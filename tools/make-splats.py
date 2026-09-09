#!/usr/bin/env python3
"""Turn Figma brush-stroke exports into inline-ready graffiti SVGs.

Figma exports a marker stroke as a *scatter*: a brush blob defined once in
`<defs>`, then stamped along the stroke by a run of `<use>` elements — one per
dab, emitted in the order the pen travelled. That ordering is the whole trick
here: revealing the stamps in sequence replays the stroke exactly as it was
drawn, texture and all, with no mask or dash-offset guesswork.

This script only has to clean the export up:

  * drop the two background rects Figma bakes in (the node's own backdrop and
    the page behind it) so the splat is transparent
  * namespace every id, since each export reuses `stroke0_11245_908` and two
    of them inlined in one document would collide
  * de-duplicate the blob path, which Figma repeats verbatim per stroke
  * number each stamp with `--i`, which is what CSS staggers on

    python3 tools/make-splats.py
"""

import re
from pathlib import Path

SRC = Path("assets/graffiti/_src")
OUT = Path("assets/graffiti")


def strip_backgrounds(svg: str) -> str:
    """Remove the backdrop rects, keeping the artwork transparent."""
    return re.sub(r'<rect\b[^>]*?fill="#(?:1E1E1E|F5F5F5)"[^>]*/>', "", svg, flags=re.I)


def namespace_ids(svg: str, prefix: str) -> str:
    """Prefix every id and every reference to one, so two splats can coexist."""
    ids = set(re.findall(r'id="([^"]+)"', svg))
    for old in sorted(ids, key=len, reverse=True):
        new = f"{prefix}-{old}"
        svg = svg.replace(f'id="{old}"', f'id="{new}"')
        svg = svg.replace(f'href="#{old}"', f'href="#{new}"')
        svg = svg.replace(f'data-figma-scatter-ref="{old}"',
                          f'data-figma-scatter-ref="{new}"')
    return svg


BLOB = re.compile(r'<path\b([^>]*?)\sd="([^"]{2000,})"([^>]*)/>')


def dedupe_blob(svg: str) -> str:
    """Figma repeats the identical blob path once per stroke — one per group,
    each several kilobytes. Keep the first and point the rest at it."""
    blobs = [m.group(2) for m in BLOB.finditer(svg)]
    if len(blobs) < 2 or any(b != blobs[0] for b in blobs):
        return svg           # not the repeat we expected; leave well alone
    seen = {"n": 0}
    blob_id = "blob"   # namespace_ids() prefixes it afterwards

    def swap(m):
        seen["n"] += 1
        rest = (m.group(1) + m.group(3)).strip()
        if seen["n"] == 1:
            return f'<path id="{blob_id}" d="{m.group(2)}" {rest}/>'
        return f'<use href="#{blob_id}"/>'

    return BLOB.sub(swap, svg)


def number_stamps(svg: str) -> tuple[str, int]:
    """Tag each stamp with its position along the stroke.

    Only stamps in the body are marked. `<use>` also appears inside `<defs>`
    once the blob is de-duplicated, and those are plumbing, not dabs — styling
    them would blank the very shape the dabs reference."""
    n = {"i": 0}

    def tag(m):
        i = n["i"]
        n["i"] += 1
        return m.group(0)[:-2].rstrip() + f' class="dab" style="--i:{i}"/>'

    body_start = svg.index(">", svg.index("<svg")) + 1
    defs_start = svg.index("<defs")
    body = re.sub(r"<use\b[^>]*/>", tag, svg[body_start:defs_start])
    return svg[:body_start] + body + svg[defs_start:], n["i"]


def shrink(svg: str) -> str:
    """Two decimals is well past what a 110px splat can show."""
    svg = re.sub(r"(\d+\.\d{3,})", lambda m: f"{float(m.group(1)):.2f}", svg)
    return re.sub(r">\s+<", "><", svg).strip()


def inline_into_page(names: list[str]) -> None:
    """Refresh the <template> in index.html so the page ships the new art."""
    page = Path("index.html")
    html = page.read_text()
    art = "\n".join((OUT / f"{n}.svg").read_text().strip() for n in names)
    start = html.index("<template data-splats>") + len("<template data-splats>")
    end = html.index("</template>", start)
    page.write_text(html[:start] + "\n" + art + "\n  " + html[end:])
    print(f"  index.html template refreshed with {len(names)} splats")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    built = []
    print("building graffiti:")
    for src in sorted(SRC.glob("*.svg")):
        name = src.stem
        svg = src.read_text()
        before = len(svg)
        svg = strip_backgrounds(svg)
        svg = dedupe_blob(svg)
        svg = namespace_ids(svg, name)
        svg, stamps = number_stamps(svg)
        svg = shrink(svg)
        svg = svg.replace("<svg ", f'<svg class="splat" data-splat="{name}" '
                                   f'data-stamps="{stamps}" ', 1)
        (OUT / f"{name}.svg").write_text(svg + "\n")
        built.append(name)
        print(f"  {name}.svg  {stamps} stamps  {before//1024}KB -> {len(svg)//1024}KB")
    inline_into_page(built)
