#!/usr/bin/env python3
"""Stand-in asset sets for projects that only have one picture so far.

    python3 tools/make-placeholder-shots.py

Reducto has five real assets in a folder of its own. The others have a single
logo each, so there is nothing to flick through. This fakes a set: same logo,
five different grounds, which is enough to judge how the cycling reads without
pretending to be finished artwork.

Where a work has a flat background it is recoloured and the logo left alone.
Where it does not — voiceflow is a photograph — a wash goes over the whole
thing instead, since there is no background to separate.

Writes assets/works/<slug>/<slug>-asset-01..05.png. Never touches a project
that already has a folder.
"""

import colorsys
from pathlib import Path
from PIL import Image

WORKS = Path('assets/works')
SHOTS = 5
TOLERANCE = 46          # how close to the corner colour still counts as ground


def shades(rgb):
    """Five grounds derived from the work's own, so they stay in its key."""
    r, g, b = (v / 255 for v in rgb)
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    out = []
    for i in range(SHOTS):
        # a small walk around the hue, and a lightness that lifts then settles
        hh = (h + (i - 2) * 0.045) % 1.0
        ll = min(0.92, max(0.05, l * (1 + (i - 2) * 0.16)))
        ss = min(1.0, s * (1 + (i - 2) * 0.10))
        out.append(tuple(round(v * 255) for v in colorsys.hls_to_rgb(hh, ll, ss)))
    return out


def flat_ground(im):
    W, H = im.size
    corners = {im.getpixel(p)[:3] for p in [(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)]}
    return corners.pop() if len(corners) == 1 else None


for src in sorted(WORKS.glob('*.png')):
    slug = src.stem
    out = WORKS / slug
    if out.exists():
        print(f'  {slug:11} already has a folder, left alone')
        continue

    im = Image.open(src).convert('RGBA')
    ground = flat_ground(im)
    out.mkdir(parents=True)

    for i, shade in enumerate(shades(ground or (128, 128, 128)), start=1):
        if ground:
            # swap the ground, keep every pixel that is not it
            px = im.load()
            W, H = im.size
            new = im.copy()
            npx = new.load()
            for y in range(H):
                for x in range(W):
                    r, g, b, a = px[x, y]
                    if abs(r - ground[0]) + abs(g - ground[1]) + abs(b - ground[2]) < TOLERANCE:
                        npx[x, y] = (*shade, a)
        else:
            # no ground to isolate — lay a wash over the lot
            wash = Image.new('RGBA', im.size, (*shade, 92))
            new = Image.alpha_composite(im, wash)

        new.save(out / f'{slug}-asset-{i:02d}.png')

    kind = 'recoloured ground' if ground else 'wash'
    print(f'  {slug:11} {SHOTS} stand-ins written ({kind})')
