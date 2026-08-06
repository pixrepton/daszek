/**
 * X1-02 — hermetic Playwright: exceptions_only preference survives reload.
 * No WP login / no live Node B — exercises preference helpers + endpoint wiring.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const tempCandidates = [
  path.join(process.env.TEMP || '/tmp', 'pw-stale-proof', 'node_modules', 'playwright'),
  path.join(process.env.TEMP || '/tmp', 'pw-x1-02-proof', 'node_modules', 'playwright'),
];
const tempPw = tempCandidates.find((candidate) => fs.existsSync(candidate));
const { chromium } = require(tempPw || 'playwright');
const APP_JS = path.join(__dirname, '..', 'public', 'app.js');
const SOURCE = fs.readFileSync(APP_JS, 'utf8');

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = SOURCE.indexOf(marker);
  if (start < 0) throw new Error(`missing ${name}`);
  const bodyStart = SOURCE.indexOf('{', start);
  let depth = 1;
  let index = bodyStart + 1;
  while (depth > 0 && index < SOURCE.length) {
    const ch = SOURCE[index];
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    index += 1;
  }
  return SOURCE.slice(start, index);
}

const STORAGE_KEY_LINE = SOURCE.match(/const EXCEPTIONS_ONLY_STORAGE_KEY = '[^']+';/);
if (!STORAGE_KEY_LINE) throw new Error('missing EXCEPTIONS_ONLY_STORAGE_KEY');

const pageHtml = [
  '<!doctype html><html><body>',
  '<label><input type="checkbox" data-exceptions-only-toggle /> Tylko wyjątki</label>',
  '<div id="status"></div>',
  '<script>',
  STORAGE_KEY_LINE[0],
  'window.state = { exceptionsOnlyView: false };',
  extractFunction('readExceptionsOnlyPreference'),
  extractFunction('setExceptionsOnlyView'),
  extractFunction('operationalFeedLatestEndpoint'),
  `window.boot = () => {
    window.state.exceptionsOnlyView = readExceptionsOnlyPreference();
    const el = document.querySelector('[data-exceptions-only-toggle]');
    el.checked = !!window.state.exceptionsOnlyView;
    el.addEventListener('change', () => {
      setExceptionsOnlyView(!!el.checked);
      document.getElementById('status').textContent = operationalFeedLatestEndpoint();
    });
    document.getElementById('status').textContent = operationalFeedLatestEndpoint();
  };`,
  'window.boot();',
  '</script></body></html>',
].join('\n');

function startServer() {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(pageHtml);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

async function run() {
  const { server, origin } = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(origin, { waitUntil: 'domcontentloaded' });

    const before = await page.evaluate(() => ({
      checked: document.querySelector('[data-exceptions-only-toggle]').checked,
      endpoint: document.getElementById('status').textContent,
      local: localStorage.getItem('daszek-exceptions-only-view'),
    }));
    assert.equal(before.checked, false);
    assert.equal(before.endpoint, '/operational-feed-snapshots/latest');
    assert.equal(before.local, null);

    await page.check('[data-exceptions-only-toggle]');
    const afterToggle = await page.evaluate(() => ({
      checked: document.querySelector('[data-exceptions-only-toggle]').checked,
      endpoint: document.getElementById('status').textContent,
      local: localStorage.getItem('daszek-exceptions-only-view'),
      session: sessionStorage.getItem('daszek-exceptions-only-view'),
    }));
    assert.equal(afterToggle.checked, true);
    assert.equal(afterToggle.endpoint, '/operational-feed-snapshots/latest?exceptions_only=1');
    assert.equal(afterToggle.local, '1');
    assert.equal(afterToggle.session, null);

    // Preference must survive session reload (same origin).
    await page.reload({ waitUntil: 'domcontentloaded' });
    const afterReload = await page.evaluate(() => ({
      checked: document.querySelector('[data-exceptions-only-toggle]').checked,
      endpoint: document.getElementById('status').textContent,
      local: localStorage.getItem('daszek-exceptions-only-view'),
      state: window.state.exceptionsOnlyView,
    }));
    assert.equal(afterReload.local, '1');
    assert.equal(afterReload.state, true);
    assert.equal(afterReload.checked, true);
    assert.equal(afterReload.endpoint, '/operational-feed-snapshots/latest?exceptions_only=1');

    // Migration: sessionStorage '1' becomes durable localStorage.
    const page2 = await context.newPage();
    await page2.addInitScript(() => {
      localStorage.removeItem('daszek-exceptions-only-view');
      sessionStorage.setItem('daszek-exceptions-only-view', '1');
    });
    await page2.goto(origin, { waitUntil: 'domcontentloaded' });
    const migrated = await page2.evaluate(() => ({
      local: localStorage.getItem('daszek-exceptions-only-view'),
      session: sessionStorage.getItem('daszek-exceptions-only-view'),
      checked: document.querySelector('[data-exceptions-only-toggle]').checked,
    }));
    assert.equal(migrated.local, '1');
    assert.equal(migrated.session, null);
    assert.equal(migrated.checked, true);

    console.log('PLAYWRIGHT_X1_02_EXCEPTIONS_ONLY_PREFERENCE PASS');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
