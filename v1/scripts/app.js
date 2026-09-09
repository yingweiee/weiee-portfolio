/* =========================================================================
   The shelf.

   One idea drives everything: the picture frame is a fixed aperture and the
   work travels behind it. Nothing here moves the frame.

   A single number — `shift`, measured in slots — describes the carousel at any
   moment. 0 is at rest, ±1 is one step away, and scrolling passes through
   every value between. Position and opacity are both pure functions of it,
   so the scroll, a click and an arrow key all run the same code path.
   ========================================================================= */

(() => {
  'use strict';

  /* ----------------------------------------------------------- the works */
  /* Five works, one asset each in ../assets/works/<slug>.png.

     The artwork is real. The *copy* is not: only Reducto's eyebrow and
     description came from the design — the other four are placeholders, and
     they name real companies, so they want real words before this is public. */
  const PROJECTS = [
    {
      slug: 'reducto',
      marker: '#edbdff',
      shots: 5,          // ../assets/works/reducto/reducto-asset-01..05.png
      eyebrow: 'website design',
      title: 'Reducto',
      body: 'Reducto is the agentic document platform for leading AI teams—a comprehensive toolkit for document tasks, built for enterprise performance at scale.',
      href: '#',
    },
    {
      slug: 'david-ai',
      stem: 'davidai',        // its export drops the hyphen
      marker: '#ffbea5',
      shots: 5,
      eyebrow: 'brand identity',
      title: 'David AI',
      body: 'David AI is an audio data research company — trusted by top AI labs to develop the proprietary audio datasets that power their models.',
      href: '#',
    },
    {
      slug: 'orchestra',
      marker: '#a7d5b8',
      shots: 5,
      eyebrow: 'website design',
      title: 'Orchestra Bio',
      body: 'Orchestra helps R&D organizations unify planning, automate operations, and reduce the risks that derail breakthrough science.',
      href: '#',
    },
    {
      slug: 'voiceflow',
      marker: '#9deaff',
      shots: 6,
      eyebrow: 'brand identity',
      title: 'Voiceflow',
      body: 'Voiceflow is the AI agent platform for customer experience automation. Build, launch, and scale chat and voice AI agents for customer support and CX.',
      href: '#',
    },
    {
      slug: 'colosseum',
      marker: '#cdcef9',
      shots: 6,
      eyebrow: 'website design',
      title: 'Colosseum',
      body: 'Colosseum hosts and organises the world\u2019s largest online hackathons, where elite crypto founders launch startups on Solana and beyond.',
      href: '#',
    },
  ];

  /* The frames `[ ... ]` cycles through, each with the opening its artwork
     shows through — measured off the PNG's alpha channel, as a fraction of
     the frame.

     This has to be per-frame rather than a constant: the monitor's screen is
     landscape and sits *above* centre, because the machine has a control panel
     under it. Everything downstream reads `opening`, so the work reshapes and
     re-seats itself to whichever frame it is in. */
  const FRAMES = [
    { name: 'monitor',  opening: { w: 0.6667, h: 0.5789, cx: 0.5000, cy: 0.4333 } },
    { name: 'vending',  opening: { w: 0.6732, h: 0.6355, cx: 0.5000, cy: 0.4937 } },
    { name: 'terminal', opening: { w: 0.6840, h: 0.6481, cx: 0.4982, cy: 0.4767 } },
    { name: 'ornate',   opening: { w: 0.6948, h: 0.6858, cx: 0.4946, cy: 0.4704 } },
    { name: 'polaroid', opening: { w: 0.7092, h: 0.6912, cx: 0.5018, cy: 0.4425 } },
    { name: 'arcade',   opening: { w: 0.6768, h: 0.5835, cx: 0.5000, cy: 0.4892 } },
  ];

  /* The work is a square of one fixed size, whatever frame is around it —
     changing frames changes the aperture, never the picture. Sized to cover
     the widest opening in the set so it can never leave a gap at the edge,
     with a little over for the bezel to sit on. */
  const OVERLAP = 1.053;
  /* Fixed, not derived from the frames on hand. Deriving it meant every frame
     added or removed resized every work, which is exactly what must not
     happen — the picture is the constant and the frame is the variable. Any
     frame whose opening is wider than this would leave the artwork short of
     the aperture, so `checkFrames()` says so rather than letting a gap ship. */
  /* The picture is cut a little larger than the widest window so the bezel
     always has something under it — but only a little, because every extra
     percent here is picture the frame hides. 0.7164 is the floor: below that
     the polaroid's window (cut high) and the ornate's (cut low) can no longer
     both be covered. Sat a little above that floor, because ART_CY has been
     nudged down off the balance point and the picture has to reach further to
     the top to keep covering the polaroid's high window. */
  const ART_FRACTION = 0.756;

  /* Shelf lays the works out in a row, so the ones either side of the current
     project show at the edges of the page. Solo stacks them in one place and
     dissolves between them, which is the only way no work's edge ever crosses
     the opening. Flip this to false to go back to solo. */
  const SHELF = true;

  /* The objects propped around the canvas — spray can, badge and the rest.
     Off for now; the assets and their positions are all still here, so this
     is the only line to change. */
  const SHOW_PROPS = false;
  const GAP_RATIO = 100 / 570;   // the filmstrip gap
  /* Read from the tokens rather than fixed here, so the `?tune` panel can
     move them. Cached: `render` runs on every scroll frame and asking the
     cascade each time would be a style recalculation per frame. */
  let inactiveOpacity = 0.15;
  let inactiveSaturate = 0;

  function readShelf() {
    const cs = getComputedStyle(root);
    const o = parseFloat(cs.getPropertyValue('--inactive-opacity'));
    const t = parseFloat(cs.getPropertyValue('--inactive-saturate'));
    if (!Number.isNaN(o)) inactiveOpacity = o;
    if (!Number.isNaN(t)) inactiveSaturate = t;
  }

  /* Where the work's centre sits down the frame — also fixed, for the same
     reason the size is. Following each frame's own opening meant the picture
     stepped up or down as you cycled frames, because the windows are not cut
     at the same height (the monitor's screen sits at 0.433, the vending
     machine's at 0.494). Sitting midway between them, the work holds still
     and each window is equally close to centred on it. */
  const ART_CY = 0.4680;
  /* How much of its own slack a work travels across one transition. The art
     is cut larger than the opening, so it can slide a little before its edge
     would appear in the aperture — this spends that margin and no more, which
     is what buys the drift without ever showing an edge. */
  const DRIFT = 1;

  /* ------------------------------------------------------------ graffiti */
  /* Where each splat is tagged, as a percentage of the picture frame — so it
     travels and scales with the frame rather than with the viewport. `delay`
     staggers the drawing so they go up one after another instead of at once.
     Size is not listed: it comes from the artwork's own viewBox, measured
     against the 600pt frame the design was drawn at.

     Adding another splat is two lines: export it from Figma through
     tools/make-splats.py, then add a row here. */
  /* Hidden for now. The artwork, the placement and the draw-on all stay —
     flip this back to true to bring them out. */
  const SHOW_GRAFFITI = false;

  /* The pencil doodles. Off for now — the artwork and positions all stay. */
  const SHOW_SQUIGGLES = true;

  /* Pencil doodles, placed by centre as a percentage of the page. Positions
     are read off the design; widths are each drawing's own — the set is
     already sized relative to itself, so scaling them by eye only breaks the
     proportions the artwork was drawn with.

     To resize the whole set, move SQUIGGLE_SCALE and leave the widths alone;
     that way `w` keeps meaning "this drawing's real width" and the set stays
     in proportion however far it is taken up or down. */
  const SQUIGGLE_SCALE = 0.85;
  /* How far a note is held off its drawing, as a fraction of the drawing's
     width — so the spacing stays proportionate across doodles of different
     sizes instead of being the same handful of pixels for all of them. A note
     can set its own `gap` where the drawing's shape asks for it — a
     flat-bottomed block reads as adrift at the same distance that suits a
     ragged one. */
  const SQUIGGLE_NOTE_GAP = 0.17;
  /* The boil: how far the line is pushed, how many drawings it cycles
     through, and how long each is held. Twelve holds at 80ms is about twelve
     drawings a second — near the rate traditional animation runs on ones. */
  const BOIL_THROW = 3.6;
  const BOIL_FRAMES = 12;
  const BOIL_HOLD = 80;
  const BOIL_DRIFT = 19;   // added per doodle, so their beats separate
  /* Positions read off the design: `x`/`y` place the doodle's centre as a
     percentage of the page, and `w` is the artwork's own viewBox width, so
     each draws at the size it was made at; SQUIGGLE_SCALE moves the set.

     The note hangs off its doodle rather than off the page, and what is
     specified is the *gap* between them, not the distance between their
     centres. Centres are the wrong thing to hold fixed: the distance between
     them is the gap plus half of each box, so two pairs at the same centre
     distance sit at visibly different gaps as soon as the drawings or the
     notes differ in size. Held that way, one note ended up overlapping its
     drawing while another sat twice as far off as it should.

     So `dx` (or `dy`, for a note set beside rather than below) places it
     along the drawing, and SQUIGGLE_NOTE_GAP holds it off the edge — as a
     fraction of the drawing's width, so a bigger drawing gets proportionally
     more air rather than the same few pixels.

     Crucially that is the width of the *drawing*, not of the SVG it arrived
     in: these exports carry loose bounds — the blob's line covers 87% of its
     box across and 72% down — so measuring from the box pushed every note
     further out than the design has it, by a different amount each time.

     `tilt` is degrees; the notes are hand-placed, so none of them is quite
     level. Line breaks are as drawn, not left to wrapping.

     They take turns rather than appearing together, so the order here is the
     order you see them in, and consecutive entries sit on opposite sides —
     each arrival lands somewhere the last one was not. */
  const SQUIGGLES = [
    {
      art: 'blob', x: 11.5, y: 66.0, w: 126,
      note: { dx: -0.09, tilt: 5.05, gap: 0.10,
        lines: ['in goopyland everything', 'will have three eyes'] },
    },
    {
      art: 'fist', x: 86.9, y: 65.2, w: 118,
      note: { dx: 0.29, tilt: -12, gap: 0.05,
        lines: ['designing', 'truth to power'] },
    },
    {
      art: 'cassette', x: 23.1, y: 80.5, w: 132,
      note: { dx: 0.06, tilt: -5, gap: 0.04,
        lines: ['someone burn me a', 'mixtape of their', 'experiences'] },
    },
    {
      art: 'packet', x: 74.8, y: 80.2, w: 105,
      note: { dy: 0.36, beside: true, tilt: -7,
        lines: ['bittersweet =', 'life is good'] },
    },
  ];

  /* Objects propped around the canvas, placed the same way. `art` is which
     one it is currently showing; the chip on each cycles through the set, so
     swapping the placeholders is a click rather than an edit. */
  /* Each object has two states in one shared frame: `-01` at rest, `-02`
     under the pointer. `x`/`y` place the frame's centre, not the object's —
     for the spray can they are not the same point, because its frame has to
     leave room for a plume that only exists in the second state. */
  const PROP_ART = ['spraycan', 'postbox'];
  const PROPS = [
    { art: 'spraycan', x: 17.4, y: 71.9, w: 132 },
    { art: 'postbox',  x: 88.8, y: 59.4, w: 147 },
  ];

  const GRAFFITI = [
    { splat: 'scribble', x: 8.0,  y: 9.3,  delay: 0 },
    { splat: 'smiley',   x: 92.5, y: 93.3, delay: 620 },
  ];

  const FRAME_AT = 600;   // the frame size the Figma artwork was placed against

  /* --------------------------------------------------------------- setup */
  const root = document.documentElement;
  const stage = document.querySelector('[data-stage]');
  const strip = document.querySelector('[data-strip]');
  const slides = Array.from(strip.querySelectorAll('.slide'));
  const positions = slides.map((s) => Number(s.dataset.offset));
  const frameImg = document.querySelector('[data-frame]');
  const cursor = document.querySelector('[data-cursor]');
  const caption = document.querySelector('[data-caption]');
  const announce = document.querySelector('[data-announce]');

  const splatSource = document.querySelector('[data-splats]');
  const graffitiLayer = document.querySelector('[data-graffiti]');
  const squiggleLayer = document.querySelector('[data-squiggles]');
  const propLayer = document.querySelector('[data-props]');

  const field = {
    eyebrow: document.querySelector('[data-eyebrow]'),
    title: document.querySelector('[data-title]'),
    body: document.querySelector('[data-body]'),
    visit: document.querySelector('[data-visit]'),
    current: document.querySelector('[data-counter-current]'),
    total: document.querySelector('[data-counter-total]'),
  };

  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');

  let index = 0;
  let frameIndex = 0;
  let shift = 0;         // current carousel offset, in slots
  let swiping = false;   // a swipe owns the strip; scroll reads are suspended

  /* ------------------------------------------------------------- helpers */
  const wrap = (i) => ((i % PROJECTS.length) + PROJECTS.length) % PROJECTS.length;
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const pad = (n) => String(n).padStart(2, '0');

  /* A pure function of distance from centre. The current work is at full
     opacity and everything else falls back to 15%. It interpolates, so a
     scroll or a drag passes through the in-between states instead of snapping
     at a threshold.

     Colour drains with distance too, so the shelf reads as context. */
  const nearness = (offset) => Math.max(0, 1 - Math.abs(offset));

  /* Solo is a straight linear dissolve — the pair either side of any position
     sum to 1, so the aperture stays evenly filled all the way across. Shelf
     never lets a neighbour reach zero: they are meant to be seen. */
  const opacityAt = (offset) =>
    SHELF ? inactiveOpacity + (1 - inactiveOpacity) * nearness(offset) : nearness(offset);

  const saturationAt = (offset) =>
    inactiveSaturate + (1 - inactiveSaturate) * nearness(offset);

  /* Measured, not read from tokens, so it stays correct across breakpoints. */
  /* Shelf has a real pitch to travel; solo stacks the works, so a drag is
     read against the width of one instead. */
  const slotPitch = () => (slides[1].offsetLeft - slides[0].offsetLeft) || 1;
  const dragSpan = () => (SHELF ? slotPitch() : slides[0].getBoundingClientRect().width) || 1;

  /* Pixels a work can shift before its edge enters the opening: half the
     difference between the art and the aperture, at the current frame. */
  const edgeSlack = () => parseFloat(getComputedStyle(root).getPropertyValue('--art-slack')) || 0;

  const ms = (name) => {
    if (calm.matches) return 0;
    return parseFloat(getComputedStyle(root).getPropertyValue(name)) || 0;
  };

  /* The artwork is a fixed square, so a frame only fits if its opening is
     smaller than that square in both directions. Cheap to check, and the
     alternative is a sliver of page showing through the aperture on one
     project and not another. */
  function checkFrames() {
    const half = ART_FRACTION / 2;
    const artTop = ART_CY - half;
    const artBottom = ART_CY + half;

    FRAMES.forEach(({ name, opening: o }) => {
      const left = o.cx - o.w / 2;
      const right = o.cx + o.w / 2;
      if (left < 0.5 - half || right > 0.5 + half) {
        console.warn(
          `frame "${name}": the opening spans ${left.toFixed(4)}–${right.toFixed(4)} `
          + `across but the artwork only covers ${(0.5 - half).toFixed(4)}–`
          + `${(0.5 + half).toFixed(4)} — it will show a gap at one side.`
        );
      }
      /* The work no longer follows the window, so a window cut high or low
         enough can run past the fixed square even when it is small enough to
         fit. Both edges have to be inside it. */
      const top = o.cy - o.h / 2;
      const bottom = o.cy + o.h / 2;
      if (top < artTop || bottom > artBottom) {
        console.warn(
          `frame "${name}": the opening spans ${top.toFixed(4)}–${bottom.toFixed(4)} `
          + `but the artwork only covers ${artTop.toFixed(4)}–${artBottom.toFixed(4)} `
          + `— it will show a gap top or bottom. Move ART_CY, or crop the window.`
        );
      }
    });
  }

  /* Where a project's pictures live. A project with `shots` keeps them in a
     folder of its own and cycles through them while it is the one on show;
     one without has a single file and simply sits there. Adding a set to
     another project is a folder and one number.

     The files are usually named after the slug, but not always — whatever
     exports David AI's set drops the hyphen — so `stem` lets a project say
     what its files are actually called. Better than renaming on every export,
     which is a step that gets forgotten and fails silently as a 404. */
  const artList = (p) => (p.shots
    ? Array.from({ length: p.shots }, (_, i) =>
        `../assets/works/${p.slug}/${p.stem || p.slug}-asset-${String(i + 1).padStart(2, '0')}.png`)
    : [`../assets/works/${p.slug}.png`]);

  let shotTimer = null;

  /* Cuts rather than crossfades: the pictures are stills of one piece of work,
     and at this speed a blend would just read as mud. Restarted on every
     project change so each one begins at its first frame. */
  /* Which picture a slide is on. Kept per slide rather than globally: the
     sets are different lengths — Colosseum has three where the rest have five
     — and one shared counter would drag them into lockstep and make the
     shorter ones jump. */
  const shotOf = (slide) => Number(slide.dataset.shot) || 0;

  /* Put the incoming picture on the hidden layer and flip which one is lit,
     in the same frame. Which layer is live is tracked here rather than read
     back off the class — the class is what we are about to change. */
  function showShot(slide, src) {
    const layers = slide.querySelectorAll('.shot');
    if (layers.length < 2) return;
    const front = slide.shotFront || layers[0];
    const back = front === layers[0] ? layers[1] : layers[0];
    if (front.getAttribute('src') === src) return;

    back.setAttribute('src', src);
    slide.shotFront = back;
    layers.forEach((l) => l.classList.toggle('is-on', l === back));
  }

  function advance(slide, project) {
    const list = artList(project);
    if (list.length < 2) return;
    const next = (shotOf(slide) + 1) % list.length;
    slide.dataset.shot = next;
    showShot(slide, list[next]);
  }

  /* Two clocks, and only ever one of them running. At rest the shelf either
     side flicks through its work while the current project holds still — it is
     the one being read. Put the pointer on the frame and that reverses: the
     work you are looking at starts moving and the rest go quiet, so nothing
     competes with it. */
  function retimeShots() {
    clearInterval(shotTimer);
    shotTimer = null;
    if (calm.matches) return;

    const onFrame = stage.dataset.near === 'true';
    shotTimer = setInterval(() => {
      slides.forEach((slide, k) => {
        const centre = positions[k] === 0;
        if (centre !== onFrame) return;         // the other set holds
        advance(slide, PROJECTS[wrap(index + positions[k])]);
      });
    }, ms('--work-cycle') || 800);
  }

  /* Everything back to its first picture — the one that reads as the project. */
  function restShots() {
    slides.forEach((slide, k) => {
      slide.dataset.shot = 0;
      showShot(slide, artList(PROJECTS[wrap(index + positions[k])])[0]);
    });
  }

  /* Assign each slot the work that belongs at its position. */
  function paint(base) {
    slides.forEach((slide, k) => {
      const project = PROJECTS[wrap(base + positions[k])];
      const list = artList(project);
      showShot(slide, list[shotOf(slide) % list.length]);
      const front = slide.querySelector('.shot.is-on');
      const centre = positions[k] === 0;
      if (front) {
        front.alt = centre ? `${project.title} — ${project.eyebrow}` : '';
        front.removeAttribute('aria-hidden');
      }
    });
  }

  /* The whole visual state of the carousel, from one number. */
  function render(next) {
    shift = next;
    const slack = edgeSlack() * DRIFT;
    if (SHELF) strip.style.setProperty('--shift', `${-next * slotPitch()}px`);

    slides.forEach((slide, k) => {
      const offset = positions[k] - next;
      /* On the slide, not on the picture: the two shot layers inside it need
         their own opacities to cross-dissolve. */
      slide.style.opacity = opacityAt(offset);
      if (SHELF) {
        /* The strip carries them; each work stays put inside it. Drained of
           colour with distance as well as dropped in opacity, so the shelf
           reads as context rather than as six competing logos. */
        slide.style.filter = `saturate(${saturationAt(offset)})`;
        slide.style.transform = '';
        slide.style.zIndex = '';
      } else {
        /* A little travel in the direction of the move, clamped to the slack
           so the picture drifts under the frame rather than past it. */
        slide.style.transform = `translateX(${clamp(offset, -1, 1) * slack}px)`;
        /* Whichever work is nearest sits on top, so the dissolve looks the
           same going forwards as it does going back. */
        slide.style.zIndex = Math.round(nearness(offset) * 100);
      }
      slide.dataset.state = Math.abs(offset) < 0.5 ? 'current' : 'inactive';
    });
  }

  /* ----------------------------------------------------------- highlighter */
  /* A marker stroke drawn across the title. Built to the words' real box each
     time rather than stretched from one shape: a single path scaled to fit
     would shear its own thickness as the titles change length, so "Reducto"
     and "Orchestra Bio" would wear visibly different pens. */
  const markerSvg = document.querySelector('[data-marker]');
  const markerPath = document.querySelector('[data-marker-path]');
  const grain = document.querySelector('[data-grain]');
  const grainMap = document.querySelector('[data-grain-map]');

  /* Deterministic, so a project always gets the same stroke — the variation
     should read as several different pen strokes, not as a shuffle. An
     xorshift rather than a plain LCG: consecutive seeds through an LCG give
     near-consecutive first outputs, so every project came out wearing almost
     the same pen. */
  const wobble = (seed) => {
    let n = (seed * 2654435761) >>> 0 || 1;
    return () => {
      n ^= n << 13; n >>>= 0;
      n ^= n >>> 17;
      n ^= n << 5;  n >>>= 0;
      return n / 4294967296;
    };
  };

  function drawMarker(i) {
    if (!markerSvg || !markerPath) return;
    const text = field.title;
    const w = text.offsetWidth;
    const h = text.offsetHeight;
    if (!w || !h) return;

    /* Placed against the letters, not the box. An inline span is taller than
       its ink — the font's ascent and descent both count — so measuring from
       the top would float the stroke somewhere above the words. The baseline
       is where a real highlighter is aimed. */
    const cs = getComputedStyle(text);
    const gauge = document.createElement('canvas').getContext('2d');
    gauge.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const m = gauge.measureText(text.textContent || 'Hg');
    const baseline = m.fontBoundingBoxAscent || h * 0.8;
    const cap = m.actualBoundingBoxAscent || h * 0.5;

    const rnd = wobble(i + 1);
    /* Two passes of a chisel nib rather than one stroke — the reference is a
       pair of bars, offset from each other at both ends, which is what a
       marker leaves when it goes over the same words twice. They are two
       subpaths of one path, so the draw runs through the first and then the
       second: one pass, then the second laid over it. */
    const band = cap * (0.86 + rnd() * 0.10);        // both passes together
    /* Each pass takes a little over four tenths of the band, so the two never
       meet: a gap runs the length of the stroke between them, the way the
       Rom-com nib leaves a dry line down the middle of its swipe. The grain
       then makes that gap wander and pinch instead of running parallel. */
    const bar = band * (0.41 + rnd() * 0.04);        // each pass's thickness
    const top = baseline - cap * (0.74 + rnd() * 0.08) + bar / 2;
    const bot = top - bar + band;                    // the pair spans `band`
    const reach = cap * (0.80 + rnd() * 0.55);       // how far past the words
    /* Opposite tilts, so the seam closes at one end and opens at the other. */
    const tilt = (rnd() - 0.5) * cap * 0.09;

    /* Figma's "Rom-com" is a stretch brush: it undulates along its path
       rather than running straight, and that wave is the whole character of
       it. Both passes ride the same wave so the band travels as a unit and
       stays over the letters — only their phase differs slightly, which is
       what lets the gap between them open and close along the way. */
    const waves = 0.75 + rnd() * 0.55;               // crests across the word
    const amp = bar * (0.16 + rnd() * 0.12);         // how far it swings
    const phase = rnd() * Math.PI * 2;

    /* Catmull-Rom through the samples, converted to cubics. Sampling a sine
       and smoothing it is far less fiddly than fitting beziers to one, and at
       this size the two are indistinguishable. */
    const curve = (pts) => {
      let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
      for (let k = 0; k < pts.length - 1; k += 1) {
        const p0 = pts[k - 1] || pts[k];
        const p1 = pts[k];
        const p2 = pts[k + 1];
        const p3 = pts[k + 2] || pts[k + 1];
        const c1x = p1[0] + (p2[0] - p0[0]) / 6;
        const c1y = p1[1] + (p2[1] - p0[1]) / 6;
        const c2x = p2[0] - (p3[0] - p1[0]) / 6;
        const c2y = p2[1] - (p3[1] - p1[1]) / 6;
        d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)}`
           + ` ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
      }
      return d;
    };

    const pass = (y, left, right, lean, skew) => {
      const x0 = -left;
      const span = w + right - x0;
      const pts = [];
      for (let k = 0; k <= 16; k += 1) {
        const t = k / 16;
        pts.push([
          x0 + span * t,
          y + lean * t + amp * Math.sin(phase + skew + t * waves * Math.PI * 2),
        ]);
      }
      return curve(pts);
    };
    /* The upper pass runs long to the right and the lower one long to the
       left, so the ends step rather than stopping square together. */
    const d = [
      pass(top, reach * (0.45 + rnd() * 0.35), reach * (0.75 + rnd() * 0.45), tilt, 0),
      pass(bot, reach * (0.75 + rnd() * 0.45), reach * (0.45 + rnd() * 0.35), -tilt, 0.45),
    ].join(' ');

    /* A fresh noise field per project. Same bars, different wear — the grain
       is what separates a dry marker from a rectangle. */
    if (grain) {
      grain.setAttribute('seed', String(1 + Math.floor(rnd() * 900)));
      grain.setAttribute('baseFrequency', `${(0.09 + rnd() * 0.06).toFixed(3)} ${(0.55 + rnd() * 0.35).toFixed(2)}`);
    }
    if (grainMap) grainMap.setAttribute('scale', (bar * 0.3).toFixed(1));

    markerPath.style.stroke = PROJECTS[i].marker || 'var(--color-marker)';
    markerSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    markerPath.setAttribute('d', d);
    markerPath.setAttribute('pathLength', '1');
    markerPath.style.strokeWidth = `${bar.toFixed(1)}`;
  }

  /* Restarting an animation means taking the class off, letting the style
     settle, and putting it back. */
  function markTitle(i) {
    const title = document.querySelector('.caption__title');
    if (!title) return;
    title.classList.remove('is-marking');
    drawMarker(i);
    void title.offsetWidth;
    title.classList.add('is-marking');
  }

  let swapTimer = null;

  function showProject(i) {
    const project = PROJECTS[i];
    restShots();
    retimeShots();
    clearTimeout(swapTimer);
    caption.classList.add('is-swapping');
    swapTimer = setTimeout(() => {
      field.eyebrow.textContent = project.eyebrow;
      field.title.textContent = project.title;
      markTitle(i);
      /* Set here rather than in `drawMarker`, which also runs on resize —
         this only has to change when the project does. */
      root.style.setProperty('--color-select', project.marker);
      field.body.textContent = project.body;
      field.visit.href = project.href;
      field.current.textContent = pad(i + 1);
      announce.textContent = `${project.title}, ${i + 1} of ${PROJECTS.length}`;
      caption.classList.remove('is-swapping');
    }, ms('--duration-swap-out'));
  }

  /* ------------------------------------------------------------- scroll */
  /* Scroll position is the single source of truth. Each project owns one
     100dvh step, and `scroll-snap-type: y mandatory` supplies the magnet —
     the browser pulls the nearest step into place on its own. All this code
     does is read where the scroll got to and turn it into `shift`, which
     means the strip tracks a trackpad continuously rather than jumping when
     the snap lands.

     Two extra buffer steps, one at each end, are what let it wrap. */
  const STEPS = PROJECTS.length + 2;
  let lastHeight = 0;
  let firstStep = null;

  /* Measured off a real step rather than taken from `window.innerHeight`.
     The steps are laid out in `100dvh`, and the two are not always the same
     number — browsers with auto-hiding chrome resolve `dvh` against a
     different height. Dividing by the wrong one puts every snap point
     slightly off, the error accumulates with each step, and the strip ends up
     resting between two works: the current one hangs past the frame's edge
     and reads as sitting on top of it. */
  const stepSize = () => (firstStep && firstStep.getBoundingClientRect().height)
    || window.innerHeight;
  /* Step 0 is the leading buffer, so project i sits on step i + 1. */
  const stepFor = (i) => (i + 1) * stepSize();

  function buildSteps() {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < STEPS; i += 1) {
      const step = document.createElement('div');
      step.className = 'scroll-step';
      step.setAttribute('aria-hidden', 'true');
      frag.appendChild(step);
    }
    document.body.appendChild(frag);
    firstStep = document.querySelector('.scroll-step');
  }

  /* CSS sizes the frame and the artwork; only the gap needs measuring, since
     a percentage gap would resolve against the strip's own width. Watching
     the frame rather than the stage matters: the stage is `flex: 1 1 0` and
     so never changes size, which means an observer on it would fire once and
     never again. */
  /* The frame is whatever height the caption leaves it, so the caption has to
     be the same height on every project or the frame changes size as you move.
     Reserve the tallest description; re-measure when the width changes, since
     that changes how the copy wraps. */
  function reserveCaption() {
    const body = field.body;
    const held = body.textContent;
    body.style.height = 'auto';
    let tallest = 0;
    PROJECTS.forEach((project) => {
      body.textContent = project.body;
      tallest = Math.max(tallest, body.scrollHeight);
    });
    body.textContent = held;
    body.style.height = '';
    root.style.setProperty('--body-reserve', `${tallest}px`);
  }

  function fitSlides() {
    /* Layout geometry, not painted geometry. `getBoundingClientRect` folds in
       the lens's hover scale, and feeding that back into `--art-w` would grow
       the artwork a little more every time the pointer arrived. `offset*` is
       the box before any transform, so hovering cannot move these numbers.
       They are measured against the lens, which spans the stage exactly. */
    const size = frameImg.offsetWidth;
    if (!size) return;
    const frameTop = frameImg.offsetTop;
    const open = FRAMES[frameIndex].opening;

    /* Constant across frames — only where it sits follows the opening. */
    const side = size * ART_FRACTION;
    root.style.setProperty('--art-w', `${side}px`);
    root.style.setProperty('--art-h', `${side}px`);
    /* A fixed point inside the stage — the same one whatever frame is on, so
       switching frames never moves the picture. */
    root.style.setProperty('--art-cy', `${frameTop + size * ART_CY}px`);
    /* How far the work can travel before an edge enters the opening. The
       tighter of the two sides, because a window is not necessarily cut on
       the frame's centre line — taking half the difference in widths would
       overshoot on whichever side is closer and show a sliver mid-drift. */
    const halfArt = ART_FRACTION / 2;
    const leftRoom  = (open.cx - open.w / 2) - (0.5 - halfArt);
    const rightRoom = (0.5 + halfArt) - (open.cx + open.w / 2);
    root.style.setProperty('--art-slack', `${size * Math.min(leftRoom, rightRoom)}px`);
    root.style.setProperty('--slide-gap', `${size * GAP_RATIO}px`);
    /* How far the frame's centre sits below the work's. The hover lift scales
       both about the frame's centre, so the picture cannot slide inside the
       window as it grows — and the works either side, which are not scaled at
       all, are left out of it entirely. */
    root.style.setProperty('--art-origin-y', `${size * (0.5 - ART_CY)}px`);
    /* Where the frame's bottom edge falls inside the stage — the frame
       switch straddles it. */
    root.style.setProperty('--frame-b', `${frameTop + frameImg.offsetHeight}px`);
  }

  function readScroll() {
    /* A swipe drives the strip directly and hands the result back to the
       scroll position when it ends. Until then, scroll is not the truth. */
    if (swiping) return;

    /* A step of zero means nothing has been laid out yet — a hidden or
       zero-height viewport. Dividing by it yields NaN, which walks straight
       through Math.round and wrap() into an out-of-range project lookup.
       Bail: the next scroll or resize re-runs this with real numbers. */
    const step = stepSize();
    if (!step) return;

    let raw = window.scrollY / step;

    /* Landed on a buffer step: jump a whole lap. Everything on screen is a
       function of position modulo the list length, so nothing changes
       visually — only scrollTop does.

       Only once the scroll has actually arrived, though. `raw` crosses into
       the buffer half a step before it gets there, and jumping then lands an
       instant `scrollTo` in the middle of the smooth one still running —
       which cancels it, stranding the page mid-step until snap tidies up.
       That is the judder on wrapping from the first project to the last.
       Waiting for the position to settle keeps the animation intact, and the
       teleport that follows is invisible.

       Done inline and re-read rather than by calling back into this
       function. Snap can adjust a programmatic scroll after the fact, and
       the document clamps at the last step, so the jump is not guaranteed to
       land in range; recursing on it can run away. Worst case here is one
       frame at a clamped position, corrected on the next scroll event. */
    const settled = Math.abs(raw - Math.round(raw)) < 0.02;
    if (settled) heading = null;

    if (settled && (raw < 0.5 || raw > PROJECTS.length + 0.5)) {
      const lap = raw < 0.5 ? PROJECTS.length : -PROJECTS.length;
      window.scrollTo({ top: window.scrollY + lap * step, behavior: 'instant' });
      raw = window.scrollY / step;
      heading = null;               // the lap moved the ground under it
    }

    const pos = raw - 1;                  // position in project space
    const nearest = Math.round(pos);
    /* Sub-pixel snap positions can leave a hair of offset. Treat anything
       this close to a step as exactly on it, so at rest the current work is
       always dead centre in the frame. */
    const frac = Math.abs(pos - nearest) < 0.01 ? 0 : pos - nearest;
    if (wrap(nearest) !== index) {
      index = wrap(nearest);
      paint(index);
      showProject(index);
    }
    /* Rebasing at the halfway point is invisible: the slot that lands at a
       given screen position afterwards carries the same work at the same
       opacity as the one that just left it. */
    render(frac);
  }

  /* Buttons, keys and clicks move the scroll and let it drive the visuals —
     never both, or they would fight over `shift`. */
  /* The step a smooth scroll is currently travelling towards, or null once it
     has arrived. Counting from here rather than from `scrollY` matters when a
     second move starts before the first has landed: mid-flight the position
     is between two steps, and rounding it can name either one — so the move
     either doubles up or goes nowhere. */
  let heading = null;

  const go = (dir) => {
    const step = stepSize();
    if (!step) return;
    const from = heading === null ? Math.round(window.scrollY / step) : heading;
    heading = from + dir;
    window.scrollTo({
      top: heading * step,
      behavior: calm.matches ? 'instant' : 'smooth',
    });
  };

  /* -------------------------------------------------------------- cursor */
  /* Which way a click will go: whichever half of the page you're on. */
  const dirAt = (clientX) => (clientX < window.innerWidth / 2 ? 'prev' : 'next');

  function moveCursor(e) {
    cursor.style.transform =
      `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
    cursor.dataset.dir = dirAt(e.clientX);
  }

  stage.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse' || !fine.matches) return;
    moveCursor(e);
    cursor.classList.add('is-visible');
  });

  stage.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !fine.matches) return;
    moveCursor(e);
  });

  stage.addEventListener('pointerleave', () => {
    cursor.classList.remove('is-visible');
  });

  /* -------------------------------------------------------------- swipe */
  /* Vertical is the browser's — `touch-action: pan-y` on the stage means a
     vertical drag scrolls (and cancels this gesture), while a horizontal one
     never pans and arrives here instead. Swipe left for the next project,
     right for the previous, matching the way the shelf travels. */
  let dragId = null;
  let startX = 0;
  let startY = 0;
  let axis = null;           // null until the gesture commits to one
  let draggedAt = -Infinity; // when a swipe last ended, to disown its click

  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    axis = null;
  });

  window.addEventListener('pointermove', (e) => {
    if (e.pointerId !== dragId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (axis === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (axis !== 'x') return;
      swiping = true;
      strip.classList.remove('is-settling');
      /* Throws if the pointer is already gone — survivable, and letting it
         escape would abandon the gesture midway. */
      try { stage.setPointerCapture(dragId); } catch { /* not fatal */ }
      cursor.classList.add('is-dragging');
    }
    if (axis !== 'x') return;

    e.preventDefault();
    render(clamp(-dx / dragSpan(), -1, 1));
  }, { passive: false });

  /* Hand the gesture back to the scroll position, which is the resting
     source of truth. The scroll jump is instant and lands on a real snap
     point, so mandatory snap has nothing to argue with; the strip is rebased
     onto the new project at the same screen position it already occupied and
     then glides the remainder. Nothing jumps. */
  function endSwipe(cancelled) {
    if (dragId === null) return;
    const swiped = axis === 'x';
    dragId = null;
    axis = null;
    cursor.classList.remove('is-dragging');
    if (!swiped) return;

    draggedAt = performance.now();
    const target = cancelled ? 0 : (shift > 0.2 ? 1 : (shift < -0.2 ? -1 : 0));

    if (target !== 0) {
      const step = stepSize() || 1;
      const here = Math.round(window.scrollY / step);
      window.scrollTo({ top: (here + target) * step, behavior: 'instant' });
      index = wrap(index + target);
      paint(index);
      showProject(index);
      render(shift - target);   // same pixels, new base
    }

    settleToRest();
  }

  /* Glide whatever offset is left back to zero and hand control to the scroll
     position, which is the resting source of truth.

     The reflow commits any rebase before the transition is armed — otherwise
     it animates from the pre-rebase value, which with the slots already
     repainted sweeps through positions that were never correct. A forced
     reflow rather than a rAF, because a backgrounded tab gets no frames and
     the flags would stay set for as long as the tab stayed hidden. */
  function settleToRest() {
    void strip.offsetWidth;
    strip.classList.add('is-settling');
    render(0);

    const done = () => {
      strip.removeEventListener('transitionend', done);
      clearTimeout(fallback);
      strip.classList.remove('is-settling');
      swiping = false;
      window.scrollTo({ top: stepFor(index), behavior: 'instant' });
      readScroll();
    };
    /* Timers still run when transitions don't, so this is the guarantee. */
    const fallback = setTimeout(done, ms('--duration-settle') + 200);
    strip.addEventListener('transitionend', done);
  }

  window.addEventListener('pointerup', () => endSwipe(false));
  window.addEventListener('pointercancel', () => endSwipe(true));

  /* ------------------------------------------------------------- clicks */
  stage.addEventListener('click', (e) => {
    if (performance.now() - draggedAt < 300) return;
    go(dirAt(e.clientX) === 'prev' ? -1 : 1);
  });

  document.querySelectorAll('[data-nav]').forEach((button) => {
    button.addEventListener('click', () => go(button.dataset.nav === 'prev' ? -1 : 1));
  });

  /* ------------------------------------------------------- frame switch */
  const framer = document.querySelector('[data-framer]');

  framer.addEventListener('click', (e) => {
    /* The stage turns a click into prev/next, and this one is neither. */
    e.stopPropagation();
    /* The switch rides under the cursor, so a swipe that ends over the frame
       releases on top of it. Same guard the stage uses: a click that closes a
       drag is not a click. */
    if (performance.now() - draggedAt < 300) return;
    frameIndex = (frameIndex + 1) % FRAMES.length;
    frameImg.src = `../assets/frames/${FRAMES[frameIndex].name}.png`;
    fitSlides();          // a different opening, but the same artwork size
  });

  /* pointerdown deliberately passes through: the switch covers the cursor
     whenever it is over the frame, and swallowing the press here would mean
     no swipe could ever start on the artwork. */

  /* The switch shows while the pointer is touching the frame — its own box,
     so it tracks whatever size the stage has left it — and is carried to
     wherever the pointer is. Mouse only: a touchscreen has no pointer to
     follow, and the CSS pins it under the frame there instead. */
  const setNear = (on) => {
    const changed = on !== (stage.dataset.near === 'true');
    stage.dataset.near = on ? 'true' : 'false';
    if (changed) { restShots(); retimeShots(); }
    /* The arrow cursor lives outside `.page`, out of reach of a selector
       rooted at the stage, so the flag goes somewhere both can see it. */
    root.dataset.onFrame = on ? 'true' : 'false';
  };

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !fine.matches) return;
    const r = frameImg.getBoundingClientRect();
    const on = e.clientX >= r.left && e.clientX <= r.right &&
               e.clientY >= r.top  && e.clientY <= r.bottom;
    if (on) {
      root.style.setProperty('--framer-x', `${e.clientX}px`);
      root.style.setProperty('--framer-y', `${e.clientY}px`);
    }
    setNear(on);
  }, { passive: true });

  /* Leaving the window leaves the pointer nowhere near anything. */
  document.addEventListener('pointerleave', () => setNear(false));

  /* The bracketed letter on each control is its key. Rather than repeat what
     the control does, the key clicks the control — so the two can never drift
     apart, and the anchors keep their own target and rel. */
  const KEYS = {
    o: framer,
    x: document.querySelector('[data-key="x"]'),
    c: document.querySelector('[data-key="c"]'),
  };

  /* A free-spinning wheel throws a long tail of momentum events, and every
     one of them moves the scroll position — which is the source of truth
     here, so the snap is re-aimed before it can ever settle and the whole
     thing judders. So the wheel is taken over rather than left to the
     browser: one gesture, one project, and the tail is ignored until the
     move has had time to land.

     `passive: false` because this has to be able to preventDefault; without
     it the browser scrolls underneath us as well as us moving. */
  /* How long the wheel has to be quiet before another gesture can register.
     A flick's momentum arrives as a continuous stream — events milliseconds
     apart — so any gap this long means the hand has finished and the tail has
     died. Waiting on silence rather than on a fixed cooldown is what makes
     one flick one project however hard it is thrown: a hard flick simply has
     a longer tail, and a fixed timer expires in the middle of it. */
  const WHEEL_QUIET = 140;
  let wheelArmed = true;
  let wheelIdle = null;

  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) return;          // pinch-zoom is the browser's, not ours
    e.preventDefault();

    /* Every event pushes the re-arm further out, tail included. */
    clearTimeout(wheelIdle);
    wheelIdle = setTimeout(() => { wheelArmed = true; }, WHEEL_QUIET);

    if (!wheelArmed) return;

    /* Trackpads and tilt wheels put the travel on whichever axis they like. */
    const travel = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(travel) < 2) return;

    wheelArmed = false;
    go(travel > 0 ? 1 : -1);
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^(input|textarea|select)$/i.test(e.target.tagName || '')) return;
    if (e.target.isContentEditable) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }

    const target = KEYS[e.key.toLowerCase()];
    if (target) { e.preventDefault(); target.click(); }
  });

  /* Clone each splat out of the template and place it. Cloning rather than
     writing the artwork straight into the stage keeps the markup readable,
     and the animation starts when the node is inserted. */
  function placeGraffiti() {
    if (!SHOW_GRAFFITI || !splatSource || !graffitiLayer) return;
    GRAFFITI.forEach((spot) => {
      const art = splatSource.content.querySelector(`[data-splat="${spot.splat}"]`);
      if (!art) return;
      const svg = art.cloneNode(true);
      const width = Number(svg.getAttribute('width')) || 0;
      svg.style.setProperty('--x', `${spot.x}%`);
      svg.style.setProperty('--y', `${spot.y}%`);
      svg.style.setProperty('--w', `${(width / FRAME_AT) * 100}%`);
      svg.style.setProperty('--splat-delay', `${spot.delay}ms`);
      graffitiLayer.appendChild(svg);
    });
  }

  /* ------------------------------------------------------------- backdrop */
  /* A band of cloud along the bottom edge, redrawn as blue-noise dither,
     matching the Figma plugin: 8 levels, brightness 200%, contrast 0.6, mono.

     Why redraw it rather than filter it in CSS: dithering is a *quantisation*,
     not a colour transform. Every pixel has to be pushed to one of 8 levels
     against a threshold that varies per pixel, and no stack of CSS filters can
     do that. So the image goes through a canvas at one pixel per dot.

     The canvas is sized in dots, not device pixels, and CSS scales it up with
     `image-rendering: pixelated` — dithering at full resolution and shrinking
     would average the dots away, which is exactly what dithering is for. */
  const BACKDROP_LEVELS = 8;        // the plugin's Levels
  const BACKDROP_BRIGHT = 2.0;      // the plugin's Brightness, 200%
  const BACKDROP_CONTRAST = 0.6;    // the plugin's Contrast
  const BACKDROP_FPS = 15;          // clouds drift slowly; 60 buys nothing
  /* Motion is two things at once. A steady lateral drift moves the whole
     field, which is what actually reads as weather passing; on its own the
     warp only sways the tiles in place and the sky goes nowhere. Both live in
     tokens — see --backdrop-pan. */
  const BACKDROP_MOTION_POLL = 500; // ms between re-reads, so ?tune stays live

  /* The source image is a *rendering* of the dither, not the footage it came
     from: its whole luminance range is about 0.84 to 0.91, because the pale
     result has already been baked in. Running brightness 200% over that clips
     every pixel to paper and nothing dithers at all.

     So the tone map is stretched back out first, onto the range the original
     footage occupied, and only then does the plugin's curve run. That is what
     makes the same settings produce the same picture from a second-generation
     source. An image that already spans this range comes through unchanged. */
  const BACKDROP_FLOOR = 0.47;
  const BACKDROP_CEIL = 0.95;
  const BACKDROP_TRIM = 0.005;      // ignore this tail at each end when measuring

  /* The source is dithered, so its pixels carry dot density rather than tone.
     Reading them straight gives a noisy tone map, and dithering noise produces
     speckle instead of cloud. Drawing it small first averages the dots back
     into the tone they stand for; scaling that back up is then a box blur of
     exactly the right radius to undo the source's own screen. */
  const BACKDROP_RESOLVE = 5;

  function startBackdrop() {
    const canvas = document.querySelector('[data-backdrop]');
    const noise = window.BLUE_NOISE;
    if (!canvas || !noise) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    /* Unpack the threshold tile once. Base64 to bytes to a 0..1 float per
       cell, so the inner loop is one array read and no arithmetic. */
    const bin = atob(noise.data);
    const NS = noise.size;
    const threshold = new Float32Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) threshold[i] = bin.charCodeAt(i) / 255;

    const ink = { r: 0x6d, g: 0x64, b: 0x50 };
    const source = new Image();
    let cloud = null;                 // adjusted luminance, mirrored, one per dot
    let toneW = 0;                    // its width — twice the canvas
    let frame = null;
    let mosaic = 4;
    let dots = { w: 0, h: 0 };
    let ready = false;
    const motion = { pan: 5, swell: 3.5, churn: 0.9 };
    let polled = -Infinity;

    /* Re-read twice a second rather than per frame: `getComputedStyle` forces
       a style resolution, and nobody drags a slider faster than that. */
    function readMotion(now) {
      if (now - polled < BACKDROP_MOTION_POLL) return;
      polled = now;
      motion.pan = readVar('--backdrop-pan', 5);
      motion.swell = readVar('--backdrop-swell', 3.5);
      motion.churn = readVar('--backdrop-churn', 0.9);
    }

    function readVar(name, fallback) {
      const v = parseFloat(getComputedStyle(root).getPropertyValue(name));
      return Number.isFinite(v) ? v : fallback;
    }

    function readInk() {
      const raw = getComputedStyle(root).getPropertyValue('--backdrop-ink').trim();
      const probe = document.createElement('canvas').getContext('2d');
      probe.fillStyle = raw || '#6d6450';
      const hex = probe.fillStyle;                   // normalised to #rrggbb
      ink.r = parseInt(hex.slice(1, 3), 16);
      ink.g = parseInt(hex.slice(3, 5), 16);
      ink.b = parseInt(hex.slice(5, 7), 16);
    }

    /* The tone map is built once per size, not per frame: brightness and
       contrast are fixed, so the only thing left for the loop is choosing
       where to sample and which level to land on. */
    function buildTone() {
      const { w, h } = dots;
      /* Cover-fit, anchored to the bottom: the image's weather sits along its
         lower edge, and that edge is the one meeting the page. Drawn at a
         fraction of the size first — see BACKDROP_RESOLVE. */
      const lw = Math.max(1, Math.round(w / BACKDROP_RESOLVE));
      const lh = Math.max(1, Math.round(h / BACKDROP_RESOLVE));
      const small = document.createElement('canvas');
      small.width = lw;
      small.height = lh;
      const smctx = small.getContext('2d');
      smctx.imageSmoothingQuality = 'high';

      const scale = Math.max(w / source.naturalWidth, h / source.naturalHeight)
        / BACKDROP_RESOLVE;
      const dw = source.naturalWidth * scale;
      const dh = source.naturalHeight * scale;
      smctx.drawImage(source, (lw - dw) / 2, lh - dh, dw, dh);

      const scratch = document.createElement('canvas');
      scratch.width = w;
      scratch.height = h;
      const sctx = scratch.getContext('2d', { willReadFrequently: true });
      sctx.imageSmoothingQuality = 'high';
      sctx.drawImage(small, 0, 0, w, h);

      const px = sctx.getImageData(0, 0, w, h).data;
      const base = new Float32Array(w * h);
      for (let i = 0, j = 0; j < base.length; i += 4, j += 1) {
        base[j] = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
      }
      const tone = base;

      /* Measure the source's own range off a histogram rather than min/max, so
         a handful of stray pixels cannot set the ends. */
      const bins = new Uint32Array(256);
      for (let j = 0; j < tone.length; j += 1) bins[(tone[j] * 255) | 0] += 1;
      const cut = tone.length * BACKDROP_TRIM;
      let lo = 0;
      let hi = 255;
      for (let seen = 0, k = 0; k < 256; k += 1) {
        seen += bins[k];
        if (seen > cut) { lo = k / 255; break; }
      }
      for (let seen = 0, k = 255; k >= 0; k -= 1) {
        seen += bins[k];
        if (seen > cut) { hi = k / 255; break; }
      }

      const span = hi - lo;
      const gain = span > 0.001 ? (BACKDROP_CEIL - BACKDROP_FLOOR) / span : 1;

      for (let j = 0; j < base.length; j += 1) {
        /* Stretched onto the footage's range, then the plugin's two
           adjustments in its own order: brightness scales, contrast pivots
           about mid grey. */
        const l = BACKDROP_FLOOR + (base[j] - lo) * gain;
        base[j] = (l * BACKDROP_BRIGHT - 0.5) * BACKDROP_CONTRAST + 0.5;
      }

      /* Doubled, with the second half mirrored, so the drift can run forever:
         at the join the two halves meet on the same column, so wrapping round
         is seamless. Repeating the image instead would drag a hard edge
         across the screen once a minute. */
      toneW = w * 2;
      cloud = new Float32Array(toneW * h);
      for (let y = 0; y < h; y += 1) {
        const from = y * w;
        const to = y * toneW;
        for (let x = 0; x < w; x += 1) {
          cloud[to + x] = base[from + x];
          cloud[to + toneW - 1 - x] = base[from + x];
        }
      }
    }

    function fit() {
      const size = readVar('--backdrop-size', 2);
      const box = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.ceil(box.width / size));
      const h = Math.max(1, Math.ceil(box.height / size));
      mosaic = Math.max(1, Math.round(readVar('--backdrop-mosaic', 4)));
      if (w === dots.w && h === dots.h && cloud) return;
      dots = { w, h };
      canvas.width = w;
      canvas.height = h;
      frame = ctx.createImageData(w, h);
      readInk();
      if (ready) buildTone();
    }

    /* One tile, one tone — but the tile samples from a drifting position, so
       the pattern swims instead of sitting still. Rows slide against columns
       rather than together, which keeps it from reading as a single pan. */
    function draw(t) {
      if (!cloud) return;
      const { w, h } = dots;
      const out = frame.data;
      const top = BACKDROP_LEVELS - 1;
      const swell = mosaic * motion.swell;
      const pan = t * motion.pan;
      const c = motion.churn;
      const tiles = Math.ceil(w / mosaic);
      const rows = Math.ceil(h / mosaic);

      /* Per tile, not per dot: the offsets are the expensive part and every
         dot in a tile shares them. Two waves per axis rather than one, at
         frequencies that do not divide into each other — a single sine reads
         as a pendulum, and clouds do not swing. */
      const at = new Int32Array(tiles * rows);
      for (let cy = 0; cy < rows; cy += 1) {
        for (let cx = 0; cx < tiles; cx += 1) {
          const ox = swell * (Math.sin(t * c * 0.31 + cy * 0.42)
                            + 0.5 * Math.sin(t * c * 0.53 + cx * 0.17));
          const oy = swell * 0.55 * (Math.cos(t * c * 0.27 + cx * 0.35)
                                   + 0.5 * Math.cos(t * c * 0.44 + cy * 0.23));
          const sx = Math.round(cx * mosaic + mosaic / 2 + ox + pan);
          let sy = Math.round(cy * mosaic + mosaic / 2 + oy);
          sy = sy < 0 ? 0 : sy >= h ? h - 1 : sy;
          at[cy * tiles + cx] = sy * toneW + (((sx % toneW) + toneW) % toneW);
        }
      }

      for (let y = 0, i = 0; y < h; y += 1) {
        const nrow = (y % NS) * NS;
        const trow = ((y / mosaic) | 0) * tiles;
        for (let x = 0; x < w; x += 1, i += 4) {
          const l = cloud[at[trow + ((x / mosaic) | 0)]];

          /* Quantise against the tile. Adding the threshold before rounding
             is the whole trick: a dot between two levels lands on the higher
             one only where the noise says so, and across an area the
             proportion that do is the fraction that was lost. */
          let level = Math.round(l * top + threshold[nrow + (x % NS)] - 0.5);
          if (level < 0) level = 0;
          else if (level > top) level = top;

          /* The light end is the page itself, so it stays transparent and
             only the dark end paints. */
          out[i] = ink.r;
          out[i + 1] = ink.g;
          out[i + 2] = ink.b;
          out[i + 3] = 255 - Math.round((level / top) * 255);
        }
      }
      ctx.putImageData(frame, 0, 0);
    }

    source.addEventListener('load', () => {
      ready = true;
      readMotion(0);
      buildTone();
      draw(0);                        // something on screen before the loop
    });
    source.src = '../assets/img/clouds.png';

    fit();
    addEventListener('resize', () => { cloud = null; fit(); });

    const still = matchMedia('(prefers-reduced-motion: reduce)');
    let last = 0;
    (function tick(now) {
      requestAnimationFrame(tick);
      if (document.hidden || !ready) return;
      if (still.matches) return;                  // the load-time frame stands
      if (now - last < 1000 / BACKDROP_FPS) return;
      last = now;
      readMotion(now);
      draw(now / 1000);
    })(0);
  }

  /* Fetched rather than inlined: three pencil doodles are 250KB of path data
     between them, which has no business sitting in the document. They are
     decoration, so arriving a moment late costs nothing — and every one is
     appended in the same pass, so a slow file cannot shuffle the order the
     pen draws them in. */
  async function placeSquiggles() {
    if (!SHOW_SQUIGGLES || !squiggleLayer) return;
    const art = await Promise.all(SQUIGGLES.map(async (spot) => {
      try {
        const res = await fetch(`../assets/squiggles/${spot.art}.svg`);
        return res.ok ? await res.text() : null;
      } catch {
        return null;      // a missing doodle is not worth breaking the page
      }
    }));

    const turns = [];
    art.forEach((markup, i) => {
      if (!markup) return;
      const spot = SQUIGGLES[i];
      const holder = document.createElement('div');
      holder.innerHTML = markup;
      const svg = holder.firstElementChild;
      if (!svg) return;
      svg.style.setProperty('--x', `${spot.x}%`);
      svg.style.setProperty('--y', `${spot.y}%`);
      svg.style.setProperty('--w', `${spot.w * SQUIGGLE_SCALE}px`);
      squiggleLayer.appendChild(svg);
      turns.push({ svg, spot, note: writeNote(spot, svg) });
    });

    boilSquiggles();

    /* Anchored again on resize. The notes are placed by measuring the drawing,
       and a layout where the drawing cannot be measured — the layer is
       `display: none` below the desktop breakpoint, and `getBBox` on it throws
       — leaves the offsets unset. Without this, widening a narrow window gives
       you four doodles with their notes sitting on top of them, for the rest
       of the session. */
    addEventListener('resize', () => {
      for (const turn of turns) {
        if (turn.note) anchorNote(turn.note, turn.spot, turn.svg);
      }
    });

    takeTurns(turns);
  }

  /* The note is a plain element, not part of the SVG: it is text, it should
     be selectable and scale with the page's own type, and burying it in the
     artwork would make it neither. Returns null when there is nothing to
     write, and the doodle then simply arrives on its own. */
  function writeNote(spot, svg) {
    if (!spot.note) return null;
    const note = document.createElement('span');
    note.className = 'squiggle-note';

    /* Built word by word, because each word is staggered separately. The
       index runs across lines rather than restarting on each, so the note is
       written straight through the way it would be by hand. */
    let wi = 0;
    spot.note.lines.forEach((line) => {
      const row = document.createElement('span');
      row.className = 'squiggle-note__line';
      const words = line.split(' ');
      words.forEach((word, k) => {
        const span = document.createElement('span');
        span.className = 'w';
        span.style.setProperty('--wi', wi);
        span.textContent = word;
        row.appendChild(span);
        /* A real space between words, not a margin: it belongs to the text,
           and selecting or copying the note should give the words apart. */
        if (k < words.length - 1) row.appendChild(document.createTextNode(' '));
        wi += 1;
      });
      note.appendChild(row);
    });
    note.style.setProperty('--x', `${spot.x}%`);
    note.style.setProperty('--y', `${spot.y}%`);
    note.style.setProperty('--tilt', `${spot.note.tilt || 0}deg`);

    /* Anchored only once it is in the document — the gap is solved by
       measurement, and an element outside the tree measures as nothing. */
    squiggleLayer.appendChild(note);
    anchorNote(note, spot, svg);

    /* And again once the handwriting has loaded: the note's size is what the
       gap is solved against, and a fallback face is not the same size. */
    if (document.fonts) {
      document.fonts.ready.then(() => anchorNote(note, spot, svg));
    }
    return note;
  }

  /* Measured off the ink, not the box. `getBBox` is the drawing's own extent
     in viewBox units; scaling it by the render gives where the line actually
     sits inside the element, which is what the offsets are relative to.

     The cross-axis offset is not declared but solved for: place the note
     roughly, measure the gap that produced, and shift it by the difference.
     Working it out in advance would mean predicting the note's own height
     after wrapping, rotation and the font — measuring it is both simpler and
     right, and one pass is enough because the correction is a translation
     that cannot change the size it was measured from. */
  function anchorNote(note, spot, svg) {
    const view = svg.viewBox.baseVal;
    if (!view || !view.width) return;

    let ink;
    try { ink = svg.getBBox(); } catch { return; }
    if (!ink.width) return;

    const scale = (spot.w * SQUIGGLE_SCALE) / view.width;
    const inkW = ink.width * scale;

    /* Where the ink's centre sits relative to the element's own centre — the
       slack in the export, which the note must not inherit. */
    const slackX = (ink.x + ink.width / 2 - view.width / 2) * scale;
    const slackY = (ink.y + ink.height / 2 - view.height / 2) * scale;

    /* Always from the declared offset, never from wherever the last pass
       left it — otherwise a second run corrects an already-correct gap and
       walks the note further out each time. */
    const beside = !!spot.note.beside;
    const dx = slackX + (spot.note.dx || 0) * inkW;
    const dy = slackY + (spot.note.dy || 0) * inkW;
    note.style.setProperty('--dx', `${dx.toFixed(1)}px`);
    note.style.setProperty('--dy', `${dy.toFixed(1)}px`);

    const box = svg.getBoundingClientRect();
    const edge = {
      right: box.left + (ink.x + ink.width) * scale,
      bottom: box.top + (ink.y + ink.height) * scale,
    };

    /* The line boxes, not the note's own rect: that rect is the rotated
       bounding box, which grows with the tilt and would read as a gap the
       eye cannot see. */
    const lines = [...note.querySelectorAll('.squiggle-note__line')]
      .map((line) => line.getBoundingClientRect());
    if (!lines.length) return;

    const want = (spot.note.gap ?? SQUIGGLE_NOTE_GAP) * inkW;
    const near = silhouette(svg, box, scale, lines, beside);

    if (beside) {
      const has = Math.min(...lines.map((r) => r.left)) - (near ?? edge.right);
      note.style.setProperty('--dx', `${(dx + want - has).toFixed(1)}px`);
    } else {
      const has = Math.min(...lines.map((r) => r.top)) - (near ?? edge.bottom);
      note.style.setProperty('--dy', `${(dy + want - has).toFixed(1)}px`);
    }
  }

  /* How far the drawing actually comes down (or across) where the note sits,
     rather than where its bounding box ends.

     These are hand-drawn and tilted, so the box's bottom edge is set by
     whichever corner happens to hang lowest — often nowhere near the note.
     Measuring from it left the cassette looking pushed away while the blob,
     whose ink fills its box, sat right up against the line. So: sample the
     paths, keep the points that fall in the note's own column, and measure
     from the lowest of those. */
  function silhouette(svg, box, scale, lines, beside) {
    const paths = [...svg.querySelectorAll('defs path')];
    if (!paths.length) return null;

    const lo = beside ? Math.min(...lines.map((r) => r.top))
                      : Math.min(...lines.map((r) => r.left));
    const hi = beside ? Math.max(...lines.map((r) => r.bottom))
                      : Math.max(...lines.map((r) => r.right));

    let best = -Infinity;
    for (const path of paths) {
      let length = 0;
      try { length = path.getTotalLength(); } catch { continue; }
      if (!length) continue;
      /* Coarse on purpose: this runs for every doodle at load, and a pencil
         line does not change direction between two points six units apart. */
      const steps = Math.max(4, Math.min(24, Math.round(length / 6)));
      for (let k = 0; k <= steps; k += 1) {
        const at = path.getPointAtLength((length * k) / steps);
        const px = box.left + at.x * scale;
        const py = box.top + at.y * scale;
        const along = beside ? py : px;
        if (along < lo || along > hi) continue;
        const out = beside ? px : py;
        if (out > best) best = out;
      }
    }
    return best === -Infinity ? null : best;
  }

  /* One doodle at a time, round and round. Timed from the tokens rather than
     from `animationend`: a doodle is many paths with staggered delays, so
     "finished" would be whichever path happens to end last, and the run would
     drift every lap.

     Two phases, not one. Showing the next while clearing the last would have
     them overlap — the outgoing doodle fading in one corner while the next
     draws itself in another — and the whole point is that your eye has one
     place to be. So a turn ends, the page goes empty for a beat, and only
     then does the next one start. */
  function takeTurns(turns) {
    if (!turns.length) return;
    const ms = (name) => parseFloat(getComputedStyle(root).getPropertyValue(name)) || 0;

    let at = -1;
    let timer = null;
    let held = -1;              // the one the cursor is holding open, if any

    const clear = (turn) => {
      turn.svg.classList.remove('is-up');
      if (turn.note) turn.note.classList.remove('is-up');
      /* Reset the dashes only once it is invisible, so the paths are never
         seen snapping back to undrawn. Kept on the turn so a doodle that is
         brought straight back can cancel its own undrawing. */
      clearTimeout(turn.reset);
      turn.reset = setTimeout(() => {
        turn.svg.classList.remove('is-drawn');
        if (turn.note) turn.note.classList.remove('is-written');
      }, ms('--squiggle-wipe'));
    };

    /* Returns how long the whole arrival takes, so the caller can decide when
       it is done — the rotation waits it out, a hover does not. */
    const paint = (turn) => {
      clearTimeout(turn.reset);

      /* Wind it back first, unless it is on screen already.

         The classes that drive the drawing outlive the fade: `clear` takes
         `is-up` off at once but leaves `is-drawn` until the wipe has run, so
         the paths are never seen snapping back to undrawn. Come back inside
         that window — trivial to do with the cursor — and re-adding a class
         the element already carries restarts nothing, while the animation's
         `both` is still holding the last frame. The doodle appears complete,
         instantly.

         Taking the class off, letting the style settle, and putting it back
         is what actually rewinds a CSS animation. Skipped when it is already
         up, because a doodle mid-draw, or one just sitting there, should not
         jump back to nothing under the cursor. */
      if (!turn.svg.classList.contains('is-up')) {
        turn.svg.classList.remove('is-drawn');
        if (turn.note) turn.note.classList.remove('is-written');
        void turn.svg.offsetWidth;
      }

      const paths = turn.svg.querySelectorAll('.ink').length || 1;
      const drawn = ms('--squiggle-draw') + paths * ms('--squiggle-step');

      /* The note follows the drawing, overlapping its tail, then lands a
         word at a time. Its length is the stagger plus one word's arrival —
         the last word starts last and still has to finish. */
      let written = 0;
      let begins = 0;
      if (turn.note) {
        const words = turn.note.querySelectorAll('.w').length || 1;
        written = (words - 1) * ms('--note-word') + ms('--note-word-in');
        const overlap = parseFloat(
          getComputedStyle(root).getPropertyValue('--note-overlap'));
        begins = drawn * (1 - (Number.isFinite(overlap) ? overlap : 0));
        turn.note.style.setProperty('--note-delay', `${Math.round(begins)}ms`);
      }

      turn.svg.classList.add('is-drawn', 'is-up');
      if (turn.note) turn.note.classList.add('is-written', 'is-up');
      /* Whichever ends last — the writing usually, but a doodle with many
         paths and a two-word note finishes drawing after the words land. */
      return Math.max(drawn, begins + written);
    };

    const show = () => {
      if (held >= 0) return;                  // the cursor has the floor
      at = (at + 1) % turns.length;
      const turn = turns[at];
      timer = setTimeout(() => {
        clear(turn);
        timer = setTimeout(show, ms('--squiggle-wipe') + ms('--squiggle-gap'));
      }, paint(turn) + ms('--squiggle-hold'));
    };

    const resume = () => {
      clearTimeout(timer);
      timer = setTimeout(show, ms('--squiggle-wipe') + ms('--squiggle-gap'));
    };

    /* Nothing draws while the tab is in the background, and without this the
       turns would all come due at once on return. Picking up from a clean
       page rather than mid-turn is the simplest correct thing. */
    document.addEventListener('visibilitychange', () => {
      clearTimeout(timer);
      if (document.hidden) return;
      if (turns[at]) clear(turns[at]);
      timer = setTimeout(show, ms('--squiggle-gap'));
    });

    hoverTurns(turns, {
      enter(i) {
        clearTimeout(timer);
        held = i;
        if (at >= 0 && at !== i) clear(turns[at]);
        at = i;
        paint(turns[i]);
      },
      leave() {
        if (held < 0) return;
        clear(turns[held]);
        held = -1;
        resume();
      },
    });

    timer = setTimeout(show, ms('--squiggle-begin'));
  }

  /* Find a doodle under the cursor, so hovering its patch of margin calls it
     up out of turn.

     Hit-tested against measured boxes rather than by putting `:hover` on the
     doodles themselves. Two reasons: the layer is deliberately inert, and
     giving it pointer events would put a full-page catcher over the drawing
     surface; and a doodle is a few hairlines, so a real hover would only
     trigger on the one-pixel chance of landing on a stroke. The box is the
     drawing and its note together, with a margin — the easter egg is the
     patch of empty page, not the line. */
  const HOVER_MARGIN = 26;

  function hoverTurns(turns, on) {
    let boxes = [];
    let inside = -1;

    const remeasure = () => {
      boxes = turns.map(({ svg, note }) => {
        const a = svg.getBoundingClientRect();
        const b = note ? note.getBoundingClientRect() : a;
        return {
          left: Math.min(a.left, b.left) - HOVER_MARGIN,
          top: Math.min(a.top, b.top) - HOVER_MARGIN,
          right: Math.max(a.right, b.right) + HOVER_MARGIN,
          bottom: Math.max(a.bottom, b.bottom) + HOVER_MARGIN,
        };
      });
    };

    /* Measured once the handwriting has loaded, because the note is half of
       every box and a fallback face is not the same size. */
    remeasure();
    if (document.fonts) document.fonts.ready.then(remeasure);
    addEventListener('resize', remeasure);

    addEventListener('pointermove', (event) => {
      /* Touch has no hover, and treating a tap as one would flash a doodle
         at somebody trying to scroll. */
      if (event.pointerType === 'touch') return;
      /* Below the breakpoint the whole layer is off, and the stale boxes
         would still be catching the pointer. */
      if (getComputedStyle(squiggleLayer).display === 'none') return;

      const { clientX: x, clientY: y } = event;
      let found = -1;
      for (let i = 0; i < boxes.length; i += 1) {
        const box = boxes[i];
        if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) {
          found = i;
          break;
        }
      }
      if (found === inside) return;
      inside = found;
      if (found >= 0) on.enter(found);
      else on.leave();
    }, { passive: true });

    /* Leaving through the edge of the window fires no move that lands
       outside a box, so the last one would stay open. */
    document.addEventListener('pointerleave', () => {
      if (inside < 0) return;
      inside = -1;
      on.leave();
    });
  }

  /* Hand-drawn animation boils: the line is redrawn every few frames and no
     two drawings sit in quite the same place, so it never holds still. The
     same read comes from pushing each doodle through a noise field and
     stepping the noise — a new seed is a new drawing of the same line.

     Deliberately not smooth. The seed jumps on a slow interval rather than
     easing, because a line that eases between wobbles reads as rubber, and
     one that cuts reads as pencil. Each doodle runs its own timer at a
     slightly different rate, so they drift apart instead of twitching
     together — one shared beat across the set reads as the page flinching
     rather than four drawings living. */
  function boilSquiggles() {
    if (!squiggleLayer) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const drawn = [...squiggleLayer.querySelectorAll('.squiggle')];
    if (!drawn.length) return;

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    defs.setAttribute('aria-hidden', 'true');
    defs.classList.add('u-hidden-svg');

    drawn.forEach((svg, i) => {
      defs.insertAdjacentHTML('beforeend',
        `<filter id="boil-${i}" x="-12%" y="-12%" width="124%" height="124%">`
        + `<feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="1"`
        + ` seed="${i % BOIL_FRAMES}" result="w"/>`
        + `<feDisplacementMap in="SourceGraphic" in2="w" scale="${BOIL_THROW}"`
        + ` xChannelSelector="R" yChannelSelector="G"/></filter>`);
      svg.style.filter = `url(#boil-${i})`;
    });
    squiggleLayer.appendChild(defs);

    [...defs.querySelectorAll('feTurbulence')].forEach((node, i) => {
      let frame = i;
      setInterval(() => {
        /* Nothing to boil while the tab is in the background, and the browser
           throttles the interval there anyway — checking is cheaper than
           rendering filters nobody is looking at. */
        if (document.hidden) return;
        frame += 1;
        node.setAttribute('seed', String(frame % BOIL_FRAMES));
      }, BOIL_HOLD + i * BOIL_DRIFT);
    });
  }

  /* The objects, and the one switch they share. Which object the pointer is
     over is decided by measuring their boxes, not by `:hover` — the chip
     rides under the cursor, so a hover-driven version would hand the pointer
     to the chip, un-hover the object, hide the chip, and strobe. */
  function placeProps() {
    if (!SHOW_PROPS || !propLayer) return;
    const swap = propLayer.querySelector('[data-prop-swap]');
    const placed = [];
    let active = null;

    PROPS.forEach((spot) => {
      const el = document.createElement('div');
      el.className = 'prop';
      el.style.setProperty('--x', `${spot.x}%`);
      el.style.setProperty('--y', `${spot.y}%`);
      el.style.setProperty('--w', `${spot.w}px`);

      /* The resting picture carries the height; the hover state lies over it.
         Both were cropped to the same box, so nothing shifts between them. */
      const rest = document.createElement('img');
      rest.className = 'prop__art prop__art--rest';
      rest.alt = '';
      rest.setAttribute('nopin', 'nopin');

      const live = document.createElement('img');
      live.className = 'prop__art prop__art--live';
      live.alt = '';
      live.setAttribute('nopin', 'nopin');

      const dress = (name) => {
        rest.src = `../assets/props/${name}-01.png`;
        live.src = `../assets/props/${name}-02.png`;
      };
      dress(spot.art);

      el.append(rest, live);
      propLayer.appendChild(el);
      placed.push({ el, dress, at: Math.max(0, PROP_ART.indexOf(spot.art)) });
    });

    const setActive = (item, e) => {
      if (active && active !== item) active.el.dataset.near = 'false';
      active = item;
      propLayer.dataset.near = item ? 'true' : 'false';
      root.dataset.onProp = item ? 'true' : 'false';
      if (item) {
        item.el.dataset.near = 'true';
        root.style.setProperty('--prop-x', `${e.clientX}px`);
        root.style.setProperty('--prop-y', `${e.clientY}px`);
      }
    };

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || !fine.matches) return;
      /* The chip is under the cursor and would always win a hit test, so ask
         the boxes instead of asking what is on top. */
      const hit = placed.find(({ el }) => {
        const r = el.getBoundingClientRect();
        return e.clientX >= r.left && e.clientX <= r.right &&
               e.clientY >= r.top  && e.clientY <= r.bottom;
      });
      setActive(hit || null, e);
    }, { passive: true });

    document.addEventListener('pointerleave', () => setActive(null));

    swap.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!active) return;
      active.at = (active.at + 1) % PROP_ART.length;
      active.dress(PROP_ART[active.at]);
    });
  }

  /* -------------------------------------------------------------------- ink */
  /* A drag leaves a mark that fades out behind the pointer. It is kept
     on a canvas rather than in the DOM because a long drag is hundreds of
     segments, and hundreds of nodes appearing and being removed every second
     is a different order of work.

     Nothing is stored: the marks are held only long enough to fade, and the
     canvas is cleared and repainted from that list each frame. Once the list
     empties, the loop stops rather than idling. */
  function inkLayer() {
    const canvas = document.querySelector('[data-ink]');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let marks = [];
    let raf = null;
    let last = null;        // the previous point of the current stroke
    let drawing = false;    // whether a button is actually down

    /* The works are not a surface to scribble on. Ink is suppressed across
       the whole stage rather than the frame alone, because the shelf either
       side is part of it and reaches the edges of the page. */
    const overWork = (x, y) => {
      const r = stage.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };

    const life = () => ms('--ink-life') || 850;
    const width = () => parseFloat(getComputedStyle(root).getPropertyValue('--ink-width')) || 7;
    const colour = () => getComputedStyle(root).getPropertyValue('--color-squiggle').trim();

    /* Backing store at device resolution, drawing in CSS pixels. Without the
       transform the strokes would be laid out in device pixels and land at
       half size on a retina screen. */
    function size() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();
    window.addEventListener('resize', size);

    function paint() {
      const now = performance.now();
      const span = life();
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      marks = marks.filter((m) => now - m.at < span);

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = colour();
      for (const m of marks) {
        const age = (now - m.at) / span;
        ctx.globalAlpha = 1 - age;
        /* Thinning as it goes makes the tail read as a brush lifting rather
           than a line being switched off. */
        ctx.lineWidth = width() * (1 - age * 0.55);
        ctx.beginPath();
        ctx.moveTo(m.x1, m.y1);
        ctx.lineTo(m.x2, m.y2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      raf = marks.length ? requestAnimationFrame(paint) : null;
    }

    const wake = () => { if (raf === null) raf = requestAnimationFrame(paint); };

    /* Listening on the window, and never preventing anything: a drag on the
       stage still swipes, a drag on a link still does what it did. The ink is
       laid over the top of whatever else the gesture already meant. */
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      drawing = true;
      last = overWork(e.clientX, e.clientY) ? null : { x: e.clientX, y: e.clientY };
    }, { passive: true });

    window.addEventListener('pointermove', (e) => {
      if (!drawing) return;

      /* Dropping the previous point on the way in is what breaks the stroke
         at the edge of the works. Carrying it would draw one long segment
         straight across them when the pointer came out the other side. */
      if (overWork(e.clientX, e.clientY)) { last = null; return; }

      const point = { x: e.clientX, y: e.clientY };
      if (last) {
        marks.push({ x1: last.x, y1: last.y, x2: point.x, y2: point.y, at: performance.now() });
        wake();
      }
      last = point;
    }, { passive: true });

    const release = () => { drawing = false; last = null; };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);
  }

  /* ---------------------------------------------------------------- boot */
  strip.dataset.mode = SHELF ? 'shelf' : 'solo';
  PROJECTS.forEach((p) => artList(p).forEach((src) => { new Image().src = src; }));
  readShelf();
  checkFrames();
  FRAMES.forEach(({ name }) => { new Image().src = `../assets/frames/${name}.png`; });

  field.total.textContent = pad(PROJECTS.length);
  field.current.textContent = pad(index + 1);
  paint(index);
  retimeShots();
  /* showProject() marks every later title, but never the one already in the
     markup when the page opens. */
  if (document.fonts) document.fonts.ready.then(() => markTitle(index));
  placeGraffiti();
  startBackdrop();
  placeSquiggles();
  placeProps();
  inkLayer();

  history.scrollRestoration = 'manual';
  buildSteps();
  reserveCaption();
  fitSlides();
  /* Web fonts change how the copy wraps, so the reservation is only final
     once they have loaded. */
  if (document.fonts) document.fonts.ready.then(() => { reserveCaption(); fitSlides(); });
  lastHeight = window.innerHeight;
  new ResizeObserver(fitSlides).observe(frameImg);

  /* Read straight off the scroll event. The work is a handful of style
     writes, and deferring it to the next frame would put the strip a frame
     behind the trackpad — which is exactly what you'd feel. */
  window.addEventListener('scroll', readScroll, { passive: true });

  /* Anything that changes the layout out from under us can say so, rather
     than leaving it to the observer to notice. The spacing panel uses this:
     it moves geometry on every slider input, and observer callbacks are
     delivered at rendering opportunities, which is a weaker guarantee than
     just being told. */
  window.addEventListener('portfolio:relayout', () => {
    readShelf();
    reserveCaption();
    fitSlides();
    render(shift);        // the shelf's opacity and colour are set in script
  });

  /* The reservation is a function of the column's width, so a width change
     invalidates it — and a caption measured at a transient width would
     otherwise keep that height until the next resize. Width only: reacting
     to the height would be reacting to what this very callback just set. */
  let capW = 0;
  new ResizeObserver(([entry]) => {
    const w = Math.round(entry.contentRect.width);
    if (w === capW) return;
    capW = w;
    reserveCaption();
    fitSlides();
  }).observe(caption);

  /* Mobile browsers fire resize when the URL bar slides away; only re-seat
     the scroll position for changes big enough to be real. */
  window.addEventListener('resize', () => {
    /* Belt and braces alongside the observer: observer callbacks are
       delivered at rendering opportunities, which a background tab does not
       get, and stale slide sizes would outlast the resize. */
    reserveCaption();
    fitSlides();
    if (Math.abs(window.innerHeight - lastHeight) < 40) return;
    lastHeight = window.innerHeight;
    window.scrollTo({ top: stepFor(index), behavior: 'instant' });
  });

  window.scrollTo({ top: stepFor(0), behavior: 'instant' });
  readScroll();

})();
