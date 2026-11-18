"""Use public archive photos by default. An optional local P014 original stays outside Git."""
import argparse,json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageOps
d=Path(__file__).resolve().parent
parser=argparse.ArgumentParser()
parser.add_argument('--private-scan',type=Path)
parser.add_argument('--output',type=Path)
args=parser.parse_args()
if bool(args.private_scan)!=bool(args.output):
    parser.error('Set both the private source and a separate output directory')
if args.output and (args.output.resolve()==d or d in args.output.resolve().parents):
    parser.error('Private scan panels belong outside the repository')
data=json.loads((d/'batanov-lift-result.json').read_text())
assets=d.parents[3]/'mobot-assets'/'archive'
font=ImageFont.truetype('DejaVuSans.ttf',16)
bold=ImageFont.truetype('DejaVuSans-Bold.ttf',19)
for key,area,filename in [('SKTB2',(239,427,999,700),'1987-before-dispatch.jpg'),('P014',(284,339,999,719),None),('SKTB4',(245,374,926,652),'1987-snow-side.jpg')]:
    src=assets/filename if filename else args.private_scan
    target=(args.output or d)/f'{key}-batanov-lift.jpg'
    if src:
        with Image.open(src) as original:
            base=ImageOps.grayscale(original.resize((1000,round(1000*original.height/original.width)))).convert('RGB')
    else:
        base=Image.new('RGB',(1000,800),(36,41,49))
        g=ImageDraw.Draw(base)
        for x in range(0,1000,25):g.line((x,0,x,800),fill=(50,57,63))
        for y in range(0,800,25):g.line((0,y,1000,y),fill=(50,57,63))
    points=data['views'][key];bucket=data['bucket']['views'][key]
    a,b,c,e=area;w=c-a;h=e-b
    sheet=Image.new('RGB',(w,2*h+125),(246,247,246))
    title={'SKTB2':'СКТБ №2 · построение','P014':'Стр. 14 · поднятый ковш','SKTB4':'СКТБ №4 · снежный вид'}[key]
    g=ImageDraw.Draw(sheet);g.text((12,6),title,font=bold,fill='#13232b')
    g.text((12,33),'Белый крест — отметка оси. Жёлтые кольца — нижний контур на фото.',font=font,fill='#23333b')
    for j,(tag,color,label) in enumerate([('published','#ff9564','Опубликованная v22'),('trial','#69deed','Опытная сборка')]):
        im=base.copy();dr=ImageDraw.Draw(im)
        geom=points[tag];side=bucket[tag]
        dr.line([tuple(geom['pivot']),tuple(geom['shaft'])],fill=color,width=3)
        for x,y in [geom['pivot'],geom['shaft']]:dr.ellipse((x-5,y-5,x+5,y+5),outline=color,width=3)
        dr.line([tuple(p) for p in side['poly']],fill=color,width=3)
        if side['lipError'] is not None:
            x,y=side['lip'];dr.rectangle((x-3,y-3,x+3,y+3),outline=color,width=2)
        for xy in points['measured'].values():
            if xy is not None:
                x,y=xy;dr.line((x-7,y,x+7,y),fill='black',width=5);dr.line((x,y-7,x,y+7),fill='black',width=5)
                dr.line((x-7,y,x+7,y),fill='white',width=2);dr.line((x,y-7,x,y+7),fill='white',width=2)
        for x,y in bucket['checks']:dr.ellipse((x-2,y-2,x+2,y+2),outline='#ffd237',width=2)
        y0=60+j*(h+30)
        g.text((12,y0),f"{label} · RMS нижнего контура {side['lowerRms']:.1f} px",font=font,fill='#172e39')
        sheet.paste(im.crop(area),(0,y0+23))
    sheet.save(target,quality=90,optimize=True)
