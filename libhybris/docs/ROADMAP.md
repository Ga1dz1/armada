# Roadmap

The 13 phases from `MASTER_PLAN.md`, with live status. Update this file
whenever a phase's status changes - it's the first thing to check before
picking a next task. Detailed reasoning/evidence for any status lives in
`logs/YYYY-MM-DD.md` or `ARCHITECTURE.md`; this file stays a scannable
summary.

Status legend: 🔴 not started · 🟡 in progress · 🟢 mostly done · ✅ done (exit criteria met)

⸻

## CURRENT FOCUS

**Current milestone:** `Power On → Steam` (PHASE 1 exit criteria)

**Blocking tasks:**
- Real boot image for RP6 (kernel/DTB/ABL packing against this rootfs - not started)
- Steam Runtime URL fix (`build_files/generate-steam-bootstrap.sh`, root-caused, not yet patched)
- Turning `gamescope`/`mesa` from raw `ninja install` into real `pacman`-tracked packages
- First real hardware boot test (blocked entirely until the above three land - devices are unavailable until there's something to flash)

Not blocking PHASE 1, deliberately deferred: FEX-emu (needed for Proton/Windows games, not for PHASE 1's own exit criteria).

⸻

## PHASE 0 — Proof of Concept

**Status: ✅ done, via inherited evidence, not fresh Atlas-specific proof**

Depends on: nothing (foundational)

Done when:
- ✓ Linux boots
- ✓ Steam launches
- ✓ Gamescope launches
- ✓ Vulkan works
- ✓ Audio works
- ✓ Suspend works
- ✓ Wi-Fi works
- ✓ Bluetooth works
- ✓ Controller works

Exit criteria: playable Linux game.

**Note**: all nine deliverables are already proven true on this exact
hardware family (RP6/Mini V2/etc.) via armada's own existing, shipping
Fedora-bootc-based OS - the feasibility question this phase exists to
answer is already answered. What hasn't been proven yet is the *same*
list on Atlas OS's own Arch Linux ARM base specifically - that's what
PHASE 1 is actually re-establishing from a different foundation, not a
gap in PHASE 0 itself.

⸻

## PHASE 1 — Base Operating System

**Status: 🟡 in progress, substantial (build-side is close to done; nothing has booted on real hardware yet)**

Depends on: PHASE 0

Build:
- ☑ Arch Linux ARM (real rootfs bootstrapped, `pacman`/`systemd 261` verified)
- ☑ systemd
- ☑ pacman
- ☐ initramfs (stock `mkinitcpio` present; not yet tailored to the real RP6 boot chain)
- ☑ Btrfs (`btrfs-progs` installed; kernel-level Btrfs support for the *Android* side is a separate, deferred question - see `ARCHITECTURE.md`)

DONE:
- ☑ Arch Linux ARM rootfs (bootstrapped, verified)
- ☑ Gamescope (armada's 6 patches, built, installed, `--use-rotation-shader` confirmed compiled in)
- ☑ Mesa/Turnip (armada's 3 patches, built trimmed to freedreno+llvmpipe, installed, A830 patch confirmed in generated output)
- ☑ InputPlumber (armada's 2 patches, built, installed, device profiles included)
- ☑ armada-jupiter-hw-support (both patches, installed, no compile needed)
- ☑ Steam bootstrap mechanism (confirmed distro-portable, real Valve ARM64 client downloads/unpacks)

TODO:
- ☐ MangoHud (armada's 6 patches, in progress)
- ☐ Fix and apply the Steam Runtime URL bug (root-caused, fix documented, not patched)
- ☐ Real boot image: kernel/DTB/ramdisk packed for RP6's actual ABL boot chain (`post_process/make-bootimg.sh`'s header-v0 conventions), using armada's own already-proven kernel+DTB for this base-OS milestone (not the Halium-target kernel - see `ARCHITECTURE.md` on why those are deliberately decoupled)
- ☐ Turn `gamescope`/`mesa` raw `ninja install`s into real `pacman` packages (`makepkg`) - see `TECHNICAL_DEBT.md`
- ☐ First real hardware boot test

Exit criteria:

```
Power On
↓
Steam
```

Not yet met - closest phase to completion, but "compiles and installs in
a chroot" is explicitly not the same as "boots on hardware," see
`docs/MASTER_PLAN.md`... actually see the Definition-of-Done discipline
below. Don't mistake the DONE list above for phase completion.

⸻

## PHASE 2 — Hardware Manager

**Status: 🔴 not started**

Depends on: PHASE 1

Responsibilities: battery, charging, suspend, wake, thermal, fan, LEDs,
vibration, brightness, gyro, dock.

Done when:
- ☐ A single dedicated daemon exists exposing one Hardware API
- ☐ Nothing else in the system accesses hardware directly
- ☐ All responsibilities above are implemented and testable on real hardware

Note: `armada-jupiter-hw-support` (PHASE 1, done) provides raw storage/
automount/sshd-enable helpers this phase can build on, but is not itself
the Hardware Manager the plan describes - it's Valve's own narrower
Steam Deck helper package, adapted, not a from-scratch daemon with a
unified API.

⸻

## PHASE 3 — Graphics Stack

**Status: 🟡 in progress (build-side done, runtime unverified)**

Depends on: PHASE 1

Bring up: Mesa → Turnip → Gamescope → Vulkan.

Done when:
- ☐ `vkCube` renders
- ☐ Vulkan works
- ☑ Gamescope starts *(compiles/installs; not yet run on real GPU hardware)*
- ☐ MangoHud renders
- ☐ No software rendering (i.e. `llvmpipe`/`swrast` isn't silently what's actually drawing)

**Without this Definition of Done, "compiles" could get mistaken for
"done" - it explicitly hasn't been. Mesa/Turnip and gamescope both build
and install cleanly (PHASE 1's DONE list), which is necessary but not
sufficient for this phase's actual exit criteria - none of the five
checks above can be verified without real Adreno hardware.**

⸻

## PHASE 4 — Android Layer

**Status: 🟡 in progress (substantial groundwork, nothing running yet)**

Depends on: PHASE 1, PHASE 3

Integrate: Halium, libhybris, BinderFS, Waydroid.

**Scope boundary (ADR-006, added 2026-07-24)**: Android stays a thin
bridge to proprietary hardware (GPU/audio HAL/camera/sensors/thermal/
power/vibrator, plus Bluetooth/Wi-Fi where no native driver exists) - it
does not become a second userspace. Input, network management, udev,
systemd, and PipeWire stay native Linux, not routed through Android.
Bluetooth/Wi-Fi need a per-device check (native driver vs. Android HAL),
not a blanket assumption.

Done when:
- ☐ Camera functional
- ☐ Audio functional
- ☐ Bluetooth functional
- ☐ Wi-Fi functional
- ☐ Sensors functional
- ☐ GPU functional (Adreno vendor blobs actually driving the display via the guest)

Real progress so far (full detail: `SCOPING.md`, `ARCHITECTURE.md`):
- ☑ Real RP6 kernel + DTB + 241 vendor `.ko` modules pulled from an
  official LineageOS build and verified
- ☑ Real vendor/system partition images pulled and verified (confirmed
  genuine Adreno GPU blobs present: `libEGL_adreno.so`, Turnip's
  proprietary counterpart, gralloc, etc.)
- ☑ Found the real current Halium boot architecture (LXC/nspawn-guest
  model, not the legacy `.stowaways` approach)
- 🟡 Built and locally verified a `systemd-nspawn`-based container
  prototype - **but PHASE 1's later re-read of `MASTER_PLAN.md` names
  Waydroid explicitly**, so this hand-rolled prototype is likely getting
  replaced by Waydroid rather than continued (see `DECISIONS.md`) -
  don't treat the nspawn work as the committed path forward
- ☐ Mini V2 has no official Android build at all - the "donor device for
  vendor blobs" question is still open, not decided

⸻

## PHASE 5 — Execution Manager

**Status: 🔴 not started**

Depends on: PHASE 1, PHASE 3, PHASE 4

The core of the operating system - `Play/Pause/Resume/Stop(Game)`,
auto-detects/configures/launches/monitors/shuts down the right runtime.

Done when:
- ☐ API implemented: `Play(Game)`, `Pause(Game)`, `Resume(Game)`, `Stop(Game)`
- ☐ Runtime auto-detection works across at least Steam + one non-Steam runtime
- ☐ Steam never directly launches a game itself (PHASE 7's requirement, but enforced here)

Don't start this before PHASE 1/3/4 have real, running (not just
compiling) foundations - there's nothing to *execute* yet.

⸻

## PHASE 6 — Library Manager

**Status: 🔴 not started**

Depends on: PHASE 5

Single database across Steam, Heroic, ROM folders, APK folders, local
executables, Flatpaks. Metadata: title, artwork, playtime, achievements,
platform, runtime, compatibility.

Done when:
- ☐ Single database schema exists and is populated from at least 2 sources
- ☐ Metadata fields above are populated, not just titles

⸻

## PHASE 7 — Steam Integration

**Status: 🔴 not started**

Depends on: PHASE 5

Steam becomes UI only - `Play button → Execution Manager → Runtime → Game`.

Done when:
- ☐ Steam's own launch path is fully intercepted/redirected through Execution Manager
- ☐ Verified Steam never directly launches a game process itself

⸻

## PHASE 8 — Android Integration

**Status: 🔴 not started**

Depends on: PHASE 4, PHASE 6

APKs automatically appear in Library; Waydroid launches transparently;
user never sees Android.

Done when:
- ☐ Installed APKs appear as Library entries with no separate launcher
- ☐ Launching one starts the Waydroid guest (if not already running) transparently
- ☐ No Android UI/chrome is ever visible to the user

⸻

## PHASE 9 — Emulation Layer

**Status: 🔴 not started**

Depends on: PHASE 5

Supported runtimes: RetroArch, PCSX2, RPCS3, Dolphin. Future: Switch, Xbox, others.

Done when:
- ☐ Execution Manager selects the correct emulator automatically from ROM metadata
- ☐ At least RetroArch + one of PCSX2/RPCS3/Dolphin fully wired through Execution Manager

⸻

## PHASE 10 — Update System

**Status: 🔴 not started**

Depends on: PHASE 1

Immutable root, A/B updates, rollback, snapshots, atomic updates. Never brick devices.

Done when:
- ☐ Root filesystem is immutable by default
- ☐ A/B slot mechanism implemented and tested
- ☐ At least one real rollback-from-bad-update tested on hardware

⸻

## PHASE 11 — Desktop

**Status: 🔴 not started**

Depends on: PHASE 1 (only after Game Mode is complete, per the plan's own ordering)

Possible environments: KDE Plasma, GNOME. Desktop is optional.

Done when:
- ☐ At least one desktop environment boots as an alternative session
- ☐ Switching Game Mode ↔ Desktop works without a full reboot

⸻

## PHASE 12 — Settings

**Status: 🔴 not started**

Depends on: PHASE 2, PHASE 5

Performance, display, controllers, battery, fan, gyro, storage, network.
No advanced settings visible by default.

Done when:
- ☐ All eight categories above have a working settings surface
- ☐ Advanced options are hidden by default (confirmed via UI review, not just "exists")

⸻

## PHASE 13 — Optimization

**Status: 🔴 not started**

Depends on: everything else (this is a polish pass, not a feature phase)

Boot time, memory usage, battery life, thermals, shader cache, background services.

Done when:
- ☐ Boot-time budget defined and met
- ☐ Battery-life target defined and measured on hardware
- ☐ Shader cache persists across reboots and measurably reduces stutter
