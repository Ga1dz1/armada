# Changelog

Terse, one line per real milestone. Full detail lives in
`logs/YYYY-MM-DD.md`; this file is for scanning "what actually shipped,"
newest first.

⸻

## 2026-07-24

- Removed all "armada" branding from new package names/metadata per
  explicit project direction (`gamescope-armada`/`mesa-armada` renamed to
  `gamescope`/`mesa`). Real provenance kept as internal developer
  comments only.
- **ADR-005 superseded by ADR-007**: the first RP6 boot test uses the
  real Halium-target (LineageOS) kernel, not armada's own kernel - caught
  directly by the user (armada's kernel never had the vendor/HAL support
  PHASE 4 actually needs - camera, full sensors including gyroscope,
  GPU vendor blobs - using it first would've been a real milestone that
  doesn't build toward the actual target).
- `mesa` turned into a real, tested `pacman` package
  (`libhybris/packages/mesa/PKGBUILD`) - built clean on the first
  `makepkg` try, installed via `pacman -U` after clearing stale files
  left by the earlier raw `ninja install`. `pacman -Qo` confirms
  `libvulkan_freedreno.so` is tracked. Both components flagged as raw
  installs (`TECHNICAL_DEBT.md` Priority B) are now real packages.
- `gamescope` turned into a real, tested `pacman` package
  (`libhybris/packages/gamescope/PKGBUILD`) - built with `makepkg`,
  installed via `pacman -U`, `pacman -Q` confirms tracking. Found and
  fixed two real bugs while getting it right: a double-patch-apply bug,
  and `arch-meson`'s `--wrap-mode=nodownload` blocking the
  wlroots/libliftoff subproject auto-fetch (fixed by vendoring both as
  pinned-commit tarballs). Removed stale `/usr/local` leftovers from the
  earlier raw `ninja install` that were shadowing it via PATH.
- Fixed the stale Steam Runtime URL in
  `build_files/generate-steam-bootstrap.sh` (Valve retired the
  `latest-public-beta` alias; now resolves the newest dated directory
  from the real index). Verified with a full end-to-end run - the real
  Steam client self-bootstraps successfully under Xvfb.
- MangoHud built and installed (armada's 6 patches - Qualcomm GPU
  support, SM8550/SM8750 GPU+battery, RAM/battery naming). Real
  `kgsl`/`msm_dpu`/`msm_drm` symbols confirmed in the compiled output.
  Five of six main armada-packages gaming-stack components now done.
- Android-layer scope boundary decided (ADR-006): Android stays a thin
  bridge to proprietary hardware (GPU/audio/camera/sensors/thermal/
  power/vibrator/BT/Wi-Fi where needed), input/network/udev/systemd/
  PipeWire/BlueZ stay native Linux wherever a working driver exists.
- Documentation restructured: `MASTER_PLAN.md` split into
  `MASTER_PLAN.md`/`ROADMAP.md`/`ARCHITECTURE.md`/`DECISIONS.md`/
  `CHANGELOG.md`/`KNOWN_ISSUES.md`/`TECHNICAL_DEBT.md` + dated
  `logs/`, per explicit user direction.
- `MASTER_PLAN.md` (the full project plan) received from the user;
  saved verbatim. Resolved the Halium-vs-ChromeOS-ARC ambiguity in
  favor of Halium (ADR-002).
- InputPlumber built and installed (armada's 2 patches, Rust/cargo,
  ~5 min build) - device profiles, systemd unit, udev/polkit all in
  place.
- `armada-jupiter-hw-support` ported and installed (both armada
  patches, no compile needed - pure shell/udev/polkit).
- Mesa/Turnip built and installed, trimmed to freedreno+llvmpipe only
  (full Arch build compiles every GPU vendor). Confirmed armada's A830
  chip-ID patch present in the actual generated
  `freedreno_devices.h`.
- Gamescope built and installed with all 6 armada patches. Confirmed
  `--use-rotation-shader` (load-bearing for RP6) compiled in.
- Real Arch Linux ARM aarch64 rootfs bootstrapped
  (`pacman`/`systemd 261`/`btrfs-progs` verified). Found
  `armada-packages` (public, no token needed) as the real patch/build
  source.
- Confirmed armada's Steam bootstrap script is genuinely distro-
  portable (downloads the real official Valve ARM64 Steam client).
  Found and precisely root-caused a stale-URL bug in its last step
  (steam-runtime, `latest-public-beta` no longer exists).
- RP6: pulled real vendor/system Android partition images from an
  official LineageOS build, confirmed genuine Adreno GPU vendor blobs
  present.
- RP6: built and locally verified a `systemd-nspawn`-based Halium
  container prototype (real Android `/init` starts under it). Later
  superseded in direction by Waydroid once `MASTER_PLAN.md`'s PHASE 4
  was re-read (ADR-003).
- RP6: pulled real kernel (Linux 5.15.208) + DTB + 241 vendor `.ko`
  modules from an official LineageOS build, vermagic-verified.
- Project rebrand noted: "CR(g) OS" / "Atlas OS" for new work only,
  armada's existing repo/OTA untouched.
