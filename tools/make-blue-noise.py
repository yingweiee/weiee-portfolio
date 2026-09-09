#!/usr/bin/env python3
"""Bake a 64x64 blue-noise threshold tile for the backdrop dither.

Ordered dithering needs a threshold map. A Bayer matrix is the cheap one, but
its thresholds are laid out on a grid, so at 1-2px dots the result reads as
crosshatch — you see the matrix, not the image. Blue noise spreads near-equal
thresholds as far apart as possible, so the same dithering reads as film grain.

Void-and-cluster (Ulichney): start from a loose random binary pattern, relax it
by repeatedly moving the tightest cluster into the largest void, then rank every
pixel by removing clusters downward and filling voids upward.

    python3 tools/make-blue-noise.py     ->  scripts/blue-noise.js
"""

import base64
import math
import random
from pathlib import Path

N = 64        # tile edge; wraps, so it can be repeated seamlessly
SIG = 1.9     # gaussian width — how far "near each other" reaches
R = 9         # kernel radius, past which the weight stops mattering

random.seed(7)

KER = {}
for dy in range(-R, R + 1):
    for dx in range(-R, R + 1):
        w = math.exp(-(dx * dx + dy * dy) / (2 * SIG * SIG))
        if w > 1e-4:
            KER[(dx, dy)] = w


def energy_field(pts):
    """How crowded each cell is, counting every point through the kernel."""
    f = [0.0] * (N * N)
    for (px, py) in pts:
        for (dx, dy), w in KER.items():
            f[((py + dy) % N) * N + ((px + dx) % N)] += w
    return f


def bump(f, x, y, sign):
    for (dx, dy), w in KER.items():
        f[((y + dy) % N) * N + ((x + dx) % N)] += sign * w


def tightest(f, pts):
    return max(pts, key=lambda p: f[p[1] * N + p[0]])


def largest_void(f, pts):
    return min(((x, y) for y in range(N) for x in range(N) if (x, y) not in pts),
               key=lambda p: f[p[1] * N + p[0]])


def main():
    pts = set()
    while len(pts) < (N * N) // 10:
        pts.add((random.randrange(N), random.randrange(N)))

    # Relax: the tightest cluster keeps moving into the largest void until
    # doing so would put it straight back where it came from.
    f = energy_field(pts)
    for _ in range(4000):
        tight = tightest(f, pts)
        pts.discard(tight); bump(f, tight[0], tight[1], -1)
        void = largest_void(f, pts)
        if void == tight:
            pts.add(tight); bump(f, tight[0], tight[1], +1)
            break
        pts.add(void); bump(f, void[0], void[1], +1)

    proto = set(pts)
    rank = [0] * (N * N)

    work = set(proto); f = energy_field(work)
    for r in range(len(proto) - 1, -1, -1):
        tight = tightest(f, work)
        work.discard(tight); bump(f, tight[0], tight[1], -1)
        rank[tight[1] * N + tight[0]] = r

    work = set(proto); f = energy_field(work)
    for r in range(len(proto), N * N):
        void = largest_void(f, work)
        work.add(void); bump(f, void[0], void[1], +1)
        rank[void[1] * N + void[0]] = r

    vals = bytes(min(255, r * 256 // (N * N)) for r in rank)
    Path('scripts/blue-noise.js').write_text(
        '/* 64x64 void-and-cluster blue noise, baked.\n'
        '   Regenerate with tools/make-blue-noise.py — see there for why this is\n'
        '   not a Bayer matrix. */\n'
        f'window.BLUE_NOISE = {{ size: {N}, data: "{base64.b64encode(vals).decode()}" }};\n')
    print(f'wrote scripts/blue-noise.js  ({len(vals)} thresholds, '
          f'min {min(vals)} max {max(vals)} mean {sum(vals) / len(vals):.1f})')


if __name__ == '__main__':
    main()
