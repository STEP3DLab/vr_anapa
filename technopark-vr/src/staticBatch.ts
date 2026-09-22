import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
/** Batch only direct, opaque, non-interactive children. Animated groups stay untouched. */
export function batchStatic(root:T.Group,keep=new Set<T.Object3D>()){
 const batches=new Map<string,T.Mesh[]>();
 for(const child of [...root.children]){
  const m=child as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
  if(!m.isMesh||(m as unknown as T.InstancedMesh).isInstancedMesh||Array.isArray(m.material)||
     !m.visible||m.material.transparent||m.material.map||m.userData.action||m.userData.dynamic||keep.has(m))continue;
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

/** One draw call for the rigid, opaque parts of a small coloured prop.
 * Vertex colours preserve its silhouette/material palette; animated parts are excluded. */
export function batchPalette(root:T.Group,keep:Set<T.Object3D>){
 const meshes=root.children.filter((o):o is T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>=>{
  const m=o as T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
  return !!m.isMesh&&!(m as unknown as T.InstancedMesh).isInstancedMesh&&m.visible&&!keep.has(m)&&!Array.isArray(m.material)&&m.material.isMeshStandardMaterial&&!m.material.map&&!m.material.transparent;
 });
 const copies=meshes.map(m=>{m.updateMatrix();const g=m.geometry.clone().applyMatrix4(m.matrix),colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<colors.length;i+=3){colors[i]=m.material.color.r;colors[i+1]=m.material.color.g;colors[i+2]=m.material.color.b;}g.setAttribute('color',new T.BufferAttribute(colors,3));return g;});
 const geometry=mergeGeometries(copies,false);copies.forEach(g=>g.dispose());
 if(!geometry)return ()=>{};
 const material=new T.MeshStandardMaterial({vertexColors:true,metalness:.42,roughness:.48}),mesh=new T.Mesh(geometry,material);mesh.name='rigid-palette';root.add(mesh);meshes.forEach(m=>root.remove(m));
 return ()=>{geometry.dispose();material.dispose();};
}
