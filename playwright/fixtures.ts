import { test as base } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sessionStoragePath = path.resolve(
  rootDir,
  'playwright/.auth/session.json'
);

export const test = base.extend({
  context: async ({ context }, use) => {
    const entries = readFileSync(sessionStoragePath, 'utf-8');
    await context.addInitScript((data) => {
      if (window.sessionStorage.getItem('__pw_restored')) return;
      for (const [key, value] of Object.entries(JSON.parse(data))) {
        window.sessionStorage.setItem(key, value);
      }
      window.sessionStorage.setItem('__pw_restored', '1');
    }, entries);
    await use(context);
  },
});

export { expect } from '@playwright/test';
