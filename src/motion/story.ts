// Our Story: slight parallax on the photo (desktop), and stats that count up
// once on first view. Reduced motion: nothing moves; numbers are already final.
import { gsap, ScrollTrigger, mm, MQ } from './core';

const root = document.querySelector<HTMLElement>('[data-story]');

if (root) {
  const photo = root.querySelector<HTMLElement>('[data-parallax] img');
  const counters = Array.from(root.querySelectorAll<HTMLElement>('[data-count]'));

  mm.add(MQ.desktop, () => {
    if (!photo) return;
    gsap.fromTo(photo, { yPercent: -8 }, {
      yPercent: 0,
      ease: 'none',
      scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  mm.add(MQ.motion, () => {
    const counted = counters.filter((el) => Number(el.dataset.from) !== Number(el.dataset.count));
    ScrollTrigger.create({
      trigger: root.querySelector('dl') ?? root,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        counted.forEach((el) => {
          const target = Number(el.dataset.count);
          const state = { n: Number(el.dataset.from) };
          gsap.to(state, {
            n: target,
            duration: 1.2,
            ease: 'power2.out',
            onUpdate: () => { el.textContent = String(Math.round(state.n)); },
          });
        });
      },
    });
  });
}
