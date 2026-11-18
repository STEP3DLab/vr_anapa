// Refine the previous assembly-box veto on the released and longer hangers.
// A disjoint pair of projected vertex intervals proves separation even for nonconvex meshes.
import * as T from '../../../../mobot-assets/three.module.min.js';
import {makeMobot1986} from '../../../../mobot-ch-hv-1986-research-v7-model.js';

const bounds=obj=>new T.Box3().setFromObject(obj,true);
function pieces(group){
  const result=[];
  group.traverse(obj=>{if(obj.isMesh)result.push({obj,box:bounds(obj)});});
  return result;
}
function vertices(obj){
  const points=[],attr=obj.geometry.getAttribute('position');
  for(let i=0;i<attr.count;i++)points.push(new T.Vector3().fromBufferAttribute(attr,i).applyMatrix4(obj.matrixWorld));
  return points;
}
function axes(obj){
  return [[1,0,0],[0,1,0],[0,0,1]].map(v=>new T.Vector3(...v).transformDirection(obj.matrixWorld));
}
function certifiedApart(a,b){
  const av=vertices(a),bv=vertices(b),ax=axes(a),bx=axes(b);
  const candidates=[...ax,...bx,...ax.flatMap(u=>bx.map(v=>u.clone().cross(v)))];
  function separates(n){
    if(n.lengthSq()<1e-18)return false;
    n.normalize();
    const aa=av.map(p=>p.dot(n)),bb=bv.map(p=>p.dot(n));
    return Math.min(...aa)>Math.max(...bb)+1e-8 || Math.min(...bb)>Math.max(...aa)+1e-8;
  }
  if(candidates.some(separates))return true;
  function directions(mesh,points){
    const idx=mesh.geometry.index?.array ?? points.map((_,i)=>i);
    const edges=[],normals=[];
    for(let i=0;i<idx.length;i+=3){
      const triangle=[points[idx[i]],points[idx[i+1]],points[idx[i+2]]];
      const e=triangle.map((p,j)=>triangle[(j+1)%3].clone().sub(p));
      edges.push(...e);normals.push(e[0].clone().cross(e[1]));
    }
    return {edges,normals};
  }
  const A=directions(a,av),B=directions(b,bv);
  return A.normals.some(separates) || B.normals.some(separates) ||
    A.edges.some(u=>B.edges.some(v=>separates(u.clone().cross(v))));
}

// A segment crossing a triangle strictly between its endpoints and inside all
// three triangle edges is a positive witness; coplanar contacts stay unresolved.
function surfaceCrossing(a,b){
  const av=vertices(a),bv=vertices(b);
  const indices=obj=>obj.geometry.index?.array ?? Array.from({length:obj.geometry.attributes.position.count},(_,i)=>i);
  const ai=indices(a),bi=indices(b),hit=new T.Vector3(),bary=new T.Vector3();
  for(let i=0;i<ai.length;i+=3)for(let j=0;j<bi.length;j+=3){
    const tri=new T.Triangle(bv[bi[j]],bv[bi[j+1]],bv[bi[j+2]]);
    for(let k=0;k<3;k++){
      const start=av[ai[i+k]],end=av[ai[i+(k+1)%3]],v=end.clone().sub(start),length=v.length();
      if(length<1e-8)continue;
      const ray=new T.Ray(start,v.normalize());
      if(!ray.intersectTriangle(tri.a,tri.b,tri.c,false,hit))continue;
      const along=start.distanceTo(hit);
      if(along<1e-8 || along>length-1e-8)continue;
      tri.getBarycoord(hit,bary);
      if(Math.min(bary.x,bary.y,bary.z)>1e-7)return {
        edgeMesh:a.name,faceMesh:b.name,edgeTriangle:i/3,edgeIndex:k,faceTriangle:j/3,
        worldPoint:hit.toArray(),segmentFraction:along/length,barycentric:bary.toArray()
      };
    }
  }
  return null;
}

function* samplePoses(stress){
  if(stress){
    for(const sign of [-1,1])for(let yaw=130;yaw<=180;yaw++)for(let grab=0;grab<=32;grab+=2)
      yield {yaw:sign*yaw,boom:0,loader:16,tip:25,grab};
    return;
  }
  for(let yaw=-180;yaw<=180;yaw+=15)for(const boom of [0,16,32])for(const loader of [0,8,16])
    for(const tip of [-5,10,25])for(const grab of [0,16,32])yield {yaw,boom,loader,tip,grab};
}
const results=[];
for(const stress of [false,true])for(const extension of [.105,.120,.135,.150,.165,.180]){
  const model=makeMobot1986(T,extension);
  const {grab,scoop}=model.mechanisms;
  const targets=[scoop,model.root.getObjectByName('Арочный кожух'),model.root.getObjectByName('Настил платформы')];
  let poses=0,flaggedPairs=0,componentBoxOverlaps=0,unresolved=0,crossings=0;
  const examples=[];
  for(const pose of samplePoses(stress)){
      model.setPose(pose);poses++;
      const grabBox=bounds(grab);
      for(const target of targets){
        if(!grabBox.intersectsBox(bounds(target)))continue;
        flaggedPairs++;
        const aa=pieces(grab),bb=pieces(target);
        for(const a of aa)for(const b of bb){
          if(!a.box.intersectsBox(b.box))continue;
          componentBoxOverlaps++;
          if(!certifiedApart(a.obj,b.obj)){
            const crossing=surfaceCrossing(a.obj,b.obj) ?? surfaceCrossing(b.obj,a.obj);
            if(crossing)crossings++;else unresolved++;
            if(examples.length<5)examples.push({pose,a:a.obj.name,b:b.obj.name,crossing});
          }
        }
      }
    }
  results.push({extension,grid:stress?'raised bucket stress':'regular',poses,flaggedPairs,componentBoxOverlaps,unresolved,crossings,
    separationStatus:crossings?'FAIL':unresolved?'UNRESOLVED':'PASS',examples});
}
console.log(JSON.stringify({scope:'Six variants on regular and raised-bucket grids, grapple vs scoop/hood/deck only.',results},null,2));
if(results.some(row=>row.extension===.105 && row.separationStatus!=='PASS'))process.exitCode=1;
