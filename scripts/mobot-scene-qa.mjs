// Actual THREE scene graph and transforms; this is NOT a WebGL test.
import * as T from '../mobot-assets/three.module.min.js';
import {makeMobot1986} from '../mobot-ch-hv-1986-research-v5-model.js';
import {makeMobot} from '../mobot-engineering-v20-model.js';
import {makeMobot as makeV19} from '../mobot-engineering-v19-model.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
// Only decorative CanvasTexture generation is unavailable in Node. No THREE stub.
globalThis.document={createElement:()=>({getContext:()=>null})};
const models=[['1986-v5',makeMobot1986(T)],['1987-v20',makeMobot(T,'desktop')],['1987-v19',makeV19(T,'desktop')]];
const report={engine:'real vendored THREE geometry under Node; no WebGL',canvasTextureGenerated:false,models:[],latestPreserved:fs.readFileSync(new URL('../mobot-latest.html',import.meta.url),'utf8').includes('mobot-engineering-v17.html')};
assert(report.latestPreserved);
for(const [name,m] of models){
 m.root.updateMatrixWorld(true);let meshes=0,instances=0,vertices=0,invalid=0;
 m.root.traverse(o=>{if(!o.matrixWorld.elements.every(Number.isFinite))invalid++;if(o.isMesh){meshes++;instances+=o.isInstancedMesh?o.count:1;const p=o.geometry.attributes.position;vertices+=p.count;for(let i=0;i<p.array.length;i++)if(!Number.isFinite(p.array[i]))invalid++;}});
 assert.equal(invalid,0,name+' finite geometry');
 const b=new T.Box3().setFromObject(m.root);assert(!b.isEmpty());const profile=name==='1986-v5'?m.sourceProfile():m.mechanisms.sourceProfile();
 const xs=profile.wheelXs,rs=profile.visibleWheelOuterRadiiScene||xs.map(()=>profile.wheelRadius);const overlaps=[];
 for(let i=0;i<xs.length-1;i++)if(rs[i]+rs[i+1]>xs[i+1]-xs[i]+1e-8)overlaps.push(i);assert.equal(overlaps.length,0);
 let poses=0,negativeClearances=0;const neutralModelRange=[];
 if(name==='1986-v5'){
  for(const yaw of [-180,0,180])for(const boom of [-40,-15,12])for(const loader of [-8,0,22])for(const tip of [-20,0,20])for(const grab of [0,20]){
   m.setPose({yaw,boom,loader,tip,grab});const q=m.auditPose();assert(Number.isFinite(q.bucketClearance));assert(Number.isFinite(q.grappleClearance));if(Math.min(q.bucketClearance,q.grappleClearance)<0)negativeClearances++;poses++;
  }
  m.setPose(m.defaults);
 }else{
  for(const yaw of [-180,0,180])for(const arm of [-18,0,25])for(const bucket of [-8,0,36])for(const tip of [-25,0,25]){
   const q=m.mechanisms;q.turntable.rotation.y=T.MathUtils.degToRad(yaw);q.arm.rotation.z=T.MathUtils.degToRad(arm);q.gripper.rotation.z=T.MathUtils.degToRad(90-arm);q.bucketLift.rotation.z=-T.MathUtils.degToRad(bucket);q.bucketTilt.rotation.z=T.MathUtils.degToRad(tip);q.updateLinkages();m.root.updateMatrixWorld(true);const check=q.estimateBucketClearance();assert(Number.isFinite(check.relativeClearanceScene));if(check.underNominalPlane)negativeClearances++;poses++;
  }
  for(const tool of ['gripper','breaker-arm','breaker-loader'])assert.equal(m.mechanisms.setWorkTool(tool),tool);
  if(name==='1987-v20'){
   const boom=m.mechanisms.arm.children.find(o=>o.type==='Group'&&Math.abs(o.scale.x-.86)<1e-6);
   const pin=new T.Vector3(-1.46,.01,0);boom.localToWorld(pin);const head=new T.Vector3();m.mechanisms.gripper.getWorldPosition(head);assert(pin.distanceTo(head)<1e-9,'distal head attaches to pin');
   neutralModelRange.push({distalPinGap:pin.distanceTo(head)});
  }
 }
 report.models.push({name,meshes,instances,vertices,finiteGeometry:true,box:{min:b.min.toArray(),max:b.max.toArray()},wheelAdjacentCircleOverlaps:overlaps.length,poseSamples:poses,negativeClearances,checks:neutralModelRange,fullCollisionDetection:false});
}
fs.writeFileSync(new URL('../mobot-qa/demo-2026-11-18/scene-report.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
