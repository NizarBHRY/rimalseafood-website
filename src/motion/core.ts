// Shared motion setup: GSAP + ScrollTrigger, media-query branches, and Lenis smooth
// scrolling (desktop pointers only, never with reduced motion).
//
// Rules: animate transform and opacity only; content is in the HTML and
// readable without this file; reduced motion shows final states instantly.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

gsap.registerPlugin(ScrollTrigger);
gsap.defaults({ ease: 'power3.out', duration: 0.8 });

export const MQ = {
  motion: '(prefers-reduced-motion: no-preference)',
  reduce: '(prefers-reduced-motion: reduce)',
  desktop: '(min-width: 64rem) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
} as const;

/** One gsap.matchMedia() for the page; each feature adds its own branches. */
export const mm = gsap.matchMedia();

// ---------- Lenis ----------
let lenis: Lenis | null = null;
const raf = (time: number) => lenis?.raf(time * 1000);
const smooth = window.matchMedia(`(pointer: fine) and ${MQ.motion}`);

function syncLenis() {
  if (smooth.matches && !lenis) {
    // Elements marked data-lenis-prevent (dialogs, popovers) scroll natively.
    lenis = new Lenis({ autoRaf: false, anchors: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
  } else if (!smooth.matches && lenis) {
    gsap.ticker.remove(raf);
    lenis.destroy();
    lenis = null;
  }
}
smooth.addEventListener('change', syncLenis);
syncLenis();

export { gsap, ScrollTrigger };
