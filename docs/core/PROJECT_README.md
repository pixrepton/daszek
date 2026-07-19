# Daszek / TOP-INSTAL AI-OS — README produktu i developera (Node A)

> **Node B canonical:** [`../../../gmail-agent/`](../../../gmail-agent/) — Postgres i journal są SoT spraw oraz wykonania; Daszek jest projekcją operatorską.

**Status:** aktywny przewodnik po wtyczce WordPress `daszek`. **Wersja:** 2026-07-13.  
**Plugin:** 1.3.4 (`daszek.php`)  
**Stan żywy:** `../../../knowledge/memory/ACTIVE_WORKSPACE.md`  
**Proof:** [`../../../gmail-agent/docs/runbooks/LAST_PROVEN_STATE.md`](../../../gmail-agent/docs/runbooks/LAST_PROVEN_STATE.md)

Dokument opisuje UI, proxy, feed i bridge. Nie jest źródłem semantyki Case ani dowodem produkcyjnego deployu.

## 0. Stan na dziś (2026-07-13)

| Obszar | Status | Dowód |
| --- | --- | --- |
| Node A ↔ Node B critical loop | **PASS lokalnie** | LPS + integrated decision-loop proof |
| PHP proxy auth / CSRF | PASS | write proxy + Node B fail-closed auth |
| stabilny `decision_key` | PASS | proxy → bridge → Node B |
| send/reject replay safety | PASS | IDEMP-01 / IDEMP-02 |
| UI `accepted` vs final result | rozdzielone | DEC-01 |
| UI convergence | finalny sukces po fresh matching feed | DEC-01 |
| Daszek pytest | `8 passed` | proof 2026-07-13 |
| Node tests | `13 passed` | `test_row4b_note_hitl_approve.node.js` |
| JS/PHP syntax | PASS | `node --check`, `php -l` |
| Workspace gate | `exit 0` po recreate Node B | LPS |

**Lokalnie:** `http://127.0.0.1:8090/daszek/`. VPS/produkcja pozostają zawieszone.

## 1. Po co istnieje Daszek

Daszek to **panel operatorski TOP-INSTAL** (Node A, WordPress). Nie przechowuje prawdy o sprawach — **projektuje** stan z Node B (`gmail-agent`) i zbiera **feedback operatora** (HITL, bridge queue, notatki).

| Twierdzenie          | Prawda                                               |
| -------------------- | ---------------------------------------------------- |
| SoT sprawy           | Postgres `mailbox_memory` na Node B                  |
| Daszek               | Projekcja + overlay WP + bounded feedback            |
| LLM w UI             | Asystuje; nie wykonuje ryzykownych akcji bez approve |
| Daszek ≠ gmail-agent | Partnerzy HTTP; kontrakt feed v3 + proxy v2/v3       |

**Zasada D4 (closed):** zmiana semantyki feed / case w UI → najpierw Python (`gmail-agent/tools/gmail_audit/daszek_v3_operational_feed.py`), potem PHP storage i proxy.

---

## 2. Oś danych (Node A w ekosystemie)

```text
Node B: trwały Case / decision state / execution result
  → build + push operational feed v3
  → Daszek store-v3 JSONL
  → app.js render
  → operator click
  → PHP: session + CSRF + bearer + stable decision_key
  → Node B: received → accepted → executing → executed|rejected|outcome_unknown
  → completion / feed refresh
  → app.js odczytuje świeżą projekcję
  → matching decision_key + final status
  → converged UI confirmation
```

| Kierunek | Mechanizm | Gwarancja |
| --- | --- | --- |
| B → A feed | `post_v3_operational_feed_snapshot` | projekcja, nie execution proof |
| A → B read | PHP proxy GET | odczyt bez nadania write scope |
| A → B write | PHP proxy POST | session/CSRF/owner + bearer; Node B default-deny |
| A → B bridge | WP queue + `daszek-bridge-drain` | stabilny key, replay-safe completion |

## 3. Model mentalny developera

### Jedna aplikacja SPA

Operator widzi **jeden produkt** — `public/app.js` (~8060 linii). Widoki to **stany** `state.currentView`, nie osobne repozytoria.

| Widok (`data-view`) | Źródło danych                                    |
| ------------------- | ------------------------------------------------ |
| `desk`              | Feed v3 `desk` + `action_items`                  |
| `cases`             | Feed + opcjonalnie proxy `GET /cases` (Node B)   |
| `day`               | Feed sekcje dnia                                 |
| `cockpit`           | Feed + KPI / skróty operatorskie                 |
| `chat`              | `POST /agent-chat` (proxy), `state.agentChat`    |
| `decisions`         | `GET /system/decision-queue` (v3 proxy)          |
| `constitution`      | Konstytucja + learning candidates                |
| `system`            | Observability, bridge summary, diagramy Mermaid  |
| `tasks`             | Proxy `GET/POST /tasks` (deprecated shim Node B) |
| `quality`           | `GET /ai-quality`, ingress quality snapshots     |
| `identity`          | Proxy identity binding suggestions               |
| `cohort_runs`       | v3 cohort-runs storage + proxy                   |
| `last_ingress`      | Ostatni ingress-quality snapshot                 |
| `archive`           | `store-v2` case archive overlay                  |

**`KNOWN_MAIN_VIEWS`** (`app.js` ~2111): zestaw powyżej — nawigacja `data-view` + hash; nieznany widok → fallback `desk`.

### `apiFetch` — jedyna ścieżka HTTP z UI

```javascript
// public/app.js — buildApiHeaders
// POST: Content-Type application/json + X-CSRF-Token (meta lub sesja)
// credentials: same-origin
```

Mutacje (approve, HITL, materialize) **zawsze** przez `apiFetch(V2_API_BASE | V3_API_BASE, ...)`, nie bezpośrednio na `:8766` z przeglądarki.

### Materialize approve (CT-FU-5) — łańcuch UI

1. `decideActionProposal(proposalId, 'approve')` — tylko `konrad` / `darek`
2. `window.prompt` → `reason`
3. `approveProposalViaApi` — gdy `prop_*` + znaleziony `engagement_id`:
   - `POST /wp-json/daszek/v2/engagements/{id}/materialize/approve`
   - body: `{ proposal_id, reason }`
4. PHP `daszek_api_v2_engagement_materialize_approve` — CSRF, owner, wstrzykuje `operator_id`
5. Node B `POST /engagements/{id}/materialize/approve`

**P1-MAT-1 (done 2026-07-13):** gdy brak `engagement_id`, UI **rzuca błąd** (nie fallback na `/action-proposals`). Operator musi odświeżyć szczegóły sprawy. Proof: LPS 2026-07-13 + CT-FU-5 browser.

---

## 4. Warstwy PHP

| Warstwa    | Pliki                                                   | Rola                                          |
| ---------- | ------------------------------------------------------- | --------------------------------------------- |
| Bootstrap  | `daszek.php`                                            | Rejestracja WP, ładowanie includes            |
| Auth       | `includes/auth.php`, `config.php`                       | Sesja operatora, CSRF                         |
| REST v1    | `includes/api.php`                                      | Login, `/me`, csrf_token                      |
| REST v2    | `includes/api-v2.php`, `api-v3-handlers.php`            | Proxy Node B, HITL, materialize, bridge       |
| REST v3    | `includes/api-v3.php`                                   | Feed snapshots, decision-queue, observability |
| Storage v2 | `store.php`, `store-v2*.php`                            | Desk legacy, bridge queue, archiwum           |
| Storage v3 | `store-v3.php`                                          | `operational_feed_snapshots.jsonl`            |
| Agent chat | `includes/proxy-agent-chat.php`                         | Streaming proxy do Node B                     |
| UI         | `public/index.php`, `public/app.js`, `public/style.css` | SPA                                           |

**Contract-gate:** nowe pole w feed v3 → najpierw test/fixture w `gmail-agent`, potem `fixtures/v3/`, potem PHP walidacja.

---

## 5. Operational feed v3 (schema 1.3)

**Envelope:** `schema_version: "1.3"`, wymagane `action_items` (nie `tasks`).

| Klucz               | Zawartość                          |
| ------------------- | ---------------------------------- |
| `feed.desk`         | Karty biurka                       |
| `feed.action_items` | Lista działań / priorytetów        |
| `feed.case_details` | Szczegóły spraw do panelu bocznego |

**Prywatność:** feed i UI nie mogą przenosić raw body maila, credentiali, tokenów, sekretów ani pełnych danych prywatnych, jeśli wystarcza projekcja/metadane.

**Retention:** `daszek_v3_trim_operational_feed_snapshots` — **40** snapshotów; bez przycięcia worker heartbeat może OOM PHP (128M).

**Eksport (Node B):** `daszek_v3_operational_feed.py` → `daszek_client.post_v3_operational_feed_snapshot`.

---

## 6. UI — przepływy operatorskie

### Biurko / Sprawy

Feed v3 jest podstawą renderu. UI nie zmienia semantyki Case i nie uznaje lokalnego overlay za wykonanie Node B.

### Czat agenta

Agent proponuje. Akcja wymagająca skutku przechodzi przez policy/HITL i wspólny kontrakt decyzji.

### Kolejka decyzji

- każda komenda ma stabilny `decision_key`;
- duplikowane kliknięcie jest blokowane podczas oczekiwania;
- `accepted` pokazuje wyłącznie przyjęcie/oczekiwanie;
- `executing` i `outcome_unknown` mają jawne, niefinalne stany UI;
- `executed` lub `rejected` staje się finalne dopiero po świeżej projekcji zgodnej z tym samym kluczem;
- timeout, stary snapshot lub feed push failure nie daje finalnego sukcesu.

### HITL / materialize

Approval autoryzuje runtime, ale nie jest execution proof. UI po mutacji odświeża feed/case detail i czeka na konwergencję. `outcome_unknown` wymaga operator review; UI nie wysyła automatycznie tej samej decyzji ponownie.

## 7. Lokalny stack i env

```powershell
# root workspace
docker compose -f docker-compose.daszek-local.yml up -d
.\scripts\sync-local-stack-env.ps1

# Node B (wymagany do żywego feedu)
cd gmail-agent
docker compose --env-file .env.vps -f docker-compose.local-vps.yml --profile api up -d
```

| Zmienna                  | Gdzie                               | Cel                                                     |
| ------------------------ | ----------------------------------- | ------------------------------------------------------- |
| `DASZEK_NODE_B_API_BASE` | `.env.daszek-local` / wp-config     | URL Node B z kontenera WP (`host.docker.internal:8766`) |
| `NODE_B_REGISTRY_TOKEN`  | sync z gmail-agent `.env.local-vps` | Bearer proxy                                            |
| `DASZEK_BRIDGE_TOKEN`    | obie strony                         | Bridge drain / queue                                    |

**Smoke:** `scripts/daszek-smoke.ps1` (root) — static + subset pytest + Node B probe.

---

## 8. Walidacja i proof

```powershell
node --check daszek/public/app.js
php -l daszek/includes/api-v3-handlers.php
python -m pytest daszek/tests -q --tb=line
node --test daszek/tests/test_row4b_note_hitl_approve.node.js
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-local-gates.ps1
```

Po zmianie cross-repo decision flow wymagany jest wspólny proof: auth failure, accepted, single execution/reject, completion failure, replay/recovery, fresh feed i finalne UI confirmation. Nie wysyłaj realnego maila w proofie.

Ostatni wynik: pytest Daszka `8 passed`, Node `13 passed`, syntax PASS, workspace gate `exit 0`. Aktualne twierdzenia runtime utrzymuje LPS.

## 9. Granice i antywzorce

| Nie rób                              | Dlaczego                                |
| ------------------------------------ | --------------------------------------- |
| Zapis sprawy tylko w WP              | D4 — SoT jest Postgres Node B           |
| Nowy endpoint proxy bez testu Node B | contract-gate                           |
| Duplikuj logikę reconcile w PHP      | reconcile żyje w `signal_reconciler.py` |
| Pełna lista route w tym README       | użyj CBM / przeczytaj `api-v3.php`      |

---

## 10. Dokumentacja wtórna

- `../../../gmail-agent/docs/core/PROJECT_README.md` — Node B.
- `../../../gmail-agent/docs/core/CONSTITUTION_V2_1.md` — zasady bezpieczeństwa.
- `../../../gmail-agent/docs/core/PHYSICAL_TOPOLOGY.md` — granica Node A/B.
- `../../../gmail-agent/docs/runbooks/LAST_PROVEN_STATE.md` — proof authority.
- `../../../knowledge/INDEX.md` — router workspace.

Nie przywracaj linków do usuniętych onboardingów, archiwów ani historycznych handoffów.

## 11. Mapa plików (start)

```text
daszek/
  daszek.php              # plugin header, loaders
  includes/
    api.php               # REST v1 — login, csrf, /me
    api-v2.php            # route registration v2 (proxy + legacy desk)
    api-v3.php            # route registration v3 (feed, observability)
    api-v3-handlers.php   # proxy handlers (materialize, HITL, …)
    auth.php
    proxy-agent-chat.php
  public/
    app.js                # SPA — wszystkie widoki
    index.php             # shell HTML, csrf meta
    style.css
  store.php               # legacy desk
  store-v2*.php           # bridge queue, archive, desk notes
  store-v3.php            # operational_feed_snapshots.jsonl
  fixtures/v3/            # kontrakty testowe feed
  docs/core/
    PROJECT_README.md     # ten plik — kanoniczny manual
```

---

## 11a. Model mentalny developera — rozszerzenie

### Dwa właściciele HTTP

| Warstwa          | Właściciel                               | Semantyka                                      |
| ---------------- | ---------------------------------------- | ---------------------------------------------- |
| Feed v3 envelope | Node B (`daszek_v3_operational_feed.py`) | Co widać na Biurku / w Sprawach                |
| Proxy mutacji    | Node B (`api_app.py`) + PHP transport    | HITL, materialize, agent-chat                  |
| Overlay WP       | Daszek storage                           | Bridge queue, archiwum lokalne, notatki biurka |

**Daszek nigdy nie jest arbitrem polityki** — PHP sprawdza sesję, CSRF i owner (`konrad`/`darek`), potem przekazuje do Node B z Bearer.

### Cykl odświeżania UI

```text
loadOperationalFeedSnapshot()  → GET v3/operational-feed-snapshots/latest
renderCurrentView()            → widok zależny od state.currentView
openCaseDetail(caseId)         → v3/cases/{id} + engagement opcjonalnie
poll / refresh                 → timer + po mutacji (approve, HITL)
```

Feed-first: gdy snapshot jest świeży, UI **nie** woła Node B dla każdej karty biurka — czyta z JSONL przez v3 latest.

### Bridge queue (feedback A→B)

Operator akcja w UI → czasem `POST bridge-queue` (WP storage) → CLI Node B `daszek-bridge-drain` → reconcile / feedback runtime. **Nie** duplikuj drain w PHP cron bez bounded proof.

### Auth i CSRF

- v1 `/login` → cookie sesji WP;
- `GET /csrf` lub meta `csrf-token`;
- `apiFetch`: `credentials: same-origin` i `X-CSRF-Token` na POST;
- PHP proxy wymaga owner/permission i przekazuje bearer Node B;
- Node B write routes pozostają fail-closed także wtedy, gdy PHP ma błąd konfiguracji;
- brak/błędny/read-only token nie może dojść do walidacji Case ani store;
- `operator_id` jest wiązany z uwierzytelnioną sesją, nie bezwarunkowo z body.

---

## 11b. Moduły

| Moduł         | Plik                             | Odpowiedzialność                          |
| ------------- | -------------------------------- | ----------------------------------------- |
| Bootstrap     | `daszek.php`                     | `require` includes, rejestracja hooków WP |
| Config        | `config.php`                     | `DASZEK_NODE_B_API_BASE`, tokeny, ownerzy |
| Auth          | `includes/auth.php`              | `daszek_require_login`, CSRF verify       |
| REST v1       | `includes/api.php`               | Sesja operatora                           |
| REST v2 proxy | `includes/api-v2.php` + handlers | Legacy desk + proxy Node B                |
| REST v3       | `includes/api-v3.php` + handlers | Snapshots, system/\*, cohort              |
| Agent chat    | `includes/proxy-agent-chat.php`  | SSE/stream do Node B                      |
| Storage v2    | `store-v2*.php`                  | Bridge, archive, desk notes               |
| Storage v3    | `store-v3.php`                   | JSONL feed, trim retention=40             |
| UI SPA        | `public/app.js`                  | Wszystkie widoki, `apiFetch`, HITL        |
| Fixtures      | `fixtures/v3/`                   | Kontrakt feed dla pytest PHP/JS           |

**Testy Daszek:** istnieją zarówno Python tests w `daszek/tests`, jak i Node test krytycznego flow w `daszek/tests/test_row4b_note_hitl_approve.node.js`; cross-repo kontrakty nadal mają testy po stronie gmail-agent.

---

## 11c. Powierzchnia REST

Namespace WordPress: `/wp-json/daszek/{v1|v2|v3}/…`. **Pełna lista:** CBM lub grep `register_rest_route` w `includes/api*.php`.

### v1 — sesja (`includes/api.php`)

| Route                        | Metoda   | Rola                            |
| ---------------------------- | -------- | ------------------------------- |
| `/login`, `/logout`          | POST     | Sesja operatora                 |
| `/csrf`                      | GET      | Token CSRF                      |
| `/me`                        | GET      | Profil zalogowanego             |
| `/tasks`, `/tasks/{id}/done` | GET/POST | Legacy shim (preferuj v2 proxy) |

### v2 — proxy operatorski (`includes/api-v2.php`)

| Grupa       | Przykłady                                  | Kierunek                 |
| ----------- | ------------------------------------------ | ------------------------ |
| Legacy desk | `/desk`, `/day`, `/cases`                  | WP storage lub mix       |
| Mutacje     | `/action-proposals/{id}/approve\|reject`   | → Node B                 |
| HITL        | `/agent-hitl/approve`, `/agent-hitl/send`  | → Node B                 |
| Materialize | `/engagements/{id}/materialize/approve`    | → Node B (CT-FU-5)       |
| Agent       | `/agent-chat`                              | → Node B (stream)        |
| Bridge      | `/bridge-queue`, `/bridge-queue/complete`  | WP queue                 |
| Identity    | `/identity/suggestions`, `/identity/merge` | → Node B                 |
| Tasks       | `/tasks`                                   | → Node B deprecated shim |

### v3 — feed i observability (`includes/api-v3.php`)

| Grupa         | Przykłady                                                                | Rola                           |
| ------------- | ------------------------------------------------------------------------ | ------------------------------ |
| Feed          | `/operational-feed-snapshots`, `/latest`, `/{id}`                        | JSONL read/write (push Node B) |
| Desk read     | `/desk`, `/day`, `/cases`, `/cases/{id}`                                 | Feed-first + proxy detail      |
| System        | `/system/decision-queue`, `/health/status`, `/briefing`, `/constitution` | Proxy Node B                   |
| Observability | `/system-health-snapshots`, `/ingress-quality-snapshots`                 | Snapshot storage               |
| Engagement    | `/engagements/{id}/timeline`, `/snapshot`, `/os-events`                  | Proxy Node B                   |
| Skrzat        | `/cases/{id}/skrzat/ask`                                                 | Proxy Node B                   |
| Learning      | `/learning/rule-candidates`, `/{id}/status`                              | Proxy approve gate             |
| Identity L3   | `/identity/binding-suggestions/*`                                        | Proxy merge UI                 |
| Cohort        | `/cohort-runs`                                                           | Lokalny storage + proxy        |

**Proxy pattern:** handler PHP buduje URL `{DASZEK_NODE_B_API_BASE}{path}`, dodaje `Authorization: Bearer`, przekazuje body JSON, mapuje błędy na `{ok:false,error}`.

---

## 11d. Statusy prawdy w Daszku

| Etykieta | Znaczenie |
| --- | --- |
| `accepted` | Node B przyjął decyzję; skutek nie jest jeszcze finalny |
| `executing` | runtime rozpoczął wykonanie |
| `outcome_unknown` | wynik skutku jest nieznany; brak automatycznego retry |
| `feed_snapshot` | ostatnia projekcja Node B w JSONL |
| `converged` | świeży snapshot potwierdza właściwy `decision_key` i finalny status |
| `wp_overlay` | lokalny stan pomocniczy; nie jest SoT wykonania |
| `proven_local` | posiada aktualny artifact i test/runtime proof |
| `not proven` | brak wystarczającego dowodu |

UI może traktować stan jako finalny wyłącznie po `converged`. Local toast, HTTP 200 i bridge queue completion nie zastępują projekcji Node B.

## 11e. Jak zacząć jako developer

### Ścieżka 1 — tylko UI (bez Node B)

```powershell
docker compose -f docker-compose.daszek-local.yml up -d
node --check daszek/public/app.js
```

Feed będzie pusty lub fixture — wystarczy na zmiany CSS/JS nawigacji.

### Ścieżka 2 — pełny stack lokalny

```powershell
.\scripts\sync-local-stack-env.ps1
docker compose -f docker-compose.daszek-local.yml up -d --build
cd gmail-agent
docker compose --env-file .env.vps -f docker-compose.local-vps.yml --profile api --profile worker up -d --build
.\scripts\daszek-smoke.ps1
```

### Ścieżka 3 — bounded proof HITL

```powershell
# wymaga MAILBOX_MEMORY_DATABASE_URL → :54129
python gmail-agent/tools/gmail_audit/scripts/seed_materialize_ctfu5.py
python gmail-agent/tools/gmail_audit/scripts/test_ctfu5_daszek_proxy.py
```

### Ścieżka 4 — zmiana kontraktu feed v3

1. `gmail-agent/.../daszek_v3_operational_feed_contract.py` + testy
2. `daszek/fixtures/v3/`
3. `store-v3.php` walidacja
4. `app.js` render (desk / action_items)
5. `daszek-smoke.ps1` + subset pytest

---

## 11f. Macierz walidacji

| Zmiana | Minimalny gate | Proof końcowy |
| --- | --- | --- |
| `app.js` | `node --check` + Node tests | fresh feed convergence test |
| PHP proxy | `php -l` + auth/proxy tests | unauthorized + authorized runtime proof |
| decision key/status | backend + frontend RED/GREEN | integrated decision loop |
| feed schema | Python contract + fixture/store tests | push/readback latest |
| wspólny Python Node B | targeted + full suite | rebuild API/worker + parity + health |

Metryki pełnego suite pozostają w LPS, nie w wielu README.

## 12. Jak dodawać nową funkcję w Daszku

### Definition of Done

1. **Semantyka** — czy to projekcja (OK w PHP/JS) czy prawda sprawy (→ Node B + gateway)?
2. **Kontrakt** — jeśli nowe pole feed: najpierw Python contract test.
3. **Proxy** — nowy endpoint: handler w `api-v3-handlers.php`, Bearer, CSRF, owner check.
4. **UI** — jedna ścieżka `apiFetch`; nie `fetch('http://127.0.0.1:8766')` z przeglądarki.
5. **Test** — pytest proxy lub `daszek-smoke.ps1` subset.
6. **Docs** — ten plik lub ten dokument w tej samej sesji.
7. **CBM** — zaktualizuj graf jeśli nowa krawędź HTTP cross-repo.

### Antywzorzec: logika reconcile w PHP

Jeśli potrzebujesz „przeliczyć sprawę” — to `signal_reconciler.py` / `case_write_gateway`, nie `store.php`.

### Antywzorzec: drugi feed

Jeden kanoniczny envelope v3. Legacy v2 desk jest wycofywany — nie dodawaj trzeciego formatu bez RFC.

---

## 13. Bridge i push

### Push feed (B → A)

```text
Node B durable state
→ validate feed v3
→ POST operational-feed-snapshots
→ store-v3 JSONL
→ trim retention
→ app.js readback
```

Feed push jest transportem projekcji. Jego powodzenie nie zastępuje execution result; jego failure nie może uruchamiać skutku ponownie.

### Bridge drain (A → B)

```text
operator action
→ WP bridge row z stabilnym queue/decision key
→ daszek-bridge-drain
→ auth/policy
→ single execution or reject
→ durable result
→ completion + feed refresh
```

Replay completion jest dozwolony. Replay external effect po `executed` lub `outcome_unknown` jest zabroniony. Dwa równoległe drainery nie mogą wykonać skutku dwa razy.

## 14. Observability w UI

Widok `system` agreguje:

- `GET /system/health/status` — komponenty Node B
- `GET /system/bridge-queue/summary` — kolejka WP
- Diagramy Mermaid (read-only, sync z Node B proof 2026-06)
- Koszty / jakość: `/system/cost-summary`, `/system/quality-summary`

**Nie** traktuj zakładki System jako panelu architekta — to projekcja health, nie SoT metryk (metryki żyją w PG/logach Node B).

---

## 15. Aktualny praktyczny kierunek (2026-07-13)

| Obszar | Status |
| --- | --- |
| feed v3 / Node A projection | stabilny baseline |
| Node B mutation auth | fail-closed, PASS |
| send/reject decision loop | replay-safe, PASS |
| UI accepted/final separation | PASS |
| final confirmation after convergence | PASS |
| VPS deploy | zawieszony |

Stabilizacja połączenia `gmail-agent ↔ Daszek` jest zamknięta lokalnie. Następna faza dotyczy jakości inteligencji, która zasila Daszek: uniwersalne rozumienie sygnałów, współpraca kompetencji i business-first synthesis — bez tworzenia osobnego sztywnego workflow dla każdego typu maila.

## 16. Najkrótsza mentalna mapa (Node A)

```text
Node B durable state + execution result
  → feed v3
  → app.js render
  → operator decision
  → PHP session/CSRF/owner + bearer
  → Node B accepted / executing / final result
  → completion + refreshed feed
  → matching decision_key
  → converged UI confirmation
```

Daszek prezentuje i zbiera decyzję. Nie jest właścicielem prawdy Case ani skutku.

## 17. `app.js` — transport HTTP i stan (deep dive)

Ten rozdział uzupełnia §3 i §6 o **konkretne wzorce z kodu** — punkt odniesienia przy zmianach proxy lub HITL.

### 17.1 Stałe API i globalny `state`

```javascript
// public/app.js (początek pliku)
const V2_API_BASE = "/wp-json/daszek/v2";
const V3_API_BASE = "/wp-json/daszek/v3";

const state = {
  currentUser: null,
  csrfToken: null,
  currentView: "desk",
  data: {
    /* desk, cases, operationalFeed, decisionQueue, … */
  },
  detail: null, // panel boczny sprawy
  agentChat: {
    /* turns, proposals */
  },
};
```

**Zasada:** nowe źródło danych → pole w `state.data`, nie globalne zmienne poza `state`.

### 17.2 `apiFetch` — jedyny klient HTTP

```javascript
async function apiFetch(base, endpoint, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = buildApiHeaders(method, options.headers);
  const response = await fetch(buildApiUrl(base, endpoint, method), {
    ...options,
    method,
    headers,
    credentials: "same-origin",
    cache: method === "GET" ? "no-store" : options.cache,
  });
  // … parse JSON, throw Error z .status przy !response.ok
  return parsedBody;
}

function buildApiHeaders(method, extraHeaders) {
  const headers = {
    "Content-Type": "application/json",
    ...(extraHeaders || {}),
  };
  if (state.csrfToken && method !== "GET") {
    headers["X-CSRF-Token"] = state.csrfToken;
  }
  return headers;
}
```

| Wymóg             | Implementacja                                             |
| ----------------- | --------------------------------------------------------- |
| Sesja WP          | `credentials: 'same-origin'`                              |
| CSRF na mutacjach | `X-CSRF-Token` z `state.csrfToken` (meta / `GET /csrf`)   |
| Cache bust GET    | `buildApiUrl` dodaje `_rt` timestamp                      |
| Błąd HTTP         | `throw Error` z `error.status` — UI czyta `error.message` |

**Antywzorzec:** `fetch('http://127.0.0.1:8766/…')` z przeglądarki — omija CSRF i CORS policy.

### 17.3 `loadAllData` — równoległe zasilenie

Przy starcie / odświeżeniu UI woła **Promise.allSettled** (linie ~1967–1978):

| Request                                    | Baza | Cel                                     |
| ------------------------------------------ | ---- | --------------------------------------- |
| `/operational-feed-snapshots/latest`       | v3   | **Priorytet** — gdy OK, `feedWins=true` |
| `/desk`, `/day`, `/cases`                  | v3   | Fallback gdy brak feed snapshot         |
| `/mailbox-cases?view=full`                 | v2   | Pełny rejestr (opcjonalny)              |
| `/cockpit`, `/ai-quality`, cohort, archive | v3   | Widoki poboczne                         |

Gdy `feedWins`, legacy desk/day/cases **nie nadpisują** feedu — D4: semantyka kart z Node B.

`hasOperationalFeedSnapshot()` (~294): `state.data.operationalFeed?.snapshot?.feed` istnieje.

### 17.4 Nawigacja widoków

```javascript
const KNOWN_MAIN_VIEWS = new Set([
  "desk",
  "cockpit",
  "day",
  "cases",
  "archive",
  "quality",
  "tasks",
  "system",
  "last_ingress",
  "cohort_runs",
  "chat",
  "decisions",
  "identity",
  "constitution",
]);

function renderCurrentView() {
  const viewKey = normalizeMainViewId(state.currentView) || "desk";
  const config = viewConfig()[viewKey];
  // dispatch: renderDeskView | startChatViewLoad | startDecisionQueueViewLoad | …
}
```

`viewConfig()` (~2140) — tytuł + subtitle PL per widok; **nie** duplikuj copy w HTML na sztywno poza `index.php` shell.

### 17.5 `openCaseDetail` — feed-first, potem live

```text
openCaseDetail(caseId)
  → resolveOperationalFeedCaseDetail(cid)  # z snapshot feed
  → jeśli hit: state.detail = { type:'case', source:'operational_feed' }
  → inaczej: GET v3/cases/{id} + GET v3/cases/{id}/engagement
  → refreshCaseDetailOsEvents() → GET v3/engagements/{id}/os-events
```

`resolveEngagementIdFromCaseDetail` (~4893) — szuka `engagement_id` w zagnieżdżonym `detail.engagement` lub `payload.case`.

### 17.6 Materialize approve (CT-FU-5 / P1-MAT-1) — łańcuch UI

```javascript
function resolveEngagementIdForMaterializeProposal(proposalId) {
  const fromChat = findEngagementIdForProposal(proposalId);
  if (fromChat) return fromChat;
  return resolveEngagementIdFromCaseDetail(state.detail);
}

async function refreshEngagementIdForMaterializeProposal(proposalId) {
  const cached = resolveEngagementIdForMaterializeProposal(proposalId);
  if (cached) return cached;
  // brak cache: próbuje jednego dociągnięcia GET /cases/{id}/engagement
  // zanim odda pustą wartość wywołującemu (approveProposalViaApi rzuca błąd)
  // …
}

async function approveProposalViaApi(proposalId, decision, reason) {
  if (decision === "approve" && isMaterializeProposalId(proposalId)) {
    const engagementId = await refreshEngagementIdForMaterializeProposal(proposalId);
    if (!engagementId) {
      throw new Error(
        "Brak engagement_id — odśwież szczegóły sprawy przed zatwierdzeniem materialize.",
      );
    }
    return apiFetch(
      V2_API_BASE,
      `/engagements/${encodeURIComponent(engagementId)}/materialize/approve`,
      {
        method: "POST",
        body: JSON.stringify({ proposal_id: proposalId, reason: reason || "" }),
      },
    );
  }
  return apiFetch(
    V2_API_BASE,
    `/action-proposals/${encodeURIComponent(proposalId)}/${decision}`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
}
```

**Status (2026-07-13):** brak fallbacku na `/action-proposals` dla `prop_*` — zgodnie z kodem `app.js` ~5945–5960 (`approveProposalViaApi`). Kod dziś próbuje jednego automatycznego dociągnięcia `engagement_id` przez `refreshEngagementIdForMaterializeProposal` (GET `/cases/{id}/engagement`) zanim rzuci błąd — dopiero brak wyniku po tej próbie wymaga ręcznego odświeżenia przez operatora. Wcześniejsza dokumentacja sugerowała fallback na `/action-proposals`; **przyjęto wersję z kodu** (P1-MAT-1).

### 17.7 PHP proxy materialize (`api-v3-handlers.php`)

```php
function daszek_api_v2_engagement_materialize_approve(WP_REST_Request $request) {
    // CSRF + daszek_api_v2_require_owner() (konrad/darek)
    // body: proposal_id, reason; operator_id z sesji jeśli brak w body
    $result = daszek_node_b_get_json(
        '/engagements/' . rawurlencode($engagement_id) . '/materialize/approve',
        'POST',
        ['proposal_id' => $proposal_id, 'operator_id' => $operator_id, 'reason' => $reason]
    );
}
```

Node B: `POST /engagements/{id}/materialize/approve` (registry bearer) → `materialize.execute_materialize_proposal`.

### 17.8 Kolejka decyzji

```javascript
async function startDecisionQueueViewLoad() {
  const data = await apiFetch(V3_API_BASE, "/system/decision-queue");
  state.data.decisionQueue = { ok, items: data.items || [], loadError: null };
  renderDecisionQueueView();
}
```

Request id + `normalizeMainViewId(state.currentView) === 'decisions'` — ochrona przed race przy szybkiej nawigacji.

### 17.9 Konwergencja decyzji

Po mutacji UI przechowuje stabilny `decision_key` i stan oczekiwania. Finalne potwierdzenie wymaga:

1. odświeżenia operational feed/case detail;
2. snapshotu nowszego niż stan przed decyzją;
3. zgodnego `decision_key`;
4. finalnego `executed` lub `rejected`;
5. braku konfliktu lub `outcome_unknown`.

Do czasu spełnienia warunku UI pokazuje `accepted`/„oczekiwanie na synchronizację”, a nie „wykonano”. Duplicate click pozostaje zablokowany. Po refreshu przeglądarki stan jest rekonstruowany z Node B.

### 17.10 Agent chat (skrót)

- `POST /wp-json/daszek/v2/agent-chat` — `proxy-agent-chat.php` (stream SSE do Node B)
- Approve z czatu: `approveProposalViaApi` (ten sam łańcuch co karty propozycji)
- Briefing przy wejściu: proxy `GET /system/briefing`

### 17.11 Checklist debugowania developera

| Objaw             | Sprawdź                                                               |
| ----------------- | --------------------------------------------------------------------- |
| 403 na POST       | `state.csrfToken`, cookie sesji, owner                                |
| Pusty biurko      | `operational-feed-snapshots/latest`, worker push, retention 40        |
| Materialize 502   | `NODE_B_REGISTRY_TOKEN`, `MAILBOX_MEMORY_DATABASE_URL` na seed        |
| Case 404 w panelu | feed vs live — `hasOperationalFeedSnapshot()` + odśwież push          |
| Proxy timeout     | `DASZEK_NODE_B_API_BASE` z kontenera WP (`host.docker.internal:8766`) |

**Proof po zmianie `app.js`:** `node --check public/app.js` → `scripts/daszek-smoke.ps1`.

---

## 18. Dokumentacja wtórna

| Dokument | Rola |
| --- | --- |
| `../../../gmail-agent/docs/core/PROJECT_README.md` | Node B deep manual |
| `../../../gmail-agent/docs/core/CONSTITUTION_V2_1.md` | nadrzędne gwarancje |
| `../../../gmail-agent/docs/core/PHYSICAL_TOPOLOGY.md` | Node A/B i kanały |
| `../../../gmail-agent/docs/runbooks/LAST_PROVEN_STATE.md` | proof z datą |
| `../../../knowledge/INDEX.md` | router workspace |
| `../../../knowledge/memory/ACTIVE_WORKSPACE.md` | żywy stan |
| CBM | symbole i wpływ zmian |

Przy rozbieżności README vs `public/app.js`/PHP wygrywa kod i test; przy claimie „działa” wygrywa LPS.
