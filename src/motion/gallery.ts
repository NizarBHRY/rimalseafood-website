// Gallery: on desktop with motion, the photos move sideways as the page
// scrolls past the section, so all of them come into view without a
// sideways scroll. Tied 1:1 to the scroll (no catch-up lag) and no pinning,
// so the page never stops. Phones, reduced motion and no-JS keep a native
// scrollable strip.
import { gsap, mm, MQ } from './core';

const root = document.querySelector<HTMLElement>('[data-gallery]');

if (root) {
  const strip = root.querySelector<HTMLElement>('[data-gallery-strip]')!;
  const track = root.querySelector<HTMLElement>('[data-gallery-track]')!;
  const hint = root.querySelector<HTMLElement>('[data-gallery-hint]');

  mm.add(MQ.desktop, () => {
    strip.classList.add('is-gliding');
    if (hint) hint.hidden = false;

    const tween = gsap.to(track, {
      x: () => -Math.max(0, track.scrollWidth - strip.clientWidth),
      ease: 'none',
      scrollTrigger: {
        trigger: strip,
        start: 'top 85%',
        end: 'bottom 15%',
        scrub: true,
        invalidateOnRefresh: true,
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
      strip.classList.remove('is-gliding');
      if (hint) hint.hidden = true;
      gsap.set(track, { clearProps: 'all' });
    };
  });
}
