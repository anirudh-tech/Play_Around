import { expect, test } from '@playwright/test';

const web = process.env.WEB_URL ?? 'http://localhost:3000';
const admin = process.env.ADMIN_URL ?? 'http://localhost:3001';
const api = process.env.API_URL ?? 'http://localhost:4000';

async function up(url: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

test.describe('web core loop', () => {
  test('landing and discover render', async ({ page }) => {
    test.skip(!(await up(web)), 'web is not running on :3000');
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /find a game/i })).toBeVisible();
    await page.goto('/discover');
    await expect(page.getByRole('heading', { name: /filters/i }).or(page.getByText(/discover/i)).first()).toBeVisible();
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  });

  test('legal placeholders are unpublished (L-05)', async ({ page }) => {
    test.skip(!(await up(web)), 'web is not running on :3000');
    for (const path of ['/terms', '/privacy', '/organiser-agreement']) {
      await page.goto(path);
      await expect(page.getByText(/not published/i)).toBeVisible();
    }
  });
});

test.describe('admin core loop', () => {
  test('staff sign-in is reachable', async ({ page }) => {
    test.skip(!(await up(admin)), 'admin is not running on :3001');
    await page.goto(admin);
    await expect(page.getByRole('heading', { name: /staff sign-in/i })).toBeVisible();
  });
});

test.describe('api smoke', () => {
  test('health is live', async () => {
    test.skip(!(await up(`${api}/health`)), 'api is not running on :4000');
    const res = await fetch(`${api}/health`);
    expect(res.ok).toBeTruthy();
  });
});
