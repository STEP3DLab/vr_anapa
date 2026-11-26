// Projective check on a coarse manual reading of published Fig.2, not historical metrology.
'use strict';
const assert=require('node:assert/strict');
const ledger=require('../mobot-qa/demo-2026-11-18/sktb-2-landmarks-manual.json');
const note=require('../research/mobot/1987/2026-11-26-alma-mater-figure2-landmarks.json');
function audit(ledger,note){
 const original=ledger.lowerWheelsLeftToRight.map(w=>w.center[0]).reverse();
 const x=original.map(v=>(original[0]-v)/(original[0]-original.at(-1)));
 const y=note.wheelXApproxPx, u=note.wheelXPickingTolerancePx;
 assert.equal(x.length,7);assert.equal(y.length,7);
 const rms=v=>Math.sqrt(v.reduce((s,t)=>s+t*t,0)/v.length);
 function fit(x,y,anchors){
  const m=anchors.map(i=>[x[i],1,-x[i]*y[i],y[i]]);
  for(let c=0;c<3;c++){let p=c;for(let i=c+1;i<3;i++)if(Math.abs(m[i][c])>Math.abs(m[p][c]))p=i;[m[c],m[p]]=[m[p],m[c]];let d=m[c][c];assert(Math.abs(d)>1e-10,'singular registration');for(let j=c;j<4;j++)m[c][j]/=d;for(let i=0;i<3;i++)if(i!==c){let f=m[i][c];for(let j=c;j<4;j++)m[i][j]-=f*m[c][j];}}
  let [a,b,c]=m.map(r=>r[3]);assert(1+c>0.5,'unstable denominator');
  return {coefficients:[a,b,c],predictions:x.map(t=>(a*t+b)/(1+c*t))};
 }
 function evalFit(x,y,anchors){
  const f=fit(x,y,anchors),held=y.map((v,i)=>({index:i,residual:v-f.predictions[i]})).filter(o=>!anchors.includes(o.index));
  return {anchors,coefficients:f.coefficients,heldout:held,rmsPx:rms(held.map(o=>o.residual))};
 }
 const primary=evalFit(x,y,[0,3,6]),other=[[0,2,6],[0,4,6]].map(a=>evalFit(x,y,a));
 const h=[1,2,4,5],affineRms=rms(h.map(i=>y[i]-(y[0]+x[i]*(y[6]-y[0]))));
 const equal=Array.from({length:7},(_,i)=>i/6),equalAffineRms=rms(h.map(i=>y[i]-(y[0]+equal[i]*(y[6]-y[0])))),equalProjective=evalFit(equal,y,[0,3,6]);
 // Deliberately vary all 7 target picks at both extremes: 128 sign corners.
 // Sensitivity scenarios are not confidence intervals and are not an exhaustive continuum proof.
 let lo=Infinity,hi=0,eLo=Infinity,eHi=0,valid=0,rejected=0,preferExisting=0;
 for(let mask=0;mask<128;mask++){
  const z=y.map((v,i)=>v+((mask>>i)&1?u:-u));
  try{const a=evalFit(x,z,[0,3,6]).rmsPx,b=evalFit(equal,z,[0,3,6]).rmsPx;lo=Math.min(lo,a);hi=Math.max(hi,a);eLo=Math.min(eLo,b);eHi=Math.max(eHi,b);valid++;if(a<b)preferExisting++;}catch(e){rejected++;}
 }
 assert(primary.rmsPx<u&&equalProjective.rmsPx<u,'Manual reading incompatible; recheck');
 return {source:'Alma Mater 2025 #6 fig2 page70; screenshot only',evidenceClass:'C',modelGeometryChanged:false,physicalScaleKnown:false,sourceXNormalized:x,targetXScreenPx:y,pickAllowancePx:u,primary,otherAnchorSets:other,affineRmsPx:affineRms,equalPitchAffineRmsPx:equalAffineRms,equalPitchProjective:equalProjective,sensitivity:{cornerCases:128,valid,rejected,existingProjectiveRmsRangePx:[lo,hi],equalPitchProjectiveRmsRangePx:[eLo,eHi],existingLowerRmsCases:preferExisting},conclusion:'Existing and equal-pitch hypotheses both fit below crude picking allowance. This is consistent with seven visible wheel centres but does not identify true axle spacing, far-side identity, or balance-arm pivots.'};
}
if(require.main===module)console.log(JSON.stringify(audit(ledger,note),null,2));
module.exports=audit;
