# libhybris / Halium migration — scoping notes

Started 2026-07-22, first pass only. This is research groundwork, not a plan
to execute yet - the goal here was just "is this feasible, and what's the
real first step," per the earlier discussion about driver-support pain
(DSI PLL issues, GPU OPP tuning, all the ROCKNIX-derived kernel patching this
whole project has needed).

**Naming note (added 2026-07-24):** the project is moving toward a new
name, **CR(g) OS**, for new work going forward - this Halium/libhybris
port is exactly that kind of new work, so treat it as CR(g) OS territory
conceptually (kernel/DTB/module artifacts, the container/init design, the
eventual boot flow). Nothing existing is being renamed: the armada repo,
codebase, and OTA pipeline stay untouched and unaffected for now.

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

## 2026-07-24: RP6 LineageOS prebuilt boot images — pulled, unpacked, real milestone

Acted on the recommendation above. `download.lineageos.org` has a public
API (`https://download.lineageos.org/api/v2/devices/RP6/builds`) listing
individual downloadable artifacts per nightly, not just the flashable zip.
Latest at the time: 2026-07-18. Pulled `boot.img`, `vendor_boot.img`,
`dtbo.img`, `init_boot.img` directly (sha256 verified against the API's own
hashes), ~320MB total combined - nowhere near the earlier disk-fill
incident's scale.

Unpacked with `unpack_bootimg.py` pulled straight from
`system/tools/mkbootimg` (a single lightweight standalone Python script via
googlesource's `?format=TEXT` gitiles endpoint, base64-decoded - no build
tree, no Bazel, no `repo` needed at all):

- **`boot.img`** (header v4): kernel only, **ramdisk size 0**. This is
  Android's modern split-boot layout - `boot.img` on Android 13+/GKI
  devices carries just the kernel, the generic ramdisk moved to a separate
  `init_boot.img`.
- Extracted kernel (`out-boot/kernel`, 51MB) is a valid, real ARM64 boot
  Image. `strings` shows `Linux version 5.15.208-g94a246947232`, built
  2026-07-18 with Android's own Clang/LLVM 21 toolchain (matches
  `kernel/ayn/qcs8550`'s tree, same version we found there - this genuinely
  is that kernel, already built).
- **`vendor_boot.img`** (header v4): device-specific DTB (473KB, single
  flat blob, decompiles cleanly with `dtc` - real qcs8550/kalama tree
  visible: `remoteproc-adsp`, `remoteproc-spss`, `dsi_pll_codes`, etc.) +
  an LZ4-compressed vendor ramdisk (9.9MB compressed, 29.6MB decompressed
  cpio). Needed the actual `lz4` CLI (only `liblz4` was preinstalled) and
  `--legacy`-less `lz4 -d` worked fine once the binary existed.
- Vendor ramdisk contains **241 real, prebuilt `.ko` kernel modules** under
  `lib/modules/` - `modinfo` on one (`moorechip-joystick.ko`, "Driver for
  Moorechip controller over UART", by Balázs Triszka) shows `vermagic:
  5.15.208-g94a246947232 SMP preempt mod_unload modversions aarch64` -
  **exact match** to the kernel's own version string, i.e. this is a real,
  ABI-consistent, already-tested kernel+modules set, not something
  reconstructed or guessed at.
- **`init_boot.img`**: the real generic-ramdisk half of the split (kernel
  size 0, ramdisk 2.8MB compressed / 5.2MB decompressed) - standard modern
  Android generic ramdisk layout (`init`, `first_stage_ramdisk`,
  `second_stage_resources`, etc.), useful later as a reference for how
  hybris-boot's own custom init needs to hook in, not touched further yet.

**This delivers exactly what the paused Bazel/Kleaf path was trying to
produce, without any of its risk.** No `msm-kernel` sibling repo, no
bzlmod dependency graph, no JVM/qemu fighting - just four small file
downloads and a standard unpack script. Confirms the recommendation from
the previous section was right.

All of this is saved at `libhybris/src/rp6-lineageos-prebuilt/` (gitignored,
~341MB): the four `.img` files, `unpack_bootimg.py`, the unpacked
`out-boot/` / `out-vendor_boot/` / `out-init_boot/` directories, and the
extracted `vendor_ramdisk_extracted/` (241 `.ko` files under `lib/modules/`)
and `init_ramdisk_extracted/` trees.

**Next step from here**: this is now genuinely at the same stage Mini V2
reached (a real, verified, buildable/bootable kernel in hand) - the actual
hybris-boot ramdisk-assembly work can start on RP6 using these artifacts
instead of Mini V2's. Still open, still needs a real decision, not a guess:
whether to pursue RP6 or Mini V2 first as the initial hybris-boot target -
RP6 now has a head start (real vendor modules + DTB in hand, zero build
risk) but Mini V2 has no Android layer at all to borrow HAL blobs from
(the donor-device question), so RP6 may honestly be the more tractable
first target end-to-end. Flagging this shift rather than deciding it.

## 2026-07-24: the real, current boot architecture is LXC-container-based, not a bare ramdisk - major finding

`Halium/hybris-boot` (checked earlier, last pushed 2022) turned out to be
legacy. Checked the org's actually-active repos instead (sorted by push
date) and found the real, current toolchain: **`initramfs-tools-halium`**
(pushed 2026-07-13 - six days before the RP6 nightly we pulled) +
**`halium-boot`** (bootimg generator) + `lxc-android` ("Configuration for
starting android inside LXC container") + `jumpercable`
("System-As-Root boot helper") + `mechanicd` ("Manage Android-isms and
kernel features on GNU/Linux systems"). This is a coherent, still-developed
toolchain, not abandonware.

**`initramfs-tools-halium` is genuinely standalone** - a Debian
`initramfs-tools` hook set, built via `debootstrap` (no Android build tree
needed at all), and it **publishes prebuilt continuous release binaries**:
pulled `initrd.img-touch-arm64` from
`github.com/Halium/initramfs-tools-halium/releases/tag/continuous`
(sha256-verified, ~4MB compressed). Saved at
`libhybris/src/initramfs-tools-halium/` (gitignored). Note: this prebuilt
release is stale (last updated Jan 2023) but the logic itself is generic
device bring-up, not device-specific, so it's still a legitimate reference
even if we end up rebuilding it ourselves via `build-initrd.sh`.

**Read `scripts/halium` (677 lines) - this is the real mount/boot
architecture**, and it's a materially better fit for armada than the old
`hybris-boot`/`.stowaways` model:

1. `identify_boot_mode()` reads `androidboot.mode` off `/proc/cmdline` to
   decide `halium` vs `android` boot (charger mode etc.) - the vendor boot
   chain still exists underneath, we just don't normally take it.
2. `mountroot()` finds Android's `/data`-equivalent partition, mounts it
   at a temp mountpoint, then mounts the **actual target OS rootfs**
   (`/halium-system`) - either a real partition, a loop-mounted image
   file, or (classic approach) a directory inside the Android data
   partition. This is what becomes PID 1 - **not Android**.
3. It then loop-mounts Android's `system.img` (or `android-rootfs.img`)
   and later `mount --move`s it into place for **`/var/lib/lxc/android/`**
   - the vendor Android userspace runs **inside an LXC container**, as a
     guest, not as the host OS. `mount_kernel_modules()` bind-mounts the
     Android image's `/lib/modules` (exactly the 241 `.ko` files we
     extracted from `vendor_boot.img`) into the real rootfs.
4. Finally `switch_root`s into `/halium-system` - the real OS boots
   normally from there.

**Why this matters for armada specifically**: this is much closer to
armada's own mental model (bootc/podman, containers as the isolation
primitive) than the legacy approach - the "Android layer" is architecturally
just a guest container that owns the GPU/media vendor blobs, not something
that takes over the whole boot. It's plausible this could use podman
instead of LXC (mechanicd/lxc-android would need checking - not done yet).

**Why this is where autonomous work stops for now**: `mount_android_partitions()`
/ `identify_file_layout()` assume a classic Android partition table (labeled
`/data`, `/cache` etc., found by scanning `/dev/block/by-name` or similar).
**armada's own disk image has none of that** - it's a single btrfs root on
an SD card, GRUB-or-qcom-abl booted (see `BOOT_ARCHITECTURE.md`), no Android
partition layout at all. Where the halium-system rootfs and the Android
`system.img`/vendor blobs actually *live* on an armada install - a new
partition carved out of the SD image, a subvolume, a plain file on the
existing btrfs root - is a real storage-layout decision with real
consequences (image size, OTA update story, A/B considerations), not
something to guess at without the user.

**Recommended next steps, in order, next time this is picked up:**
1. ~~Decide the storage layout question above.~~ **Decided 2026-07-24**:
   file/subvolume on the existing btrfs root - not touching the SD image's
   partition table. Keeps this MVP-scoped; halium-system and Android's
   system.img live as ordinary files/subvolumes inside armada's own root,
   same disk, no repartitioning, no `finalize-armada-image.sh` changes.
   Tradeoff accepted knowingly: shares space/I/O with the rest of armada
   rather than being isolated - fine for a first working prototype.
2. ~~Check whether `lxc-android`/`mechanicd` could map onto podman instead
   of LXC.~~ **Checked 2026-07-24**: read `lxc-android`'s actual container
   config (`var/lib/lxc/android/config`) and `pre-start.sh`. It's a
   genuinely minimal container - `lxc.network.type = none` (no separate
   network namespace, shares the host's), a handful of bind mounts from
   the host's Android fstab into the container rootfs, and
   `lxc.init_cmd = /init` - it just runs Android's own `/init` as the
   container's PID 1, sharing the kernel. No OCI image involved anywhere.
   **This is a worse fit for podman than expected, and a better fit for
   `systemd-nspawn` than for either.** Podman's whole model centers on OCI
   images and (by default) a separate network namespace - neither applies
   here, there's no image to pull/build, just an existing directory tree
   to boot another init system inside of. `systemd-nspawn` is *built for
   exactly this* ("boot a second init tree, share the host kernel") and
   costs armada zero new dependencies, since it's already part of systemd.
   Recommending `systemd-nspawn` over both LXC (extra dependency, and this
   session already has a `feedback_verify_thirdparty_claims`-style
   discipline to actually check tools before adopting them) and podman
   (wrong abstraction for this specific job) - not yet implemented,
   flagging as the working assumption for whenever this is picked up.
3. Only then actually attempt building/adapting an initramfs + assembling
   a boot.img (`halium-boot`'s manual-repack recipe, or `mkbootimg.py` from
   the same `system/tools/mkbootimg` repo `unpack_bootimg.py` came from)
   against the RP6 kernel/DTB/modules already in hand.

## 2026-07-24: pulled the real vendor/system partition images too - the actual payoff is confirmed real

`boot.img`/`vendor_boot.img` only get you a bootable kernel - the actual
Android *userspace* (GPU/media/sensor HAL blobs, the thing libhybris exists
to bridge to) lives in separate partition images that aren't part of either
file. Those only ship inside the full OTA package as an Android A/B update
payload (`payload.bin` inside the flashable zip), not as individually
downloadable files.

- Pulled the full `lineage-23.2-20260718-nightly-RP6-signed.zip` (1.3GB,
  sha256-verified against the API), extracted `payload.bin` (1.3GB).
- Used `payload-dumper-go` (a real, independent, actively-maintained tool -
  not Google's own; grabbed the official `linux_arm64` release binary,
  sha256-verified, native aarch64 so no qemu needed at all) to list and
  selectively extract partitions.
- `payload-dumper-go -l` lists everything in the payload: firmware/baseband
  blobs we don't need (`abl`, `aop`, `bluetooth`, `cpucp`, `dsp`, `hyp`,
  `modem`, `tz`, `uefi`, `xbl`, etc. - these matter to a from-scratch
  bootloader replacement, not to us, since armada already has its own
  qcom-abl/GRUB boot chain per `BOOT_ARCHITECTURE.md`) alongside the ones
  that actually matter for libhybris: `vendor` (842MB), `vendor_dlkm`
  (79MB), `odm` (1.8MB), `system` (981MB), `system_ext` (566MB). Skipped
  `product` (2.5GB, mostly bundled apps/UI, not HAL-relevant) to stay
  disk-conscious. Total pulled: ~2.4GB, disk still fine (173GB free
  afterward).
- All five are real ext4 filesystem images (`file` confirms - extents,
  large/huge files support). Verified by mounting `vendor.img` read-only:
  **real, official Adreno GPU vendor blobs are present and intact** -
  `libEGL_adreno.so`, `libGLESv2_adreno.so`, `libgralloc.qti.so`,
  `vulkan.adreno.so`, `libq3dtools_adreno.so`, etc. under `lib64/` and
  `lib64/egl/`. This is the actual payoff of the whole Halium approach,
  and it's now *confirmed real*, not theoretical.
- Also mounted `system.img` read-only: confirms the real System-as-Root
  layout (its root **is** Android's actual `/`, with `vendor`/`odm`/
  `product`/`system_ext`/`vendor_dlkm` as empty mountpoint directories
  waiting for the other partition images to be mounted there at boot -
  exactly the layered-mount structure `scripts/halium`'s
  `mount_android_partitions()` builds at runtime). Confirmed a full,
  real HIDL/AIDL HAL interface library set under `system/lib64/`
  (`android.hardware.audio.*`, `.boot.*`, `.camera.*`, `.broadcastradio.*`,
  etc., correctly versioned). Didn't find HAL *service* binaries under
  `system/bin/hw/` (empty) - expected, those are vendor-provided and
  likely live under `vendor.img`'s own `bin/hw/`, not checked yet.
- Both mounts done read-only, cleanly unmounted after inspection - no
  writes, no risk to the source images.

All five images saved at
`libhybris/src/rp6-lineageos-prebuilt/full-ota/dumped/` (gitignored,
~2.4GB): `vendor.img`, `vendor_dlkm.img`, `odm.img`, `system.img`,
`system_ext.img`. The full zip and `payload.bin` are also kept at
`libhybris/src/rp6-lineageos-prebuilt/full-ota/` in case other partitions
are needed later (e.g. `product` if some HAL turns out to live there
unexpectedly).

**Net result: everything the from-source Bazel/Kleaf path and the
theoretical LXC/nspawn design were ultimately working toward is now
sitting on disk, verified real.** Kernel, DTB, 241 vendor `.ko` modules,
and now the actual vendor/system HAL blob partitions too. What's left is
genuinely the design/assembly work: the nspawn container spec, the
initramfs adaptation, and the btrfs storage layout (already decided) -
no more "is this even real" uncertainty.

## 2026-07-24: first nspawn container draft, locally verified where possible

Started on the actual container assembly, verifying everything checkable
without real RP6 hardware:

- **`libhybris/scripts/assemble-android-guest.sh`**: loop-mounts
  `system.img` as the base (read-only) and `vendor`/`odm`/`system_ext`/
  `vendor_dlkm` at their real mountpoints inside it - the same layered
  structure Android itself builds at boot, and the same one
  `scripts/halium`'s `mount_android_partitions()` builds. **Ran it for
  real** (not just written, actually executed): assembled tree confirmed
  correct, `vendor/lib64/libEGL_adreno.so` reachable at the expected path,
  `/init` resolves (`/system/bin/init`, a real ARM64 PIE ELF binary,
  confirmed with `file`). Cleanly unmounted after - read-only throughout,
  no writes to the source images.
- **`libhybris/nspawn/android-guest.nspawn`**: first draft of the
  container spec, translated from `lxc-android`'s LXC config directive by
  directive (`Boot=no` + `Parameters=/init` = LXC's `lxc.init_cmd = /init`;
  `Private=no` under `[Network]` = LXC's `lxc.network.type = none`;
  `DropCapability=CAP_MAC_ADMIN CAP_MAC_OVERRIDE` = LXC's matching
  `lxc.cap.drop`). Checked every directive name against this machine's own
  `man systemd.nspawn` - all real, not guessed syntax.
- **Device node list wasn't guessed from general Qualcomm knowledge** -
  mounted `vendor.img` again and grepped its own `etc/init`/`etc/`
  ueventd/init rc files for actual device references:
  `/dev/kgsl`/`kgsl-2d0`/`kgsl-2d1`/`kgsl-3d0` (GPU), `/dev/ion`,
  `/dev/dma_heap` (memory allocation) all confirmed present in this
  exact build's own configs. `/dev/binder`/`hwbinder`/`vndbinder` added
  too (only `vndbinder` actually turned up in the text-config grep - the
  others are kernel-created per `CONFIG_ANDROID_BINDER_DEVICES` and
  referenced directly by compiled binaries, not text configs, so their
  absence from the grep doesn't mean absence from the real requirement).

**What's genuinely NOT verified, and can't be from a build host**: whether
this actually boots. Android's `/init` needs binder/ashmem/ion kernel
support, `androidboot.*` cmdline properties, and a kernel that's actually
*this* one (5.15.208 qcs8550) - none of that can be meaningfully tested
here. First real test has to happen on RP6 hardware. Flagging this clearly
rather than implying the design is proven - it's a well-grounded first
draft, not a working port yet.

**Still not started**: the initramfs work (adapting
`initramfs-tools-halium`'s `scripts/halium` to call `assemble-android-guest.sh`
+ `systemd-nspawn` instead of the LXC pre-start hook, and to find
halium-system on the btrfs-subvolume-or-file layout instead of a classic
Android partition table), and actually assembling a flashable boot.img.

## 2026-07-24: boot.img packing toolchain verified end-to-end (round-trip)

RP6 wasn't reachable over SSH from this environment (192.168.0.88 timed
out) to attempt anything on real hardware, so stayed with work that's
actually verifiable from here rather than writing unverifiable init-script
guesses. Checked whether the packing half of the toolchain (not just
unpacking) actually works:

- Pulled `mkbootimg.py` + `repack_bootimg.py` + `gki/generate_gki_certificate.py`
  from the same `system/tools/mkbootimg` googlesource repo
  `unpack_bootimg.py` came from (same lightweight, no-build-tree approach).
- **Round-trip test**: packed a fresh `boot.img` (header v4) from the
  kernel already extracted from the real LineageOS `boot.img`, then
  unpacked that repacked image again with `unpack_bootimg.py`. Result:
  `os_version`/`os_patch_level`/header version all matched the original,
  and `cmp` confirms the kernel bytes are **byte-identical** after the
  pack→unpack round trip. (The repacked file is smaller than the original
  100MB - expected, `mkbootimg.py` doesn't pad to the AVB-reserved
  partition size the way LineageOS's own signed build does; irrelevant to
  whether the tool works correctly.)
- Confirms the actual packing tool works correctly on this real kernel,
  not just the already-proven unpacking direction. This is the last piece
  of infrastructure needed before assembling a real custom boot.img -
  everything else now blocks on writing the actual init logic (needs
  real hardware iteration, not more guessing) and having the initramfs
  itself.

## 2026-07-24: actually ran systemd-nspawn against the real Android /init locally - major finding

Realized "needs real hardware" wasn't fully true - this build host is
itself native aarch64, so the *container mechanism itself* (not the actual
HAL/GPU functionality, which genuinely does need real RP6 hardware) is
testable right here. Tried it rather than continuing to assume it needed
hardware:

- First attempt (`systemd-nspawn --directory=<assembled-tree> /init`)
  failed immediately: *"Directory ... doesn't look like it has an OS tree
  (/usr/ directory is missing). Refusing."* - nspawn does a hard sanity
  check for `/usr/` before it'll boot anything, and Android's rootfs has
  no `/usr` at all (`/system` is Android's equivalent). Not documented in
  `man systemd-nspawn` in an obviously-searchable way, found by hitting it
  directly.
- The assembled tree is mounted read-only by design
  (`assemble-android-guest.sh` uses `loop,ro`), so couldn't just `mkdir
  usr` on it directly. Set up a temporary overlayfs (tmpfs upper +
  read-only assembled tree as lower) purely for this test, created an
  empty `usr/` in the writable upper layer, retried.
- **Android's real `/init` actually started.** Got past nspawn's OS-tree
  check and began executing. It then hit something fatal fast (almost
  certainly: this build host's kernel has none of the
  binder/ashmem/`androidboot.*`-cmdline/SELinux-policy support the real
  RP6 kernel has - expected, this is a generic Ubuntu build host, not
  RP6's actual 5.15.208 kernel) and **called `reboot()`**, which
  `systemd-nspawn` correctly interpreted as a container reboot request -
  confirmed by watching it loop ("Container ... is being rebooted." over
  and over until the 15s timeout killed it).
- **This is genuinely significant, verified evidence**: the
  nspawn+Android-`/init` mechanism itself is sound at the process/
  namespace level - a real, unmodified Android init binary runs under
  nspawn, and its syscalls (specifically `reboot()`) propagate through
  nspawn's container lifecycle handling correctly. The empty-`usr`-dir
  workaround is now a confirmed, necessary, and sufficient fix for
  `android-guest.nspawn`, not a guess.
- Everything was cleaned up afterward: killed by `timeout 15` (nothing
  left running, `machinectl list` confirmed empty), all loop/overlay
  mounts unmounted, temp directories removed (needed `sudo rm` for a
  couple of root-owned files nspawn's overlay upper layer created -
  `system/etc/localtime`, `system/etc/resolv.conf`, `var/log/journal`).
  No writes ever touched the real source `.img` files (read-only
  throughout) or anything outside job-scoped temp directories.

**Updated `android-guest.nspawn`** with the confirmed `usr/` workaround
requirement (see file - needs to be created by whatever prep step calls
`assemble-android-guest.sh`, e.g. `mkdir -p "$ROOT/usr"` right after
assembly, since the real deployment won't have the read-only-mount
complication this local test hit - the real halium-system-side rootfs
this all lives inside is meant to be writable per the earlier btrfs
storage decision).

**What's still genuinely unverified and needs real RP6 hardware**:
whether `/init` gets further than "immediately reboot" once the real
qcs8550 kernel, real `androidboot.*` cmdline, and real binder/ashmem
support are present - that can't be simulated here. But the container
*mechanism* itself is no longer a guess.

Also found and fixed a real bug in `assemble-android-guest.sh` while
testing this: the first version wrapped the *entire* pre-mounted tree
(system.img + vendor/odm/system_ext/vendor_dlkm already mounted inside
it) in one overlayfs to add a writable `usr/` - but **overlayfs does not
see into submounts that already exist inside its lowerdir** (it looks up
the lowerdir's raw underlying directory entries directly, bypassing
whatever's mounted on top of them - a real, easy-to-hit overlayfs
gotcha, not documented anywhere obvious). Result:
`vendor/lib64/libEGL_adreno.so` was unreachable through the overlay even
though the submount itself was fine. Fixed by re-ordering: build the
overlay from `system.img` *alone* first (gets a writable `usr/`), then
mount vendor/odm/system_ext/vendor_dlkm directly onto the overlay's own
merged result afterward - mounting onto an already-established overlay's
merged view works completely normally, it's specifically pre-existing
mounts *inside a lowerdir* that break. Re-verified end to end after the
fix: all five images reachable, `/init` still starts under nspawn
correctly. Script and file header comments updated to explain why the
ordering matters, so this doesn't get "simplified" back into the broken
version later.

## 2026-07-24: hit a real complexity wall on early-boot networking - reframed the MVP scope instead of guessing

The user's plan is: I build something flashable, they flash it, and *then*
SSH becomes available for further live iteration - so the immediate goal
became "get a custom boot.img with SSH reachable," not the full
Halium/Android-guest stack. Started down that path and hit a genuine wall:

- Considered WiFi bring-up in a custom early initramfs - needs
  `wpa_supplicant` (not in busybox) and the user's actual WiFi
  credentials, which isn't something to ask for/handle in this kind of
  session, and adds real complexity (firmware loading timing, associating
  correctly) with no way to verify without hardware.
- Considered USB gadget networking (CDC-ECM/RNDIS over the same cable
  already used for fastboot) as a credential-free alternative - checked
  what this exact vendor image actually uses, via its real
  `etc/init/hw/init.qcom.usb.rc`. **It's Qualcomm's own downstream GSI
  gadget stack** (`gsi.rndis`, `rndis_bam.rndis`, ConfigFS functions named
  `ffs.*`/`gsi.*`/`rmnet_bam.*` etc.), not the standard mainline
  `usb_f_rndis`/`usb_f_ecm` ConfigFS functions. Hand-rolling this
  correctly, blind, with no hardware to verify against, is a real risk of
  shipping something silently broken and burning one of the user's
  hardware-access-gated flash/test cycles for nothing.

**Reframed instead of pushing through blind**: the initramfs's job
doesn't have to include bringing up networking at all. Its actual job is
narrower - mount/find `halium-system` (the real target OS, on the
already-decided btrfs subvolume/file storage) and `switch_root` into it.
Once that handoff succeeds, a normal systemd-based OS takes over as PID 1
- and armada *already has fully working WiFi/SSH on this exact hardware*
(RP6 support predates this whole Halium effort, per
`rp6_boot_architecture.md`). So for the MVP, `halium-system` can just be
armada's own existing rootfs (or a minimal chroot of it) rather than
something new - only the front end (kernel + initramfs + reaching
`switch_root`) is genuinely new and needs verifying; the far end
(networking, SSH, a working userspace) is already solved, reused as-is.
The Android-guest/nspawn/HAL-bridging work becomes a systemd service that
starts *after* the OS is already up and reachable, not a boot-blocking
prerequisite - failures there become debuggable over SSH instead of
silent black-box boot failures.

This avoids the USB-gadget/WiFi-credential wall entirely for the MVP
milestone, without guessing at either. Not yet built - this is the
corrected plan, next actual step is writing the (now much simpler) init
script against it.
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
