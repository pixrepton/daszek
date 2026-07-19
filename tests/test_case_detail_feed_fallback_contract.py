"""Contract checks for Daszek case detail live-first loading."""

from __future__ import annotations

from pathlib import Path

APP_JS = Path(__file__).resolve().parents[1] / "public" / "app.js"


def _open_case_detail_body() -> str:
    source = APP_JS.read_text(encoding="utf-8")
    start = source.index("async function openCaseDetail(caseId)")
    end = source.index("function renderSignalItems", start)
    return source[start:end]


def test_case_detail_fetches_live_before_feed_fallback() -> None:
    body = _open_case_detail_body()

    live_fetch = "apiFetch(V3_API_BASE, `/cases/${encodeURIComponent(cid)}`)"
    feed_fallback = "resolveOperationalFeedCaseDetail(cid)"

    assert body.index(live_fetch) < body.index(feed_fallback)
    assert "operational_feed_fallback" in body
    assert "operational_feed_stub_fallback" in body
