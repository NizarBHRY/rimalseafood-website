// Motion tokens for the motion principles page. Every "After" example uses
// these and nothing else, so the whole page moves the same way (principle 14).
// The same values exist as CSS in motion-lab.css (@theme) for Tailwind classes.
import { useEffect, useState } from 'react';
import type { Transition, Variants } from 'framer-motion';

/** Entrances: decelerate into place. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
/** Exits: the mirror curve, accelerating away. */
export const EASE_IN = [0.64, 0, 0.78, 0] as const;

export const DURATION = {
  /** Hover and press feedback. */
  feedback: 0.1,
  /** Entrances and state changes. The ceiling for every animation. */
  base: 0.2,
  /** Exits are a little quicker than entrances. */
  exit: 0.15,
} as const;

/** Delay between list items (30-50 ms band). */
export const STAGGER = 0.04;
/** Small offset for fades, in px. One step of the 8px spacing system. */
export const OFFSET = 8;
/** Pop-ins start here, never from 0. */
export const POP_FROM = 0.97;
/** Press physics. */
export const SPRING: Transition = { type: 'spring', stiffness: 300, damping: 25 };

export const enter: Transition = { duration: DURATION.base, ease: EASE_OUT };
export const exit: Transition = { duration: DURATION.exit, ease: EASE_IN };
export const feedback: Transition = { duration: DURATION.feedback, ease: EASE_OUT };

/** Opacity + a short rise. `custom` is the item's index, for staggering. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: OFFSET },
  shown: (i: number = 0) => ({ opacity: 1, y: 0, transition: { ...enter, delay: i * STAGGER } }),
  gone: { opacity: 0, y: OFFSET / 2, transition: exit },
};

/** Opacity + scale from 0.97. */
export const pop: Variants = {
  hidden: { opacity: 0, scale: POP_FROM },
  shown: { opacity: 1, scale: 1, transition: enter },
  gone: { opacity: 0, scale: POP_FROM, transition: exit },
};

/**
 * Counts replays. `run` comes from the page (Replay / Play all); the returned
 * `replay` lets a demo's own button trigger it too. Starts at 0, which means
 * "at rest": demos render their final state and do not animate on page load.
 */
export function useTrigger(run: number) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (run) setCount((c) => c + 1);
  }, [run]);
  return [count, () => setCount((c) => c + 1)] as const;
}

/** Runs a little script of timed steps each time `count` changes (not at 0). */
export function useScript(count: number, script: (at: (ms: number, fn: () => void) => void) => void) {
  useEffect(() => {
    if (!count) return;
    const ids: number[] = [];
    script((ms, fn) => ids.push(window.setTimeout(fn, ms)));
    return () => ids.forEach((id) => window.clearTimeout(id));
    // The script is re-created every render; only a new count should run it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);
}

/** `initial` for a remounted element: no entrance at rest, an entrance on replay. */
export const from = (count: number) => (count ? 'hidden' : false);
