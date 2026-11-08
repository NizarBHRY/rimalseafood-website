import { test, expect } from '@playwright/test';

test('menu preview chips filter dishes', async ({ page }) => {
  await page.goto('/');
  const chips = page.locator('[data-preview-chips]');
  await chips.scrollIntoViewIfNeeded();
  await expect(chips).toBeVisible();
  const cards = page.locator('[data-preview-grid] > li');
  const total = await cards.count();
  await chips.getByRole('button', { name: 'Desserts' }).click();
  await expect(chips.getByRole('button', { name: 'Desserts' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.locator('[data-preview-grid] > li:not([hidden])').count()).toBeLessThan(total);
  for (const c of await page.locator('[data-preview-grid] > li:not([hidden])').all()) {
    await expect(c).toHaveAttribute('data-cat', 'desserts');
  }
  await chips.getByRole('button', { name: 'All' }).click();
  await expect(page.locator('[data-preview-grid] > li[hidden]')).toHaveCount(0);
});

test('story stats end on their real values', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-story] dl').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-story] [data-count="24"]')).toHaveText('24', { timeout: 4000 });
  await expect(page.locator('[data-story] [data-count="7"]')).toHaveText('7');
});

test('gallery: scrolling the page moves it sideways on desktop; native strip on phones', async ({ page }, info) => {
  await page.goto('/');
  const strip = page.locator('[data-gallery-strip]');
  if (info.project.name === 'desktop') {
    await expect(strip).toHaveClass(/is-gliding/);
    const track = page.locator('[data-gallery-track]');
    const x = () => track.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);
    const top = await strip.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    // Strip entering at the bottom of the screen, then leaving at the top.
    await page.evaluate((y) => window.scrollTo(0, y - window.innerHeight * 0.85), top);
    await page.waitForTimeout(1200);
    const start = await x();
    await page.evaluate((y) => window.scrollTo(0, y), top);
    await page.waitForTimeout(1200);
    const end = await x();
    expect(end).toBeLessThan(start - 200);
  } else {
    await strip.scrollIntoViewIfNeeded();
    await expect(strip).not.toHaveClass(/is-gliding/);
    expect(await strip.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  }
});

test('menu dish photos: toggle works everywhere, hover photo on desktop', async ({ page }, info) => {
  await page.goto('/menu');
  const first = page.locator('[data-menu-item][data-photo]').first();
  await first.locator('summary').click();
  await expect(first.locator('details img')).toBeVisible();
  if (info.project.name === 'desktop') {
    const float = page.locator('[data-float-photo]');
    await page.locator('[data-menu-item][data-photo]').nth(1).hover();
    await expect.poll(() => float.evaluate((el) => Number(getComputedStyle(el).opacity))).toBeGreaterThan(0.9);
    await page.mouse.move(5, 5);
    await expect.poll(() => float.evaluate((el) => Number(getComputedStyle(el).opacity))).toBeLessThan(0.1);
  }
});
