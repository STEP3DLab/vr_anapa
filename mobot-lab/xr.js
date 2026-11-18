// A table-top exhibit with a controller-operated panel in the XR scene.
import * as T from './engine/three.module.min.js';

function createExhibit(model) {
  // Each batch shares a material and a vertex layout. Keep the original joint
  // hierarchy as the authority for motion, including the individual track pads.
  const sets=new Map(), root=new T.Group();
  model.traverse(o=>{
    if(!o.isMesh)return;
    const g=o.geometry;
    const key=[o.material.uuid,Boolean(g.index),...Object.keys(g.attributes).sort()].join(':');
    if(!sets.has(key))sets.set(key,{objects:[],geometries:new Set()});
    const set=sets.get(key);set.objects.push(o);set.geometries.add(g);
  });
  const transforms=[],local=new T.Matrix4(),world=new T.Matrix4();
  for(const {objects,geometries} of sets.values()){
    let vertices=0,indices=0,count=0;
    for(const g of geometries){vertices+=g.attributes.position.count;indices+=g.index?.count??0}
    for(const o of objects)count+=o.isInstancedMesh?o.count:1;
    if(!count)continue;
    const batch=new T.BatchedMesh(count,vertices,Math.max(indices,1),objects[0].material);
    batch.perObjectFrustumCulled=false;batch.frustumCulled=false;batch.sortObjects=false;
    const ids=new Map();
    for(const g of geometries)ids.set(g,batch.addGeometry(g));
    for(const o of objects){
      const n=o.isInstancedMesh?o.count:1;
      const instances=Array.from({length:n},()=>batch.addInstance(ids.get(o.geometry)));
      transforms.push({batch,o,instances});
    }
    root.add(batch);
  }
  function sync(){
    model.updateWorldMatrix(true,true);
    const inverse=new T.Matrix4().copy(model.matrixWorld).invert();
    for(const {batch,o,instances} of transforms){
      let visible=true;
      for(let parent=o;parent&&parent!==model;parent=parent.parent)visible=visible&&parent.visible;
      world.multiplyMatrices(inverse,o.matrixWorld);
      instances.forEach((id,index)=>{
        batch.setVisibleAt(id,visible);
        if(o.isInstancedMesh){o.getMatrixAt(index,local);local.premultiply(world);batch.setMatrixAt(id,local)}
        else batch.setMatrixAt(id,world);
      });
    }
  }
  sync();return {root,sync,dispose(){for(const b of root.children)b.dispose()}};
}

export function createXR(renderer,callbacks) {
  const scene=new T.Scene();scene.background=new T.Color(0x202a23);
  const room=new T.Group();scene.add(room);
  const camera=new T.PerspectiveCamera(58,1,.02,60);
  const fill=new T.HemisphereLight(0xf5f9e8,0x8eab96,2.7);
  const sun=new T.DirectionalLight(0xfff6df,3.6);sun.position.set(3,6,4);
  const rim=new T.DirectionalLight(0xc2e5ff,2);rim.position.set(-2,3,-3);
  scene.add(fill,sun,rim);
  const grid=new T.GridHelper(16,64,0x61795f,0x3c4e40);room.add(grid);
  const pedestal=new T.Mesh(new T.CylinderGeometry(1.04,.92,.11,64),new T.MeshStandardMaterial({color:0x455546,roughness:.82}));
  pedestal.position.set(.18,.73,-1.9);room.add(pedestal);
  const holder=new T.Group();holder.position.set(.18,.785,-1.9);room.add(holder);
  const board=document.createElement('canvas');board.width=680;board.height=862;
  const ctx=board.getContext('2d'), texture=new T.CanvasTexture(board);texture.colorSpace=T.SRGBColorSpace;
  const plane=new T.Mesh(new T.PlaneGeometry(.46,.583),new T.MeshBasicMaterial({map:texture,toneMapped:false}));
  plane.position.set(-.64,1.28,-1.03);plane.rotation.y=.36;room.add(plane);
  const ray=new T.Raycaster(),direction=new T.Vector3(),origin=new T.Vector3();
  const pick=controller=>{
    controller.getWorldPosition(origin);controller.getWorldDirection(direction).negate();
    ray.set(origin,direction);return ray.intersectObject(plane,false)[0];
  };
  let buttons=[],exhibit=null,activeSession=null,refresh=()=>{};
  function paint(){
    const s=callbacks.get(), accent='#d4f778';
    ctx.fillStyle='#edf2e7';ctx.fillRect(0,0,680,862);
    ctx.fillStyle='#354932';ctx.font='24px sans-serif';ctx.fillText('ЛАБОРАТОРИЯ МОБОТ',38,52);
    ctx.font='bold 45px sans-serif';ctx.fillStyle='#202823';ctx.fillText(s.name,38,115);
    const actions=[
      ['Сменить робот  ·  '+(s.year===1986?'1987':'1986'),callbacks.switchModel],
      ['Механизм  ·  '+s.jointName,callbacks.nextJoint],
      ['−     '+s.jointName,()=>callbacks.change(-1)],
      ['+     '+s.jointName,()=>callbacks.change(1)],
      [s.year===1987?'Оснастка  ·  '+s.toolName:'Исходное положение',s.year===1987?callbacks.nextTool:callbacks.reset],
      ['Повернуть модель на 30°',()=>{holder.rotation.y+=Math.PI/6}],
      ['Закрыть VR',()=>activeSession?.end()]
    ];
    buttons=actions.map(([label,run],i)=>{
      const y=146+i*88;ctx.fillStyle=i===0?accent:'#d9e2d2';ctx.fillRect(30,y,620,72);
      ctx.font='bold 29px sans-serif';ctx.fillStyle='#223021';ctx.fillText(label,48,y+46,586);
      return {x:30,y,w:620,h:72,run};
    });
    ctx.fillStyle='#344632';ctx.font='25px sans-serif';ctx.fillText(s.jointName+'  '+s.value,38,820);
    texture.needsUpdate=true;
  }
  const controllers=[];
  for(let i=0;i<2;i++){
    const c=renderer.xr.getController(i);scene.add(c);controllers.push(c);
    const beam=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3(0,0,-1)]),new T.LineBasicMaterial({color:0xd4f778,transparent:true,opacity:.72}));
    beam.name='pointer';c.add(beam);
    c.addEventListener('select',()=>{
      const hit=pick(c);if(!hit)return;
      const x=hit.uv.x*board.width,y=(1-hit.uv.y)*board.height;
      buttons.find(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h)?.run();paint();
    });
  }
  function showModel(){
    if(exhibit){holder.remove(exhibit.root);exhibit.dispose()}
    const s=callbacks.get();exhibit=createExhibit(s.root);
    exhibit.root.position.y=-s.ground;holder.scale.setScalar(.57);
    holder.rotation.y=s.year===1986?-.55:2.6;holder.add(exhibit.root);paint();
  }
  return {
    get active(){return !!activeSession},
    modelChanged(){if(activeSession)showModel()},
    poseChanged(){if(activeSession){exhibit?.sync();paint()}},
    async start(session){
      activeSession=session;
      session.addEventListener('end',()=>{activeSession=null;renderer.setAnimationLoop(null);if(exhibit){holder.remove(exhibit.root);exhibit.dispose();exhibit=null}callbacks.ended()},{once:true});
      let space='local-floor';
      try{await session.requestReferenceSpace(space)}catch{space='local'}
      room.position.y=space==='local'?-1.6:0;
      renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType(space);
      showModel();await renderer.xr.setSession(session);
      refresh=()=>{for(const c of controllers){if(!c.visible)continue;const hit=pick(c);c.getObjectByName('pointer').scale.z=hit?.distance??1.5}renderer.render(scene,camera)};
      renderer.setAnimationLoop(refresh);
    }
  };
}
