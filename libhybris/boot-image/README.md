# RP6 first boot test - CR(g)

**Status 2026-07-24: revision 1 (`init_boot.img`) confirmed to hang
indefinitely on the bootloader's static splash logo on real hardware.**
Reverting to `init_boot_stock.img` (verified byte-identical to the real
factory image) restores normal Android boot - this isolates the failure
to the custom ramdisk itself, not slot/flash-process/AVB-lockout issues.

**`init_boot_v2_diag.img` is the current thing to test.** It's a
diagnostic revision, not a fix - see "Revision 2 (diagnostic)" below.
Full technical detail: `libhybris/logs/2026-07-24.md`.

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

## Revision 2 (diagnostic): `init_boot_v2_diag.img`

There's no serial console on this hardware, so revision 1's "drop to an
interactive busybox shell on failure" looks *identical* to a true hang -
both are just a frozen logo, forever. That means the confirmed hang
doesn't actually tell us whether:

(a) the kernel/AVB rejects or never even loads this ramdisk at all, or
(b) the ramdisk **does** run, hits some failure (e.g. `userdata` never
    shows up, `rootfs.img` missing/wrong path, loop-mount fails), and
    silently sits at an invisible shell prompt.

`init_boot_v2_diag.img` replaces every failure path with a **forced
reboot** instead of a silent shell (`reboot_now()` - logs to `/dev/kmsg`,
sleeps 3s, `reboot -f`), plus an unconditional 20-second watchdog reboot
as a backstop in case something hangs without hitting an explicit check.
It's still not a fix - it's purely to make (a) and (b) look different
from each other.

**How to test:**
```
fastboot flash init_boot init_boot_v2_diag.img
fastboot reboot
```
Then just watch the device for about 30-40 seconds:
- **If it reboots on its own** (device goes dark/logo flashes again,
  possibly looping) - the ramdisk **is** executing, and failing at one of
  the mount/rootfs steps. That's real progress - it means (b), and the
  next step is narrowing down which check is failing (most likely: the
  `rootfs.img` push to `/data/atlas/rootfs.img` didn't happen yet for
  this test, since this diagnostic round doesn't require it to have
  landed - the watchdog alone would cause a reboot at ~20s if nothing
  else fires first).
- **If it hangs on the exact same static logo with zero change**,
  indefinitely, past 40+ seconds with no reboot - that points to (a),
  meaning the problem is at the kernel/bootloader/AVB level before any
  userspace code in this ramdisk runs at all, and the next step is
  looking at that layer (AVB signing/rollback index on `init_boot`,
  header_version/kernel_size=0 assumptions, etc.) rather than the shell
  script.

If you can grab `adb shell su -c 'dmesg | grep atlas-init'` or a
`last_kmsg` right after either outcome, that would confirm exactly which
step it reached, if any.

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
