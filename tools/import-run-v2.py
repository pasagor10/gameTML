"""Import split 8-frame run sheets while preserving each pose's position and flight height."""
from pathlib import Path
from PIL import Image
from statistics import median
import json

def registration_anchor(cell, box, back):
    """Track face on front/side views, silver head on rear views (not a moving boot)."""
    pixels=cell.load();height=box[3]-box[1];points=[]
    for y in range(round(box[1]+height*(0 if back else .15)),round(box[1]+height*(.36 if back else .53))):
        for x in range(box[0],box[2]):
            r,g,b,a=pixels[x,y]
            silver=min(r,g,b)>85 and max(r,g,b)-min(r,g,b)<45 and b>=r*.9
            skin=r-g>18 and g-b>10 and b>65 and r>150
            if a>200 and (silver if back else skin):points.append((x,y))
    if len(points)<30:raise ValueError("Cannot register character head; manual anchor needed")
    return median([x for x,y in points]),median([y for x,y in points])


ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets/sprites/source'
OUT=ROOT/'assets/sprites/heroes'
DIRECTIONS=['n','ne','e','se','s','sw','w','nw']
SIZE,AX,AY=256,128,224

def import_run(sex):
    cells=[]
    config_path=SOURCE/'run-sources.json'
    config=json.loads(config_path.read_text()) if config_path.exists() else {'version':2}
    version=config['version']
    for part_index,part in enumerate(['upper','lower']):
        image=Image.open(SOURCE/f'{sex}-run-v{version}-{part}.png').convert('RGBA')
        assert image.getchannel('A').getextrema()[0]==0
        for row in range(4):
            for col in range(8):
                left,top=round(col*image.width/8),round(row*image.height/4)
                right,bottom=round((col+1)*image.width/8),round((row+1)*image.height/4)
                cell=image.crop((left,top,right,bottom))
                bbox=cell.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox()
                if not bbox:raise ValueError(f'empty {sex} {part} {row} {col}')
                direction_row=row+part_index*4
                anchor=registration_anchor(cell,bbox,direction_row in [0,1,7])
                cells.append({'row':direction_row,'col':col,'image':cell,'bbox':bbox,'anchor':anchor})
    # Scale is shared by both halves. Register face/hair across frames to remove baked-in whole-body drift.
    # A small authored bob remains; leg pose height is not flattened.
    scale=min(188/max(c['bbox'][3]-c['bbox'][1] for c in cells),218/max(c['bbox'][2]-c['bbox'][0] for c in cells))
    atlas=Image.new('RGBA',(2048,2048));frames={}
    for row in range(8):
        group=[c for c in cells if c['row']==row]
        ground=median([c['bbox'][3] for c in group if c['col'] in [0,4]])
        center=median([(c['bbox'][0]+c['bbox'][2])/2 for c in group])
        head_x=median(c['anchor'][0] for c in group)
        head_y=median(c['anchor'][1] for c in group if c['col'] in [0,4])
        bob=[0,1,-1,-3,0,1,-1,-3]
        for c in group:
            box=c['bbox'];crop=c['image'].crop(box)
            crop=crop.resize((max(1,round(crop.width*scale)),max(1,round(crop.height*scale))),Image.Resampling.LANCZOS)
            offset_x=head_x-c['anchor'][0]
            offset_y=head_y-c['anchor'][1]+bob[c['col']]
            dx=round(AX+(box[0]-center+offset_x)*scale)
            dy=round(AY+(box[1]-ground+offset_y)*scale)
            # The ground is stable; sprite bottoms are deliberately NOT stable.
            if dy<4:dy=4
            if dy+crop.height>252:dy=252-crop.height
            atlas.alpha_composite(crop,(c['col']*256+dx,row*256+dy))
            frames[f'{DIRECTIONS[row]}-{c["col"]}']={'x':c['col']*256,'y':row*256,'width':256,'height':256,'foot':{'x':AX,'y':AY},'hand':{'x':AX+(-24 if row>=5 else 24),'y':AY-61},'handStatus':'provisional','sourceAnchor':list(c['anchor']),'registeredHead':[round(dx+(c['anchor'][0]-box[0])*scale,2),round(dy+(c['anchor'][1]-box[1])*scale,2)],'contentBounds':[dx,dy,dx+crop.width,dy+crop.height],'sourceBounds':list(box)}
    atlas.save(OUT/sex/'run.png',optimize=True)
    return {'source':[f'assets/sprites/source/{sex}-run-v{version}-{p}.png' for p in ['upper','lower']],'columns':8,'rows':8,'frameSize':256,'scale':scale,'fps':12,'preserveFlight':True,'registeredHead':True,'frameOrder':[0,1,2,3,4,5,6,7],'frames':frames,'warnings':[]}

if __name__=='__main__':
    path=OUT/'manifest.json';manifest=json.loads(path.read_text());manifest['version']=4
    for sex in ['male','female']:
        manifest['characters'][sex]['run']=import_run(sex)
        print(sex,'run: 64 frames, head registered, leg poses preserved')
    path.write_text(json.dumps(manifest,indent=2))
