"""Create a new skeletal pose diagram, not a modification of character artwork."""
from PIL import Image,ImageDraw
from math import sin,cos,pi
from pathlib import Path
root=Path(__file__).resolve().parents[1]
# Thigh angle and knee flexion; the opposite leg uses a half-cycle offset.
poses=[(35,15),(15,60),(-25,40),(-40,95),(35,15),(15,60),(-25,40),(-40,95)]
left=[(35,15),(15,60),(-25,40),(-40,95),(45,100),(55,115),(45,85),(45,45)]
# Near leg advances, compresses, pushes off, folds, recovers and reaches out again.
right=left[4:]+left[:4]
for part,rows in [('upper',[(0,-1),(1,-1),(1,0),(1,1)]),('lower',[(0,1),(-1,1),(-1,0),(-1,-1)])]:
 im=Image.new('RGBA',(2048,1024),(255,255,255,255));d=ImageDraw.Draw(im)
 for row,(dx,dy) in enumerate(rows):
  norm=(dx*dx+dy*dy)**.5;dx/=norm;dy/=norm
  for col in range(8):
   ox=col*256+128;oy=row*256+224;hipz=58+[0,-3,0,3,0,-3,0,3][col]
   def p(forward,side,z):return (ox+dx*forward-dy*side,oy+(dy*forward+dx*side)*.43-z)
   hips=[p(0,-9,hipz),p(0,9,hipz)]
   for leg,angles,color in [(0,left[col],(232,125,54,255)),(1,right[col],(63,137,225,255))]:
    a,k=[v*pi/180 for v in angles];side=-9 if leg==0 else 9
    knee=p(sin(a)*31,side,hipz-cos(a)*31)
    ankle=p(sin(a)*31+sin(a-k)*29,side,hipz-cos(a)*31-cos(a-k)*29)
    d.line([hips[leg],knee,ankle],fill=color,width=12)
    d.ellipse((knee[0]-5,knee[1]-5,knee[0]+5,knee[1]+5),fill=color)
    toe=(ankle[0]+dx*12,ankle[1]+dy*5)
    d.line([ankle,toe],fill=color,width=13)
   h=p(0,0,hipz);shoulder=p(6,0,hipz+43);head=p(10,0,hipz+91)
   d.line([h,shoulder],fill=(100,115,127),width=38)
   for arm,phase,color in [(0,col,(232,125,54)),(1,(col+4)%8,(63,137,225))]:
    swing=sin(phase*pi/4)*18;side=-22 if arm==0 else 22
    sh=p(6,side,hipz+38);el=p(-swing,side,hipz+22);hand=p(-swing+20,side,hipz+27)
    d.line([sh,el,hand],fill=color,width=10)
   d.ellipse((head[0]-29,head[1]-30,head[0]+29,head[1]+30),fill=(204,211,219),outline=(87,100,114),width=2)
   if dy>=0 or dx:
    face=p(10+dx*12,dy*5,hipz+91)
    d.ellipse((face[0]-3,face[1]-3,face[0]+3,face[1]+3),fill=(61,77,91))
 im.save(root/'assets/sprites/guides'/f'run-{part}.png')
