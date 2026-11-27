import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PATH = '/motion-principles';

test('loads with 19 labelled before/after pairs and no errors', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(e.message));
  page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
  page.on('response', (r) => r.status() >= 400 && problems.push(`${r.status()} ${r.url()}`));
  await page.goto(PATH, { waitUntil: 'networkidle' });
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('article')).toHaveCount(19);
  await expect(page.locator('figure[data-variant="before"] > figcaption')).toHaveText(Array(19).fill('Before'));
  await expect(page.locator('figure[data-variant="after"] > figcaption')).toHaveText(Array(19).fill('After'));
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(problems).toEqual([]);
});

test('has no WCAG 2.2 AA violations', async ({ page }) => {
  await page.goto(PATH, { waitUntil: 'networkidle' });
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s) — ${v.help}`)).toEqual([]);
});

test('Replay never moves the page: each stage has a fixed height', async ({ page }) => {
  await page.goto(PATH, { waitUntil: 'networkidle' });
  const heights = () => page.locator('figure > div').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  const before = await heights();
  for (const button of await page.getByRole('button', { name: /^Replay / }).all()) await button.click();
  await page.waitForTimeout(150);
  expect(await heights()).toEqual(before);
});

test('Play all walks through every example in about 21 s, and stops', async ({ page }) => {
  await page.goto(PATH, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Play all · 21 s' }).click();
  await expect(page.locator('article[aria-current="step"]')).toHaveId('p01');
  await expect(page.locator('article[aria-current="step"]')).toHaveId('p03', { timeout: 3000 });
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.locator('article[aria-current="step"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Play all · 21 s' })).toBeVisible();
});

test('with reduced motion, says so, and demos only fade', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(PATH, { waitUntil: 'networkidle' });
  await expect(page.getByText('Your device asks for reduced motion')).toBeVisible();
  // Accessibility row: the card fades in place, with no transform at any point.
  const row = page.locator('#p13');
  await row.getByRole('button', { name: /^Replay/ }).click();
  const card = row.locator('figure[data-variant="after"] [style*="opacity"]').first();
  await page.waitForTimeout(50);
  const transform = await card.evaluate((el) => getComputedStyle(el).transform);
  expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(transform);
});
