"""Compare the archive buttons; assess perspective on wheel centres reserved from fitting."""
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps
from scipy.optimize import least_squares

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
OUT=HERE/'experiments'
def read(path):
    return json.loads(path.read_text())
views=read(HERE/'landmarks.json')
tracks=read(OUT/'track-photo.json')
registration=read(HERE/'registration/registration.json')['views']
world=json.loads(subprocess.check_output(['node',HERE/'anchors.mjs','v7']))
plate=Image.new('RGB',(1170,830),'#f8f7f2')
draw=ImageDraw.Draw(plate)
font=ImageFont.truetype('DejaVuSans.ttf',17)
report={}
for row,fig in enumerate(('fig6','fig9')):
    view=views[fig]
    centre=np.array(view['size'])/2
    samples=tracks[fig]['archiveSamples']
    marks=dict(view['landmarks'])
    marks.update(endRear=[*samples['rear'][:2],12],road0=[*samples['hubs'][0],12])
    if samples['front']:marks['endFront']=[*samples['front'],14]
    train=['endRear','endFront','road0','lampNear','lampFar']
    hold=[f'road{i}' for i in range(1,len(samples['hubs']))]
    for key,v in zip(hold,samples['hubs'][1:]):marks[key]=[*v,14]
    xyz=world[fig]
    def proj(keys,p,dist):
        a,e,r=np.radians(p[:3])
        right=np.array([np.cos(a),0,-np.sin(a)])
        up=np.array([-np.sin(a)*np.sin(e),np.cos(e),-np.cos(a)*np.sin(e)])
        points=np.array([xyz[k] for k in keys])
        uv=np.column_stack((points@right,points@up))@np.array([[np.cos(r),-np.sin(r)],[-np.sin(r),-np.cos(r)]])
        depth=points@np.cross(right,up)
        return centre+(p[3]*uv+p[4:]-centre)/(1-depth[:,None]/dist)
    initial=list(registration[fig]['camera'].values())
    a,b=(2,85) if fig=='fig6' else (90,179)
    def fit(keys,dist):
        obs=np.array([marks[k] for k in keys])
        return least_squares(lambda p:((proj(keys,p,dist)-obs[:,:2])/obs[:,2:]).ravel(),initial,
            bounds=([a,0,-15,80,-500,0],[b,50,15,1100,2000,1900]),loss='soft_l1').x
    def residuals(keys,p,dist):
        return np.linalg.norm(proj(keys,p,dist)-np.array([marks[k][:2] for k in keys]),axis=1)
    trials=[]
    for dist in [np.inf,16,10,7,5,4]:
        p=fit(train,dist)
        loo=[residuals([k],fit([v for v in train if v!=k],dist),dist)[0] for k in train]
        trials.append(dict(distance=None if np.isinf(dist) else dist,leaveOneOutMeanPx=round(np.mean(loo),2),
            wheelControlMeanPx=round(residuals(hold,p,dist).mean(),2),
            hoodControlPx=round(residuals(['hood'],p,dist)[0],2),wheelErrors=residuals(hold,p,dist).round(2).tolist()))
    best=min(trials,key=lambda r:r['leaveOneOutMeanPx'])
    results={'training':train,'wheelControls':hold,'trials':trials,'selectedDistance':best['distance'],
             'publishedWheelControlMeanPx':round(residuals(hold,initial,np.inf).mean(),2)}
    keys=['endRear','endFront']+['road'+str(i) for i in range(len(samples['hubs']))]
    reference=proj(keys,initial,np.inf)
    photo=Image.open(ROOT/view['image']).convert('RGB')
    with tempfile.TemporaryDirectory() as tmp:
        images=[photo]
        for control in ['previous','registered']:
            ppm=Path(tmp)/(control+'.ppm');anchors=Path(tmp)/(control+'.json')
            subprocess.run(['node',HERE/'photo-render.mjs',HERE/'registration/registration.json',fig,'v7',ppm,anchors,control],check=True)
            hubs=read(anchors)['hubs']
            xy=np.array([hubs[7],hubs[8],*hubs[:len(samples['hubs'])]])
            results[control+'RegistrationRmsPx']=round(np.sqrt(np.mean(np.sum((xy-reference)**2,axis=1))),4)
            results[control+'ArchiveWheelMeanPx']=round(np.linalg.norm(xy[2:]-samples['hubs'],axis=1).mean(),2)
            images.append(Image.open(ppm).convert('RGB'))
        for j,img in enumerate(images):
            tile=ImageOps.contain(img,(378,361),Image.Resampling.LANCZOS)
            x,y=j*390,row*409
            draw.text((x+12,y+8),'Рис. '+fig[3:]+'  ·  '+['архив','прежний вид в окне','вид по регистрации'][j],font=font,fill='#25372d')
            plate.paste(tile,(x+(390-tile.width)//2,y+36+(361-tile.height)//2))
    report[fig]=results
plate.save(OUT/'control-views.jpg',quality=87)
(OUT/'control-views.json').write_text(json.dumps(report,indent=2)+'\n')
assert all(r['registeredRegistrationRmsPx']<.01 for r in report.values())
