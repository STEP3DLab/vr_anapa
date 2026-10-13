import * as THREE from './vendor/three.module.min.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';

// Keep exhibits, raycast targets, instancing, animation and text plates independent.
export function consolidateArchitecture(world){
  const batches=new Map(),protectedGroups=new Set(world.groups);
  world.root.updateMatrixWorld(true);
  world.root.traverse(object=>{
    if(!object.isMesh||object.isInstancedMesh||object===world.floor||Array.isArray(object.material)||object.material.map||object.material.transparent)return;
    for(let p=object.parent;p;p=p.parent)if(protectedGroups.has(p))return;
    const key=object.material.uuid;if(!batches.has(key))batches.set(key,[]);batches.get(key).push(object);
  });
  let removed=0;
  for(const meshes of batches.values()){
    if(meshes.length<2)continue;
    const geometries=meshes.map(mesh=>mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
    const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());
    if(!geometry)continue;
    geometry.computeBoundingSphere();geometry.computeBoundingBox();
    const combined=new THREE.Mesh(geometry,meshes[0].material);combined.name='Architectural batch';
    world.root.add(combined);meshes.forEach(mesh=>mesh.removeFromParent());removed+=meshes.length-1;
  }
  world.scene.updateMatrixWorld(true);return removed;
}
