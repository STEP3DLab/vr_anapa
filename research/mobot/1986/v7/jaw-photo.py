"""Can relative yaw explain both the transverse rib and the overall jaw outline?"""
import json
import subprocess
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy.spatial import ConvexHull

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
OUT = HERE/'experiments'
views = json.loads((HERE/'registration/registration.json').read_text())['views']
samples = json.loads(subprocess.check_output(['node',HERE/'jaw-projection.mjs']))
# Rib ends, visible outer shell horizontal limits and uncertainty per edge;
# the partially obscured fig9 left edge has a larger interval.
observed = {
    'fig6': dict(rib=[[236,624],[314,622]], xBounds=[233,414], edgeRadius=[6,8],
                 top=[319,462], crop=[170,425,460,685], endpointRadius=6),
    'fig9': dict(rib=[[245,518],[335,538]], xBounds=[115,346], edgeRadius=[27,9],
                 top=[250,339], crop=[65,295,380,590], endpointRadius=8)}
report = {}
plate = Image.new('RGB',(720,700),'#f8f6f0')
for row,(figure,obs) in enumerate(observed.items()):
    view=views[figure]
    c=view['camera']
    a,e,r=np.radians([c['azimuth'],c['elevation'],c['roll']])
    axes=np.array([[np.cos(a),0,-np.sin(a)],[-np.sin(a)*np.sin(e),np.cos(e),-np.cos(a)*np.sin(e)]])
    projection=c['pxPerSceneUnit']*np.array([[np.cos(r),-np.sin(r)],[-np.sin(r),-np.cos(r)]])@axes
    def transform(angle):
        t=np.radians(angle)
        return projection@np.array([[np.cos(t),0,np.sin(t)],[0,1,0],[-np.sin(t),0,np.cos(t)]])
    angle=view['demoPose']['openingIllustration']
    jaws=samples[figure][angle]['jaws']
    target=np.diff(obs['rib'],axis=0)[0]
    def rib_error(yaw):
        delta=transform(yaw)@jaws[0]['ribVector']
        if delta[0]<0: delta=-delta
        return np.linalg.norm(delta-target)
    # Transverse rib is an unoriented line; search a half-turn, using no shell widths.
    yaws=range(-90,90)
    best=min(yaws,key=rib_error)
    def outlines(grab,yaw):
        return [np.array(j['points'])@transform(yaw).T for j in samples[figure][grab]['jaws']]
    def width(grab,yaw):
        return np.ptp(np.concatenate(outlines(grab,yaw))[:,0])
    width_photo=np.diff(obs['xBounds'])[0]
    def metrics(yaw):
        widths=[width(grab,yaw) for grab in range(33)]
        return dict(yaw=yaw,ribErrorPx=round(rib_error(yaw),2),
                    widthPx=round(width(angle,yaw),2),
                    widthErrorPx=round(width(angle,yaw)-width_photo,2),
                    widthsByOpening0to32Px=np.round(widths,2).tolist())
    # Include all yaw angles compatible with two uncertain rib endpoints.
    # Precompute 3-D hulls once; their vertices preserve all projected extrema.
    hulls=[]
    for pose in samples[figure]:
        pts=np.concatenate([j['points'] for j in pose['jaws']])
        hulls.append(pts[ConvexHull(pts).vertices])
    allowed=[y for y in yaws if rib_error(y)<=2*obs['endpointRadius']]
    widths=[float(np.ptp(h@transform(y)[0])) for y in allowed for h in hulls]
    tolerance=sum(obs['edgeRadius'])
    report[figure]=dict(measurement=obs,opening=angle,baseline=metrics(0),yawTrial=metrics(best),
        ribCompatibleYawsDeg=allowed,
        compatibleProjectedWidthIntervalPx=np.round([min(widths),max(widths)],2).tolist(),
        observedWidthIntervalPx=[int(width_photo-tolerance),int(width_photo+tolerance)],
        compatiblePoses=int(sum(abs(w-width_photo)<=tolerance for w in widths)),
        testedCompatibleYawOpeningPairs=len(widths))
    for col,yaw in enumerate([0,best]):
        im=Image.open(ROOT/f'mobot-assets/archive/1986-{figure}.png').convert('RGB')
        draw=ImageDraw.Draw(im)
        draw.line(list(map(tuple,obs['rib'])),fill='#fff500',width=3)
        # Dashed model rib is centred on the photo rib solely to compare vectors.
        mid=np.mean(obs['rib'],axis=0)
        vec=transform(yaw)@jaws[0]['ribVector']
        for frac in np.linspace(-.5,.4,7):
            draw.line([tuple(mid+frac*vec),tuple(mid+(frac+.065)*vec)],fill='#be31df',width=3)
        for x in obs['xBounds']:
            draw.line((x,obs['rib'][0][1]-18,x,obs['rib'][0][1]+18),fill='#fff500',width=2)
        for hull,color in zip(outlines(angle,yaw),['#10c9e0','#f48822']):
            xy=hull[ConvexHull(hull).vertices]+obs['top']
            draw.line(list(map(tuple,np.vstack([xy,xy[:1]]))),fill=color,width=2)
        tile=im.crop(obs['crop']); tile.thumbnail((350,315))
        x,y=360*col,350*row
        plate.paste(tile,(x+(360-tile.width)//2,y+28))
        ImageDraw.Draw(plate).text((x+12,y+6),f'{figure} / relative yaw {yaw:+d} deg / opening {angle} deg',fill='#171717')
plate.save(OUT/'jaw-photo.jpg',quality=86)
(OUT/'jaw-photo.json').write_text(json.dumps(report,indent=2)+'\n')
