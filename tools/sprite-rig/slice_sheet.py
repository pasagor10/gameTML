"""Slice a painted sprite sheet on a flat background into game sprite sets.

The sheet is a grid; each row is one action of one hero. The flat background
is keyed out with a flood fill from every cell edge, and the anti-aliased rim
gets a soft matte (alpha from colour distance, background colour removed) so
outlines and glows don't keep a navy fringe. Frames are registered so each
one's feet sit on the same root, then written as animation.json 3.0 + atlas
for public/sprite-sets.js.

    python3 tools/sprite-rig/slice_sheet.py SHEET --cols 6 \\
        --rows archer-male:idle archer-male:attack archer-female:idle ...

Only Pillow is required.
"""

from __future__ import annotations

import argparse
import json
import time
import math
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2] / "public" / "assets" / "sprites"
KEY_T = 10  # colour distance treated as pure background (navy hair sits near 6-16)
SOFT_T = 70  # distance where a rim pixel becomes fully opaque
POCKET_MIN = 6  # enclosed background blobs at least this many px are keyed
POCKET_HEAD = 0.3  # blobs centred above this fraction of the cell are hair, not gaps
POCKET_BIG = 400  # ...unless they are this large (e.g. inside a slash arc)
# x/y say how each frame is put on the root:
#   "feet"   per-frame feet (x: centre of the lowest rows, y: lowest opaque row)
#   "cell"   x as drawn in the cell (keeps stride and the backward fall)
#   "median" y from the row's median feet line (keeps run flight frames)
TIMING = {
    # One frame is fine: creature-fx adds breathing on top.
    "idle": dict(ms=160, loop=True, hit=None, x="cell", y="feet"),
    "attack": dict(ms=[70, 70, 70, 80, 90, 110], loop=False, hit=4, x="feet", y="feet"),
    "walk": dict(ms=110, loop=True, hit=None, x="cell", y="feet"),
    "run": dict(ms=80, loop=True, hit=None, x="cell", y="median"),
    # The game's hit state lasts 0.22 s, so the recoil sits up front.
    "hurt": dict(ms=[40, 40, 45, 45, 50, 60], loop=False, hit=None, x="cell", y="feet"),
    "death": dict(ms=[90, 110, 130, 160, 200, 300], loop=False, hit=None, x="cell", y="feet"),
}
BODY_PX = 180  # stored body height for every hero clip (one pixel density, ~1.6x screen)
HERO_HEIGHT = 112  # on-screen body height in world px (NPCs are ~98, old heroes ~110)
STATE_FOR = {"idle": "idle", "attack": "attack", "walk": "walk", "run": "run", "hurt": "hit", "death": "death"}


def dist(a, b):
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)


def light_dist(c, _bg=None):
    """Distance from a baked white/checkerboard backdrop (247-255, grey)."""
    return max(0, 250 - min(c)) + 2 * (max(c) - min(c))


def key_cell(cell: Image.Image, bg, dist_fn=dist, key_t=None, soft_t=None,
             pocket_min=None, head_band=True, glow_min=None, glow_gain=2.2) -> Image.Image:
    """Return the cell as RGBA with the background removed."""
    KEY_T = key_t if key_t is not None else globals()["KEY_T"]
    SOFT_T = soft_t if soft_t is not None else globals()["SOFT_T"]
    POCKET_MIN = pocket_min if pocket_min is not None else globals()["POCKET_MIN"]
    rgb = cell.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    d = [[dist_fn(px[x, y], bg) for x in range(w)] for y in range(h)]
    is_bg = [[False] * w for _ in range(h)]
    q = deque()
    for x in range(w):
        q.extend(((x, 0), (x, h - 1)))
    for y in range(h):
        q.extend(((0, y), (w - 1, y)))
    while q:
        x, y = q.popleft()
        if is_bg[y][x] or d[y][x] > KEY_T:
            continue
        is_bg[y][x] = True
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not is_bg[ny][nx]:
                q.append((nx, ny))
    # Enclosed pockets (between bow and string, staff and body, inside a
    # slash arc) never touch the edge; key any background-coloured blob too.
    seen = [[False] * w for _ in range(h)]
    for sy in range(h):
        for sx in range(w):
            if is_bg[sy][sx] or seen[sy][sx] or d[sy][sx] > KEY_T:
                continue
            blob, q = [], deque([(sx, sy)])
            seen[sy][sx] = True
            while q:
                x, y = q.popleft()
                blob.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and not is_bg[ny][nx] and d[ny][nx] <= KEY_T:
                        seen[ny][nx] = True
                        q.append((nx, ny))
            # Dark navy hair can match the key colour as closely as a pocket
            # does, so small blobs in the head band (top of the cell) are kept.
            cy = sum(y for _, y in blob) / len(blob)
            head = head_band and cy < POCKET_HEAD * h and len(blob) < POCKET_BIG
            if len(blob) >= POCKET_MIN and not head:
                for x, y in blob:
                    is_bg[y][x] = True
    # On a white backdrop, pale glows/smoke/sparkles touching the backdrop are
    # really translucent light. Grow from the backdrop through pale pixels
    # (min channel >= glow_min) and give them alpha by how far from white they
    # are. Pale areas fenced in by an outline (white fur, cream skin) are safe.
    glow = [[False] * w for _ in range(h)]
    if glow_min is not None:
        q = deque((x, y) for y in range(h) for x in range(w) if is_bg[y][x])
        while q:
            x, y = q.popleft()
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and not is_bg[ny][nx] and not glow[ny][nx] \
                        and min(px[nx, ny]) >= glow_min:
                    glow[ny][nx] = True
                    q.append((nx, ny))
    out = Image.new("RGBA", (w, h))
    o = out.load()
    for y in range(h):
        for x in range(w):
            if is_bg[y][x]:
                continue
            c = px[x, y]
            if glow[y][x]:
                a = max(0.0, min(1.0, (255 - min(c)) / 255 * glow_gain))
                if a > 0.02:
                    r, g, b = (max(0, min(255, round(bg[i] + (c[i] - bg[i]) / a))) for i in range(3))
                    o[x, y] = (r, g, b, round(a * 255))
                continue
            near = any(
                0 <= x + dx < w and 0 <= y + dy < h and is_bg[y + dy][x + dx]
                for dx in (-2, -1, 0, 1, 2) for dy in (-2, -1, 0, 1, 2)
            )
            a = 1.0
            if near and d[y][x] < SOFT_T:
                a = max(0.0, min(1.0, (d[y][x] - KEY_T) / (SOFT_T - KEY_T)))
            if a <= 0.02:
                continue
            # Un-mix the background from semi-transparent rim pixels.
            r, g, b = (max(0, min(255, round(bg[i] + (c[i] - bg[i]) / a))) for i in range(3))
            o[x, y] = (r, g, b, round(a * 255))
    return out


def keep_own_blobs(im: Image.Image, x0: int, x1: int) -> Image.Image:
    """Keep blobs whose centre lies in [x0, x1): this cell's art, including
    parts that spill past the grid line, without the neighbours' frames."""
    w, h = im.size
    a = im.getchannel("A").load()
    seen = [[False] * w for _ in range(h)]
    px = im.load()
    for sy in range(h):
        for sx in range(w):
            if seen[sy][sx] or a[sx, sy] == 0:
                continue
            pts, q = [], deque([(sx, sy)])
            seen[sy][sx] = True
            while q:
                x, y = q.popleft()
                pts.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and a[nx, ny] > 0:
                        seen[ny][nx] = True
                        q.append((nx, ny))
            cx = sum(x for x, _ in pts) / len(pts)
            if not x0 <= cx < x1:
                for x, y in pts:
                    px[x, y] = (0, 0, 0, 0)
    return im


def drop_edge_specks(im: Image.Image, share=0.12) -> Image.Image:
    """Remove small blobs touching the cell edge (bits of the neighbour cell)."""
    w, h = im.size
    a = im.getchannel("A").load()
    seen = [[False] * w for _ in range(h)]
    blobs, total = [], 0
    for sy in range(h):
        for sx in range(w):
            if seen[sy][sx] or a[sx, sy] <= 40:
                continue
            pts, q, edge = [], deque([(sx, sy)]), False
            seen[sy][sx] = True
            while q:
                x, y = q.popleft()
                pts.append((x, y))
                edge |= x in (0, w - 1) or y in (0, h - 1)
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and a[nx, ny] > 40:
                        seen[ny][nx] = True
                        q.append((nx, ny))
            total += len(pts)
            blobs.append((pts, edge))
    px = im.load()
    for pts, edge in blobs:
        if edge and len(pts) < share * total:
            for x, y in pts:
                px[x, y] = (0, 0, 0, 0)
    return im


def feet(im: Image.Image):
    """Bottom of the opaque body and the x centre of its lowest rows."""
    a = im.getchannel("A")
    w, h = im.size
    bottom = max((y for y in range(h) for x in range(0, w, 2) if a.getpixel((x, y)) > 160), default=h - 1)
    xs = [x for y in range(max(0, bottom - 10), bottom + 1) for x in range(w) if a.getpixel((x, y)) > 160]
    return (sum(xs) / len(xs) if xs else w / 2), bottom


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sheet")
    ap.add_argument("--cols", type=int, required=True)
    ap.add_argument("--rows", nargs="+", required=True, help="set:action per sheet row, top to bottom")
    ap.add_argument("--suffix", default="-painted", help="folder suffix for each set")
    ap.add_argument("--derive", nargs="*", default=[],
                    help="extra clip from frames of a sliced row: set:action=row_action:i,j "
                         "(e.g. archer-male:idle=hurt:0 uses the neutral first hurt frame)")
    ap.add_argument("--replace", action="store_true",
                    help="rebuild the set's action map from this sheet only and delete other action folders")
    args = ap.parse_args()

    sheet = Image.open(args.sheet).convert("RGB")
    W, H = sheet.size
    nrows = len(args.rows)
    corners = [sheet.getpixel(p) for p in ((0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1))]
    bg = tuple(sorted(c[i] for c in corners)[1] for i in range(3))
    print("background", bg)

    # Key every frame and record its feet root.
    rows = {}
    for r, spec in enumerate(args.rows):
        name, action = spec.split(":")
        y0, y1 = round(r * H / nrows), round((r + 1) * H / nrows)
        frames = []
        for c in range(args.cols):
            x0, x1 = round(c * W / args.cols), round((c + 1) * W / args.cols)
            # Crop with a margin so art spilling past the grid line survives,
            # then drop whatever belongs to the neighbouring cells.
            m = round((x1 - x0) * 0.25)
            lo, hi = max(0, x0 - m), min(W, x1 + m)
            im = key_cell(sheet.crop((lo, y0, hi, y1)), bg)
            im = keep_own_blobs(im, x0 - lo, x1 - lo)
            # Re-centre on the grid cell so "cell" alignment stays the drawn spot.
            pad_l, pad_r = m - (x0 - lo), m - (hi - x1)
            if pad_l or pad_r:
                padded = Image.new("RGBA", (im.width + pad_l + pad_r, im.height))
                padded.paste(im, (pad_l, 0))
                im = padded
            im = drop_edge_specks(im)
            frames.append((im, feet(im)))
        rows.setdefault(name, {})[action] = frames
    for spec in args.derive:
        target, src = spec.split("=")
        name, action = target.split(":")
        src_action, idx = src.split(":")
        rows[name][action] = [rows[name][src_action][int(i)] for i in idx.split(",")]

    index_path = ROOT / "index.json"
    index = json.loads(index_path.read_text()) if index_path.exists() else {"sets": {}}
    for name, actions in rows.items():
        # Re-root frames per action rule, then one canvas per sheet.
        for action, frames in actions.items():
            t = TIMING.get(action, TIMING["idle"])
            ys = sorted(fy for _, (_, fy) in frames)
            med = ys[len(ys) // 2]
            actions[action] = [
                (im, (im.width / 2 if t["x"] == "cell" else fx, med if t["y"] == "median" else fy))
                for im, (fx, fy) in frames
            ]
        all_frames = [f for fs in actions.values() for f in fs]
        left = max(fx for _, (fx, _) in all_frames)
        right = max(im.width - fx for im, (fx, _) in all_frames)
        up = max(fy for _, (_, fy) in all_frames)
        cw, ch = math.ceil(left + right) + 4, math.ceil(up) + 6
        ax, ay = math.ceil(left) + 2, math.ceil(up) + 2
        # Scale from standing frames only (a lying body would blow the scale up).
        standing = [f for a in ("idle", "walk", "attack") for f in actions.get(a, [])] or all_frames
        body = max(fy - (im.getchannel("A").getbbox() or (0, 0, 0, 0))[1] for im, (_, fy) in standing)
        folder_root = ROOT / f"{name}{args.suffix}"
        for action, frames in actions.items():
            t = TIMING.get(action, TIMING["idle"])
            n = len(frames)
            durations = t["ms"] if isinstance(t["ms"], list) else [t["ms"]] * n
            atlas = Image.new("RGBA", (cw * n, ch))
            for i, (im, (fx, fy)) in enumerate(frames):
                atlas.alpha_composite(im, (i * cw + round(ax - fx), round(ay - fy)))
            # Every hero clip is stored at the same pixel density (BODY_PX
            # source px per body), so switching idle -> walk never changes
            # sharpness even when the source sheets differ in resolution.
            k = BODY_PX / body
            ncw, nh = max(1, round(cw * k)), max(1, round(ch * k))
            atlas = atlas.resize((ncw * n, nh), Image.LANCZOS)
            folder = folder_root / action
            folder.mkdir(parents=True, exist_ok=True)
            page = f"{action}-atlas-00.webp"
            for old in folder.glob(f"{action}-atlas-*"):
                old.unlink()
            atlas.save(folder / page, "WEBP", quality=92, method=6)
            events = [] if t["hit"] is None else [{"name": "hit", "atMs": sum(durations[: t["hit"]]), "frame": t["hit"]}]
            manifest = {
                "schemaVersion": "3.0", "name": action, "artSource": "painted sheet (supplied artwork)",
                "sourceSize": [ncw, nh], "sourceAnchor": [round(ax * ncw / cw, 2), round(ay * nh / ch, 2)],
                "frameCount": n, "durationsMs": durations, "durationSeconds": sum(durations) / 1000,
                "fps": round(1000 * n / sum(durations), 3), "loop": t["loop"],
                "bodyHeightPx": float(BODY_PX), "events": events, "sampling": "linear",
                "fallback": {"type": "png-atlas", "cellSize": [ncw, nh],
                             "pages": [{"file": page, "firstFrame": 0, "frameCount": n, "columns": n}]},
            }
            (folder / "animation.json").write_text(json.dumps(manifest, indent=2) + "\n")
        # Merge with actions other sheets already provided for this set.
        mapping = {} if args.replace else dict(index["sets"].get(name, {}).get("actions", {}))
        if args.replace:
            for old in folder_root.iterdir():
                if old.is_dir() and old.name not in actions:
                    for f in old.iterdir():
                        f.unlink()
                    old.rmdir()
        for action in actions:
            mapping[STATE_FOR.get(action, action)] = action
        if "attack" in actions:
            mapping["skill"] = "attack"
        index["sets"][name] = {
            "dir": folder_root.name, "height": HERO_HEIGHT, "facing": 1,
            "source": "supplied painted sheets; states without frames use procedural motion on idle",
            "actions": mapping,
        }
        print("wrote", name, (cw, ch))
    index["version"] = time.strftime("%Y%m%d%H%M%S")  # busts browser caches
    index_path.write_text(json.dumps(index, indent=2) + "\n")


if __name__ == "__main__":
    main()
