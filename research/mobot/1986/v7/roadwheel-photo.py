"""Compare exposed upper wheel rims in the two archive photos with registered v7 renders.

Run from any directory with the baseline checkout (7b8468dc) as the sole argument.
"""
import argparse
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
REGISTRATION = HERE / 'registration/registration.json'
EXPERIMENTS = HERE / 'experiments'
# Wheel index from rear, previously read hub, three points on the exposed upper edge.
# Use only the upper edge: cables/terrain obscure parts of the lower semicircle.
READINGS = {
    'fig6': [(1, [417, 932], [[408, 901], [415, 900], [422, 901]]),
             (2, [477, 941], [[469, 907], [475, 907], [481, 909]]),
             (3, [552, 954], [[543, 923], [550, 922], [557, 923]])],
    'fig9': [(0, [777, 950], [[773, 933], [778, 932], [782, 933]]),
             (1, [744, 961], [[740, 940], [745, 938], [750, 938]]),
             (2, [698, 961], [[695, 932], [701, 930], [706, 930]])],
}
# Fixed in both renders. Sampling is relative to each local wheel, not its position on the page.
RADIUS = .090
RING_MID = .79
INNER_FRACTION = .68


def camera_matrix(camera):
    a, e, r = np.deg2rad([camera[k] for k in ('azimuth', 'elevation', 'roll')])
    basis = [[np.cos(a), 0, -np.sin(a)],
             [-np.sin(a)*np.sin(e), np.cos(e), -np.cos(a)*np.sin(e)]]
    return camera['pxPerSceneUnit'] * np.array([[np.cos(r), -np.sin(r)],
                                               [-np.sin(r), -np.cos(r)]]) @ basis


def sample(image, points):
    # Bilinear samples prevent a half-pixel translation snapping to a different pixel.
    x, y = points.T
    ix, iy = np.floor(x).astype(int), np.floor(y).astype(int)
    fx, fy = x-ix, y-iy
    return ((1-fx)*(1-fy)*image[iy, ix] + fx*(1-fy)*image[iy, ix+1] +
            (1-fx)*fy*image[iy+1, ix] + fx*fy*image[iy+1, ix+1])


def contrast(image, center, edge, offset=(0, 0)):
    grey = np.asarray(image.convert('L'), dtype=float)
    # Average a 3x3 footprint at each reading; median over the three paired sites.
    patch = np.array([(x, y) for x in (-1, 0, 1) for y in (-1, 0, 1)])
    def intensity(points):
        sites = points[:, None, :] + patch + offset
        return np.median(sample(grey, sites.reshape(-1, 2)).reshape(-1, 9).mean(axis=1))
    outer = intensity(edge)
    inner = intensity(center + INNER_FRACTION*(edge-center))
    return float((outer-inner)/(outer+inner))


def render(source, fig, prefix):
    image = prefix.with_suffix('.ppm')
    points = prefix.with_suffix('.json')
    subprocess.run(['node', source/'photo-render.mjs', REGISTRATION, fig, 'v7', image, points],
                   check=True)
    return Image.open(image).convert('RGB'), np.array(json.loads(points.read_text())['hubs'])


def wheel_readings(fig, camera, image, hubs=None, offset=(0, 0)):
    readings = []
    matrix = camera_matrix(camera)
    for wheel, center, edge in READINGS[fig]:
        center, edge = np.array(center), np.array(edge)
        if hubs is not None:
            direction = edge-center
            # Invert the 2-D projection of the wheel plane, then intersect each ray
            # with the circle. Correct the datum from hub centre to outer face.
            local = np.linalg.solve(matrix[:, :2], direction.T).T
            side = 1 if fig == 'fig6' else -1
            center = hubs[wheel] + matrix[:, 2] * side*(.083-.086)
            edge = center + direction*(RADIUS*RING_MID/np.linalg.norm(local, axis=1))[:, None]
        readings.append(contrast(image, center, edge, offset))
    return np.array(readings)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('baseline_root', type=Path)
    baseline = parser.parse_args().baseline_root.resolve()
    cameras = json.loads(REGISTRATION.read_text())['views']
    report = {'baselineModelGitBlob': subprocess.check_output(
        ['git', '-C', str(baseline), 'hash-object', 'mobot-ch-hv-1986-research-v7-model.js'],
        text=True).strip(), 'units': 'dimensionless (rim - inner face) / (rim + inner face)',
        'innerSamplingFraction': INNER_FRACTION, 'modelRadiusFraction': RING_MID,
        'scope': 'Upper exposed arcs only; manual 3x3 px samples. No absolute reflectance or wheel diameter.',
        'views': {}}
    plate = Image.new('RGB', (1140, 584), '#f6f5ef')
    draw = ImageDraw.Draw(plate)
    font = ImageFont.truetype('DejaVuSans.ttf', 18)
    small = ImageFont.truetype('DejaVuSans.ttf', 15)
    with tempfile.TemporaryDirectory() as directory:
        for row, (fig, marks) in enumerate(READINGS.items()):
            photo = Image.open(ROOT/f'mobot-assets/archive/1986-{fig}.png').convert('RGB')
            images = [photo]
            hubsets = [None]
            for j, source in enumerate([baseline/HERE.relative_to(ROOT), HERE]):
                im, hubs = render(source, fig, Path(directory)/f'{fig}-{j}')
                images.append(im)
                hubsets.append(hubs)
            camera = cameras[fig]['camera']
            samples = np.array([wheel_readings(fig, camera, im, hubs)
                                for im, hubs in zip(images, hubsets)])
            errors = np.abs(samples[1:] - samples[0]).mean(axis=1)
            shifts = [wheel_readings(fig, camera, photo, offset=(x, y))
                      for x in (-2, 0, 2) for y in (-2, 0, 2)]
            error_gain = [np.abs(samples[1]-a).mean()-np.abs(samples[2]-a).mean() for a in shifts]
            report['views'][fig] = {'archiveLandmarks': marks,
                'contrastByWheelArchiveBeforeAfter': samples.round(4).tolist(),
                'meanAbsoluteErrorBeforeAfter': errors.round(4).tolist(),
                'errorReductionRangeArchiveShift2px': np.round([min(error_gain), max(error_gain)], 4).tolist()}
            for col, (im, hubs, values) in enumerate(zip(images, hubsets, samples)):
                top, left = row*266+12, col*380+12
                label = ['архив', 'до', 'после'][col]
                draw.text((left, top), f'Рис. {fig[3:]}  ·  {label}', font=font, fill='#20392e')
                centers = np.array([c for _, c, _ in marks]) if hubs is None else hubs[[m[0] for m in marks]]
                cx, cy = np.round(centers.mean(axis=0)).astype(int)
                w, h = (228, 116) if fig == 'fig6' else (144, 74)
                box = (cx-w//2, cy-h//2, cx+w//2, cy+h//2)
                chip = im.crop(box)
                chip = chip.resize((356, round(356*h/w)), Image.Resampling.LANCZOS)
                plate.paste(chip, (left, top+33))
                draw.text((left, top+228), f'Средний контраст     {values.mean():.3f}', font=small, fill='#20392e')
    draw.text((12, 544), 'Светлота верхней закраины относительно внутренней части диска. Кропы центрированы по трём каткам.', font=font, fill='#20392e')
    passed = all(result['errorReductionRangeArchiveShift2px'][0] > 0 and
                 result['meanAbsoluteErrorBeforeAfter'][1] < result['meanAbsoluteErrorBeforeAfter'][0]
                 for result in report['views'].values())
    report['status'] = 'PASS' if passed else 'FAIL'
    (EXPERIMENTS/'roadwheel-faces.json').write_text(json.dumps(report, indent=2)+'\n')
    plate.save(EXPERIMENTS/'roadwheel-faces.jpg', quality=90)
    if not passed:
        raise SystemExit('Photo comparison failed')


if __name__ == '__main__':
    main()
