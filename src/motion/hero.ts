// Hero: the photo settles from 1.05 to 1 and the eyebrow and buttons fade in.
// The headline and intro paragraph are never hidden: they are the page's
// largest text and must paint immediately (LCP), so they don't wait for JS.
// Reduced motion: all final.
import { gsap, mm, MQ } from './core';

const hero = document.querySelector<HTMLElement>('[data-hero]');

if (hero) {
  const media = hero.querySelector<HTMLElement>('[data-hero-media] img');
  const fades = hero.querySelectorAll<HTMLElement>('[data-hero-fade]');

  mm.add({ motion: MQ.motion, reduce: MQ.reduce }, (ctx) => {
    const { motion } = ctx.conditions as { motion: boolean };
    if (!motion) {
      gsap.set(fades, { autoAlpha: 1 });
      return;
    }
    if (media) gsap.fromTo(media, { scale: 1.05 }, { scale: 1, duration: 2.4, ease: 'power2.out' });
    gsap.fromTo(fades, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.08, delay: 0.1 });
  });
}
