import { PROFILE_V15, auditBucketPose as sharedAudit, sweepBucketEnvelope as sharedSweep } from './mobot-kinematics-v15.js';
// MOBOT-CH-HV-2 / TRACK V20: visible rim-size approximation / 2026-11-17
// Derived non-destructively from V18. Research only: projected photo-visible wheel radii; NOT measured factory coordinates.
// Source photo: https://sktbpr.ru/sites/default/files/foto_album/2.jpg
// Primary photo: https://sktbpr.ru/sites/default/files/foto_album/2.jpg
// Primary tech description: https://sktbpr.ru/content/mrk-mobot-ch-hv-2
// NOT a dimensionally calibrated CAD model. Side silhouette anchored to ONE archival image.
// Purpose: visually realistic inspection model; NOT a dimensional CAD certification.
export function makeMobot(THREE, quality='auto') {
  const root=new THREE.Group(); root.name='Мобот-Ч-ХВ-2 / исследовательская реконструкция';
  const parts={}, meshes=[], materialRegistry={};
  const isMobile=quality==='mobile'||(quality==='auto'&&window.innerWidth<760);
  let count=0;
  let fastenerCounter=0;
  const driveModules=[];
  let sourceTrackProfile=null;
  let researchRoadWheelXs=null; // v20: approximate scene positions from one photograph
  let researchRoadWheelRadii=null; // v20: face-radius estimate in scene units, not actual radii
  const terminalWheelOuterRadius=.105; // scene-only projected end-wheel proxy
  const rotatingHubs=[];
  const suspensionSchemes=[];
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
    const id='tracks',cy=.47; // side-view track axle plane remains a scene-level hypothesis
    // The source side-view has a slanted nose and a long level return section.
    // This is a DIMENSIONLESS profile approximation. It does NOT supply physical track dimensions.
    const contour=[
      [-.70,.635],[0,.635],[.71,.635],[.82,.57],[.87,.45],
      [.75,.25],[.61,.14],[0,.14],[-.47,.14],[-.67,.21],[-.85,.37],[-.91,.47],[-.85,.58]
    ]; // v20: return run below deck (SKTB originals2,4), all coordinates C.
    if(!sourceTrackProfile)sourceTrackProfile=contour.map(p=>[...p]);
    const path=new THREE.CatmullRomCurve3(contour.map(([x,y])=>new THREE.Vector3(x,y,0)),true,'centripetal',.35);
    path.arcLengthDivisions=350;
    const P=path.getLength();
    function pathAt(s){
      const t=((s%P)+P)%P/P;
      const point=path.getPointAt(t),tangent=path.getTangentAt(t);
      return [point.x,point.y,Math.atan2(tangent.y,tangent.x)];
    }
    // Suspension is not a rigid row of invented individual vertical arms:
    // SKTB-linked historic recollections mention bent balance levers in early 1987.
    // The schematic pairing below is intentionally marked as HYPOTHESIS, not a documented bogie topology.
    const suspension=new THREE.Group();
    suspension.name='Парные балансиры — условная версия A';
    suspension.userData.part='tracks';g.add(suspension);
    const independentSuspension=new THREE.Group();
    independentSuspension.name='Независимые рычаги — условная версия B';
    independentSuspension.userData.part='tracks';
    independentSuspension.visible=false;
    g.add(independentSuspension);
    suspensionSchemes.push({paired:suspension,independent:independentSuspension});
    const rockerPairs=[[0,1],[2,3],[4,5]];
    const rockerMaterial=m.olive;
    // Lower running wheels and output sprockets.
    // Seven distinct lower wheel centres are visible in the identified SKTB 1987 side photograph.
    // From approx pixels [319,275,229,188,144,100,53] in a 500px rendering,
    // mapped REVERSED along model X because model FRONT is -X while bucket is on the RIGHT in the photo.
    // Relative alignment only: manual landmark uncertainty ~10px; no physical scale.
    const wheelXs=[-.45,-.26,-.07,.10,.29,.47,.67];
    const wheelRadii=wheelXs.map((_,i)=>.070+(i%2===0?.003:0));
    if(!researchRoadWheelXs){researchRoadWheelXs=wheelXs.slice();researchRoadWheelRadii=wheelRadii.slice();}
    // 7 lower wheel features: photo-visible class B for photographed 1987 machine; model coordinates remain C.
    // A later MRK-46M paper specifies SIX road wheels for the MRK-46M;
    // those data must not be retrofitted onto CH-HV-2 without primary evidence.
    wheelXs.forEach((x,i)=>{
      // SKTB Photo2 preview (500 px): apparent outer wheel face about 14–18 px radius.
      // With nominal 425 px / 1.78 scene-width this is approximately 0.059–0.075 SCENE units.
      // The 0.070/0.073 proxy is class C, never a historical radius. ±5 px feature uncertainty.
      const y=.25,outer=wheelRadii[i];
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
      // Wheel centers are kept as independent nominal coordinates.
      // Their exact relationship to each rocker remains unverified by original plans.
      cylinder(g,.040,.040,.075,[x,.426,sign*.045],m.joint,id,'z');
    });
    // Three paired rockers and a single terminal support: VISUAL HYPOTHESIS.
    // Main proof from archives: balance arms existed; pivot spacing/arm shape not established.
    rockerPairs.forEach(([left,right],idx)=>{
      const x0=wheelXs[left],x1=wheelXs[right],cx=(x0+x1)/2;
      const yWheel=.25,yPivot=.445,zShell=sign*.055,zFace=sign*.132;
      const gR=new THREE.Group();gR.name='Схематический балансир '+(idx+1);
      gR.userData.part=id;suspension.add(gR);
      cylinder(gR,.055,.055,.115,[cx,yPivot,zShell],m.frame,id,'z',22);
      cylinder(gR,.038,.038,.124,[cx,yPivot,zFace],m.satin,id,'z',20);
      beam(gR,[cx,yPivot,zShell],[x0,yWheel,zShell],.039,rockerMaterial,id);
      beam(gR,[cx,yPivot,zShell],[x1,yWheel,zShell],.039,rockerMaterial,id);
      for(const x of [x0,x1]){
        cylinder(gR,.046,.046,.075,[x,yWheel,zFace],m.bright,id,'z',22);
        bolt(gR,[x,yWheel,zFace+sign*.045],'z',m.darkBolt,id,.014);
      }
      // A short service stop/guard near pivot; geometry is not sourced to manufacturer.
      beam(gR,[cx,yPivot,zShell],[cx+.030,.63,zShell],.025,m.shadow,id,12);
      bolt(gR,[cx,.615,zFace],'z',m.satin,id,.012);
    });
    // The seventh small wheel receives a separate schematic support.
    beam(suspension,[wheelXs[6],.46,sign*.055],[wheelXs[6],.25,sign*.055],.032,m.olive,id);
    cylinder(suspension,.043,.043,.075,[wheelXs[6],.46,sign*.116],m.satin,id,'z',20);
    // Alternative B: independent levers. This is also speculative, provided to
    // show why the historical recollection alone cannot fix linkage topology.
    for(const [index,x] of wheelXs.entries()){
      const z=sign*.055,outer=sign*.129,topY=.49;
      cylinder(independentSuspension,.045,.045,.075,[x+.038,topY,outer],m.shadow,id,'z',18);
      beam(independentSuspension,[x+.038,topY,z],[x,.25,z],.034,m.olive,id);
      cylinder(independentSuspension,.039,.039,.075,[x,.25,outer],m.satin,id,'z',16);
      // Service-stop shape is only suggested, not a known factory item.
      if(index%2===0)box(independentSuspension,[.034,.10,.035],[x+.055,.56,z],m.frame,id);
    }
    // End-wheel apparent silhouette is smaller than 0.14 scene units in SKTB Photo2.
    // V20 chooses a 0.105-scene proxy to avoid interpenetration of visible nominal discs.
    // Their photo silhouette is occluded; ±6 px uncertainty, actual radii unknown (C).
    // This is not calibrated photogrammetry, and not validation of 1987 wheel construction.
    for(const x of [-.70,.72]){
      cylinder(g,terminalWheelOuterRadius,terminalWheelOuterRadius,.12,[x,cy,sign*.006],m.shadow,id,'z',34);
      cylinder(g,.086,.086,.124,[x,cy,sign*.06],m.joint,id,'z',32);
      cylinder(g,.051,.051,.139,[x,cy,sign*.076],m.satin,id,'z',24);
      ring(g,.091,.009,[x,cy,sign*.124],m.frame,id);
      for(let j=0;j<12;j++){
        const a=Math.PI*2*j/12;
        const b=box(g,[.018,.023,.042],[x+.106*Math.cos(a),cy+.106*Math.sin(a),sign*.062],m.satin,id);
        b.rotation.z=a;
      }
      for(let j=0;j<8;j++){
        const a=2*Math.PI*j/8;
        bolt(g,[x+.059*Math.cos(a),cy+.059*Math.sin(a),sign*.133],'z',m.darkBolt,id,.007);
      }
    }
    // An exposed metallic side rail with stiffeners behind the track pads.
    box(g,[1.31,.045,.075],[0,.577,0],m.shadow,id);
    box(g,[1.31,.07,.064],[0,.218,0],m.olive,id);
    // The old eight repeated vertical side bars had no identified photographic basis.
    // Link geometry is instanced for mobile rendering performance.
    const linkCount=114; // Same geometry on mobile; historical pitch remains C.
    const treadGeo=new THREE.BoxGeometry(P/linkCount*.91,.048,.298);
    const tread=new THREE.InstancedMesh(treadGeo,m.rubber,linkCount);
    tread.name='Отдельные полиуретановые траки';tread.userData.part=id;
    tread.castShadow=true;tread.receiveShadow=true;g.add(tread);meshes.push(tread);count++;
    const shoeGeo=new THREE.BoxGeometry(P/linkCount*.62,.024,.310);
    const cleats=new THREE.InstancedMesh(shoeGeo,m.tread,linkCount);
    cleats.userData.part=id;cleats.castShadow=true;cleats.receiveShadow=true;g.add(cleats);meshes.push(cleats);count++;
    const a=new THREE.Object3D(),b=new THREE.Object3D();
    for(let i=0;i<linkCount;i++){
      const [x,y,ang]=pathAt(i*P/linkCount);
      a.position.set(x,y,0);a.rotation.set(0,0,ang);a.updateMatrix();tread.setMatrixAt(i,a.matrix);
      const nx=-Math.sin(ang),ny=Math.cos(ang);
      b.position.set(x+nx*.034,y+ny*.034,0);b.rotation.set(0,0,ang);b.updateMatrix();cleats.setMatrixAt(i,b.matrix);
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
    for(const hub of rotatingHubs)hub.group.rotation.z=phaseUnits/hub.radius;
    for(const mod of driveModules){
      for(let i=0;i<mod.linkCount;i++){
        const [x,y,ang]=mod.pathAt((i/mod.linkCount)*mod.P+phaseUnits);
        linkTransform.position.set(x,y,0);
        linkTransform.rotation.set(0,0,ang);
        linkTransform.updateMatrix();mod.tread.setMatrixAt(i,linkTransform.matrix);
        cleatTransform.position.set(x-Math.sin(ang)*.035,y+Math.cos(ang)*.035,0);
        cleatTransform.rotation.set(0,0,ang);
        cleatTransform.updateMatrix();mod.cleats.setMatrixAt(i,cleatTransform.matrix);
      }
      mod.tread.instanceMatrix.needsUpdate=true;
      mod.cleats.instanceMatrix.needsUpdate=true;
    }
  }


  // Only the existence of suspension balance levers is documented.
  // Both visible arrangements are hypotheses; 'bare' shows neither.
  function setSuspensionScheme(scheme){
    const selected=['paired','independent','bare'].includes(scheme)?scheme:'bare';
    for(const pair of suspensionSchemes){
      pair.paired.visible=selected==='paired';
      pair.independent.visible=selected==='independent';
    }
    root.userData.activeSuspensionScheme=selected;
    return selected;
  }
  setSuspensionScheme('bare');
  // WELDED CHASSIS & POWER PACK.
  const body=section('body','Корпус и рама');
  box(body,[1.61,.19,1.05],[0,.57,0],m.frame,'body');
  box(body,[1.58,.045,.99],[0,.677,0],m.satin,'body');
  box(body,[1.50,.06,.71],[.09,.714,0],m.shadow,'body');
  for(const side of [-1,1]){
    box(body,[1.53,.13,.055],[0,.620,side*.535],m.olive,'body');
    beam(body,[-.78,.58,side*.54],[.78,.58,side*.54],.018,m.satin,'body');
    for(let i=0;i<12;i++)bolt(body,[-.69+i*.123,.648,side*.568],'z',m.darkBolt,'body',.012);
    for(let x of [-.58,-.26,.1,.4,.65]){
      box(body,[.12,.11,.012],[x,.56,side*.579],m.frame,'body');
      bolt(body,[x,.56,side*.589],'z',m.satin,'body',.014);
    }
  }
  // Rounded rear cover silhouette is visible in both SKTB photos2 and4.
  // Its function, cross-section and all scene dimensions remain unmeasured.
  const hoodPts=[[.06,.72],[.06,.75]];
  for(let i=0;i<=24;i++){const a=Math.PI-i*Math.PI/24;hoodPts.push([.49+.43*Math.cos(a),.75+.24*Math.sin(a)]);}
  hoodPts.push([.92,.72]);plate(body,hoodPts,.80,-.40,m.shadow,'body');
  // Low deck and service panels forward of the drive enclosure.
  box(body,[.50,.06,.77],[-.41,.76,0],m.panel,'body');
  box(body,[.47,.055,.50],[-.41,.796,0],m.olive,'body');
  for(const x of [-.58,-.25]){
    for(const z of [-.21,.21])bolt(body,[x,.83,z],'y',m.darkBolt,'body',.014);
  }
  // Hidden torsion bars / repeated hood vents omitted: not resolved in source views.
  // Rear cable exit and protected sheave.
  cylinder(body,.072,.072,.14,[.92,.65,-.17],m.satin,'body','x',22);
  ring(body,.082,.012,[.99,.65,-.17],m.frame,'body','x');
  tube(body,[[.94,.65,-.17],[1.02,.62,-.2],[1.19,.57,-.22],[1.32,.52,-.27]],.021,m.cable,'body',32);

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
  boom.scale.set(.81,.81,1); // provisional silhouette fit to full-resolution SKTB photo2
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
  cylinder(boom,.048,.048,.29,[-1.46,.01,0],m.frame,'arm','z',24);
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
  gripper.position.set(-1.06,.68,0);
  cylinder(gripper,.083,.083,.275,[0,0,0],m.frame,'gripper','z',28);
  for(const side of [-1,1]){
    cylinder(gripper,.062,.062,.022,[0,0,side*.144],m.satin,'gripper','z',28);
    bolt(gripper,[0,0,side*.161],'z',m.darkBolt,'gripper',.019);
  }
  const fingerHead=new THREE.Group();
  fingerHead.name='Двупалый сменный схват';fingerHead.userData.part='gripper';
  gripper.add(fingerHead);
  // Local -X is the hanging axis; viewer keeps it vertical at a neutral wrist.
  // B: open frame, central cylindrical member and wide plates. Internal drive C.
  cylinder(fingerHead,.068,.068,.27,[-.22,0,0],m.satin,'gripper','x',24);
  for(const z of [-.09,.09])for(const s of [-1,1]){
    beam(fingerHead,[-.07,s*.085,z],[-.39,s*.085,z],.015,m.frame,'gripper');
    beam(fingerHead,[-.39,s*.085,z],[-.39,-s*.085,z],.018,m.frame,'gripper');
  }
  cylinder(fingerHead,.043,.043,.34,[.12,-.16,.04],m.panel,'gripper','x',22);
  const fingerMechanisms=[];
  for(const side of [-1,1]){
    const finger=new THREE.Group();finger.name='Широкая губка '+side;
    finger.position.set(-.40,side*.035,0);fingerHead.add(finger);
    for(const z of [-.12,.12]){
      beam(finger,[0,0,z],[-.19,side*.18,z],.020,m.frame,'gripper');
      beam(finger,[-.07,-side*.025,z],[-.25,side*.14,z],.016,m.satin,'gripper');
    }
    // Broad side surface; no invented count of edge serrations.
    plate(finger,[[-.18,side*.18],[-.41,side*.18],[-.43,side*.025],[-.23,side*.025]],.31,-.155,m.panel,'gripper');
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
      cylinder(g,.055,.060,.46,[-.30,0,0],m.satin,id,'x',28);
      cylinder(g,.035,.035,.24,[-.62,0,0],m.bright,id,'x',22);
      beam(g,[-.74,0,0],[-.94,0,0],.018,m.frame,id);
      box(g,[.09,.12,.14],[-.09,0,0],m.frame,id);
    }else{
      g.position.set(-.76,-.055,0);
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
  for(const s of [-1,1]){
    const z=s*.69;
    beam(bucket,[1.30,.17,z],[.34,-.09,z],.052,m.frame,'bucket',12);
    beam(bucket,[1.31,.17,z],[.37,.02,z],.023,m.satin,'bucket',12);
    cylinder(bucket,.090,.090,.11,[1.31,.17,z],m.olive,'bucket','z',24);
    cylinder(bucket,.072,.072,.10,[.35,-.09,z],m.bright,'bucket','z',24);
    beam(bucket,[.97,.30,z],[.41,.03,z],.039,m.shadow,'bucket',16);
    beam(bucket,[.79,.23,z],[.43,.04,z],.019,m.satin,'bucket',16);
    for(const t of [.13,.34,.56,.8]){
      const x=1.31-(1.31-.35)*t,y=.17+(-.09-.17)*t;
      bolt(bucket,[x,y,z+s*.055],'z',m.darkBolt,'bucket',.011);
    }
  }
  // Distinct bucket tilt joint (second loader DOF): articulated attachment rotates without rotating support links.
  const bucketScoop=new THREE.Group();
  bucketScoop.name='Ковш: отдельная ось опрокидывания';bucketScoop.userData.part='bucket';
  bucket.add(bucketScoop);
  // Articulated scooping assembly: bottom wear plate, sloping back plate, vertical side cheeks.
  box(bucketScoop,[.72,.045,1.21],[-.09,-.17,0],m.panel,'bucket');
  const back=box(bucketScoop,[.06,.43,1.21],[.23,.005,0],m.panel,'bucket',-.29);
  for(const s of [-1,1]){
    const z=s*.59;
    plate(bucketScoop,[[-.46,-.19],[.28,-.19],[.31,.25],[.12,.37],[-.27,.09]],.04,z-.02,m.frame,'bucket');
    beam(bucketScoop,[-.47,-.14,z],[.29,-.14,z],.021,m.satin,'bucket');
    for(const x of [-.28,.03,.26])bolt(bucketScoop,[x,-.18,z+s*.025],'z',m.darkBolt,'bucket',.014);
  }
  box(bucketScoop,[.82,.026,1.22],[-.15,-.200,0],m.bright,'bucket');
  // Smooth continuous scraper edge: nine separately invented teeth in v14 were
  // not confirmed by the original side photo. The precise shape remains provisional.
  box(bucketScoop,[.18,.024,1.24],[-.50,-.210,0],m.satin,'bucket');
  beam(bucketScoop,[-.58,-.206,-.615],[-.58,-.206,.615],.012,m.bright,'bucket',12);
  for(const z of [-.48,-.24,0,.24,.48]){
    // Broad backing plates only, not tooth tips. Their number is provisional.
    box(bucketScoop,[.07,.022,.042],[-.40,-.176,z],m.frame,'bucket');
    bolt(bucketScoop,[-.40,-.15,z],'y',m.darkBolt,'bucket',.012);
  }
  for(const z of [-.42,-.19,.19,.42]){
    beam(bucketScoop,[.24,.25,z],[.24,-.14,z],.023,m.olive,'bucket');
    beam(bucketScoop,[.28,.25,z],[.03,-.14,z],.013,m.satin,'bucket');
  }
  cylinder(bucketScoop,.07,.07,1.34,[.32,.04,0],m.darkBolt,'bucket','z',22);

  // Place pivot at the leading attachment axis; keep original geometry location at 0°.
  const scoopPivot=new THREE.Vector3(.31,.04,0);
  for(const element of bucketScoop.children)element.position.sub(scoopPivot);
  bucketScoop.position.copy(scoopPivot);
  // Change the loader's lift-axis to the inboard CHASSIS joint.
  // At 0° it keeps the v7 silhouette, but lift rotates around the frame, not around the bucket.
  const originalLoaderBase=bucket.position.clone();
  const loaderPivotLocal=new THREE.Vector3(1.31,.17,0);
  for(const child of bucket.children) child.position.sub(loaderPivotLocal);
  bucket.position.copy(originalLoaderBase).add(loaderPivotLocal);
  const breakerLoader=buildBreaker(bucket,'bucket','loader');
  // Modes are EXCLUSIVE; historical text documents either working location,
  // not simultaneous installation of both breakers.
  function setWorkTool(mode){
    const next=['gripper','breaker-arm','breaker-loader'].includes(mode)?mode:'gripper';
    fingerHead.visible=next==='gripper';
    breakerArm.visible=next==='breaker-arm';
    breakerLoader.visible=next==='breaker-loader';
    root.userData.activeWorkTool=next;
    return next;
  }
  setWorkTool('gripper');
  // Position of pivot in robot local coords ~= [0.28,0.65,0].
  // Source only confirms two DOFs, not these exact joint coordinates.
  // Two distinct television cameras (front drive & manipulator observation).
  const cameras=section('cameras','Цилиндрические корпуса телекамер: положение C');
  function cameraHousing(parent,at,ang){
    const g=new THREE.Group();g.position.set(...at);g.rotation.z=ang;parent.add(g);
    cylinder(g,.11,.13,.38,[0,0,0],m.panel,'cameras','x',32);
    cylinder(g,.095,.095,.018,[-.20,0,0],m.shadow,'cameras','x',32);
    box(g,[.16,.08,.13],[.10,-.14,0],m.frame,'cameras');
    return g;
  }
  const upperCamera=cameraHousing(base,[-.03,1.35,.36],-.27);
  const rearCamera=cameraHousing(base,[.12,1.55,-.27],.6);
  // Both belong to the turntable. No pair of identical chassis-mounted boxes.
  // Cable management with service hatch: the winding drum is an internal reconstruction.
  const cabling=section('cable','Внутренний кабелеукладчик');
  cylinder(cabling,.22,.22,.43,[.48,.71,0],m.shadow,'cable','z',36);
  for(const s of [-1,1]){
    cylinder(cabling,.24,.24,.029,[.48,.71,s*.225],m.satin,'cable','z',36);
    for(let i=0;i<6;i++){
      const a=2*Math.PI*i/6;
      bolt(cabling,[.48+.17*Math.cos(a),.71+.17*Math.sin(a),s*.251],'z',m.darkBolt,'cable',.013);
    }
  }
  for(let i=0;i<14;i++)ring(cabling,.198,.012,[.48,.71,-.18+i*.027],m.cable,'cable','z');
  cylinder(cabling,.05,.05,.75,[.48,.71,0],m.satin,'cable','z',20);
  tube(cabling,[[.74,.66,-.18],[.94,.63,-.21],[1.15,.59,-.23],[1.30,.50,-.30]],.022,m.cable,'cable');
  // Exposed maintenance aperture/cover adjacent to the spool, shown only in service mode.
  const cover=box(cabling,[.51,.030,.48],[.49,1.015,0],m.olive,'cable');
  for(const x of [.27,.72])for(const z of [-.19,.19])bolt(cabling,[x,1.035,z],'y',m.darkBolt,'cable',.012);
  cabling.userData.cover=cover;

  // Coupling: approximate geometry, visibly marked unconfirmed in the interface.
  const dock=section('dock','Полуавтоматический стыковочный узел');
  const liftPosition=[.48,1.13,.01];
  cylinder(dock,.145,.145,.075,liftPosition,m.frame,'dock','y',28);
  for(const s of [-1,1]){
    beam(dock,[.26,.88,s*.22],[.49,1.22,s*.08],.034,m.satin,'dock');
    bolt(dock,[.49,1.20,s*.14],'z',m.darkBolt,'dock',.013);
  }
  cylinder(dock,.08,.08,.17,[.48,1.27,.01],m.satin,'dock','y',28);
  ring(dock,.126,.032,[.48,1.40,.01],m.bright,'dock','y');
  beam(dock,[.355,1.40,.01],[.605,1.40,.01],.024,m.frame,'dock',12);

  // Dosimeter housing and the associated inspection probe are indicative, not a scanned instrument.
  const dose=section('dose','Блок дозиметрии ИМД-21Б');
  box(dose,[.23,.13,.19],[.36,1.05,-.38],m.panel,'dose');
  box(dose,[.18,.025,.14],[.36,1.123,-.38],m.shadow,'dose');
  cylinder(dose,.042,.042,.06,[.36,1.148,-.38],m.satin,'dose','y',22);
  beam(dose,[.34,1.03,-.38],[-.30,1.30,-.35],.017,m.frame,'dose',12);
  cylinder(dose,.039,.039,.19,[-.34,1.30,-.35],m.olive,'dose','x',18);
  tube(dose,[[.38,1.07,-.44],[.15,1.18,-.48],[-.23,1.32,-.42],[-.34,1.30,-.35]],.010,m.cable,'dose',32);

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
    const theta=armPivot.rotation.z;
    const ca=Math.cos(theta),sa=Math.sin(theta);
    const armMountA=new THREE.Vector3(.10,1.04,-.24);
    const x=-.52,y=.42;
    const armMountB=new THREE.Vector3(armPivot.position.x +x*ca-y*sa,
      armPivot.position.y +x*sa+y*ca,-.17);
    setSegment(actuatorArmHousing,armMountA,interpolate(armMountA,armMountB,.68),.048);
    setSegment(actuatorArmScrew,interpolate(armMountA,armMountB,.46),armMountB,.027);

    const beta=bucket.rotation.z,cb=Math.cos(beta),sb=Math.sin(beta);
    for(let i=0;i<2;i++){
      const side=i===0?-1:1;
      const a=new THREE.Vector3(.69,.79,side*.65);
      const relX=-.64,relY=.10;
      const b=new THREE.Vector3(bucket.position.x+relX*cb-relY*sb,
        bucket.position.y+relX*sb+relY*cb,side*.68);
      setSegment(loaderHousings[i].o,a,interpolate(a,b,.66),.035);
      setSegment(loaderScrews[i].o,interpolate(a,b,.45),b,.020);
    }
  }
  updateLinkages();
  // Secondary fasteners, junctions, mechanical guarding, service seams.
  const mechanics=section('mechanics','Крепления и узлы шасси');
  for(const s of [-1,1]){
    const z=s*.53;
    beam(mechanics,[-.61,.67,z],[.54,.69,z],.016,m.satin,'mechanics');
    for(const x of [-.64,-.30,.06,.42,.70]){
      bolt(mechanics,[x,.695,z],'y',m.darkBolt,'mechanics',.012);
      box(mechanics,[.045,.05,.045],[x,.66,z],m.panel,'mechanics');
    }
    tube(mechanics,[[.82,.71,s*.38],[.65,.68,s*.52],[.22,.67,s*.56],[-.35,.68,s*.55]],.010,m.cable,'mechanics',38);
  }
  for(const x of [-.7,-.5,-.3])for(const z of [-.37,.37]){
    box(mechanics,[.06,.03,.09],[x,.737,z],m.frame,'mechanics');
    bolt(mechanics,[x,.764,z],'y',m.satin,'mechanics',.011);
  }
  // Surface highlights: two subtly separate shades for rebuilt welded steel.
  const info={
    tracks:{name:'Гусеничный движитель',status:'К фотографическому профилю добавлена отдельная условная схема балансиров: три пары и одиночная опора на каждом борту. Наличие балансиров подтверждают воспоминания о ремонте 1987 года, но эта компоновка и оси не доказаны архивными чертежами. Контур и число катков — гипотеза.',basis:'СКТБ ПР · архивный снимок; Батанов/Лосицкий «Чернобыльская крыша» · сведения о деформации балансиров'},
    body:{name:'Корпус и рама',status:'Обводы защитного кожуха, листовые панели и крепеж восстановлены визуально. Не все люки и толщины металла документированы.',basis:'СКТБ ПР · архивный профиль'},
    turret:{name:'Поворотная опора',status:'Открытая опорная рама уточнена по снимкам; оси и фланцы условные. Внутренние подшипники и редукторы показаны условно.',basis:'Фото, функциональная реконструкция'},
    arm:{name:'Манипулятор',status:'На стендовом снимке видны продольные тяги, наружные ребристые элементы и боковые пластины у головки. Их пропорции подобраны по фотографии.',basis:'А. Батанов, В. Лосицкий, «Чернобыльская крыша», рис. 7'},
    gripper:{name:'Двупалый захват',status:'Документально подтверждены сменный двупалый захват и вариант отбойного молотка вместо схвата. В модели можно переключать инструмент, но корпус, зубило и места крепления выполнены условно.',basis:'СКТБ ПР · описание модернизации Ч-ХВ-2'},
    bucket:{name:'Фронтальный погрузчик',status:'Удалены девять неподтверждённых зубьев ковша. Смоделирована непрерывная металлическая рабочая кромка и сменный отбойный молоток на погрузчике; точная форма и крепления остаются условными.',basis:'СКТБ ПР · демонстрационный снимок и описание сменного инструмента'},
    cameras:{name:'Телевизионная система',status:'Наличие двух телекамер подтверждено. Их форма и координаты ориентировочные; необходимы дополнительные фотографии.',basis:'СКТБ ПР · два телевизионных канала'},
    cable:{name:'Кабелеукладчик',status:'Полуавтоматическая внутренняя укладка кабеля подтверждена. Барабан и укладка в данном виде визуализированы схематично.',basis:'СКТБ ПР · 200 м кабеля, вставка до 400 м'},
    dock:{name:'Стыковочное устройство',status:'Функция известна, а верхний узел геометрически условен. Нельзя утверждать точное расположение точки подъёма.',basis:'СКТБ ПР · устройство Ч-ХВ-2'},
    dose:{name:'Дозиметрический блок',status:'Дозиметрия входила в рабочий цикл. Геометрия крепления и положение датчика требуют архивной сверки.',basis:'Первичные материалы проекта и СКТБ'},
    mechanics:{name:'Крепёж и коммуникации',status:'Служебная детализация добавлена по инженерным аналогам. Болтовые группы и магистрали требуют подтверждения.',basis:'Реконструкция, не паспортные сборочные чертежи'}
  };

  // v13: survey the *full leading tooth row* in model coordinates rather than
  // a single invented blade point. This is a transparent, deterministic 2D
  // kinematic screening model, NOT a mesh collision engine or historical joint limits.

  // All math below is delegated to ONE canonical engine used by the 2D atlas.
  // Coordinates for physically moving groups are read from the actual model:
  // if a future model edit changes pivots, the assessment updates automatically.
  const groundReferenceY=PROFILE_V15.groundY;
  const bladeProbes=PROFILE_V15.probes.map(p=>({...p}));
  function activePlanarProfile(){
    return {
      ...PROFILE_V15,
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
    version:'v20-research',
    units:'uncalibrated scene units',
    physicalScaleKnown:false,
    trackContour:sourceTrackProfile.map(p=>[...p]),
    wheelXs:researchRoadWheelXs.slice(),
    visibleWheelOuterRadiiScene:researchRoadWheelRadii.slice(),
    terminalWheelOuterRadiusScene:terminalWheelOuterRadius,
    wheelRadiometry:'manual single-photo apparent face scale; NOT factory wheel dimensions',
    wheelY:PROFILE_V15.wheelY,
    bucketLiftPivot:[bucket.position.x,bucket.position.y],
    bucketTiltPivotRelative:[bucketScoop.position.x,bucketScoop.position.y],
    armPivot:[armPivot.position.x,armPivot.position.y],
    armDistalLocal:[-1.06,.68],
    lowerTrackDatum:groundReferenceY,
    bucketProbes:bladeProbes.map(p=>({...p})),
    canonicalModule:'mobot-kinematics-v15.js',
    trueArchivalDimensions:false
  });
  const mechanisms={turntable,arm:armPivot,bucketLift:bucket,bucketTilt:bucketScoop,setWorkTool,updateLinkages,setTrackPhase,
    setSuspensionScheme,estimateBucketClearance,auditBucketPose,sweepBucketEnvelope,sourceProfile,
    gripper,fingers:fingerMechanisms,cameras,cover};
  // Model's nominal dimensions are scene units only. This scale is not equal to verified metres.
  assembleFasteners();
  root.userData.nominalOnly=true;
  root.userData.suspensionProvenance={
    existence:"Balance levers supported by retrospective 1987 repairs in historical article.",
    actualPairing:"UNVERIFIED",
    alternatives:{bare:"No assumed link topology",paired:"Three paired rockers and terminal support (unverified)",
      independent:"One individual lever per visible small wheel (unverified)"},
    defaultView:"bare",
    archivalEvidence:"https://storage.arsenal-otechestva.ru/article/2375-chernobylskaya-krysha",
    use:"Visual research hypotheses; neither alternative is a reconstructed factory suspension."
  };
  root.userData.verificationPolicy="Do not assert reconstructed hinge dimensions, speeds, or assembly topology as historical facts.";
  root.userData.sharedKinematics='mobot-kinematics-v15.js';
  root.userData.bucketEnvelope={
    probeCount:bladeProbes.length,kind:'7 transverse cross-sections of continuous blade edge and underside',
    limits:'sampled demonstrative slider values only, not actual physical limits',
    solver:'rigid planar Z rotations; no real collision calculation'
  };
  root.userData.nominalTrackLength=1.78;
  root.userData.nominalTrackLengthNote='Estimated longest crawler X-span in uncalibrated MODEL coordinates, not the real length.';
  root.userData.fastenerInstances=fastenerInstanceCount;
  root.userData.fastenerLOD='v10 instancing: retain fastener geometry in desktop and mobile profiles';
  root.userData.version='v20-research / full-resolution archival silhouette';
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
  root.userData.geometryBasis='v20: full-resolution SKTB photos2,3,4,9; return track below deck, rounded cover, open upright, revised boom silhouette, wide plate gripper, cylindrical camera housings and slender breaker. Topology B; dimensions/axes C.';
  root.userData.driveType='electromechanical; internal reducer dimensions are speculative';
  root.userData.loaderDegreesOfFreedom=2;
  root.userData.trackLoopMethod='closed Catmull-Rom profile, estimated from photo #2';
  root.userData.roadWheelsPerSide=7;
  root.userData.variantGuard='Never copy MRK-46M (later robot) specification: six road wheels and eight polyurethane elements into the 1987 Mobot CH-HV-2 model.';
  root.userData.roadWheelConfidence='seven visible wheel features B in SKTB 1987 image; apparent face size is estimated from 500px preview; all scene radii, axle coordinates and actual wheel cross-sections remain C';
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