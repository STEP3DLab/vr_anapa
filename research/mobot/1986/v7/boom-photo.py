"""Test yaw ambiguity and a common mast-height correction with frozen chassis cameras."""
import importlib.util
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy.optimize import least_squares
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
spec = importlib.util.spec_from_file_location('registration', HERE/'archive-fit.py')
registration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(registration)
world = json.loads(subprocess.check_output(['node', HERE/'boom-anchors.mjs']))
views = json.loads((HERE/'registration/registration.json').read_text())['views']
photos = json.loads((HERE/'landmarks.json').read_text())
# Mid levels of the visible end bands (not centres of obscured shafts).
marks = {
    'fig6': {'upper':[710,915,377,22], 'lower':[695,892,718,16], 'heel':[746,390,32]},
    'fig9': {'upper':[478,659,474,32], 'lower':[414,594,706,22], 'heel':[510,486,44]},
}
origin = np.array(world['origin'])
heel = np.array(world['heel'])
tip = np.array(world['nose']) - heel
posts = np.array(world['posts'])
foot = posts[0,0,1]


def projected(figure, yaw, lift, height):
    a,b = np.radians([yaw,lift])
    pivot = heel.copy()
    pivot[1] = foot+height*(pivot[1]-foot)
    nose = pivot + [tip[0]*np.cos(b)+tip[1]*np.sin(b),
                    -tip[0]*np.sin(b)+tip[1]*np.cos(b),0]
    ends = posts.copy()
    ends[:,:,1] = foot+height*(posts[:,:,1]-foot)
    points = np.vstack([nose,pivot,ends.reshape(-1,3)])
    rotation = np.array([[np.cos(a),0,-np.sin(a)],[0,1,0],[np.sin(a),0,np.cos(a)]])
    cam = views[figure]['camera']
    p = np.array([cam[k] for k in ('azimuth','elevation','roll','pxPerSceneUnit','cx','cy')])
    return registration.project(points@rotation+origin,p)


def trial(figure,height):
    data = marks[figure]
    target = np.array(photos[figure]['nose'][:2])
    # Explore both sides of the camera ray, with multiple starting angles.
    solutions = []
    for init in range(-165,180,30):
        fit = least_squares(lambda pose: projected(figure,*pose,height)[0]-target,
                            [init,12], bounds=([-180,0],[180,32]))
        xy = projected(figure,*fit.x,height)
        nose_error = np.linalg.norm(xy[0]-target)
        if any(np.linalg.norm(fit.x-np.array(v['angles']))<.1 for v in solutions):
            continue
        upper,lower = xy[3::2],xy[2::2]
        h = lower[:,1].mean()-upper[:,1].mean()
        solutions.append(dict(angles=fit.x.round(3).tolist(),nosePx=round(nose_error,2),
            heelPx=round(np.linalg.norm(xy[1]-data['heel'][:2]),2),
            heightResidualPx=round(h-(data['lower'][2]-data['upper'][2]),2),
            projectedHeightPx=round(h,2),
            topWidthResidualPx=round(np.ptp(upper[:,0])-(data['upper'][1]-data['upper'][0]),2)))
    # Resolve near-ties by the sum of squared errors in reading-radius units.
    def score(s):
        return (s['nosePx']/photos[figure]['nose'][2])**2 + (s['heelPx']/data['heel'][2])**2
    return {'selected':min(solutions,key=score), 'solutions':solutions}


baseline = {f:trial(f,1) for f in marks}
# Select height solely on figure 6 relative height; reserve figure 9 for veto.
h6 = marks['fig6']['lower'][2]-marks['fig6']['upper'][2]
factor = h6/baseline['fig6']['selected']['projectedHeightPx']
candidate = {f:trial(f,factor) for f in marks}
report = {'baseHeightScale':1,'candidateHeightScale':factor,'bands':marks,
          'baseline':baseline,'candidate':candidate}
out = HERE/'experiments'
(out/'boom-photo.json').write_text(json.dumps(report,indent=2)+'\n')
plate = Image.new('RGB',(900,860),'white')
for row,figure in enumerate(marks):
    for col,(scale,result) in enumerate([(1,baseline),(factor,candidate)]):
        source = Image.open(ROOT/photos[figure]['image']).convert('RGB')
        draw = ImageDraw.Draw(source)
        for key in ['upper','lower']:
            x0,x1,y,r=marks[figure][key]
            draw.rectangle((x0,y-r,x1,y+r),outline='#24ae55',width=3)
        x,y,r=marks[figure]['heel']
        draw.ellipse((x-r,y-r,x+r,y+r),outline='#24ae55',width=3)
        xy=projected(figure,*result[figure]['selected']['angles'],scale)
        for a,b in zip(xy[2::2],xy[3::2]):
            draw.line([tuple(a),tuple(b)],fill='#0077e0',width=4)
        draw.line([tuple(xy[0]),tuple(xy[1])],fill='#ef6600',width=4)
        box=(525,280,1000,790) if figure=='fig6' else (290,370,725,790)
        tile=source.crop(box);tile.thumbnail((450,404))
        plate.paste(tile,(col*450,row*430+26))
        ImageDraw.Draw(plate).text((col*450+10,row*430+5),
            figure+' / mast height x '+format(scale,'.3f'),fill='black')
plate.save(out/'boom-photo.jpg',quality=85)
