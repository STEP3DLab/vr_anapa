import assert from 'node:assert/strict';
import * as T from '../../../mobot-assets/three.module.min.js';
import {makeMobot} from '../../../mobot-engineering-v21-model.js';
globalThis.document={createElement:()=>({getContext:()=>null})};
const model=makeMobot(T,'desktop'), p=model.mechanisms.sourceProfile();
const discs=[...p.lowerWheels,...p.terminalWheels];
let discGap=Infinity, padGap=Infinity;
for(let i=0;i<discs.length;i++){
  const {x,y,r}=discs[i];
  for(const d of discs.slice(i+1))discGap=Math.min(discGap,Math.hypot(x-d.x,y-d.y)-r-d.r);
}
const belts=model.meshes.filter(o=>o.name==='Отдельные полиуретановые траки');
assert.equal(belts.length,2);
for(const phase of [0,.013,.37,1.2]){
  model.mechanisms.setTrackPhase(phase);
  for(const belt of belts){
    belt.geometry.computeBoundingBox();
    const bounds=belt.geometry.boundingBox, matrix=new T.Matrix4();
    for(let i=0;i<belt.count;i++){
      belt.getMatrixAt(i,matrix);
      assert(matrix.elements.every(Number.isFinite));matrix.invert();
      for(const d of discs){
        const pt=new T.Vector3(d.x,d.y,0).applyMatrix4(matrix);
        padGap=Math.min(padGap,bounds.distanceToPoint(pt)-d.r);
      }
    }
  }
}
assert(discGap>0);assert(padGap>=-1e-6,`track penetrates a wheel by ${-padGap}`);
console.log(JSON.stringify({discsPerSide:discs.length,belts:belts.length,phases:4,discGap,padGap},null,2));
