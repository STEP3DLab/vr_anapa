// Compare the visible lower cheek only, using the two pre-existing registration marks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../../../../mobot-assets/three.module.min.js';
const file=name=>new URL(name,import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(file(name)));
const baseline=read('bucket-cheek-pre-heel.json'),candidate=read('bucket-cheek.json');
const marks={
 SKTB2:[[775,529],[783,544],[798,562],[807,565],[815,565],[830,558],[851,546],[875,534],[898,520]],
 SKTB4:[[694,571],[698,578],[705,584],[714,587],[727,589],[742,593]]
};
function lower(view,key){
 const rear=view.cornersXY.findIndex(([x,y])=>Math.abs(x-.075)<1e-5&&Math.abs(y-.23)<1e-5);
 assert(rear>1);
 return view[key].slice(0,rear+1);
}
function residual(poly,checks){
 const points=poly.map(p=>new T.Vector2(...p));
 const errors=checks.map(p=>{
  const q=new T.Vector2(...p);
  return Math.min(...points.slice(1).map((b,i)=>{
   const a=points[i],delta=b.clone().sub(a);
   return q.distanceTo(a.clone().addScaledVector(delta,T.MathUtils.clamp(q.clone().sub(a).dot(delta)/delta.lengthSq(),0,1)));
  }));
 });
 return {errors,rms:Math.hypot(...errors)/Math.sqrt(errors.length)};
}
const output={};
for(const [id,checks] of Object.entries(marks)){
 const before=baseline[id],after=candidate[id];
 assert.deepEqual(before.basis,after.basis);
 const obs=Math.hypot(after.tip[0]-after.root[0],after.tip[1]-after.root[1]);
 const projected=lower(after,'raw');
 const chord=Math.hypot(projected[0][0]-projected.at(-1)[0],projected[0][1]-projected.at(-1)[1]);
 const row={checks,root:after.root,tip:after.tip,observedChordPx:obs,deckChordPx:chord,
  observedToProjected:obs/chord,scope:id==='SKTB4'?'Only visible rear heel; snow-covered cutting lip excluded':'Development view; lower contour traced here'};
 for(const [name,view] of [['before',before],['after',after]]){
  const poly=lower(view,'poly');
  row[name]={poly,...residual(poly,checks),rawRms:residual(lower(view,'raw'),checks).rms};
 }
 // Move only the two registration anchors. Re-use exactly the same shifts for both profiles.
 const steps=id==='SKTB4'?[-6,0,6]:[-3,0,3], gains=[];
 for(const dx of [-3,0,3])for(const dy of [-3,0,3])for(const tx of steps)for(const ty of steps){
  const a=new T.Vector2(...row.root),b=new T.Vector2(...row.tip).sub(a);
  const offset=new T.Vector2(dx,dy),newSpan=b.clone().add(new T.Vector2(tx,ty)).sub(offset);
  const register=p=>new T.Vector2(...p).sub(a).rotateAround(new T.Vector2(),newSpan.angle()-b.angle())
    .multiplyScalar(newSpan.length()/b.length()).add(a).add(offset).toArray();
  gains.push(residual(row.before.poly.map(register),checks).rms-residual(row.after.poly.map(register),checks).rms);
 }
 row.anchorSensitivity={pairs:gains.length,improved:gains.filter(v=>v>0).length,worstGain:Math.min(...gains)};
 assert(row.after.rms<row.before.rms);output[id]=row;
}
fs.writeFileSync(file('bucket-heel.json'),JSON.stringify(output,null,2)+'\n');
console.log(Object.entries(output).map(([k,v])=>[k,v.before.rms,v.after.rms,v.observedToProjected]));
