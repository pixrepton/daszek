"""Contract checks for Roadmap 2.4 feed-visibility override UI + proxy serialization."""

from __future__ import annotations

from pathlib import Path

APP_JS = Path(__file__).resolve().parents[1] / "public" / "app.js"
HANDLERS_PHP = Path(__file__).resolve().parents[1] / "includes" / "api-v3-handlers.php"


def _function_body(source: str, signature: str) -> str:
    start = source.index(signature)
    # Next top-level function after this one (heuristic: "\nfunction " or "\nasync function ").
    next_fn = len(source)
    for marker in ("\nfunction ", "\nasync function "):
        idx = source.find(marker, start + len(signature))
        if idx != -1:
            next_fn = min(next_fn, idx)
    return source[start:next_fn]


def test_clear_request_builder_omits_mode() -> None:
    source = APP_JS.read_text(encoding="utf-8")
    assert "function buildFeedVisibilityOverrideRequestBody" in source
    body = _function_body(source, "function buildFeedVisibilityOverrideRequestBody")
    assert "if (clear)" in body
    assert "body.clear = true" in body
    # Clear branch returns before mode assignment.
    clear_idx = body.index("if (clear)")
    mode_assign_idx = body.index("body.mode = normalizedMode")
    assert clear_idx < mode_assign_idx
    clear_section = body[clear_idx:mode_assign_idx]
    assert "return body" in clear_section
    assert "body.mode" not in clear_section


def test_submit_uses_builder_and_refreshes_projection() -> None:
    source = APP_JS.read_text(encoding="utf-8")
    body = _function_body(source, "async function submitFeedVisibilityOverride")
    assert "buildFeedVisibilityOverrideRequestBody" in body
    assert "clear: true" in body
    assert "await loadAllData()" in body
    assert "await openCaseDetail(caseId)" in body


def test_ui_renders_effective_not_as_requested_override() -> None:
    source = APP_JS.read_text(encoding="utf-8")
    assert "Efektywny widok na biurku" in source
    assert "Żądana reklasyfikacja (override)" in source
    assert "attention_required" in source
    assert "Aktualny tryb:" not in source  # old ambiguous label removed


def test_php_proxy_rejects_clear_with_mode() -> None:
    source = HANDLERS_PHP.read_text(encoding="utf-8")
    fn = _function_body(source, "function daszek_api_v2_engagement_feed_visibility_override")
    assert "ambiguous_request" in fn
    assert "clear=true cannot be combined with mode" in fn
    assert "$node_b_body['clear'] = true" in fn
