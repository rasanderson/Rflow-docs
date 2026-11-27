import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const storageStatePath = path.resolve(rootDir, 'playwright/.auth/user.json');

dotenv.config({ path: path.resolve(rootDir, '.env.playwright') });

export default defineConfig({
  testDir: './playwright/tests',
  fullyParallel: false,
  reporter: 'html',
  timeout: 90_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      testMatch: '**/tutorial*.screenshots.spec.ts',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: storageStatePath,
      },
    },
  ],
});
