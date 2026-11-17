"""Slice painted town NPC sheets (4 columns x 2 rows) into game sprite sets.

Rows, top to bottom: idle (loop), talk (loop; played while a player is near).
Sheets come on a white backdrop, keyed like the monster sheets. Every frame's
feet go back on the idle baseline, and the root x is the idle body's centre
(characters are drawn left of the cell centre, props like the anvil sit right).

    python3 tools/sprite-rig/slice_npcs.py              # every sheet in source/npcs
    python3 tools/sprite-rig/slice_npcs.py forge

Only Pillow is required.
"""

from __future__ import annotations

import argparse
import json
import math
import statistics
import sys
import time
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from slice_sheet import ROOT, key_cell, light_dist  # noqa: E402
from slice_monsters import body_stats  # noqa: E402

SOURCE = Path(__file__).parent / "source" / "npcs"
ROWS = ["idle", "talk"]
TIMING = {"idle": [420, 380, 160, 400], "talk": [240, 260, 240, 320]}
# On-screen body height in world px (heroes are 112). glow: pale fire/sparks
# touching the backdrop become translucent instead of white blotches.
NPCS = {
    "elder": dict(height=104),
    "potion": dict(height=108),
    "weapon": dict(height=114),
    "forge": dict(height=114, glow=True),
}


def slice_npc(name: str, sheet_path: Path):
    spec = NPCS[name]
    sheet = Image.open(sheet_path).convert("RGB")
    W, H = sheet.size
    cols = 4
    cw, ch = math.floor(W / cols), math.floor(H / len(ROWS))
    keyed = {}
    for r, action in enumerate(ROWS):
        frames = []
        for c in range(cols):
            x0, y0 = round(c * W / cols), round(r * H / len(ROWS))
            cell = sheet.crop((x0, y0, x0 + cw, y0 + ch))
            im = key_cell(cell, (252, 252, 252), dist_fn=light_dist, key_t=8, soft_t=60, pocket_min=40,
                          head_band=False, glow_min=150 if spec.get("glow") else None)
            frames.append((im, body_stats(im)))
        keyed[action] = frames

    idle = keyed["idle"]
    base = round(statistics.median(b for _, (area, b, _) in idle if area))
    cx = statistics.median(x for _, (area, _, x) in idle if area)
    top = min((im.getchannel("A").getbbox() or (0, base, 0, 0))[1] for im, _ in idle)
    body = max(1, base - top)
    pad_top, pad_bottom = 8, 6
    out_h = ch + pad_top + pad_bottom
    k = min(1.0, spec["height"] * 1.4 / body)  # stored at ~1.4x on-screen size
    ncw, nh = max(1, round(cw * k)), max(1, round(out_h * k))
    folder_root = ROOT / "npcs" / name
    for action, frames in keyed.items():
        durations = TIMING[action]
        atlas = Image.new("RGBA", (cw * len(frames), out_h))
        for i, (im, (area, bottom, _)) in enumerate(frames):
            dy = base - bottom if area and bottom >= 0 else 0
            atlas.alpha_composite(im, (i * cw, pad_top + dy))
        if k < 1.0:
            atlas = atlas.resize((ncw * len(frames), nh), Image.LANCZOS)
        folder = folder_root / action
        folder.mkdir(parents=True, exist_ok=True)
        page = f"{action}-atlas-00.webp"
        atlas.save(folder / page, "WEBP", quality=90, method=6)
        manifest = {
            "schemaVersion": "3.0", "name": action, "artSource": "painted sheet (supplied artwork)",
            "sourceSize": [ncw, nh], "sourceAnchor": [round(cx * k, 2), round((pad_top + base) * k, 2)],
            "frameCount": len(frames), "durationsMs": durations,
            "durationSeconds": sum(durations) / 1000, "fps": round(1000 * len(frames) / sum(durations), 3),
            "loop": True, "bodyHeightPx": round(body * k, 2), "events": [], "sampling": "linear",
            "fallback": {"type": "png-atlas", "cellSize": [ncw, nh],
                         "pages": [{"file": page, "firstFrame": 0, "frameCount": len(frames), "columns": len(frames)}]},
        }
        (folder / "animation.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return {"dir": f"npcs/{name}", "height": spec["height"], "facing": 1,
            "source": "supplied painted sheet", "actions": {a: a for a in ROWS}}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("names", nargs="*")
    args = ap.parse_args()
    names = args.names or [p.stem for p in sorted(SOURCE.glob("*.*")) if p.stem in NPCS]
    index_path = ROOT / "index.json"
    index = json.loads(index_path.read_text())
    index.setdefault("npcs", {})
    for name in names:
        index["npcs"][name] = slice_npc(name, next(SOURCE.glob(f"{name}.*")))
        print("wrote", name)
    index["version"] = time.strftime("%Y%m%d%H%M%S")
    index_path.write_text(json.dumps(index, indent=2) + "\n")


if __name__ == "__main__":
    main()
