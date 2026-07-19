#!/bin/bash
# Post-BIB: stage ROCKNIX ABL files and compress.

set -euxo pipefail

RAW_IMAGE="${1:-output/raw/disk.raw}"
ROCKNIX_ABL_VERSION="${ROCKNIX_ABL_VERSION:-v1.1.5}"
OUT="${OUT:-output/armada-$(TZ='America/New_York' date +%Y%m%d).img.gz}"
REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

if [[ ! -f "${RAW_IMAGE}" ]]; then
    echo "ERROR: raw image not found at ${RAW_IMAGE}"
    echo "Run 'just build-raw' first."
    exit 1
fi

WORK=$(mktemp -d)
trap "sudo umount '${WORK}/mnt' 2>/dev/null || true; sudo umount '${WORK}/boot' 2>/dev/null || true; sudo losetup -d \"\$(cat ${WORK}/loop 2>/dev/null)\" 2>/dev/null || true; rm -rf '${WORK}'" EXIT

curl -fsSL -o "${WORK}/abl.tar.gz" \
    "https://github.com/ROCKNIX/abl/releases/download/${ROCKNIX_ABL_VERSION}/rocknix-abl-${ROCKNIX_ABL_VERSION}.tar.gz"
mkdir -p "${WORK}/abl-extracted"
tar -xzf "${WORK}/abl.tar.gz" -C "${WORK}/abl-extracted"

LOOP=$(sudo losetup -fP --show "${RAW_IMAGE}")
echo "${LOOP}" > "${WORK}/loop"
sleep 1

ESP="${LOOP}p1"
if ! sudo blkid "${ESP}" | grep -q 'TYPE="vfat"'; then
    echo "ERROR: ${ESP} is not vfat. BIB partition layout may have changed."
    sudo blkid "${LOOP}"*
    exit 1
fi

mkdir -p "${WORK}/mnt"
sudo mount "${ESP}" "${WORK}/mnt"

sudo mkdir -p "${WORK}/mnt/rocknix_abl"
# One image serves all devices, so stage a self-contained folder per SoC.
# vfat has no Unix ownership, so `cp -a` would error on chown under set -e.
ABL_SRC=$(ls -d "${WORK}/abl-extracted"/rocknix-abl-*)
sudo cp "${REPO_ROOT}/abl/README" "${WORK}/mnt/rocknix_abl/README"
for soc in SM8550 SM8650 SM8750 SM8250; do
    d="${WORK}/mnt/rocknix_abl/${soc}"
    sudo mkdir -p "$d"
    sudo cp "${ABL_SRC}/abl_signed-${soc}.elf" "${ABL_SRC}/abl_signed-${soc}.elf.sha256" "$d/"
    for s in flash_abl backup_abl restore_backup_abl; do
        sed "s/%DEVICE%/${soc}/g" "${REPO_ROOT}/abl/${s}.sh.template" \
            | sudo tee "$d/${s}.sh" >/dev/null
    done
    sudo chmod 0755 "$d"/*.sh
done

# The BLS entry ships `fdtdir <dir-with-one-dtb-per-armada-device>`. Fedora's
# blscfg auto-selects from that directory using a firmware-provided
# compatible-string hint, which ABL never supplies for SM8250 (its ABL build
# has no per-device menu, unlike SM8550/8650/8750). Left as fdtdir, GRUB picks
# some other device's DTB, which explains the wrong panel orientation/
# rotation and non-working gamepad on real hardware: the kernel boots against
# hardware it isn't actually running on, and its model string never matches
# device-env's case statement so no device profile (scale, panel, gamepad,
# etc.) is applied at all.
#
# So whenever this image bundles an SM8250 Retroid DTB, GRUB must stay enabled
# and present an explicit per-device menu (below) - this is detected here,
# not left opt-in behind a KEEP_GRUB env var, since a normal release build
# (via the Justfile, which never sets that var) must get this right on its
# own. KEEP_GRUB can still be set explicitly to force the choice either way
# for testing.
BOOT="${LOOP}p2"
mkdir -p "${WORK}/boot"
sudo mount "${BOOT}" "${WORK}/boot"
shopt -s nullglob
entries=("${WORK}/boot/loader/entries/"*.conf)
shopt -u nullglob
[ "${#entries[@]}" -eq 1 ] || { echo "ERROR: expected exactly 1 BLS entry under ${BOOT}/loader/entries, found ${#entries[@]}"; exit 1; }
entry="${entries[0]}"

OPTIONS=$(sudo sed -n 's/^options //p' "${entry}")
LINUX=$(sudo sed -n 's/^linux //p' "${entry}")
INITRD=$(sudo sed -n 's/^initrd //p' "${entry}")
FDTDIR=$(sudo sed -n 's/^fdtdir //p' "${entry}")
[[ -n "${OPTIONS}" && -n "${LINUX}" && -n "${INITRD}" && -n "${FDTDIR}" ]] \
    || { echo "ERROR: could not parse BLS entry ${entry} (options/linux/initrd/fdtdir)"; sudo cat "${entry}"; exit 1; }

shopt -s nullglob
sm8250_dtbs=("${WORK}/boot${FDTDIR}/qcom/sm8250-retroidpocket-"*.dtb)
shopt -u nullglob
[[ -z "${KEEP_GRUB:-}" && "${#sm8250_dtbs[@]}" -gt 0 ]] && KEEP_GRUB=1

if [[ -n "${KEEP_GRUB:-}" ]]; then
    # save_env/load_env (used below to remember the last-booted entry) need
    # grubenv to already exist in the right format - it can't create one
    # from scratch. Fedora's BLS/grub2-mkconfig setup normally provisions
    # this, but don't rely on that holding across image/tooling changes.
    if ! sudo test -f "${WORK}/boot/grub2/grubenv"; then
        sudo grub-editenv "${WORK}/boot/grub2/grubenv" create
    fi
    # blscfg (called from the stock, do-not-edit grub.cfg) renders this same
    # BLS entry as an extra, generic "Fedora Linux NN" menu item alongside the
    # named ones below - confusing since it's unclear which device it boots.
    # We've already pulled every field we need out of it, so rename it out of
    # blscfg's `loader/entries/*.conf` glob (kept as .disabled, not deleted,
    # in case ostree/bootc tooling wants to find it later) so only the named
    # entries show.
    sudo mv "${entry}" "${entry}.disabled"

    # One menu entry per SM8250 Retroid DTB found, so any future "865 series"
    # device tree added to armada-packages/kernel/dts picks up a boot menu
    # entry automatically - no further edits to this script needed. The label
    # and --id both come from the DTB's own `model` property (same string
    # device-env matches on /sys/firmware/devicetree/base/model against), so
    # they can't drift out of sync with each other.
    {
        echo "# Generated by finalize-armada-image.sh - see the fdtdir-detection"
        echo "# comment above in the script that wrote this file."
        echo "set timeout_style=menu"
        echo "set timeout=5"
        # Button input picking a menu entry can be unreliable on some of
        # these devices (e.g. reported broken on Flip2 - no per-device
        # hardware to verify against). Whichever entry actually boots -
        # whether by an explicit press or by being left highlighted when
        # the 5s timeout expires, GRUB boots whatever is currently
        # highlighted either way - saves itself as the default for every
        # later boot, so at most one boot ever needs working button input
        # per physical device. `load_env`/`save_env` need grubenv on the
        # search path; harmless no-op if that file can't be found yet.
        echo "if [ -s \$prefix/grubenv ]; then load_env; fi"
        default_id=""
        ids=()
        for dtb in "${sm8250_dtbs[@]}"; do
            base=$(basename "${dtb}" .dtb)
            model=$(sudo fdtget -t s "${dtb}" / model 2>/dev/null) || model="${base}"
            id=$(tr '[:upper:]' '[:lower:]' <<<"${model}" | tr -cs 'a-z0-9' '-' | sed 's/^-\+//; s/-\+$//')
            ids+=("${id}")
            [[ -z "${default_id}" ]] && default_id="${id}"
            [[ "${base}" == *flip2 ]] && default_id="${id}"
            printf "\nmenuentry '%s' --id '%s' {\n" "${model}" "${id}"
            # Recording OUR OWN id here, not whatever "default" happened to
            # be set to - GRUB doesn't retroactively update that variable
            # to match the entry actually booted, so save_env-ing it as-is
            # would just persist the prior static default every time.
            printf "    set default='%s'\n" "${id}"
            printf "    save_env default\n"
            printf "    linux %s %s\n" "${LINUX}" "${OPTIONS}"
            printf "    initrd %s\n" "${INITRD}"
            printf "    devicetree %s/qcom/%s.dtb\n" "${FDTDIR}" "${base}"
            printf "}\n"
        done
        # Only trust a remembered choice if it's still one of this image's
        # known entries (a stale saved_entry from a previous, differently
        # built image must not silently override the computed default).
        printf "\nset default='%s'\n" "${default_id}"
        printf "if [ -n \"\${saved_entry}\" ]; then\n"
        for id in "${ids[@]}"; do
            printf "    if [ \"\${saved_entry}\" = '%s' ]; then set default='%s'; fi\n" "${id}" "${id}"
        done
        printf "fi\n"
    } | sudo tee "${WORK}/boot/grub2/custom.cfg" >/dev/null
fi
sudo sync
sudo umount "${WORK}/boot"

# Disable GRUB so ABL falls through to /KERNEL, for SoCs whose ABL build has
# its own working per-device menu and doesn't need it (see the fdtdir
# comment above for why SM8250 is the exception, detected automatically).
if [[ -z "${KEEP_GRUB:-}" ]] && [ -d "${WORK}/mnt/EFI" ]; then sudo mv "${WORK}/mnt/EFI" "${WORK}/mnt/EFI.disabled"; fi
sudo sync
sudo umount "${WORK}/mnt"

# Android shows this label when copying the ABL
sudo fatlabel "${ESP}" ARMADA

# MBR, not GPT: a fixed-size GPT image flashed to a larger card strands the backup
# GPT mid-disk and Android's vold rejects the card. MBR has no end-of-disk
# structure, so it reads on any card. SD image only; internal installs stay GPT.
TABLE=$(sudo sfdisk -J "${LOOP}")
mapfile -t PARTS < <(jq -r '.partitiontable.partitions[] | "\(.start) \(.size)"' <<<"${TABLE}")
[ "${#PARTS[@]}" -eq 3 ] || { echo "ERROR: expected 3 partitions, got ${#PARTS[@]}"; sudo sfdisk -l "${LOOP}"; exit 1; }
read -r P1_START P1_SIZE <<<"${PARTS[0]}"
read -r P2_START P2_SIZE <<<"${PARTS[1]}"
read -r P3_START P3_SIZE <<<"${PARTS[2]}"
SECTORS=$(sudo blockdev --getsz "${LOOP}")

# Zero the two GPT copies (primary LBA 1-33, backup last 33 LBAs); dd avoids a
# gdisk dependency. The guards refuse any layout where a zero could hit a partition.
[ "$(jq -r '.partitiontable.sectorsize // 512' <<<"${TABLE}")" = 512 ] \
    || { echo "ERROR: non-512-byte sectors; GPT-zero math assumes 512"; exit 1; }
[ "${P1_START}" -ge 34 ] || { echo "ERROR: p1 starts inside the primary-GPT span"; exit 1; }
[ "$((P3_START + P3_SIZE))" -le "$((SECTORS - 33))" ] || { echo "ERROR: p3 overlaps the backup-GPT span"; exit 1; }
sudo dd if=/dev/zero of="${LOOP}" bs=512 seek=1 count=33 conv=notrunc status=none
sudo dd if=/dev/zero of="${LOOP}" bs=512 seek=$((SECTORS - 33)) count=33 conv=notrunc status=none

sudo sfdisk --label dos "${LOOP}" <<EOF
${P1_START},${P1_SIZE},c,*
${P2_START},${P2_SIZE},da
${P3_START},${P3_SIZE},da
EOF

sudo sfdisk -J "${LOOP}" \
    | jq -e '.partitiontable.label=="dos" and (.partitiontable.partitions|length)==3' >/dev/null \
    || { echo "ERROR: MBR conversion verify failed"; sudo sfdisk -l "${LOOP}"; exit 1; }

sudo losetup -d "${LOOP}"
rm "${WORK}/loop"

GZIP_LEVEL="${GZIP_LEVEL:-6}"
mkdir -p "$(dirname "${OUT}")"
pigz -f "-${GZIP_LEVEL}" -p "$(nproc)" -c "${RAW_IMAGE}" > "${OUT}"
rm -f "${RAW_IMAGE}"

echo "Built: ${OUT}"
echo "Flash to SD with:  zcat ${OUT} | sudo dd of=/dev/sdX bs=4M conv=fsync status=progress"
