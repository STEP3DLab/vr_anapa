// Absolute (two-coordinate) traverse error at the two independently read nose positions.
import fs from 'node:fs';
import * as T from '../../../../mobot-assets/three.module.min.js';
import {makeMobot1986} from '../../../../mobot-ch-hv-1986-research-v7-model.js';
import {frameArchive} from './archive-camera.mjs';
const read=file=>JSON.parse(fs.readFileSync(new URL(file,import.meta.url)));
const views=read('registration/registration.json').views;
const marks=read('landmarks.json');
const alternate=read('experiments/suspension-photo.json');
const results={};
for(const [fig,view] of Object.entries(views)){
  const {size,grapple}=marks[fig], [w,h]=size;
  const camera=new T.OrthographicCamera(-1,1,1,-1,.02,90);
  frameArchive(camera,new T.Vector3(),view.camera,size,w/h);
  const fits=alternate[fig].cameras.find(row=>row.distance==='orthographic');
  const rows={};
  for(const reading of ['original','hardwarePatch']){
    const [yaw,boom]=fits[reading].yawBoomDeg;
    rows[reading]=[.105,.135].map(extension=>{
      const model=makeMobot1986(T,extension);
      model.setPose({yaw,boom});
      const top=model.sections['Открытая рамка грейфера'].localToWorld(new T.Vector3(0,-.286,0)).project(camera);
      const x=(1+top.x)*w/2,y=(1-top.y)*h/2;
      return {extension,topXY:[x,y].map(v=>+v.toFixed(2)),error2dPx:+Math.hypot(x-grapple.top[0],y-grapple.top[1]).toFixed(2)};
    });
  }
  results[fig]={target:grapple.top,rows};
}
console.log(JSON.stringify(results,null,2));
