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

## 2026-07-24: RP6 from-source kernel build attempt — paused, here's why

Tried to actually build `kernel/ayn/qcs8550` for real, following the
targeted-clone method that worked for Mini V2. Documenting in full because
this took a lot of investigation and the next person picking this up
(possibly future me) shouldn't have to re-derive it.

**The architecture is heavier than Mini V2's.** `RetroidPocket/linux` is a
single self-contained Kbuild tree (its own Makefile/Kconfig/arch, `make
ARCH=arm64 defconfig && make Image dtbs` just works). `kernel/ayn/qcs8550`
is NOT that - its own `build.config.msm.kalama` sources
`${ROOT_DIR}/msm-kernel/build.config.common`, i.e. this is Qualcomm's split
**msm-kernel (base) + vendor-hook overlay** design. The real kernel source
lives in a sibling `msm-kernel` repo we haven't even cloned yet. Google's
own build orchestration for this generation of kernel is Bazel/Kleaf
(bzlmod), not a plain `make` invocation - there is no legacy `build.sh`
fallback on the `main-kernel` branch of `build/kernel` (it was removed once
that branch went bzlmod-only).

**Chased the Bazel/Kleaf dependency chain a long way, in order:**
1. `kernel/ayn/qcs8550`'s own `BUILD.bazel` uses `define_common_kernels` -
   Kleaf, confirmed no legacy WORKSPACE path exists on `main-kernel`.
2. `build/kernel/kleaf/bzlmod/bazel.MODULE.bazel` is the authoritative dep
   list: ~17 `local_path_override`'d Bazel modules under `external/`
   (bazel_skylib, rules_cc/python/pkg/shell/rust/license/devicetree,
   protobuf, zlib, zstd, abseil-cpp/py, platforms, bazel_features,
   package_metadata) plus several `kleaf_local_repository`-style prebuilt
   tool deps (dwarves, libcap, kmod, dtc, lz4, toybox, zopfli, pigz, avb,
   argp-standalone, obstack, stg) plus NDK/Rust-toolchain prebuilts (the
   latter two look GBL-bootloader-only, probably skippable for our target).
3. The `prebuilts/kernel-build-tools` bundled `bazel` binary is **x86_64**.
   Under `qemu-user-static` emulation it crashed - `[Too many errors,
   abort]`, `uncaught target signal 6` - because Bazel bundles a JVM, and
   JVMs are unreliable under user-mode QEMU (JIT/signal handling doesn't
   translate well). Fixed by adding a scoped `amd64`-only apt source
   (`archive.ubuntu.com`, since the configured mirror is `ports.ubuntu.com`
   which doesn't carry amd64) to install `libc6:amd64`/`libstdc++6:amd64`
   for the emulated interpreter, AND separately by downloading the
   **official native linux-arm64 Bazel 8.0.0 release** directly from GitHub
   and using that instead - sidesteps the JVM/qemu problem entirely, this
   is the one to keep using.
4. `MODULE.bazel` (symlinked at the workspace root from
   `build/kernel/kleaf/bzlmod/bazel.MODULE.bazel`) declares `bazel_dep(name
   = "gbl", dev_dependency = True)` with no version and no override -
   errors immediately as root module. Fixed with a hand-written stub module
   (`external/stub-gbl/{MODULE.bazel,BUILD.bazel}`, just
   `module(name="gbl", version="0.0.0")`) via
   `--override_module=gbl=external/stub-gbl`.
5. Cloned all ~17 `local_path_override` targets from
   `android.googlesource.com/platform/external/...` (~150MB total, cheap).
   Two needed a non-default branch to actually contain `MODULE.bazel`:
   `protobuf` needed `main-kernel` (its default `main` branch is the plain
   Android.bp/Soong variant with no bzlmod support at all); `zlib` needed
   **none of** `main-kernel`, `main-kernel-2025`, `main-kernel-2026`, or
   `main-kernel-build-2024` - none of the branches tried have `MODULE.bazel`
   anywhere in the tree. Bazel wants `zlib` `1.3.1.bcr.5` specifically (the
   `.bcr.N` suffix is a Bazel Central Registry patch revision), which may
   mean the real answer is pulling the BCR module folder itself rather than
   an AOSP mirror branch - not yet resolved.

**Decision: stopping here, not continuing further tonight.** Reasons:
- This is Bazel workspace archaeology, not Halium work - every fix so far
  (JVM/qemu, gbl stub, protobuf/zlib branch hunting) has been pure
  yak-shaving with the actual kernel source (`msm-kernel`) not even cloned
  yet. No sign the chain ends soon; NDK/Rust-toolchain prebuilts and the
  msm-kernel sibling repo are still ahead and could each be another
  multi-step investigation.
- It's the same class of risk as the manifest-sync disk-fill incident, via
  a different door - open-ended, un-scoped cloning against an unfamiliar
  build system, at 1am, unsupervised.
- More importantly: **it's very likely unnecessary**. Real Halium ports
  bridge libhybris to the device's already-built, already-tested stock/OEM
  kernel + vendor blobs - they do not, as standard practice, rebuild the
  vendor's own Android kernel from source via Google's exact Bazel
  toolchain. LineageOS itself already produces working, community-tested
  RP6 builds (official device, active wiki). hybris-boot's job is to
  package a custom initramfs/init *around* an existing kernel Image; a
  full from-source recompile is only actually required if we need to
  change kernel-level config (which, for an Android-derived GKI kernel,
  we mostly don't - binder/binderfs/seccomp/cgroups/namespaces are already
  on by default in any real Android kernel, unlike `RetroidPocket/linux`
  where we just had to add them by hand, see below).

**Recommended next step for RP6, when picked back up:** look for a
LineageOS-published RP6 build artifact (recovery/OTA package containing a
`boot.img`) to pull the already-built kernel Image + DTB + vendor modules
from directly, instead of reproducing the from-source Bazel build. That's
the same shape of shortcut that made Mini V2's milestone cheap, applied to
RP6. Only fall back to the full from-source Bazel path if no such artifact
exists or turns out to be unusable.

**What's been kept on disk** (`libhybris/src/kernel-ayn-qcs8550/`, ~4.3GB,
cheap to keep): the kernel/modules/devicetree source, `build/kernel`,
prebuilt Clang (`lineage-20.0` branch, r416183b - **note this doesn't match
`build.config.constants`'s `CLANG_VERSION=r450784e`, wrong toolchain
version, would need re-fetching if the Bazel path is resumed**),
`kernel-build-tools`, the native arm64 Bazel binary, and the ~150MB of
cloned `external/` bzlmod deps. None of this is wasted if resumed, but none
of it blocks anything else either.

## 2026-07-24: Mini V2 Halium kernel config — Kconfig fragment applied, verified

User supplied a specific list of Kconfig options needed for the Halium
libhybris bridge (namespaces/cgroups/seccomp for container isolation,
Android binder/binderfs for the HAL IPC bridge, overlayfs/squashfs/zstd for
a vendor-image rootfs strategy, btrfs to match armada's own filesystem
choice). Applied to the already-working `RetroidPocket/linux` build:

- Fragment saved at `libhybris/configs/halium-common.config`; merged via
  `scripts/kconfig/merge_config.sh -m .config <fragment>` then `make
  ARCH=arm64 olddefconfig`, same discipline as armada's own kernel config
  tooling uses to avoid silent dependency-driven demotion.
- **`CONFIG_ASHMEM` does not exist in this tree at all** - it's an
  AOSP/Android-common-kernel-only driver, never part of mainline Linux
  (superseded upstream by `memfd_create`). `RetroidPocket/linux` is a
  mainline-derived tree, so there's nothing to enable. If libhybris/the
  vendor blobs genuinely need ashmem (older HALs sometimes do), it would
  have to be backported from an AOSP common-kernel fork - not attempted,
  flagging for whoever picks up the actual libhybris bring-up.
- `CONFIG_ANDROID_BINDER_IPC`/`CONFIG_ANDROID_BINDERFS` - mainline has had
  these for years, just weren't on; now `=y`. Default
  `CONFIG_ANDROID_BINDER_DEVICES="binder,hwbinder,vndbinder"` already
  includes `hwbinder`, which is what HIDL HAL calls (the libhybris-relevant
  one) actually need.
- `CONFIG_DM_CRYPT` requested `=y`, landed as `=m` after `olddefconfig` -
  it `depends on BLK_DEV_DM` which is itself `=m` here, and Kconfig won't
  let a bool depend on a module. Loadable dm-crypt is fine for our purposes
  (no known need for it before `/` is mounted).
- `CONFIG_BTRFS_FS_CHECK_INTEGRITY` requested `=n` - already satisfied,
  the symbol doesn't exist in this kernel's `fs/btrfs/Kconfig` at all
  (removed upstream).
- Everything else applied exactly as requested with no surprises.
- Rebuilt `arch/arm64/boot/Image` clean with the new config
  (`file`-verified valid ARM64 boot Image, 47.5MB). Merged `.config` saved
  at `libhybris/configs/mini-v2.config.applied` for reference.

## 2026-07-24: hybris-boot itself — checked, it's not the next mechanical step

Cloned `Halium/hybris-boot` (`libhybris/src/hybris-boot/`, active fork,
last pushed 2026-07-17) to see what actually turns our built kernel Image
into a bootable hybris ramdisk. Its own `Makefile` prints a literal warning
on every invocation: *"You are using the non-android-build approach /
Please don't do this / Setup an android build chroot and build your img
files there."* Its standalone device targets (`mako`, `grouper`, `tilapia`,
`aries`...) are 2012-2013-era Nexus/Galaxy devices - this repo is legacy
tooling kept around for old Mer/SailfishOS-style ports, not the path a
modern GKI device like ours would actually use. The real, intended flow is
`mka hybris-boot hybris-recovery` run *inside* a full Android/LineageOS
device build tree, where it picks up the kernel + a `BOARD_KERNEL_CMDLINE`
etc. from that build's own config.

This means the actual next milestone isn't "run hybris-boot's Makefile
against our Image" - it's a real strategic question that needs a decision,
not just more digging:

- **Mini V2 has no official Android/LineageOS build at all** (there's no
  stock Android for this device family in the Halium sense - `RetroidPocket/
  linux` is a from-scratch mainline-ish kernel, not an AOSP kernel tree).
  Getting real Adreno 650 vendor HAL blobs therefore means **borrowing them
  from a donor device** - some other SM8250 (Snapdragon 865) phone with a
  LineageOS/stock Android build, GKI-ABI- and DTB-compatible enough for the
  blobs to load. Picking that donor device is a real decision, not
  mechanical work - it determines almost everything downstream (which
  vendor partition, which kernel ABI to target, how much of our own DTS
  work carries over).
- **RP6 has an official LineageOS build** (see above), which is the more
  promising path precisely because a real `mka hybris-boot` flow already
  exists for it upstream - once (if) the from-source kernel question is
  resolved via a prebuilt LineageOS boot.img instead of our own from-source
  Bazel rebuild.

Recommending this gets a real conversation with the user before more
autonomous digging - "which donor device for Mini V2's vendor blobs" and
"do we lean into RP6-via-LineageOS-prebuilts instead of Mini V2 first" are
project-direction calls, not something to guess at overnight.
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

## Milestone reached, same session: Mini V2 kernel actually builds

`RetroidPocket/linux` (`sm8250/linux-6.12.y`) turned out to have **no**
Bazel/Kleaf at all - plain kbuild, unlike both RP6 paths. Installed
flex/bison/libssl-dev/libelf-dev/bc/dwarves, ran
`make ARCH=arm64 defconfig && make ARCH=arm64 -j8 Image dtbs` natively
(this host is aarch64, no cross-compiler or emulation needed) and it
**built clean**: `arch/arm64/boot/Image` (45.7MB, confirmed
`file`-valid "Linux kernel ARM64 boot executable Image") plus
`sm8250-retroidpocket-rpmini.dtb` compiled successfully alongside RP5's.

This proves the toolchain/source/config combination is genuinely sound
for this device family - a real, verified first milestone, not just a
paper plan. Remaining gap for Mini V2 *specifically* (vs. the original
Mini, which this DTB is for): still need the V2 devicetree - per the
earlier note, likely a small diff from `rpmini.dts` (screen
masking difference), now something to actually attempt with a working
build loop to test against, rather than a cold-start unknown.

Next: hybris-boot ramdisk assembly against this working Image, and/or
start the Mini V2 DTS diff. RP6's Bazel/Kleaf path (repo sync in
progress) is the slower, more complex of the two - Mini V2 may end up
being the faster path to an actual libhybris milestone despite starting
the RP6 side first.

## Incident, same session: full LineageOS repo sync filled the disk

Ran `repo init -u https://github.com/LineageOS/android.git -b lineage-23.2`
+ `repo sync` for RP6 to reliably resolve the Bazel/Kleaf workspace layout
(after two hand-reconstruction mistakes above). It pulled 84GB (`.repo`
alone) before disk space hit 8.6GB free / 97% used and had to be killed
and deleted as an emergency measure - the full default manifest pulls in
the *entire* AOSP platform tree (frameworks, packages, art, bionic,
thousands of repos), almost none of which is needed just to validate a
kernel builds. Same mistake as trying to "just repo sync" without
scoping - don't repeat it.

**Corrected approach, matching what actually worked for Mini V2**:
don't `repo sync` a full manifest for a kernel-only goal. Instead,
individually clone just what Kleaf actually needs, using the specific
paths/repos already identified: `android_kernel_ayn_qcs8550` +
`-devicetrees` + `-modules` + `-common-modules` (already have these,
`kernel-ayn-qcs8550/kernel/ayn/`), plus `build/kernel` (Google's Kleaf
tooling, `android.googlesource.com/kernel/build`) and the specific pinned
Clang (`LineageOS/android_prebuilts_clang_kernel_linux-x86_clang-r416183b`
on GitHub, per the manifest snippet) and `kernel/prebuilts/build-tools`
(googlesource, `main-kernel-2025` revision) - fetched directly, not via
`repo`. More manual assembly, but bounded and disk-safe, unlike a full
manifest sync.
