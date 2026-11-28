import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../engine/three.module.min.js';
import {makeMobot} from '../models/mobot-engineering-v23-model.js';
import {assessPose,assess1986Pose,pairs1986} from '../pose-check.js';
import {inspectGroupPairs} from '../engine/contact.js';
import {makeMobot1986} from '../models/mobot-ch-hv-1986-research-v7-model.js';

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

test('Selected-group solver distinguishes a gap, surface witness and possible containment',()=>{
  const make=(size,x)=>{const m=new T.Mesh(new T.BoxGeometry(size,size,size));m.position.x=x;m.updateMatrixWorld(true);return m};
  const a=make(2,0);
  const results=inspectGroupPairs([
    {id:'gap',a,b:make(2,3)},
    {id:'intersect',a,b:make(2,1)},
    {id:'contained',a,b:make(.5,0)}
  ]);
  assert.equal(results[0].status,'clear-in-checked-scope');
  assert.equal(results[1].status,'confirmed');
  assert(results[1].hits[0].point.every(Number.isFinite));
  assert.equal(results[2].status,'unresolved');
  assert.equal(results[2].hits.length,0);
});
test('1986 five pairs and nominal ground: actual model, demonstration and independent coarse pose grid',()=>{
  const m=makeMobot1986(T);
  const poses=[m.defaults,{yaw:46,boom:20,grab:18,loader:16,tip:18,track:75}];
  for(const p of poses){
    m.setPose(p);
    const {report}=assess1986Pose(m);
    assert.equal(report.modelVersion,'1986-v7');
    assert.equal(report.allPairsChecked,false);
    assert.equal(report.pairs.length,5);
    assert(report.ground&&!report.ground.below);
    assert.equal(report.status,'clear-in-checked-scope');
  }
  const stats=Object.fromEntries(pairs1986(m).map(p=>[p.id,{broadOverlaps:0,refined:0,confirmed:0,unresolved:0}]));
  let n=0,minBucket=Infinity,minGrapple=Infinity;
  for(const yaw of [-180,-135,-90,-45,0,45,90,135,180])
  for(const boom of [0,16,32])for(const grab of [0,16,32])
  for(const loader of [0,8,16])for(const tip of [-5,10,25]){
    const p={yaw,boom,grab,loader,tip,track:0};
    m.setPose(p);n++;
    const {bucketClearance,grappleClearance}=m.auditPose();
    minBucket=Math.min(minBucket,bucketClearance);minGrapple=Math.min(minGrapple,grappleClearance);
    for(const pair of pairs1986(m)){
      assert(pair.a&&pair.b);
      const a=new T.Box3().setFromObject(pair.a),b=new T.Box3().setFromObject(pair.b);
      if(a.intersectsBox(b)){
        const item=stats[pair.id];item.broadOverlaps++;
        const result=inspectGroupPairs([pair])[0];
        assert.equal(result.broadOverlap,true);
        assert.equal(result.meshBoxPairs,0);
        item.refined++;
        if(result.status==='confirmed')item.confirmed++;
        if(result.status==='unresolved')item.unresolved++;
      }
    }
  }
  assert.equal(stats['grapple/bucket'].broadOverlaps,36);
  for(const item of Object.values(stats)){
    assert.equal(item.refined,item.broadOverlaps);
    assert.equal(item.confirmed,0);
    assert.equal(item.unresolved,0);
  }
  assert(minBucket>0&&minGrapple>0);
  assert.equal(n,729);
  assert([minBucket,minGrapple].every(Number.isFinite));
  console.log('MOBOT_1986_AUDIT '+JSON.stringify({poses:n,minBucket,minGrapple,units:'scene',pairs:stats,allPairsChecked:false,continuous:false,physicalScaleKnown:false}));
});
