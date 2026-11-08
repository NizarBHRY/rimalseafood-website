// Catch Your Plate.
//   Desktop + motion: pin the section; vertical scroll slides the three steps
//     sideways (scrub, ~1.5 screens). In step 2 the photo cross-fades through
//     the cooking styles as it crosses the screen. A rail shows the step.
//   Phones / tablets: the native swipe carousel gets prev/next buttons and
//     left/right arrow keys.
import { gsap, ScrollTrigger, mm, MQ } from './core';

const root = document.querySelector<HTMLElement>('[data-cyp]');

if (root) {
  const viewport = root.querySelector<HTMLElement>('[data-cyp-viewport]')!;
  const track = root.querySelector<HTMLElement>('[data-cyp-track]')!;
  const panels = Array.from(track.children) as HTMLElement[];
  const railItems = Array.from(root.querySelectorAll<HTMLElement>('[data-cyp-rail] li'));
  const styleBox = root.querySelector<HTMLElement>('[data-cyp-styles]');
  const styleImgs = styleBox ? Array.from(styleBox.querySelectorAll<HTMLImageElement>('img')) : [];
  const styleLabel = root.querySelector<HTMLElement>('[data-cyp-style-label]');
  const controls = root.querySelector<HTMLElement>('[data-cyp-controls]')!;
  const prev = root.querySelector<HTMLButtonElement>('[data-cyp-prev]')!;
  const next = root.querySelector<HTMLButtonElement>('[data-cyp-next]')!;

  const setActive = (i: number) => railItems.forEach((li, n) => li.classList.toggle('is-active', n === i));
  const showStyle = (i: number) => {
    styleImgs.forEach((img, n) => gsap.to(img, { autoAlpha: n === i ? 1 : 0, duration: 0.3, overwrite: true }));
    if (styleLabel && styleImgs[i]) styleLabel.textContent = styleImgs[i].dataset.style ?? '';
  };

  // ---------- Desktop: pinned horizontal scroll ----------
  mm.add(MQ.desktop, () => {
    root.classList.add('is-pinned');
    // Style photos are lazy; load them now so the cross-fade has them ready.
    styleImgs.forEach((img) => (img.loading = 'eager'));

    const distance = () => track.scrollWidth - window.innerWidth;
    const slide = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: root,
        start: 'top top',
        end: '+=150%',
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => setActive(Math.min(panels.length - 1, Math.round(self.progress * (panels.length - 1)))),
      },
    });

    // Exposed for the end-to-end tests (pin start/end in px).
    (window as unknown as { __cypTrigger?: ScrollTrigger }).__cypTrigger = slide.scrollTrigger;

    // Step 2: cross-fade the cooking styles while that panel crosses the screen.
    let styles: ScrollTrigger | undefined;
    if (styleImgs.length > 1) {
      styles = ScrollTrigger.create({
        trigger: panels[1],
        containerAnimation: slide,
        start: 'left 80%',
        end: 'right 40%',
        onUpdate: (self) => showStyle(Math.min(styleImgs.length - 1, Math.floor(self.progress * styleImgs.length))),
      });
    }

    return () => {
      styles?.kill();
      root.classList.remove('is-pinned');
      gsap.set(track, { clearProps: 'all' });
      gsap.set(styleImgs, { clearProps: 'all' });
      showStyle(0);
      setActive(0);
    };
  });

  // ---------- Phones / tablets: carousel buttons and arrow keys ----------
  mm.add('(max-width: 63.99rem)', () => {
    const reduced = window.matchMedia(MQ.reduce).matches;
    if (reduced) return; // steps are stacked
    controls.hidden = false;

    const current = () => {
      const left = viewport.scrollLeft;
      return panels.reduce((best, p, i) => (Math.abs(p.offsetLeft - track.offsetLeft - left) < Math.abs(panels[best].offsetLeft - track.offsetLeft - left) ? i : best), 0);
    };
    const go = (i: number) => {
      const target = panels[Math.max(0, Math.min(panels.length - 1, i))];
      viewport.scrollTo({ left: target.offsetLeft - track.offsetLeft, behavior: 'smooth' });
    };
    const update = () => {
      const i = current();
      prev.disabled = i === 0;
      next.disabled = i === panels.length - 1;
      if (i === 1) showStyle(0);
    };
    const onPrev = () => go(current() - 1);
    const onNext = () => go(current() + 1);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); onNext(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); onPrev(); }
    };
    // Tap the step-2 photo to see the next cooking style.
    let styleIndex = 0;
    const onStyleTap = () => { styleIndex = (styleIndex + 1) % styleImgs.length; showStyle(styleIndex); };

    prev.addEventListener('click', onPrev);
    next.addEventListener('click', onNext);
    viewport.addEventListener('keydown', onKey);
    viewport.addEventListener('scroll', update, { passive: true });
    styleBox?.addEventListener('click', onStyleTap);
    update();

    return () => {
      controls.hidden = true;
      prev.removeEventListener('click', onPrev);
      next.removeEventListener('click', onNext);
      viewport.removeEventListener('keydown', onKey);
      viewport.removeEventListener('scroll', update);
      styleBox?.removeEventListener('click', onStyleTap);
    };
  });
}
