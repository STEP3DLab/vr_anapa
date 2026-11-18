import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../../../../mobot-assets/three.module.min.js';
import {makeMobot} from '../../../../mobot-engineering-v22-model.js';
globalThis.document={createElement:()=>({getContext:()=>null})};
const m=makeMobot(T,'desktop').mechanisms;
let maxPinOffset=0,positions=0,minGap=Infinity,maxGap=0;
for(const yaw of [-180,0,90])for(const arm of [-18,0,25]){
  let previous=-Infinity;
  for(let claw=0;claw<=24;claw++){
    m.setPose({yaw,arm,wrist:90,claw});
    const innerEdges=[];
    for(const {side,group,links,fixedPins,jawPins,end} of m.fingers){
      for(const [i,link] of links.entries()){
        for(const [point,pin] of [[new T.Vector3(),fixedPins[i]],[end.clone(),jawPins[i]]]){
          const error=link.localToWorld(point).distanceTo(pin.getWorldPosition(new T.Vector3()));
          maxPinOffset=Math.max(maxPinOffset,error);
        }
      }
      const inner=group.children.find(o=>o.geometry?.type==='BoxGeometry');
      assert(inner);
      const face=inner.geometry.attributes.position, lateral=[];
      for(let i=0;i<face.count;i++){
        const world=inner.localToWorld(new T.Vector3().fromBufferAttribute(face,i));
        lateral.push(side*m.fingerHead.worldToLocal(world).y);
      }
      innerEdges.push(Math.min(...lateral));
    }
    const gap=innerEdges[0]+innerEdges[1];
    assert(gap>0 && gap>previous);
    previous=gap;minGap=Math.min(minGap,gap);maxGap=Math.max(maxGap,gap);positions++;
  }
}
assert(maxPinOffset<1e-10);
const record={positions,pinEndpointsPerPosition:8,maxPinOffset,minGap,maxGap,units:'uncalibrated scene coordinates'};
fs.writeFileSync(new URL('jaw-linkage.json',import.meta.url),JSON.stringify(record,null,2)+'\n');
console.log(record);
