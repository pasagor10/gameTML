"""Find the weapon-hand position in every hero frame and store it as frames[...].hand.

The importer wrote one provisional socket at the belt for all frames, so equipment stayed
still while the painted arms pumped. Here the hand is the forward-most opaque, non-scarf
pixel inside the arm band (the leading fist), smoothed over neighbouring frames so the
weapon follows the swing without hopping when the two fists cross. Reads the atlas only.
"""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / 'assets/sprites/heroes/manifest.json'
DIRECTIONS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
SIZE = 256
LEFT = {'sw', 'w', 'nw'}  # mirrors the renderer: these rows hold the weapon on screen-left


def is_body(pixel):
    r, g, b, a = pixel
    if a < 140:
        return False
    if r > 110 and r > 1.6 * g and r > 1.6 * b:  # red scarf / cape
        return False
    if min(r, g, b) > 175:  # silver hair
        return False
    if r > 185 and g > 135 and b > 105:  # bare face skin (hands are gloved)
        return False
    return True


def find_hand(frame, direction):
    side = -1 if direction in LEFT else 1
    top, bottom = (124, 160) if direction in ('n', 's') else (118, 154)
    best = None
    for y in range(top, bottom):
        xs = range(SIZE - 1, -1, -1) if side > 0 else range(SIZE)
        for x in xs:
            if is_body(frame.getpixel((x, y))):
                if best is None or (x - best[0]) * side > 0:
                    best = (x, y)
                break
    if best is None:
        return None
    # Step inward from the knuckle edge to the centre of the fist.
    return (best[0] - side * 7, best[1] + 2)


def smooth(points):
    n = len(points)
    out = []
    for i in range(n):
        neighbours = [points[(i - 1) % n], points[i], points[i], points[(i + 1) % n]]
        out.append({'x': round(sum(p[0] for p in neighbours) / 4), 'y': round(sum(p[1] for p in neighbours) / 4)})
    return out


manifest = json.loads(MANIFEST.read_text())
for sex in ('male', 'female'):
    for state, entry in manifest['characters'][sex].items():
        atlas = Image.open(ROOT / f'assets/sprites/heroes/{sex}/{state}.png').convert('RGBA')
        for row, direction in enumerate(DIRECTIONS):
            raw = []
            for col in range(entry['columns']):
                frame = atlas.crop((col * SIZE, row * SIZE, col * SIZE + SIZE, row * SIZE + SIZE))
                fallback = entry['frames'][f'{direction}-{col}']['hand']
                raw.append(find_hand(frame, direction) or (fallback['x'], fallback['y']))
            for col, hand in enumerate(smooth(raw)):
                f = entry['frames'][f'{direction}-{col}']
                f['hand'] = hand
                f['handStatus'] = 'detected'
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
print('hand sockets written')
