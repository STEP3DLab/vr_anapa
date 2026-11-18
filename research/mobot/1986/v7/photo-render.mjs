// Fixed camera for both revisions, expressed in pixels of the original research crop.
import fs from 'node:fs';
import {frameArchive} from './archive-camera.mjs';
import * as T from '../../../../mobot-assets/three.module.min.js';
import {makeRasterRenderer} from '../../../../mobot-assets/orthographic-raster.js';
import {makeMobot1986 as v6} from '../../../../mobot-ch-hv-1986-research-v6-model.js';
import {makeMobot1986 as v7} from '../../../../mobot-ch-hv-1986-research-v7-model.js';
const [file,view,version,out]=process.argv.slice(2);
const registration=JSON.parse(fs.readFileSync(file)).views[view],cam=registration.camera;
const {yaw,boom}=registration.demoPose,model=({v6,v7}[version])(T);
model.setPose({yaw:process.argv[7]?Math.round(yaw):yaw,boom:process.argv[7]?Math.round(boom):boom,grab:registration.demoPose.openingIllustration});
const [w,h]=view==='fig6'?[1456,1140]:[864,1170];
const [a,e,r]=[cam.azimuth,cam.elevation,cam.roll].map(T.MathUtils.degToRad);
const x=new T.Vector3(Math.cos(a),0,-Math.sin(a));
const y=new T.Vector3(-Math.sin(a)*Math.sin(e),Math.cos(e),-Math.cos(a)*Math.sin(e));
const z=x.clone().cross(y),right=x.clone().multiplyScalar(Math.cos(r)).addScaledVector(y,-Math.sin(r));
const up=x.clone().multiplyScalar(Math.sin(r)).addScaledVector(y,Math.cos(r));
const scale=cam.pxPerSceneUnit;
const camera=new T.OrthographicCamera(-cam.cx/scale,(w-cam.cx)/scale,cam.cy/scale,(cam.cy-h)/scale,.01,40);
camera.position.copy(z).multiplyScalar(9);camera.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(right,up,z));camera.updateMatrixWorld();
// Reproduce the archive controls before/after at the original crop aspect.
const control=process.argv[7];
if(control==='registered'){
  frameArchive(camera,new T.Vector3(),cam,[w,h],w/h);
}else if(control==='previous'){
  const bounds=new T.Box3();
  model.root.traverse(o=>{if(o.isMesh && o.visible)bounds.expandByObject(o,false);});
  const center=bounds.getCenter(new T.Vector3());
  camera.position.copy(center).addScaledVector(z,9);camera.lookAt(center);camera.updateMatrixWorld();
  let half=.1;
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    const v=new T.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);
    half=Math.max(half,Math.abs(v.y),Math.abs(v.x)*h/w);
  }
  half*=w/h<1.25?1.13:1.10;
  Object.assign(camera,{left:-half*w/h,right:half*w/h,top:half,bottom:-half});camera.updateProjectionMatrix();
}
// The optional file records projected reference positions for shape-only detail tiles.
if(process.argv[6]){
  const top=model.sections['Открытая рамка грейфера'];
  const q=top.localToWorld(new T.Vector3(0,-.286,0)).project(camera);
  const side=view==='fig6'?1:-1,hubs=[];
  model.sections['Борт '+side].traverse(o=>{
    if(o.name==='Ступица'){
      const v=o.getWorldPosition(new T.Vector3()).project(camera);
      hubs.push([(1+v.x)*w/2,(1-v.y)*h/2]);
    }
  });
  fs.writeFileSync(process.argv[6],JSON.stringify({top:[(q.x+1)*w/2,(1-q.y)*h/2],hubs}));
}
let rgba;
const ctx={createImageData:(width,height)=>({data:new Uint8ClampedArray(width*height*4)}),putImageData:b=>{rgba=b.data;}};
const raster=makeRasterRenderer({getContext:()=>ctx});raster.resize(w,h);raster.render(model.root,camera);
const rgb=Buffer.alloc(w*h*3);for(let i=0;i<w*h;i++)for(let k=0;k<3;k++)rgb[3*i+k]=rgba[i*4+3]?rgba[i*4+k]:[231,235,227][k];
fs.writeFileSync(out,Buffer.concat([Buffer.from('P6\n'+w+' '+h+'\n255\n'),rgb]));
