/* =========================================================================
   Sound — the page's interaction cues.

   Cuelume does the synthesis: seventeen cues built live out of Web Audio,
   no files to fetch. It is vendored into scripts/vendor/cuelume rather than
   imported by name, because nothing here is bundled and a browser cannot
   resolve a bare specifier. `npm run sync:cuelume` re-copies it after an
   update; package.json keeps the version.

   This is a module, and the rest of the page is not. Rather than reach across
   that line with a global, app.js dispatches a `portfolio:cue` event and this
   listens for it — the same way it already announces `portfolio:relayout`. If
   this file fails to load, those events go nowhere and the page is simply
   silent, which is the correct failure.
   ========================================================================= */

import { play, bind, setEnabled, setVolume } from './vendor/cuelume/index.js';

/* --------------------------------------------------------------- volume */
/* Read from the stylesheet like every other tunable on the page, so the one
   place to adjust it is tokens.css. */
const token = getComputedStyle(document.documentElement)
  .getPropertyValue('--sound-volume');
const volume = parseFloat(token);
setVolume(Number.isFinite(volume) ? volume : 0.5);

/* ------------------------------------------------------------ the wiring */
/* Links carry the attribute and cuelume binds them itself: they are real
   anchors, the sound belongs to the element, and delegated listeners cover
   any that appear later. They sound on hover rather than on click, so the
   cue arrives as you reach the link instead of as you leave it. Cuelume
   throttles hover to one every 150ms and ignores anything but a real mouse,
   so sweeping the footer stays quiet and a touch device stays silent.

   Everything else on this page is driven from script — a project changes by
   swipe, wheel, arrow key, chip or scroll — so binding to the controls would
   miss most of the ways it actually happens. Those fire from app.js at the
   moment the thing occurs, once, whatever caused it. */
bind();

addEventListener('portfolio:cue', (e) => {
  const { name, volume: v } = e.detail || {};
  if (name) play(name, typeof v === 'number' ? { volume: v } : undefined);
});

/* ---------------------------------------------------------------- mute */
/* Cuelume mutes on request but deliberately does not remember the answer —
   "your app owns the setting" — so the remembering is here.
   `aria-pressed` carries the state: the button reads it, the stylesheet
   strikes the word through from it, and a screen reader gets it for free,
   so there is no second copy of the truth to fall out of step. */
const KEY = 'weiee:sound';
const button = document.querySelector('[data-sound-toggle]');

/* Storage can throw outright — private windows, blocked site data — so a
   failure to read is just "no preference yet", never a broken page. */
function remembered() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function apply(on, remember) {
  setEnabled(on);
  if (button) button.setAttribute('aria-pressed', on ? 'true' : 'false');
  if (!remember) return;
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* The sound still toggles; it just will not survive a reload. */
  }
}

apply(remembered() !== 'off', false);

if (button) {
  button.addEventListener('click', () => {
    const on = button.getAttribute('aria-pressed') !== 'true';
    apply(on, true);
    /* Only on the way back. Turning it on with no sound leaves you wondering
       whether it worked; turning it off with a parting sound is a joke that
       stops being funny the second time. */
    if (on) play('toggle');
  });
}
