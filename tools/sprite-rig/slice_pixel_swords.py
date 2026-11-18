#!/usr/bin/env python3
"""Cut the pixel sword sheet into held-weapon pictures.

source/pixel/swords.webp is 6 x 6 upright swords (tip up, grip down) on
flat magenta. Each is keyed, scaled to true pixels (the same scale for all,
so the median sword is HEIGHT px tall, sized for the 48px pixel heroes) and
colour reduced. Writes public/assets/items/held/sword-NN.webp (NN = 0..35,
row by row) and held/index.json with each picture's grip point (share of
the height from the top, where the fist closes on the handle).

  python3 tools/sprite-rig/slice_pixel_swords.py
"""
import json
from pathlib import Path

from PIL import Image

from import_pixel_sheet import components, is_key, keyed

HERE = Path(__file__).resolve().parent
SHEET = HERE / "source/pixel/swords.webp"
OUT = HERE.parents[1] / "public/assets/items/held"
GRID = 6
HEIGHT = 30
COLOURS = 24


def main():
    im = Image.open(SHEET).convert("RGB")
    W, H = im.size
    half = im.resize((W // 2, H // 2), Image.NEAREST)
    w, h = half.size
    px = half.load()
    mask = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            if not is_key(px[x, y]):
                mask[y * w + x] = 1
    boxes = {}
    for pix in components(mask, w, h):
        if len(pix) < 10:
            continue
        xs = [j % w for j in pix]
        ys = [j // w for j in pix]
        c = int(sum(xs) / len(xs) // (w / GRID))
        r = int(sum(ys) / len(ys) // (h / GRID))
        b = (min(xs) * 2, min(ys) * 2, max(xs) * 2 + 2, max(ys) * 2 + 2)
        o = boxes.get(r * GRID + c)
        boxes[r * GRID + c] = (min(o[0], b[0]), min(o[1], b[1]), max(o[2], b[2]), max(o[3], b[3])) if o else b
    missing = [i for i in range(GRID * GRID) if i not in boxes]
    if missing:
        raise SystemExit(f"swords not found: {missing}")
    heights = sorted(b[3] - b[1] for b in boxes.values())
    k = HEIGHT / heights[len(heights) // 2]
    OUT.mkdir(parents=True, exist_ok=True)
    meta = {}
    for i, b in sorted(boxes.items()):
        crop = keyed(im.crop(b))
        sw, sh = max(1, round(crop.width * k)), max(1, round(crop.height * k))
        small = crop.convert("RGBa").resize((sw, sh), Image.Resampling.BOX).convert("RGBA")
        alpha = small.getchannel("A").point(lambda v: 255 if v >= 110 else 0)
        q = small.convert("RGB").quantize(colors=COLOURS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")
        q.putalpha(alpha)
        q = q.crop(q.getbbox())
        q.save(OUT / f"sword-{i}.webp", "WEBP", lossless=True)
        # The fist closes on the handle a little above the pommel.
        meta[f"sword-{i}"] = {"size": [q.width, q.height], "grip": round(1 - 3.5 / q.height, 3)}
    (OUT / "index.json").write_text(json.dumps(meta, indent=1) + "\n")
    print(f"{len(meta)} swords, scale {k:.3f}")


if __name__ == "__main__":
    main()
