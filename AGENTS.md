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

<!-- gitnexus:start -->

# GitNexus — Code Intelligence

This project is indexed by GitNexus as **daszek** (2030 symbols, 4634 relationships, 176 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource                                | Use for                                  |
| --------------------------------------- | ---------------------------------------- |
| `gitnexus://repo/daszek/context`        | Codebase overview, check index freshness |
| `gitnexus://repo/daszek/clusters`       | All functional areas                     |
| `gitnexus://repo/daszek/processes`      | All execution flows                      |
| `gitnexus://repo/daszek/process/{name}` | Step-by-step execution trace             |

## Cross-Repo Groups

This repository is listed under GitNexus **group(s): topinstal-workspace** (see `~/.gitnexus/groups/`). For cross-repo analysis, use MCP tools `impact`, `query`, and `context` with `repo` set to `@<groupName>` or `@<groupName>/<memberPath>` (paths match keys in that group’s `group.yaml`). Use `group_list` / `group_sync` for membership and sync. From the terminal: `npx gitnexus group list`, `npx gitnexus group sync <name>`, `npx gitnexus group impact <name> --target <symbol> --repo <group-path>`.

## CLI

| Task                                         | Read this skill file                                        |
| -------------------------------------------- | ----------------------------------------------------------- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md`       |
| Blast radius / "What breaks if I change X?"  | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?"             | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md`       |
| Rename / extract / split / refactor          | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md`     |
| Tools, resources, schema reference           | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md`           |
| Index, status, clean, wiki CLI commands      | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md`             |

<!-- gitnexus:end -->
