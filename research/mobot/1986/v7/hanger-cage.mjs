// Run with Node, optionally passing the older v7 model module path.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import * as T from '../../../../mobot-assets/three.module.min.js';
import {frameArchive} from './archive-camera.mjs';
const previous=process.argv[2];
const moduleURL=previous?pathToFileURL(path.resolve(previous)):new URL('../../../../mobot-ch-hv-1986-research-v7-model.js',import.meta.url);
const {makeMobot1986}=await import(moduleURL);
const model=makeMobot1986(T),{grab}=model.mechanisms;
const named=name=>model.root.getObjectByName(name);
const read=name=>JSON.parse(fs.readFileSync(new URL(name,import.meta.url)));
const views=read('registration/registration.json').views,marks=read('landmarks.json');
const frame=named('Верхняя траверса'),pin=named('Палец подвеса');
const bounds=o=>new T.Box3().setFromObject(o,true);
const lower=bounds(frame),pinY=pin.getWorldPosition(new T.Vector3()).y;
const rods=model.objects.filter(o=>o.name==='Наружный стержень подвеса');
const collar=named('Верхний пояс подвеса');
let exposed=0,shortestOverlap=null;
if(collar){
  if(rods.length!==4)throw Error('Incomplete rod assembly');
  const upper=bounds(collar),neck=named('Шейка подвеса');
  exposed=upper.min.y-lower.max.y;
  shortestOverlap=Infinity;
  for(const rod of rods){
    const box=bounds(rod);
    if(Math.hypot(rod.position.x,rod.position.z)<=rod.geometry.parameters.radiusTop+neck.geometry.parameters.radiusTop)throw Error('Rod merged with neck');
    for(const support of [upper,lower]){
      const overlap=box.clone().intersect(support).getSize(new T.Vector3());
      if(Math.min(overlap.x,overlap.y,overlap.z)<=0)throw Error('Disconnected rod');
      shortestOverlap=Math.min(shortestOverlap,overlap.y);
    }
  }
}else if(rods.length||!previous)throw Error('Missing collar');
const poseFraction=exposed/(pinY-lower.max.y);
const cameraData=Object.entries(views).map(([fig,v])=>{
  const size=marks[fig].size,camera=new T.OrthographicCamera(-1,1,1,-1,.02,90);
  frameArchive(camera,new T.Vector3(),v.camera,size,size[0]/size[1]);
  return {fig,camera,size};
});
const gap={},motion={};
function pinToTraverse({size,camera}){
  const a=pin.getWorldPosition(new T.Vector3()).project(camera);
  const b=frame.getWorldPosition(new T.Vector3()).project(camera);
  return [(b.x-a.x)*size[0]/2,(a.y-b.y)*size[1]/2];
}
for(const item of cameraData){gap[item.fig]=pinToTraverse(item);motion[item.fig]=0;}
let poses=0;
for(let yaw=-180;yaw<=180;yaw++)for(let boom=0;boom<=32;boom++){
  model.setPose({yaw,boom});poses++;
  for(const item of cameraData){
    const d=pinToTraverse(item),base=gap[item.fig];
    motion[item.fig]=Math.max(motion[item.fig],Math.hypot(d[0]-base[0],d[1]-base[1]));
  }
}
if(Object.values(motion).some(v=>v>1e-8))throw Error('Pin-to-traverse vector changes in the registered orthographic camera');
console.log(JSON.stringify({rods:rods.length,openFraction:poseFraction,shortestOverlapScene:shortestOverlap,
  poses,pinToTraversePx:gap,maxVectorChangePx:motion},null,2));
