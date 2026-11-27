// Motion tokens for the whole site: GSAP (src/motion/*), the Preact islands
// and the React motion principles page all read these. The CSS copies live in
// src/styles/tokens.css (--ease-out, --dur, ...); keep the two in step.
//
// The rules (see /motion-principles for each one, before and after):
//   - Time-based animations take 200 ms or less. Hover and press: 100 ms.
//   - Entrances ease out, exits ease in, and exits are a little quicker.
//   - Animate transform and opacity only.
//   - Lists stagger 40 ms per item. Pop-ins start at 0.97, never 0.
//   - Movement is small: an 8 px offset.
//   - Nothing moves just to decorate. Reduced motion: no movement at all.

/** Entrances: decelerate into place. CSS: --ease-out. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
/** Exits: the mirror curve, accelerating away. CSS: --ease-in. */
export const EASE_IN = [0.64, 0, 0.78, 0] as const;

/** In seconds (GSAP and Framer Motion both use seconds). */
export const DURATION = {
  /** Hover and press feedback. CSS: --dur-feedback. */
  feedback: 0.1,
  /** Entrances and state changes; the ceiling for every animation. CSS: --dur. */
  base: 0.2,
  /** Exits. CSS: --dur-exit. */
  exit: 0.15,
} as const;

/** Delay between list items, in seconds (30-50 ms band). CSS: --stagger. */
export const STAGGER = 0.04;
/** Offset for fades, in px: one 8 px step. CSS: --offset. */
export const OFFSET = 8;
/** Pop-ins start at this scale. CSS: --pop-from. */
export const POP_FROM = 0.97;
/** Press physics. CSS: --ease-spring over --dur-spring is the same curve. */
export const SPRING = { stiffness: 300, damping: 25 } as const;
