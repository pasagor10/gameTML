"""Erase a cool-tinted (lavender steel) blade drawn into a hero sheet.

  python3 tools/sprite-rig/erase_tinted_blade.py IN.png OUT.png GRIPS.json

Used for swordsman-male-knight-v1 (guardian-2). Frames where no blade is
found get no grip; add those by hand.

Blade pixels are cool (blue >= red > green) and light; the armour is warm
grey and the cape teal. Per frame: the longest straight band of blade
pixels is the blade; along it, pixels with background on both sides are
keyed out, and where it crosses the body it is filled from both sides.
"""
import json
import math
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from import_pixel_sheet import components  # noqa: E402

KEY = (251, 2, 253)


def is_key(p):
    r, g, b = p[0], p[1], p[2]
    return r > 150 and b > 150 and g < 0.55 * min(r, b)


def is_blade(p):
    r, g, b = p
    if is_key(p):
        return False
    return max(p) > 105 and b >= r - 4 and b > g + 8 and r >= g - 2 and (b - g) < 60


def main(src, out, grips_out, grip_back=14.0, rows=8, cols=4):
    im = Image.open(src).convert("RGB")
    px = im.load()
    W, H = im.size
    cw, ch = W / cols, H / rows
    grips, n = {}, 0
    for r in range(rows):
        for c in range(cols):
            x0, y0, x1, y1 = round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch)
            pts = [(x, y) for y in range(y0, y1) for x in range(x0, x1) if is_blade(px[x, y])]
            best = None
            for deg in range(0, 180, 2):
                t_ = math.radians(deg)
                ux, uy, nx, ny = math.cos(t_), math.sin(t_), -math.sin(t_), math.cos(t_)
                bins = {}
                for x, y in pts:
                    bins.setdefault(int((x * nx + y * ny) // 2), []).append(x * ux + y * uy)
                for b0 in bins:
                    ts = sorted(t for k in range(b0, b0 + 5) for t in bins.get(k, ()))
                    start, prev, cnt = None, None, 0
                    for t in ts:
                        if prev is None or t - prev > 10:
                            start, cnt = t, 0
                        prev = t
                        cnt += 1
                        score = (prev - start) * min(1, cnt / max(1, (prev - start) * 2))
                        if best is None or score > best[0]:
                            best = (score, deg, b0, start, prev)
            if not best or best[0] < 30:
                print("no blade", c, r)
                continue
            _, deg, b0, ta, tb = best
            t_ = math.radians(deg)
            ux, uy, nx, ny = math.cos(t_), math.sin(t_), -math.sin(t_), math.cos(t_)
            ds = [x * nx + y * ny for x, y in pts
                  if b0 * 2 - 4 <= x * nx + y * ny < b0 * 2 + 14 and ta <= x * ux + y * uy <= tb]
            dc = sum(ds) / len(ds)
            ds.sort()
            lo_d, hi_d = ds[int(len(ds) * 0.05)] - dc, ds[int(len(ds) * 0.95)] - dc
            hw = max(-lo_d, hi_d) + 3  # + dark outline

            def at(t, k):
                return ux * t + nx * (dc + k), uy * t + ny * (dc + k)

            def inside(X, Y):
                return x0 <= X < x1 and y0 <= Y < y1

            def bg(x, y):
                X, Y = int(round(x)), int(round(y))
                return not inside(X, Y) or is_key(px[X, Y])

            # Which end is the hilt: the end whose continuation is body.
            def solid_run(t0, s):
                return sum(not bg(*at(t0 + s * k, 0)) for k in range(3, 14))

            if solid_run(ta, -1) >= solid_run(tb, 1):
                base, sign = ta, 1
            else:
                base, sign = tb, -1
            # Erase from just past the base (crossguard stays in the fist)
            # out past the tip.
            t_from, t_to = (ta + 1, tb + 4) if sign == 1 else (tb - 1, ta - 4)
            step = 1 if t_to > t_from else -1
            orig = im.copy().load()
            keyset, holes = set(), set()
            t = t_from
            while (t - t_to) * step <= 0:
                side = hw + 3
                open_a = bg(*at(t, side))
                open_b = bg(*at(t, -side))
                lim_a = hw + 5 if open_a else hw + 1
                lim_b = hw + 5 if open_b else hw + 1
                for k10 in range(int(-lim_b * 2), int(lim_a * 2) + 1):
                    k = k10 / 2
                    X, Y = (int(round(v)) for v in at(t, k))
                    if not inside(X, Y) or is_key(orig[X, Y]):
                        continue
                    (keyset if (open_a or open_b) else holes).add((X, Y))
                t += step * 0.5
            holes -= keyset
            for X, Y in keyset:
                px[X, Y] = KEY
            n += len(keyset) + len(holes)
            # Inpaint holes from the outside in: average known neighbours.
            todo = set(holes)
            while todo:
                ready = []
                for X, Y in todo:
                    nb = [px[X + dx, Y + dy] for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                          if (dx or dy) and (X + dx, Y + dy) not in todo
                          and 0 <= X + dx < W and 0 <= Y + dy < H and not is_key(px[X + dx, Y + dy])]
                    if len(nb) >= 2:
                        ready.append(((X, Y), tuple(sum(p[i] for p in nb) // len(nb) for i in range(3))))
                if not ready:
                    for X, Y in todo:
                        px[X, Y] = KEY
                    break
                for (X, Y), col in ready:
                    px[X, Y] = col
                    todo.discard((X, Y))
            gt = base - sign * grip_back
            gx, gy = at(gt, 0)
            grips[f"{c},{r}"] = [round(gx - x0, 1), round(gy - y0, 1),
                                 round(math.degrees(math.atan2(uy * sign, ux * sign)))]
    left = bytearray(0 if is_key(px[x, y]) else 1 for y in range(H) for x in range(W))
    for comp in components(left, W, H):
        if len(comp) < 40:
            for j in comp:
                px[j % W, j // W] = KEY
    im.save(out)
    Path(grips_out).write_text(json.dumps(grips, indent=1) + "\n")
    print("px", n, "grips", len(grips))


if __name__ == "__main__":
    main(*sys.argv[1:4])
