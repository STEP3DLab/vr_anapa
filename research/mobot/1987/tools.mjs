import * as T from '../../../mobot-assets/three.module.min.js';
import {makeMobot} from '../../../mobot-engineering-v21-model.js';
import assert from 'node:assert/strict';
globalThis.document={createElement:()=>({getContext:()=>null})};
const {mechanisms:m}=makeMobot(T,'desktop');
for(const [i,mode] of ['gripper','breaker-arm','breaker-loader','gripper'].entries()){
  m.setWorkTool(mode);
  assert.deepEqual([m.fingerHead,m.breakerArm,m.breakerLoader].map(o=>o.visible),
    [mode==='gripper',mode==='breaker-arm',mode==='breaker-loader']);
  assert.equal(m.scoopShell.visible,mode!=='breaker-loader');
  m.bucketTilt.rotation.z=i*.13;
  assert(m.breakerLoader.getWorldPosition(new T.Vector3()).distanceTo(m.bucketTilt.getWorldPosition(new T.Vector3()))<1e-10);
}
const gap=angle=>{
  for(const {group,side} of m.fingers)group.rotation.z=-side*angle;
  return Math.abs(m.fingers[0].group.localToWorld(new T.Vector3(-.41,-.1,0)).z-
      m.fingers[1].group.localToWorld(new T.Vector3(-.41,.1,0)).z);
};
const closed=gap(0),opened=gap(.38);
assert(opened>closed);
console.log(JSON.stringify({toolSwitches:4,closed,opened}));
