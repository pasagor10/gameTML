#!/usr/bin/env python3
"""Erase a sword drawn into a hero sheet so the game can draw the equipped one.

The blade is the thin, grey part of the figure: a morphological opening of
the figure mask drops thin parts (blade, but also hair spikes and cape tips);
of those, only low-saturation (steel) pixels, plus the dark outline around
them, are keyed back to magenta. The hilt in the fist stays and is covered
by the equipped weapon's grip.

With --grips, also writes where each frame held the blade (just behind its
base, in cell px) and the angle it pointed, for import_pixel_sheet.py
--grips: the equipped weapon then sits where the drawn one was.

  python3 tools/sprite-rig/erase_baked_weapon.py IN.png OUT.png [--grips G.json]
"""
import argparse
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from import_pixel_sheet import components  # noqa: E402

KEY = (251, 2, 253)


def is_key(p):
    r, g, b = p[0], p[1], p[2]
    return r > 150 and b > 150 and g < 0.55 * min(r, b)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--width", type=int, default=23, help="opening size: parts thinner than this are candidates")
    ap.add_argument("--grid", default="4x8")
    ap.add_argument("--grips", default=None)
    ap.add_argument("--grip-back", type=float, default=14, help="px from blade base back to the fist")
    a = ap.parse_args()
    im = Image.open(a.src).convert("RGB")
    px = im.load()
    W, H = im.size
    mask = Image.new("L", im.size)
    steel = Image.new("L", im.size)
    mp, sp = mask.load(), steel.load()
    for y in range(H):
        for x in range(W):
            p = px[x, y]
            if is_key(p):
                continue
            mp[x, y] = 255
            hi, lo = max(p), min(p)
            if hi - lo < 46 and hi > 95:  # light, unsaturated: blade steel
                sp[x, y] = 255
    opened = mask.filter(ImageFilter.MinFilter(a.width)).filter(ImageFilter.MaxFilter(a.width))
    thin = ImageChops.subtract(mask, opened)
    cand = ImageChops.multiply(thin, steel)
    # Per frame, the blade is the big thin steel piece; small ones (shin
    # guards, armour rims) stay.
    cols, rows = map(int, a.grid.split("x"))
    cw, ch = W / cols, H / rows
    blade = Image.new("L", im.size)
    solid = opened.load()
    grips = {}
    for r in range(rows):
        for c in range(cols):
            box = (round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch))
            cell = cand.crop(box)
            w, h = cell.size
            data = bytearray(1 if v else 0 for v in cell.getdata())
            comps = sorted(components(data, w, h), key=len, reverse=True)
            if not comps:
                continue
            keep = Image.new("L", (w, h))
            kp = keep.load()
            for comp in comps:
                if len(comp) < max(150, 0.35 * len(comps[0])):
                    break
                for j in comp:
                    kp[j % w, j // w] = 255
            blade.paste(keep, box[:2])
            # Grip from the biggest piece: its long axis, base = the end
            # touching the solid body.
            big = comps[0]
            if len(big) < 150:
                continue
            pts = [(j % w, j // w) for j in big]
            mx = sum(x for x, _ in pts) / len(pts)
            my = sum(y for _, y in pts) / len(pts)
            sxx = sum((x - mx) ** 2 for x, _ in pts)
            syy = sum((y - my) ** 2 for _, y in pts)
            sxy = sum((x - mx) * (y - my) for x, y in pts)
            ang = 0.5 * math.atan2(2 * sxy, sxx - syy)
            ux, uy = math.cos(ang), math.sin(ang)
            proj = [(x - mx) * ux + (y - my) * uy for x, y in pts]
            ends = [min(proj), max(proj)]

            def touch(t):
                ex, ey = mx + ux * t, my + uy * t
                n = 0
                for dy in range(-8, 9):
                    for dx in range(-8, 9):
                        X, Y = int(ex + dx) + box[0], int(ey + dy) + box[1]
                        if 0 <= X < W and 0 <= Y < H and solid[X, Y]:
                            n += 1
                return n

            base, tip = (ends[0], ends[1]) if touch(ends[0]) >= touch(ends[1]) else (ends[1], ends[0])
            sign = 1 if tip > base else -1
            gx = mx + ux * (base - sign * a.grip_back)
            gy = my + uy * (base - sign * a.grip_back)
            deg = math.degrees(math.atan2(uy * sign, ux * sign))
            grips[f"{c},{r}"] = [round(gx, 1), round(gy, 1), round(deg)]
    # Grow into the blade's outline, staying inside the thin parts.
    grown = ImageChops.multiply(blade.filter(ImageFilter.MaxFilter(7)), thin)
    gp = grown.load()
    n = 0
    for y in range(H):
        for x in range(W):
            if gp[x, y]:
                px[x, y] = KEY
                n += 1
    # Drop specks the erase left floating (outline bits off the blade).
    left = bytearray(0 if is_key(px[x, y]) else 1 for y in range(H) for x in range(W))
    for comp in components(left, W, H):
        if len(comp) < 40:
            for j in comp:
                px[j % W, j // W] = KEY
    im.save(a.out)
    if a.grips:
        Path(a.grips).write_text(json.dumps(grips, indent=1) + "\n")
        print(f"grips for {len(grips)} frames")
    print(f"keyed {n} px")


if __name__ == "__main__":
    main()
