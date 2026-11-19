"""Build the town kit from the AI-drawn pixel art in tools/town-kit/source/pixel/.

Every image is snapped to its art pixel grid (tools/sprite-rig/pixel_snap.py),
colour reduced, then blown up by a whole number with nearest sampling so the
pieces draw 1:1 in the world and every art pixel stays a square block:

  piece-<name>.webp   building pieces (PIECES: name -> blow-up)
  prop-px-<n>.webp    the 6 x 4 prop sheet, numbered row by row
  far-<layer>.webp    parallax strips that wrap sideways (sky, clouds,
                      mountains, hills, treeline)
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
from pixel_snap import grid, is_key, quantize, snap, upscale  # noqa: E402

SRC = Path(__file__).parent / "source" / "pixel"
OUT = ROOT / "public" / "assets" / "town-kit"
# Blow-up per piece: a shop door ends up about two heroes tall.
PIECES = {"tree": 4, "shop": 5, "stall": 5, "tower": 4, "stairs": 6, "cavegate": 5}
PROP_N = 3
# Far layers: (source, blow-up). The sky is cut from the top of its image.
FAR = {"mountains": ("mountains", 4), "hills": ("hills", 4), "treeline": ("treeline", 4)}
SKY_N = 4
STREET_N = 4
# Pixel sizes the search would halve (a strong 2-pixel pattern).
HINT = {"stairs": 12.85, "cavegate": 10.5, "sky": 10.7, "ui-kit": 10.35}
# UI kit pieces (true-pixel boxes in the snapped sheet) -> public/assets/ui/px-<name>.webp
UI = {"panel": (3, 5, 89, 43), "chat": (93, 5, 115, 25), "bag": (118, 5, 140, 25), "hero": (143, 5, 165, 25),
      "lock": (93, 28, 115, 48), "party": (118, 28, 140, 48), "settings": (143, 28, 165, 48),
      "attack": (88, 53, 114, 80), "quest": (118, 55, 135, 77), "next": (139, 60, 166, 74)}


def true_pixels(name, colours=40, keep_key=False):
    im = Image.open(SRC / f"{name}.webp").convert("RGB")
    p, ox, oy = grid(im, hint=HINT.get(name))
    small = snap(im if not keep_key else im.convert("RGBA"), p, ox, oy)
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


def wrap(im: Image.Image, blend=12) -> Image.Image:
    """Make the strip repeat sideways: the right end steps into the left one."""
    w, h = im.size
    out = im.crop((0, 0, w - blend, h))
    px, src = out.load(), im.load()
    # Columns near the right edge copy the matching columns past the left
    # edge on a dither ramp, so the seam lands on art pixels, not a blur.
    for i in range(blend):
        x = w - blend - blend + i
        for y in range(h):
            if (y * 7 + i * 3) % blend < i:
                px[x, y] = src[i, y]
    return out


def pieces(names, sizes):
    for name, n in PIECES.items():
        if names and name not in names:
            continue
        im = clean_rim(true_pixels(name))
        im = im.crop(im.getbbox())
        save(im, f"piece-{name}", n, sizes)


def props(sizes):
    sheet = clean_rim(true_pixels("props"))
    W, H = sheet.size
    cols, rows = 6, 4
    for r in range(rows):
        for c in range(cols):
            cell = sheet.crop((round(c * W / cols), round(r * H / rows), round((c + 1) * W / cols), round((r + 1) * H / rows)))
            bb = cell.getbbox()
            if bb:
                save(cell.crop(bb), f"prop-px-{r * cols + c}", PROP_N, sizes)


def far(names, sizes):
    for layer, (src, n) in FAR.items():
        if names and layer not in names:
            continue
        im = clean_rim(true_pixels(src, 48))
        bb = im.getbbox()
        im = im.crop((0, bb[1], im.width, im.height))
        save(wrap(im), f"far-{layer}", n, sizes)
    if not names or "sky" in names:
        sky = true_pixels("sky", 24)
        px = sky.load()
        # The sky image is a whole scene: keep the sky above the mountains,
        # and lift the clouds onto their own drifting strip.
        def is_sky(p):
            return p[2] > 170 and p[2] > p[0] + 60
        def is_cloud(p):
            return min(p[:3]) > 200
        top = 0
        for y in range(sky.height):
            row = [px[x, y] for x in range(sky.width)]
            if sum(1 for p in row if is_sky(p) or is_cloud(p)) < 0.97 * len(row):
                break
            top = y
        band = sky.crop((0, 0, sky.width, top))
        blue = sorted((px[x, y] for y in range(top) for x in range(sky.width) if is_sky(px[x, y])), key=lambda p: p[2])
        base = blue[len(blue) // 2]
        clouds = Image.new("RGBA", band.size)
        plain = Image.new("RGBA", band.size, base)
        cp, bp = clouds.load(), band.load()
        for y in range(band.height):
            for x in range(band.width):
                if not is_sky(bp[x, y]):
                    cp[x, y] = bp[x, y][:3] + (255,)
        # A tall sky in three blue steps (deeper at the top, paler at the
        # horizon) with dithered seams, so it covers any camera height.
        deep = tuple(round(v * 0.82) for v in base[:3]) + (255,)
        pale = tuple(min(255, round(v * 1.1 + 22)) for v in base[:3]) + (255,)
        tall = Image.new("RGBA", (band.width, 350), base)
        tp = tall.load()
        for y in range(tall.height):
            for x in range(tall.width):
                if y < 110 or (y < 122 and (x + y) % (2 if y < 116 else 4) == 0):
                    tp[x, y] = deep
                elif y > 262 or (y > 250 and (x + y) % (4 if y < 256 else 2) == 0):
                    tp[x, y] = pale
        save(wrap(tall), "far-sky", SKY_N, sizes)
        save(wrap(clouds), "far-clouds", SKY_N, sizes)


def street(sizes):
    im = clean_rim(true_pixels("street", 32))
    # Keep the bottom band (grass edge over a cobble wall, no buildings), then
    # repeat the cobble rows down so the tile reaches below the screen.
    px = im.load()

    def green(y):
        return sum(1 for x in range(im.width) if px[x, y][3] and px[x, y][1] > px[x, y][0] + 25) > 0.4 * im.width

    rows = [sum(1 for x in range(im.width) if px[x, y][3]) for y in range(im.height)]
    y1 = max(y for y, n in enumerate(rows) if n > 0.98 * im.width) + 1
    low = int(im.height * 0.6)
    y0 = next(y for y in range(low, y1) if green(y))
    stone = next(y for y in range(y1 - 1, y0, -1) if green(y)) + 1 - y0
    band = im.crop((0, y0, im.width, y1))
    wall = band.crop((0, stone, band.width, band.height))
    tile = Image.new("RGBA", (band.width, 64))
    tile.alpha_composite(band, (0, 0))
    y = band.height
    while y < tile.height:
        tile.alpha_composite(wall, (0, y))
        y += wall.height
    sizes["street-grass"] = {"rows": stone, "px": STREET_N}
    save(wrap(tile), "street", STREET_N, sizes)


def ui():
    sheet = clean_rim(true_pixels("ui-kit"))
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
    if not names or "ui" in names:
        ui()
    for k, v in sizes.items():
        kit[k] = v
    kit_path.write_text(json.dumps(kit, indent=1) + "\n")


if __name__ == "__main__":
    main()
