import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../engine/three.module.min.js';
import {makeMobot} from '../models/mobot-engineering-v23-model.js';
import {assessPose} from '../pose-check.js';

globalThis.document = {createElement: () => ({getContext: () => null})};
const model = makeMobot(T, 'mobile');
// The independent accepted viewer's surface-witnesses fixture changes only
// bucket tip: 0° has separating-axis certificates, 3° intersects the bucket.
// See research/mobot/1987/night-20261118/browser-v23.cjs.
const pose = {yaw: 0, arm: 25, wrist: 90, claw: 8, bucket: 36, track: 0};

test('An overlapping broad bound at tip 0 resolves to verified gaps in the checked pairs', () => {
  model.mechanisms.setWorkTool('gripper');
  model.mechanisms.setPose({...pose, tip: 0});
  const {messages, report} = assessPose(model, 'gripper');
  assert(report.broad.alerts.length > 0);
  assert.equal(report.status, 'clear-in-checked-scope');
  assert.equal(report.allPairsChecked, false);
  const bucket = report.surfaces.envelopes.find(item => item.group === 'bucket');
  assert(bucket);
  assert.equal(bucket.hits.length, 0);
  assert.equal(bucket.unresolved.length, 0);
  assert(bucket.separated.length > 0);
  assert(bucket.separated.every(pair => pair.gap > 0));
  assert.match(messages.join(' '), /в проверенных парах поверхностей установлен зазор/);
});

test('The same geometry at tip 3 reports actual triangle witnesses against the bucket', () => {
  model.mechanisms.setWorkTool('gripper');
  model.mechanisms.setPose({...pose, tip: 3});
  const {messages, report} = assessPose(model, 'gripper');
  assert.equal(report.status, 'confirmed');
  const bucket = report.surfaces.envelopes.find(item => item.group === 'bucket');
  assert(bucket?.hits.length > 0);
  assert(bucket.hits.every(hit => hit.point.length === 3 && hit.point.every(Number.isFinite)));
  assert.match(messages.join(' '), /Подтверждён контакт поверхностей рабочего органа и ковша в модели/);
  assert.equal(report.allPairsChecked, false);
});
