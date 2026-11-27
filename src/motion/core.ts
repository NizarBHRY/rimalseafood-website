// Shared motion setup: GSAP + ScrollTrigger, the site's two easing curves,
// and media-query branches.
//
// Rules (src/motion/tokens.ts): 200 ms or less, ease out to enter and ease in
// to leave, transform and opacity only, nothing moves just to decorate.
// Content is in the HTML and readable without this file; reduced motion
// shows final states instantly. Scrolling is the browser's own: no smoothing,
// so the page always moves exactly with the wheel or finger.
import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DURATION, EASE_IN, EASE_OUT, OFFSET, POP_FROM, STAGGER } from './tokens';

gsap.registerPlugin(ScrollTrigger, CustomEase);

/** GSAP names for the two curves: ease: 'enter' / ease: 'exit'. */
CustomEase.create('enter', EASE_OUT.join(','));
CustomEase.create('exit', EASE_IN.join(','));
gsap.defaults({ ease: 'enter', duration: DURATION.base });

export const MQ = {
  motion: '(prefers-reduced-motion: no-preference)',
  reduce: '(prefers-reduced-motion: reduce)',
  desktop: '(min-width: 64rem) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
} as const;

/** One gsap.matchMedia() for the page; each feature adds its own branches. */
export const mm = gsap.matchMedia();

export { gsap, ScrollTrigger, DURATION, OFFSET, POP_FROM, STAGGER };
