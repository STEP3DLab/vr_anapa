import {registrations} from '../registrations.js';
import {frames} from './audit-crops.mjs';

export function mapByPair(point,[p,a],[q,b]){
 const [ux,uy]=[b.x-a.x,b.y-a.y],[vx,vy]=[q.x-p.x,q.y-p.y],d=ux**2+uy**2;
 if(d<1e-8)throw new RangeError('Coincident model reference points');
 const re=(ux*vx+uy*vy)/d,im=(ux*vy-uy*vx)/d;
 const [x,y]=[point.x-a.x,point.y-a.y];
 return {x:p.x+re*x-im*y,y:p.y+im*x+re*y};
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

export function getAuditSensitivity(){
 return frames.map(([id,year,name,label])=>{
  const {points}=registrations[id].overlay;
  const pairs=points.filter(p=>p.kind==='photo').flatMap(p=>{
   const q=points.find(q=>q.kind==='model'&&p.label===q.label);return q?[[p,q]]:[];
  });
  const target=pairs.find(([p])=>p.label===label);
  const controls=pairs.filter(pair=>pair!==target);
  const [photo,model]=target;
  const delta=axis=>controls.reduce((s,[p,m])=>s+p[axis]-m[axis],0)/controls.length;
  const residuals=controls.flatMap((first,i)=>controls.slice(i+1).map(second=>distance(photo,mapByPair(model,first,second))));
  return {id,year,name,original:distance(photo,model),shift:distance(photo,{x:model.x+delta('x'),y:model.y+delta('y')}),residuals};
 });
}

const decimal=x=>x.toFixed(1).replace('.',',');
export function renderAuditSensitivity(){
 return getAuditSensitivity().map(({id,year,name,original,shift,residuals})=>{
  const pairFit=residuals.length===1?decimal(residuals[0]):decimal(Math.min(...residuals))+'–'+decimal(Math.max(...residuals));
  return `<article><h3><a href="#audit-${id}">${year} · ${name}</a></h3>
<dl><dt>Исходное совмещение</dt><dd>${decimal(original)}</dd><dt>После общего сдвига</dt><dd>${decimal(shift)}</dd><dt>По парам опорных точек</dt><dd>${pairFit}</dd></dl></article>`;
 }).join('\n');
}
