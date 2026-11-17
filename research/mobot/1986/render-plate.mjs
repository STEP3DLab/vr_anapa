// Renders the actual Three.js model with the repository's software z-buffer.
import fs from 'node:fs';
import * as T from '../../../mobot-assets/three.module.min.js';
import {makeRasterRenderer} from '../../../mobot-assets/orthographic-raster.js';
import {makeMobot1986} from '../../../mobot-ch-hv-1986-research-v6-model.js';
const [, ,view='overview',out='plate.ppm']=process.argv;
const model=makeMobot1986(T);
const views={overview:[2.15,1.52,4.9],side:[0,.04,5],grapple:[3,1.1,4],front:[4.6,1.8,-2.7]};
if(!Object.hasOwn(views,view))throw Error('Unknown view');
if(view==='grapple')model.setPose({grab:24});
if(view==='front')model.setPose({yaw:168,boom:12,grab:8});
const subject=view==='grapple'?model.mechanisms.grab:model.root;
const bounds=new T.Box3().setFromObject(subject,true),center=bounds.getCenter(new T.Vector3());
const camera=new T.OrthographicCamera(-3,3,2,-2,.01,40);
camera.position.copy(center).addScaledVector(new T.Vector3(...views[view]).normalize(),9);
camera.lookAt(center);camera.updateMatrixWorld();
const w=1280,h=820,aspect=w/h;let height=0;
for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
  const p=new T.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);
  height=Math.max(height,Math.abs(p.y),Math.abs(p.x)/aspect);
}
height*=1.065;Object.assign(camera,{top:height,bottom:-height,left:-height*aspect,right:height*aspect});camera.updateProjectionMatrix();
let frame;const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:b=>{frame=b.data;}};
const raster=makeRasterRenderer({getContext:()=>ctx});raster.resize(w,h);raster.render(subject,camera);
const pixels=Buffer.alloc(w*h*3);
for(let i=0;i<w*h;i++)for(let c=0;c<3;c++)pixels[i*3+c]=frame[i*4+3]?frame[i*4+c]:[231,235,227][c];
fs.writeFileSync(out,Buffer.concat([Buffer.from('P6\n'+w+' '+h+'\n255\n'),pixels]));
