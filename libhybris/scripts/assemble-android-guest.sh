#!/bin/bash
# Assembles the Android vendor/system partition images (dumped from a
# LineageOS OTA payload, see libhybris/SCOPING.md) into one merged
# directory tree, replicating the layered mount structure Android itself
# builds at boot (system.img's root IS Android's real /, with
# vendor/odm/system_ext/vendor_dlkm as mountpoints for the other images).
#
# This tree is what a systemd-nspawn container (see
# libhybris/nspawn/android-guest.nspawn) boots as its rootfs - the guest's
# own /init runs as the container's PID 1, sharing the host kernel, same
# model Halium's lxc-android used with LXC instead of nspawn.
#
# Read-only by design: mounts the .img files `ro`, never modifies them -
# these are vendor blobs, same as Android itself never writes to /vendor
# or /system at runtime. A thin tmpfs overlay adds the one thing this
# tree needs that Android's own layout doesn't have: a top-level usr/
# directory. systemd-nspawn hard-refuses to boot any tree without one
# ("doesn't look like it has an OS tree") - confirmed locally 2026-07-24,
# see libhybris/SCOPING.md. Verified end-to-end locally: Android's real
# /init does start under nspawn with this in place (gets as far as
# calling reboot() on a non-RP6 kernel, which is expected - see SCOPING.md
# for what still needs real hardware to verify further).
set -euo pipefail

IMGDIR="${IMGDIR:-$(dirname "$0")/../src/rp6-lineageos-prebuilt/full-ota/dumped}"
ROOT="${1:?usage: $0 <mount-root>}"
SYSBASE="${ROOT}.sysbase"
UPPER="${ROOT}.upper"
WORK="${ROOT}.work"

if mountpoint -q "$ROOT" 2>/dev/null; then
	echo "error: $ROOT is already a mountpoint" >&2
	exit 1
fi

# IMPORTANT ordering, found the hard way (see SCOPING.md 2026-07-24):
# overlayfs does NOT see into submounts that already exist inside its
# lowerdir - it looks up the lowerdir's own underlying directory entries
# directly, bypassing whatever is mounted on top of them. So the overlay
# has to be built from system.img ALONE first (to get a writable usr/),
# and vendor/odm/system_ext/vendor_dlkm have to be mounted afterward,
# directly onto the overlay's own merged result at $ROOT - mounting onto
# an already-established overlay's merged view works completely normally,
# it's only "inside the lowerdir before the overlay exists" that's broken.
mkdir -p "$SYSBASE" "$UPPER" "$WORK" "$ROOT"
sudo mount -o loop,ro "$IMGDIR/system.img" "$SYSBASE"
sudo mount -t overlay overlay -o lowerdir="$SYSBASE",upperdir="$UPPER",workdir="$WORK" "$ROOT"
sudo mkdir -p "$ROOT/usr"

for part in vendor odm system_ext vendor_dlkm; do
	sudo mount -o loop,ro "$IMGDIR/${part}.img" "$ROOT/$part"
done

echo "Assembled Android guest rootfs at $ROOT"
echo "Unmount with: for p in vendor odm system_ext vendor_dlkm; do sudo umount $ROOT/\$p; done; sudo umount $ROOT; sudo umount $SYSBASE; rm -rf $SYSBASE $UPPER $WORK"
