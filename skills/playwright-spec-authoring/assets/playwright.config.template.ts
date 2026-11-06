import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  // Long timeout: the user may need to log in / approve 2FA manually in the headed window.
  timeout: 10 * 60 * 1000,
  expect: { timeout: 15_000 },
  use: {
    actionTimeout: 20_000,
    baseURL: 'https://example.com', // replace with the site under test
    storageState: '.auth/state.json',
    headless: false,
    viewport: { width: 1280, height: 900 },
    locale: 'en-US', // match the language the site renders accessible names in
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
