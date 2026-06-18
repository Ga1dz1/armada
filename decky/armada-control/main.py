import configparser
import copy
import json
import os
import shutil
import shlex
import subprocess
import tempfile
import time
from pathlib import Path


POWER_CONFIG = Path("/etc/armada/power-profiles.conf")
FACTORY_POWER_CONFIG = Path("/usr/share/armada/power-profiles.conf")
TWEAKS_CONFIG = Path("/etc/armada/game-tweaks.json")
FEX_PROFILES_CONFIG = Path("/usr/share/armada/fex-profiles.json")
PLUGIN_FEX_PROFILES_CONFIG = Path(__file__).with_name("fex-profiles.json")
STEAM_ROOT = Path("/var/home/armada/.local/share/Steam")
STEAM_APPS_DIR = STEAM_ROOT / "steamapps"
PROFILES = ("quiet", "balanced", "performance")


def atomically_write(path, text, mode=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
        if mode is not None:
            os.chmod(tmp, mode)
        os.replace(tmp, path)
    finally:
        try:
            os.unlink(tmp)
        except FileNotFoundError:
            pass


def load_fex_contract():
    path = FEX_PROFILES_CONFIG if FEX_PROFILES_CONFIG.exists() else PLUGIN_FEX_PROFILES_CONFIG
    with path.open(encoding="utf-8") as f:
        contract = json.load(f)
    profiles = contract.get("profiles")
    if not isinstance(contract.get("defaults"), dict) or not isinstance(profiles, dict) or "default" not in profiles:
        raise ValueError("invalid FEX profile contract")
    for profile in profiles.values():
        if not isinstance(profile, dict) or not isinstance(profile.get("config"), dict):
            raise ValueError("invalid FEX profile contract")
    return contract


def fex_profile_labels(contract):
    return {
        name: {"label": profile.get("label", name.title())}
        for name, profile in contract["profiles"].items()
        if isinstance(profile, dict)
    }


def restore_factory_power_config(reason):
    if not POWER_CONFIG.exists() or not FACTORY_POWER_CONFIG.exists():
        raise reason
    backup = POWER_CONFIG.with_name(f"{POWER_CONFIG.name}.invalid-{time.strftime('%Y%m%d-%H%M%S')}")
    try:
        shutil.copy2(POWER_CONFIG, backup)
        shutil.copy2(FACTORY_POWER_CONFIG, POWER_CONFIG)
    except OSError:
        raise reason


def parse_power(path=None, repair=True):
    parser = configparser.ConfigParser()
    paths = [path] if path is not None else [FACTORY_POWER_CONFIG, POWER_CONFIG]
    try:
        if not parser.read([candidate for candidate in paths if candidate.exists()]):
            raise FileNotFoundError(path or FACTORY_POWER_CONFIG)
        return parsed_power(parser)
    except Exception as exc:
        if path is None and repair:
            restore_factory_power_config(exc)
            return parse_power(FACTORY_POWER_CONFIG, repair=False)
        raise


def parsed_power(parser):
    for section in ("general", "fan"):
        if not parser.has_section(section):
            raise ValueError(f"missing config section [{section}]")
    data = {
        "general": {"default_profile": parser.get("general", "default_profile")},
        "profiles": {},
        "fan_curves": {},
        "fan": {},
        "underclocks": {},
    }
    for name in PROFILES:
        section = f"profile.{name}"
        if not parser.has_section(section):
            raise ValueError(f"missing config section [{section}]")
        data["profiles"][name] = {
            "cpu_governor": parser.get(section, "cpu_governor"),
            "cpu_max": parser.get(section, "cpu_max"),
            "cpu_underclock": parser.get(section, "cpu_underclock"),
            "gpu_max": parser.get(section, "gpu_max"),
            "gpu_min": parser.get(section, "gpu_min"),
            "fan_curve": parser.get(section, "fan_curve"),
        }
    for section in parser.sections():
        if section.startswith("fan_curve."):
            name = section.split(".", 1)[1]
            data["fan_curves"][name] = parser.get(section, "curve")
            continue
        if not section.startswith("underclock."):
            continue
        parts = section.split(".")
        if len(parts) == 3:
            _, device_class, level = parts
            data["underclocks"].setdefault(device_class, {})[level] = dict(parser.items(section))
    data["fan"] = dict(parser.items("fan"))
    return data


def render_power(data):
    parser = configparser.ConfigParser()
    parser.optionxform = str
    parser["general"] = {"default_profile": data["general"]["default_profile"]}
    for name in PROFILES:
        profile = data["profiles"][name]
        parser[f"profile.{name}"] = {
            "cpu_governor": str(profile["cpu_governor"]),
            "cpu_max": str(profile["cpu_max"]),
            "cpu_underclock": str(profile["cpu_underclock"]),
            "gpu_max": str(profile["gpu_max"]),
            "gpu_min": str(profile["gpu_min"]),
            "fan_curve": str(profile["fan_curve"]),
        }
    for name in sorted(data.get("fan_curves", {})):
        parser[f"fan_curve.{name}"] = {"curve": str(data["fan_curves"][name])}
    parser["fan"] = {str(k): str(v) for k, v in data["fan"].items()}
    for device_class in sorted(data.get("underclocks", {})):
        levels = data["underclocks"][device_class]
        for level in sorted(levels):
            parser[f"underclock.{device_class}.{level}"] = {
                str(k): str(v) for k, v in levels[level].items()
            }
    with tempfile.TemporaryFile("w+", encoding="utf-8") as f:
        parser.write(f)
        f.seek(0)
        return f.read()


def load_tweaks():
    contract = load_fex_contract()
    profiles = contract["profiles"]
    try:
        with TWEAKS_CONFIG.open(encoding="utf-8") as f:
            loaded = json.load(f)
    except (OSError, ValueError):
        return copy.deepcopy(contract["defaults"])
    data = copy.deepcopy(contract["defaults"])
    if isinstance(loaded, dict):
        if isinstance(loaded.get("global"), dict):
            data["global"].update(loaded["global"])
        if isinstance(loaded.get("games"), dict):
            data["games"] = loaded["games"]
    if data["global"].get("fexProfile") not in profiles:
        data["global"]["fexProfile"] = "default"
    for game in data["games"].values():
        if not isinstance(game, dict):
            continue
        game["enabled"] = bool(game.get("enabled", False))
        if game.get("fexProfile") not in profiles:
            game.pop("fexProfile", None)
    return data


def installed_games():
    steamapps_dirs = {STEAM_APPS_DIR}
    for library_file in (STEAM_APPS_DIR / "libraryfolders.vdf", STEAM_ROOT / "config/libraryfolders.vdf"):
        try:
            lines = library_file.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            continue
        for line in lines:
            parts = line.strip().split('"')
            if len(parts) >= 4 and parts[1] == "path":
                steamapps_dirs.add(Path(parts[3]) / "steamapps")
    games = []
    seen = set()
    for steamapps_dir in sorted(steamapps_dirs):
        for manifest in sorted(steamapps_dir.glob("appmanifest_*.acf")):
            values = {}
            try:
                lines = manifest.read_text(encoding="utf-8", errors="replace").splitlines()
            except OSError:
                continue
            for line in lines:
                parts = line.strip().split('"')
                if len(parts) >= 4 and parts[1] in ("appid", "name"):
                    values[parts[1]] = parts[3]
            appid = values.get("appid")
            name = values.get("name")
            if appid and name and appid not in seen:
                games.append({"appid": str(appid), "name": name})
                seen.add(appid)
    return sorted(games, key=lambda game: game["name"].casefold())


def factory_power_defaults():
    try:
        return parse_power(FACTORY_POWER_CONFIG)
    except OSError:
        return parse_power()


def cpu_device_class():
    return device_env().get("ARMADA_SOC_CLASS", "")


def device_env():
    helper = os.environ.get("ARMADA_DEVICE_ENV", "/usr/libexec/armada/device-env")
    proc = subprocess.run(
        [helper],
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    env = {}
    for line in proc.stdout.splitlines():
        if "=" in line:
            key, value = line.split("=", 1)
            env[key] = shlex.split(value)[0] if value else ""
    return env


def ssh_enabled():
    enabled = subprocess.run(
        ["systemctl", "is-enabled", "sshd"],
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    ).stdout.strip()
    active = subprocess.run(
        ["systemctl", "is-active", "sshd"],
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    ).stdout.strip()
    return enabled == "enabled" or active == "active"


class Plugin:
    async def get_config(self):
        fex_contract = load_fex_contract()
        return {
            "power": parse_power(),
            "powerDefaults": factory_power_defaults(),
            "tweaks": load_tweaks(),
            "installedGames": installed_games(),
            "fexProfiles": fex_profile_labels(fex_contract),
            "cpuDeviceClass": cpu_device_class(),
            "sshEnabled": ssh_enabled(),
        }

    async def save_power_config(self, data):
        atomically_write(POWER_CONFIG, render_power(data))
        subprocess.run(["/usr/bin/armada-power", "reload"], check=True)
        return await self.get_config()

    async def save_tweaks(self, data):
        atomically_write(TWEAKS_CONFIG, json.dumps(data, indent=2, sort_keys=True) + "\n", 0o644)
        return await self.get_config()

    async def set_ssh_enabled(self, enabled):
        command = ["systemctl", "enable", "--now", "sshd"] if enabled else ["systemctl", "disable", "--now", "sshd"]
        subprocess.run(command, check=True)
        return ssh_enabled()
