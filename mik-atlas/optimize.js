import * as THREE from './vendor/three.module.min.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';

// Keep exhibits, raycast targets, instancing, animation and text plates independent.
export function consolidateArchitecture(world){
  const batches=new Map(),protectedGroups=new Set(world.groups);
  world.root.updateMatrixWorld(true);
  world.root.traverse(object=>{
    if(!object.isMesh||object.isInstancedMesh||object===world.floor||Array.isArray(object.material)||object.material.transparent)return;
    // Marble/stone maps share UVs and materials; only independent labels stay separate.
    if(object.material.map&&object.material.isMeshBasicMaterial)return;
    for(let p=object.parent;p;p=p.parent)if(protectedGroups.has(p))return;
    const key=object.material.uuid+':'+object.castShadow+':'+object.receiveShadow;if(!batches.has(key))batches.set(key,[]);batches.get(key).push(object);
  });
  let removed=0;
  for(const meshes of batches.values()){
    if(meshes.length<2)continue;
    const geometries=meshes.map(mesh=>mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
    const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());
    if(!geometry)continue;
    geometry.computeBoundingSphere();geometry.computeBoundingBox();
    const combined=new THREE.Mesh(geometry,meshes[0].material);combined.name='Architectural batch';combined.castShadow=meshes.some(mesh=>mesh.castShadow);combined.receiveShadow=meshes.some(mesh=>mesh.receiveShadow);
    world.root.add(combined);meshes.forEach(mesh=>mesh.removeFromParent());removed+=meshes.length-1;
  }
  world.scene.updateMatrixWorld(true);return removed;
}

export function freezeArchitecture(world){
  const moving=new Set(world.animated.map(a=>a.group));
  world.scene.updateMatrixWorld(true);world.scene.matrixAutoUpdate=false;
  world.root.traverse(object=>{if(!moving.has(object)){object.updateMatrix();object.matrixAutoUpdate=false;}});
}

// Broad selection volumes keep the 60k-triangle sculpture out of pointer raycasts.
export function createExhibitPicker(world){
  const geometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshBasicMaterial({visible:false});
  const targets=world.groups.map((group,index)=>{
    const bounds=new THREE.Box3().setFromObject(group).expandByScalar(.06);
    const proxy=new THREE.Mesh(geometry,material);bounds.getCenter(proxy.position);bounds.getSize(proxy.scale);proxy.userData.exhibit=index;
    proxy.updateMatrixWorld(true);proxy.matrixAutoUpdate=false;return proxy;
  });
  return {targets,pick(raycaster){return raycaster.intersectObjects(targets,false)[0]||null;},dispose(){geometry.dispose();material.dispose();}};
}
