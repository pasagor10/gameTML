"""Build six-state runtime atlases from generated transparent 4x6 sheets."""
import json
import time
from pathlib import Path
from PIL import Image
from import_pixel_monsters import cells, write_set, ROOT
from slice_monsters import ROWS, TIMING

SOURCE = Path(__file__).parent / "source/extra-monsters"
SPECS = {
    "frost-scarab": (92, False), "lava-salamander": (88, False),
    "thorn-mantis": (106, False), "storm-harpy": (104, True),
    "moon-reaper": (112, True), "mimic": (90, False),
}


def main():
    path = ROOT / "index.json"
    index = json.loads(path.read_text())
    for name, (height, flyer) in SPECS.items():
        sheet = Image.open(SOURCE / f"{name}.png").convert("RGBA")
        if sheet.getchannel("A").getextrema()[0] > 32:
            raise ValueError(f"{name}: missing transparent background")
        # Quantize faint alpha noise before measuring feet and body anchors.
        # RGB artwork and the generated silhouette remain unchanged.
        sheet.putalpha(sheet.getchannel("A").point(lambda a: 0 if a < 96 else a))
        rows = cells(sheet, 4, 6)
        scale = min(1, 144 / rows[0][0].height)
        rows = [[f.resize((round(f.width * scale), round(f.height * scale)),
                           Image.Resampling.NEAREST) for f in row] for row in rows]
        write_set("monsters", name, rows, ROWS, lambda a: TIMING[a], height, flyer)
        portrait = rows[0][0]
        bounds = portrait.getbbox()
        if not bounds:
            raise ValueError(f"{name}: empty idle frame")
        portrait.crop(bounds).save(ROOT / "monsters" / name / "portrait.webp", "WEBP", lossless=True)
        for action in ROWS:
            manifest_path = ROOT / "monsters" / name / action / "animation.json"
            manifest = json.loads(manifest_path.read_text())
            manifest["artSource"] = "generated original monster sprite sheet"
            manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
        index["monsters"][name] = {
            "dir": f"monsters/{name}", "height": height, "facing": -1,
            "flyer": flyer, "pixel": True,
            "source": "generated original sheet (import_extra_monsters.py)",
            "actions": {a: a for a in ROWS},
        }
    index["version"] = time.time_ns()
    path.write_text(json.dumps(index, indent=2) + "\n")


if __name__ == "__main__":
    main()
