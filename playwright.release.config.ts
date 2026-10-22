import { defineConfig, devices } from '@playwright/test';

// These journeys exercise the built service worker and must never silently
// skip their offline assertions as development-server runs do.
process.env.FLOWTASK_PRODUCTION = 'true';

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results-release-candidate',
  testMatch: ['productionReadiness.spec.ts', 'entryFlow.spec.ts', 'auditRegression.spec.ts', 'releasePolish.spec.ts', 'accessibilityAudit.spec.ts', 'focusStudioV2.spec.ts'],
  fullyParallel: false,
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:5191', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], ...(process.env.CI ? {} : { channel: 'chrome' }) } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 5191 --strictPort', url: 'http://127.0.0.1:5191', reuseExistingServer: !process.env.CI },
});
