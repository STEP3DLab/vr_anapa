import {poses} from './poses.js';
// Offline surface audit. Only compares disjoint active assemblies named by inspectPose.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../../../../mobot-assets/three.module.min.js';
import {makeMobot as before} from '../../../../mobot-engineering-v21-model.js';
import {makeMobot as after} from '../../../../mobot-engineering-v22-model.js';
globalThis.document={createElement:()=>({getContext:()=>null})};
import {contact,inspectSurfaces} from './contact.js';
function selfTest(){
  const mesh=(coords,name)=>{const points=coords.map(p=>new T.Vector3(...p));return {points,name,
    object:{geometry:{}},box:new T.Box3().setFromPoints(points)};};
  const base=mesh([[0,0,0],[1,0,0],[0,1,0]],'base');
  assert(contact(base,mesh([[.2,.2,-1],[.2,.2,1],[.4,.3,0]],'cross')));
  assert(contact(base,mesh([[.9,-.1,0],[.9,.9,0],[1.1,1,0]],'coplanar')));
  assert(!contact(base,mesh([[.8,.8,0],[.8,2,0],[2,.8,0]],'disjoint')));
}
selfTest();
const defaults={yaw:0,arm:0,wrist:90,claw:4,bucket:8,tip:0};
const demos=[['gripper',{}],['gripper',{yaw:180,arm:-8,bucket:0}],
  ['gripper',{yaw:90,claw:22,bucket:0}],['breaker-arm',{yaw:-65,arm:22,wrist:60,bucket:0}],
  ['breaker-loader',{bucket:36}],['gripper',{yaw:90,bucket:32,tip:-10}]];
const modes=['gripper','breaker-arm','breaker-loader'];
function sweep(build,presets){
  const model=build(T,'desktop'), m=model.mechanisms;
  const hood=model.meshes.find(o=>o.name.startsWith('Кожух с плоской'));
  const rows=[];
  function audit(tool,pose,demo=false){
    m.setWorkTool(tool);m.setPose({...defaults,...pose});
    const broad=m.inspectPose();
    const {ground,envelopes,clearance}=inspectSurfaces(m,hood,tool,broad);
    assert(Math.abs(broad.clearance-clearance)<1e-8);
    assert.equal(broad.alerts.length,envelopes.length+Number(!!ground));
    return {tool,pose,demo,ground,envelopes};
  }
  for(const tool of modes)for(const yaw of [-180,0,90])for(const arm of [-18,0,25])
    for(const bucket of [-8,12,36])rows.push(audit(tool,{yaw,arm,bucket,claw:8}));
  const demoRows=presets.map(([tool,pose])=>audit(tool,pose,true));
  assert(demoRows.every(r=>!r.ground&&!r.envelopes.length));
  const all=rows.flatMap(r=>r.envelopes);
  const counts={flagged:rows.filter(r=>r.ground||r.envelopes.length).length,
    below:rows.filter(r=>r.ground).length,envelopes:all.length,
    surfacePairs:all.filter(e=>e.hits.length).length,
    confirmedPoses:rows.filter(r=>r.ground||r.envelopes.some(e=>e.hits.length)).length};
  return {counts,rows,demoRows};
}
const data={defaults,v21:sweep(before,demos),v22:sweep(after,poses.map(([,tool,pose])=>[tool,pose]))};
assert.equal(data.v21.counts.flagged,50);
fs.writeFileSync(new URL('contact-sweep.json',import.meta.url),JSON.stringify(data)+'\n');
for(const rev of ['v21','v22'])console.log(rev,data[rev].counts);
