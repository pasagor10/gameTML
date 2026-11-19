"""Import detailed serpent replacements without overwriting the original art.

Sources: source/serpent-redesigns/serpent-v2.png (4x6), naga-v2.png (4x7).
The runtime ids stay serpent/naga; new versioned directories make rollback simple.
"""
import json
import time
from pathlib import Path
from PIL import Image
from import_pixel_monsters import cells, write_set, ROOT
from slice_monsters import TIMING

SOURCE = Path(__file__).parent / "source/serpent-redesigns"
SPECS = {
    "serpent": ("serpent-v2", 190, ["idle", "move", "attack", "hit", "death", "spawn"]),
    "naga": ("naga-v2", 300, ["idle", "move", "attack", "skill", "hit", "death", "spawn"]),
}


def main():
    path = ROOT / "index.json"
    index = json.loads(path.read_text())
    for runtime_id, (name, height, actions) in SPECS.items():
        sheet = Image.open(SOURCE / f"{name}.png").convert("RGBA")
        if sheet.getchannel("A").getextrema()[0] > 32:
            raise ValueError(f"{name}: expected transparent background")
        sheet.putalpha(sheet.getchannel("A").point(lambda a: 0 if a < 96 else a))
        rows = cells(sheet, 4, len(actions))
        # Keep the original resolution; these large monsters need detailed faces.
        timing = lambda action: ([160, 180, 100, 180], False, 2) if action == "skill" else TIMING[action]
        write_set("monsters", name, rows, actions, timing, height, False)
        first = rows[0][0]
        bounds = first.getbbox()
        if not bounds:
            raise ValueError(f"{name}: empty idle frame")
        first.crop(bounds).save(ROOT / "monsters" / name / "portrait.webp", "WEBP", lossless=True)
        for action in actions:
            manifest_path = ROOT / "monsters" / name / action / "animation.json"
            manifest = json.loads(manifest_path.read_text())
            manifest["artSource"] = "original detailed painted serpent redesign"
            manifest["sampling"] = "linear"
            manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
        index["monsters"][runtime_id] = {
            "dir": f"monsters/{name}", "height": height, "facing": -1,
            "flyer": False, "pixel": False, "portrait": "portrait.webp",
            "source": "painted redesign (import_serpent_redesigns.py)",
            "actions": {a: a for a in actions},
        }
    index["version"] = time.time_ns()
    path.write_text(json.dumps(index, indent=2) + "\n")


if __name__ == "__main__":
    main()
