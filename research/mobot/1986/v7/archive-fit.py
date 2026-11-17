"""Register the rigid chassis in two oblique archive crops. Run from repository root."""
import argparse
import json
import subprocess
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy.optimize import least_squares
from scipy.signal import fftconvolve

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
VIEWS=('fig6','fig9')
def match_template(img, template):
    img=np.asarray(img,dtype=float); temp=np.asarray(template,dtype=float)
    h,w=temp.shape; temp-=temp.mean()
    # Sliding integral sums with the same valid domain as cross correlation.
    def window_sum(a):
        integral=np.pad(a.cumsum(0).cumsum(1),((1,0),(1,0)))
        return integral[h:,w:]-integral[:-h,w:]-integral[h:,:-w]+integral[:-h,:-w]
    var=window_sum(img*img)-window_sum(img)**2/(w*h)
    score=fftconvolve(img,temp[::-1,::-1],mode='valid')/np.sqrt(np.maximum(var,1)*np.sum(temp**2))
    y,x=np.unravel_index(np.argmax(score),score.shape)
    return int(x),int(y),float(score[y,x])
def scan_transform(crop,scan):
    size=lambda im,s:tuple(max(1,round(v*s)) for v in im.size)
    small=scan.resize(size(scan,.25),Image.Resampling.BOX)
    best=(-1,None)
    for scale in [.25,1/3,.5,2/3,1.0]:
        tmpl=crop.resize(size(crop,.25*scale),Image.Resampling.BOX)
        x,y,score=match_template(small,tmpl)
        if score>best[0]:best=(score,(scale,4*x,4*y))
    scale,x,y=best[1];w,h=size(crop,scale);x0=max(0,x-10);y0=max(0,y-10)
    patch=scan.crop((x0,y0,min(scan.width,x+w+12),min(scan.height,y+h+12)))
    dx,dy,score=match_template(patch,crop.resize((w,h),Image.Resampling.BOX))
    if score<.88:raise ValueError('Crop not identified confidently')
    return dict(scanOffset=[x0+dx,y0+dy],cropToScanScale=scale,normalizedCorrelation=round(score,5))
def project(xyz,p):
    az,el,roll=np.radians(p[:3]);ca,sa=np.cos(az),np.sin(az);ce,se=np.cos(el),np.sin(el)
    xx=xyz @ np.array([ca,0,-sa]); yy=xyz @ np.array([-sa*se,ce,-ca*se])
    c,s=np.cos(roll),np.sin(roll)
    return p[4:]+p[3]*np.column_stack([xx*c-yy*s,-xx*s-yy*c])
def fit(fig,xyz):
    keys=fig['fit'];points=np.array([xyz[k] for k in keys]);target=np.array([fig['landmarks'][k] for k in keys])
    is_rear=fig['side']==1;bounds=([2 if is_rear else 90,0,-15,80,-500,0],[85 if is_rear else 179,50,15,1100,2000,1900])
    def residual(p):return ((project(points,p)-target[:,:2])/target[:,2:]).flatten()
    init=np.array([25 if is_rear else 140,13,0,410,650,950])
    return least_squares(residual,init,bounds=bounds,loss='soft_l1',max_nfev=220).x
def fit_pose(cam,data):
    target=np.array(data['nose'][:2])
    def err(angles):
        yaw,lift=np.radians(angles)
        # Turntable, boom origin/tip and neutral frame-top landmarks from v6.
        x=-.132-1.49*np.cos(lift)+.30*np.sin(lift)
        y=.83+.960+1.49*np.sin(lift)+.30*np.cos(lift)
        xyz=np.array([[.29+x*np.cos(yaw),y,-x*np.sin(yaw)]])
        return project(xyz,cam)[0]-target
    guesses=[-40,0,40] if data['side']==1 else [-170,-135,135,170]
    fits=[least_squares(err,[angle,8],bounds=([-180,0],[180,32])) for angle in guesses]
    preferred=0 if data['side']==1 else -165
    score=min(np.linalg.norm(f.fun) for f in fits)
    best=min((f for f in fits if np.linalg.norm(f.fun)<score+1),key=lambda f:abs(f.x[0]-preferred))
    return {'yaw':round(best.x[0],3),'boom':round(best.x[1],3),'openingIllustration':data['illustrativeOpening'],'noseResidualPx':round(float(np.linalg.norm(best.fun)),2)}
def archive(out,repeats,seed):
    inputs=json.loads((HERE/'landmarks.json').read_text())
    shapes=json.loads(subprocess.check_output(['node',str(HERE/'anchors.mjs')],cwd=ROOT))
    candidate=json.loads(subprocess.check_output(['node',str(HERE/'anchors.mjs'),'v7'],cwd=ROOT))
    rng=np.random.default_rng(seed);report={}
    for figure,page in zip(VIEWS,[74,75]):
        data=inputs[figure];world=shapes[figure];photo=Image.open(ROOT/data['image']).convert('RGB')
        scan=Image.open(ROOT/f'mobot-assets/archive/1986-page{page}.jpg').convert('L')
        xform=scan_transform(photo.convert('L'),scan)
        cam=fit(data,world); rows=[];draw=ImageDraw.Draw(photo)
        for key,val in data['landmarks'].items():
            xy=project(np.array([world[key]]),cam)[0];x,y=xy;tx,ty,err=val
            residual=np.linalg.norm(xy-[tx,ty]);role='fit' if key in data['fit'] else 'holdout'
            rows.append(dict(point=key,role=role,residualPixels=round(float(residual),2),readingUncertainty=err,projected=xy.round(2).tolist()))
            color='#29de94' if role=='fit' else '#ffb125'
            draw.ellipse((tx-err,ty-err,tx+err,ty+err),outline=color,width=3)
            draw.line((tx,ty,x,y),fill=color,width=3);draw.line((x-6,y,x+6,y),fill='red',width=3);draw.line((x,y-6,x,y+6),fill='red',width=3)
        photo.thumbnail((840,900));photo.save(out/(figure+'-registration.jpg'),quality=85)
        errors=[];orientations=[]
        for _ in range(repeats):
            jitter={**data,'landmarks':{k:[*(np.array(v[:2])+rng.uniform(-v[2],v[2],2)),v[2]] for k,v in data['landmarks'].items()}}
            p=fit(jitter,world);orientations.append(p[:3])
            pred=project(np.array([world[k] for k in data['holdout']]),p)
            obs=np.array([data['landmarks'][k][:2] for k in data['holdout']])
            errors.append(np.linalg.norm(pred-obs,axis=1).mean())
        report[figure]=dict(cropToScan=xform,camera=dict(zip(['azimuth','elevation','roll','pxPerSceneUnit','cx','cy'],cam.round(4).tolist())),
            hoodCrown=dict(v6Pixels=next(row['residualPixels'] for row in rows if row['point']=='hood'),
                v7Pixels=round(float(np.linalg.norm(project(np.array([candidate[figure]['hood']]),cam)[0]-data['landmarks']['hood'][:2])),2),
                role='shape selection' if figure=='fig6' else 'separate view check',readingUncertainty=data['landmarks']['hood'][2]),
            demoPose=fit_pose(cam,data),points=rows,holdoutMeanPixels=round(np.mean([p['residualPixels'] for p in rows if p['role']=='holdout']),2),
            jitterSamples=repeats,jitterHoldoutMeanPixelP10P50P90=np.percentile(errors,[10,50,90]).round(2).tolist(),
            jitterAnglesP10P90=np.percentile(orientations,[10,90],axis=0).round(2).tolist())
    return {'method':'Rigid chassis only; weak perspective; independent camera per photo; manual points; interval sensitivity is not a confidence interval. Angles and depth are hypotheses.', 'seed':seed,'views':report}
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--out',type=Path,required=True);parser.add_argument('--repeats',type=int,default=20);parser.add_argument('--seed',type=int,default=1986)
    args=parser.parse_args();args.out.mkdir(exist_ok=True,parents=True)
    (args.out/'registration.json').write_text(json.dumps(archive(args.out,args.repeats,args.seed),indent=2)+'\n')
