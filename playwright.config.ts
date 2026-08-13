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
  // Capped locally rather than left to the core count. `reuseExistingServer`
  // attaches these runs to the *dev* server, which compiles each route the
  // first time it is asked for; six workers demanding six cold routes at once
  // pushes the first request past the 5s assertion timeout and produces
  // failures that look like product bugs and are not. CI builds for production
  // first and runs single-file, so it never sees this.
  workers: isCI ? 1 : 3,
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
    env: {
      // Detection runs on the local rule engine here, always. A suite that
      // reached the Claude API would be slow, non-deterministic, and would
      // start costing money the day somebody put a key in their `.env`.
      MOTOR_DETECCION: 'reglas',
    },
  },
});
