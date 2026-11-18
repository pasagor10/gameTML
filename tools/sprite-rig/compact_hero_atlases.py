#!/usr/bin/env python3
"""Shrink runtime hero atlases to a 140px body. Leave source art and portraits intact."""
import json
from pathlib import Path
from time import time_ns

from PIL import Image

ROOT = Path(__file__).resolve().parents[2] / "public/assets/sprites"
BODY_PIXELS = 140


def compact(path):
    manifest = json.loads(path.read_text())
    fallback = manifest["fallback"]
    width, height = fallback["cellSize"]
    body = manifest["bodyHeightPx"] * height / manifest["sourceSize"][1]
    if body <= BODY_PIXELS:
        return False

    scale = BODY_PIXELS / body
    new_width = max(1, round(width * scale))
    new_height = max(1, int(height * scale))
    for page in fallback["pages"]:
        image_path = path.parent / page["file"]
        columns = page["columns"]
        rows = (page["frameCount"] + columns - 1) // columns
        with Image.open(image_path) as source:
            atlas = Image.new("RGBA", (columns * new_width, rows * new_height))
            for frame in range(page["frameCount"]):
                column, row = frame % columns, frame // columns
                x, y = column * width, row * height
                cell = source.crop((x, y, x + width, y + height))
                cell = cell.resize((new_width, new_height), Image.Resampling.LANCZOS)
                atlas.paste(cell, (column * new_width, row * new_height))
        atlas.save(image_path, "WEBP", quality=88, method=3)

    fallback["cellSize"] = [new_width, new_height]
    if "encodedAnchor" in manifest:
        x, y = manifest["encodedAnchor"]
        manifest["encodedAnchor"] = [x * new_width / width, y * new_height / height]
    path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    return True


def main():
    index_path = ROOT / "index.json"
    index = json.loads(index_path.read_text())
    manifests = {
        ROOT / entry["dir"] / action / "animation.json"
        for entry in index["sets"].values()
        for action in entry["actions"].values()
    }
    count = sum(compact(path) for path in sorted(manifests))
    if count:
        index["version"] = str(time_ns())
        index_path.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n")
    print(f"Compacted {count} hero atlases")


if __name__ == "__main__":
    main()
