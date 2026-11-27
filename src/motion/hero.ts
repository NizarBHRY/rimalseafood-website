// Hero: the eyebrow and buttons fade up into place, 40 ms apart. The
// headline, intro and photo are never hidden or moved: they are the page's
// largest content and must paint immediately (LCP), so they don't wait for JS.
// Reduced motion: all final.
import { gsap, mm, MQ, OFFSET, STAGGER } from './core';

const hero = document.querySelector<HTMLElement>('[data-hero]');

if (hero) {
  const fades = hero.querySelectorAll<HTMLElement>('[data-hero-fade]');

  mm.add({ motion: MQ.motion, reduce: MQ.reduce }, (ctx) => {
    const { motion } = ctx.conditions as { motion: boolean };
    if (!motion) {
      gsap.set(fades, { autoAlpha: 1 });
      return;
    }
    gsap.fromTo(fades, { autoAlpha: 0, y: OFFSET }, { autoAlpha: 1, y: 0, stagger: STAGGER });
  });
}
