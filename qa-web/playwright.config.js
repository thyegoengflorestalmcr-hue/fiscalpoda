import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.ARBOR_BASE_URL || 'https://arbor-intel.vercel.app';

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.js/,
  timeout: 45000,
  expect: { timeout: 10000 },
  retries: 1,
  workers: 2,
  reporter: [
    ['line'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }]
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: false,
    actionTimeout: 10000
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'] }
    },
    {
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1366, height: 768 } }
    },
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone 13'] }
    }
  ]
});
