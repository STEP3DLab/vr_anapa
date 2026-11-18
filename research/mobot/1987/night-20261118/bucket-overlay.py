from pathlib import Path
import json
from PIL import Image, ImageDraw
d = Path(__file__).resolve().parent
before, after = [json.loads((d/f'bucket-cheek{s}.json').read_text()) for s in ('-before','')]
for key, photo, crop in [('SKTB2','before-dispatch',(635,382,998,620)),('SKTB4','snow-side',(625,380,915,639))]:
    im = Image.open(d.parents[3]/'mobot-assets/archive'/f'1987-{photo}.jpg')
    im = im.resize((1000, round(im.height*1000/im.width)), Image.Resampling.LANCZOS)
    panels = []
    for text, row, field in [('deck camera',after[key],'raw'),('local / before',before[key],'poly'),('local / candidate',after[key],'poly')]:
        pic = im.copy()
        pen = ImageDraw.Draw(pic)
        pts = [tuple(p) for p in row[field]]
        pen.line(pts + pts[:1],fill='cyan',width=2)
        for x,y in row['upper']:
            pen.ellipse((x-2,y-2,x+2,y+2),fill='orange')
        for x,y in [row['root'],row['tip']]:pen.ellipse((x-4,y-4,x+4,y+4),outline='lime',width=2)
        panel=pic.crop(crop)
        ImageDraw.Draw(panel).text((6,6),key+' / '+text,fill='white',stroke_width=1,stroke_fill='black')
        panels.append(panel)
    w,h=panels[0].size
    sheet=Image.new('RGB',(w*3,h))
    for i,p in enumerate(panels):sheet.paste(p,(i*w,0))
    sheet.save(d/f'{key}-bucket.jpg',quality=93)
