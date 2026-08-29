import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  // seed.spec.ts navigates to baseURL, which has nothing running until an app
  // exists (see tests/seed.spec.ts) — excluded from the default run (CI included,
  // same placeholder problem there), but still runnable explicitly:
  // `bunx playwright test tests/seed.spec.ts --debug=cli`. Remove this once a
  // real app + webServer block exist.
  testIgnore: '**/seed.spec.ts',
  outputDir: 'tests/results',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  ...(process.env['CI'] ? { workers: 1 } : {}),
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: process.env['BASE_URL'] ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],

  // Wire this in once Phase 1 ships a dev server, then delete the testIgnore
  // line above and tests/seed.spec.ts starts navigating for real:
  // webServer: {
  //   command: 'bun run dev',
  //   url: process.env['BASE_URL'] ?? 'http://localhost:3000',
  //   reuseExistingServer: !process.env['CI'],
  // },
})
