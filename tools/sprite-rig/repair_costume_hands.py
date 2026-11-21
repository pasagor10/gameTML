"""Apply reviewed per-frame palm positions and rebuild the procedural grip mask."""
import json
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[2]
SET = ROOT / 'public/assets/sprites/female-costume-1-maple-v1'
points = json.loads((Path(__file__).parent / 'attachments/female-costume-1.json').read_text())
for action, palms in points.items():
    manifest = SET / 'body' / action / 'animation.json'
    data = json.loads(manifest.read_text())
    old = data['sockets']['hand']
    data['sockets']['hand'] = [[x, y, old[i][2]] for i, (x, y) in enumerate(palms)]
    manifest.write_text(json.dumps(data, indent=2) + '\n')
    w, h = data['fallback']['cellSize']
    page = data['fallback']['pages'][0]['file']
    body = Image.open(manifest.parent / page).convert('RGBA')
    hand = Image.new('RGBA', body.size)
    radius = data['bodyHeightPx'] * .075
    for i, (x, y) in enumerate(palms):
        frame = body.crop((i*w, 0, (i+1)*w, h))
        mask = Image.new('L', (w, h))
        ImageDraw.Draw(mask).ellipse((x-radius,y-radius,x+radius,y+radius),fill=255)
        from PIL import ImageChops
        frame.putalpha(ImageChops.multiply(frame.getchannel('A'), mask))
        hand.paste(frame, (i*w, 0))
    hand.save(SET / 'hand' / action / page, 'WEBP', lossless=True)
index_file = ROOT / 'public/assets/sprites/index.json'
index = json.loads(index_file.read_text())
index['version'] = 'costume-palm-fix-20261121'
index_file.write_text(json.dumps(index, ensure_ascii=False, indent=2) + '\n')
