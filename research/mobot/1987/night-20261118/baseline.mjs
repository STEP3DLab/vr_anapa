// This is the v21 reference sweep. Its alarms describe the viewer's own tests.
import assert from 'node:assert/strict';
import * as THREE from '../../../../mobot-assets/three.module.min.js';
import {makeMobot} from '../../../../mobot-engineering-v21-model.js';
globalThis.document = {createElement: () => ({getContext: () => null})};
const robot = makeMobot(THREE, 'desktop');
const {mechanisms} = robot;
const counts = {}, samples = [];
for (const tool of ['gripper', 'breaker-arm', 'breaker-loader']) {
  mechanisms.setWorkTool(tool);
  counts[tool] = {poses: 0, flagged: 0, byReason: {}};
  for (const yaw of [-180, 0, 90]) {
    for (const arm of [-18, 0, 25]) {
      for (const bucket of [-8, 12, 36]) {
        mechanisms.setPose({yaw, arm, bucket, wrist: 90, claw: 8, tip: 0});
        const {clearance, alerts} = mechanisms.inspectPose();
        assert(Number.isFinite(clearance));
        counts[tool].poses++;
        if (alerts.length) counts[tool].flagged++;
        for (const reason of alerts) {
          const byReason = counts[tool].byReason;
          byReason[reason] = (byReason[reason] || 0) + 1;
        }
        samples.push({tool, yaw, arm, bucket, clearance, alerts});
      }
    }
  }
}
assert.equal(samples.length, 81);
assert.equal(samples.filter(row => row.alerts.length).length, 50);
console.log(JSON.stringify({revision: 'v21', modelGitBlob: '907645f254fe29fcd4acb47bb9527de18d4f0ce2',
  fixedAngles: {wrist: 90, claw: 8, tip: 0}, counts, samples}, null, 2));
