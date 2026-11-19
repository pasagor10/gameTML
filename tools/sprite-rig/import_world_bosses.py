#!/usr/bin/env python3
"""Import the labelled world-boss sheets (transparent RGBA, label column on the left).

Sources: source/world-bosses/<name>.webp, rows idle, move, attack, skill,
hit, death, spawn (8/8/8/8/6/8/6 frames). Frames are found by the empty
columns between them inside each row band (rows are not on a strict grid),
trimmed, placed in one cell size per boss with the feet on a shared baseline
and the body centred, and saved as WebP atlases plus animation.json 3.0.

  python3 tools/sprite-rig/import_world_bosses.py          # both
  python3 tools/sprite-rig/import_world_bosses.py naga
"""
import argparse
import json
import time
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1] / "public/assets/sprites"
ROWS = ["idle", "move", "attack", "skill", "hit", "death", "spawn"]
COUNTS = [8, 8, 8, 8, 6, 8, 6]
TIMING = {
    "idle": ([140] * 8, True, None),
    "move": ([100] * 8, True, None),
    "attack": ([90, 90, 100, 110, 80, 90, 110, 130], False, 4),
    "skill": ([100, 120, 140, 70, 80, 110, 130, 150], False, 3),
    "hit": ([40, 40, 50, 50, 50, 60], False, None),
    "death": ([110, 120, 130, 150, 170, 190, 220, 300], False, None),
    "spawn": ([90, 90, 100, 110, 120, 140], False, None),
}
# Row bands (y) and where the label column ends (x), measured per sheet.
SHEETS = {
    "yaksha": dict(bands=[0, 121, 226, 331, 446, 537, 633, 750], label=118, height=330, pixel=True),
    "naga": dict(bands=[0, 93, 165, 248, 329, 400, 472, 562], label=80, height=300, pixel=False),
}
ALPHA = 24  # below this, a pixel is background haze


def segments(frame: Image.Image, count: int):
    """Split a row into `count` frames at its widest empty column runs."""
    a = frame.getchannel("A").load()
    w, h = frame.size
    fill = [sum(1 for y in range(h) if a[x, y] > ALPHA) for x in range(w)]
    filled = [n > 0 for n in fill]
    runs, x = [], 0
    while x < w:
        if filled[x]:
            s = x
            while x < w and filled[x]:
                x += 1
            runs.append([s, x])
        else:
            x += 1
    # Debris and sparks make extra runs: join the closest neighbours first.
    while len(runs) > count:
        k = min(range(len(runs) - 1), key=lambda i: runs[i + 1][0] - runs[i][1])
        runs[k] = [runs[k][0], runs[k + 1][1]]
        del runs[k + 1]
    # Touching frames (a swoosh reaching the next one): cut the widest run at
    # its thinnest column, away from the edges.
    while len(runs) < count:
        k = max(range(len(runs)), key=lambda i: runs[i][1] - runs[i][0])
        s, e = runs[k]
        lo, hi = s + (e - s) // 4, e - (e - s) // 4
        cut = min(range(lo, hi), key=lambda x: fill[x])
        runs[k:k + 1] = [[s, cut], [cut, e]]
    if len(runs) != count:
        raise ValueError(f"expected {count} frames, found {len(runs)}")
    return runs


def body_x(im: Image.Image):
    """X centroid of the lower half of the opaque pixels: the feet / coil."""
    a = im.getchannel("A").load()
    w, h = im.size
    sx = n = 0
    for y in range(h // 2, h):
        for x in range(w):
            if a[x, y] > 128:
                sx += x
                n += 1
    return sx / n if n else w / 2


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("names", nargs="*", metavar="boss")
    args = ap.parse_args()
    if any(n not in SHEETS for n in args.names):
        ap.error("unknown boss; choose from " + ", ".join(SHEETS))
    index_path = ROOT / "index.json"
    index = json.loads(index_path.read_text())
    for name in args.names or SHEETS:
        spec = SHEETS[name]
        sheet = Image.open(HERE / "source/world-bosses" / f"{name}.webp").convert("RGBA")
        # Drop the faint row separator lines and haze.
        sheet.putalpha(sheet.getchannel("A").point(lambda v: 0 if v < ALPHA else v))
        rows = []
        for r, count in enumerate(COUNTS):
            y0, y1 = spec["bands"][r] + 3, spec["bands"][r + 1] - 2
            band = sheet.crop((spec["label"], y0, sheet.width, y1))
            frames = []
            for s, e in segments(band, count):
                f = band.crop((s, 0, e, band.height))
                box = f.getbbox()
                frames.append(f.crop(box))
            rows.append(frames)
        idle_h = sorted(f.height for f in rows[0])[len(rows[0]) // 2]
        # One cell for every clip: wide enough for the body centred plus spills.
        half = max(max(body_x(f), f.width - body_x(f)) for row in rows for f in row)
        cw = int(half * 2) + 4
        ch = max(f.height for row in rows for f in row) + 6
        base = ch - 3
        for action, frames in zip(ROWS, rows):
            durations, loop, hit = TIMING[action]
            atlas = Image.new("RGBA", (cw * len(frames), ch))
            for i, f in enumerate(frames):
                x = round(i * cw + cw / 2 - body_x(f))
                atlas.alpha_composite(f, (x, base - f.height))
            folder = ROOT / "monsters" / name / action
            folder.mkdir(parents=True, exist_ok=True)
            for old in folder.glob(f"{action}-atlas-*"):
                old.unlink()
            page = f"{action}-atlas-00.webp"
            atlas.save(folder / page, "WEBP", lossless=True)
            manifest = {
                "schemaVersion": "3.0", "name": action, "artSource": "supplied world boss sheet",
                "sourceSize": [cw, ch], "sourceAnchor": [cw / 2, base],
                "frameCount": len(frames), "durationsMs": durations,
                "durationSeconds": sum(durations) / 1000,
                "fps": round(1000 * len(frames) / sum(durations), 3),
                "loop": loop, "bodyHeightPx": idle_h,
                "events": [] if hit is None else [{"name": "hit", "atMs": sum(durations[:hit]), "frame": hit}],
                "sampling": "nearest" if spec["pixel"] else "linear",
                "fallback": {"type": "png-atlas", "cellSize": [cw, ch],
                             "pages": [{"file": page, "firstFrame": 0, "frameCount": len(frames),
                                        "columns": len(frames)}]},
            }
            (folder / "animation.json").write_text(json.dumps(manifest, indent=2) + "\n")
        portrait = rows[0][0]
        portrait.save(ROOT / "monsters" / name / "portrait.webp", "WEBP", lossless=True)
        index["monsters"][name] = {
            "dir": f"monsters/{name}", "height": spec["height"], "facing": -1, "flyer": False,
            "source": "supplied world boss sheet (import_world_bosses.py)", "portrait": "portrait.webp",
            "actions": {a: a for a in ROWS}, "pixel": spec["pixel"],
        }
        print(f"{name}: cell {cw}x{ch}, idle body {idle_h}px -> {spec['height']} world px")
    index["version"] = time.time_ns()
    index_path.write_text(json.dumps(index, indent=2) + "\n")


if __name__ == "__main__":
    main()
