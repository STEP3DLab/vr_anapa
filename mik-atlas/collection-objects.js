import * as THREE from './vendor/three.module.min.js';
import {mergeGeometries,mergeVertices} from './vendor/BufferGeometryUtils.js';

// Original exhibition objects. Smooth designed profiles replace stacked primitives.
export function createCollectionObjects(groups,animated){
  const material=(color,metalness,roughness)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
  const ivory=material('#d9d5c4',.32,.3),brass=material('#a18b5c',.8,.29),steel=material('#acb5b1',.95,.19),dark=material('#222b29',.68,.34),copper=material('#915e43',.8,.33);
  const light=new THREE.MeshStandardMaterial({color:'#eadbb7',metalness:.2,roughness:.28,emissive:'#efd1a0',emissiveIntensity:.7});
  const ball=new THREE.SphereGeometry(1,28,18);
  function add(parent,geometry,mat,position=[0,0,0],scale=[1,1,1]){const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(...position);mesh.scale.set(...scale);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  const sphere=(p,position,scale,mat)=>add(p,ball,mat,position,scale);
  const ring=(p,r,t,position,mat,rotation=[0,0,0])=>{const o=add(p,new THREE.TorusGeometry(r,t,8,64),mat,position);o.rotation.set(...rotation);return o;};
  function profile(p,points,position,scale,mat){return add(p,new THREE.LatheGeometry(points.map(v=>new THREE.Vector2(...v)),40),mat,position,scale);}
  function link(p,a,b,r1,r2,mat){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),d=end.clone().sub(start);const o=add(p,new THREE.CylinderGeometry(r2,r1,d.length(),20),mat,start.clone().add(end).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return o;}
  function roundedPlate(p,w,h,depth,r,position,mat){const s=new THREE.Shape();s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.012,bevelThickness:.012,curveSegments:6});return add(p,g,mat,position);}

  const sputnik=new THREE.Group();sputnik.name='Sputnik — polished shell';sputnik.position.set(0,3.03,0);sputnik.rotation.z=.2;groups[1].add(sputnik);
  add(sputnik,new THREE.SphereGeometry(.59,64,40),steel);ring(sputnik,.593,.009,[0,0,0],brass,[Math.PI/2,0,0]);
  for(let i=0;i<20;i++){const a=i*Math.PI/10;sphere(sputnik,[Math.cos(a)*.594,0,Math.sin(a)*.594],[.012,.012,.012],dark);}
  for(const [x,z] of [[-.33,-.28],[.33,-.28],[-.33,.28],[.33,.28]]){
    const start=[x,-.42,z],socket=[x*1.35,-.62,z*1.4],tip=[x*2.9,-1.75,z*3.5];
    sphere(sputnik,start,[.063,.055,.063],brass);link(sputnik,start,socket,.042,.034,steel);link(sputnik,socket,tip,.019,.007,steel);
  }
  link(groups[1],[0,3.64,0],[0,6.4,0],.006,.006,dark);animated.push({group:sputnik,kind:'sputnik'});

  const atom=new THREE.Group();atom.name='Atom — kinetic brass';atom.position.y=2.65;groups[2].add(atom);
  for(let i=0;i<3;i++){const orbit=new THREE.Group();orbit.rotation.set(i*Math.PI/3,.55,0);atom.add(orbit);ring(orbit,1.1,.029,[0,0,0],i===1?copper:brass);sphere(orbit,[1.1,0,0],[.065,.065,.065],light);animated.push({group:orbit,kind:'orbit',speed:.14+i*.05});}
  add(atom,new THREE.IcosahedronGeometry(.3,2),copper);for(const p of [[.19,.08,.05],[-.12,.19,.07],[0,-.17,.17]])sphere(atom,p,[.155,.155,.155],brass);
  profile(groups[2],[[.13,0],[.13,.04],[.06,.09],[.04,1.15],[.09,1.3],[0,1.32]],[0,1.08,0],[1,1,1],brass);

  const robot=new THREE.Group();robot.name='MIK caretaker — enamel and brass';robot.position.y=1.09;groups[3].add(robot);
  // A narrow waist, broad shoulder line and a quiet, continuous helmet.
  profile(robot,[[0,0],[.25,0],[.29,.045],[.33,.16],[.42,.45],[.49,.69],[.46,.83],[.35,.89],[.18,.91],[0,.91]],[0,1.2,0],[1,1,.68],ivory);
  profile(robot,[[0,0],[.29,0],[.35,.05],[.36,.16],[.3,.26],[0,.29]],[0,.87,0],[1,1,.72],ivory);
  profile(robot,[[0,0],[.19,0],[.2,.045],[.18,.08],[.18,.13],[.2,.17],[.19,.2],[0,.2]],[0,1.06,0],[1,1,.85],dark);
  for(let i=0;i<3;i++)ring(robot,.183,.014,[0,1.09+i*.052,0],brass,[Math.PI/2,0,0]);
  link(robot,[0,2.05,0],[0,2.23,0],.105,.09,dark);ring(robot,.115,.018,[0,2.16,0],brass,[Math.PI/2,0,0]);
  profile(robot,[[0,0],[.18,.01],[.3,.075],[.37,.2],[.385,.37],[.355,.5],[.29,.59],[.16,.645],[0,.66]],[0,2.18,0],[1,1,.88],ivory);
  // Recessed optical band and one narrow, warm illuminated slit.
  roundedPlate(robot,.59,.16,.028,.075,[0,2.52,.298],brass);
  roundedPlate(robot,.55,.125,.018,.06,[0,2.52,.333],dark);
  roundedPlate(robot,.35,.022,.004,.008,[0,2.52,.356],light);
  for(const side of [-1,1]){
    const x=v=>v*side;
    sphere(robot,[x(.39),2.53,0],[.055,.115,.115],brass);ring(robot,.071,.012,[x(.43),2.53,0],dark,[0,Math.PI/2,0]);
    const shoulder=[x(.48),1.94,0],elbow=[x(.64),1.44,.065],wrist=[x(.59),.99,.21];
    sphere(robot,shoulder,[.145,.145,.145],brass);link(robot,shoulder,elbow,.13,.1,ivory);sphere(robot,elbow,[.112,.112,.112],dark);
    ring(robot,.106,.019,elbow,brass,[0,Math.PI/2,0]);link(robot,elbow,wrist,.115,.069,ivory);sphere(robot,wrist,[.07,.07,.07],brass);
    roundedPlate(robot,.125,.15,.055,.035,[x(.585),.91,.205],dark);
    for(let f=0;f<3;f++){const fx=x(.54+f*.045);link(robot,[fx,.875,.255],[fx,.785,.28],.018,.016,brass);link(robot,[fx,.785,.28],[fx,.76,.325],.016,.013,brass);}
    const hip=[x(.205),.94,0],knee=[x(.22),.51,.02],ankle=[x(.24),.16,.05];
    sphere(robot,hip,[.12,.12,.12],dark);link(robot,hip,knee,.12,.095,ivory);sphere(robot,knee,[.11,.11,.11],brass);link(robot,knee,ankle,.105,.072,ivory);
    const boot=roundedPlate(robot,.26,.2,.34,.08,[x(.24),.095,-.085],dark);boot.rotation.x=.03;
    roundedPlate(robot,.245,.115,.23,.05,[x(.24),.16,-.06],ivory);
  }
  roundedPlate(robot,.27,.27,.012,.03,[0,1.86,.344],brass);
  // The original college mark is installed here by sculpture.js, never redrawn.
  robot.userData.collegeMark={position:[0,1.86,.381],width:.21};
  for(let i=0;i<4;i++)roundedPlate(robot,.22-i*.018,.012,.008,.005,[0,1.53-i*.047,.3-i*.012],dark);
  animated.push({group:robot,kind:'robot'});

  // Rigid material batches retain every contour while reducing exhibit draw calls.
  for(const object of [sputnik,robot])batchRigidObject(object);
  return {sputnik,atom,robot};
}

function batchRigidObject(root){
  root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),batches=new Map();
  root.traverse(o=>{if(!o.isMesh)return;const key=o.material.uuid;if(!batches.has(key))batches.set(key,[]);batches.get(key).push(o);});
  for(const meshes of batches.values()){
    const geometries=meshes.map(o=>{let g=o.geometry.clone();if(g.index){const expanded=g.toNonIndexed();g.dispose();g=expanded;}return g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));});
    const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());
    if(!geometry)throw new Error('Exhibit geometry could not be batched');
    const indexed=mergeVertices(geometry,1e-5);geometry.dispose();
    const mesh=new THREE.Mesh(indexed,meshes[0].material);mesh.castShadow=mesh.receiveShadow=true;mesh.name='Exhibit material batch';meshes.forEach(o=>o.removeFromParent());root.add(mesh);
  }
}
