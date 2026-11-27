// Menu: on desktop with motion, hovering a dish floats its photo beside the
// cursor. Decorative only (hidden from screen readers); every dish photo is
// also reachable through its "Photo" toggle. It pops in from 0.97 in 200 ms,
// follows the cursor with a 200 ms ease-out, and leaves in 150 ms.
import { gsap, mm, MQ, DURATION, POP_FROM } from './core';

const float = document.querySelector<HTMLImageElement>('[data-float-photo]');
const items = Array.from(document.querySelectorAll<HTMLElement>('[data-menu-item][data-photo]'));

if (float && items.length) {
  mm.add(MQ.desktop, () => {
    // Warm the cache the first time the pointer reaches the menu.
    let preloaded = false;
    const preload = () => {
      if (preloaded) return;
      preloaded = true;
      items.forEach((el) => { new Image().src = el.dataset.photo!; });
    };

    const x = gsap.quickTo(float, 'x', { duration: DURATION.base, ease: 'enter' });
    const y = gsap.quickTo(float, 'y', { duration: DURATION.base, ease: 'enter' });
    const onMove = (e: PointerEvent) => { x(e.clientX + 24); y(e.clientY - float.offsetHeight / 2); };
    let hovered: HTMLElement | null = null;
    const reveal = () => gsap.to(float, { autoAlpha: 1, scale: 1, overwrite: 'auto' });
    const show = (e: PointerEvent) => {
      preload();
      hovered = e.currentTarget as HTMLElement;
      const src = hovered.dataset.photo!;
      if (float.getAttribute('src') !== src) float.src = src;
      gsap.set(float, { x: e.clientX + 24, y: e.clientY - float.offsetHeight / 2 });
      if (gsap.getProperty(float, 'opacity') === 0) gsap.set(float, { scale: POP_FROM });
      // Never show an empty frame: wait for the photo if it isn't loaded yet.
      if (float.complete && float.naturalWidth) reveal();
      else float.onload = () => { if (hovered?.dataset.photo === float.getAttribute('src')) reveal(); };
    };
    const hide = () => {
      hovered = null;
      gsap.to(float, { autoAlpha: 0, scale: POP_FROM, duration: DURATION.exit, ease: 'exit', overwrite: 'auto' });
    };

    items.forEach((el) => {
      el.addEventListener('pointerenter', show);
      el.addEventListener('pointerleave', hide);
      el.addEventListener('pointermove', onMove);
    });
    return () => {
      items.forEach((el) => {
        el.removeEventListener('pointerenter', show);
        el.removeEventListener('pointerleave', hide);
        el.removeEventListener('pointermove', onMove);
      });
      gsap.set(float, { clearProps: 'all' });
    };
  });
}
