import { test, expect, type Page } from '@playwright/test';

// The site's motion rules (src/motion/tokens.ts, /motion-principles):
// 200 ms or less, transform and opacity only, nothing decorative.

/** Every running CSS transition and animation, with its duration in ms. */
const runningDurations = (page: Page) =>
  page.evaluate(() => {
    const out: { what: string; ms: number }[] = [];
    for (const a of document.getAnimations()) {
      const t = a.effect?.getTiming();
      const ms = Number(t?.duration ?? 0);
      const el = (a.effect as KeyframeEffect | null)?.target as Element | null;
      out.push({ what: `${a.constructor.name} on ${el?.className || el?.tagName}`, ms });
    }
    return out;
  });

test.describe('with motion', () => {
  test('hero headline ends fully visible', async ({ page }) => {
    await page.goto('/');
    const h1 = page.locator('[data-hero] h1');
    await expect(h1).toBeVisible();
    await expect.poll(() => h1.evaluate((el) => getComputedStyle(el).visibility)).toBe('visible');
    await expect(page.locator('[data-hero] .btn-row')).toBeVisible();
  });

  test('hero entrance is done within a quarter second', async ({ page }) => {
    await page.goto('/');
    const fades = page.locator('[data-hero-fade]');
    // 200 ms + one 40 ms stagger step, plus a little slack for script start.
    await page.waitForFunction(() => document.querySelector('[data-hero-fade]') && getComputedStyle(document.querySelector('[data-hero-fade]')!).visibility === 'visible');
    await page.waitForTimeout(260);
    expect(await fades.evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity))).toEqual(['1', '1']);
  });

  test("today's catch is a still list", async ({ page }) => {
    await page.goto('/');
    const list = page.locator('.catch ul');
    await expect(list).toHaveCount(1);
    const box = await list.boundingBox();
    await page.waitForTimeout(400);
    expect(await list.boundingBox()).toEqual(box);
    await expect(page.getByRole('button', { name: /pause/i })).toHaveCount(0);
  });

  test('no CSS transition or animation runs longer than the spring', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Order delivery' }).first().click();
    await page.waitForTimeout(50);
    for (const { what, ms } of await runningDurations(page)) {
      expect(ms, what).toBeLessThanOrEqual(450);
    }
  });

  test('buttons give way on press and tint on hover, in 100 ms', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'pointer hover');
    await page.goto('/menu');
    const btn = page.locator('.btn').first();
    const tint = () => btn.evaluate((el) => getComputedStyle(el, '::before').transitionDuration);
    expect(await tint()).toBe('0.1s');
    await btn.hover();
    await expect.poll(() => btn.evaluate((el) => getComputedStyle(el, '::before').opacity)).toBe('1');
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('nothing moves and everything shows', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveClass(/motion/);
    await expect(page.locator('[data-hero] h1')).toBeVisible();
    await expect(page.locator('[data-hero-fade]').first()).toBeVisible();
    await expect(page.locator('[data-gallery-strip]')).not.toHaveClass(/is-gliding/);
  });
});

test('scrolling is native: no smooth-scroll library', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(await page.locator('html').evaluate((el) => el.classList.contains('lenis'))).toBe(false);
  await page.evaluate(() => window.scrollTo(0, 600));
  expect(await page.evaluate(() => window.scrollY)).toBe(600);
});
