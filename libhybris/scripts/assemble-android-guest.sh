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
# Read-only by design: mounts everything `ro`, never modifies the source
# .img files. Verified locally (mount assembly only - actually booting
# /init needs to happen on real RP6 hardware with the Android-derived
# kernel, not on a build host).
set -euo pipefail

IMGDIR="${IMGDIR:-$(dirname "$0")/../src/rp6-lineageos-prebuilt/full-ota/dumped}"
ROOT="${1:?usage: $0 <mount-root>}"

if mountpoint -q "$ROOT" 2>/dev/null; then
	echo "error: $ROOT is already a mountpoint" >&2
	exit 1
fi

mkdir -p "$ROOT"
sudo mount -o loop,ro "$IMGDIR/system.img" "$ROOT"
for part in vendor odm system_ext vendor_dlkm; do
	mkdir -p "$ROOT/$part"
	sudo mount -o loop,ro "$IMGDIR/${part}.img" "$ROOT/$part"
done

echo "Assembled Android guest rootfs at $ROOT"
echo "Unmount with: for p in vendor odm system_ext vendor_dlkm; do sudo umount $ROOT/\$p; done; sudo umount $ROOT"
