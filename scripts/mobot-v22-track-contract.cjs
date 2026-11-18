// Static research contract for the *current* 1987 track source and its manual photo ledger.
// Usage: node scripts/mobot-v22-track-contract.cjs
// Deliberately checks projected MODEL circles and traceability only, NOT real wheel sizes,
// suspension construction, physical collisions, independent camera calibration, or WebGL.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const model=read('mobot-engineering-v22-model.js');
const photo=JSON.parse(read('mobot-qa/demo-2026-11-18/sktb-2-landmarks-manual.json'));
const passport=JSON.parse(read('mobot-engineering-v22-passport.json'));
const html=read('mobot-engineering-v22.html');
const latest=read('mobot-latest.html');
function pairs(name){
  const match=model.match(new RegExp('const '+name+'\\s*=\\s*(\\[\\[[^\\n]+\\]\\])\\s*\\.map'));
  assert(match,'Model wheel landmark declaration absent: '+name);
  const data=[...match[1].matchAll(/\[(\d+)\s*,\s*(\d+)\]/g)].map(m=>[+m[1],+m[2]]);
  assert(data.length>0,'Empty wheel landmark declaration: '+name);
  return data;
}
const measuredLower=photo.lowerWheelsLeftToRight.map(w=>[w.center[0],w.outerDiscRadius]);
const measuredEnds=photo.endWheelsLeftToRight.map(w=>[w.center[0],w.projectedRadiusApprox]);
const lower=pairs('lowerWheels'),ends=pairs('endWheels');
assert.equal(lower.length,7,'Seven observed lower circles must be represented per photographed side');
assert.equal(ends.length,2,'Two terminal circles must be represented');
assert.deepEqual(lower,measuredLower,'Model pixel landmarks diverged from the provenance ledger');
assert.deepEqual(ends,measuredEnds,'Terminal pixel landmarks diverged from ledger');
assert.deepEqual(photo.imageSize,[2786,2106],'Changed source-image pixel basis requires new registration');
assert(photo.uncertaintyPx.centers>0 && photo.uncertaintyPx.outerRadii>0 && photo.uncertaintyPx.endRadii>0,
  'Manual measurement uncertainty must be retained');
assert(model.includes('const pixelScale = 1.78 / (1980 - 238)')&&
       model.includes('const sceneX = u => .89 - (u - 238) * pixelScale'),
       'Scene normalization changed: review photo transform before updating contract');
assert(model.includes('trackSide(-.63,-1);trackSide(.63,1)'),
  'Two rendered track sides required; mirrored unseen side remains C-grade');
assert(model.includes('wheelXs:lowerWheels.map(w=>w.x)') &&
       model.includes('visibleWheelOuterRadiiScene:lowerWheels.map(w=>w.r)') &&
       model.includes('terminalWheels:endWheels.map(w=>({...w}))'),
       'Public research sourceProfile must follow actual mesh input landmarks');
assert(model.includes("version:'v22-research'")&&model.includes('physicalScaleKnown:false')&&
       model.includes('trueArchivalDimensions:false'),
       'Uncalibrated output must not claim a historical scale');
assert.equal(passport.revision,'v22');
assert.equal(passport.physicalScaleKnown,false,'Passport cannot assert factory dimensions');
assert.equal(passport.trackFit.landmarks,'mobot-qa/demo-2026-11-18/sktb-2-landmarks-manual.json');
assert(html.includes('mobot-engineering-v22-passport.json')&&html.includes('contact-sweep.json'),
       'Released viewer must expose its provenance and surface-contact diagnostics');
assert(latest.includes('mobot-engineering-v22.html'),'Permanent entrypoint unexpectedly changed');
assert(fs.existsSync(path.join(root,'mobot-engineering-v17.html'))&&
       fs.existsSync(path.join(root,'mobot-engineering-v21.html')),
       'Previous public releases must remain available');
// These are PHOTO-APPARENT radii rescaled into arbitrary scene units. Not mm or true wheel clearance.
const pxScale=1.78/1742,sceneX=u=>.89-(u-238)*pxScale;
const datum=.14, running=datum+.016+.006;
const bodies=lower.map(([u,r])=>({x:sceneX(u),y:running+.011+r*pxScale,r:r*pxScale}));
const terminals=ends.map(([u,r])=>({x:sceneX(u),y:datum+(2020-1707)*pxScale,r:r*pxScale}));
function gap(a,b){return Math.hypot(a.x-b.x,a.y-b.y)-a.r-b.r;}
const neighbors=bodies.slice(1).map((b,i)=>gap(bodies[i],b));
const terminalGaps=terminals.map(t=>Math.min(...bodies.map(w=>gap(t,w))));
const minSceneCircleGap=Math.min(...neighbors,...terminalGaps);
assert(minSceneCircleGap>=0,'Projected nominal wheel circles overlap: re-check scene layout');
const report={
  test:'v22-track-photo-provenance-static',
  revision:'v22',sourceImage:'SKTB archive photo #2',imagePixels:photo.imageSize,
  lowerDiscsPerSide:lower.length,terminalDiscsPerSide:ends.length,
  photoCenterUncertaintyPx:photo.uncertaintyPx.centers,
  photoOuterRadiusUncertaintyPx:photo.uncertaintyPx.outerRadii,
  photoEndRadiusUncertaintyPx:photo.uncertaintyPx.endRadii,
  nominalMinPlanarCircleGapSceneUnits:+minSceneCircleGap.toFixed(8),
  sourceLandmarksAgreeWithMeshInputs:true,sceneNominalCircleOverlaps:0,
  physicalWheelDimensionsValidated:false,independentPhotogrammetricScale:false,
  historicalSuspensionTopologyConfirmed:false,actual3DMeshCollisionsChecked:false,
  browserOrHardwareChecked:false,
  limitations:'Static source/ledger regression gate, not historical geometry certification.'
};
if(require.main===module)console.log(JSON.stringify(report,null,2));
module.exports=report;
