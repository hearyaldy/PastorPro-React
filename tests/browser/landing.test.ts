import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
test('landing page is responsive, sample tabs work, and WebApp uses the local app or honest public setup state', async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    const origin = process.env.REPORT_TEST_ORIGIN || 'http://127.0.0.1:3000';
    await page.goto(`${origin}/landing/`);
    await page.getByRole('heading', { name: 'More time for ministry. Less time on paperwork.' }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'WebApp', exact: false }).first().getAttribute('href'), `${origin}/`);
    await page.getByRole('tab', { name: 'Reports', exact: true }).click();
    assert.ok(await page.getByRole('heading', { name: 'Clear questions. Complete reports.' }).isVisible());
    await page.getByRole('tab', { name: 'Reports', exact: true }).press('End');
    assert.equal(await page.getByRole('tab', { name: 'Activities', exact: true }).getAttribute('aria-selected'), 'true');
    await page.getByRole('tab', { name: 'Overview', exact: true }).click();
    await page.screenshot({ path: '/private/tmp/pastorpro-landing-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobile.goto(`${origin}/landing/`);
    await mobile.screenshot({ path: '/private/tmp/pastorpro-landing-mobile.png' });
    await mobile.close();
    await page.getByRole('link', { name: 'Privacy & your data' }).click();
    assert.equal(await page.locator('#privacy').getAttribute('open'), '');
    // Simulate a published static host without making requests to that host.
    await page.route('https://landing.example/**', async route => {
      const path = new URL(route.request().url()).pathname;
      const name = path === '/' ? 'index.html' : path.slice(1);
      const types: Record<string, string> = { html: 'text/html', css: 'text/css', js: 'application/javascript', svg: 'image/svg+xml' };
      try { await route.fulfill({ body: await readFile(`landing/${name}`), contentType: types[name.split('.').at(-1)!] || 'text/plain' }); }
      catch { await route.fulfill({ status: 404, body: 'Not found' }); }
    });
    await page.goto('https://landing.example/');
    await page.getByRole('link', { name: 'WebApp', exact: false }).first().click();
    await page.getByRole('dialog').waitFor();
    assert.ok(await page.getByRole('heading', { name: 'The WebApp link is being prepared.' }).isVisible());
    await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog').count(), 0);
    await page.route('https://landing.example/config.js', route => route.fulfill({ contentType: 'application/javascript', body: "window.PASTORPRO_WEBAPP_URL='https://workspace.example/';" }));
    await page.reload();
    await page.waitForFunction(() => document.querySelector('.webapp-link')?.getAttribute('href') === 'https://workspace.example/');
    assert.equal(await page.locator('.webapp-link').count(), 3);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
