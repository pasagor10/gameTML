"""Recolour the knight sheet into its tier-3 look: crimson cape, royal-blue
shield and cloth, gold-washed plate.

  python3 tools/sprite-rig/recolour_knight_tier3.py IN.png OUT.png
"""
import colorsys, sys
from PIL import Image
src, out = sys.argv[1:3]
im = Image.open(src).convert("RGB"); px = im.load(); W, H = im.size
def key(p): r,g,b=p; return r>150 and b>150 and g<0.55*min(r,b)
for y in range(H):
    for x in range(W):
        p = px[x, y]
        if key(p): continue
        h, s, v = colorsys.rgb_to_hsv(*(c/255 for c in p))
        hd = h*360
        if 150 <= hd <= 215 and s > 0.15:          # teal cape -> crimson
            h, s, v = 352/360, min(1, max(s, 0.55)*1.15), min(1, v*1.35+0.06)
        elif 215 < hd <= 290 and s > 0.07 and v < 0.62:  # navy shield/cloth -> royal blue
            h, s, v = 224/360, min(1, max(s, 0.42)*1.1), min(1, v*1.2+0.03)
        elif s < 0.28 and v > 0.38:                 # silver plate -> gold-washed white steel
            t = (v-0.38)/0.62
            h = 42/360; s = s*0.5 + 0.22*(1-t*0.6); v = min(1, v*1.04)
        px[x, y] = tuple(round(c*255) for c in colorsys.hsv_to_rgb(h, s, v))
im.save(out)
