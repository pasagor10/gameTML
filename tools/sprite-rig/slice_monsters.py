"""Slice painted monster sheets (4 columns x 6 rows) into game sprite sets.

Rows, top to bottom: idle, move, attack, hit, death, spawn (the slime layout).
Sheets come with a baked white/checkerboard backdrop, which is keyed out with
the same flood fill + soft matte as slice_sheet.py. Ground monsters get each
frame's feet put back on the baseline (generated frames drift vertically);
flyers keep the frames as drawn so their bob and wingbeats survive. Frames
with no body (sparkles, dust) keep their drawn position.

    python3 tools/sprite-rig/slice_monsters.py             # every sheet in source/monsters
    python3 tools/sprite-rig/slice_monsters.py bat wolf

Only Pillow is required.
"""

from __future__ import annotations

import argparse
import json
import time
import math
import statistics
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from slice_sheet import ROOT, key_cell, light_dist  # noqa: E402

SOURCE = Path(__file__).parent / "source" / "monsters"
ROWS = ["idle", "move", "attack", "hit", "death", "spawn"]
TIMING = {
    "idle": ([150] * 4, True, None),
    "move": ([110] * 4, True, None),
    "attack": ([110, 120, 90, 140], False, 2),
    "hit": ([60, 70, 80, 100], False, None),
    "death": ([110, 130, 170, 220], False, None),
    "spawn": ([90, 90, 100, 120], False, None),
}
# On-screen height in world px (static monsters were 95 px, bosses 210 px).
MONSTERS = {
    "bat": dict(height=72, flyer=True),
    "boar": dict(height=78),
    "mushroom": dict(height=82),
    "wolf": dict(height=80, glow=False),  # grey fur has no outline; glow matte would thin it
    "goblin": dict(height=92),
    "batking": dict(height=175, flyer=True),
    "golem": dict(height=185),
    "serpent": dict(height=190),
}


def body_stats(im: Image.Image):
    """Opaque area, bottom row and x centroid of a keyed frame."""
    a = im.getchannel("A")
    w, h = im.size
    area, sx, bottom = 0, 0, -1
    for y in range(0, h):
        for x in range(0, w, 2):
            if a.getpixel((x, y)) > 160:
                area += 1
                sx += x
                bottom = y
    return area, bottom, (sx / area if area else w / 2)


def slice_monster(name: str, sheet_path: Path):
    spec = MONSTERS[name]
    sheet = Image.open(sheet_path).convert("RGB")
    W, H = sheet.size
    cols, nrows = 4, len(ROWS)
    cw, ch = math.floor(W / cols), math.floor(H / nrows)
    keyed = {}
    for r, action in enumerate(ROWS):
        frames = []
        for c in range(cols):
            x0, y0 = round(c * W / cols), round(r * H / nrows)
            cell = sheet.crop((x0, y0, x0 + cw, y0 + ch))
            im = key_cell(cell, (252, 252, 252), dist_fn=light_dist, key_t=8, soft_t=60, pocket_min=40, head_band=False,
                          glow_min=150 if spec.get("glow", True) else None)
            frames.append((im, body_stats(im)))
        keyed[action] = frames

    idle_bottoms = [b for _, (area, b, _) in keyed["idle"] if area]
    base = round(statistics.median(idle_bottoms))
    idle_area = statistics.median(area for _, (area, _, _) in keyed["idle"])
    pad_top, pad_bottom = 8, 6
    out_h = ch + pad_top + pad_bottom
    # Scale by the idle body so effects (sparkles, slashes) don't shrink it,
    # and store at ~1.4x the on-screen height: sharp at zoom, far smaller files.
    top = min((im.getchannel("A").getbbox() or (0, base, 0, 0))[1] for im, _ in keyed["idle"])
    body = max(1, base - top)
    k = min(1.0, spec["height"] * 1.4 / body)
    ncw, nh = max(1, round(cw * k)), max(1, round(out_h * k))
    folder_root = ROOT / "monsters" / name
    for action, frames in keyed.items():
        durations, loop, hit = TIMING[action]
        atlas = Image.new("RGBA", (cw * len(frames), out_h))
        for i, (im, (area, bottom, _)) in enumerate(frames):
            dy = 0
            if not spec.get("flyer") and area > idle_area * 0.35 and bottom >= 0:
                dy = base - bottom  # put the feet back on the baseline
            atlas.alpha_composite(im, (i * cw, pad_top + dy))
        if k < 1.0:
            atlas = atlas.resize((ncw * len(frames), nh), Image.LANCZOS)
        folder = folder_root / action
        folder.mkdir(parents=True, exist_ok=True)
        # WebP with alpha: painted detail is ~5x smaller than PNG.
        page = f"{action}-atlas-00.webp"
        for old in folder.glob(f"{action}-atlas-*.png"):
            old.unlink()
        atlas.save(folder / page, "WEBP", quality=90, method=6)
        manifest = {
            "schemaVersion": "3.0", "name": action, "artSource": "painted sheet (supplied artwork)",
            "sourceSize": [ncw, nh], "sourceAnchor": [ncw / 2, round((pad_top + base) * k, 2)],
            "frameCount": len(frames), "durationsMs": durations,
            "durationSeconds": sum(durations) / 1000, "fps": round(1000 * len(frames) / sum(durations), 3),
            "loop": loop, "bodyHeightPx": round(body * k, 2),
            "events": [] if hit is None else [{"name": "hit", "atMs": sum(durations[:hit]), "frame": hit}],
            "sampling": "linear",
            "fallback": {"type": "png-atlas", "cellSize": [ncw, nh],
                         "pages": [{"file": page, "firstFrame": 0, "frameCount": len(frames), "columns": len(frames)}]},
        }
        (folder / "animation.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return {
        "dir": f"monsters/{name}", "height": spec["height"], "facing": 1, "flyer": bool(spec.get("flyer")),
        "source": "supplied painted sheet",
        "actions": {a: a for a in ROWS},
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("names", nargs="*")
    args = ap.parse_args()
    names = args.names or [p.stem for p in sorted(SOURCE.glob("*.*")) if p.stem in MONSTERS]
    index_path = ROOT / "index.json"
    index = json.loads(index_path.read_text())
    index.setdefault("monsters", {})
    for name in names:
        src = next(SOURCE.glob(f"{name}.*"))
        index["monsters"][name] = slice_monster(name, src)
        print("wrote", name)
    index["version"] = time.strftime("%Y%m%d%H%M%S")  # busts browser caches
    index_path.write_text(json.dumps(index, indent=2) + "\n")


if __name__ == "__main__":
    main()
