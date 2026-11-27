// Menu preview filter. Chips appear only with JS; filtering is instant with
// reduced motion. With motion (GSAP Flip): cards that stay slide to their new
// places, new cards pop in from 0.97, leaving cards fade out a little quicker.
// Everything takes 200 ms, staggered 40 ms.
import { Flip } from 'gsap/Flip';
import { gsap, MQ, DURATION, POP_FROM, STAGGER } from './core';

gsap.registerPlugin(Flip);

const root = document.querySelector<HTMLElement>('[data-preview]');

if (root) {
  const chips = root.querySelector<HTMLElement>('[data-preview-chips]')!;
  const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-preview-grid] > li'));
  const buttons = Array.from(chips.querySelectorAll<HTMLButtonElement>('button'));
  chips.hidden = false;

  chips.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-filter]');
    if (!btn || btn.getAttribute('aria-pressed') === 'true') return;
    const filter = btn.dataset.filter!;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));

    const animate = window.matchMedia(MQ.motion).matches;
    const state = animate ? Flip.getState(cards) : null;
    cards.forEach((c) => (c.hidden = filter !== 'all' && c.dataset.cat !== filter));
    if (state) {
      Flip.from(state, {
        absolute: true,
        stagger: STAGGER,
        onEnter: (els) => gsap.fromTo(els, { autoAlpha: 0, scale: POP_FROM }, { autoAlpha: 1, scale: 1, stagger: STAGGER }),
        onLeave: (els) => gsap.to(els, { autoAlpha: 0, scale: POP_FROM, duration: DURATION.exit, ease: 'exit' }),
      });
    }
  });
}
