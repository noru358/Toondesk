#!/usr/bin/env python3
"""Explode a TOONDESK_PACKAGE_V1 transport file into a project episode directory.

    python3 toondesk_unpack.py MY_EPISODE.package.json output/

Writes:
    output/<episode>/composition/manifest.json
    output/<episode>/composition/<PAGE>.layout.json
    output/<episode>/editable/<PAGE>.svg

Never touches artwork/ or export/ — project-authoritative artwork bytes stay as they are.
TOONDESK_PACKAGE_V1 is transport only; unpacking does not make it canonical authority.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2

    src = Path(argv[0])
    root = Path(argv[1])
    data = json.loads(src.read_text(encoding="utf-8"))

    if data.get("schema") != "TOONDESK_PACKAGE_V1":
        print(f"not a TOONDESK_PACKAGE_V1 file: {src}", file=sys.stderr)
        return 2

    episode = data.get("episode")
    if not episode:
        print("package has no episode name", file=sys.stderr)
        return 2
    episode = Path(str(episode)).name
    if episode in {"", ".", ".."}:
        print("package has unsafe episode name", file=sys.stderr)
        return 2

    comp = root / episode / "composition"
    edit = root / episode / "editable"
    comp.mkdir(parents=True, exist_ok=True)
    edit.mkdir(parents=True, exist_ok=True)

    written = []
    manifest = data.get("manifest")
    if manifest:
        p = comp / "manifest.json"
        p.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        written.append(p)

    for name, layout in (data.get("composition") or {}).items():
        if layout.get("schema") != "EDITABLE_COMPOSITION_PACKAGE_V1":
            print(f"skipping {name}: unexpected schema", file=sys.stderr)
            continue
        p = comp / Path(name).name
        p.write_text(json.dumps(layout, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        written.append(p)

    for name, svg in (data.get("editable") or {}).items():
        p = edit / Path(name).name
        p.write_text(svg, encoding="utf-8")
        written.append(p)

    for p in written:
        print(p)
    print(f"\n{len(written)} files written under {root / episode}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
