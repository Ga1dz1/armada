# Decisions

ADR-style records: what was decided, why, and what alternative was
rejected. Append new entries at the bottom, numbered sequentially. Once
written, a decision entry doesn't get edited to reflect new information -
if a decision is later reversed, add a new entry that supersedes it and
says so explicitly.

⸻

### ADR-001: Base OS is Arch Linux ARM, not armada's Fedora bootc/ostree

**Date**: 2026-07-24

**Decision**: PHASE 1's base OS is Arch Linux ARM (`systemd` + `pacman` +
`mkinitcpio` + Btrfs), per `MASTER_PLAN.md` explicitly. armada's own
Fedora bootc/ostree foundation is not reused as the base.

**Why**: given directly in the master plan; armada becomes a resource
donor (kernel patches, DTBs, controller/thermal profiles, driver
knowledge, its `armada-packages` patch set) rather than the architectural
base.

**Rejected alternative**: continuing on armada's own Fedora bootc base
(would have been the path of least resistance given all of this
session's prior armada-specific work, but explicitly not what was
asked for).

⸻

### ADR-002: Android bridge is Halium (+ Waydroid), not ChromeOS's ARC++/ARCVM

**Date**: 2026-07-24

**Decision**: the Android-compatibility layer is Halium/libhybris/
BinderFS/Waydroid, per `MASTER_PLAN.md`'s own architecture diagram
(`Android Kernel → Vendor Drivers → Halium → Linux Userspace`) and PHASE
4's explicit component list.

**Why**: this was a real open question earlier the same day (a
"ChromeOS as base" comment was ambiguous - could have meant "adopt
ChromeOS's ARC++/ARCVM Android-container tech," which is objectively a
more mature answer to the exact problem this project was hand-rolling a
solution for). The full `MASTER_PLAN.md` text, once given, resolved this
directly and unambiguously in favor of Halium.

**Rejected alternative**: ChromeOS's ARC++/ARCVM (would have meant a much
larger architectural pivot - Gentoo/Portage-based Chromium OS as the
actual base, not just borrowing one subsystem - and isn't what the plan
specifies).

⸻

### ADR-003: Android guest container is (likely) Waydroid, not a hand-rolled systemd-nspawn setup

**Date**: 2026-07-24

**Decision**: use Waydroid for the Android-guest container, not the
custom `systemd-nspawn`-based prototype built earlier the same session.

**Why**: `MASTER_PLAN.md` PHASE 4 names Waydroid explicitly alongside
Halium/libhybris/BinderFS. Waydroid is a mature, actively-maintained tool
built for exactly this problem (LXC-based Halium container with Wayland
integration) - reusing it matches the project's own NON GOALS principle
("orchestrate existing components, don't reimplement them"). The earlier
nspawn prototype was itself a reasonable engineering call at the time (it
predated re-reading `MASTER_PLAN.md`'s Waydroid mention, and was chosen
over LXC specifically because it needed zero new dependencies on a
systemd-based host and the container turned out to be minimal - no
network namespace, just `/init` as PID 1) - but is being superseded now
that Waydroid is confirmed as the intended tool, not abandoned as wrong.

**Rejected alternative**: continuing the hand-rolled `systemd-nspawn`
container (`libhybris/nspawn/android-guest.nspawn`,
`libhybris/scripts/assemble-android-guest.sh`) as the long-term path.
Kept as reference/prior art - it proved real things (the container
mechanism itself works, the `/usr`-directory requirement, an overlayfs-
submount gotcha) that remain useful even if Waydroid's own tooling
differs in the specifics.

**Not yet done**: actually evaluating/adopting Waydroid. This ADR records
the direction, not a completed migration.

⸻

### ADR-004: Android's `/data` stays ext4; unified Btrfs applies only to the CR(g) OS side

**Date**: 2026-07-24

**Decision**: the proposed single-`userdata`-Btrfs-with-subvolumes
storage scheme applies to the CR(g) OS side only
(`@steamos_root`/`@steamos_home`/`@cache`/`@snapshots`/`@images`).
Android's own `/data` stays ext4 (as shipped), living inside a Btrfs
subvolume as an ordinary loopback-image file if needed, not as a real
Btrfs subvolume.

**Why**: checked directly against the real RP6 kernel binary (embedded
IKCONFIG extraction) - `CONFIG_BTRFS_FS is not set`, confirmed absent
both built-in and as a loadable module across all 241 real vendor `.ko`
files. Since Android (as a Halium guest) and the CR(g) OS host share one
kernel, Android's filesystem support is bounded by whatever that one
kernel has, and it doesn't have Btrfs. Checking whether a lighter path
(building just `btrfs.ko` as an out-of-tree module) could route around
this: tried it directly, and it converges back onto needing the exact
Android Clang toolchain (`clang-r563880c`) plus a real
`Module.symvers` from the original build, because the kernel is built
with `CONFIG_CFI_CLANG` + `CONFIG_LTO_CLANG_FULL` + `CONFIG_MODVERSIONS`
- i.e. the "lighter" path isn't actually lighter, it's the same
from-source rebuild risk already avoided once (see PHASE 4 in
`ROADMAP.md`/`SCOPING.md` on the paused Bazel/Kleaf attempt).

**Rejected alternatives**:
1. Full from-source kernel rebuild with `CONFIG_BTRFS_FS=y` - rejected as
   the same open-ended Bazel/Kleaf risk already paused once for RP6.
2. `btrfs.ko` as a standalone out-of-tree module - checked directly,
   converges onto the same toolchain-matching problem as (1), not a
   genuine shortcut.

⸻

### ADR-005: PHASE 1 base-OS work deliberately uses armada's own kernel, not the Halium-target kernel

**Date**: 2026-07-24

**Decision**: the first real hardware boot test for PHASE 1 (Arch Linux
ARM base OS on RP6) will use armada's own already-proven kernel + DTB,
not the LineageOS/Halium-target kernel pulled for PHASE 4's work.

**Why**: matches `MASTER_PLAN.md`'s own stated priority ordering
("Hardware → Stability → Performance → UX → Features, never reverse").
Combining a brand-new base OS *and* a brand-new (to this project) kernel
in the same first boot test compounds two unproven things - if it fails,
there's no way to know which one broke. armada's kernel is already
proven working on this exact hardware (WiFi, GPU, controller, LEDs, all
confirmed pre-dating this session). PHASE 4's Halium kernel work stays on
its own track and gets integrated later, once PHASE 1 itself is proven.

**Rejected alternative**: using the Halium-target kernel from the start,
which would be architecturally "further along" toward the eventual goal
but riskier for the very first hardware test.

⸻

### ADR-006: Android is a thin bridge to proprietary hardware, not a second userspace

**Date**: 2026-07-24

**Decision**: split what actually needs to come from the Android guest
(via Halium/libhybris) from what should be native Linux components
instead, wherever a native path exists:

**From Android** (genuinely proprietary/vendor-locked, no viable native
alternative on this hardware):
- GPU (vendor blobs - this is Turnip's whole reason for existing as a
  *bridge* target, not a replacement)
- Audio HAL
- Camera
- Sensors
- Bluetooth (vendor firmware/HAL, *unless* a specific device's Bluetooth
  chip works fine under a native Linux Bluetooth stack - see below)
- Wi-Fi (same caveat)
- Thermal
- Power
- Vibrator

**Native Linux instead, wherever possible** (Android's own stack for
these is explicitly not to be used as the system's actual implementation):
- Input stack → InputPlumber (PHASE 1, already built/installed - this
  was already the direction, now confirmed as deliberate policy, not
  incidental)
- Network management → NetworkManager
- Device management → udev
- Init/service management → systemd
- Audio routing/mixing → PipeWire
- Bluetooth stack → BlueZ, **per-device**, only where the device's
  Bluetooth chip can actually be driven without Android's Bluetooth HAL

**Why**: Android must stay a thin bridge to hardware the Linux side
can't otherwise reach - not a second, competing userspace that ends up
owning system-level responsibilities (input, network, service
management) that Linux already does natively and better. This is a
direct application of the project's own NON GOALS principle
("orchestrate existing components, don't reimplement them" - and
symmetrically, don't let Android *become* the implementation of things
Linux already implements well).

**Per-device nuance, not yet resolved for any specific device**:
Bluetooth and Wi-Fi are marked with a caveat because whether they need
the Android HAL or can run under native Linux drivers/BlueZ depends on
the specific chip in each device (some Qualcomm Wi-Fi/BT combo chips
have working mainline Linux drivers already; others don't). This has to
be checked per-device (RP6, Mini V2, etc.), not assumed one way for the
whole project - see `ARCHITECTURE.md`'s Android layer section.

**Not yet implemented**: this is a scope/boundary decision for PHASE 4,
not something built yet. Recorded now so PHASE 4 work has a clear target
boundary from the start rather than accidentally routing everything
through the Android guest by default.
