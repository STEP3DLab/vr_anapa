import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
/** Batch only direct, opaque, non-interactive children. Animated groups stay untouched. */
export function batchStatic(root:T.Group,keep=new Set<T.Object3D>()){
 const batches=new Map<string,T.Mesh[]>();
 for(const child of [...root.children]){
  const m=child as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
  if(!m.isMesh||(m as unknown as T.InstancedMesh).isInstancedMesh||Array.isArray(m.material)||
     m.material.transparent||m.material.map||m.userData.action||m.userData.dynamic||keep.has(m))continue;
  const key=m.material.uuid+'|'+Object.keys(m.geometry.attributes).sort().join(',')+'|'+!!m.geometry.index;
  const list=batches.get(key)||[];list.push(m);batches.set(key,list);
 }
 const merged:T.BufferGeometry[]=[];
 for(const meshes of batches.values()){
  if(meshes.length<3)continue;
  const copies=meshes.map(m=>{m.updateMatrix();return m.geometry.clone().applyMatrix4(m.matrix);});
  const geometry=mergeGeometries(copies,false);copies.forEach(g=>g.dispose());
  if(!geometry)continue;
  geometry.computeBoundingSphere();const mesh=new T.Mesh(geometry,meshes[0].material);mesh.name='static-batch';root.add(mesh);
  meshes.forEach(m=>root.remove(m));merged.push(geometry);
 }
 return ()=>merged.forEach(g=>g.dispose());
}
