#!/usr/bin/env python3
"""Measure a frame PNG: the opening it shows through, and its own silhouette.

    python3 tools/measure-frame.py assets/frames/monitor.png

Prints the `opening` descriptor for FRAMES in scripts/app.js: width and height
as fractions of the frame, and `cy`, where the opening's centre falls down the
frame. The artwork is sized and seated from these three numbers.

The opening is found by flooding out from the centre through transparent
pixels, not by taking every transparent pixel in the file — the corners
outside the frame's own silhouette are transparent too, and counting those
would report an opening the size of the whole image.

The silhouette is the other half of the story, and the reason this tool
reports it: the artwork is hidden only where the frame is opaque. A frame
whose art stops short of the file's edge leaves a band the artwork can show
through, above or below the frame entirely. The artwork therefore has to be
large enough to cover the opening and small enough to stay inside the
silhouette, and those two can conflict — see `checkFrames()` in the app.
"""

import sys
from collections import deque
from pathlib import Path
from PIL import Image

CLEAR = 8          # alpha at or below this counts as a hole
SOLID = 24         # alpha above this counts as frame you cannot see through


def opening(path):
    im = Image.open(path).convert('RGBA')
    W, H = im.size
    a = im.getchannel('A').load()

    start = (W // 2, H // 2)
    if a[start] > CLEAR:
        raise SystemExit(f'{path}: centre is opaque — is the window knocked out?')

    seen = bytearray(W * H)
    q = deque([start])
    seen[start[1] * W + start[0]] = 1
    x0 = y0 = 10 ** 9
    x1 = y1 = -1

    while q:
        x, y = q.popleft()
        x0, x1 = min(x0, x), max(x1, x)
        y0, y1 = min(y0, y), max(y1, y)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < W and 0 <= ny < H:
                i = ny * W + nx
                if not seen[i] and a[nx, ny] <= CLEAR:
                    seen[i] = 1
                    q.append((nx, ny))

    w, h = x1 - x0 + 1, y1 - y0 + 1
    return {
        'size': (W, H),
        'box': (x0, y0, x1, y1),
        'w': w / W,
        'h': h / H,
        'cy': (y0 + h / 2) / H,
        'cx': (x0 + w / 2) / W,
    }


def silhouette(path):
    """The bounds of everything solid — where the frame can hide the artwork."""
    im = Image.open(path).convert('RGBA')
    W, H = im.size
    a = im.getchannel('A').load()
    rows = [y for y in range(H) if any(a[x, y] > SOLID for x in range(W))]
    cols = [x for x in range(W) if any(a[x, y] > SOLID for y in range(H))]
    if not rows or not cols:
        raise SystemExit(f'{path}: nothing solid in this image')
    return {
        'top': rows[0] / H, 'bottom': (rows[-1] + 1) / H,
        'left': cols[0] / W, 'right': (cols[-1] + 1) / W,
    }


for arg in sys.argv[1:] or ['assets/frames/monitor.png']:
    o = opening(Path(arg))
    s = silhouette(Path(arg))
    print(f'{Path(arg).stem}:')
    print(f"  image {o['size'][0]}x{o['size'][1]}  opening box {o['box']}")
    print(f"  opening:    {{ w: {o['w']:.4f}, h: {o['h']:.4f}, "
          f"cx: {o['cx']:.4f}, cy: {o['cy']:.4f} }}")
    print(f"  silhouette: {{ top: {s['top']:.4f}, bottom: {s['bottom']:.4f}, "
          f"left: {s['left']:.4f}, right: {s['right']:.4f} }}")
