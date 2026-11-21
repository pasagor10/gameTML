#!/usr/bin/env python3
"""Cut the pixel item sheets into item icons and held weapons.

Each sheet in source/pixel/ is 6 x 6 items on flat magenta, numbered 0..35
row by row. All sheets share one theme layout per row, so an item keeps the
same index across groups (public/item-art.js maps items to indices):
  row 0 plain   row 1 fire / lava / dark   row 2 water / ice
  row 3 nature  row 4 moon / star / storm  row 5 gold / sun / legendary
(charms: rings, necklaces, bracelets, brooches, earrings, amulets by row).

Every item is keyed, scaled to true pixels (one scale per sheet, so the
median item is HEIGHT px tall) and colour reduced, then written as
  public/assets/items/px/<group>-N.webp    icon: square, 4x nearest
  public/assets/items/held/<group>-N.webp  weapons only: true pixels,
                                           held upright in the hero's fist
  public/assets/items/held{2,4}x/<group>-N.webp  the same at 2x / 4x the
      pixel count, for finer bodies (2x remakes, the hero-select stage)

  python3 tools/sprite-rig/slice_pixel_items.py
  python3 tools/sprite-rig/slice_pixel_items.py --held-detail 2 4   # finer held copies only
"""
import argparse
from pathlib import Path

from PIL import Image

from import_pixel_sheet import components, is_key, keyed

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "source/pixel"
ITEMS = HERE.parents[1] / "public/assets/items"
GRID = 6
ICON_SCALE = 4
COLOURS = 24
# group: (sheet, median height in true pixels, held weapon?)
GROUPS = {
    "sword": ("swords.webp", 30, True),
    "bow": ("bows.webp", 30, True),
    "staff": ("staffs.webp", 38, True),
    "mace": ("maces.webp", 32, True),
    "armor": ("armors.webp", 26, False),
    "boots": ("boots.webp", 24, False),
    "charm": ("charms.webp", 22, False),
}


def boxes_of(im):
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
    return boxes


def slice_group(group, sheet, height, held, detail=1):
    """detail > 1: only write held<detail>x/, detail times finer."""
    im = Image.open(SOURCE / sheet).convert("RGB")
    boxes = boxes_of(im)
    missing = [i for i in range(GRID * GRID) if i not in boxes]
    if missing:
        raise SystemExit(f"{sheet}: items not found: {missing}")
    heights = sorted(b[3] - b[1] for b in boxes.values())
    k = height * detail / heights[len(heights) // 2]
    for i, b in sorted(boxes.items()):
        crop = keyed(im.crop(b))
        sw, sh = max(1, round(crop.width * k)), max(1, round(crop.height * k))
        small = crop.convert("RGBa").resize((sw, sh), Image.Resampling.BOX).convert("RGBA")
        alpha = small.getchannel("A").point(lambda v: 255 if v >= 110 else 0)
        q = small.convert("RGB").quantize(colors=COLOURS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")
        q.putalpha(alpha)
        q = q.crop(q.getbbox())
        if detail > 1:
            q.save(ITEMS / f"held{detail}x" / f"{group}-{i}.webp", "WEBP", lossless=True)
            continue
        if held:
            q.save(ITEMS / "held" / f"{group}-{i}.webp", "WEBP", lossless=True)
        side = max(q.width, q.height) + 2
        icon = Image.new("RGBA", (side, side))
        icon.alpha_composite(q, ((side - q.width) // 2, (side - q.height) // 2))
        icon = icon.resize((side * ICON_SCALE, side * ICON_SCALE), Image.NEAREST)
        icon.save(ITEMS / "px" / f"{group}-{i}.webp", "WEBP", lossless=True)
    print(f"{group}: {len(boxes)} items, scale {k:.3f}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--held-detail", type=int, nargs="*", default=None)
    a = ap.parse_args()
    if a.held_detail:
        for d in a.held_detail:
            (ITEMS / f"held{d}x").mkdir(parents=True, exist_ok=True)
            for group, (sheet, height, held) in GROUPS.items():
                if held:
                    slice_group(group, sheet, height, held, d)
        return
    (ITEMS / "px").mkdir(parents=True, exist_ok=True)
    (ITEMS / "held").mkdir(parents=True, exist_ok=True)
    for group, (sheet, height, held) in GROUPS.items():
        slice_group(group, sheet, height, held)


if __name__ == "__main__":
    main()
