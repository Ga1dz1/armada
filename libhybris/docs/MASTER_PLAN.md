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
  source of truth for what's being built and why.

  Restructured 2026-07-24, same day, per explicit user direction: this
  file now holds ONLY goals and stable high-level architecture. Everything
  else moved out:
  - docs/ROADMAP.md      - the 13 phases, with live status/dependencies/DoD
  - docs/ARCHITECTURE.md - current-state technical architecture (repo
                            structure, device/runtime structure, storage)
  - docs/DECISIONS.md    - ADR-style records of specific decisions made
  - docs/CHANGELOG.md    - terse one-line-per-milestone log
  - docs/KNOWN_ISSUES.md - open bugs/gaps, not yet fixed
  - docs/TECHNICAL_DEBT.md - shortcuts taken, prioritized cleanup list
  - logs/YYYY-MM-DD.md   - full raw engineering diary, dated
  Cross-reference: libhybris/SCOPING.md (Halium/RP6/Mini V2 execution log,
  maps onto PHASE 4 "Android Layer"), VISION.md (library-first/unified-
  library product philosophy, maps onto PHASE 6-8).
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

NON GOALS

Added 2026-07-24, per explicit user emphasis - this is the single most
important section for keeping scope honest, for Claude and for any future
contributor alike.

The project will NOT:

- Replace Steam.
- Replace Heroic.
- Replace Proton.
- Replace RetroArch.
- Replace Waydroid.
- Replace Mesa.

Instead it orchestrates them.

Concretely: if a task looks like "write our own compatibility layer" or
"write our own emulator" or "write our own Android container runtime,"
that's a signal to stop and check whether an existing component (Proton,
RetroArch, Waydroid, ...) already does this - the project's job is
integration and orchestration (Execution Manager, Library Manager,
Hardware Manager), not reimplementation. This is why, for example, the
Halium/Android-guest work (see ARCHITECTURE.md, SCOPING.md) is converging
on Waydroid rather than a hand-rolled container setup.

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
