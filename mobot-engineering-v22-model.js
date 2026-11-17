import { PROFILE_V15, auditBucketPose as sharedAudit, sweepBucketEnvelope as sharedSweep } from './mobot-kinematics-v15.js';
// 1987 v22 candidate, derived from v21. All geometry uses uncalibrated scene units.
// Photo 2: measured image coordinates in mobot-qa/demo-2026-11-18/sktb-2-landmarks-manual.json.
export function makeMobot(THREE, quality='auto') {
  const root=new THREE.Group(); root.name='Мобот-Ч-ХВ-2 / исследовательская реконструкция';
  const parts={}, meshes=[], materialRegistry={};
  const isMobile=quality==='mobile'||(quality==='auto'&&window.innerWidth<760);
  let count=0;
  let fastenerCounter=0;
  const driveModules=[];
  const pixelScale = 1.78 / (1980 - 238); // conventional span of the visible track
  const sceneX = u => .89 - (u - 238) * pixelScale;
  const padHalf = .011, cleatOffset = .016, cleatHalf = .006;
  const groundReferenceY = PROFILE_V15.groundY;
  const runningLine = groundReferenceY + cleatOffset + cleatHalf;
  const lowerWheels = [[512,70],[693,73],[884,73],[1053,69],[1232,68],[1408,69],[1574,69]]
    .map(([u, r]) => ({x:sceneX(u), y:runningLine + padHalf + r*pixelScale, r:r*pixelScale}));
  // Projected terminal faces differ. Using them separately is only one possible depth interpretation.
  const endWheels = [[391,118],[1859,98]].map(([u,r]) => ({
    x:sceneX(u), y:groundReferenceY+(2020-1707)*pixelScale, r:r*pixelScale
  }));
  // Clockwise convex envelope with tangent straight runs and sampled wheel arcs.
  // The top witnesses come from the near edge of photo 2; a hidden support is not inferred.
  const support = [[650,1610],[1000,1634],[1340,1645]].map(([u,v]) =>
    [sceneX(u), groundReferenceY + (2020-v)*pixelScale - cleatOffset - cleatHalf]);
  for(const {x,y,r} of [...lowerWheels,...endWheels]){
    for(let i=0;i<96;i++){
      const angle=i*Math.PI/48;
      const clearanceRadius=(r+padHalf+.0003)/Math.cos(Math.PI/96);
      support.push([x+clearanceRadius*Math.cos(angle),y+clearanceRadius*Math.sin(angle)]);
    }
  }
  support.sort((a,b)=>a[0]-b[0] || a[1]-b[1]);
  function halfHull(points){
    const hull=[];
    for(const p of points){
      while(hull.length>=2){
        const a=hull.at(-2),b=hull.at(-1);
        if((b[0]-a[0])*(p[1]-a[1])>(b[1]-a[1])*(p[0]-a[0]))break;
        hull.pop();
      }
      hull.push(p);
    }
    return hull.slice(0,-1);
  }
  const sourceTrackProfile=halfHull(support).concat(halfHull([...support].reverse())).reverse();
  const path=new THREE.CurvePath();
  sourceTrackProfile.forEach(([x,y],i)=>{
    const [nx,ny]=sourceTrackProfile[(i+1)%sourceTrackProfile.length];
    path.add(new THREE.LineCurve3(new THREE.Vector3(x,y,0),new THREE.Vector3(nx,ny,0)));
  });
  const P=path.getLength();
  function pathAt(distance){
    const t=THREE.MathUtils.euclideanModulo(distance,P)/P;
    const point=path.getPoint(t), tangent=path.getTangent(t);
    return [point.x,point.y,Math.atan2(tangent.y,tangent.x)];
  }
  const rotatingHubs=[];

  const fastenerPool=new Map(), groupKeys=new WeakMap(), materialKeys=new WeakMap();
  let nextGroupKey=1,nextMaterialKey=1,fastenerInstanceCount=0;
  function lookupKey(weak,obj,prefix){
    if(!weak.has(obj))weak.set(obj,prefix+(prefix==='g'?nextGroupKey++:nextMaterialKey++));
    return weak.get(obj);
  }
  const mat=(name,color,metal=.6,rough=.49)=> {
    const m=new THREE.MeshStandardMaterial({color,metalness:metal,roughness:rough});
    materialRegistry[name]=m;return m;
  };
  const m={
    panel:mat('Светлый алюминий',0xb0b8b5,.71,.43),
    frame:mat('Тёмная конструкционная сталь',0x454d4b,.72,.58),
    satin:mat('Механически обработанная сталь',0x8e9795,.84,.36),
    bright:mat('Кромки деталей',0xc4c9c4,.78,.30),
    shadow:mat('Внутренние поверхности',0x252d2d,.62,.67),
    olive:mat('Потемневший защитный металл',0x6f7870,.57,.62),
    rubber:mat('Полиуретановые траки',0x202727,.08,.92),
    tread:mat('Рёбра гусениц',0x343b38,.18,.86),
    cable:mat('Кабельная оболочка',0x252a29,.07,.87),
    lens:new THREE.MeshPhysicalMaterial({color:0x203943,metalness:.30,roughness:.11,clearcoat:1,clearcoatRoughness:.10}),
    brass:mat('Точки крепежа',0x9b927b,.69,.39),
    darkBolt:mat('Заворонённый крепёж',0x303738,.76,.46),
    joint:mat('Материал шарниров',0x687370,.73,.42),
  };
  // Deterministic fine roughness and stamped metallic micrograin; not photographic texture.
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d');
  let seed=458762;
  const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  if(ctx){
    const img=ctx.createImageData(128,128);
    for(let y=0;y<128;y++)for(let x=0;x<128;x++){
      const p=(y*128+x)*4;
      const n=130+45*rand()+7*Math.sin(y*.88)+10*Math.sin(x*.19);
      const v=Math.max(42,Math.min(235,n|0));
      img.data[p]=img.data[p+1]=img.data[p+2]=v;img.data[p+3]=255;
    }
    ctx.putImageData(img,0,0);
    const grain=new THREE.CanvasTexture(canvas);grain.wrapS=grain.wrapT=THREE.RepeatWrapping;
    grain.repeat.set(3.5,3.5);
    for(const key of ['panel','frame','satin','bright','olive']){
      m[key].bumpMap=grain;m[key].bumpScale=key==='frame'?.007:.003;
      m[key].needsUpdate=true;
    }
  }
  const unitY=new THREE.Vector3(0,1,0);
  const V=(a)=>new THREE.Vector3(...a);
  function section(id,label,parent=root) {
    const g=new THREE.Group();g.name=label||id;g.userData.part=id;
    parent.add(g);parts[id]=g;return g;
  }
  function mesh(parent,geo,material,partId,label=''){
    const o=new THREE.Mesh(geo,material);o.name=label;o.castShadow=true;o.receiveShadow=true;
    o.userData.part=partId;parent.add(o);meshes.push(o);count++;return o;
  }
  function box(parent,s,p,material,id,rotate=0){
    const o=mesh(parent,new THREE.BoxGeometry(...s),material,id);
    o.position.set(...p);o.rotation.z=rotate;return o;
  }
  function cylinder(parent,rt,rb,h,p,material,id,axis='y',segments=28){
    const o=mesh(parent,new THREE.CylinderGeometry(rt,rb,h,segments),material,id);
    o.position.set(...p);
    if(axis==='z')o.rotation.x=Math.PI/2;
    if(axis==='x')o.rotation.z=Math.PI/2;
    return o;
  }
  function ring(parent,r,t,p,material,id,orientation='z'){
    const o=mesh(parent,new THREE.TorusGeometry(r,t,8,48),material,id);
    o.position.set(...p);
    if(orientation==='y')o.rotation.x=Math.PI/2;
    if(orientation==='x')o.rotation.y=Math.PI/2;
    return o;
  }
  function beam(parent,a,b,r,material,id,radial=12){
    const A=V(a),B=V(b),vec=B.clone().sub(A),len=vec.length();
    const o=mesh(parent,new THREE.CylinderGeometry(r,r,len,radial),material,id);
    o.position.copy(A).addScaledVector(vec,.5);
    o.quaternion.setFromUnitVectors(unitY,vec.normalize());return o;
  }
  function tube(parent,pts,r,material,id,seg=42){
    const line=new THREE.CatmullRomCurve3(pts.map(V));
    return mesh(parent,new THREE.TubeGeometry(line,seg,r,7,false),material,id);
  }
  function plate(parent,points,depth,z,material,id){
    const s=new THREE.Shape();
    points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelThickness:.009,bevelSize:.012,bevelSegments:1,steps:1,curveSegments:8});
    const p=mesh(parent,g,material,id);p.position.z=z;return p;
  }
  // v10: instanced engineering fasteners. Identical local bolt meshes share a
  // single draw call per assembly/diameter/material/axis instead of one call per screw.
  // All bolts remain visible in low-power mode; no historic dimensions are implied.
  function bolt(parent,p,axis,material,id,r=.016){
    fastenerCounter+=1;
    const shift=[p[0]+(axis==='x'?.009:0),p[1]+(axis==='y'?.009:0),p[2]+(axis==='z'?.009:0)];
    // The jaws and bucket scoop are later shifted into a new local hinge frame.
    // Keep those few bolts as ordinary scene objects so their transforms track the shift.
    if(id==='bucket'||(parent.name||'').includes('подвижная губка')||(parent.name||'').includes('Ковш:')){
      return cylinder(parent,r,r,.018,shift,material,id,axis,6);
    }
    const key=lookupKey(groupKeys,parent,'g')+'|'+lookupKey(materialKeys,material,'m')+
      '|'+axis+'|'+r.toFixed(5)+'|'+id;
    if(!fastenerPool.has(key))fastenerPool.set(key,{parent,material,id,r,axis,points:[]});
    fastenerPool.get(key).points.push(shift);
    return null;
  }
  function assembleFasteners(){
    const dummy=new THREE.Object3D();
    for(const b of fastenerPool.values()){
      const instanced=new THREE.InstancedMesh(
        new THREE.CylinderGeometry(b.r,b.r,.018,6),
        b.material,b.points.length
      );
      instanced.name='Крепёж · пакет '+b.id;
      instanced.userData.part=b.id;
      instanced.castShadow=!isMobile;
      instanced.receiveShadow=true;
      b.parent.add(instanced);
      for(let i=0;i<b.points.length;i++){
        dummy.position.set(...b.points[i]);
        dummy.rotation.set(b.axis==='z'?Math.PI/2:0,0,b.axis==='x'?Math.PI/2:0);
        dummy.updateMatrix();instanced.setMatrixAt(i,dummy.matrix);
      }
      instanced.instanceMatrix.needsUpdate=true;
      fastenerInstanceCount+=b.points.length;
      meshes.push(instanced);count+=1;
    }
    fastenerPool.clear();
  }
  function motor(parent,p,axis,id,s=1){
    cylinder(parent,.115*s,.115*s,.28*s,p,m.frame,id,axis,28);
    cylinder(parent,.087*s,.087*s,.292*s,p,m.satin,id,axis,24);
    const off=axis==='z'?[p[0],p[1],p[2]+.149*s]:axis==='x'?[p[0]+.149*s,p[1],p[2]]:[p[0],p[1]+.149*s,p[2]];
    cylinder(parent,.07*s,.07*s,.026*s,off,m.shadow,id,axis,22);
    for(let i=0;i<10;i++){
      const a=2*Math.PI*i/10;
      if(axis==='z')beam(parent,[p[0]+Math.cos(a)*.091*s,p[1]+Math.sin(a)*.091*s,p[2]-.13*s],
        [p[0]+Math.cos(a)*.091*s,p[1]+Math.sin(a)*.091*s,p[2]+.13*s],.006*s,m.olive,id,6);
    }
  }

  // TRACK MODULES: archive-anchored asymmetrical track silhouette and an illustrative multi-balancer suspension.
  const tracks=section('tracks','Ходовая часть: два гусеничных борта');
  function trackSide(z,sign) {
    const g=new THREE.Group();g.position.z=z;tracks.add(g);
    const id='tracks';
    // Axles bridge the faces and a simplified inner carrier. Depth and support design are C.
    box(g,[1.52,.045,.035],[.02,.395,-sign*.081],m.frame,id);
    for(const {x,y,r:outer} of lowerWheels){
      beam(g,[x,y,-sign*.085],[x,.38,-sign*.085],.025,m.frame,id);
      cylinder(g,.025,.025,.16,[x,y,-sign*.036],m.satin,id,'z',16);
      cylinder(g,outer,outer,.115,[x,y,sign*.020],m.shadow,id,'z',32);
      cylinder(g,outer-.011,outer-.011,.120,[x,y,sign*.055],m.satin,id,'z',32);
      cylinder(g,.037,.037,.131,[x,y,sign*.090],m.frame,id,'z',24);
      ring(g,.047,.006,[x,y,sign*.121],m.bright,id,'z');
      const movingHub=new THREE.Group();
      movingHub.name='Вращающийся фланец опорного катка';
      movingHub.position.set(x,y,sign*.123);
      movingHub.userData.part=id;g.add(movingHub);
      for(let j=0;j<6;j++){
        const a=2*Math.PI*j/6;
        bolt(movingHub,[.047*Math.cos(a),.047*Math.sin(a),0],'z',m.darkBolt,id,.007);
      }
      rotatingHubs.push({group:movingHub,radius:outer});
    }
    for(const {x,y,r} of endWheels){
      cylinder(g,r,r,.115,[x,y,sign*.012],m.shadow,id,'z',40);
      cylinder(g,r*.84,r*.84,.024,[x,y,sign*.071],m.joint,id,'z',32);
      cylinder(g,r*.38,r*.38,.027,[x,y,sign*.094],m.satin,id,'z',24);
      cylinder(g,.032,.032,.18,[x,y,-sign*.042],m.frame,id,'z',18);
      beam(g,[x,.38,-sign*.081],[x,y,-sign*.081],.030,m.frame,id);
    }
    // Link geometry is instanced for mobile rendering performance.
    const linkCount=114; // Same geometry on mobile; historical pitch remains C.
    const treadGeo=new THREE.BoxGeometry(P/linkCount*.91,2*padHalf,.298);
    const tread=new THREE.InstancedMesh(treadGeo,m.rubber,linkCount);
    tread.name='Отдельные полиуретановые траки';tread.userData.part=id;
    tread.castShadow=true;tread.receiveShadow=true;g.add(tread);meshes.push(tread);count++;
    const shoeGeo=new THREE.BoxGeometry(P/linkCount*.62,2*cleatHalf,.310);
    const cleats=new THREE.InstancedMesh(shoeGeo,m.tread,linkCount);
    cleats.userData.part=id;cleats.castShadow=true;cleats.receiveShadow=true;g.add(cleats);meshes.push(cleats);count++;
    const a=new THREE.Object3D(),b=new THREE.Object3D();
    for(let i=0;i<linkCount;i++){
      const [x,y,ang]=pathAt(i*P/linkCount);
      a.position.set(x,y,0);a.rotation.set(0,0,ang);a.updateMatrix();tread.setMatrixAt(i,a.matrix);
      const nx=-Math.sin(ang),ny=Math.cos(ang);
      b.position.set(x+nx*cleatOffset,y+ny*cleatOffset,0);b.rotation.set(0,0,ang);b.updateMatrix();cleats.setMatrixAt(i,b.matrix);
    }
    tread.instanceMatrix.needsUpdate=true;cleats.instanceMatrix.needsUpdate=true;
    driveModules.push({g,tread,cleats,pathAt,P,linkCount});
    // Two guide strips are visible behind articulated pad links.
    for(const side of [-.106,.106]){
      const pts=[];
      for(let i=0;i<=96;i++){const [x,y]=pathAt(i*P/96);pts.push([x,y,side]);}
      tube(g,pts,.010,m.darkBolt,id,96);
    }
    return g;
  }
  trackSide(-.63,-1);trackSide(.63,1);
  // Instanced crawler links move together in a closed loop (tread animation only).
  // No claim about verified speed, motor ratio or individual sprocket tooth pitch.
  const linkTransform=new THREE.Object3D(),cleatTransform=new THREE.Object3D();
  function setTrackPhase(phase){
    const phaseUnits=Number.isFinite(phase)?phase:0;
    for(const hub of rotatingHubs)hub.group.rotation.z=-phaseUnits/hub.radius;
    for(const mod of driveModules){
      for(let i=0;i<mod.linkCount;i++){
        const [x,y,ang]=mod.pathAt((i/mod.linkCount)*mod.P+phaseUnits);
        linkTransform.position.set(x,y,0);
        linkTransform.rotation.set(0,0,ang);
        linkTransform.updateMatrix();mod.tread.setMatrixAt(i,linkTransform.matrix);
        cleatTransform.position.set(x-Math.sin(ang)*cleatOffset,y+Math.cos(ang)*cleatOffset,0);
        cleatTransform.rotation.set(0,0,ang);
        cleatTransform.updateMatrix();mod.cleats.setMatrixAt(i,cleatTransform.matrix);
      }
      mod.tread.instanceMatrix.needsUpdate=true;
      mod.cleats.instanceMatrix.needsUpdate=true;
    }
  }


  root.userData.activeSuspensionScheme='bare';
  // WELDED CHASSIS & POWER PACK.
  const body=section('body','Корпус и рама');
  // Lower cross-members tie both inner carriers to the central frame below the upper run.
  for(const x of [-.50,.43])box(body,[.075,.070,1.12],[x,.41,0],m.frame,'body');
  box(body,[1.62,.22,.91],[0,.53,0],m.frame,'body');
  box(body,[1.71,.047,1.35],[0,.663,0],m.satin,'body');
  box(body,[1.62,.055,1.15],[0,.708,0],m.frame,'body');
  // The near cheek in photo 2 meets the outer deck edge and has a low crown.
  // Longitudinal and vertical coordinates, transverse offset and depth remain C.
  const hoodBase=.687, shoulder=.706, crownRise=.150;
  const hoodPts=[[.030,hoodBase],[.030,shoulder]];
  for(let i=0;i<=12;i++){
    const a=Math.PI-i*Math.PI/24;
    hoodPts.push([.275+.245*Math.cos(a),shoulder+crownRise*Math.sin(a)]);
  }
  for(let i=0;i<=12;i++){
    const a=Math.PI/2-i*Math.PI/24;
    hoodPts.push([.572+.232*Math.cos(a),shoulder+crownRise*Math.sin(a)]);
  }
  hoodPts.push([.804,hoodBase]);
  const hood=plate(body,hoodPts,.81,-.644,m.shadow,'body');
  hood.name='Кожух с плоской вершиной и скруглёнными плечами';
  // Low deck and service panels forward of the drive enclosure.
  box(body,[.50,.06,.77],[-.41,.76,0],m.panel,'body');
  box(body,[.47,.055,.50],[-.41,.796,0],m.olive,'body');
  for(const x of [-.58,-.25]){
    for(const z of [-.21,.21])bolt(body,[x,.823,z],'y',m.darkBolt,'body',.014);
  }
  // Hidden torsion bars / repeated hood vents omitted: not resolved in source views.
  // ROTARY PEDESTAL & VISIBLE TRANSMISSION
  const base=section('turret','Поворотная опора манипулятора');
  // Shift toward the front according to the approximate archival side-view silhouette.
  // This is an uncalibrated relative alignment, NOT a factory coordinate.
  base.position.x=-.20;
  cylinder(base,.36,.37,.11,[.06,.79,0],m.frame,'turret','y',48);
  cylinder(base,.30,.30,.035,[.06,.853,0],m.satin,'turret','y',48);
  cylinder(base,.24,.24,.12,[.06,.927,0],m.panel,'turret','y',40);
  cylinder(base,.17,.17,.06,[.06,1.009,0],m.shadow,'turret','y',40);
  ring(base,.333,.023,[.06,.853,0],m.bright,'turret','y');
  for(let i=0;i<24;i++){
    const a=i*Math.PI*2/24;
    bolt(base,[.06+.329*Math.cos(a),.873,.329*Math.sin(a)],'y',m.darkBolt,'turret',.013);
  }
  // Open upright side frames visible in SKTB photo2,4 and Arsenal stand photograph.
  for(const s of [-1,1]){
    const z=s*.235;
    for(const x of [-.13,.24])beam(base,[x,.89,z],[x,1.52,z],.026,m.satin,'turret');
    beam(base,[-.13,1.52,z],[.24,1.52,z],.032,m.frame,'turret');
    beam(base,[-.13,.91,z],[.24,1.48,z],.017,m.panel,'turret');
    plate(base,[[-.16,.88],[.27,.88],[.24,1.06],[-.12,1.06]],.025,z-.0125,m.panel,'turret');
  }
  cylinder(base,.09,.09,.58,[.06,1.18,0],m.frame,'turret','z',32);
  // Batanov & Lositsky, fig. 7: slender longitudinal members, external
  // ribbed elements and flat end plates. Internal section is unknown.
  const armPivot=section('arm','Стрела манипулятора',root);
  armPivot.position.set(-.14,1.18,0);
  const boom=new THREE.Group();
  boom.rotation.z=-Math.atan2(.68,1.06);
  boom.scale.set(.86,.86,1); // provisional silhouette fit to full-resolution SKTB photo2
  armPivot.add(boom);
  for(const side of [-1,1]){
    const z=side*.118;
    box(boom,[1.16,.067,.051],[-.53,0,z],m.satin,'arm');
    box(boom,[.42,.058,.045],[-1.31,0,z],m.panel,'arm');
    plate(boom,[[-1.55,.044],[-1.46,.079],[-1.08,.039],[-1.12,-.115],[-1.48,-.032]],
      .035,z-.0175,m.panel,'arm');
    beam(boom,[.03,-.18,z],[-1.17,-.089,z],.019,m.satin,'arm',12);
    beam(boom,[-.25,-.18,z],[-.57,-.03,z],.014,m.frame,'arm',10);
    plate(boom,[[-.22,.048],[.05,.10],[.13,.015],[.09,-.12],[-.1,-.16]],
      .034,z-.017,m.frame,'arm');
    cylinder(boom,.078,.078,.068,[0,0,side*.16],m.satin,'arm','z',24);
    for(const x of [-1.44,-1.15]) bolt(boom,[x,.008,z+side*.027],'z',m.darkBolt,'arm',.012);
  }
  // Two longitudinal side planes with open bays in photos 2 and 4. The hidden
  // cross-ties, their stations and the exact triangular subdivisions are C.
  for(const z of [-.118,.118]){
    beam(boom,[.03,-.18,z],[.03,.025,z],.020,m.frame,'arm');
    beam(boom,[-.61,-.132,z],[-.61,0,z],.014,m.panel,'arm');
    beam(boom,[-.61,-.132,z],[-.97,0,z],.013,m.panel,'arm');
    beam(boom,[-1.17,-.089,z],[-1.46,.01,z],.018,m.satin,'arm');
  }
  for(const x of [-.14,-.61,-1.08])
    beam(boom,[x,0,-.118],[x,0,.118],.020,m.frame,'arm');
  for(const x of [-.13,.24])
    beam(base,[x,1.50,-.235],[x,1.50,.235],.023,m.frame,'turret');
  const distalPin=cylinder(boom,.048,.048,.29,[-1.46,.01,0],m.frame,'arm','z',24);
  distalPin.name='Концевая ось стрелы';
  function spring(parent,a,b,rad,turns,coil,id) {
    const A=V(a),B=V(b),dir=B.clone().sub(A),len=dir.length();
    const up=dir.clone().normalize();const ref=new THREE.Vector3(0,0,1);
    const u=ref.clone().cross(up).normalize(),v=up.clone().cross(u).normalize();
    const pts=[];
    for(let i=0;i<=turns*10;i++){
      const t=i/(turns*10),ang=t*turns*Math.PI*2;
      pts.push(A.clone().addScaledVector(dir,t).addScaledVector(u,Math.cos(ang)*rad).addScaledVector(v,Math.sin(ang)*rad));
    }
    const curve=new THREE.CatmullRomCurve3(pts);
    const o=mesh(parent,new THREE.TubeGeometry(curve,Math.min(480,turns*12),coil,6,false),m.satin,id);
    beam(parent,a,b,.023,m.frame,id,12);return o;
  }
  for(const side of [-1,1]){
    const z=side*.12;
    spring(boom,[-.04,.098,z],[-1.08,.098,z],.03,32,.0075,'arm');
    beam(boom,[-.04,.098,z],[-.015,.022,z],.025,m.frame,'arm');
    beam(boom,[-1.08,.098,z],[-1.13,.005,z],.022,m.olive,'arm');
  }
  tube(boom,[[.14,-.025,.12],[.12,.11,.15],[-.36,.068,.16],
    [-.91,.065,.15],[-1.33,.073,.12],[-1.49,.10,.10]],.010,m.cable,'arm',40);

  // The photographed head has an open dark frame and broad light-coloured
  // lower surfaces. Exact division into moving and fixed parts is inferred.
  const gripper=section('gripper','Сменная рабочая головка',armPivot);
  gripper.position.copy(new THREE.Vector3(-1.46,.01,0).multiply(boom.scale).applyAxisAngle(new THREE.Vector3(0,0,1),boom.rotation.z)); // Share the actual distal pin; no detached head.
  cylinder(gripper,.083,.083,.275,[0,0,0],m.frame,'gripper','z',28);
  for(const side of [-1,1]){
    cylinder(gripper,.062,.062,.022,[0,0,side*.144],m.satin,'gripper','z',28);
    bolt(gripper,[0,0,side*.161],'z',m.darkBolt,'gripper',.019);
  }
  const fingerHead=new THREE.Group();
  fingerHead.name='Двупалый сменный схват';fingerHead.userData.part='gripper';
  gripper.add(fingerHead);
  // The opposing broad plates read across the frontal image (#3).
  // Roll about the hanging tool axis remains a single-view interpretation.
  fingerHead.rotation.x=Math.PI*.32;
  for(const z of [-.09,.09]){
    beam(fingerHead,[0,0,z],[-.08,.085,z],.020,m.frame,'gripper');
    beam(fingerHead,[0,0,z],[-.08,-.085,z],.020,m.frame,'gripper');
    beam(fingerHead,[-.39,-.085,z],[-.39,.085,z],.018,m.frame,'gripper');
  }
  beam(fingerHead,[-.39,0,-.12],[-.39,0,.12],.025,m.frame,'gripper');
  beam(fingerHead,[-.085,0,-.09],[-.085,0,.09],.024,m.frame,'gripper');
  for(const side of [-1,1])
    beam(fingerHead,[-.085,0,side*.09],[-.085,.085,side*.09],.018,m.frame,'gripper');

  // Local -X is the hanging axis; viewer keeps it vertical at a neutral wrist.
  // B: open frame, central cylindrical member and wide plates. Internal drive C.
  cylinder(fingerHead,.068,.068,.27,[-.22,0,0],m.satin,'gripper','x',24);
  for(const z of [-.09,.09])for(const s of [-1,1]){
    beam(fingerHead,[-.07,s*.085,z],[-.39,s*.085,z],.015,m.frame,'gripper');

  }

  const fingerMechanisms=[];
  for(const side of [-1,1]){
    const finger=new THREE.Group();finger.name='Широкая губка '+side;
    finger.position.set(-.40,side*.035,0);fingerHead.add(finger);
    for(const z of [-.12,.12]){
      beam(finger,[0,0,z],[-.19,side*.18,z],.020,m.frame,'gripper');
      beam(finger,[-.07,-side*.025,z],[-.25,side*.14,z],.016,m.satin,'gripper');
    }
    // Broad side surface; no invented count of edge serrations.
    for(const z of [-.155,.133])plate(finger,[[-.18,side*.18],[-.41,side*.18],[-.43,side*.025],[-.23,side*.025]],.022,z,m.panel,'gripper');
    box(finger,[.20,.024,.31],[-.33,side*.025,0],m.panel,'gripper');
    cylinder(finger,.026,.026,.28,[0,0,0],m.frame,'gripper','z',20);
    fingerMechanisms.push({side,group:finger});
  }
  tube(fingerHead,[[.03,.08,-.09],[.10,.17,-.09],[-.20,.17,-.09],[-.34,.09,-.09]],.009,m.cable,'gripper');
  // Removable electrically driven percussion-tool PROXY. Functional interchangeability
  // is documented by SKTB, but these outlines/connection details are illustrative.
  function buildBreaker(parent,id,pose='arm'){
    const g=new THREE.Group();g.name='Отбойный молоток · реконструкция';
    g.userData.part=id;parent.add(g);
    if(pose==='arm'){
      // SKTB album9 documents a narrow cylindrical attachment and extended chisel.
      // The adapter/axis is approximate; this is not a manufacturing reconstruction.
      cylinder(g,.050,.052,.46,[-.30,0,0],m.satin,id,'x',28);
      cylinder(g,.035,.035,.24,[-.62,0,0],m.bright,id,'x',22);
      // In photo 9 the exposed working tip narrows toward the contact point.
      cylinder(g,.006,.026,.20,[-.84,0,0],m.frame,id,'x',24);
      box(g,[.14,.11,.13],[-.065,0,0],m.frame,id);
      cylinder(g,.067,.066,.086,[-.497,0,0],m.frame,id,'x',20);
      tube(g,[[0,.04,0],[-.13,.095,0],[-.27,.085,0],[-.31,.047,0]],.008,m.cable,id,20);
    }else{
      // A possible substitution at the loader tilt pin. The adapter is class C.
      g.position.set(0,0,0);
      cylinder(g,.044,.044,1.72,[0,0,0],m.frame,id,'z',24);
      box(g,[.18,.35,.18],[0,-.10,0],m.frame,id);
      cylinder(g,.083,.088,.31,[0,-.26,0],m.olive,id,'y',28);
      cylinder(g,.05,.05,.12,[0,-.47,0],m.satin,id,'y',20);
      beam(g,[0,-.52,0],[0,-.75,0],.028,m.bright,id);
      const point=mesh(g,new THREE.ConeGeometry(.044,.14,4),m.satin,id,'Рабочее зубило');
      point.position.set(0,-.78,0);point.rotation.z=Math.PI;
      for(const y of [-.16,-.25,-.33])ring(g,.087,.008,[0,y,0],m.satin,id,'y');
    }
    g.visible=false;return g;
  }
  const breakerArm=buildBreaker(gripper,'gripper','arm');

  // FRONT LOADER: outside-frame lifting links and a genuine open bucket silhouette.
  const bucket=section('bucket','Фронтальный погрузчик и ковш');
  bucket.position.set(-1.03,.48,0);
  const loaderPivotLocal=new THREE.Vector3(1.31,.17,0);
  const scoopPivot=new THREE.Vector3(.02,.015,0);
  bucket.position.add(loaderPivotLocal);
  const bucketScoop=new THREE.Group();
  bucketScoop.name='Ось наклона оснастки';bucketScoop.userData.part='bucket';
  bucketScoop.position.copy(scoopPivot).sub(loaderPivotLocal);bucket.add(bucketScoop);
  const liftPins=[], framePins=[];
  for(const side of [-1,1]){
    const z=side*.835;
    // Broad inclined carrier, outer crank and a continuous forward ear (photo 2).
    // Its lateral offset clears the track shoes. Bearing and plate sections are C.
    const profile=[[.04,.075],[-.24,.09],[-.66,-.09],[-1.24,-.10],[-1.33,-.13],
      [-1.33,-.20],[-1.24,-.22],[-.63,-.20],[-.20,-.035],[.04,-.035]];
    plate(bucket,profile,.043,z-.0215,m.frame,'bucket');
    cylinder(bucket,.068,.068,.078,[0,0,z],m.joint,'bucket','z');
    cylinder(bucket,.058,.058,.091,[bucketScoop.position.x,bucketScoop.position.y,z],m.satin,'bucket','z');
    const liftAnchor=cylinder(bucket,.038,.038,.095,[-.66,-.14,z],m.joint,'bucket','z');
    liftPins.push(liftAnchor);
    // Fixed trunnions project from above the track, never from a free point in space.
    box(body,[.16,.055,.23],[.28,.682,side*.735],m.frame,'body');
    cylinder(body,.048,.048,.13,[.28,.65,side*.793],m.satin,'body','z');
    box(body,[.11,.07,.22],[.51,.71,side*.735],m.frame,'body');
    const framePin=cylinder(body,.040,.040,.11,[.51,.72,z],m.joint,'body','z');
    framePins.push(framePin);
  }
  const scoopShell=new THREE.Group();scoopShell.name='Съёмный ковш';
  scoopShell.userData.part='bucket';bucketScoop.add(scoopShell);
  // An open transverse pan with a folded back and a single working lip (#2, #4).
  // The cross-section is shared by floor and cheeks to avoid detached sheets.
  const sectionXY=[[-.60,-.21],[-.48,-.18],[-.10,-.13],[.015,-.04],[.075,.23]];
  function sheetBetween(a,b,width,thickness){
    const dx=b[0]-a[0],dy=b[1]-a[1];
    return box(scoopShell,[Math.hypot(dx,dy)+.006,thickness,width],
      [(a[0]+b[0])/2,(a[1]+b[1])/2,0],m.panel,'bucket',Math.atan2(dy,dx));
  }
  for(let i=1;i<sectionXY.length;i++)sheetBetween(sectionXY[i-1],sectionXY[i],1.52,.027);
  const blade=sheetBetween([-.64,-.216],sectionXY[1],1.56,.019);
  blade.name='Сплошная рабочая кромка';
  for(const side of [-1,1]){
    const z=side*.75;
    plate(scoopShell,[...sectionXY,[-.07,.245],[-.42,-.01]],.034,z-.017,m.frame,'bucket');
    beam(scoopShell,[.052,.15,z],[0,0,z],.04,m.frame,'bucket');
  }
  cylinder(scoopShell,.046,.046,1.72,[0,0,0],m.joint,'bucket','z');
  const breakerLoader=buildBreaker(bucketScoop,'bucket','loader');
  // Modes are EXCLUSIVE; historical text documents either working location,
  // not simultaneous installation of both breakers.
  function setWorkTool(mode){
    const next=['gripper','breaker-arm','breaker-loader'].includes(mode)?mode:'gripper';
    fingerHead.visible=next==='gripper';
    breakerArm.visible=next==='breaker-arm';
    breakerLoader.visible=next==='breaker-loader';
    scoopShell.visible=next!=='breaker-loader';
    root.userData.activeWorkTool=next;
    return next;
  }
  setWorkTool('gripper');
  // Position of pivot in robot local coords ~= [0.28,0.65,0].
  // Source only confirms two DOFs, not these exact joint coordinates.
  // Two distinct television cameras (front drive & manipulator observation).
  const cameras=section('cameras','Наружные корпуса телекамер',base);
  function cameraHousing(at,ang,anchor){
    const housing=new THREE.Group();housing.position.set(...at);housing.rotation.z=ang;cameras.add(housing);
    const shell=cylinder(housing,.079,.088,.26,[0,0,0],m.panel,'cameras','x',32);
    cylinder(housing,.065,.065,.015,[-.133,0,0],m.shadow,'cameras','x',24);
    cylinder(housing,.039,.039,.009,[-.143,0,0],m.lens,'cameras','x',20);
    const saddle=cylinder(housing,.093,.093,.038,[.05,0,0],m.frame,'cameras','x',24);
    saddle.updateWorldMatrix(true,false);
    // Use the actual outer clamp as endpoint of the assumed bracket.
    const end=cameras.worldToLocal(saddle.getWorldPosition(new THREE.Vector3()));
    beam(cameras,anchor,end.toArray(),.026,m.frame,'cameras');
    return shell;
  }
  cameraHousing([-.11,1.32,.34],-.72,[-.13,1.28,.235]);
  cameraHousing([.19,1.37,-.34],.78,[.24,1.30,-.235]);
  // Exterior cable only. The archive describes a change of routing, but offers
  // no section of the stower or verified mounting geometry for the dosimeter.
  const cabling=section('cable','Наружный вывод кабеля');
  cylinder(cabling,.047,.047,.09,[.804,.738,-.28],m.frame,'cable','x',24);
  tube(cabling,[[.842,.738,-.28],[.92,.724,-.29],[1.01,.60,-.31],
    [1.15,.34,-.33],[1.32,.16,-.36],[1.43,.15,-.39]],.011,m.cable,'cable',30);
  // Visible mechanical linkages follow lifting motion instead of being static decoration.
  // These are topologically plausible ELECTROMECHANICAL screw actuator proxies,
  // not a measured reconstruction of factory jack mounting points.
  const actuatorVisual=new THREE.Group();
  actuatorVisual.name='Условная демонстрация кинематических связей';
  actuatorVisual.userData.part='arm';root.add(actuatorVisual);
  const cylGeo=new THREE.CylinderGeometry(1,1,1,16);
  function adjustableSegment(material,id,r){
    const o=mesh(actuatorVisual,cylGeo,material,id);
    o.scale.set(r,1,r);return o;
  }
  // All parts carried by the turntable share one vertical axis. Coordinates
  // from v15 were expressed in the robot frame. Retain their neutral pose.
  const turntable=new THREE.Group();
  turntable.name='Поворот манипулятора';turntable.position.x=-.14;root.add(turntable);
  const rotatingFrame=new THREE.Group();rotatingFrame.position.x=.14;turntable.add(rotatingFrame);
  rotatingFrame.add(base,armPivot);
  const armFixed=cylinder(base,.034,.034,.10,[.22,.99,-.235],m.joint,'turret','z');
  const armMoving=cylinder(boom,.030,.030,.10,[-.61,-.132,-.118],m.joint,'arm','z');
  const actuatorArmHousing=adjustableSegment(m.frame,'arm',.047);
  const actuatorArmScrew=adjustableSegment(m.bright,'arm',.027);
  rotatingFrame.add(actuatorArmHousing,actuatorArmScrew);
  const loaderHousings=[],loaderScrews=[];
  for(const s of [-1,1]){
    loaderHousings.push({s,o:adjustableSegment(m.frame,'bucket',.034)});
    loaderScrews.push({s,o:adjustableSegment(m.satin,'bucket',.019)});
  }
  function setSegment(o,a,b,r){
    const direction=b.clone().sub(a),length=direction.length();
    o.position.copy(a).addScaledVector(direction,.5);
    o.quaternion.setFromUnitVectors(unitY,direction.clone().normalize());
    o.scale.set(r,length,r);
  }
  function interpolate(a,b,t){return a.clone().addScaledVector(b.clone().sub(a),t);}
  function updateLinkages(){
    const armMountA=rotatingFrame.worldToLocal(armFixed.getWorldPosition(new THREE.Vector3()));
    const armMountB=rotatingFrame.worldToLocal(armMoving.getWorldPosition(new THREE.Vector3()));
    setSegment(actuatorArmHousing,armMountA,interpolate(armMountA,armMountB,.68),.048);
    setSegment(actuatorArmScrew,interpolate(armMountA,armMountB,.46),armMountB,.027);

    for(let i=0;i<2;i++){
      const a=actuatorVisual.worldToLocal(framePins[i].getWorldPosition(new THREE.Vector3()));
      const b=actuatorVisual.worldToLocal(liftPins[i].getWorldPosition(new THREE.Vector3()));
      setSegment(loaderHousings[i].o,a,interpolate(a,b,.66),.035);
      setSegment(loaderScrews[i].o,interpolate(a,b,.45),b,.020);
    }
  }
  updateLinkages();
  // Secondary fasteners, junctions, mechanical guarding, service seams.
  const mechanics=section('mechanics','Крепления и узлы шасси');
  // Keep only deck edge rails supported continuously by the deck (C).
  for(const side of [-1,1])
    box(mechanics,[1.46,.026,.025],[0,.692,side*.639],m.olive,'mechanics');
  // Surface highlights: two subtly separate shades for rebuilt welded steel.
  const info={
    tracks:{name:'Гусеничный движитель',status:'К фотографическому профилю добавлена отдельная условная схема балансиров: три пары и одиночная опора на каждом борту. Наличие балансиров подтверждают воспоминания о ремонте 1987 года, но эта компоновка и оси не доказаны архивными чертежами. Контур и число катков — гипотеза.',basis:'СКТБ ПР · архивный снимок; Батанов/Лосицкий «Чернобыльская крыша» · сведения о деформации балансиров'},
    body:{name:'Корпус и рама',status:'Обводы защитного кожуха, листовые панели и крепеж восстановлены визуально. Не все люки и толщины металла документированы.',basis:'СКТБ ПР · архивный профиль'},
    turret:{name:'Поворотная опора',status:'Открытая опорная рама уточнена по снимкам; оси и фланцы условные. Внутреннее устройство опоры не установлено.',basis:'Фото, функциональная реконструкция'},
    arm:{name:'Манипулятор',status:'На стендовом снимке видны продольные тяги, наружные ребристые элементы и боковые пластины у головки. Их пропорции подобраны по фотографии.',basis:'А. Батанов, В. Лосицкий, «Чернобыльская крыша», рис. 7'},
    gripper:{name:'Двупалый захват',status:'Документально подтверждены сменный двупалый захват и вариант отбойного молотка вместо схвата. В модели можно переключать инструмент, но корпус, зубило и места крепления выполнены условно.',basis:'СКТБ ПР · описание модернизации Ч-ХВ-2'},
    bucket:{name:'Фронтальный погрузчик',status:'Удалены девять неподтверждённых зубьев ковша. Смоделирована непрерывная металлическая рабочая кромка и сменный отбойный молоток на погрузчике; точная форма и крепления остаются условными.',basis:'СКТБ ПР · демонстрационный снимок и описание сменного инструмента'},
    cameras:{name:'Телевизионная система',status:'Наличие двух телекамер подтверждено. Их форма и координаты ориентировочные; необходимы дополнительные фотографии.',basis:'СКТБ ПР · два телевизионных канала'},
    cable:{name:'Наружный вывод кабеля',status:'Виден наружный кабель. Изменение точки вывода описано разработчиком. Трасса и ввод в этой сцене условны.',basis:'СКТБ ПР, №2 и №4'},
    dock:{name:'Стыковочное устройство',status:'Функция известна, а верхний узел геометрически условен. Нельзя утверждать точное расположение точки подъёма.',basis:'СКТБ ПР · устройство Ч-ХВ-2'},
    dose:{name:'Дозиметрическое оборудование',status:'Дозиметрия входила в рабочий цикл. Геометрия крепления и положение датчика требуют архивной сверки.',basis:'Первичные материалы проекта и СКТБ'},
    mechanics:{name:'Крепёж и коммуникации',status:'Служебная детализация добавлена по инженерным аналогам. Болтовые группы и магистрали требуют подтверждения.',basis:'Реконструкция, не паспортные сборочные чертежи'}
  };

  // v13: survey the *full leading tooth row* in model coordinates rather than
  // a single invented blade point. This is a transparent, deterministic 2D
  // kinematic screening model, NOT a mesh collision engine or historical joint limits.

  // All math below is delegated to ONE canonical engine used by the 2D atlas.
  // Coordinates for physically moving groups are read from the actual model:
  // if a future model edit changes pivots, the assessment updates automatically.

  const bladeProbes=[];
  blade.updateMatrix();
  const vertices=blade.geometry.getAttribute('position');
  for(let i=0;i<vertices.count;i++){
    const p=new THREE.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(blade.matrix);
    if(!bladeProbes.some(q=>q.x===p.x&&q.y===p.y&&q.z===p.z))
      bladeProbes.push({x:p.x,y:p.y,z:p.z,label:'вершина кромки'});
  }
  function activePlanarProfile(){
    return {
      ...PROFILE_V15,
      probes:bladeProbes,
      loaderPivot:[bucket.position.x,bucket.position.y],
      scoopRelative:[bucketScoop.position.x,bucketScoop.position.y],
      groundY:groundReferenceY
    };
  }
  function auditBucketPose(lift=bucket.rotation.z,tip=bucketScoop.rotation.z){
    return sharedAudit(lift,tip,activePlanarProfile());
  }
  function sweepBucketEnvelope(liftMin=-18,liftMax=28,tipMin=-38,tipMax=38,step=2){
    return sharedSweep(liftMin,liftMax,tipMin,tipMax,step,activePlanarProfile());
  }
  function estimateBucketClearance(){
    const scan=auditBucketPose();
    return {
      bladeTipHeightScene:scan.lowestPoint.y,
      nominalTrackPlaneScene:groundReferenceY,
      relativeClearanceScene:scan.minClearanceScene,
      underNominalPlane:scan.potentialGroundCrossing,
      probeCount:scan.probeCount,
      negativeProbeCount:scan.negativeProbeCount,
      validated:false
    };
  }
  const sourceProfile=()=>({
    version:'v22-research',
    units:'uncalibrated scene units',
    physicalScaleKnown:false,
    trackContour:sourceTrackProfile.map(p=>[...p]),
    wheelXs:lowerWheels.map(w=>w.x),
    visibleWheelOuterRadiiScene:lowerWheels.map(w=>w.r),
    terminalWheels:endWheels.map(w=>({...w})),
    lowerWheels:lowerWheels.map(w=>({...w})), padHalf, cleatOffset, cleatHalf,
    wheelRadiometry:'manual single-photo apparent face scale; NOT factory wheel dimensions',

    bucketLiftPivot:[bucket.position.x,bucket.position.y],
    bucketTiltPivotRelative:[bucketScoop.position.x,bucketScoop.position.y],
    armPivot:[armPivot.position.x,armPivot.position.y],
    armDistalLocal:[gripper.position.x,gripper.position.y],
    lowerTrackDatum:groundReferenceY,
    bucketProbes:bladeProbes.map(p=>({...p})),
    canonicalModule:'mobot-kinematics-v15.js',
    trueArchivalDimensions:false
  });
  const neutral={yaw:0,arm:0,wrist:90,claw:4,bucket:12,tip:0,track:0};
  let current={...neutral};
  function setPose(values={}){
    current={...current,...values};
    const r=THREE.MathUtils.degToRad;
    turntable.rotation.y=r(current.yaw);
    armPivot.rotation.z=r(current.arm);
    gripper.rotation.z=r(current.wrist-current.arm);
    for(const f of fingerMechanisms)f.group.rotation.z=-f.side*r(current.claw);
    bucket.rotation.z=-r(current.bucket);
    bucketScoop.rotation.z=r(current.tip);
    if('track' in values)setTrackPhase(current.track*.015);
    updateLinkages();
    root.updateMatrixWorld(true);
  }
  function solidBounds(group){
    const bounds=new THREE.Box3();
    group.traverseVisible(o=>{if(o.isMesh)bounds.expandByObject(o,true)});
    return bounds;
  }
  function inspectPose(){
    // Evaluate assembled scene only. Bounds of active tools use transformed vertices.
    const tool=root.userData.activeWorkTool;
    const carried=tool==='gripper'?fingerHead:tool==='breaker-arm'?breakerArm:null;
    const working=solidBounds(tool==='breaker-loader'?breakerLoader:scoopShell);
    const handheld=carried?solidBounds(carried):null;
    const clearance=Math.min(working.min.y,handheld?.min.y??Infinity)-groundReferenceY;
    const alerts=[];
    if(clearance<-.0001)alerts.push('Рабочий орган ниже плоскости опоры');
    if(handheld && handheld.intersectsBox(working))
      alerts.push('Возможное пересечение рабочего органа и ковша по габаритам');
    if(handheld && handheld.intersectsBox(solidBounds(hood)))
      alerts.push('Возможное пересечение рабочего органа и кожуха по габаритам');
    return {clearance,alerts,datum:groundReferenceY,tool};
  }
  const mechanisms={setPose,inspectPose,turntable,arm:armPivot,bucketLift:bucket,bucketTilt:bucketScoop,setWorkTool,updateLinkages,setTrackPhase,
    estimateBucketClearance,auditBucketPose,sweepBucketEnvelope,sourceProfile,
    distalPin,armFixed,armMoving,actuatorArmHousing,actuatorArmScrew,
    framePins,liftPins,loaderHousings,loaderScrews,blade,
    fingerHead,breakerArm,breakerLoader,scoopShell,
    gripper,fingers:fingerMechanisms,cameras};
  // Model's nominal dimensions are scene units only. This scale is not equal to verified metres.
  assembleFasteners();
  root.userData.nominalOnly=true;
  root.userData.suspensionProvenance='Схема балансиров неизвестна. В модели показана условная внутренняя опора (C).';
  root.userData.verificationPolicy="Do not assert reconstructed hinge dimensions, speeds, or assembly topology as historical facts.";
  root.userData.sharedKinematics='mobot-kinematics-v15.js';
  root.userData.bucketEnvelope={
    probeCount:bladeProbes.length,kind:'actual corners of continuous wear lip',
    limits:'sampled demonstrative slider values only, not actual physical limits',
    solver:'rigid planar Z rotations; no real collision calculation'
  };
  root.userData.nominalTrackLength=1.78;
  root.userData.nominalTrackLengthNote='Estimated longest crawler X-span in uncalibrated MODEL coordinates, not the real length.';
  root.userData.fastenerInstances=fastenerInstanceCount;
  root.userData.fastenerLOD='v10 instancing: retain fastener geometry in desktop and mobile profiles';
  root.userData.version='v22-research';
  root.userData.workToolEvidence={
    interchangeableGripper:true,breakerAtArm:true,breakerOnLoader:true,
    reference:'https://sktbpr.ru/node/23',
    mountingGeometryVerified:false,toolShapeVerified:false,
    modelsAreExclusive:true
  };
  root.userData.bucketEdgeEvidence={
    oldTeeth:'9 separate teeth were unsupported and removed',
    current:'continuous profile provisionally aligned with SKTB side photo',
    exactCrossSectionVerified:false
  };
  root.userData.geometryBasis='v22: photo-registered enclosure; full-frame wheel landmarks, tangent track and articulated exterior; SKTB photos 2,3,4,9; return track below deck, rounded cover, open upright, revised boom silhouette, wide plate gripper, cylindrical camera housings and slender breaker. Topology B; dimensions/axes C.';
  root.userData.driveType='electromechanical; internal reducer dimensions are speculative';
  root.userData.loaderDegreesOfFreedom=2;
  root.userData.trackLoopMethod='convex tangent envelope from full-resolution photo 2; nominal';
  root.userData.roadWheelsPerSide=7;
  root.userData.variantGuard='Never copy MRK-46M (later robot) specification: six road wheels and eight polyurethane elements into the 1987 Mobot CH-HV-2 model.';
  root.userData.roadWheelConfidence='seven visible wheel features B in SKTB 1987 image; apparent face size is estimated from full-resolution photo 2; all scene radii, axle coordinates and actual wheel cross-sections remain C';
  root.userData.trackDriveAnimation='track pad loop and visible wheel hub motion for stand inspection; drive-speed and sprocket transmission not measured';

  root.userData.modelRailPivot='chassis local x=0.28 y=0.65; estimated from 1987 photo';
  root.userData.loaderDriveRendering='electromechanical screw links shown schematically and length-adjust dynamically';
  root.userData.kinematicAccuracy='demonstrative, not a validated mechanism';
  root.userData.fingerAnimation='demonstrative two-jaw actuation, not exact linkage';

  root.userData.source='https://sktbpr.ru/foto-alb/65';
  root.userData.secondarySource='https://storage.arsenal-otechestva.ru/article/2375-chernobylskaya-krysha';
  const calibrated=false;
  return {root,parts,info,meshes,materials:materialRegistry,mechanisms,
    meshCount:count,renderedFasteners:fastenerInstanceCount,calibrated,
    quality:isMobile?'mobile':'desktop'};
}