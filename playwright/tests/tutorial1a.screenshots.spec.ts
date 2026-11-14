import { test, expect } from '../fixtures';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const imagesDir = path.resolve(rootDir, 'tutorials/figs');

test.use({ deviceScaleFactor: 2 });

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
  await page.waitForLoadState('networkidle', { timeout: 15_000 });
  await card.getByRole('button', { name: /^Open/ }).click();
  const canvas = page.locator('.react-flow');
  await expect(canvas).toBeVisible({ timeout: 15_000 });

  // Remove only the tutorial dataset using the project's storage controls.
  const histogram = canvas.locator('.react-flow__node').filter({ hasText: /histogram/i }).first();
  await expect(histogram).toBeVisible({ timeout: 15_000 });
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
  const dataset = storage.getByText('diet_dat', { exact: true });
  const objectKey = (key: string | string[]) => Array.isArray(key) ? key[0] : key;
  if (storageData.objects.some((object: { key: string | string[] }) => objectKey(object.key) === 'diet_dat')) {
    const confirmation = page.waitForEvent('dialog');
    const deleteRequest = page.waitForRequest(
      (request) => request.method() === 'POST' && new URL(request.url()).pathname === '/delete_object',
      { timeout: 15_000 },
    );
    const deleteClick = dataset.locator('xpath=../..').getByTitle('Delete this object').click();
    const dialog = await confirmation;
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toBe('Delete "diet_dat"? This action cannot be undone.');
    await dialog.accept();
    await deleteClick;
    const deletionFetch = await deleteRequest;
    const result = await deletionFetch.response();
    if (!result) {
      throw new Error(`Could not delete diet_dat: ${deletionFetch.failure()?.errorText || 'request failed'}`);
    }
    expect(result.ok(), 'Could not delete diet_dat').toBe(true);
    const deletion = await result.json();
    if (!deletion.ok || objectKey(deletion.key) !== 'diet_dat') {
      throw new Error(`Could not delete diet_dat: ${deletion.error || 'unexpected response'}`);
    }
    const warning = deletion.warning ? objectKey(deletion.warning) : undefined;
    if (warning) console.warn('Project storage:', warning);
    await expect(dataset).toHaveCount(0);
  }
  await userMenuButton.click();

  // Capture the workflow only when every node is Pending, before executing any node.
  const workflowNodes = canvas.locator('.react-flow__node');
  const nodeCount = await workflowNodes.count();
  expect(nodeCount, 'The workflow contains no nodes').toBeGreaterThan(0);
  for (let index = 0; index < nodeCount; index++) {
    await expect(
      workflowNodes.nth(index),
      'Every workflow node must be Pending before the workflow screenshot',
    ).toContainText('? Pending');
  }
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

  // Capture the Density node's Input, Output, and R code panels.
  const density = canvas.locator('.react-flow__node').filter({ hasText: /density/i }).first();
  await expect(density).toBeVisible({ timeout: 15_000 });
  await density.click();
  await expect(panel).toBeVisible();
  await panel.screenshot({
    path: path.join(imagesDir, 'tutorial_1a_density_input.png'),
  });

  const densitySize = await panel.boundingBox();
  if (!densitySize) {
    throw new Error('Could not measure the Density panel before capturing screenshots.');
  }
  await panel.evaluate((el, { width, height }) => {
    el.style.boxSizing = 'border-box';
    el.style.width = `${width}px`;
    el.style.minHeight = `${height}px`;
  }, densitySize);
  const assertDensitySameSize = async () => {
    const box = await panel.boundingBox();
    expect(box?.width).toBeCloseTo(densitySize.width, 0);
    expect(box?.height).toBeCloseTo(densitySize.height, 0);
  };

  await runNode();
  await page.waitForTimeout(1500);
  await assertDensitySameSize();
  await panel.screenshot({
    path: path.join(imagesDir, 'tutorial_1a_density_output.png'),
  });

  await tab('R code').click();
  await page.waitForTimeout(500);
  await assertDensitySameSize();
  await panel.screenshot({
    path: path.join(imagesDir, 'tutorial_1a_density_r_code.png'),
  });

  // Capture a second Density configuration with diet selected as the fill variable.
  await tab('Input').click();
  const fillVariable = panel.getByRole('combobox', { name: 'Fill variable' });
  await fillVariable.selectOption({ label: 'diet' });
  await expect(fillVariable).toHaveValue('diet');
  await panel.screenshot({
    path: path.join(imagesDir, 'tutorial_1a_density_input2.png'),
  });

  await runNode();
  await expect(panel.getByRole('img', { name: 'Density plot of weight' })).toBeVisible();
  await page.waitForTimeout(1500);
  await assertDensitySameSize();
  await panel.screenshot({
    path: path.join(imagesDir, 'tutorial_1a_density_output2.png'),
  });

  await tab('R code').click();
  await page.waitForTimeout(500);
  await expect(panel.locator('pre')).toContainText('fill = diet');
  await assertDensitySameSize();
  await panel.screenshot({
    path: path.join(imagesDir, 'tutorial_1a_density_r_code2.png'),
  });

  // Capture the Boxplot node's Input, Output, and R code panels.
  const boxplot = canvas.locator('.react-flow__node').filter({ hasText: /boxplot/i }).first();
  await expect(boxplot).toBeVisible({ timeout: 15_000 });
  await boxplot.click();
  await expect(panel).toBeVisible();
  await panel.screenshot({
    path: path.join(imagesDir, 'tutorial_1a_boxplot_input_panel.png'),
  });

  const boxplotSize = await panel.boundingBox();
  if (!boxplotSize) {
    throw new Error('Could not measure the Boxplot panel before capturing screenshots.');
  }
  await panel.evaluate((el, { width, height }) => {
    el.style.boxSizing = 'border-box';
    el.style.width = `${width}px`;
    el.style.minHeight = `${height}px`;
  }, boxplotSize);
  const assertBoxplotSameSize = async () => {
    const box = await panel.boundingBox();
    expect(box?.width).toBeCloseTo(boxplotSize.width, 0);
    expect(box?.height).toBeCloseTo(boxplotSize.height, 0);
  };

  await runNode();
  await page.waitForTimeout(1500);
  await assertBoxplotSameSize();
  await panel.screenshot({
    path: path.join(imagesDir, 'tutorial_1a_boxplot_output_panel.png'),
  });

  await tab('R code').click();
  await page.waitForTimeout(500);
  await assertBoxplotSameSize();
  await panel.screenshot({
    path: path.join(imagesDir, 'tutorial_1a_boxplot_r_code_panel.png'),
  });

  // Capture the Summary node's Input, Output, and R code panels.
  const summary = canvas.locator('.react-flow__node').filter({ hasText: /summary/i }).first();
  await expect(summary).toBeVisible({ timeout: 15_000 });
  await summary.click();
  await expect(panel).toBeVisible();
  
  // Measure input panel height
  const inputBox = await panel.boundingBox();
  if (!inputBox) {
    throw new Error('Could not measure the Summary input panel.');
  }
  let maxHeight = inputBox.height;
  await panel.screenshot({
    path: path.join(imagesDir, 'tutorial_1a_summary_input_panel.png'),
  });

  // Run the node to generate output
  await runNode();
  await page.waitForTimeout(1500);

  // Measure output panel height
  const outputBox = await panel.boundingBox();
  if (!outputBox) {
    throw new Error('Could not measure the Summary output panel.');
  }
  maxHeight = Math.max(maxHeight, outputBox.height);
  await panel.screenshot({
    path: path.join(imagesDir, 'tutorial_1a_summary_output_panel.png'),
  });

  // Measure R code panel height
  await tab('R code').click();
  await page.waitForTimeout(500);
  const rCodeBox = await panel.boundingBox();
  if (!rCodeBox) {
    throw new Error('Could not measure the Summary R code panel.');
  }
  maxHeight = Math.max(maxHeight, rCodeBox.height);
  await panel.screenshot({
    path: path.join(imagesDir, 'tutorial_1a_summary_r_code_panel.png'),
  });

  // Capture the Means / SD node's Input, Output, and R code panels.
  const meanSD = canvas.locator('.react-flow__node').filter({ hasText: /mean/i }).first();
  await expect(meanSD).toBeVisible({ timeout: 15_000 });
  await meanSD.click();
  await expect(panel).toBeVisible();
  await panel.screenshot({
    path: path.join(imagesDir, 'tutorial_1a_mean_input_panel.png'),
  });

  const meanSDSize = await panel.boundingBox();
  if (!meanSDSize) {
    throw new Error('Could not measure the Means / SD panel before capturing screenshots.');
  }
  await panel.evaluate((el, { width, height }) => {
    el.style.boxSizing = 'border-box';
    el.style.width = `${width}px`;
    el.style.minHeight = `${height}px`;
  }, meanSDSize);
  const assertMeanSDSameSize = async () => {
    const box = await panel.boundingBox();
    expect(box?.width).toBeCloseTo(meanSDSize.width, 0);
    expect(box?.height).toBeCloseTo(meanSDSize.height, 0);
  };

  await runNode();
  await page.waitForTimeout(1500);
  await assertMeanSDSameSize();
  await panel.screenshot({
    path: path.join(imagesDir, 'tutorial_1a_mean_output_panel.png'),
  });

  await tab('R code').click();
  await page.waitForTimeout(500);
  await assertMeanSDSameSize();
  await panel.screenshot({
    path: path.join(imagesDir, 'tutorial_1a_mean_r_code_panel.png'),
  });

  // Capture the Barchart node's Input, Output, and R code panels.
  const barchart = canvas.locator('.react-flow__node').filter({ hasText: /barchart/i }).first();
  await expect(barchart).toBeVisible({ timeout: 15_000 });
  await barchart.click();
  await expect(panel).toBeVisible();
  await panel.screenshot({
    path: path.join(imagesDir, 'tutorial_1a_barchart_input_panel.png'),
  });

  const barchartSize = await panel.boundingBox();
  if (!barchartSize) {
    throw new Error('Could not measure the Barchart panel before capturing screenshots.');
  }
  await panel.evaluate((el, { width, height }) => {
    el.style.boxSizing = 'border-box';
    el.style.width = `${width}px`;
    el.style.minHeight = `${height}px`;
  }, barchartSize);
  const assertBarchartSameSize = async () => {
    const box = await panel.boundingBox();
    expect(box?.width).toBeCloseTo(barchartSize.width, 0);
    expect(box?.height).toBeCloseTo(barchartSize.height, 0);
  };

  await runNode();
  await page.waitForTimeout(1500);
  await assertBarchartSameSize();
  await panel.screenshot({
    path: path.join(imagesDir, 'tutorial_1a_barchart_output_panel.png'),
  });

  await tab('R code').click();
  await page.waitForTimeout(500);
  await assertBarchartSameSize();
  await panel.screenshot({
    path: path.join(imagesDir, 'tutorial_1a_barchart_r_code_panel.png'),
  });
});
