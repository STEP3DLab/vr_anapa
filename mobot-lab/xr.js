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
  const board=document.createElement('canvas');board.width=680;board.height=1030;
  const ctx=board.getContext('2d'),texture=new T.CanvasTexture(board);
  texture.colorSpace=T.SRGBColorSpace;
  const panel=new T.Mesh(new T.PlaneGeometry(.49,.742),new T.MeshBasicMaterial({map:texture,toneMapped:false}));
  panel.position.set(-.65,1.25,-1.12);panel.rotation.y=.37;room.add(panel);
  const controllers=[], ray=new T.Raycaster(),pointer=new T.Vector3(),origin=new T.Vector3();
  const scales=[.40,.57,.76],scaleNames=['малый','средний','крупный'];
  let scale=1,hover=-1,drag=null,buttons=[],exhibit=null,session=null;
  function setScale(i){scale=i;holder.scale.setScalar(scales[i])}
  function resetView(){holder.rotation.y=callbacks.get().year===1986?-.55:2.6;setScale(1)}
  function paint() {
    const s=callbacks.get();
    if(!s.root)return;
    ctx.fillStyle='#edf2e7';ctx.fillRect(0,0,board.width,board.height);
    ctx.fillStyle='#354932';ctx.font='24px sans-serif';ctx.fillText('ЛАБОРАТОРИЯ МОБОТ',34,46);
    ctx.font='bold 44px sans-serif';ctx.fillStyle='#202823';ctx.fillText(s.name,34,100);
    ctx.font='26px sans-serif';ctx.fillText(s.jointName+'   '+s.value,34,140);
    const actions=[
      ['Сменить машину  ·  '+(s.year===1986?'1987':'1986'),callbacks.switchModel],
      ['Выбрать механизм  ·  '+s.jointName,callbacks.nextJoint],
      ['−     '+s.jointName,()=>callbacks.change(-1)],
      ['+     '+s.jointName,()=>callbacks.change(1)],
      ...(s.year===1987?[['Оснастка  ·  '+s.toolName,callbacks.nextTool]]:[]),
      ['Масштаб  ·  '+scaleNames[scale],()=>setScale((scale+1)%scales.length)],
      ['Повернуть модель на 30°',()=>{holder.rotation.y+=Math.PI/6}],
      ['Исходное положение',()=>{callbacks.reset();resetView()}],
      ['Выйти из VR',()=>session?.end().catch(()=>{})]
    ];
    const step=82;
    buttons=actions.map(([label,run],i)=>{
      const y=170+i*step;
      ctx.fillStyle=i===hover?'#b6d876':i===0?'#d4f778':'#d8e2d2';ctx.fillRect(28,y,624,67);
      ctx.fillStyle='#223021';ctx.font='bold 27px sans-serif';ctx.fillText(label,44,y+43,592);
      return {x:28,y,w:624,h:67,run};
    });
    ctx.fillStyle='#344632';ctx.font='24px sans-serif';
    ctx.fillText('Курок выбирает действие.',33,965);
    ctx.fillText('Для поворота зажмите боковую кнопку и ведите руку.',33,1001,615);
    texture.needsUpdate=true;
  }
  function panelHit(controller){
    controller.getWorldPosition(origin);controller.getWorldDirection(pointer).negate();
    ray.set(origin,pointer);
    return ray.intersectObject(panel,false)[0];
  }
  function buttonAt(hit){
    if(!hit)return -1;
    const x=hit.uv.x*board.width,y=(1-hit.uv.y)*board.height;
    return buttons.findIndex(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);
  }
  const handPosition=new T.Vector3();
  function handX(controller){return room.worldToLocal(controller.getWorldPosition(handPosition)).x}
  for(let i=0;i<2;i++){
    const controller=renderer.xr.getController(i);scene.add(controller);controllers.push(controller);
    const beam=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3(0,0,-1)]),new T.LineBasicMaterial({color:0xd4f778,transparent:true,opacity:.75}));
    beam.name='pointer';controller.add(beam);
    controller.addEventListener('select',()=>{
      if(!session||drag)return;
      const button=buttons[buttonAt(panelHit(controller))];
      if(button){button.run();if(session)paint()}
    });
    controller.addEventListener('squeezestart',()=>{
      if(session&&!drag)drag={controller,start:handX(controller),angle:holder.rotation.y};
    });
    const release=()=>{if(drag?.controller===controller)drag=null};
    controller.addEventListener('squeezeend',release);controller.addEventListener('disconnected',release);
  }
  function clearExhibit(){
    if(!exhibit)return;
    holder.remove(exhibit.root);exhibit.dispose();exhibit=null;
  }
  function showModel(){
    clearExhibit();drag=null;
    const s=callbacks.get();exhibit=createExhibit(s.root);exhibit.root.position.y=-s.ground;
    holder.add(exhibit.root);resetView();paint();
  }
  return {
    get active(){return !!session},
    modelChanged(){if(session)showModel()},
    poseChanged(){if(session){exhibit?.sync();paint()}},
    async start(nextSession){
      session=nextSession;
      session.addEventListener('end',()=>{
        session=null;drag=null;hover=-1;renderer.setAnimationLoop(null);clearExhibit();callbacks.ended();
      },{once:true});
      let space='local-floor';
      try{await nextSession.requestReferenceSpace(space)}catch{space='local'}
      if(session!==nextSession)return;
      renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType(space);
      showModel();await renderer.xr.setSession(nextSession);
      if(session!==nextSession)return;
      let placed=false;
      const forward=new T.Vector3(),orientation=new T.Quaternion();
      renderer.setAnimationLoop((_time,frame)=>{
        if(!placed&&frame){
          const reference=renderer.xr.getReferenceSpace();
          const pose=reference&&frame.getViewerPose(reference);
          if(pose){
            const p=pose.transform.position,q=pose.transform.orientation;
            forward.set(0,0,-1).applyQuaternion(orientation.set(q.x,q.y,q.z,q.w));
            room.rotation.y=Math.atan2(-forward.x,-forward.z);
            room.position.set(p.x,space==='local'?p.y-1.6:Math.min(0,p.y-1.45),p.z);
            room.updateMatrixWorld(true);placed=true;
          }
        }
        if(drag)holder.rotation.y=drag.angle+(handX(drag.controller)-drag.start)*3.2;
        let over=-1;
        for(const c of controllers){
          if(!c.visible)continue;
          const hit=panelHit(c),id=buttonAt(hit),beam=c.getObjectByName('pointer');
          beam.scale.z=hit?.distance??1.5;
          beam.material.color.setHex(id>=0?0xffffff:0xd4f778);
          if(id>=0)over=id;
        }
        if(over!==hover){hover=over;paint()}
        renderer.render(scene,camera);
      });
    }
  };
}
