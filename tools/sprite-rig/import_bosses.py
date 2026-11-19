#!/usr/bin/env python3
"""Import the original RGBA 4x6 boss sheets; keep alpha, align feet and write atlases.
Run: python3 tools/sprite-rig/import_bosses.py [boss-id ...]
Prompts and untouched source sheets live in source/bosses/.
"""
import argparse
import json
import time
from pathlib import Path
from PIL import Image
from import_pixel_monsters import cells, write_set
from pixel_snap import quantize
from slice_monsters import ROWS, TIMING

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SIZES = {"frost-revenant": 195, "ember-colossus": 210, "thorn-queen": 200,
         "storm-roc": 185, "moon-emperor": 215}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("names", nargs="*", metavar="boss-id")
    args = parser.parse_args()
    if any(name not in SIZES for name in args.names):
        parser.error("unknown boss id; choose from " + ", ".join(SIZES))
    index_path = ROOT / "public/assets/sprites/index.json"
    index = json.loads(index_path.read_text())
    for name in args.names or SIZES:
        sheet = Image.open(HERE / "source/bosses" / f"{name}.png").convert("RGBA")
        if sheet.size != (1024, 1536):
            raise ValueError(f"{name}: expected a 1024x1536, 4x6 sheet")
        # Generated sheets have faint translucent ambience outside the silhouette.
        # Binary alpha removes it while preserving the opaque pixel-art body.
        sheet.putalpha(sheet.getchannel("A").point(lambda a: 255 if a >= 180 else 0))
        rows = cells(sheet, 4, 6)
        frames = quantize([cell.resize((96, 96), Image.Resampling.NEAREST)
                           for row in rows for cell in row], colours=64)
        rows = [frames[r * 4:(r + 1) * 4] for r in range(6)]
        write_set("monsters", name, rows, ROWS, lambda a: TIMING[a], SIZES[name], False)
        folder = ROOT / "public/assets/sprites/monsters" / name
        # Separate portrait avoids relying on hardcoded atlas aspect ratios in UI.
        portrait = rows[0][0]
        portrait.crop(portrait.getbbox()).save(folder / "portrait.webp", lossless=True)
        index["monsters"][name] = {
            "dir": f"monsters/{name}", "height": SIZES[name], "facing": 1, "flyer": False,
            "source": "original generated boss sheet (import_bosses.py)",
            "portrait": "portrait.webp", "actions": {a: a for a in ROWS}, "pixel": True,
        }
    index["version"] = time.time_ns()
    index_path.write_text(json.dumps(index, indent=2) + "\n")


if __name__ == "__main__":
    main()
