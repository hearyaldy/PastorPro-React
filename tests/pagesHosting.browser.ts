import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright-core';

test('GitHub Pages artifact loads app assets and public pages under its repository subpath', async () => {
  const root = resolve('dist-pages');
  const server = createServer(async (req, res) => {
    const path = new URL(req.url!, 'http://localhost').pathname;
    if (!path.startsWith('/PastorPro-React/')) { res.writeHead(404).end(); return; }
    const file = resolve(root, `.${path.slice('/PastorPro-React'.length)}${path.endsWith('/') ? 'index.html' : ''}`);
    if (!file.startsWith(`${root}/`)) { res.writeHead(404).end(); return; }
    try {
      const types: Record<string, string> = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
      res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
      res.end(await readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address() as { port: number };
  const origin = process.env.PAGES_TEST_ORIGIN || `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().startsWith(origin) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    await page.goto(`${origin}/PastorPro-React/`);
    assert.equal(await page.locator('.webapp-link').first().getAttribute('href'), 'https://hearyaldy.github.io/PastorPro-React/app/');
    if (process.env.PAGES_TEST_ORIGIN) await page.locator('.webapp-link').first().click();
    else await page.goto(`${origin}/PastorPro-React/app/`);
    await page.getByRole('heading', { name: 'Unified pastoral ledgers, monthly Borang B, and mission governance.', exact: true }).waitFor();
    // Exercise the actual cascade: a dark class alone can hide palette conflicts.
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const [label, canvas] of [
      ['Alabaster Forest', '#F2F0E9'], ['Nordic Navy', '#E8EEF6'],
      ['Coastal Teal', '#E5F0EE'], ['Rosewood Parchment', '#F4EAEB'],
      ['Sandstone Olive', '#F1EDE0'],
    ]) {
      await page.getByRole('button', { name: `Select ${label} theme`, exact: true }).click();
      await page.waitForFunction(expected => getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim().toLowerCase() === expected.toLowerCase() && getComputedStyle(document.documentElement).colorScheme === 'light', canvas);
      await page.getByRole('button', { name: 'Toggle dark mode', exact: true }).click();
      await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim().toLowerCase() === '#0b1117' && getComputedStyle(document.documentElement).colorScheme === 'dark');
      assert.equal(await page.locator('html').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(11, 17, 23)');
      assert.equal(await page.locator('html').evaluate(node => getComputedStyle(node).color), 'rgb(241, 245, 249)');
    }
    await page.reload();
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim().toLowerCase() === '#0b1117');
    await page.getByRole('button', { name: 'Toggle dark mode', exact: true }).click();
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim().toLowerCase() === '#f1ede0');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('link', { name: 'Privacy policy', exact: true }).click();
    assert.equal(new URL(page.url()).pathname, '/PastorPro-React/app/privacy-policy/');
    await page.getByRole('heading', { name: 'Privacy policy', exact: true }).waitFor();
    await page.reload();
    await page.getByRole('heading', { name: 'Privacy policy', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Account deletion', exact: true }).click();
    assert.equal(new URL(page.url()).pathname, '/PastorPro-React/app/account-deletion/');
    await page.getByRole('heading', { name: 'Account deletion', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Sign in to continue', exact: true }).waitFor();
    await page.reload();
    await page.getByRole('heading', { name: 'Account deletion', exact: true }).waitFor();
    await page.getByRole('link', { name: 'WebApp', exact: true }).click();
    assert.equal(new URL(page.url()).pathname, '/PastorPro-React/app/');
    await page.getByRole('heading', { name: 'Unified pastoral ledgers, monthly Borang B, and mission governance.', exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (process.env.PAGES_TEST_ORIGIN) {
      await page.getByRole('link', { name: 'Home — PastorPro landing page', exact: true }).click();
      await page.getByRole('heading', { name: 'More time for ministry. Less time on paperwork.' }).waitFor();
      assert.equal(new URL(page.url()).pathname, '/PastorPro-React/');
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.closeAllConnections();
    await new Promise<void>(done => server.close(() => done()));
  }
});
