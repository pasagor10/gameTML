#!/usr/bin/env python3
"""Turn the painted sprite sets still in use into pixel art that matches the
pixel heroes.

Pixel heroes show one art pixel per ~1.7 world px (a 48px body at height 96,
x0.86 GROUP_SCALE). Every painted set in public/assets/sprites/index.json
(monsters, NPCs, hero sets without "layers") gets its atlases shrunk so its
pixels come out the same size in the world, alpha made binary and the colours
reduced to one palette per set. Only cellSize changes in each animation.json
(sourceSize, anchors and body height stay in source units, so the game maps
them into the smaller cells by itself); sampling becomes "nearest". The set
gets "pixel": true, loses its sharp "showcase" still, and its portrait is
shrunk the same way.

Sets already at "sampling": "nearest" are skipped, so it is safe to re-run.

  python3 tools/sprite-rig/pixelate_sprites.py [name ...]
"""
import json
import math
import sys
from time import time_ns
from pathlib import Path

from PIL import Image

from import_pixel_sheet import quantize_all

ROOT = Path(__file__).resolve().parents[2] / "public/assets/sprites"
GROUP_SCALE = {"sets": 0.86, "npcs": 0.9, "monsters": 1}
TARGET = 96 * 0.86 / 48  # world px per hero art pixel


def shrink(cell, size):
    small = cell.convert("RGBa").resize(size, Image.Resampling.BOX).convert("RGBA")
    small.putalpha(small.getchannel("A").point(lambda v: 255 if v >= 120 else 0))
    return small


def pixelate(group, name, spec):
    folder = ROOT / spec["dir"]
    clips = {}
    for action in sorted(set(spec["actions"].values())):
        path = folder / action / "animation.json"
        if path.exists():
            clips[action] = (path, json.loads(path.read_text()))
    if not clips or all(m.get("sampling") == "nearest" for _, m in clips.values()):
        return None
    height = spec.get("height", 118) * GROUP_SCALE[group]
    cells, plan, idle_k = [], {}, None
    for action, (path, m) in clips.items():
        cw, ch = m["fallback"]["cellSize"]
        sw, sh = m.get("sourceSize") or [cw, ch]
        body = m["bodyHeightPx"] * ch / sh if m.get("bodyHeightPx") else ch * 0.85
        k = min(1, height / body / TARGET)
        if action == spec["actions"].get("idle"):
            idle_k = k
        ncw, nch = max(1, round(cw * k)), max(1, round(ch * k))
        pages = []
        for page in m["fallback"]["pages"]:
            im = Image.open(path.parent / page["file"]).convert("RGBA")
            cols = page.get("columns") or page["frameCount"]
            frames = []
            for i in range(page["frameCount"]):
                x, y = (i % cols) * cw, (i // cols) * ch
                frames.append(shrink(im.crop((x, y, x + cw, y + ch)), (ncw, nch)))
                cells.append(frames[-1])
            pages.append((page, cols, frames))
        plan[action] = (path, m, (ncw, nch), k, pages)
    reduced = iter(quantize_all(cells))
    for action, (path, m, (ncw, nch), k, pages) in plan.items():
        for page, cols, frames in pages:
            rows = math.ceil(len(frames) / cols)
            atlas = Image.new("RGBA", (ncw * cols, nch * rows))
            for i in range(len(frames)):
                atlas.paste(next(reduced), ((i % cols) * ncw, (i // cols) * nch))
            atlas.save(path.parent / page["file"], "WEBP", lossless=True)
        m["fallback"]["cellSize"] = [ncw, nch]
        m["sampling"] = "nearest"
        if m.get("sockets"):
            for socks in m["sockets"].values():
                for s in socks:
                    s[0], s[1] = round(s[0] * k, 2), round(s[1] * k, 2)
        path.write_text(json.dumps(m, indent=2) + "\n")
    portrait = spec.get("portrait") and folder / spec["portrait"]
    if portrait and portrait.exists() and idle_k:
        im = Image.open(portrait).convert("RGBA")
        small = shrink(im, (max(1, round(im.width * idle_k)), max(1, round(im.height * idle_k))))
        q = quantize_all([small])[0]
        q.save(portrait, "WEBP", lossless=True)
    if spec.get("showcase"):
        (folder / spec["showcase"]).unlink(missing_ok=True)
        del spec["showcase"]
    spec["pixel"] = True
    spec["source"] = spec.get("source", "") + "; pixelated (pixelate_sprites.py)"
    return idle_k


def main():
    only = set(sys.argv[1:])
    index_path = ROOT / "index.json"
    index = json.loads(index_path.read_text())
    for group in ("monsters", "npcs", "sets"):
        for name, spec in index.get(group, {}).items():
            if spec.get("layers") or (only and name not in only):
                continue
            k = pixelate(group, name, spec)
            if k:
                print(f"{group}/{name}: x{k:.3f}")
    # New version: atlas URLs carry it, so browsers drop the cached art.
    index["version"] = time_ns()
    index_path.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
