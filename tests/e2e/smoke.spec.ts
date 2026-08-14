import { expect, test } from '@playwright/test';

test.describe('M0 smoke', () => {
  test('the marketing page renders the product promise', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('vencimiento');
    await expect(page).toHaveTitle(/Olbun/);
  });

  test('the health endpoint reports the database as up', async ({ request }) => {
    const response = await request.get('/api/health');

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      checks: { database: 'up' },
    });
  });

  test('security headers are present on HTML responses', async ({ request }) => {
    const response = await request.get('/');
    const headers = response.headers();

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['x-powered-by']).toBeUndefined();
  });

  test('the production server sends HSTS and upgrades insecure requests', async ({
    request,
  }) => {
    // Playwright starts the built server. Development-only absence is covered
    // by next.config's isDev branch and does not belong in this production E2E.
    const response = await request.get('/');
    const headers = response.headers();

    expect(headers['strict-transport-security']).toContain('max-age=63072000');
    expect(headers['content-security-policy']).toContain('upgrade-insecure-requests');
  });
});
