# Architecture

Current-state technical architecture. This is a living snapshot, not a
diary - when something changes, edit this file in place rather than
appending a dated note (dated narrative belongs in `logs/YYYY-MM-DD.md`,
specific decisions with rationale belong in `DECISIONS.md`). Cross-
reference `SCOPING.md` for the detailed Halium/RP6/Mini V2 execution log
this summarizes.

⸻

## Repository structure

Current best structure, given directly by the user 2026-07-24, superseding
`MASTER_PLAN.md`'s original illustrative sketch. Neither is necessarily
final.

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

`platform/` holds the actual code modules (one per subsystem the plan
defines - Hardware Manager, Execution Manager, Library Manager, Update
Manager, boot tooling, UI). `packages/` is vendored/patched third-party
components the OS builds and ships - mirrors what
`build_files/30-install-steam-session.sh` already does for armada today
(mesa/gamescope/InputPlumber/mangohud RPM builds, FEX-emu).

**Open question, not resolved**: `packages/` lists both `fex/` and
`box64/`. armada today only uses FEX-emu (confirmed in
`build_files/30-install-steam-session.sh`, with an x86_64 Arch Linux
guest rootfs for library thunking); box64 is a different, separate
x86-on-ARM translation layer. Not yet clarified whether both are meant to
coexist (e.g. box64 as a fallback for specific games) or this is
provisional. Flag rather than assume before either is actually
integrated.

**Where this actually lives today**: no dedicated `atlas`/`crg-os` repo
exists yet. All work stages inside the armada repo under `libhybris/`
(this directory) until one is created.

⸻

## Device structure

```
devices/
    retroid-pocket-mini/
    retroid-pocket-5/
    flip2/
    odin2/
    odin3/
    steamdeck/
    generic/
```

Each device package contains: DTB, overlays, firmware, controller map,
thermal profile, battery profile, fan profile, boot configuration.

(Note the naming mismatch with the refined repo structure's `devices/`
list above - `retroid-pocket-mini` vs `rpminiv2`, and the refined list
adds `rp6` explicitly. Not yet reconciled; the refined, more recent list
is probably authoritative but hasn't been confirmed as a deliberate
rename.)

⸻

## Runtime structure

```
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
```

Every runtime exposes the same interface:

```
launch(game)
stop(game)
pause(game)
resume(game)
```

Execution Manager (PHASE 5, not started) should never care how the
runtime works internally.

⸻

## Base OS

**Decision**: Arch Linux ARM (`systemd` + `pacman` + `mkinitcpio` +
Btrfs), not armada's own Fedora bootc/ostree foundation. Armada is a
resource donor going forward (kernel patches, DTBs, controller/thermal
profiles, driver knowledge, and its `armada-packages` patch set), not the
architectural base. See `DECISIONS.md` for why.

A real rootfs is bootstrapped and verified as far as possible without
booting real hardware - see `ROADMAP.md` PHASE 1 and `logs/2026-07-24.md`
for the full build log. Location: `libhybris/src/atlas-base/rootfs/`
(gitignored).

Five of the six `armada-packages` gaming-stack components are built,
patched, and installed into this rootfs: `gamescope`, `mesa`(/Turnip),
`inputplumber`, `jupiter-hw-support`, `mangohud`. `fex` is deliberately
deferred (see `DECISIONS.md` - not required for PHASE 1's own exit
criteria, and a meaningfully bigger build than the others).

**`gamescope` and `mesa` are now real, tested `pacman` packages**
(`libhybris/packages/{gamescope,mesa}/PKGBUILD` - both built with
`makepkg`, installed via `pacman -U`, ownership verified via `pacman -Q`/
`pacman -Qo`).

**Known gap, `inputplumber`/`jupiter-hw-support`/`mangohud` still**: these
remain raw `make install`, not real `pacman`-tracked packages. Lower
priority than gamescope/mesa were - see `TECHNICAL_DEBT.md`.

⸻

## Android layer (Halium)

**Decision**: Halium (Android Bootloader → Android Kernel → Vendor
Drivers → Halium → Linux Userspace), not ChromeOS's ARC++/ARCVM. See
`DECISIONS.md`. `MASTER_PLAN.md`'s own architecture diagram names Halium
explicitly, and PHASE 4 names `Waydroid` alongside `libhybris`/`BinderFS`.

**Real artifacts already pulled and verified for RP6** (detail:
`SCOPING.md`): a real kernel (Linux 5.15.208, from an official LineageOS
build), its matching DTB, 241 real vendor `.ko` modules
(vermagic-verified against the kernel exactly), and the real vendor/
system partition images (confirmed genuine Adreno GPU vendor blobs -
`libEGL_adreno.so`, gralloc, the Vulkan/Turnip proprietary counterpart,
etc.).

**Container mechanism**: a `systemd-nspawn`-based prototype was built and
verified locally (real Android `/init` starts under it, gets as far as
calling `reboot()` on this non-RP6 build host - expected). **This is
likely being superseded by Waydroid**, since `MASTER_PLAN.md` names it
explicitly and Waydroid is a mature, actively-maintained tool built for
exactly this problem (matches the project's own "orchestrate, don't
reimplement" NON GOALS principle). The nspawn prototype's real value
going forward is what it *proved* (the container/reboot mechanics, the
`/usr`-directory requirement, the overlayfs-submount gotcha) rather than
as code to keep building on - don't assume it's the committed path.

**Storage for the Android guest + halium-system**: decided as a file/
subvolume on the existing btrfs root, not a new SD-image partition (kept
MVP-scoped, no `finalize-armada-image.sh`/partition-table changes
needed). See "Storage architecture" below for the deeper Btrfs-vs-Android
constraint this interacts with.

**Resolved 2026-07-24**: the donor-device question for Mini V2 (and
Flip2, RP5) is no longer open. The user has official stock firmware
dumps for Mini, Mini V2, Flip2, and RP5 too (same QFIL/EDL format as the
RP6 one just processed - see `logs/2026-07-24.md`) - these are each
device's own real, OEM-shipped kernel + vendor blobs, not a borrowed
donor device's. No donor-device compromise needed for the SM8250 family
at all. Not yet received/processed in this session - flagging that this
gap is closed as soon as they're provided, not guessing at contents yet.

**RP6 stock firmware already received and partially processed**
(`libhybris/src/rp6-stock-firmware/`, gitignored) - genuinely richer than
the LineageOS community build used earlier: `CONFIG_ASHMEM=y` already
enabled (unlike Mini V2's own `RetroidPocket/linux` mainline tree, where
the symbol doesn't exist at all), binder/binderfs already on by default,
306 real vendor `.ko` modules (vs. 241 in the LineageOS build). Likely
becomes the primary RP6 source going forward - not yet formally decided,
see `logs/2026-07-24.md`.

**All real partitions extracted, no special tooling needed after all**:
the `super_1.img`-`super_8.img` files turned out to be plain individually-
mountable ext4 images (this flash tool's own naming, not Android dynamic-
partition metadata) - `odm`/`product`/`system`/`system_dlkm`/
`system_ext`/`vendor`/`vendor_dlkm` all extracted and saved at
`libhybris/src/rp6-stock-firmware/partitions/`. **Confirmed with real
evidence, not just argument**: mounted stock `vendor.img`, found the real
Qualcomm Sensors HAL (`sensors.ssc.so`, `android.hardware.sensors@2.1.so`,
calibration libs) - exactly the gyroscope/sensor capability the armada-
kernel path (ADR-007) never would have provided.

**Android layer scope boundary** (ADR-006): Android is a thin bridge to
proprietary hardware, not a second userspace. From Android: GPU, audio
HAL, camera, sensors, Bluetooth*, Wi-Fi*, thermal, power, vibrator.
Native Linux instead: input (InputPlumber, already built), network
(NetworkManager), udev, systemd, PipeWire, BlueZ*. `*` = Bluetooth/Wi-Fi
specifically depend on whether each device's chip has a working native
Linux driver - checked per-device, not assumed project-wide. Not yet
checked for RP6 or Mini V2 specifically.

⸻

## Storage architecture

**Proposed idea** (not fully decided, real constraint found): drop
separate ext4 partitions entirely, use one big `userdata` partition
formatted Btrfs after install, with subvolumes instead of partitions:

```
userdata (btrfs)
├── @android_data
├── @steamos_root
├── @steamos_home
├── @cache
├── @snapshots
└── @images
```

**Real, verified blocker**: Android almost never ships kernels with Btrfs
support, and this matters specifically because Android (as a Halium
guest) and the CR(g) OS host **share one kernel** - there's no separate
Android kernel to have its own filesystem support. Checked the actual RP6
kernel's embedded IKCONFIG directly (extracted from the binary, not
guessed): `CONFIG_BTRFS_FS is not set`, `CONFIG_EXT4_FS=y`,
`CONFIG_F2FS_FS=y`. Confirmed absent as a loadable module too (checked
all 241 real vendor `.ko` files and `vendor_dlkm.img`).

**Decision, per the dead-end check documented in `DECISIONS.md`**: don't
put Android's own `/data` on Btrfs. Keep it ext4 (as shipped); give only
the CR(g) OS side (`@steamos_root`, `@steamos_home`, `@cache`,
`@snapshots`, `@images`) the unified Btrfs/subvolume treatment.
`@android_data` becomes an ext4 loopback image *living inside* a Btrfs
subvolume (an ordinary file from Btrfs's point of view), not a real
Btrfs subvolume itself.

⸻

## Boot chain

Not yet built for Atlas OS's own rootfs. armada's existing mechanism
(`post_process/make-bootimg.sh`) is the reference: takes the ostree
deployment's `vmlinuz`/`initramfs`, gzips the kernel, appends the
device's supported DTBs, packs via `mkbootimg.py` with header-v0/ABL
geometry (`--base 0x10000000 --pagesize 2048 ... --header_version 0`,
from `system_files/usr/lib/armada/bootimg-args`) into a single `/KERNEL`
staged on the FAT boot partition.

**Superseded (ADR-007)**: the plan was originally to reuse armada's own
kernel+DTB for the first boot test, decoupling "new base OS" risk from
"new kernel" risk. Corrected same day: armada's kernel doesn't have (and
was never going to gain) the vendor/HAL support PHASE 4 actually needs
(camera, full sensors incl. gyroscope, vendor GPU blobs) - it's a
different kernel line by armada's own deliberate design choice. Using it
first would've been a real milestone that doesn't build toward PHASE 4's
actual target, paying for the kernel integration twice instead of once.

**Current plan**: use the real Halium-target kernel already pulled and
verified in PHASE 4's work (`libhybris/src/rp6-lineageos-prebuilt/` -
Linux 5.15.208, real DTB, 241 vendor `.ko` modules, all vermagic-matched)
with the new Arch Linux ARM rootfs/initramfs for RP6's first real boot
test. Not yet attempted - in progress.
