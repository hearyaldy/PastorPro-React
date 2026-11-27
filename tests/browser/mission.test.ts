import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright-core';
test('mission summary filters reconciliation, exports scoped reports, preserves period, and marks partial data', async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${process.env.REPORT_TEST_ORIGIN || 'http://127.0.0.1:3000'}/tests/fixtures/mission.html`);
    await page.getByRole('heading', { name: 'District Reconciliation' }).waitFor();
    assert.ok(await page.getByText('1 / 2 churches · 50% visible').isVisible());
    await page.getByLabel('Search reconciliation').fill('South');
    const reconciliation = page.locator('section').filter({ has: page.getByRole('heading', { name: 'District Reconciliation' }) });
    assert.ok(await reconciliation.getByRole('cell', { name: 'South District', exact: true }).isVisible());
    assert.equal(await reconciliation.getByRole('cell', { name: 'North District', exact: true }).count(), 0);
    await page.getByLabel('Reconciliation status').selectOption('match');
    assert.ok(await page.getByText('No districts match the current filters.').isVisible());
    await page.getByLabel('Reconciliation status').selectOption('all');
    const excelEvent = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export Excel', exact: true }).click();
    assert.ok((await excelEvent).suggestedFilename().endsWith('.xlsx'));
    await page.getByRole('button', { name: 'Preview / Print Reporting', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.report-preview iframe')?.getAttribute('src')?.startsWith('blob:'));
    const pdfEvent = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
    assert.ok((await pdfEvent).suggestedFilename().endsWith('.pdf')); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'View Financial Reports for November 2026', exact: true }).click();
    assert.ok((await page.getByLabel('Navigation context').textContent())?.includes('"month":11'));
    await page.getByRole('button', { name: 'Toggle Partial Access' }).click();
    assert.ok(await page.getByText('Full coverage cannot be confirmed.', { exact: false }).isVisible());
    await page.screenshot({ path: '/private/tmp/pastorpro-mission-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: '/private/tmp/pastorpro-mission-mobile.png' });
    await page.getByRole('heading', { name: 'Monthly Ministry Statistics' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/private/tmp/pastorpro-mission-mobile-ministry.png' });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
