"""Project the two model outlines on the same registered crop of SKTB9."""
import json, math
from pathlib import Path
from PIL import Image,ImageDraw
folder=Path(__file__).resolve().parent
data=json.loads((folder/'breaker-photo.json').read_text())
photo=Image.open(folder.parents[3]/'mobot-assets/archive/1987-breaker.jpg')
scale=photo.width/data['imageWidth']
a,b=data['origin']
dx,dy=data['direction']
length=math.hypot(dx,dy)
ux,uy=dx/length,dy/length
vx,vy=-uy,ux
# Each output pixel is 1/3 of a reference-image pixel.
zoom=3
coeff=(scale*ux/zoom,scale*vx/zoom,scale*(a-5*ux-20*vx),
       scale*uy/zoom,scale*vy/zoom,scale*(b-5*uy-20*vy))
crop=photo.transform((525,120),Image.Transform.AFFINE,coeff,Image.Resampling.BICUBIC)
sheet=Image.new('RGB',(525,3*148),'#202326')
draw=ImageDraw.Draw(sheet)
for i,rev in enumerate(['archive','v21','v22']):
    top=i*148
    draw.text((8,top+7),'SKTB9 / '+rev,fill='white')
    sheet.paste(crop,(0,top+28))
    if i:
        slices=data['revisions'][rev]['slices']
        for side in ('lo','hi'):
            draw.line([((s['x']+5)*zoom,top+28+(s[side]+20)*zoom) for s in slices],
                      fill='#57deff',width=2)
sheet.save(folder/'SKTB9-breaker.jpg',quality=92)
