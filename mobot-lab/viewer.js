import * as T from './engine/three.module.min.js';
import {OrbitControls} from './engine/controls/OrbitControls.js';
import {makeRasterRenderer} from './engine/orthographic-raster.js';
import {createXR} from './xr.js';

export function createViewer(surface, callbacks, options = {}) {
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-2,2,2,-2,.01,80);
  let canvas=document.createElement('canvas'),gl=null,raster=null;
  const graphics={alpha:true,antialias:true,depth:true,powerPreference:'high-performance'};
  try {
    const context=canvas.getContext('webgl2',graphics);
    if(context) gl=new T.WebGLRenderer({canvas,context,...graphics});
  } catch { /* Use the same articulated geometry through the software renderer. */ }
  if(!gl){canvas=document.createElement('canvas');raster=makeRasterRenderer(canvas)}
  canvas.setAttribute('aria-label','Вращаемая трёхмерная модель');
  canvas.setAttribute('aria-describedby','hint keyboardHelp');canvas.tabIndex=0;
  surface.append(canvas);
  const controls=new OrbitControls(camera,canvas);
  controls.enablePan=false;controls.minZoom=.4;controls.maxZoom=5;
  controls.maxPolarAngle=Math.PI/2;controls.rotateSpeed=.75;
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
  let current, definition, selectedView = 'iso', targetNode = null, frameId = 0;
  let contextLost = false, switchedInXR = false, disposed = false;
  if (gl) {
    canvas.addEventListener('webglcontextlost', event => {
      if(disposed)return;
      event.preventDefault(); contextLost=true; callbacks.contextLost();
    });
    canvas.addEventListener('webglcontextrestored', () => {
      if(disposed)return;
      contextLost=false; resize(); draw();
    });
  }
  const xr = gl && options.xr !== false ? createXR(gl, {...callbacks, ended() {
    gl.xr.enabled = false;
    requestAnimationFrame(() => { resize(); if(switchedInXR) frame('iso'); switchedInXR=false; callbacks.ended(); });
  }}) : null;
  function draw() {
    if (disposed || frameId || contextLost || xr?.active || !current) return;
    frameId = requestAnimationFrame(() => {
      frameId = 0;
      if (disposed || contextLost || xr?.active || !current) return;
      if (gl) gl.render(scene, camera);
      else raster.render(current.root, camera);
      callbacks.drawn();
    });
  }
  controls.addEventListener('change', () => { draw(); callbacks.cameraChanged?.(capture()); });
  // OrbitControls also emits "start" for an ordinary tap. Keep the named
  // view until the direction actually changes.
  let orbitStart;
  controls.addEventListener('start', () => { orbitStart = camera.position.clone().sub(controls.target).normalize(); });
  controls.addEventListener('end', () => {
    const direction = camera.position.clone().sub(controls.target).normalize();
    if (orbitStart && direction.distanceToSquared(orbitStart) > 0.000001) {
      selectedView = null;
      callbacks.viewChanged(null);
    }
  });
  const corner = new T.Vector3();
  function eachCorner(root, fn) {
    root.updateWorldMatrix(true, true);
    root.traverseVisible(o => {
      if (!o.isMesh) return;
      if (o.isInstancedMesh && !o.boundingBox) o.computeBoundingBox();
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const bounds = o.isInstancedMesh ? o.boundingBox : o.geometry.boundingBox;
      if (!bounds || bounds.isEmpty()) return;
      for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
          for (const z of [bounds.min.z, bounds.max.z])
            fn(corner.set(x, y, z).applyMatrix4(o.matrixWorld));
    });
  }
  function capture() {
    return {
      view: selectedView, zoom: camera.zoom, detail: !!targetNode,
      direction: camera.position.clone().sub(controls.target).normalize().toArray(),
      up: camera.up.toArray()
    };
  }
  function frame(view = 'iso', options = {}) {
    if (!current || xr?.active || !surface.clientHeight || !surface.clientWidth) return;
    const side = definition.side;
    const directions = {iso:[.54*side,.44,side], side:[0,.007,side], front:[side,.025,0], top:[.0001,1,.0002*side]};
    const direction = new T.Vector3(...(options.direction || directions[view] || directions.iso)).normalize();
    targetNode = options.node || null;
    const root = targetNode || current.root;
    const bounds = new T.Box3();
    eachCorner(root, p => bounds.expandByPoint(p));
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new T.Vector3());
    camera.up.fromArray(options.up || [0,1,0]).normalize();
    camera.position.copy(center).addScaledVector(direction, 9);
    camera.lookAt(center); camera.updateMatrixWorld();
    const projected = new T.Box3();
    eachCorner(root, p => projected.expandByPoint(p.applyMatrix4(camera.matrixWorldInverse)));
    const aspect = surface.clientWidth / surface.clientHeight;
    const width = projected.max.x - projected.min.x;
    const height = projected.max.y - projected.min.y;
    // A marker may identify a single pin. Keep enough of its assembly in view.
    const narrow = matchMedia('(max-width:760px)').matches;
    const half = Math.max(height / (narrow ? 1.78 : 1.43), width / (aspect * 1.78), targetNode ? .36 : .48);
    const offset = new T.Vector3((projected.min.x + projected.max.x)/2, (projected.min.y + projected.max.y)/2 + half*.04, 0);
    center.add(offset.applyQuaternion(camera.quaternion));
    controls.target.copy(center); camera.position.copy(center).addScaledVector(direction, 9);
    Object.assign(camera, {left:-half*aspect, right:half*aspect, top:half, bottom:-half, zoom:T.MathUtils.clamp(options.zoom ?? 1,.4,5)});
    camera.updateProjectionMatrix(); controls.update();
    selectedView = view || null;
    callbacks.viewChanged(selectedView); draw();
  }
  function resize() {
    if (!current || xr?.active) return;
    const width = surface.clientWidth, height = surface.clientHeight;
    if (!width || !height) return;
    if (gl) gl.setSize(width, height, false);
    else {
      const scale = Math.min(1.35, 880/width, 720/height);
      raster.resize(Math.max(1, Math.round(width*scale)), Math.max(1, Math.round(height*scale)));
    }
    const state = capture();
    frame(selectedView, {...state, node:targetNode});
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(surface);
  const picker = new T.Raycaster();
  const visibleMeshes = [];
  let down = null, activePointers = new Set();
  canvas.addEventListener('pointerdown', e => {
    activePointers.add(e.pointerId);
    down = activePointers.size === 1 && e.button === 0 ? {id:e.pointerId,x:e.clientX,y:e.clientY} : null;
  });
  canvas.addEventListener('pointercancel', e => { activePointers.delete(e.pointerId); down = null; });
  canvas.addEventListener('pointerup', e => {
    const start = down;
    activePointers.delete(e.pointerId); down = null;
    if (contextLost || !start || start.id !== e.pointerId || Math.hypot(e.clientX-start.x, e.clientY-start.y)>6 || !current) return;
    const rect = canvas.getBoundingClientRect();
    picker.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1, 1-(e.clientY-rect.top)/rect.height*2), camera);
    visibleMeshes.length = 0;
    current.root.traverseVisible(o => { if (o.isMesh) visibleMeshes.push(o); });
    const hit = picker.intersectObjects(visibleMeshes, false)[0];
    if (!hit) return;
    const groups = Object.entries(definition.groups(current));
    for (let n = hit.object; n; n = n.parent) {
      const match = groups.find(([,node]) => node === n);
      if (match) { callbacks.picked(match[0]); return; }
    }
  });
  function zoom(factor) {
    camera.zoom = T.MathUtils.clamp(camera.zoom * factor,.4,5);
    camera.updateProjectionMatrix(); draw(); callbacks.cameraChanged?.(capture());
  }
  canvas.addEventListener('keydown', e => {
    // Browser zoom, OS shortcuts and assistive technology keep their own modifiers.
    if (contextLost || e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '+' || e.key === '=') zoom(1.2);
    else if (e.key === '-') zoom(1/1.2);
    else if (e.key === 'Home') frame('iso');
    else if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
      const offset = camera.position.clone().sub(controls.target);
      const spherical = new T.Spherical().setFromVector3(offset);
      spherical.theta += ({ArrowLeft:-.12, ArrowRight:.12}[e.key] || 0);
      spherical.phi = T.MathUtils.clamp(spherical.phi + ({ArrowUp:-.1,ArrowDown:.1}[e.key] || 0),.015,controls.maxPolarAngle);
      camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
      controls.update(); selectedView = null; callbacks.viewChanged(null);
    } else return;
    e.preventDefault();
  });
  const markerBox = new T.Box3(), markerPoint = new T.Vector3();
  function project(node) {
    if (!node) return null;
    for (let parent=node;parent;parent=parent.parent) if (!parent.visible) return null;
    markerBox.setFromObject(node);
    if (markerBox.isEmpty()) return null;
    markerBox.getCenter(markerPoint).project(camera);
    if (Math.abs(markerPoint.x)>1 || Math.abs(markerPoint.y)>1 || Math.abs(markerPoint.z)>1) return null;
    return [(markerPoint.x+1)*50,(1-markerPoint.y)*50];
  }
  return {xr, mode:gl?'gpu':'cpu', capture, project, frame, zoom,
    select(model, def) {
      if (current) scene.remove(current.root);
      current = model; definition = def; targetNode = null;
      scene.add(model.root); deck.position.y = (model.groundY ?? def.ground)-.009;
      selectedView = 'iso';
      if (xr?.active) { switchedInXR=true; xr.modelChanged(); }
      else { resize(); frame('iso'); }
    },
    draw() { if (xr?.active) xr.poseChanged(); else draw(); },
    dispose({models=false}={}) {
      disposed=true; cancelAnimationFrame(frameId); resizeObserver.disconnect(); controls.dispose();
      const geometries=new Set(), materials=new Set(), textures=new Set();
      for (const root of [deck,...(models&&current?[current.root]:[])]) root.traverse(o=>{
        if(o.geometry) geometries.add(o.geometry);
        for(const material of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)) materials.add(material);
      });
      for(const material of materials) {
        for(const value of Object.values(material)) if(value?.isTexture) textures.add(value);
        material.dispose();
      }
      for(const texture of textures)texture.dispose();
      for(const geometry of geometries)geometry.dispose();
      gl?.dispose(); gl?.forceContextLoss(); canvas.remove(); current=null;
    }
  };
}
