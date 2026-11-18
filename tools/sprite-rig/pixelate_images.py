#!/usr/bin/env python3
"""Give the painted town, backgrounds and select-screen art the pixel look of
the heroes, keeping every file's size (so no draw code changes).

Each picture is averaged into BLOCK x BLOCK source-pixel squares, its colours
reduced (no dithering), alpha made binary, then blown back up to its own size
with nearest neighbour. BLOCK is picked from how big the picture is drawn, so
one art pixel comes out near the heroes' ~1.7 world px (town kit pieces draw
at 1 source px = 1 world px; the cave backdrop is stretched 1.56x; the slot
machine and the player stall are drawn at half size). Lossless webp/png.

Run once on the original art (re-running would quantize again; harmless but
pointless):  python3 tools/sprite-rig/pixelate_images.py [glob ...]
"""
from pathlib import Path

from PIL import Image

PUBLIC = Path(__file__).resolve().parents[2] / "public"
COLOURS = 64
# path (glob under public/), block in source px
JOBS = [
    ("assets/town-kit/piece-*.webp", 2),
    ("assets/town-kit/prop-*.webp", 2),
    ("assets/town-kit/anim-*.webp", 2),
    ("assets/town-kit/street.webp", 2),
    ("assets/town-kit/far-clouds.webp", 2),
    ("assets/town-kit/far-hills.webp", 2),
    ("assets/town-kit/far-mountains.webp", 2),
    ("assets/town-kit/far-treeline.webp", 2),
    ("assets/town-kit/far-sky.webp", 1),
    ("assets/town-kit/player-market-stall.webp", 4),
    ("assets/town-kit/slot-machine-v2.png", 4),
    ("assets/town-kit/slot-machine.webp", 4),
    ("assets/cave.webp", 1),
    ("assets/town.webp", 2),
    ("assets/selection/sanctuary-lake.webp", 3),
    ("assets/selection/pixel-sanctuary-v1.png", 2),
    # Slime motion atlas (256px cells shown ~125 world px) and the static
    # monster sheet shown until a monster's sprite set loads.
    ("assets/animations/slime.png", 4),
    ("assets/monsters.png", 4),
]


def pixelate(path, block):
    im = Image.open(path).convert("RGBA")
    W, H = im.size
    has_alpha = im.getchannel("A").getextrema()[0] < 255
    small = im.convert("RGBa").resize((max(1, round(W / block)), max(1, round(H / block))), Image.Resampling.BOX).convert("RGBA")
    alpha = small.getchannel("A").point(lambda v: 255 if v >= 120 else 0)
    q = small.convert("RGB").quantize(colors=COLOURS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")
    if has_alpha:
        q.putalpha(alpha)
    out = q.resize((W, H), Image.NEAREST)
    if path.suffix == ".png":
        out.save(path, optimize=True)
    else:
        out.save(path, "WEBP", lossless=True)


def main():
    import sys
    only = sys.argv[1:]
    for pattern, block in JOBS:
        if only and pattern not in only:
            continue
        for path in sorted(PUBLIC.glob(pattern)):
            pixelate(path, block)
            print(f"{path.relative_to(PUBLIC)}: block {block}")


if __name__ == "__main__":
    main()
