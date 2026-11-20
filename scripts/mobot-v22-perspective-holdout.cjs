// Independent, dimensionless cross-view wheel-axis check for the 1987 research model.
// Usage: node scripts/mobot-v22-perspective-holdout.cjs
// Three fitted anchors, four held-out centres; this is NOT camera calibration or proof of 3D wheel geometry.
'use strict';
const assert=require('node:assert/strict');
const ledger=require('../mobot-qa/demo-2026-11-18/sktb-2-landmarks-manual.json');
const photoSide=require('../research/mobot/1987/night-20261118/photo-side.json');
const views=Object.fromEntries(photoSide.views.map(v=>[v.id,v]));
assert(views.SKTB2 && views.SKTB4,'SKTB photo #2/#4 landmarks missing');
assert.deepEqual(ledger.imageSize,[views.SKTB2.width,views.SKTB2.height]);
const keys=['r1','r2','r3','r4','r5','r6','r7'];
const x=keys.map((k,i)=>{
  assert.equal(views.SKTB2.centres[k][0],ledger.lowerWheelsLeftToRight[i].center[0],
    'Photo #2 manual ledger changed; re-fit rather than silently reusing results');
  return views.SKTB2.centres[k][0];
});
const y=keys.map(k=>views.SKTB4.centres[k][0]);
function solve3(rows,values){
  const m=rows.map((r,i)=>[...r,values[i]]);
  for(let c=0;c<3;c++){
    let p=c;for(let i=c+1;i<3;i++)if(Math.abs(m[i][c])>Math.abs(m[p][c]))p=i;
    assert(Math.abs(m[p][c])>1e-12,'degenerate image registration');
    [m[c],m[p]]=[m[p],m[c]];
    const div=m[c][c];for(let j=c;j<4;j++)m[c][j]/=div;
    for(let i=0;i<3;i++)if(i!==c){
      const factor=m[i][c];for(let j=c;j<4;j++)m[i][j]-=factor*m[c][j];
    }
  }
  return m.map(row=>row[3]);
}
function fitProjective(anchors){
  // Only a one-dimensional projectivity on projected horizontal centres:
  // y=(a*x+b)/(c*x+1), with 3 correspondences and 4 independent residuals.
  const [a,b,c]=solve3(anchors.map(i=>[x[i],1,-x[i]*y[i]]),anchors.map(i=>y[i]));
  const denominatorAtEnds=[1+c*x[0],1+c*x.at(-1)];
  assert(denominatorAtEnds.every(t=>Number.isFinite(t)&&t>0.5),
    'unphysical singular or reversed mapping within the observed wheel span');
  return {coefficients:[a,b,c],denominatorAtEnds,
    predict:u=>(a*u+b)/(c*u+1)};
}
const fitAffine=anchors=>{
  const [p,q]=anchors;
  return u=>y[p]+(u-x[p])*(y[q]-y[p])/(x[q]-x[p]);
};
const rms=values=>Math.sqrt(values.reduce((sum,v)=>sum+v*v,0)/values.length);
function evaluate(anchors){
  const projective=fitProjective(anchors);
  const withheld=keys.map((_,i)=>i).filter(i=>!anchors.includes(i));
  const errors=withheld.map(i=>y[i]-projective.predict(x[i]));
  const anchorResiduals=anchors.map(i=>y[i]-projective.predict(x[i]));
  assert(anchorResiduals.every(r=>Math.abs(r)<1e-6),'Projective fit failed anchors');
  assert(y.every(Number.isFinite)&&x.every(Number.isFinite));
  return {
    fitWheelIds:anchors.map(i=>keys[i]),
    withheldWheelIds:withheld.map(i=>keys[i]),
    coefficients:projective.coefficients,
    denominatorAtEnds:projective.denominatorAtEnds,
    rmsWithheldPx:+rms(errors).toFixed(4),
    heldout:withheld.map((i,j)=>({
      wheel:keys[i], measuredXPx:y[i],
      predictedXPx:+projective.predict(x[i]).toFixed(4),
      residualPx:+errors[j].toFixed(4)
    }))
  };
}
const primary=evaluate([0,3,6]); // left, central, right; fixed before scoring 4 other wheels
const alternate1=evaluate([0,2,6]);
const alternate2=evaluate([0,4,6]);
const affine=fitAffine([0,6]);
const matchingHoldout=[1,2,4,5];
const affineRmsPx=rms(matchingHoldout.map(i=>y[i]-affine(x[i])));
assert(primary.rmsWithheldPx<affineRmsPx,'Perspective test does not improve held-out residual');
assert(primary.rmsWithheldPx<4,'Cross-view score changed: inspect archival image and manual picks');
assert(alternate1.rmsWithheldPx<4&&alternate2.rmsWithheldPx<4,
  'Projectivity result sensitive to a single central anchor; re-check picks');
const report={
  test:'1987-v22-cross-view-projectivity-holdout',
  date:'2026-11-20',
  sourcePhoto2:ledger.source,
  sourcePhoto4:'https://sktbpr.ru/foto-alb/65',
  sourceLandmarks:['mobot-qa/demo-2026-11-18/sktb-2-landmarks-manual.json',
    'research/mobot/1987/night-20261118/photo-side.json'],
  model:'mobot-engineering-v22-model.js (unchanged)',
  observable:'x-coordinate of 7 manually identified lower wheel-centre features',
  comparison:'SKTB #2 to independently annotated SKTB #4; image #4 width 1000 px',
  affineEndpointAnchors:['r1','r7'],
  affineRmsOnMatchingFourHeldoutsPx:+affineRmsPx.toFixed(4),
  primary,
  anchorSensitivity:[alternate1,alternate2].map(v=>({
    fitWheelIds:v.fitWheelIds,withheldWheelIds:v.withheldWheelIds,rmsWithheldPx:v.rmsWithheldPx
  })),
  independentImage4PickingUncertaintyPx:views.SKTB4.uncertainty,
  image2PickingUncertaintyPx:views.SKTB2.uncertainty,
  geometryRevised:false,
  originalWheelDimensionsEstablished:false,
  perspectiveCameraCalibrated:false,
  suspensionProven:false,
  conclusion:'A 1D projective mapping explains the extra systematic shift seen with the two-endpoint affine model. This is compatible with perspective and does NOT prove factory axle positions or justify changing v22 geometry.',
  limitations:'Three anchors consume an extra degree of freedom versus affine; only four residuals remain and wheel centres were picked manually. Side depth, y coordinates, camera intrinsics, projection distortion, wheel occlusion and historical physical dimensions are not identified. A 1D projectivity is not 3D photogrammetry. The choice of anchors is fixed and alternative middle anchors are reported for sensitivity.'
};
if(require.main===module)console.log(JSON.stringify(report,null,2));
module.exports=report;
