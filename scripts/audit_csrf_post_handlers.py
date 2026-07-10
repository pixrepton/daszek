#!/usr/bin/env python3
"""P1-ID-3: audit Daszek REST POST handlers for CSRF / token write protection."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

DASZEK_ROOT = Path(__file__).resolve().parent.parent
INCLUDES = DASZEK_ROOT / "includes"
MANIFEST = DASZEK_ROOT / "docs" / "ROUTE_MANIFEST.json"

CSRF_MARKERS = ("daszek_check_csrf",)
TOKEN_MARKERS = (
    "daszek_check_bridge_token",
    "daszek_check_node_b_service_token",
    "daszek_check_ingress_quality_snapshot_write",
    "daszek_check_operational_feed_snapshot_write",
    "daszek_check_system_health_snapshot_write",
)
PRE_AUTH_EXCEPTIONS = {
    "daszek_api_login",
}

FUNC_RE = re.compile(r"function\s+([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{", re.MULTILINE)
CALLBACK_RE = re.compile(r"'callback'\s*=>\s*'([^']+)'")
PERM_CB_RE = re.compile(r"'permission_callback'\s*=>\s*'([^']+)'")


def _extract_function_body(source: str, name: str) -> str:
    match = FUNC_RE.search(source)
    while match:
        if match.group(1) == name:
            start = match.end()
            depth = 1
            idx = start
            while idx < len(source) and depth > 0:
                ch = source[idx]
                if ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                idx += 1
            return source[start : idx - 1]
        match = FUNC_RE.search(source, match.end())
    return ""


def _load_php_sources() -> dict[str, str]:
    out: dict[str, str] = {}
    for path in sorted(INCLUDES.glob("*.php")):
        out[path.name] = path.read_text(encoding="utf-8", errors="replace")
    return out


def _find_handler_body(sources: dict[str, str], callback: str) -> tuple[str, str]:
    for filename, source in sources.items():
        body = _extract_function_body(source, callback)
        if body:
            return filename, body
    return "", ""


def _permission_by_callback(sources: dict[str, str]) -> dict[str, str]:
    merged = "\n".join(sources.values())
    out: dict[str, str] = {}
    for block in re.findall(
        r"register_rest_route\([^,]+,\s*'[^']+'\s*,\s*\[(.*?)\]\s*\)",
        merged,
        re.DOTALL,
    ):
        if "POST" not in block.upper():
            continue
        cb = CALLBACK_RE.search(block)
        perm = PERM_CB_RE.search(block)
        if cb and perm:
            out[cb.group(1)] = perm.group(1)
    return out


def _classify(callback: str, handler_body: str, permission_callback: str) -> str:
    if callback in PRE_AUTH_EXCEPTIONS:
        return "pre_auth_exception"
    if any(marker in handler_body for marker in CSRF_MARKERS):
        return "csrf_in_handler"
    if any(marker in permission_callback for marker in TOKEN_MARKERS):
        return "token_in_permission_callback"
    if any(marker in handler_body for marker in TOKEN_MARKERS):
        return "token_in_handler"
    if permission_callback in TOKEN_MARKERS:
        return "token_in_permission_callback"
    return "session_only"


def audit() -> dict:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    sources = _load_php_sources()
    perm_map = _permission_by_callback(sources)

    items: list[dict] = []
    for route in manifest.get("routes", []):
        if "POST" not in str(route.get("methods") or "").upper():
            continue
        callback = str(route.get("callback") or "").strip()
        handler_file, handler_body = _find_handler_body(sources, callback)
        permission_callback = perm_map.get(callback, "")
        status = _classify(callback, handler_body, permission_callback)
        items.append(
            {
                "namespace": route.get("namespace"),
                "path": route.get("path"),
                "callback": callback,
                "handler_file": handler_file,
                "permission_callback": permission_callback or None,
                "status": status,
                "handler_found": bool(handler_body),
            }
        )

    gaps = [item for item in items if item["status"] == "session_only"]
    return {
        "post_route_count": len(items),
        "csrf_in_handler": sum(1 for i in items if i["status"] == "csrf_in_handler"),
        "token_protected": sum(
            1 for i in items if i["status"] in ("token_in_handler", "token_in_permission_callback")
        ),
        "pre_auth_exception": sum(1 for i in items if i["status"] == "pre_auth_exception"),
        "session_only_gaps": len(gaps),
        "gaps": gaps,
        "routes": items,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit Daszek POST handlers for CSRF coverage.")
    parser.add_argument("--fail-on-gaps", action="store_true", help="Exit 1 when session_only gaps exist.")
    parser.add_argument("--json", action="store_true", help="Print full JSON report.")
    args = parser.parse_args()

    report = audit()
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(f"POST routes: {report['post_route_count']}")
        print(f"csrf_in_handler: {report['csrf_in_handler']}")
        print(f"token_protected: {report['token_protected']}")
        print(f"pre_auth_exception: {report['pre_auth_exception']}")
        print(f"session_only_gaps: {report['session_only_gaps']}")
        for gap in report["gaps"]:
            print(
                f"  GAP {gap['namespace']}{gap['path']} -> {gap['callback']} ({gap.get('handler_file') or '?'})"
            )

    if args.fail_on_gaps and report["session_only_gaps"] > 0:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
