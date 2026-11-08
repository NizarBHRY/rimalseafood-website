// Menu preview filter. Chips appear only with JS; filtering is instant with
// reduced motion and animated with GSAP Flip otherwise.
import { Flip } from 'gsap/Flip';
import { gsap, MQ } from './core';

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
        duration: 0.6,
        ease: 'power3.inOut',
        absolute: true,
        stagger: 0.04,
        onEnter: (els) => gsap.fromTo(els, { autoAlpha: 0, scale: 0.94 }, { autoAlpha: 1, scale: 1, duration: 0.5 }),
        onLeave: (els) => gsap.to(els, { autoAlpha: 0, scale: 0.94, duration: 0.3 }),
      });
    }
  });
}
