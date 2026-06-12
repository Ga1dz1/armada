# Armada

A SteamOS-like Linux distribution for ARM handhelds built on Fedora bootc using
device support from ROCKNIX.

Includes:
* ARM64 Steam
* Latest FEX
* CachyOS Proton 11
* Desktop mode (KDE)
* Bazaar App Store
* Over-the-air updates

> [!WARNING]
> **Prototype software. Use at your own risk.** Armada is under active
> development and is not stable. Booting it requires flashing an ABL which
> could brick your device if done incorrectly.
>
> **Over-the-air updates are experimental.** Armada can now update itself in
> place (see [Updating](#updating)) instead of reflashing, but the update path
> is still being validated. If an update fails, reflashing the SD card is the
> reliable recovery.
>
> **SSH is enabled with a known default password.** To make debugging easier
> in the prototype phase, the image ships with user `armada` / password `armada`
> and SSH open. **Anyone on your network can log in.** Change the password
> before using Armada on an untrusted network, or treat the device as
> fully exposed.

## Supported devices

| Device | SoC | Status |
|---|---|---|
| AYANEO Pocket EVO | SM8550 | ✅ Supported and tested |
| AYN Odin 2 Portal | SM8550 | ✅ Supported and tested |
| AYN Odin 2 Mini | SM8550 | ✅ Supported and tested |
| AYN Odin 2 | SM8550 | ✅ Supported and tested |
| AYN Thor | SM8550 | ✅ Supported and tested |
| AYN Odin 3 | SM8750 | ⚠️ Untested try at own risk |
| Retroid Pocket 6 | SM8550 | ⚠️ Untested try at own risk |
| AYANEO Pocket ACE | SM8550 | ⚠️ Untested try at own risk |
| AYANEO Pocket DMG | SM8550 | ⚠️ Untested try at own risk |
| AYANEO Pocket DS | SM8550 | ⚠️ Untested try at own risk |
| AYANEO Pocket S 2K | SM8550 | ⚠️ Untested try at own risk |
| AYANEO Pocket S2 | SM8650 | ⚠️ Untested try at own risk |
| KONKR Pocket FIT | SM8650 | ⚠️ Untested try at own risk |

## Install

Armada currently boots from SD card. Internal install support is still in
development.

1. Flash the Armada image to SD.

   Use Balena Etcher to flash the latest `armada-YYYYMMDD.img.gz` image to a
   64GB or larger SD card (A2 speed for best results).

2. Flash the ROCKNIX ABL for your device.

   Insert the SD card and boot into Android. Copy the `rocknix_abl` folder to
   the root of your internal storage. Run `backup_abl.sh` as root followed by
   `flash_abl.sh` as root.

3. Boot from SD and set your device model.

   Reboot and hold volume down while powering on the device with the SD card
   inserted. Navigate the menus to set your device model and switch boot mode
   to Linux. Choose Start to boot your device.

4. Wait for Steam first-run setup.

   After the intro animation, the display may be black for up to 60 seconds
   before Steam appears. This is expected on the current SD-card boot path.
   Eventually you will see Steam first-run where you can configure your 
   language, timezone, and Wi-Fi. At the end Steam will restart again, and 
   you may see another 60 seconds of black before the login screen appears.

## Updating

> [!NOTE]
> Over-the-air updates are new and still being validated. You may need to reflash
> if an update fails.

Armada has several release channels (`Beta` only in currently) and can update 
itself in place — no reflash, no re-downloading games. Trigger an update 
from Steam's update prompt, or run `steamos-update` from a terminal. Updates are
image-based with rollback, so a failed boot falls back to the previous image.

## Roadmap

- **Install to internal storage:** currently boots from SD card
- **Power / fan control:** integrated with Steam UI where possible
- **Game compatibility decky plugin:** per game FEX and Proton settings

## Known issues

- **No true suspend.** Pressing power does a "fake suspend" inspired by ROCKNIX,
  not real S3 sleep, so idle battery drain is higher than it should be.
- **Black screen during Steam launch.** Sometimes there is a 30-60s black screen 
  before Steam becomes fully visible, often following an update or restart.
- **Steam Machine onboarding.** Sometimes you see the Steam Machine onboarding
  before choosing your language. Tap through it to continue.
- **QAM is unmapped on Ayaneo devices.** Use Home+A to open the Quick Access Menu.

## Credits

- **[ROCKNIX](https://github.com/ROCKNIX):** bootloader, device support,
  input mappings, audio profiles, and more.
- **[Bazzite](https://github.com/ublue-os/bazzite)** and the
  **[Universal Blue](https://github.com/ublue-os)** ecosystem: the bootc/image
  build structure, the [image-template](https://github.com/ublue-os/image-template)
  this repo is built from, and Steam/Gamescope session patterns.
- **Fedora** and the **[bootc](https://github.com/bootc-dev/bootc)** project: the
  base image and tooling.

## License

Armada's own code is **GPL-2.0-or-later**. If you modify and distribute it, your
changes stay open under the same terms. Bundled components keep their upstream
licenses. See [`LICENSE.md`](LICENSE.md).
