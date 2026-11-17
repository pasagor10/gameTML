"""Turn the painted far-background strips into seamless parallax tiles.

Sources in tools/town-kit/source/ are painted on flat magenta (#FF00FF), except
sky. The magenta is keyed out with background unmixing (soft edges keep their
own colour instead of a pink fringe), the right end is crossfaded into the left
so each strip repeats sideways, and the result is written as WebP to
public/assets/town-kit/far-<name>.webp.

    python3 tools/town-kit/far_layers.py

Only Pillow is required.
"""

from __future__ import annotations

import colorsys
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = Path(__file__).parent / "source"
OUT = ROOT / "public" / "assets" / "town-kit"
LAYERS = ["sky", "clouds", "mountains", "hills", "treeline"]
KEY = (253, 3, 251)
M0 = 70  # magenta-ness (min(r, b) - g) that real art can still have (pink blossoms)
BLEND = 160  # columns crossfaded to make the strip wrap


def key_magenta(im: Image.Image, despill: bool, rim_fix: bool = True) -> Image.Image:
    rgb = im.convert("RGB")
    w, h = rgb.size
    src = rgb.load()
    out = Image.new("RGBA", (w, h))
    dst = out.load()
    mk = min(KEY[0], KEY[2]) - KEY[1]
    for y in range(h):
        for x in range(w):
            r, g, b = src[x, y]
            if y < 3 or y >= h - 3:  # generators leave a stray line at the edges
                dst[x, y] = (0, 0, 0, 0)
                continue
            m = min(r, b) - g
            a = 1.0 if m <= M0 else max(0.0, 1 - (m - M0) / (mk - M0))
            if a <= 0.02:
                dst[x, y] = (0, 0, 0, 0)
                continue
            if a < 1:  # unmix: pixel = a * colour + (1 - a) * key (a floored: thin edges go dark otherwise)
                d = max(a, 0.45)
                r, g, b = (round(min(255, max(0, (c - (1 - d) * k) / d))) for c, k in zip((r, g, b), KEY))
            e = min(r, b) - g
            if e > 0 and (despill or (e > 18 and abs(r - b) < 45)):
                # Clouds/mist lose every magenta cast; elsewhere only key-like
                # fringe pixels (r ~ b), so pink blossoms (r >> b) stay pink.
                r, b = r - e, b - e // 2
            dst[x, y] = (r, g, b, round(a * 255))
    # The generator paints a few px of magenta halo along silhouettes: within
    # 8 px of the transparent area, drop strongly magenta pixels and despill
    # the rest (pink blossoms deeper inside the art are untouched).
    alpha = out.getchannel("A")
    inner = alpha.point(lambda v: 255 if v > 128 else 0).filter(ImageFilter.MinFilter(17)).load()
    a_px = alpha.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = dst[x, y]
            if not a or inner[x, y]:
                continue
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            e = max(0, min(r, b) - g)
            keyish = rim_fix or abs(r - b) < 40  # art pinks have r well above b
            if keyish and ((0.72 <= hh <= 0.96 and ss > 0.3) or e > 70):
                a_px[x, y] = 0
            elif keyish and e > 8:  # foliage blended with the key: fade and neutralise
                a_px[x, y] = round(a * max(0.0, 1 - (e - 8) / 70))
                dst[x, y] = (r - e, g, b - e, a_px[x, y])
            elif rim_fix and r - g > 25 and b - g > -20:  # pink rim light: make it a leaf highlight
                dst[x, y] = (min(255, g + 12), g, round(g * 0.62), a)
    out.putalpha(alpha)
    # Shave the 1 px rim where key and art were blended.
    out.putalpha(ImageChops.multiply(out.getchannel("A"), out.getchannel("A").filter(ImageFilter.MinFilter(3)).point(lambda v: 255 if v else 0)))
    return out


def wrap(im: Image.Image, k: int = BLEND) -> Image.Image:
    """Crossfade the last k columns over the first k, then drop them, so the
    strip's right edge flows into its left edge."""
    w, h = im.size
    tile = im.crop((0, 0, w - k, h))
    for x in range(k):
        a = im.crop((w - k + x, 0, w - k + x + 1, h))
        b = tile.crop((x, 0, x + 1, h))
        tile.paste(Image.blend(a, b, x / k), (x, 0))
    return tile


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name in LAYERS:
        src = next(SRC.glob(f"{name}.*"))
        im = Image.open(src)
        im = im.convert("RGB").convert("RGBA") if name == "sky" else key_magenta(im, despill=name in ("clouds", "mountains"))
        im = wrap(im)
        box = im.getchannel("A").getbbox() or (0, 0, *im.size)
        im = im.crop((0, box[1], im.width, box[3]))  # trim empty rows
        im.save(OUT / f"far-{name}.webp", "WEBP", quality=88, method=6)
        print(name, im.size, "top trimmed", box[1])


if __name__ == "__main__":
    main()
