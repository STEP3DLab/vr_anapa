"""Rebuild the side-by-side crops from original archival pixels and projected mesh edges."""
from pathlib import Path
import json
from PIL import Image,ImageDraw

d=Path(__file__).resolve().parent
views=json.loads((d/'hood-views.json').read_text())
results=json.loads((d/'hood-results.json').read_text())
for key,view in results.items():
    info=views[key]
    photo=Image.open(d.parents[3]/'mobot-assets/archive'/('1987-'+info['source']+'.jpg'))
    photo=photo.resize((1000,info['imageHeight']),Image.Resampling.LANCZOS)
    crop=(65,395,405,565) if key=='SKTB2' else (90,302,410,472)
    w,h=crop[2]-crop[0],crop[3]-crop[1]
    sheet=Image.new('RGB',(3*w, h+30),'#1d2023')
    for i,rev in enumerate(['archive','v21','v22']):
        pane=photo.copy()
        draw=ImageDraw.Draw(pane)
        if i:
            draw.line([tuple(p) for p in view['revisions'][rev]['edge']],fill='#46d4ff',width=2)
        for x,y in info['samples']:
            draw.line((x-3,y,x+3,y),fill='#ffbf32')
            draw.line((x,y-3,x,y+3),fill='#ffbf32')
        sheet.paste(pane.crop(crop),(i*w,30))
        ImageDraw.Draw(sheet).text((i*w+8,8),key+' / '+rev,fill='white')
    sheet.save(d/(key+'-hood.jpg'),quality=92)
