import * as T from '../../../mobot-assets/three.module.min.js';
import {makeMobot} from '../../../mobot-engineering-v21-model.js';
import assert from 'node:assert/strict';
globalThis.document={createElement:()=>({getContext:()=>null})};
const robot=makeMobot(T,'desktop'), m=robot.mechanisms;
const methods=['gripper','breaker-arm','breaker-loader'];
let poses=0, warnings=0;
for(const tool of methods){
  m.setWorkTool(tool);
  for(const yaw of [-180,0,90])for(const arm of [-18,0,25])for(const bucket of [-8,12,36]){
    m.setPose({arm,yaw,bucket,wrist:90,claw:8,tip:0});
    robot.root.traverse(o=>{assert(o.matrixWorld.elements.every(Number.isFinite));if(o!==robot.root)assert(o.parent)});
    const audit=m.inspectPose();
    assert(Number.isFinite(audit.clearance));if(audit.alerts.length)warnings++;poses++;
  }
}
assert(warnings>0&&warnings<poses);
for(const mesh of robot.meshes){
  for(const attrib of Object.values(mesh.geometry.attributes))assert(attrib.array.every(Number.isFinite));
  if(mesh.isInstancedMesh)assert(mesh.instanceMatrix.array.every(Number.isFinite));
}
export function checkAttachments(tool,pose){
  m.setWorkTool(tool);m.setPose(pose);
  const boxes=[];
  robot.root.traverseVisible(o=>{
    if(!o.isMesh)return;
    o.geometry.computeBoundingBox();
    for(let i=0;i<(o.isInstancedMesh?o.count:1);i++){
      const local=new T.Matrix4();if(o.isInstancedMesh)o.getMatrixAt(i,local);
      const bounds=o.geometry.boundingBox.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(o.matrixWorld,local));
      boxes.push({bounds,name:[o.userData.part,o.name,o.id,i].join('/'),seen:false});
    }
  });
  const components=[];
  for(const entry of boxes){
    if(entry.seen)continue;
    const component=[],queue=[entry]; entry.seen=true;
    while(queue.length){
      const o=queue.pop();component.push(o.name);
      const envelope=o.bounds.clone().expandByScalar(.003);
      for(const other of boxes)if(!other.seen && envelope.intersectsBox(other.bounds)){
        other.seen=true;queue.push(other);
      }
    }
    components.push(component);
  }
  return components.sort((a,b)=>b.length-a.length);
}
for(const tool of methods){
  const components=checkAttachments(tool,{arm:0,yaw:0,bucket:tool==='breaker-loader'?36:12,wrist:90,claw:4,tip:0});
  if(components.length!==1)console.log(tool,components.slice(1).map(c=>c.slice(0,3)));
  assert.equal(components.length,1,'detached bounding volumes in assembled scene');
}
console.log(JSON.stringify({poses,warnings,meshes:robot.meshes.length,attachmentTolerance:.003}));
