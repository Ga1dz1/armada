# libhybris / Halium migration — scoping notes

Started 2026-07-22, first pass only. This is research groundwork, not a plan
to execute yet - the goal here was just "is this feasible, and what's the
real first step," per the earlier discussion about driver-support pain
(DSI PLL issues, GPU OPP tuning, all the ROCKNIX-derived kernel patching this
whole project has needed).

## What it actually buys us

Halium's whole point is libhybris: a shim that lets a normal Linux userspace
(Wayland/EGL, systemd, glibc) call into Android's bionic-based vendor HAL
blobs (GPU driver, media codecs, sensors) instead of needing a from-scratch
mainline kernel driver for each one. The **kernel stays the stock Android
one** - Halium doesn't replace it, it wraps the vendor userspace around it.

That's the opposite of what we do now: we run a real, fairly mainline-ish
kernel (ROCKNIX-derived DTS/patches, our own real-suspend hooks, HTR3212 LED
driver, GPU OPP tuning) directly on the hardware, no Android layer at all.

## What we'd give up / have to redo

Everything we've built at the kernel level this whole project would need to
move onto the **stock Android kernel** instead of our current one, since
that's the kernel Halium boots:

- Real suspend (s2idle) hooks, wifi radio block/unblock around sleep,
  power-key rebound guard - all currently kernel-adjacent work tied to our
  specific kernel/DTS.
- HTR3212 stick LED driver (`0033_leds--Add-driver-for-HEROIC-HTR3212.patch`)
  - would need porting onto the stock kernel tree instead of ours.
  - Every kernel patch in armada-packages' `kernel/patches/` - GPU OPP
  tables, the pmic-typec/alpha-pll log-spam fix, etc.

This is a real kernel migration, not a driver swap - "gradually" is the
right framing, this isn't a weekend project.

## The one fact that decides feasibility before anything else — RESOLVED, positively

Halium needs to **rebuild the Android kernel** (hybris-boot ramdisk, ROCTest
adjustments, etc.), which means it needs the stock kernel **source**, not
just the running binary. Confirmed 2026-07-23: it exists, and it's not stale.

- `turtleletortue/android_kernel_retroid_pocket2` (Pocket 2) was the wrong
  precedent - too old a device to mean much for Mini V2's own SoC generation.
- **`RetroidPocket/linux`** (the org's own repo, not a community mirror):
  branch `sm8250/linux-6.12.y`, real Linux 6.12.y kernel source, currently
  maintained. Commit history is explicitly about *our* hardware family, not
  generic SM8250 boilerplate: HTR3212 stick LED driver (the same one our own
  `0033_leds--Add-driver-for-HEROIC-HTR3212.patch` carries), RP5/Mini gamepad
  rumble/force-feedback, LED zone assignment fixes ("Fix Retroid Pocket 5 /
  Mini led assignment"), the CH13726A display panel driver, battery
  charger/fuel-gauge drivers. Most recent commits are from Jan 2025 - not
  abandoned.
- **`RetroidPocket/u-boot`**: "Retroid Pocket SM8250 'Das U-Boot' Source
  Tree" - the bootloader side, same SoC, separately maintained.
- Adreno 650 remains a known-workable Halium GPU target generally
  (freedreno/libhybris has supported Adreno for years) - was never the risk.

Net result: the single blocking prerequisite is no longer a question mark.
Real, current, device-family-specific kernel *and* bootloader source both
exist under Retroid's own GitHub org.

## Recommended next step (when we pick this back up)

1. Clone `RetroidPocket/linux` (`sm8250/linux-6.12.y`) and `RetroidPocket/u-boot`
   and confirm they actually build for Mini V2 specifically (not just RP5) -
   the commit history mixes both, need to check the devicetree/defconfig
   naming to see if Mini V2 has its own target or rides on RP5's.
2. Diff this against ROCKNIX's own SM8250 kernel fork (which we already
   vendor patches from) to see how much of what we already carry in
   `armada-packages/kernel/patches/` is just a reimplementation of things
   this upstream tree already has natively - could mean less porting work
   than the earlier pass assumed, not more.
3. First buildable milestone stays the same: get hybris-boot to produce a
   bootable ramdisk on top of this real source tree, confirm the Adreno 650
   vendor blobs actually initialize via libhybris on real hardware - before
   touching anything about our existing OS, display stack, or any shipped
   userspace work.

## Major update, 2026-07-24: RP6 (SM8550) now has a stronger path than Mini V2

RP6 has since become armada's own flagship device (real hardware, first
successful boot this same day - see BOOT_ARCHITECTURE.md in the repo root),
and it turns out to have a *better* Halium prerequisite chain than Mini V2's
SM8250 ever did: **official LineageOS support**, not a community fork.

- `LineageOS/android_device_retroidpocket_RP6` (branches `lineage-23.2`,
  `lineage-24.0`) - official device tree, Android 16, wiki-documented
  (wiki.lineageos.org/devices/RP6/). Depends on a shared common tree:
- `LineageOS/android_device_ayn_qcs8550-common` (pushed 2026-07-14, current) -
  confirms independently, via a completely different source, the same fact
  this session found live on real RP6 hardware today: **RP6 shares its
  platform/controller with the AYN qcs8550 family**, not the SM8250 Retroid
  line. Depends on:
  - `LineageOS/android_kernel_ayn_qcs8550` - the actual kernel source, GKI
    (Generic Kernel Image) architecture with loadable vendor modules
    (`android_kernel_ayn_qcs8550-modules`: audio-kernel, camera-kernel,
    securemsm-kernel, eva-kernel, graphics-kernel, bt-kernel) rather than a
    monolithic vendor kernel - a notably Halium/libhybris-friendly shape,
    arguably easier than Mini V2's older non-GKI SM8250 kernel would have
    been.
  - `LineageOS/android_kernel_ayn_qcs8550-devicetrees`,
    `LineageOS/android_kernel_ayn_common-modules`,
    `LineageOS/android_hardware_ayn` (vendor HAL glue).

This is a materially stronger starting point than the Mini V2 path above:
official (not community-abandoned) upstream, actively maintained as of this
same month, and for the device we actually have working, tested hardware
for right now. **RP6/qcs8550 should be the primary Halium target going
forward**, with the Mini V2/SM8250 research above kept as a fallback/
reference, not superseded outright (the general libhybris tradeoffs section
above still applies to either device).

Next concrete step: clone `android_kernel_ayn_qcs8550` and its devicetrees/
modules repos, confirm they actually build (GKI kernels have their own
toolchain/config quirks), and check whether the AYN qcs8550 devicetree
already matches or needs adaptation for RP6 specifically vs. other
qcs8550-family boards (Odin 2/Mini/Portal) - same "shared family, per-board
variance" pattern this session already had to handle for InputPlumber and
GRUB/boot-style purposes on the armada side.

## Update, same day: cloned and inspected both device targets

Both cloned shallow into `libhybris/src/` (not committed - large, easy to
re-clone, treat as scratch): `linux` (RetroidPocket/linux, Mini V2/SM8250),
`android_kernel_ayn_qcs8550` + `android_kernel_ayn_qcs8550-devicetrees`
(RP6/SM8550), `u-boot` (RetroidPocket/u-boot).

**Mini V2 (SM8250)**: `RetroidPocket/linux`'s devicetree is for the
*original* "Retroid Pocket Mini" (`model = "Retroid Pocket Mini"` in
`sm8250-retroidpocket-rpmini.dts`), not Mini V2 specifically - confirms the
open question from the first pass. Only RP5 and the non-V2 Mini have DTS
here. Mini V2 support would need a new devicetree, presumably a close
derivative of `rpmini.dts` (same pattern as porting our own
`armada-packages/kernel` ROCKNIX-derived DTS work), not a blocker but real
porting work, not free.

Per the user (2026-07-24): the *only* difference between Mini and Mini V2 is
that V2's screen is no longer masked/covered (i.e. same panel, V2 just
exposes more of it rather than hiding part of it under a bezel) - suggests
the actual devicetree diff needed is small (panel active-area/timing
properties, not a different panel or SoC wiring), not a from-scratch board
port. Worth confirming directly against `rpmini.dts` panel timing nodes once
this is picked back up, but this meaningfully lowers the expected Mini V2
porting effort versus treating it as an unknown-sized task.

**RP6 (SM8550/qcs8550)**: confirmed real, dedicated devicetree support -
`android_kernel_ayn_qcs8550-devicetrees` has
`moorechip/kalamap-retroid-pocket-6.dtsi` + `-overlay.dts`, plus *separate*
audio (`kalama-audio-retroid-pocket-6.dts`) and display
(`kalama-sde-display-retroid-pocket-6.dtsi` + `-overlay.dts`) devicetree
files - first-class support, not an afterthought. ("moorechip" appears to
be the board vendor codename, "kalama" Qualcomm's SM8550 platform codename.)

**Bigger-than-expected fact for both**: this is Linux **5.15.208** (an
Android Common Kernel / GKI branch), built via **Bazel/Kleaf**
(`BUILD.bazel` present, no plain `build.sh`) - Google's current Android
kernel build system. This is not a standalone `make defconfig && make`
kernel tree the way `armada-packages/kernel` is; GKI/Kleaf builds normally
expect to run inside a `repo`-synced Android kernel manifest workspace
(pulling in `build/kernel`, prebuilt Clang toolchains pinned to a specific
version, `common-modules` trees, etc.), not a bare git clone in isolation.
Getting an actual build running is a real infrastructure task on its own -
setting up `repo`, the right manifest (LineageOS publishes kernel manifests
for exactly this), and Google's kernel-build-tools/Clang prebuilts - before
any kernel *code* work starts. Don't underestimate this step relative to
everything else in this doc; it's the next real blocker, not a formality.

**Revised recommended next step**: before attempting any hybris-boot
milestone, first get *any* unmodified boot.img to build successfully from
one of these two trees via its proper `repo`-manifest + Kleaf/Bazel flow
(RP6/qcs8550 is the better first target - real hardware, dedicated
devicetree, and LineageOS's own build instructions/wiki page to follow
exactly rather than reverse-engineering). Only after that baseline build
works is it meaningful to start layering in hybris-boot/libhybris changes.

## Update, same day (continued): found the *current* kernel repos, and a real new blocker

`android_kernel_ayn_qcs8550` (cloned earlier, Linux 5.15.208) turned out to
be a **stale/legacy** repo - the actual current one referenced by
`android_kernel_ayn_qcs8550-build-ack`'s `BUILD.bazel` is a different,
newer family: `android_kernel_ayn_kernel-ack` (**Linux 6.18.20**, pushed
2026-06-29 - genuinely current), `android_kernel_ayn_modules-ack`,
`android_kernel_ayn_qcs8550-devicetrees-ack`. Confirmed via the Bazel
`kernel_build()` target names and `target_path` entries in the build-ack
repo's own `lineage.dependencies`/BUILD.bazel. Don't build against the
`-qcs8550` (no `-ack` suffix, no `-kernel-`/`-modules-` split) repo already
on disk - it's superseded.

**Real new blocker found**: LineageOS's own manifest
(`LineageOS/android`, `lineage-23.2`, both `default.xml` and
`snippets/lineage.xml`) pins kernel-build Clang **only** as
`prebuilts/clang/kernel/linux-x86/clang-r416183b` and
`prebuilts/clang/host/linux-x86` - **no linux-arm64/aarch64 host toolchain
variant exists in the standard manifest**. This build host is native
aarch64 (confirmed via `uname -m` and `repo`'s own version banner - not
running under emulation, which is genuinely good news for everything
*else*), but has **no x86_64 emulation installed** (`qemu-x86_64-static`
absent, no `binfmt_misc` entry) - so the standard, well-tested kernel
build toolchain literally cannot execute on this machine as-is.

The GKI "mixed build" base kernel prebuilts
(`kernel/prebuilts/<version>/arm64`, confirmed present in the manifest
alongside x86_64 ones) are fine - those are *target*-arch binaries, not a
host-arch problem. It's specifically the **compiler toolchain used to
build the vendor modules** that's x86_64-only in the standard manifest.

Three real options, not yet chosen (needs a decision, not more research):
1. Install x86_64 userspace emulation (`qemu-user-static`/binfmt) on this
   host and accept slower (emulated) module compilation - straightforward,
   no architecture workarounds, just slower.
2. Try substituting a native aarch64 host Clang/GCC for the pinned
   x86_64 prebuilt - Kleaf/Bazel builds are often strict about exact
   toolchain version pins for reproducibility, so this may not "just work"
   without its own real debugging.
3. Do this specific build phase on a different, x86_64 host if one becomes
   available, and only bring the resulting artifacts back here.

Not decided yet - flagged to the user rather than picked unilaterally,
since it's a host/environment setup choice, not a code decision.

**Correction, same session**: the "current (Linux 6.18) beats stale
(Linux 5.15)" reasoning above was wrong. Checked the ONLY authoritative
source - `android_device_ayn_qcs8550-common`'s own current
`lineage.dependencies` and `BoardConfigCommon.mk`
(`TARGET_KERNEL_SOURCE := kernel/ayn/qcs8550`) - and the device tree that
`breakfast RP6` actually uses references the **non-`-ack` family**:
`android_kernel_ayn_qcs8550` (Linux 5.15.208, the one deleted earlier in
this same session as "stale" - it wasn't), `-qcs8550-devicetrees`,
`-qcs8550-modules`, `-common-modules`. The `-ack`/`kernel-6.18`/
`kernel/platform/...` family (`kernel-ack`, `modules-ack`,
`devicetrees-ack`, `qcs8550-build-ack`) is a **separate, newer effort**
(possibly a future kernel bump in progress, or a parallel GKI-certification
build) that isn't what currently ships - re-cloned under
`kernel-ayn-qcs8550/` as the correct target; the `-ack` clone under
`kernel-6.18/` is kept as a secondary reference, not deleted, but not the
primary path. Lesson: a newer kernel version number is not evidence of
being "the current one" - always verify against the device tree's actual
`TARGET_KERNEL_SOURCE`/`lineage.dependencies`, not repo naming/dates.

Good news: both trees use the same Bazel/Kleaf build system
(`android_kernel_ayn_qcs8550` also has `BUILD.bazel` + the full
`build.config.msm.kalama` etc. set), so the x86_64-toolchain finding and
the qemu-user-static mitigation above apply either way - no wasted work
there.
