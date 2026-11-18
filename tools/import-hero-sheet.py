#!/usr/bin/env python3
"""Turn one 4x8 hero sheet on a flat magenta background into a game sprite set.

Rows (top to bottom): idle, walk, run, jump, attack, skill, hit, death;
four frames each, left to right. Usage:

  python3 tools/import-hero-sheet.py SHEET.png swordsman-female-guardian-2
  python3 tools/import-hero-sheet.py SHEET.png KEY --out /tmp/x --no-register

Writes public/assets/sprites/<KEY>/<action>/{animation.json,<action>-atlas-00.webp}
and registers <KEY> in public/assets/sprites/index.json. The game picks the
set by name: <class>-<gender>-<specialization>-<tier> (see heroSkins()).
"""
import argparse
import json
import os
import sys
import time

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "sprites")
ROWS = ["idle", "walk", "run", "jump", "attack", "skill", "hurt", "death"]
COLS = 4
# Per-action timing (ms per frame), looping, and the impact frame for hits.
TIMING = {
    "idle": ([180] * 4, True, None),
    "walk": ([130] * 4, True, None),
    "run": ([95] * 4, True, None),
    "jump": ([120] * 4, False, None),
    "attack": ([70, 80, 90, 120], False, 2),
    "skill": ([90, 100, 110, 160], False, 2),
    "hurt": ([70, 90, 90, 110], False, None),
    "death": ([140, 160, 180, 400], False, None),
}
# Game state -> folder (index.json "actions").
ACTIONS = {
    "idle": "idle",
    "walk": "walk",
    "run": "run",
    "jump": "jump",
    "attack": "attack",
    "skill": "skill",
    "hit": "hurt",
    "death": "death",
}


def key_out_magenta(img):
    """Flat #FF00FF -> transparent, with a soft edge and the pink spill removed."""
    img = img.convert("RGBA")
    out = []
    pixels = (
        img.get_flattened_data() if hasattr(img, "get_flattened_data") else img.getdata()
    )
    for r, g, b, a in pixels:
        # How magenta a pixel is: red and blue both well above green.
        m = min(r, b) - g
        if m > 150:
            out.append((0, 0, 0, 0))
            continue
        if m > 60:
            keep = 1 - (m - 60) / 90  # fade the fringe
            # Pull the pink spill back toward neutral before fading it.
            r = g + (r - g) * 0.35
            b = g + (b - g) * 0.35
            out.append((int(r), g, int(b), int(a * keep)))
            continue
        if m > 25:  # faint pink tint left on edges: neutralise it
            r = g + (r - g) * 0.7
            b = g + (b - g) * 0.7
        out.append((int(r), g, int(b), a))
    img.putdata(out)
    return img


def opaque_box(cell, threshold=24):
    alpha = cell.getchannel("A").point(lambda v: 255 if v > threshold else 0)
    return alpha.getbbox()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sheet", help="a sheet, or a folder of <key>.png sheets")
    ap.add_argument("key", nargs="?", help="e.g. swordsman-female-guardian-2")
    ap.add_argument("--height", type=int, default=112, help="on-screen body px")
    ap.add_argument("--out", default=ROOT)
    ap.add_argument("--no-register", action="store_true")
    args = ap.parse_args()
    if os.path.isdir(args.sheet):
        # Batch: every image in the folder, named after its set key.
        folder = args.sheet
        for name in sorted(os.listdir(folder)):
            stem, ext = os.path.splitext(name)
            if ext.lower() in (".png", ".webp", ".jpg", ".jpeg"):
                args.sheet, args.key = os.path.join(folder, name), stem
                import_sheet(args)
        return
    if not args.key:
        ap.error("key is required for a single sheet")
    import_sheet(args)


def import_sheet(args):
    sheet = key_out_magenta(Image.open(args.sheet))
    W, H = sheet.size
    cells = []
    for row in range(len(ROWS)):
        line = []
        for col in range(COLS):
            # Rounded grid edges keep odd sheet sizes from drifting.
            x0, x1 = round(col * W / COLS), round((col + 1) * W / COLS)
            y0, y1 = round(row * H / len(ROWS)), round((row + 1) * H / len(ROWS))
            line.append(sheet.crop((x0, y0, x1, y1)))
        cells.append(line)
    cw = min(c.size[0] for line in cells for c in line)
    ch = min(c.size[1] for line in cells for c in line)
    cells = [[c.crop((0, 0, cw, ch)) for c in line] for line in cells]

    # One shared crop for every frame, so feet stay put between actions.
    boxes = [opaque_box(c) for line in cells for c in line]
    boxes = [b for b in boxes if b]
    if not boxes:
        sys.exit("sheet is empty after removing the background")
    pad = 6
    left = max(0, min(b[0] for b in boxes) - pad)
    top = max(0, min(b[1] for b in boxes) - pad)
    right = min(cw, max(b[2] for b in boxes) + pad)
    bottom = min(ch, max(b[3] for b in boxes) + pad)
    fw, fh = right - left, bottom - top

    # Feet line and body height from the idle row.
    idle = [opaque_box(c) for c in cells[0]]
    idle = [b for b in idle if b]
    feet = sorted(b[3] for b in idle)[len(idle) // 2] - top
    body = sorted(b[3] - b[1] for b in idle)[len(idle) // 2]
    anchor_x = sorted((b[0] + b[2]) / 2 for b in idle)[len(idle) // 2] - left

    dest = os.path.join(args.out, args.key)
    for row, name in enumerate(ROWS):
        folder = os.path.join(dest, name)
        os.makedirs(folder, exist_ok=True)
        atlas = Image.new("RGBA", (fw * COLS, fh), (0, 0, 0, 0))
        for col, cell in enumerate(cells[row]):
            atlas.paste(cell.crop((left, top, right, bottom)), (col * fw, 0))
        page = f"{name}-atlas-00.webp"
        atlas.save(os.path.join(folder, page), "WEBP", quality=90, method=6)
        durations, loop, hit = TIMING[name]
        manifest = {
            "schemaVersion": "3.0",
            "name": name,
            "artSource": f"4x8 sheet {os.path.basename(args.sheet)}",
            "sourceSize": [fw, fh],
            "sourceAnchor": [round(anchor_x, 2), round(feet, 2)],
            "frameCount": COLS,
            "durationsMs": durations,
            "durationSeconds": sum(durations) / 1000,
            "fps": round(COLS / (sum(durations) / 1000), 3),
            "loop": loop,
            "bodyHeightPx": float(body),
            "events": (
                [{"name": "hit", "atMs": sum(durations[:hit]), "frame": hit}]
                if hit is not None
                else []
            ),
            "sampling": "linear",
            "fallback": {
                "type": "png-atlas",
                "cellSize": [fw, fh],
                "pages": [
                    {"file": page, "firstFrame": 0, "frameCount": COLS, "columns": COLS}
                ],
            },
        }
        with open(os.path.join(folder, "animation.json"), "w") as f:
            json.dump(manifest, f, indent=2)

    # Portrait for slots, inventory and HUD: the first idle frame.
    cells[0][0].crop((left, top, right, bottom)).save(
        os.path.join(dest, "portrait.webp"), "WEBP", quality=90, method=6
    )

    if not args.no_register:
        index_path = os.path.join(ROOT, "index.json")
        with open(index_path) as f:
            index = json.load(f)
        index.setdefault("sets", {})[args.key] = {
            "dir": os.path.relpath(dest, ROOT),
            "height": args.height,
            "facing": 1,
            "source": f"4x8 sheet {os.path.basename(args.sheet)}",
            "portrait": "portrait.webp",
            "actions": ACTIONS,
        }
        index["version"] = time.strftime("%Y%m%d%H%M%S")
        with open(index_path, "w") as f:
            json.dump(index, f, indent=2, ensure_ascii=False)
            f.write("\n")
    print(f"{args.key}: {COLS}x{len(ROWS)} frames {fw}x{fh}, body {body}px -> {dest}")


if __name__ == "__main__":
    main()
