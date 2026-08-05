import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.TEMP, 'pw-stale-proof', 'node_modules', 'playwright'));
const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const start = SOURCE.lastIndexOf('submitHitlAgentAction = async function(');
const bodyStart = SOURCE.indexOf('{', start);
let depth = 1;
let index = bodyStart + 1;
while (depth > 0 && index < SOURCE.length) {
  const ch = SOURCE[index];
  if (ch === '{') depth += 1;
  if (ch === '}') depth -= 1;
  index += 1;
}
while (index < SOURCE.length && SOURCE[index] !== ';') index += 1;
const submitFn = SOURCE.slice(start, index + 1);

const html = `<!doctype html><html><body>
<textarea data-hitl-draft data-hitl-body-hash="h1" data-hitl-revision="1" data-hitl-draft-id="d1">body</textarea>
<button id="approve" data-hitl-approve="eng" data-hitl-case="case" data-hitl-note="note" data-hitl-action="draft_reply" data-hitl-body-hash="h1" data-hitl-revision="1" data-hitl-draft-id="d1">A</button>
<script>
window.__log = [];
window.__calls = { fetch: [] };
window.V2_API_BASE = '/wp-json/daszek/v2';
window.state = { currentUser: 'konrad', hitlAction: { pending: false, awaitingSync: false, engagementId: '', kind: '', noteId: '', decisionKey: '', status: '' }, detail: null };
window.showToast = (m) => window.__log.push(['toast', m]);
window.showError = (m) => window.__log.push(['error', m]);
window.renderDetailPanel = () => window.__log.push(['render']);
window.loadAllData = async () => window.__log.push(['load']);
window.openCaseDetail = async (id) => window.__log.push(['case', id]);
window.openNoteDetail = async (id) => window.__log.push(['note', id]);
window.resolveHitlDecisionConvergence = () => ({ converged: false, status: '' });
window.apiFetch = async (base, endpoint, options = {}) => {
  window.__calls.fetch.push({ base, endpoint, body: options.body });
  return { ok: true, decision_key: 'k', decision_status: 'approved', execution_status: 'not_applicable', delivery_mode: 'manual_operator', effect_started: false };
};
try {
${submitFn}
window.__log.push(['defined', typeof window.submitHitlAgentAction]);
} catch (e) {
  window.__log.push(['define_error', String(e), e.stack]);
}
</script></body></html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => console.log('CONSOLE', m.type(), m.text()));
await page.setContent(html, { waitUntil: 'domcontentloaded' });
const info = await page.evaluate(async () => {
  const before = { log: [...window.__log], typeofFn: typeof window.submitHitlAgentAction };
  try {
    await window.submitHitlAgentAction(document.getElementById('approve'), 'approve');
  } catch (e) {
    return { before, err: String(e), stack: e.stack, log: window.__log, calls: window.__calls };
  }
  return { before, log: window.__log, calls: window.__calls, hitl: window.state.hitlAction };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
