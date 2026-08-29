const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const start = source.indexOf('function offerTruthFieldLabel');
const end = source.indexOf('function renderGraphHintsInner', start);
assert(start >= 0 && end > start, 'offer truth UI function block must exist');

const calls = [];
const context = {
  console,
  V3_API_BASE: '/wp-json/daszek/v3',
  state: { detail: { type: 'case', offerTruth: null } },
  escapeHtml: (value) => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'),
  humanizeCode: (value, fallback) => String(value || fallback),
  formatDate: (value) => String(value || ''),
  showError: (message) => calls.push(['error', message]),
  showToast: (message) => calls.push(['toast', message]),
  renderDetailPanel: () => calls.push(['render']),
  openCaseDetail: async (caseId) => calls.push(['refresh', caseId]),
  apiFetch: async (...args) => {
    calls.push(['apiFetch', ...args]);
    return {
      ok: true,
      offer: { case_id: 'case_truth', offer_id: 'cieplo:wf-truth', final_price_pln: 36856 },
      conflicts: [{ resolution_status: 'OPERATOR_RESOLVED' }],
      trust_status: 'VERIFIED',
    };
  },
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

const candidates = [
  {
    candidate_id: 'candidate-a',
    value: 36856,
    provenance_quality: 'PROVEN',
    evidence: [{ producer: 'cieplo-orchestrator', source_workflow: 'wf-truth', source_path: 'pricing.totals.gross', transformation: 'CIEPLO_PRICE_ADJUSTMENT_GROSS_PLN' }],
  },
  {
    candidate_id: 'candidate-b',
    value: 37856,
    provenance_quality: 'PROVEN',
    evidence: [{ producer: 'cieplo-orchestrator', source_workflow: 'wf-truth', source_path: 'pricing.totals.gross' }],
  },
];

const operatorHtml = context.renderOfferTruthSection({
  offer: { case_id: 'case_truth', offer_id: 'cieplo:wf-truth', selected_model: 'KIT-WC09K3E8', final_price_pln: 37856, status: 'generated' },
  trust_status: 'CONFLICTED',
  conflicts: [{
    conflict_id: 'offer_conflict:case_truth:cieplo:wf-truth:final_price_pln',
    case_id: 'case_truth',
    offer_id: 'cieplo:wf-truth',
    field: 'final_price_pln',
    current_value: 37856,
    canonical_value: null,
    resolution_status: 'OPERATOR_REQUIRED',
    resolution_version: 'rev-1',
    candidate_evidence: candidates,
    explanation: { human_summary: 'Dwa dowody PROVEN wymagają decyzji operatora.' },
  }],
});
assert(operatorHtml.includes('Wymaga decyzji operatora'));
assert(operatorHtml.includes('CIEPLO_PRICE_ADJUSTMENT_GROSS_PLN'));
assert.strictEqual((operatorHtml.match(/data-offer-conflict-select/g) || []).length, 2);

const autoHtml = context.renderOfferTruthSection({
  offer: { case_id: 'case_truth', offer_id: 'cieplo:wf-truth', selected_model: 'KIT-WC09K3E8', final_price_pln: 36856, status: 'generated' },
  trust_status: 'VERIFIED',
  conflicts: [{
    conflict_id: 'offer_conflict:case_truth:cieplo:wf-truth:final_price_pln',
    case_id: 'case_truth', offer_id: 'cieplo:wf-truth', field: 'final_price_pln',
    current_value: 35856, canonical_value: 36856, canonical_candidate_id: 'candidate-a',
    resolution_status: 'AUTO_RESOLVED', resolution_version: 'rev-2', candidate_evidence: candidates,
    explanation: { human_summary: '36856 selected because producer evidence is stronger.' },
  }],
});
assert(autoHtml.includes('Rozwiązano automatycznie'));
assert(!autoHtml.includes('data-offer-conflict-select'));

(async () => {
  const trigger = {
    dataset: {
      caseId: 'case_truth', offerId: 'cieplo:wf-truth',
      conflictId: 'offer_conflict:case_truth:cieplo:wf-truth:final_price_pln',
      conflictRevision: 'rev-1', offerConflictSelect: 'candidate-a',
    },
    disabled: false,
    closest: () => ({ querySelector: () => ({ value: 'Sprawdzone przez operatora' }) }),
  };
  await context.submitOfferConflictResolution(trigger);
  const api = calls.find((item) => item[0] === 'apiFetch');
  assert(api, 'mutation must call API');
  assert.strictEqual(api[2], '/cases/case_truth/offers/cieplo%3Awf-truth/conflicts/resolve');
  const payload = JSON.parse(api[3].body);
  assert.strictEqual(payload.expected_revision, 'rev-1');
  assert.strictEqual(payload.candidate_id, 'candidate-a');
  assert.strictEqual(context.state.detail.offerTruth.conflicts[0].resolution_status, 'OPERATOR_RESOLVED');
  assert(calls.some((item) => item[0] === 'toast'));
  console.log('offer truth UI tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
