/* =========================================================================
   Spacing panel — a dev tool, not part of the page.

   Off unless the URL carries `?tune`, so nothing ships to a visitor. Every
   control writes a CSS custom property straight onto the root, so what you
   see is the real cascade, not a preview: changing the caption's padding
   shrinks the stage, which resizes the frame, which re-seats the artwork —
   the whole chain runs exactly as it would in production.

   When it looks right, "copy CSS" gives you only what you actually changed,
   ready to paste into tokens.css.
   ========================================================================= */

(() => {
  'use strict';

  if (!new URLSearchParams(location.search).has('tune')) return;

  /* name, label, min, max, step, unit. Unit defaults to px — the shelf's
     opacity and colour are bare numbers, so they carry an empty one. */
  const GROUPS = [
    ['the backdrop', [
      ['--backdrop-opacity', 'opacity', 0, 1, 0.01, ''],
      ['--backdrop-size', 'dot size', 1, 8, 1],
      ['--backdrop-mosaic', 'tile', 1, 16, 1, ''],
      ['--backdrop-height', 'band height', 20, 90, 1, 'vh'],
      ['--backdrop-pan', 'drift', 0, 30, 0.5, ''],
      ['--backdrop-swell', 'billow', 0, 12, 0.1, ''],
      ['--backdrop-churn', 'churn', 0, 4, 0.05, ''],
    ]],
    ['the shelf either side', [
      ['--inactive-opacity', 'opacity', 0, 1, 0.01, ''],
      ['--inactive-saturate', 'colour', 0, 1, 0.01, ''],
      ['--dither-cell', 'dither cell', 1, 12, 1],
    ]],
    ['the caption box', [
      ['--pad-caption', 'padding top', 0, 120, 1],
      ['--pad-caption-end', 'padding bottom', 0, 160, 1],
      ['--gap-caption', 'gap', 0, 60, 1],
      ['--measure-prose', 'text width', 280, 560, 4],
      ['--text-display-size', 'title', 28, 88, 1],
      ['--text-body-size', 'body', 12, 24, 1],
      ['--text-body-leading', 'body leading', 14, 40, 1],
    ]],
    ['around it', [
      ['--pad-bar', 'bar inset', 0, 80, 1],
      ['--measure-page', 'column width', 400, 900, 4],
      ['--frame-size', 'frame ceiling', 320, 800, 10],
    ]],
  ];

  const root = document.documentElement;
  const initial = new Map();

  /* Changing spacing resizes the stage, which resizes the frame, which
     re-seats the artwork inside its opening. Tell the page rather than hoping
     an observer notices in time. */
  const relayout = () => window.dispatchEvent(new Event('portfolio:relayout'));

  /* Resolve each token once, before anything is overridden, so "reset" and
     the diff in "copy CSS" both have a truthful baseline. */
  const read = (name) => parseFloat(getComputedStyle(root).getPropertyValue(name)) || 0;
  GROUPS.forEach(([, rows]) => rows.forEach(([name]) => initial.set(name, read(name))));

  const panel = document.createElement('aside');
  panel.className = 'tune';
  panel.innerHTML = `
    <header class="tune__head">
      <span>spacing</span>
      <button type="button" data-act="collapse" title="Collapse">–</button>
    </header>
    <div class="tune__body"></div>
    <footer class="tune__foot">
      <button type="button" data-act="copy">copy CSS</button>
      <button type="button" data-act="reset">reset</button>
    </footer>`;

  const body = panel.querySelector('.tune__body');
  const inputs = new Map();

  GROUPS.forEach(([heading, rows]) => {
    const h = document.createElement('p');
    h.className = 'tune__group';
    h.textContent = heading;
    body.appendChild(h);

    rows.forEach(([name, label, min, max, step, unit = 'px']) => {
      const row = document.createElement('label');
      row.className = 'tune__row';
      row.innerHTML = `<span class="tune__label">${label}</span>
        <input type="range" min="${min}" max="${max}" step="${step}">
        <output class="tune__value"></output>`;
      const input = row.querySelector('input');
      const out = row.querySelector('output');

      input.value = initial.get(name);
      out.textContent = `${initial.get(name)}`;

      input.addEventListener('input', () => {
        root.style.setProperty(name, `${input.value}${unit}`);
        out.textContent = input.value;
        row.classList.toggle('is-changed', Number(input.value) !== initial.get(name));
        relayout();
      });

      inputs.set(name, { input, out, row, unit });
      body.appendChild(row);
    });
  });

  const changed = () =>
    [...inputs].filter(([name, { input }]) => Number(input.value) !== initial.get(name));

  panel.addEventListener('click', (e) => {
    const act = e.target.dataset && e.target.dataset.act;
    if (!act) return;

    if (act === 'collapse') {
      panel.classList.toggle('is-collapsed');
      e.target.textContent = panel.classList.contains('is-collapsed') ? '+' : '–';
    }

    if (act === 'reset') {
      inputs.forEach(({ input, out, row }, name) => {
        root.style.removeProperty(name);
        input.value = initial.get(name);
        out.textContent = `${initial.get(name)}`;
        row.classList.remove('is-changed');
      });
      relayout();
    }

    if (act === 'copy') {
      const rows = changed();
      const css = rows.length
        ? `:root {\n${rows.map(([n, { input, unit }]) => `  ${n}: ${input.value}${unit};`).join('\n')}\n}`
        : '/* nothing changed */';
      navigator.clipboard.writeText(css).then(
        () => { e.target.textContent = `copied ${rows.length}`; },
        () => { e.target.textContent = 'copy failed'; }
      );
      setTimeout(() => { e.target.textContent = 'copy CSS'; }, 1400);
    }
  });

  document.body.appendChild(panel);
})();
