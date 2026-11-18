"""Compare actual rear wheel renders against archive crops. Argument is the baseline checkout."""
import argparse
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

here = Path(__file__).resolve().parent
root = here.parents[3]
p = argparse.ArgumentParser()
p.add_argument('baseline_root', type=Path)
args = p.parse_args()
before = args.baseline_root.resolve()/here.relative_to(root)
views = json.loads((here/'registration/registration.json').read_text())['views']
anchors = json.loads(subprocess.check_output(['node',here/'anchors.mjs','v7']))
# Face centres independently reread on both archive crops, plus elliptical sampling radii.
spec = {'fig6':{'rear':[284,803,34,42],'road':[347,920,24,31],
                'hubs':[[347,920],[417,932],[477,941],[552,954],[621,972],[700,982],[775,995]],
                'front':[902,868], 'crop':[225,723,976,1040]},
        'fig9':{'rear':[820,867,19,32],'road':[777,950,13,20],
                'hubs':[[777,950],[744,961],[698,961],[664,958]],'front':None,
                'crop':[375,741,864,1008]}}
font=ImageFont.truetype('DejaVuSans.ttf',17)
plate=Image.new('RGB',(1200,515),'#f8f7f2')
draw=ImageDraw.Draw(plate)
def median(im,ellipse,offset=(0,0)):
    x,y,rx,ry=ellipse
    yy,xx=np.ogrid[:im.height,:im.width]
    r=((xx-x-offset[0])/rx)**2+((yy-y-offset[1])/ry)**2
    return float(np.median(np.asarray(im.convert('L'))[(r>=.43**2)&(r<=.7**2)]))

def contrast(im,rear,road,offset=(0,0)):
    a,b=median(im,rear,offset),median(im,road,offset)
    return (a-b)/(a+b)

report={}
with tempfile.TemporaryDirectory() as d:
    for i,(fig,item) in enumerate(spec.items()):
        cam=views[fig]['camera']
        a,e,r=np.radians([cam[k] for k in ('azimuth','elevation','roll')])
        basis=np.array([[np.cos(a),0,-np.sin(a)],[-np.sin(a)*np.sin(e),np.cos(e),-np.cos(a)*np.sin(e)]])
        mat=cam['pxPerSceneUnit']*np.array([[np.cos(r),-np.sin(r)],[-np.sin(r),-np.cos(r)]])@basis
        xy={k:mat@v+[cam['cx'],cam['cy']] for k,v in anchors[fig].items()}
        photo=Image.open(root/f'mobot-assets/archive/1986-{fig}.png').convert('RGB')
        images=[photo]
        for j,source in enumerate([before,here]):
            path=Path(d)/f'{fig}-{j}.ppm'
            subprocess.run(['node',source/'photo-render.mjs',here/'registration/registration.json',fig,'v7',path],check=True)
            images.append(Image.open(path).convert('RGB'))
        values=[]
        for j,im in enumerate(images):
            rear,road=item['rear'],item['road']
            if j:
                rear=[*xy['endRear'],*rear[2:]];road=[*xy['road0'],*road[2:]]
            values.append(contrast(im,rear,road))
            tile=ImageOps.contain(im.crop(item['crop']),(392,206),Image.Resampling.LANCZOS)
            x,y=j*400,i*244
            draw.text((x+12,y+9),f'Рис. {fig[3:]}  ·  '+['архив','до','после'][j],font=font,fill='#272821')
            plate.paste(tile,(x+(400-tile.width)//2,y+37))
        nearby=[contrast(photo,item['rear'],item['road'],(x,y)) for x in (-4,0,4) for y in (-4,0,4)]
        observed={f'road{k}':v for k,v in enumerate(item['hubs'])}
        observed['endRear']=item['rear'][:2]
        if item['front']:observed['endFront']=item['front']
        report[fig]=dict(archiveSamples=item,photoBeforeAfter=np.round(values,4).tolist(),
            photoShift4pxRange=np.round([min(nearby),max(nearby)],4).tolist(),
            absoluteErrorBeforeAfter=np.round(np.abs(np.array(values[1:])-values[0]),4).tolist(),
            centreResidualPx={k:round(np.linalg.norm(xy[k]-v),2) for k,v in observed.items()})
draw.text((12,486),'Одинаковая камера и масштаб для обеих версий модели в каждом ракурсе.',font=font,fill='#272821')
plate.save(here/'experiments/track-photo.jpg',quality=88)
(here/'experiments/track-photo.json').write_text(json.dumps(report,indent=2)+'\n')
assert all(x['absoluteErrorBeforeAfter'][1]<x['absoluteErrorBeforeAfter'][0] for x in report.values())
