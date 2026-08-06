"""X1-02 — run hermetic Playwright preference proof when Chromium is available."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parent / "test_exceptions_only_preference.playwright.mjs"


def _playwright_available() -> bool:
    temp = Path(os.environ.get("TEMP") or os.environ.get("TMP") or "/tmp")
    candidates = [
        temp / "pw-stale-proof" / "node_modules" / "playwright",
        temp / "pw-x1-02-proof" / "node_modules" / "playwright",
        Path(__file__).resolve().parents[1] / "node_modules" / "playwright",
    ]
    if any(path.exists() for path in candidates):
        return True
    try:
        import playwright  # noqa: F401

        return True
    except Exception:
        return False


@pytest.mark.playwright
def test_hermetic_exceptions_only_preference_playwright() -> None:
    if not SCRIPT.is_file():
        pytest.fail(f"missing hermetic script: {SCRIPT}")
    if not _playwright_available():
        pytest.skip("Playwright Chromium package unavailable — hermetic X1-02 preference proof skipped")
    completed = subprocess.run(
        ["node", str(SCRIPT)],
        cwd=str(SCRIPT.parent.parent),
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        raise AssertionError(
            "hermetic X1-02 Playwright failed\n"
            f"stdout:\n{completed.stdout}\n"
            f"stderr:\n{completed.stderr}"
        )
    assert "PLAYWRIGHT_X1_02_EXCEPTIONS_ONLY_PREFERENCE PASS" in completed.stdout
