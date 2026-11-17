// Offline surface audit. Only compares disjoint active assemblies named by inspectPose.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../../../../mobot-assets/three.module.min.js';
import {makeMobot as before} from '../../../../mobot-engineering-v21-model.js';
import {makeMobot as after} from '../../../../mobot-engineering-v22-model.js';
globalThis.document={createElement:()=>({getContext:()=>null})};
const EPS=1e-9, vec=()=>new T.Vector3();
function triangles(mesh){
  const idx=mesh.object.geometry.index?.array;
  const count=idx?.length??mesh.points.length;
  const out=[];
  for(let i=0;i<count;i+=3){
    const v=[0,1,2].map(j=>mesh.points[idx?idx[i+j]:i+j]);
    const t=new T.Triangle(...v);
    if(t.getArea()<1e-14)continue;
    out.push({v,t,face:i/3,box:new T.Box3().setFromPoints(v),plane:t.getPlane(new T.Plane())});
  }
  return out;
}
function coplanarEdge(a,b,target){
  // Flatten onto the two coordinates with largest projected surface area.
  const n=target.plane.normal.toArray().map(Math.abs);
  const skip=n.indexOf(Math.max(...n)),axes=['x','y','z'].filter((_,i)=>i!==skip);
  const uv=p=>new T.Vector2(p[axes[0]],p[axes[1]]);
  const start=uv(a), r=uv(b).sub(start);
  for(let j=0;j<3;j++){
    const c=uv(target.v[j]), s=uv(target.v[(j+1)%3]).sub(c);
    const delta=c.sub(start), denom=r.cross(s);
    if(Math.abs(denom)<1e-15)continue;
    const t=delta.cross(s)/denom, u=delta.cross(r)/denom;
    if(t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS)return a.clone().lerp(b,t);
  }
}
function firstEdgeHit(from,to){
  for(let i=0;i<3;i++){
    const a=from.v[i],b=from.v[(i+1)%3];
    const d=to.plane.distanceToPoint(a),e=to.plane.distanceToPoint(b);
    if(Math.abs(d)<EPS && to.t.closestPointToPoint(a,vec()).distanceTo(a)<EPS)return a;
    if(Math.abs(d)<EPS && Math.abs(e)<EPS){
      const p=coplanarEdge(a,b,to);if(p)return p;
    }else if(d*e<=0){
      const p=a.clone().lerp(b,d/(d-e));
      if(to.t.closestPointToPoint(p,vec()).distanceTo(p)<EPS)return p;
    }
  }
}
function contact(a,b){
  if(!a.box.intersectsBox(b.box))return;
  a.faces??=triangles(a);b.faces??=triangles(b);
  for(const t of a.faces)for(const u of b.faces){
    if(!t.box.intersectsBox(u.box))continue;
    const p=firstEdgeHit(t,u)??firstEdgeHit(u,t);
    if(p)return {parts:[a.name,b.name],faces:[t.face,u.face],point:p.toArray()};
  }
}
// A strict gap on any axis proves even the convex hulls of both meshes disjoint.
function separation(a,b){
  const axes=[...a.faces,...b.faces].map(f=>f.plane.normal);
  const edges=mesh=>{
    const dirs=new Map();
    for(const f of mesh.faces)for(let i=0;i<3;i++){
      const d=f.v[i].clone().sub(f.v[(i+1)%3]).normalize();
      const primary=[d.x,d.y,d.z].find(n=>Math.abs(n)>EPS);
      if(primary<0)d.negate();
      dirs.set(d.toArray().map(x=>Math.round(x*1e6)).join('/'),d);
    }
    return dirs.values();
  };
  function check(n){
    if(n.lengthSq()<1e-16)return;
    const axis=n.clone().normalize();
    const span=m=>{
      const t=m.points.map(p=>p.dot(axis));return [Math.min(...t),Math.max(...t)];
    };
    const u=span(a),v=span(b),gap=Math.max(v[0]-u[1],u[0]-v[1]);
    if(gap>EPS)return {parts:[a.name,b.name],axis:axis.toArray(),intervals:[u,v],gap};
  }
  for(const axis of axes){const result=check(axis);if(result)return result;}
  const eb=[...edges(b)];
  for(const x of edges(a))for(const y of eb){
    const result=check(vec().crossVectors(x,y));if(result)return result;
  }
}
function collect(root){
  const meshes=[];
  root.traverseVisible(o=>{
    if(!o.isMesh)return;
    // These three active tools and the hood have no instanced geometry.
    assert(!o.isInstancedMesh,'instance matrices need explicit expansion');
    const attr=o.geometry.attributes.position;
    const points=Array.from({length:attr.count},(_,i)=>vec().fromBufferAttribute(attr,i).applyMatrix4(o.matrixWorld));
    let p=o;const path=[];
    while(p!==root){path.unshift(p.parent.children.indexOf(p));p=p.parent;}
    const name=[root.name,...path,o.name||o.geometry.type].join('/');
    meshes.push({object:o,name,points,box:new T.Box3().setFromPoints(points)});
  });
  return meshes;
}
function selfTest(){
  const mesh=(coords,name)=>{const points=coords.map(p=>new T.Vector3(...p));return {points,name,
    object:{geometry:{}},box:new T.Box3().setFromPoints(points)};};
  const base=mesh([[0,0,0],[1,0,0],[0,1,0]],'base');
  assert(contact(base,mesh([[.2,.2,-1],[.2,.2,1],[.4,.3,0]],'cross')));
  assert(contact(base,mesh([[.9,-.1,0],[.9,.9,0],[1.1,1,0]],'coplanar')));
  assert(!contact(base,mesh([[.8,.8,0],[.8,2,0],[2,.8,0]],'disjoint')));
}
selfTest();
const defaults={yaw:0,arm:0,wrist:90,claw:4,bucket:8,tip:0};
const demos=[['gripper',{}],['gripper',{yaw:180,arm:-8,bucket:0}],
  ['gripper',{yaw:90,claw:22,bucket:0}],['breaker-arm',{yaw:-65,arm:22,wrist:60,bucket:0}],
  ['breaker-loader',{bucket:36}],['gripper',{yaw:90,bucket:32,tip:-10}]];
const modes=['gripper','breaker-arm','breaker-loader'];
function sweep(build){
  const model=build(T,'desktop'), m=model.mechanisms;
  const hood=model.meshes.find(o=>o.name.startsWith('Кожух с плоской'));
  const rows=[];
  function audit(tool,pose,demo=false){
    m.setWorkTool(tool);m.setPose({...defaults,...pose});
    const broad=m.inspectPose(), working=collect(tool==='breaker-loader'?m.breakerLoader:m.scoopShell);
    const carried=tool==='breaker-loader'?[]:collect(tool==='gripper'?m.fingerHead:m.breakerArm);
    let minY=Infinity,ground;
    for(const o of [...working,...carried])for(const [i,p] of o.points.entries()){
      if(p.y<minY){minY=p.y;ground={mesh:o.name,vertex:i,point:p.toArray(),depth:broad.datum-p.y};}
    }
    assert(Math.abs(broad.clearance-(minY-broad.datum))<1e-8);
    const envelopes=[];
    for(const [group,targets] of [['bucket',working],['hood',collect(hood)]]){
      if(!carried.length)continue;
      const box=arr=>arr.reduce((b,o)=>b.union(o.box),new T.Box3());
      if(!box(carried).intersectsBox(box(targets)))continue;
      const hits=[],separated=[],unresolved=[];let meshBoxPairs=0;
      for(const a of carried)for(const b of targets){
        if(!a.box.intersectsBox(b.box))continue;
        meshBoxPairs++;
        const witness=contact(a,b);
        if(witness)hits.push(witness);
        else {
          const certificate=separation(a,b);
          if(certificate)separated.push(certificate);
          else unresolved.push([a.name,b.name]);
        }
      }
      envelopes.push({group,meshBoxPairs,hits,separated,unresolved});
    }
    const below=ground.depth>.0001;
    assert.equal(broad.alerts.length,envelopes.length+Number(below));
    return {tool,pose,demo,ground:below?ground:null,envelopes};
  }
  for(const tool of modes)for(const yaw of [-180,0,90])for(const arm of [-18,0,25])
    for(const bucket of [-8,12,36])rows.push(audit(tool,{yaw,arm,bucket,claw:8}));
  const demoRows=demos.map(([tool,pose])=>audit(tool,pose,true));
  assert(demoRows.every(r=>!r.ground&&!r.envelopes.length));
  const all=rows.flatMap(r=>r.envelopes);
  const counts={flagged:rows.filter(r=>r.ground||r.envelopes.length).length,
    below:rows.filter(r=>r.ground).length,envelopes:all.length,
    surfacePairs:all.filter(e=>e.hits.length).length,
    confirmedPoses:rows.filter(r=>r.ground||r.envelopes.some(e=>e.hits.length)).length};
  return {counts,rows,demoRows};
}
const data={defaults,v21:sweep(before),v22:sweep(after)};
assert.equal(data.v21.counts.flagged,50);
fs.writeFileSync(new URL('contact-sweep.json',import.meta.url),JSON.stringify(data)+'\n');
for(const rev of ['v21','v22'])console.log(rev,data[rev].counts);
