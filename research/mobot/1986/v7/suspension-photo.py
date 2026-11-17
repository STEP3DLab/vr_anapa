"""Profile camera distance using rigid anchors; reserve grapple top for checking the pose."""
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.optimize import least_squares

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
OUT = HERE / 'experiments'
observations = json.loads((HERE / 'landmarks.json').read_text())
world = json.loads(subprocess.check_output(['node', HERE / 'anchors.mjs', 'v7']))
# Alternative reading of the overlapped hardware patch, not an identified pin.
patches = {'fig6': [298, 315, 35], 'fig9': [263, 132, 35]}


def project(points, p, distance, centre):
    az, el, roll = np.radians(p[:3])
    right = np.array([np.cos(az), 0, -np.sin(az)])
    up = np.array([-np.sin(az)*np.sin(el), np.cos(el), -np.cos(az)*np.sin(el)])
    depth = points @ np.cross(right, up)
    xy = np.column_stack([points @ right, points @ up])
    c, s = np.cos(roll), np.sin(roll)
    offset = p[3]*xy @ np.array([[c, -s], [-s, -c]]) + p[4:] - centre
    return centre + offset / (1-depth[:, None]/distance)


def pin(angles):
    yaw, lift = np.radians(angles)
    x = -.132 - 1.49*np.cos(lift) + .30*np.sin(lift)
    y = 1.79 + 1.49*np.sin(lift) + .30*np.cos(lift)
    return np.array([.29+x*np.cos(yaw), y, -x*np.sin(yaw)])


report = {}
tiles = []
for figure, patch in patches.items():
    data = observations[figure]
    anchors = data['landmarks']
    centre = np.array(data['size']) / 2
    train = data['fit']
    controls = [k for k in data['holdout'] if k != 'hood']
    region = (160, 160, 450, 530) if figure == 'fig6' else (100, 0, 390, 370)
    camera_rows = []
    for distance in [np.inf, 16, 10, 7, 5, 4]:
        def errors(keys, p):
            xyz = np.array([world[figure][k] for k in keys])
            return project(xyz, p, distance, centre) - [anchors[k][:2] for k in keys]

        a, b = (2, 85) if figure == 'fig6' else (90, 179)
        fitted = least_squares(lambda p: (errors(train, p) /
            np.array([[anchors[k][2]] for k in train])).ravel(),
            [(a+b)/2, 10, 0, 350, 600, 950], loss='soft_l1',
            bounds=([a,0,-15,80,-500,0],[b,50,15,1100,2000,1900]))
        p = fitted.x
        row = {'distance': 'orthographic' if np.isinf(distance) else distance,
               'chassisControlMeanPx': round(np.linalg.norm(errors(controls,p),axis=1).mean(),2)}
        for label, obs in [('original',data['nose']), ('hardwarePatch',patch)]:
            def residual(angles):
                return project(pin(angles)[None,:], p, distance, centre)[0] - obs[:2]
            fits = [least_squares(residual,[angle,12],bounds=([-180,0],[180,32]))
                    for angle in [-160,-80,0,80,160]]
            fit = min(fits,key=lambda f: np.linalg.norm(f.fun))
            xyz = pin(fit.x)
            tip, top = project(np.array([xyz,xyz+[0,-.391,0]]),p,distance,centre)
            gap = (data['grapple']['top'][1]-obs[1])-(top[1]-tip[1])
            row[label] = {'yawBoomDeg':fit.x.round(2).tolist(),'pinFitPx':round(np.linalg.norm(fit.fun),2),
                          'gapResidualPx':round(gap,2),'predictedTop':top.round(2).tolist(),
                          'topErrorPx':round(np.linalg.norm(top-data['grapple']['top'][:2]),2)}
        camera_rows.append(row)
    best = min(camera_rows,key=lambda r:r['chassisControlMeanPx'])
    report[figure] = {'chassisControls':controls,'patchXYRadiusPx':patch,'selectedDistance':best['distance'],'cameras':camera_rows}
    for label,row in [('baseline',camera_rows[0]),('distance 4',camera_rows[-1])]:
        im = Image.open(ROOT/data['image']).convert('RGB')
        draw = ImageDraw.Draw(im)
        for (x,y,r),color in [(data['nose'],'orange'),(patch,'deepskyblue'),(data['grapple']['top'],'lime')]:
            draw.ellipse((x-r,y-r,x+r,y+r),outline=color,width=2)
        for key,color in [('original','orange'),('hardwarePatch','deepskyblue')]:
            x,y=row[key]['predictedTop']
            draw.line((x-8,y,x+8,y),fill=color,width=3)
            draw.line((x,y-8,x,y+8),fill=color,width=3)
        tile = im.crop(region)
        ImageDraw.Draw(tile).text((6,5),figure+' / '+label,fill='white',stroke_width=1,stroke_fill='black')
        tiles.append(tile)
plate = Image.new('RGB',(580,740))
for i, tile in enumerate(tiles):
    plate.paste(tile,((i%2)*290,(i//2)*370))
plate.save(OUT/'suspension-photo.jpg',quality=90)
(OUT/'suspension-photo.json').write_text(json.dumps(report,indent=2)+'\n')
