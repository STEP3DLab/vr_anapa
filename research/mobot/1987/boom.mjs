import assert from 'node:assert/strict';
import * as T from '../../../mobot-assets/three.module.min.js';
import {makeMobot} from '../../../mobot-engineering-v21-model.js';
globalThis.document={createElement:()=>({getContext:()=>null})};
const m=makeMobot(T,'desktop').mechanisms;
const position=o=>o.getWorldPosition(new T.Vector3());
let largestGap=0, poses=0;
for(const yaw of [-180,-91,0,65,180])for(const lift of [-18,0,25]){
  m.turntable.rotation.y=T.MathUtils.degToRad(yaw);
  m.arm.rotation.z=T.MathUtils.degToRad(lift);
  m.updateLinkages();
  const gaps=[position(m.gripper).distanceTo(position(m.distalPin)),
    m.actuatorArmHousing.localToWorld(new T.Vector3(0,-.5,0)).distanceTo(position(m.armFixed)),
    m.actuatorArmScrew.localToWorld(new T.Vector3(0,.5,0)).distanceTo(position(m.armMoving))];
  largestGap=Math.max(largestGap,...gaps);poses++;
}
assert(largestGap<1e-8);
console.log(JSON.stringify({poses,largestGap}));
