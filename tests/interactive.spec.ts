import { test, expect } from '@playwright/test';

test('menu search filters dishes and announces the count', async ({ page }) => {
  await page.goto('/menu');
  const input = page.getByLabel('Search the menu');
  await input.fill('salmon');
  await expect(page.locator('.menu-search-status')).toHaveText(/\d+ dish(es)? found/);
  const visible = page.locator('[data-menu-item]:not([hidden])');
  await expect(visible.first()).toContainText(/salmon|fillet/i);
  await input.fill('zzzz');
  await expect(page.locator('.menu-search-status')).toContainText('No dishes match');
  await page.getByRole('button', { name: 'Clear' }).click();
  expect(await page.locator('[data-menu-item][hidden]').count()).toBe(0);
});

test('skip link moves focus to the content', async ({ page, browserName }, info) => {
  test.skip(info.project.name === 'phone', 'keyboard test runs on desktop');
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});
