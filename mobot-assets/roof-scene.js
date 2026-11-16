import * as T from './three.module.min.js';
import {makeMobot} from '../mobot-engineering-v16-model.js';
import {route} from './roof-operation.js';

// Merge rigid siblings by material for the exhibit. Animated treads and wheel
// hubs keep their own transforms, as do the bucket and its two moving joints.
function batchRigidParts(parts){
  const parents=new Set();
  for(const part of Object.values(parts))part.traverseVisible(node=>{if(node.isGroup)parents.add(node);});
  for(const parent of parents){
    const batches=new Map();
    for(const mesh of parent.children){
      if(!mesh.visible||!mesh.isMesh||mesh.isInstancedMesh||mesh.children.length||Array.isArray(mesh.material))continue;
      if(!batches.has(mesh.material))batches.set(mesh.material,[]);
      batches.get(mesh.material).push(mesh);
    }
    for(const [material,meshes] of batches){
      if(meshes.length<2)continue;
      const geometry=new T.BufferGeometry(),indexes=[];
      const originals=meshes.map(mesh=>{
        mesh.updateMatrix();return mesh.geometry.clone().applyMatrix4(mesh.matrix);
      });
      let offset=0;
      for(const shape of originals){
        const count=shape.attributes.position.count,index=shape.index;
        for(let i=0;i<(index?index.count:count);i++)indexes.push(offset+(index?index.getX(i):i));
        offset+=count;
      }
      geometry.setIndex(indexes);
      for(const name of ['position','normal','uv']){
        if(!originals.every(shape=>shape.attributes[name]))continue;
        const size=originals[0].attributes[name].itemSize,buffer=new Float32Array(offset*size);
        let i=0;
        for(const shape of originals){const data=shape.attributes[name].array;buffer.set(data,i);i+=data.length;}
        geometry.setAttribute(name,new T.BufferAttribute(buffer,size));
      }
      parent.remove(...meshes);parent.add(new T.Mesh(geometry,material));
      originals.forEach(shape=>shape.dispose());
    }
  }
}

export function makeRoofScene(){
  const scene=new T.Scene(), world=new T.Group();
  scene.add(world);
  const matte=(color,metalness=.05)=>new T.MeshStandardMaterial({color,metalness,roughness:.82});
  const concrete=matte(0x82918c), slab=matte(0x50615d), seam=matte(0x5d6e69);
  const white=matte(0xcfceaf), orange=matte(0xd48449), pad=matte(0x68776f);
  function block(size,position,material){
    const o=new T.Mesh(new T.BoxGeometry(...size),material);o.position.set(...position);world.add(o);return o;
  }
  // A cutaway specimen of roof, deliberately schematic and open at the sides.
  block([9.4,.17,3.36],[-.05,-.19,0],slab);
  block([9.4,.12,3.36],[-.05,-.045,0],concrete);
  for(let x=-3.25;x<4.7;x+=1.58)block([.019,.009,3.35],[x,.018,0],seam);
  for(const z of [-1.23,1.23]){
    for(let x=-2.62;x<4.2;x+=.66)block([.35,.009,.030],[x,.025,z],white);
  }
  block([1.4,.021,2.12],[-3.65,.026,0],pad);
  for(const z of [-1.04,1.04])block([1.42,.009,.065],[-3.65,.042,z],orange);
  for(const x of [-4.34,-2.96])block([.065,.009,2.07],[x,.042,0],orange);
  for(let i=0;i<5;i++) {
    const mark=block([.19,.008,.046],[-4.17+i*.255,.043,.86],orange);
    mark.rotation.y=-.65;
  }

  const model=makeMobot(T,'mobile'), robot=model.root, m=model.mechanisms;
  model.parts.dock.visible=false;world.add(robot);robot.position.y=-.105;
  m.gripper.rotation.z=T.MathUtils.degToRad(63);
  for(const f of m.fingers)f.group.rotation.z=-f.side*.11;
  batchRigidParts(model.parts);
  const stones=[], sizes=[.145,.19,.133];
  const starts=[[-.02,.136,-.28],[-.16,.17,.085],[-.19,.123,.36]];
  const seats=[[-.47,-.124,-.29],[-.58,-.095,.072],[-.49,-.127,.355]];
  const ends=[[-3.53,.152,-.35],[-3.73,.194,.08],[-3.49,.148,.41]];
  for(let i=0;i<3;i++){
    const rock=new T.Mesh(new T.IcosahedronGeometry(sizes[i],0),matte([0x916f58,0xb69473,0x715f51][i]));
    rock.scale.set(1.26,.78,1.03);rock.rotation.set(.34*i,.59+i,.20+i*.15);
    rock.position.fromArray(starts[i]);world.add(rock);stones.push(rock);
  }
  scene.add(new T.HemisphereLight(0xfff8e7,0x91a59c,2.2));
  const light=new T.DirectionalLight(0xffefda,4);light.position.set(-3,7,4);scene.add(light);
  const fill=new T.DirectionalLight(0xe6f3ff,2.1);fill.position.set(4,3,-3);scene.add(fill);
  // Convert the bucket's coordinates into exhibit space, also in tabletop VR.
  const localFromBucket=new T.Matrix4(), invWorld=new T.Matrix4(), seat=new T.Vector3();
  let lastX=NaN;
  function update(s){
    robot.position.x=s.x;
    if(s.x!==lastX){m.setTrackPhase(route.start-s.x);lastX=s.x;}
    m.bucketLift.rotation.z=T.MathUtils.degToRad(-s.lift);
    m.bucketTilt.rotation.z=T.MathUtils.degToRad(s.tip);
    m.updateLinkages();world.updateWorldMatrix(true,true);
    localFromBucket.multiplyMatrices(invWorld.copy(world.matrixWorld).invert(),m.bucketTilt.matrixWorld);
    const pickupMix=s.loaded||s.step===5?1:(s.step===1?T.MathUtils.clamp((route.pickup+.37-s.x)/.37,0,1):0);
    for(let i=0;i<3;i++){
      const rock=stones[i];seat.fromArray(seats[i]).applyMatrix4(localFromBucket);
      rock.position.fromArray(starts[i]).lerp(seat,pickupMix);
      const t=s.drop;
      if(t>0){
        rock.position.x=T.MathUtils.lerp(seat.x,ends[i][0],t);
        rock.position.y=T.MathUtils.lerp(seat.y,ends[i][1],t*t)+.055*Math.sin(Math.PI*t);
        rock.position.z=T.MathUtils.lerp(seat.z,ends[i][2],t);
      }
      rock.rotation.z=.2+i*.15+(pickupMix?T.MathUtils.degToRad(s.tip-s.lift)*pickupMix:0)+t*(.4+i*.34);
    }
  }
  return {scene,world,update};
}
