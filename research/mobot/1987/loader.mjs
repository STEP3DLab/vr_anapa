import assert from 'node:assert/strict';
import * as T from '../../../mobot-assets/three.module.min.js';
import {makeMobot} from '../../../mobot-engineering-v21-model.js';
globalThis.document={createElement:()=>({getContext:()=>null})};
const robot=makeMobot(T,'mobile'),m=robot.mechanisms;
let maxError=0;
for(const lift of [-8,0,12,36])for(const tip of [-25,0,25]){
  m.bucketLift.rotation.z=-T.MathUtils.degToRad(lift);m.bucketTilt.rotation.z=T.MathUtils.degToRad(tip);
  m.updateLinkages();robot.root.updateMatrixWorld(true);
  const actual=new T.Box3().setFromObject(m.blade,true).min.y;
  maxError=Math.max(maxError,Math.abs(actual-m.auditBucketPose().lowestPoint.y));
  for(let i=0;i<2;i++){
    const v=new T.Vector3(0,.5,0);
    maxError=Math.max(maxError,m.loaderScrews[i].o.localToWorld(v).distanceTo(m.liftPins[i].getWorldPosition(new T.Vector3())));
    v.set(0,-.5,0);
    maxError=Math.max(maxError,m.loaderHousings[i].o.localToWorld(v).distanceTo(m.framePins[i].getWorldPosition(new T.Vector3())));
  }
}
assert(maxError<1e-8);
console.log(JSON.stringify({poses:12,maxError}));
