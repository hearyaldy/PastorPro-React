import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright-core';
import { BORANG_B_SECTIONS, BORANG_B_TEXT_FIELDS, emptyBorangB } from '../../src/lib/borangB';

test('Borang B form sections retain every answer, review before submission, and respect blocked saves', async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${process.env.REPORT_TEST_ORIGIN || 'http://127.0.0.1:3000'}/tests/fixtures/borang-b-form.html`);
    const expected = emptyBorangB();
    let count = 0;
    assert.equal(await page.getByRole('button', { name: 'Submit Report', exact: true }).count(), 0);
    for (const section of BORANG_B_SECTIONS) {
      await page.getByRole('heading', { name: section.title, exact: true }).waitFor();
      for (const [field, label] of section.fields) {
        expected[field] = field === 'tithe' || field === 'offerings' ? 123.45 : count++;
        await page.getByLabel(label, { exact: true }).fill(String(expected[field]));
      }
      if (section === BORANG_B_SECTIONS[0]) {
        await page.getByLabel('Simulate conflict').check();
        assert.ok(await page.getByLabel('Members at Beginning', { exact: true }).isDisabled());
        assert.ok(await page.getByRole('button', { name: 'Save Draft / Changes', exact: true }).isDisabled());
        await page.getByLabel('Simulate conflict').uncheck();
        await page.getByRole('button', { name: 'Save Draft / Changes', exact: true }).click();
        assert.equal(JSON.parse((await page.getByLabel('Saved report').textContent())!).status, 'draft');
        await page.screenshot({ path: '/private/tmp/pastorpro-borang-form-desktop.png', fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.getByRole('button', { name: 'Toggle dark mode', exact: true }).click();
        await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim().toLowerCase() === '#0b1117');
        await page.screenshot({ path: '/private/tmp/pastorpro-borang-form-mobile-dark.png', fullPage: true });
      }
      await page.getByRole('button', { name: 'Next', exact: true }).click();
    }
    for (const [field, label] of BORANG_B_TEXT_FIELDS) {
      expected[field] = `${label}: follow up with families.\nMonthly notes.`;
      await page.getByLabel(label, { exact: true }).fill(expected[field]);
    }
    await page.getByRole('button', { name: 'Review report', exact: true }).click();
    await page.getByRole('heading', { name: 'Review your report', exact: true }).waitFor();
    assert.ok(await page.getByText('RM 123.45', { exact: true }).count() >= 2);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    assert.equal(await page.getByLabel('Remarks', { exact: true }).inputValue(), expected.remarks);
    await page.getByLabel('Go to section', { exact: true }).selectOption('0');
    assert.equal(await page.getByLabel('Members at End', { exact: true }).inputValue(), String(expected.membersEnd));
    await page.getByLabel('Go to section', { exact: true }).selectOption('8');
    await page.getByLabel('Simulate save failure').check();
    await page.getByRole('button', { name: 'Submit Report', exact: true }).click();
    await page.getByRole('alert').waitFor();
    assert.ok(await page.getByRole('heading', { name: 'Review your report', exact: true }).isVisible());
    await page.getByLabel('Simulate conflict').check();
    assert.ok(await page.getByRole('button', { name: 'Submit Report', exact: true }).isDisabled());
    await page.getByLabel('Simulate conflict').uncheck();
    await page.getByLabel('Simulate save failure').uncheck();
    await page.getByRole('button', { name: 'Submit Report', exact: true }).click();
    assert.deepEqual(JSON.parse((await page.getByLabel('Saved report').textContent())!), { ...expected, status: 'submitted' });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
