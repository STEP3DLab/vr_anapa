// Automated research-geometry gate: node mobot-geometry-gate.cjs
// Checks scene-code relationships only; never historical dimensions.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(path.join(__dirname,p),'utf8');
const first=read('mobot-ch-hv-1986-research-v4.html');
const second=read('mobot-engineering-v18-model.js');
const latest=read('mobot-latest.html');
function requireOne(source,pattern,description){
 const m=source.match(pattern);assert(m,description);return m;
}
// Validate the actual new v4 orientation statements are present in the model source.
requireOne(first,/const loader=group\('фронтальный погрузчик'[^;\n]*;loader\.position\.set\(\.72,\.83,0\);/,'1986 loader mount');
requireOne(first,/scoop\.position\.set\(\.67,-\.35,0\)/,'1986 bucket mount');
requireOne(first,/grab\.position\.set\(-\.87,1\.69,0\)/,'1986 grapple on boom');
requireOne(first,/boom\.position\.set\(\.22,1\.21,0\)/,'1986 arm mount');
requireOne(first,/grab\.rotation\.z=-boom\.rotation\.z/,'1986 hanging grab display condition');
assert(first.includes('mobot-ch-hv-1986-research-v4-qa.json'));
const rad=d=>d*Math.PI/180;
const grabXs=[-15,0,24,58,72].map(a=>.22-.87*Math.cos(rad(a))-1.69*Math.sin(rad(a)));
const bucketXs=[-15,0,25].map(a=>.72+.67*Math.cos(rad(a))+.35*Math.sin(rad(a)));
assert(grabXs.every(x=>x<0),'1986 grapple must remain on rear side');
assert(bucketXs.every(x=>x>0),'1986 bucket must remain on opposite/front side');
const wheels=requireOne(second,/const wheelXs=\[([-.0-9,\s]+)\];/,'1987 candidate axle sequence')[1].split(',').map(Number);
assert(second.includes('const y=.25,outer=.099+(i%2===0?.004:0)'),'1987 lower-wheel radius formula has changed; revise the gate');
assert(second.includes('for(const x of [-.70,.72])'),'1987 end-wheel centers have changed; revise the gate');
assert(second.includes('cylinder(g,.14,.14,.12'),'1987 end-wheel radius has changed; revise the gate');
const radii=wheels.map((_,i)=>.099+(i%2===0?.004:0));
const overlaps=[];
for(let i=0;i<wheels.length-1;i++){
 const overlap=radii[i]+radii[i+1]-(wheels[i+1]-wheels[i]);
 if(overlap>0)overlaps.push({indexPair:[i,i+1],sceneOverlap:Number(overlap.toFixed(6))});
}
const rearOverlap=Number(Math.max(0,.14+radii.at(-1)-Math.hypot(.72-wheels.at(-1),.47-.25)).toFixed(6));
assert(latest.includes('mobot-engineering-v21.html')&&!latest.includes('mobot-engineering-v18.html'),'Research latest must point to v21, not rejected v18 candidate');
assert(fs.existsSync(path.join(__dirname,'mobot-engineering-v17.html')),'Preserved historical v17 file missing');
console.log(JSON.stringify({
 researchGate:'reproducible-static-layout-screening',
 variant1986:{loaderOppositeGrapple:true,sceneGrappleXRange:[Math.min(...grabXs),Math.max(...grabXs)],sceneLoaderXRange:[Math.min(...bucketXs),Math.max(...bucketXs)],historicalDimensionsValidated:false},
 variant1987:{candidate:'v18',nominalAdjacentCircleOverlaps:overlaps,rearEndCircleOverlap:rearOverlap,realWheelClearanceEstablished:false,nominalCircleNonintersecting:overlaps.length===0&&rearOverlap===0,eligibleForLatest:false,additionalGatesMissing:['independent historical view','real WebGL/mobile verification','photogrammetric calibration']},
 latest:'v21 (research)',archivedStable:'v17',note:'v18 circle overlap is a scene-model warning; v21 is a research viewer, not factory-calibrated CAD.'
},null,2));
