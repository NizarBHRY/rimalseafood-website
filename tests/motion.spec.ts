import { test, expect } from '@playwright/test';

test.describe('with motion', () => {
  test('hero headline ends fully visible', async ({ page }) => {
    await page.goto('/');
    const h1 = page.locator('[data-hero] h1');
    await expect(h1).toBeVisible();
    await expect.poll(() => h1.evaluate((el) => getComputedStyle(el).visibility)).toBe('visible');
    await expect(page.locator('[data-hero] .btn-row')).toBeVisible();
  });

  test('ticker runs, and pauses with its button', async ({ page }) => {
    await page.goto('/');
    const root = page.locator('[data-marquee]');
    await expect(root).toHaveClass(/is-running/);
    const toggle = root.locator('[data-marquee-toggle]');
    await expect(toggle).toBeVisible();
    // The copy for the loop is hidden from screen readers.
    await expect(root.locator('ul[aria-hidden="true"]')).toHaveCount(1);
    await expect(root.locator('ul:not([aria-hidden])')).toHaveCount(1);

    await page.mouse.move(0, 0); // not hovering the ticker
    const x = () => root.locator('[data-marquee-track]').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);
    const a = await x();
    await page.waitForTimeout(400);
    expect(await x()).not.toBe(a);

    await toggle.click();
    await expect(toggle).toHaveText('Play');
    await page.mouse.move(0, 0);
    const p = await x();
    await page.waitForTimeout(400);
    expect(await x()).toBe(p);
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('nothing moves and everything shows', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveClass(/motion/);
    await expect(page.locator('[data-hero] h1')).toBeVisible();
    const root = page.locator('[data-marquee]');
    await expect(root).not.toHaveClass(/is-running/);
    await expect(root.locator('[data-marquee-toggle]')).toBeHidden();
    await expect(root.locator('ul')).toHaveCount(1);
    await expect(page.locator('html')).not.toHaveClass(/lenis/);
  });
});

test('smooth scroll is desktop-only', async ({ page }, info) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const lenis = await page.locator('html').evaluate((el) => el.classList.contains('lenis'));
  expect(lenis).toBe(info.project.name === 'desktop');
});
