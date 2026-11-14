import { test, expect } from '../fixtures';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const imagesDir = path.resolve(rootDir, 'tutorials/figs');

test('capture workflow and Histogram panel screenshots for Tutorial 1A', async ({ page }) => {
  // Setup: create the folder that will hold the captured screenshots.
  await mkdir(imagesDir, { recursive: true });

  // Start from the project list and make the page large enough to capture the full panel.
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/projects');

  // Find the Tutorial 1A project card, then open it to enter the workflow canvas.
  const card = page
    .locator('article.project-card')
    .filter({ has: page.getByRole('heading', { name: /Tutorial 1a/i }) })
    .first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.getByRole('button', { name: /^Open/ }).click();
  const canvas = page.locator('.react-flow');
  await expect(canvas).toBeVisible({ timeout: 15_000 });

  // Capture the loaded workflow before selecting or running a node.
  const histogram = canvas.locator('.react-flow__node').filter({ hasText: /histogram/i }).first();
  await expect(histogram).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Project loaded successfully')).toBeHidden({ timeout: 15_000 });
  await canvas.locator('.react-flow__controls-fitview').click();
  await canvas.screenshot({
    path: path.join(imagesDir, 'tutorial_1a_workflow.png'),
  });

  // Select the Histogram node so its configuration/output panel is the active focus.
  await histogram.click();

  // Helper for switching tabs and reaching the panel wrapper that contains the selected node content.
  const tab = (name: string) => page.getByRole('button', { name, exact: true });
  const panel = tab('Input').locator('xpath=../..');

  // Capture the initial "Input" state before the node is executed.
  await expect(panel).toBeVisible();
  await panel.screenshot({
    path: path.join(imagesDir, 'tutorial_1a_histogram_input_panel.png'),
  });

  // Measure the panel once and then freeze its size before future captures.
  // This keeps screenshots consistent across tab changes, where UI layout may resize.
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

  // Run the node and wait for the output tab to become active before capturing the result.
  await panel.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(tab('Output')).toHaveCSS('border-bottom-color', 'rgb(59, 130, 246)', {
    timeout: 60_000,
  });
  await page.waitForTimeout(1500);
  await assertSameSize();
  await panel.screenshot({
    path: path.join(imagesDir, 'tutorial_1a_histogram_output_panel.png'),
  });

  // Finally, switch to the generated R code tab and capture that view as well.
  await tab('R code').click();
  await page.waitForTimeout(500);
  await assertSameSize();
  await panel.screenshot({
    path: path.join(imagesDir, 'tutorial_1a_histogram_r_panel.png'),
  });
});
