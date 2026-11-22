"""Measure how far each run frame moves to the next one and store per-frame timing.

AI-painted run cycles do not change pose evenly: some neighbouring frames are almost
identical while others jump. Showing each frame for the same time makes the stride look
like pause-jump-pause. We hold each frame in proportion to the silhouette change to the
next frame so the visible motion advances at an even rate. Only reads the atlas; writes
`timing` into manifest.json.
"""
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / 'assets/sprites/heroes/manifest.json'
DIRECTIONS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
SIZE = 256

manifest = json.loads(MANIFEST.read_text())
for sex in ('male', 'female'):
    entry = manifest['characters'][sex]['run']
    columns = entry['columns']
    atlas = Image.open(ROOT / f'assets/sprites/heroes/{sex}/run.png').convert('RGBA')
    timing = {}
    for row, direction in enumerate(DIRECTIONS):
        frames = [atlas.crop((c * SIZE, row * SIZE, c * SIZE + SIZE, row * SIZE + SIZE)).getchannel('A') for c in range(columns)]
        change = [ImageStat.Stat(ImageChops.difference(frames[i], frames[(i + 1) % columns])).mean[0] for i in range(columns)]
        mean = sum(change) / columns
        # Clamp so a measuring outlier can never freeze or skip a frame.
        weights = [min(1.5, max(0.6, value / mean)) for value in change]
        total = sum(weights)
        timing[direction] = [round(w * columns / total, 4) for w in weights]
    entry['timing'] = timing
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
print('timing written for', ', '.join(manifest['characters']))
