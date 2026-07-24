# Technical Debt

Shortcuts deliberately taken to make progress, with a plan to clean them
up later. Different from `KNOWN_ISSUES.md`: these are things that *work*
right now but aren't done the "real" way yet, not things that are broken.

⸻

## Priority A

*(none currently open - the Steam Runtime URL item that lived here was
fixed 2026-07-24, see `CHANGELOG.md`)*

⸻

## Priority B

### ~~`gamescope` is raw `ninja install`~~ — FIXED

**Fixed 2026-07-24.** `libhybris/packages/gamescope/PKGBUILD` is a real,
tested `PKGBUILD` - built with `makepkg` (not just written and assumed to
work), installed via `pacman -U`, `pacman -Q gamescope-armada` confirms
it's tracked. Two real bugs found and fixed while getting this right:
(1) `prepare()` originally applied every patch twice (a leftover loop-plus-
explicit-list duplication); (2) `arch-meson`'s `--wrap-mode=nodownload`
blocks meson's wrap-based auto-fetch for the `wlroots`/`libliftoff`
subprojects (this didn't affect the earlier manual `ninja install`, which
used plain `meson setup` without that flag) - fixed by vendoring both as
real pinned-commit tarballs (from GitHub's tree API for the exact tag, not
guessed) alongside `reshade`/`vkroots`, same pattern. The stale
`/usr/local/bin` leftovers from the earlier raw `ninja install` were
shadowing the new package via PATH order - removed.

### ~~`mesa` is raw `ninja install`~~ — FIXED

**Fixed 2026-07-24.** `libhybris/packages/mesa/PKGBUILD` - built with
`makepkg` on the first try (no bugs this time, unlike gamescope), installed
via `pacman -U`. Hit one real conflict along the way: leftover files from
the earlier raw `ninja install` (which also used the `/usr` prefix)
collided with the new package's own files - `pacman -U` refused until
those stale files were removed manually. `pacman -Qo
/usr/lib/libvulkan_freedreno.so` confirms it's now owned by
`mesa-armada`, not a leftover.

**Priority B is now fully closed** - both `gamescope` and `mesa`, the two
components that were raw installs, are real `pacman`-tracked packages.

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
