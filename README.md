# weiee — portfolio

Build of the three Figma frames (desktop / tablet / mobile) plus the interactive
states. No framework, no build step:

```bash
python3 tools/serve.py
```

Use that rather than `python3 -m http.server`. The stock server sends no
`Cache-Control`, so browsers fall back to heuristic caching and will happily
show you a stale page after an edit — every "it didn't change" moment in this
project traced back to it. `tools/serve.py` is the same static server with
`no-store` and range requests added.

```
index.html            markup for all three breakpoints
styles/tokens.css     the design system — colour, type, space, layout, motion
styles/style.css      layout + components, every value drawn from a token
scripts/app.js        the carousel, the cursor, and the project list
scripts/draw.js       the drawing toolkit (trial)
scripts/tune.js       dev-only spacing sliders, opened with ?tune
scripts/agentation.js dev-only annotation toolbar (localhost)
package.json          one dependency: agentation
assets/frames/        the picture frames `[ ... ]` cycles through
assets/works/         one logo per project
assets/graffiti/      the splats, plus `_src/` raw Figma exports
tools/make-frames.py  regenerates the placeholder frames
tools/make-splats.py  cleans Figma brush exports and inlines them
```

**To add or change a project**, edit the `PROJECTS` array at the top of
[scripts/app.js](scripts/app.js) and drop a square PNG into `assets/works/`
under the matching `slug`. The counter and the wrap both read their length
from that array, so five is not a fixed number.

Five works today: **Reducto · David AI · Orchestra · Voiceflow · Colosseum**.
The artwork is real. The *copy* is not — only Reducto's eyebrow and description
came from the design; the other four are placeholders, and since they name real
companies they want real words before this goes anywhere public.

## Finalising: two dev tools

Neither ships. Both are localhost-only or query-gated.

### Agentation — telling me what to change

`npm install agentation`. Loads automatically on **localhost** (or anywhere
with `?agentation`; `?no-agentation` turns it off). Toolbar appears bottom
right — click to activate, click any element, write a note, copy, paste back
to me. The output carries the selector, element path and bounding box, so
"this needs more padding" arrives attached to the actual node instead of a
description I have to guess at. Its animation-freeze is worth knowing about
here: the graffiti draws itself on and the carousel is often mid-motion, and
you cannot annotate a frame you cannot hold still.

**One integration note.** The published bundle has a single
`process.env.NODE_ENV` check. A bundler would substitute that; we serve the raw
ESM out of `node_modules`, so nothing does, and the component threw
`process is not defined` mid-render and silently rendered *nothing* — CSS
injected, no DOM, no error surfaced to the page. `scripts/agentation.js` defines
`globalThis.process` before the import. If it ever renders blank again, that is
the first thing to check.

It resolves through the import map as `/node_modules/agentation/dist/index.mjs`
and reuses the React already loaded for the drawing toolkit, so it adds no new
network dependency. **Licence: PolyForm Shield 1.0.0** — source-available, not
OSI-approved. Fine as a dev tool; worth knowing if this repo is ever published.

### The slider panel — changing values directly

```
localhost:4321/?tune
```

Opens a panel of sliders top-right. Off without the query.

Each control writes a CSS custom property straight onto the root, so you are
adjusting the real cascade rather than a preview — shrink the caption's padding
and the stage grows, which grows the frame, which re-seats the artwork inside
its opening. Verified end to end: caption padding 40 → 0 takes the frame
380 → 460 and the artwork 269 → 325, seated correctly at every step, with the
page still summing to exactly the viewport.

| the caption box | around it |
|---|---|
| padding top, padding bottom | bar inset |
| gap, text width | column width |
| title, body, body leading | frame ceiling |

Changed rows are marked, **copy CSS** puts only those on the clipboard as a
`:root` block ready for `tokens.css`, and **reset** restores every value.

The defaults are the 4pt scale — `--pad-caption` and friends resolve to
`--space-10` and `--space-5` until you override them, so the panel adds hooks
without changing how anything looks.

Two notes on how it behaves: the panel fires a `portfolio:relayout` event
rather than leaving the refit to a `ResizeObserver`, because it moves geometry
on every slider input and observer callbacks only arrive at rendering
opportunities. And arrow keys inside a slider adjust the slider, not the
carousel — the page's key handler already ignores form controls.

---

**Source of truth** — Figma file `9lCRHsCELT72xIsxHHWGsv` ("Portfolio"), nodes
`17625:30` desktop · `17627:411` tablet · `17627:464` mobile · `17627:544` states.

---

## Design system

### Colour

The palette is one neutral ramp. Hierarchy is carried by *emphasis*, never hue —
which is why the page holds together with no accent at all.

| Token | Value | Figma | Used for |
|---|---|---|---|
| `--color-surface` | `#f5f5f5` | `neutral/100` | page |
| `--color-high` | `#18181b` | `elements/light/highEm` | title, links, current index |
| `--color-mid` | `#71717b` | `elements/light/midEm` | body copy, labels, total count |
| `--color-low` | `#9f9fa9` | `elements/light/lowEm` | connectives ("by", "out of"), arrows at rest |
| `--color-highlight` | `#ebebeb` | — | the hover sweep behind links |
| `--color-plate` | `rgba(0,0,0,.05)` | — | empty filmstrip slots |

That's the entire palette — there is no accent. `fuchsia/400` (`#ed6aff`) exists
in the Figma library but is deliberately unused; the focus ring is drawn in
`--color-high`, the same ink as the links it lands on.

### Typography

Vollkorn throughout, always weight 400. Two voices do all the work:

- **italic** — the UI voice: labels, links, counter, the title
- **upright** — punctuation, arrows, and long-form copy

Three OpenType feature sets, applied deliberately (they're what give the counter
its `01 out of 10` oldstyle look):

| Token | Setting | Applies to |
|---|---|---|
| `--ff-ui` | `ss03, ss08, ss17 on; calt off` | all chrome and labels |
| `--ff-body` | `calt off` | the description paragraph |
| `--ff-display` | none | the title |

| Style | Size / leading / tracking | Where |
|---|---|---|
| display | 48 / 1.0 / 0 · italic | project title |
| body | 16 / 26 / .02em | description — the Figma says 18, 16 is your call |
| meta | 15 / 24 / .04em · italic | labels, links, counter, colophon |
| glyph | 15 / 24 / 0 | arrows, `©`, `no all rights reserved.` |
| caption | 14 / 22 / .04em | `[ ... ]` |
| hint | 12 / 20 / .04em · italic | "change frame" |
| micro | 9.675 | the `zz` on `d(-_-)b` |

### Spacing

A strict 4pt scale — only these seven steps appear anywhere in the designs:

`4 · 8 · 12 · 20 · 24 · 40 · 80`

40 is the workhorse (every section's vertical padding), 20 the rhythm inside the
caption stack, 80 both the footer's bottom breath and the filmstrip gap.

### Layout

| Token | Value |
|---|---|
| `--measure-page` | 560 (20 gutters on mobile) |
| `--measure-prose` | 460 |
| `--frame-size` | 570 — a **ceiling**; spills the 560 column slightly |

The page is exactly one viewport tall, so the frame is not given a size: it
takes whatever height the masthead, caption and footer leave it, up to the
width of the content column — where it stops growing, filling the container
exactly rather than spilling past it. See *Fitting one viewport* below.

The filmstrip still bleeds past the viewport — clipped at `<html>` so it never
opens a horizontal scrollbar. The frame no longer spills past the column; it is
capped at the column width.

### The gallery moves on its own

At rest the shelf **drifts gently left**, one project crossing every
`--drift-per-slot`, wrapping forever. The moment the mouse moves — or any
other input arrives — it **snaps to the nearest project and stops there**. Go
quiet for `--drift-resume` and it picks the walk back up. Set that token to `0`
and a stop is permanent.

It runs on its own `requestAnimationFrame` rather than through the scroll
position, because scrolling is snapped: nudging `scrollTop` by a fraction of a
step every frame would be fought by the browser's own magnet. So the drift owns
the strip while it runs and hands back a real scroll position when it lands —
the same handover the swipe already did, now shared as `settleToRest()`.

Crossing a whole slot rebases onto the next project exactly as the scroll path
does at its halfway point, which is what makes it infinite: there is no end to
run out of, only a base index that keeps moving.

`prefers-reduced-motion` disables it outright, and a hidden tab pauses it — a
backgrounded tab gets no frames, so it would otherwise lurch on return.

**One trap worth knowing.** While the drift runs it suppresses scroll reads, so
`scroll` had to be a wake event and not just `wheel`. Without it a scroll that
arrived any other way — momentum, a scrollbar drag, anything programmatic —
was swallowed and the page looked frozen: the counter stuck on one project
while `scrollTop` moved underneath it. Caught in testing; `scroll` is in the
wake list now. The drift never moves `scrollTop` itself, so it cannot wake
itself.

### Graffiti, currently hidden

`SHOW_GRAFFITI` in [scripts/app.js](scripts/app.js) is `false`. The artwork,
the placement data and the draw-on animation all stay — it is one word to bring
them back.

### Full-width bars

The masthead and footer run edge to edge with an even **24px inset**, and only
the caption is held to the 560 column. Byline hard left, `[ ... ]` on the
viewport's centre line, counter hard right; colophon left, the two links
grouped right with a 32 gap.

The `d(-_-)b` sign-off is gone — the design clips it out of the footer group.
Removing it mattered structurally too: `.footer__links` used `display: contents`
so the four children could space out evenly, and with three left `twitter`
ended up stranded mid-bar. It is a real flex group now.

### The mark behind the title

A **2px checkerboard** of `--color-highlight` over `--color-dither`, measured
straight off the Figma render — `#ebebeb` and `#cecece`, about 26% each. The
Figma layer is a flat `#e5e5e5` at 20%, so the dither is the intent rather than
the file; sampling the pixels is what settled the two colours and the cell size.

It is an `inline-block` wrapping the title text with `--mark-pad` either side,
which is what makes it **scale with the name** rather than sit in a fixed box:
Reducto 166px, David AI 189, Orchestra 199, Voiceflow 195, Colosseum 216.

The title text carries `data-title`, so the caption swap writes to the span and
the block resizes with it.

### Fitting one viewport

The page is exactly one viewport tall. **The chrome keeps the spacing the
design specifies — 40 throughout — and the image absorbs whatever is left.**
Nothing about the masthead, caption or footer changes with viewport height;
only the frame flexes.

**So the frame is height-bound, not width-bound.** At the design's own 1040px
height the numbers land on the Figma exactly: masthead 72, stage 598, caption
298, footer 72 — frame **570**, artwork **400** square, filmstrip gap **120**.

| Viewport height | Frame | Artwork |
|---|---|---|
| 1040 (the design) | **570** | 400 |
| 900 | 430 | 302 |
| 812 (phone) | 270 | 190 |

Below roughly 660px tall the chrome alone fills the screen and the stage hits
its 140px floor; the page overflows rather than crushing the image further.

The only lever that buys more on a short screen is the caption, and within it
the single longest description — since every project reserves that height.

The frame is sized **in CSS** — from the height it was left (`height: 100%` +
`aspect-ratio` + `max-height`) — so it can never go stale. The artwork is
measured in script, because its size and seat come from the current frame's
opening and percentages there would resolve against the strip, whose size is
what its own contents determine. That measurement runs from a ResizeObserver on
the frame, the window `resize`, and every frame change.

### Responsive

One breakpoint, at **640px**.
Desktop and tablet are the same layout at different viewport widths; the Figma
frames differ only in canvas size. Below 640 the layout changes shape:

- masthead arrows move down to flank the description
- byline shortens from "latest dabblings" to "latest"
- the frame stops spilling and stays inside the padded column
- footer stacks into three centred rows

The frame is at its smallest here: mobile chrome runs to 632px of an 812px
screen — the footer stacks to three rows, and the description wraps to five
lines — leaving the image 180px. Shortening the descriptions is what buys it
back; the geometry has nothing left to give.

One visible change from the Figma here: because the gap now scales with the
frame, a sliver of the neighbouring works shows either side on a phone, where
the original mobile frame had them fully off-screen. It reads as a hint that
there is more to scroll to, which the mobile layout otherwise lacks — but it is
a deviation, so flagging it.

---

## Interactions

### Specified in the Figma states frame

All three hover states are built and working. They share one gesture — a
`#ebebeb` block **wipes in from the left**, inset 16.67% (4px on a 24px line),
like a highlighter pen:

| Element | At rest | On hover |
|---|---|---|
| `weiee`, `visit link →`, `twitter [x]`, `contact [@]` | dotted underline, `high` | sweep in; text unchanged |
| `←` `→` | `low` | sweep in; text `low` → `high` |
| `[ ... ]` | `low` | sweep in; text `low` → `high`; "change frame" fades in 24px below |

That last one is the most informative state in the file: the ellipsis is a
**control**, and its job is swapping the picture frame.

### Built

**The frame never moves.** It's a fixed aperture — the work travels behind it.
Everything below follows from that one rule.

**One number describes the carousel.** `shift`, measured in slots: `0` at rest,
`±1` one step away, and a drag passes through every value between. Position and
opacity are both pure functions of it, so a flick, a click, an arrow key and a
button all run the same code path — there is no separate "drag mode".

Art opacity is `max(0, 1 − |offset| / 2)`, which lands on `1 · .5 · 0` at the
five resting positions. That last zero is what renders the outermost pair as the
design's empty plates: **a plate is simply a slide at zero opacity**, so
lazy-loading needs no new visual and there is no special case in the code.

**Scrolling is the gesture, and the snap is the magnet.** Each project owns one
empty `100dvh` step in the document; `scroll-snap-type: y mandatory` is what
pulls the nearest one into place. Nothing is hijacked — the browser scrolls
normally, on every input it already supports, and the script only *reads* where
the scroll got to and turns it into `shift`. So the strip tracks a trackpad
continuously rather than jumping once the snap lands.

**Four ways to move, all equivalent:**

| | |
|---|---|
| scroll down / up | next / previous; tracks 1:1, snap settles it |
| swipe left / right | next / previous; follows the finger, commits past a fifth of a slot |
| click a half of the stage | goes the way the cursor is pointing |
| `←` `→` buttons and keys | masthead on desktop, flanking the description on mobile |

**One project per gesture, however hard the flick.** For scrolling that is
`scroll-snap-stop: always` on the steps — the scroll is forbidden from passing
over a snap point during a single intended scroll, so momentum stops at the very
next project instead of flying through several. It stays native, so the browser
still owns the easing. For swiping it falls out of the maths: the strip's offset
is clamped to ±1 slot, so a 1300px drag and a 100px drag both commit exactly one
step.

**How the two gestures share one carousel.** Scroll position is the resting
source of truth, and a swipe borrows the strip for the length of the gesture:
scroll reads are suspended while a finger is down, then the swipe hands its
result back by jumping the scroll — instantly, and onto a real snap point, so
mandatory snap has nothing to argue with. The strip is rebased onto the new
project at the exact screen position it already occupied and glides the
remainder from there, so nothing jumps at the handover. A swipe off either end
lands on a buffer step and is folded back onto the real lap immediately.

Which axis a gesture belongs to is the browser's call, not ours: `touch-action:
pan-y` on the stage means a vertical drag scrolls (and cancels the swipe),
while a horizontal one never pans and arrives as pointer events instead.

**The cursor is the control.** Over the stage the native pointer is replaced by
a bare arrow that flips at the page's midline: left half `←`, right half `→`.
Nothing sits behind it — no plate, no chip. It reads cleanly against the page
and against the mid-grey neighbours, and disappears over the near-black centre
of a work; that is a deliberate trade for keeping it unadorned.

The flip is sequenced, not cross-faded: the outgoing arrow leaves before the
incoming one arrives. Overlapping them at half opacity reads as a single
ambiguous `↔`.

**The caption cross-fades while the strip slides.** Eyebrow, title, description,
`visit link` and the counter all belong to the current work and swap together;
sliding them alongside the image would fight the frame, which has to stay put.
The words clear in 140ms and return over 220ms, landing well before the image
settles at 520ms — you should never be waiting on the text.

**It wraps**, so the arrows never need a disabled state. From `10` the next step
is `01`. Two extra buffer steps, one at each end, are what make that possible
with a real scrollbar: drift into one and the page hops a whole lap instantly.
Because everything on screen is a function of position *modulo* the list
length, nothing changes visually — only `scrollTop` does. The scrollbar is
hidden for exactly that reason: a visible thumb would leap a full page and read
as a glitch.

**`[ ... ]` cycles the picture frame**, wrapping the same way. The work stays
put; only the frame swaps. All six are preloaded so it's instant.

**Scope note.** The cursor takes over the stage band only — full width, but not
the masthead, caption or footer, where the real links live and a hijacked
pointer would do more harm than good. The left/right split is still the page's
midline, as asked.

---

## Injected extension buttons

Pinterest's browser extension puts a **Save** button over images. The page opts
out of it two ways, which is all the control a page has:

- `<meta name="pinterest" content="nopin">` in the head, for the whole site
- `nopin="nopin"` on every `<img>`

That covers Pinterest, which honours the tag by design. **There is no general
fix.** Extensions inject their UI into the page with the same privileges as the
page itself, and a site cannot detect or remove another extension's elements —
anything that tried would be a fragile guessing game against changing class
names, and would break the moment the extension updated. If some other
extension's button shows up, the reliable answers are to disable it for this
site, or to check the design in a clean profile or a private window.

Worth remembering when reviewing: **what you see is your browser, not the
site.** Nobody visiting without that extension sees the button.

## A gotcha worth knowing: `100dvh` is not `window.innerHeight`

The scroll steps are laid out in `100dvh`. Browsers with auto-hiding chrome —
Arc among them — resolve `dvh` against a different height than
`window.innerHeight` reports, sometimes by 50px or more.

Read the scroll with the wrong one and every snap point lands slightly off.
The error **accumulates with each step**, so the further along the shelf you
go the worse it gets. At project 4 with a 6% mismatch the strip rests a quarter
of a slot off centre — the current work hangs past the frame's edge, which
looks exactly like it is sitting on top of the frame rather than behind it.

So `stepSize()` measures a real step element instead of trusting
`window.innerHeight`, and anything within 1% of a step is treated as exactly on
it. Whatever `dvh` resolves to, the arithmetic matches the real snap geometry.

**If the work ever looks off-centre in the frame again, this is the first thing
to check** — it presents as a layering problem and is not one.

## Drawing toolkit — trial

[drawesome](https://benji.org/drawesome) mounted with **brush, colours and
eraser only**. Everything else it offers is switched off rather than rebuilt:
no size or opacity sliders, no undo or clear, no hex picker.

```js
tools: ['brush'], eraser: true,
controls: { color: true, size: false, opacity: false,
            undo: false, clear: false, custom: false, minimize: true }
```

The palette is the site's own ink — the neutral ramp plus the two graffiti
colours already on the canvas — so anything drawn belongs to the same picture
instead of arriving from a stock rainbow.

### The problem it had to solve

This page navigates **by gesture**: scroll moves between projects, a horizontal
swipe does the same, a click on either half of the stage does too. A
full-viewport drawing surface would have swallowed all of it.

The toolbar already knows whether it is open, so rather than keep a second copy
of "is the user drawing?", the CSS reads its state directly:

```css
.draw-host { pointer-events: none; }
.draw-host .Draw_root:has(.MorphBar_bar:not(.MorphBar_collapsed)) {
  pointer-events: auto;
}
```

`pointer-events` is inherited, so `none` on the host reaches the surface while
the toolbar — which sets its own `auto` — stays clickable. Minimised, the disc
is the only live thing on screen. Verified both ways:

| toolbar | under the cursor | page gestures | drawing |
|---|---|---|---|
| disc | the page | scroll / swipe / click all navigate | off |
| open | the surface | suspended | ✓ |

### Placement

Bottom-left, inset 20. Clear of the 560px content column, the counter at top
right, and the footer, which is centred — empty at every breakpoint. Checked on
mobile: the disc sits beside the footer's box but never over its text, and the
footer links still take clicks.

### What this costs

React. It is the only dependency in the project and it exists solely for this,
loaded from esm.sh through an import map — so there is still no build step, but
there is now a **network dependency**. `scripts/draw.js` is wrapped in a `try`:
if the CDN is unreachable it removes its own host and the page is exactly as it
was. Reverting the trial is deleting `draw.js`, the import map, and one CSS
block.

Two things deliberately left out, both one flag away: **undo/clear** (the
eraser is the only way back right now) and **persistence** — `onChange` would
let a drawing survive a reload, but nothing is stored today.

## The current work, and the rest

Opacity and colour are both pure functions of distance from centre:

```js
nearness   = max(0, 1 − |offset|)
opacity    = 0.2 + 0.8 · nearness     // full at centre, 20% either side
saturation = nearness                 // full colour at centre, grey either side
```

Both interpolate, so a scroll or a drag passes through the in-between states
instead of snapping at a threshold. With five logos on one shelf this matters:
without it, five brands compete at once.

### Why `filter`, not `mix-blend-mode: saturation`

The blend mode is **inert on this page**, and it is worth knowing why before
anyone tries it again. `.page` is `position: fixed; z-index: 1`, which makes it
a stacking context. Inside that group the slides have only transparency behind
them — the page colour is painted outside the group — so `saturation` has no
backdrop to take hue and luminosity from, and passes the source straight
through.

Verified rather than assumed: switching the blend off rendered pixel-identical.
`filter: saturate()` needs no backdrop, is deterministic, and interpolates,
which the blend mode could not have done anyway — it would have had to flip at
a threshold mid-scroll.

Making the literal blend work would mean painting the page colour *inside* the
group, behind the strip — which is the grey bar across the sides that got
removed earlier. Not worth trading back.

## Graffiti

Two splats are tagged onto the picture frame — a lime scribble at its top-left,
a magenta smiley at its bottom-right — and they **draw themselves on at load**.

### Why it can draw itself

Figma exports a marker stroke as a *scatter*, not a shape: the brush blob is
defined once, then stamped along the stroke by a run of `<use>` elements —
**one per dab, in the order the pen travelled**. That ordering is the whole
trick. Revealing the dabs in sequence replays the stroke exactly as it was
drawn, texture and all. No `stroke-dasharray`, no mask, no guessing at a stroke
width that would have to cover the brush.

Each dab carries `--i`, its position along the stroke, and CSS staggers on it:

```
animation-delay: calc(--splat-begin + --splat-delay + --i * --splat-step)
```

`--splat-step` is the time between dabs, so it *is* the drawing speed. At
2.4ms: the scribble's 217 dabs run 0.26s → 0.78s, then the smiley's 139 run
0.88s → 1.21s — they go up one after the other rather than at once.

### What the generator has to fix

`tools/make-splats.py` takes the raw exports in `assets/graffiti/_src/` and:

- **drops two background rects** Figma bakes in (the node's own backdrop and
  the whole page behind it), which otherwise ship as opaque blocks
- **namespaces every id** — each export reuses `stroke0_11245_908`, and two of
  them inlined in one document would collide
- **de-duplicates the blob**, which Figma repeats verbatim per stroke; the
  smiley carried four identical 7KB copies, 45KB → 26KB
- **marks the real dabs** `.dab`. Once the blob is de-duplicated, `<use>` also
  appears inside `<defs>` as plumbing — styling those blanks the very shape
  every dab refers to, which silently erased the smiley's eyes and mouth
- **refreshes the `<template>` in index.html** so the page ships the new art

### Placing them

Position is a percentage of the picture frame, not the viewport, so graffiti
travels and scales with the frame at every size. Size is not listed at all — it
comes from the artwork's own viewBox measured against the 600pt frame the
design was drawn against.

```js
const GRAFFITI = [
  { splat: 'scribble', x: 8.0,  y: 9.3,  delay: 0 },
  { splat: 'smiley',   x: 92.5, y: 93.3, delay: 620 },
];
```

**Adding another is two steps**: drop the Figma export into
`assets/graffiti/_src/`, run `python3 tools/make-splats.py`, add a row. The art
is inlined in a `<template>` rather than fetched, so it animates from CSS and
the page still works off the filesystem.

### Note on colour

The splats introduce `#87F500` and `#FF07DE` — a lime and a magenta — into a
design that until now was a strict neutral ramp with no accent at all. They are
deliberately **not** tokenised as part of the palette; they live inside the
artwork, as graffiti does. Worth a conscious decision before any of it leaks
into the interface.

## Layering the frame over the works

Pure z-order, matching how the Figma file stacks it: the strip sits at
`z-index: 0`, the frame at `2`. The works stay continuously visible — through
the opening *and* either side of it — and simply pass beneath the ornament.
Nothing masks them.

**The ornament is a halftone, though**, and that has a consequence worth
knowing. Only about 64% of its pixels carry ink, measured off the PNG's alpha
channel. The artwork is cut 6% larger than the opening, so a work tucks under
the lip on each side — deliberately, so no gap can open at the edge. In that
overlap band a near-black work shows straight through the dither, and the
frame's inner edge reads dark.

This only affects `ornate`. The default frame is the monitor, whose bezel is
fully opaque, so nothing shows through it.

That is not a stacking problem and no z-index will change it — the frame is on
top; you are seeing through it. Figma composites it the same way. If the
ornament should ever read solidly over a dark work, the fix is frame art with
an opaque inner lip, not a change to the layering.

## Keeping the frame a constant size

The frame takes whatever height the caption leaves it — which means a longer
description makes a smaller frame, and the frame visibly changes size as you
move along the shelf.

So the caption reserves the height of the **longest** description, measured at
boot across the whole project list and again whenever the width changes (which
changes how the copy wraps) and once fonts have loaded (same reason). Short
copy centres in the reserved box instead of sitting at the top of it. Verified
identical at all ten projects.

The practical consequence: **one very long description costs every project the
same height.** If the frame ever looks smaller than it should, the culprit is
the longest entry in the list, not the layout.

### Placeholders

Slide 01 (Reducto) is real. Slides 02–10 are placeholders: invented one-word
titles, copy that says it's placeholder copy and runs to about the length of a
real description so the caption keeps its shape, and generated artwork from
[tools/make-works.py](tools/make-works.py). Each is a different geometric
system, but they share the real piece's language — fine light linework on
near-black — so the shelf reads as one body of work while you swipe.

### The frame set

`assets/frames/` holds the cycle. `monitor.png` is the default; `ornate.png`
is the original Figma export; the other five are geometric placeholders.

**Each frame declares the opening its artwork shows through**, as a fraction of
the frame, measured off the PNG's alpha channel:

```js
{ name: 'monitor', opening: { w: 0.6667, h: 0.5807, cy: 0.4325 } }
{ name: 'ornate',  opening: { w: 0.7683, h: 0.7683, cy: 0.5    } }
```

This has to be per-frame, not a constant. The monitor's screen is **landscape
and sits above centre** — the machine has a control panel under it — where
every other frame is a centred square. So the artwork reshapes and re-seats
itself to whichever frame it is in, and cycling `[ ... ]` is visibly a change
of aperture rather than just a change of border.

The work is a **square**, cut 5.3% larger than the opening's longer side, so it
covers and tucks under the bezel whatever shape that opening is. That lands on
400 against the monitor's 570 frame and 485 against the ornate frame's 600 —
both the numbers the design uses.

**Adding a frame**: drop a square PNG with a transparent opening into
`assets/frames/`, measure its opening, add a row. If the artwork ever sits
wrong in a frame, that row is the thing to check.

### Open question

- Should `weiee` in the byline link somewhere — an about page — or is it
  decorative? It's the only link in the design with no obvious destination.
