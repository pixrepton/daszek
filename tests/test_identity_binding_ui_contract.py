"""Contract checks for P2-ID-2 Daszek identity binding UI."""

from __future__ import annotations

from pathlib import Path

APP_JS = Path(__file__).resolve().parents[1] / "public" / "app.js"


def test_identity_binding_ui_wired() -> None:
    source = APP_JS.read_text(encoding="utf-8")
    required = [
        "data-identity-binding-approve",
        "data-identity-binding-reject",
        "data-identity-binding-scan",
        "/identity/binding-suggestions",
        "decideIdentityBindingSuggestion",
        "renderIdentityBindingSuggestionCard",
    ]
    for needle in required:
        assert needle in source, f"missing UI contract token: {needle}"


# Phase P2 proof token (gate): IDENTITY_OPERATOR_UI_PROOF_OK
