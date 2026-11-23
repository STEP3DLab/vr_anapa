// Research-only kinematic envelope: 1987 Ch-HV-2 v22 track links vs nominal support plane.
// Run: node scripts/mobot-v22-tread-footprint.cjs
// Tests the actual v22 polygon construction, not measured wheel dimensions or physical terrain.
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const model=fs.readFileSync(path.join(root,'mobot-engineering-v22-model.js'),'utf8');
const canonical=fs.readFileSync(path.join(root,'mobot-kinematics-v15.js'),'utf8');
const ledger=JSON.parse(fs.readFileSync(path.join(root,'mobot-qa/demo-2026-11-18/sktb-2-landmarks-manual.json'),'utf8'));
assert(model.includes('sourceTrackProfile=halfHull(support).concat(halfHull([...support].reverse())).reverse()'));
assert(model.includes('const linkCount=114;'));
assert(model.includes('const treadGeo=new THREE.BoxGeometry(P/linkCount*.91,2*padHalf,.298)'));
assert(model.includes('const shoeGeo=new THREE.BoxGeometry(P/linkCount*.62,2*cleatHalf,.310)'));
assert(model.includes('b.position.set(x+nx*cleatOffset,y+ny*cleatOffset,0)'));
assert(model.includes('cleatTransform.position.set(x-Math.sin(ang)*cleatOffset,y+Math.cos(ang)*cleatOffset,0)'));
assert(model.includes('trackSide(-.63,-1);trackSide(.63,1)'));
const mm=canonical.match(/groundY:\s*(0?\.\d+)/);
assert(mm,'Canonical nominal datum missing');
const groundY=Number(mm[1]);
const a=model.indexOf('  const pixelScale =');
const b=model.indexOf('  const path=new THREE.CurvePath();',a);
assert(a>=0&&b>a,'Track source section moved: review extraction');
const source=model.slice(a,b);
// Evaluate only the self-contained source section in an isolated VM with a finite timeout.
const scene=vm.runInNewContext('(function(){'+source+
  ';return {sourceTrackProfile,lowerWheels,endWheels,padHalf,cleatOffset,cleatHalf};})()',
  {PROFILE_V15:{groundY}},{timeout:1000});
const {sourceTrackProfile:points,lowerWheels,endWheels,padHalf,cleatOffset,cleatHalf}=scene;
assert.equal(lowerWheels.length,7);
assert.equal(endWheels.length,2);
assert.equal(points.length>20,true);
const scale=1.78/(1980-238);
for(const [i,w] of ledger.lowerWheelsLeftToRight.entries()){
  assert(Math.abs(w.outerDiscRadius*scale-lowerWheels[i].r)<1e-12);
  assert(Math.abs((.89-(w.center[0]-238)*scale)-lowerWheels[i].x)<1e-12);
}
const area=points.reduce((sum,p,i)=>{
  const next=points[(i+1)%points.length];
  return sum+p[0]*next[1]-next[0]*p[1];
},0)/2;
assert(area<0,'Track winding changed: current left-normal calculation is not verified');
const segments=points.map((p,i)=>{
  const q=points[(i+1)%points.length],dx=q[0]-p[0],dy=q[1]-p[1];
  return {x:p[0],y:p[1],dx,dy,length:Math.hypot(dx,dy)};
});
assert(segments.every(s=>s.length>1e-9));
const perimeter=segments.reduce((sum,s)=>sum+s.length,0);
const linkCount=114;
function at(distance){
  let d=((distance%perimeter)+perimeter)%perimeter;
  for(const s of segments){
    if(d<=s.length) {
      const ratio=d/s.length;
      return {x:s.x+ratio*s.dx,y:s.y+ratio*s.dy,
        c:s.dx/s.length,s:s.dy/s.length};
    }
    d-=s.length;
  }
  throw Error('No track segment');
}
const halfPadX=perimeter/linkCount*.91/2;
const halfShoeX=perimeter/linkCount*.62/2;
let minPadY=Infinity,minCleatY=Infinity;
let worstWheelPadGap=Infinity,worstWheelCleatGap=Infinity;
let sampledIntersections=0;
const phases=101,allWheels=[...lowerWheels,...endWheels];
for(let p=0;p<phases;p++){
  for(let i=0;i<linkCount;i++){
    const {x,y,c,s}=at(i*perimeter/linkCount+p*perimeter/phases);
    const padY=y-Math.abs(s)*halfPadX-Math.abs(c)*padHalf;
    const cleatY=y+c*cleatOffset-Math.abs(s)*halfShoeX-Math.abs(c)*cleatHalf;
    minPadY=Math.min(minPadY,padY);
    minCleatY=Math.min(minCleatY,cleatY);
    if(cleatY<groundY)sampledIntersections++;
    for(const w of allWheels){
      function clearance(cx,cy,hx,hy){
        const dx=w.x-cx,dy=w.y-cy;
        const lx=dx*c+dy*s,ly=-dx*s+dy*c;
        return Math.hypot(Math.max(Math.abs(lx)-hx,0),Math.max(Math.abs(ly)-hy,0))-w.r;
      }
      worstWheelPadGap=Math.min(worstWheelPadGap,clearance(x,y,halfPadX,padHalf));
      worstWheelCleatGap=Math.min(worstWheelCleatGap,
        clearance(x-s*cleatOffset,y+c*cleatOffset,halfShoeX,cleatHalf));
    }
  }
}
assert(worstWheelPadGap>=-1e-8,'Nominal track-pad section intersects a scene wheel disc');
assert(worstWheelCleatGap>=-1e-8,'Nominal track cleat section intersects a scene wheel disc');
const scenePenetration=Math.max(0,groundY-Math.min(minPadY,minCleatY));
assert(scenePenetration<.005,
  'Nominal ground intrusion grew >.005 scene units: inspect track geometry and photo basis');

  // Segmentwise continuous envelope: each bottom corner height is affine along
  // a straight path segment; both one-sided tangent frames are tested at corners.
  function bottomAt(s,cleat,end){
    const c=s.dx/s.length,t=s.dy/s.length,y=s.y+(end?s.dy:0);
    return cleat
      ? y+c*cleatOffset-Math.abs(t)*halfShoeX-Math.abs(c)*cleatHalf
      : y-Math.abs(t)*halfPadX-Math.abs(c)*padHalf;
  }
  function belowDatumLength(s,cleat){
    const a=bottomAt(s,cleat,false),b=bottomAt(s,cleat,true);
    if(Math.max(a,b)<groundY)return s.length;
    if(Math.min(a,b)>=groundY)return 0;
    const fraction=(groundY-a)/(b-a);
    return s.length*(a<groundY?fraction:1-fraction);
  }
  let continuousPad=Infinity,continuousCleat=Infinity,cleatLength=0,padLength=0,maxTurn=0;
  for(let i=0;i<segments.length;i++){
    const s=segments[i],p=segments[(i+segments.length-1)%segments.length];
    continuousPad=Math.min(continuousPad,bottomAt(s,false,false),bottomAt(s,false,true));
    continuousCleat=Math.min(continuousCleat,bottomAt(s,true,false),bottomAt(s,true,true));
    cleatLength+=belowDatumLength(s,true);padLength+=belowDatumLength(s,false);
    maxTurn=Math.max(maxTurn,Math.abs(Math.atan2(p.dx*s.dy-p.dy*s.dx,p.dx*s.dx+p.dy*s.dy)));
  }
  const continuousPenetration=Math.max(0,groundY-Math.min(continuousPad,continuousCleat));
  const continuousFraction=cleatLength/perimeter;
  const maxTurnDeg=maxTurn*180/Math.PI;
  assert(continuousPad<=minPadY+1e-10&&continuousCleat<=minCleatY+1e-10,
    'Continuous envelope must enclose all phase samples');
  assert(continuousPenetration+1e-10>=scenePenetration,
    'Phase sampling cannot be lower than the continuous bound');
  assert(padLength<1e-10,'Unexpected virtual tread-pad intersection with datum');
  assert(Math.abs(continuousPenetration-0.00110125434643)<1e-8,
    'Frozen v22 continuous extreme changed; revisit the model assumption');
  assert(Math.abs(continuousFraction-0.28812395373206)<1e-7,
    'Frozen v22 below-datum path fraction changed; review provenance');
  assert(Math.abs(maxTurnDeg-3.75)<1e-5,
    'Frozen v22 tangent discontinuity changed; review link mechanics');
  const continuousFootprint={
    method:'piecewise linear exact segment envelope; both one-sided corner limits',
    modelOnly:true,
    minPadYScene:+continuousPad.toFixed(9),
    minCleatYScene:+continuousCleat.toFixed(9),
    maxBelowDatumScene:+continuousPenetration.toFixed(9),
    pathLengthWithCleatBelowDatumScene:+cleatLength.toFixed(9),
    fractionOfPathWithCleatBelowDatum:+continuousFraction.toFixed(9),
    maxTangentJumpDegrees:+maxTurnDeg.toFixed(6),
    realTrackPitchMeasured:false,
    historicalGroundContactCertified:false,
    note:'Virtual path length fraction, not the physical contact area or an operating probability.'
  };

const report={
  test:'mobot-v22-track-footprint-envelope',date:'2026-11-23',
  model:'mobot-engineering-v22-model.js',nominalModelOnly:true,
  provenance:['https://sktbpr.ru/foto-alb/65',
    'mobot-qa/demo-2026-11-18/sktb-2-landmarks-manual.json'],
  winding:'clockwise',trackSides:2,linkCountPerSide:linkCount,
  sampledPhases:phases,samplesPerSide:phases*linkCount,
  polylineVertices:points.length,perimeterScene:+perimeter.toFixed(9),
  groundDatumScene:groundY,
  minPadYScene:+minPadY.toFixed(9),minCleatYScene:+minCleatY.toFixed(9),
  maxBelowDatumScene:+scenePenetration.toFixed(9),
  sampleLinkCentersWithCleatBelowDatum:sampledIntersections,
  minWheelDiscToPadGapScene:+worstWheelPadGap.toFixed(9),
  minWheelDiscToCleatGapScene:+worstWheelCleatGap.toFixed(9),
  continuousFootprint,
  QAStatus:scenePenetration>1e-6?'WARNING_TREAD_CLEAT_INTERSECTS_NOMINAL_PLANE':'NOMINAL_PLANE_CLEAR',
  historicalDimensionsCertified:false,trackLinkPitchCertified:false,
  historicalGroundContactCertified:false,measuredAxleSpacingCertified:false,
  browserAndGPUNotExecutedByThisTest:true,
  note:'A model-only support-plane intrusion is not real soil contact or a historical measurement. The photographed axle radii, depth, tread flexibility and physical support plane remain unknown.'
};
if(require.main===module) console.log(JSON.stringify(report,null,2));
module.exports=report;
