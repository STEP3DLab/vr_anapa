// 1987 v22 photo-coordinate sensitivity audit, NOT CAD collision detection.
// Run: node scripts/mobot-v22-uncertainty.cjs
// Uses manual measurements from SKTB frame #2 and the held-out snow-side frame #4.
// All results are in *scene units* or pixel coordinates, never historical millimetres.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const readJSON=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const nominalContract=require('./mobot-v22-track-contract.cjs');
const ledger=readJSON('mobot-qa/demo-2026-11-18/sktb-2-landmarks-manual.json');
const side=readJSON('research/mobot/1987/night-20261118/photo-side.json');
assert.equal(nominalContract.revision,'v22');
assert.deepEqual(ledger.imageSize,[2786,2106]);
const scale=1.78/(1980-238);
const sceneX=u=>.89-(u-238)*scale;
const lowY=.14+.016+.006+.011;
const endY=.14+(2020-1707)*scale;
const lower=ledger.lowerWheelsLeftToRight.map((w,i)=>({
  id:'r'+(i+1),kind:'lower',u:w.center[0],r:w.outerDiscRadius
}));
const ends=ledger.endWheelsLeftToRight.map((w,i)=>({
  id:'e'+(i+1),kind:'terminal',u:w.center[0],r:w.projectedRadiusApprox
}));
assert.equal(lower.length,7);
assert.equal(ends.length,2);
const xError=ledger.uncertaintyPx.centers;
const radiusError=w=>w.kind==='lower'?ledger.uncertaintyPx.outerRadii:ledger.uncertaintyPx.endRadii;
function make(w,du=0,dr=0){
  const radius=(w.r+dr)*scale;
  return {x:sceneX(w.u+du),y:w.kind==='lower'?lowY+radius:endY,r:radius};
}
function gap(a,b){return Math.hypot(a.x-b.x,a.y-b.y)-a.r-b.r;}
function endpointScenarios(a,b){
  const values=[];
  for(const au of [-xError,xError])
    for(const bu of [-xError,xError])
      for(const ar of [-radiusError(a),radiusError(a)])
        for(const br of [-radiusError(b),radiusError(b)])
          values.push({gap:gap(make(a,au,ar),make(b,bu,br)),
            deviationsPx:[au,ar,bu,br]});
  const worst=values.reduce((m,v)=>v.gap<m.gap?v:m,values[0]);
  const best=values.reduce((m,v)=>v.gap>m.gap?v:m,values[0]);
  return {pair:a.id+'-'+b.id,
    nominalScene:+gap(make(a),make(b)).toFixed(8),
    minSampledEndpointScene:+worst.gap.toFixed(8),
    maxSampledEndpointScene:+best.gap.toFixed(8),
    worstDeviationsPx:worst.deviationsPx,
    negativeGapScenarioFound:worst.gap<0};
}
// Adjacent projected discs and every terminal-to-lower pair: no hidden plane inferred.
const pairs=lower.slice(1).map((w,i)=>endpointScenarios(lower[i],w))
  .concat(ends.flatMap(e=>lower.map(w=>endpointScenarios(e,w))));
const nominalMin=Math.min(...pairs.map(x=>x.nominalScene));
assert(Math.abs(nominalMin-nominalContract.nominalMinPlanarCircleGapSceneUnits)<1e-7,
  'Changed track source or projection formula: update and re-evaluate uncertainty analysis');
const views=Object.fromEntries(side.views.map(v=>[v.id,v]));
assert(views.SKTB2&&views.SKTB4,'Independent snow-side image landmarks unavailable');
const getX=(view,key)=>view.centres[key][0];
const r1a=getX(views.SKTB2,'r1'),r7a=getX(views.SKTB2,'r7');
const r1b=getX(views.SKTB4,'r1'),r7b=getX(views.SKTB4,'r7');
const projected=[];
for(let i=1;i<=7;i++){
  const key='r'+i;
  const predicted=r1b+(getX(views.SKTB2,key)-r1a)*(r7b-r1b)/(r7a-r1a);
  projected.push({wheel:key,predictedXpx:+predicted.toFixed(4),
    observedXpx:getX(views.SKTB4,key),
    residualPx:+(getX(views.SKTB4,key)-predicted).toFixed(4),
    usedToFit:i===1||i===7});
}
const heldout=projected.filter(x=>!x.usedToFit);
const heldoutRmsPx=Math.sqrt(heldout.reduce((sum,x)=>sum+x.residualPx*x.residualPx,0)/heldout.length);
assert(Number.isFinite(heldoutRmsPx));
assert(heldoutRmsPx<views.SKTB4.visibleSpan[1]-views.SKTB4.visibleSpan[0]);
const negative=pairs.filter(x=>x.negativeGapScenarioFound);
const report={
  test:'v22-track-apparent-circle-uncertainty',
  testedAgainst:['SKTB #2 manual wheel ledger','SKTB #4 independent snow-side manual centres'],
  modelRevision:'v22', units:'scene units; pixels for two-view holdout',
  photo2ManualCentreErrorPx:xError,
  photo2ManualDiscRadiusErrorPx:ledger.uncertaintyPx.outerRadii,
  photo2ManualTerminalRadiusErrorPx:ledger.uncertaintyPx.endRadii,
  nominalMinimumGapScene:+nominalMin.toFixed(8),
  minGapAcrossEndpointScenariosScene:+Math.min(...pairs.map(x=>x.minSampledEndpointScene)).toFixed(8),
  nominalNegativeProjectedGapPairs:pairs.filter(x=>x.nominalScene<0).map(x=>x.pair),
  endpointScenariosWithNegativeGap:negative.map(x=>x.pair),
  examinedPairs:pairs.length,endpointCombinationsPerPair:16,
  perPair:pairs,
  independentSnowSide:{
    file:'research/mobot/1987/night-20261118/photo-side.json',
    imageWidthPx:views.SKTB4.width,
    fitAnchorWheels:['r1','r7'],
    heldOutWheels:heldout.map(x=>x.wheel),
    heldoutRmsPx:+heldoutRmsPx.toFixed(4),
    image4ManualCentreErrorPx:views.SKTB4.uncertainty,
    residuals:projected,
  },
  certifiedNonOverlap:false,
  realWheelSizesCertified:false,
  actual3DContactChecked:false,
  provenance:'SKTB photo gallery; all photo point selections were recorded by prior researchers, not newly digitised here',
  limitations:'Endpoint stress cases vary x and circle radii within declared manual errors; not a probability interval or exhaustive continuous optimisation. Lower wheel y follows the v22 modelling proxy; image y uncertainty, perspective, occlusion and depth are not resolved. Negative 2D gap scenarios demonstrate sensitivity, NOT actual physical wheel intersection. Image #4 affine 1D residual is not calibrated 3D photogrammetry.'
};
if(require.main===module) console.log(JSON.stringify(report,null,2));
module.exports=report;
