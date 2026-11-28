// Transferred from research/mobot/1987/night-20261118/contact.js.
// The original triangle witnesses, separating axes and tolerances are preserved.
// Only the Three.js import is relocated to the common exhibit engine.
// Scope: gripper/arm-mounted breaker against bucket/hood, plus nominal ground.
// The loader-mounted breaker is checked against the nominal ground only.
// This is not an all-pairs collision solver or a validation of the real robot.
import * as T from './three.module.min.js';
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
export function contact(a,b){
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
    if(o.isInstancedMesh)throw new Error('Instance matrices require explicit expansion');
    const attr=o.geometry.attributes.position;
    const points=Array.from({length:attr.count},(_,i)=>vec().fromBufferAttribute(attr,i).applyMatrix4(o.matrixWorld));
    let p=o;const path=[];
    while(p!==root){path.unshift(p.parent.children.indexOf(p));p=p.parent;}
    const name=[root.name,...path,o.name||o.geometry.type].join('/');
    meshes.push({object:o,name,points,box:new T.Box3().setFromPoints(points)});
  });
  return meshes;
}
export function inspectSurfaces(m,hood,tool,broad){
    const working=collect(tool==='breaker-loader'?m.breakerLoader:m.scoopShell);
    const carried=tool==='breaker-loader'?[]:collect(tool==='gripper'?m.fingerHead:m.breakerArm);
    let minY=Infinity,ground;
    for(const o of [...working,...carried])for(const [i,p] of o.points.entries()){
      if(p.y<minY){minY=p.y;ground={mesh:o.name,vertex:i,point:p.toArray(),depth:broad.datum-p.y};}
    }

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

    return {ground:below?ground:null,envelopes,clearance:minY-broad.datum};
  }


// General selected-pair inspection for assembled, non-instanced groups.
// A disjoint group bound is a conservative certificate; an overlapping
// bound alone is not a collision. Unresolved includes possible containment.
export function inspectGroupPairs(pairs) {
  const bounds=new Map(), meshes=new Map();
  const box=root=>{if(!bounds.has(root))bounds.set(root,new T.Box3().setFromObject(root));return bounds.get(root)};
  const list=root=>{if(!meshes.has(root))meshes.set(root,collect(root));return meshes.get(root)};
  return pairs.map(({id,a,b})=>{
    if(!a||!b)throw new Error('Missing group '+id);
    const hits=[],separated=[],unresolved=[];
    const aa=box(a),bb=box(b);
    if(aa.isEmpty()||bb.isEmpty())throw new Error('Empty group '+id);
    const broadOverlap=aa.intersectsBox(bb);
    let meshBoxPairs=0;
    if(broadOverlap)for(const x of list(a))for(const y of list(b)){
      if(!x.box.intersectsBox(y.box))continue;
      meshBoxPairs++;
      const witness=contact(x,y);
      if(witness)hits.push(witness);
      else {
        const certificate=separation(x,y);
        if(certificate)separated.push(certificate);
        else unresolved.push([x.name,y.name]);
      }
    }
    return {id,broadOverlap,meshBoxPairs,hits,separated,unresolved,
      status:hits.length?'confirmed':unresolved.length?'unresolved':'clear-in-checked-scope'};
  });
}
