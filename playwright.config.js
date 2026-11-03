import { defineConfig, devices } from '@playwright/test';

// End-to-end checks of the real app in a real browser, on a desktop and a phone screen.
// External music APIs are replaced with a fake catalogue (e2e/fakeMusic.js), so results
// don't depend on JioSaavn or Audius being up.
const PORT = 4321;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
