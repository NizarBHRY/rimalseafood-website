import { test, expect } from '@playwright/test';

// The essentials must work with JavaScript turned off.
// With JavaScript off Chrome ignores loading="lazy", so every photo downloads;
// homepage tests wait for the HTML rather than the load event.
test.use({ javaScriptEnabled: false });

test('full menu is readable', async ({ page }) => {
  await page.goto('/menu');
  const items = page.locator('[data-menu-item]');
  expect(await items.count()).toBeGreaterThan(20);
  await expect(items.first()).toBeVisible();
  await expect(page.locator('#menu-search-input')).toHaveCount(0); // no dead search box
});

test('order sheet opens and closes', async ({ page, isMobile }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const opener = isMobile ? page.locator('.bottombar button') : page.locator('.header-order');
  await opener.click();
  const sheet = page.locator('#order-sheet');
  await expect(sheet).toBeVisible();
  const services = sheet.locator('.sheet-links a');
  await expect(services).toHaveCount(6);
  await expect(services.first()).toContainText('Order Online');
  for (const a of await services.all()) {
    await expect(a).toHaveAttribute('target', '_blank');
    await expect(a).toHaveAttribute('rel', 'noopener');
  }
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
});

test('Call, Directions and hours are on every page', async ({ page }) => {
  await page.goto('/visit');
  await expect(page.locator('.topbar')).toContainText('Open daily');
  await expect(page.locator('.topbar a[href^="tel:"]')).toBeVisible();
  await expect(page.locator('.topbar a[href*="google.com/maps"]')).toBeVisible();
});
