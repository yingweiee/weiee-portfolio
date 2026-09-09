#!/usr/bin/env python3
"""Copy cuelume's dist into the site, and re-apply the one local patch.

    npm run sync:cuelume

The site has no build step, so a bare `import "cuelume"` cannot resolve in a
browser. The package is installed for its version and provenance, and its
built files are copied to scripts/vendor/cuelume to be served directly.

THE PATCH
---------
cuelume refuses to play anything until `navigator.userActivation.hasBeenActive`
is true — a guard of its own, stricter than the browser's. The browser's real
policy is separate and still applies: an AudioContext opens `suspended` when
audio is not allowed yet, and the code immediately below the guard already
handles that correctly, resuming and playing only if the resume succeeds, and
swallowing the failure otherwise.

So the guard only decides what happens when the browser *would* allow audio —
a site with enough media engagement, or one the visitor has allowed autoplay
for. In that case cuelume stays silent anyway, and the page's hover cues do
nothing until the visitor happens to click. Removing it hands the decision
back to the browser, which is the only thing entitled to make it.

This is not a way around the autoplay policy, and it cannot be: where the
browser blocks audio, the resume fails and nothing plays, exactly as before.

The patch asserts on the exact text it expects. If a future version rewrites
that line the sync fails loudly rather than quietly restoring the guard.
"""

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'node_modules' / 'cuelume'
OUT = ROOT / 'scripts' / 'vendor' / 'cuelume'

GUARD = (
    '    if (typeof navigator !== "undefined" && navigator.userActivation'
    '?.hasBeenActive === false)\n'
    '        return;\n'
)
REPLACEMENT = (
    '    /* PATCHED, see tools/sync-cuelume.py — cuelume\'s own activation\n'
    '       guard removed, so the browser\'s policy is the only gate. A context\n'
    '       that is not allowed yet still opens suspended, and the resume below\n'
    '       still fails quietly. */\n'
)


def main():
    if not SRC.exists():
        sys.exit('cuelume is not installed — run `npm install` first.')

    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(SRC / 'dist', OUT)
    shutil.copy(SRC / 'LICENSE', OUT / 'LICENSE')

    for stale in OUT.rglob('*.d.ts'):        # types are for editors, not browsers
        stale.unlink()

    engine = OUT / 'audio' / 'engine.js'
    text = engine.read_text()
    if GUARD not in text:
        sys.exit(
            f'sync-cuelume: the activation guard was not found in {engine.name}.\n'
            'cuelume has changed that code. Re-read play() and update GUARD here,\n'
            'or drop the patch if it is no longer needed — do not ship silently\n'
            'un-patched, because hover cues would go quiet until the first click.'
        )
    engine.write_text(text.replace(GUARD, REPLACEMENT, 1))

    version = (SRC / 'package.json').read_text().split('"version": "')[1].split('"')[0]
    kb = sum(f.stat().st_size for f in OUT.rglob('*.js')) / 1024
    print(f'cuelume {version} vendored to {OUT.relative_to(ROOT)} '
          f'({kb:.1f} kB of JS), activation guard patched out.')


if __name__ == '__main__':
    main()
