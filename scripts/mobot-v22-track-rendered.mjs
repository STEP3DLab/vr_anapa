// Actual v22 Three.js meshes vs idealized polygon envelope. No historical scale.
import assert from 'node:assert/strict';
import * as T from '../mobot-assets/three.module.min.js';
import { makeMobot } from '../mobot-engineering-v22-model.js';
import ideal from './mobot-v22-tread-footprint.cjs';
globalThis.document={createElement:()=>({getContext:()=>null})};
const robot=makeMobot(T,'desktop'),m=robot.mechanisms,p=m.sourceProfile();
assert.equal(p.version,'v22-research');
const trackPath=new T.CurvePath();
p.trackContour.forEach(([x,y],i)=>{
 const [a,b]=p.trackContour[(i+1)%p.trackContour.length];
 trackPath.add(new T.LineCurve3(new T.Vector3(x,y,0),new T.Vector3(a,b,0)));
});
const P=trackPath.getLength(), count=114;
assert(Math.abs(P-ideal.perimeterScene)<1e-7);
const pads=[],cleats=[];
robot.root.traverse(o=>{
 if(!o.isInstancedMesh||o.userData.part!=='tracks'||o.count!==count)return;
 if(o.name.startsWith('Отдельные траки'))pads.push(o);else cleats.push(o);
});
assert.equal(pads.length,2);assert.equal(cleats.length,2);
const pairs=pads.map(pad=>{
 const cleat=cleats.find(o=>o.parent===pad.parent);
 assert(cleat,'Each side must have instanced cleats');
 return [pad,cleat];
});
const local=new T.Matrix4(),world=new T.Matrix4();
function info(mesh,i){
 mesh.getMatrixAt(i,local);world.multiplyMatrices(mesh.matrixWorld,local);
 assert(world.elements.every(Number.isFinite));
 const e=world.elements,b=mesh.geometry;
 const hx=b.parameters.width/2,hy=b.parameters.height/2,hz=b.parameters.depth/2;
 return {x:e[12],y:e[13],z:e[14],
  bottom:e[13]-Math.abs(e[1])*hx-Math.abs(e[5])*hy-Math.abs(e[9])*hz,
  c:e[0],s:e[1]};
}
let minPad=Infinity,minCleat=Infinity,below=0,maxCentreError=0,maxAngleError=0;
let maxCleatNormalError=0,maxSideDifference=0;
const phases=101;
for(let k=0;k<phases;k++){
 const travel=k*P/phases;
 m.setTrackPhase(travel);robot.root.updateMatrixWorld(true);
 for(let i=0;i<count;i++){
  const t=T.MathUtils.euclideanModulo(i*P/count+travel,P)/P;
  const point=trackPath.getPoint(t),tan=trackPath.getTangent(t),out=[];
  for(const [pad,cleat] of pairs){
   const a=info(pad,i),b=info(cleat,i);
   out.push([a.bottom,b.bottom]);
   maxCentreError=Math.max(maxCentreError,Math.hypot(a.x-point.x,a.y-point.y));
   maxAngleError=Math.max(maxAngleError,Math.hypot(a.c-tan.x,a.s-tan.y));
   maxCleatNormalError=Math.max(maxCleatNormalError,Math.hypot(
     b.x-a.x+tan.y*p.cleatOffset,b.y-a.y-tan.x*p.cleatOffset));
   minPad=Math.min(minPad,a.bottom);minCleat=Math.min(minCleat,b.bottom);
   if(b.bottom<p.lowerTrackDatum)below++;
  }
  maxSideDifference=Math.max(maxSideDifference,Math.abs(out[0][0]-out[1][0]),Math.abs(out[0][1]-out[1][1]));
 }
}
assert(maxCentreError<1e-9&&maxAngleError<1e-8&&maxCleatNormalError<1e-9);
assert(maxSideDifference<1e-9,'Mirrored virtual sides changed');
assert(minPad>p.lowerTrackDatum&&minCleat<p.lowerTrackDatum);
const n=30000,hxPad=P/count*.91/2,hxCleat=P/count*.62/2;
let minDensePad=Infinity,minDenseCleat=Infinity,belowDense=0;
for(let i=0;i<n;i++){
 const t=i/n,v=trackPath.getPoint(t),a=trackPath.getTangent(t);
 const pad=v.y-Math.abs(a.y)*hxPad-Math.abs(a.x)*p.padHalf;
 const cleat=v.y+a.x*p.cleatOffset-Math.abs(a.y)*hxCleat-Math.abs(a.x)*p.cleatHalf;
 minDensePad=Math.min(minDensePad,pad);minDenseCleat=Math.min(minDenseCleat,cleat);
 if(cleat<p.lowerTrackDatum)belowDense++;
}
function degrees(a,b){
 return Math.acos(T.MathUtils.clamp(a.clone().normalize().dot(b.clone().normalize()),-1,1))*180/Math.PI;
}
let polygonMaxTurn=0,nearCornerMaxTurn=0;
const curveLengths=trackPath.getCurveLengths();
for(let j=0;j<trackPath.curves.length;j++){
 polygonMaxTurn=Math.max(polygonMaxTurn,degrees(trackPath.curves[j].getTangent(0),
    trackPath.curves[(j+1)%trackPath.curves.length].getTangent(0)));
 const at=curveLengths[j]/P;
 nearCornerMaxTurn=Math.max(nearCornerMaxTurn,degrees(
    trackPath.getTangent(Math.max(0,at-1e-6)),
    trackPath.getTangent(Math.min(1,at+1e-6))));
}
const seamTurn=degrees(trackPath.getTangent(0),trackPath.getTangent(1));
assert(minDensePad>p.lowerTrackDatum&&minDenseCleat<p.lowerTrackDatum);
assert(minDenseCleat>=ideal.continuousFootprint.minCleatYScene-.0005);
const report={
 test:'v22-actual-threejs-instanced-track-geometry',
 version:p.version,modelOnly:true,scaleMeasured:false,
 trackSides:2,instancesPerSide:count,phases,
 instanceSamplesPerSide:count*phases,
 minRenderedPadYScene:+minPad.toFixed(9),
 minRenderedCleatYScene:+minCleat.toFixed(9),
 renderedCleatBelowDatumCount:below,
 approximateMinPadYDense:+minDensePad.toFixed(9),
 approximateMinCleatYDense:+minDenseCleat.toFixed(9),
 approximateFractionPathWithCleatBelowDatum:+(belowDense/n).toFixed(6),
 idealPolygonContinuousMinCleatYScene:ideal.continuousFootprint.minCleatYScene,
 polygonCornerMaxTurnDegrees:+polygonMaxTurn.toFixed(6),
 renderedTangentNearCornerMaxTurnDegrees:+nearCornerMaxTurn.toFixed(6),
 renderedSeamTangentDifferenceDegrees:+seamTurn.toFixed(6),
 maxModelPathError:+maxCentreError.toFixed(12),
 maxMeshTangentError:+maxAngleError.toFixed(12),
 maxCleatNormalError:+maxCleatNormalError.toFixed(12),
 maxInterSideYError:+maxSideDifference.toFixed(12),
 note:'The polygon-only continuous bound uses one-sided tangents; Three.CurvePath.getTangent derives finite differences and blends near corners. Dense mesh/path values are samples, not certified global extrema.',
 historicalTrackPitchVerified:false,
 realSurfaceContactVerified:false,
 hardwareTested:false
};
console.log(JSON.stringify(report,null,2));
