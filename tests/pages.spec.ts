import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES = ['/', '/menu', '/market', '/visit', '/rewards', '/privacy', '/404'];

for (const path of PAGES) {
  test.describe(path, () => {
    test('loads with one h1, no errors, no broken requests', async ({ page }) => {
      const problems: string[] = [];
      page.on('pageerror', (e) => problems.push(e.message));
      page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
      page.on('response', (r) => r.status() >= 400 && problems.push(`${r.status()} ${r.url()}`));
      await page.goto(path, { waitUntil: 'networkidle' });
      await expect(page.locator('h1')).toHaveCount(1);
      expect(problems).toEqual([]);
    });

    test('has no WCAG 2.2 AA violations', async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      const summary = results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s) — ${v.help}`);
      expect(summary).toEqual([]);
    });

    test('Arabic text is marked lang="ar" dir="rtl"', async ({ page }) => {
      await page.goto(path);
      const unmarked = await page.evaluate(() => {
        const arabic = /[؀-ۿ]/;
        const out: string[] = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          const el = node.parentElement!;
          if (!arabic.test(node.textContent ?? '') || el.closest('script, style')) continue;
          const host = el.closest('[lang]');
          if (host?.getAttribute('lang') !== 'ar' || !el.closest('[dir="rtl"]')) out.push(node.textContent!.trim());
        }
        return out;
      });
      expect(unmarked).toEqual([]);
    });
  });
}

test('staff page is hidden from search engines', async ({ page, request }) => {
  await page.goto('/manage.html');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  const robots = await (await request.get('/robots.txt')).text();
  // Not blocked in robots.txt, so crawlers can read the noindex.
  expect(robots).not.toContain('Disallow: /manage');
  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  expect(sitemap).not.toMatch(/manage|admin|404/);
});

test('every page uses the one phone number', async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    const tels = await page.locator('a[href^="tel:"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')))]);
    expect(tels, path).toEqual(['tel:+13474974002']);
  }
});

test('menu structured data lists exactly the dishes on the page', async ({ page }) => {
  await page.goto('/menu');
  const shown = await page.locator('[data-menu-item]').count();
  const inLd = await page.locator('script[type="application/ld+json"]').evaluate((el) =>
    JSON.parse(el.textContent!).hasMenuSection.reduce((n: number, s: { hasMenuItem: unknown[] }) => n + s.hasMenuItem.length, 0));
  expect(inLd).toBe(shown);
});

test('visit page FAQ matches its structured data', async ({ page }) => {
  await page.goto('/visit');
  const questions = await page.locator('.faq dt').allTextContents();
  const ld = await page.locator('script[type="application/ld+json"]').evaluate((el) => JSON.parse(el.textContent!));
  expect(ld['@type']).toBe('FAQPage');
  expect(ld.mainEntity.map((q: { name: string }) => q.name)).toEqual(questions);
});
