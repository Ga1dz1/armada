const React = window.SP_REACT;
const DFL = window.DFL || {};
const {
  ButtonItem,
  Dropdown,
  Field,
  PanelSection,
  PanelSectionRow,
  SliderField,
  Tabs,
  ToggleField,
  Router,
} = DFL;

const e = React.createElement;
const backend = window.__DECKY_SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED_deckyLoaderAPIInit.connect(2, "Armada Control");
const tabs = ["Compatibility", "Power", "Advanced"];
const underclocks = [
  { data: "none", label: "None" },
  { data: "small", label: "Small" },
  { data: "medium", label: "Medium" },
  { data: "large", label: "Large" },
];
const resolutionOptions = [
  { data: "Default", label: "Default" },
  { data: "Native", label: "Native" },
  { data: "1280x720", label: "1280x720" },
  { data: "960x540", label: "960x540" },
];
const dxOptions = [
  { data: "dxvk", label: "DXVK" },
  { data: "wined3d", label: "WineD3D" },
];
function Icon({ path }) {
  return e("svg", {
    style: { display: "block" },
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  }, path);
}

const tabIcons = {
  Compatibility: Icon({ path: e(React.Fragment, null,
    e("line", { x1: "6", x2: "10", y1: "11", y2: "11" }),
    e("line", { x1: "8", x2: "8", y1: "9", y2: "13" }),
    e("line", { x1: "15", x2: "15.01", y1: "12", y2: "12" }),
    e("line", { x1: "18", x2: "18.01", y1: "10", y2: "10" }),
    e("path", { d: "M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" }),
  ) }),
  Power: Icon({ path: e(React.Fragment, null,
    e("path", { d: "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" }),
  ) }),
  Advanced: Icon({ path: e(React.Fragment, null,
    e("path", { d: "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" }),
    e("circle", { cx: "12", cy: "12", r: "3" }),
  ) }),
};

// Steam's QAM profile dropdown over-expands on armada; Decky has no stable hook for that row.
function installQamFix(styleId, attr, profileIds) {
  const css = `
    [data-armada-qam-profile-fix] { min-width: 0 !important; }
    [data-armada-qam-profile-fix="value"] {
      flex: 0 0 154px !important;
      width: 154px !important;
      min-width: 154px !important;
      max-width: 154px !important;
      overflow: hidden !important;
    }
    [data-armada-qam-profile-fix="value"] > *,
    [data-armada-qam-profile-fix="value"] [role="combobox"],
    [data-armada-qam-profile-fix="value"] .DialogDropDown,
    [data-armada-qam-profile-fix="value"] .DialogButton {
      width: 100% !important;
      min-width: 0 !important;
      max-width: 100% !important;
    }
    [data-armada-qam-profile-fix="value"] button,
    [data-armada-qam-profile-fix="value"] .DialogButton {
      width: 100% !important;
    }
    [data-armada-qam-profile-fix="value"] .DialogDropDown_CurrentDisplay {
      max-width: 100% !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
      text-transform: capitalize !important;
      font-size: 16px !important;
    }
    [data-armada-qam-profile-fix="menu"] [role="option"],
    [data-armada-qam-profile-fix="menu"] .contextMenuItem {
      text-transform: capitalize !important;
    }
  `;
  function installStyle() {
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = css;
  }
  function tagRows() {
    const rows = document.querySelectorAll(".Panel.Focusable, .quickaccesscontrols_Panel_3aLED");
    for (const row of rows) {
      const labels = Array.from(row.querySelectorAll("div, span")).filter((node) => node.textContent?.trim() === "Performance Profile");
      if (!labels.length) continue;
      row.setAttribute(attr, "row");
      const combo = row.querySelector('[role="combobox"], .DialogDropDown');
      let value = combo;
      for (let i = 0; i < 3 && value?.parentElement && value.parentElement !== row; i += 1) {
        value = value.parentElement;
      }
      if (value) value.setAttribute(attr, "value");
    }
    for (const listbox of document.querySelectorAll('[role="listbox"]')) {
      const options = Array.from(listbox.querySelectorAll('[role="option"]'));
      const texts = new Set(options.map((node) => node.textContent?.trim()).filter(Boolean));
      if (profileIds.length && profileIds.every((profile) => texts.has(profile))) {
        listbox.setAttribute(attr, "menu");
      }
    }
  }
  installStyle();
  tagRows();
  window.__armadaQamProfileFixObserver?.disconnect?.();
  window.__armadaQamProfileFixObserver = new MutationObserver(tagRows);
  window.__armadaQamProfileFixObserver.observe(document.body, { childList: true, subtree: true });
}

function installQamProfileFix(profileIds) {
  const qamScript = `(${installQamFix.toString()})("armada-qam-profile-fix-style", "data-armada-qam-profile-fix", ${JSON.stringify(profileIds)})`;
  backend.executeInTab("QuickAccess_uid2", false, qamScript).catch(() => {});
  backend.executeInTab("Steam Big Picture Mode", false, qamScript).catch(() => {});
}

backend.call("get_config").then((config) => {
  installQamProfileFix(Object.keys(config.power.profiles || {}));
}).catch(() => {});

function cleanupQamFix() {
  const script = `
    window.__armadaQamProfileFixObserver?.disconnect?.();
    delete window.__armadaQamProfileFixObserver;
    document.getElementById("armada-qam-profile-fix-style")?.remove();
    document.querySelectorAll("[data-armada-qam-profile-fix]").forEach((node) => node.removeAttribute("data-armada-qam-profile-fix"));
  `;
  backend.executeInTab("QuickAccess_uid2", false, script).catch(() => {});
  backend.executeInTab("Steam Big Picture Mode", false, script).catch(() => {});
}

function SelectEdit({ label, value, options, onChange }) {
  const rgOptions = options.map((option) => (
    typeof option === "string" ? { data: option, label: option } : option
  ));
  return e(PanelSectionRow, null, e(Dropdown, {
    label,
    selectedOption: value,
    rgOptions,
    onChange: (option) => onChange(option.data),
  }));
}

function ToggleRow({ label, value, onChange, disabled, description }) {
  return e(PanelSection, null,
    e(ToggleField, { label, description, checked: !!value, disabled, onChange }),
  );
}

function ToggleEdit({ label, value, onChange, disabled, description }) {
  return e(ToggleField, { label, description, checked: !!value, disabled, onChange });
}

function SliderEdit({ label, value, min, max, step, onChange, format }) {
  const numeric = Number(value);
  return e(PanelSectionRow, null,
    e("div", { className: "armada-slider-field" },
      e(SliderField, {
        label,
        value: Number.isFinite(numeric) ? numeric : min,
        min,
        max,
        step,
        showValue: true,
        onChange: (next) => onChange(format ? format(next) : next),
      }),
    ),
  );
}

function StatusRow({ message }) {
  if (!message) return null;
  return e("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      padding: "0 16px 12px",
      minHeight: "24px",
    },
  },
    e("div", { style: { opacity: 0.85, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" } }, message),
  );
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function update(obj, path, value) {
  const next = clone(obj);
  let cursor = next;
  for (let i = 0; i < path.length - 1; i += 1) cursor = cursor[path[i]];
  cursor[path[path.length - 1]] = value;
  return next;
}

function titleCase(value) {
  const text = String(value || "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function gameDisplayName(game) {
  if (!game?.appid) return "";
  return game.name || `App ${game.appid}`;
}

function availableGames(config) {
  const games = new Map();
  for (const game of config.installedGames || []) {
    if (game?.appid) games.set(String(game.appid), { appid: String(game.appid), name: game.name || `App ${game.appid}` });
  }
  for (const [appid, game] of Object.entries(config.tweaks?.games || {})) {
    if (game && typeof game === "object") games.set(String(appid), { appid: String(appid), name: game.name || games.get(String(appid))?.name || `App ${appid}` });
  }
  return Array.from(games.values()).sort((a, b) => gameDisplayName(a).localeCompare(gameDisplayName(b)));
}

function editTargetOptions(config) {
  return [
    { data: "", label: "Default" },
    ...availableGames(config).map((game) => ({ data: game.appid, label: gameDisplayName(game) })),
  ];
}

function fexProfileOptions(config) {
  return Object.entries(config.fexProfiles || {}).map(([id, profile]) => ({
    data: id,
    label: profile.label || titleCase(id),
  }));
}

function currentGame() {
  const running = Router?.MainRunningApp || window.Router?.MainRunningApp;
  const appid = running?.appid;
  if (!appid) return null;
  const id = String(appid);
  let name = running?.display_name || running?.displayName || "";
  try {
    const details = window.appDetailsStore?.GetAppDetails?.(Number(id));
    name = details?.strDisplayName || details?.strName || details?.name || name;
  } catch (error) {
  }
  return { appid: id, name: name || `App ${id}` };
}

function Compatibility({ config, setConfig }) {
  const [resolution, setResolution] = React.useState("Default");
  const [resolutionMessage, setResolutionMessage] = React.useState("");
  const runtimeGame = config.game;
  const games = availableGames(config);
  const selectedGame = config.selectedGame || runtimeGame || null;
  const game = selectedGame;
  const gameName = gameDisplayName(game);
  const tweaks = config.tweaks;
  const apps = window.SteamClient?.Apps;
  React.useEffect(() => {
    let cancelled = false;
    async function loadResolution() {
      if (!game?.appid || !apps?.GetResolutionOverrideForApp) {
        setResolution("Default");
        setResolutionMessage("");
        return;
      }
      try {
        const current = await apps.GetResolutionOverrideForApp(Number(game.appid));
        if (!cancelled) {
          setResolution(current || "Default");
          setResolutionMessage("");
        }
      } catch (error) {
        if (!cancelled) setResolutionMessage("Resolution override is unavailable");
      }
    }
    loadResolution();
    return () => {
      cancelled = true;
    };
  }, [apps, game?.appid]);
  const gameSettings = game?.appid ? tweaks.games[game.appid] || {} : {};
  const editingDefault = !game?.appid;
  const perGameEnabled = !!(game?.appid && gameSettings.enabled === true);
  const values = editingDefault || !perGameEnabled ? tweaks.global : { ...tweaks.global, ...gameSettings };
  const setValue = (name, value) => {
    setConfig((current) => {
      if (!current) return current;
      const next = clone(current);
      if (editingDefault) {
        next.tweaks.global[name] = value;
      } else if (perGameEnabled) {
        next.tweaks.games[game.appid] = { ...(next.tweaks.games[game.appid] || {}), enabled: true, [name]: value, name: game.name || "" };
      }
      return next;
    });
  };
  const setPerGameEnabled = async (enabled) => {
    if (!game?.appid) return;
    setConfig((current) => {
      if (!current) return current;
      const next = clone(current);
      next.tweaks.games[game.appid] = {
        ...(next.tweaks.games[game.appid] || {}),
        enabled,
        name: game.name || "",
      };
      return next;
    });
    if (!enabled && apps?.SetAppResolutionOverride) {
      try {
        await apps.SetAppResolutionOverride(Number(game.appid), "Default");
        setResolution("Default");
        setResolutionMessage("");
      } catch (error) {
        setResolutionMessage("Failed to clear resolution override");
      }
    }
  };
  const setSteamResolution = async (value) => {
    setResolution(value);
    if (!game?.appid || !apps?.SetAppResolutionOverride) return;
    try {
      await apps.SetAppResolutionOverride(Number(game.appid), value);
      setResolutionMessage("");
    } catch (error) {
      setResolutionMessage("Failed to set resolution override");
    }
  };
  const hostThunks = values.hostThunks !== false;
  const gameOptions = editTargetOptions(config);
  const setSelectedGame = (appid) => {
    const saved = games.find((candidate) => candidate.appid === String(appid));
    setConfig((current) => current ? { ...current, selectedGame: saved || null } : current);
  };
  return e(React.Fragment, null,
    e(PanelSection, { title: "EDIT GAME PROFILE" },
      SelectEdit({ label: "Game", value: game?.appid || "", options: gameOptions, onChange: setSelectedGame }),
      e("div", { className: "armada-compat-note" }, "Compatibility changes apply on next launch"),
      !editingDefault ? e(ToggleField, {
        label: "Use per-game settings",
        checked: perGameEnabled,
        onChange: setPerGameEnabled,
      }) : null,
    ),
    !editingDefault && perGameEnabled ? e(PanelSection, { title: "Resolution" },
      SelectEdit({
        label: "Game resolution",
        value: resolution,
        options: resolutionOptions,
        onChange: setSteamResolution,
      }),
      resolutionMessage ? e(Field, { label: "Status", description: resolutionMessage }) : null,
    ) : null,
    (editingDefault || perGameEnabled) ? e(PanelSection, { title: "FEX" },
      SelectEdit({
        label: "Profile",
        value: values.fexProfile || "default",
        options: fexProfileOptions(config),
        onChange: (v) => setValue("fexProfile", v),
      }),
      ToggleEdit({
        label: "Host thunks",
        value: hostThunks,
        onChange: (enabled) => setValue("hostThunks", enabled),
      }),
    ) : null,
    (editingDefault || perGameEnabled) ? e(PanelSection, { title: "Proton" },
      SelectEdit({ label: "DirectX 9-11 renderer", value: values.dxBackend, options: dxOptions, onChange: (v) => setValue("dxBackend", v) }),
    ) : null,
  );
}

function Power({ config, setConfig }) {
  const [profile, setProfile] = React.useState(config.power.general.default_profile || "balanced");
  const p = config.power.profiles[profile] || {};
  const profiles = Object.keys(config.power.profiles || {}).map((name) => ({
    data: name,
    label: titleCase(name),
  }));
  const fanCurves = Object.keys(config.power.fan_curves || {}).map((name) => ({
    data: name,
    label: name.charAt(0).toUpperCase() + name.slice(1),
  }));
  const setProfileValue = (name, value) => {
    setConfig((current) => current ? update(current, ["power", "profiles", profile, name], value) : current);
  };
  const setGpuValue = (name, value) => {
    setConfig((current) => {
      if (!current) return current;
      const next = clone(current);
      const target = next.power.profiles[profile];
      target[name] = value;
      if (name === "gpu_min" && Number(value) > Number(target.gpu_max || 0)) {
        target.gpu_max = value;
      }
      if (name === "gpu_max" && Number(value) < Number(target.gpu_min || 0)) {
        target.gpu_min = value;
      }
      return next;
    });
  };
  const resetProfile = () => {
    const defaults = config.powerDefaults?.profiles?.[profile];
    if (!defaults) return;
    setConfig((current) => current ? update(current, ["power", "profiles", profile], defaults) : current);
  };
  const underclockLevel = p.cpu_underclock || "";
  const supportsUnderclockPresets = !!config.power.underclocks?.[config.cpuDeviceClass];
  const profileLabel = titleCase(profile);
  return e(React.Fragment, null,
    e(PanelSection, { title: "EDIT POWER PROFILE" },
      SelectEdit({ label: "Edit profile", value: profile, options: profiles, onChange: setProfile }),
    ),
    e("div", { className: "armada-profile-settings" },
      e(PanelSection, { title: "Fan Profile" },
        SelectEdit({ label: "Fan profile", value: p.fan_curve, options: fanCurves, onChange: (v) => setProfileValue("fan_curve", v) }),
      ),
      supportsUnderclockPresets ? e(PanelSection, { title: "CPU Underclock" },
        SelectEdit({ label: "CPU Underclock", value: underclockLevel, options: underclocks, onChange: (v) => setProfileValue("cpu_underclock", v) }),
      ) : e(PanelSection, null,
        SliderEdit({ label: "CPU Max (%)", value: Math.round(Number(p.cpu_max || 0) * 100), min: 35, max: 100, step: 1, onChange: (v) => setProfileValue("cpu_max", (v / 100).toFixed(2)) }),
      ),
      e(PanelSection, null,
        SliderEdit({ label: "GPU Min (%)", value: Math.round(Number(p.gpu_min || 0) * 100), min: 0, max: 100, step: 1, onChange: (v) => setGpuValue("gpu_min", (v / 100).toFixed(2)) }),
        SliderEdit({ label: "GPU Max (%)", value: Math.round(Number(p.gpu_max || 0) * 100), min: 35, max: 100, step: 1, onChange: (v) => setGpuValue("gpu_max", (v / 100).toFixed(2)) }),
      ),
      e("div", { className: "armada-reset-row" },
        e(ButtonItem, { layout: "below", onClick: resetProfile }, `Reset ${profileLabel} defaults`),
      ),
    ),
  );
}

function Settings({ config, setConfig, setMessage }) {
  const setSshEnabled = async (enabled) => {
    setConfig((current) => current ? { ...current, sshEnabled: enabled } : current);
    setMessage("Saving");
    try {
      const applied = await backend.call("set_ssh_enabled", enabled);
      setConfig((current) => current ? { ...current, sshEnabled: applied } : current);
      setMessage("Saved");
    } catch (error) {
      setConfig((current) => current ? { ...current, sshEnabled: !enabled } : current);
      setMessage(String(error));
    }
  };
  return e(React.Fragment, null,
    ToggleRow({
      label: "Enable SSH",
      value: !!config.sshEnabled,
      onChange: setSshEnabled,
    }),
  );
}

function Content() {
  const [tab, setTab] = React.useState("Compatibility");
  const [config, setConfig] = React.useState(null);
  const [message, setMessage] = React.useState("Loading");
  const savedPowerSnapshot = React.useRef("");
  const savedTweaksSnapshot = React.useRef("");
  const load = React.useCallback(async () => {
    setMessage("Loading");
    try {
      const next = await backend.call("get_config");
      next.game = currentGame();
      next.selectedGame = next.game || null;
      savedPowerSnapshot.current = JSON.stringify(next.power);
      savedTweaksSnapshot.current = JSON.stringify(next.tweaks);
      setConfig(next);
      setMessage("");
    } catch (error) {
      setMessage(String(error));
    }
  }, []);
  React.useEffect(() => {
    load();
  }, [load]);
  React.useEffect(() => {
    if (!config) return;
    let cancelled = false;
    const refreshRuntime = async () => {
      try {
        const runtimeGame = currentGame();
        if (cancelled) return;
        setConfig((current) => {
          if (!current) return current;
          const currentApp = current.game?.appid || "";
          const nextApp = runtimeGame?.appid || "";
          const currentName = current.game?.name || "";
          const nextName = runtimeGame?.name || "";
          if (currentApp === nextApp && currentName === nextName) return current;
          return { ...current, game: runtimeGame, selectedGame: runtimeGame || current.selectedGame };
        });
      } catch (error) {
      }
    };
    const timer = window.setInterval(refreshRuntime, 2000);
    refreshRuntime();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [!!config]);
  React.useEffect(() => {
    if (!config || !savedPowerSnapshot.current) return;
    const snapshot = JSON.stringify(config.power);
    if (snapshot === savedPowerSnapshot.current) return;
    setMessage("Saving");
    const timer = window.setTimeout(async () => {
      try {
        const next = await backend.call("save_power_config", config.power);
        savedPowerSnapshot.current = JSON.stringify(next.power);
        setConfig((current) => current ? { ...current, power: next.power } : next);
        setMessage("Saved");
      } catch (error) {
        setMessage(String(error));
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [config && config.power]);
  React.useEffect(() => {
    if (!config || !savedTweaksSnapshot.current) return;
    const snapshot = JSON.stringify(config.tweaks);
    if (snapshot === savedTweaksSnapshot.current) return;
    setMessage("Saving");
    const timer = window.setTimeout(async () => {
      try {
        const next = await backend.call("save_tweaks", config.tweaks);
        savedTweaksSnapshot.current = JSON.stringify(next.tweaks);
        setConfig((current) => current ? { ...current, tweaks: next.tweaks } : next);
        setMessage("Saved");
      } catch (error) {
        setMessage(String(error));
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [config && config.tweaks]);
  if (!config) return e(PanelSection, { title: "Armada Control" }, e(Field, { label: message }));
  const tabContent = (content) => e("div", { className: "armada-control-tab-content" },
    e(StatusRow, { message }),
    content,
  );
  return e("div", { className: "armada-control-tabs" },
    e("style", null, `
      .armada-control-tabs {
        height: 95%;
        width: 316px;
        position: fixed;
        margin-top: -12px;
        margin-left: -8px;
        overflow: hidden;
      }
      .armada-control-tabs > div > div:first-child::before {
        background: #0D141C;
        box-shadow: none;
        backdrop-filter: none;
      }
      .armada-control-tabs [role="tabpanel"] {
        padding-left: 0 !important;
        padding-right: 0 !important;
      }
      .armada-control-tabs .armada-control-tab-content {
        padding-bottom: 24px;
      }
      .armada-control-tabs .armada-profile-settings {
        margin: 0 0 10px 16px;
        padding: 0 0 2px 2px;
        border-left: 2px solid rgba(255, 255, 255, 0.22);
      }
      .armada-control-tabs .armada-profile-settings > div {
        margin-left: -10px;
      }
      .armada-control-tabs .armada-slider-field {
        width: 100%;
        max-width: none;
        overflow: hidden;
      }
      .armada-control-tabs .armada-slider-field * {
        min-width: 0 !important;
        max-width: 100% !important;
      }
      .armada-control-tabs .armada-reset-row {
        padding: 0 14px 8px;
      }
      .armada-control-tabs .armada-note {
        padding: 0 16px 6px;
        font-size: 12px;
        line-height: 16px;
        opacity: 0.62;
      }
      .armada-control-tabs .armada-compat-note {
        box-sizing: border-box;
        width: 100%;
        padding: 8px 16px 8px;
        font-size: 12px;
        line-height: 16px;
        opacity: 0.62;
        text-align: left;
        justify-content: flex-start;
        align-self: stretch;
      }
    `),
    e(Tabs, {
      activeTab: tab,
      onShowTab: setTab,
      tabs: [
        { id: "Compatibility", title: tabIcons.Compatibility, content: tabContent(e(Compatibility, { config, setConfig })) },
        { id: "Power", title: tabIcons.Power, content: tabContent(e(Power, { config, setConfig })) },
        { id: "Advanced", title: tabIcons.Advanced, content: tabContent(e(Settings, { config, setConfig, setMessage })) },
      ],
    }),
  );
}

export default function Plugin() {
  return {
    name: "Armada Control",
    content: e(Content),
    icon: e("div", { style: { fontWeight: 700 } }, "A"),
    alwaysRender: true,
    onDismount: cleanupQamFix,
  };
}
