import * as T from './engine/three.module.min.js';
import {OrbitControls} from './engine/controls/OrbitControls.js';
import {makeRasterRenderer} from './engine/orthographic-raster.js';
import {createXR} from './xr.js';

export function createViewer(surface, callbacks) {
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-2,2,2,-2,.01,80);
  let canvas=document.createElement('canvas'),gl=null,raster=null;
  try{gl=new T.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'})}
  catch{canvas=document.createElement('canvas');raster=makeRasterRenderer(canvas)}
  canvas.setAttribute('aria-label','Вращаемая трёхмерная модель');canvas.tabIndex=0;surface.append(canvas);
  const controls=new OrbitControls(camera,canvas);
  controls.enablePan=false;controls.minZoom=.4;controls.maxZoom=5;
  controls.maxPolarAngle=Math.PI*.496;controls.rotateSpeed=.75;
  const deck=new T.Group();scene.add(deck);
  if(gl){
    gl.setPixelRatio(Math.min(devicePixelRatio,1.65));gl.setClearColor(0x172019,0);
    gl.toneMapping=T.ACESFilmicToneMapping;gl.toneMappingExposure=1.16;
    scene.add(new T.HemisphereLight(0xf8fff0,0x9ba9a0,2.8));
    for(const [color,power,x,y,z] of [[0xfff4dd,3.8,2,6,4],[0xe0f5ff,3,-4,4,-3],[0xe8ffc3,1.2,0,2,-5]]){
      const light=new T.DirectionalLight(color,power);light.position.set(x,y,z);scene.add(light);
    }
    const grid=new T.GridHelper(18,72,0x829677,0x687d69);
    grid.material.transparent=true;grid.material.opacity=.23;grid.material.depthWrite=false;deck.add(grid);
    const vertices=[];
    for(let i=0;i<160;i++){
      const a=i*Math.PI/80,b=(i+1)*Math.PI/80,r=1.79;
      vertices.push(r*Math.cos(a),.003,r*Math.sin(a),r*Math.cos(b),.003,r*Math.sin(b));
      if(i%4===0){const end=i%20===0?1.86:1.825;vertices.push(r*Math.cos(a),.003,r*Math.sin(a),end*Math.cos(a),.003,end*Math.sin(a))}
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    deck.add(new T.LineSegments(geometry,new T.LineBasicMaterial({color:0x9cae8b,transparent:true,opacity:.34,depthWrite:false})));
    const map=document.createElement('canvas');map.width=map.height=128;const c=map.getContext('2d');
    const fade=c.createRadialGradient(64,64,3,64,64,63);fade.addColorStop(0,'rgba(0,0,0,.68)');fade.addColorStop(.55,'rgba(0,0,0,.46)');fade.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=fade;c.fillRect(0,0,128,128);
    const shadow=new T.Mesh(new T.PlaneGeometry(3.1,1.55),new T.MeshBasicMaterial({map:new T.CanvasTexture(map),transparent:true,depthWrite:false}));
    shadow.rotation.x=-Math.PI/2;shadow.position.y=.005;deck.add(shadow);
  }
  surface.classList.toggle('software',!!raster);
  let current,definition,selectedView='iso',frameId=0,resizing=false;
  const xr=gl?createXR(gl,{...callbacks,ended(){gl.xr.enabled=false;requestAnimationFrame(()=>{resize();callbacks.ended()})}}):null;
  function draw(){
    if(frameId||xr?.active||!current)return;
    frameId=requestAnimationFrame(()=>{
      frameId=0;if(xr?.active||!current)return;
      if(gl)gl.render(scene,camera);else raster.render(current.root,camera);
      callbacks.drawn();
    });
  }
  controls.addEventListener('change',draw);
  controls.addEventListener('start',()=>{selectedView=null;callbacks.viewChanged(null)});
  const v=new T.Vector3();
  function eachCorner(fn){
    current.root.updateWorldMatrix(true,true);
    current.root.traverseVisible(o=>{
      if(!o.isMesh)return;
      if(o.isInstancedMesh&&!o.boundingBox)o.computeBoundingBox();
      if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
      const bounds=o.isInstancedMesh?o.boundingBox:o.geometry.boundingBox;
      if(!bounds||bounds.isEmpty())return;
      for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
        v.set(x,y,z).applyMatrix4(o.matrixWorld);fn(v);
      }
    });
  }
  function frame(view='iso'){
    if(!current||xr?.active)return;
    const s=definition.side,angle=view||selectedView;
    const directions={iso:[.54*s,.44,1*s],side:[0,.01,s],front:[s,.045,0],top:[.0001,1,.0002*s]};
    const d=angle?new T.Vector3(...directions[angle]).normalize():camera.position.clone().sub(controls.target).normalize();
    const box=new T.Box3();eachCorner(p=>box.expandByPoint(p));
    const center=box.getCenter(new T.Vector3());
    const w=surface.clientWidth,h=surface.clientHeight;if(!w||!h)return;
    const aspect=w/h;
    camera.position.copy(center).addScaledVector(d,9);camera.up.set(0,1,0);camera.lookAt(center);camera.updateMatrixWorld();
    // Measure the transformed corners of each mesh in the chosen view.
    const ext=new T.Box3();eachCorner(p=>ext.expandByPoint(p.applyMatrix4(camera.matrixWorldInverse)));
    const width=ext.max.x-ext.min.x,height=ext.max.y-ext.min.y;
    const half=Math.max(height/(aspect<1.15?1.18:1.43),width/(aspect*1.75),.3);
    const focus=new T.Vector3();
    // Convert the camera-plane offset without normalizing its magnitude.
    focus.set((ext.min.x+ext.max.x)/2,(ext.min.y+ext.max.y)/2+half*.045,0).applyQuaternion(camera.quaternion);
    center.add(focus);controls.target.copy(center);camera.position.copy(center).addScaledVector(d,9);
    camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.zoom=1;camera.updateProjectionMatrix();
    controls.update();selectedView=angle;callbacks.viewChanged(angle);draw();
  }
  function resize(){
    if(!current||xr?.active||resizing)return;resizing=true;
    const w=surface.clientWidth,h=surface.clientHeight;
    if(w&&h){
      if(gl)gl.setSize(w,h,false);
      else{const scale=Math.min(1.35,880/w,720/h);raster.resize(Math.max(1,Math.round(w*scale)),Math.max(1,Math.round(h*scale)))}
      frame(selectedView);
    }
    resizing=false;
  }
  new ResizeObserver(resize).observe(surface);
  const picker=new T.Raycaster();let start=null;
  canvas.addEventListener('pointerdown',e=>{start=[e.clientX,e.clientY]});
  canvas.addEventListener('pointerup',e=>{
    if(!start||Math.hypot(e.clientX-start[0],e.clientY-start[1])>5||!current)return;
    start=null;
    const b=canvas.getBoundingClientRect();
    picker.setFromCamera(new T.Vector2((e.clientX-b.left)/b.width*2-1,1-(e.clientY-b.top)/b.height*2),camera);
    const meshes=[];current.root.traverseVisible(o=>{if(o.isMesh)meshes.push(o)});
    const hit=picker.intersectObjects(meshes,false)[0];
    if(!hit)return;
    const groups=definition.groups(current);
    for(let n=hit.object;n;n=n.parent){const group=Object.entries(groups).find(([,node])=>node===n);if(group){callbacks.picked(group[0]);return}}
  });
  function zoom(factor){camera.zoom=T.MathUtils.clamp(camera.zoom*factor,.4,5);camera.updateProjectionMatrix();draw()}
  canvas.addEventListener('keydown',e=>{
    if(e.key==='+'||e.key==='=')zoom(1.2);else if(e.key==='-')zoom(1/1.2);else if(e.key==='Home')frame('iso');else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
      const offset=camera.position.clone().sub(controls.target),spherical=new T.Spherical().setFromVector3(offset);
      if(e.key==='ArrowLeft')spherical.theta-=.12;if(e.key==='ArrowRight')spherical.theta+=.12;
      if(e.key==='ArrowUp')spherical.phi-=.1;if(e.key==='ArrowDown')spherical.phi+=.1;
      spherical.phi=T.MathUtils.clamp(spherical.phi,.015,controls.maxPolarAngle);
      camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));controls.update();selectedView=null;callbacks.viewChanged(null);
    }else return;e.preventDefault();
  });
  return {xr,mode:gl?'gpu':'cpu',select(model,def){
    if(current)scene.remove(current.root);current=model;definition=def;scene.add(model.root);deck.position.y=def.ground-.009;selectedView='iso';
    if(xr?.active)xr.modelChanged();else resize();
  },draw(){if(xr?.active)xr.poseChanged();else draw()},frame,zoom};
}
