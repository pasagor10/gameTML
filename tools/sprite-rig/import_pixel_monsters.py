#!/usr/bin/env python3
"""Turn AI-drawn pixel-art monster and NPC sheets into true-pixel sprite sets.

Sources, all on flat magenta:
  source/monsters-pixel/<name>.webp   4 x 6: idle, move, attack, hit, death, spawn
  source/npcs-pixel/<name>.webp       4 x 2: idle, talk
The sheet is snapped to its art pixel grid (pixel_snap.py), cut into cells,
colour reduced with one palette per sheet, and each frame's feet go back on
the idle baseline (not for flyers, whose bob is part of the art). Frames are
stored at true pixels and drawn nearest; the game scales them to `height`.

The slime is the exception: the game draws it from one 4 x 6 sheet,
public/assets/animations/slime.png, at a square size with its feet at 94% of
the cell (combat-visuals.js), so that is what it gets.

  python3 tools/sprite-rig/import_pixel_monsters.py            # everything
  python3 tools/sprite-rig/import_pixel_monsters.py bat elder
"""
from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from pixel_snap import grid, quantize, snap  # noqa: E402
from slice_monsters import MONSTERS, ROWS as MONSTER_ROWS, TIMING as MONSTER_TIMING  # noqa: E402
from slice_npcs import NPCS, ROWS as NPC_ROWS, TIMING as NPC_TIMING  # noqa: E402

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1] / "public/assets/sprites"
SLIME = HERE.parents[1] / "public/assets/animations/slime.png"
COLOURS = 48
# Pixel sizes the grid search gets wrong (it halves a strong 2-pixel pattern).
HINT = {"batking": 6.4}


def cells(sheet: Image.Image, cols: int, rows: int):
    W, H = sheet.size
    out = []
    for r in range(rows):
        row = []
        for c in range(cols):
            x0, y0 = round(c * W / cols), round(r * H / rows)
            x1, y1 = round((c + 1) * W / cols), round((r + 1) * H / rows)
            row.append(sheet.crop((x0, y0, x1, y1)))
        out.append(row)
    return out


def stats(im: Image.Image):
    """(area, bottom row, x centroid) of the opaque pixels."""
    a = im.getchannel("A").load()
    w, h = im.size
    area = sx = 0
    bottom = -1
    for y in range(h):
        for x in range(w):
            if a[x, y]:
                area += 1
                sx += x
                bottom = y
    return area, bottom, (sx / area if area else w / 2)


def true_sheet(path: Path, cols: int, rows: int):
    rgb = Image.open(path).convert("RGB")
    p, ox, oy = grid(rgb, hint=HINT.get(path.stem))
    small = snap(rgb, p, ox, oy)
    grid_cells = cells(small, cols, rows)
    flat = quantize([c for row in grid_cells for c in row], COLOURS)
    print(f"{path.stem}: art pixel {p:.2f}, sheet {small.size[0]}x{small.size[1]}")
    return [flat[r * cols:(r + 1) * cols] for r in range(rows)]


def write_set(group: str, name: str, rows: list, actions: list, timing, height: int, flyer: bool,
              loops=None):
    idle = [stats(f) for f in rows[0]]
    base = round(statistics.median(b for area, b, _ in idle if area))
    cx = statistics.median(x for area, _, x in idle if area)
    idle_area = statistics.median(area for area, _, _ in idle)
    top = min((f.getbbox() or (0, base, 0, 0))[1] for f in rows[0])
    body = max(1, base + 1 - top)
    cw, ch = rows[0][0].size
    pad_top, pad_bottom = 4, 3
    out_h = ch + pad_top + pad_bottom
    for action, frames in zip(actions, rows):
        durations, loop, hit = timing(action)
        atlas = Image.new("RGBA", (cw * len(frames), out_h))
        for i, f in enumerate(frames):
            area, bottom, _ = stats(f)
            dy = 0
            if not flyer and area > idle_area * 0.35 and bottom >= 0:
                dy = base - bottom
            atlas.alpha_composite(f, (i * cw, max(0, min(out_h - ch, pad_top + dy))))
        folder = ROOT / group / name / action
        folder.mkdir(parents=True, exist_ok=True)
        for old in folder.glob(f"{action}-atlas-*"):
            old.unlink()
        page = f"{action}-atlas-00.webp"
        atlas.save(folder / page, "WEBP", lossless=True)
        manifest = {
            "schemaVersion": "3.0", "name": action, "artSource": "pixel sheet (supplied artwork)",
            "sourceSize": [cw, out_h], "sourceAnchor": [round(cx, 2), pad_top + base + 1],
            "frameCount": len(frames), "durationsMs": durations,
            "durationSeconds": sum(durations) / 1000, "fps": round(1000 * len(frames) / sum(durations), 3),
            "loop": loop, "bodyHeightPx": body,
            "events": [] if hit is None else [{"name": "hit", "atMs": sum(durations[:hit]), "frame": hit}],
            "sampling": "nearest",
            "fallback": {"type": "png-atlas", "cellSize": [cw, out_h],
                         "pages": [{"file": page, "firstFrame": 0, "frameCount": len(frames), "columns": len(frames)}]},
        }
        (folder / "animation.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"  {group}/{name}: cell {cw}x{out_h}, body {body}px -> {height} world px")


def write_slime(rows: list):
    """slime.png: 4 x 6 square cells, feet on 94% of the cell height."""
    idle = [stats(f) for f in rows[0]]
    idle_area = statistics.median(a for a, _, _ in idle)
    cw, ch = rows[0][0].size
    side = max(cw, ch)
    foot = round(side * 0.94)
    sheet = Image.new("RGBA", (side * 4, side * len(rows)))
    for r, frames in enumerate(rows):
        for c, f in enumerate(frames):
            area, bottom, _ = stats(f)
            dy = foot - 1 - bottom if area > idle_area * 0.2 and bottom >= 0 else foot - ch
            sheet.alpha_composite(f, (c * side + (side - cw) // 2, r * side + max(-ch, min(side - 1, dy))))
    sheet.save(SLIME)
    print(f"  slime.png: {sheet.size[0]}x{sheet.size[1]}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("names", nargs="*")
    args = ap.parse_args()
    index_path = ROOT / "index.json"
    index = json.loads(index_path.read_text())
    mon_src, npc_src = HERE / "source/monsters-pixel", HERE / "source/npcs-pixel"
    want = set(args.names)
    for path in sorted(mon_src.glob("*.webp")):
        name = path.stem
        if want and name not in want:
            continue
        rows = true_sheet(path, 4, len(MONSTER_ROWS))
        if name == "slime":
            write_slime(rows)
            continue
        spec = MONSTERS[name]
        write_set("monsters", name, rows, MONSTER_ROWS, lambda a: MONSTER_TIMING[a], spec["height"],
                  bool(spec.get("flyer")))
        index["monsters"][name] = {
            "dir": f"monsters/{name}", "height": spec["height"], "facing": 1, "flyer": bool(spec.get("flyer")),
            "source": "supplied pixel sheet (import_pixel_monsters.py)",
            "actions": {a: a for a in MONSTER_ROWS}, "pixel": True,
        }
    for path in sorted(npc_src.glob("*.webp")):
        name = path.stem
        if want and name not in want:
            continue
        rows = true_sheet(path, 4, len(NPC_ROWS))
        spec = NPCS[name]
        write_set("npcs", name, rows, NPC_ROWS, lambda a: (NPC_TIMING[a], True, None), spec["height"], False)
        index["npcs"][name] = {
            "dir": f"npcs/{name}", "height": spec["height"], "facing": 1,
            "source": "supplied pixel sheet (import_pixel_monsters.py)",
            "actions": {a: a for a in NPC_ROWS}, "pixel": True,
        }
    index["version"] = time.time_ns()
    index_path.write_text(json.dumps(index, indent=2) + "\n")


if __name__ == "__main__":
    main()
