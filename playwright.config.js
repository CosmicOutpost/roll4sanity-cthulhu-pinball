import { defineConfig } from '@playwright/test';
const deployedURL = process.env.PINBALL_BASE_URL;
export default defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  workers: 1,
  use: {
    baseURL: deployedURL ? `${deployedURL.replace(/\/+$/, '')}/` : 'http://127.0.0.1:5173',
    headless: true,
    launchOptions: {
      // Actions uses Playwright's installed browser; local cloud tasks use the
      // existing system Chromium. CHROMIUM_PATH overrides either choice.
      executablePath: process.env.CHROMIUM_PATH || (process.env.CI ? undefined : '/usr/bin/chromium'),
      args: ['--no-sandbox'],
    },
  },
  webServer: deployedURL ? undefined : {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
});
