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
