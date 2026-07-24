# Boot architecture: GRUB vs. native ABL, and why the shared SD image needs to split

Written 2026-07-24 after a live RP6 flash landed at an unusable GRUB menu with no
entry for the device. Documents what was found, why, and the fix plan - so this
isn't re-derived (or re-broken) from scratch next time.

## RP6 (SM8550) is not new to armada

Before this got confused by a context compaction mid-session: Retroid Pocket 6
(SM8550) was already an extensively tested, working device in this fork, not
something being added for the first time. Prior real-hardware-confirmed work
already in `main` includes:

- Device profile: `system_files/usr/lib/armada/devices/retroid-pocket-6.conf`
- Kernel: `qcs8550-retroidpocket-rp6.dtb` + `-top-dpad` variant, panel driver
  (`CONFIG_DRM_PANEL_VISIONOX_VTDR6130_COG`), SM8550 display/GPU clock config -
  all already in `armada-packages/kernel`.
- Controller: RP6 shares the AYN family's `rsinput-gamepad` driver/MCU (NOT the
  SM8250 family's own `retroid.c`) - matched in
  `system_files/usr/share/inputplumber/devices/02-ayn-controller.yaml` alongside
  AYN Odin 2/Mini/Portal/Thor, using capability map `ayn_mcu`.
- Stick RGB lighting (commit `41f234f`): confirmed live that RP6's LED zone
  layout (`/sys/class/leds/l:r1` etc.) is identical to Mini V2 despite being a
  different SoC/gamepad MCU, and that RP6's raw gamepad device is mode `0000`
  (root-only) - same passthrough-safety reasoning as Mini V2 applies.
- GPU wedge workaround (`device-quirks`): SM8550's A740 GPU wedges from a CPU0
  deep power-collapse C-state; disabled specifically for `ARMADA_SOC_CLASS ==
  SM8550`.

So the gap this document is about is narrow: **the flashable SD-card disk-image
build**, not device/kernel/userspace support, which was already solid.

## The bug: GRUB gets force-enabled for the whole shared image, but only knows about SM8250

`post_process/finalize-armada-image.sh` builds one SD-card image that's meant to
serve every armada device (kernel/DTBs for the whole family are always bundled
together - see the 90%-shared-code note in [[armada 90 percent shared]] if that
memory exists). Two SoC-dependent boot mechanisms exist on real hardware:

- **SM8250** (Mini V2, RP5, Flip2): its ROCKNIX ABL build has no per-device DTB
  auto-pick at all. It **must** chainload GRUB (`EFI/BOOT/BOOTAA64.EFI`), which
  then explicitly selects the right `devicetree` per device via a hand-written
  menu (`armada`'s own `rocknix-grub.cfg`, generated in this same script).
- **SM8550 / SM8650 / SM8750** (RP6, AYN Odin 2/Mini/Portal/Thor, AYANEO Pocket*,
  KONKR Pocket FIT): their ABL builds **do** have a working per-device menu -
  they boot `/KERNEL` (an Android bootimg with every DTB for the family appended,
  built by `make-bootimg.sh`) directly and pick the right DTB themselves, no
  GRUB needed at all.

`finalize-armada-image.sh` currently detects "does this image contain any SM8250
Retroid DTB" and, if so, sets `KEEP_GRUB=1` **for the whole image** - keeping
`EFI/BOOT/BOOTAA64.EFI` in place. Since the image always bundles every device's
kernel/DTBs together, this is **always true**, so GRUB is always kept. Two
consequences, confirmed live flashing an RP6:

1. The custom GRUB menu (`rocknix-grub.cfg`) is generated with one `menuentry`
   **per SM8250 DTB only** (`for dtb in "${sm8250_dtbs[@]}"`) - there is no menu
   entry for RP6 or any other non-SM8250 device at all.
2. The one non-per-device ("generic Fedora") BLS entry, which is what an
   SM8550-family ABL's own native mechanism would otherwise use, gets its
   `fdtdir` (dynamic, ABL-resolved) line **overwritten** to a hardcoded
   `devicetree` pointing at whichever SM8250 device happens to be first/default.
   That's a second, independent way this breaks non-SM8250 devices even if they
   somehow reached that entry.

Net effect: an RP6 (or any SM8550/8650/8750 device) flashed from this image and
booted through ABL lands in a GRUB menu with **no correct option** - every
listed entry points at a different, incompatible device's kernel/DTB.

This custom `rocknix-grub.cfg` is a hand-rolled `menuentry` list, not Fedora's
own `blscfg`-driven `grub.cfg` - it has no dynamic per-device DTB matching of
its own (that's what ABL's native `/KERNEL` path does instead, for the families
that support it). So there's no "make one menu entry do the right thing for any
device" shortcut available inside this GRUB config; the DTB choice is fully
static per menu entry, same as it already is for the three SM8250 devices.

## What does NOT work as a fix

- **Leaving GRUB force-enabled and hoping SM8550-family ABL builds ignore it**:
  disproven live - RP6's ABL does chainload GRUB when `EFI/BOOT/BOOTAA64.EFI` is
  present, same as SM8250's.
- **A GRUB menu entry that "passes through" to `/KERNEL`'s native ABL
  auto-detect**: `/KERNEL` is an Android bootimg, not a UEFI PE/COFF binary -
  GRUB's `chainloader` can't load it directly. Doing this would mean
  reimplementing ABL's own bootimg-parsing + per-board-id DTB selection inside
  GRUB script, or relying on undocumented ABL behavior for "EFI app exits, now
  what" - not something to improvise against real hardware without dedicated
  ABL/firmware research first.
- **A dynamic, per-booting-device EFI enable/disable decided at image-build
  time**: impossible by construction - the image is shared across every device,
  built long before it's known which physical unit it'll be flashed onto.

## The fix: split the SD-image build along the boot-style boundary (verified precedent)

`shuuri-labs/pocknix-os` (an Arch-based distro targeting this exact device
family) hits the identical qcom-abl vs. arm-efi split and does **not** attempt a
single universal image either - see their `devices/README.md`
(`BOOTLOADER` in each SoC family's `profile.conf`: `qcom-abl` for sm8550,
`arm-efi` for sm8250) and `packages/pocknix-bootloader-sm8250/` (a bootloader
package that only exists for the arm-efi family - there is no sm8550
equivalent). They keep one shared codebase (matching armada's own ~90%-shared
architecture) but build **two separate images**, split exactly at this
boundary. This is corroborating evidence for a real hardware/firmware
constraint, not just "how one other project happens to do it" - and armada's
own RP6 support was independently developed and verified before this specific
SD-image gap was found, so this isn't a case of copying their design wholesale,
just confirming the boot-style split is the right axis.

**Plan** (not yet implemented as of this doc):
- `just build-armada-image` (or a new variant of it) takes which boot-style
  family it's building for, or infers it from which DTBs the target image
  actually needs for that run.
- The **OTA container image itself does not change** - it stays the single
  shared image for every device (this only affects `post_process/*.sh`'s
  disk-image finalize step, which already runs after the container is built).
- For an `arm-efi` build: keep the existing `finalize-armada-image.sh` GRUB
  logic exactly as-is (per-SM8250-device menu), scoped to just that family's
  DTBs.
- For a `qcom-abl` build: skip GRUB entirely (`EFI` stays `EFI.disabled`,
  matching the existing "SoCs whose ABL has its own per-device menu" path that
  already exists in the script for the no-SM8250-DTBs case) - `/KERNEL` (built
  by `make-bootimg.sh`, already correct) is all that's needed.

## Future idea (not started): a native-DTB-pick SM8250 ABL

Raised 2026-07-24, deliberately not folded into the split-image fix above -
this is a much deeper, separate undertaking. If SM8250's ROCKNIX ABL build
gained the same per-device DTB auto-pick that SM8550/8650/8750 ABL builds
already have, SM8250 would move to the `qcom-abl` boot style too and GRUB
would no longer be needed for *any* armada device - collapsing the whole
split back to one universal image, and incidentally fixing the GRUB-menu
button-press-reliability issues already noted elsewhere in this codebase
(`finalize-armada-image.sh`'s own comments on Flip2/RP5). This is real
bootloader/firmware engineering (patching or rebuilding ABL itself, not an
armada script), needs its own research into whether ROCKNIX publishes SM8250
ABL source at all vs. only prebuilt binaries, and how the SM8550-family ABL's
own board-id/DTB matching is actually implemented as a reference. Track
separately; don't let it block the split-image fix, which is scoped, safe,
and unblocks RP6 today.
