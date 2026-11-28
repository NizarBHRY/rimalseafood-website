import { test, expect } from '@playwright/test';

// Phone layout: runs on the "phone" project (Pixel 7) and also at the
// narrowest common iPhone width (iPhone SE, 320px).
const PAGES = ['/', '/menu', '/market', '/visit', '/rewards', '/privacy', '/404'];

for (const width of [320, 412]) {
  test.describe(`${width}px wide`, () => {
    test.use({ viewport: { width, height: 740 }, hasTouch: true, isMobile: true });

    for (const path of PAGES) {
      test(`${path}: no sideways scroll, every control at least 44px tall`, async ({ page }) => {
        await page.goto(path, { waitUntil: 'networkidle' });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        // Links inside running text are exempt (WCAG 2.5.8 inline exception).
        const small = await page.locator('a, button, summary, input').evaluateAll((els) =>
          els
            .filter((el) => {
              const s = getComputedStyle(el);
              const r = el.getBoundingClientRect();
              if (!r.width || s.visibility === 'hidden' || s.display === 'inline') return false;
              return r.height < 44;
            })
            .map((el) => `${el.tagName} "${(el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(el.getBoundingClientRect().height)}px`),
        );
        expect(small).toEqual([]);
      });
    }

    test('all four nav links fit on screen', async ({ page }) => {
      await page.goto('/');
      for (const a of await page.locator('nav[aria-label="Main"] a').all()) {
        const box = (await a.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      }
    });

    test('top bar is one line and scrolls away', async ({ page }) => {
      await page.goto('/');
      const bar = page.locator('.topbar');
      expect((await bar.boundingBox())!.height).toBeLessThan(50);
      await page.evaluate(() => window.scrollTo(0, 800));
      expect((await bar.boundingBox())!.y).toBeLessThan(0);
    });

    test('menu: search box is full width; a long price wraps instead of squeezing the name', async ({ page }) => {
      await page.goto('/menu');
      const input = page.getByLabel('Search the menu');
      const row = page.locator('.menu-search-row');
      expect((await input.boundingBox())!.width).toBeCloseTo((await row.boundingBox())!.width, 0);
      const names = await page.locator('.item-name').evaluateAll((els) =>
        els.map((el) => ({ text: el.textContent!.trim(), lines: Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)) })),
      );
      const squeezed = names.filter((n) => n.lines > 1 && n.text.length < 24);
      expect(squeezed).toEqual([]);
    });

    test('home: menu preview and market cards sit two to a row', async ({ page }) => {
      test.skip(width < 360, 'one column on the very narrowest screens');
      await page.goto('/');
      const cards = page.locator('[data-preview-grid] > li');
      expect((await cards.nth(0).boundingBox())!.y).toBe((await cards.nth(1).boundingBox())!.y);
      await page.goto('/market');
      const fish = page.locator('.fish');
      expect((await fish.nth(0).boundingBox())!.y).toBe((await fish.nth(1).boundingBox())!.y);
    });
  });
}
