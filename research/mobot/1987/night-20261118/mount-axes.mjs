import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../../../../mobot-assets/three.module.min.js';
import {makeMobot} from '../../../../mobot-engineering-v22-model.js';
import {initial, poses} from './poses.js';

globalThis.document = {createElement: () => ({getContext: () => null})};
const m = makeMobot(T, 'desktop').mechanisms;
const tools = {gripper: m.fingerHead, 'breaker-arm': m.breakerArm, 'breaker-loader': m.breakerLoader};
const center = part => part.getWorldPosition(new T.Vector3());
const endpoint = (part, y) => part.localToWorld(new T.Vector3(0, y, 0));
const cylinders = group => group.children.filter(part => part.geometry?.type === 'CylinderGeometry');
const bearings = cylinders(m.bucketLift).filter(part => part.geometry.parameters.radiusTop === .058);
const wrist = cylinders(m.gripper).find(part => part.geometry.parameters.radiusTop === .083);
assert.equal(bearings.length, 2);
assert(wrist);
const maximum = {}, tested = Object.fromEntries(Object.keys(tools).map(name => [name, 0]));
function check(label, error) {
  assert(error < 1e-8, label + ' residual ' + error);
  maximum[label] = Math.max(maximum[label] ?? 0, error);
}
function pinAndSleeve(label, pin, sleeve) {
  // Both centres must lie on the finite shaft and both cylinder axes must be parallel.
  const half = pin.geometry.parameters.height / 2;
  const shaft = new T.Line3(endpoint(pin, -half), endpoint(pin, half));
  const bore = endpoint(sleeve, 1).sub(center(sleeve)).normalize();
  check(label + '/offset', shaft.closestPointToPoint(center(sleeve), true, new T.Vector3()).distanceTo(center(sleeve)));
  check(label + '/direction', shaft.delta(new T.Vector3()).normalize().cross(bore).length());
}
function inspect(tool, pose) {
  m.setWorkTool(tool);
  m.setPose({...initial, ...pose});
  for (const [name, part] of Object.entries(tools)) assert.equal(part.visible, name === tool);
  assert.equal(m.scoopShell.visible, tool !== 'breaker-loader');
  pinAndSleeve('wrist', m.distalPin, wrist);
  if (tool !== 'breaker-loader') check('arm tool mount', center(tools[tool]).distanceTo(center(m.distalPin)));
  const fitted = tool === 'breaker-loader' ? m.breakerLoader : m.scoopShell;
  const shafts = cylinders(fitted).filter(part => part.geometry.parameters.height > 1);
  assert.equal(shafts.length, 1);
  for (const bearing of bearings) pinAndSleeve('loader/' + tool, shafts[0], bearing);
  check('boom housing', endpoint(m.actuatorArmHousing, -.5).distanceTo(center(m.armFixed)));
  check('boom screw', endpoint(m.actuatorArmScrew, .5).distanceTo(center(m.armMoving)));
  for (let side = 0; side < 2; side++) {
    check('loader housing', endpoint(m.loaderHousings[side].o, -.5).distanceTo(center(m.framePins[side])));
    check('loader screw', endpoint(m.loaderScrews[side].o, .5).distanceTo(center(m.liftPins[side])));
  }
  tested[tool]++;
}
for (const name of Object.keys(tools)) {
  for (const yaw of [-180, 0, 90]) for (const arm of [-18, 0, 25])
    for (const wrist of [55, 115]) for (const bucket of [-8, 36]) for (const tip of [-25, 25])
      inspect(name, {yaw, arm, wrist, bucket, tip});
}
for (const [, name, pose] of poses) inspect(name, pose);
const record = {tested, maximum, units: 'offsets in scene units; direction residual is the sine of the angle between axes'};
fs.writeFileSync(new URL('mount-axes.json', import.meta.url), JSON.stringify(record, null, 2) + '\n');
console.log(record);
