import json
from pathlib import Path
from PIL import Image, ImageDraw
d=Path(__file__).resolve().parent
baseline=json.loads((d/'jaw-opening-before.json').read_text())
results=json.loads((d/'jaw-opening.json').read_text())
for id,view in results.items():
    photo=Image.open(d.parents[3]/'mobot-assets/archive'/('1987-'+view['image']+'.jpg'))
    photo=photo.resize((1000,round(photo.height*1000/photo.width)),Image.Resampling.LANCZOS)
    crop=(690,260,965,440) if id=='SKTB2' else (238,440,675,728)
    w,h=crop[2]-crop[0],crop[3]-crop[1]
    panels=[('SKTB',None),('v22 / released',baseline[id]['revisions']['v22']['preset']),
            ('v22 / candidate',view['revisions']['v22']['preset'])]
    sheet=Image.new('RGB',(w*3,h+28),'#191d20')
    for i,(label,model) in enumerate(panels):
        img=photo.copy()
        draw=ImageDraw.Draw(img)
        if model:
            for side in ['right','left']:
                pts=[tuple(p) for p in model[side]]
                draw.line(pts+pts[:1],width=2,fill='#42d6ff')
        for group,color in [('right','#ffd23f'),('left','#8bff8c')]:
            for x,y in view[group]:
                draw.line((x-3,y,x+3,y),fill=color)
                draw.line((x,y-3,x,y+3),fill=color)
        sheet.paste(img.crop(crop),(i*w,28))
        ImageDraw.Draw(sheet).text((i*w+8,6),id+' / '+label,fill='white')
    sheet.save(d/(id+'-opening.jpg'),quality=92)
