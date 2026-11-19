"""Build the town kit from the AI-drawn cottage-village pixel art.

Sources are in tools/town-kit/source/cottage/ (the UI kit stays in
source/pixel/). Every image is snapped to its art pixel grid
(tools/sprite-rig/pixel_snap.py), colour reduced, then blown up by a whole
number with nearest sampling so the pieces draw 1:1 in the world and every art
pixel stays a square block:

  piece-<name>.webp   building pieces (PIECES: name -> blow-up)
  piece-house<n>.webp the six small houses of houses.webp
  prop-px-<n>.webp    the 6 x 4 prop sheet, numbered row by row
  far-<layer>.webp    parallax strips that wrap sideways (sky, mountains,
                      hills, treeline, village)
  street.webp         the walkable street tile (grass edge and cobbles)

and writes their sizes to kit.json (shared/town-layout.js uses them).

    python3 tools/town-kit/pixel_kit.py [names...]

Only Pillow is required.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/sprite-rig"))
from pixel_snap import grid, quantize, snap, upscale  # noqa: E402

SRC = Path(__file__).parent / "source" / "cottage"
UI_SRC = Path(__file__).parent / "source" / "pixel"
OUT = ROOT / "public" / "assets" / "town-kit"
# Blow-up per piece. The sources draw an art pixel at 5.5-6 (detailed
# buildings) or 8-10 image pixels (chunkier ones); 2 and 3 keep them all at
# about a third of the source size, so a door is about one hero tall.
PIECES = {"cottage": 2, "smithy": 2, "potion": 2, "weapon": 2, "tree": 2,
          "stall": 3, "stairs": 3, "cavegate": 3, "bridge": 3}
HOUSES_N = 3
PROP_N = 3
# Far layers: (blow-up, colours).
# The far strips are drawn bigger than the buildings (they are only scenery)
# so they repeat less often.
FAR = {"mountains": (4, 12), "hills": (4, 40), "treeline": (3, 12), "village": (3, 40)}
SKY_N = 4
STREET_N = 3
# Pixel sizes the search gets wrong (it halves or doubles a strong pattern).
HINT = {"houses": 7.92, "hills": 7.4, "village": 6.47, "sky": 8.0, "props": 7.8,
        "street": 9.8, "ui-kit": 10.35}
# UI kit pieces (true-pixel boxes in the snapped sheet) -> public/assets/ui/px-<name>.webp
UI = {"panel": (3, 5, 89, 43), "chat": (93, 5, 115, 25), "bag": (118, 5, 140, 25), "hero": (143, 5, 165, 25),
      "lock": (93, 28, 115, 48), "party": (118, 28, 140, 48), "settings": (143, 28, 165, 48),
      "attack": (88, 53, 114, 80), "quest": (118, 55, 135, 77), "next": (139, 60, 166, 74)}


def true_pixels(name, colours=40, src=SRC, opaque=False):
    im = Image.open(src / f"{name}.webp").convert("RGB")
    p, ox, oy = grid(im, hint=HINT.get(name))
    small = snap(im.convert("RGBA") if opaque else im, p, ox, oy)
    print(f"{name}: art pixel {p:.2f} -> {small.size[0]}x{small.size[1]}")
    return quantize([small], colours)[0]


def clean_rim(im: Image.Image) -> Image.Image:
    """Drop opaque pixels that are still magenta-ish (blended rim)."""
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a and r > 140 and b > 120 and g < 0.6 * min(r, b):
                px[x, y] = (0, 0, 0, 0)
    return im


def save(im, name, n, sizes):
    big = upscale(im, n)
    big.save(OUT / f"{name}.webp", "WEBP", lossless=True)
    sizes[name] = {"out": list(big.size), "px": n}
    print(f"  {name}.webp {big.size[0]}x{big.size[1]}")


def wrap(im: Image.Image) -> Image.Image:
    """Make the strip repeat sideways without a seam: it and its mirror image."""
    out = Image.new("RGBA", (im.width * 2, im.height))
    out.alpha_composite(im, (0, 0))
    out.alpha_composite(im.transpose(Image.Transpose.FLIP_LEFT_RIGHT), (im.width, 0))
    return out


def pieces(names, sizes):
    for name, n in PIECES.items():
        if names and name not in names:
            continue
        im = clean_rim(true_pixels(name))
        im = im.crop(im.getbbox())
        save(im, f"piece-{name}", n, sizes)
    if names and "houses" not in names:
        return
    sheet = clean_rim(true_pixels("houses"))
    W, H = sheet.size
    for r in range(2):
        for c in range(3):
            cell = sheet.crop((round(c * W / 3), round(r * H / 2), round((c + 1) * W / 3), round((r + 1) * H / 2)))
            save(cell.crop(cell.getbbox()), f"piece-house{r * 3 + c}", HOUSES_N, sizes)


def main_band(cell: Image.Image) -> Image.Image:
    """Keep the tallest run of non-empty rows (drops bits of the row above)."""
    a = cell.getchannel("A").load()
    filled = [any(a[x, y] for x in range(cell.width)) for y in range(cell.height)]
    best, start = (0, 0), None
    for y, f in enumerate(filled + [False]):
        if f and start is None:
            start = y
        elif not f and start is not None:
            if y - start > best[1] - best[0]:
                best = (start, y)
            start = None
    return cell.crop((0, best[0], cell.width, best[1]))


def props(sizes):
    sheet = clean_rim(true_pixels("props"))
    W, H = sheet.size
    cols, rows = 6, 4
    for r in range(rows):
        for c in range(cols):
            cell = sheet.crop((round(c * W / cols), round(r * H / rows), round((c + 1) * W / cols), round((r + 1) * H / rows)))
            cell = main_band(cell)
            bb = cell.getbbox()
            if bb:
                save(cell.crop(bb), f"prop-px-{r * cols + c}", PROP_N, sizes)


def key_blue(im: Image.Image) -> Image.Image:
    """The village strip fills the gaps between houses with flat blue."""
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a and b > 170 and r < 110 and b > g + 50:
                px[x, y] = (0, 0, 0, 0)
    return im


def far(names, sizes):
    for layer, (n, colours) in FAR.items():
        if names and layer not in names:
            continue
        im = clean_rim(true_pixels(layer, colours))
        if layer == "village":
            im = key_blue(im)
            # Drop the ragged bottom rows (the street covers them).
            im = im.crop((0, 0, im.width, im.height - 3))
        bb = im.getbbox()
        im = im.crop((0, bb[1], im.width, bb[3]))
        if layer != "village":
            # Carry the bottom row on down so no gap opens under the strip.
            deep = Image.new("RGBA", (im.width, im.height + 40))
            deep.alpha_composite(im, (0, 0))
            row = im.crop((0, im.height - 1, im.width, im.height))
            for y in range(im.height, deep.height):
                deep.alpha_composite(row, (0, y))
            im = deep
        save(wrap(im), f"far-{layer}", n, sizes)
    if not names or "sky" in names:
        sky = true_pixels("sky", 16, opaque=True)
        # Grow the sky upwards in its top colour so it covers any camera
        # height; the horizon end is hidden by the mountains.
        top = Image.new("RGBA", (sky.width, 250), sky.getpixel((sky.width // 2, 0)))
        tall = Image.new("RGBA", (sky.width, sky.height + top.height + 60))
        tall.alpha_composite(top, (0, 0))
        tall.alpha_composite(sky, (0, top.height))
        # ...and down in its bottom row, behind the mountains.
        row = sky.crop((0, sky.height - 1, sky.width, sky.height))
        for y in range(top.height + sky.height, tall.height):
            tall.alpha_composite(row, (0, y))
        save(wrap(tall), "far-sky", SKY_N, sizes)


def street(sizes):
    im = clean_rim(true_pixels("street", 24))
    bb = im.getbbox()
    band = im.crop((0, bb[1], im.width, bb[3]))
    px = band.load()

    def green(y):
        return sum(1 for x in range(band.width) if px[x, y][3] and px[x, y][1] > px[x, y][2] + 40 and px[x, y][1] > 0.85 * px[x, y][0]) > 0.3 * band.width

    # The grass edge ends where rows stop being mostly green.
    grass = max(y for y in range(min(band.height, 20)) if green(y)) + 1
    body = band.crop((0, grass, band.width, band.height))
    tile = Image.new("RGBA", (band.width, 200))
    tile.alpha_composite(band, (0, 0))
    y = band.height
    while y < tile.height:
        tile.alpha_composite(body, (0, y))
        y += body.height
    sizes["street-grass"] = {"rows": grass, "px": STREET_N}
    save(wrap(tile), "street", STREET_N, sizes)


def ui():
    sheet = clean_rim(true_pixels("ui-kit", src=UI_SRC))
    out = ROOT / "public" / "assets" / "ui"
    out.mkdir(exist_ok=True)
    for name, box in UI.items():
        sheet.crop(box).save(out / f"px-{name}.webp", "WEBP", lossless=True)
        print(f"  ui/px-{name}.webp")


def main():
    names = set(sys.argv[1:])
    kit_path = OUT / "kit.json"
    kit = json.loads(kit_path.read_text())
    sizes = {}
    pieces(names, sizes)
    if not names or "props" in names:
        props(sizes)
    far(names, sizes)
    if not names or "street" in names:
        street(sizes)
    if "ui" in names:
        ui()
    for k, v in sizes.items():
        kit[k] = v
    kit_path.write_text(json.dumps(kit, indent=1) + "\n")


if __name__ == "__main__":
    main()
