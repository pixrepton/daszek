from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ROUTES = (ROOT / "includes" / "api-v3.php").read_text(encoding="utf-8")
HANDLERS = (ROOT / "includes" / "api-v3-handlers.php").read_text(encoding="utf-8")
APP = (ROOT / "public" / "app.js").read_text(encoding="utf-8")


def test_offer_truth_routes_proxy_only_to_node_b() -> None:
    assert "/cases/(?P<id>[a-zA-Z0-9_:-]+)/offers/latest" in ROUTES
    assert "/cases/(?P<id>[a-zA-Z0-9_:-]+)/offers/(?P<offer_id>[^/]+)/conflicts/resolve" in ROUTES
    assert "daszek_api_v3_case_latest_offer" in ROUTES
    assert "daszek_api_v3_offer_conflict_resolve" in ROUTES
    assert "'/cases/' . rawurlencode($case_id) . '/offers/latest'" in HANDLERS
    assert "'/conflicts/resolve'" in HANDLERS


def test_offer_resolution_mutation_is_csrf_owner_and_node_b_principal_gated() -> None:
    start = HANDLERS.index("function daszek_api_v3_offer_conflict_resolve")
    end = HANDLERS.index("function ", start + 10)
    body = HANDLERS[start:end]
    assert "daszek_check_csrf($request)" in body
    assert "daszek_api_v2_require_owner()" in body
    assert "expected_revision" in body
    assert "candidate_id" in body
    assert "rawurldecode((string) $request->get_param('offer_id'))" in body
    assert "daszek_node_b_get_json" in body
    assert "operator_id" not in body


def test_case_detail_loads_and_renders_offer_truth_without_raw_json_ui() -> None:
    assert "`/cases/${encodeURIComponent(cid)}/offers/latest`" in APP
    assert "renderOfferTruthSection(state.detail.offerTruth)" in APP
    assert "Wymaga decyzji operatora" in APP
    assert "Rozwiązano automatycznie" in APP
    assert "data-offer-conflict-select" in APP
    assert "JSON.stringify(conflict" not in APP
