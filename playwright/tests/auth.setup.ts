import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const authDir = path.resolve(rootDir, 'playwright/.auth');
const storageStatePath = path.resolve(authDir, 'user.json');
const sessionStoragePath = path.resolve(authDir, 'session.json');

test('authenticate and save browser state', async ({ page }) => {
  const username = process.env.TEST_USER;
  const password = process.env.TEST_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'Set TEST_USER and TEST_PASSWORD in .env.playwright before running Playwright.'
    );
  }

  await page.goto('/');
  await page.getByLabel(/username|email/i).fill(username);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /login|sign in/i }).click();

  await expect(page.locator('input[type="password"]')).toHaveCount(0, {
    timeout: 10_000,
  });

  await mkdir(authDir, { recursive: true });
  await page.context().storageState({ path: storageStatePath });

  const sessionData = await page.evaluate(() =>
    JSON.stringify(Object.fromEntries(Object.entries(window.sessionStorage)))
  );
  await writeFile(sessionStoragePath, sessionData);
});
