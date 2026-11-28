import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../engine/three.module.min.js';
import {machines} from '../catalog.js';
import {inspections} from '../inspection.js';
import {readFileSync} from 'node:fs';

globalThis.document={createElement:()=>({getContext:()=>null})};
for(const year of [1986,1987]) {
  test(year+' : check every mesh and map every visible surface to an inspection assembly',()=>{
    const m=machines[year].create(T),owners=new Set(),verified=new Set(),all=[];
    const bounds=new T.Box3();
    m.root.traverse(o=>{if(o.isMesh)all.push(o)});
    for(const tool of year===1986?['gripper']:['gripper','breaker-arm','breaker-loader']){
      if(year===1987)m.mechanisms.setWorkTool(tool);
      m.root.updateMatrixWorld(true);
      const visible=new Set();owners.clear();
      m.root.traverseVisible(o=>{if(o.isMesh)visible.add(o)});
      for(const {selection} of inspections[year])for(const node of [selection(m)].flat()){
        assert(node?.isObject3D);
        node.traverse(o=>{if(o.isMesh)owners.add(o)});
      }
      for(const mesh of visible)assert(owners.has(mesh),mesh.name||mesh.userData.part);
      for(const mesh of all){
        const g=mesh.geometry,pos=g.getAttribute('position');
        assert(mesh.matrixWorld.elements.every(Number.isFinite),'non-finite world transform');
        bounds.setFromObject(mesh);assert(!bounds.isEmpty()&&[...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite),'invalid bounds');
        if(mesh.isInstancedMesh)for(let i=0;i<mesh.count;i++){const mat=new T.Matrix4();mesh.getMatrixAt(i,mat);assert(mat.elements.every(Number.isFinite))}
        if(verified.has(g))continue;
        verified.add(g);
        assert(pos&&pos.count>=3&&pos.array.every(Number.isFinite),'invalid vertices');
        if(g.index)assert(g.index.array.every(i=>Number.isInteger(i)&&i>=0&&i<pos.count),'invalid triangle indices');
        assert.equal((g.index?.count??pos.count)%3,0,'incomplete triangles');
      }
      console.log(year,tool,all.length,visible.size,verified.size);
    }
  });
}
test('Archive audit covers every passport node and names both explicit limitations',()=>{
  const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
  const report=read('geometry-audit.html');
  for(const y of [1986,1987])for(const node of JSON.parse(read('data/'+y+'-passport.json')).nodes)
    assert(report.includes('id="y'+y+'-'+node.id+'"'),y+' '+node.id);
  assert.match(report,/не заводские размеры/);
  assert.match(report,/не считываются/);
  assert.match(read('offline-worker.js'),/'geometry-audit.html'/);
  assert.match(read('research-ui.js'),/href="\.\/geometry-audit\.html"/);
});
