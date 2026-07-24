# Technical Debt

Shortcuts deliberately taken to make progress, with a plan to clean them
up later. Different from `KNOWN_ISSUES.md`: these are things that *work*
right now but aren't done the "real" way yet, not things that are broken.

⸻

## Priority A

### Steam Runtime URL

Tracked primarily in `KNOWN_ISSUES.md` since it's a real bug (breaks a
script), not just a shortcut - listed here too because fixing it is
genuinely quick (a two-minute patch, precisely root-caused already) and
should happen before it's forgotten.

⸻

## Priority B

### `gamescope`/`mesa` are raw `ninja install`, not real `pacman` packages

Built and installed directly via `ninja -C build install` inside the
chroot - works, and both patch sets are verified present in the compiled
output (`ARCHITECTURE.md`/`logs/2026-07-24.md` have the verification
detail). But `pacman -Q` doesn't know these files exist, which means:

- A future `pacman -Syu` would silently overwrite `mesa`'s install with
  the stock unpatched Arch package again (gamescope wouldn't collide the
  same way since its `ninja install` prefix defaults to `/usr/local`,
  outside `pacman`'s `/usr` ownership - but that's its own kind of
  fragile, not a fix).
- No `.pkg.tar.zst` artifact exists to actually ship/distribute.
- No dependency tracking, no easy uninstall/reinstall, no way to pin a
  version.

**Fix**: write real `PKGBUILD`s for both (the meson flags, patch list,
and version pins are all already known and verified working - this is
translation work, not re-investigation), build with `makepkg`, install
via `pacman -U`.

⸻

## Priority C

### `btrfs.ko` out-of-tree module path

Not really debt so much as a dead end worth remembering so it isn't
re-investigated: tried building `btrfs.ko` standalone against the real
RP6 kernel config, converges onto needing the exact Android Clang
toolchain + a real `Module.symvers` from the original build (see
`DECISIONS.md` ADR-004). Not attempted again unless the toolchain
situation changes.

### Device-name reconciliation

`retroid-pocket-mini` vs `rpminiv2` and friends - see
`KNOWN_ISSUES.md`. Low cost to fix once someone confirms which naming is
actually intended.
