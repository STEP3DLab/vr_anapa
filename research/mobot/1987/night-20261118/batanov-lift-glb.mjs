// Minimal glTF writer for this indexed triangle assembly and its two measured poses.
import fs from 'node:fs';
import * as T from '../../../../mobot-assets/three.module.min.js';
export function writeLiftGLB(path,rig,tilt,poseAngles){
  const doc={asset:{version:'2.0',generator:'Mobot v22 lift experiment'},scene:0,scenes:[{nodes:[0],extras:{units:'Uncalibrated v22 scene units. Do not interpret as physical metres.',scope:'Experimental loader only; rods mark the lines of centres.'}}],
    nodes:[],meshes:[],materials:[],buffers:[],bufferViews:[],accessors:[],animations:[]};
  const chunks=[],geometries=new Map(),materials=new Map(),nodes=new Map();let size=0;
  function stream(array,type,components){
    const buf=Buffer.from(array.buffer,array.byteOffset,array.byteLength);
    const view=doc.bufferViews.push({buffer:0,byteOffset:size,byteLength:buf.length})-1;
    chunks.push(buf);size+=buf.length;
    const padding=(4-size%4)%4;
    if(padding){chunks.push(Buffer.alloc(padding));size+=padding;}
    const min=Array(components).fill(Infinity),max=Array(components).fill(-Infinity);
    array.forEach((v,i)=>{const j=i%components;min[j]=Math.min(min[j],v);max[j]=Math.max(max[j],v);});
    return doc.accessors.push({bufferView:view,componentType:array instanceof Float32Array?5126:5125,
      count:array.length/components,type,min,max})-1;
  }
  function material(m){
    if(!materials.has(m)){
      const value={pbrMetallicRoughness:{baseColorFactor:[...m.color.toArray(),1],metallicFactor:.18,roughnessFactor:.72}};
      materials.set(m,doc.materials.push(value)-1);
    }
    return materials.get(m);
  }
  function visit(o){
    const raw={name:o.name||o.type,translation:o.position.toArray(),rotation:o.quaternion.toArray(),scale:o.scale.toArray()};
    const id=doc.nodes.push(raw)-1;nodes.set(o,id);
    if(o.isMesh){
      const g=o.geometry,k=g.uuid+':'+o.material.uuid;
      if(!geometries.has(k)){
        const attributes={POSITION:stream(g.attributes.position.array,'VEC3',3),NORMAL:stream(g.attributes.normal.array,'VEC3',3)};
        const primitive={attributes,material:material(o.material)};
        if(g.index)primitive.indices=stream(Uint32Array.from(g.index.array),'SCALAR',1);
        geometries.set(k,doc.meshes.push({primitives:[primitive]})-1);
      }
      raw.mesh=geometries.get(k);
    }
    if(o.children.length)raw.children=o.children.map(visit);
    return id;
  }
  visit(rig);
  const time=stream(Float32Array.of(0,1),'SCALAR',1),channels=[],samplers=[];
  for(const [part,angles] of [[rig,poseAngles.map(x=>-x[0])],[tilt,poseAngles.map(x=>x[1])]]){
    const keys=angles.flatMap(a=>new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),T.MathUtils.degToRad(a)).toArray());
    const sampler=samplers.push({input:time,output:stream(Float32Array.from(keys),'VEC4',4),interpolation:'LINEAR'})-1;
    channels.push({sampler,target:{node:nodes.get(part),path:'rotation'}});
  }
  doc.animations.push({name:'SKTB2 to P014 (illustrative duration)',channels,samplers});
  doc.buffers.push({byteLength:size});
  const json=Buffer.from(JSON.stringify(doc)),js=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
  function header(...fields){const b=Buffer.alloc(fields.length*4);fields.forEach((n,i)=>b.writeUInt32LE(n,i*4));return b;}
  const data=Buffer.concat([header(0x46546c67,2,28+js.length+size),header(js.length,0x4e4f534a),js,header(size,0x004e4942),...chunks]);
  fs.writeFileSync(path,data);
}
