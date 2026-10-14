// Native asset export. Requires @napi-rs/canvas in CODEX_PRIMARY_RUNTIME_NODE_MODULES.
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';import {createRequire} from 'node:module';
const {createCanvas,loadImage,GlobalFonts}=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/')('@napi-rs/canvas');
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','Arial');
import * as THREE from '../vendor/three.module.min.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {buildWorld,EXHIBITS} from '../world.js';
import {loadSculpture,installCollegeMark} from '../sculpture.js';
import {configureMuseumLighting} from '../atmosphere.js';
import {GalleryAtmosphere} from '../gallery-atmosphere.js';
import {collectionBounds} from '../framing.js';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
const dir='gallery-render';fs.mkdirSync(dir,{recursive:true});
global.document={createElement:()=>{const o={width:1,height:1,getContext(){o.canvas??=createCanvas(o.width,o.height);return o.canvas.getContext('2d');}};return o;}};
GLTFLoader.prototype.loadAsync=function(){const b=fs.readFileSync('assets/lenin-bust.glb');return this.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');};
THREE.TextureLoader.prototype.loadAsync=async path=>new THREE.Texture(await loadImage(path));
const world=buildWorld();await Promise.all([loadSculpture(world),installCollegeMark(world)]);
const renderer={shadowMap:{}};configureMuseumLighting(renderer,world);world.setLighting(false);
const atmosphere=new GalleryAtmosphere(world,EXHIBITS,{reduced:true});atmosphere.focus(0);atmosphere.update(0);
world.scene.updateMatrixWorld(true);const bounds=collectionBounds(world);
const textures=new Map(),materials=new Map(),meshes=[],buffers=[];let offset=0;
function textureId(texture){if(!texture)return -1;if(textures.has(texture.uuid))return textures.get(texture.uuid).id;
 const id=textures.size,img=texture.image.canvas||texture.image;let c=img;if(!c.toBuffer){c=createCanvas(img.width,img.height);c.getContext('2d').drawImage(img,0,0);}
 fs.writeFileSync(dir+'/texture-'+id+'.png',c.toBuffer('image/png'));textures.set(texture.uuid,{id,repeat:texture.repeat.toArray(),wrap:texture.wrapS===THREE.RepeatWrapping});return id;}
function materialId(mat){if(materials.has(mat.uuid))return materials.get(mat.uuid).id;const id=materials.size;materials.set(mat.uuid,{id,color:mat.color.toArray(),metal:mat.metalness||0,rough:mat.roughness??.5,emissive:mat.emissive?mat.emissive.clone().multiplyScalar(mat.emissiveIntensity).toArray():[0,0,0],unlit:!!mat.isMeshBasicMaterial,opacity:mat.opacity,texture:textureId(mat.map)});return id;}
world.scene.traverse(o=>{
 if(!o.isMesh||o.material.visible===false||o.material.transparent||o===atmosphere.halo)return;
 for(let i=0;i<(o.isInstancedMesh?o.count:1);i++){
  const matrix=o.matrixWorld.clone();if(o.isInstancedMesh){const m=new THREE.Matrix4();o.getMatrixAt(i,m);matrix.multiply(m);}
  const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(matrix);const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;const data=new Float32Array(p.count*8);
  for(let v=0;v<p.count;v++)data.set([p.getX(v),p.getY(v),p.getZ(v),n.getX(v),n.getY(v),n.getZ(v),uv?.getX(v)||0,uv?.getY(v)||0],v*8);
  let parent=o,index=-1;while(parent){if(Number.isInteger(parent.userData.exhibit)){index=parent.userData.exhibit;break;}parent=parent.parent;}
  meshes.push({start:offset,count:p.count,material:materialId(o.material),exhibit:index});offset+=p.count;buffers.push(Buffer.from(data.buffer));g.dispose();
 }
});
const shots=[];for(const [name,width,height,index] of [['cover-wide',1920,1080,0],['cover-tall',900,1600,0],['caretaker',900,1200,3],['sputnik',900,1200,1],['atom',900,1200,2]]){
 const view=EXHIBITS[index].view,target=[...EXHIBITS[index].target];if(index===1)target[0]=bounds[index].getCenter(new THREE.Vector3()).x;
 const camera=new THREE.PerspectiveCamera(65,width/height,.08,70);camera.position.set(view[0],EXHIBITS[index].eye??1.65,view[2]);camera.lookAt(...target);camera.updateMatrixWorld(true);let scale=1;
 for(const x of [bounds[index].min.x,bounds[index].max.x])for(const y of [bounds[index].min.y,bounds[index].max.y])for(const z of [bounds[index].min.z,bounds[index].max.z]){const p=new THREE.Vector3(x,y,z).project(camera);scale=Math.max(scale,Math.abs(p.x)/.82,Math.abs(p.y)/.65);}
 camera.fov=Math.min(100,THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(65)/2)*scale)));camera.updateProjectionMatrix();
 atmosphere.focus(index);atmosphere.update(0);world.scene.updateMatrixWorld(true);
 const lights=[];world.scene.traverse(o=>{if(o.isDirectionalLight||o.isSpotLight)lights.push({kind:o.isSpotLight?1:0,position:o.position.toArray(),target:o.target.position.toArray(),color:o.color.clone().multiplyScalar(o.intensity).toArray(),angle:o.angle||0,penumbra:o.penumbra||0,decay:o.decay||0});});
 shots.push({name,width,height,index,camera:camera.position.toArray(),projection:camera.projectionMatrix.toArray(),view:camera.matrixWorldInverse.toArray(),lights});
}
const shadowCamera=new THREE.OrthographicCamera(-14,14,17,-17,.5,50);shadowCamera.position.copy(world.sun.position);shadowCamera.lookAt(0,0,0);shadowCamera.updateMatrixWorld(true);
fs.writeFileSync(dir+'/geometry.bin',Buffer.concat(buffers));fs.writeFileSync(dir+'/scene.json',JSON.stringify({meshes,materials:[...materials.values()],textures:[...textures.values()],shots,shadow:new THREE.Matrix4().multiplyMatrices(shadowCamera.projectionMatrix,shadowCamera.matrixWorldInverse).toArray(),hemisphere:world.hemisphere.intensity,exposure:renderer.toneMappingExposure}));
console.log({meshes:meshes.length,triangles:offset/3,materials:materials.size,textures:textures.size});
