import { defineConfig, devices } from '@playwright/test';

// Port 3100, not 3000: this machine runs other Next.js projects, and
// `reuseExistingServer` will happily bind a test run to whichever app answers
// first. A dedicated port makes that mistake impossible.
const baseURL = process.env['APP_URL'] ?? 'http://localhost:3100';
const isCI = Boolean(process.env['CI']);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Frontline supervisors work on phones (SPEC §8): keep a mobile project
    // green from the start rather than retrofitting responsiveness later.
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'pnpm build && pnpm start',
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
