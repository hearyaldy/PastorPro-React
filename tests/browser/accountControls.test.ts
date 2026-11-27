import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright-core';
test('privacy and deletion pages are public, and deletion requires identity/confirmation and reports service failures honestly', async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const origin = process.env.REPORT_TEST_ORIGIN || 'http://127.0.0.1:3000';
    await page.goto(`${origin}/privacy-policy`);
    await page.getByRole('heading', { name: 'Privacy policy', exact: true }).waitFor();
    assert.ok(await page.getByRole('heading', { name: 'Retention and account deletion' }).isVisible());
    assert.ok(await page.getByRole('link', { name: 'Account deletion', exact: true }).isVisible());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: '/private/tmp/pastorpro-privacy-mobile.png', fullPage: true });
    await page.goto(`${origin}/account-deletion`);
    await page.getByRole('heading', { name: 'Account deletion', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Sign in to continue', exact: true }).waitFor();
    await page.goto(`${origin}/tests/fixtures/account-controls.html`);
    const submit = page.getByRole('button', { name: 'Verify identity and request deletion' });
    assert.ok(await submit.isDisabled());
    await page.getByLabel('Type DELETE to confirm', { exact: true }).fill('DELETE');
    assert.ok(await submit.isDisabled());
    await page.getByLabel('I understand that my account', { exact: false }).check();
    assert.ok(await submit.isEnabled());
    await submit.click();
    await page.getByRole('alert').waitFor();
    assert.ok((await page.getByRole('alert').textContent())?.includes('Your account has not been deleted'));
    await page.getByRole('combobox', { name: 'Sign-in method' }).selectOption('password');
    assert.ok(await submit.isDisabled());
    await page.getByLabel('Current password', { exact: true }).fill('sample-only');
    await page.getByLabel('Simulate unavailable service').uncheck();
    await page.screenshot({ path: '/private/tmp/pastorpro-delete-account-mobile.png', fullPage: true });
    await submit.click();
    await page.getByRole('heading', { name: 'Deletion request accepted for processing' }).waitFor();
  } finally { await browser.close(); }
});
