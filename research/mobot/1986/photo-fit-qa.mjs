// Reproducible 2D registration audit for the ORIGINAL Mobot-Ch-HV (1986).
// The manual image points and several model x coordinates share the same source.
// Accordingly this checks internal consistency, NOT independent historical accuracy.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../../../mobot-assets/three.module.min.js';
import {makeMobot1986} from '../../../mobot-ch-hv-1986-research-v6-model.js';

const annotationPath = new URL('../../../mobot-qa/demo-2026-11-18/fig6-1986-landmarks-manual.json', import.meta.url);
const annotated = JSON.parse(readFileSync(annotationPath, 'utf8'));
const model = makeMobot1986(T), p = model.sourceProfile();
assert.equal(annotated.figure, 6);
assert.equal(annotated.printedPage, 74);
assert.equal(annotated.lowerWheelCentersLeftToRight.length, 7);
assert.equal(annotated.endWheelCentersApprox.length, 2);
assert.equal(p.wheelXs.length, 7);
assert.equal(p.endWheels.length, 2);
assert.equal(p.dimensionsVerified, false);
assert.equal(model.root.userData.historicallyCalibrated, false);

const lower = p.wheelXs.map((x, i) => ({
  id: 'lower-' + (i + 1), xy: [x, p.wheelY],
  pixel: annotated.lowerWheelCentersLeftToRight[i]
}));
const raised = p.endWheels.map((wheel, i) => ({
  id: i === 0 ? 'rear-end' : 'front-end',
  xy: wheel.slice(0, 2), pixel: annotated.endWheelCentersApprox[i]
}));
const points = [...lower, ...raised];
for (const item of points) {
  assert(item.xy.concat(item.pixel).every(Number.isFinite), 'non-finite control point');
}

// Reflect model Y (up) into scan Y (down), then fit uniform scale + rotation + shift.
//    pixelX = a*x + b*y + tx
//    pixelY = b*x - a*y + ty
// This is a 2D similarity approximation; perspective and occlusion are NOT modeled.
function register(data) {
  const system = Array.from({length: 4}, () => Array(5).fill(0));
  for (const {xy: [x, y], pixel: [u, v]} of data) {
    for (const [row, target] of [
      [[x, y, 1, 0], u],
      [[-y, x, 0, 1], v]
    ]) {
      for (let i = 0; i < 4; i++) {
        system[i][4] += row[i] * target;
        for (let j = 0; j < 4; j++) system[i][j] += row[i] * row[j];
      }
    }
  }
  for (let col = 0; col < 4; col++) {
    let pivot = col;
    for (let i = col + 1; i < 4; i++)
      if (Math.abs(system[i][col]) > Math.abs(system[pivot][col])) pivot = i;
    assert(Math.abs(system[pivot][col]) > 1e-10, 'ambiguous registration');
    [system[col], system[pivot]] = [system[pivot], system[col]];
    const factor = system[col][col];
    for (let j = col; j < 5; j++) system[col][j] /= factor;
    for (let i = 0; i < 4; i++) {
      if (i === col) continue;
      const t = system[i][col];
      for (let j = col; j < 5; j++) system[i][j] -= t * system[col][j];
    }
  }
  const [a, b, tx, ty] = system.map(row => row[4]);
  const projectPoint = ([x, y]) => [a*x + b*y + tx, b*x - a*y + ty];
  const err = sample => {
    const [u, v] = projectPoint(sample.xy);
    return Math.hypot(sample.pixel[0] - u, sample.pixel[1] - v);
  };
  return {parameters: {a, b, tx, ty, scale: Math.hypot(a, b)},
    project: projectPoint, residual: err,
    rms: Math.sqrt(data.reduce((sum, entry) => sum + err(entry)**2, 0)/data.length)};
}
const fitAll = register(points);
const fitLower = register(lower);
const rounded = x => Math.round(x*1000)/1000;
const endpointHoldout = raised.map(entry => ({
  id: entry.id,
  observedPixels: entry.pixel,
  fittedPixels: fitLower.project(entry.xy).map(rounded),
  residualPixels: rounded(fitLower.residual(entry))
}));
const rms9 = rounded(fitAll.rms), rms7 = rounded(fitLower.rms);
const maxHeldOut = Math.max(...endpointHoldout.map(x => x.residualPixels));
assert(rms9 < 20, 'source-to-model nine-anchor fit changed materially');
assert(rms7 < 10, 'source-to-model lower-wheel fit changed materially');
assert(maxHeldOut < 40, 'raised-wheel holdout drift requires a review');
const report = {
  subject: 'Мобот-Ч-ХВ 1986 — research-v6',
  source: annotated.source,
  imageSize: annotated.imageSize,
  figure: 6,
  printedPage: 74,
  reference: 'mobot-qa/demo-2026-11-18/fig6-1986-landmarks-manual.json',
  units: 'full-page scan pixels, NOT millimetres',
  method: 'unrectified 2D similarity with reflection; X model coordinates partly derived from same manually annotated source',
  fitOfAllNine: {anchors: 9, rmsPixels: rms9, maxResidualPixels: rounded(Math.max(...points.map(fitAll.residual)))},
  fitOfSevenLower: {anchors: 7, rmsPixels: rms7},
  raisedWheelsHeldOut: endpointHoldout,
  status: 'PASS',
  meaning: 'Numerical registration smoke test only; within-photo fit cannot independently verify manufactured dimensions.',
  unresolved: [
    'Perspective, camera calibration and occlusion are unknown.',
    'Manual landmark accuracy is approximately ±10 px (occluded ±15 px).',
    'The front raised wheel has a larger residual; distinguish projection from shape before altering geometry.',
    'An independent matched-point set for figure 9 is needed before claiming cross-view accuracy.',
    'No true 3D dimensions or manufacturing tolerances are established.'
  ]
};
console.log(JSON.stringify(report, null, 2));
