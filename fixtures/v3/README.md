# Daszek V3 — fixtures (syntetyczne)

> **Uwaga (2026-06-11):** ten folder jest **legacy/orphaned** — kanon operacji i kontraktów: `../docs/core/PROJECT_README.md`. Pliki JSON pozostają jako referencja kontraktu feedu.

Statyczne payloady do ręcznego podglądu lub testów smoke (bez danych klientów).

| Plik                             | Zawartość                                                                        |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `normal.json`                    | Sprawa z dowodami + propozycja działania (dedupe z `proposed_next_actions`)      |
| `conflicts.json`                 | Sprzeczności                                                                     |
| `gaps.json`                      | Braki danych                                                                     |
| `service_signal.json`            | Sygnał serwisowy                                                                 |
| `marketing_signal.json`          | Sygnał marketingowy                                                              |
| `sparse.json`                    | Pusta / uboga projekcja                                                          |
| `proposal_sparse.json`           | Minimalna propozycja (bez payload / evidence)                                    |
| `proposed_only.json`             | Tylko `proposed_next_actions` — **brak klucza** `action_proposals`               |
| `ingress_quality_snapshot.json`  | Zsanityzowany snapshot jakości ostatniego bounded ingress (read model Daszek V3) |
| `operational_feed_snapshot.json` | Bogaty operational feed (Biurko → Dzień → Sprawy → Zadania + `case_details`)     |
| `operational_feed_empty.json`    | Prawidłowy envelope feedu — puste listy (empty states w UI)                      |
| `operational_feed_sparse.json`   | Jedna sprawa minimalna + szczegół w `case_details`; brak bogatych sekcji         |
| `operational_feed_agent_runtime.json` | Feed z EngagementSnapshot.v2 (`gmail-agent.tools.gmail_audit.daszek_engagement_feed`) — HITL agent runtime |

**Eksport Node B:** migawka z `python tools/gmail_audit/daszek_v3_operational_feed.py --from-mailbox-memory` powinna pasować do tego samego kontraktu co `operational_feed_snapshot.json` (`schema_name`: `daszek_operational_feed_snapshot`, pole `feed`).

## Przegląd operatorski (ręczny)

Po zmianach w `daszek/public/app.js` otwórz kolejno fixture w mocku szczegółu sprawy i sprawdź w **15–30 s**:

1. **normal** — Czy widać dowód, czy propozycja jest po polsku (karta, nie JSON), czy techniczne dane są w rozwinięciu?
2. **conflicts** — Czy sprzeczność i wartości są czytelne?
3. **gaps** — Czy brak jest opisany i czy widać nasilenie/stan tam gdzie fixture je ma?
4. **service_signal** / **marketing_signal** — Czy granica „rekomendacja, nie wykonane” jest widoczna? Czy osobne sekcje serwis vs marketing?
5. **sparse** — Czy empty states **nie** sugerują, że „wszystko OK”, skoro brakuje sekcji lub danych?
6. **proposal_sparse** — Czy karta propozycji działa bez `payload` / `evidence_refs` (fallback, brak `undefined` w UI)?
7. **proposed_only** — Czy sekcja „Propozycje działań” pokazuje karty wyłącznie z `proposed_next_actions` (mimo braku klucza `action_proposals`)?
8. **operational_feed_snapshot** — Po POST migawki (most lub fixture w mocku): Biurko pokazuje ≥2 pozycje uwagi; Dzień ma sekcję „Teraz”; Sprawy ≥3; Zadania ≥3; otwarcie `case-fix-1` używa szczegółu z `feed.case_details` (banner „z migawki”) — dowody, braki, sprzeczności, sygnały serwis/marketing, propozycja, wpis `execution_results`.
9. **operational_feed_empty** — Po załadowaniu migawki: komunikaty „Brak zasilenia … z Node B” / puste listy bez sugestii „wszystko OK”, jeśli operator oczekuje danych z Node B.
10. **operational_feed_sparse** — Lista spraw ma jedną pozycję; szczegół `sparse-case-1` jest czytelny mimo braku bogatych sekcji; brak szczegółu dla innego ID powinien przełączyć UI na fallback v2 z widocznym disclaimerem projekcji.

### `<details>` i CSS (krótka lista)

- **Szczegóły pamięci** / **Dane techniczne … (JSON)** — klik rozwija; `<pre class="detail-pre">` nie wychodzi poza panel (overflow), tekst czytelny.
- **Sygnały** — granica copy + badge nie nachodzą na siebie (`guidance-compact` / `guidance-badge`).
- **Karty propozycji** — przyciski Akceptuj/Odrzuć tylko przy `status: proposed` i obecnym `proposal_id`.

### Pytania, które operator powinien móc sobie zadać

- Co mam zrobić dalej?
- Na czym system opiera tę sugestię?
- Czy to już zostało wykonane?
- Czy to wymaga mojej akceptacji?

