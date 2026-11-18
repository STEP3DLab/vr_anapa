"""Re-register both deck projections after shifting the two photo anchors together for each pair."""
import json
from itertools import product
from math import sqrt
from pathlib import Path

folder = Path(__file__).resolve().parent
cases = [json.loads((folder/name).read_text()) for name in ('bucket-cheek-before.json','bucket-cheek.json')]

def rms(points, polygon):
    def squared_distance(p, start, end):
        edge = end-start
        fraction = max(0, min(1, ((p-start)/edge).real))
        return abs(p-start-fraction*edge)**2
    edges = list(zip(polygon, polygon[1:]+polygon[:1]))
    return sqrt(sum(min(squared_distance(p,a,b) for a,b in edges) for p in points)/len(points))

result = {}
for key, tip_radius in [('SKTB2',3),('SKTB4',6)]:
    view = cases[1][key]
    root, tip = complex(*view['root']), complex(*view['tip'])
    checks = [complex(*p) for p in view['upper']]
    polys = [[complex(*p) for p in case[key]['poly']] for case in cases]
    differences = []
    for ax,ay in product((-3,0,3), repeat=2):
        for bx,by in product((-tip_radius,0,tip_radius), repeat=2):
            a, b = root+complex(ax,ay), tip+complex(bx,by)
            transform=(b-a)/(tip-root)
            old, new = [rms(checks,[a+(p-root)*transform for p in poly]) for poly in polys]
            if (ax,ay,bx,by)==(0,0,0,0):
                assert abs(new-view['rms'])<1e-8 and abs(old-cases[0][key]['rms'])<1e-8
            differences.append(old-new)
    result[key] = dict(cases=len(differences),rootDxDyPx=[-3,0,3],tipDxDyPx=[-tip_radius,0,tip_radius],
                       improved=sum(v>0 for v in differences),worstGainPx=min(differences),bestGainPx=max(differences))
print(json.dumps(result,indent=2))
(folder/'bucket-anchor-sensitivity.json').write_text(json.dumps(result,indent=2)+'\n')
