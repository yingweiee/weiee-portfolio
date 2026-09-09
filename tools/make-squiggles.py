#!/usr/bin/env python3
"""Turn Figma's squiggle exports into self-drawing SVGs.

Figma outlines a pencil stroke rather than exporting it as a stroke: what
arrives is a closed filled shape that traces up one side of the line and back
down the other. `stroke-dashoffset` on that path would draw the *outline*, not
the line, so the drawing effect has to come at it sideways.

The trick here: keep the filled shape as a clip, and sweep a deliberately
fat stroke along its own contour underneath. Clipped to the fill, the stroke
can never paint outside the shape, so as it advances it uncovers the squiggle
in the order the pen drew it. `pathLength="1"` normalises every path to unit
length, so one keyframe drives them all whatever their real size.

    python3 tools/make-squiggles.py

Reads assets/squiggles/_src/*.svg, writes assets/squiggles/<name>.svg.
"""

import re
from pathlib import Path

SRC = Path('assets/squiggles/_src')
OUT = Path('assets/squiggles')

# _src filename -> the name the page knows it by. Anything not listed keeps
# its own stem, so dropping `squiggle-08.svg` in needs no edit here.
# The set was redrawn: 01-04 are the cassette, blob, fist and packet, and they
# supersede the drawings 05-07 used to supply (and the star that 04 used to be).
# The retired ones stay in _src rather than being deleted.
NAMES = {
    'squiggle-01.svg': 'cassette',
    'squiggle-02.svg': 'blob',
    'squiggle-03.svg': 'fist',
    'squiggle-04.svg': 'packet',
    'squiggle-05.svg': 'robot',
}
RETIRED = {'squiggle-06.svg', 'squiggle-07.svg'}

# Wide enough to cover the pencil line as it sweeps. It cannot bleed: the
# clip is the shape itself.
STROKE = 6

NUM = re.compile(r'-?\d+\.\d+')


def trim(d):
    """Figma writes ten decimal places for a pencil doodle — 25,000 of them in
    the fist alone. One is plenty: the viewBox is ~80 units drawn at ~110px,
    so 0.1 of a unit is about an eighth of a pixel. Going to whole units would
    be a third of the size again, but that is a pixel and a bit of error and it
    shows on a hand-drawn line."""
    return NUM.sub(lambda m: f'{float(m.group()):.1f}'.rstrip('0').rstrip('.'), d)


def convert(path, name):
    svg = path.read_text()
    head = re.search(r'<svg([^>]*)>', svg).group(1)
    w = re.search(r'width="(\d+)"', head).group(1)
    h = re.search(r'height="(\d+)"', head).group(1)
    box = re.search(r'viewBox="([^"]+)"', head).group(1)

    ds = [trim(m) for m in re.findall(r'<path d="([^"]+)"', svg)]

    defs, uses = [], []
    for i, d in enumerate(ds):
        pid = f'{name}-p{i}'
        defs.append(f'<path id="{pid}" d="{d}" pathLength="1"/>')
        defs.append(f'<clipPath id="{name}-c{i}"><use href="#{pid}"/></clipPath>')
        uses.append(
            f'<use class="ink" style="--i:{i}" href="#{pid}" '
            f'clip-path="url(#{name}-c{i})" fill="none" stroke="currentColor" '
            f'stroke-width="{STROKE}" stroke-linecap="round"/>'
        )

    return (
        f'<svg class="squiggle" data-squiggle="{name}" data-paths="{len(ds)}" '
        f'width="{w}" height="{h}" viewBox="{box}" fill="none" '
        f'xmlns="http://www.w3.org/2000/svg">'
        f'<defs>{"".join(defs)}</defs>{"".join(uses)}</svg>'
    )


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for src in sorted(SRC.glob('*.svg')):
        if src.name in RETIRED:
            continue
        name = NAMES.get(src.name, src.stem)
        out = OUT / f'{name}.svg'
        out.write_text(convert(src, name))
        before, after = src.stat().st_size, out.stat().st_size
        print(f'  {src.name:16} -> {out.name:14} '
              f'{before/1024:6.1f}KB -> {after/1024:6.1f}KB')


if __name__ == '__main__':
    main()
