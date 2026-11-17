"""Key the painted town kit (building pieces and prop sheets) off magenta.

Sources in tools/town-kit/source/:
  stall, shop, smithy, stairs, tower, tree, cavegate   one building piece each
  props-ground, props-hanging, props-foliage            sheets of separate props
  props-animated                                        4 x 3 grid, one 4-frame loop per row

Writes public/assets/town-kit/:
  piece-<name>.webp     keyed, trimmed to the art, scaled by PIECES[name]
  prop-<sheet>-<n>.webp  every separate prop, numbered left-to-right, top-to-bottom
  anim-<row>.webp        4-frame strip per animated row (equal cells, shared baseline)
and prints sizes so ledges can be measured (see shared/town-layout.js).

    python3 tools/town-kit/kit_art.py

Only Pillow is required.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from far_layers import key_magenta  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SRC = Path(__file__).parent / "source"
OUT = ROOT / "public" / "assets" / "town-kit"
# Scale from the painting to world px (old-town proportions: doors ~ 90 px).
PIECES = {"stall": 0.36, "shop": 0.42, "smithy": 0.46, "stairs": 0.42,
          "tower": 0.42, "tree": 0.5, "cavegate": 0.42}
PROP_SCALE = {"props-ground": 0.34, "props-hanging": 0.3, "props-foliage": 0.42}
# Pieces with no real pink near their edges: also turn pink rim light green.
RIM_FIX = {"tree"}
ANIM_ROWS = ["banner", "lantern", "brazier"]
ANIM_SCALE = 0.32


def keyed(name):
    return key_magenta(Image.open(next(SRC.glob(f"{name}.*"))), despill=False, rim_fix=name in RIM_FIX)


def save(im, name, scale):
    if scale != 1:
        im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    im.save(OUT / f"{name}.webp", "WEBP", quality=90, method=6)
    return im.size


def blobs(alpha, min_area=600):
    """Bounding boxes of separate props: columns/rows of empty alpha split them."""
    a = alpha.point(lambda v: 255 if v > 40 else 0)
    w, h = a.size
    # Split into rows by empty horizontal bands, then each row into columns.
    def bands(img, axis):
        sums = []
        px = img.load()
        n, m = (img.height, img.width) if axis == 0 else (img.width, img.height)
        for i in range(n):
            sums.append(sum(1 for j in range(0, m, 2) if (px[j, i] if axis == 0 else px[i, j])))
        out, start = [], None
        for i, s in enumerate(sums + [0]):
            if s and start is None:
                start = i
            elif not s and start is not None:
                if i - start > 6:
                    out.append((start, i))
                start = None
        return out
    boxes = []
    for y0, y1 in bands(a, 0):
        row = a.crop((0, y0, w, y1))
        for x0, x1 in bands(row, 1):
            bb = a.crop((x0, y0, x1, y1)).getbbox()
            if bb and (bb[2] - bb[0]) * (bb[3] - bb[1]) >= min_area:
                boxes.append((x0 + bb[0], y0 + bb[1], x0 + bb[2], y0 + bb[3]))
    return boxes


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    report = {}
    for name, k in PIECES.items():
        im = keyed(name)
        im = im.crop(im.getchannel("A").getbbox())
        report[f"piece-{name}"] = {"src": im.size, "out": save(im, f"piece-{name}", k), "scale": k}
    for sheet, k in PROP_SCALE.items():
        im = keyed(sheet)
        for n, box in enumerate(blobs(im.getchannel("A"))):
            report[f"prop-{sheet[6:]}-{n}"] = {"out": save(im.crop(box), f"prop-{sheet[6:]}-{n}", k)}
    im = keyed("props-animated")
    cw, ch = im.width // 4, im.height // 3
    for r, row in enumerate(ANIM_ROWS):
        cells = [im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)) for c in range(4)]
        boxes = [c.getchannel("A").getbbox() for c in cells]
        x0, y0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
        x1, y1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
        fw, fh = round((x1 - x0) * ANIM_SCALE), round((y1 - y0) * ANIM_SCALE)
        strip = Image.new("RGBA", (fw * 4, fh))  # whole-pixel frames for the game's frame grid
        for i, c in enumerate(cells):
            strip.alpha_composite(c.crop((x0, y0, x1, y1)).resize((fw, fh), Image.LANCZOS), (fw * i, 0))
        report[f"anim-{row}"] = {"out": save(strip, f"anim-{row}", 1), "frame": [fw, fh], "frames": 4}
    (OUT / "kit.json").write_text(json.dumps(report, indent=1) + "\n")
    for k, v in report.items():
        print(k, v)


if __name__ == "__main__":
    main()
