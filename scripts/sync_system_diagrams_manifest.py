#!/usr/bin/env python3
"""Sync Daszek System diagrams: single markdown source -> manifest.js for UI.

Source of truth (ONE file):
  knowledge/docs/daszek-system-diagrams.md

Generated (do not edit):
  daszek/public/system-diagrams-manifest.js

Usage:
  python daszek/scripts/sync_system_diagrams_manifest.py
  python daszek/scripts/sync_system_diagrams_manifest.py --check

Stdout on successful --check: DASZEK_SYSTEM_DIAGRAMS_MANIFEST_SYNC_OK
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

DASZEK_DIR = Path(__file__).resolve().parents[1]
WORKSPACE = DASZEK_DIR.parent
SOURCE_MD = WORKSPACE / "knowledge" / "docs" / "daszek-system-diagrams.md"
OUT_JS = DASZEK_DIR / "public" / "system-diagrams-manifest.js"

MARKER = "<!-- @daszek-diagrams v1 -->"
SECTION_GLOBAL = "<!-- @section-global -->"
SECTION_MODULES = "<!-- @section-modules -->"
DIAGRAM_META_RE = re.compile(r"<!--\s*@diagram\s+(.+?)\s*-->")
MODULE_META_RE = re.compile(r"<!--\s*@module\s+moduleId=(\S+)\s*-->")
HEADING_RE = re.compile(r"^(#{1,4})\s+(.+)$")
MERMAID_FENCE_RE = re.compile(r"^```mermaid\s*$")
FENCE_END_RE = re.compile(r"^```\s*$")
ATTR_RE = re.compile(r'(\w+)=("([^"]*)"|(\S+))')


def _parse_attrs(raw: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for match in ATTR_RE.finditer(raw):
        key = match.group(1)
        value = match.group(3) if match.group(3) is not None else match.group(4)
        out[key] = value
    return out


def _strip_md_bold(text: str) -> str:
    return text.replace("**", "").strip()


def _is_skippable_line(line: str) -> bool:
    stripped = line.strip()
    return (
        not stripped
        or stripped == "---"
        or stripped.startswith(">")
        or stripped.startswith(MARKER)
        or stripped.startswith("<!-- @")
        or stripped.startswith("**Powiązanie z UI:**")
    )


def _skip_blank_lines(lines: list[str], idx: int) -> int:
    while idx < len(lines) and not lines[idx].strip():
        idx += 1
    return idx


def _extract_mermaid(lines: list[str], start: int) -> tuple[str, int]:
    if start >= len(lines) or not MERMAID_FENCE_RE.match(lines[start].strip()):
        return "", start
    body: list[str] = []
    idx = start + 1
    while idx < len(lines):
        if FENCE_END_RE.match(lines[idx].strip()):
            return "\n".join(body).strip(), idx + 1
        body.append(lines[idx])
        idx += 1
    raise ValueError(f"unclosed mermaid fence near line {start + 1}")


def _collect_paragraphs(lines: list[str], start: int, stop_pred) -> tuple[str, str, int]:
    caption_parts: list[str] = []
    dynamic_note = ""
    idx = start
    while idx < len(lines):
        line = lines[idx]
        if stop_pred(line, idx):
            break
        stripped = line.strip()
        if _is_skippable_line(line):
            idx += 1
            continue
        if MERMAID_FENCE_RE.match(stripped):
            break
        if stripped.startswith("_") and stripped.endswith("_") and len(stripped) > 2:
            dynamic_note = stripped.strip("_").strip()
            idx += 1
            continue
        if HEADING_RE.match(stripped):
            break
        caption_parts.append(stripped)
        idx += 1
    return "\n\n".join(caption_parts).strip(), dynamic_note, idx


def parse_markdown_source(text: str) -> dict:
    if MARKER not in text:
        raise ValueError(f"missing canonical marker {MARKER}")
    lines = text.splitlines()
    document_title = ""
    document_intro = ""
    global_title = ""
    global_intro = ""
    modules_title = ""
    modules_intro = ""
    global_diagrams: list[dict] = []
    modules: list[dict] = []
    current_module: dict | None = None
    section = "header"
    idx = 0

    while idx < len(lines):
        line = lines[idx]
        stripped = line.strip()

        if stripped == SECTION_GLOBAL:
            section = "global"
            idx += 1
            continue
        if stripped == SECTION_MODULES:
            section = "modules"
            idx += 1
            continue

        heading = HEADING_RE.match(stripped)
        if heading:
            level = len(heading.group(1))
            title = heading.group(2).strip()
            if level == 1 and not document_title:
                document_title = title
                idx += 1
                continue
            if level == 2 and section == "header":
                global_title = title
                idx += 1
                continue
            if level == 2 and section == "global" and global_title and not modules_title:
                modules_title = title
                idx += 1
                if idx < len(lines) and lines[idx].strip() == SECTION_MODULES:
                    section = "modules"
                    idx += 1
                continue
            if level == 2 and section == "modules" and not modules_title:
                modules_title = title
                idx += 1
                continue
            if level == 3 and section == "global":
                idx += 1
                idx = _skip_blank_lines(lines, idx)
                meta_line = lines[idx].strip() if idx < len(lines) else ""
                meta_match = DIAGRAM_META_RE.match(meta_line)
                if not meta_match:
                    raise ValueError(f"expected @diagram meta after global heading at line {idx}")
                attrs = _parse_attrs(meta_match.group(1))
                idx += 1
                caption, dynamic_note, idx = _collect_paragraphs(
                    lines,
                    idx,
                    lambda ln, _i: bool(MERMAID_FENCE_RE.match(ln.strip())),
                )
                mermaid, idx = _extract_mermaid(lines, idx)
                diag = {
                    "hostId": attrs["hostId"],
                    "diagramKey": attrs.get("diagramKey", ""),
                    "title": title,
                    "caption": caption,
                    "renderMode": attrs.get("renderMode", "static"),
                }
                mode = diag["renderMode"]
                if mode.startswith("dynamic"):
                    diag["mermaidDoc"] = mermaid
                    if dynamic_note:
                        diag["dynamicNote"] = dynamic_note
                else:
                    diag["mermaid"] = mermaid
                global_diagrams.append(diag)
                continue
            if level == 3 and section == "modules":
                idx += 1
                idx = _skip_blank_lines(lines, idx)
                meta_line = lines[idx].strip() if idx < len(lines) else ""
                meta_match = MODULE_META_RE.match(meta_line)
                if not meta_match:
                    raise ValueError(f"expected @module meta after module heading at line {idx}")
                idx += 1
                intro, _, idx = _collect_paragraphs(
                    lines,
                    idx,
                    lambda ln, _i: bool(HEADING_RE.match(ln.strip()) and ln.strip().startswith("####")),
                )
                current_module = {
                    "moduleId": meta_match.group(1),
                    "moduleTitle": title,
                    "moduleIntro": intro,
                    "diagrams": [],
                }
                modules.append(current_module)
                continue
            if level == 4 and section == "modules" and current_module is not None:
                idx += 1
                idx = _skip_blank_lines(lines, idx)
                meta_line = lines[idx].strip() if idx < len(lines) else ""
                meta_match = DIAGRAM_META_RE.match(meta_line)
                if not meta_match:
                    raise ValueError(f"expected @diagram meta after module diagram heading at line {idx}")
                attrs = _parse_attrs(meta_match.group(1))
                idx += 1
                caption, dynamic_note, idx = _collect_paragraphs(
                    lines,
                    idx,
                    lambda ln, _i: bool(MERMAID_FENCE_RE.match(ln.strip())),
                )
                mermaid, idx = _extract_mermaid(lines, idx)
                diag = {
                    "hostId": attrs["hostId"],
                    "diagramKey": attrs.get("diagramKey", ""),
                    "title": title,
                    "caption": caption,
                    "renderMode": attrs.get("renderMode", "static"),
                }
                if diag["renderMode"].startswith("dynamic"):
                    diag["mermaidDoc"] = mermaid
                    if dynamic_note:
                        diag["dynamicNote"] = dynamic_note
                else:
                    diag["mermaid"] = mermaid
                current_module["diagrams"].append(diag)
                continue

        if section == "header" and document_title and not global_title and not _is_skippable_line(line):
            document_intro = f"{document_intro}\n{stripped}".strip() if document_intro else stripped
        elif section == "global" and global_title and not modules_title and stripped and not heading:
            global_intro = f"{global_intro}\n{stripped}".strip() if global_intro else stripped
        elif section == "modules" and modules_title and current_module is None and stripped and not heading:
            modules_intro = f"{modules_intro}\n{stripped}".strip() if modules_intro else stripped

        idx += 1

    manifest = {
        "schemaVersion": 1,
        "documentTitle": document_title,
        "documentIntro": document_intro,
        "globalSection": {
            "title": global_title,
            "intro": global_intro,
            "diagrams": global_diagrams,
        },
        "modulesSection": {
            "title": modules_title,
            "intro": modules_intro,
            "modules": modules,
        },
    }
    _validate_manifest(manifest)
    return manifest


def _manifest_digest(manifest: dict) -> str:
    payload = json.dumps(manifest, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def generate_js(manifest: dict) -> str:
    digest = _manifest_digest(manifest)
    body = json.dumps(manifest, ensure_ascii=False, indent=2)
    rel_source = SOURCE_MD.relative_to(WORKSPACE).as_posix()
    return (
        "/* AUTO-GENERATED — do not edit. */\n"
        f"/* Source: {rel_source} (digest {digest}) */\n"
        "window.DASZEK_SYSTEM_DIAGRAMS_MANIFEST = "
        f"{body};\n"
    )


def _validate_manifest(manifest: dict) -> None:
    global_diagrams = manifest["globalSection"].get("diagrams", [])
    if len(global_diagrams) != 6:
        raise ValueError(f"expected 6 global diagrams, got {len(global_diagrams)}")
    global_hosts = {d.get("hostId") for d in global_diagrams}
    for host_id in (
        "system-mermaid-mega-master",
        "system-mermaid-arch",
        "system-mermaid-pipeline",
        "system-mermaid-cieplo",
        "system-mermaid-case-os",
        "system-mermaid-ai-os",
    ):
        if host_id not in global_hosts:
            raise ValueError(f"missing global diagram hostId: {host_id}")
    module_ids = [m.get("moduleId") for m in manifest["modulesSection"].get("modules", [])]
    expected = [
        "kalk-top",
        "daszek",
        "rag-chat-asystent",
        "rag-widget",
        "gmail-agent",
        "fast-kalk",
        "cieplo-orchestrator",
    ]
    if module_ids != expected:
        raise ValueError(f"unexpected modules: {module_ids}")
    gmail_mod = next(m for m in manifest["modulesSection"]["modules"] if m["moduleId"] == "gmail-agent")
    if len(gmail_mod.get("diagrams", [])) < 5:
        raise ValueError("gmail-agent module needs at least 5 diagrams")
    rag_mod = next(m for m in manifest["modulesSection"]["modules"] if m["moduleId"] == "rag-chat-asystent")
    if len(rag_mod.get("diagrams", [])) < 4:
        raise ValueError("rag-chat-asystent module needs at least 4 diagrams")


def _write_if_changed(path: Path, content: str) -> bool:
    existing = path.read_text(encoding="utf-8") if path.is_file() else None
    if existing == content:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    if not SOURCE_MD.is_file():
        raise SystemExit(f"Missing source markdown: {SOURCE_MD}")

    manifest = parse_markdown_source(SOURCE_MD.read_text(encoding="utf-8"))
    js_content = generate_js(manifest)

    if args.check:
        if not OUT_JS.is_file() or OUT_JS.read_text(encoding="utf-8") != js_content:
            print(
                "DASZEK_SYSTEM_DIAGRAMS_MANIFEST_SYNC_FAIL: stale "
                f"{OUT_JS}. Run: python {Path(__file__).as_posix()}",
                file=sys.stderr,
            )
            return 1
        print("DASZEK_SYSTEM_DIAGRAMS_MANIFEST_SYNC_OK")
        return 0

    changed = _write_if_changed(OUT_JS, js_content)
    print(
        json.dumps(
            {
                "ok": True,
                "source_md": str(SOURCE_MD),
                "wrote_js": changed,
                "out_js": str(OUT_JS),
                "digest": _manifest_digest(manifest),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
