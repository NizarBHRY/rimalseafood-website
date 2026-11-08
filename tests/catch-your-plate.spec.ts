import { test, expect } from '@playwright/test';

const trackX = (page: import('@playwright/test').Page) =>
  page.locator('[data-cyp-track]').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);

test('desktop: pins and slides the steps sideways as you scroll', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'desktop only');
  await page.goto('/');
  const root = page.locator('[data-cyp]');
  await expect(root).toHaveClass(/is-pinned/);
  await expect(page.locator('[data-cyp-rail]')).toBeVisible();

  // The pin starts when the section's top reaches the top of the screen and lasts 1.5 screens.
  const { start: pinStart, end: pinEnd } = await page.evaluate(() => {
    const st = (window as any).__cypTrigger;
    return st ? { start: st.start, end: st.end } : { start: 0, end: 0 };
  });
  expect(pinEnd - pinStart).toBeGreaterThan(500);

  await page.evaluate((y) => window.scrollTo(0, y), pinStart + 5);
  await page.waitForTimeout(1200);
  const start = await trackX(page);
  await expect(page.locator('[data-cyp-rail] li').nth(0)).toHaveClass(/is-active/);

  // Halfway through the pin: section held at the top, track moved left.
  await page.evaluate((y) => window.scrollTo(0, y), (pinStart + pinEnd) / 2);
  await page.waitForTimeout(1500);
  expect(Math.abs((await root.boundingBox())!.y)).toBeLessThan(5);
  expect(await trackX(page)).toBeLessThan(start - 200);

  // End of the pin: last step active.
  await page.evaluate((y) => window.scrollTo(0, y), pinEnd - 2);
  await page.waitForTimeout(1500);
  await expect(page.locator('[data-cyp-rail] li').nth(2)).toHaveClass(/is-active/);
});

test('phone: swipe carousel with next/prev buttons', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'phone only');
  await page.goto('/');
  const root = page.locator('[data-cyp]');
  await expect(root).not.toHaveClass(/is-pinned/);
  const next = root.locator('[data-cyp-next]');
  const prev = root.locator('[data-cyp-prev]');
  await next.scrollIntoViewIfNeeded();
  await expect(prev).toBeDisabled();
  await next.click();
  await expect.poll(() => root.locator('[data-cyp-viewport]').evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);
  await expect(prev).toBeEnabled();
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('no pinning; on phones the steps stack', async ({ page }, info) => {
    await page.goto('/');
    const root = page.locator('[data-cyp]');
    await expect(root).not.toHaveClass(/is-pinned/);
    if (info.project.name === 'phone') {
      const lefts = await root.locator('[data-cyp-track] > li').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
      expect(new Set(lefts).size).toBe(1); // all in one column
      await expect(root.locator('[data-cyp-controls]')).toBeHidden();
    }
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('all three steps and prices are in the page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const steps = page.locator('[data-cyp-track] > li');
    await expect(steps).toHaveCount(3);
    await expect(steps.nth(2)).toContainText('$4.99 grill & dine-in fee');
    await expect(steps.nth(2).locator('.prices li').first()).toContainText('$');
  });
});
