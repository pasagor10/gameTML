"""Cut the repeating street tile (street + foundation wall) from the town painting.

The town's buildings and props are separate kit art (kit_art.py) and its
background is far_layers.py; only the street still comes from the painting.
Writes public/assets/town-kit/street.webp, crossfaded to repeat sideways.

    python3 tools/town-kit/cut_town.py [painting.png]

Only Pillow is required.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "assets" / "town-kit"
STREET_TOP = 770  # the street's back edge in the painting (world y TOWN_STREET_Y)


def seamless(src: Image.Image, x0: int, y0: int, w: int, h: int, k: int) -> Image.Image:
    """Crop w x h at (x0, y0) and blend its first k columns with the k columns
    just past its right edge, so the tile wraps without a seam."""
    region = src.crop((x0, y0, x0 + w + k, y0 + h))
    tile = region.crop((0, 0, w, h))
    for x in range(k):
        a = region.crop((w + x, 0, w + x + 1, h))
        b = tile.crop((x, 0, x + 1, h))
        tile.paste(Image.blend(a, b, x / k), (x, 0))
    return tile


def main():
    src_path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "public" / "assets" / "town-terraces-v2.png"
    src = Image.open(src_path).convert("RGB")
    OUT.mkdir(parents=True, exist_ok=True)
    street = seamless(src, 300, STREET_TOP, 512, src.height - STREET_TOP, 96)
    street.save(OUT / "street.webp", "WEBP", quality=90, method=6)
    print("tile street", street.size)


if __name__ == "__main__":
    main()
