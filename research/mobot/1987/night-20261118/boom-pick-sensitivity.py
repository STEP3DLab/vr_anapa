"""Vary both registration anchors and all eight check points in paired image-space trials."""
import json
from math import sqrt
from pathlib import Path
from random import Random
from statistics import median

folder = Path(__file__).resolve().parent
source = json.loads((folder / 'boom-cheek.json').read_text())
views = json.loads((folder / 'photo-side.json').read_text())['views']
span = {v['id']: (v['visibleSpan'][1] - v['visibleSpan'][0]) * 1000 / v['width'] for v in views}
result = {}

def edge_distance(point, a, b):
    edge = b - a
    fraction = max(0, min(1, ((point - a) / edge).real))
    return abs(point - a - fraction * edge)

def rms(points, polygon):
    edges = list(zip(polygon, polygon[1:] + polygon[:1]))
    return sqrt(sum(min(edge_distance(p, a, b) for a, b in edges)**2 for p in points) / len(points))

for name, photo in source.items():
    rng = Random(1987 + int(name[-1]))
    root, pin = complex(*photo['root']), complex(*photo['pin'])
    checks = [complex(*p) for p in photo['checks']]
    contours = [[complex(*p) for p in photo[rev]['poly']] for rev in ('before', 'after')]
    for rev, poly in zip(('before', 'after'), contours):
        assert abs(rms(checks, poly) - photo[rev]['rms']) < 1e-9
    radius = photo['pickPx']
    def jitter(p):
        return p + complex(rng.uniform(-radius, radius), rng.uniform(-radius, radius))
    gains = []
    for _ in range(2000):
        start, end = jitter(root), jitter(pin)
        scale_and_roll = (end - start) / (pin - root)
        marked = [jitter(p) for p in checks]
        before, after = [rms(marked, [start + (p-root)*scale_and_roll for p in poly]) for poly in contours]
        gains.append(before - after)
    result[name] = dict(trials=len(gains), coordinatePerturbationPx=radius,
                        lowerRmsCount=sum(x > 0 for x in gains), minGainPx=min(gains), medianGainPx=median(gains),
                        maxGainPx=max(gains), visibleTrackSpanPx=span[name],
                        originalRmsFractionOfTrack={r: photo[r]['rms']/span[name] for r in ('before', 'after')})
print(json.dumps(result, indent=2))
(folder / 'boom-pick-sensitivity.json').write_text(json.dumps(result, indent=2) + '\n')
