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
