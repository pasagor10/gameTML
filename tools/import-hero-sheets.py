"""Normalize generated equal-grid sheets into aligned runtime atlases, without repainting art.
Usage: python3 tools/import-hero-sheets.py
Dependencies: Pillow. Preserves source PNGs and genuine alpha. Reports suspicious cells.
"""
from pathlib import Path
from PIL import Image
import json

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/sprites/source'
DEST = ROOT / 'assets/sprites/heroes'
DIRECTIONS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
SIZE, AX, AY = 256, 128, 224

def import_sheet(sex, state, columns):
    overrides = json.loads((SOURCE/'sources.json').read_text()) if (SOURCE/'sources.json').exists() else {}
    src = SOURCE / overrides.get(f'{sex}-{state}', f'{sex}-{state}.png')
    image = Image.open(src).convert('RGBA')
    if image.getchannel('A').getextrema()[0] != 0:
        raise ValueError(f'{src}: lacks transparent background')
    width, height = image.size
    cells = []
    # Generated rows are only approximately gridded. Find the transparent gutter
    # nearest each expected boundary per column rather than cutting hair or boots.
    separators = {}
    for col in range(columns):
        strip = image.crop((round(col*width/columns), 0, round((col+1)*width/columns), height))
        alpha = strip.getchannel('A')
        density = [sum(a > 32 for a in alpha.crop((0,y,strip.width,y+1)).tobytes()) for y in range(height)]
        bounds = [0]
        for row in range(1,8):
            expected = row*height/8
            candidates = range(max(bounds[-1]+1,round(expected-height/8*.15)), min(height,round(expected+height/8*.15)))
            bounds.append(min(candidates,key=lambda y:(density[y],abs(y-expected))))
        bounds.append(height)
        separators[col] = bounds
    for row in range(8):
        for col in range(columns):
            box = (round(col*width/columns), separators[col][row], round((col+1)*width/columns), separators[col][row+1])
            cell = image.crop(box)
            alpha = cell.getchannel('A')
            # Ignore faint edge/glow noise when calculating normalization bounds.
            bbox = alpha.point(lambda a: 255 if a > 32 else 0).getbbox()
            if not bbox:
                raise ValueError(f'{src}: empty cell {row},{col}')
            cells.append((row, col, cell, bbox))
    # One shared scale per character, not one scale per frame (which causes size popping).
    scale = min(194/max(b[3]-b[1] for _,_,_,b in cells), 226/max(b[2]-b[0] for _,_,_,b in cells))
    atlas = Image.new('RGBA', (SIZE*columns, SIZE*8))
    frames, warnings = {}, []
    for row, col, cell, bbox in cells:
        crop = cell.crop(bbox)
        crop = crop.resize((max(1,round(crop.width*scale)),max(1,round(crop.height*scale))),Image.Resampling.LANCZOS)
        dx, dy = AX-crop.width//2, AY-crop.height
        atlas.alpha_composite(crop,(col*SIZE+dx,row*SIZE+dy))
        # Initial weapon anchors: editable independently per frame after attachment preview.
        frames[f'{DIRECTIONS[row]}-{col}'] = {'x':col*SIZE,'y':row*SIZE,'width':SIZE,'height':SIZE,'foot':{'x':AX,'y':AY},'hand':{'x':AX+(-24 if row>=5 else 24),'y':AY-61},'handStatus':'provisional','sourceBounds':list(bbox)}
        if bbox[0]<2 or bbox[1]<2 or bbox[2]>=cell.width-2 or bbox[3]>=cell.height-2:
            warnings.append(f'{DIRECTIONS[row]}-{col}: artwork touches source cell edge; inspect')
    out = DEST/sex
    out.mkdir(parents=True,exist_ok=True)
    atlas.save(out/f'{state}.png',optimize=True)
    return {'source':str(src.relative_to(ROOT)),'columns':columns,'rows':8,'frameSize':SIZE,'scale':scale,'fps':10 if state=='run' else 4,'frames':frames,'warnings':warnings}

def main():
    manifest={'version':1,'directions':DIRECTIONS,'frameSize':SIZE,'foot':{'x':AX,'y':AY},'characters':{}}
    for sex in ['male','female']:
        manifest['characters'][sex]={}
        for state,columns in [('run',6),('idle',4)]:
            result=import_sheet(sex,state,columns)
            manifest['characters'][sex][state]=result
            print(sex,state,'frames',len(result['frames']),'warnings',result['warnings'])
    (DEST/'manifest.json').write_text(json.dumps(manifest,indent=2))

if __name__=='__main__':main()
