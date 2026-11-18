"""Paired perturbation of manual points. Stress ranges describe the chosen noise model."""
import json
from pathlib import Path
from random import Random
from math import dist,sqrt
from statistics import median

folder=Path(__file__).resolve().parent
old=json.loads((folder/'jaw-opening-before.json').read_text())
new=json.loads((folder/'jaw-opening.json').read_text())
rng=Random(1987)
summary={}
def weights(p,anchors):
    (x,y),(bx,by),(cx,cy)=anchors
    dx,dy=p[0]-x,p[1]-y
    det=(bx-x)*(cy-y)-(by-y)*(cx-x)
    b=(dx*(cy-y)-dy*(cx-x))/det
    c=((bx-x)*dy-(by-y)*dx)/det
    return (1-b-c,b,c)
def corner_weights(pose,marks,anchors):
    result=[]
    for mark,err in zip(marks,pose['errors']):
        matches=[p for p in pose['left'] if abs(dist(mark,p)-err)<1e-6]
        assert len(matches)==1
        result.append(weights(matches[0],anchors))
    return result
for key,view in new.items():
    anchors,marks=view['right'],view['left']
    cases=[d[key]['revisions']['v22']['preset'] for d in (old,new)]
    groups=[corner_weights(r,marks,anchors) for r in cases]
    changes=[]
    radius=view['pickPx']
    for trial in range(2000):
        def nudge(p):
            return [v+rng.uniform(-radius,radius) for v in p]
        perturbed=list(map(nudge,anchors)); targets=list(map(nudge,marks))
        rms=[]
        for group in groups:
            pred=[[sum(w*p[k] for w,p in zip(ws,perturbed)) for k in (0,1)] for ws in group]
            rms.append(sqrt(sum(dist(p,q)**2 for p,q in zip(pred,targets))/len(targets)))
        changes.append(rms[0]-rms[1])
    changes.sort()
    summary[key]={'pairedTrials':len(changes),'coordinatePerturbationPx':radius,
      'lowerRmsCount':sum(x>0 for x in changes),'minGainPx':changes[0],
      'medianGainPx':median(changes),'maxGainPx':changes[-1]}
print(json.dumps(summary,indent=2))
(folder/'jaw-pick-sensitivity.json').write_text(json.dumps(summary,indent=2)+'\n')
