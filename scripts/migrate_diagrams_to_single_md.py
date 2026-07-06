#!/usr/bin/env python3
"""One-time migration: manifest.json + .mmd -> annotated single markdown."""
from __future__ import annotations

import json
from pathlib import Path

WORKSPACE = Path(__file__).resolve().parents[2]
DASZEK = WORKSPACE / "daszek"
OUT = WORKSPACE / "knowledge" / "docs" / "daszek-system-diagrams.md"


def resolve(val: str | None) -> str | None:
    if not val:
        return None
    if val.startswith("@file:"):
        path = DASZEK / val[6:].lstrip("/")
        return path.read_text(encoding="utf-8").strip()
    return val


def diagram_block(diag: dict, level: int) -> str:
    hashes = "#" * level
    lines = [
        f"{hashes} {diag['title']}",
        (
            f"<!-- @diagram hostId={diag['hostId']} "
            f"diagramKey={diag['diagramKey']} renderMode={diag['renderMode']} -->"
        ),
        "",
        diag["caption"],
        "",
    ]
    if diag.get("dynamicNote"):
        lines.extend([f"_{diag['dynamicNote']}_", ""])
    mermaid = resolve(diag.get("mermaidDoc") or diag.get("mermaid"))
    if mermaid:
        lines.extend(["```mermaid", mermaid, "```", ""])
    return "\n".join(lines)


def main() -> None:
    manifest = json.loads((DASZEK / "system-diagrams.manifest.json").read_text(encoding="utf-8"))
    parts: list[str] = [
        "<!-- @daszek-diagrams v1 -->",
        "",
        f"# {manifest['documentTitle']}",
        "",
        "> **Jeden wspólny plik** dla dokumentacji i UI Daszek (zakładka System).",
        "> Edytuj **tylko ten plik**, potem uruchom:",
        "> `python daszek/scripts/sync_system_diagrams_manifest.py`",
        "",
        manifest["documentIntro"],
        "",
        f"## {manifest['globalSection']['title']}",
        "<!-- @section-global -->",
        "",
        manifest["globalSection"]["intro"],
        "",
    ]
    for diag in manifest["globalSection"]["diagrams"]:
        parts.append(diagram_block(diag, 3))
    parts.extend(["---", ""])
    ms = manifest["modulesSection"]
    parts.extend([
        f"## {ms['title']}",
        "<!-- @section-modules -->",
        "",
        ms["intro"],
        "",
    ])
    for mod in ms["modules"]:
        parts.extend([
            f"### {mod['moduleTitle']}",
            f"<!-- @module moduleId={mod['moduleId']} -->",
            "",
            mod["moduleIntro"],
            "",
        ])
        for diag in mod["diagrams"]:
            parts.append(diagram_block(diag, 4))
    parts.extend([
        "---",
        "",
        "**Powiązanie z UI:** po sync powstaje `daszek/public/system-diagrams-manifest.js`, "
        "który ładuje `app.js`.",
        "",
    ])
    OUT.write_text("\n".join(parts), encoding="utf-8", newline="\n")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
