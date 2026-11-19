"""Import transparent 4x2 NPC sheets, preserving their generated alpha.

Run after placing trainer.png and stones.png in source/npcs-services.
Uses the existing atlas writer and NPC idle/talk runtime contract.
"""
import json
import time
from pathlib import Path

from PIL import Image
from import_pixel_monsters import cells, write_set, ROOT
from slice_npcs import ROWS, TIMING

SOURCE = Path(__file__).parent / "source/npcs-services"


def main():
    index_path = ROOT / "index.json"
    index = json.loads(index_path.read_text())
    for name, height in [("trainer", 114), ("stones", 108)]:
        sheet = Image.open(SOURCE / f"{name}.png").convert("RGBA")
        if sheet.getchannel("A").getextrema()[0] == 255:
            raise ValueError(f"{name}: expected genuine transparent background")
        rows = cells(sheet, 4, 2)
        # Retain the same cell coordinates and alpha while reducing atlas cost.
        scale = min(1, 180 / rows[0][0].height)
        rows = [[frame.resize((round(frame.width * scale), round(frame.height * scale)),
                              Image.Resampling.NEAREST) for frame in row] for row in rows]
        write_set("npcs", name, rows, ROWS, lambda a: (TIMING[a], True, None), height, False)
        for action in ROWS:
            path = ROOT / "npcs" / name / action / "animation.json"
            manifest = json.loads(path.read_text())
            manifest["artSource"] = "AI generated transparent pixel sprite sheet"
            path.write_text(json.dumps(manifest, indent=2) + "\n")
        index.setdefault("npcs", {})[name] = {
            "dir": f"npcs/{name}", "height": height, "facing": 1,
            "source": "generated transparent sheet (import_service_npcs.py)",
            "actions": {a: a for a in ROWS}, "pixel": True,
        }
    index["version"] = time.time_ns()
    index_path.write_text(json.dumps(index, indent=2) + "\n")


if __name__ == "__main__":
    main()
