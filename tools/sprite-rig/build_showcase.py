#!/usr/bin/env python3
"""Sharp idle frames for the hero select screen.

The runtime atlases are shrunk to a 140px body (compact_hero_atlases.py),
which looks soft when the select screen shows a hero three times larger.
This builds one showcase frame per hero set from the full-resolution idle
frame (source/showcase/<dir>.webp, the first idle cell before compaction):
upscaled 2x with Lanczos and lightly sharpened. The frame covers the same
cell as the atlas idle frame, so the client swaps it in place of the idle
sprite at the same size and anchor.

Writes public/assets/sprites/<dir>/showcase.webp and adds "showcase" to the
matching sets in index.json (bumping its version so clients refetch).
"""
import json
from pathlib import Path
from time import time_ns

from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1] / "public/assets/sprites"
SOURCE = HERE / "source/showcase"
SCALE = 2
NAME = "showcase.webp"


def build(source, out):
    with Image.open(source) as im:
        im = im.convert("RGBA")
        big = im.resize((im.width * SCALE, im.height * SCALE), Image.Resampling.LANCZOS)
        # Sharpen colour only; sharpening alpha would ring around the outline.
        rgb = big.convert("RGB").filter(ImageFilter.UnsharpMask(radius=1.4, percent=70, threshold=2))
        rgb.putalpha(big.getchannel("A"))
        rgb.save(out, "WEBP", quality=90, method=6)


def main():
    index_path = ROOT / "index.json"
    index = json.loads(index_path.read_text())
    built = set()
    for source in sorted(SOURCE.glob("*.webp")):
        folder = ROOT / source.stem
        if not folder.is_dir():
            print("skip (no set folder)", source.stem)
            continue
        build(source, folder / NAME)
        built.add(source.stem)
        print("built", source.stem)
    for spec in index["sets"].values():
        if spec.get("dir") in built and "layers" not in spec:
            spec["showcase"] = NAME
    index["version"] = time_ns()
    index_path.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
