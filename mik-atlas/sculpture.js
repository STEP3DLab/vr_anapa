import * as THREE from './vendor/three.module.min.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';

export async function loadSculpture(world,onProgress){
  const loader=new GLTFLoader();
  const gltf=await loader.loadAsync('./assets/lenin-bust.glb',event=>onProgress?.(event.total?event.loaded/event.total:null));
  const model=gltf.scene;model.name='Lenin — 3D scan by fractalnoise';
  model.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const height=3.1;const scale=height/size.y;
  const holder=new THREE.Group();holder.name='lenin-scan';holder.position.set(0,2.18,0);
  model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);model.scale.multiplyScalar(scale);holder.add(model);
  const bronze=new THREE.MeshStandardMaterial({color:'#967443',metalness:.8,roughness:.38,envMapIntensity:1});
  model.traverse(o=>{if(o.isMesh){o.material=bronze;o.castShadow=true;o.receiveShadow=true;}});
  world.groups[0].add(holder);world.sculptureLoaded=true;world.scene.updateMatrixWorld(true);
  return holder;
}

export async function installCollegeMark(world){
  const texture=await new THREE.TextureLoader().loadAsync('./assets/miko-official.png');texture.colorSpace=THREE.SRGBColorSpace;
  const geometry=new THREE.PlaneGeometry(1.5,1.5*texture.image.height/texture.image.width);
  const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});
  for(const x of [-4,4]){const plaque=new THREE.Mesh(geometry,material);plaque.position.set(x,3.9,13.7);plaque.rotation.y=Math.PI;world.root.add(plaque);}
  const mark=new THREE.Mesh(geometry,material);mark.scale.setScalar(.58);mark.position.set(0,6.2,-13.04);world.root.add(mark);
}
