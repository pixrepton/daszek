"""X1-02 — exceptions_only toggle preference + Daszek→Node B proxy contract."""

from __future__ import annotations

from pathlib import Path

APP_JS = Path(__file__).resolve().parents[1] / "public" / "app.js"
HANDLERS_PHP = Path(__file__).resolve().parents[1] / "includes" / "api-v3-handlers.php"
API_V3_PHP = Path(__file__).resolve().parents[1] / "includes" / "api-v3.php"


def _function_body(source: str, signature: str) -> str:
    start = source.index(signature)
    next_fn = len(source)
    for marker in ("\nfunction ", "\nasync function "):
        idx = source.find(marker, start + len(signature))
        if idx != -1:
            next_fn = min(next_fn, idx)
    return source[start:next_fn]


def test_preference_persists_in_local_storage() -> None:
    source = APP_JS.read_text(encoding="utf-8")
    assert "EXCEPTIONS_ONLY_STORAGE_KEY = 'daszek-exceptions-only-view'" in source
    assert "function readExceptionsOnlyPreference" in source
    read_body = _function_body(source, "function readExceptionsOnlyPreference")
    assert "localStorage.getItem(EXCEPTIONS_ONLY_STORAGE_KEY)" in read_body
    assert "sessionStorage.getItem(EXCEPTIONS_ONLY_STORAGE_KEY)" in read_body  # migration
    set_body = _function_body(source, "function setExceptionsOnlyView")
    assert "localStorage.setItem(EXCEPTIONS_ONLY_STORAGE_KEY" in set_body
    assert "sessionStorage.setItem" not in set_body


def test_toggle_wires_query_and_reload() -> None:
    source = APP_JS.read_text(encoding="utf-8")
    endpoint = _function_body(source, "function operationalFeedLatestEndpoint")
    assert "exceptions_only=1" in endpoint
    assert "data-exceptions-only-toggle" in source
    assert "Tylko wyjątki" in source
    bind = _function_body(source, "function bindDeskViewDelegated")
    assert "setExceptionsOnlyView(!!target.checked)" in bind
    assert "void loadAllData()" in bind


def test_php_latest_proxies_node_b_exceptions_only() -> None:
    handlers = HANDLERS_PHP.read_text(encoding="utf-8")
    body = _function_body(handlers, "function daszek_api_v3_operational_feed_snapshot_latest")
    assert "exceptions_only" in body
    assert "/system/operational-feed?exceptions_only=1" in body
    assert "'live_preview' => true" in body
    assert "'exceptions_only' => true" in body

    routes = API_V3_PHP.read_text(encoding="utf-8")
    assert "'exceptions_only'" in routes
    assert "rest_sanitize_boolean" in routes
    latest_route_idx = routes.index("/operational-feed-snapshots/latest")
    assert "'exceptions_only'" in routes[latest_route_idx : latest_route_idx + 500]
