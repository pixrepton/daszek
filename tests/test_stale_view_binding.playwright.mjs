/**
 * AI-OS-DASZEK-STALE-VIEW-BINDING-01 — Playwright proof (no live send, no WP login).
 *
 * Proves the operator-facing binding in real Chromium:
 * 1) approve of the current previewed version sends expected_body_hash (+ revision)
 * 2) stale expected_body_hash is rejected (409) and UI refreshes with an explicit message
 * 3) /agent-hitl/send is never called
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const tempPw = path.join(process.env.TEMP || '/tmp', 'pw-stale-proof', 'node_modules', 'playwright');
const { chromium } = require(fs.existsSync(tempPw) ? tempPw : 'playwright');
const APP_JS = path.join(__dirname, '..', 'public', 'app.js');
const SOURCE = fs.readFileSync(APP_JS, 'utf8');

function extractAssignment(name) {
  const marker = `${name} = async function(`;
  const start = SOURCE.lastIndexOf(marker);
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
  // include trailing `};`
  while (index < SOURCE.length && SOURCE[index] !== ';') index += 1;
  return SOURCE.slice(start, index + 1);
}

const submitFn = extractAssignment('submitHitlAgentAction');

const pageHtml = [
  '<!doctype html><html><body>',
  '<textarea data-hitl-draft data-hitl-draft-id="draft_pw_1" data-hitl-body-hash="previewhashpw0001" data-hitl-revision="1">Podgladany draft</textarea>',
  '<button id="approve" data-hitl-approve="eng_pw" data-hitl-case="case_pw" data-hitl-note="desk-eng_pw" data-hitl-action="draft_reply" data-hitl-draft-id="draft_pw_1" data-hitl-body-hash="previewhashpw0001" data-hitl-revision="1">Zatwierdz</button>',
  '<script>',
  'window.__calls = { fetch: [], toasts: [], errors: [], loadAllData: 0, openCaseDetail: [], openNoteDetail: [] };',
  "window.V2_API_BASE = '/wp-json/daszek/v2';",
  "window.state = { currentUser: 'konrad', hitlAction: { pending: false, awaitingSync: false, engagementId: '', kind: '', noteId: '', decisionKey: '', status: '' }, detail: null };",
  'window.showToast = (m) => window.__calls.toasts.push(String(m || ""));',
  'window.showError = (m) => window.__calls.errors.push(String(m || ""));',
  'window.renderDetailPanel = () => {};',
  'window.loadAllData = async () => { window.__calls.loadAllData += 1; };',
  'window.openCaseDetail = async (id) => { window.__calls.openCaseDetail.push(String(id || "")); };',
  'window.openNoteDetail = async (id) => { window.__calls.openNoteDetail.push(String(id || "")); };',
  "window.resolveHitlDecisionConvergence = () => ({ converged: false, status: '' });",
  `window.apiFetch = async (base, endpoint, options = {}) => {
  window.__calls.fetch.push({ base, endpoint, options });
  const body = options && options.body ? JSON.parse(options.body) : {};
  if (String(endpoint || '').includes('/agent-hitl/send')) {
    throw new Error('SEND_MUST_NOT_BE_CALLED');
  }
  if (body.expected_body_hash === 'previewhashpw0001') {
    return {
      ok: true,
      decision_key: 'bq_pw_ok',
      decision_status: 'approved',
      execution_status: 'not_applicable',
      delivery_mode: 'manual_operator',
      effect_started: false,
    };
  }
  const err = new Error(
    "body_hash mismatch for action_id 'draft_reply': expected 'stalehashpw000002', current is 'previewhashpw0001' (revision 1) — stale draft, refetch before approving"
  );
  err.status = 409;
  throw err;
};`,
  submitFn,
  '</script></body></html>',
].join('\n');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(pageHtml, { waitUntil: 'domcontentloaded' });
  const boot = await page.evaluate(() => typeof window.submitHitlAgentAction);
  assert.equal(boot, 'function');

  // 1) Current version approve PASS + sends expected_body_hash; no send endpoint.
  const step1 = await page.evaluate(async () => {
    await window.submitHitlAgentAction(document.getElementById('approve'), 'approve');
    return window.__calls;
  });
  assert.equal(step1.fetch.length, 1);
  assert.equal(step1.fetch[0].endpoint, '/agent-hitl/approve');
  const okBody = JSON.parse(step1.fetch[0].options.body);
  assert.equal(okBody.expected_body_hash, 'previewhashpw0001');
  assert.equal(okBody.expected_revision, 1);
  assert.equal(okBody.draft_id, 'draft_pw_1');
  assert.equal(okBody.draft_pl, 'Podgladany draft');
  assert.ok(step1.toasts.length >= 1);
  assert.equal(step1.errors.length, 0);
  assert.ok(!step1.fetch.some((c) => String(c.endpoint).includes('/agent-hitl/send')));

  // 2) Stale expected hash REJECT + refresh + operator message; still no send.
  const afterStale = await page.evaluate(async () => {
    window.__calls.fetch = [];
    window.__calls.toasts = [];
    window.__calls.errors = [];
    window.__calls.loadAllData = 0;
    window.__calls.openCaseDetail = [];
    // Clear prior awaitingSync so a second approve attempt is allowed.
    window.state.hitlAction = {
      pending: false,
      awaitingSync: false,
      engagementId: '',
      kind: '',
      noteId: '',
      decisionKey: '',
      status: '',
    };
    const btn = document.getElementById('approve');
    btn.dataset.hitlBodyHash = 'stalehashpw000002';
    await window.submitHitlAgentAction(btn, 'approve');
    return window.__calls;
  });
  assert.equal(afterStale.fetch.length, 1);
  assert.equal(afterStale.fetch[0].endpoint, '/agent-hitl/approve');
  assert.equal(afterStale.loadAllData, 1);
  assert.deepEqual(afterStale.openCaseDetail, ['case_pw']);
  assert.match(afterStale.errors[0] || '', /zmienila sie od czasu podgladu/i);
  assert.ok(!afterStale.fetch.some((c) => String(c.endpoint).includes('/agent-hitl/send')));

  await browser.close();
  console.log('PLAYWRIGHT_STALE_VIEW_BINDING PASS');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
