// Prospective closed-curve tangent; test only, no mutation to released model.
import assert from 'node:assert/strict';
import * as T from '../mobot-assets/three.module.min.js';
import {makeMobot} from '../mobot-engineering-v22-model.js';
globalThis.document={createElement:()=>({getContext:()=>null})};
const p=makeMobot(T,'desktop').mechanisms.sourceProfile();
assert.equal(p.version,'v22-research');
const path=new T.CurvePath();
p.trackContour.forEach(([x,y],i)=>{
  const [a,b]=p.trackContour[(i+1)%p.trackContour.length];
  path.add(new T.LineCurve3(new T.Vector3(x,y,0),new T.Vector3(a,b,0)));
});
const h=1e-4,wrap=t=>T.MathUtils.euclideanModulo(t,1);
function periodicTangent(t){
  return path.getPoint(wrap(t+h)).sub(path.getPoint(wrap(t-h))).normalize();
}
const degrees=(a,b)=>Math.atan2(a.clone().cross(b).length(),a.dot(b))*180/Math.PI;
const baseJump=degrees(path.getTangent(0),path.getTangent(1));
const candidateJump=degrees(periodicTangent(0),periodicTangent(1));
const nearJump=degrees(periodicTangent(1-1e-8),periodicTangent(1e-8));
let outsideMax=0;
for(let i=1;i<30000;i++){
  const t=i/30000;
  if(t<=h||t>=1-h)continue;
  outsideMax=Math.max(outsideMax,degrees(path.getTangent(t),periodicTangent(t)));
}
assert(Math.abs(baseJump-3.75)<1e-5);
assert(candidateJump<1e-7 && nearJump<.001 && outsideMax<1e-7);
const P=path.getLength(),N=114,wheels=[...p.lowerWheels,...p.terminalWheels];
assert.equal(wheels.length,9);
const report=[];
for(const [label,direction] of [['baseline',t=>path.getTangent(t)],['periodic',periodicTangent]]){
  let minPad=Infinity,minCleat=Infinity,minGap=Infinity,seamGap=Infinity;
  function sample(t,seam){
    const v=path.getPoint(t),a=direction(t),hx=P/N*.91/2,chx=P/N*.62/2;
    minPad=Math.min(minPad,v.y-Math.abs(a.y)*hx-Math.abs(a.x)*p.padHalf);
    minCleat=Math.min(minCleat,v.y+a.x*p.cleatOffset-Math.abs(a.y)*chx-Math.abs(a.x)*p.cleatHalf);
    for(const w of wheels){
      const x=w.x-v.x,y=w.y-v.y;
      const u=Math.max(0,Math.abs(x*a.x+y*a.y)-hx);
      const k=Math.max(0,Math.abs(-x*a.y+y*a.x)-p.padHalf);
      const gap=Math.hypot(u,k)-w.r;
      minGap=Math.min(minGap,gap);if(seam)seamGap=Math.min(seamGap,gap);
    }
  }
  for(let i=0;i<30000;i++)sample(i/30000,false);
  for(let i=0;i<=2000;i++)sample(wrap(-h+2*h*i/2000),true);
  assert(minGap>=0);
  report.push({label,minPad,minCleat,minGap,seamGap});
}
assert(Math.abs(report[0].minCleat-report[1].minCleat)<1e-7);
assert(Math.abs(report[0].minPad-report[1].minPad)<1e-7);
console.log(JSON.stringify({modelOnly:true,actualThreeRuntime:true,actualCandidateMeshes:false,physicalScaleKnown:false,baseJump,candidateJump,nearJump,outsideMax,denseSamples:30000,seamSamples:2001,report},null,2));
