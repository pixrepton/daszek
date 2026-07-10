"""Tests for Daszek CSRF POST audit script (P1-ID-3)."""

from __future__ import annotations

import importlib.util
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "audit_csrf_post_handlers.py"
spec = importlib.util.spec_from_file_location("audit_csrf_post_handlers", SCRIPT)
mod = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(mod)


def test_csrf_audit_finds_handler_in_included_file() -> None:
    report = mod.audit()
    approve = next(
        item
        for item in report["routes"]
        if item["callback"] == "daszek_api_v2_action_proposal_approve"
    )
    assert approve["handler_file"] == "api-v3-handlers.php"
    assert approve["status"] == "csrf_in_handler"


def test_csrf_audit_token_snapshot_routes() -> None:
    report = mod.audit()
    ingest = next(
        item
        for item in report["routes"]
        if item["callback"] == "daszek_api_v3_operational_feed_snapshot_ingest"
    )
    assert ingest["status"] in ("token_in_permission_callback", "token_in_handler")
