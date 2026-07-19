const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const APP_JS = path.join(__dirname, '..', 'public', 'app.js');
const SOURCE = fs.readFileSync(APP_JS, 'utf8');

function extractFunction(name) {
  const patterns = [
    { marker: `${name} = async function(`, kind: 'assignment' },
    { marker: `${name} = function(`, kind: 'assignment' },
    { marker: `async function ${name}(`, kind: 'declaration' },
    { marker: `function ${name}(`, kind: 'declaration' },
  ];
  let start = -1;
  let kind = 'declaration';
  for (const candidate of patterns) {
    const found = SOURCE.lastIndexOf(candidate.marker);
    if (found !== -1) {
      start = found;
      kind = candidate.kind;
      break;
    }
  }
  assert.notStrictEqual(start, -1, `Missing function ${name}`);
  const bodyStart = SOURCE.indexOf('{', start);
  assert.notStrictEqual(bodyStart, -1, `Missing body for ${name}`);
  let depth = 1;
  let index = bodyStart + 1;
  while (depth > 0 && index < SOURCE.length) {
    const ch = SOURCE[index];
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    index += 1;
  }
  assert.strictEqual(depth, 0, `Unbalanced braces for ${name}`);
  if (kind === 'assignment') {
    const nextMarkers = {
      renderHitlOperatorActions: '\nfunction renderAgentTurnsSection(',
      submitHitlAgentAction: '\nfunction isMaterializeProposalId(',
    };
    const nextMarker = nextMarkers[name];
    if (nextMarker) {
      const nextIndex = SOURCE.indexOf(nextMarker, index);
      assert.notStrictEqual(nextIndex, -1, `Missing trailing marker for ${name}`);
      return SOURCE.slice(start, nextIndex).trimEnd();
    }
    const semicolon = SOURCE.indexOf(';', index);
    assert.notStrictEqual(semicolon, -1, `Missing assignment terminator for ${name}`);
    return SOURCE.slice(start, semicolon + 1);
  }
  return SOURCE.slice(start, index);
}

function buildContext(overrides = {}) {
  const calls = {
    apiFetch: [],
    loadAllData: 0,
    openCaseDetail: [],
    openNoteDetail: [],
    renderDetailPanel: 0,
    showToast: [],
    showError: [],
  };
  const context = {
    V2_API_BASE: '/wp-json/daszek/v2',
    state: {
      currentUser: 'konrad',
      hitlAction: {
        pending: false,
        awaitingSync: false,
        engagementId: '',
        kind: '',
        noteId: '',
        decisionKey: '',
        status: '',
      },
      actionDecision: {
        pending: false,
        awaitingSync: false,
        proposalId: '',
        decision: '',
        decisionKey: '',
        status: '',
      },
      detail: {
        type: 'note',
        payload: {
          note: {
            note_id: 'desk-stg_sig_de445bdb',
            engagement_id: 'stg_sig_de445bdb',
            case_id: '',
            hitl_required: true,
          },
        },
      },
    },
    document: {
      querySelector() {
        return null;
      },
    },
    apiFetch: (...args) => {
      calls.apiFetch.push(args);
      return Promise.resolve({ ok: true });
    },
    loadAllData: async () => {
      calls.loadAllData += 1;
    },
    openCaseDetail: async (caseId) => {
      calls.openCaseDetail.push(caseId);
    },
    openNoteDetail: async (noteId) => {
      calls.openNoteDetail.push(noteId);
    },
    renderDetailPanel: () => {
      calls.renderDetailPanel += 1;
    },
    showToast: (message) => {
      calls.showToast.push(message);
    },
    showError: (message) => {
      calls.showError.push(message);
    },
    escapeHtml: (value) => String(value ?? ''),
    canCurrentUserDecideActionProposals: () => true,
    isMaterializeProposalId: () => false,
    approveProposalViaApi: () => Promise.resolve({ ok: true }),
    window: {
      prompt: () => '',
    },
    console,
    setTimeout,
    clearTimeout,
    Promise,
    ...overrides,
  };
  vm.createContext(context);
  return { context, calls };
}

function loadFunctions(context, names) {
  const source = names.map(extractFunction).join('\n\n');
  vm.runInContext(source, context);
}

test('staging note HITL approve renders in approve-only mode without send action', () => {
  const { context } = buildContext();
  loadFunctions(context, ['renderHitlOperatorActions']);

  const html = context.renderHitlOperatorActions(
    {
      note_id: 'desk-stg_sig_de445bdb',
      engagement_id: 'stg_sig_de445bdb',
      case_id: '',
      hitl_required: true,
      hitl_action_id: 'draft_reply',
      operator_questions_pl: ['Podaj OZC'],
    },
    {
      engagement_id: 'stg_sig_de445bdb',
      hitl_gate: { required: true },
    },
    { approveOnly: true }
  );

  assert.match(html, /data-hitl-approve="stg_sig_de445bdb"/);
  assert.match(html, /Zatwierdz bez wysylki/);
  assert.doesNotMatch(html, /data-hitl-send=/);
});

test('ordinary note or note without active HITL does not render approve action', () => {
  const { context } = buildContext();
  loadFunctions(context, ['renderHitlOperatorActions']);

  const noEngagement = context.renderHitlOperatorActions(
    { note_id: 'note_1', case_id: '', hitl_required: true },
    {},
    { approveOnly: true }
  );
  const approved = context.renderHitlOperatorActions(
    {
      note_id: 'desk-stg_sig_de445bdb',
      engagement_id: 'stg_sig_de445bdb',
      case_id: '',
      hitl_required: false,
    },
    {
      engagement_id: 'stg_sig_de445bdb',
      hitl_gate: { required: false },
    },
    { approveOnly: true }
  );

  assert.strictEqual(noEngagement, '');
  assert.strictEqual(approved, '');
});

test('pending HITL request disables approve button and keeps send hidden in approve-only mode', () => {
  const { context } = buildContext({
    state: {
      currentUser: 'konrad',
      hitlAction: {
        pending: true,
        engagementId: 'stg_sig_de445bdb',
        kind: 'approve',
        noteId: 'desk-stg_sig_de445bdb',
      },
      detail: null,
    },
  });
  loadFunctions(context, ['renderHitlOperatorActions']);

  const html = context.renderHitlOperatorActions(
    {
      note_id: 'desk-stg_sig_de445bdb',
      engagement_id: 'stg_sig_de445bdb',
      case_id: '',
      hitl_required: true,
    },
    { engagement_id: 'stg_sig_de445bdb', hitl_gate: { required: true } },
    { approveOnly: true }
  );

  assert.match(html, /Zatwierdzam/);
  assert.match(html, /disabled/);
  assert.doesNotMatch(html, /data-hitl-send=/);
});

test('approve click uses canonical endpoint without case_id and refreshes note detail from feed', async () => {
  const { context, calls } = buildContext();
  loadFunctions(context, ['submitHitlAgentAction']);

  const trigger = {
    dataset: {
      hitlApprove: 'stg_sig_de445bdb',
      hitlCase: '',
      hitlAction: 'draft_reply',
      hitlNote: 'desk-stg_sig_de445bdb',
    },
    disabled: false,
  };

  await context.submitHitlAgentAction(trigger, 'approve');

  assert.strictEqual(calls.apiFetch.length, 1);
  const [base, endpoint, options] = calls.apiFetch[0];
  assert.strictEqual(base, '/wp-json/daszek/v2');
  assert.strictEqual(endpoint, '/agent-hitl/approve');
  const body = JSON.parse(options.body);
  assert.deepStrictEqual(body, {
    engagement_id: 'stg_sig_de445bdb',
    case_id: '',
    action_id: 'draft_reply',
    operator_id: 'konrad',
    draft_pl: '',
  });
  assert.strictEqual(calls.loadAllData, 1);
  assert.deepStrictEqual(calls.openCaseDetail, []);
  assert.deepStrictEqual(calls.openNoteDetail, ['desk-stg_sig_de445bdb']);
});

test('approve click stays in accepted state until feed convergence is confirmed', async () => {
  const { context, calls } = buildContext({
    apiFetch: (...args) => {
      calls.apiFetch.push(args);
      return Promise.resolve({ ok: true, decision_key: 'bq_hitl_accept_1', decision_status: 'accepted' });
    },
  });
  loadFunctions(context, ['submitHitlAgentAction']);

  const trigger = {
    dataset: {
      hitlApprove: 'stg_sig_de445bdb',
      hitlCase: '',
      hitlAction: 'draft_reply',
      hitlNote: 'desk-stg_sig_de445bdb',
    },
    disabled: false,
  };

  await context.submitHitlAgentAction(trigger, 'approve');

  assert.ok(calls.showToast.length >= 1);
  assert.doesNotMatch(calls.showToast[0], /HITL zatwierdzone|wykonano/i);
});

test('send click does not show final success before convergence', async () => {
  const { context, calls } = buildContext({
    document: {
      querySelector(selector) {
        if (selector === '[data-hitl-draft]') {
          return { value: 'Test draft' };
        }
        return null;
      },
    },
    apiFetch: (...args) => {
      calls.apiFetch.push(args);
      return Promise.resolve({ ok: true, decision_key: 'bq_hitl_send_1', decision_status: 'accepted' });
    },
  });
  loadFunctions(context, ['submitHitlAgentAction']);

  const trigger = {
    dataset: {
      hitlSend: 'stg_sig_de445bdb',
      hitlCase: '',
      hitlAction: 'draft_reply',
      hitlNote: 'desk-stg_sig_de445bdb',
    },
    disabled: false,
  };

  await context.submitHitlAgentAction(trigger, 'send');

  assert.ok(calls.showToast.length >= 1);
  assert.doesNotMatch(calls.showToast[0], /Wysylka zapisana w kolejce bridge|wyslano|wykonano/i);
});

test('approve click shows final confirmation only after converged feed refresh', async () => {
  const { context, calls } = buildContext({
    apiFetch: (...args) => {
      calls.apiFetch.push(args);
      return Promise.resolve({ ok: true, decision_key: 'bq_hitl_accept_2', decision_status: 'accepted' });
    },
    openNoteDetail: async (noteId) => {
      calls.openNoteDetail.push(noteId);
      context.state.detail = {
        type: 'note',
        engagement: { hitl_gate: { required: false } },
        payload: {
          note: {
            note_id: noteId,
            engagement_id: 'stg_sig_de445bdb',
            case_id: '',
            hitl_required: false,
          },
        },
      };
    },
  });
  loadFunctions(context, ['submitHitlAgentAction']);

  const trigger = {
    dataset: {
      hitlApprove: 'stg_sig_de445bdb',
      hitlCase: '',
      hitlAction: 'draft_reply',
      hitlNote: 'desk-stg_sig_de445bdb',
    },
    disabled: false,
  };

  await context.submitHitlAgentAction(trigger, 'approve');

  assert.match(calls.showToast[0], /Przyjeto do realizacji/i);
  assert.match(calls.showToast[1] || '', /potwierdzone w aktualnym feedzie/i);
});

test('send click shows final confirmation only after converged feed refresh', async () => {
  const { context, calls } = buildContext({
    document: {
      querySelector(selector) {
        if (selector === '[data-hitl-draft]') {
          return { value: 'Test draft' };
        }
        return null;
      },
    },
    apiFetch: (...args) => {
      calls.apiFetch.push(args);
      return Promise.resolve({ ok: true, decision_key: 'bq_hitl_send_2', decision_status: 'accepted' });
    },
    openNoteDetail: async (noteId) => {
      calls.openNoteDetail.push(noteId);
      context.state.detail = {
        type: 'note',
        payload: {
          note: {
            note_id: noteId,
            engagement_id: 'stg_sig_de445bdb',
            case_id: 'case_hitl',
            hitl_required: false,
          },
          case: {
            case_id: 'case_hitl',
            execution_results: [
              {
                proposal_id: 'bq_hitl_send_2',
                execution_status: 'executed',
                result_payload: {
                  decision_key: 'bq_hitl_send_2',
                  decision_status: 'executed',
                },
              },
            ],
          },
        },
      };
    },
  });
  loadFunctions(context, ['submitHitlAgentAction']);

  const trigger = {
    dataset: {
      hitlSend: 'stg_sig_de445bdb',
      hitlCase: '',
      hitlAction: 'draft_reply',
      hitlNote: 'desk-stg_sig_de445bdb',
    },
    disabled: false,
  };

  await context.submitHitlAgentAction(trigger, 'send');

  assert.match(calls.showToast[0], /Przyjeto do realizacji/i);
  assert.match(calls.showToast[1] || '', /Wykonanie potwierdzone w aktualnym feedzie/i);
});

test('duplicate send click is blocked while awaiting feed convergence', async () => {
  const { context, calls } = buildContext({
    document: {
      querySelector(selector) {
        if (selector === '[data-hitl-draft]') {
          return { value: 'Test draft' };
        }
        return null;
      },
    },
    apiFetch: (...args) => {
      calls.apiFetch.push(args);
      return Promise.resolve({ ok: true, decision_key: 'bq_hitl_send_wait', decision_status: 'accepted' });
    },
  });
  loadFunctions(context, ['submitHitlAgentAction']);

  const trigger = {
    dataset: {
      hitlSend: 'stg_sig_de445bdb',
      hitlCase: '',
      hitlAction: 'draft_reply',
      hitlNote: 'desk-stg_sig_de445bdb',
    },
    disabled: false,
  };

  await context.submitHitlAgentAction(trigger, 'send');
  await context.submitHitlAgentAction(trigger, 'send');

  assert.strictEqual(calls.apiFetch.length, 1);
});

test('duplicate approve click is blocked while request is pending', async () => {
  let resolveRequest;
  const deferred = new Promise((resolve) => {
    resolveRequest = resolve;
  });
  const { context, calls } = buildContext({
    apiFetch: (...args) => {
      calls.apiFetch.push(args);
      return deferred;
    },
  });
  loadFunctions(context, ['submitHitlAgentAction']);

  const trigger = {
    dataset: {
      hitlApprove: 'stg_sig_de445bdb',
      hitlCase: '',
      hitlAction: 'draft_reply',
      hitlNote: 'desk-stg_sig_de445bdb',
    },
    disabled: false,
  };

  const first = context.submitHitlAgentAction(trigger, 'approve');
  const second = context.submitHitlAgentAction(trigger, 'approve');
  await Promise.resolve();

  assert.strictEqual(calls.apiFetch.length, 1);
  resolveRequest({ ok: true });
  await first;
  await second;
});

test('conflict response shows error and refreshes current note detail', async () => {
  const conflict = new Error('Node B odrzucil zapytanie.');
  conflict.status = 409;
  const { context, calls } = buildContext({
    apiFetch: () => Promise.reject(conflict),
  });
  loadFunctions(context, ['submitHitlAgentAction']);

  const trigger = {
    dataset: {
      hitlApprove: 'stg_sig_de445bdb',
      hitlCase: '',
      hitlAction: 'draft_reply',
      hitlNote: 'desk-stg_sig_de445bdb',
    },
    disabled: false,
  };

  await context.submitHitlAgentAction(trigger, 'approve');

  assert.strictEqual(calls.loadAllData, 1);
  assert.deepStrictEqual(calls.openNoteDetail, ['desk-stg_sig_de445bdb']);
  assert.strictEqual(calls.showToast.length, 0);
  assert.match(calls.showError[0] || '', /Konflikt|konflikt/);
});

test('reject decision stays accepted until case feed convergence is confirmed', async () => {
  const { context, calls } = buildContext({
    state: {
      currentUser: 'konrad',
      hitlAction: { pending: false, awaitingSync: false, engagementId: '', kind: '', noteId: '', decisionKey: '', status: '' },
      actionDecision: { pending: false, awaitingSync: false, proposalId: '', decision: '', decisionKey: '', status: '' },
      detail: {
        type: 'case',
        payload: {
          case: {
            case_id: 'case_1',
            action_proposals: [{ proposal_id: 'prop_1', status: 'proposed' }],
          },
        },
      },
    },
    approveProposalViaApi: () => Promise.resolve({ ok: true, decision_key: 'reject_decision_1', decision_status: 'accepted' }),
  });
  loadFunctions(context, ['decideActionProposal']);

  await context.decideActionProposal('prop_1', 'reject');

  assert.match(calls.showToast[0] || '', /Przyjeto do realizacji/i);
  assert.strictEqual(calls.showToast.length, 1);
});

test('reject decision shows final confirmation only after case feed convergence', async () => {
  const { context, calls } = buildContext({
    state: {
      currentUser: 'konrad',
      hitlAction: { pending: false, awaitingSync: false, engagementId: '', kind: '', noteId: '', decisionKey: '', status: '' },
      actionDecision: { pending: false, awaitingSync: false, proposalId: '', decision: '', decisionKey: '', status: '' },
      detail: {
        type: 'case',
        payload: {
          case: {
            case_id: 'case_2',
            action_proposals: [{ proposal_id: 'prop_2', status: 'proposed' }],
          },
        },
      },
    },
    approveProposalViaApi: () => Promise.resolve({ ok: true, decision_key: 'reject_decision_2', decision_status: 'accepted' }),
    openCaseDetail: async (caseId) => {
      calls.openCaseDetail.push(caseId);
      context.state.detail = {
        type: 'case',
        payload: {
          case: {
            case_id: caseId,
            action_proposals: [{ proposal_id: 'prop_2', status: 'rejected' }],
          },
        },
      };
    },
  });
  loadFunctions(context, ['decideActionProposal']);

  await context.decideActionProposal('prop_2', 'reject');

  assert.match(calls.showToast[0] || '', /Przyjeto do realizacji/i);
  assert.match(calls.showToast[1] || '', /potwierdzona w aktualnym feedzie/i);
});
