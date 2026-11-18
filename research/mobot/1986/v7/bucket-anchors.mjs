// Read exterior points from the public meshes and emit actual scoop transforms.
import * as T from '../../../../mobot-assets/three.module.min.js';
import {makeMobot1986} from '../../../../mobot-ch-hv-1986-research-v7-model.js';
const m=makeMobot1986(T), scoop=m.mechanisms.scoop;
const cheeks=scoop.children.filter(o=>o.name==='Боковина ковша');
const points=cheeks.map(mesh=>{
  const z=mesh.position.z+(mesh.position.z>0?mesh.geometry.parameters.options.depth:0);
  return mesh.geometry.parameters.shapes.getPoints().slice(0,-1).map(v=>[v.x,v.y,z]);
});
const edge=scoop.getObjectByName('Режущая кромка');
const {width,depth}=edge.geometry.parameters;
const lip=[-1,1].map(s=>scoop.worldToLocal(edge.localToWorld(new T.Vector3(width/2,0,s*depth/2))).toArray());
const poses=[];
for(let lift=m.limits.loader[0];lift<=m.limits.loader[1];lift++){
  for(let tip=m.limits.tip[0];tip<=m.limits.tip[1];tip++){
    m.setPose({loader:lift,tip});
    poses.push({lift,tip,matrix:scoop.matrixWorld.toArray()});
  }
}
console.log(JSON.stringify({cheeks:points,lip,poses}));
