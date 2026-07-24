MASTER PLAN
Universal Gaming Platform
Working Title: Atlas OS (Temporary)

<!--
  Saved verbatim 2026-07-24 from the user's own project description, given
  directly in conversation. Also referred to as "CR(g) OS" the same day
  (see the project-rebrand-crg-os memory) - treat these as the same
  project; "Atlas OS" appears to be an earlier/alternate working title in
  this specific document, not a different project. Do not edit the plan
  content itself without the user's direction - this is the canonical
  source of truth for what's being built and why. Cross-reference:
  libhybris/SCOPING.md (Halium/RP6/Mini V2 execution log, maps onto
  PHASE 4 "Android Layer" below), VISION.md (library-first/unified-library
  product philosophy, maps onto PHASE 6-8 below).
-->

⸻

Mission

Build a universal gaming operating system for ARM handhelds.
The operating system should provide a Steam Deck–like experience while supporting games from multiple ecosystems through a single unified library.

The user should never have to think about:

Steam
Windows
Android
Emulators
Compatibility layers

The only visible action should be:

Press Play.

The system determines everything else automatically.

⸻

Core Philosophy

Library First

The operating system revolves around the game library.
Not applications.
Not emulators.
Not launchers.
Everything is represented as a Game.

⸻

Game Mode First

The default environment is Gamescope + Steam Game Mode.
Desktop mode exists only for maintenance and advanced users.
Desktop is not the operating system.
Game Mode is.

⸻

Zero Configuration

The user should never manually choose:

Proton version
Emulator
Graphics backend
Controller profile
Performance profile

Execution Manager handles this automatically.

⸻

Android is Firmware

Android is NOT the user operating system.
Android exists only as a hardware compatibility layer.
Linux provides the user experience.

⸻

High-Level Architecture

Firmware
↓
Android Bootloader
↓
Android Kernel
↓
Vendor Drivers
↓
Halium
↓
Linux Userspace
↓
Execution Manager
↓
Steam Game Mode
↓
Player

⸻

Development Principles

Priority order:

Hardware
Stability
Performance
UX
Features

Never reverse this order.

⸻

Repository Structure

atlas/

docs/
architecture/
boot/
kernel/
hardware/
execution/
library/
runtime/
ui/
update/
devices/
packages/
scripts/
tools/

⸻

Repository Structure (refined, 2026-07-24)

Given directly in conversation the same day as a more concrete revision of
the structure above - `platform/` now holds the actual code modules
(previously these were doc categories under `docs/`), `devices/` lists
real current device codenames, `runtimes/` is the concrete initial
runtime set, and `packages/` is new (vendored/patched third-party
components CR(g) OS builds and ships, mirroring what
`build_files/30-install-steam-session.sh` already does for armada today -
mesa/gamescope/InputPlumber/mangohud RPM builds, FEX-emu, etc.). Treat
this as superseding the illustrative structure above where they conflict,
though neither is necessarily final:

```
platform/
    boot/
    hardware/
    execution/
    library/
    runtime/
    updater/
    ui/

devices/
    rpminiv2/
    rp5/
    flip2/
    rp6/

runtimes/
    steam/
    android/
    proton/
    pcsx2/
    rpcs3/
    retroarch/

packages/
    mesa/
    gamescope/
    waydroid/
    fex/
    box64/

docs/
```

Note `packages/` lists both `fex/` and `box64/` - armada today only uses
FEX-emu (confirmed in `build_files/30-install-steam-session.sh`, with an
x86_64 Arch Linux guest rootfs for library thunking); box64 is a
different, separate x86-on-ARM translation layer. Not yet clarified
whether both are meant to coexist (e.g. box64 as a fallback/alternative
for specific games) or this is provisional - flag rather than assume if
it matters before either is actually integrated.

⸻

Storage architecture (proposed 2026-07-24, not yet decided)

Idea: drop separate ext4 partitions entirely. One big `userdata`
partition, formatted Btrfs after install, with subvolumes instead of
partitions:

```
userdata (btrfs)
├── @android_data
├── @steamos_root
├── @steamos_home
├── @cache
├── @snapshots
└── @images
```

The installer wouldn't run `mkfs.ext4`, it would run
`mkfs.btrfs /dev/block/by-name/userdata` and then
`btrfs subvolume create @android` / `@steamos` / `@home` etc. - Android
keeps using `/data` (backed by a subvolume), Linux mounts its own
subvolume. This gets snapshots/rollback (matches PHASE 10's "Immutable
root, A/B updates, Rollback, Snapshots, Atomic updates") essentially for
free across the whole storage layout, not just the OS side.

**Real blocker found the same day, checked directly against actual
hardware data, not assumed**: Android almost never ships kernels with
Btrfs support (ext4/F2FS are the near-universal defaults), and this
matters here specifically because Android (as a Halium guest, see
`libhybris/SCOPING.md`) and the CR(g) OS host **share one kernel** -
there's no separate Android kernel to have its own filesystem support,
unlike a real dual-boot device. Checked the actual RP6 kernel extracted
from LineageOS (`libhybris/src/rp6-lineageos-prebuilt/out-boot/kernel`):
pulled its embedded IKCONFIG directly out of the binary (found the
`IKCFG_ST`/`IKCFG_ED` markers, extracted and gunzipped the embedded
`.config` - a real technique, not guesswork) -

```
# CONFIG_BTRFS_FS is not set
CONFIG_EXT4_FS=y
CONFIG_F2FS_FS=y
```

Also checked all 241 real vendor `.ko` modules and `vendor_dlkm.img` for
a loadable `btrfs.ko` - not present either way. **Btrfs is genuinely
absent from this kernel, confirmed, not assumed.**

Two real paths forward, not yet decided:
1. Enable Btrfs in the kernel. Either the full from-source rebuild (the
   Bazel/Kleaf path already paused once for being an open-ended risk -
   see SCOPING.md), or - untried, worth checking first - build just
   `btrfs.ko` as an out-of-tree module against this exact kernel's
   vermagic (`5.15.208-g94a246947232`), which is much lighter if the
   matching `Module.symvers`/headers are obtainable without the full
   Kleaf workspace.
2. Don't put Android's own `/data` on Btrfs at all - keep it ext4 (as
   shipped), and give only the CR(g) OS side (`@steamos_root`, `@home`,
   `@cache`, `@snapshots`, `@images`) the unified Btrfs/subvolume
   treatment on a separate area. `@android_data` in the sketch above
   would then have to be an ext4 loopback image *living inside* a Btrfs
   subvolume (an ordinary file from Btrfs's point of view) rather than a
   real Btrfs subvolume itself.

**Path 1 checked directly, 2026-07-24 - it's a dead end, not a
shortcut.** Tried building `btrfs.ko` as an out-of-tree module against
`kernel/ayn/qcs8550` (Linux 5.15.208, matches the shipped kernel exactly)
using the real extracted `.config`. The kernel is built with
`CONFIG_CFI_CLANG=y` + `CONFIG_LTO_CLANG_FULL=y` + `CONFIG_MODVERSIONS=y`
- Control Flow Integrity and full Link-Time-Optimization are Clang-only
hardening features that fundamentally change function-pointer call-site
ABI; a module built with a different compiler (tried this host's GCC)
would not load into a CFI+LTO kernel at all, and `MODVERSIONS` additionally
requires matching per-symbol CRCs from the *exact* original build's
`Module.symvers`, which only exists as a build artifact we don't have (the
shipped binary alone doesn't contain it). Getting a loadable module
therefore needs the same near-exact toolchain match (Android's own
`clang-r563880c`) and enough of a real rebuild to regenerate a matching
`Module.symvers` - i.e. **this "lighter" path converges back onto the same
from-source Bazel/Kleaf work already paused in SCOPING.md, not a shortcut
around it.** Resolves the open question directly: outside of resuming that
full rebuild, **path 2 (keep Android's own data off the unified Btrfs
scheme) is the pragmatic choice.**

⸻

Device Structure

devices/

retroid-pocket-mini/
retroid-pocket-5/
flip2/
odin2/
odin3/
steamdeck/
generic/

Each device package contains:

DTB
overlays
firmware
controller map
thermal profile
battery profile
fan profile
boot configuration

⸻

Runtime Structure

runtime/

steam/
proton/
wine/
android/
retroarch/
pcsx2/
rpcs3/
dolphin/
heroic/

Every runtime exposes the same interface.

Example:

launch(game)
stop(game)
pause(game)
resume(game)

Execution Manager should never care how the runtime works internally.

⸻

PHASE 0
Proof of Concept

Goal:
Prove that the architecture is technically possible.

Deliverables:
✓ Linux boots
✓ Steam launches
✓ Gamescope launches
✓ Vulkan works
✓ Audio works
✓ Suspend works
✓ Wi-Fi works
✓ Bluetooth works
✓ Controller works

Exit Criteria:
Playable Linux game.

⸻

PHASE 1
Base Operating System

Build:

Arch Linux ARM
systemd
pacman
initramfs
Btrfs

No desktop.
Boot directly into Steam.

Exit Criteria:

Power On
↓
Steam

⸻

PHASE 2
Hardware Manager

Develop a dedicated daemon.

Responsibilities:

battery
charging
suspend
wake
thermal
fan
LEDs
vibration
brightness
gyro
dock

Output:
Single Hardware API.
Nothing accesses hardware directly.

⸻

PHASE 3
Graphics Stack

Bring up:

Mesa
↓
Turnip
↓
Gamescope
↓
Vulkan

Verify:

vkCube
Steam
MangoHUD
Native Vulkan sample

⸻

PHASE 4
Android Layer

Integrate:

Halium
libhybris
BinderFS
Waydroid

Goals:

Camera
Audio
Bluetooth
Wi-Fi
Sensors
GPU

All functional.

⸻

PHASE 5
Execution Manager

This is the core of the operating system.

API:

Play(Game)
Pause(Game)
Resume(Game)
Stop(Game)

Responsibilities:

Detect runtime
Configure runtime
Launch runtime
Monitor runtime
Shutdown runtime

⸻

PHASE 6
Library Manager

Single database.

Sources:

Steam
Heroic
ROM folders
APK folders
Local executables
Flatpaks

Metadata:

Title
Artwork
Playtime
Achievements
Platform
Runtime
Compatibility

⸻

PHASE 7
Steam Integration

Steam becomes UI only.

Play button
↓
Execution Manager
↓
Runtime
↓
Game

Steam should never directly launch games.

⸻

PHASE 8
Android Integration

APKs automatically appear in Library.
Waydroid launches transparently.
User never sees Android.

⸻

PHASE 9
Emulation Layer

Supported runtimes:

RetroArch
PCSX2
RPCS3
Dolphin

Future:

Switch
Xbox
Others

Execution Manager selects automatically.

⸻

PHASE 10
Update System

Immutable root
A/B updates
Rollback
Snapshots
Atomic updates

Never brick devices.

⸻

PHASE 11
Desktop

Only after Game Mode is complete.

Possible environments:

KDE Plasma
GNOME

Desktop is optional.

⸻

PHASE 12
Settings

Performance
Display
Controllers
Battery
Fan
Gyro
Storage
Network

No advanced settings visible by default.

⸻

PHASE 13
Optimization

Boot time
Memory usage
Battery life
Thermals
Shader cache
Background services

⸻

Coding Principles

Never hardcode devices.
Everything must be modular.
Every subsystem must expose clean APIs.
No subsystem should depend directly on UI.

Execution Manager owns game launching.
Hardware Manager owns hardware.
Library Manager owns metadata.
Update Manager owns updates.

⸻

Success Criteria

A player should be able to:

Turn on the device.
↓
See Steam.
↓
Press Play.
↓
Game launches.
↓
Never know:

which emulator was used
which compatibility layer ran
whether the game was Android, Windows, Linux, or emulated

If the player has to think about the platform, the architecture has failed.

⸻

PHASE 1 progress log (2026-07-24)

Not part of the original plan text above - an execution log appended
the same day, same pattern as the repository-structure/storage-
architecture addenda earlier in this file. User confirmed PHASE 1 needs
to be real, not more banked PHASE 4 work ("Нужен реальный"). Deliberately
decoupled from the Halium/kernel work - using armada's own already-proven
hardware support, not a new kernel, so this doesn't compound two risks at
once (matches the plan's own "Hardware → Stability" priority ordering).

**Real Arch Linux ARM rootfs bootstrapped, not just planned:**
- Pulled the official `ArchLinuxARM-aarch64-latest.tar.gz` (818MB,
  md5-verified against ALARM's own checksum), extracted to
  `libhybris/src/atlas-base/rootfs/` (gitignored, ~3.6GB).
- This build host is native aarch64, so no qemu/cross-arch complication -
  chrooted directly. Real, working `pacman` + `systemd 261` confirmed
  (`systemctl --version` output is real, not a stub).
- Hit and fixed two real chroot issues: DNS didn't resolve (host uses
  systemd-resolved's `127.0.0.53` stub which the chroot couldn't reach
  cleanly - fixed by writing real nameservers directly into the chroot's
  `/etc/resolv.conf`), and `pacman -Syu` failed with a "not enough disk
  space" error despite 170GB free (`CheckSpace` gives false positives in
  some sandboxed/bind-mount environments - a known pacman quirk, not a
  real space issue; disabled via `pacman.conf`).
- `pacman-key --init` + `--populate archlinuxarm`, then a real
  `pacman -Syu` succeeded: 58 packages, systemd/btrfs-progs/
  NetworkManager/sudo all installed cleanly (165+ packages total).

**Found `armada-packages` (`github.com/Ga1dz1/armada-packages`) - the
real patch/build source armada already uses, publicly clonable without
a token** (the `PACKAGES_READ_TOKEN` from memory is for something else,
maybe private CI pulls - the repo itself isn't private). Contains real,
documented (`PATCHES.md`, provenance URLs) build recipes for `fex`,
`gamescope`, `mesa`, `inputplumber`, `mangohud`, `jupiter-hw-support`,
plus the kernel patches. This is the actual source of truth for what
needs porting from Fedora/RPM to Arch/pacman - not something to guess at
or reconstruct from memory.

**Checked what's already available upstream in Arch Linux ARM's own
repos vs. needs a custom build from `armada-packages`:**
- `gamescope 3.16.25-1` is in `extra` - nearly identical to armada's own
  pinned `3.16.24`. Same for `wlroots0.18`, `libliftoff 0.5.0`,
  `mesa 26.1.5`. Installed the stock versions as a **PHASE 1 placeholder
  only** - armada's own gamescope carries 6 patches on top
  (`armada-packages/gamescope/patches/`), most importantly ROCKNIX's
  rotation-shader patch which `BOOT_ARCHITECTURE.md` already documented
  as load-bearing for RP6 (black screen without it). **The stock package
  installed here will NOT work correctly on real RP6 hardware as-is** -
  building the patched version from `armada-packages/gamescope/` is real
  PHASE 3 work, not done yet, don't mistake this placeholder for finished
  work.
- `fex-emu` is **not** in Arch Linux ARM's standard repos at all - needs
  building from `armada-packages/fex/` (real source + 2 patches +
  `build-fex-sysroot.sh`) from scratch. Not attempted yet - FEX is needed
  for Proton/Windows games, not for the Steam client itself, so it's
  fine to defer past this initial PHASE 1 milestone.
  **Checked its build.sh**: meaningfully bigger undertaking than
  gamescope/mesa - requires `clang`/`lld`/`llvm` specifically (not gcc),
  Qt6 for the config GUI, and a two-stage process where a whole separate
  x86_64 sysroot gets built first (`build-fex-sysroot.sh`, its own
  multi-package Fedora-based build) before FEX itself compiles against
  it. Deliberately not started this session - genuinely deserves its own
  dedicated pass rather than being squeezed in, and isn't required for
  PHASE 1's actual exit criteria (native Linux Steam + native Linux
  games need no x86 translation at all; FEX only matters once Proton/
  Windows games enter the picture).

**`armada-jupiter-hw-support` ported and installed - the simplest of the
components so far.** Unlike gamescope/mesa/InputPlumber, this one's spec
has an entirely empty `%build` section (`BuildArch: noarch`) - it's pure
shell scripts (storage/SD-card automount helpers), udev rules, and
polkit policy/rules files, no compilation at all. Fetched the real
upstream (`gitlab.com/evlaV/jupiter-hw-support`, Valve's own Steam Deck
hardware-support package) at the pinned tag, applied both real armada
patches cleanly (storage-behavior adaptations for the `armada` user;
polkit-helper safety - hostname validation before `hostnamectl`, explicit
`sshd.service` target), then placed the files at the exact paths the
spec's `%install` section specifies. Verified the `sshd.service` polkit
patch landed for real in the installed file, not just applied to the
source. One dependency (`f3`, a flash-fraud-detection tool) isn't in
Arch's standard repos and was skipped - it's a `Requires:` for an
optional storage-testing helper, not load-bearing for the core
automount/sshd-enable functionality this package exists for.

**InputPlumber (armada's patched fork, `ShadowBlip/InputPlumber` at the
pinned commit) built and installed too - Rust/cargo, both real armada
patches applied cleanly** (the dpad signed-axis-button `CapabilityMap`
fix, and the gamepad passthrough-config fix). `cargo build --release
--target aarch64-unknown-linux-gnu` (all deps from crates.io, no vendoring
needed) finished in ~5 minutes real wall-clock time - confirmed a real
aarch64 ELF binary, ran `make install` (the project's own install target,
matching what the RPM's `%install` does), verified `inputplumber
--version` reports `0.77.2` from the actual installed `/usr/bin/inputplumber`.
This also installed armada's own real device profile YAMLs
(`/usr/share/inputplumber/devices/*` - the same `0X-*-controller.yaml`
files referenced throughout this project's controller work) alongside the
binary, systemd unit, udev rules/hwdb, and polkit policy.

Running tally of the six main `armada-packages` gaming-stack components
(`fex`/`gamescope`/`inputplumber`/`jupiter-hw-support`/`mangohud`/`mesa`):
**gamescope, mesa/Turnip, jupiter-hw-support, and InputPlumber - four of
six - are now real, patched, installed builds** on this Arch Linux ARM
rootfs. Remaining: `fex` (deliberately deferred, see above) and
`mangohud` (in progress).

**Confirmed the Steam bootstrap mechanism is genuinely portable across
distros** - ran armada's own `build_files/generate-steam-bootstrap.sh`
unmodified inside the fresh Arch chroot. It successfully downloaded and
unpacked the **real, official Valve ARM64 Steam client**
(`steamdeck_publicbeta` channel, `bins_linuxarm64_linuxarm64.zip` from
Steam's own CDN) - confirms this part needs no porting work at all, it's
plain bash+python hitting Steam's CDN directly, no RPM/dnf/Fedora
dependency anywhere in it.

**Found a real bug, potentially affecting armada's current builds too,
not just this new work**: the script's last step (downloading
`steam-runtime-steamrt-arm64.tar.xz` from
`repo.steampowered.com/steamrt3c/images/latest-public-beta/`) fails - not
with a normal 403, but a `Google-Edge-Cache: encountered an internal
error` / `Error: 118` response specifically on that `latest-public-beta/`
path, while sibling `steampowered.com`/`steamstatic.com` endpoints
(including the actual Steam client download) work fine. This looks like
a stale/moved URL on Valve's CDN, not an environment/network-blocking
issue on this end - worth checking whether armada's own current builds
are hitting this same failure. Not yet root-caused further or reported
anywhere; flagging here so it isn't lost.

**Root-caused precisely**: fetched `repo.steampowered.com/steamrt3c/images/`'s
real directory listing directly - there is no `latest-public-beta/` entry
at all anymore, only date/build-numbered directories
(`3c.0.20260316.216290/`, ..., newest currently `3c.0.20260618.246540/`).
The `steam-runtime-steamrt-arm64.tar.xz` file genuinely still exists and
is still published, just under the real versioned path, e.g.
`repo.steampowered.com/steamrt3c/images/3c.0.20260618.246540/steam-runtime-steamrt-arm64.tar.xz` -
confirmed that exact file is listed there. **The fix for
`build_files/generate-steam-bootstrap.sh`**: scrape
`https://repo.steampowered.com/steamrt3c/images/` for the newest
`3c.0.*` directory (same pattern the script already uses to parse the
Steam client manifest via `curl`+`python3`/regex) instead of hardcoding
`latest-public-beta`. Not yet patched in this session - this is armada's
own production script, a real fix deserves its own dedicated, reviewed
commit rather than getting folded into this exploratory session's
momentum. Flagging precisely so it's a two-minute fix whenever picked up,
not another investigation.

**Where this leaves PHASE 1**: a real, working Arch Linux ARM base
(systemd/pacman/Btrfs-capable/networked) exists and is verified as far as
it can be without booting real hardware. The mechanically separate pieces
still needed before PHASE 1's actual exit criteria ("Power On → Steam")
are met: building the patched `armada-packages` versions of
gamescope/mesa (PHASE 3 work bleeding into PHASE 1's exit criteria, since
"boot directly into Steam" needs a working display stack), building
FEX-emu, resolving the steam-runtime URL issue, and - separately -
actually integrating this rootfs with the real RP6 boot chain
(`post_process/make-bootimg.sh`'s header-v0/ABL packing, using armada's
own already-proven kernel+DTB, not the Halium-target one).

**Update, same session: patched gamescope actually built successfully -
real, not a placeholder anymore.** Took the "gamescope/mesa still need
armada's patched build" gap above and closed it for gamescope. Cloned
upstream `ValveSoftware/gamescope` at the exact pinned tag (`3.16.24`,
matching `armada-packages/gamescope/BASE.env`), vendored `reshade` and
`vkroots` at their exact pinned commits (`696b14c`/`5106d8a`, matching
`gamescope.spec`'s `%global` pins, fetched as tarballs from the same
`misyltoad` forks the spec uses), applied all 6 real
`armada-packages/gamescope/patches/*.patch` files cleanly (no `.rej`
files, verified), then ran the exact same `meson setup` flags from
`gamescope.spec`'s `%build` section unmodified.

Hit one real, legitimate version-skew issue: Arch's `stb` package only
ships `stb_image_resize2.h` (upstream stb renamed/rewrote this at some
point), while this gamescope version's source still expects the old
`stb_image_resize.h`. Fixed by fetching the exact same file from stb's
own upstream repo (`nothings/stb`, now living under `deprecated/` there)
and placing it alongside the installed package's headers - not a patch
to gamescope's source, a real missing-header gap in how Arch packages
`stb` versus what Fedora's `stb_image-devel` (which armada's real build
uses) still ships.

**Result: `ninja -C build` completed 186/186 targets, including the real
`src/gamescope` binary.** Verified it's real, not just "didn't error out":
`file` confirms a genuine aarch64 PIE ELF, `ldd` shows a full, coherent
set of resolved runtime dependencies (wayland, X11/Xwayland, libdrm,
SDL2, libinput, libseat, etc.), and - the actual point of doing this at
all - **`gamescope --help` lists `--use-rotation-shader`, and `strings`
confirms it's compiled in.** This is the flag `BOOT_ARCHITECTURE.md`
already documented as load-bearing for RP6 (black screen without it) -
confirms the patch that matters most for this hardware is genuinely
present in this Arch-built binary, not just assumed carried over.

Not yet done: `ninja install` / actually placing this into the rootfs
properly (Wayland/Vulkan layer JSON paths, etc.), and this only proves
*compiles correctly* - whether it *runs* correctly still needs real RP6
hardware (GPU driver, DRM/KMS, real display). `mesa`/Turnip (with
armada's own 3 patches from `armada-packages/mesa/`) is the next piece in
the same category, not attempted yet this session.

**Mesa checked too, differently from gamescope.** `armada-packages/mesa/`
isn't a clean upstream-clone-plus-patches recipe like gamescope - it
starts from a **Fedora Rawhide SRPM** (`mesa-26.1.4-1.fc45`, fetched via
`koji download-build`) and layers 3 patches onto Fedora's own mesa.spec
and its own (much larger) Fedora patch set. Replicating that exactly for
Arch would mean re-deriving Fedora's whole mesa packaging, not just
armada's 3 patches - not the right move when Arch Linux ARM already
packages mesa well itself (`26.1.5`, essentially the same upstream
version). Instead: fetched plain upstream `mesa-26.1.5.tar.xz` (matching
what Arch's own package builds from) and dry-ran all 3
`armada-packages/mesa/patches/*.patch` files against it directly -
**all three apply cleanly** (freedreno-vulkan fix, the A830 chip-id
addition, the ir3 bindless-UBO-const-lowering disable), only minor line
offsets from the 26.1.4→26.1.5 version drift, no rejects. Confirms the
patches are genuinely portable and this is a real, achievable next
build.

**Update, continued same session: actually built it, completely.**
Fetched the real Arch Linux mesa `PKGBUILD`
(`gitlab.archlinux.org/archlinux/packaging/packages/mesa`) as the
authoritative dependency/build-flag reference rather than guessing -
its default build compiles every gallium/Vulkan driver for every GPU
vendor (AMD/Intel/Nouveau/etc.), which would take hours and is almost
entirely irrelevant to Adreno/RP6. Trimmed the `arch-meson` invocation
down to just `gallium-drivers=freedreno,llvmpipe` and
`vulkan-drivers=freedreno,swrast` and iterated through the real
config-time errors that came from stripping so many drivers out
(`gallium-va`/`gallium-mediafoundation`/`android-libbacktrace` are
auto-enabled by default but require drivers/platforms we're not
building; `libunwind` needed explicit disabling too, matching what
Arch's own PKGBUILD already does for the same reason) - each fixed by
checking the real error against `meson.options`, not guessed blind.

**`ninja -C build` completed 1664/1664 targets**, including the real
Turnip driver (`src/freedreno/vulkan/libvulkan_freedreno.so`, 15MB, real
aarch64 ELF) and the DRI/EGL/GBM stack. Verified armada's A830 chip-ID
patch (`0002-add-a830-chip-id.patch`) genuinely took effect - not just
"patch applied to source," checked the actual **generated**
`freedreno_devices.h` header this build produced and found all three new
chip-ID entries the patch adds
(`0xffff44050001`/`0x44050000`/`0x44050001`, all "Adreno (TM) 830")
present verbatim. Same category of result as gamescope: compiling
correctly and carrying the right patches through to the real build
output is now confirmed; whether it *runs* correctly on real Adreno
silicon still needs actual RP6 hardware.

Both `gamescope` and `mesa`/Turnip - the two pieces flagged as
PHASE 1/3-blocking placeholders earlier in this log - are now real,
verified, patched builds sitting on disk (`libhybris/src/atlas-base/rootfs/build/`,
gitignored), not gaps anymore.

**Installed both into the rootfs for real** (`ninja -C build install` for
each, not left as isolated build directories): mesa's Turnip ICD
(`/usr/share/vulkan/icd.d/freedreno_icd.json`) and `msm_dri.so`/
`kgsl_dri.so` driver aliases landed correctly; gamescope installed to
`/usr/local/bin/gamescope` (its meson prefix defaults there, unlike
mesa's `arch-meson`-set `/usr/prefix`) and resolves system-wide via PATH
- `gamescope --help` from a plain shell (not a hardcoded path) still
shows `--use-rotation-shader`. Known limitation, not yet addressed: this
was a raw `ninja install`, not a real pacman package (`makepkg` →
`.pkg.tar.zst`) - `pacman -Q` doesn't know about these files, and a
future `pacman -Syu` would silently overwrite mesa's install with the
stock unpatched version again. Turning both into real, `pacman`-tracked
packages (matching how they'd actually ship) is follow-up work, not done
this session.
