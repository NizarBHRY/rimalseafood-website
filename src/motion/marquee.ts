// Today's Catch ticker. Without JS or with reduced motion the list sits still
// and wraps. With motion it scrolls slowly; it pauses on hover, on keyboard
// focus, and with its Pause button. On desktop, scrolling the page nudges its
// speed and adds a slight skew.
import { gsap, ScrollTrigger, mm, MQ } from './core';

const PX_PER_SECOND = 40;

document.querySelectorAll<HTMLElement>('[data-marquee]').forEach((root) => {
  const track = root.querySelector<HTMLElement>('[data-marquee-track]');
  const list = track?.querySelector<HTMLElement>('ul');
  const toggle = root.querySelector<HTMLButtonElement>('[data-marquee-toggle]');
  if (!track || !list || !toggle) return;

  mm.add({ motion: MQ.motion, desktop: MQ.desktop }, (ctx) => {
    const { motion, desktop } = ctx.conditions as { motion: boolean; desktop: boolean };
    if (!motion) return;

    // A second copy makes the loop seamless; screen readers get the first only.
    const copy = list.cloneNode(true) as HTMLElement;
    copy.setAttribute('aria-hidden', 'true');
    copy.querySelectorAll('a, button').forEach((el) => el.setAttribute('tabindex', '-1'));
    track.append(copy);
    root.classList.add('is-running');

    const tween = gsap.to(track, {
      xPercent: -50,
      ease: 'none',
      duration: list.offsetWidth / PX_PER_SECOND,
      repeat: -1,
    });

    let userPaused = false;
    let hovering = false;
    const update = () => {
      const paused = userPaused || hovering;
      tween.paused(paused);
      toggle.textContent = userPaused ? 'Play' : 'Pause';
      toggle.setAttribute('aria-label', userPaused ? "Play today's catch ticker" : "Pause today's catch ticker");
    };
    const onToggle = () => { userPaused = !userPaused; update(); };
    const onEnter = () => { hovering = true; update(); };
    const onLeave = () => { hovering = false; update(); };
    toggle.addEventListener('click', onToggle);
    track.addEventListener('pointerenter', onEnter);
    track.addEventListener('pointerleave', onLeave);
    root.addEventListener('focusin', onEnter);
    root.addEventListener('focusout', onLeave);
    update();

    let velocity: ScrollTrigger | undefined;
    if (desktop) {
      const skew = gsap.quickTo(track, 'skewX', { duration: 0.4, ease: 'power3.out' });
      velocity = ScrollTrigger.create({
        trigger: root,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate(self) {
          const v = self.getVelocity();
          skew(gsap.utils.clamp(-6, 6, v / -300));
          if (!tween.paused()) {
            tween.timeScale(1 + Math.min(Math.abs(v) / 1500, 2));
            gsap.to(tween, { timeScale: 1, duration: 0.8, overwrite: true });
          }
        },
      });
    }

    return () => {
      velocity?.kill();
      tween.kill();
      gsap.set(track, { clearProps: 'all' });
      copy.remove();
      root.classList.remove('is-running');
      toggle.removeEventListener('click', onToggle);
      track.removeEventListener('pointerenter', onEnter);
      track.removeEventListener('pointerleave', onLeave);
      root.removeEventListener('focusin', onEnter);
      root.removeEventListener('focusout', onLeave);
    };
  });
});
