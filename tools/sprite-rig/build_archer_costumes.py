"""Build supplied four-column, eight-row archer class costume sheets.
Uses the existing sprite import pipeline; originals remain unchanged.
Usage: python3 tools/sprite-rig/build_archer_costumes.py male-2.png male-3.png female-2.png female-3.png
"""
import sys
import json
from pathlib import Path
import slice_sheet as slicer
from PIL import Image


def clear_magenta(im):
    # Remove matte contamination left by compression around hair and bow edges.
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            spill = min(r, b) - g
            if a and spill > 8:
                strength = min(1, (spill - 8) / 22)
                px[x, y] = (r, g, b, round(a * (1 - strength)))
    return im


def main(paths):
    if len(paths) != 4:
        raise SystemExit(__doc__)
    # The supplied magenta matte has compression variation near the edges.
    slicer.KEY_T = 75
    slicer.SOFT_T = 125
    slicer.POCKET_HEAD = 0
    slicer.TIMING.update({
        "idle": dict(ms=180, loop=True, hit=None, x="cell", y="feet"),
        "jump": dict(ms=[90, 130, 140, 110], loop=False, hit=None, x="cell", y="median"),
        "attack": dict(ms=[90, 100, 70, 140], loop=False, hit=2, x="cell", y="feet"),
        "skill": dict(ms=[100, 100, 110, 150], loop=False, hit=2, x="cell", y="feet"),
        "hurt": dict(ms=[60, 70, 90, 100], loop=False, hit=None, x="cell", y="feet"),
        "death": dict(ms=[90, 140, 200, 450], loop=False, hit=None, x="cell", y="median"),
    })
    slicer.STATE_FOR["jump"] = "jump"
    for path, (gender, tier) in zip(paths, [("male", 2), ("male", 3), ("female", 2), ("female", 3)]):
        name = f"archer-{gender}-ranger-{tier}"
        sys.argv = [__file__, path, "--cols", "4", "--rows", *[
            f"{name}:{action}" for action in ["idle", "walk", "run", "jump", "attack", "skill", "hurt", "death"]
        ]]
        slicer.main()
        folder = slicer.ROOT / f"{name}-painted"
        for page in folder.glob("*/*-atlas-00.webp"):
            clear_magenta(Image.open(page).convert("RGBA")).save(page, "WEBP", quality=94, method=2)
        clip = json.loads((folder / "idle/animation.json").read_text())
        width, height = clip["fallback"]["cellSize"]
        atlas = Image.open(folder / "idle/idle-atlas-00.webp")
        portrait = atlas.crop((0, 0, width, height))
        portrait = portrait.crop(portrait.getbbox())
        portrait.save(folder / "portrait.webp", "WEBP", quality=94, method=2)
        # Both branches use the supplied appearance at the corresponding tier.
        # Aliases share the atlas files rather than duplicate downloads.
        index_path = slicer.ROOT / "index.json"
        index = json.loads(index_path.read_text())
        index["sets"][f"archer-{gender}-scout-{tier}"] = dict(index["sets"][name])
        index_path.write_text(json.dumps(index, indent=2) + "\n")


if __name__ == "__main__":
    main(sys.argv[1:])
