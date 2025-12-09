/**
 * Elara AI Agent - Playwright E2E Test Configuration
 *
 * Tests the end-to-end memory flow:
 * 1. User query -> E-BRAIN memory retrieval
 * 2. Memory context injection into LLM prompt
 * 3. Neural Service -> WebLLM -> Gemini fallback chain
 * 4. Response generation with memory context
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: 'chrome-extension://elara-ai-agent',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium-extension',
      use: {
        ...devices['Desktop Chrome'],
        // Chrome extension specific configuration
        launchOptions: {
          args: [
            `--disable-extensions-except=${process.cwd()}/dist`,
            `--load-extension=${process.cwd()}/dist`,
          ],
        },
      },
    },
  ],

  // Timeout settings for E2E tests with LLM inference
  timeout: 60000, // 60 seconds for LLM responses
  expect: {
    timeout: 30000, // 30 seconds for assertions
  },
});
