# Daszek V3 ÔÇö fixtures (syntetyczne)

Statyczne payloady do r─Öcznego podgl─ůdu lub test├│w smoke (bez danych klient├│w).

| Plik                             | Zawarto┼Ť─ç                                                                        |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `normal.json`                    | Sprawa z dowodami + propozycja dzia┼éania (dedupe z `proposed_next_actions`)      |
| `conflicts.json`                 | Sprzeczno┼Ťci                                                                     |
| `gaps.json`                      | Braki danych                                                                     |
| `service_signal.json`            | Sygna┼é serwisowy                                                                 |
| `marketing_signal.json`          | Sygna┼é marketingowy                                                              |
| `sparse.json`                    | Pusta / uboga projekcja                                                          |
| `proposal_sparse.json`           | Minimalna propozycja (bez payload / evidence)                                    |
| `proposed_only.json`             | Tylko `proposed_next_actions` ÔÇö **brak klucza** `action_proposals`               |
| `ingress_quality_snapshot.json`  | Zsanityzowany snapshot jako┼Ťci ostatniego bounded ingress (read model Daszek V3) |
| `operational_feed_snapshot.json` | Bogaty operational feed (Biurko Ôćĺ Dzie┼ä Ôćĺ Sprawy Ôćĺ Zadania + `case_details`)     |
| `operational_feed_empty.json`    | Prawid┼éowy envelope feedu ÔÇö puste listy (empty states w UI)                      |
| `operational_feed_sparse.json`   | Jedna sprawa minimalna + szczeg├│┼é w `case_details`; brak bogatych sekcji         |

**Eksport Node B:** migawka z `python tools/gmail_audit/daszek_v3_operational_feed.py --from-mailbox-memory` powinna pasowa─ç do tego samego kontraktu co `operational_feed_snapshot.json` (`schema_name`: `daszek_operational_feed_snapshot`, pole `feed`).

## Przegl─ůd operatorski (r─Öczny)

Po zmianach w `Daszek/public/app.js` otw├│rz kolejno fixture w mocku szczeg├│┼éu sprawy i sprawd┼║ w **15ÔÇô30 s**:

1. **normal** ÔÇö Czy wida─ç dow├│d, czy propozycja jest po polsku (karta, nie JSON), czy techniczne dane s─ů w rozwini─Öciu?
2. **conflicts** ÔÇö Czy sprzeczno┼Ť─ç i warto┼Ťci s─ů czytelne?
3. **gaps** ÔÇö Czy brak jest opisany i czy wida─ç nasilenie/stan tam gdzie fixture je ma?
4. **service_signal** / **marketing_signal** ÔÇö Czy granica ÔÇ×rekomendacja, nie wykonaneÔÇŁ jest widoczna? Czy osobne sekcje serwis vs marketing?
5. **sparse** ÔÇö Czy empty states **nie** sugeruj─ů, ┼╝e ÔÇ×wszystko OKÔÇŁ, skoro brakuje sekcji lub danych?
6. **proposal_sparse** ÔÇö Czy karta propozycji dzia┼éa bez `payload` / `evidence_refs` (fallback, brak `undefined` w UI)?
7. **proposed_only** ÔÇö Czy sekcja ÔÇ×Propozycje dzia┼éa┼äÔÇŁ pokazuje karty wy┼é─ůcznie z `proposed_next_actions` (mimo braku klucza `action_proposals`)?
8. **operational_feed_snapshot** ÔÇö Po POST migawki (most lub fixture w mocku): Biurko pokazuje Ôëą2 pozycje uwagi; Dzie┼ä ma sekcj─Ö ÔÇ×TerazÔÇŁ; Sprawy Ôëą3; Zadania Ôëą3; otwarcie `case-fix-1` u┼╝ywa szczeg├│┼éu z `feed.case_details` (banner ÔÇ×z migawkiÔÇŁ) ÔÇö dowody, braki, sprzeczno┼Ťci, sygna┼éy serwis/marketing, propozycja, wpis `execution_results`.
9. **operational_feed_empty** ÔÇö Po za┼éadowaniu migawki: komunikaty ÔÇ×Brak zasilenia ÔÇŽ z Node BÔÇŁ / puste listy bez sugestii ÔÇ×wszystko OKÔÇŁ, je┼Ťli operator oczekuje danych z Node B.
10. **operational_feed_sparse** ÔÇö Lista spraw ma jedn─ů pozycj─Ö; szczeg├│┼é `sparse-case-1` jest czytelny mimo braku bogatych sekcji; brak szczeg├│┼éu dla innego ID powinien prze┼é─ůczy─ç UI na fallback v2 z widocznym disclaimerem projekcji.

### `<details>` i CSS (kr├│tka lista)

- **Szczeg├│┼éy pami─Öci** / **Dane techniczne ÔÇŽ (JSON)** ÔÇö klik rozwija; `<pre class="detail-pre">` nie wychodzi poza panel (overflow), tekst czytelny.
- **Sygna┼éy** ÔÇö granica copy + badge nie nachodz─ů na siebie (`guidance-compact` / `guidance-badge`).
- **Karty propozycji** ÔÇö przyciski Akceptuj/Odrzu─ç tylko przy `status: proposed` i obecnym `proposal_id`.

### Pytania, kt├│re operator powinien m├│c sobie zada─ç

- Co mam zrobi─ç dalej?
- Na czym system opiera t─Ö sugesti─Ö?
- Czy to ju┼╝ zosta┼éo wykonane?
- Czy to wymaga mojej akceptacji?
