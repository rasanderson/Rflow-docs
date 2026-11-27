import { test, expect } from '../fixtures';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const imagesDir = path.resolve(rootDir, 'tutorials/figs');

test.use({ deviceScaleFactor: 2 });

test('capture tutorial 1b workflow and nodes', async ({ page }) => {
  // Setup: create the folder that will hold the captured screenshots.
  await mkdir(imagesDir, { recursive: true });

  // Start from the project list and make the page large enough to capture the full panel.
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/projects');

  // Find the Tutorial 1B project card, then open it to enter the workflow canvas.
  const card = page
    .locator('article.project-card')
    .filter({ has: page.getByRole('heading', { name: /Tutorial 1b/i }) })
    .first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 });
  await card.getByRole('button', { name: /^Open/ }).click();
  const canvas = page.locator('.react-flow');
  await expect(canvas).toBeVisible({ timeout: 15_000 });

  // Remove only the tutorial dataset using the project's storage controls.
  const inputNode = canvas.locator('.react-flow__node').filter({ hasText: /input csv/i }).first();
  await expect(inputNode).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Project loaded successfully')).toBeHidden({ timeout: 15_000 });

  const userMenuButton = page.locator('.panel-left .user-button');
  await userMenuButton.click();
  const storageRequest = page.waitForRequest(
    (request) => request.method() === 'GET' && new URL(request.url()).pathname === '/storage_objects',
    { timeout: 15_000 },
  );
  await page.getByRole('button', { name: /manage project storage/i }).click();
  const storageFetch = await storageRequest;
  const storageResult = await storageFetch.response();
  if (!storageResult) {
    throw new Error(`Could not load project storage: ${storageFetch.failure()?.errorText || 'request failed'}`);
  }
  expect(storageResult.ok(), 'Could not load project storage').toBe(true);
  const storageData = await storageResult.json();
  if (storageData.error || !Array.isArray(storageData.objects)) {
    throw new Error(`Could not load project storage: ${storageData.error || 'invalid object list'}`);
  }

  const storage = page.getByRole('heading', { name: 'Stored Objects' }).locator('..');
  await expect(storage.getByTitle('Delete this object')).toHaveCount(storageData.objects.length);
  await page.waitForLoadState('networkidle', { timeout: 15_000 });
  const dataset = storage.getByText('chick_dat', { exact: true });
  const objectKey = (key: string | string[]) => Array.isArray(key) ? key[0] : key;
  if (storageData.objects.some((object: { key: string | string[] }) => objectKey(object.key) === 'chick_dat')) {
    const confirmation = page.waitForEvent('dialog');
    const deleteRequest = page.waitForRequest(
      (request) => request.method() === 'POST' && new URL(request.url()).pathname === '/delete_object',
      { timeout: 15_000 },
    );
    const deleteClick = dataset.locator('xpath=../..').getByTitle('Delete this object').click();
    const dialog = await confirmation;
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toBe('Delete "chick_dat"? This action cannot be undone.');
    await dialog.accept();
    await deleteClick;
    const deletionFetch = await deleteRequest;
    const result = await deletionFetch.response();
    if (!result) {
      throw new Error(`Could not delete chick_dat: ${deletionFetch.failure()?.errorText || 'request failed'}`);
    }
    expect(result.ok(), 'Could not delete chick_dat').toBe(true);
    const deletion = await result.json();
    if (!deletion.ok || objectKey(deletion.key) !== 'chick_dat') {
      throw new Error(`Could not delete chick_dat: ${deletion.error || 'unexpected response'}`);
    }
    const warning = deletion.warning ? objectKey(deletion.warning) : undefined;
    if (warning) console.warn('Project storage:', warning);
    await expect(dataset).toHaveCount(0);
  }
  await userMenuButton.click();

  // Capture the workflow before executing nodes.
  const workflowNodes = canvas.locator('.react-flow__node');
  const nodeCount = await workflowNodes.count();
  expect(nodeCount, 'The workflow contains no nodes').toBeGreaterThan(0);
  await canvas.locator('.react-flow__controls-fitview').click();
  await canvas.screenshot({
    path: path.join(imagesDir, 'tutorial_1b_workflow.png'),
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
    path.join(rootDir, 'tutorials/data_workflows/chick_growth.csv'),
  );
  const dataframeName = panel.getByPlaceholder('e.g., my_df or data.table1');
  if (await dataframeName.inputValue() !== 'chick_dat') {
    await dataframeName.fill('chick_dat');
  }
  await expect(panel.getByText('Selected: chick_growth.csv')).toBeVisible();
  const initialInputSize = await panel.boundingBox();
  if (!initialInputSize) throw new Error('Could not measure the Input CSV panel.');

  await runNode();
  await expect(panel.getByRole('table', { name: 'CSV preview' })).toBeVisible();

  const outputSize = await panel.boundingBox();
  await tab('R code').click();
  await expect(panel.locator('pre')).toBeVisible();
  const rCodeSize = await panel.boundingBox();
  await tab('Input').click();
  await expect(panel.getByText('Selected: chick_growth.csv')).toBeVisible();
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
    { tab: 'Input', filename: 'tutorial_1b_inputcsv_input_panel.png' },
    { tab: 'Output', filename: 'tutorial_1b_inputcsv_output_panel.png' },
    { tab: 'R code', filename: 'tutorial_1b_inputcsv_r_panel.png' },
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

  const capturePanelViews = async (prefix: string, waitForView?: (name: string) => Promise<void>) => {
    const views = [
      { tab: 'Input', filename: `${prefix}_input_panel.png` },
      { tab: 'Output', filename: `${prefix}_output_panel.png` },
      { tab: 'R code', filename: `${prefix}_r_panel.png` },
    ];
    const heights: number[] = [];
    for (const view of views) {
      await tab(view.tab).click();
      await waitForView?.(view.tab);
      const box = await panel.boundingBox();
      if (!box) throw new Error(`Could not measure the ${view.tab} panel for ${prefix}.`);
      heights.push(box.height);
    }

    const previousStyle = await panel.evaluate((el, height) => {
      const previous = { boxSizing: el.style.boxSizing, minHeight: el.style.minHeight };
      el.style.boxSizing = 'border-box';
      el.style.minHeight = `${height}px`;
      return previous;
    }, Math.ceil(Math.max(...heights)));

    let screenshotHeight: number | undefined;
    for (const view of views) {
      await tab(view.tab).click();
      await waitForView?.(view.tab);
      const screenshot = await panel.screenshot({ path: path.join(imagesDir, view.filename) });
      const height = screenshot.readUInt32BE(20);
      if (screenshotHeight === undefined) screenshotHeight = height;
      expect(height).toBe(screenshotHeight);
    }
    await panel.evaluate((el, previous) => {
      el.style.boxSizing = previous.boxSizing;
      el.style.minHeight = previous.minHeight;
    }, previousStyle);
  };

  // Capture the Summary node's Input, Output, and R code panels.
  const summary = canvas.locator('.react-flow__node').filter({ hasText: /summary/i }).first();
  await expect(summary).toBeVisible({ timeout: 15_000 });
  await summary.click();
  await expect(panel).toBeVisible();
  await runNode();
  await expect(panel.getByRole('table', { name: 'Numeric summary statistics table' })).toBeVisible();
  await capturePanelViews('tutorial_1b_summary');

  // Capture the Scatterplot node's Input, Output, and R code panels.
  const scatterplot = canvas.locator('.react-flow__node').filter({ hasText: /scatterplot/i }).first();
  await expect(scatterplot).toBeVisible({ timeout: 15_000 });
  await scatterplot.click();
  await expect(panel).toBeVisible();
  const xColumn = panel.getByRole('combobox', { name: 'X Column' });
  const yColumn = panel.getByRole('combobox', { name: 'Y Column' });
  await expect(xColumn.locator('option[value="time"]')).toHaveCount(1);
  await expect(yColumn.locator('option[value="weight"]')).toHaveCount(1);
  await xColumn.selectOption('time');
  await yColumn.selectOption('weight');
  await runNode();
  const plot = panel.getByRole('img', { name: 'Scatterplot time vs weight' });
  await expect(plot).toBeVisible();
  await capturePanelViews('tutorial_1b_scatterplot', async (name) => {
    if (name === 'Input') {
      await expect(xColumn).toBeEnabled();
      await expect(xColumn.locator('option[value="time"]')).toHaveCount(1);
      await expect(panel.getByText('Loading columns…')).toBeHidden();
    } else if (name === 'Output') {
      await expect(plot).toBeVisible();
      await plot.evaluate((el) => {
        if (!(el instanceof HTMLImageElement)) throw new Error('Scatterplot output is not an image.');
        return el.decode();
      });
    }
  });
});
