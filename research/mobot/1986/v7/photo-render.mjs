// Fixed camera for both revisions, expressed in pixels of the original research crop.
import fs from 'node:fs';
import * as T from '../../../../mobot-assets/three.module.min.js';
import {makeRasterRenderer} from '../../../../mobot-assets/orthographic-raster.js';
import {makeMobot1986 as v6} from '../../../../mobot-ch-hv-1986-research-v6-model.js';
import {makeMobot1986 as v7} from '../../../../mobot-ch-hv-1986-research-v7-model.js';
const [file,view,version,out]=process.argv.slice(2);
const registration=JSON.parse(fs.readFileSync(file)).views[view],cam=registration.camera;
const {yaw,boom}=registration.demoPose,model=({v6,v7}[version])(T);
model.setPose({yaw,boom,grab:registration.demoPose.openingIllustration});
const [w,h]=view==='fig6'?[1456,1140]:[864,1170];
const [a,e,r]=[cam.azimuth,cam.elevation,cam.roll].map(T.MathUtils.degToRad);
const x=new T.Vector3(Math.cos(a),0,-Math.sin(a));
const y=new T.Vector3(-Math.sin(a)*Math.sin(e),Math.cos(e),-Math.cos(a)*Math.sin(e));
const z=x.clone().cross(y),right=x.clone().multiplyScalar(Math.cos(r)).addScaledVector(y,-Math.sin(r));
const up=x.clone().multiplyScalar(Math.sin(r)).addScaledVector(y,Math.cos(r));
const scale=cam.pxPerSceneUnit;
const camera=new T.OrthographicCamera(-cam.cx/scale,(w-cam.cx)/scale,cam.cy/scale,(cam.cy-h)/scale,.01,40);
camera.position.copy(z).multiplyScalar(9);camera.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(right,up,z));camera.updateMatrixWorld();
// The optional file records projected reference positions for shape-only detail tiles.
if(process.argv[6]){
  const top=model.sections['Открытая рамка грейфера'];
  const q=top.localToWorld(new T.Vector3(0,-.286,0)).project(camera);
  fs.writeFileSync(process.argv[6],JSON.stringify({top:[(q.x+1)*w/2,(1-q.y)*h/2]}));
}
let rgba;
const ctx={createImageData:(width,height)=>({data:new Uint8ClampedArray(width*height*4)}),putImageData:b=>{rgba=b.data;}};
const raster=makeRasterRenderer({getContext:()=>ctx});raster.resize(w,h);raster.render(model.root,camera);
const rgb=Buffer.alloc(w*h*3);for(let i=0;i<w*h;i++)for(let k=0;k<3;k++)rgb[3*i+k]=rgba[i*4+3]?rgba[i*4+k]:[231,235,227][k];
fs.writeFileSync(out,Buffer.concat([Buffer.from('P6\n'+w+' '+h+'\n255\n'),rgb]));
