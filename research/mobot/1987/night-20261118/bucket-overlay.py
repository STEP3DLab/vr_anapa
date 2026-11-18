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

# Lower cheek, registered by the same two upper/root and front anchors in both panels.
for key, row in json.loads((d/'bucket-heel.json').read_text()).items():
    photo = 'before-dispatch' if key=='SKTB2' else 'snow-side'
    crop = (724,440,955,583) if key=='SKTB2' else (659,452,855,613)
    im = Image.open(d.parents[3]/'mobot-assets/archive'/f'1987-{photo}.jpg')
    scale = im.width/1000
    bounds = tuple(round(x*scale) for x in crop)
    panel = im.crop(bounds).resize(((crop[2]-crop[0])*3,(crop[3]-crop[1])*3),Image.Resampling.LANCZOS)
    w,h=panel.size
    sheet=Image.new('RGB',(2*w,h+30),'#1e2528')
    for i,(name,label) in enumerate([('before','Published v22'),('after','Refitted cheek')]):
        pic=panel.copy(); draw=ImageDraw.Draw(pic)
        point=lambda p: ((p[0]-crop[0])*3,(p[1]-crop[1])*3)
        draw.line([point(p) for p in row[name]['poly']],fill='cyan',width=3)
        for p in row['checks']:
            x,y=point(p); draw.line((x-5,y,x+5,y),fill='orange',width=2);draw.line((x,y-5,x,y+5),fill='orange',width=2)
        for p in [row['root'],row['tip']]:
            x,y=point(p);draw.ellipse((x-5,y-5,x+5,y+5),outline='lime',width=2)
        sheet.paste(pic,(i*w,30))
        ImageDraw.Draw(sheet).text((i*w+10,8),f"{key}  |  {label}  |  RMS {row[name]['rms']:.2f} px  |  cyan: mesh, orange: archive, green: anchors",fill='white')
    sheet.save(d/f'{key}-bucket-heel.jpg',quality=93)

# The actual shaft end and cutting lip are separate from the two points used for fitting.
for key,row in json.loads((d/'loader-witnesses.json').read_text()).items():
    name = 'before-dispatch' if key=='SKTB2' else 'snow-side'
    box = (635,383,998,660) if key=='SKTB2' else (610,390,895,633)
    photo=Image.open(d.parents[3]/'mobot-assets/archive'/f'1987-{name}.jpg')
    photo=photo.resize((1000,round(photo.height*1000/photo.width)),Image.Resampling.LANCZOS)
    w,h=box[2]-box[0],box[3]-box[1]
    sheet=Image.new('RGB',(w*2,h+22),'#1e2528')
    for i,field in enumerate(['reference','fit']):
        state=row[field];panel=photo.copy();draw=ImageDraw.Draw(panel)
        draw.line([tuple(p) for p in state['outline']],fill='cyan',width=2)
        for p in [state['shaftEnd'],state['lip']]:
            x,y=p;draw.ellipse((x-4,y-4,x+4,y+4),outline='magenta',width=2)
        for p in [row['pinMark'],row['lipMark']]:
            if p:
                x,y=p;draw.line((x-5,y,x+5,y),fill='orange',width=2);draw.line((x,y-5,x,y+5),fill='orange',width=2)
        sheet.paste(panel.crop(box),(i*w,22))
        label=field if field!='fit' or key=='SKTB2' else 'fit / rejected'
        ImageDraw.Draw(sheet).text((i*w+5,5),f"{key}  {label}  |  lift {state['bucket']}   tilt {state['tip']}",fill='white')
    sheet.save(d/f'{key}-loader-pose.jpg',quality=93)
