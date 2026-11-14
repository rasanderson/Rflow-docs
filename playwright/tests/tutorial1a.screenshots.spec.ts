import { test, expect } from '../fixtures';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const imagesDir = path.resolve(rootDir, 'tutorials/figs');

test('capture tutorial 1a workflow and nodes', async ({ page }) => {
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

  // Helper for switching tabs and reaching the panel wrapper that contains the selected node content.
  const tab = (name: string) => page.getByRole('button', { name, exact: true });
  const panel = tab('Input').locator('xpath=../..');

  const runNode = async () => {
    await panel.getByRole('button', { name: 'Run', exact: true }).click();
    const error = panel.getByText(/^Error:/);
    await expect.poll(async () => {
      if (await error.isVisible()) return 'error';
      return (await tab('Output').evaluate((el) => getComputedStyle(el).borderBottomColor)) ===
        'rgb(59, 130, 246)' ? 'output' : 'running';
    }, { timeout: 60_000 }).not.toBe('running');
    if (await error.isVisible()) {
      throw new Error(await error.innerText());
    }
  };

  // Import the tutorial dataset before capturing its output or running downstream nodes.
  const inputCSV = canvas.locator('.react-flow__node').filter({ hasText: /input csv/i }).first();
  await expect(inputCSV).toBeVisible({ timeout: 15_000 });
  await inputCSV.click();
  await panel.locator('input[type="file"]').setInputFiles(
    path.join(rootDir, 'tutorials/data_workflows/chick_diet.csv'),
  );
  const dataframeName = panel.getByPlaceholder('e.g., my_df or data.table1');
  if (await dataframeName.inputValue() !== 'diet_dat') {
    await dataframeName.fill('diet_dat');
  }
  await expect(panel.getByText('Selected: chick_diet.csv')).toBeVisible();
  const initialInputSize = await panel.boundingBox();
  if (!initialInputSize) throw new Error('Could not measure the Input CSV panel.');

  await runNode();
  await expect(panel.getByRole('table', { name: 'CSV preview' })).toBeVisible();

  const outputSize = await panel.boundingBox();
  await tab('R code').click();
  await expect(panel.locator('pre')).toBeVisible();
  const rCodeSize = await panel.boundingBox();
  await tab('Input').click();
  await expect(panel.getByText('Selected: chick_diet.csv')).toBeVisible();
  const inputSize = await panel.boundingBox();
  if (!outputSize || !rCodeSize || !inputSize) {
    throw new Error('Could not measure the Input CSV panel views.');
  }

  const csvHeight = Math.ceil(Math.max(
    initialInputSize.height, inputSize.height, outputSize.height, rCodeSize.height,
  ));
  const originalStyle = await panel.evaluate((el, height) => {
    const previous = { boxSizing: el.style.boxSizing, minHeight: el.style.minHeight };
    el.style.boxSizing = 'border-box';
    el.style.minHeight = `${height}px`;
    return previous;
  }, csvHeight);

  const csvViews = [
    { tab: 'Input', filename: 'tutorial_1a_inputcsv_input_panel.png' },
    { tab: 'Output', filename: 'tutorial_1a_inputcsv_output_panel.png' },
    { tab: 'R code', filename: 'tutorial_1a_inputcsv_r_panel.png' },
  ];
  let screenshotHeight: number | undefined;
  for (const view of csvViews) {
    await tab(view.tab).click();
    const screenshot = await panel.screenshot({ path: path.join(imagesDir, view.filename) });
    const height = screenshot.readUInt32BE(20);
    if (screenshotHeight === undefined) screenshotHeight = height;
    expect(height).toBe(screenshotHeight);
  }
  await panel.evaluate((el, previous) => {
    el.style.boxSizing = previous.boxSizing;
    el.style.minHeight = previous.minHeight;
  }, originalStyle);

  // Select the Histogram node so its configuration/output panel is the active focus.
  await histogram.click();

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
  await runNode();
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
