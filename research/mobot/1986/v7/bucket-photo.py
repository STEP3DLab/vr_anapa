"""Fixed-chassis test for the cutting edge, upper rail and near cheek of the 1986 scoop."""
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
OUT = HERE/'experiments'
mesh = json.loads(subprocess.check_output(['node', HERE/'bucket-anchors.mjs']))
views = json.loads((HERE/'registration/registration.json').read_text())['views']
cheeks = np.array(mesh['cheeks'])
lip = np.array(mesh['lip'])
# Archive crop pixels. Endpoints in left-to-right order, same radius for each end.
marks = {'fig6': {'lip': ([[1298,1104],[1398,948]],10),
                  'rail': ([[1060,873],[1215,776]],9)},
         'fig9': {'rail': ([[34,828],[338,906]],10)}}
near6 = {'heel':[1060,873],'front':[1281,1085],'knee':[1202,945]}
poses = np.array([p['matrix'] for p in mesh['poses']]).reshape(-1,4,4).transpose(0,2,1)


def camera(fig):
    c = views[fig]['camera']
    a,e,r = np.radians([c['azimuth'],c['elevation'],c['roll']])
    basis = [[np.cos(a),0,-np.sin(a)],[-np.sin(a)*np.sin(e),np.cos(e),-np.cos(a)*np.sin(e)]]
    return c['pxPerSceneUnit']*np.array([[np.cos(r),-np.sin(r)],[-np.sin(r),-np.cos(r)]])@basis


def xy(local,fig):
    h = np.column_stack([local,np.ones(len(local))])
    return (poses@h.T)[:,:3,:].transpose(0,2,1)@camera(fig).T


def edge_vector(fig,name):
    local = lip if name=='lip' else cheeks[:,0,:]
    vectors = np.diff(xy(local,fig),axis=1)[:,0,:]
    assert np.max(np.abs(vectors-vectors[0]))<1e-9
    return vectors[0]*np.sign(vectors[0,0])


def measured(points):
    return np.diff(points,axis=0)[0]


base = edge_vector('fig6','lip')
obs = measured(marks['fig6']['lip'][0])
factor = np.dot(obs,base)/np.dot(base,base)
report = {'fit':'fig6 cutting edge vector only','factor':factor,'posesChecked':len(poses),'edges':{}}
plate = Image.new('RGB',(1000,795),'#f8f7f2')
font=ImageFont.truetype('DejaVuSans.ttf',16)
for row,fig in enumerate(marks):
    crop = (925,735,1445,1135) if fig=='fig6' else (0,775,475,1150)
    panels=[]
    for col,scale in enumerate([1,factor]):
        im=Image.open(ROOT/f'mobot-assets/archive/1986-{fig}.png').convert('RGB')
        draw=ImageDraw.Draw(im)
        for name,(pts,radius) in marks[fig].items():
            vector=edge_vector(fig,name)
            target=measured(pts)
            fit=vector*scale
            entry=report['edges'].setdefault(fig+'-'+name,{'endpoints':pts,'radiusEachPx':radius,
                'scaleFromXandY':np.round(target/vector,3).tolist()})
            # Maximum angle change for a segment whose endpoints can each move in a disk.
            direction=np.degrees(np.arctan2(target[1],target[0]))
            spread=np.degrees(np.arcsin(2*radius/np.linalg.norm(target)))
            entry['photoAngleBoundsDeg']=np.round([direction-spread,direction+spread],2).tolist()
            entry['baseline' if col==0 else 'trial']={'vectorPx':fit.round(2).tolist(),
                'vectorResidualPx':round(np.linalg.norm(fit-target),2),
                'errorXY':(fit-target).round(2).tolist()}
            p=np.array(pts[0]);draw.line([tuple(p),tuple(pts[1])],fill='#ffd000',width=3)
            for x,y in pts:
                draw.ellipse((x-radius,y-radius,x+radius,y+radius),outline='#ffd000',width=2)
            draw.line([tuple(p),tuple(p+fit)],fill='#00a0b5',width=4)
        if fig=='fig6':
            # Fit the side's root-to-front chord independently of its intermediate knee.
            # Whole-width change cannot affect this single plane after translating the root.
            cheek=xy(cheeks[1],fig)
            relative=cheek-cheek[:,0:1,:]
            chord=np.array(near6['front'])-near6['heel']
            errors=np.linalg.norm(relative[:,4,:]-chord,axis=1)
            i=int(np.argmin(errors)); outline=relative[i]+near6['heel']
            detail=mesh['poses'][i]
            report['cheekFig6']={'landmarks':near6,'radiusEachPx':12,'bestLiftTipOnGrid':[detail['lift'],detail['tip']],
                'frontErrorPx':round(errors[i],2),'heldOutKneeErrorPx':round(np.linalg.norm(outline[2]-near6['knee']),2),
                'observedReachDropPx':chord.tolist(),'projectedReachDropPx':relative[i,4].round(2).tolist()}
            draw.line([tuple(p) for p in np.vstack([outline,outline[:1]])],fill='#ed7131',width=2)
            x,y=near6['knee'];draw.ellipse((x-12,y-12,x+12,y+12),outline='#ffd000',width=2)
        tile=im.crop(crop); tile.thumbnail((495,357))
        x,y=500*col,390*row
        plate.paste(tile,(x+(500-tile.width)//2,y+34))
        ImageDraw.Draw(plate).text((x+14,y+6),f'Рис. {fig[3:]}   /   ширина × {scale:.3f}',font=font,fill='#26251f')
ImageDraw.Draw(plate).text((15,770),'Жёлтый — фото и допуск чтения     Голубой — модель     Оранжевый — профиль ближней боковины',font=font,fill='#26251f')
plate.save(OUT/'bucket-photo.jpg',quality=84)
(OUT/'bucket-photo.json').write_text(json.dumps(report,indent=2)+'\n')
