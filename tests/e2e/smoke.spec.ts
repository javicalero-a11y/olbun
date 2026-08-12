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

  test('the dev server never sends HSTS or asks for HTTPS upgrades', async ({ request }) => {
    // Both belong in production only. Over plaintext they pin localhost to
    // HTTPS in the browser for two years — and `includeSubDomains` takes every
    // other local project with it. The browser keeps honouring the pin long
    // after the server stops sending it, so the only cure is clearing its HSTS
    // store by hand. That is expensive enough to be worth a test.
    const response = await request.get('/');
    const headers = response.headers();

    expect(headers['strict-transport-security']).toBeUndefined();
    expect(headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
  });
});
