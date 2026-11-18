from pathlib import Path
import json
from PIL import Image,ImageDraw
folder=Path(__file__).resolve().parent
for key,v in json.loads((folder/'jaw-profile.json').read_text()).items():
    im=Image.open(folder.parents[3]/'mobot-assets/archive'/('1987-'+v['file']+'.jpg'))
    im=im.resize((1000,round(im.height*1000/im.width)),Image.Resampling.LANCZOS)
    bounds=(730,248,955,418) if key=='SKTB2' else (315,495,660,708)
    w,h=bounds[2]-bounds[0],bounds[3]-bounds[1]
    sheet=Image.new('RGB',(w*3,h+24),'#171a20')
    for i,rev in enumerate(['archive','v21','v22']):
        panel=im.copy()
        draw=ImageDraw.Draw(panel)
        if i:
            p=[tuple(q) for q in v['revisions'][rev]['polygon']]
            draw.line(p+p[:1],fill='#4ad5ff',width=2)
        for coords,color in [(v['fit'],'#efbc43'),(v['test'],'#99ff80')]:
            for x,y in coords:
                draw.line((x-3,y,x+3,y),fill=color)
                draw.line((x,y-3,x,y+3),fill=color)
        sheet.paste(panel.crop(bounds),(w*i,24))
        ImageDraw.Draw(sheet).text((w*i+6,5),key+' / '+rev,fill='white')
    sheet.save(folder/(key+'-jaw.jpg'),quality=92)
