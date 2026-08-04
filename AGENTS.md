# AGENTS.md — daszek

Status: active L2 adapter (Typ A). **Node A** (WordPress operator UI).

## Safety capsule

- Code and local proof in this repo beat historical docs.
- Default target is **local**, not VPS/production.
- No production mutation without explicit operator order and dedicated proof.
- Do not write other repos without explicit `ai_os_task` scope expansion.
- Cross-repo contract changes require Gate A of the owner (usually `gmail-agent`) and of this consumer.
- Do not declare `done` without the proof appropriate to the UI/HITL layer changed.
- When opened inside `top-code workspace`, root `../AGENTS.md` also applies.
- Missing root does not waive these local rules.

## Role

Projection-only operator UI and bounded HITL. Presents Node B state; collects approve/reject and notes.  
**Not** the Source of Truth for cases, decisions, or execution.

## Owns / Must not

| Owns | Must not |
|------|----------|
| UI render; PHP proxy; session/CSRF surface | Case / decision / reconcile semantics (`gmail-agent`) |
| Local projection store; bounded HITL UX | Browser `fetch` to Node B bypassing the PHP proxy |
| | Locally inventing readiness / stagnation / membership when fields come from Node B |

## Read first

1. This file
2. Root `../AGENTS.md` when available
3. `../knowledge/INDEX.md` when cross-repo routing is needed
4. `docs/core/PROJECT_README.md`
5. Owning feed/HITL contracts in `../gmail-agent` when changing card semantics

## Write and task scope

- Feed/case **semantics** change first in Node B, then PHP/JS adapters here.
- New proxy endpoints require an owning Node B contract and proof — not UI-only invention.
- Scope via `daszek:<path>` in `ai_os_task`.

## Gate A

**Syntax / smoke (minimum on every edit):**

```powershell
node --check public/app.js
php -l includes/api-v3-handlers.php
```

(`php -l` the specific PHP files you changed when handlers differ.)

**Behavior / HITL (required before closeout when HITL, feed, or stale-view is in scope):**

```powershell
python -m pytest tests -q --tb=line
node --test tests/test_row4b_note_hitl_approve.node.js
```

`node --check` + `php -l` alone are **not** full HITL/behavior proof.

Workspace Gate B (`scripts/verify-local-gates.ps1`) only when runtime/stack is in scope.

## Cross-repo contract changes

1. Owning repo for case/feed/HITL semantics is usually `gmail-agent`.
2. Change owner + tests first.
3. Then change this consumer.
4. Run Gate A for owner and Daszek.
5. Do not invent client-only compatibility.
6. Knowledge docs alone do not change runtime.

## Anti-goals

- Final UI success after bare HTTP 200 — require fresh convergent Node B projection
- Fail-open stale-view or draft-identity bypass
- Duplicating Node B domain logic in JS/PHP
- Treating Daszek as write SoT for cases

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **daszek** (1153 symbols, 3790 relationships, 99 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/daszek/context` | Codebase overview, check index freshness |
| `gitnexus://repo/daszek/clusters` | All functional areas |
| `gitnexus://repo/daszek/processes` | All execution flows |
| `gitnexus://repo/daszek/process/{name}` | Step-by-step execution trace |

## Cross-Repo Groups

This repository is listed under GitNexus **group(s): topinstal-workspace** (see `~/.gitnexus/groups/`). For cross-repo analysis, use MCP tools `impact`, `query`, and `context` with `repo` set to `@<groupName>` or `@<groupName>/<memberPath>` (paths match keys in that group’s `group.yaml`). Use `group_list` / `group_sync` for membership and sync. From the project root: `node .gitnexus/run.cjs group list`, `node .gitnexus/run.cjs group sync <name>`, `node .gitnexus/run.cjs group impact <name> --target <symbol> --repo <group-path>` (the `.gitnexus/run.cjs` path is repo-root-relative).

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
