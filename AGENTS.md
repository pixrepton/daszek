# AGENTS.md — daszek

**Status:** aktywny router repo.

## Rola

`daszek` jest Node A — panel operatorski WordPress. Projection-only UI i bounded HITL: prezentuje stan z Node B i zbiera feedback operatora (approve/reject, notatki, bridge queue).

Nie jest właścicielem SoT spraw, decyzji ani wykonania — to `../gmail-agent` (Node B, Postgres/journal). Semantyka sprawy, decyzji i wykonania nie powstaje w PHP ani JavaScript; zmiana semantyki feed/case zaczyna się w `gmail-agent` (Python), dopiero potem PHP storage i proxy.

## Czytaj najpierw

1. root `../AGENTS.md`;
2. kanoniczny cold-start w `../knowledge/INDEX.md`;
3. `../knowledge/memory/OPERATOR_DECISIONS.md` oraz `ACTIVE_WORKSPACE.md`;
4. `docs/core/PROJECT_README.md` — kanoniczny manual (UI, proxy, feed, bridge);
5. `../gmail-agent/docs/runbooks/LAST_PROVEN_STATE.md` tylko dla proof/runtime claims.

Nie czytaj historycznych handoffów, archiwów ani raw exports jako aktywnej prawdy.

## Runtime boundaries i freeze

- Domyślnie local Docker only; VPS/prod są zawieszone.
- Daszek jest projection-only; Node B (`../gmail-agent`) pozostaje SoT spraw i wykonania — nie duplikuj logiki reconcile w PHP.
- Nowy endpoint proxy bez testu po stronie Node B jest zabroniony (contract-gate).
- Mutacje idą wyłącznie przez `apiFetch` → PHP proxy (session/CSRF/owner + bearer) → Node B; nigdy bezpośredni `fetch` na Node B z przeglądarki.
- UI potwierdza finalny sukces wyłącznie po świeżej, zbieżnej projekcji z Node B (matching `decision_key` + final status) — nie po HTTP 200/accepted.
- `outcome_unknown` wymaga operator review; UI nie ponawia automatycznie tej samej decyzji.
- Stability freeze z `../knowledge/memory/OPERATOR_DECISIONS.md` obowiązuje: zmiany w chronionym obiegu (auth, idempotencja send/reject, konwergencja UI) wymagają reprodukcji, testu RED, minimalnej poprawki, testu GREEN + regresji i runtime proof przed aktualizacją LPS.

## Verification

```powershell
node --check daszek/public/app.js
php -l daszek/includes/api-v3-handlers.php
python -m pytest daszek/tests -q --tb=line
node --test daszek/tests/test_row4b_note_hitl_approve.node.js
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-local-gates.ps1
```

## Pamięć

Nie twórz lokalnego memory banku ani duplikatu `knowledge/memory/*` w tym repo. Trwała pamięć żyje wyłącznie w `../knowledge/memory/{OPERATOR_DECISIONS,BACKLOG,ACTIVE_WORKSPACE,LAST_SESSION}.md`.
