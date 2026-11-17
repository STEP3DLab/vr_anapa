"""Evaluate the overnight experiments. Run from the repository root."""
import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
PUBLIC = 'https://step3dlab.github.io/vr_anapa/mobot-ch-hv-1986-research-v7.html'

def dump(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')

def read(path):
    return json.loads(path.read_text())

def run(cmd, env=None, check=True):
    return subprocess.run(cmd, cwd=ROOT, env={**os.environ, **(env or {})},
                          capture_output=True, text=True, check=check)

def registration(out, detailed):
    import numpy as np
    trials = 240 if detailed else 24
    run([sys.executable,str(HERE/'archive-fit.py'),'--out',str(out),'--repeats',str(trials),'--seed','19861118'])
    cameras=read(out/'registration.json')['views']
    sources=read(HERE/'landmarks.json')
    rng=np.random.default_rng(1986)
    result={}
    for name,view in cameras.items():
        points=sources[name]['grapple']
        y=[]
        for key in ('top','rail','lip'):
            _,center,spread=points[key]
            y.append(center+rng.uniform(-spread,spread,20000))
        ratio=(y[2]-y[1])/(y[1]-y[0])
        old=.329/(.575-.286);new=old*.68
        win=float(np.mean(np.abs(ratio-new)<np.abs(ratio-old)))
        result[name]={'nominalRatio':float((points['lip'][1]-points['rail'][1])/(points['rail'][1]-points['top'][1])),
                      'ratioP10P50P90':np.percentile(ratio,[10,50,90]).round(3).tolist(),
                      'fractionCloserToV7':win,'nominalV6':old,'nominalV7':new,'hood':view['hoodCrown']}
    return {'phase':'registration','status':'PASS' if all(q['fractionCloserToV7']>.90 and q['hood']['v7Pixels']<q['hood']['v6Pixels'] for q in result.values()) else 'FAIL',
            'cameraRefitsPerView':trials,'outlinePerturbationsPerView':20000,'views':result,
            'scope':'Чувствительность к ручному считыванию фотографии; коэффициенты не являются оценкой точности в миллиметрах.'}

def candidate(out):
    import math
    data=read(HERE/'landmarks.json');registration=read(HERE/'registration/registration.json')['views']
    options=[.060,.075,.090,.105,.120,.135,.150,.165,.180]
    trials=[]
    for extension in options:
        env={'MOBOT_EXTENSION':str(extension)}
        # Both range boundaries and intermediate poses are essential: a random sweep misses the raised bucket.
        test=run(['node',str(HERE/'scene-qa.mjs')],env,check=False)
        scene=json.loads(test.stdout);errors=[t.get('error') for t in scene['tests'] if t['status']!='PASS']
        residual={}
        for name in ['fig6','fig9']:
            camera=registration[name]['camera']
            factor=camera['pxPerSceneUnit']*math.cos(math.radians(camera['elevation']))*math.cos(math.radians(camera['roll']))
            drop=data[name]['grapple']['top'][1]-data[name]['nose'][1]
            residual[name]=round(abs(drop-factor*(.286+extension)),2)
        trials.append({'extension':extension,'discreteScene':'PASS' if test.returncode==0 else 'FAIL','firstError':next(iter(errors),None),'verticalErrorPx':residual})
    eligible=[x for x in trials if x['discreteScene']=='PASS']
    if not eligible:return {'phase':'candidate','status':'FAIL','trials':trials}
    # Choose on fig. 6 only. A distinct view and off-grid clearance can veto the choice.
    base=trials[0]; selected=None
    for proposed in sorted(eligible,key=lambda x:x['verticalErrorPx']['fig6']):
        env={'MOBOT_EXTENSION':str(proposed['extension'])}
        for phase in ['links','collisions']:
            target=out/('candidate-'+phase+'.json')
            test=run(['node',str(HERE/'night-geometry.mjs'),phase,str(target)],env,check=False)
            if test.returncode:break
        else:
            if proposed['verticalErrorPx']['fig9']<=base['verticalErrorPx']['fig9']:
                selected=proposed
                break
    if selected is None:return {'phase':'candidate','status':'FAIL','trials':trials}
    status='PASS'
    url=PUBLIC+'?suspension='+format(selected['extension'],'.3f') if selected!=base else PUBLIC
    return {'phase':'candidate','status':status,'extension':selected['extension'],'selected':selected,'baseline':base,'url':url,'trials':trials,
            'scope':'Вертикальная проекция условного расстояния оголовок–траверса. Выбор по рис. 6, вето по рис. 9. Кинематика проверена в сцене. Длина и ракурс остаются C.'}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('phase',choices=['kickoff','registration','candidate','links','tracks','loader','collisions','morning'])
    parser.add_argument('out',type=Path);a=parser.parse_args();out=a.out.resolve();out.mkdir(parents=True,exist_ok=True)
    full=a.phase in ('kickoff','morning')
    phases=['registration','candidate','links','tracks','loader','collisions'] if full else [a.phase]
    summary={'phase':a.phase,'commit':os.environ.get('GITHUB_SHA'),'run':os.environ.get('GITHUB_RUN_ID'),'experiments':[]}
    try:
        for phase in phases:
            if phase=='registration':result=registration(out,a.phase!='kickoff')
            elif phase=='candidate':result=candidate(out)
            else:
                path=out/(phase+'.json');test=run(['node',str(HERE/'night-geometry.mjs'),phase,str(path)],check=False)
                result=read(path)
                if test.returncode:result['status']='FAIL'
            dump(out/(phase+'-result.json'),result)
            summary['experiments'].append({'phase':phase,'status':result['status']})
    finally:
        summary['status']='PASS' if len(summary['experiments'])==len(phases) and all(x['status']=='PASS' for x in summary['experiments']) else 'FAIL'
        dump(out/'summary.json',summary)
    if summary['status']!='PASS':raise SystemExit(1)
if __name__=='__main__':main()
