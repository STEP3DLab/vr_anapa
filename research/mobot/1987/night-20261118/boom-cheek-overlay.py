from pathlib import Path
from PIL import Image,ImageDraw
import json
d=Path(__file__).resolve().parent
for id,v in json.loads((d/'boom-cheek.json').read_text()).items():
    photo=Image.open(d.parents[3]/'mobot-assets/archive'/('1987-'+v['file']+'.jpg'))
    photo=photo.resize((1000,round(photo.height*1000/photo.width)),Image.Resampling.LANCZOS)
    crop=(680,68,880,218) if id=='SKTB2' else (64,52,264,202)
    sheet=Image.new('RGB',(1200,330),'#1d2226')
    for i,k in enumerate(['archive','before','after']):
        img=photo.copy();draw=ImageDraw.Draw(img)
        if k!='archive':
            poly=list(map(tuple,v[k]['poly']))
            draw.line(poly+poly[:1],fill='#49d6ff',width=1)
            x,y=v['pin'];r=v[k]['capRadius']
            draw.ellipse((x-r,y-r,x+r,y+r),outline='#49d6ff')
        for p in v['checks']:
            x,y=p;draw.line((x-2,y,x+2,y),fill='#90ff80')
            draw.line((x,y-2,x,y+2),fill='#90ff80')
        for x,y in [v['pin'],v['root']]:
            draw.ellipse((x-2,y-2,x+2,y+2),outline='orange')
        sheet.paste(img.crop(crop).resize((400,300),Image.Resampling.BICUBIC),(i*400,30))
        ImageDraw.Draw(sheet).text((i*400+8,8),id+' / '+k,fill='white')
    sheet.save(d/(id+'-boom-cheek.jpg'),quality=93)
