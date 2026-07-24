# Product vision: a gaming OS, not a SteamOS clone

Written 2026-07-24, capturing a product-direction conversation before it gets
lost. This is a philosophy/direction document, not an implementation plan -
none of this is scheduled or committed to yet. It exists so the idea doesn't
have to be re-derived from scratch in a future conversation.

**Naming note (added same day):** the project is moving toward a new name,
**CR(g) OS**, for new work going forward - this document describes new
work (session UX, Android-apps-in-library), so treat it as CR(g) OS
territory conceptually. Nothing existing is being renamed yet: the current
armada codebase, repo, and OTA pipeline are untouched and unaffected by
this - see the "already-shipped infrastructure" section below, which is
existing armada work this new direction builds on top of, not replaces.

## The core claim

SteamOS's pitch is "an OS for Steam." armada's pitch can be different: **an OS
for games**, full stop - regardless of where they come from. Steam, Heroic,
GOG, Epic, Lutris, RetroArch, Ryujinx, and (via the Halium/libhybris work,
see `libhybris/SCOPING.md`) **Android apps**, all living in one library, one
interface, one update system. That last part - Android apps as first-class
library entries, not a second interface hidden behind a launcher - is a
feature Valve doesn't have. It's also the real strategic payoff of the
Halium investment: not "reuse Android's drivers" as an end in itself, but
"the Android layer becomes invisible, its apps just show up in the library."

## Session architecture (mostly already real)

The intended shape:

```
Power On → Splash → Gamescope → Steam Game Mode
```

The user never sees a desktop by default. Desktop becomes something you
*launch*, not something you boot into - "Steam → Power → Switch to Desktop,"
Deck-style, or faster: "Steam → Launch Desktop," a few seconds later you're
in KDE, `logout` and you're back in Game Mode. No reboot either direction.

**This is not a new idea for armada - most of it already exists.** The repo
already ships:

- `system_files/etc/gamescope-session-plus/sessions.d/steam` - the Gamescope
  Steam session (this is `aarron-lee/gamescope-session-plus`, the same
  mechanism SteamOS itself is built on).
- `system_files/usr/share/wayland-sessions/armada-plasma.desktop` +
  `system_files/usr/libexec/armada/start-plasma` - a separate, real KDE
  Plasma desktop session.

So the "Session 1: gamescope-session / Session 2: desktop-session, switchable
without reboot" split the user described is largely *already-shipped
infrastructure*, not something to build from zero. What's still missing is
the fast, no-logout switching UX layer.

## What's actually new

### 1. Power+Select quick-switch menu

Hold Power + Select (or similar), get a system overlay:

```
Resume Game
Desktop
Android Apps
Recovery
Reboot
Shutdown
```

Roughly: an overlay UI + a dbus call (or direct session-switch call) into the
already-working gamescope-session-plus/Plasma session machinery. Doesn't
require `logout` to leave Plasma - a real fast-switch, not the current
logout-based round-trip. This is a UI/UX layer on top of infrastructure that
mostly already exists; the main new work is the switching mechanism itself
(instant, no logout) and the overlay.

### 2. Android apps as native Steam library entries (the killer feature)

Once Halium/libhybris gives armada a real Android container underneath
(status: `libhybris/SCOPING.md`, currently paused on RP6, in-progress on
Mini V2), the idea is: **installed APKs don't get their own launcher.** Each
one becomes a non-Steam-game shortcut in the existing Steam library, sitting
next to Half-Life, Cyberpunk, Cemu, RPCS3, Discord, YouTube, Chrome - all in
one list, all one interface.

Sketch of the mechanism (not yet designed in detail, not started):

- The Android container starts lazily, on first launch of any APK-backed
  entry, not at boot.
- Each installed APK gets registered as a Steam shortcut pointing at a small
  wrapper script.
- The wrapper starts the container if it isn't already running, launches the
  app inside it, and surfaces its window through Wayland/Xwayland into
  Gamescope as an ordinary game window.
- Steam itself knows nothing about Android - it just sees a shortcut, same
  as any other non-Steam game.

This is the part that turns the Halium work from "a driver-reuse technical
exercise" into an actual product differentiator, and it's worth treating as
the real target when making Halium decisions (which donor device for Mini
V2's vendor blobs, prioritizing RP6-via-LineageOS-prebuilt vs. Mini V2 first
- both still open, see `libhybris/SCOPING.md`).

## Relationship to the Halium work

This vision doesn't resolve either of the open Halium questions
(`libhybris/SCOPING.md`'s "recommended next step" sections) - it explains
*why* they're worth resolving. The Android-container-as-library-source idea
only pays off once a real Android userspace is actually running under
libhybris on real hardware; nothing here changes what that requires.
