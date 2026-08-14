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

  test('a plaintext production preview does not force unavailable HTTPS', async ({
    request,
  }) => {
    // `next start` is production mode, but the local and LAN demos intentionally
    // serve HTTP. Enabling either directive here breaks Safari and all assets.
    const response = await request.get('/');
    const headers = response.headers();

    expect(headers['strict-transport-security']).toBeUndefined();
    expect(headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
  });
});
