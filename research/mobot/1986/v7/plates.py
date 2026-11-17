from pathlib import Path
import argparse
import json
import subprocess
import tempfile
from PIL import Image, ImageDraw, ImageFont, ImageOps
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
parser=argparse.ArgumentParser()
parser.add_argument('--out',type=Path,required=True)
parser.add_argument('--registration',type=Path,required=True)
args=parser.parse_args();args.out.mkdir(parents=True,exist_ok=True)
data=json.loads((HERE/'landmarks.json').read_text())
font=ImageFont.truetype('DejaVuSans.ttf',22)
headers=['Архив','v6','v7']
def create_plate(tmp,detail):
    tw,th=(330,305) if detail else (380,380)
    plate=Image.new('RGB',(3*tw+24,2*(th+38)+12),'#f7f6f1');draw=ImageDraw.Draw(plate)
    for row,key in enumerate(('fig6','fig9')):
        source=Image.open(ROOT/data[key]['image']).convert('RGB')
        for col,image in enumerate([source,Image.open(tmp/(key+'-v6.ppm')),Image.open(tmp/(key+'-v7.ppm'))]):
            if detail:
                x0,y0,x1,y1=data[key]['crop']
                if col:
                    # Translate the crop only, keeping the chassis-derived pixel scale.
                    anchor=json.loads((tmp/(key+'-'+headers[col]+'.json')).read_text())['top']
                    tx,ty=data[key]['grapple']['top'][:2]
                    dx,dy=round(anchor[0]-tx),round(anchor[1]-ty)
                    x0+=dx;x1+=dx;y0+=dy;y1+=dy
                image=image.crop((x0,y0,x1,y1))
            tile=ImageOps.contain(image,(tw-6,th),Image.Resampling.LANCZOS);left=8+col*tw;y=6+row*(th+38)
            draw.text((left,y),'Рис. '+key[3:]+'  /  '+headers[col],font=font,fill='#233c32')
            plate.paste(tile,(left+(tw-tile.width)//2,y+32+(th-tile.height)//2))
    plate.save(args.out/('comparison.jpg' if detail else 'whole-machine.jpg'),quality=88)
with tempfile.TemporaryDirectory() as temp:
    tmp=Path(temp)
    for key in ('fig6','fig9'):
        for v in ('v6','v7'):
            subprocess.run(['node',str(HERE/'photo-render.mjs'),str(args.registration),key,v,str(tmp/(key+'-'+v+'.ppm')),str(tmp/(key+'-'+v+'.json'))],cwd=ROOT,check=True)
    for detail in (True,False):create_plate(tmp,detail)
