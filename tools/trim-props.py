#!/usr/bin/env python3
"""Crop the transparent margin off each prop, a state-pair at a time.

    python3 tools/trim-props.py

An exported PNG carries a wide transparent border, and an <img> hit-tests on
its whole box — transparent pixels included. Left padded, each object claims a
rectangle much larger than the thing you can see, swallowing clicks meant for
the page behind it.

The crop is the union of a pair's two states, never each state's own box. The
second state is usually bigger — the spray can grows a plume — and cropping
them separately would leave the two images with different frames, so the can
itself would jump the moment you hovered it. Sharing one box keeps the object
still and lets only the new part appear.

Reads assets/props/_src/<name>-01.png and -02.png, writes assets/props/.
"""

from collections import defaultdict
from pathlib import Path
from PIL import Image

SRC = Path('assets/props/_src')
OUT = Path('assets/props')


def ink_box(im):
    return im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()


def union(a, b):
    return (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))


pairs = defaultdict(dict)
for src in sorted(SRC.glob('*.png')):
    stem = src.stem
    base, _, state = stem.rpartition('-')
    pairs[base or stem][state or '01'] = src

OUT.mkdir(parents=True, exist_ok=True)
for base, states in sorted(pairs.items()):
    images = {k: Image.open(p).convert('RGBA') for k, p in states.items()}
    box = None
    for im in images.values():
        b = ink_box(im)
        box = b if box is None else union(box, b)
    if box is None:
        print(f'  {base}: no ink, skipped')
        continue

    for state, im in sorted(images.items()):
        cut = im.crop(box)
        cut.save(OUT / f'{base}-{state}.png')
    own = ', '.join(f'{s}:{ink_box(im)[2]-ink_box(im)[0]}x{ink_box(im)[3]-ink_box(im)[1]}'
                    for s, im in sorted(images.items()))
    print(f'  {base:10} shared box {box[2]-box[0]}x{box[3]-box[1]}   (own ink {own})')
