"""Contract checks for Daszek note detail live enrichment."""

from __future__ import annotations

from pathlib import Path

APP_JS = Path(__file__).resolve().parents[1] / "public" / "app.js"


def _source() -> str:
    return APP_JS.read_text(encoding="utf-8")


def test_feed_note_triggers_live_context_refresh() -> None:
    source = _source()
    start = source.index("async function openNoteDetail(noteId)")
    end = source.index("async function openCaseDetail(caseId)", start)
    body = source[start:end]

    assert "source: 'operational_feed'" in body
    assert "void refreshNoteDetailLiveContext();" in body


def test_note_detail_renders_node_b_os_events_section() -> None:
    source = _source()

    assert "function resolveEngagementIdFromNoteDetail(detail)" in source
    assert "async function refreshNoteDetailLiveContext()" in source
    assert "loadOsEventsForEngagement(eid)" in source
    assert "${renderOsEventsSection(state.detail.osEvents)}" in source
