from pathlib import Path
from PIL import Image,ImageDraw
import json
d=Path(__file__).resolve().parent
for key,v in json.loads((d/'boom-pose.json').read_text()).items():
    name={'SKTB2':'before-dispatch','SKTB4':'snow-side'}[key]
    im=Image.open(d.parents[3]/'mobot-assets/archive'/('1987-'+name+'.jpg'))
    im=im.resize((1000,round(im.height*1000/im.width)),Image.Resampling.LANCZOS)
    crop=(330,50,912,392) if key=='SKTB2' else (48,50,630,392)
    sheet=Image.new('RGB',(1164,370),'#1c2022')
    for i,(label,row) in enumerate([('preset',v['preset']),('rail angle fit',v['slopeFit'])]):
        pic=im.copy(); draw=ImageDraw.Draw(pic)
        draw.line([tuple(x) for x in v['rail']],fill='orange',width=3)
        draw.line([tuple(x) for x in row['rail']],fill='cyan',width=2)
        draw.line([tuple(row['proximal']),tuple(row['tip'])],fill='#a4d8ff')
        for pt,color in [(v['pin'],'lime'),(row['tip'],'cyan')]:
            x,y=pt;draw.ellipse((x-5,y-5,x+5,y+5),outline=color,width=2)
        sheet.paste(pic.crop(crop),(i*582,28))
        ImageDraw.Draw(sheet).text((i*582+7,6),key+' / '+label+'   orange: observed direction   cyan: model   green: withheld pin',fill='white')
    sheet.save(d/(key+'-boom-pose.jpg'),quality=91)
