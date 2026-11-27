import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { chromium, type Browser, type Page } from 'playwright-core';

let browser: Browser;
let page: Page;
const errors: string[] = [];
before(async () => {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${process.env.REPORT_TEST_ORIGIN || 'http://127.0.0.1:3000'}/tests/fixtures/reports.html`);
  await page.getByRole('heading', { name: 'Pastoral Statistics & Reports' }).waitFor();
});
after(async () => { await browser?.close(); });

test('Flutter-style statistics and tables render at desktop and mobile widths', async () => {
  assert.equal(await page.getByText('500.0 km', { exact: true }).count(), 1);
  assert.equal(await page.getByText('Church Membership Statistics', { exact: true }).count(), 1);
  await page.screenshot({ path: '/private/tmp/pastorpro-statistics-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: '/private/tmp/pastorpro-statistics-mobile.png', fullPage: true });
});

test('all report previews generate downloadable PDFs and close with Escape', async () => {
  for (const name of ['Activities', 'Borang B', 'Financial', 'Quarterly']) {
    await page.getByRole('button', { name: `Preview ${name}`, exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await page.waitForFunction(() => Boolean(document.querySelector('.report-preview iframe')?.getAttribute('src')?.startsWith('blob:')));
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
    const download = await downloadEvent;
    const path = await download.path();
    assert.ok(path); assert.ok(download.suggestedFilename().endsWith('.pdf'));
    const contents = await readFile(path!);
    assert.equal(contents.subarray(0, 5).toString(), '%PDF-');
    if (name === 'Borang B') {
      assert.ok(contents.toString().includes('Kiulu'));
      assert.ok(!contents.toString().includes('iqatSkQaKBhoOZgD0Dhn'));
      await page.screenshot({ path: '/private/tmp/pastorpro-borang-preview.png' });
    }
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await page.getByRole('button', { name: `Preview ${name}`, exact: true }).evaluate(element => document.activeElement === element), true);
  }
  assert.deepEqual(errors, []);
});
