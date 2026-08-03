const V1_API_BASE = '/wp-json/daszek/v1';
const V2_API_BASE = '/wp-json/daszek/v2';
const V3_API_BASE = '/wp-json/daszek/v3';

const THEME_STORAGE_KEY = 'daszek-theme';

function applyDaszekTheme(mode) {
    const m = mode === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', m);
    try {
        localStorage.setItem(THEME_STORAGE_KEY, m);
    } catch (e) {
        /* ignore */
    }
}

function initDaszekTheme() {
    try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'dark' || stored === 'light') {
            applyDaszekTheme(stored);
        }
    } catch (e) {
        /* ignore */
    }
    const btn = document.getElementById('theme-toggle');
    if (btn) {
        btn.addEventListener('click', () => {
            const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
            applyDaszekTheme(cur === 'dark' ? 'light' : 'dark');
        });
    }
}

const state = {
    currentUser: null,
    csrfToken: null,
    currentView: 'desk',
    search: '',
    detail: null,
    data: {
        desk: { items: [], counts: {} },
        cockpit: { substrate: {}, cohort_runs: [] },
        day: { sections: [] },
        cases: { items: [] },
        quality: { summary: {}, loadError: null },
        tasks: [],
        lastIngress: { ok: false, snapshot: null, message: '' },
        systemOsEvents: { ok: false, items: [], loadError: null, loading: false },
        systemObservability: { ok: false, nodeBStatus: null, feedMeta: null, bridgeSummary: null, loadError: null, loading: false },
        cockpit: { loadError: null },
        decisionQueue: { ok: false, items: [], loadError: null, loading: false },
        identityMerge: { ok: false, bindingSuggestions: [], emailDuplicates: [], loadError: null, loading: false },
        constitution: { ok: false, data: null, loadError: null, loading: false },
        operationalFeed: { ok: false, snapshot: null, message: '', loadError: null },
        cohortList: { ok: false, items: [], loadError: null },
        caseArchive: { ok: false, items: [], ids: [], loadError: null },
        mailboxCases: { ok: false, cases: [], loadError: null },
    },
    skrzat: {
        answers: {},
        loadingCaseId: '',
        errors: {},
    },
    agentChat: {
        sessionId: '',
        messages: [],
        isStreaming: false,
        streamingBuffer: '',
        currentCaseId: '',
        abortController: null,
        proposals: [],
        hitlRequired: false,
        loadError: null,
        loading: false,
        hasBriefed: false,
    },
};

function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : null;
}

state.csrfToken = getCsrfToken();
state.hitlAction = state.hitlAction || { pending: false, awaitingSync: false, engagementId: '', kind: '', noteId: '', decisionKey: '', status: '' };
state.actionDecision = state.actionDecision || { pending: false, awaitingSync: false, proposalId: '', decision: '', decisionKey: '', status: '' };

function buildApiUrl(base, endpoint, method = 'GET') {
    const url = new URL(`${base}${endpoint}`, window.location.origin);
    if ((method || 'GET').toUpperCase() === 'GET') {
        url.searchParams.set('_rt', Date.now().toString());
    }
    return url.toString();
}

async function apiFetch(base, endpoint, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const headers = buildApiHeaders(method, options.headers);

    const response = await fetch(buildApiUrl(base, endpoint, method), {
        ...options,
        method,
        headers,
        credentials: 'same-origin',
        cache: method === 'GET' ? 'no-store' : options.cache,
    });

    const rawBody = await response.text();
    let parsedBody = null;
    if (rawBody) {
        try {
            parsedBody = JSON.parse(rawBody);
        } catch (parseError) {
            parsedBody = null;
        }
    }

    if (!response.ok) {
        const message = parsedBody && typeof parsedBody === 'object'
            ? parsedBody.message || parsedBody.code || 'Błąd API'
            : rawBody || 'Błąd API';
        const error = new Error(message);
        error.status = response.status;
        throw error;
    }

    return parsedBody !== null ? parsedBody : rawBody;
}

function buildApiHeaders(method, extraHeaders) {
    const headers = {
        'Content-Type': 'application/json',
        ...(extraHeaders || {}),
    };
    const upper = (method || 'GET').toUpperCase();
    if (upper === 'GET') {
        headers['Cache-Control'] = 'no-cache';
        headers.Pragma = 'no-cache';
    }
    if (state.csrfToken && upper !== 'GET') {
        headers['X-CSRF-Token'] = state.csrfToken;
    }
    return headers;
}

function showLoginScreen() {
    document.getElementById('login-screen').style.display = 'grid';
    document.getElementById('main-screen').style.display = 'none';
}

function showMainScreen() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'block';
    document.getElementById('current-user').textContent = state.currentUser || 'operator';
    // Onboarding: show wizard on first login
    try {
        if (!localStorage.getItem('daszek-onboarding-done')) {
            setTimeout(showOnboardingWizard, 500);
        }
    } catch (_) { /* ignore */ }
}

function showError(message) {
    const box = document.getElementById('global-error');
    box.textContent = message;
    box.style.display = 'block';
}

function clearError() {
    const box = document.getElementById('global-error');
    box.textContent = '';
    box.style.display = 'none';
}

function clearStaleDetailOnViewChange() {
    if (!state.detail) {
        return;
    }
    if (state.detail.type === 'detail_error' || state.detail.type === 'detail_loading') {
        state.detail = null;
        setDetailPanelChromeOpen(false);
        const panel = document.getElementById('detail-panel');
        if (panel) {
            panel.innerHTML = '';
        }
    }
}

function navigateToView(next) {
    const viewKey = normalizeMainViewId(next);
    if (!viewKey) {
        return;
    }
    clearError();
    clearStaleDetailOnViewChange();
    state.currentView = viewKey;
    syncViewToUrl(viewKey);
    renderCurrentView();
}

function showToast(message, type) {
    var host = document.getElementById('toast-host');
    var toast = document.createElement('div');
    toast.className = 'toast';
    if (type) { toast.classList.add('toast--' + type); }
    toast.textContent = message;
    host.appendChild(toast);
    setTimeout(function () { toast.classList.add('toast-visible'); }, 10);
    setTimeout(function () {
        toast.classList.remove('toast-visible');
        setTimeout(function () { toast.remove(); }, 250);
    }, 2600);
}

function nodeBApiBase() {
    const raw = window.DASZEK_NODE_B_API_BASE || window.daszekNodeBApiBase || V3_API_BASE;
    return String(raw || '').replace(/\/+$/, '');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text ?? '';
    return div.innerHTML;
}

function sanitizeMarkdownHref(href) {
    const raw = String(href || '').trim();
    if (!raw) return '';
    try {
        const parsed = new URL(raw, window.location.origin);
        const scheme = (parsed.protocol || '').toLowerCase();
        if (scheme === 'http:' || scheme === 'https:' || scheme === 'mailto:') {
            return parsed.href;
        }
    } catch (_) {
        /* invalid URL */
    }
    return '';
}

function formatDate(value) {
    if (!value) {
        return 'Brak terminu';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return escapeHtml(value);
    }
    return date.toLocaleString('pl-PL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function humanizeCode(value, fallback = '') {
    const text = String(value || '').trim();
    if (!text) {
        return fallback;
    }
    const normalized = text.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function priorityLabel(priority) {
    return {
        critical: 'krytyczny',
        high: 'wysoki',
        medium: 'średni',
        low: 'niski',
    }[priority] || humanizeCode(priority, 'średni');
}

function priorityTone(priority) {
    return {
        critical: 'high',
        high: 'high',
        medium: 'medium',
        low: 'low',
    }[priority] || 'medium';
}

function firstNonEmpty(...values) {
    for (const value of values) {
        const text = String(value || '').trim();
        if (text) {
            return text;
        }
    }
    return '';
}

function hasOperationalFeedSnapshot() {
    const snap = state.data.operationalFeed && state.data.operationalFeed.snapshot;
    return !!(snap && snap.feed && typeof snap.feed === 'object');
}

function getOperationalFeed() {
    return hasOperationalFeedSnapshot() ? state.data.operationalFeed.snapshot.feed : null;
}

const KNOWN_OPERATIONAL_FEED_SCHEMA_VERSIONS = new Set(['1', '1.0', '1.2', '1.3']);
const SPRAWY_SOURCE = 'mailbox-cases';

function operationalFeedSnapshotMetaLine() {
    if (!hasOperationalFeedSnapshot()) {
        return '';
    }
    const s = state.data.operationalFeed.snapshot;
    const parts = [];
    const id = String(s.snapshot_id || '').trim();
    if (id) {
        parts.push(`Migawka: ${escapeHtml(id)}`);
    }
    const ing = firstNonEmpty(s.ingested_at, s.generated_at);
    if (ing) {
        parts.push(`Zapis: ${escapeHtml(String(ing))}`);
    }
    const env = firstNonEmpty(s.environment);
    if (env) {
        parts.push(`Środowisko: ${escapeHtml(env)}`);
    }
    const run = firstNonEmpty(s.source_run_id);
    if (run) {
        parts.push(`run: ${escapeHtml(run)}`);
    }
    const sha = String(s.build_git_sha || '').trim();
    if (sha) {
        parts.push(`build: <code class="ds-meta-code">${escapeHtml(sha.slice(0, 12))}</code>`);
    }
    const sv = String(s.schema_version || '').trim();
    if (sv) {
        if (!KNOWN_OPERATIONAL_FEED_SCHEMA_VERSIONS.has(sv)) {
            parts.push(`<span class="ds-schema-warn">schema ${escapeHtml(sv)} — nieznana wersja, odczyt best-effort</span>`);
        } else {
            parts.push(`schema ${escapeHtml(sv)}`);
        }
    }
    return parts.length ? parts.join(' · ') : '';
}

function wrapDaszekViewShell(viewTrailLabels, innerHtml, metaLineHtml = '') {
    const trail = ['Daszek', ...viewTrailLabels];
    const crumbHtml = trail.map((label, i) => {
        const isLast = i === trail.length - 1;
        const cls = isLast ? 'ds-crumb ds-crumb-current' : 'ds-crumb';
        const currentAttr = isLast ? ' aria-current="page"' : '';
        const sep = isLast ? '' : '<span class="ds-crumb-sep" aria-hidden="true"> / </span>';
        return `<span class="${cls}"${currentAttr}>${escapeHtml(label)}</span>${sep}`;
    }).join('');
    const metaBlock = metaLineHtml
        ? `<p class="ds-meta-line detail-muted">${metaLineHtml}</p>`
        : '';
    return `
        <div class="ds-view-shell view-fade-in">
            <nav class="ds-breadcrumb" aria-label="Ścieżka widoku">${crumbHtml}</nav>
            ${metaBlock}
            ${innerHtml}
        </div>`;
}

function wrapOperationalViewShell(viewTitle, innerHtml) {
    const footer = hasOperationalFeedSnapshot() ? buildOperationalViewTechFooter() : '';
    return wrapDaszekViewShell([viewTitle], innerHtml + footer, '');
}

function lastIngressSnapshotMetaLine(snap) {
    if (!snap || typeof snap !== 'object') {
        return '';
    }
    const parts = [];
    const runId = String(snap.run_id || '').trim();
    if (runId) {
        parts.push(`run_id ${escapeHtml(runId)}`);
    }
    const ts = firstNonEmpty(snap.ingested_at, snap.created_at);
    if (ts) {
        parts.push(`snapshot ${escapeHtml(String(ts))}`);
    }
    return parts.length ? parts.join(' · ') : '';
}

function projectionBoundaryHtml() {
    return '<p class="detail-muted projection-boundary">Widok jest projekcją. Nie tworzy spraw i nie wykonuje akcji.</p>';
}

function projectionSectionMissingPreview() {
    return 'Brak w tej projekcji (read-only)';
}

const PRIMARY_VIEW_TABS = ['desk', 'cases', 'day', 'archive'];
const MORE_VIEW_TABS = ['cockpit', 'quality', 'system', 'last_ingress', 'cohort_runs', 'decisions', 'identity', 'constitution'];

function isGatebTestArtifact(item) {
    if (!item || typeof item !== 'object') {
        return false;
    }
    const title = String(item.title || item.title_pl || '').toUpperCase();
    const nid = String(item.note_id || item.desk_note_id || '').toLowerCase();
    const cid = String(item.case_id || '').toLowerCase();
    const mid = String(item.source_message_id || item.message_id || '').toLowerCase();
    if (title.includes('BADBAD') || nid.includes('badbad')) {
        return true;
    }
    return mid.startsWith('gateb_badbad') || mid.startsWith('gateb-');
}

function operationalFeedHumanTimestampLine() {
    if (!hasOperationalFeedSnapshot()) {
        return '';
    }
    const s = state.data.operationalFeed.snapshot;
    const ing = firstNonEmpty(s.ingested_at, s.generated_at, s.created_at);
    return ing ? `Ostatnia aktualizacja danych: ${formatDate(ing)}` : '';
}

function renderOperatorTechTier1(innerHtml) {
    const body = String(innerHtml || '').trim();
    if (!body) {
        return '';
    }
    return `
        <details class="ds-tech-tier-1 detail-tech">
            <summary class="ds-tech-tier-summary"><span class="ds-tech-plus" aria-hidden="true">+</span> Szczegóły systemu</summary>
            <div class="ds-tech-tier-body">${body}</div>
        </details>`;
}

function renderOperatorTechTier2(innerHtml) {
    const body = String(innerHtml || '').trim();
    if (!body) {
        return '';
    }
    return `
        <details class="ds-tech-tier-2 detail-tech">
            <summary class="ds-tech-tier-summary"><span class="ds-tech-plus" aria-hidden="true">+</span> Pełne dane techniczne</summary>
            <div class="ds-tech-tier-body ds-tech-tier-body--scroll">${body}</div>
        </details>`;
}

function buildOperationalViewTechFooter() {
    const tier1 = `
        <p class="detail-muted">Dane z systemu AI (podgląd). Ten ekran nie wysyła maili ani nie zamyka spraw automatycznie.</p>
        ${operationalFeedHumanTimestampLine() ? `<p class="detail-muted">${escapeHtml(operationalFeedHumanTimestampLine())}</p>` : ''}`;
    const tier2Parts = [];
    const meta = operationalFeedSnapshotMetaLine();
    if (meta) {
        tier2Parts.push(`<p class="ds-meta-line detail-muted">${meta}</p>`);
    }
    tier2Parts.push(projectionBoundaryHtml());
    return renderOperatorTechTier1(`${tier1}${renderOperatorTechTier2(tier2Parts.join(''))}`);
}

function operatorEssenceFor(item) {
    const row = item && typeof item === 'object' ? item : {};
    const candidates = [
        row.operator_essence_pl,
        row.summary_short,
        row.why_on_desk,
        row.why_now_pl,
        row.summary,
        row.operator_brief_pl,
        row.latest_signal_summary_pl,
    ];
    for (const raw of candidates) {
        const text = String(raw || '').replace(/\s+/g, ' ').trim();
        if (text) {
            return text;
        }
    }
    return '';
}

function textsEqual(a, b) {
    const left = String(a || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const right = String(b || '').replace(/\s+/g, ' ').trim().toLowerCase();
    return Boolean(left && right && left === right);
}

function nextStepLineFor(item) {
    const row = item && typeof item === 'object' ? item : {};
    const step = firstNonEmpty(
        row.primary_next_action_title_pl,
        row.recommended_next_step,
        row.recommended_next_step_pl,
        row.next_step_hint_pl,
        row.assistant_suggestion_pl,
    );
    if (step) {
        return step;
    }
    return 'Do ustalenia z klientem lub wewnętrznie.';
}

function humanizeOperationalStatus(statusRaw) {
    const s = String(statusRaw || '').trim().toUpperCase();
    const map = {
        WATCHING: 'Do obserwacji',
        REVIEW: 'Wymaga przejrzenia',
        CONFLICT: 'Sprzeczność danych',
        WAIT: 'Czeka na odpowiedź',
        CLOSED: 'Zamknięte',
        DONE: 'Zakończone',
    };
    return map[s] || humanizeCode(statusRaw, '');
}

function recordActivityLabel(item) {
    const ts = caseActivityTimestamp(item) || firstNonEmpty(item.updated_at, item.latest_signal_at, item.created_at);
    return ts ? formatDate(ts) : '';
}

function renderOperatorHero(item, options = {}) {
    const row = item && typeof item === 'object' ? item : {};
    const title = firstNonEmpty(row.title, row.title_pl, 'Temat operacyjny');
    const essence = operatorEssenceFor(row);
    const next = nextStepLineFor(row);
    const activity = recordActivityLabel(row);
    const showTitle = options.hideTitle !== true;
    const essenceBlock = essence && !textsEqual(essence, title)
        ? `<p class="ds-hero-essence">${escapeHtml(limitText(essence, options.essenceMax || 320))}</p>`
        : '';
    return `
        <div class="ds-operator-hero">
            ${showTitle ? `<p class="ds-hero-title">${escapeHtml(title)}</p>` : ''}
            ${essenceBlock}
            <p class="ds-hero-next"><strong>Następny krok:</strong> ${escapeHtml(limitText(next, 200))}</p>
            ${activity ? `<p class="ds-hero-meta">Aktywność: ${escapeHtml(activity)}</p>` : ''}
        </div>`;
}

function formatRelativeDateTime(value) {
    if (!value) {
        return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    const diffMs = Date.now() - date.getTime();
    if (diffMs < 0) {
        return formatDate(value);
    }
    const min = Math.round(diffMs / 60000);
    if (min < 1) {
        return 'przed chwilą';
    }
    if (min < 60) {
        return `${min} min temu`;
    }
    const hrs = Math.round(min / 60);
    if (hrs < 24) {
        return `${hrs} godz. temu`;
    }
    const days = Math.round(hrs / 24);
    if (days < 7) {
        return days === 1 ? 'wczoraj' : `${days} dni temu`;
    }
    return formatDate(value);
}

function senderLineFor(item) {
    const row = item && typeof item === 'object' ? item : {};
    const name = firstNonEmpty(row.sender_name);
    const email = firstNonEmpty(row.customer_email, row.sender_email);
    if (name && email) {
        return `${name} <${email}>`;
    }
    return name || email;
}

function messageWhenFor(item) {
    const row = item && typeof item === 'object' ? item : {};
    return firstNonEmpty(row.received_at, row.latest_message_at, row.latest_signal_at, row.updated_at);
}

function attachmentList(item) {
    const row = item && typeof item === 'object' ? item : {};
    const list = Array.isArray(row.attachments) ? row.attachments : [];
    return list.filter(a => a && typeof a === 'object' && String(a.file_name || '').trim());
}

function attachmentIcon(mime) {
    const m = String(mime || '').toLowerCase();
    if (m.includes('pdf')) {
        return '📄';
    }
    if (m.includes('image')) {
        return '🖼️';
    }
    if (m.includes('sheet') || m.includes('excel') || m.includes('csv')) {
        return '📊';
    }
    if (m.includes('word') || m.includes('document')) {
        return '📝';
    }
    return '📎';
}

function renderMailHeaderLine(item) {
    const sender = senderLineFor(item);
    const when = messageWhenFor(item);
    const rel = formatRelativeDateTime(when);
    const abs = when ? formatDate(when) : '';
    const attachCount = attachmentList(item).length;
    const parts = [];
    if (sender) {
        parts.push(`<span class="mailmeta-from" title="${escapeHtml(sender)}">✉ ${escapeHtml(limitText(sender, 46))}</span>`);
    }
    if (rel) {
        parts.push(`<span class="mailmeta-when" title="${escapeHtml(abs)}">${escapeHtml(rel)}</span>`);
    }
    if (attachCount) {
        parts.push(`<span class="mailmeta-attach" title="Załączniki: ${attachCount}">📎 ${attachCount}</span>`);
    }
    if (!parts.length) {
        return '';
    }
    return `<div class="record-mailmeta">${parts.join('')}</div>`;
}

function attachmentKindLabel(att) {
    const row = att && typeof att === 'object' ? att : {};
    const kind = String(row.document_kind || '').trim();
    const map = {
        floor_plan: 'Rzut / projekt',
        invoice: 'Faktura',
        offer: 'Oferta',
        energy_certificate: 'Świadectwo energetyczne',
        photo: 'Zdjęcie',
        generic: '',
    };
    if (map[kind]) {
        return map[kind];
    }
    return humanizeCode(kind, '');
}

function renderAttachmentChips(item, { interactive = true } = {}) {
    const list = attachmentList(item);
    if (!list.length) {
        return '';
    }
    const chips = list.map((att, idx) => {
        const name = escapeHtml(limitText(att.file_name, 42));
        const icon = attachmentIcon(att.mime_type);
        const kind = attachmentKindLabel(att);
        const title = escapeHtml(`${att.file_name}${kind ? ' — ' + kind : ''}`);
        const hasText = att.has_text && String(att.summary_pl || '').trim();
        if (interactive && hasText) {
            return `<button type="button" class="attachment-chip attachment-chip--preview" data-attachment-preview="${escapeHtml(String(idx))}" title="${title}">${icon} ${name}</button>`;
        }
        return `<span class="attachment-chip" title="${title}">${icon} ${name}</span>`;
    }).join('');
    return `<div class="attachment-chips">${chips}</div>`;
}

function renderDetailMailHeader(item) {
    const sender = senderLineFor(item);
    const when = messageWhenFor(item);
    const abs = when ? formatDate(when) : '';
    const rel = when ? formatRelativeDateTime(when) : '';
    const rows = [];
    if (sender) {
        rows.push(`<div class="detail-mail-row"><span class="detail-mail-key">Od</span><span class="detail-mail-val">${escapeHtml(sender)}</span></div>`);
    }
    if (abs) {
        const whenText = rel && rel !== abs ? `${abs} (${rel})` : abs;
        rows.push(`<div class="detail-mail-row"><span class="detail-mail-key">Data</span><span class="detail-mail-val">${escapeHtml(whenText)}</span></div>`);
    }
    if (!rows.length) {
        return '';
    }
    return `<section class="detail-mail-header">${rows.join('')}</section>`;
}

function renderCaseAttachmentsSection(item) {
    const list = attachmentList(item);
    if (!list.length) {
        return '';
    }
    const rows = list.map(att => {
        const icon = attachmentIcon(att.mime_type);
        const name = escapeHtml(att.file_name);
        const kind = attachmentKindLabel(att);
        const kindText = kind ? `<span class="attachment-kind">${escapeHtml(kind)}</span>` : '';
        const summary = String(att.summary_pl || '').trim();
        if (summary) {
            return `
                <details class="attachment-item">
                    <summary>${icon} ${name} ${kindText}</summary>
                    <p class="attachment-preview">${escapeHtml(summary)}</p>
                </details>`;
        }
        return `<div class="attachment-item attachment-item--plain">${icon} ${name} ${kindText}</div>`;
    }).join('');
    return `
        <section class="detail-section detail-section-intelligence">
            <h3>Załączniki (${list.length})</h3>
            <p class="detail-muted">Podgląd to tekst wyciągnięty przez AI. Pełny plik otwórz w Gmailu.</p>
            ${rows}
        </section>`;
}

function resolveFeedbackNoteId(note) {
    const row = note && typeof note === 'object' ? note : {};
    const candidates = [
        row.v2_desk_note_id,
        row.desk_note_id,
        row.note_id,
    ];
    for (const raw of candidates) {
        const id = String(raw || '').trim();
        if (id.startsWith('note_')) {
            return id;
        }
    }
    return '';
}

function canSendFeedback(note) {
    const row = note && typeof note === 'object' ? note : {};
    if (row.feedback_eligible === false) {
        return false;
    }
    if (row.feedback_eligible === true) {
        return true;
    }
    const noteId = resolveFeedbackNoteId(row);
    const caseId = String(row.case_id || '').trim();
    const sigIds = row.source_signal_ids;
    const signalOk = Array.isArray(sigIds) && String(sigIds[0] || '').trim() !== '';
    return Boolean(noteId && caseId && signalOk);
}

function renderNoteFeedbackBlock(note) {
    const noteId = resolveFeedbackNoteId(note);
    if (!canSendFeedback(note)) {
        const synthetic = String(note.note_id || '').startsWith('desk-') || String(note.note_id || '').startsWith('day-');
        if (synthetic && noteId) {
            return `<p class="detail-muted">Aby ocenić sugestię, otwórz kartkę ponownie z magazynu (przycisk Odśwież), jeśli ingest zdążył zapisać rekord.</p>`;
        }
        return '<p class="detail-muted">Ocena sugestii wymaga powiązania kartki ze sprawą i sygnałem w magazynie.</p>';
    }
    return `
        <section class="detail-section detail-section-actions detail-section-quality">
            <h3>Ocena jakości AI</h3>
            <p class="detail-muted">Czy AI trafnie wyłowiło tę sprawę? Twoja ocena uczy model — nie wysyła nic do klienta.</p>
            <div class="feedback-grid feedback-grid--primary">
                <button type="button" class="btn btn-ghost btn-small" data-note-action="trafne" data-note-id="${escapeHtml(noteId)}" data-tooltip="Slusznie trafilo na biurko">&#128077; Trafne</button>
                <button type="button" class="btn btn-secondary btn-small" data-note-action="zla_sprawa" data-note-id="${escapeHtml(noteId)}" data-tooltip="To nie powinno tu trafic / bledna klasyfikacja">&#128078; Nietrafione</button>
            </div>
            <details class="detail-tech detail-collapsible">
                <summary>Dokładniejsza ocena</summary>
                <div class="detail-tech-body feedback-grid">
                    <button type="button" class="btn btn-ghost btn-small" data-note-action="za_mocne" data-note-id="${escapeHtml(noteId)}" data-tooltip="Priorytet zawyżony">Za wysoki priorytet</button>
                    <button type="button" class="btn btn-ghost btn-small" data-note-action="za_slabe" data-note-id="${escapeHtml(noteId)}" data-tooltip="Priorytet zanizony">Za niski priorytet</button>
                    <button type="button" class="btn btn-ghost btn-small" data-note-action="nie_pokazuj_takich" data-note-id="${escapeHtml(noteId)}" data-tooltip="Wycisz podobne w przyszlosci">Nie pokazuj podobnych</button>
                    ${note.case_id ? `<button type="button" class="btn btn-ghost btn-small" data-note-merge="${escapeHtml(noteId)}" data-tooltip="Scal z istniejaca sprawa">Polacz ze sprawa</button>` : ''}
                </div>
            </details>
        </section>`;
}

function buildDetailTechBundle({ feedBanner = '', decisionView = {}, caseItem = {}, payload = {}, signals = [], traces = [], skrzatCaseId = '' }) {
    const tier1 = feedBanner ? `<div class="detail-tech-tier1-intro">${feedBanner}</div>` : '';
    const tier2 = [];
    tier2.push(projectionBoundaryHtml());
    const dv = renderDecisionViewSection(decisionView || {});
    if (dv) {
        tier2.push(dv);
    }
    if (skrzatCaseId) {
        tier2.push(renderSkrzatPanel(caseItem, payload));
    }
    tier2.push(renderVNextFeedBadgeStrip(caseItem));
    tier2.push(renderCieploEngagementBlock(state.detail && state.detail.engagement));
    const caseId = String(caseItem.case_id || '').trim();
    if (caseId) {
        tier2.push(`<p class="detail-muted">Identyfikator sprawy: <code>${escapeHtml(caseId)}</code></p>`);
    }
    tier2.push(`
        <details class="detail-tech detail-collapsible">
            <summary>Źródła i ślad decyzji (techniczne)</summary>
            <div class="detail-tech-body">
                <section class="detail-section">
                    <h3>Źródła</h3>
                    <ul class="detail-list">${renderSignalItems(signals || [])}</ul>
                </section>
                <section class="detail-section">
                    <h3>Ślad decyzji</h3>
                    <ul class="detail-list">${renderTraceItems(traces || [])}</ul>
                </section>
            </div>
        </details>`);
    return renderOperatorTechTier1(`${tier1}${renderOperatorTechTier2(tier2.join(''))}`);
}

function renderCollapsibleDetailBlockIfPresent(title, sectionSt, previewText, bodyHtml) {
    if (sectionSt !== 'present') {
        return '';
    }
    return renderCollapsibleDetailBlock(title, previewText, bodyHtml);
}

function renderAboutCaseSection(caseItem) {
    const summary = String(caseItem.summary || '').trim();
    const brief = String(caseItem.operator_brief_pl || '').trim();
    const text = summary || brief;
    if (!text) {
        return '';
    }
    if (textsEqual(summary, brief)) {
        return `
            <section class="detail-section">
                <h3>O czym jest sprawa</h3>
                <p>${escapeHtml(text)}</p>
            </section>`;
    }
    let html = '';
    if (summary) {
        html += `
            <section class="detail-section">
                <h3>O czym jest sprawa</h3>
                <p>${escapeHtml(summary)}</p>
            </section>`;
    }
    if (brief && !textsEqual(brief, summary)) {
        html += `
            <section class="detail-section detail-section-intelligence">
                <h3>Uwagi dla operatora</h3>
                <p>${escapeHtml(brief)}</p>
            </section>`;
    }
    return html;
}

function renderWhyOnDeskSection(caseItem) {
    // A1: case cards had no "why is this on my desk today" explanation (only
    // note cards did, via the same why_on_desk field). Only rendered when
    // Node B honestly populated it from a fresh, correlated Understanding —
    // omitted otherwise, never a guessed reason.
    const whySee = String(caseItem.why_on_desk || '').trim();
    if (!whySee) {
        return '';
    }
    return `
        <section class="detail-section">
            <h3>Dlaczego to widzę</h3>
            <p>${escapeHtml(whySee)}</p>
        </section>`;
}

function renderWhatChangedSection(caseItem) {
    // A1: "what changed since last time" — only shown when honestly available.
    const changed = String(caseItem.what_changed_pl || '').trim();
    if (!changed) {
        return '';
    }
    return `
        <section class="detail-section">
            <h3>Co się zmieniło</h3>
            <p>${escapeHtml(changed)}</p>
        </section>`;
}

function renderDetailSectionIfContent(title, htmlBody) {
    const body = String(htmlBody || '').trim();
    if (!body || body.includes('Brak aktywnych') || body.includes('Brak wpisów') || body.includes('Brak powiązanych')) {
        const plain = body.replace(/<[^>]+>/g, '').trim();
        if (!plain || /^Brak\b/i.test(plain)) {
            return '';
        }
    }
    return `
        <section class="detail-section detail-section-intelligence">
            <h3>${escapeHtml(title)}</h3>
            ${body}
        </section>`;
}

function scheduleDetailPanelFocus() {
    requestAnimationFrame(() => {
        const panel = document.getElementById('detail-panel');
        const el = panel && panel.querySelector('[data-detail-focus-root]');
        if (el && typeof el.focus === 'function') {
            el.focus({ preventScroll: true });
        }
    });
}

function setDetailPanelChromeOpen(open) {
    document.body.classList.toggle('detail-panel--open', !!open);
    const bd = document.getElementById('detail-panel-backdrop');
    if (bd) {
        bd.hidden = !open;
        bd.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
}

function limitText(value, max = 130) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= max) {
        return text;
    }
    return `${text.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function countArray(value) {
    return Array.isArray(value) ? value.length : 0;
}

function conflictCountFor(item) {
    return countArray(item?.operator_visible_conflicts) + countArray(item?.conflicting_facts);
}

function gapCountFor(item) {
    return countArray(item?.completeness_gaps) + countArray(item?.missing_info) + countArray(item?.operator_checklist_pl);
}

function recordTypeLabel(item, fallback = 'Uwaga') {
    return firstNonEmpty(
        item.record_type_label,
        item.presence_label,
        item.family_label,
        caseKindLabel(item.case_kind),
        caseFamilyLabel(item.family || item.case_family),
        fallback
    );
}

function recordStatusLabel(item) {
    return firstNonEmpty(
        item.status_label,
        item.current_state_label,
        operationalStatusLabel(item.status || item.operational_status),
        item.lifecycle_label_pl,
        caseStateLabel(item.current_state),
        daszekLifecycle(item.lifecycle_state),
        'aktywny'
    );
}

function operationalStatusLabel(code) {
    const raw = String(code || '').trim();
    return {
        pending_operator: 'Oczekuje operatora',
        ready_for_quote: 'Gotowe do oferty',
        enriching: 'Uzupełnianie danych',
        raw_inquiry: 'Nowe zapytanie',
        node_a_error: 'Błąd kalkulacji',
    }[raw] || humanizeCode(raw, '');
}

function recordDueText(item) {
    const due = firstNonEmpty(item.due_at, item.latest_signal_at, item.updated_at);
    if (!due) {
        return '';
    }
    return formatDate(due);
}

function caseActivityTimestamp(item) {
    return firstNonEmpty(item.latest_signal_at, item.updated_at, item.created_at, item.archived_at) || '';
}

function sortCasesChronologically(items) {
    return [...items].sort((left, right) => {
        const leftTs = caseActivityTimestamp(left);
        const rightTs = caseActivityTimestamp(right);
        if (leftTs === rightTs) {
            return String(left.case_id || '').localeCompare(String(right.case_id || ''));
        }
        return rightTs.localeCompare(leftTs);
    });
}

function getArchivedCaseIdSet() {
    const arch = state.data.caseArchive || {};
    const ids = Array.isArray(arch.ids) ? arch.ids : [];
    return new Set(ids.map(id => String(id || '').trim()).filter(Boolean));
}

function isCaseArchived(caseId) {
    return getArchivedCaseIdSet().has(String(caseId || '').trim());
}

function findCaseRecordById(caseId) {
    const cid = String(caseId || '').trim();
    if (!cid) {
        return null;
    }
    if (hasOperationalFeedSnapshot()) {
        const feed = getOperationalFeed();
        const fromFeed = (feed.cases || []).find(row => String(row.case_id || '') === cid);
        if (fromFeed) {
            return fromFeed;
        }
        const deskRow = iterOperationalFeedDeskLikeItems(feed).find(row => String(row.case_id || '') === cid);
        if (deskRow) {
            return {
                case_id: cid,
                title: firstNonEmpty(deskRow.case_title, deskRow.title, cid),
                summary: firstNonEmpty(deskRow.summary, deskRow.why_on_desk, ''),
                updated_at: deskRow.updated_at,
            };
        }
    }
    const legacy = (state.data.cases.items || []).find(row => String(row.case_id || '') === cid);
    return legacy || null;
}

function isFeedProjectionNoteId(noteId) {
    const nid = String(noteId || '').trim();
    if (!nid) {
        return false;
    }
    return /^desk-/i.test(nid) || /^day-/i.test(nid);
}

function iterOperationalFeedDeskLikeItems(feed) {
    if (!feed || typeof feed !== 'object') {
        return [];
    }
    const out = [];
    for (const item of feed.desk || []) {
        if (item && typeof item === 'object') {
            out.push(item);
        }
    }
    const day = feed.day;
    if (day && Array.isArray(day.sections)) {
        for (const sec of day.sections) {
            if (!sec || !Array.isArray(sec.items)) {
                continue;
            }
            for (const item of sec.items) {
                if (item && typeof item === 'object') {
                    out.push(item);
                }
            }
        }
    }
    return out;
}

function findOperationalFeedDeskNote(noteId) {
    const nid = String(noteId || '').trim();
    if (!nid || !hasOperationalFeedSnapshot()) {
        return null;
    }
    const feed = getOperationalFeed();
    return iterOperationalFeedDeskLikeItems(feed).find(row => String(row.note_id || '') === nid) || null;
}

function deskNotesForCaseFromFeed(caseId, feed) {
    const cid = String(caseId || '').trim();
    if (!cid) {
        return [];
    }
    return iterOperationalFeedDeskLikeItems(feed).filter(row => String(row.case_id || '') === cid);
}

function buildCaseDetailPayloadFromFeedCase(caseRow, feed) {
    const cid = String(caseRow.case_id || '').trim();
    const embedded = feed && typeof feed.case_details === 'object' ? feed.case_details[cid] : null;
    if (embedded && typeof embedded === 'object') {
        return embedded;
    }
    return {
        ok: true,
        generated_at: new Date().toISOString(),
        view: 'case_detail_feed_stub',
        case: { ...caseRow },
        desk_notes: deskNotesForCaseFromFeed(cid, feed).map(n => ({
            note_id: n.note_id,
            case_id: n.case_id,
            title: n.title,
            summary: n.summary,
            why_on_desk: n.why_on_desk,
            recommended_next_step: n.recommended_next_step,
            presence_mode: n.presence_mode,
            updated_at: n.updated_at,
        })),
        signals: [],
        decision_traces: [],
        last_change: {},
        thread_memory: {},
        operational_timeline: [],
        action_proposals: Array.isArray(caseRow.action_proposals) ? caseRow.action_proposals : [],
        execution_results: Array.isArray(caseRow.execution_results) ? caseRow.execution_results : [],
        case_id: cid,
        feed_read_only_stub: true,
    };
}

function resolveOperationalFeedCaseDetail(caseId) {
    const cid = String(caseId || '').trim();
    if (!cid || !hasOperationalFeedSnapshot()) {
        return null;
    }
    const feed = getOperationalFeed();
    const embedded = feed && typeof feed.case_details === 'object' ? feed.case_details[cid] : null;
    if (embedded && typeof embedded === 'object') {
        return embedded;
    }
    const row = findCaseRecordById(cid);
    if (row) {
        return buildCaseDetailPayloadFromFeedCase(row, feed);
    }
    return null;
}

function buildNoteDetailPayloadFromFeedDeskItem(item) {
    const feed = getOperationalFeed();
    const cid = String(item.case_id || '').trim();
    let casePayload = null;
    if (cid) {
        const resolved = resolveOperationalFeedCaseDetail(cid);
        casePayload = resolved && resolved.case ? resolved.case : (findCaseRecordById(cid) || null);
    }
    return {
        ok: true,
        note: item,
        case: casePayload,
        why_you_see_it: item.why_on_desk || item.summary || '',
        operational_timeline: [],
        signals: [],
        decision_traces: [],
        last_change: {},
        feed_projection: true,
    };
}

async function refreshCaseArchiveIndex() {
    try {
        const payload = await apiFetch(V3_API_BASE, '/case-archive');
        const items = Array.isArray(payload.items) ? payload.items : [];
        const ids = Array.isArray(payload.ids)
            ? payload.ids
            : items.map(row => String(row.case_id || '').trim()).filter(Boolean);
        state.data.caseArchive = { ok: true, items, ids, loadError: null };
    } catch (error) {
        state.data.caseArchive = {
            ok: false,
            items: [],
            ids: [],
            loadError: error && error.message ? String(error.message) : 'Nie udało się pobrać archiwum.',
        };
    }
}

async function archiveCaseById(caseId, meta = {}) {
    const cid = String(caseId || '').trim();
    if (!cid) {
        return;
    }
    const record = findCaseRecordById(cid) || {};
    const title = firstNonEmpty(meta.title, record.title, record.case_key, cid);
    const summary = firstNonEmpty(meta.summary, record.summary, record.operator_brief_pl, '');
    const confirmed = window.confirm(`Przenieść sprawę „${title}” do archiwum?\n\nZniknie z listy aktywnych spraw. Możesz ją przywrócić w widoku Archiwum.`);
    if (!confirmed) {
        return;
    }
    try {
        await apiFetch(V2_API_BASE, `/cases/${encodeURIComponent(cid)}/archive`, {
            method: 'POST',
            body: JSON.stringify({
                title,
                summary,
                latest_signal_at: caseActivityTimestamp(record),
            }),
        });
        showToast('Sprawa została zarchiwizowana.');
        if (state.detail && state.detail.type === 'case') {
            const openId = (state.detail.payload && state.detail.payload.case && state.detail.payload.case.case_id) || '';
            if (openId === cid) {
                state.detail = null;
                renderDetailPanel();
            }
        }
        await refreshCaseArchiveIndex();
        renderCurrentView();
    } catch (error) {
        showError(error.message);
    }
}

async function unarchiveCaseById(caseId) {
    const cid = String(caseId || '').trim();
    if (!cid) {
        return;
    }
    try {
        await apiFetch(V2_API_BASE, `/cases/${encodeURIComponent(cid)}/unarchive`, { method: 'POST' });
        showToast('Sprawa została przywrócona z archiwum.');
        await refreshCaseArchiveIndex();
        renderCurrentView();
    } catch (error) {
        showError(error.message);
    }
}

function noteBucket(item) {
    const priority = String(item.priority || item.business_priority || '').toLowerCase();
    const mode = String(item.presence_mode || '').toLowerCase();
    const waiting = firstNonEmpty(item.waiting_for, item.waiting_for_label);
    const operational = String(item.operational_status || '').toLowerCase();
    const hasAttentionIssue = conflictCountFor(item) > 0 || gapCountFor(item) > 0 || item.review_required;

    if (waiting || operational === 'waiting' || countArray(item.blockers) > 0 || item.maintenance_guard?.blocked) {
        return 'waiting';
    }
    if (hasAttentionIssue || priority === 'critical' || priority === 'high' || ['alarm', 'strong', 'advisory'].includes(mode)) {
        return 'decision';
    }
    return 'now';
}

function groupDeskItems(items) {
    const groups = {
        now: { key: 'now', title: 'Teraz', subtitle: 'Najkrótsza lista rzeczy do ruszenia od razu.', items: [] },
        decision: { key: 'decision', title: 'Do decyzji', subtitle: 'Tematy niepewne albo wymagające człowieka.', items: [] },
        waiting: { key: 'waiting', title: 'Oczekujące / zablokowane', subtitle: 'Aktywne sprawy, ale niekoniecznie do wykonania w tej chwili.', items: [] },
    };

    items.forEach(item => {
        groups[noteBucket(item)].items.push(item);
    });

    if (!groups.now.items.length && groups.decision.items.length) {
        groups.now.items = groups.decision.items.splice(0, Math.min(3, groups.decision.items.length));
    }

    return [groups.now, groups.decision, groups.waiting].filter(group => group.items.length);
}

function renderRecordBadges(item, { includeSource = true } = {}) {
    const badges = [];
    const priority = String(item.priority || item.business_priority || '').trim();
    const due = recordDueText(item);
    const conflicts = conflictCountFor(item);
    const gaps = gapCountFor(item);

    if (priority) {
        badges.push(`<span class="record-badge record-badge-${escapeHtml(priorityTone(priority))}">${escapeHtml(priorityLabel(priority))}</span>`);
    }
    if (due) {
        badges.push(`<span class="record-badge">${escapeHtml(due)}</span>`);
    }
    if (conflicts) {
        badges.push(`<span class="record-badge record-badge-risk">Sprzeczności: ${escapeHtml(String(conflicts))}</span>`);
    }
    if (gaps) {
        badges.push(`<span class="record-badge record-badge-gap">Braki: ${escapeHtml(String(gaps))}</span>`);
    }
    if (includeSource && item.latest_change_source_label) {
        badges.push(`<span class="record-badge">${escapeHtml(item.latest_change_source_label)}</span>`);
    }
    return badges.length ? `<div class="record-badges">${badges.join('')}</div>` : '';
}

function renderOperationalNoteRecord(item, { showDone = true, compact = false } = {}) {
    const title = firstNonEmpty(item.title, 'Kartka operacyjna');
    const caseTitle = firstNonEmpty(item.case_title, item.case_id ? 'Powiązana sprawa' : 'Bez przypisanej sprawy');
    // Single-stream: kafelek Biurka to projekcja sprawy — klik w całą kartę otwiera tę samą sprawę.
    const opensCase = Boolean(item.case_id);
    const openAttr = opensCase
        ? `data-open-case="${escapeHtml(item.case_id)}"`
        : `data-open-note="${escapeHtml(item.note_id)}"`;
    const openLabel = opensCase ? `Otwórz sprawę: ${limitText(title, 60)}` : `Otwórz kartkę: ${limitText(title, 60)}`;
    const statusLabel = humanizeOperationalStatus(item.operational_status) || recordStatusLabel(item);
    const activity = recordActivityLabel(item);
    const hasDraft = Boolean(String(item.draft_reply_pl || '').trim());
    return `
        <article class="operational-record">
            <button type="button" class="record-main" ${openAttr} aria-label="${escapeHtml(openLabel)}" aria-controls="detail-panel">
                <div class="record-top">
                    <span class="record-type">${escapeHtml(recordTypeLabel(item, 'Uwaga'))}</span>
                    <span class="record-status">${escapeHtml(statusLabel)}</span>
                </div>
                ${renderMailHeaderLine(item)}
                ${renderOperatorHero(item, { essenceMax: compact ? 120 : 200 })}
                ${renderRecordBadges(item)}
                <div class="record-footer">
                    <span>${escapeHtml(caseTitle)}</span>
                    ${activity ? `<span>Aktywność: ${escapeHtml(activity)}</span>` : ''}
                </div>
            </button>
            <div class="record-actions">
                ${hasDraft && opensCase ? `<button type="button" class="btn btn-primary btn-small" ${openAttr} aria-label="${escapeHtml(openLabel)}">Przejrzyj draft</button>` : ''}
                ${showDone ? `<button type="button" class="btn btn-secondary btn-small" data-note-action="to_juz_nieaktualne" data-note-id="${escapeHtml(item.note_id)}">Zrobione</button>` : ''}
            </div>
        </article>
    `;
}

function operationalStatusPillClass(statusRaw) {
    const s = String(statusRaw || '').trim().toUpperCase();
    if (s.includes('CONFLICT') || s === 'CONFLICT') {
        return 'status-pill--conflict';
    }
    if (s.includes('WAIT') || s.includes('REVIEW')) {
        return 'status-pill--review';
    }
    if (s.includes('CLOSE') || s.includes('DONE')) {
        return 'status-pill--closed';
    }
    return 'status-pill--default';
}

function renderOperationalCaseRecord(item, options = {}) {
    const previewOnly = Boolean(options.previewOnly);
    const title = firstNonEmpty(item.title, item.case_key, 'Sprawa operacyjna');
    const area = firstNonEmpty(item.business_area_label, businessAreaLabel(item.business_area), item.family_label, caseFamilyLabel(item.family));
    const taskCount = Number(item.open_task_count || item.active_note_count || 0);
    const openCaseLabel = `Otwórz sprawę: ${limitText(title, 60)}`;
    const statusLabel = firstNonEmpty(item.status_label, caseStatusLabel(item.status));
    const opHuman = humanizeOperationalStatus(item.operational_status);
    const opPill = opHuman ? `<span class="status-pill ${operationalStatusPillClass(item.operational_status)}">${escapeHtml(opHuman)}</span>` : '';
    const previewClass = previewOnly ? ' operational-record--preview' : '';
    return `
        <article class="operational-record operational-record-case${previewClass}">
            <button type="button" class="record-main" data-open-case="${escapeHtml(item.case_id)}" aria-label="${escapeHtml(openCaseLabel)}" aria-controls="detail-panel">
                <div class="record-top">
                    <span class="record-type">${escapeHtml(area || 'Sprawa')}</span>
                    <span class="record-status">${escapeHtml(statusLabel)}${opPill}</span>
                </div>
                ${renderMailHeaderLine(item)}
                ${renderOperatorHero(item, { essenceMax: 200 })}
                ${renderRecordBadges(item, { includeSource: false })}
                <div class="record-footer">
                    <span>Otwarte kartki: ${escapeHtml(String(taskCount))}</span>
                    ${caseActivityTimestamp(item) ? `<span>Aktywność: ${escapeHtml(formatDate(caseActivityTimestamp(item)))}</span>` : ''}
                </div>
            </button>
            ${previewOnly ? '' : `<div class="record-actions">
                ${item.case_id && !options.archived ? `<button type="button" class="btn btn-ghost btn-small" data-archive-case="${escapeHtml(item.case_id)}">Archiwizuj</button>` : ''}
                ${item.case_id && options.archived ? `<button type="button" class="btn btn-secondary btn-small" data-unarchive-case="${escapeHtml(item.case_id)}">Przywróć</button>` : ''}
            </div>`}
        </article>
    `;
}

function renderOperationalSection(section, options = {}) {
    const limit = options.limit || section.items.length;
    const visible = section.items.slice(0, limit);
    const hiddenCount = section.items.length - visible.length;
    return `
        <section class="ops-section ops-section-${escapeHtml(section.key || 'items')}">
            <div class="section-header ops-section-header">
                <div>
                    <h3>${escapeHtml(section.title)}</h3>
                    ${section.subtitle ? `<p>${escapeHtml(section.subtitle)}</p>` : ''}
                </div>
                <span>${escapeHtml(String(section.items.length))}</span>
            </div>
            <div class="operational-list">
                ${visible.map(item => renderOperationalNoteRecord(item, options)).join('')}
            </div>
            ${hiddenCount > 0 ? `<p class="detail-muted ops-more">Jeszcze ${escapeHtml(String(hiddenCount))} tematów poza pierwszym ekranem.</p>` : ''}
        </section>
    `;
}

/** @returns {'missing'|'empty'|'present'} */
function sectionState(obj, key) {
    const o = obj && typeof obj === 'object' ? obj : {};
    if (!Object.prototype.hasOwnProperty.call(o, key)) {
        return 'missing';
    }
    const v = o[key];
    if (v == null || v === '') {
        return 'empty';
    }
    if (Array.isArray(v)) {
        return v.length ? 'present' : 'empty';
    }
    if (typeof v === 'object') {
        return Object.keys(v).length ? 'present' : 'empty';
    }
    return 'present';
}

function sectionStateMessage(state, missingText, emptyText) {
    if (state === 'missing') {
        return `<p class="detail-muted">${escapeHtml(missingText)}</p>`;
    }
    if (state === 'empty') {
        return `<p class="detail-muted">${escapeHtml(emptyText)}</p>`;
    }
    return '';
}

function renderCollapsibleDetailBlock(title, previewText, bodyHtml, { open = false } = {}) {
    const openAttr = open ? ' open' : '';
    const prev = previewText ? escapeHtml(String(previewText)) : 'Szczegóły';
    return `
    <details class="detail-section-collapsible detail-section-intelligence"${openAttr}>
        <summary>
            <span class="detail-collapsible-title">${escapeHtml(title)}</span>
            <span class="detail-collapsible-preview">${prev}</span>
        </summary>
        <div class="detail-collapsible-inner">${bodyHtml}</div>
    </details>`;
}

function proposalKeysPresent(caseItem, payload) {
    const c = caseItem && typeof caseItem === 'object' ? caseItem : {};
    const p = payload && typeof payload === 'object' ? payload : {};
    return ['action_proposals', 'proposed_next_actions'].some(
        k => Object.prototype.hasOwnProperty.call(c, k) || Object.prototype.hasOwnProperty.call(p, k),
    );
}

function proposalSectionState(caseItem, payload) {
    if (!proposalKeysPresent(caseItem, payload)) {
        return 'missing';
    }
    const merged = collectActionProposalsForUi(caseItem, payload);
    return merged.length ? 'present' : 'empty';
}

function conflictsKeysPresent(caseItem) {
    const c = caseItem && typeof caseItem === 'object' ? caseItem : {};
    return Object.prototype.hasOwnProperty.call(c, 'conflicting_facts')
        || Object.prototype.hasOwnProperty.call(c, 'operator_visible_conflicts');
}

function conflictsSectionState(caseItem) {
    if (!conflictsKeysPresent(caseItem)) {
        return 'missing';
    }
    const list = caseItem.operator_visible_conflicts || caseItem.conflicting_facts || [];
    return Array.isArray(list) && list.length ? 'present' : 'empty';
}

function executionHistorySectionState(caseItem, payload) {
    const c = caseItem && typeof caseItem === 'object' ? caseItem : {};
    const p = payload && typeof payload === 'object' ? payload : {};
    const hasC = Object.prototype.hasOwnProperty.call(c, 'execution_results');
    const hasP = Object.prototype.hasOwnProperty.call(p, 'execution_results');
    if (!hasC && !hasP) {
        return 'missing';
    }
    const list = (hasP ? p.execution_results : null) ?? (hasC ? c.execution_results : null) ?? [];
    return Array.isArray(list) && list.length ? 'present' : 'empty';
}

function collectActionProposalsForUi(caseItem, payload) {
    const c = caseItem && typeof caseItem === 'object' ? caseItem : {};
    const p = payload && typeof payload === 'object' ? payload : {};
    const raw = [
        ...(Array.isArray(p.action_proposals) ? p.action_proposals : []),
        ...(Array.isArray(c.action_proposals) ? c.action_proposals : []),
        ...(Array.isArray(p.proposed_next_actions) ? p.proposed_next_actions : []),
        ...(Array.isArray(c.proposed_next_actions) ? c.proposed_next_actions : []),
    ].filter(x => x && typeof x === 'object');
    const seen = new Set();
    const out = [];
    raw.forEach((item, idx) => {
        const k = proposalDedupeKey(item, idx);
        if (seen.has(k)) {
            return;
        }
        seen.add(k);
        out.push(item);
    });
    return out;
}

function proposalDedupeKey(item, idx) {
    const id = String((item || {}).proposal_id || '').trim();
    if (id) {
        return `p:${id}`;
    }
    const aid = String((item || {}).action_id || '').trim();
    if (aid) {
        return `a:${aid}`;
    }
    const oid = String((item || {}).id || '').trim();
    if (oid) {
        return `i:${oid}`;
    }
    return `f:${String((item || {}).action_type || '')}:${idx}`;
}

function renderTechnicalDetails(title, value) {
    if (value == null || value === '') {
        return '';
    }
    let str = '';
    if (typeof value === 'string') {
        str = value;
    } else {
        try {
            str = JSON.stringify(value, null, 2);
        } catch (e) {
            str = String(value);
        }
    }
    const esc = escapeHtml(str);
    if (!esc.trim()) {
        return '';
    }
    return `
        <details class="detail-tech">
            <summary class="detail-muted">${escapeHtml(title)}</summary>
            <pre class="detail-pre">${esc}</pre>
        </details>`;
}

function polishPolicyStatus(raw) {
    const s = String(raw || '').trim();
    const map = {
        allowed_for_projection: 'Do pokazania operatorowi',
        blocked: 'Zablokowane',
        requires_approval: 'Wymaga akceptacji',
    };
    return map[s] || (s ? humanizeCode(s, s) : '');
}

function polishProposalStatus(raw) {
    const s = String(raw || '').trim();
    const map = {
        proposed: 'Zaproponowane',
        approved: 'Zatwierdzone',
        rejected: 'Odrzucone',
        executed: 'Wykonane',
        expired: 'Wygasłe',
        new: 'Nowe',
        requires_approval: 'Wymaga akceptacji',
    };
    return map[s] || (s ? humanizeCode(s, s) : 'Nieznany');
}

function polishRiskLevel(raw) {
    const s = String(raw || '').trim().toLowerCase();
    const map = {
        low: 'niskie',
        medium: 'średnie',
        high: 'wysokie',
        unknown: 'nieokreślone',
    };
    return map[s] || (s ? humanizeCode(s, 'nieokreślone') : 'nieokreślone');
}

function polishGapSeverity(raw) {
    const s = String(raw || '').trim().toLowerCase();
    const map = {
        info: 'informacja',
        warning: 'ostrzeżenie',
        blocking: 'blokujące',
        high: 'wysokie',
        medium: 'średnie',
        low: 'niskie',
    };
    return map[s] || (s ? humanizeCode(s, s) : '');
}

function polishGapStatus(raw) {
    const s = String(raw || '').trim().toLowerCase();
    const map = {
        open: 'otwarte',
        closed: 'zamknięte',
        waived: 'świadomie pominięte',
        resolved: 'rozwiązane',
        false_positive: 'fałszywy alarm',
        needs_action: 'wymaga działania',
    };
    return map[s] || (s ? humanizeCode(s, s) : '');
}

function polishExecutionStatus(raw) {
    const s = String(raw || '').trim().toLowerCase();
    const map = {
        completed: 'Zakończone',
        failed: 'Niepowodzenie',
        pending: 'Oczekuje',
        skipped: 'Pominięte',
    };
    return map[s] || (s ? humanizeCode(s, s) : '');
}

function mailboxSourceTypeLabel(type) {
    const t = String(type || '').trim().toLowerCase();
    const map = {
        ref: 'Odniesienie',
        gmail_message: 'Wiadomość e-mail',
        email_thread: 'Wątek e-mail',
        drive_document: 'Dokument na dysku',
        document: 'Dokument',
        calendar_event: 'Wydarzenie w kalendarzu',
        event: 'Zdarzenie',
    };
    return map[t] || humanizeCode(t, 'Źródło');
}

function formatEvidenceRefsSummary(refs) {
    const list = Array.isArray(refs) ? refs : [];
    if (!list.length) {
        return '';
    }
    const bits = list.slice(0, 4).map(r => {
        if (typeof r === 'string') {
            return r;
        }
        if (r && typeof r === 'object') {
            return r.label || r.source_ref || r.id || r.source_id || '';
        }
        return '';
    }).filter(Boolean);
    const tail = list.length > 4 ? ` (+${list.length - 4})` : '';
    return bits.length ? `${bits.join(', ')}${tail}` : '';
}

function downstreamSignalCategoryLabel(sig) {
    const st = String((sig || {}).subtype || '').trim().toLowerCase();
    const map = {
        warranty_service_state: 'Serwis / gwarancja',
        media_evidence_presence: 'Marketing / materiały',
        review_request: 'Opinia / rekomendacja',
        retention: 'Retencja',
    };
    if (map[st]) {
        return map[st];
    }
    const t = String((sig || {}).type || '').trim().toLowerCase();
    if (t === 'service') {
        return 'Serwis';
    }
    if (t === 'marketing') {
        return 'Marketing';
    }
    return humanizeCode(st || t, 'Rekomendacja');
}

function calendarRiskLabelPl(code) {
    const c = String(code || '').trim();
    const map = {
        no_calendar_action_needed: 'Brak wymaganego działania w kalendarzu',
    };
    return map[c] || humanizeCode(c, c || 'Nieokreślone');
}

function taskSourceLabel(source) {
    return {
        gmail_intake: 'Gmail Intake / zgodność',
        manual: 'Ręczne',
        auto: 'Automatyczne',
        mail: 'Mail',
    }[source] || humanizeCode(source, 'Nieznane');
}

function businessAreaLabel(area) {
    return {
        sales: 'Sprzedaż',
        finance: 'Finanse',
        procurement: 'Zakupy',
        logistics: 'Logistyka',
        operations: 'Operacje',
        service: 'Serwis',
        security: 'Bezpieczeństwo',
        supplier_commercial: 'Relacje z dostawcami',
        marketing_growth: 'Marketing',
        compliance_legal: 'Prawo i zgodność',
        internal_coordination: 'Koordynacja wewnętrzna',
        general_admin: 'Administracja',
    }[area] || humanizeCode(area, 'Operacje');
}

function caseKindLabel(kind) {
    return {
        wycena_oferta: 'Wycena / oferta',
        zapytanie_klienta: 'Zapytanie klienta',
        awaria_naprawa: 'Awaria / serwis',
        przeglad_konserwacja: 'Przegląd / konserwacja',
        faktura_sprzedaz: 'Faktura sprzedażowa',
        faktura_zakup: 'Faktura zakupowa',
        ksiegowosc: 'Księgowość',
        zakupy_materialow: 'Zakupy materiałów',
        szkolenie: 'Szkolenie / webinar',
        inne: 'Sprawa wewnętrzna',
        niezaklasyfikowane: 'Sprawa ogólna',
    }[kind] || humanizeCode(kind, '');
}

function caseFamilyLabel(family) {
    return {
        lead_opportunity: 'Szansa sprzedażowa',
        finance_settlement: 'Rozliczenie finansowe',
        procurement_delivery: 'Dostawa zakupowa',
        supplier_commercial_review: 'Ustalenia z dostawcą',
        platform_service_security: 'Incydent platformy lub bezpieczeństwa',
        compliance_legal_review: 'Sprawa prawna lub zgodność',
        marketing_performance_review: 'Wyniki marketingu',
        internal_coordination: 'Koordynacja wewnętrzna',
        unknown: 'Sprawa ogólna',
    }[family] || humanizeCode(family, 'Sprawa ogólna');
}

function caseStatusLabel(status) {
    return {
        open: 'Otwarta',
        closed: 'Zamknięta',
        merged: 'Połączona',
    }[status] || humanizeCode(status, 'Otwarta');
}

function caseStateLabel(stateValue) {
    return {
        none: 'Bez stanu',
        new: 'Nowa',
        active: 'Aktywna',
        received: 'Odebrane',
        delivered: 'Dostarczone',
        delivery_at_risk: 'Dostawa zagrożona',
        ordered: 'Zamówione',
        delayed: 'Opóźnione',
        waiting_for_reply: 'Czeka na odpowiedź',
        resolved: 'Rozwiązana',
    }[stateValue] || humanizeCode(stateValue, 'Bez stanu');
}

function renderGuidanceSection(entity, { compact = false } = {}) {
    if (!entity || (!entity.operational_status && !entity.guidance_reason_summary_pl)) {
        return '';
    }
    const badge = entity.operational_status_label || entity.operational_status || '';
    const wait = entity.waiting_for && entity.waiting_for !== 'none'
        ? `<span class="guidance-waiting">${escapeHtml(entity.waiting_for_label || entity.waiting_for)}</span>`
        : '';
    const stagn = entity.stagnation_flag
        ? '<span class="guidance-stagnation" title="Zaleganie">stoi</span>'
        : '';
    const reason = entity.guidance_reason_summary_pl
        ? `<p>${escapeHtml(entity.guidance_reason_summary_pl)}</p>`
        : '';
    const blocker = entity.blocker_summary_pl
        ? `<p class="detail-muted"><strong>Blokada:</strong> ${escapeHtml(entity.blocker_summary_pl)}</p>`
        : '';
    const hint = entity.next_step_hint_pl
        ? `<p class="detail-muted"><strong>Hint:</strong> ${escapeHtml(entity.next_step_hint_pl)}</p>`
        : '';
    if (compact) {
        return `
            <div class="guidance-compact">
                ${badge ? `<span class="guidance-badge">${escapeHtml(badge)}</span>` : ''}
                ${wait}
                ${stagn}
            </div>
        `;
    }
    return `
        <section class="detail-section detail-section-guidance">
            <h3>Stan sprawy (guidance)</h3>
            <div class="guidance-meta">
                ${badge ? `<span class="guidance-badge">${escapeHtml(badge)}</span>` : ''}
                ${wait}
                ${stagn}
            </div>
            ${reason}
            ${blocker}
            ${hint}
        </section>
    `;
}

function riskTypeLabel(riskType) {
    return {
        lead_loss_risk: 'Ryzyko utraty leada',
        operational_delay_risk: 'Ryzyko opóźnienia operacyjnego',
        logistics_risk: 'Ryzyko logistyczne',
        finance_risk: 'Ryzyko finansowe',
        interpretation_risk: 'Ryzyko błędnej interpretacji',
        aging_risk: 'Ryzyko zalegania',
        customer_silence_risk: 'Ryzyko ciszy klienta',
        supplier_dependency_risk: 'Ryzyko zależności od dostawcy',
    }[riskType] || humanizeCode(riskType, 'Ryzyko');
}

function decisionTypeLabel(decisionType) {
    return {
        upsert_case: 'Aktualizacja sprawy',
        create_note: 'Utworzenie kartki',
        update: 'Aktualizacja kartki',
        resolve: 'Oznaczenie jako załatwione',
        suppress: 'Wyciszenie kartki',
        merge: 'Scalenie',
        compatibility_update: 'Aktualizacja z widoku Zadań',
        trafne: 'Ocena: trafne',
        za_mocne: 'Ocena: za mocne',
        za_slabe: 'Ocena: za słabe',
        tylko_w_sprawie: 'Tylko w sprawie',
        nie_pokazuj_takich: 'Nie pokazuj takich',
        polacz_ze_sprawa: 'Połącz ze sprawą',
        to_juz_nieaktualne: 'Już nieaktualne',
        zla_sprawa: 'Błędne powiązanie ze sprawą',
    }[decisionType] || humanizeCode(decisionType, 'Zmiana');
}

function changeSourceTone(source) {
    return {
        intake: 'intake',
        operator: 'operator',
        maintenance: 'maintenance',
    }[source] || 'neutral';
}

function renderMetaBadge(label, tone = 'neutral') {
    const text = String(label || '').trim();
    if (!text) {
        return '';
    }
    return `<span class="meta-badge meta-badge-${escapeHtml(tone)}">${escapeHtml(text)}</span>`;
}

function renderMaintenanceGuard(guard) {
    if (!guard || !guard.blocked) {
        return '';
    }
    const blockedUntil = formatDate(guard.blocked_until);
    const reason = guard.reason_pl || 'Świeży manual feedback blokuje maintenance przez 7 dni.';
    const lastAction = guard.last_action_label
        ? `<div class="detail-muted">Ostatnia akcja operatora: ${escapeHtml(guard.last_action_label)} • ${escapeHtml(blockedUntil)}</div>`
        : `<div class="detail-muted">Maintenance zablokowany do ${escapeHtml(blockedUntil)}</div>`;
    return `
        <div class="guard-callout">
            <strong>Manual feedback blokuje maintenance</strong>
            <div>${escapeHtml(reason)}</div>
            ${lastAction}
        </div>
    `;
}

function renderLastChangeSummary(change, guard = null) {
    const sourceLabel = change?.source_label || 'Intake AI';
    const decisionLabel = change?.decision_type_label || '';
    const ruleLabel = change?.maintenance_rule_label_pl || '';
    const reason = change?.reason_summary_pl || '';
    const createdAt = change?.created_at ? formatDate(change.created_at) : '';
    const badges = [
        renderMetaBadge(`Źródło: ${sourceLabel}`, changeSourceTone(change?.source)),
        decisionLabel ? renderMetaBadge(decisionLabel, changeSourceTone(change?.source)) : '',
        ruleLabel ? renderMetaBadge(ruleLabel, 'maintenance') : '',
    ].filter(Boolean).join('');

    return `
        ${badges ? `<div class="note-meta-badges">${badges}</div>` : ''}
        <p>${escapeHtml(reason || 'Brak dodatkowego uzasadnienia ostatniej zmiany.')}</p>
        ${createdAt ? `<p class="detail-muted">Ostatnia zmiana: ${escapeHtml(createdAt)}</p>` : ''}
        ${renderMaintenanceGuard(guard)}
    `;
}

function compatibilityTaskTitle(task) {
    const title = String((task || {}).title || '').trim();
    if (!title) {
        return 'Zadanie';
    }
    return title
        .replace(/^Task:\s*/i, 'Zadanie: ')
        .replace(/^Case:\s*/i, 'Sprawa: ')
        .replace(/^Review:\s*/i, 'Do przeglądu: ');
}

function compatibilityTaskSummary(task) {
    const intake = (task || {}).intake || {};
    if ((task || {}).source === 'gmail_intake' && intake.decision_action) {
        const parts = ['Pozycja zgodności z Gmail Intake.'];
        parts.push(`Obszar: ${businessAreaLabel(intake.business_area)}.`);
        if ((task || {}).due_at) {
            parts.push(`Termin: ${formatDate(task.due_at)}.`);
        }
        if (intake.review_required) {
            parts.push('Wymaga ręcznej oceny.');
        }
        return parts.join(' ');
    }
    return String((task || {}).note || '').trim();
}

function matchesSearch(parts) {
    if (!state.search.trim()) {
        return true;
    }
    const query = state.search.trim().toLowerCase();
    return parts.some(part => String(part || '').toLowerCase().includes(query));
}

async function login(loginName, password) {
    try {
        const data = await apiFetch(V1_API_BASE, '/login', {
            method: 'POST',
            body: JSON.stringify({ login: loginName, password }),
        });

        state.currentUser = data.user;
        state.csrfToken = data.csrf_token;
        showMainScreen();
        await loadAllData();
    } catch (error) {
        const box = document.getElementById('login-error');
        box.textContent = error.message;
        box.style.display = 'block';
    }
}

async function logout() {
    try {
        await apiFetch(V1_API_BASE, '/logout', { method: 'POST' });
    } catch (error) {
        console.error(error);
    } finally {
        state.currentUser = null;
        state.csrfToken = getCsrfToken();
        showLoginScreen();
    }
}

function hasDaszekSessionCookie() {
    const name = 'daszek_session=';
    return document.cookie.split(';').some(part => part.trim().startsWith(name));
}

async function tryRestoreSession() {
    if (!hasDaszekSessionCookie()) {
        return false;
    }
    try {
        const me = await apiFetch(V1_API_BASE, '/me');
        if (me && me.ok && me.user) {
            state.currentUser = me.user;
            if (me.csrf_token) {
                state.csrfToken = me.csrf_token;
            }
            showMainScreen();
            await loadAllData();
            return true;
        }
    } catch (error) {
        if (error && error.status === 401) {
            showLoginScreen();
            return false;
        }
    }
    return false;
}

function bindClick(id, handler) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`Daszek UI: brak elementu #${id}`);
        return;
    }
    el.addEventListener('click', handler);
}

function parseViewFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const v = normalizeMainViewId(params.get('view'));
        if (v) {
            state.currentView = v;
        }
    } catch (err) {
        console.warn('Daszek: parseViewFromUrl', err);
    }
}

function syncViewToUrl(viewKey) {
    const normalized = normalizeMainViewId(viewKey);
    if (!normalized) {
        return;
    }
    try {
        const url = new URL(window.location.href);
        url.searchParams.set('view', normalized);
        history.replaceState({}, '', url);
    } catch (err) {
        console.warn('Daszek: syncViewToUrl', err);
    }
}

async function loadAllData() {
    const viewRoot = document.getElementById('view-root');
    if (viewRoot) {
        viewRoot.setAttribute('aria-busy', 'true');
    }
    try {
        clearError();
        parseViewFromUrl();
        setViewHeader('Ładuję zasilenie Daszka…', 'Pobieranie projekcji operational feed, biurka i ingressu (read-only).');

        const requests = await Promise.allSettled([
            apiFetch(V3_API_BASE, '/desk'),
            apiFetch(V3_API_BASE, '/cockpit'),
            apiFetch(V3_API_BASE, '/day'),
            apiFetch(V3_API_BASE, '/cases'),
            apiFetch(V3_API_BASE, '/ai-quality'),
            apiFetch(V2_API_BASE, '/mailbox-cases?view=full&limit=500'),
            apiFetch(V3_API_BASE, '/operational-feed-snapshots/latest'),
            apiFetch(V3_API_BASE, '/ingress-quality-snapshots/latest'),
            apiFetch(V3_API_BASE, '/cohort-runs'),
            apiFetch(V3_API_BASE, '/case-archive'),
        ]);

        const [deskResult, cockpitResult, dayResult, casesResult, qualityResult, mailboxCasesResult, operationalResult, lastIngressResult, cohortListResult, caseArchiveResult] = requests;

        let feedWins = false;
        if (operationalResult.status === 'fulfilled') {
            const v = operationalResult.value;
            if (v && typeof v === 'object' && v.ok && v.snapshot && v.snapshot.feed) {
                state.data.operationalFeed = { ok: true, snapshot: v.snapshot, message: '', loadError: null };
                feedWins = true;
            } else if (v && typeof v === 'object' && v.ok) {
                state.data.operationalFeed = {
                    ok: true,
                    snapshot: null,
                    message: typeof v.message === 'string' ? v.message : '',
                    loadError: null,
                };
            } else {
                state.data.operationalFeed = { ok: false, snapshot: null, message: '', loadError: null };
            }
        } else {
            const reason = operationalResult.reason;
            state.data.operationalFeed = {
                ok: false,
                snapshot: null,
                message: '',
                loadError: reason && reason.message ? String(reason.message) : 'Nie udało się pobrać operational feed.',
            };
        }

        if (deskResult.status === 'fulfilled' && !feedWins) {
            state.data.desk = deskResult.value;
        }
        if (cockpitResult.status === 'fulfilled') {
            state.data.cockpit = cockpitResult.value;
            state.data.cockpit.loadError = null;
        } else {
            state.data.cockpit = { loadError: String(cockpitResult.reason && cockpitResult.reason.message ? cockpitResult.reason.message : cockpitResult.reason) };
        }
        if (dayResult.status === 'fulfilled' && !feedWins) {
            state.data.day = dayResult.value;
        }
        if (casesResult.status === 'fulfilled' && !feedWins) {
            state.data.cases = casesResult.value;
        }
        if (qualityResult.status === 'fulfilled') {
            state.data.quality = qualityResult.value;
            state.data.quality.loadError = null;
        } else {
            state.data.quality = { summary: {}, loadError: String(qualityResult.reason && qualityResult.reason.message ? qualityResult.reason.message : qualityResult.reason) };
        }
        if (mailboxCasesResult.status === 'fulfilled') {
            const v = mailboxCasesResult.value;
            if (v && typeof v === 'object' && v.ok) {
                state.data.mailboxCases = {
                    ok: true,
                    cases: Array.isArray(v.cases) ? v.cases : [],
                    loadError: null,
                };
            } else {
                state.data.mailboxCases = {
                    ok: false,
                    cases: [],
                    loadError: (v && v.error) ? String(v.error) : 'Nie udało się pobrać rejestru spraw.',
                };
            }
        } else {
            const reason = mailboxCasesResult.reason;
            state.data.mailboxCases = {
                ok: false,
                cases: [],
                loadError: reason && reason.message ? String(reason.message) : 'Nie udało się pobrać rejestru spraw.',
            };
        }

        if (lastIngressResult.status === 'fulfilled') {
            state.data.lastIngress = lastIngressResult.value;
        } else {
            state.data.lastIngress = { ok: false, snapshot: null, message: '' };
        }

        if (cohortListResult.status === 'fulfilled') {
            const cl = cohortListResult.value;
            if (cl && typeof cl === 'object' && cl.ok && Array.isArray(cl.items)) {
                state.data.cohortList = { ok: true, items: cl.items, loadError: null };
            } else {
                state.data.cohortList = { ok: false, items: [], loadError: null };
            }
        } else {
            const reason = cohortListResult.reason;
            state.data.cohortList = {
                ok: false,
                items: [],
                loadError: reason && reason.message ? String(reason.message) : 'Nie udało się pobrać listy kohort.',
            };
        }

        if (caseArchiveResult.status === 'fulfilled') {
            const arch = caseArchiveResult.value;
            const items = arch && Array.isArray(arch.items) ? arch.items : [];
            const ids = arch && Array.isArray(arch.ids)
                ? arch.ids
                : items.map(row => String(row.case_id || '').trim()).filter(Boolean);
            state.data.caseArchive = { ok: true, items, ids, loadError: null };
        } else {
            const reason = caseArchiveResult.reason;
            state.data.caseArchive = {
                ok: false,
                items: [],
                ids: [],
                loadError: reason && reason.message ? String(reason.message) : 'Nie udało się pobrać archiwum.',
            };
        }

        const rejected = requests.filter(item => item.status === 'rejected');
        if (rejected.length) {
            const unauthorized = rejected.find(item => item.reason && item.reason.status === 401);
            if (unauthorized) {
                showLoginScreen();
                return;
            }
            showError('Nie udało się wczytać pełnego widoku. Widok zgodności pozostaje dostępny.');
        }

        renderCurrentView();
        populateChatCaseSelect();
    } finally {
        if (viewRoot) {
            viewRoot.removeAttribute('aria-busy');
        }
    }
}

const KNOWN_MAIN_VIEWS = new Set(['desk', 'cockpit', 'day', 'cases', 'archive', 'quality', 'tasks', 'system', 'last_ingress', 'cohort_runs', 'chat', 'decisions', 'identity', 'constitution']);

function normalizeMainViewId(raw) {
    const id = String(raw || '').trim();
    if (id === 'tasks') {
        return 'cases';
    }
    if (KNOWN_MAIN_VIEWS.has(id)) {
        return id;
    }
    if (id === 'last-ingress') {
        return 'last_ingress';
    }
    return '';
}

function resolveNavButtonViewId(button) {
    if (!button) {
        return '';
    }
    const fromAttr = button.getAttribute('data-view');
    if (fromAttr !== null && String(fromAttr).trim() !== '') {
        return normalizeMainViewId(fromAttr);
    }
    return normalizeMainViewId(button.dataset.view);
}

let lastIngressViewRequestId = 0;

function viewConfig() {
    return {
        desk: {
            title: 'Biurko Case OS',
            subtitle: 'Jedna lista: to, co wymaga Ciebie teraz. Pełny rejestr jest w zakładce Sprawy Case OS.',
        },
        cockpit: {
            title: 'Cockpit V3',
            subtitle: 'Podgląd projekcji: sprawa, dowody, braki, sygnały (read-only).',
        },
        day: {
            title: 'Dzień operacyjny',
            subtitle: 'Szerszy horyzont dnia bez poczucia pracy na skrzynce.',
        },
        cases: {
            title: 'Sprawy',
            subtitle: 'Pełny rejestr: Do zrobienia (w tym zadania firmowe) i Informacyjne. Bieżącą pracę prowadź na Biurku.',
        },
        archive: {
            title: 'Archiwum',
            subtitle: 'Sprawy ukryte z listy aktywnej. Przywróć, gdy temat wraca do pracy.',
        },
        quality: {
            title: 'Jakość AI',
            subtitle: 'Prosty panel trafności, decyzji i problemów z feedbacku.',
        },
        last_ingress: {
            title: 'Ostatni ingress',
            subtitle: 'Podgląd jakości bounded Gmail ingress (read-only, bez biurka spraw).',
        },
        cohort_runs: {
            title: 'Uruchomienia kohorty',
            subtitle: 'Lista bounded cohort z Node B (read-only) — szczegóły w panelu bocznym.',
        },
        system: {
            title: 'System Case OS',
            subtitle: 'Oś zdarzeń cross-repo (Node B) — projekcja read-only. Kanał Oferta HVAC to równoległa ścieżka (kalk-top).',
        },
        chat: {
            title: 'Czat',
            subtitle: 'Rozmowa z agentem AI — wydawaj polecenia, pytaj o sprawy, zarzadzaj systemem.',
        },
        decisions: {
            title: 'Kolejka decyzji',
            subtitle: 'Decyzje oczekujace na operatora — zatwierdz, odrzuc lub przegladaj szczegoly.',
        },
        identity: {
            title: 'Tożsamość klientów',
            subtitle: 'Sugestie wiązania tożsamości (NIP, telefon, nazwa) — zatwierdź lub odrzuć scalenie.',
        },
        constitution: {
            title: 'Konstytucja',
            subtitle: 'Dokument konstytucji systemu Case OS — reguly, narzedzia i granice dzialania agenta.',
        },
    };
}

function setMoreMenuOpen(open) {
    const moreBtn = document.getElementById('view-tabs-more-btn');
    const moreMenu = document.getElementById('view-tabs-more-menu');
    if (!moreBtn || !moreMenu) {
        return;
    }
    moreMenu.hidden = !open;
    moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function installDaszekNavHandlers() {
    const app = document.getElementById('app');
    if (!app || app.dataset.navBound === '1') {
        return;
    }
    app.dataset.navBound = '1';
    app.addEventListener('click', event => {
        const moreItem = event.target.closest('.view-tab-more-item');
        if (moreItem && app.contains(moreItem)) {
            const next = resolveNavButtonViewId(moreItem);
            if (next) {
                navigateToView(next);
                const menu = document.getElementById('view-tabs-more-menu');
                if (menu) {
                    menu.hidden = true;
                }
            }
            return;
        }
        const button = event.target.closest('.nav-link, .view-tab');
        if (!button || !app.contains(button)) {
            // Check for other interactive elements
            const osEventItem = event.target.closest('.os-event-item');
            if (osEventItem && app.contains(osEventItem)) {
                var eventId = osEventItem.getAttribute('data-os-event-id');
                if (eventId) {
                    openOsEventDetail(eventId);
                }
                return;
            }
            const openCaseBtn = event.target.closest('[data-open-case]');
            if (openCaseBtn && app.contains(openCaseBtn)) {
                var caseId = openCaseBtn.getAttribute('data-open-case');
                if (caseId) {
                    openCaseDetail(caseId);
                }
                return;
            }
            const viewDecisionBtn = event.target.closest('[data-view-decision]');
            if (viewDecisionBtn && app.contains(viewDecisionBtn)) {
                var decisionId = viewDecisionBtn.getAttribute('data-view-decision');
                if (decisionId) {
                    openDecisionDetail(decisionId);
                }
                return;
            }
            const bindingApproveBtn = event.target.closest('[data-identity-binding-approve]');
            if (bindingApproveBtn && app.contains(bindingApproveBtn)) {
                decideIdentityBindingSuggestion(bindingApproveBtn.getAttribute('data-identity-binding-approve'), 'approved');
                return;
            }
            const bindingRejectBtn = event.target.closest('[data-identity-binding-reject]');
            if (bindingRejectBtn && app.contains(bindingRejectBtn)) {
                decideIdentityBindingSuggestion(bindingRejectBtn.getAttribute('data-identity-binding-reject'), 'rejected');
                return;
            }
            const bindingScanBtn = event.target.closest('[data-identity-binding-scan]');
            if (bindingScanBtn && app.contains(bindingScanBtn)) {
                void scanIdentityBindingSuggestions(bindingScanBtn);
                return;
            }
            return;
        }
        const next = resolveNavButtonViewId(button);
        if (!next) {
            console.warn('Daszek nav: brak lub nieznany atrybut data-view', button);
            return;
        }
        navigateToView(next);
    });
    const moreBtn = document.getElementById('view-tabs-more-btn');
    const moreMenu = document.getElementById('view-tabs-more-menu');
    if (moreBtn && moreMenu) {
        moreBtn.addEventListener('click', event => {
            event.stopPropagation();
            setMoreMenuOpen(moreMenu.hidden);
        });
        document.addEventListener('click', () => {
            setMoreMenuOpen(false);
        });
    }
}

function setViewHeader(title, subtitle) {
    const header = document.getElementById('view-header');
    if (!header) {
        return;
    }
    const freshness = operationalFeedHumanTimestampLine();
    header.innerHTML = `
        <div>
            <p class="eyebrow">Biurko operacyjne TOP-INSTAL</p>
            <h2>${escapeHtml(title)}</h2>
            <p>${escapeHtml(subtitle)}</p>
            ${freshness ? `<p class="ds-freshness detail-muted">${escapeHtml(freshness)}</p>` : ''}
        </div>
    `;
}

function syncViewTabsActive(viewKey) {
    document.querySelectorAll('.view-tab').forEach(button => {
        const id = resolveNavButtonViewId(button);
        button.classList.toggle('active', id === viewKey);
        button.setAttribute('aria-current', id === viewKey ? 'page' : 'false');
    });
    document.querySelectorAll('.view-tab-more-item').forEach(button => {
        const id = resolveNavButtonViewId(button);
        button.classList.toggle('active', id === viewKey);
    });
    const moreBtn = document.getElementById('view-tabs-more-btn');
    if (moreBtn) {
        moreBtn.classList.toggle('active', MORE_VIEW_TABS.includes(viewKey));
    }
}

function updateSidebarSummary() {
    const summary = document.getElementById('view-summary');
    let visible = 0;
    let nowCount = 0;
    let casesCount = 0;

    if (hasOperationalFeedSnapshot()) {
        const feed = getOperationalFeed();
        visible = (feed.desk || []).length;
        const sections = ((feed.day || {}).sections || []);
        nowCount = sections.find(section => section.key === 'teraz')?.items?.length || 0;
        if (!nowCount && (!sections.length || !sections.some(s => (s.items || []).length))) {
            nowCount = Math.min(3, (feed.cases || []).length);
        }
    } else {
        visible = (state.data.desk.items || []).length;
        nowCount = (state.data.day.sections || []).find(section => section.key === 'teraz')?.items.length || 0;
    }
    const mc = state.data.mailboxCases || {};
    if (mc.ok && Array.isArray(mc.cases)) {
        casesCount = mc.cases.length;
    } else if (hasOperationalFeedSnapshot()) {
        casesCount = (getOperationalFeed().cases || []).length;
    } else {
        casesCount = (state.data.cases.items || []).length;
    }

    summary.innerHTML = `
        <h2>Stan biurka</h2>
        <div class="summary-grid">
            <div><span>Na biurku</span><strong>${visible}</strong></div>
            <div><span>Teraz</span><strong>${nowCount}</strong></div>
            <div><span>Sprawy</span><strong>${casesCount}</strong></div>
        </div>
        <details class="sidebar-help-details detail-tech">
            <summary>Pomoc dla operatora</summary>
            <p class="detail-muted">Biurko pokazuje, na co zwrócić uwagę. Przycisk «Zła sprawa» poprawia błędne powiązanie maila ze sprawą. Szczegóły techniczne są pod «+» na dole ekranu. Pełny przewodnik: repozytorium <code>docs/dev/DASZEK_OPERATOR_ONBOARDING_PL.md</code>.</p>
        </details>
        ${hasOperationalFeedSnapshot() ? '' : '<p class="detail-muted sidebar-feed-hint">Brak zasilenia z serwera — podsumowanie z magazynu lokalnego.</p>'}
    `;
}

function renderCurrentView() {
    clearError();
    updateSidebarSummary();
    const configs = viewConfig();
    let viewKey = normalizeMainViewId(state.currentView);
    if (!viewKey || !configs[viewKey]) {
        viewKey = 'desk';
        state.currentView = 'desk';
    }
    const config = configs[viewKey];
    setViewHeader(config.title, config.subtitle);

    syncViewTabsActive(viewKey);

    if (viewKey === 'desk') {
        renderDeskView();
    } else if (viewKey === 'cockpit') {
        renderCockpitView();
    } else if (viewKey === 'day') {
        renderDayView();
    } else if (viewKey === 'cases') {
        renderCasesView();
    } else if (viewKey === 'archive') {
        renderArchiveView();
    } else if (viewKey === 'quality') {
        renderQualityView();
    } else if (viewKey === 'last_ingress') {
        void startLastIngressViewLoad();
    } else if (viewKey === 'system') {
        void startSystemViewLoad();
    } else if (viewKey === 'cohort_runs') {
        renderCohortRunsView();
    } else if (viewKey === 'chat') {
        void startChatViewLoad();
    } else if (viewKey === 'decisions') {
        void startDecisionQueueViewLoad();
    } else if (viewKey === 'identity') {
        void startIdentityMergeViewLoad();
    } else if (viewKey === 'constitution') {
        void startConstitutionViewLoad();
    } else {
        renderDeskView();
    }
}

function renderFeedAttentionSummary(feed) {
    const f = feed && typeof feed === 'object' ? feed : {};
    const cases = f.cases || [];
    let conflicts = 0;
    let gaps = 0;
    let proposals = 0;
    let svc = 0;
    let mkt = 0;
    cases.forEach(c => {
        conflicts += conflictCountFor(c);
        gaps += gapCountFor(c);
        proposals += countArray(c.action_proposals) + countArray(c.proposed_next_actions);
        svc += countArray(c.service_signals);
        mkt += countArray(c.marketing_signals);
    });
    const desk = f.desk || [];
    const waitingDesk = desk.filter(d => String(d.operational_status || '').toLowerCase() === 'waiting'
        || countArray(d.blockers) > 0
        || d.maintenance_guard?.blocked).length;
    const attentionIssues = conflicts + gaps;
    const l1 = `
        <div class="ds-metric-strip" role="group" aria-label="Najważniejsze metryki">
            <div class="ds-metric-card"><span>Kartki na biurku</span><strong>${escapeHtml(String(desk.length))}</strong></div>
            <div class="ds-metric-card"><span>Sprawy w feedzie</span><strong>${escapeHtml(String(cases.length))}</strong></div>
            <div class="ds-metric-card"><span>Uwaga: sprzeczności i braki</span><strong>${escapeHtml(String(attentionIssues))}</strong></div>
            <div class="ds-metric-card"><span>Oczekujące / blokady</span><strong>${escapeHtml(String(waitingDesk))}</strong></div>
        </div>`;

    return `
        <section class="section-block feed-attention-summary">
            <div class="section-header">
                <h3>Na czym mam się skupić teraz</h3>
            </div>
            ${projectionBoundaryHtml()}
            ${l1}
            <details class="ds-metric-more">
                <summary>Więcej metryk ze snapshotu</summary>
                <div class="ds-metric-grid-inner" role="group" aria-label="Rozszerzone metryki">
                    <div><span>Sprzeczności (łącznie)</span><strong>${escapeHtml(String(conflicts))}</strong></div>
                    <div><span>Braki danych</span><strong>${escapeHtml(String(gaps))}</strong></div>
                    <div><span>Propozycje działań</span><strong>${escapeHtml(String(proposals))}</strong></div>
                    <div><span>Sygnały serwisowe</span><strong>${escapeHtml(String(svc))}</strong></div>
                    <div><span>Sygnały marketingowe</span><strong>${escapeHtml(String(mkt))}</strong></div>
                </div>
            </details>
        </section>
    `;
}

function getFeedActionItems(feed) {
    const f = feed || {};
    if (Array.isArray(f.action_items) && f.action_items.length) {
        return f.action_items;
    }
    return Array.isArray(f.tasks) ? f.tasks : [];
}

function buildFeedDaySections(feed) {
    const dayObj = feed.day || {};
    const raw = Array.isArray(dayObj.sections) ? dayObj.sections : [];
    const hasAnyItems = raw.some(sec => (sec.items || []).length > 0);
    if (hasAnyItems) {
        return { sections: raw, usedFallback: false };
    }
    const sections = [];
    const caseItems = (feed.cases || []).filter(item => !isGatebTestArtifact(item)).filter(item => matchesSearch([
        item.title,
        item.summary,
        item.operator_brief_pl,
        item.case_id,
    ])).slice(0, 10);
    const taskItems = getFeedActionItems(feed).filter(item => matchesSearch([
        item.title,
        item.summary,
        item.linked_case_id,
        item.source_type,
    ])).slice(0, 12);
    if (caseItems.length) {
        sections.push({
            key: 'feed_cases',
            title: 'Najbliższe sprawy',
            subtitle: 'Z operational feed',
            items: caseItems,
            renderKind: 'case',
        });
    }
    if (taskItems.length) {
        sections.push({
            key: 'feed_tasks',
            title: 'Sugerowane działania',
            subtitle: 'Propozycje agenta do zatwierdzenia — nie są to zadania wewnętrzne',
            items: taskItems,
            renderKind: 'task',
        });
    }
    return { sections, usedFallback: true };
}

function renderFeedDaySectionRow(section) {
    const kind = section.renderKind || 'note';
    return (section.items || []).map(item => {
        if (kind === 'case') {
            return renderOperationalCaseRecord(item);
        }
        if (kind === 'task') {
            return renderFeedTaskRow(item, { compact: true });
        }
        return renderOperationalNoteRecord(item, { showDone: false, compact: true });
    }).join('');
}

function renderFeedTaskRow(task, { compact = false } = {}) {
    const t = task || {};
    const title = firstNonEmpty(t.title, 'Zadanie');
    const summary = limitText(firstNonEmpty(t.summary, t.note), compact ? 88 : 130);
    const caseId = firstNonEmpty(t.linked_case_id, t.case_id);
    const src = humanizeCode(t.source_type || 'źródło', 'źródło');
    const risk = t.risk_level ? polishRiskLevel(t.risk_level) : '';
    const approval = t.requires_approval ? '<span class="record-badge record-badge-risk">Wymaga akceptacji</span>' : '';
    const evidenceN = countArray(t.evidence_refs);
    const readOnlyFeed = t.feed_read_only !== false;
    const actions = [];
    if (caseId) {
        actions.push(`<button type="button" class="btn btn-ghost btn-small" data-open-case="${escapeHtml(caseId)}">Otwórz sprawę</button>`);
    }
    if (!readOnlyFeed && t.task_id) {
        actions.push(`<button type="button" class="btn btn-secondary btn-small" data-task-done="${escapeHtml(t.task_id)}">Zrobione</button>`);
        actions.push(`<button type="button" class="btn btn-ghost btn-small" data-task-due="${escapeHtml(t.task_id)}">Termin</button>`);
    } else if (readOnlyFeed) {
        actions.push('<span class="detail-muted">Zadanie z migawki — bez poleceń wykonania z UI.</span>');
    }
    return `
        <article class="operational-record operational-record-task">
            <div class="record-main">
                <div class="record-top">
                    <span class="record-type">${escapeHtml(src)}</span>
                    <span class="record-status">${escapeHtml(humanizeCode(t.status, 'status'))}</span>
                </div>
                <h3>${escapeHtml(title)}</h3>
                ${summary ? `<p class="record-summary">${escapeHtml(summary)}</p>` : ''}
                <div class="record-badges">${approval}${risk ? `<span class="record-badge">${escapeHtml(risk)}</span>` : ''}${evidenceN ? `<span class="record-badge">Dowody: ${escapeHtml(String(evidenceN))}</span>` : ''}</div>
            </div>
            <div class="record-actions">${actions.join('')}</div>
        </article>
    `;
}

function renderDeskView() {
    const root = document.getElementById('view-root');
    const op = state.data.operationalFeed || {};

    if (op.loadError) {
        root.innerHTML = wrapOperationalViewShell('Biurko', `
            <section class="empty-state ds-state ds-state--error" role="alert">
                <h3>Nie udało się pobrać operational feed</h3>
                <p>${escapeHtml(op.loadError)}</p>
                <p class="detail-muted">Sprawdź sesję operatora lub endpoint <code>/wp-json/daszek/v3/operational-feed-snapshots/latest</code>. Błąd 401 przy mostku oznacza inny problem niż brak sesji operatora.</p>
            </section>
        `);
        return;
    }

    if (!hasOperationalFeedSnapshot()) {
        root.innerHTML = wrapOperationalViewShell('Biurko', `
            <section class="empty-state ds-state">
                <h3>Brak zasilenia biurka z Node B</h3>
                <p>Operational feed nie został jeszcze zapisany w Daszek V3. Uruchom eksporter <code>daszek_v3_operational_feed.py</code> i wyślij snapshot metodą POST (bridge token lub sesja + CSRF).</p>
                ${projectionBoundaryHtml()}
            </section>
        `);
        return;
    }

    const feed = getOperationalFeed();
    const items = (feed.desk || []).filter(item => !isGatebTestArtifact(item)).filter(item => matchesSearch([
        item.title,
        item.summary,
        item.why_on_desk,
        item.case_title,
        item.operator_brief_pl,
        item.operator_essence_pl,
        item.sender_name,
        item.customer_email,
    ]));
    const actionItems = getFeedActionItems(feed).filter(item => !isGatebTestArtifact(item)).filter(item => matchesSearch([
        item.title,
        item.summary,
        item.linked_case_id,
        item.source_type,
    ])).slice(0, 8);

    const actionSectionHtml = actionItems.length ? `
        <section class="section-block registry-section registry-section--action">
            <div class="registry-section-header">
                <h4>Sugerowane działania</h4>
                <span class="registry-count">${escapeHtml(String(actionItems.length))}</span>
            </div>
            <p class="detail-muted">Propozycje agenta do zatwierdzenia — nie są to zadania wewnętrzne.</p>
            <div class="operational-list operational-list--registry">
                ${actionItems.map(item => renderFeedTaskRow(item, { compact: true })).join('')}
            </div>
        </section>
    ` : '';

    if (!items.length && !actionItems.length) {
        root.innerHTML = wrapOperationalViewShell('Biurko', `
            ${renderFeedAttentionSummary(feed)}
            <section class="empty-state ds-state">
                <h3>Biurko jest spokojne</h3>
                <p>W aktualnym snapshotcie operational feed nie ma kartek na biurku.</p>
            </section>
        `);
        return;
    }

    const deskBoardHtml = items.length
        ? `<div class="ops-board">
            ${groupDeskItems(items).map(section => renderOperationalSection(section, { limit: section.key === 'now' ? 5 : 8, showDone: false })).join('')}
        </div>`
        : '';

    root.innerHTML = wrapOperationalViewShell('Biurko', `
        ${renderFeedAttentionSummary(feed)}
        ${deskBoardHtml}
        ${actionSectionHtml}
    `);
}

function cockpitProjectionFootnote(caseCount, cohortCount, substrate) {
    const sc = substrate || {};
    const cc = Number(sc.case_count || 0);
    const conflicts = Number(sc.conflict_count || 0);
    const gaps = Number(sc.gap_count || 0);
    if (!cc && !caseCount && !cohortCount) {
        return '<p class="detail-muted">System nie ma jeszcze wystarczających danych do rekomendacji w tym widoku.</p>';
    }
    const parts = [];
    if (!conflicts) {
        parts.push('Brak wykrytych sprzeczności w zliczonym zakresie.');
    }
    if (!gaps) {
        parts.push('Brak widocznych braków danych.');
    }
    if (!parts.length) {
        return '';
    }
    return `<p class="detail-muted">${escapeHtml(parts.join(' '))}</p>`;
}

function renderCockpitView() {
    const cockpit = state.data.cockpit || {};
    if (cockpit.loadError) {
        const root = document.getElementById('view-root');
        root.innerHTML = wrapDaszekViewShell(['Cockpit V3'], `
            <section class="empty-state ds-state ds-state--error" role="alert">
                <h3>Błąd wczytywania Cockpit</h3>
                <p class="error-inline">${escapeHtml(cockpit.loadError)}</p>
                <button type="button" class="btn btn-primary btn-small" id="cockpit-retry-btn">Spróbuj ponownie</button>
            </section>
        `);
        const retryBtn = document.getElementById('cockpit-retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => { void loadAllData(); });
        }
        return;
    }
    const substrate = cockpit.substrate || {};
    const cohortRuns = cockpit.cohort_runs || [];
    const cases = ((cockpit.cases || {}).items || state.data.cases.items || []).filter(item => matchesSearch([
        item.title,
        item.summary,
        item.case_key,
        item.operator_brief_pl,
    ])).slice(0, 12);
    const root = document.getElementById('view-root');
    const foot = cockpitProjectionFootnote(cases.length, cohortRuns.length, substrate);
    root.innerHTML = wrapDaszekViewShell(['Cockpit V3'], `
        <section class="section-block">
            <div class="section-header">
                <h3>Co wiemy</h3>
                <span>${escapeHtml(String(substrate.case_count || 0))}</span>
            </div>
            <p class="detail-muted">Zbiorczy podgląd z projekcji Node B (read-only).</p>
            <div class="summary-grid summary-grid-wide">
                <div><span>Sprawy</span><strong>${escapeHtml(String(substrate.case_count || 0))}</strong></div>
                <div><span>Dowody</span><strong>${escapeHtml(String(substrate.evidence_card_count || 0))}</strong></div>
                <div><span>Sprzeczności</span><strong>${escapeHtml(String(substrate.conflict_count || 0))}</strong></div>
                <div><span>Braki danych</span><strong>${escapeHtml(String(substrate.gap_count || 0))}</strong></div>
                <div><span>Sygnały serwisowe</span><strong>${escapeHtml(String(substrate.service_signal_count || 0))}</strong></div>
                <div><span>Sygnały marketingowe</span><strong>${escapeHtml(String(substrate.marketing_signal_count || 0))}</strong></div>
            </div>
            ${foot}
        </section>
        <section class="section-block">
            <div class="section-header">
                <h3>Ostatni przebieg kohorty</h3>
                <span>${escapeHtml(String(cohortRuns.length))}</span>
            </div>
            ${cohortRuns.length ? `
                <div class="case-grid">
                    ${cohortRuns.map(renderCohortRunCard).join('')}
                </div>
            ` : `
                <section class="empty-state ds-state">
                    <h3>Brak zapisanych przebiegów kohorty</h3>
                    <p>Ta sekcja jest niedostępna dopóki Node B nie zapisze projekcji bounded cohort (read-only).</p>
                </section>
            `}
        </section>
        <section class="section-block">
            <div class="section-header">
                <h3>Sprawy z najbogatszym kontekstem</h3>
                <span>${escapeHtml(String(cases.length))}</span>
            </div>
            ${cases.length ? `<section class="case-grid">${cases.map(renderCockpitCaseCard).join('')}</section>` : `
                <section class="empty-state ds-state">
                    <h3>Brak spraw do pokazania</h3>
                    <p>Brak danych jeszcze w tej projekcji albo filtr wyszukiwania ukrywa wyniki.</p>
                </section>
            `}
        </section>
    `);
}

function renderCohortRunCard(run) {
    const counts = run.counts || {};
    const rid = escapeHtml(String(run.run_id || '').trim());
    return `
        <article class="case-card cohort-run-card">
            <div class="case-meta">
                <span>${escapeHtml(run.schema_version || 'cohort_proof_run.v1')}</span>
                <span>${escapeHtml(formatDate(run.generated_at || run.projected_at))}</span>
            </div>
            <h3>${escapeHtml(run.run_id || 'cohort run')}</h3>
            <dl class="case-stats">
                <div><dt>Gmail</dt><dd>${escapeHtml(String(counts.gmail_selected || 0))}</dd></div>
                <div><dt>Drive</dt><dd>${escapeHtml(String(counts.drive_documents_selected || 0))}</dd></div>
                <div><dt>Wspólne (Gmail + Dysk)</dt><dd>${escapeHtml(String(counts.shared_gmail_drive_case_count || 0))}</dd></div>
            </dl>
            ${rid ? `<p class="cohort-run-actions"><button type="button" class="btn btn-secondary btn-small" data-open-cohort-run="${rid}">Szczegóły</button></p>` : ''}
        </article>
    `;
}

function renderCohortRunsView() {
    const root = document.getElementById('view-root');
    const cl = state.data.cohortList || { ok: false, items: [], loadError: null };
    if (cl.loadError) {
        root.innerHTML = wrapDaszekViewShell(['Uruchomienia kohorty'], `
            <section class="section-block">
                <div class="section-header">
                    <h3>Uruchomienia kohorty</h3>
                </div>
                <section class="empty-state ds-state ds-state--error" role="alert">
                    <h3>Błąd wczytywania listy</h3>
                    <p class="error-inline">${escapeHtml(cl.loadError)}</p>
                    <p class="detail-muted">Sprawdź sesję operatora lub uprawnienia do endpointu <code>/wp-json/daszek/v3/cohort-runs</code>.</p>
                </section>
            </section>
        `);
        return;
    }
    const items = (cl.items || []).filter(item => matchesSearch([
        item.run_id,
        item.schema_version,
        String((item.counts || {}).gmail_selected || ''),
    ]));
    if (!items.length) {
        root.innerHTML = wrapDaszekViewShell(['Uruchomienia kohorty'], `
            <section class="section-block">
                <div class="section-header">
                    <h3>Uruchomienia kohorty</h3>
                </div>
                <section class="empty-state ds-state">
                    <h3>Brak zapisanych przebiegów</h3>
                    <p>Node B nie zapisał jeszcze bounded cohort w magazynie v2/v3 — widok jest pusty (read-only).</p>
                </section>
            </section>
        `);
        return;
    }
    root.innerHTML = wrapDaszekViewShell(['Uruchomienia kohorty'], `
        <section class="section-block">
            <div class="section-header">
                <h3>Lista przebiegów</h3>
                <span>${escapeHtml(String(items.length))}</span>
            </div>
            <p class="detail-muted">Wybierz przebieg, aby zobaczyć payload w panelu szczegółów (bez wykonywania akcji).</p>
            <div class="case-grid">
                ${items.map(renderCohortRunCard).join('')}
            </div>
        </section>
    `);
}

async function openCohortRunDetail(runId) {
    const rid = String(runId || '').trim();
    if (!rid) {
        return;
    }
    state.detail = {
        type: 'cohort_run',
        payload: { run_id: rid, run: null, loading: true, error: '' },
    };
    setDetailPanelChromeOpen(true);
    renderDetailPanel();
    try {
        const data = await apiFetch(V3_API_BASE, `/cohort-runs/${encodeURIComponent(rid)}`);
        if (data && typeof data === 'object' && data.ok && data.cohort_run) {
            state.detail = {
                type: 'cohort_run',
                payload: { run_id: rid, run: data.cohort_run, loading: false, error: '' },
            };
        } else {
            state.detail = {
                type: 'cohort_run',
                payload: { run_id: rid, run: null, loading: false, error: 'Brak danych przebiegu w odpowiedzi API.' },
            };
        }
    } catch (err) {
        state.detail = {
            type: 'cohort_run',
            payload: { run_id: rid, run: null, loading: false, error: String(err.message || err) },
        };
    }
    renderDetailPanel();
}

function renderCockpitCaseCard(item) {
    const evidenceCount = (item.evidence_cards || []).length;
    const conflictCount = (item.operator_visible_conflicts || item.conflicting_facts || []).length;
    const gapCount = (item.completeness_gaps || []).length;
    const signalCount = (item.service_signals || []).length + (item.marketing_signals || []).length;
    const title = item.title || item.case_key || 'Sprawa operacyjna';
    const openCaseLabel = `Otwórz sprawę: ${limitText(title, 60)}`;
    const opPill = item.operational_status ? `<span class="status-pill ${operationalStatusPillClass(item.operational_status)}">${escapeHtml(String(item.operational_status))}</span>` : '';
    return `
        <article class="case-card" data-open-case="${escapeHtml(item.case_id)}" aria-label="${escapeHtml(openCaseLabel)}">
            <div class="case-meta">
                <span>${escapeHtml(item.family_label || caseFamilyLabel(item.family))}</span>
                <span>${escapeHtml(item.status_label || caseStatusLabel(item.status))}${opPill}</span>
            </div>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(item.summary || item.operator_brief_pl || 'Brak skrótu sprawy.')}</p>
            <dl class="case-stats">
                <div><dt>Dowody</dt><dd>${escapeHtml(String(evidenceCount))}</dd></div>
                <div><dt>Sprzeczności</dt><dd>${escapeHtml(String(conflictCount))}</dd></div>
                <div><dt>Braki</dt><dd>${escapeHtml(String(gapCount))}</dd></div>
                <div><dt>Sygnały</dt><dd>${escapeHtml(String(signalCount))}</dd></div>
            </dl>
        </article>
    `;
}

function renderDayView() {
    const root = document.getElementById('view-root');
    const op = state.data.operationalFeed || {};

    if (op.loadError) {
        root.innerHTML = wrapOperationalViewShell('Dzień operacyjny', `
            <section class="empty-state ds-state ds-state--error" role="alert">
                <h3>Nie udało się pobrać operational feed</h3>
                <p>${escapeHtml(op.loadError)}</p>
            </section>
        `);
        return;
    }

    if (!hasOperationalFeedSnapshot()) {
        root.innerHTML = wrapOperationalViewShell('Dzień operacyjny', `
            <section class="empty-state ds-state">
                <h3>Brak zasilenia dnia operacyjnego z Node B</h3>
                <p>Operational feed nie jest dostępny. Dzień operacyjny wymaga migawki z Node B.</p>
            </section>
        `);
        return;
    }

    const feed = getOperationalFeed();
    const { sections: rawSections, usedFallback } = buildFeedDaySections(feed);
    const sections = rawSections.map(section => ({
        ...section,
        items: (section.items || []).filter(item => {
            if (section.renderKind === 'case') {
                return matchesSearch([item.title, item.summary, item.operator_brief_pl, item.case_id]);
            }
            if (section.renderKind === 'task') {
                return matchesSearch([item.title, item.summary, item.linked_case_id, item.source_type]);
            }
            return matchesSearch([item.title, item.summary, item.why_on_desk, item.case_title]);
        }),
    }));
    const nonEmptySections = sections.filter(section => section.items.length);

    if (!nonEmptySections.length) {
        root.innerHTML = wrapOperationalViewShell('Dzień operacyjny', `
            <section class="empty-state ds-state">
                <h3>Brak wpisów na dziś</h3>
                <p>Snapshot operacyjny nie zawiera jeszcze planu dnia i nie ma spraw ani sugerowanych działań do pokazania.</p>
                ${projectionBoundaryHtml()}
            </section>
        `);
        return;
    }

    const banner = usedFallback
        ? '<p class="detail-muted feed-day-fallback">Snapshot nie zawiera jeszcze planu dnia. Pokazuję najbliższe sprawy i sugerowane działania.</p>'
        : '';

    root.innerHTML = wrapOperationalViewShell('Dzień operacyjny', `
        ${projectionBoundaryHtml()}
        ${banner}
        ${nonEmptySections.map(section => `
        <section class="section-block">
            <div class="section-header">
                <h3>${escapeHtml(section.title)}</h3>
                <span>${section.items.length}</span>
            </div>
            ${section.subtitle ? `<p class="detail-muted">${escapeHtml(section.subtitle)}</p>` : ''}
            <div class="operational-list operational-list-compact">
                ${renderFeedDaySectionRow(section)}
            </div>
        </section>
    `).join('')}
    `);
}

function caseRowRequiresAction(row) {
    if (!row || typeof row !== 'object') {
        return true;
    }
    if (row.requires_action !== undefined) {
        return Boolean(row.requires_action);
    }
    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    if (meta.requires_action !== undefined) {
        return Boolean(meta.requires_action);
    }
    return true;
}

function enrichRegistryCaseRow(row) {
    const cid = String(row.case_id || '').trim();
    if (!cid || isCaseArchived(cid) || isGatebTestArtifact(row)) {
        return null;
    }
    const feedRecord = findCaseRecordById(cid);
    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const base = feedRecord ? { ...feedRecord } : {
        case_id: cid,
        title: firstNonEmpty(row.subject, meta.task_title, cid),
        family: row.case_family || '',
        family_label: caseFamilyLabel(row.case_family),
        summary: meta.priority_label || '',
        latest_signal_at: row.latest_signal_at || row.updated_at || row.created_at || '',
    };
    base.requires_action = caseRowRequiresAction(row);
    return base;
}

function firmTasksFromState() {
    const payload = state.data.tasks || {};
    let tasks = [];
    if (Array.isArray(payload.tasks)) {
        tasks = payload.tasks;
    } else if (Array.isArray(payload)) {
        tasks = payload;
    }
    if (tasks.length) {
        return tasks;
    }
    const mailboxCases = state.data.mailboxCases && Array.isArray(state.data.mailboxCases.cases)
        ? state.data.mailboxCases.cases
        : [];
    return mailboxCases
        .filter((row) => {
            const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
            const sk = String(meta.source_kind || row.source_kind || '').trim();
            const family = String(row.case_family || '').trim();
            const isManual = sk === 'manual' && family === 'operations';
            const requires = row.requires_action !== false && meta.requires_action !== false;
            return isManual && requires;
        })
        .map((row) => {
            const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
            return {
                case_id: row.case_id,
                case_family: row.case_family || 'operations',
                task_title: meta.task_title || row.subject || '',
                source_kind: meta.source_kind || 'manual',
                task_status: meta.task_status || 'confirmed',
                priority: meta.priority || 'normalny',
                scheduled_at: meta.scheduled_at || '',
                source_email_id: meta.source_email_id || '',
                task_confidence: meta.task_confidence || '',
                reasoning_pl: meta.reasoning_pl || '',
                created_at: row.created_at || '',
                updated_at: row.updated_at || '',
            };
        });
}

function buildFirmTasksPanelHtml(tasks) {
    const confident = tasks.filter(t => t.source_kind === 'agent_confident' && t.task_status === 'pending');
    const active = tasks.filter(t => t.task_status === 'confirmed');
    const uncertain = tasks.filter(t => t.source_kind === 'agent_uncertain' && t.task_status === 'pending');

    let html = '<section class="registry-firm-tasks section-block">';
    html += '<div class="section-header"><div><h4>Zadania firmowe</h4>';
    html += '<p class="detail-muted">Sprawy wewnętrzne (ZUS, auto, faktury). Leady HVAC są w sekcji spraw klientów poniżej.</p></div>';
    html += '<button id="task-new-btn" type="button" class="btn btn-primary btn-small">+ Nowe zadanie</button></div>';

    html += '<div id="task-new-form" class="task-new-form" style="display:none;">';
    html += '<label><span>Tytuł</span><input type="text" id="task-title" placeholder="Np. Firmowe auto — naprawić hamulec"></label>';
    html += '<div class="task-new-form-row"><label><span>Priorytet</span><select id="task-priority"><option value="normalny" selected>normalny</option><option value="pilne">pilne</option><option value="niski">niski</option></select></label>';
    html += '<label><span>Data/godzina (opcjonalnie)</span><input type="text" id="task-scheduled" placeholder="np. 2026-07-05 11:00"></label></div>';
    html += '<div class="task-new-form-actions"><button id="task-create-btn" type="button" class="btn btn-primary">Dodaj</button><button id="task-cancel-btn" type="button" class="btn btn-ghost">Anuluj</button></div>';
    html += '</div>';

    html += '<div class="registry-task-group"><h5>Do potwierdzenia (od agenta)</h5>';
    if (confident.length) {
        confident.forEach(t => { html += taskCardHtml(t, 'pending'); });
    } else {
        html += '<p class="detail-muted">Brak zadań do potwierdzenia.</p>';
    }
    html += '</div>';

    html += '<div class="registry-task-group"><h5>Aktywne zadania</h5>';
    if (active.length) {
        active.sort((a, b) => (a.priority === 'pilne' ? -1 : 0) - (b.priority === 'pilne' ? -1 : 0)).forEach(t => { html += taskCardHtml(t, 'active'); });
    } else {
        html += '<p class="detail-muted">Brak aktywnych zadań firmowych.</p>';
    }
    html += '</div>';

    html += '<div class="registry-task-group"><h5>Sugestie agenta (niepewne)</h5>';
    if (uncertain.length) {
        uncertain.forEach(t => { html += taskCardHtml(t, 'uncertain'); });
    } else {
        html += '<p class="detail-muted">Brak sugestii.</p>';
    }
    html += '</div>';

    html += '<details class="registry-task-archive"><summary>Pokaż archiwum zadań</summary><div id="task-archive"><button id="task-archive-load" type="button" class="btn btn-ghost btn-small">Załaduj archiwum</button></div></details>';
    html += '</section>';
    return html;
}

function bindFirmTasksPanel(root) {
    const newBtn = root.querySelector('#task-new-btn');
    const cancelBtn = root.querySelector('#task-cancel-btn');
    const createBtn = root.querySelector('#task-create-btn');
    const archiveBtn = root.querySelector('#task-archive-load');
    const taskForm = root.querySelector('#task-new-form');
    if (newBtn && taskForm) {
        newBtn.addEventListener('click', () => { taskForm.style.display = 'block'; });
    }
    if (cancelBtn && taskForm) {
        cancelBtn.addEventListener('click', () => { taskForm.style.display = 'none'; });
    }
    if (createBtn) {
        createBtn.addEventListener('click', () => { void createManualTask(); });
    }
    if (archiveBtn) {
        archiveBtn.addEventListener('click', loadArchive);
    }
}

async function refreshRegistryViewAfterTaskMutation() {
    await loadAllData();
    if (normalizeMainViewId(state.currentView) === 'cases') {
        renderCasesView();
    }
}

function renderCasesView() {
    const root = document.getElementById('view-root');
    const mc = state.data.mailboxCases || {};

    if (mc.loadError) {
        root.innerHTML = wrapOperationalViewShell('Sprawy', `
            <section class="empty-state ds-state ds-state--error" role="alert">
                <h3>Nie udało się pobrać rejestru spraw</h3>
                <p>${escapeHtml(mc.loadError)}</p>
                <p class="detail-muted">Endpoint <code>/daszek/v2/mailbox-cases</code> proxy do Node B <code>GET /cases</code>.</p>
            </section>
        `);
        return;
    }

    const rawCases = Array.isArray(mc.cases) ? mc.cases : [];
    const enriched = [];
    rawCases.forEach(row => {
        const item = enrichRegistryCaseRow(row);
        if (!item) {
            return;
        }
        if (!matchesSearch([
            item.operator_essence_pl,
            item.title,
            item.summary,
            item.operator_brief_pl,
            item.primary_next_action_title_pl,
            item.family_label || item.family,
            item.current_state_label || item.current_state,
            item.case_id,
            item.sender_name,
            item.customer_email,
            item.customer_name,
        ])) {
            return;
        }
        enriched.push(item);
    });

    const actionItems = sortCasesChronologically(enriched.filter(item => item.requires_action !== false));
    const infoItems = sortCasesChronologically(enriched.filter(item => item.requires_action === false));
    const firmTasksHtml = buildFirmTasksPanelHtml(firmTasksFromState());
    const searchActive = Boolean(String(state.search || '').trim());
    const totalCount = actionItems.length + infoItems.length;

    if (!totalCount && !firmTasksFromState().length) {
        root.innerHTML = wrapOperationalViewShell('Sprawy', `
            <section class="empty-state ds-state">
                <h3>Brak spraw w rejestrze</h3>
                <p>Magazyn Node B nie zawiera aktywnych spraw klientów pasujących do wyszukiwania.</p>
                ${firmTasksHtml}
            </section>
            ${projectionBoundaryHtml()}
        `);
        bindFirmTasksPanel(root);
        return;
    }

    root.innerHTML = wrapOperationalViewShell('Sprawy', `
        <section class="registry-header">
            <div class="registry-header-row">
                <h3>Rejestr spraw</h3>
                <span class="registry-count">${escapeHtml(String(totalCount))}</span>
            </div>
            <p class="detail-muted">${searchActive
            ? 'Wyniki wyszukiwania w rejestrze spraw (Node B).'
            : 'Pełny rejestr z magazynu Node B — nie tylko podzbiór z Biurka. Bieżącą pracę prowadź na Biurku.'}</p>
        </section>
        <section class="registry-section registry-section--action">
            <div class="registry-section-header">
                <h4>Do zrobienia</h4>
                <span class="registry-count">${escapeHtml(String(actionItems.length))}</span>
            </div>
            ${firmTasksHtml}
            ${actionItems.length
            ? `<div class="operational-list operational-list--registry">${actionItems.map(item => renderOperationalCaseRecord(item)).join('')}</div>`
            : '<p class="detail-muted">Brak spraw klientów wymagających działania (zadania firmowe powyżej).</p>'}
        </section>
        <section class="registry-section registry-section--info">
            <div class="registry-section-header">
                <h4>Informacyjne</h4>
                <span class="registry-count">${escapeHtml(String(infoItems.length))}</span>
            </div>
            ${infoItems.length
            ? `<div class="operational-list operational-list--registry">${infoItems.map(item => renderOperationalCaseRecord(item, { previewOnly: true })).join('')}</div>`
            : '<p class="detail-muted">Brak spraw informacyjnych.</p>'}
        </section>
        ${projectionBoundaryHtml()}
    `);
    bindFirmTasksPanel(root);
}

function renderArchiveView() {
    const root = document.getElementById('view-root');
    const arch = state.data.caseArchive || {};

    if (arch.loadError) {
        root.innerHTML = wrapOperationalViewShell('Archiwum', `
            <section class="empty-state ds-state ds-state--error" role="alert">
                <h3>Nie udało się wczytać archiwum</h3>
                <p>${escapeHtml(arch.loadError)}</p>
            </section>
        `);
        return;
    }

    const archivedRows = Array.isArray(arch.items) ? arch.items : [];
    const items = sortCasesChronologically(archivedRows.map(entry => {
        const cid = String(entry.case_id || '').trim();
        const live = findCaseRecordById(cid);
        if (live) {
            return { ...live, archived_at: entry.archived_at, archived_by: entry.archived_by };
        }
        return {
            case_id: cid,
            title: firstNonEmpty(entry.title, cid),
            summary: entry.summary || '',
            latest_signal_at: entry.latest_signal_at || entry.archived_at || '',
            archived_at: entry.archived_at,
            archived_by: entry.archived_by,
        };
    }).filter(item => matchesSearch([
        item.title,
        item.summary,
        item.operator_brief_pl,
        item.case_id,
        item.archived_by,
    ])));

    if (!items.length) {
        root.innerHTML = wrapOperationalViewShell('Archiwum', `
            <section class="empty-state ds-state">
                <h3>Archiwum jest puste</h3>
                <p>Zarchiwizowane sprawy pojawią się tutaj. Aktywne listy nie pokazują ich dalej.</p>
            </section>
        `);
        return;
    }

    root.innerHTML = wrapOperationalViewShell('Archiwum', `
        <p class="detail-muted cases-sort-hint">Sortowanie: od najnowszej daty archiwizacji / aktywności.</p>
        <section class="operational-list">
            ${items.map(item => renderOperationalCaseRecord(item, { archived: true })).join('')}
        </section>
    `);
}

function renderQualityView() {
    const root = document.getElementById('view-root');
    const quality = state.data.quality || {};
    if (quality.loadError) {
        root.innerHTML = wrapDaszekViewShell(['Jakość AI'], `
            <section class="empty-state ds-state ds-state--error" role="alert">
                <h3>Błąd wczytywania jakości AI</h3>
                <p class="error-inline">${escapeHtml(quality.loadError)}</p>
                <button type="button" class="btn btn-primary btn-small" id="quality-retry-btn">Spróbuj ponownie</button>
            </section>
        `);
        const retryBtn = document.getElementById('quality-retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => { void loadAllData(); });
        }
        return;
    }
    const summary = quality.summary || {};
    const tags = summary.top_problem_tags || [];
    const feedback = summary.recent_feedback || [];
    const ai = Number(summary.total_ai_suggestions || 0);
    const acc = Number(summary.accepted_suggestions || 0);
    const rej = Number(summary.rejected_suggestions || 0);
    const fb = Number(summary.feedback_count || 0);
    const isEmptyQuality = !ai && !acc && !rej && !fb && !tags.length && !feedback.length;
    const emptyExtra = isEmptyQuality ? `
        <section class="panel-section empty-state ds-state quality-empty">
            <h3>Brak danych jakości w tym widoku</h3>
            <p>Wszystkie liczniki są zerowe — albo magazyn v2 nie ma jeszcze agregatu, albo środowisko jest świeże po wdrożeniu.</p>
            <p class="detail-muted">Operator: zobacz dokumentację jakości AI i job agregujący w repozytorium gmail-agent (read-only UI).</p>
        </section>
    ` : '';
    root.innerHTML = wrapDaszekViewShell(['Jakość AI'], `
        <section class="panel-section">
            <div class="stats-grid">
                <div class="stat-card"><span>Propozycje AI</span><strong>${ai}</strong></div>
                <div class="stat-card"><span>Zaakceptowane</span><strong>${acc}</strong></div>
                <div class="stat-card"><span>Odrzucone</span><strong>${rej}</strong></div>
                <div class="stat-card"><span>Feedback</span><strong>${fb}</strong></div>
            </div>
        </section>
        ${emptyExtra}
        <section class="panel-section">
            <h3>Trafność</h3>
            <div class="summary-grid">
                <div><span>Accurate</span><strong>${Math.round(Number(summary.accurate_rate || 0) * 100)}%</strong></div>
                <div><span>Partial</span><strong>${Math.round(Number(summary.partially_accurate_rate || 0) * 100)}%</strong></div>
                <div><span>Inaccurate</span><strong>${Math.round(Number(summary.inaccurate_rate || 0) * 100)}%</strong></div>
            </div>
        </section>
        <section class="panel-section">
            <h3>Najczęstsze problemy</h3>
            ${tags.length ? `<ul class="detail-list">${tags.map(item => `<li><strong>${escapeHtml(item.tag)}</strong><span>${Number(item.count || 0)}</span></li>`).join('')}</ul>` : '<p class="detail-muted">Brak problemów w aktualnym podsumowaniu.</p>'}
        </section>
        <section class="panel-section">
            <h3>Ostatnie feedbacki</h3>
            ${feedback.length ? `<ul class="detail-list">${feedback.map(item => `<li><strong>${escapeHtml((item.payload && item.payload.rating) || item.rating || 'feedback')}</strong><span>${escapeHtml(item.summary_text || item.detail || '')}</span></li>`).join('')}</ul>` : '<p class="detail-muted">Brak feedbacku.</p>'}
        </section>
    `);
}

function ingressDecisionLabelPl(code) {
    const map = {
        ignore: 'Zignorowano',
        create_case: 'Nowe sprawy',
        append_to_existing_case: 'Dołączono do spraw',
        review: 'Do przeglądu',
        update_case_state: 'Aktualizacja stanu',
        create_task: 'Utworzono zadania',
        mark_reference: 'Oznaczono jako referencję',
    };
    const key = String(code || '').trim();
    return map[key] || humanizeCode(key, '—');
}

async function startLastIngressViewLoad() {
    const root = document.getElementById('view-root');
    const requestId = ++lastIngressViewRequestId;
    const skeletonRows = Array.from({ length: 5 }, () => `
        <div class="ingress-skeleton-row" aria-hidden="true">
            <span class="ingress-skeleton-cell ingress-skeleton-cell--long"></span>
            <span class="ingress-skeleton-cell"></span>
            <span class="ingress-skeleton-cell ingress-skeleton-cell--short"></span>
        </div>
    `).join('');
    root.innerHTML = wrapDaszekViewShell(['Ostatni ingress'], `
        <section class="ingress-quality-loading" role="status" aria-live="polite">
            <div class="ingress-quality-loading-head">
                <h3>Wczytywanie ostatniego ingressu…</h3>
                <p class="detail-muted">Pobieranie <code>/wp-json/daszek/v3/ingress-quality-snapshots/latest</code> (sesja operatora).</p>
            </div>
            <div class="ingress-skeleton-list" role="progressbar" aria-busy="true" aria-label="Ładowanie listy ingress">
                ${skeletonRows}
            </div>
        </section>
    `);
    try {
        const data = await apiFetch(V3_API_BASE, '/ingress-quality-snapshots/latest');
        if (requestId !== lastIngressViewRequestId || normalizeMainViewId(state.currentView) !== 'last_ingress') {
            return;
        }
        state.data.lastIngress = data && typeof data === 'object'
            ? data
            : { ok: false, snapshot: null, message: 'Niepoprawna odpowiedź serwera.' };
    } catch (err) {
        if (requestId !== lastIngressViewRequestId || normalizeMainViewId(state.currentView) !== 'last_ingress') {
            return;
        }
        state.data.lastIngress = {
            ok: false,
            snapshot: null,
            message: err && err.message ? String(err.message) : 'Nie udało się pobrać snapshotu.',
        };
    }
    if (requestId !== lastIngressViewRequestId || normalizeMainViewId(state.currentView) !== 'last_ingress') {
        return;
    }
    renderLastIngressView();
}

let systemViewRequestId = 0;

async function startSystemViewLoad() {
    const root = document.getElementById('view-root');
    const requestId = ++systemViewRequestId;
    state.data.systemOsEvents = { ok: false, items: [], loadError: null, loading: true };
    state.data.systemHealth = { ok: false, snapshot: null, loadError: null, loading: true };
    state.data.systemObservability = { ok: false, nodeBStatus: null, feedMeta: null, bridgeSummary: null, loadError: null, loading: true };
    root.innerHTML = wrapDaszekViewShell(['System'], `
        <section class="detail-section detail-section-os-events">
            <h3>Oś systemu</h3>
            <p class="detail-muted" role="status">Wczytywanie zdarzeń systemowych…</p>
        </section>
    `);
    const [eventsResult, healthResult, statusResult, feedResult, bridgeResult] = await Promise.allSettled([
        apiFetch(V3_API_BASE, '/system/os-events/recent'),
        apiFetch(V3_API_BASE, '/system-health-snapshots/latest'),
        apiFetch(V3_API_BASE, '/system/health/status'),
        apiFetch(V3_API_BASE, '/operational-feed-snapshots/latest'),
        apiFetch(V3_API_BASE, '/system/bridge-queue/summary'),
    ]);
    if (requestId !== systemViewRequestId || normalizeMainViewId(state.currentView) !== 'system') {
        return;
    }
    if (eventsResult.status === 'fulfilled') {
        const data = eventsResult.value;
        const items = data && Array.isArray(data.items) ? data.items : [];
        state.data.systemOsEvents = {
            ok: !!(data && data.ok !== false),
            items,
            loadError: null,
            loading: false,
        };
    } else {
        const err = eventsResult.reason;
        state.data.systemOsEvents = {
            ok: false,
            items: [],
            loadError: String(err && err.message ? err.message : err),
            loading: false,
        };
    }
    if (healthResult.status === 'fulfilled') {
        const data = healthResult.value;
        state.data.systemHealth = {
            ok: !!(data && data.ok !== false),
            snapshot: data && data.snapshot ? data.snapshot : null,
            loadError: null,
            loading: false,
        };
    } else {
        const err = healthResult.reason;
        state.data.systemHealth = {
            ok: false,
            snapshot: null,
            loadError: String(err && err.message ? err.message : err),
            loading: false,
        };
    }
    const obsErrors = [];
    let nodeBStatus = null;
    let feedMeta = null;
    let bridgeSummary = null;
    if (statusResult.status === 'fulfilled') {
        nodeBStatus = statusResult.value;
    } else {
        obsErrors.push(String(statusResult.reason && statusResult.reason.message ? statusResult.reason.message : statusResult.reason));
    }
    if (feedResult.status === 'fulfilled') {
        const feedData = feedResult.value;
        const snap = feedData && feedData.snapshot ? feedData.snapshot : null;
        if (snap) {
            feedMeta = {
                snapshot_id: snap.snapshot_id || '',
                ingested_at: snap.ingested_at || snap.created_at || '',
                case_count: Array.isArray(snap.feed && snap.feed.cases) ? snap.feed.cases.length : null,
            };
        }
    } else {
        obsErrors.push(String(feedResult.reason && feedResult.reason.message ? feedResult.reason.message : feedResult.reason));
    }
    if (bridgeResult.status === 'fulfilled') {
        bridgeSummary = bridgeResult.value;
    } else {
        obsErrors.push(String(bridgeResult.reason && bridgeResult.reason.message ? bridgeResult.reason.message : bridgeResult.reason));
    }
    state.data.systemObservability = {
        ok: obsErrors.length === 0,
        nodeBStatus,
        feedMeta,
        bridgeSummary,
        loadError: obsErrors.length ? obsErrors.join(' · ') : null,
        loading: false,
    };
    renderSystemView();
    initMermaidDiagrams();
}

function renderSystemHealthStrip(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
        return `
            <section class="system-health-strip system-health-strip-empty">
                <p class="detail-muted">Brak snapshotu system_health. Uruchom <code>push_system_health_snapshot.py</code> z RAG.</p>
            </section>
        `;
    }
    const rag = snapshot.components && snapshot.components.rag ? snapshot.components.rag : {};
    const status = String(rag.status || 'unknown').trim();
    const statusClass = status === 'healthy' || status === 'ok' ? 'is-ok' : (status === 'degraded' ? 'is-warning' : 'is-muted');
    const indexReady = rag.index_ready === true ? 'tak' : (rag.index_ready === false ? 'nie' : '—');
    const docCount = rag.doc_count != null ? String(rag.doc_count) : '—';
    const chunkCount = rag.chunk_count != null ? String(rag.chunk_count) : '—';
    const ingestRunning = rag.ingest_running ? 'tak' : 'nie';
    const when = formatDate(snapshot.ingested_at || snapshot.created_at || '');
    return `
        <section class="system-health-strip ${statusClass}">
            <div class="system-health-head">
                <h4>Stan KB RAG</h4>
                <span class="record-badge">${escapeHtml(status)}</span>
            </div>
            <dl class="system-health-metrics">
                <div><dt>Indeks gotowy</dt><dd>${escapeHtml(indexReady)}</dd></div>
                <div><dt>Dokumenty</dt><dd>${escapeHtml(docCount)}</dd></div>
                <div><dt>Chunki</dt><dd>${escapeHtml(chunkCount)}</dd></div>
                <div><dt>Ingest w toku</dt><dd>${escapeHtml(ingestRunning)}</dd></div>
            </dl>
            <p class="detail-muted system-health-meta">Snapshot: ${escapeHtml(String(snapshot.snapshot_id || ''))} · ${escapeHtml(when)}</p>
        </section>
    `;
}

function renderSystemObservabilityDashboard() {
    const bundle = state.data.systemOsEvents || {};
    const healthBundle = state.data.systemHealth || {};
    const obs = state.data.systemObservability || {};
    const nodeB = obs.nodeBStatus && typeof obs.nodeBStatus === 'object' ? obs.nodeBStatus : {};
    const nodeBStatus = String(nodeB.status || nodeB.health || (obs.nodeBStatus ? 'ok' : 'unknown')).trim();
    const nodeBClass = nodeBStatus === 'ok' || nodeBStatus === 'healthy' ? 'is-ok' : (nodeBStatus === 'degraded' ? 'is-warning' : 'is-muted');
    const feedMeta = obs.feedMeta || {};
    const feedWhen = feedMeta.ingested_at ? formatDate(feedMeta.ingested_at) : '—';
    const feedAge = feedMeta.ingested_at ? humanizeAge(feedMeta.ingested_at) : 'brak danych';
    const eventCount = Array.isArray(bundle.items) ? bundle.items.length : 0;
    const riskFlags = Array.isArray(nodeB.risk_flags) ? nodeB.risk_flags : [];
    const riskCount = riskFlags.length;
    const riskClass = riskCount > 0 ? 'is-warning' : 'is-ok';
    const bridge = obs.bridgeSummary && typeof obs.bridgeSummary === 'object' ? obs.bridgeSummary : {};
    const bridgePending = bridge.pending_count != null ? Number(bridge.pending_count) : 0;
    const bridgeRetry = bridge.retry_count != null ? Number(bridge.retry_count) : 0;
    const bridgeDeadLetter = bridge.dead_letter_count != null ? Number(bridge.dead_letter_count) : 0;
    const bridgeOldest = bridge.oldest_created_at ? humanizeAge(bridge.oldest_created_at) : '—';
    const bridgeStuck = bridge.stuck_count != null ? Number(bridge.stuck_count) : 0;
    const bridgeClass = (bridgeStuck > 0 || bridgeDeadLetter > 0) ? 'is-warning' : ((bridgePending + bridgeRetry) > 0 ? 'is-muted' : 'is-ok');
    const healthErr = healthBundle.loadError ? `<p class="error-inline" role="alert">${escapeHtml(healthBundle.loadError)}</p>` : '';
    const obsErr = obs.loadError ? `<p class="error-inline" role="alert">${escapeHtml(obs.loadError)}</p>` : '';
    return `
        <section class="detail-section system-observability-dashboard">
            <h3>Observability</h3>
            <p class="detail-muted">Szybki podgląd zdrowia stosu — feed, Node B, bridge queue, risk flags, zdarzenia OS.</p>
            ${healthErr}
            ${obsErr}
            <div class="system-obs-grid">
                <article class="system-obs-card ${nodeBClass}">
                    <h4>Node B</h4>
                    <p class="system-obs-value">${escapeHtml(nodeBStatus)}</p>
                    <p class="detail-muted">Proxy: /system/health/status</p>
                </article>
                <article class="system-obs-card">
                    <h4>Feed operacyjny</h4>
                    <p class="system-obs-value">${escapeHtml(feedAge)}</p>
                    <p class="detail-muted">${escapeHtml(feedWhen)}${feedMeta.case_count != null ? ` · ${feedMeta.case_count} spraw` : ''}</p>
                </article>
                <article class="system-obs-card ${bridgeClass}">
                    <h4>Bridge queue</h4>
                    <p class="system-obs-value">${bridgePending} actionable</p>
                    <p class="detail-muted">Retry: ${bridgeRetry} · Dead-letter: ${bridgeDeadLetter}${bridgeStuck > 0 ? ` · ${bridgeStuck} stuck` : ''} · Najstarszy: ${escapeHtml(bridgeOldest)}</p>
                </article>
                <article class="system-obs-card ${riskClass}">
                    <h4>Risk flags</h4>
                    <p class="system-obs-value">${riskCount}</p>
                    <p class="detail-muted">Deterministyczne reguły Node B</p>
                </article>
                <article class="system-obs-card">
                    <h4>Zdarzenia OS</h4>
                    <p class="system-obs-value">${eventCount}</p>
                    <p class="detail-muted">Ostatnia projekcja z Node B</p>
                </article>
            </div>
        </section>
    `;
}

function humanizeAge(iso) {
    const t = Date.parse(String(iso || ''));
    if (!Number.isFinite(t)) return '—';
    const mins = Math.round((Date.now() - t) / 60000);
    if (mins < 1) return 'przed chwilą';
    if (mins < 60) return `${mins} min temu`;
    const hrs = Math.round(mins / 60);
    if (hrs < 48) return `${hrs} h temu`;
    const days = Math.round(hrs / 24);
    return `${days} d temu`;
}

function renderSystemView() {
    const root = document.getElementById('view-root');
    const bundle = state.data.systemOsEvents || {};
    const healthBundle = state.data.systemHealth || {};
    const obsBundle = state.data.systemObservability || {};
    if (bundle.loading || healthBundle.loading || obsBundle.loading) {
        return;
    }
    const items = Array.isArray(bundle.items) ? bundle.items : [];
    const rows = items.map((ev) => {
        const summary = String(ev.summary_pl || ev.event_type || 'Zdarzenie').trim();
        const repo = String(ev.source_repo || '').trim();
        const eid = String(ev.engagement_id || '').trim();
        const when = formatDate(ev.occurred_at || '');
        const status = String((ev.payload && ev.payload.status) || ev.status || 'ok').trim();
        const statusClass = status === 'error' ? 'is-error' : (status === 'warning' ? 'is-warning' : 'is-ok');
        const typeLabel = String(ev.event_type || '').trim();
        const eventId = String(ev.event_id || '').trim();
        return `<li class="os-event-row ${statusClass} os-event-item" data-os-event-id="${escapeHtml(eventId)}" data-engagement-id="${escapeHtml(eid)}" tabindex="0" role="button" aria-label="Kliknij po szczególy: ${escapeHtml(summary.slice(0, 60))}">
            <div class="os-event-head">
                <time datetime="${escapeHtml(String(ev.occurred_at || ''))}">${escapeHtml(when)}</time>
                ${repo ? `<span class="record-badge os-event-repo">${escapeHtml(repo)}</span>` : ''}
                ${typeLabel ? `<span class="record-badge">${escapeHtml(typeLabel)}</span>` : ''}
            </div>
            <p class="os-event-summary">${escapeHtml(summary)}</p>
            ${eid ? `<p class="detail-muted os-event-engagement">engagement: ${escapeHtml(eid)}</p>` : ''}
        </li>`;
    }).join('');
    const eventsError = bundle.loadError
        ? `<p class="error-inline" role="alert">${escapeHtml(bundle.loadError)}</p>`
        : '';
    root.innerHTML = wrapDaszekViewShell(['System'], `
        ${renderSystemObservabilityDashboard()}
        ${renderSystemHealthStrip(healthBundle.snapshot)}
        <section class="detail-section detail-section-os-events">
            <h3>Oś systemu</h3>
            <p class="detail-muted">Read-only timeline zdarzeń cross-repo (Node B). Nie zastępuje dziennika sprawy ani workflow Cieplo w jego DB.</p>
            ${eventsError}
            ${items.length ? `<ul class="os-event-list">${rows}</ul>` : '<p class="detail-muted">Brak zdarzeń systemowych.</p>'}
        </section>
        ${renderSystemDiagramsSection()}
    `);
}

function renderSystemDiagramsSection() {
    const manifest = window.DASZEK_SYSTEM_DIAGRAMS_MANIFEST;
    if (!manifest || !manifest.globalSection || !Array.isArray(manifest.globalSection.diagrams)) {
        return '';
    }
    const diagrams = manifest.globalSection.diagrams;
    const diagramCards = diagrams.map((d, idx) => {
        const mermaidCode = d.mermaid || d.mermaidDoc || '';
        if (!mermaidCode) return '';
        const safeId = `mermaid-diagram-${idx}`;
        return `<div class="system-diagram-card">
            <h4>${escapeHtml(d.title || 'Diagram ' + (idx + 1))}</h4>
            <p class="detail-muted">${escapeHtml(d.caption || '')}</p>
            <pre class="mermaid" id="${safeId}">${escapeHtml(mermaidCode)}</pre>
        </div>`;
    }).filter(Boolean).join('');
    if (!diagramCards) return '';
    return `<section class="detail-section detail-section-diagrams">
        <h3>Diagramy architektury</h3>
        <p class="detail-muted">${escapeHtml(manifest.globalSection.intro || '')}</p>
        ${diagramCards}
    </section>`;
}

function initMermaidDiagrams() {
    if (typeof mermaid === 'undefined') {
        return;
    }
    try {
        mermaid.initialize({ startOnLoad: false, theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'default' });
        mermaid.run({ querySelector: '.mermaid' });
    } catch (e) {
        console.warn('Mermaid init error:', e);
    }
}

function renderLastIngressView() {
    const root = document.getElementById('view-root');
    const wrap = state.data.lastIngress || {};
    const snap = wrap.snapshot;

    if (!snap) {
        const hint = wrap.message || 'Brak zapisanego snapshotu ostatniego ingressu.';
        root.innerHTML = wrapDaszekViewShell(['Ostatni ingress'], `
            <section class="empty-state ds-state">
                <h3>${escapeHtml(hint)}</h3>
                <p>Ten widok czyta zapisany snapshot z Node B. Uruchom eksporter <code>ingress_quality_snapshot.py</code>, a następnie wyślij JSON metodą POST na endpoint Daszek V3 (operator + CSRF albo skonfigurowany bridge token).</p>
                <p class="detail-muted">Nie uruchamia Gmaila ani LLM. Nie tworzy spraw. Osobny kontekst od operational feed.</p>
            </section>
        `);
        return;
    }

    const counts = snap.counts || {};
    const llm = snap.llm || {};
    const dist = snap.decision_distribution || {};
    const manual = snap.manual_review_items || [];
    const failed = snap.failed_items || [];
    const items = snap.items || [];
    const runId = snap.run_id || '';
    const ts = snap.ingested_at || snap.created_at || '';

    const distRows = Object.keys(dist).length
        ? Object.entries(dist).map(([k, v]) => `
            <tr><td>${escapeHtml(ingressDecisionLabelPl(k))}</td><td><strong>${escapeHtml(String(v))}</strong></td></tr>
        `).join('')
        : '<tr><td colspan="2" class="detail-muted">Brak rozkładu decyzji.</td></tr>';

    const manualRows = manual.length
        ? manual.map(row => `
            <tr>
                <td><code>${escapeHtml(row.message_id || '')}</code></td>
                <td>${escapeHtml(ingressDecisionLabelPl(row.decision))}</td>
                <td>${escapeHtml(row.case_id || '—')}</td>
                <td>${escapeHtml(row.status || '')}</td>
                <td>${row.truncated ? 'tak' : 'nie'}</td>
                <td>${escapeHtml(row.operator_question || '')}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="6" class="detail-muted">Brak pozycji oznaczonych do ręcznego przeglądu.</td></tr>';

    const failedSection = failed.length
        ? failed.map(row => `
            <article class="case-card">
                <div class="case-meta"><span>niepowodzenie</span><span>${escapeHtml(row.status || '')}</span></div>
                <h3><code>${escapeHtml(row.message_id || '')}</code></h3>
                <p>${escapeHtml(row.non_sensitive_reason || '')}</p>
                <p class="detail-muted">${escapeHtml(row.recommended_operator_action || '')}</p>
            </article>
        `).join('')
        : '<p class="detail-muted">Brak zapisanych niepowodzeń walidacji.</p>';

    const refs = snap.report_refs && typeof snap.report_refs === 'object' ? snap.report_refs : {};
    const refList = Object.entries(refs).filter(([, v]) => v).map(([k, v]) => `<li><strong>${escapeHtml(k)}</strong> — <code>${escapeHtml(String(v))}</code></li>`).join('');

    root.innerHTML = wrapDaszekViewShell(['Ostatni ingress'], `
        <p class="detail-muted feed-detail-banner">Osobny kontekst od operational feed — tylko jakość bounded ingress (read-only).</p>
        <section class="section-block ingress-quality-banner">
            <div class="ingress-quality-head">
                <div>
                    <p class="eyebrow">${escapeHtml(snap.title || 'Ostatni ingress')}</p>
                    <h3>${escapeHtml(snap.operator_label || 'Podgląd jakości ingressu — nie tworzy spraw i nie wykonuje akcji')}</h3>
                    <p class="detail-muted">${escapeHtml(snap.subtitle || '')}</p>
                </div>
                <span class="badge badge-readonly">tylko podgląd jakości</span>
            </div>
            <p class="ingress-quality-disclaimer">Ten widok pokazuje wynik bounded mail ingress. Nie tworzy spraw, nie wykonuje akcji i nie obchodzi policy.</p>
            <div class="ingress-quality-meta">
                <div><span>run_id</span><code>${escapeHtml(runId)}</code>
                    <button type="button" class="btn btn-secondary btn-compact" data-copy-run-id="${escapeHtml(runId)}">Kopiuj run_id</button>
                </div>
                <div><span>Czas snapshotu</span><strong>${escapeHtml(formatDate(ts))}</strong></div>
            </div>
        </section>

        <section class="panel-section">
            <div class="stats-grid">
                <div class="stat-card"><span>Wybrane</span><strong>${escapeHtml(String(counts.selected_count ?? 0))}</strong></div>
                <div class="stat-card"><span>Przetworzone</span><strong>${escapeHtml(String(counts.processed_count ?? 0))}</strong></div>
                <div class="stat-card"><span>OK</span><strong>${escapeHtml(String(counts.valid_count ?? 0))}</strong></div>
                <div class="stat-card"><span>Błędy</span><strong>${escapeHtml(String(counts.failed_count ?? 0))}</strong></div>
                <div class="stat-card"><span>Do przeglądu</span><strong>${escapeHtml(String(manual.length))}</strong></div>
                <div class="stat-card"><span>Zdarzenia rate limit</span><strong>${escapeHtml(String(llm.rate_limit_events ?? 0))}</strong></div>
                <div class="stat-card"><span>Przycięte wejścia</span><strong>${escapeHtml(String(llm.truncation_count ?? 0))}</strong></div>
                <div class="stat-card"><span>Push do Daszka (persisted)</span><strong>${escapeHtml(String(snap.daszek_persisted_push_count ?? 0))}</strong></div>
            </div>
        </section>

        <section class="section-block">
            <div class="section-header"><h3>Infrastruktura i limity</h3></div>
            <ul class="detail-list">
                <li><strong>Live Gmail</strong><span>${snap.live_gmail_used ? 'tak' : 'nie'}</span></li>
                <li><strong>Pamięć skrzynki zmieniona</strong><span>${snap.mailbox_memory_mutated ? 'tak' : 'nie'}</span></li>
                <li><strong>Outbound actions</strong><span>${snap.outbound_actions ? 'tak' : 'nie'}</span></li>
                <li><strong>Lokalne podglądy projekcji</strong><span>${escapeHtml(String(snap.local_projection_preview_count ?? 0))}</span></li>
                <li><strong>Invalid JSON / schema / semantic</strong><span>${escapeHtml([llm.invalid_json, llm.schema_invalid, llm.semantic_invalid].join(' / '))}</span></li>
            </ul>
        </section>

        <section class="section-block">
            <div class="section-header"><h3>Rozkład decyzji (audyt)</h3></div>
            <table class="ingress-table">
                <thead><tr><th>Decyzja</th><th>Liczba</th></tr></thead>
                <tbody>${distRows}</tbody>
            </table>
        </section>

        <section class="section-block">
            <div class="section-header"><h3>Lista do ręcznego sprawdzenia</h3><span>${manual.length}</span></div>
            <table class="ingress-table">
                <thead><tr><th>message_id</th><th>Decyzja</th><th>case_id</th><th>status</th><th>Przycięte</th><th>Pytanie</th></tr></thead>
                <tbody>${manualRows}</tbody>
            </table>
        </section>

        <section class="section-block">
            <div class="section-header"><h3>Niepowodzenia</h3><span>${failed.length}</span></div>
            <div class="case-grid">${failedSection}</div>
        </section>

        <section class="section-block">
            <div class="section-header"><h3>Pełna tabela (sanitized)</h3><span>${items.length}</span></div>
            <p class="detail-muted">Bez treści maili — tylko identyfikatory i metadane z raportu operatora.</p>
            <div class="table-scroll">
            <table class="ingress-table ingress-table-dense">
                <thead><tr><th>#</th><th>message_id</th><th>Decyzja</th><th>case_id</th><th>status</th><th>Przycięte</th><th>Pytanie</th></tr></thead>
                <tbody>
                    ${items.map(row => `
                        <tr>
                            <td>${escapeHtml(String(row.index ?? ''))}</td>
                            <td><code>${escapeHtml(row.message_id || '')}</code></td>
                            <td>${escapeHtml(ingressDecisionLabelPl(row.decision))}</td>
                            <td>${escapeHtml(row.case_id || '—')}</td>
                            <td>${escapeHtml(row.status || '')}</td>
                            <td>${row.truncated ? 'tak' : 'nie'}</td>
                            <td>${escapeHtml(row.operator_question || '')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            </div>
        </section>

        <section class="section-block">
            <div class="section-header"><h3>Odniesienia do raportów</h3></div>
            <p class="detail-muted">Ścieżka względna repozytorium Node B: <code>${escapeHtml(snap.source_run_dir_reference || '')}</code></p>
            <ul class="detail-list">${refList || '<li class="detail-muted">Brak listy plików.</li>'}</ul>
        </section>
    `, lastIngressSnapshotMetaLine(snap));
}

function renderTasksView() {
    renderCasesView();
}

function loadTasksIntoView() {
    void refreshRegistryViewAfterTaskMutation();
}

function renderTasksContent(tasks) {
    var root = document.getElementById('view-root');
    var confident = tasks.filter(function (t) { return t.source_kind === 'agent_confident' && t.task_status === 'pending'; });
    var active = tasks.filter(function (t) { return t.task_status === 'confirmed'; });
    var uncertain = tasks.filter(function (t) { return t.source_kind === 'agent_uncertain' && t.task_status === 'pending'; });

    var html = '<div class="section-block">';
    html += '<div class="section-header"><div><h3>Zadania</h3><p>Sprawy firmowe wymagające działania (ZUS, auto, faktury). Leady klientów HVAC są w Biurku i Sprawach.</p></div>';
    html += '<button id="task-new-btn" class="btn btn-primary btn-small">+ Nowe zadanie</button></div>';

    html += '<div id="task-new-form" style="display:none; margin:12px 0; padding:12px; border:1px solid #ccc; border-radius:8px;">';
    html += '<label><span>Tytuł</span><input type="text" id="task-title" placeholder="Np. Firmowe auto — naprawić hamulec" style="width:100%;padding:8px;"></label>';
    html += '<div style="display:flex;gap:8px;margin-top:8px;"><label><span>Priorytet</span><select id="task-priority"><option value="normalny" selected>normalny</option><option value="pilne">pilne</option><option value="niski">niski</option></select></label>';
    html += '<label><span>Data/godzina (opcjonalnie)</span><input type="text" id="task-scheduled" placeholder="np. 2026-07-05 11:00" style="padding:8px;"></label></div>';
    html += '<div style="margin-top:8px;"><button id="task-create-btn" class="btn btn-primary">Dodaj</button><button id="task-cancel-btn" class="btn btn-ghost">Anuluj</button></div>';
    html += '</div>';

    html += '<div style="margin-top:16px;"><h4>Do potwierdzenia (od agenta)</h4>';
    if (confident.length) { confident.forEach(function (t) { html += taskCardHtml(t, 'pending'); }); }
    else { html += '<p class="detail-muted">Brak zadań do potwierdzenia.</p>'; }
    html += '</div>';

    html += '<div style="margin-top:16px;"><h4>Do zrobienia</h4>';
    if (active.length) { active.sort(function (a, b) { return (a.priority === 'pilne' ? -1 : 0) - (b.priority === 'pilne' ? -1 : 0); }).forEach(function (t) { html += taskCardHtml(t, 'active'); }); }
    else { html += '<p class="detail-muted">Brak aktywnych zadań.</p>'; }
    html += '</div>';

    html += '<div style="margin-top:16px;"><h4>Sugestie agenta (niepewne)</h4>';
    if (uncertain.length) { uncertain.forEach(function (t) { html += taskCardHtml(t, 'uncertain'); }); }
    else { html += '<p class="detail-muted">Brak sugestii.</p>'; }
    html += '</div>';

    html += '<details style="margin-top:16px;"><summary>Pokaż archiwum</summary><div id="task-archive" style="margin-top:8px;">';
    html += '<button id="task-archive-load" class="btn btn-ghost btn-small">Załaduj archiwum</button></div></details>';
    html += '</div>';
    root.innerHTML = html;

    document.getElementById('task-new-btn').addEventListener('click', function () { document.getElementById('task-new-form').style.display = 'block'; });
    document.getElementById('task-cancel-btn').addEventListener('click', function () { document.getElementById('task-new-form').style.display = 'none'; });
    document.getElementById('task-create-btn').addEventListener('click', function () { void createManualTask(); });
    document.getElementById('task-archive-load').addEventListener('click', loadArchive);
    bindTaskButtonsDelegated();
}

function bindTaskButtonsDelegated() {
    const root = document.getElementById('view-root');
    if (!root || root.dataset.taskDelegationBound === '1') {
        return;
    }
    root.dataset.taskDelegationBound = '1';
    root.addEventListener('click', function (event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }
        const confirmBtn = target.closest('.task-confirm');
        if (confirmBtn) {
            showTaskFeedback(confirmBtn.dataset.id, 'confirm');
            return;
        }
        const rejectBtn = target.closest('.task-reject');
        if (rejectBtn) {
            showTaskFeedback(rejectBtn.dataset.id, 'reject');
            return;
        }
        const doneBtn = target.closest('.task-done');
        if (doneBtn) {
            void markTaskDone(doneBtn.dataset.id);
        }
    });
}

function taskCardHtml(task, mode) {
    var pr = task.priority;
    var prClass = pr === 'pilne' ? 'task-priority--urgent' : (pr === 'normalny' ? 'task-priority--normal' : 'task-priority--low');
    var src = task.source_kind === 'agent_confident' ? '🤖 Agent' : task.source_kind === 'agent_uncertain' ? '🤖 Agent (niepewny)' : '👤 Operator';
    var taskId = task.id || task.task_id || task.case_id || '';
    var modeClass = mode === 'pending' ? 'task-card--pending' : 'task-card--default';
    var html = '<div class="task-card ' + modeClass + '">';
    html += '<span class="task-priority-icon ' + prClass + '">' + (pr === 'pilne' ? '🔴' : pr === 'normalny' ? '🟡' : '⚪') + '</span>';
    html += '<div class="task-card-body"><strong>' + escapeHtml(task.task_title || task.case_id) + '</strong>';
    html += '<div class="task-card-meta">' + src + (task.scheduled_at ? ' · 📅 ' + escapeHtml(task.scheduled_at) : '') + '</div></div>';
    html += '<div class="task-card-actions">';
    if (mode === 'pending') { html += '<button class="btn btn-primary btn-small task-confirm" data-id="' + escapeHtml(taskId) + '">Potwierdź</button><button class="btn btn-ghost btn-small task-reject" data-id="' + escapeHtml(taskId) + '">Odrzuć</button>'; }
    else if (mode === 'active') { html += '<button class="btn btn-ghost btn-small task-done" data-id="' + escapeHtml(taskId) + '">Zrobione</button>'; }
    else { html += '<button class="btn btn-ghost btn-small task-done" data-id="' + escapeHtml(taskId) + '">Zrobione</button><button class="btn btn-ghost btn-small task-reject" data-id="' + escapeHtml(taskId) + '">Odrzuć</button>'; }
    html += '</div></div>'; return html;
}

function bindTaskButtons() {
    /* legacy no-op — delegation via bindTaskButtonsDelegated */
}

function showTaskFeedback(cid, action) {
    var fb = prompt(action === 'confirm' ? 'Potwierdzasz — wiadomość dla agenta (opcjonalnie):' : 'Odrzucasz — wiadomość dla agenta (opcjonalnie):');
    if (fb === null) return;
    apiFetch(V2_API_BASE, '/tasks/' + cid + '/' + (action === 'confirm' ? 'confirm' : 'reject'), { method: 'POST', body: JSON.stringify({ feedback: fb || '' }) })
        .then(function () { void refreshRegistryViewAfterTaskMutation(); })
        .catch(function (err) { showToast('Nie udalo sie zapisac decyzji: ' + err.message, 'error'); });
}

function loadArchive() {
    var d = document.getElementById('task-archive');
    apiFetch(V2_API_BASE, '/tasks?archive=true', {}).then(function (data) {
        if (!data || !data.ok) { d.innerHTML = '<p class="detail-muted">Brak archiwum.</p>'; return; }
        var tasks = data.tasks || []; if (!tasks.length) { d.innerHTML = '<p class="detail-muted">Archiwum puste.</p>'; return; }
        var h = ''; tasks.forEach(function (t) { h += '<div style="padding:8px;border-bottom:1px solid #e5e7eb;">' + escapeHtml(t.task_title || t.case_id) + ' <span style="color:#6b7280;">' + (t.task_status === 'rejected' ? '❌ Odrzucone' : '✅ Zrobione') + ' · ' + escapeHtml(String(t.updated_at || t.created_at || '').substring(0, 10)) + '</span></div>'; });
        d.innerHTML = h;
    }).catch(function (err) {
        d.innerHTML = '<p class="error-inline" role="alert">' + escapeHtml(err && err.message ? err.message : String(err)) + '</p>';
    });
}

function renderManualTaskFormHtml() {
    return `
            <form id="manual-task-form" class="manual-task-form">
                <div class="form-row">
                    <label class="form-group flex-2">
                        <span>Tytuł</span>
                        <input type="text" name="title" required placeholder="Np. Telefon do dostawcy albo przypomnienie serwisowe">
                    </label>
                    <label class="form-group">
                        <span>Priorytet</span>
                        <select name="priority">
                            <option value="high">wysoki</option>
                            <option value="medium" selected>średni</option>
                            <option value="low">niski</option>
                        </select>
                    </label>
                    <label class="form-group">
                        <span>Termin</span>
                        <input type="date" name="due_at">
                    </label>
                </div>
                <label class="form-group">
                    <span>Notatka</span>
                    <textarea name="note" rows="2" placeholder="Krótki kontekst do ręcznie dodanego przypomnienia"></textarea>
                </label>
                <button type="submit" class="btn btn-primary">Dodaj ręczne zadanie</button>
            </form>`;
}

function renderNoteCard(item, showFeedback) {
    const badges = [
        item.latest_change_source_label
            ? renderMetaBadge(`Źródło: ${item.latest_change_source_label}`, changeSourceTone(item.latest_change_source))
            : '',
        item.latest_change_decision_label
            ? renderMetaBadge(item.latest_change_decision_label, changeSourceTone(item.latest_change_source))
            : '',
        item.latest_change_rule_label
            ? renderMetaBadge(item.latest_change_rule_label, 'maintenance')
            : '',
    ].filter(Boolean).join('');
    return `
        <article class="note-card note-${escapeHtml(item.presence_mode || 'standard')}">
            <button type="button" class="note-open" data-open-note="${escapeHtml(item.note_id)}">
                <span class="note-presence">${escapeHtml(item.presence_label)}</span>
                <h3>${escapeHtml(item.title || 'Kartka AI')}</h3>
                ${renderGuidanceSection(item, { compact: true })}
                <p class="note-why">${escapeHtml(item.why_on_desk || item.summary || '')}</p>
                <p class="note-step">${escapeHtml(item.recommended_next_step || 'Sprawdź szczegóły i zdecyduj o kolejnym kroku.')}</p>
                ${badges ? `<div class="note-meta-badges">${badges}</div>` : ''}
                ${item.latest_change_reason_pl ? `<p class="note-trust">${escapeHtml(item.latest_change_reason_pl)}</p>` : ''}
                ${item.maintenance_guard?.blocked ? `<p class="note-guard">${escapeHtml(item.maintenance_guard.reason_pl || 'Świeży manual feedback blokuje maintenance przez 7 dni.')}</p>` : ''}
                <div class="note-footer">
                    <span>${escapeHtml(item.case_title || 'Bez przypisanej sprawy')}</span>
                    <span>${escapeHtml(formatDate(item.updated_at))}</span>
                </div>
            </button>
            <div class="note-actions">
                <button type="button" class="btn btn-secondary btn-small" data-note-action="to_juz_nieaktualne" data-note-id="${escapeHtml(item.note_id)}">Zrobione</button>
                ${item.case_id ? `<button type="button" class="btn btn-ghost btn-small" data-open-case="${escapeHtml(item.case_id)}">Otwórz sprawę</button>` : ''}
                ${showFeedback ? `
                    <button type="button" class="btn btn-ghost btn-small" data-note-action="trafne" data-note-id="${escapeHtml(item.note_id)}">Trafne</button>
                    <button type="button" class="btn btn-ghost btn-small" data-note-action="za_mocne" data-note-id="${escapeHtml(item.note_id)}">Za mocne</button>
                    <button type="button" class="btn btn-ghost btn-small" data-note-action="za_slabe" data-note-id="${escapeHtml(item.note_id)}">Za słabe</button>
                    ${item.case_id ? `<button type="button" class="btn btn-ghost btn-small" data-note-action="tylko_w_sprawie" data-note-id="${escapeHtml(item.note_id)}">Tylko w sprawie</button>` : ''}
                ` : ''}
            </div>
        </article>
    `;
}

function renderTaskRow(task) {
    const isDone = task.status === 'done';
    const summary = compatibilityTaskSummary(task);
    return `
        <article class="task-row ${isDone ? 'task-row-done' : ''}">
            <div class="task-row-main">
                <div class="task-row-top">
                    <h3>${escapeHtml(compatibilityTaskTitle(task))}</h3>
                    <span class="task-badge">${escapeHtml(priorityLabel(task.priority))}</span>
                </div>
                ${summary ? `<p>${escapeHtml(summary)}</p>` : ''}
                <div class="task-row-meta">
                    <span>Źródło: ${escapeHtml(taskSourceLabel(task.source))}</span>
                    <span>Termin: ${escapeHtml(formatDate(task.due_at))}</span>
                </div>
            </div>
            <div class="task-row-actions">
                ${!isDone ? `<button type="button" class="btn btn-secondary btn-small" data-task-done="${escapeHtml(task.id)}">Zrobione</button>` : '<span class="done-chip">Załatwione</span>'}
                <button type="button" class="btn btn-ghost btn-small" data-task-due="${escapeHtml(task.id)}">Termin</button>
            </div>
        </article>
    `;
}

async function openNoteDetail(noteId) {
    const nid = String(noteId || '').trim();
    if (!nid) {
        return;
    }
    clearError();
    const feedItem = findOperationalFeedDeskNote(nid);
    if (feedItem) {
        state.detail = {
            type: 'note',
            payload: buildNoteDetailPayloadFromFeedDeskItem(feedItem),
            source: 'operational_feed',
        };
        setDetailPanelChromeOpen(true);
        renderDetailPanel();
        void refreshNoteDetailLiveContext();
        return;
    }
    if (hasOperationalFeedSnapshot() && isFeedProjectionNoteId(nid)) {
        state.detail = {
            type: 'detail_error',
            mode: 'note',
            id: nid,
            message: `Kartka „${nid}” nie występuje w bieżącej migawce operational feed. Odśwież zasilenie z Node B.`,
            httpStatus: 404,
        };
        setDetailPanelChromeOpen(true);
        renderDetailPanel();
        return;
    }
    state.detail = { type: 'detail_loading', mode: 'note', id: nid };
    setDetailPanelChromeOpen(true);
    renderDetailPanel();
    try {
        const detail = await apiFetch(V3_API_BASE, `/desk-notes/${encodeURIComponent(nid)}`);
        state.detail = { type: 'note', payload: detail, source: 'v3_live' };
        renderDetailPanel();
        void refreshNoteDetailLiveContext();
    } catch (error) {
        const st = Number(error.status || 0);
        let msg = String(error.message || 'Błąd wczytania kartki.');
        if (st === 404 && hasOperationalFeedSnapshot()) {
            msg = `Kartka „${nid}” nie występuje w magazynie v2 ani w bieżącej migawce operational feed. Odśwież zasilenie z Node B.`;
        } else if (st === 404) {
            msg = `Kartka „${nid}” nie istnieje w magazynie v2. Możliwy stary snapshot lub rozjazd zasilenia.`;
        }
        state.detail = {
            type: 'detail_error',
            mode: 'note',
            id: nid,
            message: msg,
            httpStatus: st,
        };
        renderDetailPanel();
        if (st === 401 || st === 403) {
            showError(msg);
        }
    }
}

function resolveEngagementIdFromNoteDetail(detail) {
    if (!detail || detail.type !== 'note') {
        return '';
    }
    const payload = detail.payload && typeof detail.payload === 'object' ? detail.payload : {};
    const note = payload.note && typeof payload.note === 'object' ? payload.note : {};
    return String(note.engagement_id || payload.engagement_id || '').trim();
}

async function refreshNoteDetailLiveContext() {
    if (!state.detail || state.detail.type !== 'note') {
        return;
    }
    let eid = resolveEngagementIdFromNoteDetail(state.detail);
    const payload = state.detail.payload && typeof state.detail.payload === 'object' ? state.detail.payload : {};
    const note = payload.note && typeof payload.note === 'object' ? payload.note : {};
    const caseItem = payload.case && typeof payload.case === 'object' ? payload.case : {};
    const caseId = String(caseItem.case_id || note.case_id || payload.case_id || '').trim();
    if (!eid && caseId) {
        try {
            const eng = await apiFetch(V3_API_BASE, `/cases/${encodeURIComponent(caseId)}/engagement`);
            if (eng && typeof eng.engagement === 'object') {
                state.detail.engagement = eng.engagement;
                eid = String(eng.engagement.engagement_id || '').trim();
            }
        } catch (_engErr) {
            // optional enrichment only
        }
    }
    if (!eid) {
        state.detail.osEvents = { ok: false, items: [], loadError: null, engagement_id: '', loading: false };
        renderDetailPanel();
        return;
    }
    state.detail.osEvents = { ok: false, items: [], loadError: null, engagement_id: eid, loading: true };
    renderDetailPanel();
    const loaded = await loadOsEventsForEngagement(eid);
    if (!state.detail || state.detail.type !== 'note') {
        return;
    }
    state.detail.osEvents = { ...loaded, loading: false };
    renderDetailPanel();
}

async function openCaseDetail(caseId) {
    const cid = String(caseId || '').trim();
    if (!cid) {
        return;
    }
    clearError();
    state.detail = { type: 'detail_loading', mode: 'case', id: cid };
    setDetailPanelChromeOpen(true);
    renderDetailPanel();
    try {
        const detail = await apiFetch(V3_API_BASE, `/cases/${encodeURIComponent(cid)}`);
        let engagementSummary = null;
        try {
            const eng = await apiFetch(V3_API_BASE, `/cases/${encodeURIComponent(cid)}/engagement`);
            engagementSummary = eng && typeof eng.engagement === 'object' ? eng.engagement : null;
        } catch (_engErr) {
            engagementSummary = null;
        }
        state.detail = { type: 'case', payload: detail, engagement: engagementSummary, source: 'v3_live' };
        renderDetailPanel();
        void refreshCaseDetailOsEvents();
    } catch (error) {
        const st = Number(error.status || 0);
        let msg = String(error.message || 'Błąd wczytania sprawy.');
        if (st === 404 && hasOperationalFeedSnapshot()) {
            msg = `Sprawa „${cid}” nie występuje w magazynie v2 ani w bieżącej migawce operational feed. Odśwież zasilenie z Node B.`;
        } else if (st === 404) {
            msg = `Sprawa „${cid}” nie istnieje w magazynie v2. Możliwy stary snapshot lub rozjazd zasilenia.`;
        }
        const fromFeed = resolveOperationalFeedCaseDetail(cid);
        if (fromFeed && st !== 401 && st !== 403) {
            const source = fromFeed.feed_read_only_stub ? 'operational_feed_stub_fallback' : 'operational_feed_fallback';
            state.detail = {
                type: 'case',
                payload: {
                    ...fromFeed,
                    live_detail_fetch_failed: true,
                    live_detail_error: msg,
                },
                source,
                liveError: {
                    message: msg,
                    httpStatus: st,
                },
            };
            renderDetailPanel();
            void refreshCaseDetailOsEvents();
            return;
        }
        state.detail = {
            type: 'detail_error',
            mode: 'case',
            id: cid,
            message: msg,
            httpStatus: st,
        };
        renderDetailPanel();
        if (st === 401 || st === 403) {
            showError(msg);
        }
    }
}

function renderSignalItems(signals) {
    if (!signals || !signals.length) {
        return '<p class="detail-muted">Brak zapisanych źródeł.</p>';
    }
    return signals.map(signal => {
        const observedAt = signal.observed_at || ((signal.source_ref || {}).received_at) || '';
        const sourceLine = observedAt
            ? `Źródło: Gmail • ${escapeHtml(formatDate(observedAt))}`
            : 'Źródło: Gmail';
        return `
            <li>
                <strong>${escapeHtml((signal.intake || {}).primary_signal_name || 'Sygnał')}</strong>
                <span> • ${escapeHtml((signal.intake || {}).business_area_label || businessAreaLabel((signal.intake || {}).business_area))}</span>
                <div class="detail-muted">${sourceLine}</div>
            </li>
        `;
    }).join('');
}

function renderTraceItems(traces) {
    if (!traces || !traces.length) {
        return '<p class="detail-muted">Brak śladu decyzji.</p>';
    }
    return traces.map(trace => `
        <li>
            <strong>${escapeHtml(trace.decision_type_label || decisionTypeLabel(trace.decision_type))}</strong>
            <div>${escapeHtml(trace.reason_summary_pl || '')}</div>
            <div class="detail-muted">
                ${escapeHtml(trace.actor_source_label || trace.actor || 'Intake AI')}
                • ${escapeHtml(formatDate(trace.created_at))}
                ${trace.maintenance_rule_label_pl ? ` • ${escapeHtml(trace.maintenance_rule_label_pl)}` : ''}
            </div>
        </li>
    `).join('');
}

function renderStringList(items, emptyText = 'Brak.') {
    if (!items || !items.length) {
        return `<p class="detail-muted">${escapeHtml(emptyText)}</p>`;
    }
    return `<ul class="detail-list">${items.map(item => `<li>${escapeHtml(String(item || ''))}</li>`).join('')}</ul>`;
}

function renderRiskSummary(risks) {
    if (!risks || !risks.length) {
        return '<p class="detail-muted">Brak wyraźnych ryzyk.</p>';
    }
    return `<ul class="detail-list">${risks.map(risk => `
        <li>
            <strong>${escapeHtml(riskTypeLabel((risk || {}).risk_type || ''))}</strong>
            <div>${escapeHtml((risk || {}).reason_pl || '')}</div>
            ${((risk || {}).what_to_watch_for) ? `<div class="detail-muted">Obserwuj: ${escapeHtml((risk || {}).what_to_watch_for || '')}</div>` : ''}
        </li>
    `).join('')}</ul>`;
}

function renderSuggestionItems(items, emptyText = 'Brak sugestii.') {
    if (!items || !items.length) {
        return `<p class="detail-muted">${escapeHtml(emptyText)}</p>`;
    }
    return `<ul class="detail-list">${items.map(item => `
        <li>
            <strong>${escapeHtml((item || {}).suggestion_type === 'split' ? 'Sugestia rozdzielenia' : 'Sugestia połączenia')}</strong>
            <div>${escapeHtml((item || {}).reason_pl || '')}</div>
        </li>
    `).join('')}</ul>`;
}

function renderMailboxFactItems(items, emptyText = 'Brak zapisanych faktów.') {
    if (!items || !items.length) {
        return `<p class="detail-muted">${escapeHtml(emptyText)}</p>`;
    }
    return `<ul class="detail-list">${items.map(item => `
        <li>
            <strong>${escapeHtml(humanizeCode((item || {}).fact_key || (item || {}).entity_scope, 'Fakt'))}</strong>
            <div>${escapeHtml((item || {}).value || (item || {}).normalized_value || '')}</div>
            ${((item || {}).source_ref) ? `<div class="detail-muted">Źródło: ${escapeHtml((item || {}).source_ref || '')}</div>` : ''}
        </li>
    `).join('')}</ul>`;
}

function renderMailboxDocumentItems(items, emptyText = 'Brak ostatnich dokumentów.') {
    if (!items || !items.length) {
        return `<p class="detail-muted">${escapeHtml(emptyText)}</p>`;
    }
    return `<ul class="detail-list">${items.map(item => {
        const dk = String((item || {}).document_kind || '').trim().toLowerCase();
        const kindLabel = dk === 'generic' || !dk ? 'Ogólny' : humanizeCode(dk, dk);
        return `
        <li>
            <strong>${escapeHtml((item || {}).file_name || 'Dokument')}</strong>
            <div>${escapeHtml((item || {}).summary_text || '')}</div>
            <div class="detail-muted">
                ${escapeHtml(kindLabel)}
                ${((item || {}).updated_at) ? ` | ${escapeHtml(formatDate((item || {}).updated_at || ''))}` : ''}
            </div>
        </li>
    `;
    }).join('')}</ul>`;
}

function renderMailboxConflictItems(items, emptyText = 'Brak konfliktów danych w tej części pamięci.') {
    if (!items || !items.length) {
        return `<p class="detail-muted">${escapeHtml(emptyText)}</p>`;
    }
    return `<ul class="detail-list">${items.map(item => `
        <li>
            <strong>${escapeHtml(humanizeCode((item || {}).fact_key, 'Konflikt'))}</strong>
            <div>${escapeHtml(((item || {}).values || []).join(' | '))}</div>
        </li>
    `).join('')}</ul>`;
}

function renderMailboxSourceRefs(items, emptyText = 'Brak jawnych odniesień do źródeł.') {
    if (!items || !items.length) {
        return `<p class="detail-muted">${escapeHtml(emptyText)}</p>`;
    }
    return `<ul class="detail-list">${items.map(item => {
        const type = (item || {}).type || 'ref';
        const typeLabel = mailboxSourceTypeLabel(type);
        const detail = (item || {}).file_name || (item || {}).source_ref || (item || {}).document_id || (item || {}).event_type || (item || {}).id || '';
        return `
        <li>
            <strong>${escapeHtml(typeLabel)}</strong>
            <div>${escapeHtml(detail)}</div>
        </li>
    `;
    }).join('')}</ul>`;
}

function renderMailboxMemorySection(noteOrCase) {
    const snapshot = (noteOrCase && typeof noteOrCase.case_snapshot === 'object' && noteOrCase.case_snapshot) || {};
    const keyFacts = (noteOrCase.key_facts && noteOrCase.key_facts.length ? noteOrCase.key_facts : snapshot.key_facts) || [];
    const latestDocuments = (noteOrCase.latest_documents && noteOrCase.latest_documents.length ? noteOrCase.latest_documents : snapshot.latest_documents) || [];
    const conflictingFacts = (noteOrCase.conflicting_facts && noteOrCase.conflicting_facts.length ? noteOrCase.conflicting_facts : snapshot.conflicting_facts) || [];
    const sourceRefs = noteOrCase.source_refs || [];
    const openQuestions = snapshot.open_questions || [];
    const customer = (snapshot && typeof snapshot.customer === 'object' && snapshot.customer) || {};
    const headerBits = [];

    if (snapshot.status) {
        headerBits.push(`Status migawki: ${snapshot.status}`);
    }
    if (customer.name) {
        headerBits.push(`Klient: ${customer.name}`);
    }
    if (snapshot.recommended_next_action) {
        headerBits.push(`Wskazówka kolejnego kroku (read-only z migawki, nie decyzja formalna): ${snapshot.recommended_next_action}`);
    }

    const hasDetailsBody = keyFacts.length || latestDocuments.length || conflictingFacts.length || sourceRefs.length
        || (openQuestions.length > 2);

    if (!headerBits.length && !snapshot.recommended_next_action_reason && !openQuestions.length && !hasDetailsBody) {
        return '';
    }

    const reasonLine = snapshot.recommended_next_action_reason
        ? `<p class="detail-muted">${escapeHtml(snapshot.recommended_next_action_reason)}</p>`
        : '';
    const questionsCompact = openQuestions.length
        ? `<p class="detail-muted">Otwarte pytania: ${escapeHtml(openQuestions.slice(0, 2).join('; '))}${openQuestions.length > 2 ? '…' : ''}</p>`
        : '';

    const detailsBlock = hasDetailsBody ? `
        <details class="detail-tech">
            <summary class="detail-muted">Szczegóły pamięci</summary>
            <div class="detail-tech-body">
                ${openQuestions.length > 2 ? `<p class="detail-muted">Wszystkie pytania: ${escapeHtml(openQuestions.join('; '))}</p>` : ''}
                <p><strong>Kluczowe fakty</strong></p>
                ${renderMailboxFactItems(keyFacts)}
                <p><strong>Ostatnie dokumenty</strong></p>
                ${renderMailboxDocumentItems(latestDocuments)}
                <p><strong>Konflikty danych (pamięć)</strong></p>
                ${renderMailboxConflictItems(conflictingFacts)}
                <p><strong>Źródła pamięci</strong></p>
                ${renderMailboxSourceRefs(sourceRefs)}
                ${renderTechnicalDetails('Surowa migawka (JSON)', snapshot)}
            </div>
        </details>
    ` : '';

    return `
        <section class="detail-section detail-section-intelligence">
            <h3>Pamięć sprawy</h3>
            ${headerBits.length ? `<p>${escapeHtml(headerBits.join(' · '))}</p>` : ''}
            ${reasonLine}
            ${openQuestions.length <= 2 ? questionsCompact : ''}
            ${detailsBlock}
        </section>
    `;
}

function renderOperationalTimeline(items) {
    if (!items || !items.length) {
        return '<p class="detail-muted">Brak wpisów w dzienniku operacyjnym (zapis pojawi się po kolejnych zdarzeniach systemu).</p>';
    }
    return `<ol class="detail-timeline">${items.map(ev => {
        const row = ev || {};
        const when = row.occurred_at || row.at || '';
        const label = row.event_type_label || row.event_type || row.kind || row.tool_name || '';
        return `
        <li>
            <div class="timeline-meta">${escapeHtml(when)} · ${escapeHtml(label)}</div>
            <div>${escapeHtml(row.summary_pl || '')}</div>
        </li>`;
    }).join('')}</ol>`;
}

function renderEngagementActionsPlaceholder(caseItem, payload) {
    const row = caseItem || {};
    const actions = Array.isArray(row.engagement_actions)
        ? row.engagement_actions
        : (Array.isArray(payload && payload.engagement_actions) ? payload.engagement_actions : []);
    if (!actions.length) {
        return '';
    }
    const cards = actions.map((a) => {
        const item = a || {};
        const enabled = item.enabled !== false;
        const label = String(item.payload_pl || item.id || 'Akcja').trim();
        const reason = String(item.disabled_reason_pl || '').trim();
        return `<li class="engagement-action-card ${enabled ? '' : 'is-disabled'}">
            <span class="engagement-action-label">${escapeHtml(label)}</span>
            ${enabled ? '<span class="detail-muted">(placeholder — wykonanie policy-gated)</span>' : `<span class="detail-muted">${escapeHtml(reason || 'Niedostępne')}</span>`}
        </li>`;
    }).join('');
    return `
        <section class="detail-section detail-section-actions detail-section-engagement-actions">
            <h3>Sugerowane akcje (agent)</h3>
            <p class="detail-muted">Podgląd kontraktu actions[] — bez autonomicznego wykonania.</p>
            <ul class="engagement-actions-list">${cards}</ul>
        </section>`;
}

function renderHitlOperatorActions(caseItem, payload) {
    const row = caseItem || {};
    const hitlPending = Boolean(
        row.hitl_pending
        || row.hitl_required
        || (payload && payload.hitl_pending)
        || (payload && payload.hitl_gate && payload.hitl_gate.required)
    );
    if (!hitlPending) {
        return '';
    }
    const engagementId = String(row.engagement_id || (payload && payload.engagement_id) || '').trim();
    const caseId = String(row.case_id || (payload && payload.case_id) || '').trim();
    const actionId = String(row.hitl_action_id || (payload && payload.hitl_action_id) || 'draft_reply').trim();
    const draft = String(row.draft_reply_pl || (payload && payload.draft_reply_pl) || '').trim();
    const hasDraft = draft.length > 0;
    const asks = Array.isArray(row.operator_questions_pl)
        ? row.operator_questions_pl
        : (Array.isArray(payload && payload.operator_questions_pl) ? payload.operator_questions_pl : []);
    const draftBlock = hasDraft
        ? `<label class="ds-draft-label" for="ds-hitl-draft">Treść odpowiedzi (możesz edytować przed wysłaniem)</label>
           <textarea id="ds-hitl-draft" class="ds-draft" data-hitl-draft rows="8">${escapeHtml(draft)}</textarea>`
        : `<p class="detail-muted">Brak gotowego draftu — decyzja należy do Ciebie. Asystent zebrał kontekst sprawy.</p>
           ${asks.length ? `<ul class="ds-ask">${asks.map(q => `<li>${escapeHtml(String(q))}</li>`).join('')}</ul>` : ''}`;
    // Oś: odpowiedź do klienta. "Wyślij" = realna odpowiedź (primary). "Zatwierdź bez wysyłki" = akceptacja planu agenta.
    const primaryAction = '';
    return `
        <section class="detail-section detail-section-actions detail-section-reply">
            <h3>Odpowiedź do klienta</h3>
            <p class="detail-muted">Nic nie wychodzi bez Twojego kliknięcia. Przejrzyj, popraw i wyślij.</p>
            ${draftBlock}
            <div class="hitl-actions">
                ${primaryAction}
                <button type="button" class="btn btn-ghost btn-small" data-hitl-approve="${escapeHtml(engagementId)}" data-hitl-case="${escapeHtml(caseId)}" data-hitl-action="${escapeHtml(actionId)}" data-tooltip="Zatwierdz plan agenta bez wysylki maila">Zatwierdz bez wysylki</button>
            </div>
        </section>`;
}

renderHitlOperatorActions = function(caseItem, payload, options = {}) {
    const row = caseItem || {};
    const opts = options || {};
    const hitlPending = Boolean(
        row.hitl_pending
        || row.hitl_required
        || (payload && payload.hitl_pending)
        || (payload && payload.hitl_gate && payload.hitl_gate.required)
    );
    if (!hitlPending) {
        return '';
    }
    const engagementId = String(row.engagement_id || (payload && payload.engagement_id) || '').trim();
    if (!engagementId) {
        return '';
    }
    const caseId = String(row.case_id || (payload && payload.case_id) || '').trim();
    const noteId = String(row.note_id || '').trim();
    const actionId = String(row.hitl_action_id || (payload && payload.hitl_action_id) || 'draft_reply').trim();
    const draft = String(row.draft_reply_pl || (payload && payload.draft_reply_pl) || '').trim();
    const hasDraft = draft.length > 0;
    const approveOnly = opts.approveOnly === true;
    const hitlRequest = state.hitlAction || {};
    const requestPending = Boolean(
        hitlRequest.engagementId === engagementId && (hitlRequest.pending || hitlRequest.awaitingSync)
    );
    const approvePending = requestPending && hitlRequest.kind === 'approve';
    const sendPending = requestPending && hitlRequest.kind === 'send';
    const asks = Array.isArray(row.operator_questions_pl)
        ? row.operator_questions_pl
        : (Array.isArray(payload && payload.operator_questions_pl) ? payload.operator_questions_pl : []);
    const draftBlock = hasDraft
        ? `<label class="ds-draft-label" for="ds-hitl-draft">Tresc odpowiedzi (mozesz edytowac przed wysylka)</label>
           <textarea id="ds-hitl-draft" class="ds-draft" data-hitl-draft rows="8" ${requestPending ? 'disabled' : ''}>${escapeHtml(draft)}</textarea>`
        : `<p class="detail-muted">Brak gotowego draftu - decyzja nalezy do Ciebie. Asystent zebral kontekst sprawy.</p>
           ${asks.length ? `<ul class="ds-ask">${asks.map(q => `<li>${escapeHtml(String(q))}</li>`).join('')}</ul>` : ''}`;
    const primaryAction = '';
    const approveLabel = approvePending ? 'Zatwierdzam...' : 'Zatwierdz do recznej wysylki';
    const sectionTitle = approveOnly ? 'Decyzja operatora' : 'Szkic odpowiedzi dla operatora';
    const sectionLead = approveOnly
        ? 'Zatwierdzenie zapisze decyzje HITL w Node B bez wysylki maila.'
        : 'Node B nie wysyla wiadomosci. Przejrzyj tekst, popraw go i zatwierdz do recznej wysylki poza systemem.';
    return `
        <section class="detail-section detail-section-actions detail-section-reply">
            <h3>${sectionTitle}</h3>
            <p class="detail-muted">${sectionLead}</p>
            ${draftBlock}
            <div class="hitl-actions">
                ${primaryAction}
                <button type="button" class="btn btn-ghost btn-small" data-hitl-approve="${escapeHtml(engagementId)}" data-hitl-case="${escapeHtml(caseId)}" data-hitl-note="${escapeHtml(noteId)}" data-hitl-action="${escapeHtml(actionId)}" data-tooltip="Zatwierdz plan agenta bez wysylki maila" ${requestPending ? 'disabled' : ''}>${approveLabel}</button>
            </div>
        </section>`;
};

function renderAgentTurnsSection(turns) {
    if (!Array.isArray(turns) || !turns.length) {
        return '';
    }
    const operatorLines = turns
        .map(t => String((t || {}).turn_summary_pl || '').trim())
        .filter(Boolean);
    const technical = turns.map(t => {
        const row = t || {};
        const tool = String(row.tool_name || 'narzędzie').trim();
        const tokens = Number(row.tokens_used || 0);
        const meta = tokens > 0 ? ` · ${tokens} tok` : '';
        const status = String(row.tool_status || '').trim();
        return `<li><div class="timeline-meta">${escapeHtml(tool)}${escapeHtml(meta)}</div><div>${escapeHtml(status)}</div></li>`;
    }).join('');
    const summaryBlock = operatorLines.length
        ? `<ul class="ds-agent-summary">${operatorLines.map(l => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`
        : '<p class="detail-muted">Asystent nie dodał notatek operatorskich.</p>';
    return `
        <section class="detail-section detail-section-intelligence">
            <h3>Co ustalił asystent</h3>
            ${summaryBlock}
            <details class="ds-tech">
                <summary>Szczegóły techniczne (kroki agenta)</summary>
                <ol class="detail-timeline">${technical}</ol>
            </details>
        </section>`;
}

function renderAutomationPolicy(policy) {
    const p = policy || {};
    const blocks = (p.blocked_automation_reasons || []).join(', ');
    const lines = [];
    lines.push(`Projekcja biurka (bez review): ${p.allow_automated_desk_projection ? 'tak' : 'nie'}`);
    lines.push(`Push zadań v1: ${p.allow_automated_v1_task_push ? 'tak' : 'nie'}`);
    lines.push(`Odpowiedź do klienta (auto): ${p.allow_automated_client_reply ? 'tak' : 'nie'}`);
    lines.push(`Kontakt z dostawcą (auto): ${p.allow_automated_supplier_touch ? 'tak' : 'nie'}`);
    if (blocks) {
        lines.push(`Powody blokady: ${blocks}`);
    }
    return lines.map(l => `<p>${escapeHtml(l)}</p>`).join('');
}

function renderMissingInfoDetail(noteOrCase) {
    const checklist = noteOrCase.operator_checklist_pl || [];
    const summary = noteOrCase.missing_info_summary_pl || '';
    if (!summary && !checklist.length) {
        return '<p class="detail-muted">W tej projekcji nie ma opisanych braków informacji na checklistie.</p>';
    }
    return `
        ${summary ? `<p>${escapeHtml(summary)}</p>` : ''}
        ${checklist.length ? renderStringList(checklist, 'Brak checklisty.') : ''}
    `;
}

function canCurrentUserDecideActionProposals() {
    return ['konrad', 'darek'].includes(String(state.currentUser || '').trim());
}

function renderActionProposalCard(item) {
    const it = item || {};
    const title = String(it.title || it.summary || humanizeCode(it.action_type, 'Propozycja')).trim();
    const doText = String(it.recommended_operator_action || it.primary_next_action_title_pl || '').trim();
    const why = String(it.reason || it.primary_next_action_reason_pl || '').trim();
    const evid = formatEvidenceRefsSummary(it.evidence_refs);
    const risk = polishRiskLevel(it.risk_level || it.risk_class);
    const approval = it.requires_approval ? 'Tak' : 'Nie';
    const policy = polishPolicyStatus(it.policy_status);
    const status = polishProposalStatus(it.status);
    const statusRaw = String(it.status || 'proposed').trim();
    const decisionId = String(it.proposal_id || it.id || '').trim();
    const canDecide = statusRaw === 'proposed' && decisionId && canCurrentUserDecideActionProposals();
    const lines = [];
    lines.push('<p class="guidance-compact"><span class="guidance-badge">Propozycja</span></p>');
    lines.push(`<p><strong>${escapeHtml(title)}</strong></p>`);
    if (doText) {
        lines.push(`<p><span class="detail-muted">Co zrobić:</span> ${escapeHtml(doText)}</p>`);
    }
    if (why) {
        lines.push(`<p><span class="detail-muted">Dlaczego:</span> ${escapeHtml(why)}</p>`);
    }
    if (evid) {
        lines.push(`<p><span class="detail-muted">Dowody:</span> ${escapeHtml(evid)}</p>`);
    } else {
        lines.push('<p class="detail-muted">Dowody: brak jawnego odwołania do dowodu w tej projekcji.</p>');
    }
    const metaBits = [
        `Ryzyko: ${risk}`,
        `Wymaga akceptacji: ${approval}`,
        `Status polityki: ${policy || '—'}`,
        `Status: ${status}`,
    ];
    lines.push(`<p class="detail-muted">${escapeHtml(metaBits.join(' · '))}</p>`);
    lines.push(renderTechnicalDetails('Dane techniczne propozycji (JSON)', it));
    if (canDecide) {
        lines.push(`
                    <div class="feedback-grid">
                        <button type="button" class="btn btn-primary btn-small" data-action-proposal-approve="${escapeHtml(decisionId)}">Akceptuj</button>
                        <button type="button" class="btn btn-secondary btn-small" data-action-proposal-reject="${escapeHtml(decisionId)}">Odrzuć</button>
                    </div>
                `);
    } else if (statusRaw === 'proposed' && decisionId) {
        lines.push('<p class="detail-muted">Akceptację lub odrzucenie zapisuje tylko owner. Ta rekomendacja nie wykonuje się automatycznie.</p>');
    }
    return `<li>${lines.join('')}</li>`;
}

function renderActionProposalsSection(caseItem, payload) {
    const st = proposalSectionState(caseItem, payload);
    if (st !== 'present') {
        return sectionStateMessage(
            st,
            'Ta projekcja nie zawiera jeszcze sekcji propozycji działań.',
            'Brak propozycji działań w dostarczonych danych.',
        );
    }
    const proposals = collectActionProposalsForUi(caseItem, payload);
    return `<ul class="detail-list">${proposals.map(renderActionProposalCard).join('')}</ul>`;
}

function renderOperatorHistoryInner(executionResults) {
    const results = Array.isArray(executionResults) ? executionResults : [];
    if (!results.length) {
        return '';
    }
    return results.map(item => `
        <li>
            <strong>${escapeHtml(humanizeCode(item.action_type, 'Działanie'))}</strong>
            <span class="detail-muted">${escapeHtml(polishExecutionStatus(item.execution_status) || '—')}</span>
        </li>
    `).join('');
}

function renderOperatorHistorySection(caseItem, payload) {
    const st = executionHistorySectionState(caseItem, payload);
    if (st !== 'present') {
        return sectionStateMessage(
            st,
            'Ta projekcja nie zawiera jeszcze sekcji historii decyzji operatora.',
            'Brak zapisanej historii decyzji w dostarczonych danych.',
        );
    }
    const p = payload && typeof payload === 'object' ? payload : {};
    const c = caseItem && typeof caseItem === 'object' ? caseItem : {};
    const list = (p.execution_results || c.execution_results || []);
    return `<ul class="detail-list">${renderOperatorHistoryInner(list)}</ul>`;
}

function gapSummaryText(raw) {
    if (typeof raw === 'string') {
        return raw.trim();
    }
    if (raw && typeof raw === 'object') {
        return String(raw.ask_pl || raw.summary || raw.summary_pl || raw.text || '').trim();
    }
    return '';
}

function renderEvidenceCardsInner(list) {
    const cards = Array.isArray(list) ? list : [];
    return `<ul class="detail-list">${cards.map(card => {
        const c = card || {};
        const title = c.summary || c.evidence_id || 'Dowód';
        const quote = String(c.quote || c.snippet || c.excerpt || '').trim();
        const stype = mailboxSourceTypeLabel(c.source_type || '');
        const ts = c.timestamp || c.occurred_at || '';
        const conf = c.confidence != null && String(c.confidence).trim() !== ''
            ? `Pewność: ${String(c.confidence)}`
            : '';
        const meta = [stype, c.source_id ? `ID: ${c.source_id}` : '', ts ? formatDate(ts) : '', conf].filter(Boolean).join(' · ');
        return `
        <li>
            <strong>${escapeHtml(title)}</strong>
            ${quote ? `<div>${escapeHtml(quote)}</div>` : ''}
            <div class="detail-muted">${escapeHtml(meta || 'Typ źródła nieokreślony')}</div>
        </li>`;
    }).join('')}</ul>`;
}

function renderGapItem(g) {
    if (typeof g === 'string') {
        return `<li>${escapeHtml(g.trim())}</li>`;
    }
    const o = g && typeof g === 'object' ? g : {};
    const sum = gapSummaryText(o) || 'Brak opisu';
    const sev = o.severity ? polishGapSeverity(o.severity) : '';
    const st = o.status ? polishGapStatus(o.status) : '';
    const sugg = String(o.suggested_next_action || '').trim();
    const ev = formatEvidenceRefsSummary(o.evidence_refs);
    const meta = [];
    if (sev) {
        meta.push(`Nasilenie: ${sev}`);
    }
    if (st) {
        meta.push(`Stan: ${st}`);
    }
    if (sugg) {
        meta.push(`Sugerowany krok: ${sugg}`);
    }
    if (o.blocking === true) {
        meta.push('Blokuje dalszy przebieg: tak');
    }
    meta.push(ev ? `Dowody: ${ev}` : 'Dowody: brak jawnego odwołania w tej projekcji');
    return `
        <li>
            <strong>${escapeHtml(sum)}</strong>
            <div class="detail-muted">${escapeHtml(meta.join(' · '))}</div>
        </li>`;
}

function renderGapsInner(gaps) {
    const list = Array.isArray(gaps) ? gaps : [];
    return `<ul class="detail-list">${list.map(renderGapItem).join('')}</ul>`;
}

function renderConflictItem(c) {
    const o = c && typeof c === 'object' ? c : {};
    const sum = String(o.summary || humanizeCode(o.fact_key, 'Sprzeczność')).trim();
    const vals = (o.values || []).join(' · ');
    const sev = o.severity ? polishGapSeverity(o.severity) : '';
    const st = o.status ? polishGapStatus(o.status) : '';
    const ev = formatEvidenceRefsSummary(o.evidence_refs);
    const dec = String(o.operator_decision || o.decision || '').trim();
    const meta = [];
    if (vals) {
        meta.push(`Wartości: ${vals}`);
    }
    if (sev) {
        meta.push(`Nasilenie: ${sev}`);
    }
    if (st) {
        meta.push(`Stan: ${st}`);
    }
    meta.push(ev ? `Dowody: ${ev}` : 'Dowody: brak jawnego odwołania w tej projekcji');
    if (dec) {
        meta.push(`Decyzja operatora: ${dec}`);
    }
    return `
        <li>
            <strong>${escapeHtml(sum)}</strong>
            <div class="detail-muted">${escapeHtml(meta.join(' · '))}</div>
        </li>`;
}

function renderConflictsInner(items) {
    const list = Array.isArray(items) ? items : [];
    return `<ul class="detail-list">${list.map(renderConflictItem).join('')}</ul>`;
}

function renderGraphHintsInner(hints) {
    const list = Array.isArray(hints) ? hints : [];
    return `<ul class="detail-list">${list.map(h => `<li>${escapeHtml(h.related_title || h.target_title || h.relation_type || 'Powiązanie')}</li>`).join('')}</ul>`;
}

function renderDownstreamSignalCard(sig) {
    const s = sig || {};
    const category = downstreamSignalCategoryLabel(s);
    const sum = String(s.summary || '').trim();
    const act = String(s.recommended_operator_action || '').trim();
    const risk = polishRiskLevel(s.risk_level);
    const approval = s.requires_approval ? 'Tak' : 'Nie';
    const policy = polishPolicyStatus(s.policy_status);
    const status = polishProposalStatus(s.status);
    const evid = formatEvidenceRefsSummary(s.evidence_refs);
    const lines = [];
    lines.push(`<p class="guidance-compact"><span class="guidance-badge">${escapeHtml(category)}</span></p>`);
    if (sum) {
        lines.push(`<p><strong>${escapeHtml(sum)}</strong></p>`);
    }
    if (act) {
        lines.push(`<p><span class="detail-muted">Co zrobić:</span> ${escapeHtml(act)}</p>`);
    }
    const metaBits = [
        `Ryzyko: ${risk}`,
        `Wymaga akceptacji: ${approval}`,
        policy ? `Status polityki: ${policy}` : '',
        status ? `Status: ${status}` : '',
        evid ? `Dowody: ${evid}` : 'Dowody: brak jawnego odwołania w tej projekcji',
    ].filter(Boolean);
    lines.push(`<p class="detail-muted">${escapeHtml(metaBits.join(' · '))}</p>`);
    lines.push(renderTechnicalDetails('Dane techniczne sygnału (JSON)', s));
    return `<li>${lines.join('')}</li>`;
}

function renderDownstreamSignalListHtml(signals) {
    const list = (Array.isArray(signals) ? signals : []).filter(s => s && typeof s === 'object');
    if (!list.length) {
        return '';
    }
    return `<ul class="detail-list">${list.map(renderDownstreamSignalCard).join('')}</ul>`;
}

function renderDownstreamSignalSection(title, signals, st, missingMsg, emptyMsg, extraBoundaryHtml = '') {
    const boundary = '<p class="detail-muted">To jest rekomendacja dla operatora. System nie wykonuje tej akcji automatycznie.</p>';
    const extra = extraBoundaryHtml ? extraBoundaryHtml : '';
    const list = Array.isArray(signals) ? signals : [];
    let bodyHtml;
    let preview;
    if (st !== 'present') {
        preview = st === 'missing' ? projectionSectionMissingPreview() : 'Brak wpisów';
        bodyHtml = boundary + extra + sectionStateMessage(st, missingMsg, emptyMsg);
    } else if (!list.length) {
        preview = 'Brak wpisów';
        bodyHtml = boundary + extra + `<p class="detail-muted">${escapeHtml(emptyMsg)}</p>`;
    } else {
        preview = `${list.length} ${list.length === 1 ? 'sygnał' : 'sygnałów'}`;
        bodyHtml = boundary + extra + renderDownstreamSignalListHtml(signals);
    }
    return renderCollapsibleDetailBlock(title, preview, bodyHtml);
}

/**
 * Read-only vNext strip from operational feed (no recompute, no raw mail body).
 * Fields: context_pack_version, has_blocking_*, badges.* counts, top_conflicts, top_gaps.
 */
function renderVNextFeedBadgeStrip(caseItem) {
    const c = caseItem && typeof caseItem === 'object' ? caseItem : {};
    const ver = String(c.context_pack_version || '').trim();
    const badges = c.badges && typeof c.badges === 'object' ? c.badges : {};
    const gapN = typeof badges.gaps === 'number' ? badges.gaps : (Array.isArray(c.completeness_gaps) ? c.completeness_gaps.length : 0);
    const confN = typeof badges.conflicts === 'number' ? badges.conflicts : (Array.isArray(c.conflicting_facts) ? c.conflicting_facts.length : 0);
    const blockC = Boolean(c.has_blocking_conflicts);
    const blockG = Boolean(c.has_blocking_gaps);
    const topsC = Array.isArray(c.top_conflicts) ? c.top_conflicts : [];
    const topsG = Array.isArray(c.top_gaps) ? c.top_gaps : [];

    const hasVnext = Boolean(ver || blockC || blockG || topsC.length || topsG.length);
    if (!hasVnext) {
        return '';
    }

    const parts = [];
    if (ver) {
        parts.push(`<span class="record-badge">${escapeHtml(`Kontekst: ${ver}`)}</span>`);
    }
    if (blockC) {
        parts.push('<span class="record-badge record-badge-risk">Blokujące sprzeczności</span>');
    }
    if (blockG) {
        parts.push('<span class="record-badge record-badge-risk">Blokujące braki</span>');
    }
    if (confN > 0) {
        parts.push(`<span class="record-badge record-badge-risk">Konflikty: ${escapeHtml(String(confN))}</span>`);
    }
    if (gapN > 0) {
        parts.push(`<span class="record-badge record-badge-gap">Braki: ${escapeHtml(String(gapN))}</span>`);
    }

    const mini = [];
    topsC.slice(0, 3).forEach((row) => {
        if (row && typeof row === 'object') {
            const s = String(row.summary || row.type || '').trim().slice(0, 200);
            if (s) {
                mini.push(`<li class="detail-muted">${escapeHtml(s)}</li>`);
            }
        }
    });
    topsG.slice(0, 3).forEach((row) => {
        if (row && typeof row === 'object') {
            const s = String(row.summary || row.type || '').trim().slice(0, 200);
            if (s) {
                mini.push(`<li class="detail-muted">${escapeHtml(s)}</li>`);
            }
        }
    });

    const strip = parts.length ? `<div class="record-badges vnext-feed-badges">${parts.join('')}</div>` : '';
    const list = mini.length ? `<ul class="detail-list vnext-top-signals">${mini.join('')}</ul>` : '';
    return `<div class="vnext-context-micro"><p class="detail-muted">Wersja kontekstu (read-only z feedu Node B — bez przeliczania w UI).</p>${strip}${list}</div>`;
}

function renderCieploEngagementBlock(engagementBundle) {
    const bundle = engagementBundle && typeof engagementBundle === 'object' ? engagementBundle : null;
    if (!bundle) {
        return '<div class="vnext-context-micro"><p class="detail-muted">Powiązane zlecenie Cieplo: brak wpisu w rejestrze korelacji (P0).</p></div>';
    }
    const links = Array.isArray(bundle.links) ? bundle.links : [];
    const workflowLink = links.find(l => l && l.link_type === 'cieplo_workflow');
    const workflowId = workflowLink ? String(workflowLink.target_id || '') : '';
    if (!workflowId) {
        return '<div class="vnext-context-micro"><p class="detail-muted">Ten sam klient może mieć zlecenie Cieplo — jeszcze nie powiązane automatycznie.</p></div>';
    }
    return `<div class="vnext-context-micro"><p><strong>Zlecenie Cieplo</strong> <span class="record-badge">${escapeHtml(workflowId)}</span></p><p class="detail-muted">Zaangażowanie: ${escapeHtml(String(bundle.engagement_id || ''))}</p></div>`;
}

function resolveEngagementIdFromCaseDetail(detail) {
    if (!detail || detail.type !== 'case') {
        return '';
    }
    const engRoot = detail.engagement;
    if (engRoot && typeof engRoot === 'object') {
        const fromRoot = String(engRoot.engagement_id || '').trim();
        if (fromRoot) {
            return fromRoot;
        }
        const nested = engRoot.engagement;
        if (nested && typeof nested === 'object') {
            const fromNested = String(nested.engagement_id || '').trim();
            if (fromNested) {
                return fromNested;
            }
        }
    }
    const payload = detail.payload && typeof detail.payload === 'object' ? detail.payload : {};
    const caseItem = payload.case && typeof payload.case === 'object' ? payload.case : {};
    return String(caseItem.engagement_id || payload.engagement_id || '').trim();
}

async function loadOsEventsForEngagement(engagementId) {
    const eid = String(engagementId || '').trim();
    if (!eid) {
        return { ok: false, items: [], loadError: null, engagement_id: '' };
    }
    try {
        const data = await apiFetch(V3_API_BASE, `/engagements/${encodeURIComponent(eid)}/os-events`);
        const items = data && Array.isArray(data.items) ? data.items : [];
        return {
            ok: !!(data && data.ok !== false),
            items,
            loadError: null,
            engagement_id: eid,
        };
    } catch (err) {
        return {
            ok: false,
            items: [],
            loadError: String(err.message || err),
            engagement_id: eid,
        };
    }
}

async function refreshCaseDetailOsEvents() {
    if (!state.detail || state.detail.type !== 'case') {
        return;
    }
    let eid = resolveEngagementIdFromCaseDetail(state.detail);
    const payload = state.detail.payload && typeof state.detail.payload === 'object' ? state.detail.payload : {};
    const caseItem = payload.case && typeof payload.case === 'object' ? payload.case : {};
    const caseId = String(caseItem.case_id || '').trim();
    if (!eid && caseId) {
        try {
            const eng = await apiFetch(V3_API_BASE, `/cases/${encodeURIComponent(caseId)}/engagement`);
            if (eng && typeof eng.engagement === 'object') {
                state.detail.engagement = eng.engagement;
                eid = resolveEngagementIdFromCaseDetail(state.detail);
            }
        } catch (_engErr) {
            // engagement lookup optional
        }
    }
    if (!eid) {
        state.detail.osEvents = { ok: false, items: [], loadError: null, engagement_id: '', loading: false };
        renderDetailPanel();
        return;
    }
    state.detail.osEvents = { ok: false, items: [], loadError: null, engagement_id: eid, loading: true };
    renderDetailPanel();
    const loaded = await loadOsEventsForEngagement(eid);
    if (!state.detail || state.detail.type !== 'case') {
        return;
    }
    state.detail.osEvents = { ...loaded, loading: false };
    renderDetailPanel();
}

function renderOsEventsSection(osEventsBundle) {
    const bundle = osEventsBundle && typeof osEventsBundle === 'object' ? osEventsBundle : null;
    if (!bundle) {
        return '';
    }
    if (bundle.loading) {
        return `
            <section class="detail-section detail-section-os-events">
                <h3>Oś systemu</h3>
                <p class="detail-muted" role="status">Wczytywanie zdarzeń systemowych…</p>
            </section>`;
    }
    if (bundle.loadError) {
        return `
            <section class="detail-section detail-section-os-events">
                <h3>Oś systemu</h3>
                <p class="error-inline" role="alert">${escapeHtml(bundle.loadError)}</p>
                <p class="detail-muted">Read-only projekcja z Node B — nie magazyn prawdy.</p>
            </section>`;
    }
    const items = Array.isArray(bundle.items) ? bundle.items : [];
    if (!items.length) {
        return `
            <section class="detail-section detail-section-os-events">
                <h3>Oś systemu</h3>
                <p class="detail-muted">Brak zdarzeń systemowych dla tego zaangażowania.</p>
                <p class="detail-muted">Read-only projekcja z Node B — nie magazyn prawdy.</p>
            </section>`;
    }
    const rows = items.map((ev) => {
        const summary = String(ev.summary_pl || ev.event_type || 'Zdarzenie').trim();
        const repo = String(ev.source_repo || '').trim();
        const when = formatDate(ev.occurred_at || '');
        const status = String((ev.payload && ev.payload.status) || ev.status || 'ok').trim();
        const statusClass = status === 'error' ? 'is-error' : (status === 'warning' ? 'is-warning' : 'is-ok');
        const eventId = String(ev.event_id || '').trim();
        return `<li class="os-event-row ${statusClass} os-event-item" data-os-event-id="${escapeHtml(eventId)}" tabindex="0" role="button" aria-label="Kliknij po szczególy">
            <div class="os-event-head">
                <time datetime="${escapeHtml(String(ev.occurred_at || ''))}">${escapeHtml(when)}</time>
                ${repo ? `<span class="record-badge os-event-repo">${escapeHtml(repo)}</span>` : ''}
            </div>
            <p class="os-event-summary">${escapeHtml(summary)}</p>
        </li>`;
    }).join('');
    return `
        <section class="detail-section detail-section-os-events">
            <h3>Oś systemu</h3>
            <p class="detail-muted">Read-only timeline zdarzeń cross-repo (Node B). Nie zastępuje dziennika sprawy.</p>
            <ul class="os-event-list">${rows}</ul>
        </section>`;
}

function renderCaseProjectionExtras(caseItem, payload) {
    const c = caseItem && typeof caseItem === 'object' ? caseItem : {};
    const p = payload && typeof payload === 'object' ? payload : {};

    const evSt = sectionState(c, 'evidence_cards');
    const evidence = c.evidence_cards || [];
    const evPreview = evSt === 'missing' ? projectionSectionMissingPreview() : evSt !== 'present' ? 'Brak wpisów' : (evidence.length ? `${evidence.length} ${evidence.length === 1 ? 'dowód' : 'dowodów'}` : 'Brak dowodów');
    const evBody = evSt !== 'present'
        ? sectionStateMessage(evSt, 'Ta projekcja nie zawiera jeszcze sekcji dowodów.', 'Brak dowodów w dostarczonych danych.')
        : renderEvidenceCardsInner(evidence);

    const gapsSt = sectionState(c, 'completeness_gaps');
    const gaps = c.completeness_gaps || [];
    const gapsPreview = gapsSt === 'missing' ? projectionSectionMissingPreview() : gapsSt !== 'present' ? 'Brak wpisów' : (gaps.length ? `${gaps.length} ${gaps.length === 1 ? 'brak' : 'braków'}` : 'Brak braków');
    const gapsBody = gapsSt !== 'present'
        ? sectionStateMessage(gapsSt, 'Ta projekcja nie zawiera jeszcze sekcji braków danych.', 'Brak widocznych braków danych w dostarczonej liście.')
        : renderGapsInner(gaps);

    const cfSt = conflictsSectionState(c);
    const conflicts = c.operator_visible_conflicts || c.conflicting_facts || [];
    const cfPreview = cfSt === 'missing' ? projectionSectionMissingPreview() : cfSt !== 'present' ? 'Brak wpisów' : (conflicts.length ? `${conflicts.length} ${conflicts.length === 1 ? 'sprzeczność' : 'sprzeczności'}` : 'Brak sprzeczności');
    const cfBody = cfSt !== 'present'
        ? sectionStateMessage(cfSt, 'Ta projekcja nie zawiera jeszcze sekcji sprzeczności.', 'Brak zidentyfikowanych sprzeczności w dostarczonych danych.')
        : renderConflictsInner(conflicts);

    const ghSt = sectionState(c, 'graph_hints');
    const hints = c.graph_hints || [];
    const ghPreview = ghSt === 'missing' ? projectionSectionMissingPreview() : ghSt !== 'present' ? 'Brak wpisów' : (hints.length ? `${hints.length} ${hints.length === 1 ? 'powiązanie' : 'powiązań'}` : 'Brak wskazówek');
    const ghBody = ghSt !== 'present'
        ? sectionStateMessage(ghSt, 'Ta projekcja nie zawiera jeszcze sekcji powiązań.', 'Brak wskazówek powiązań w dostarczonych danych.')
        : renderGraphHintsInner(hints);

    const apSt = proposalSectionState(c, p);
    const apList = collectActionProposalsForUi(c, p);
    const apPreview = apSt === 'missing' ? projectionSectionMissingPreview() : apSt === 'empty' ? 'Brak propozycji' : `${apList.length} ${apList.length === 1 ? 'propozycja' : 'propozycji'}`;
    const apBody = renderActionProposalsSection(c, p);

    const histSt = executionHistorySectionState(c, p);
    const histPayloadList = (p.execution_results || c.execution_results || []);
    const histPreview = histSt === 'missing' ? projectionSectionMissingPreview() : histSt === 'empty' ? 'Brak historii' : `${Array.isArray(histPayloadList) ? histPayloadList.length : 0} wpisów`;
    const histBody = renderOperatorHistorySection(c, p);

    const svcSt = sectionState(c, 'service_signals');
    const mktSt = sectionState(c, 'marketing_signals');

    return `
            ${renderCollapsibleDetailBlockIfPresent('Dowody', evSt, evPreview, evBody)}
            ${renderCollapsibleDetailBlockIfPresent('Braki danych', gapsSt, gapsPreview, gapsBody)}
            ${renderCollapsibleDetailBlockIfPresent('Sprzeczności', cfSt, cfPreview, cfBody)}
            ${renderCollapsibleDetailBlockIfPresent('Wskazówki powiązań', ghSt, ghPreview, ghBody)}
            ${renderCollapsibleDetailBlockIfPresent('Propozycje działań', apSt, apPreview, apBody)}
            ${svcSt === 'present' ? renderDownstreamSignalSection('Sygnały serwisowe', c.service_signals || [], svcSt, '', '', '') : ''}
            ${mktSt === 'present' ? renderDownstreamSignalSection('Sygnały marketingowe', c.marketing_signals || [], mktSt, '', '', '<p class="detail-muted">Sygnał marketingowy wymaga decyzji operatora i sprawdzenia zgody przed publikacją.</p>') : ''}
            ${renderCollapsibleDetailBlockIfPresent('Historia decyzji operatora', histSt, histPreview, histBody)}
    `;
}

function renderCalendarBlock(calendar = {}) {
    const events = calendar.events || [];
    const riskCode = calendar.calendar_risk || 'no_calendar_action_needed';
    return `
        <p><strong>Ryzyko kalendarza:</strong> ${escapeHtml(calendarRiskLabelPl(riskCode))}</p>
        ${events.length ? `<ul class="detail-list">${events.map(ev => `<li><strong>${escapeHtml(ev.summary || 'Wydarzenie')}</strong><span>${formatDate(ev.start_at)} - ${escapeHtml(ev.location || '')}</span></li>`).join('')}</ul>` : '<p class="detail-muted">Brak powiązanych wydarzeń.</p>'}
    `;
}

function renderDocumentIntelligenceBlock(block = {}) {
    const docs = block.important_documents || [];
    const conflicts = block.document_conflicts || [];
    if (!docs.length && !conflicts.length) {
        return '<p class="detail-muted">Brak wyników Document Intelligence.</p>';
    }
    return `
        ${docs.length ? `<ul class="detail-list">${docs.map(doc => {
        const dtype = String(doc.document_type || '').trim().toLowerCase();
        const typeLabel = dtype === 'unknown' || !dtype ? 'nieznany typ' : humanizeCode(dtype, dtype);
        return `<li><strong>${escapeHtml(doc.filename || doc.document_id || 'dokument')}</strong><span>${escapeHtml(typeLabel)} / ${Math.round(Number(doc.document_type_confidence || 0) * 100)}%</span>${(doc.extracted_fields || []).slice(0, 4).map(field => `<p class="detail-muted">${escapeHtml(field.field_name)}: ${escapeHtml(field.field_value)}</p>`).join('')}</li>`;
    }).join('')}</ul>` : ''}
        ${conflicts.length ? `<p class="detail-muted">Konflikty: ${escapeHtml(conflicts.map(c => c.field_name || c.conflict_type).join(', '))}</p>` : ''}
    `;
}

function renderDecisionViewSection(dv) {
    // decision_pipeline_v2 + source_spine: read-only Case OS projection from Node B feed/case detail.
    if (!dv || typeof dv !== 'object') {
        return '';
    }
    const renderDecisionViewKv = (items) => items
        .filter(([, value]) => value !== undefined && value !== null && String(value).trim())
        .map(([label, value]) => `<span class="pill">${escapeHtml(label)}: ${escapeHtml(String(value))}</span>`)
        .join(' ');
    const renderDecisionViewCards = (title, cards, mapper) => {
        const rows = Array.isArray(cards) ? cards.slice(0, 6).filter(Boolean) : [];
        if (!rows.length) {
            return '';
        }
        return `<div class="decision-view-cardset"><strong>${escapeHtml(title)}</strong><ul class="detail-list">${rows.map(mapper).join('')}</ul></div>`;
    };
    const cop = dv.collapsed_operator_pl && typeof dv.collapsed_operator_pl === 'object' ? dv.collapsed_operator_pl : null;
    const headline = escapeHtml(
        String(dv.headline_co_pl || '').trim()
        || String(cop && cop.essence_pl ? cop.essence_pl : '').trim()
        || String(dv.decision_summary && dv.decision_summary.essence_pl ? dv.decision_summary.essence_pl : '').trim(),
    );
    const ribbonSituation = cop && String(cop.situation_vs_decision_hint_pl || '').trim()
        ? escapeHtml(String(cop.situation_vs_decision_hint_pl).trim()) : '';
    const ribbonExpand = cop && String(cop.expand_hint_pl || '').trim()
        ? escapeHtml(String(cop.expand_hint_pl).trim()) : '';
    const collapseDetails = !!(cop && cop.details_collapsed_by_default === true);

    const change = escapeHtml(dv.change_summary_pl || dv.what_changed_since_pl || '');
    const missing = escapeHtml(dv.missing_summary_pl || '');
    const risk = escapeHtml(dv.risk_summary_pl || '');
    const proposal = escapeHtml(dv.proposal_summary_pl || '');
    const why = escapeHtml(dv.why_pl || '');
    const policy = escapeHtml(dv.policy_status_pl || '');
    const pb = escapeHtml(dv.playbook_instruction_pl || '');
    const prim = dv.primary_button || {};
    const sec = Array.isArray(dv.secondary_buttons) ? dv.secondary_buttons : [];
    const decision = dv.decision && typeof dv.decision === 'object' ? dv.decision : {};
    const policyBlock = dv.policy && typeof dv.policy === 'object' ? dv.policy : {};
    const decisionPills = renderDecisionViewKv([
        ['topic', decision.topic],
        ['typ', decision.case_type],
        ['priorytet', decision.priority],
        ['SLA', decision.sla_risk],
        ['tryb (DecisionCandidate)', decision.recommended_mode],
    ]);
    const policyPills = renderDecisionViewKv([
        ['status', policyBlock.status || policy],
        ['risk', policyBlock.risk_class],
        ['dry-run', policyBlock.dry_run_only ? 'tak' : ''],
        ['approval', policyBlock.requires_human_approval ? 'wymagany' : ''],
    ]);
    const failedRules = Array.isArray(policyBlock.failed_rules) ? policyBlock.failed_rules.filter(Boolean).slice(0, 5) : [];
    const warnings = Array.isArray(policyBlock.warnings) ? policyBlock.warnings.filter(Boolean).slice(0, 5) : [];
    const mapActionProposalRow = (a) => {
        const aObj = a && typeof a === 'object' ? a : {};
        const typeLine = escapeHtml(String(
            aObj.action_type_label_pl
            || (aObj.action_type ? humanizeCode(aObj.action_type, aObj.action_type) : '')
            || aObj.proposal_id
            || 'propozycja',
        ));
        const statusSpan = escapeHtml([aObj.status, aObj.action_mode, aObj.blocked_reason].filter(Boolean).join(' / '));
        let policyMuted = '';
        if (aObj.allowed_by_policy === false) {
            const blocked = aObj.reason_if_blocked_pl
                ? escapeHtml(String(aObj.reason_if_blocked_pl))
                : 'Tylko podgląd — brak zgody policy dla tej propozycji w tej projekcji.';
            policyMuted = `<p class="detail-muted">${blocked}</p>`;
        }
        const sum = aObj.summary_pl ? `<p class="detail-muted">${escapeHtml(aObj.summary_pl)}</p>` : '';
        return `<li><strong>${typeLine}</strong><span>${statusSpan}</span>${sum}${policyMuted}</li>`;
    };
    const actionCards = renderDecisionViewCards('Propozycje działań v2 (read-only)', dv.action_proposals, mapActionProposalRow);
    const evidenceCards = renderDecisionViewCards('Evidence', dv.evidence_cards, (e) => `<li><strong>${escapeHtml(e.title_pl || 'evidence')}</strong><span>${escapeHtml([e.content_pl, e.source_id].filter(Boolean).join(' / '))}</span></li>`);
    const missingCards = renderDecisionViewCards('Missing Info', dv.missing_info_cards, (m) => `<li><strong>${escapeHtml(m.title_pl || 'brak')}</strong><span>${escapeHtml(m.content_pl || '')}</span></li>`);
    const riskCards = renderDecisionViewCards('Conflicts / Risks', dv.risk_cards, (r) => `<li><strong>${escapeHtml(r.title_pl || 'ryzyko')}</strong><span>${escapeHtml(r.content_pl || '')}</span></li>`);
    const primId = escapeHtml(String(prim.id || 'review'));
    const primLab = escapeHtml(String(prim.label_pl || 'Przejrzyj'));
    let buttons = `<button type="button" class="btn btn-primary btn-small" data-decision-view-action="${primId}">${primLab}</button>`;
    sec.slice(0, 3).forEach(b => {
        if (!b || !b.id) {
            return;
        }
        buttons += ` <button type="button" class="btn btn-ghost btn-small" data-decision-view-action="${escapeHtml(String(b.id))}">${escapeHtml(String(b.label_pl || b.id))}</button>`;
    });
    const dcId = escapeHtml(String(dv.decision_candidate_id || '—'));
    const pdId = escapeHtml(String(dv.policy_decision_id || '—'));
    const apList = Array.isArray(dv.action_proposals) ? dv.action_proposals.filter(Boolean) : [];
    const hasInnerText = !!(change || missing || risk || proposal || why || policy || pb || (dv.decision_candidate_id || '').trim());
    const hasCards = !!(apList.length
        || (Array.isArray(dv.evidence_cards) && dv.evidence_cards.length)
        || (Array.isArray(dv.missing_info_cards) && dv.missing_info_cards.length)
        || (Array.isArray(dv.risk_cards) && dv.risk_cards.length));
    const hasBody = !!(headline || ribbonSituation || ribbonExpand || hasInnerText || hasCards);
    if (!hasBody) {
        return '';
    }
    const detailPreviewParts = [];
    if (cop && cop.topic) {
        detailPreviewParts.push(String(cop.topic));
    }
    if (cop && cop.priority) {
        detailPreviewParts.push(`priorytet: ${cop.priority}`);
    }
    if (apList.length) {
        detailPreviewParts.push(`${apList.length}× v2`);
    }
    const detailPreview = detailPreviewParts.length ? detailPreviewParts.join(' · ') : 'Szczegóły projekcji';

    const detailsInner = `
                ${change ? `<p><strong>Co się zmieniło:</strong> ${change}</p>` : ''}
                ${missing ? `<p><strong>Czego brakuje:</strong> ${missing}</p>` : ''}
                ${risk ? `<p><strong>Ryzyko:</strong> ${risk}</p>` : ''}
                ${proposal ? `<p><strong>Propozycje (read-only, z Node B):</strong> ${proposal}</p>` : ''}
                ${why ? `<p><strong>Dlaczego:</strong> ${why}</p>` : ''}
                ${policy ? `<p><strong>Status policy (z projekcji):</strong> ${policy}</p>` : ''}
                ${pb ? `<p><strong>Instrukcja playbook:</strong> ${pb}</p>` : ''}
                <p class="detail-muted">DecisionCandidate: <code>${dcId}</code> · PolicyDecision: <code>${pdId}</code></p>
                ${decisionPills ? `<p class="detail-muted">${decisionPills}</p>` : ''}
                ${policyPills ? `<p><strong>Policy (payload):</strong> ${policyPills}</p>` : ''}
                ${failedRules.length ? `<p><strong>Failed rules:</strong> ${escapeHtml(failedRules.join(', '))}</p>` : ''}
                ${warnings.length ? `<p><strong>Warnings:</strong> ${escapeHtml(warnings.join(', '))}</p>` : ''}
                ${actionCards}
                ${evidenceCards}
                ${missingCards}
                ${riskCards}`;
    const detailsBlock = collapseDetails
        ? renderCollapsibleDetailBlock('Szczegóły projekcji decyzyjnej', detailPreview, detailsInner, { open: false })
        : detailsInner;

    return `
            <section class="detail-section detail-section-intelligence decision-view-mvp">
                <h3>Blok decyzyjny (projekcja Node B)</h3>
                <p class="detail-muted">Read-only — zapis decyzji odbywa się przez istniejące ścieżki operatora / kartki / bridge (nie ten panel).</p>
                ${ribbonSituation ? `<p class="detail-muted decision-view-ribbon">${ribbonSituation}</p>` : ''}
                ${ribbonExpand ? `<p class="detail-muted decision-view-ribbon">${ribbonExpand}</p>` : ''}
                ${headline ? `<p><strong>Co to za sprawa:</strong> ${headline}</p>` : ''}
                ${detailsBlock}
                <div class="decision-view-actions">${buttons}</div>
            </section>`;
}

function renderSkrzatItems(items, emptyText) {
    const rows = Array.isArray(items) ? items.filter(Boolean).slice(0, 6) : [];
    if (!rows.length) {
        return `<p class="detail-muted">${escapeHtml(emptyText)}</p>`;
    }
    return `<ul class="detail-list">${rows.map(item => {
        const obj = item && typeof item === 'object' ? item : {};
        const title = String(obj.title || obj.fact_key || obj.gap_key || obj.conflict_key || obj.move_key || obj.source_id || item || 'pozycja');
        const body = String(obj.summary || obj.description || obj.value || obj.reason || obj.warning || obj.source_type || '');
        const meta = [obj.source_id, obj.evidence_ref, obj.status, obj.severity].filter(Boolean).join(' / ');
        return `<li><strong>${escapeHtml(title)}</strong>${body ? `<span>${escapeHtml(body)}</span>` : ''}${meta ? `<p class="detail-muted">${escapeHtml(meta)}</p>` : ''}</li>`;
    }).join('')}</ul>`;
}

function renderSkrzatPanel(caseItem, payload) {
    const caseId = String(caseItem.case_id || payload.case_id || '').trim();
    if (!caseId) {
        return '';
    }
    const answer = state.skrzat.answers[caseId] || null;
    const loading = state.skrzat.loadingCaseId === caseId;
    const error = state.skrzat.errors[caseId] || '';
    const evidence = answer && Array.isArray(answer.evidence) ? answer.evidence : [];
    const gaps = answer && Array.isArray(answer.gaps) ? answer.gaps : [];
    const conflicts = answer && Array.isArray(answer.conflicts) ? answer.conflicts : [];
    const warnings = answer && Array.isArray(answer.warnings) ? answer.warnings : [];
    const moves = answer && Array.isArray(answer.candidate_moves) ? answer.candidate_moves : [];
    const schema = answer && answer.schema_version ? String(answer.schema_version) : 'conversation_answer_envelope.v1';
    const audit = answer && answer.context_audit && typeof answer.context_audit === 'object' ? answer.context_audit : null;
    const metrics = answer && answer.quality_metrics && typeof answer.quality_metrics === 'object' ? answer.quality_metrics : null;
    const auditSummary = audit
        ? `${String(audit.stage_name || 'skrzat_copilot')} · ${String(audit.answer_mode || '?')} · ${String(audit.parse_status || '?')}`
        : '';
    const coverage = metrics && metrics.skrzat_evidence_coverage_rate != null
        ? String(metrics.skrzat_evidence_coverage_rate)
        : '';
    return `
        <section class="detail-section detail-section-intelligence skrzat-panel">
            <h3>Zapytaj asystenta (podgląd)</h3>
            <p class="detail-muted">Odpowiedź z pamięci sprawy (Node B). Ten panel nie wysyła maili ani nie wykonuje akcji w Twoim imieniu.</p>
            <form data-skrzat-form="${escapeHtml(caseId)}">
                <div class="form-row">
                    <label for="skrzat-question-${escapeHtml(caseId)}">Pytanie o sprawę</label>
                    <textarea id="skrzat-question-${escapeHtml(caseId)}" name="question" rows="3" placeholder="Zapytaj o braki, konflikty, dowody albo następny bezpieczny ruch" ${loading ? 'disabled' : ''}></textarea>
                </div>
                <div class="form-row">
                    <label for="skrzat-mode-${escapeHtml(caseId)}">Tryb</label>
                    <select id="skrzat-mode-${escapeHtml(caseId)}" name="mode" ${loading ? 'disabled' : ''}>
                        <option value="ask">Ask</option>
                        <option value="investigate">Investigate</option>
                        <option value="case_copilot">Case Copilot</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary btn-small" data-skrzat-ask="${escapeHtml(caseId)}" ${loading ? 'disabled' : ''}>
                    ${loading ? 'Pytam…' : 'Zapytaj Skrzata'}
                </button>
            </form>
            ${error ? `<p class="error-inline" role="alert">${escapeHtml(error)}</p>` : ''}
            ${answer ? `
                <div class="detail-tech-body">
                    <p class="detail-muted">${escapeHtml(schema)} · read_only=${answer.read_only === true ? 'true' : 'false'} · action_allowed=${answer.action_allowed === true ? 'true' : 'false'}</p>
                    <p><strong>Odpowiedź:</strong> ${escapeHtml(answer.answer_text || 'Brak odpowiedzi.')}</p>
                    <details class="detail-tech detail-collapsible" open>
                        <summary>Dowody, braki i konflikty</summary>
                        <div class="detail-tech-body">
                            <h4>Dowody</h4>
                            ${renderSkrzatItems(evidence, 'Brak jawnych dowodów w odpowiedzi.')}
                            <h4>Braki</h4>
                            ${renderSkrzatItems(gaps, 'Brak zgłoszonych braków.')}
                            <h4>Konflikty</h4>
                            ${renderSkrzatItems(conflicts, 'Brak zgłoszonych konfliktów.')}
                            <h4>Ostrzeżenia</h4>
                            ${renderSkrzatItems(warnings, 'Brak ostrzeżeń.')}
                            <h4>Możliwe ruchy</h4>
                            ${renderSkrzatItems(moves, 'Brak sugerowanych ruchów.')}
                        </div>
                    </details>
                    ${audit ? `
                    <details class="ds-tech-tier-2 detail-tech">
                        <summary class="ds-tech-tier-summary"><span class="ds-tech-plus" aria-hidden="true">+</span> Kontekst LLM (audit)</summary>
                        <div class="ds-tech-tier-body ds-tech-tier-body--scroll">
                            <p class="detail-muted">${escapeHtml(auditSummary)}${coverage ? ` · coverage=${escapeHtml(coverage)}` : ''}</p>
                            <pre class="detail-pre">${escapeHtml(JSON.stringify(audit, null, 2))}</pre>
                        </div>
                    </details>
                    ` : ''}
                </div>
            ` : '<p class="detail-muted">Zadaj pytanie, żeby zobaczyć odpowiedź z dowodami, brakami i konfliktami.</p>'}
        </section>
    `;
}

async function askSkrzat(caseId, form) {
    const cid = String(caseId || '').trim();
    if (!cid) {
        return;
    }
    const formData = new FormData(form);
    const question = String(formData.get('question') || '').trim();
    const mode = String(formData.get('mode') || 'ask').trim() || 'ask';
    if (!question) {
        state.skrzat.errors[cid] = 'Wpisz pytanie do Skrzata.';
        renderDetailPanel();
        return;
    }
    state.skrzat.loadingCaseId = cid;
    state.skrzat.errors[cid] = '';
    renderDetailPanel();
    try {
        const body = await apiFetch(V3_API_BASE, `/cases/${encodeURIComponent(cid)}/skrzat/ask`, {
            method: 'POST',
            body: JSON.stringify({ question, mode, query_text: question }),
        });
        if (!body || body.schema_version !== 'conversation_answer_envelope.v1') {
            throw new Error('Nieprawidłowy envelope odpowiedzi Skrzata.');
        }
        state.skrzat.answers[cid] = body;
        showToast('Skrzat odpowiedział.');
    } catch (error) {
        state.skrzat.errors[cid] = error && error.message ? error.message : 'Nie udało się zapytać Skrzata.';
    } finally {
        state.skrzat.loadingCaseId = '';
        renderDetailPanel();
    }
}

function renderDetailPanel() {
    const panel = document.getElementById('detail-panel');
    if (!state.detail) {
        setDetailPanelChromeOpen(false);
        panel.innerHTML = `
            <div class="detail-empty">
                <h2>Panel szczegółów</h2>
                <p>Otwórz kartkę, sprawę albo przebieg kohorty, aby zobaczyć źródła, payload read-only i historię zmian.</p>
            </div>
        `;
        return;
    }

    setDetailPanelChromeOpen(true);

    if (state.detail.type === 'detail_loading') {
        const dm = state.detail.mode;
        const kind = dm === 'note' ? 'kartki' : 'sprawy';
        panel.innerHTML = `
            <div class="detail-shell detail-shell--loading">
                <div class="detail-header">
                    <div>
                        <p class="eyebrow">Wczytywanie</p>
                        <h2 tabindex="-1" data-detail-focus-root>Wczytywanie ${kind}…</h2>
                    </div>
                    <button type="button" class="btn btn-ghost btn-small" data-close-detail="1" aria-label="Zamknij panel szczegółów">Zamknij</button>
                </div>
                <div class="detail-skeleton" role="progressbar" aria-busy="true" aria-label="Trwa wczytywanie szczegółów">
                    <div class="detail-skeleton-line"></div>
                    <div class="detail-skeleton-line detail-skeleton-line--short"></div>
                    <div class="detail-skeleton-line"></div>
                </div>
            </div>
        `;
        scheduleDetailPanelFocus();
        return;
    }

    // Custom HTML detail (used by OS Event detail, tooltip-rich content)
    if (state.detail._customHtml) {
        setDetailPanelChromeOpen(true);
        panel.innerHTML = state.detail._customHtml;
        scheduleDetailPanelFocus();
        return;
    }

    if (state.detail.type === 'detail_error') {
        const dm = state.detail.mode;
        const rid = String(state.detail.id || '').trim();
        const msg = String(state.detail.message || 'Wystąpił błąd.');
        const st = Number(state.detail.httpStatus || 0);
        const isNote404 = dm === 'note' && st === 404;
        panel.innerHTML = `
            <div class="detail-shell detail-shell--error">
                <div class="detail-header">
                    <div>
                        <p class="eyebrow">Błąd wczytania</p>
                        <h2 tabindex="-1" data-detail-focus-root>${dm === 'note' ? 'Nie udało się wczytać kartki' : 'Nie udało się wczytać sprawy'}</h2>
                    </div>
                    <button type="button" class="btn btn-ghost btn-small" data-close-detail="1" aria-label="Zamknij panel szczegółów">Zamknij</button>
                </div>
                <p class="error-inline" role="alert">${escapeHtml(msg)}</p>
                <div class="detail-error-actions">
                    <button type="button" class="btn btn-primary btn-small" data-retry-detail="${escapeHtml(dm)}" data-retry-id="${escapeHtml(rid)}">Spróbuj ponownie</button>
                    ${isNote404 ? '<button type="button" class="btn btn-secondary btn-small" data-refresh-operational-feed="1">Odśwież dane</button>' : ''}
                </div>
            </div>
        `;
        scheduleDetailPanelFocus();
        return;
    }

    if (state.detail.type === 'cohort_run') {
        const pack = state.detail.payload || {};
        const runId = String(pack.run_id || '').trim();
        const loading = !!pack.loading;
        const err = String(pack.error || '').trim();
        const run = pack.run && typeof pack.run === 'object' ? pack.run : null;
        const jsonPreview = run
            ? escapeHtml(JSON.stringify(run, null, 2).slice(0, 24000))
            : '';
        panel.innerHTML = `
            <div class="detail-shell">
                <div class="detail-header">
                    <div>
                        <p class="eyebrow">Kohorta (read-only)</p>
                        <h2>${escapeHtml(runId || 'Przebieg kohorty')}</h2>
                    </div>
                    <button type="button" class="btn btn-ghost btn-small" data-close-detail="1" aria-label="Zamknij panel szczegółów">Zamknij</button>
                </div>
                <p class="detail-muted feed-detail-banner">Projekcja bounded cohort zapisana na Node A — panel nie wykonuje akcji ani nie zmienia pamięci skrzynki.</p>
                ${loading ? '<p class="detail-muted" role="status">Ładowanie szczegółów…</p>' : ''}
                ${err ? `<p class="error-inline" role="alert">${escapeHtml(err)}</p>` : ''}
                ${!loading && run ? `
                    <section class="detail-section">
                        <h3>Podsumowanie</h3>
                        <p><strong>Wersja schematu:</strong> ${escapeHtml(String(run.schema_version || '—'))}</p>
                        <p><strong>Zapisano:</strong> ${escapeHtml(formatDate(run.generated_at || run.projected_at))}</p>
                    </section>
                    <details class="detail-tech detail-collapsible">
                        <summary>Pełny JSON przebiegu (ograniczony podgląd)</summary>
                        <pre class="detail-pre" tabindex="0">${jsonPreview}</pre>
                    </details>
                ` : ''}
            </div>
        `;
        return;
    }

    if (state.detail.type === 'note') {
        const payload = state.detail.payload;
        const note = payload.note || {};
        const caseItem = payload.case || null;
        const whySee = String(payload.why_you_see_it || note.why_on_desk || '').trim();
        const noteTech = buildDetailTechBundle({
            feedBanner: state.detail.source === 'operational_feed'
                ? '<p class="detail-muted">Podgląd kartki z ostatniego zrzutu danych AI.</p>'
                : '<p class="detail-muted">Odczyt z magazynu kartek.</p>',
            caseItem: note,
            payload,
            signals: payload.signals || [],
            traces: payload.decision_traces || [],
        });
        panel.innerHTML = `
            <div class="detail-shell">
                <div class="detail-header">
                    <div>
                        <p class="eyebrow">Kartka</p>
                        <h2 tabindex="-1" data-detail-focus-root>${escapeHtml(note.title || 'Kartka AI')}</h2>
                    </div>
                    <button type="button" class="btn btn-ghost btn-small" data-close-detail="1" aria-label="Zamknij panel szczegółów">Zamknij</button>
                </div>

                ${renderDetailMailHeader(note)}

                ${renderOperatorHero(note)}

                ${renderCaseAttachmentsSection(note)}

                ${renderHitlOperatorActions(note, payload, { approveOnly: true })}

                ${renderNoteFeedbackBlock(note)}

                ${renderGuidanceSection(note)}

                ${whySee ? `
                <section class="detail-section">
                    <h3>Dlaczego to widzę</h3>
                    <p>${escapeHtml(whySee)}</p>
                    <div class="detail-muted">${escapeHtml(daszekLabel(note.presence_mode))} • ${escapeHtml(daszekLifecycle(note.lifecycle_state))}</div>
                </section>` : ''}

                ${renderDetailSectionIfContent('Brakujące informacje', renderMissingInfoDetail(note))}
                ${note.risk_summary_pl || (note.risks || []).length ? renderDetailSectionIfContent('Ryzyka', `${note.risk_summary_pl ? `<p>${escapeHtml(note.risk_summary_pl)}</p>` : ''}${renderRiskSummary(note.risks || [])}`) : ''}
                ${note.attachment_summary_pl ? `
                <section class="detail-section detail-section-intelligence">
                    <h3>Załączniki</h3>
                    <p>${escapeHtml(note.attachment_summary_pl)}</p>
                </section>` : ''}
                ${note.thread_summary_pl ? `
                <section class="detail-section detail-section-intelligence">
                    <h3>Pamięć rozmowy</h3>
                    <p>${escapeHtml(note.thread_summary_pl)}</p>
                </section>` : ''}

                <section class="detail-section">
                    <h3>Powiązana sprawa</h3>
                    ${caseItem ? `<button type="button" class="link-button" data-open-case="${escapeHtml(caseItem.case_id)}">${escapeHtml(caseItem.title || 'Otwórz sprawę')}</button>` : '<p class="detail-muted">Kartka nie jest jeszcze powiązana ze sprawą.</p>'}
                </section>

                ${renderOsEventsSection(state.detail.osEvents)}

                ${noteTech}
            </div>
        `;
        scheduleDetailPanelFocus();
        return;
    }

    const payload = state.detail.payload;
    const caseItem = payload.case || {};
    const feedbackNote = (Array.isArray(payload.desk_notes) ? payload.desk_notes : []).find(n => canSendFeedback(n)) || null;
    const stateLabel = caseItem.current_state_label || caseStateLabel(caseItem.current_state);
    const showState = stateLabel && !/^bez stanu$/i.test(String(stateLabel).trim());
    const caseTech = buildDetailTechBundle({
        feedBanner: state.detail.source === 'operational_feed'
            ? '<p class="detail-muted">Podgląd sprawy z ostatniego zrzutu danych AI.</p>'
            : '<p class="detail-muted">Odczyt z magazynu spraw.</p>',
        decisionView: payload.decision_view || {},
        caseItem,
        payload,
        signals: payload.signals || [],
        traces: payload.decision_traces || [],
        skrzatCaseId: String(caseItem.case_id || '').trim(),
    });
    const calendarHtml = renderCalendarBlock(caseItem.calendar || {});
    const docHtml = renderDocumentIntelligenceBlock(caseItem.document_intelligence || {});
    const timeline = payload.operational_timeline || [];
    panel.innerHTML = `
        <div class="detail-shell">
            <div class="detail-header">
                <div>
                    <p class="eyebrow">Sprawa</p>
                    <h2 tabindex="-1" data-detail-focus-root>${escapeHtml(caseItem.title || 'Sprawa operacyjna')}</h2>
                </div>
                <div class="detail-header-actions">
                    ${caseItem.case_id ? (isCaseArchived(caseItem.case_id)
            ? `<button type="button" class="btn btn-secondary btn-small" data-unarchive-case="${escapeHtml(caseItem.case_id)}">Przywróć z archiwum</button>`
            : `<button type="button" class="btn btn-ghost btn-small" data-archive-case="${escapeHtml(caseItem.case_id)}" data-tooltip="Ukryj sprawe z aktywnej listy">Archiwizuj</button>`) : '<span class="detail-muted" data-tooltip="Brak powiazanej sprawy w magazynie">Archiwizacja niedostepna</span>'}
                    <button type="button" class="btn btn-ghost btn-small" data-close-detail="1" aria-label="Zamknij panel szczegółów">Zamknij</button>
                </div>
            </div>

            ${renderDetailMailHeader(caseItem)}

            ${renderOperatorHero(caseItem)}

            ${renderHitlOperatorActions(caseItem, payload)}

            ${renderEngagementActionsPlaceholder(caseItem, payload)}

            ${renderOsEventsSection(state.detail.osEvents)}

            ${renderCaseAttachmentsSection(caseItem)}

            ${renderAboutCaseSection(caseItem)}

            ${renderWhyOnDeskSection(caseItem)}

            ${renderWhatChangedSection(caseItem)}

            ${feedbackNote ? renderNoteFeedbackBlock(feedbackNote) : ''}

            ${renderGuidanceSection(caseItem)}

            ${showState ? `
            <section class="detail-section">
                <h3>Bieżący stan</h3>
                <p>${escapeHtml(stateLabel)}</p>
            </section>` : ''}

            ${renderMailboxMemorySection(caseItem)}

            ${renderDetailSectionIfContent('Checklista braków', renderMissingInfoDetail(caseItem))}
            ${caseItem.risk_summary_pl || (caseItem.risks || []).length ? renderDetailSectionIfContent('Ryzyka', `${caseItem.risk_summary_pl ? `<p>${escapeHtml(caseItem.risk_summary_pl)}</p>` : ''}${renderRiskSummary(caseItem.risks || [])}`) : ''}
            ${(caseItem.blockers || []).length ? renderDetailSectionIfContent('Blokery', renderStringList(caseItem.blockers || [], '')) : ''}
            ${(caseItem.merge_candidates || []).length || (caseItem.split_suspicions || []).length
            ? renderDetailSectionIfContent('Połączenia i podziały', renderSuggestionItems([...(caseItem.merge_candidates || []), ...(caseItem.split_suspicions || [])], ''))
            : ''}

            ${renderCaseProjectionExtras(caseItem, payload)}

            ${calendarHtml.includes('Brak powiązanych') ? '' : `
            <section class="detail-section detail-section-intelligence">
                <h3>Terminy</h3>
                ${calendarHtml}
            </section>`}

            ${docHtml.includes('Brak wyników') ? '' : `
            <section class="detail-section detail-section-intelligence">
                <h3>Dokumenty</h3>
                ${docHtml}
            </section>`}

            ${renderAgentTurnsSection(payload.agent_turns)}

            ${timeline.length ? `
            <section class="detail-section detail-section-intelligence">
                <h3>Dziennik operacyjny</h3>
                ${renderOperationalTimeline(timeline)}
            </section>` : ''}

            ${(payload.desk_notes || []).length ? `
            <section class="detail-section">
                <h3>Kartki na biurku</h3>
                <div class="detail-note-list">${(payload.desk_notes || []).map(note => renderOperationalNoteRecord({
                note_id: note.note_id,
                case_id: note.case_id,
                title: note.title,
                summary: note.summary,
                operator_essence_pl: note.operator_essence_pl,
                why_on_desk: note.why_on_desk,
                recommended_next_step: note.recommended_next_step,
                primary_next_action_title_pl: note.primary_next_action_title_pl,
                presence_mode: note.presence_mode,
                case_title: caseItem.title,
                updated_at: note.updated_at,
                latest_signal_at: note.latest_signal_at,
                source_signal_ids: note.source_signal_ids,
                feedback_eligible: note.feedback_eligible,
                v2_desk_note_id: note.v2_desk_note_id,
            }, { showDone: false, compact: true })).join('')}</div>
            </section>` : ''}

            ${caseTech}
        </div>
    `;
    scheduleDetailPanelFocus();
}

function daszekLabel(mode) {
    return {
        silent: 'Cicho',
        subtle: 'Dyskretnie',
        standard: 'Standardowo',
        advisory: 'Doradczo',
        strong: 'Stanowczo',
        alarm: 'Alarmowo',
    }[mode] || 'Standardowo';
}

function daszekLifecycle(stateValue) {
    return {
        active: 'Aktywna',
        suppressed: 'Wyciszona',
        resolved: 'Załatwiona',
        archived: 'Archiwalna',
    }[stateValue] || 'Aktywna';
}

async function sendFeedback(noteId, action, extra = {}) {
    const resolvedId = String(noteId || '').trim();
    if (!resolvedId.startsWith('note_')) {
        showError('Ta kartka nie ma jeszcze zapisu w magazynie — odśwież dane i spróbuj ponownie.');
        return;
    }
    try {
        await apiFetch(V2_API_BASE, `/desk-notes/${resolvedId}/feedback`, {
            method: 'POST',
            body: JSON.stringify({ action, ...extra }),
        });
        showToast('Ocena została zapisana.');
        await loadAllData();
        if (state.detail && state.detail.type === 'note' && state.detail.payload.note?.note_id === noteId) {
            await openNoteDetail(noteId);
        }
    } catch (error) {
        showError(error.message);
    }
}

async function submitHitlAgentAction(trigger, kind) {
    const engagementId = String(trigger.dataset.hitlApprove || trigger.dataset.hitlSend || '').trim();
    const caseId = String(trigger.dataset.hitlCase || '').trim();
    const actionId = String(trigger.dataset.hitlAction || 'draft_reply').trim();
    if (!engagementId) {
        showError('Brak engagement_id — odśwież szczegóły sprawy.');
        return;
    }
    if (kind === 'send') {
        showError('Node B ma Gmail read-only. Zatwierdz szkic do recznej wysylki zamiast uruchamiac send.');
        return;
    }
    const draftEl = document.querySelector('[data-hitl-draft]');
    const draftText = draftEl ? String(draftEl.value || '').trim() : '';
    if (kind === 'send' && !draftText) {
        showError('Brak treści draftu do wysłania — najpierw wygeneruj lub uzupełnij draft.');
        return;
    }
    const endpoint = '/agent-hitl/approve';
    try {
        await apiFetch(V2_API_BASE, endpoint, {
            method: 'POST',
            body: JSON.stringify({
                engagement_id: engagementId,
                case_id: caseId,
                action_id: actionId,
                operator_id: state.currentUser || 'operator',
                draft_pl: draftText,
            }),
        });
        showToast(kind === 'send' ? 'Wysyłka zapisana w kolejce bridge.' : 'HITL zatwierdzone — odświeżam widok.');
        await loadAllData();
        if (caseId) {
            await openCaseDetail(caseId);
        }
    } catch (error) {
        showError(error.message || 'Nie udało się zapisać decyzji HITL (sprawdź bridge / MCP).');
    }
}

submitHitlAgentAction = async function(trigger, kind) {
    const engagementId = String(trigger.dataset.hitlApprove || trigger.dataset.hitlSend || '').trim();
    const caseId = String(trigger.dataset.hitlCase || '').trim();
    const noteId = String(
        trigger.dataset.hitlNote
        || (state.detail && state.detail.type === 'note' && state.detail.payload && state.detail.payload.note && state.detail.payload.note.note_id)
        || (engagementId ? `desk-${engagementId}` : '')
    ).trim();
    const actionId = String(trigger.dataset.hitlAction || 'draft_reply').trim();
    if (!engagementId) {
        showError('Brak engagement_id - odswiez szczegoly kartki.');
        return;
    }
    if (
        state.hitlAction
        && state.hitlAction.engagementId === engagementId
        && state.hitlAction.kind === kind
        && (state.hitlAction.pending || state.hitlAction.awaitingSync)
    ) {
        return;
    }
    if (kind === 'send') {
        showError('Node B ma Gmail read-only. Zatwierdz szkic do recznej wysylki zamiast uruchamiac send.');
        return;
    }
    const draftEl = document.querySelector('[data-hitl-draft]');
    const draftText = draftEl ? String(draftEl.value || '').trim() : '';
    if (kind === 'send' && !draftText) {
        showError('Brak tresci draftu do wyslania - najpierw wygeneruj lub uzupelnij draft.');
        return;
    }
    const endpoint = '/agent-hitl/approve';
    state.hitlAction = {
        pending: true,
        awaitingSync: false,
        engagementId,
        kind,
        noteId,
        decisionKey: '',
        status: 'sending',
    };
    renderDetailPanel();
    try {
        const response = await apiFetch(V2_API_BASE, endpoint, {
            method: 'POST',
            body: JSON.stringify({
                engagement_id: engagementId,
                case_id: caseId,
                action_id: actionId,
                operator_id: state.currentUser || 'operator',
                draft_pl: draftText,
            }),
        });
        const decisionKey = String(
            (response && (response.decision_key || (response.queued && response.queued.queue_id))) || ''
        ).trim();
        state.hitlAction = {
            pending: false,
            awaitingSync: true,
            engagementId,
            kind,
            noteId,
            decisionKey,
            status: String((response && response.decision_status) || 'accepted').trim() || 'accepted',
            executionStatus: String((response && response.execution_status) || '').trim().toLowerCase(),
            deliveryMode: String((response && response.delivery_mode) || '').trim().toLowerCase(),
            effectStarted: Boolean(response && response.effect_started),
        };
        if (
            state.hitlAction.status === 'approved'
            && state.hitlAction.executionStatus === 'not_applicable'
            && state.hitlAction.deliveryMode === 'manual_operator'
            && state.hitlAction.effectStarted === false
        ) {
            showToast('Szkic zatwierdzony do recznej wysylki. Czekam na potwierdzenie w feedzie.');
        } else {
            showToast('Przyjeto do realizacji. Czekam na potwierdzenie w feedzie.');
        }
        await loadAllData();
        if (caseId) {
            await openCaseDetail(caseId);
        } else if (noteId) {
            await openNoteDetail(noteId);
        }
        const convergence = resolveHitlDecisionConvergence({ kind, decisionKey });
        if (convergence.converged) {
            state.hitlAction = {
                pending: false,
                awaitingSync: false,
                engagementId: '',
                kind: '',
                noteId: '',
                decisionKey,
                status: convergence.status,
            };
            if (convergence.status === 'executed') {
                showToast('Wykonanie potwierdzone w aktualnym feedzie.');
            } else if (convergence.status === 'approved') {
                showToast('Zatwierdzenie do recznej wysylki potwierdzone w aktualnym feedzie.');
            }
        } else if (convergence.status === 'outcome_unknown') {
            state.hitlAction.status = 'outcome_unknown';
            showError('Wynik wykonania jest nieznany. Sprawdz aktualny feed przed ponowieniem.');
        }
    } catch (error) {
        state.hitlAction = { pending: false, awaitingSync: false, engagementId: '', kind: '', noteId: '', decisionKey: '', status: 'failed' };
        if (Number(error.status || 0) === 409) {
            showError('Konflikt wersji engagementu - odswiezam kartke i pobieram aktualny stan.');
            await loadAllData();
            if (caseId) {
                await openCaseDetail(caseId);
            } else if (noteId) {
                await openNoteDetail(noteId);
            } else {
                renderDetailPanel();
            }
            return;
        }
        showError(error.message || 'Nie udalo sie zapisac decyzji HITL (sprawdz Node B / MCP).');
    } finally {
        if (!(state.hitlAction && state.hitlAction.pending)) {
            renderDetailPanel();
        }
    }
};

function resolveHitlDecisionConvergence({ kind, decisionKey }) {
    const detail = state.detail && typeof state.detail === 'object' ? state.detail : {};
    const payload = detail.payload && typeof detail.payload === 'object' ? detail.payload : {};
    const note = payload.note && typeof payload.note === 'object' ? payload.note : {};
    const caseItem = payload.case && typeof payload.case === 'object' ? payload.case : {};
    const engagement = detail.engagement && typeof detail.engagement === 'object'
        ? detail.engagement
        : (payload.engagement && typeof payload.engagement === 'object' ? payload.engagement : {});

    if (kind === 'send') {
        const executionResults = [
            ...(Array.isArray(payload.execution_results) ? payload.execution_results : []),
            ...(Array.isArray(caseItem.execution_results) ? caseItem.execution_results : []),
        ];
        const match = executionResults.find((item) => {
            const resultPayload = item && typeof item.result_payload === 'object' ? item.result_payload : {};
            return String(item && item.proposal_id || '').trim() === decisionKey
                || String(resultPayload.decision_key || '').trim() === decisionKey;
        });
        if (!match) {
            return { converged: false, status: 'accepted' };
        }
        const resultPayload = match && typeof match.result_payload === 'object' ? match.result_payload : {};
        const decisionStatus = String(resultPayload.decision_status || '').trim().toLowerCase();
        const executionStatus = String(match.execution_status || '').trim().toLowerCase();
        if (decisionStatus === 'executed' || executionStatus === 'executed') {
            return { converged: true, status: 'executed' };
        }
        if (decisionStatus === 'outcome_unknown' || executionStatus === 'blocked') {
            return { converged: false, status: 'outcome_unknown' };
        }
        if (decisionStatus === 'failed_before_execution' || executionStatus === 'failed') {
            return { converged: false, status: 'failed' };
        }
        return { converged: false, status: decisionStatus || executionStatus || 'accepted' };
    }

    const noteHitlRequired = note && note.hitl_required === true;
    const gateRequired = Boolean(
        engagement
        && engagement.hitl_gate
        && typeof engagement.hitl_gate === 'object'
        && engagement.hitl_gate.required === true
    );
    return noteHitlRequired || gateRequired
        ? { converged: false, status: 'accepted' }
        : { converged: true, status: 'approved' };
}

function isMaterializeProposalId(proposalId) {
    return String(proposalId || '').trim().startsWith('prop_');
}

function resolveEngagementIdForMaterializeProposal(proposalId) {
    const fromChat = findEngagementIdForProposal(proposalId);
    if (fromChat) return fromChat;
    return resolveEngagementIdFromCaseDetail(state.detail);
}

async function refreshEngagementIdForMaterializeProposal(proposalId) {
    const cached = resolveEngagementIdForMaterializeProposal(proposalId);
    if (cached) {
        return cached;
    }
    if (!state.detail || state.detail.type !== 'case') {
        return '';
    }
    const payload = state.detail.payload && typeof state.detail.payload === 'object' ? state.detail.payload : {};
    const caseItem = payload.case && typeof payload.case === 'object' ? payload.case : {};
    const caseId = String(caseItem.case_id || '').trim();
    if (!caseId) {
        return '';
    }
    try {
        const eng = await apiFetch(V3_API_BASE, `/cases/${encodeURIComponent(caseId)}/engagement`);
        if (eng && typeof eng.engagement === 'object') {
            state.detail.engagement = eng.engagement;
            return resolveEngagementIdFromCaseDetail(state.detail);
        }
    } catch (_engErr) {
        // engagement lookup optional — caller throws if still empty
    }
    return '';
}

async function approveProposalViaApi(proposalId, decision, reason) {
    if (decision === 'approve' && isMaterializeProposalId(proposalId)) {
        const engagementId = await refreshEngagementIdForMaterializeProposal(proposalId);
        if (!engagementId) {
            throw new Error('Brak engagement_id — odśwież szczegóły sprawy przed zatwierdzeniem materialize.');
        }
        return apiFetch(V2_API_BASE, `/engagements/${encodeURIComponent(engagementId)}/materialize/approve`, {
            method: 'POST',
            body: JSON.stringify({ proposal_id: proposalId, reason: reason || '' }),
        });
    }
    return apiFetch(V2_API_BASE, `/action-proposals/${encodeURIComponent(proposalId)}/${decision}`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
    });
}

async function decideActionProposal(proposalId, decision) {
    if (!canCurrentUserDecideActionProposals()) {
        showError('Tę decyzję może zapisać tylko owner Daszka.');
        return;
    }
    if (
        state.actionDecision
        && state.actionDecision.proposalId === proposalId
        && state.actionDecision.decision === decision
        && (state.actionDecision.pending || state.actionDecision.awaitingSync)
    ) {
        return;
    }
    const reason = window.prompt(decision === 'approve' ? 'Powód zatwierdzenia' : 'Powód odrzucenia', '') || '';
    state.actionDecision = {
        pending: true,
        awaitingSync: false,
        proposalId,
        decision,
        decisionKey: '',
        status: 'sending',
    };
    try {
        const response = await approveProposalViaApi(proposalId, decision, reason);
        const decisionKey = String(
            (response && (response.decision_key || (response.queued && response.queued.queue_id))) || ''
        ).trim();
        state.actionDecision = {
            pending: false,
            awaitingSync: true,
            proposalId,
            decision,
            decisionKey,
            status: String((response && response.decision_status) || 'accepted').trim() || 'accepted',
        };
        showToast('Przyjeto do realizacji. Czekam na potwierdzenie w feedzie.');
        await loadAllData();
        if (state.detail && state.detail.type === 'case') {
            await openCaseDetail(state.detail.payload.case.case_id);
        }
        const detail = state.detail && typeof state.detail === 'object' ? state.detail : {};
        const payload = detail.payload && typeof detail.payload === 'object' ? detail.payload : {};
        const caseItem = payload.case && typeof payload.case === 'object' ? payload.case : {};
        const proposals = [
            ...(Array.isArray(payload.action_proposals) ? payload.action_proposals : []),
            ...(Array.isArray(caseItem.action_proposals) ? caseItem.action_proposals : []),
        ];
        const proposal = proposals.find((item) => String(item && item.proposal_id || '').trim() === proposalId);
        const finalStatus = String((proposal && proposal.status) || '').trim().toLowerCase();
        if (
            finalStatus
            && (
                (decision === 'reject' && finalStatus === 'rejected')
                || (decision === 'approve' && finalStatus === 'approved')
                || (decision === 'approve' && finalStatus === 'executed')
            )
        ) {
            state.actionDecision = {
                pending: false,
                awaitingSync: false,
                proposalId: '',
                decision: '',
                decisionKey,
                status: finalStatus,
            };
            showToast(
                decision === 'approve' && isMaterializeProposalId(proposalId)
                    ? 'Materialize potwierdzone w aktualnym feedzie.'
                    : 'Decyzja potwierdzona w aktualnym feedzie.'
            );
        } else {
            state.actionDecision.status = finalStatus || 'accepted';
        }
    } catch (error) {
        state.actionDecision = {
            pending: false,
            awaitingSync: false,
            proposalId: '',
            decision: '',
            decisionKey: '',
            status: 'failed',
        };
        showError(error.message);
    }
}

async function markTaskDone(taskId) {
    try {
        await apiFetch(V2_API_BASE, `/tasks/${taskId}/done`, { method: 'POST' });
        showToast('Zadanie zostało oznaczone jako załatwione.');
        await refreshRegistryViewAfterTaskMutation();
    } catch (error) {
        showToast(error.message || 'Nie udało się oznaczyć zadania jako zrobione.', 'error');
    }
}

async function editTaskDue(taskId) {
    showError('Edycja terminu zadania wymaga endpointu v2 i jest chwilowo niedostępna.');
}

async function createManualTask(formData) {
    const hasFormData = formData && typeof formData.get === 'function';
    const title = hasFormData ? formData.get('title') : document.getElementById('task-title')?.value.trim();
    if (!title) {
        showError('Podaj tytuł zadania.');
        return;
    }
    const data = {
        title,
        priority: hasFormData ? (formData.get('priority') || 'normalny') : document.getElementById('task-priority')?.value || 'normalny',
        scheduled_at: hasFormData ? (formData.get('scheduled_at') || formData.get('due_at') || '') : document.getElementById('task-scheduled')?.value.trim() || '',
        note: hasFormData ? (formData.get('note') || '') : '',
        kind: 'task',
    };

    try {
        await apiFetch(V2_API_BASE, '/tasks', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        showToast('Ręczne zadanie zostało dodane.');
        document.getElementById('manual-task-form')?.reset();
        if (!hasFormData) {
            var taskForm = document.getElementById('task-new-form');
            var titleInput = document.getElementById('task-title');
            var scheduledInput = document.getElementById('task-scheduled');
            if (titleInput) titleInput.value = '';
            if (scheduledInput) scheduledInput.value = '';
            if (taskForm) taskForm.style.display = 'none';
        }
        await refreshRegistryViewAfterTaskMutation();
    } catch (error) {
        showError(error.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    installDaszekNavHandlers();
    bindTaskButtonsDelegated();

    initDaszekTheme();
    enhanceAccessibleTooltips(document.getElementById('app'));
    const backdrop = document.getElementById('detail-panel-backdrop');
    if (backdrop) {
        backdrop.addEventListener('click', () => {
            state.detail = null;
            renderDetailPanel();
        });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', event => {
            event.preventDefault();
            const formData = new FormData(event.target);
            login(formData.get('login'), formData.get('password'));
        });
    }

    bindClick('logout-btn', () => { void logout(); });
    bindClick('refresh-btn', async () => {
        const view = normalizeMainViewId(state.currentView);
        if (view === 'last_ingress') {
            await startLastIngressViewLoad();
            return;
        }
        if (view === 'system') {
            await startSystemViewLoad();
            return;
        }
        if (view === 'decisions') {
            await startDecisionQueueViewLoad();
            return;
        }
        if (view === 'constitution') {
            await startConstitutionViewLoad();
            return;
        }
        if (view === 'chat') {
            await startChatViewLoad();
            return;
        }
        if (view === 'identity') {
            await startIdentityMergeViewLoad();
            return;
        }
        if (view === 'tasks') {
            loadTasksIntoView();
            return;
        }
        await loadAllData();
    });

    const globalSearch = document.getElementById('global-search');
    if (globalSearch) {
        globalSearch.addEventListener('input', event => {
            state.search = event.target.value || '';
            renderCurrentView();
        });
    }

    // Onboarding button delegation (attached to document since wizard is outside #app)
    document.addEventListener('click', function (onboardingClick) {
        var nextBtn = onboardingClick.target.closest('#onboarding-next');
        if (nextBtn) {
            var currentStep = 0;
            var dots = document.querySelectorAll('.onboarding-step-dot--active');
            if (dots.length) {
                var allDots = document.querySelectorAll('.onboarding-step-dot');
                for (var di = 0; di < allDots.length; di++) {
                    if (allDots[di] === dots[0]) { currentStep = di; break; }
                }
            }
            advanceOnboarding(currentStep);
            return;
        }
        var skipBtn = onboardingClick.target.closest('#onboarding-skip');
        if (skipBtn) {
            completeOnboarding();
            return;
        }
        var finishBtn = onboardingClick.target.closest('#onboarding-finish');
        if (finishBtn) {
            completeOnboarding();
            return;
        }
    });

    const viewRoot = document.getElementById('view-root');
    if (viewRoot) {
        viewRoot.addEventListener('click', event => {
            const cohortBtn = event.target.closest('[data-open-cohort-run]');
            if (cohortBtn) {
                const rid = cohortBtn.getAttribute('data-open-cohort-run') || cohortBtn.dataset.openCohortRun || '';
                void openCohortRunDetail(rid);
                return;
            }
            const copyRun = event.target.closest('[data-copy-run-id]');
            if (copyRun) {
                const text = copyRun.getAttribute('data-copy-run-id') || '';
                if (text && navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(() => showToast('Skopiowano run_id')).catch(() => showToast('Kopiowanie nie powiodło się'));
                } else {
                    showToast('Brak run_id do skopiowania');
                }
                return;
            }
            const archiveTrigger = event.target.closest('[data-archive-case]');
            if (archiveTrigger) {
                event.preventDefault();
                event.stopPropagation();
                void archiveCaseById(archiveTrigger.getAttribute('data-archive-case') || archiveTrigger.dataset.archiveCase || '');
                return;
            }
            const unarchiveTrigger = event.target.closest('[data-unarchive-case]');
            if (unarchiveTrigger) {
                event.preventDefault();
                event.stopPropagation();
                void unarchiveCaseById(unarchiveTrigger.getAttribute('data-unarchive-case') || unarchiveTrigger.dataset.unarchiveCase || '');
                return;
            }
            const noteTrigger = event.target.closest('[data-open-note]');
            if (noteTrigger) {
                openNoteDetail(noteTrigger.dataset.openNote);
                return;
            }
            const caseTrigger = event.target.closest('[data-open-case]');
            if (caseTrigger) {
                openCaseDetail(caseTrigger.dataset.openCase);
                return;
            }
            const feedbackTrigger = event.target.closest('[data-note-action]');
            if (feedbackTrigger) {
                sendFeedback(feedbackTrigger.dataset.noteId, feedbackTrigger.dataset.noteAction);
                return;
            }
            const approveTrigger = event.target.closest('[data-action-proposal-approve]');
            if (approveTrigger) {
                decideActionProposal(approveTrigger.dataset.actionProposalApprove, 'approve');
                return;
            }
            const rejectTrigger = event.target.closest('[data-action-proposal-reject]');
            if (rejectTrigger) {
                decideActionProposal(rejectTrigger.dataset.actionProposalReject, 'reject');
                return;
            }
            const mergeTrigger = event.target.closest('[data-note-merge]');
            if (mergeTrigger) {
                const targetCaseId = window.prompt('Podaj identyfikator sprawy, z którą połączyć kartkę');
                if (targetCaseId) {
                    sendFeedback(mergeTrigger.dataset.noteMerge, 'polacz_ze_sprawa', { target_case_id: targetCaseId });
                }
                return;
            }
            const taskDoneTrigger = event.target.closest('[data-task-done]');
            if (taskDoneTrigger) {
                markTaskDone(taskDoneTrigger.dataset.taskDone);
                return;
            }
            const taskDueTrigger = event.target.closest('[data-task-due]');
            if (taskDueTrigger) {
                editTaskDue(taskDueTrigger.dataset.taskDue);
            }
        });
    }

    const detailPanel = document.getElementById('detail-panel');
    if (detailPanel) {
        detailPanel.addEventListener('click', event => {
            const hitlApprove = event.target.closest('[data-hitl-approve]');
            if (hitlApprove) {
                void submitHitlAgentAction(hitlApprove, 'approve');
                return;
            }
            const hitlSend = event.target.closest('[data-hitl-send]');
            if (hitlSend) {
                void submitHitlAgentAction(hitlSend, 'send');
                return;
            }
            const retryTrigger = event.target.closest('[data-retry-detail]');
            if (retryTrigger) {
                const mode = retryTrigger.dataset.retryDetail;
                const rid = retryTrigger.dataset.retryId || '';
                if (mode === 'note') {
                    void openNoteDetail(rid);
                } else if (mode === 'case') {
                    void openCaseDetail(rid);
                }
                return;
            }
            if (event.target.closest('[data-refresh-operational-feed]')) {
                state.detail = null;
                renderDetailPanel();
                void loadAllData();
                return;
            }
            if (event.target.closest('[data-close-detail]')) {
                state.detail = null;
                renderDetailPanel();
                return;
            }
            const decisionViewAct = event.target.closest('[data-decision-view-action]');
            if (decisionViewAct) {
                showToast('Blok decyzyjny jest read-only. Oceń sprawę przez kartkę na biurku, propozycję akcji lub kolejkę bridge — zgodnie z procedurą TOP-INSTAL.');
                return;
            }
            const archiveTrigger = event.target.closest('[data-archive-case]');
            if (archiveTrigger) {
                event.preventDefault();
                event.stopPropagation();
                void archiveCaseById(archiveTrigger.getAttribute('data-archive-case') || archiveTrigger.dataset.archiveCase || '');
                return;
            }
            const unarchiveTrigger = event.target.closest('[data-unarchive-case]');
            if (unarchiveTrigger) {
                event.preventDefault();
                event.stopPropagation();
                void unarchiveCaseById(unarchiveTrigger.getAttribute('data-unarchive-case') || unarchiveTrigger.dataset.unarchiveCase || '');
                return;
            }
            const noteTrigger = event.target.closest('[data-open-note]');
            if (noteTrigger) {
                openNoteDetail(noteTrigger.dataset.openNote);
                return;
            }
            const caseTrigger = event.target.closest('[data-open-case]');
            if (caseTrigger) {
                openCaseDetail(caseTrigger.dataset.openCase);
                return;
            }
            const feedbackTrigger = event.target.closest('[data-note-action]');
            if (feedbackTrigger) {
                sendFeedback(feedbackTrigger.dataset.noteId, feedbackTrigger.dataset.noteAction);
                return;
            }
            const approveTrigger = event.target.closest('[data-action-proposal-approve]');
            if (approveTrigger) {
                decideActionProposal(approveTrigger.dataset.actionProposalApprove, 'approve');
                return;
            }
            const rejectTrigger = event.target.closest('[data-action-proposal-reject]');
            if (rejectTrigger) {
                decideActionProposal(rejectTrigger.dataset.actionProposalReject, 'reject');
                return;
            }
            const mergeTrigger = event.target.closest('[data-note-merge]');
            if (mergeTrigger) {
                const targetCaseId = window.prompt('Podaj identyfikator sprawy, z którą połączyć kartkę');
                if (targetCaseId) {
                    sendFeedback(mergeTrigger.dataset.noteMerge, 'polacz_ze_sprawa', { target_case_id: targetCaseId });
                }
            }
        });

        detailPanel.addEventListener('submit', event => {
            const form = event.target.closest('[data-skrzat-form]');
            if (form) {
                event.preventDefault();
                askSkrzat(form.getAttribute('data-skrzat-form'), form);
            }
        });
    }

    if (viewRoot) {
        viewRoot.addEventListener('submit', event => {
            if (event.target.id === 'manual-task-form') {
                event.preventDefault();
                createManualTask(new FormData(event.target));
            }
        });
    }

    renderDetailPanel();
    void tryRestoreSession().then(restored => {
        if (!restored) {
            showLoginScreen();
        }
    });
});

function renderComingSoonView(title, message) {
    const root = document.getElementById('view-root');
    if (!root) return;
    root.innerHTML = wrapDaszekViewShell([title], `
        <section class="empty-state ds-state ds-state--coming-soon">
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(message)}</p>
            <p class="detail-muted">Ten widok jest w przygotowaniu i będzie dostępny w kolejnej wersji Daszka.</p>
        </section>
    `);
}

/* ═══════════════════════════════════════════════════════════════════
   Decision Queue View — P1
   ═══════════════════════════════════════════════════════════════════ */

let decisionQueueViewRequestId = 0;

async function startDecisionQueueViewLoad() {
    const root = document.getElementById('view-root');
    if (!root) return;
    const requestId = ++decisionQueueViewRequestId;
    state.data.decisionQueue = { ok: false, items: [], loadError: null, loading: true };
    root.innerHTML = wrapDaszekViewShell(['Kolejka decyzji'], `
        <section class="detail-section">
            <p class="detail-muted" role="status">Wczytywanie kolejki decyzji…</p>
            <div class="decision-skeleton">
                <div class="detail-skeleton-line"></div>
                <div class="detail-skeleton-line"></div>
                <div class="detail-skeleton-line detail-skeleton-line--short"></div>
            </div>
        </section>
    `);
    try {
        const data = await apiFetch(V3_API_BASE, '/system/decision-queue');
        if (requestId !== decisionQueueViewRequestId || normalizeMainViewId(state.currentView) !== 'decisions') return;
        const items = data && Array.isArray(data.items) ? data.items : [];
        state.data.decisionQueue = { ok: !!(data && data.ok !== false), items: items, loadError: null, loading: false };
    } catch (err) {
        if (requestId !== decisionQueueViewRequestId || normalizeMainViewId(state.currentView) !== 'decisions') return;
        state.data.decisionQueue = { ok: false, items: [], loadError: String(err.message || err), loading: false };
    }
    if (requestId !== decisionQueueViewRequestId || normalizeMainViewId(state.currentView) !== 'decisions') return;
    renderDecisionQueueView();
}

function renderDecisionQueueView() {
    var root = document.getElementById('view-root');
    if (!root) return;
    var bundle = state.data.decisionQueue || {};
    if (bundle.loading) return;
    if (bundle.loadError) {
        root.innerHTML = wrapDaszekViewShell(['Kolejka decyzji'], '<section class="empty-state ds-state ds-state--error"><h3>Blad wczytywania</h3><p class="error-inline">' + escapeHtml(bundle.loadError) + '</p></section>');
        return;
    }
    var items = bundle.items || [];
    if (!items.length) {
        root.innerHTML = wrapDaszekViewShell(['Kolejka decyzji'], '<section class="empty-state ds-state"><h3>Kolejka decyzji jest pusta</h3><p>Wszystkie decyzje zostaly podjete. Zadne dzialanie nie czeka na Ciebie.</p></section>');
        return;
    }
    var cards = items.map(function (item) {
        var priority = item.priority || 'normal';
        var isCritical = priority === 'critical';
        var timeHours = item.time_in_queue_hours != null ? Number(item.time_in_queue_hours) : 0;
        var timeLabel = timeHours < 1 ? Math.round(timeHours * 60) + ' min' : timeHours.toFixed(1) + ' godz.';
        var createdDate = item.created_at ? formatRelativeDateTime(item.created_at) : '';
        return '<article class="decision-card' + (isCritical ? ' decision-card--critical' : '') + '" data-case-id="' + escapeHtml(item.case_id || '') + '" data-decision-id="' + escapeHtml(item.decision_id || '') + '">' +
            '<div class="decision-card-header">' +
            '<span class="decision-case-id">' + escapeHtml(item.case_id || '—') + '</span>' +
            '<span class="meta-badge ' + (isCritical ? 'status-pill--conflict' : 'status-pill--review') + '">' + escapeHtml(priorityLabel(priority)) + '</span>' +
            '</div>' +
            '<div class="decision-card-body">' +
            '<span class="decision-type">' + escapeHtml(humanizeCode(item.proposal_type || '')) + '</span>' +
            '<span class="decision-status">' + escapeHtml(item.status || '—') + '</span>' +
            '</div>' +
            '<div class="decision-card-meta">' +
            (createdDate ? '<span class="decision-time-badge" data-tooltip="' + escapeHtml(item.created_at || '') + '">' + escapeHtml(createdDate) + '</span>' : '') +
            '<span>Czas w kolejce: ' + escapeHtml(timeLabel) + '</span>' +
            '</div>' +
            '<div class="decision-card-actions">' +
            '<button class="btn btn-primary btn-small" data-tooltip="Otworz szczegoly sprawy" data-open-case="' + escapeHtml(item.case_id || '') + '">Otworz sprawe</button>' +
            '<button class="btn btn-secondary btn-small" data-tooltip="Wiecej szczegolow decyzji" data-view-decision="' + escapeHtml(item.decision_id || '') + '">Szczegoly</button>' +
            '</div>' +
            '</article>';
    }).join('');
    root.innerHTML = wrapDaszekViewShell(['Kolejka decyzji'], '<section class="decision-queue-section"><div class="decision-grid">' + cards + '</div></section>');
}

/* Open a single decision in the detail panel */
function openDecisionDetail(decisionId) {
    var bundle = state.data.decisionQueue || {};
    var items = Array.isArray(bundle.items) ? bundle.items : [];
    var item = items.find(function (d) { return String(d.decision_id || '') === String(decisionId); });
    if (!item) {
        showToast('Nie znaleziono decyzji', 'error');
        return;
    }
    var priority = item.priority || 'normal';
    var isCritical = priority === 'critical';
    var priorityBadge = '<span class="meta-badge ' + (isCritical ? 'status-pill--conflict' : 'status-pill--review') + '">' + escapeHtml(priorityLabel(priority)) + '</span>';
    var timeHours = item.time_in_queue_hours != null ? Number(item.time_in_queue_hours) : 0;
    var timeLabel = timeHours < 1 ? Math.round(timeHours * 60) + ' min' : timeHours.toFixed(1) + ' godz.';

    state.detail = {
        type: null,
        _customHtml: '<div class="detail-shell"><div class="detail-header"><div><p class="eyebrow">Decyzja</p><h2 tabindex="-1" data-detail-focus-root>' + escapeHtml(item.decision_id || 'Decyzja') + '</h2></div><button type="button" class="btn btn-ghost btn-small" data-close-detail="1" aria-label="Zamknij">Zamknij</button></div>' +
            '<section class="detail-section"><div class="os-event-detail-grid">' +
            '<div><span class="detail-muted">Sprawa</span><strong>' + escapeHtml(item.case_id || '-') + '</strong></div>' +
            '<div><span class="detail-muted">Priorytet</span>' + priorityBadge + '</div>' +
            '<div><span class="detail-muted">Typ propozycji</span><strong>' + escapeHtml(humanizeCode(item.proposal_type || '')) + '</strong></div>' +
            '<div><span class="detail-muted">Status</span><strong>' + escapeHtml(item.status || '-') + '</strong></div>' +
            '<div><span class="detail-muted">Utworzono</span><strong>' + escapeHtml(formatRelativeDateTime(item.created_at || '')) + '</strong></div>' +
            '<div><span class="detail-muted">Czas w kolejce</span><strong>' + escapeHtml(timeLabel) + '</strong></div>' +
            '</div></section>' +
            '<section class="detail-section detail-section-actions"><h3>Akcje</h3><div class="hitl-actions">' +
            '<button class="btn btn-primary btn-small" data-open-case="' + escapeHtml(item.case_id || '') + '" data-tooltip="Przegladaj sprawe powiazana z ta decyzja">Otworz sprawe</button>' +
            '</div></section>' +
            '</div>'
    };
    renderDetailPanel();
}

/* ═══════════════════════════════════════════════════════════════════
   Identity Binding View — P2-ID-2 (Poziom 2 suggest + legacy email dupes)
   ═══════════════════════════════════════════════════════════════════ */

let identityMergeViewRequestId = 0;

function identitySummaryLine(identity) {
    if (!identity || typeof identity !== 'object') {
        return '—';
    }
    const email = String(identity.primary_email || '').trim();
    const name = String(identity.display_name || '').trim();
    const kind = String(identity.identity_kind || '').trim();
    const parts = [];
    if (email) parts.push(email);
    if (name && name.toLowerCase() !== email.toLowerCase()) parts.push(name);
    if (kind) parts.push(kind);
    return parts.length ? parts.join(' · ') : '—';
}

async function startIdentityMergeViewLoad() {
    const root = document.getElementById('view-root');
    if (!root) return;
    const requestId = ++identityMergeViewRequestId;
    state.data.identityMerge = {
        ok: false,
        bindingSuggestions: [],
        emailDuplicates: [],
        loadError: null,
        loading: true,
    };
    root.innerHTML = wrapDaszekViewShell(['Tożsamość klientów'], `
        <section class="detail-section">
            <p class="detail-muted" role="status">Wczytywanie kolejki sugestii tożsamości…</p>
        </section>
    `);
    try {
        const [bindingData, emailData] = await Promise.all([
            apiFetch(V3_API_BASE, '/identity/binding-suggestions?status=pending_operator&limit=50').catch(function () {
                return { ok: false, items: [] };
            }),
            apiFetch(V2_API_BASE, '/identity/suggestions?limit=20').catch(function () {
                return { ok: false, items: [] };
            }),
        ]);
        if (requestId !== identityMergeViewRequestId || normalizeMainViewId(state.currentView) !== 'identity') return;
        state.data.identityMerge = {
            ok: !!(bindingData && bindingData.ok !== false),
            bindingSuggestions: bindingData && Array.isArray(bindingData.items) ? bindingData.items : [],
            emailDuplicates: emailData && Array.isArray(emailData.items) ? emailData.items : [],
            loadError: null,
            loading: false,
        };
    } catch (err) {
        if (requestId !== identityMergeViewRequestId || normalizeMainViewId(state.currentView) !== 'identity') return;
        state.data.identityMerge = {
            ok: false,
            bindingSuggestions: [],
            emailDuplicates: [],
            loadError: String(err.message || err),
            loading: false,
        };
    }
    if (requestId !== identityMergeViewRequestId || normalizeMainViewId(state.currentView) !== 'identity') return;
    renderIdentityMergeView();
}

function renderIdentityBindingSuggestionCard(item) {
    const suggestionId = String(item.suggestion_id || '');
    const signalLabel = String(item.signal_label_pl || item.signal_type || 'Sugestia');
    const confidence = item.confidence != null ? Math.round(Number(item.confidence) * 100) : null;
    const sourceLine = identitySummaryLine(item.source_identity);
    const targetLine = identitySummaryLine(item.target_identity);
    const evidence = item.evidence_json && typeof item.evidence_json === 'object' ? item.evidence_json : {};
    const evidenceBits = [];
    if (evidence.nip) evidenceBits.push('NIP: ' + String(evidence.nip));
    if (evidence.phone) evidenceBits.push('Tel: ' + String(evidence.phone));
    if (evidence.display_a && evidence.display_b) {
        evidenceBits.push(String(evidence.display_a) + ' ↔ ' + String(evidence.display_b));
    }
    return `<article class="identity-binding-card decision-card" data-suggestion-id="${escapeHtml(suggestionId)}">
        <div class="identity-merge-head">
            <h4>${escapeHtml(signalLabel)}</h4>
            ${confidence != null ? `<span class="record-badge">${escapeHtml(String(confidence))}% pewności</span>` : ''}
        </div>
        <div class="os-event-detail-grid">
            <div><span class="detail-muted">Źródło</span><strong>${escapeHtml(sourceLine)}</strong></div>
            <div><span class="detail-muted">Cel scalenia</span><strong>${escapeHtml(targetLine)}</strong></div>
        </div>
        ${evidenceBits.length ? `<p class="detail-muted">Dowód: ${escapeHtml(evidenceBits.join(' · '))}</p>` : ''}
        <div class="decision-card-actions">
            <button type="button" class="btn btn-primary btn-small" data-identity-binding-approve="${escapeHtml(suggestionId)}" data-tooltip="Zatwierdź scalenie tożsamości">Zatwierdź</button>
            <button type="button" class="btn btn-secondary btn-small" data-identity-binding-reject="${escapeHtml(suggestionId)}" data-tooltip="Odrzuć sugestię — bez scalenia">Odrzuć</button>
        </div>
    </article>`;
}

function renderIdentityEmailDuplicateCard(item, idx) {
    const email = String(item.email_norm || item.email || item.customer_email || '').trim();
    const identityIds = Array.isArray(item.identity_ids) ? item.identity_ids : [];
    const count = item.identity_count != null ? Number(item.identity_count) : identityIds.length;
    return `<article class="identity-merge-card" id="identity-card-${idx}" data-identity-email="${escapeHtml(email)}">
        <div class="identity-merge-head">
            <h4>${escapeHtml(email || '—')}</h4>
            <span class="record-badge">${escapeHtml(String(count || '?'))} tożsamości</span>
        </div>
        <p class="detail-muted">Duplikat e-mail — wymaga reconcile po stronie Node B (P1).</p>
        ${identityIds.length ? `<p class="detail-muted">ID: ${identityIds.map(function (id) { return escapeHtml(String(id)); }).join(', ')}</p>` : ''}
    </article>`;
}

function renderIdentityMergeView() {
    const root = document.getElementById('view-root');
    if (!root) return;
    const bundle = state.data.identityMerge || {};
    if (bundle.loading) return;
    if (bundle.loadError) {
        root.innerHTML = wrapDaszekViewShell(['Tożsamość klientów'], `
            <section class="empty-state ds-state ds-state--error">
                <h3>Błąd wczytywania</h3>
                <p class="error-inline">${escapeHtml(bundle.loadError)}</p>
            </section>
        `);
        return;
    }
    const bindingSuggestions = Array.isArray(bundle.bindingSuggestions) ? bundle.bindingSuggestions : [];
    const emailDuplicates = Array.isArray(bundle.emailDuplicates) ? bundle.emailDuplicates : [];
    const bindingCards = bindingSuggestions.map(renderIdentityBindingSuggestionCard).join('');
    const emailCards = emailDuplicates.map(renderIdentityEmailDuplicateCard).join('');
    const bindingSection = bindingSuggestions.length
        ? `<div class="identity-merge-grid">${bindingCards}</div>`
        : `<section class="empty-state ds-state"><p>Brak oczekujących sugestii wiązania. Uruchom skan, jeśli spodziewasz się dopasowań NIP/telefon/nazwa.</p></section>`;
    const emailSection = emailDuplicates.length
        ? `<section class="identity-merge-section identity-merge-section--legacy"><h3 class="detail-section-title">Pozostałe duplikaty e-mail</h3><div class="identity-merge-grid">${emailCards}</div></section>`
        : '';
    root.innerHTML = wrapDaszekViewShell(['Tożsamość klientów'], `
        <section class="identity-merge-section">
            <div class="detail-section-actions" style="margin-bottom: 1rem;">
                <button type="button" class="btn btn-secondary btn-small" data-identity-binding-scan data-tooltip="Przeskanuj rejestr tożsamości pod kątem NIP/telefon/nazwa">Skanuj sugestie</button>
            </div>
            <p class="detail-muted">Poziom 2 (RFC): sugestie scalenia różnych e-maili z tym samym sygnałem — wymagają Twojej decyzji.</p>
            ${bindingSection}
        </section>
        ${emailSection}
    `);
    enhanceAccessibleTooltips(root);
}

async function scanIdentityBindingSuggestions(trigger) {
    if (trigger) trigger.disabled = true;
    try {
        const result = await apiFetch(V3_API_BASE, '/identity/binding-suggestions/scan?limit=50', { method: 'POST' });
        const detected = result && result.detected != null ? Number(result.detected) : 0;
        showToast('Skan zakończony — wykryto ' + detected + ' sugestii.', 'success');
        void startIdentityMergeViewLoad();
    } catch (err) {
        showToast(err && err.message ? err.message : 'Skan sugestii nie powiódł się.', 'error');
        if (trigger) trigger.disabled = false;
    }
}

async function decideIdentityBindingSuggestion(suggestionId, status) {
    const sid = String(suggestionId || '').trim();
    if (!sid) return;
    const label = status === 'approved' ? 'zatwierdzić' : 'odrzucić';
    if (!window.confirm('Czy na pewno chcesz ' + label + ' tę sugestię scalenia tożsamości?')) {
        return;
    }
    try {
        const result = await apiFetch(V3_API_BASE, '/identity/binding-suggestions/' + encodeURIComponent(sid) + '/status', {
            method: 'POST',
            body: JSON.stringify({ status: status, reviewed_by: 'operator' }),
        });
        if (!result || result.ok === false) {
            throw new Error((result && result.detail) || (result && result.message) || 'Operacja nie powiodła się.');
        }
        if (status === 'approved' && result.merge && result.merge.merged) {
            showToast('Tożsamości scalone — odświeżam kolejkę.', 'success');
        } else {
            showToast(status === 'approved' ? 'Sugestia zatwierdzona.' : 'Sugestia odrzucona.', 'success');
        }
        void startIdentityMergeViewLoad();
    } catch (err) {
        showToast(err && err.message ? err.message : 'Błąd operacji na sugestii.', 'error');
    }
}

/* ═══════════════════════════════════════════════════════════════════
   Constitution View — P2
   ═══════════════════════════════════════════════════════════════════ */

let constitutionViewRequestId = 0;

async function startConstitutionViewLoad() {
    var root = document.getElementById('view-root');
    if (!root) return;
    var requestId = ++constitutionViewRequestId;
    state.data.constitution = { ok: false, data: null, loadError: null, loading: true };
    root.innerHTML = wrapDaszekViewShell(['Konstytucja'], '<section class="detail-section"><div class="detail-skeleton"><div class="detail-skeleton-line"></div><div class="detail-skeleton-line detail-skeleton-line--short"></div><div class="detail-skeleton-line"></div></div></section>');
    try {
        var data = await apiFetch(V3_API_BASE, '/system/constitution');
        if (requestId !== constitutionViewRequestId || normalizeMainViewId(state.currentView) !== 'constitution') return;
        state.data.constitution = { ok: !!(data && data.ok !== false), data: data, loadError: null, loading: false };
    } catch (err) {
        if (requestId !== constitutionViewRequestId || normalizeMainViewId(state.currentView) !== 'constitution') return;
        state.data.constitution = { ok: false, data: null, loadError: String(err.message || err), loading: false };
    }
    if (requestId !== constitutionViewRequestId || normalizeMainViewId(state.currentView) !== 'constitution') return;
    renderConstitutionView();
}

function renderConstitutionView() {
    var root = document.getElementById('view-root');
    if (!root) return;
    var bundle = state.data.constitution || {};
    if (bundle.loading) return;
    if (bundle.loadError) {
        root.innerHTML = wrapDaszekViewShell(['Konstytucja'], '<section class="empty-state ds-state ds-state--error"><h3>Blad wczytywania</h3><p class="error-inline">' + escapeHtml(bundle.loadError) + '</p></section>');
        return;
    }
    var data = bundle.data;
    if (!data || !data.sections) {
        root.innerHTML = wrapDaszekViewShell(['Konstytucja'], '<section class="empty-state ds-state"><h3>Konstytucja niedostepna</h3><p>Brak danych konstytucji systemu.</p></section>');
        return;
    }

    var parts = [];

    // Company context card
    if (data.company_context) {
        parts.push('<section class="constitution-section constitution-context-card"><h3>Kontekst firmy</h3><div class="constitution-section-content">' + escapeHtml(data.company_context) + '</div></section>');
    }

    // Constitution sections
    var sectionKeys = Object.keys(data.sections);
    if (sectionKeys.length) {
        parts.push('<h3 class="constitution-subheader">Sekcje konstytucji</h3>');
        sectionKeys.forEach(function (key) {
            var content = data.sections[key] || '';
            parts.push('<section class="constitution-section"><h4>' + escapeHtml(key) + '</h4><div class="constitution-section-content constitution-section-content--body">' + escapeHtml(content) + '</div></section>');
        });
    }

    // Tool allowlist
    if (data.tool_allowlist && Array.isArray(data.tool_allowlist) && data.tool_allowlist.length) {
        parts.push('<section class="constitution-section"><h4>Narzedzia agenta</h4><div class="tool-allowlist">' +
            data.tool_allowlist.map(function (t) { return '<span class="tool-badge">' + escapeHtml(t) + '</span>'; }).join('') +
            '</div></section>');
    }

    // Forbidden actions
    if (data.forbidden_actions && Array.isArray(data.forbidden_actions) && data.forbidden_actions.length) {
        parts.push('<section class="constitution-section"><h4>Akcje zabronione</h4><div class="tool-allowlist">' +
            data.forbidden_actions.map(function (a) { return '<span class="tool-badge tool-badge--forbidden">' + escapeHtml(a) + '</span>'; }).join('') +
            '</div></section>');
    }

    // RAG enriched badge
    if (data.rag_enriched) {
        parts.push('<section class="constitution-section"><p class="detail-muted">Konstytucja wzbogacona o dane z RAG <span class="tool-badge tool-badge--rag">RAG enriched</span></p></section>');
    }

    root.innerHTML = wrapDaszekViewShell(['Konstytucja'], parts.join('\n'));
}

/* ═══════════════════════════════════════════════════════════════════
   Interactive OS Events — P2
   ═══════════════════════════════════════════════════════════════════ */

function openOsEventDetail(eventId) {
    var bundle = state.data.systemOsEvents || {};
    var items = Array.isArray(bundle.items) ? bundle.items : [];
    var ev = items.find(function (e) { return String(e.event_id || '') === String(eventId); });
    if (!ev) {
        showToast('Nie znaleziono zdarzenia', 'error');
        return;
    }
    var payloadHtml = '';
    if (ev.payload && typeof ev.payload === 'object') {
        payloadHtml = '<details class="detail-tech"><summary>Pelny payload JSON</summary><pre class="os-event-payload-json">' + escapeHtml(JSON.stringify(ev.payload, null, 2).slice(0, 8000)) + '</pre></details>';
    }
    var severity = String(ev.severity || ev.event_type || 'info').trim();
    var severityClass = severity === 'error' ? 'status-pill--conflict' : (severity === 'warning' ? 'status-pill--review' : '');
    var engagementId = String(ev.engagement_id || '').trim();
    var caseLink = engagementId ? '<button class="btn btn-primary btn-small" data-open-case="' + escapeHtml(engagementId) + '" data-tooltip="Przejdz do powiazanej sprawy">Otworz powiazana sprawe</button>' : '';

    state.detail = {
        type: null,
        _customHtml: '<div class="detail-shell"><div class="detail-header"><div><p class="eyebrow">Zdarzenie systemowe</p><h2 tabindex="-1" data-detail-focus-root>' + escapeHtml(ev.event_type || 'Zdarzenie') + '</h2></div><button type="button" class="btn btn-ghost btn-small" data-close-detail="1" aria-label="Zamknij">Zamknij</button></div><section class="detail-section"><div class="os-event-detail-grid">' +
            '<div><span class="detail-muted">Czas</span><strong>' + escapeHtml(formatDate(ev.occurred_at || '')) + '</strong></div>' +
            '<div><span class="detail-muted">Zrodlo</span><strong>' + escapeHtml(ev.source_repo || '—') + '</strong></div>' +
            (ev.severity ? '<div><span class="detail-muted">Waga</span><span class="meta-badge ' + severityClass + '">' + escapeHtml(severity) + '</span></div>' : '') +
            (ev.duration_ms != null ? '<div><span class="detail-muted">Czas trwania</span><strong>' + escapeHtml(String(ev.duration_ms)) + ' ms</strong></div>' : '') +
            (ev.success != null ? '<div><span class="detail-muted">Sukces</span><strong>' + (ev.success ? 'Tak' : 'Nie') + '</strong></div>' : '') +
            '</div></section>' +
            (ev.summary_pl ? '<section class="detail-section"><h3>Opis</h3><p>' + escapeHtml(ev.summary_pl) + '</p></section>' : '') +
            (ev.trace_id ? '<section class="detail-section"><h3>Trace ID</h3><p class="detail-muted">' + escapeHtml(ev.trace_id) + '</p></section>' : '') +
            (engagementId ? '<section class="detail-section"><h3>Powiązanie</h3><p class="detail-muted">engagement: ' + escapeHtml(engagementId) + '</p>' + caseLink + '</section>' : '') +
            payloadHtml +
            '</div>'
    };
    renderDetailPanel();
}

/* ═══════════════════════════════════════════════════════════════════
   Onboarding Wizard — P3
   ═══════════════════════════════════════════════════════════════════ */

var ONBOARDING_STEPS = [
    { title: 'Witaj w Daszku', icon: '&#127758;', text: 'Daszek to Twoje cyfrowe biurko operatorskie. AI przynosi Ci najwazniejsze sprawy, abys nie musial przegladac setek maili.' },
    { title: 'Twoje widoki', icon: '&#128202;', text: 'Biurko pokazuje co wymaga uwagi. Sprawy to pelny rejestr. Czat pozwala rozmawiac z agentem AI. Dzień i Archiwum daja szerszy obraz.' },
    { title: 'Czat z agentem', icon: '&#129302;', text: 'Mozesz wydawac polecenia agentowi: sprawdz stan, zapytaj o klienta, popros o podsumowanie. Agent mowi po polsku i rozumie Twoja firme.' },
    { title: 'Daszek gotowy!', icon: '&#10004;&#65039;', text: 'Biurko czeka. Zaczynaj prace — wszystko, co wazne, juz na Ciebie czeka.' },
];

var onboardingReturnFocus = null;

function showOnboardingWizard() {
    onboardingReturnFocus = document.activeElement;
    var backdrop = document.createElement('div');
    backdrop.className = 'onboarding-backdrop';
    backdrop.id = 'onboarding-backdrop';
    document.body.appendChild(backdrop);

    var overlay = document.createElement('div');
    overlay.className = 'onboarding-overlay';
    overlay.id = 'onboarding-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'onboarding-title');
    overlay.innerHTML = renderOnboardingStep(0);
    document.body.appendChild(overlay);
    bindOnboardingFocusTrap(overlay);
    var firstFocus = overlay.querySelector('button');
    if (firstFocus) {
        firstFocus.focus();
    }
    overlay.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            completeOnboarding();
        }
    });

    void overlay.offsetWidth; // force reflow for animation
    backdrop.classList.add('onboarding-backdrop--visible');
    overlay.classList.add('onboarding-overlay--visible');
}

function bindOnboardingFocusTrap(overlay) {
    if (!overlay || overlay.dataset.focusTrapBound === '1') return;
    overlay.dataset.focusTrapBound = '1';
    overlay.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;
        var focusable = overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusable.length) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    });
}

function enhanceAccessibleTooltips(root) {
    var scope = root || document;
    scope.querySelectorAll('[data-tooltip]').forEach(function (el) {
        var tip = el.getAttribute('data-tooltip') || '';
        if (tip && !el.getAttribute('aria-label')) {
            el.setAttribute('aria-label', tip);
        }
        if (el.tagName !== 'BUTTON' && el.tagName !== 'A' && el.getAttribute('role') !== 'button' && !el.hasAttribute('tabindex')) {
            el.setAttribute('tabindex', '0');
        }
    });
}

function renderOnboardingStep(stepIdx) {
    var step = ONBOARDING_STEPS[stepIdx];
    if (!step) return '';
    var dots = ONBOARDING_STEPS.map(function (_, i) {
        var current = i === stepIdx ? ' aria-current="step"' : '';
        return '<span class="onboarding-step-dot' + (i === stepIdx ? ' onboarding-step-dot--active' : '') + (i < stepIdx ? ' onboarding-step-dot--done' : '') + '"' + current + ' aria-label="Krok ' + (i + 1) + ' z ' + ONBOARDING_STEPS.length + '"></span>';
    }).join('');
    var isLast = stepIdx === ONBOARDING_STEPS.length - 1;
    var buttons = isLast
        ? '<button class="btn btn-primary" id="onboarding-finish" data-tooltip="Rozpocznij prace z Daszkiem">Rozpocznij prace</button>'
        : '<button class="btn btn-primary" id="onboarding-next" data-tooltip="Kontynuuj">Dalej</button><button class="btn btn-ghost btn-small" id="onboarding-skip" data-tooltip="Pomin wprowadzenie">Pomin</button>';
    return '<div class="onboarding-card">' +
        '<div class="onboarding-icon">' + step.icon + '</div>' +
        '<h2 id="onboarding-title">' + escapeHtml(step.title) + '</h2>' +
        '<p>' + escapeHtml(step.text) + '</p>' +
        '<div class="onboarding-dots" role="progressbar" aria-valuemin="1" aria-valuemax="' + ONBOARDING_STEPS.length + '" aria-valuenow="' + (stepIdx + 1) + '" aria-label="Postęp wprowadzenia">' + dots + '</div>' +
        '<div class="onboarding-actions">' + buttons + '</div>' +
        '</div>';
}

function advanceOnboarding(currentStep) {
    var nextStep = currentStep + 1;
    if (nextStep >= ONBOARDING_STEPS.length) {
        completeOnboarding();
        return;
    }
    var overlay = document.getElementById('onboarding-overlay');
    if (!overlay) return;
    overlay.innerHTML = renderOnboardingStep(nextStep);
    bindOnboardingFocusTrap(overlay);
    var focusBtn = overlay.querySelector('button');
    if (focusBtn) {
        focusBtn.focus();
    }
}

function completeOnboarding() {
    try { localStorage.setItem('daszek-onboarding-done', '1'); } catch (_) { /* ignore */ }
    var overlay = document.getElementById('onboarding-overlay');
    var backdrop = document.getElementById('onboarding-backdrop');
    if (overlay) {
        overlay.classList.remove('onboarding-overlay--visible');
        setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 300);
    }
    if (backdrop) {
        backdrop.classList.remove('onboarding-backdrop--visible');
        setTimeout(function () { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); }, 300);
    }
    if (onboardingReturnFocus && typeof onboardingReturnFocus.focus === 'function') {
        try { onboardingReturnFocus.focus(); } catch (_) { /* ignore */ }
    }
    onboardingReturnFocus = null;
    showToast('Daszek gotowy do pracy', 'success');
}

/* ═══════════════════════════════════════════════════════════════════
   Agent Chat View — production chat interface
   ═══════════════════════════════════════════════════════════════════ */

/* ── Extensibility: Message Action Registry ────────────────────────
 * Register a new action in chatMessageActions to extend per-message UI.
 * Each entry: { render: function(msg, state), position: 'after'|'before'|'footer' }
 */
/** @type {Object<string, {render: function(Object): string, position: string}>} */
const chatMessageActions = {
    copy: { render: renderChatCopyButton, position: 'after' },
    feedback: { render: renderChatFeedbackButtons, position: 'after' },
    regenerate: { render: renderChatRegenerateButton, position: 'after' },
    variants: { render: renderChatVariantSelector, position: 'footer' },
};

/* ── Session ID ─────────────────────────────────────────────────── */
function getOrCreateChatSessionId() {
    let sid = localStorage.getItem('daszek-chat-session-id');
    if (!sid) {
        sid = crypto.randomUUID ? crypto.randomUUID() : 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem('daszek-chat-session-id', sid);
    }
    return sid;
}

/**
 * Converts markdown text to safe HTML.
 * Supports: h1-h4, bold, italic, strikethrough, inline code, fenced code blocks,
 * blockquotes, links, unordered/ordered/task lists, tables, hr, emoji shortcodes.
 * Pure function — no DOM access, fully testable.
 * @param {string} text
 * @returns {string}
 */
function renderMarkdown(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    let html = div.innerHTML;

    // Preserve fenced code blocks
    var codeBlocks = [];
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, function (_, lang, code) {
        var key = '%%CODEBLOCK_' + codeBlocks.length + '%%';
        codeBlocks.push({ lang: lang, code: code });
        return key;
    });

    // Headers h1-h4
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Horizontal rules
    html = html.replace(/^(---|\*\*\*|___)\s*$/gm, '<hr>');

    // Blockquotes
    html = html.replace(/^&gt;\s*(.+)$/gm, '<blockquote>$1</blockquote>');

    // Tables
    html = html.replace(/\n\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)*)/g, function (_, header, body) {
        var headers = header.split('|').map(function (c) { return c.trim(); }).filter(Boolean);
        var rows = body.trim().split('\n').map(function (row) {
            var cells = row.split('|').map(function (c) { return c.trim(); }).filter(Boolean);
            return '<tr>' + cells.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>';
        }).join('');
        return '<table><thead><tr>' + headers.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' + rows + '</tbody></table>';
    });

    // Task lists: - [x] done, - [ ] todo
    html = html.replace(/^[\s]*[-*]\s+\[([ xX])\]\s+(.+)$/gm, function (_, checked, label) {
        var c = (checked === 'x' || checked === 'X') ? ' checked' : '';
        return '<li class="task-list-item"><input type="checkbox" disabled' + c + '> ' + label + '</li>';
    });

    // Unordered lists
    html = html.replace(/^[\s]*[-*]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, function (m) { return '<ul>' + m + '</ul>'; });

    // Ordered lists
    html = html.replace(/^[\s]*\d+\.\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, function (m) { return '<ol>' + m + '</ol>'; });

    // Merge adjacent blockquotes
    html = html.replace(/<\/blockquote>\n?<blockquote>/g, '\n');

    // Strikethrough
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

    // Bold + italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Links (allowlisted schemes only)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, label, href) {
        const safeHref = sanitizeMarkdownHref(href);
        if (!safeHref) {
            return escapeHtml(label);
        }
        return '<a href="' + escapeHtml(safeHref) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(label) + '</a>';
    });

    // Emoji shortcodes
    html = html.replace(/:(\w+):/g, function (_, name) {
        var m = {
            smile: '\u{1F60A}', fire: '\u{1F525}', ok: '\u{1F44C}', check: '\u2705', x: '\u274C',
            warning: '\u26A0\uFE0F', info: '\u2139\uFE0F', question: '\u2753', bulb: '\uD83D\uDCA1',
            star: '\u2B50', heart: '\u2764\uFE0F', thumbsup: '\uD83D\uDC4D', thumbsdown: '\uD83D\uDC4E',
            clock: '\uD83D\uDD50', alert: '\uD83D\uDEA8', robot: '\uD83E\uDD16', wave: '\uD83D\uDC4B',
            folder: '\uD83D\uDCC1', file: '\uD83D\uDCC4', search: '\uD83D\uDD0D', mail: '\u2709\uFE0F',
            phone: '\uD83D\uDCDE', calendar: '\uD83D\uDCC5', chart: '\uD83D\uDCCA', gear: '\u2699\uFE0F',
            lock: '\uD83D\uDD12', unlock: '\uD83D\uDD13', key: '\uD83D\uDD11', link: '\uD83D\uDD17',
            zap: '\u26A1', bug: '\uD83D\uDC1B', rocket: '\uD83D\uDE80', party: '\uD83C\uDF89'
        };
        return m[name] || ':' + name + ':';
    });

    // Paragraphs and line breaks
    html = html.replace(/\n\n+/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');

    if (!/^<(h[1-4]|ul|ol|pre|blockquote|table|hr|p|li)/.test(html)) {
        html = '<p>' + html + '</p>';
    }

    // Restore code blocks with proper HTML escaping
    for (var ci = 0; ci < codeBlocks.length; ci++) {
        var cb = codeBlocks[ci];
        var langClass = cb.lang ? ' class="language-' + escapeHtml(cb.lang) + '"' : '';
        var esc = document.createElement('div');
        esc.textContent = cb.code;
        html = html.replace('%%CODEBLOCK_' + ci + '%%', '<pre' + langClass + '><code>' + esc.innerHTML + '</code></pre>');
    }

    return html;
}

/* ── Format timestamp ────────────────────────────────────────────── */
function chatFormatTime(iso) {
    if (!iso) return '';
    try {
        var d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return '';
    }
}

/* ── UUID for turn IDs ───────────────────────────────────────────── */
function chatTurnId() {
    return 'turn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

/* ── Structured logging ───────────────────────────────────────────── */
/**
 * Log a chat telemetry event. In production these would feed a metrics pipeline.
 * @param {string} event
 * @param {Object} [data]
 */
function chatLog(event, data) {
    if (typeof console.info === 'function') {
        console.info('[CHAT]', event, data || '');
    }
}

/* ── Start chat view load ───────────────────────────────────────── */
var chatViewRequestId = 0;

function startChatViewLoad() {
    var root = document.getElementById('view-root');
    if (!root) return;

    var requestId = ++chatViewRequestId;

    // Get or create session
    state.agentChat.sessionId = getOrCreateChatSessionId();
    state.agentChat.loadError = null;
    state.agentChat.loading = true;

    // Store scroll position restoration
    var prevScrollTop = root.scrollTop || 0;

    // Render chat shell
    renderChatShell();

    // Restore messages from state (if returning to chat view)
    renderChatMessages();

    // Auto-brief if no messages yet
    if (!state.agentChat.hasBriefed && state.agentChat.messages.length === 0) {
        state.agentChat.loading = false;
        sendChatBrief();
    } else {
        state.agentChat.loading = false;
        scrollChatToBottom();
    }
}

/* ── Render Chat Shell ──────────────────────────────────────────── */
function renderChatShell() {
    var root = document.getElementById('view-root');
    if (!root) return;

    var messages = state.agentChat.messages.map(function (m) { return renderChatMessageHtml(m); }).join('');
    var emptyClass = state.agentChat.messages.length === 0 ? '' : ' ds-hidden';
    var suggestionsHtml = state.agentChat.messages.length === 0 ? renderChatSuggestions() : '';

    root.innerHTML = wrapDaszekViewShell(['Czat'], `
        <div id="chat-shell" class="chat-shell">
            <div class="chat-case-selector">
                <label for="chat-case-select">Kontekst:</label>
                <select id="chat-case-select">
                    <option value="">Ogolny (bez sprawy)</option>
                </select>
            </div>
            <div class="chat-messages" id="chat-messages">
                ${messages}
                <div class="chat-scroll-anchor" id="chat-scroll-anchor"></div>
            </div>
            <div class="chat-suggestions${emptyClass}" id="chat-suggestions">${suggestionsHtml}</div>
            <div class="chat-input-row">
                <textarea class="chat-input-field" id="chat-input" placeholder="Napisz wiadomosc do agenta..." rows="1"></textarea>
                <button class="chat-send-btn" id="chat-send-btn" data-tooltip="Wyslij (Enter)">&#10148;</button>
            </div>
        </div>
    `);

    // Bind events
    bindChatEvents();
    populateChatCaseSelect();

    // Scroll to bottom after render
    setTimeout(scrollChatToBottom, 50);
}

function populateChatCaseSelect() {
    var select = document.getElementById('chat-case-select');
    if (!select) return;
    var feed = getOperationalFeed();
    var caseMap = {};
    if (feed && Array.isArray(feed.cases)) {
        feed.cases.forEach(function (c) {
            var id = String(c.case_id || c.id || '').trim();
            if (!id) return;
            caseMap[id] = c;
        });
    }
    if (feed) {
        iterOperationalFeedDeskLikeItems(feed).forEach(function (row) {
            var id = String(row.case_id || '').trim();
            if (!id || caseMap[id]) return;
            caseMap[id] = {
                case_id: id,
                title: row.title || row.subject || row.note_title || '',
                subject: row.subject || '',
                status: row.status || row.desk_status || '',
            };
        });
    }
    var cases = Object.keys(caseMap).map(function (id) { return caseMap[id]; });
    cases.sort(function (a, b) {
        return String(a.title || a.subject || a.case_id || '').localeCompare(String(b.title || b.subject || b.case_id || ''), 'pl');
    });
    var stored = '';
    try { stored = localStorage.getItem('daszek-chat-case-id') || ''; } catch (_) { stored = ''; }
    var selected = state.agentChat.currentCaseId || stored || '';
    if (selected && !caseMap[selected]) {
        selected = '';
        state.agentChat.currentCaseId = '';
        try { localStorage.removeItem('daszek-chat-case-id'); } catch (_) { /* ignore */ }
    } else if (selected) {
        state.agentChat.currentCaseId = selected;
    }
    var html = '<option value="">Ogolny (bez sprawy)</option>';
    cases.slice(0, 50).forEach(function (c) {
        var id = String(c.case_id || c.id || '').trim();
        if (!id) return;
        var labelBase = String(c.title || c.subject || id).slice(0, 48);
        var status = String(c.status || c.case_status || '').trim();
        var label = status ? (labelBase + ' [' + status + ']') : labelBase;
        html += '<option value="' + escapeHtml(id) + '"' + (id === selected ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
    });
    select.innerHTML = html;
    select.onchange = function () {
        state.agentChat.currentCaseId = select.value || '';
        try {
            if (state.agentChat.currentCaseId) {
                localStorage.setItem('daszek-chat-case-id', state.agentChat.currentCaseId);
            } else {
                localStorage.removeItem('daszek-chat-case-id');
            }
        } catch (_) { /* ignore */ }
    };
}

/* ── Render suggestions chips (teaching empty state) ────────────── */
function renderChatSuggestions() {
    var chips = [
        { text: 'Przeglad na dzis', prompt: 'Co dzisiaj w firmie?' },
        { text: 'Pokaz wszystkie aktywne sprawy', prompt: 'Pokaz wszystkie aktywne sprawy' },
        { text: 'Jakie decyzje czekaja na mnie?', prompt: 'Jakie decyzje czekaja na mnie?' },
        { text: 'Stan techniczny systemu', prompt: 'Pokaz stan systemu' },
    ];
    return chips.map(function (c) {
        return '<span class="chat-suggestion-chip" data-action="suggest" data-prompt="' + escapeHtml(c.prompt) + '">' + escapeHtml(c.text) + '</span>';
    }).join('');
}

/* ── Render a single message HTML ───────────────────────────────── */
function renderChatMessageHtml(msg) {
    if (!msg) return '';
    var roleClass = msg.role === 'user' ? 'chat-message--user' : (msg.role === 'error' ? 'chat-message--error' : 'chat-message--agent');
    var roleLabel = msg.role === 'user' ? 'Ty' : 'Agent';
    var roleSpanClass = msg.role === 'user' ? 'chat-message-role--user' : '';
    var time = chatFormatTime(msg.timestamp);
    var contentHtml = renderMarkdown(msg.content || '');
    var isStreaming = msg._streaming || false;
    var thinkingHtml = renderChatThinking(msg);
    var proposalsHtml = renderChatProposals(msg);
    var actionsHtml = renderChatMessageActions(msg);

    var typingIndicator = isStreaming ? '<div class="chat-typing"><span class="chat-typing-dot"></span><span class="chat-typing-dot"></span><span class="chat-typing-dot"></span></div>' : '';

    var stoppedNote = msg._stopped ? '<div class="chat-stopped-note">Generowanie zatrzymane przez operatora.</div>' : '';

    return '<div class="chat-message ' + roleClass + '" data-turn-id="' + escapeHtml(msg.turnId || '') + '">' +
        '<div class="chat-message-header">' +
        '<span class="chat-message-role ' + roleSpanClass + '">' + escapeHtml(roleLabel) + '</span>' +
        '<span class="chat-message-time">' + escapeHtml(time) + '</span>' +
        '</div>' +
        thinkingHtml +
        '<div class="chat-markdown">' + contentHtml + '</div>' +
        typingIndicator +
        stoppedNote +
        proposalsHtml +
        actionsHtml +
        '</div>';
}

/* ── Thinking indicator ──────────────────────────────────────────── */
function renderChatThinking(msg) {
    if (!msg._thinking) return '';
    var expandedAttr = msg._thinkingExpanded ? '' : ' style="display:none"';
    return '<div class="chat-message-thinking" role="button" tabindex="0" aria-expanded="' + (msg._thinkingExpanded ? 'true' : 'false') + '">' +
        '<div class="chat-thinking-summary">' +
        '<span>&#9881; Agent analizuje...</span>' +
        '<span style="margin-left:auto;font-size:var(--font-sm)">pokaż szczegoly</span></div>' +
        '<div class="chat-thinking-detail"' + expandedAttr + '>' +
        '<p class="detail-muted">' + escapeHtml(msg._thinkingDetail || 'Przetwarzanie zapytania...') + '</p></div></div>';
}
/* ── Proposals display ───────────────────────────────────────────── */
function renderChatProposals(msg) {
    if (!msg.proposals || msg.proposals.length === 0) return '';
    var items = msg.proposals.map(function (p) {
        return '<div class="chat-proposal-item">' +
            '<span class="chat-proposal-type">' + escapeHtml(p.proposal_type || 'akcja') + '</span>' +
            '<span class="chat-proposal-status">' + escapeHtml(p.status || 'proponowane') + '</span>' +
            '<span class="chat-proposal-actions">' +
            '<button class="chat-proposal-btn chat-proposal-btn--approve" data-action="proposal-approve" data-proposal-id="' + escapeHtml(p.proposal_id || '') + '">Zatwierdz</button>' +
            '<button class="chat-proposal-btn chat-proposal-btn--reject" data-action="proposal-reject" data-proposal-id="' + escapeHtml(p.proposal_id || '') + '">Odrzuc</button>' +
            '</span></div>';
    }).join('');
    return '<div class="chat-proposal-bar"><h4>Agent proponuje:</h4>' + items + '</div>';
}

/* ── Message actions (from registry) ─────────────────────────────── */
function renderChatMessageActions(msg) {
    var actionKeys = Object.keys(chatMessageActions);
    if (actionKeys.length === 0 || msg.role !== 'agent' || msg._streaming) return '';

    var afterButtons = actionKeys.map(function (key) {
        var action = chatMessageActions[key];
        if (action.position !== 'after') return '';
        return action.render(msg);
    }).filter(Boolean).join('');

    var footerItems = actionKeys.map(function (key) {
        var action = chatMessageActions[key];
        if (action.position !== 'footer') return '';
        return action.render(msg);
    }).filter(Boolean).join('');

    if (!afterButtons && !footerItems) return '';
    var html = '';
    if (afterButtons) html += '<div class="chat-message-actions">' + afterButtons + '</div>';
    if (footerItems) html += '<div class="chat-message-footer">' + footerItems + '</div>';
    return html;
}

/* ── Feedback buttons ────────────────────────────────────────────── */
function renderChatFeedbackButtons(msg) {
    var turnId = msg.turnId || '';
    var upActive = msg._feedback === 'thumbs_up' ? ' chat-action-btn--active-thumbs-up' : '';
    var downActive = msg._feedback === 'thumbs_down' ? ' chat-action-btn--active-thumbs-down' : '';
    return '<button class="chat-action-btn' + upActive + '" data-action="thumbs-up" data-turn-id="' + escapeHtml(turnId) + '" data-tooltip="Przydatne">&#128077;</button>' +
        '<button class="chat-action-btn' + downActive + '" data-action="thumbs-down" data-turn-id="' + escapeHtml(turnId) + '" data-tooltip="Nieprzydatne">&#128078;</button>';
}

/* ── Copy button (premium UX) ─────────────────────────────────────── */
function renderChatCopyButton(msg) {
    return '<button class="chat-action-btn" data-action="copy-message" data-turn-id="' + escapeHtml(msg.turnId || '') + '" data-tooltip="Kopiuj tresc" aria-label="Kopiuj tresc">' +
        '<span class="chat-action-icon">&#128203;</span> Kopiuj</button>';
}

function renderChatRegenerateButton(msg) {
    return '<button class="chat-action-btn" data-action="regenerate-message" data-turn-id="' + escapeHtml(msg.turnId || '') + '" data-tooltip="Wygeneruj ponownie" aria-label="Wygeneruj ponownie"><span class="chat-action-icon">&#8635;</span></button>';
}

function renderChatVariantSelector(msg) {
    return '<div class="chat-variant-picker" role="group" aria-label="Warianty odpowiedzi">' +
        '<button type="button" class="chat-action-btn chat-variant-btn" data-action="variant-tone" data-turn-id="' + escapeHtml(msg.turnId || '') + '" data-variant="krotko" data-tooltip="Wersja krotsza" aria-label="Wersja krotsza">Krocej</button>' +
        '<button type="button" class="chat-action-btn chat-variant-btn" data-action="variant-tone" data-turn-id="' + escapeHtml(msg.turnId || '') + '" data-variant="szczegolowo" data-tooltip="Wersja szczegolowa" aria-label="Wersja szczegolowa">Szczegolowo</button>' +
        '<button type="button" class="chat-action-btn chat-variant-btn" data-action="variant-tone" data-turn-id="' + escapeHtml(msg.turnId || '') + '" data-variant="formalnie" data-tooltip="Ton formalny" aria-label="Ton formalny">Formalnie</button>' +
        '</div>';
}

function findPrecedingUserMessage(agentTurnId) {
    var msgs = state.agentChat.messages;
    var idx = -1;
    for (var i = 0; i < msgs.length; i++) {
        if (msgs[i].turnId === agentTurnId) { idx = i; break; }
    }
    if (idx <= 0) return null;
    for (var j = idx - 1; j >= 0; j--) {
        if (msgs[j].role === 'user') return msgs[j];
    }
    return null;
}

function removeChatMessageFromDom(turnId) {
    var container = document.getElementById('chat-messages');
    if (!container) return;
    var el = container.querySelector('[data-turn-id="' + turnId + '"]');
    if (el && el.parentNode) el.parentNode.removeChild(el);
}

function chatRegenerateResponse(agentTurnId) {
    var userMsg = findPrecedingUserMessage(agentTurnId);
    if (!userMsg || !userMsg.content) {
        showToast('Brak poprzedniej wiadomosci uzytkownika.', 'error');
        return;
    }
    removeChatMessageFromDom(agentTurnId);
    state.agentChat.messages = state.agentChat.messages.filter(function (m) { return m.turnId !== agentTurnId; });
    sendChatMessage(userMsg.content);
}

function chatApplyVariant(agentTurnId, variant) {
    var userMsg = findPrecedingUserMessage(agentTurnId);
    if (!userMsg || !userMsg.content) {
        showToast('Brak poprzedniej wiadomosci uzytkownika.', 'error');
        return;
    }
    var prompts = {
        krotko: 'Odpowiedz krocej i bardziej zwiezle na: ' + userMsg.content,
        szczegolowo: 'Odpowiedz szczegolowo, z kontekstem sprawy, na: ' + userMsg.content,
        formalnie: 'Odpowiedz formalnym tonem biznesowym na: ' + userMsg.content,
    };
    var prompt = prompts[variant] || userMsg.content;
    removeChatMessageFromDom(agentTurnId);
    state.agentChat.messages = state.agentChat.messages.filter(function (m) { return m.turnId !== agentTurnId; });
    sendChatMessage(prompt);
}

function chatCopyMessage(turnId) {
    var msg = findChatMessage(turnId);
    if (!msg || !msg.content) return;
    var text = msg.content;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
            chatLog('copy_success', { turnId: turnId, length: text.length });
        }).catch(function () { fallbackCopy(text); });
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (_) { /* noop */ }
    document.body.removeChild(ta);
}

/* ── Chat event bindings ─────────────────────────────────────────── */
function bindChatEvents() {
    var shell = document.getElementById('chat-shell');
    if (!shell) return;

    var input = document.getElementById('chat-input');
    if (input) {
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); }
            if (e.key === 'Escape' && state.agentChat.isStreaming) { stopChatGeneration(); }
        });
        input.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });
    }

    // Event delegation for all interactive elements
    shell.addEventListener('click', function (e) {
        var t = e.target;

        if (t.id === 'chat-send-btn') {
            e.preventDefault();
            if (state.agentChat.isStreaming) stopChatGeneration(); else handleChatSend();
            return;
        }

        var chip = t.closest('[data-action="suggest"]');
        if (chip) { e.preventDefault(); sendChatMessage(chip.getAttribute('data-prompt')); return; }

        var thinkingEl = t.closest('.chat-message-thinking');
        if (thinkingEl) {
            e.preventDefault();
            var detail = thinkingEl.querySelector('.chat-thinking-detail');
            if (detail) detail.style.display = detail.style.display === 'none' ? '' : 'none';
            return;
        }

        var uBtn = t.closest('[data-action="thumbs-up"]');
        if (uBtn) { e.preventDefault(); chatFeedback(uBtn.getAttribute('data-turn-id'), 'thumbs_up'); return; }

        var dBtn = t.closest('[data-action="thumbs-down"]');
        if (dBtn) { e.preventDefault(); chatFeedback(dBtn.getAttribute('data-turn-id'), 'thumbs_down'); return; }

        var fbSend = t.closest('[data-action="feedback-send"]');
        if (fbSend) { e.preventDefault(); var w = fbSend.closest('.chat-feedback-reason-wrapper'); if (w) sendFeedbackReasonFromWrapper(w); return; }

        var appBtn = t.closest('[data-action="proposal-approve"]');
        if (appBtn) { e.preventDefault(); chatApproveProposal(appBtn, appBtn.getAttribute('data-proposal-id') || ''); return; }

        var rejBtn = t.closest('[data-action="proposal-reject"]');
        if (rejBtn) { e.preventDefault(); chatRejectProposal(rejBtn, rejBtn.getAttribute('data-proposal-id') || ''); return; }

        var copyBtn = t.closest('[data-action="copy-message"]');
        if (copyBtn) { e.preventDefault(); chatCopyMessage(copyBtn.getAttribute('data-turn-id') || ''); return; }

        var regenBtn = t.closest('[data-action="regenerate-message"]');
        if (regenBtn) { e.preventDefault(); chatRegenerateResponse(regenBtn.getAttribute('data-turn-id') || ''); return; }

        var variantBtn = t.closest('[data-action="variant-tone"]');
        if (variantBtn) {
            e.preventDefault();
            chatApplyVariant(variantBtn.getAttribute('data-turn-id') || '', variantBtn.getAttribute('data-variant') || '');
            return;
        }

        var scrollHint = t.closest('[data-action="scroll-down"]');
        if (scrollHint) { e.preventDefault(); scrollChatToBottomSmooth(); return; }
    });

    // Smart scroll: detect scroll-up, show hint
    var msgC = document.getElementById('chat-messages');
    if (msgC) {
        msgC.addEventListener('scroll', function () {
            var threshold = 100;
            var atBottom = (msgC.scrollHeight - msgC.scrollTop - msgC.clientHeight) < threshold;
            var hint = document.getElementById('chat-scroll-hint');
            if (!atBottom) {
                if (!hint) {
                    var h = document.createElement('div');
                    h.id = 'chat-scroll-hint';
                    h.className = 'chat-scroll-hint';
                    h.setAttribute('data-action', 'scroll-down');
                    h.textContent = 'Nowe wiadomosci ponizej. Kliknij, by przewinac.';
                    msgC.parentNode.appendChild(h);
                    setTimeout(function () { h.classList.add('chat-scroll-hint--visible'); }, 50);
                }
            } else if (hint) {
                hint.classList.remove('chat-scroll-hint--visible');
                setTimeout(function () { if (hint && hint.parentNode) hint.parentNode.removeChild(hint); }, 300);
            }
        });
    }
    enhanceAccessibleTooltips(shell);
}

/* ── Handle send: route to brief or message ──────────────────────── */
function handleChatSend() {
    var input = document.getElementById('chat-input');
    if (!input) return;
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    input.style.height = 'auto';
    sendChatMessage(text);
}

/* ── Send a chat message (sync, with streaming) ──────────────────── */
function sendChatMessage(userInput) {
    if (!userInput || state.agentChat.isStreaming) return;

    state.agentChat.isStreaming = true;
    state.agentChat.hasBriefed = true;

    var sessionId = state.agentChat.sessionId;
    var caseId = state.agentChat.currentCaseId || '';
    var controller = new AbortController();
    state.agentChat.abortController = controller;

    var turnId = chatTurnId();
    var userMsg = { role: 'user', content: userInput, timestamp: new Date().toISOString(), turnId: turnId, proposals: [], _streaming: false };
    state.agentChat.messages.push(userMsg);
    appendChatMessageToDom(userMsg);

    var agentTurnId = chatTurnId();
    var agentMsg = { role: 'agent', content: '', timestamp: new Date().toISOString(), turnId: agentTurnId, proposals: [], _streaming: true, _thinking: true, _thinkingDetail: 'Laczenie z agentem...' };
    state.agentChat.messages.push(agentMsg);
    appendChatMessageToDom(agentMsg);

    updateChatSendBtn(true);
    scrollChatToBottom();

    var payload = { user_input: userInput, session_id: sessionId };
    if (caseId) payload.case_id = caseId;

    var url = buildApiUrl(V3_API_BASE, '/agent-chat/stream', 'POST');
    chatLog('send', { inputLength: userInput.length, sessionId: sessionId });

    // Fetch timeout: 30s
    var fetchTimeout = setTimeout(function () {
        controller.abort();
        markChatStopped(agentTurnId);
        setChatError('Przekroczono czas oczekiwania na odpowiedz agenta (30s).');
        chatLog('timeout', { turnId: agentTurnId });
    }, 30000);

    fetch(url, {
        method: 'POST',
        headers: buildApiHeaders('POST'),
        body: JSON.stringify(payload),
        signal: controller.signal,
        credentials: 'same-origin',
    })
        .then(function (response) {
            if (!response.ok) { clearTimeout(fetchTimeout); throw new Error('Agent niedostepny (HTTP ' + response.status + ')'); }
            var reader = response.body.getReader();
            var decoder = new TextDecoder();
            var buffer = '';
            function readStream() {
                reader.read().then(function (result) {
                    if (result.done) {
                        clearTimeout(fetchTimeout);
                        finalizeChatMessage(agentTurnId);
                        chatLog('stream_complete', { turnId: agentTurnId });
                        return;
                    }
                    clearTimeout(fetchTimeout);
                    buffer += decoder.decode(result.value, { stream: true });
                    var lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    for (var i = 0; i < lines.length; i++) {
                        var line = lines[i];
                        if (line.startsWith('event: ')) {
                            var eventType = line.slice(7).trim();
                            if (i + 1 < lines.length && lines[i + 1].startsWith('data: ')) {
                                try { handleSseEvent(eventType, JSON.parse(lines[i + 1].slice(6).trim()), agentTurnId); } catch (_) { }
                                i++;
                            }
                        } else if (line.startsWith('data: ')) {
                            try { handleSseEvent('data', JSON.parse(line.slice(6).trim()), agentTurnId); } catch (_) { appendChatContent(agentTurnId, line); }
                        }
                    }
                    readStream();
                }).catch(function (err) {
                    clearTimeout(fetchTimeout);
                    if (err.name === 'AbortError') markChatStopped(agentTurnId); else setChatError(err.message || 'Blad strumienia');
                });
            }
            readStream();
        })
        .catch(function (err) {
            clearTimeout(fetchTimeout);
            if (err.name === 'AbortError') markChatStopped(agentTurnId); else setChatError(err.message || 'Blad polaczenia z agentem');
        });
}

/* ── Handle SSE events ───────────────────────────────────────────── */
function handleSseEvent(eventType, data, agentTurnId) {
    switch (eventType) {
        case 'status':
            if (data.phase && data.status === 'thinking') {
                updateChatThinking(agentTurnId, data.phase);
            }
            break;
        case 'turn':
            if (data.content) {
                appendChatContent(agentTurnId, data.content);
            } else if (data.role === 'assistant' && data.content) {
                appendChatContent(agentTurnId, data.content);
            }
            break;
        case 'done':
            if (data.proposals) {
                updateChatProposals(agentTurnId, data.proposals);
            }
            if (data.session_id) {
                state.agentChat.sessionId = data.session_id;
                localStorage.setItem('daszek-chat-session-id', data.session_id);
            }
            finalizeChatMessage(agentTurnId);
            break;
        case 'error':
            setChatError(data.error || 'Blad serwera agenta');
            break;
        default:
            // Unknown event type — try content
            if (data.content) {
                appendChatContent(agentTurnId, data.content);
            } else if (typeof data === 'string') {
                appendChatContent(agentTurnId, data);
            }
            break;
    }
}

/* ── Append content to streaming message ─────────────────────────── */
function appendChatContent(turnId, content) {
    var msg = findChatMessage(turnId);
    if (!msg) return;

    // Check for proposal data
    try {
        var parsed = typeof content === 'string' ? JSON.parse(content) : content;
        if (parsed.proposals) {
            msg.proposals = parsed.proposals;
        }
        if (parsed.content) {
            content = parsed.content;
        }
        if (parsed.agent_turns && parsed.agent_turns !== undefined) {
            msg._agentTurns = parsed.agent_turns;
        }
        if (parsed.hitl_required !== undefined) {
            state.agentChat.hitlRequired = parsed.hitl_required;
        }
    } catch (e) {
        // Not JSON, treat as raw content
    }

    var textContent = typeof content === 'string' ? content : '';
    msg.content += textContent;
    msg._thinking = false;

    updateChatMessageDom(turnId, msg);
    scrollChatToBottom();
}

/* ── Update thinking status ──────────────────────────────────────── */
function updateChatThinking(turnId, phase) {
    var msg = findChatMessage(turnId);
    if (!msg) return;
    var phaseLabels = {
        loading_context: 'Wczytywanie kontekstu...',
        gathering_context: 'Zbieranie informacji...',
        thinking: 'Agent analizuje...',
    };
    msg._thinkingDetail = phaseLabels[phase] || 'Przetwarzanie: ' + phase;
    updateChatMessageDom(turnId, msg);
}

/* ── Update proposals for a message ──────────────────────────────── */
function updateChatProposals(turnId, proposals) {
    var msg = findChatMessage(turnId);
    if (!msg || !proposals) return;
    msg.proposals = proposals;
    updateChatMessageDom(turnId, msg);
}

/* ── Finalize message (streaming complete) ───────────────────────── */
function finalizeChatMessage(turnId) {
    var msg = findChatMessage(turnId);
    if (!msg) return;
    msg._streaming = false;
    msg._thinking = false;
    updateChatMessageDom(turnId, msg);
    state.agentChat.isStreaming = false;
    state.agentChat.abortController = null;
    updateChatSendBtn(false);
    scrollChatToBottom();
}

/* ── Mark message as stopped ─────────────────────────────────────── */
function markChatStopped(turnId) {
    var msg = findChatMessage(turnId);
    if (!msg) return;
    msg._streaming = false;
    msg._thinking = false;
    msg._stopped = true;
    updateChatMessageDom(turnId, msg);
    state.agentChat.isStreaming = false;
    state.agentChat.abortController = null;
    updateChatSendBtn(false);
}

/* ── Set chat error ──────────────────────────────────────────────── */
function setChatError(errorText) {
    state.agentChat.isStreaming = false;
    state.agentChat.abortController = null;
    updateChatSendBtn(false);
    state.agentChat.messages.push({
        role: 'error', content: errorText || 'Nieznany blad',
        timestamp: new Date().toISOString(), turnId: chatTurnId(),
        proposals: [], _streaming: false,
    });
    appendChatMessageToDom(state.agentChat.messages[state.agentChat.messages.length - 1]);
    scrollChatToBottom();
    chatLog('error', { error: errorText });
}

/* ── Stop generation ─────────────────────────────────────────────── */
function stopChatGeneration() {
    if (!state.agentChat.abortController) return;
    state.agentChat.abortController.abort();
    chatLog('user_stopped_generation', {});
}

/* ── Update send button icon ─────────────────────────────────────── */
function updateChatSendBtn(isStreaming) {
    var btn = document.getElementById('chat-send-btn');
    if (!btn) return;
    if (isStreaming) {
        btn.innerHTML = '&#9632;';
        btn.className = 'chat-send-btn chat-send-btn--stop';
        btn.title = 'Zatrzymaj (Esc)';
    } else {
        btn.innerHTML = '&#10148;';
        btn.className = 'chat-send-btn';
        btn.title = 'Wyslij (Enter)';
    }
}

/* ── Find message in state by turnId ─────────────────────────────── */
function findChatMessage(turnId) {
    for (var i = 0; i < state.agentChat.messages.length; i++) {
        if (state.agentChat.messages[i].turnId === turnId) {
            return state.agentChat.messages[i];
        }
    }
    return null;
}

/* ── Append message to DOM ───────────────────────────────────────── */
function appendChatMessageToDom(msg) {
    var container = document.getElementById('chat-messages');
    if (!container) return;
    var html = renderChatMessageHtml(msg);
    var wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    var el = wrapper.firstElementChild;
    if (el) {
        el.dataset.turnId = msg.turnId || '';
        container.insertBefore(el, document.getElementById('chat-scroll-anchor'));
    }
}

/* ── Update message DOM in place ─────────────────────────────────── */
function updateChatMessageDom(turnId, msg) {
    var container = document.getElementById('chat-messages');
    if (!container) return;
    var existing = container.querySelector('[data-turn-id="' + turnId + '"]');
    if (!existing) return;
    var html = renderChatMessageHtml(msg);
    var wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    var newEl = wrapper.firstElementChild;
    if (newEl) {
        existing.replaceWith(newEl);
    }
}

/* ── Render all messages from state ──────────────────────────────── */
function renderChatMessages() {
    var container = document.getElementById('chat-messages');
    if (!container) return;
    var msgs = state.agentChat.messages;
    var html = msgs.map(function (m) { return renderChatMessageHtml(m); }).join('');
    container.innerHTML = html + '<div class="chat-scroll-anchor" id="chat-scroll-anchor"></div>';
}

/* ── Auto-brief (first load) ─────────────────────────────────────── */
function sendChatBrief() {
    var sessionId = state.agentChat.sessionId;
    state.agentChat.isStreaming = true;
    state.agentChat.hasBriefed = true;

    var turnId = chatTurnId();
    var agentMsg = {
        role: 'agent', content: '',
        timestamp: new Date().toISOString(), turnId: turnId,
        proposals: [], _streaming: true, _thinking: true,
        _thinkingDetail: 'Przygotowywanie briefingu...',
    };
    state.agentChat.messages.push(agentMsg);
    appendChatMessageToDom(agentMsg);
    updateChatSendBtn(true);

    var url = buildApiUrl(V3_API_BASE, '/agent-chat', 'POST');

    fetch(url, {
        method: 'POST',
        headers: buildApiHeaders('POST'),
        body: JSON.stringify({ brief: true, session_id: sessionId }),
        credentials: 'same-origin',
    })
        .then(function (response) { return response.json(); })
        .then(function (data) {
            if (data.user_input) {
                agentMsg.content = data.user_input;
                state.agentChat.messages.splice(state.agentChat.messages.length - 1, 0, {
                    role: 'user', content: 'Przeglad na dzis',
                    timestamp: data.session_id ? new Date().toISOString() : '',
                    turnId: chatTurnId(), proposals: [], _streaming: false,
                });
            }
            if (data.proposals) agentMsg.proposals = data.proposals;
            agentMsg._streaming = false;
            agentMsg._thinking = false;
            updateChatMessageDom(turnId, agentMsg);
            state.agentChat.isStreaming = false;
            updateChatSendBtn(false);
            scrollChatToBottom();
            renderChatMessages();
            var suggestions = document.getElementById('chat-suggestions');
            if (suggestions) suggestions.classList.add('ds-hidden');
            chatLog('brief_done', { sessionId: sessionId, inputLength: (data.user_input || '').length });
        })
        .catch(function () {
            agentMsg._streaming = false;
            agentMsg._thinking = false;
            agentMsg.content = 'Dzien dobry! Jestem Twoim asystentem. Mozesz mnie pytac o sprawy, zadania, system albo wydawac polecenia.';
            updateChatMessageDom(turnId, agentMsg);
            state.agentChat.isStreaming = false;
            updateChatSendBtn(false);
        });
}

/* ── Feedback handler (uses delegation, no onclick) ──────────────── */
/**
 * @param {string} turnId
 * @param {string} rating - 'thumbs_up'|'thumbs_down'
 */
function chatFeedback(turnId, rating) {
    var sessionId = state.agentChat.sessionId;
    var url = buildApiUrl(V3_API_BASE, '/agent-chat/feedback', 'POST');

    fetch(url, {
        method: 'POST',
        headers: buildApiHeaders('POST'),
        body: JSON.stringify({ session_id: sessionId, turn_id: turnId, rating: rating, comment: '' }),
        credentials: 'same-origin',
    }).catch(function () { /* best-effort */ });

    // Visual: find all action buttons in this message and toggle
    var msgEl = document.querySelector('[data-turn-id="' + turnId + '"]');
    if (msgEl) {
        var allActionBtns = msgEl.querySelectorAll('[data-action="thumbs-up"], [data-action="thumbs-down"]');
        allActionBtns.forEach(function (b) { b.className = 'chat-action-btn'; });
        var btn = msgEl.querySelector('[data-action="' + (rating === 'thumbs_up' ? 'thumbs-up' : 'thumbs-down') + '"]');
        if (btn) {
            btn.classList.add('chat-action-btn--active');
            btn.classList.add(rating === 'thumbs_up' ? 'chat-action-btn--active-thumbs-up' : 'chat-action-btn--active-thumbs-down');
        }
    }

    var msg = findChatMessage(turnId);
    if (msg) msg._feedback = rating;
    chatLog('feedback', { turnId: turnId, rating: rating });

    // If thumbs-down, show reason textarea
    if (rating === 'thumbs_down' && msgEl) {
        var actions = msgEl.querySelector('.chat-message-actions');
        if (actions && !actions.querySelector('.chat-feedback-reason-wrapper')) {
            var wrapper = document.createElement('div');
            wrapper.className = 'chat-feedback-reason-wrapper';
            wrapper.innerHTML =
                '<textarea class="chat-feedback-reason" placeholder="Co bylo nie tak? (opcjonalnie)" rows="2"></textarea>' +
                '<button class="chat-feedback-send" data-action="feedback-send">Wyslij</button>';
            actions.appendChild(wrapper);
        }
    }
}

/**
 * @param {Element} wrapper - .chat-feedback-reason-wrapper
 */
function sendFeedbackReasonFromWrapper(wrapper) {
    var textarea = wrapper.querySelector('.chat-feedback-reason');
    if (!textarea) return;
    var reason = textarea.value.trim();
    if (!reason) { wrapper.parentNode.removeChild(wrapper); return; }

    var msgEl = wrapper.closest('[data-turn-id]');
    var turnId = msgEl ? msgEl.getAttribute('data-turn-id') : '';
    var url = buildApiUrl(V3_API_BASE, '/agent-chat/feedback', 'POST');
    fetch(url, {
        method: 'POST',
        headers: buildApiHeaders('POST'),
        body: JSON.stringify({
            session_id: state.agentChat.sessionId,
            turn_id: turnId,
            rating: 'thumbs_down',
            comment: reason,
        }),
        credentials: 'same-origin',
    }).catch(function () { });

    wrapper.innerHTML = '<p class="detail-muted" style="margin-top:var(--space-2);font-size:var(--font-sm)">Dziekuje za opinie.</p>';
    chatLog('feedback_reason', { turnId: turnId, reasonLength: reason.length });
}

/* ── Proposal handlers (enterprise: wired to real API) ───────────── */
/**
 * @param {Element} btn
 * @param {string} proposalId
 */
function chatApproveProposal(btn, proposalId) {
    if (!canCurrentUserDecideActionProposals()) {
        showError('Tę decyzję może zapisać tylko owner Daszka.');
        return;
    }
    btn.textContent = 'Zatwierdzanie...';
    btn.disabled = true;
    btn.classList.remove('chat-proposal-btn--approve');
    chatLog('proposal_approve_start', { proposalId: proposalId });

    approveProposalViaApi(proposalId, 'approve', 'Zatwierdzone z czatu agenta.')
        .then(function () {
            btn.textContent = 'Zatwierdzono';
            btn.style.borderColor = '#4caf50';
            btn.style.color = '#2e7d32';
            chatLog('proposal_approve_ok', { proposalId: proposalId });
        })
        .catch(function (err) {
            btn.textContent = 'Blad';
            btn.disabled = false;
            btn.classList.add('chat-proposal-btn--approve');
            btn.style.borderColor = '#d32f2f';
            btn.style.color = '#d32f2f';
            showError(err.message || 'Nie udalo sie zatwierdzic propozycji.');
            chatLog('proposal_approve_error', { proposalId: proposalId, error: err.message });
        });
}

/**
 * @param {Element} btn
 * @param {string} proposalId
 */
function chatRejectProposal(btn, proposalId) {
    if (!canCurrentUserDecideActionProposals()) {
        showError('Tę decyzję może zapisać tylko owner Daszka.');
        return;
    }
    btn.textContent = 'Odrzucanie...';
    btn.disabled = true;
    btn.classList.remove('chat-proposal-btn--reject');
    chatLog('proposal_reject_start', { proposalId: proposalId });

    apiFetch(V2_API_BASE, '/action-proposals/' + encodeURIComponent(proposalId) + '/reject', {
        method: 'POST',
        body: JSON.stringify({ reason: 'Odrzucone przez operatora z czatu.' }),
    })
        .then(function () {
            btn.textContent = 'Odrzucono';
            btn.style.borderColor = '#ef5350';
            btn.style.color = '#c62828';
            chatLog('proposal_reject_ok', { proposalId: proposalId });
        })
        .catch(function (err) {
            btn.textContent = 'Blad';
            btn.disabled = false;
            btn.classList.add('chat-proposal-btn--reject');
            btn.style.borderColor = '#d32f2f';
            btn.style.color = '#d32f2f';
            showError(err.message || 'Nie udalo sie odrzucic propozycji.');
            chatLog('proposal_reject_error', { proposalId: proposalId, error: err.message });
        });
}

/**
 * Best-effort lookup of engagement_id for a proposal.
 * @param {string} proposalId
 * @returns {string}
 */
function findEngagementIdForProposal(proposalId) {
    for (var i = 0; i < state.agentChat.messages.length; i++) {
        var m = state.agentChat.messages[i];
        if (m.proposals && Array.isArray(m.proposals)) {
            for (var j = 0; j < m.proposals.length; j++) {
                if (m.proposals[j].proposal_id === proposalId) {
                    return m.proposals[j].engagement_id || '';
                }
            }
        }
    }
    return '';
}

/* ── Scroll helpers ──────────────────────────────────────────────── */
function scrollChatToBottom() {
    var container = document.getElementById('chat-messages');
    if (!container) return;
    container.scrollTop = container.scrollHeight;
}

function scrollChatToBottomSmooth() {
    var container = document.getElementById('chat-messages');
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
}
