"""Contract checks for Row4b note-detail HITL approve path."""

from __future__ import annotations

from pathlib import Path

APP_JS = Path(__file__).resolve().parents[1] / "public" / "app.js"


def test_note_detail_branch_renders_hitl_operator_actions() -> None:
    source = APP_JS.read_text(encoding="utf-8")
    start = source.index("if (state.detail.type === 'note') {")
    end = source.index("const payload = state.detail.payload;", start + 100)
    body = source[start:end]

    assert "renderHitlOperatorActions(note, payload" in body
    assert "approveOnly: true" in body


def test_hitl_approve_click_handler_reuses_existing_submitter() -> None:
    source = APP_JS.read_text(encoding="utf-8")

    assert "void submitHitlAgentAction(hitlApprove, 'approve');" in source


def test_hitl_approve_payload_binds_expected_body_hash() -> None:
    source = APP_JS.read_text(encoding="utf-8")

    assert "expected_body_hash" in source
    assert "data-hitl-body-hash" in source
    assert "data-hitl-revision" in source
    assert "data-hitl-draft-id" in source
    assert "Tresc szkicu zmienila sie od czasu podgladu" in source
