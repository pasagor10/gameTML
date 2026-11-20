#!/usr/bin/env python3
"""Turn an AI-drawn pixel-art hero sheet into a layered game sprite set.

The sheets (tools/sprite-rig/source/pixel/) are 4 columns x 8 rows of one
look on flat magenta, or 8 x 8 with two looks side by side. Rows, top to
bottom: idle, walk, run, jump, attack, skill, hurt, death. The hero's hands
are empty: the game draws the equipped weapon in the front fist.

The art is "pixel style" at high resolution with a soft, off-grid pixel
look, so each frame is
  1. found as a blob on the magenta (connected components),
  2. scaled down to a true pixel grid (BODY px tall at idle), with the
     magenta keyed out, alpha made binary and the colours reduced to one
     shared palette,
  3. placed in a common cell with its feet on the row's ground line.
The front fist is found per frame (skin-coloured blob furthest from the
shoulder, front-most) and becomes the hand socket [x, y, degrees] the game
holds the weapon at; the fist pixels also go to a hand layer drawn over the
weapon grip. Weapon angles per frame come from ANGLES.

Writes public/assets/sprites/<dir>/{body,hand}/<action>/ and portrait.webp,
and registers the set in index.json.

  python3 tools/sprite-rig/import_pixel_sheet.py SHEET KEY [--cols 0-3] [--grid 4x8] [--name "..."]
"""
import argparse
import json
import math
from collections import deque
from pathlib import Path
from time import time_ns

from PIL import Image

HERE = Path(__file__).resolve().parent
SPRITES = HERE.parents[1] / "public/assets/sprites"
ROWS = ["idle", "walk", "run", "jump", "attack", "skill", "hurt", "death"]
BODY = 48  # idle body height in output pixels (shown 2x in game)
PALETTE = 64
# ms per frame, loop, impact frame
TIMING = {
    "idle": ([220] * 4, True, None),
    "walk": ([140] * 4, True, None),
    "run": ([100] * 4, True, None),
    "jump": ([120] * 4, False, None),
    "attack": ([70, 80, 100, 130], False, 2),
    "skill": ([90, 110, 120, 170], False, 2),
    "hurt": ([70, 90, 90, 110], False, None),
    "death": ([140, 160, 180, 400], False, None),
}
# Direction the held weapon points per frame (degrees, y down: -90 is up,
# 0 forward). Facing right, as drawn.
ANGLES = {
    "idle": [-62, -64, -62, -60],
    "walk": [-58, -64, -58, -64],
    "run": [-24, -30, -24, -30],
    "jump": [-50, -70, -80, -45],
    "attack": [-75, -140, -5, -55],
    "skill": [-30, -160, -95, -50],
    "hurt": [-95, -110, -90, -70],
    "death": [-40, -10, 5, 0],
}
GROUND_ROWS = {"idle", "walk", "run", "attack", "hurt"}
# Rows whose poses may hold the fist low and forward (crouches).
LOW_FIST_ROWS = {"jump", "attack", "skill"}


def is_key(p):
    r, g, b = p[0], p[1], p[2]
    return r > 150 and b > 150 and g < 0.55 * min(r, b)


def is_skin(p):
    r, g, b = p[0], p[1], p[2]
    return r > 195 and 140 < g < 228 and 95 < b < 200 and 12 < r - g < 80 and 10 < g - b < 70


def components(mask, w, h, conn8=True):
    """Connected components of a bytearray mask: list of pixel index lists."""
    seen = bytearray(w * h)
    out = []
    steps = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)] if conn8 else [(0, -1), (-1, 0), (1, 0), (0, 1)]
    for i in range(w * h):
        if not mask[i] or seen[i]:
            continue
        seen[i] = 1
        q, pix = deque([i]), []
        while q:
            j = q.popleft()
            pix.append(j)
            x, y = j % w, j // w
            for dx, dy in steps:
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < h:
                    k = yy * w + xx
                    if mask[k] and not seen[k]:
                        seen[k] = 1
                        q.append(k)
        out.append(pix)
    return out


def find_frames(im, cols, rows, col_range):
    """Bounding boxes (full res) of each frame, keyed (col, row) in the look."""
    W, H = im.size
    half = im.resize((W // 2, H // 2), Image.NEAREST)
    w, h = half.size
    px = half.load()
    mask = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            if not is_key(px[x, y]):
                mask[y * w + x] = 1
    cw, ch = w / cols, h / rows
    boxes = {}
    for pix in components(mask, w, h):
        if len(pix) < 12:
            continue
        xs = [j % w for j in pix]
        ys = [j // w for j in pix]
        cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
        c, r = int(cx // cw), int(cy // ch)
        if not col_range[0] <= c <= col_range[1]:
            continue
        b = (min(xs) * 2, min(ys) * 2, max(xs) * 2 + 2, max(ys) * 2 + 2)
        o = boxes.get((c - col_range[0], r))
        boxes[(c - col_range[0], r)] = (min(o[0], b[0]), min(o[1], b[1]), max(o[2], b[2]), max(o[3], b[3])) if o else b
    return boxes, W / cols, H / rows


def keyed(crop):
    """RGBA with the magenta keyed out."""
    rgba = crop.convert("RGBA")
    px = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            if is_key(px[x, y]):
                px[x, y] = (0, 0, 0, 0)
    return rgba


def front_fist(rgba, low_ok=False):
    """(x, y) of the front fist centre in the crop, or None."""
    w, h = rgba.size
    px = rgba.load()
    opaque = [(x, y) for y in range(h) for x in range(w) if px[x, y][3]]
    if not opaque:
        return None
    y0 = min(y for _, y in opaque)
    y1 = max(y for _, y in opaque)
    x0 = min(x for x, _ in opaque)
    x1 = max(x for x, _ in opaque)
    H = y1 - y0 + 1
    mask = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] and is_skin(p):
                mask[y * w + x] = 1
    comps = [c for c in components(mask, w, h) if len(c) >= 7]
    if not comps:
        return None
    # The face: the sizeable skin blob nearest the middle of the head (the
    # top 30% of the figure), wherever the pose puts the head.
    top = [(x, y) for x, y in opaque if y < y0 + 0.3 * H]
    head = (sum(x for x, _ in top) / len(top), y0 + 0.3 * H)

    def gap(c):
        cx = sum(j % w for j in c) / len(c)
        cy = sum(j // w for j in c) / len(c)
        return (cx - head[0]) ** 2 + (cy - head[1]) ** 2

    sizeable = [c for c in comps if len(c) >= 0.4 * max(len(q) for q in comps)]
    face = min(sizeable, key=gap)
    shoulder = ((x0 + x1) / 2, y0 + 0.38 * H)
    radius = max(3.0, 0.06 * H)
    best = None
    for c in comps:
        if c is face:
            continue
        pts = [(j % w, j // w) for j in c]
        far = max(pts, key=lambda p: (p[0] - shoulder[0]) ** 2 + (p[1] - shoulder[1]) ** 2)
        near = [p for p in pts if (p[0] - far[0]) ** 2 + (p[1] - far[1]) ** 2 <= (radius * 1.6) ** 2]
        fx = sum(p[0] for p in near) / len(near)
        fy = sum(p[1] for p in near) / len(near)
        # Legs (bare shins), unless lying down or the fist is out in front
        # near the ground in a crouched jump, attack or skill pose.
        low_front = low_ok and fx > (x0 + x1) / 2 + 0.25 * (x1 - x0)
        if fy > y0 + 0.76 * H and H > 0.6 * (x1 - x0) and not low_front:
            continue
        if best is None or fx > best[0]:
            best = (fx, fy)
    return best


def quantize_all(frames):
    """One palette for every frame; returns frames with reduced colours."""
    # Build the palette from opaque pixels only, so the empty background
    # doesn't take palette slots or pull colours toward black.
    colours = [p[:3] for f in frames for p in f.getdata() if p[3]]
    strip = Image.new("RGB", (len(colours), 1))
    strip.putdata(colours)
    pal = strip.quantize(colors=PALETTE, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    out = []
    for f in frames:
        q = f.convert("RGB").quantize(palette=pal, dither=Image.Dither.NONE).convert("RGBA")
        q.putalpha(f.getchannel("A"))
        out.append(q)
    return out


def shrink(rgba, k):
    """Area-average downscale by k with binary alpha."""
    w, h = max(1, round(rgba.width * k)), max(1, round(rgba.height * k))
    small = rgba.convert("RGBa").resize((w, h), Image.Resampling.BOX).convert("RGBA")
    a = small.getchannel("A").point(lambda v: 255 if v >= 110 else 0)
    small.putalpha(a)
    return small


def build(sheet, key, grid, col_range, name, body=BODY, register=True, grips=None):
    """body: idle body height in output px (BODY in game; larger for the
    hero-select stage's finer copies). register=False leaves index.json alone. grips:
    {"c,r": [x, y, deg]} in sheet-cell px (erase_baked_weapon.py), used
    instead of fist detection."""
    cols, rows = grid
    im = Image.open(sheet).convert("RGB")
    boxes, cw, ch = find_frames(im, cols, rows, col_range)
    n_cols = col_range[1] - col_range[0] + 1
    missing = [(c, r) for r in range(rows) for c in range(n_cols) if (c, r) not in boxes]
    if missing:
        raise SystemExit(f"{sheet}: frames not found at {missing}")
    # Scale: idle frames' median height becomes BODY px.
    idle_h = sorted(boxes[(c, 0)][3] - boxes[(c, 0)][1] for c in range(n_cols))[n_cols // 2]
    k = body / idle_h
    # Frame boxes relative to their grid cell; each row's ground = lowest feet.
    rel = {}
    for (c, r), b in boxes.items():
        ox, oy = (c + col_range[0]) * cw, r * ch
        rel[(c, r)] = (b[0] - ox, b[1] - oy, b[2] - ox, b[3] - oy)
    ground = {r: max(rel[(c, r)][3] for c in range(n_cols)) for r in range(rows)}
    anchor_y = ground[0]
    placed = {}
    for (c, r), b in rel.items():
        dy = anchor_y - (b[3] if ROWS[r] in GROUND_ROWS else ground[r])
        placed[(c, r)] = (b[0], b[1] + dy, b[2], b[3] + dy)
    ux0 = min(b[0] for b in placed.values()) - 4
    uy0 = min(b[1] for b in placed.values()) - 4
    ux1 = max(b[2] for b in placed.values()) + 4
    uy1 = anchor_y + 4
    cell = (math.ceil((ux1 - ux0) * k) + 2, math.ceil((uy1 - uy0) * k) + 2)
    idle_cx = sorted((rel[(c, 0)][0] + rel[(c, 0)][2]) / 2 for c in range(n_cols))[n_cols // 2]
    anchor = [round((idle_cx - ux0) * k) + 1, round((anchor_y - uy0) * k) + 1]

    bodies, hands, sockets = {}, {}, {}
    small_all = []
    for r in range(rows):
        for c in range(n_cols):
            b = boxes[(c, r)]
            crop = keyed(im.crop(b))
            g = (grips or {}).get(f"{c + col_range[0]},{r}")
            if g:
                fist = (round((c + col_range[0]) * cw) + g[0] - b[0], round(r * ch) + g[1] - b[1])
            else:
                fist = None if grips else front_fist(crop, ROWS[r] in LOW_FIST_ROWS)
            small = shrink(crop, k)
            px0 = round((placed[(c, r)][0] - ux0) * k) + 1
            py0 = round((placed[(c, r)][1] - uy0) * k) + 1
            bodies[(c, r)] = (small, (px0, py0))
            if fist is None:
                sockets[(c, r)] = None
            else:
                sockets[(c, r)] = (px0 + fist[0] * k, py0 + fist[1] * k)
            small_all.append(small)
    reduced = iter(quantize_all(small_all))
    for r in range(rows):
        for c in range(n_cols):
            bodies[(c, r)] = (next(reduced), bodies[(c, r)][1])
    # Frames where no fist was found borrow the neighbour's socket.
    for r in range(rows):
        known = [c for c in range(n_cols) if sockets[(c, r)]]
        for c in range(n_cols):
            if sockets[(c, r)] is None:
                src = min(known, key=lambda q: abs(q - c)) if known else None
                sockets[(c, r)] = sockets[(src, r)] if src is not None else (anchor[0] + body * 0.25, anchor[1] - body * 0.42)

    folder = SPRITES / key
    for r, action in enumerate(ROWS):
        durations, loop, hit = TIMING[action]
        socks = []
        for layer in ("body", "hand"):
            atlas = Image.new("RGBA", (cell[0] * n_cols, cell[1]))
            for c in range(n_cols):
                small, (x, y) = bodies[(c, r)]
                frame = Image.new("RGBA", cell)
                frame.alpha_composite(small, (x, y))
                if layer == "hand":
                    sx, sy = sockets[(c, r)]
                    rad = max(2.5, body * 0.075)
                    m = Image.new("L", cell, 0)
                    mp = m.load()
                    for yy in range(cell[1]):
                        for xx in range(cell[0]):
                            if (xx + 0.5 - sx) ** 2 + (yy + 0.5 - sy) ** 2 <= rad * rad:
                                mp[xx, yy] = 255
                    a = Image.composite(frame.getchannel("A"), Image.new("L", cell, 0), m)
                    frame.putalpha(a)
                atlas.paste(frame, (c * cell[0], 0))
            out = folder / layer / action
            out.mkdir(parents=True, exist_ok=True)
            atlas.save(out / f"{action}-atlas-00.webp", "WEBP", lossless=True)
            manifest = {
                "schemaVersion": "3.0",
                "name": action,
                "artSource": f"pixel sheet {Path(sheet).name}",
                "sourceSize": list(cell),
                "encodedAnchor": anchor,
                "bodyHeightPx": body,
                # Output px per game art px: the game keeps held weapons at
                # their world size on finer copies.
                **({"pixelDetail": body / BODY} if body != BODY else {}),
                "frameCount": n_cols,
                "durationsMs": durations,
                "durationSeconds": sum(durations) / 1000,
                "loop": loop,
                "sampling": "nearest",
                "events": [{"name": "hit", "atMs": sum(durations[:hit])}] if hit is not None else [],
                "fallback": {
                    "type": "png-atlas",
                    "cellSize": list(cell),
                    "pages": [{"file": f"{action}-atlas-00.webp", "firstFrame": 0, "frameCount": n_cols, "columns": n_cols}],
                },
            }
            if layer == "body":
                socks = [[round(sockets[(c, r)][0], 2), round(sockets[(c, r)][1], 2),
                          (grips or {}).get(f"{c + col_range[0]},{r}", [0, 0, ANGLES[action][c]])[2]] for c in range(n_cols)]
                manifest["sockets"] = {"hand": socks}
            (out / "animation.json").write_text(json.dumps(manifest, indent=2) + "\n")
    # Portrait: the first idle frame, cropped, 4x nearest.
    small, (x, y) = bodies[(0, 0)]
    bbox = small.getbbox()
    portrait = small.crop(bbox)
    portrait = portrait.resize((portrait.width * 4, portrait.height * 4), Image.NEAREST)
    portrait.save(folder / "portrait.webp", "WEBP", lossless=True)

    if not register:
        print(f"{key}: cell {cell}, scale {k:.3f}")
        return
    index_path = SPRITES / "index.json"
    index = json.loads(index_path.read_text())
    index["sets"][key] = {
        "dir": key,
        "height": 96,  # 48px body at 2x (x0.86 GROUP_SCALE in game)
        "facing": 1,
        "portrait": "portrait.webp",
        "source": f"pixel art sheet ({Path(sheet).name}), weapon drawn in the front fist",
        **({"name": name} if name else {}),
        "actions": {"idle": "idle", "walk": "walk", "run": "run", "jump": "jump", "attack": "attack",
                    "skill": "skill", "hit": "hurt", "death": "death"},
        "layers": {"looks": {}, "hand": "hand", "pixel": True, "heldArt": "pixel"},
    }
    index["version"] = time_ns()
    index_path.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n")
    print(f"{key}: cell {cell}, scale {k:.3f}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sheet")
    ap.add_argument("key")
    ap.add_argument("--grid", default="4x8")
    ap.add_argument("--cols", default=None, help="columns of this look, e.g. 4-7")
    ap.add_argument("--name", default=None)
    ap.add_argument("--body", type=int, default=BODY, help="idle body height in output px")
    ap.add_argument("--no-register", action="store_true", help="leave index.json alone")
    ap.add_argument("--grips", default=None, help="JSON from erase_baked_weapon.py --grips")
    a = ap.parse_args()
    cols, rows = map(int, a.grid.split("x"))
    lo, hi = map(int, a.cols.split("-")) if a.cols else (0, cols - 1)
    build(a.sheet, a.key, (cols, rows), (lo, hi), a.name, a.body, not a.no_register,
          json.loads(Path(a.grips).read_text()) if a.grips else None)


if __name__ == "__main__":
    main()
