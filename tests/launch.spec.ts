import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// The Content-Security-Policy the live site sends (written by scripts/postbuild.mjs).
const CSP = readFileSync('dist/_headers', 'utf8').match(/Content-Security-Policy: (.+)/)![1];

async function withCsp(page: Page) {
  const violations: string[] = [];
  page.on('console', (m) => /Content Security Policy|violates/i.test(m.text()) && violations.push(m.text()));
  await page.route('http://localhost:4329/**', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const res = await route.fetch();
    await route.fulfill({ response: res, headers: { ...res.headers(), 'content-security-policy': CSP } });
  });
  return violations;
}

for (const path of ['/', '/menu', '/market', '/visit', '/rewards', '/privacy', '/manage.html', '/rimal-menu.html']) {
  test(`${path} runs under the live CSP with no violations`, async ({ page }) => {
    const violations = await withCsp(page);
    await page.goto(path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    expect(violations).toEqual([]);
  });
}

test('old single-page links go to the new pages', async ({ page }) => {
  for (const [hash, to] of [['#menu', '/menu'], ['#rewards', '/rewards'], ['#visit', '/visit']]) {
    await page.goto(`/${hash}`);
    await expect(page).toHaveURL(new RegExp(`${to}$`));
  }
  await page.goto('/#admin');
  await expect(page).toHaveURL(/\/manage\.html/);
});

test('staff dashboard page still loads with its sign-in', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/manage.html', { waitUntil: 'networkidle' });
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('#page-admin')).toBeVisible();
  expect(errors).toEqual([]);
});

test.describe('rewards lookup', () => {
  test('shows stamps for a known number, never the name', async ({ page }) => {
    let body = '';
    await page.route('**/rest/v1/rpc/get_rewards', async (route) => {
      body = route.request().postData() ?? '';
      await route.fulfill({ json: [{ name: 'Secret Name', visits: 9, cycle_purchases: 3, platters_ready: 1 }] });
    });
    await page.goto('/rewards');
    await page.getByLabel('Your phone number').fill('+1 (347) 555-0123');
    await page.getByRole('button', { name: 'Check my stamps' }).click();
    await expect(page.getByText('3 of 5')).toBeVisible();
    await expect(page.getByText('1 free platter')).toBeVisible();
    await expect(page.locator('.stamps.is-live li.is-on')).toHaveCount(3);
    await expect(page.getByText('Secret Name')).toHaveCount(0);
    expect(JSON.parse(body)).toEqual({ p_phone: '3475550123' });
  });

  test('explains an unknown number and a bad one', async ({ page }) => {
    await page.route('**/rest/v1/rpc/get_rewards', (route) => route.fulfill({ json: [] }));
    await page.goto('/rewards');
    await page.getByLabel('Your phone number').fill('12');
    await page.getByRole('button', { name: 'Check my stamps' }).click();
    await expect(page.getByText('10-digit')).toBeVisible();
    await page.getByLabel('Your phone number').fill('347 555 0123');
    await page.getByRole('button', { name: 'Check my stamps' }).click();
    await expect(page.getByText('No rewards yet')).toBeVisible();
  });
});
