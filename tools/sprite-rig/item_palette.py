"""Pick each item picture's main, trim and gem colours for hero gear tints.

Writes public/assets/items/palette.json: { "armor-3": {"main": "#8a8f9a",
"trim": "#e2b24a", "gem": "#5ad0ff"}, ... }. Layered heroes tint their
outfit and headwear with the armour's colours so the worn look matches the
item picture.

    python3 tools/sprite-rig/item_palette.py
"""

import colorsys
import json
from pathlib import Path

from PIL import Image

ITEMS = Path(__file__).resolve().parents[2] / "public" / "assets" / "items"


def hsv(c):
    return colorsys.rgb_to_hsv(*(v / 255 for v in c))


def palette(path):
    im = Image.open(path).convert("RGBA").resize((96, 96))
    px = [p[:3] for p in im.get_flattened_data() if p[3] > 200]
    # Drop near-black outline and shadow pixels.
    px = [p for p in px if max(p) > 55]
    if not px:
        return None
    sample = Image.new("RGB", (len(px), 1))
    sample.putdata(px)
    q = sample.quantize(colors=14, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()
    counts = sorted(q.getcolors(), reverse=True)
    clusters = [(n, tuple(pal[i * 3:i * 3 + 3])) for n, i in counts]
    # Shadows quantize into dull dark clusters: pick colours from the lit ones.
    lit = [(n, c) for n, c in clusters if hsv(c)[2] >= 0.42] or clusters
    total = sum(n for n, _ in clusters)
    main = lit[0][1]

    def far(a, b):
        ha, sa, va = hsv(a)
        hb, sb, vb = hsv(b)
        dh = min(abs(ha - hb), 1 - abs(ha - hb))
        return dh * 2 + abs(sa - sb) + abs(va - vb) * 0.7

    # Trim: the biggest cluster that clearly differs from the main colour.
    trim = next((c for n, c in lit[1:] if far(c, main) > 0.35 and n > total * 0.03), lit[min(1, len(lit) - 1)][1])
    # Gem: the most saturated, bright cluster.
    gem = max((c for n, c in clusters if n > total * 0.004), key=lambda c: hsv(c)[1] * hsv(c)[2] ** 2)
    # Tints multiply the gear's light-grey art: keep them bright enough to read.
    def lift(c, floor):
        h, s_, v = hsv(c)
        return tuple(round(x * 255) for x in colorsys.hsv_to_rgb(h, s_, max(v, floor)))
    main, trim, gem = lift(main, 0.55), lift(trim, 0.6), lift(gem, 0.75)
    hexed = lambda c: "#%02x%02x%02x" % c
    return {"main": hexed(main), "trim": hexed(trim), "gem": hexed(gem)}


def main():
    out = {}
    for path in sorted(ITEMS.glob("*.webp")):
        p = palette(path)
        if p:
            out[path.stem] = p
    (ITEMS / "palette.json").write_text(json.dumps(out, indent=1) + "\n")
    print("wrote", len(out), "palettes")


if __name__ == "__main__":
    main()
