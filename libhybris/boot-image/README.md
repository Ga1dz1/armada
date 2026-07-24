# RP6 first boot test - CR(g) OS / Atlas OS

**Not yet tested on real hardware.** This is a carefully-reasoned first
attempt, not a proven-working image. Full technical detail:
`libhybris/docs/logs/2026-07-24.md`. Read this whole file before flashing
anything.

## What this is

The real stock RP6 kernel + DTB + vendor blobs stay **completely
unchanged** - `boot.img`, `vendor_boot.img`, `dtbo.img` are byte-identical
to the real factory firmware, already proven to boot this exact hardware.
Only `init_boot.img` is replaced: its ramdisk (which normally holds
Android's own first-stage `/init`) is swapped for a minimal custom one
(`busybox` + a short shell script) whose only job is: find the Arch Linux
ARM rootfs, mount it, and hand off control to it via `switch_root`.

Files in this folder:
- `boot.img`, `vendor_boot.img`, `dtbo.img` - **stock, unmodified**, real
  factory RP6 firmware (2026-06-15 dump). Not flashed as part of this
  test unless you're not already on this exact firmware - if your device
  already boots this stock firmware, you don't need to reflash these.
- `init_boot.img` - **the actual new thing** - custom ramdisk, everything
  else identical to stock (same header version, same "kernel_size: 0"
  layout, verified via a full pack/unpack round-trip - bytes match
  exactly what was intended).
- `rootfs.img` - the Arch Linux ARM rootfs (systemd, pacman, patched
  `gamescope`/`mesa`/`inputplumber`/`jupiter-hw-support`/`mangohud`, all
  real `pacman`-tracked packages except the last three - see
  `TECHNICAL_DEBT.md`). Plain ext4, ~5GB actual content (image is
  8GB, mostly sparse/zero).

## What you need to do before flashing

1. **Boot into the current OS (whatever's on the device now) and get the
   real `userdata` partition writable** - e.g. via `adb shell` if it's a
   working Android/LineageOS, or an equivalent method.
2. Push `rootfs.img` to `/data/atlas/rootfs.img` on the device (this
   path is what `init`'s custom init script looks for - it's hardcoded,
   see `libhybris/src/rp6-boot-image/ramdisk/init`):
   ```
   adb push rootfs.img /sdcard/rootfs.img
   adb shell su -c 'mkdir -p /data/atlas && cp /sdcard/rootfs.img /data/atlas/rootfs.img'
   ```
   (or however makes sense given whatever's currently on the device -
   the point is just: the file needs to exist at that exact path on the
   real `userdata` partition before the new `init_boot.img` boots, or
   the init script will drop to a busybox shell instead of booting
   further - see the "if it doesn't work" section below.)
3. Flash only `init_boot.img` (don't touch `boot`/`vendor_boot`/`dtbo` -
   they're unchanged from what should already be on the device if it's
   running this exact stock firmware):
   ```
   fastboot flash init_boot init_boot.img
   fastboot reboot
   ```

## If it doesn't work

The init script (`ramdisk/init`) writes progress/error messages to the
kernel log (`/dev/kmsg`) at each step - if you have serial console access
or can capture `dmesg`/`last_kmsg` after a failed boot, look for lines
starting with `atlas-init:`. It's written to drop to an interactive
busybox shell (not panic/reboot-loop) on any failure, so you should be
able to get a prompt and poke around even if the full switch_root doesn't
happen - e.g. check `ls /dev/block/by-name/` to see if `userdata` shows
up under a different path than expected, or `ls /mnt/userdata/atlas/` to
check the rootfs.img push landed correctly.

## What's genuinely unverified

- Whether the kernel's own initramfs unpacking accepts this ramdisk
  correctly (gzip-compressed cpio, matches Linux's standard support, but
  not confirmed against *this specific* kernel build/config).
- Whether AVB (Android Verified Boot) blocks a modified `init_boot.img`
  from booting at all - this assumes the bootloader is unlocked and AVB
  is permissive enough for a custom `init_boot.img`, matching what's
  presumably already true given LineageOS/custom builds have been
  flashed on this device before this session.
- Whether `mdev`'s uevent-based device population actually gets
  `/dev/block/by-name/userdata` to show up correctly on this device's
  real boot timing (the retry loop in `init` is a hedge against this,
  not a guarantee).
- Whether the Arch rootfs actually reaches a usable state once
  `systemd` starts (no display/session setup done yet - this test is
  specifically "does `switch_root` succeed and does systemd start," not
  "does Gamescope/Steam show up on screen").
