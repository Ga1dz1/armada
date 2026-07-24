# Known Issues

Open bugs/gaps that are found but not yet fixed. When one gets fixed,
move it to `CHANGELOG.md` with a one-line note, don't just delete it.

⸻

### ~~Steam Runtime URL is stale~~ — FIXED

**Found**: 2026-07-24. **Fixed**: 2026-07-24, same day. See
`CHANGELOG.md`. Moved here from "open" only long enough to record it was
real - full detail is in the changelog and the commit itself
(`build_files/generate-steam-bootstrap.sh`).

⸻

### RP6's real kernel has no Btrfs support

**Found**: 2026-07-24. **Severity**: blocks the unified-Btrfs-userdata
storage idea for Android's own `/data`; doesn't block the CR(g) OS-side
Btrfs usage.

See `ARCHITECTURE.md` "Storage architecture" and `DECISIONS.md` ADR-004
for full detail and the decision made. Not really "fixable" without a
from-source kernel rebuild that's out of scope for now - tracked here as
a standing constraint, not a task to pick up casually.

⸻

### gamescope/mesa installs aren't real pacman packages

**Found**: 2026-07-24. See `TECHNICAL_DEBT.md` (Priority B) - tracked
there since it's a concrete cleanup task, not just a fact to know.

⸻

### FEX-emu not built yet

**Found**: 2026-07-24. **Severity**: blocks Proton/Windows games only;
does not block PHASE 1's own exit criteria (native Linux Steam + native
Linux games need no x86 translation).

Assessed as meaningfully bigger than gamescope/mesa/InputPlumber: needs
`clang`/`lld`/`llvm` specifically (not gcc), Qt6 for the config GUI, and
a two-stage process (a whole separate x86_64 sysroot gets built first via
`build-fex-sysroot.sh`, its own multi-package Fedora-based build, before
FEX itself compiles against it). Deliberately deferred, not attempted.

⸻

### Real boot image for RP6 not built yet

**Found**: 2026-07-24 (never actually started). **Severity**: blocks all
real hardware testing - devices are unavailable until there's something
flashable.

See `ARCHITECTURE.md` "Boot chain" for the plan (reuse armada's own
kernel+DTB, armada's `make-bootimg.sh` header-v0/ABL conventions, the new
Arch rootfs/initramfs). Not started.

⸻

### Repository structure naming mismatch (device names)

**Found**: 2026-07-24. **Severity**: cosmetic, but worth reconciling
before it causes real confusion.

`MASTER_PLAN.md`'s original "Device Structure" section uses
`retroid-pocket-mini`/`retroid-pocket-5`; the refined repository
structure (`ARCHITECTURE.md`) uses `rpminiv2`/`rp5`/`rp6`. Not yet
confirmed whether the refined names are a deliberate rename or just a
shorthand used in that one conversation.

⸻

### `fex` vs `box64` in the packages/ structure

**Found**: 2026-07-24. **Severity**: low, just needs a decision before
either is integrated.

The refined repository structure lists both `packages/fex/` and
`packages/box64/`, but armada today only uses FEX-emu. Not clarified
whether both are meant to coexist (e.g. box64 as a fallback for specific
games) or this is provisional. See `ARCHITECTURE.md`.
