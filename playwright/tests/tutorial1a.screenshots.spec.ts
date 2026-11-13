import { test, expect } from '../fixtures';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const imagesDir = path.resolve(rootDir, 'tutorials/figs');

test('capture Histogram panel screenshots for Tutorial 1A', async ({ page }) => {
  await mkdir(imagesDir, { recursive: true });

  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/projects');
  const card = page
    .locator('article.project-card')
    .filter({ has: page.getByRole('heading', { name: /Tutorial 1a/i }) })
    .first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.getByRole('button', { name: /^Open/ }).click();
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 15_000 });

  await page.locator('.react-flow__node').filter({ hasText: /histogram/i }).first().click();

  const tab = (name: string) => page.getByRole('button', { name, exact: true });
  const panel = tab('Input').locator('xpath=../..');

  await expect(panel).toBeVisible();
  await expect(page.getByText('Project loaded successfully')).toBeHidden({ timeout: 15_000 });
  await panel.screenshot({
    path: path.join(imagesDir, 'tutorial_1a_histogram_input_panel.png'),
  });

  const size = await panel.boundingBox();
  if (!size) {
    throw new Error('Could not measure the Histogram panel before capturing screenshots.');
  }
  await panel.evaluate((el, { width, height }) => {
    el.style.boxSizing = 'border-box';
    el.style.width = `${width}px`;
    el.style.minHeight = `${height}px`;
  }, size);
  const assertSameSize = async () => {
    const box = await panel.boundingBox();
    expect(box?.width).toBeCloseTo(size.width, 0);
    expect(box?.height).toBeCloseTo(size.height, 0);
  };

  await panel.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(tab('Output')).toHaveCSS('border-bottom-color', 'rgb(59, 130, 246)', {
    timeout: 60_000,
  });
  await page.waitForTimeout(1500);
  await assertSameSize();
  await panel.screenshot({
    path: path.join(imagesDir, 'tutorial_1a_histogram_output_panel.png'),
  });

  await tab('R code').click();
  await page.waitForTimeout(500);
  await assertSameSize();
  await panel.screenshot({
    path: path.join(imagesDir, 'tutorial_1a_histogram_r_panel.png'),
  });
});
