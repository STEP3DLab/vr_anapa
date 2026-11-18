"""Recompute the Batanov series measurement and archive plate with a baseline checkout.

The optional originals directory contains C1-1.jpg, C1-2.jpg and C1-6.jpg as
identified by hash in hanger-source-marks.json. No originals are redistributed.
"""
from pathlib import Path
from itertools import product
import argparse, hashlib, json, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFont

here = Path(__file__).resolve().parent
root = here.parents[3]
out = here/'experiments'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('baseline', type=Path)
parser.add_argument('--originals', type=Path)
args = parser.parse_args()
base = args.baseline.resolve()
module = 'mobot-ch-hv-1986-research-v7-model.js'
before, after = [json.loads(subprocess.check_output(['node', here/'hanger-cage.mjs', *params]))
                 for params in ([str(base/module)], [])]
records = json.loads((out/'hanger-source-marks.json').read_text())
report = {}
for tag, row in records.items():
    if args.originals:
        raw = args.originals/(tag+'.jpg')
        assert hashlib.sha256(raw.read_bytes()).hexdigest() == row['sha256']
        with Image.open(raw) as im:
            assert list(im.size) == row['size']
    pin, collar, traverse = [row['readings'][key] for key in ('pin','collar','traverse')]
    def fraction(p, c, t):
        return (t-c)/(t-p)
    photo = fraction(pin[1],collar[1],traverse[1])
    limits = [fraction(*(p[1]+s*p[2] for s,p in zip(signs,(pin,collar,traverse))))
              for signs in product((-1,1),repeat=3)]
    report[tag] = dict(role=row['role'],photo=round(photo,4),readingRange=[round(min(limits),4),round(max(limits),4)],
                       absoluteErrorBeforeAfter=[round(abs(x['openFraction']-photo),4) for x in (before,after)])
    assert min(limits) <= after['openFraction'] <= max(limits)
    assert before['openFraction'] < min(limits)
font = ImageFont.truetype('DejaVuSans.ttf',19)
plate = Image.new('RGB',(1128,786),'#f5f5ef')
draw = ImageDraw.Draw(plate)
marks = json.loads((here/'landmarks.json').read_text())
with tempfile.TemporaryDirectory() as temp:
    for i,(fig,box) in enumerate([('fig6',(190,218,414,514)),('fig9',(116,32,362,390))]):
        target = marks[fig]['grapple']['top'][:2]
        for j,variant in enumerate(['архив','до','после']):
            region = box
            if j == 0:
                im = Image.open(root/marks[fig]['image'])
            else:
                source = base/here.relative_to(root) if j == 1 else here
                image = Path(temp)/'view.ppm'
                points = Path(temp)/'points.json'
                subprocess.run(['node', source/'photo-render.mjs', here/'registration/registration.json',fig,
                                'v7',image,points],check=True)
                im = Image.open(image)
                xy = json.loads(points.read_text())['top']
                dx,dy = (round(v-t) for v,t in zip(xy,target))
                region = (box[0]+dx,box[1]+dy,box[2]+dx,box[3]+dy)
            # The previous registered pose places the pin near the image boundary.
            # Keep the renderer background for the part of a translated crop outside it.
            tile = Image.new('RGB',(region[2]-region[0],region[3]-region[1]),(231,235,227))
            tile.paste(im,(-region[0],-region[1]))
            tile.thumbnail((352,319),Image.Resampling.LANCZOS)
            x,y=j*376,i*366
            draw.text((x+15,y+6),f'Рис. {fig[3:]}  ·  {variant}',fill='#273832',font=font)
            plate.paste(tile,(x+(376-tile.width)//2,y+40))
draw.text((16,744),'Кропы совмещены по верхней траверсе грейфера. Масштаб внутри ряда одинаков.',fill='#273832',font=font)
plate.save(out/'hanger-cage.jpg',quality=92)
data = dict(baseline='206565902b72efa4ca635111571b3b87754293b3',comparison='visible outer rod span / pin-to-upper-traverse height',
            marks=report,before=before,after=after,geometry='C',status='PASS')
(out/'hanger-cage.json').write_text(json.dumps(data,indent=2)+'\n')
