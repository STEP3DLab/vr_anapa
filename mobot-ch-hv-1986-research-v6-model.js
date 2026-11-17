// Derived from research-v5. Coordinate units are arbitrary, NOT millimetres.
// Observations: Ovchinnikov/Batanov/Mingaleev (2019), pp74–75, figures6,9.
// B: visible topology; C: ALL dimensions, hidden parts, axes and motion limits.
export function makeMobot1986(T) {
  const root=new T.Group(); root.name='Мобот-Ч-ХВ 1986 / v6';
  const sections={},objects=[];
  const mat=(color,metalness=.5)=>new T.MeshStandardMaterial({color,metalness,roughness:.53});
  const materials={structure:mat(0xb6beb8),steel:mat(0x505957),dark:mat(0x28312f),tracks:mat(0x303735,.1),hypothesis:mat(0x95846b)};
  function group(name,parent=root,basis='C'){const g=new T.Group();g.name=name;g.userData={basis,geometry:'C',source:'2019 figs6,9'};parent.add(g);sections[name]=g;return g;}
  function mesh(p,geo,m,name){const o=new T.Mesh(geo,m);o.name=name;o.userData.geometry='C';p.add(o);objects.push(o);return o;}
  function box(p,s,at,m,name){const o=mesh(p,new T.BoxGeometry(...s),m,name);o.position.set(...at);return o;}
  function cyl(p,r,h,at,m,name,axis='z'){const o=mesh(p,new T.CylinderGeometry(r,r,h,32),m,name);o.position.set(...at);if(axis==='z')o.rotation.x=Math.PI/2;if(axis==='x')o.rotation.z=Math.PI/2;return o;}
  function beam(p,a,b,w,m,name){const A=new T.Vector3(...a),B=new T.Vector3(...b),v=B.clone().sub(A);const o=mesh(p,new T.BoxGeometry(w,v.length(),w),m,name);o.position.copy(A).add(B).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());return o;}
  function plate(p,points,depth,z,m,name){const shape=new T.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();const o=mesh(p,new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false}),m,name);o.position.z=z;return o;}
  const running=group('Открытая ходовая',root,'B: seven lower circular features in fig6');
  // Fig. 6: longitudinal fractions measured between the two end centres in the
  // unrectified picture. The entire conversion into scene coordinates is C.
  const wheelXs = [1004,1038,1071,1107,1142,1177,1219].map(px => -.89 + (px-975)*1.75/310);
  const wheelRadius = .090, wheelY = .246, shoeThickness = .026, cleatHeight = .010;
  const endWheels = [[-.89,.523,.157],[.86,.536,.144]];
  const wheels = [...wheelXs.map(x => [x,wheelY,wheelRadius]), ...endWheels];
  const circles = [endWheels[0],endWheels[1],wheels[6],wheels[0]].map(([x,y,r]) =>
    ({x,y,r:r+shoeThickness/2}));
  // Clockwise external tangents. Radii include half a shoe so its inner face meets the rim.
  const tangents = circles.map((a,i) => {
    const b = circles[(i+1)%circles.length], dx=b.x-a.x, dy=b.y-a.y;
    const distance=Math.hypot(dx,dy), k=(a.r-b.r)/distance, h=Math.sqrt(1-k*k);
    const nx=(k*dx-h*dy)/distance, ny=(k*dy+h*dx)/distance;
    return {angle:Math.atan2(ny,nx), from:[a.x+a.r*nx,a.y+a.r*ny], to:[b.x+b.r*nx,b.y+b.r*ny]};
  });
  const segments=[];
  for(const [i,edge] of tangents.entries()){
    const [x,y]=edge.from, dx=edge.to[0]-x, dy=edge.to[1]-y;
    const lineLength=Math.hypot(dx,dy);
    segments.push({length:lineLength, at:s=>[x+s*dx/lineLength,y+s*dy/lineLength,Math.atan2(dy,dx)]});
    const j=(i+1)%circles.length, c=circles[j];
    const sweep=(edge.angle-tangents[j].angle+2*Math.PI)%(2*Math.PI);
    segments.push({length:c.r*sweep,at:s=>{
      const a=edge.angle-s/c.r;
      return [c.x+c.r*Math.cos(a),c.y+c.r*Math.sin(a),a-Math.PI/2];
    }});
  }
  const length = segments.reduce((sum,segment)=>sum+segment.length,0);
  function onBelt(s){
    let u=((s%length)+length)%length;
    for(const segment of segments){
      if(u<=segment.length)return segment.at(u);
      u-=segment.length;
    }
    return segments[0].at(0);
  }
  const contour=tangents.map(edge=>edge.from);
  const count=82, pitch=length/count, width=.258, modules=[], rotors=[];
  const dummy=new T.Object3D();
  for(const sign of [-1,1]){
    const g=group('Борт '+sign,running,'B внешний профиль / C подвеска');
    g.position.z=sign*.592;
    box(g,[1.74,.076,.07],[-.01,.514,-sign*.092],materials.steel,'Внутренняя продольная балка');
    for(const [index,[x,y,r]] of wheels.entries()){
      const isEnd=index>=7;
      // Schematic fixed carriers behind the visible wheels, not an inferred bogie system.
      beam(g,[x,y,-sign*.09],[x,.518,-sign*.09],.046,materials.steel,'Условная опора оси');
      cyl(g,.030,.21,[x,y,-sign*.042],materials.steel,'Ось');
      const rotor=new T.Group();rotor.position.set(x,y,0);g.add(rotor);
      cyl(rotor,r,.128,[0,0,0],materials.dark,isEnd?'Поднятое крайнее колесо':'Нижний круговой элемент');
      cyl(rotor,r*.83,.019,[0,0,sign*.072],materials.steel,'Лицевой диск');
      cyl(rotor,r*.27,.025,[0,0,sign*.086],materials.structure,'Ступица');
      // Recess on face indicates rotation; its size and angular phase are C.
      cyl(rotor,r*.11,.005,[r*.52,0,sign*.084],materials.dark,'Условное углубление диска');
      rotors.push({rotor,r});
    }
    const belt=new T.InstancedMesh(new T.BoxGeometry(pitch*.975,shoeThickness,width),materials.tracks,count);
    const cleats=new T.InstancedMesh(new T.BoxGeometry(pitch*.24,cleatHeight,width+.005),materials.steel,count);
    belt.name='Башмаки замкнутой ленты';cleats.name='Поперечные рёбра траков';
    g.add(belt,cleats);objects.push(belt,cleats);modules.push({belt,cleats});
  }
  let lastPhase=NaN;
  function setTrackPhase(phase=0){
    if(phase===lastPhase)return;
    lastPhase=phase;
    for(const {rotor,r} of rotors)rotor.rotation.z=-phase/r;
    for(let i=0;i<count;i++){
      const [x,y,a]=onBelt(i*pitch+phase);
      dummy.rotation.set(0,0,a);dummy.position.set(x,y,0);dummy.updateMatrix();
      for(const m of modules)m.belt.setMatrixAt(i,dummy.matrix);
      const lift=(shoeThickness+cleatHeight)/2;
      dummy.position.set(x-lift*Math.sin(a),y+lift*Math.cos(a),0);dummy.updateMatrix();
      for(const m of modules)m.cleats.setMatrixAt(i,dummy.matrix);
    }
    for(const {belt,cleats} of modules)for(const inst of [belt,cleats]){
      inst.instanceMatrix.needsUpdate=true;
      inst.computeBoundingSphere();inst.computeBoundingBox();
    }
  }
  setTrackPhase();
  const body=group('Рама и округлый кожух',root,'B contours in fig6');
  box(body,[1.96,.045,1.01],[-.015,.747,0],materials.steel,'Настил платформы');
  for(const z of [-.438,.438]){
    box(body,[1.86,.215,.060],[-.01,.639,z],materials.dark,'Продольная стенка платформы');
  }
  for(const x of [-.80,-.12,.72]){
    box(body,[.082,.18,1.07],[x,.59,0],materials.steel,'Поперечная балка к бортам');
  }
  box(body,[.48,.033,.59],[.29,.779,0],materials.structure,'Плита под поворотной опорой');
  const hoodBase=.800, hoodX=-.524, hoodHalf=.456;
  const hoodOutline=[[-.980,hoodBase]];
  for(let i=0;i<=32;i++){
    const a=Math.PI-i*Math.PI/32;
    hoodOutline.push([hoodX+hoodHalf*Math.cos(a),.838+.281*Math.sin(a)]);
  }
  hoodOutline.push([-.068,hoodBase]);
  plate(body,hoodOutline,.755,-.3775,materials.dark,'Арочный кожух');
  for(const sign of [-1,1]){
    const z=sign*.385;
    plate(body,hoodOutline,.015,z-.0075,materials.steel,'Торцевой лист кожуха');
    box(body,[.94,.040,.051],[hoodX,.785,sign*.371],materials.steel,'Опорный отбортованный край');
    box(body,[.064,.045,.012],[hoodX-.075,.890,sign*.398],materials.structure,'Наружная накладка, форма C');
    beam(body,[hoodX-.075,.89,sign*.408],[hoodX-.075,.936,sign*.408],.012,materials.steel,'Скоба накладки');
  }

  const turntable=group('Поворотная опора',root,'B appearance; yaw inferred from figs6,9');turntable.position.set(.29,.83,0);
  cyl(turntable,.28,.09,[0,0,0],materials.steel,'Поворотное основание','y');
  const mast=group('Высокая решётчатая стойка',turntable,'B');
  box(mast,[.55,.048,.50],[0,.061,0],materials.steel,'Плита пятки стойки');
  // B: open heel and narrowing boom across both views. Subdivision, bracing and pins C.
  const levels=[.081,.365,.660,.960];
  function mastCorner(level,side,end){
    const t=(level-levels[0])/(levels.at(-1)-levels[0]);
    return [end*(.218-.060*t)+.026*t,level,side*(.201-.026*t)];
  }
  for(const side of [-1,1])for(const end of [-1,1]){
    beam(mast,mastCorner(levels[0],side,end),mastCorner(levels.at(-1),side,end),.036,materials.structure,'Пояс стойки');
  }
  for(const [i,y] of levels.entries()){
    for(const side of [-1,1]){
      beam(mast,mastCorner(y,side,-1),mastCorner(y,side,1),.026,materials.steel,'Пояс поперечной рамы');
      if(i+1<levels.length){
        const d=i%2?1:-1;
        beam(mast,mastCorner(y,side,d),mastCorner(levels[i+1],side,-d),.024,materials.structure,'Раскос боковой грани стойки');
      }
    }
    for(const end of [-1,1]){
      beam(mast,mastCorner(y,-1,end),mastCorner(y,1,end),.028,materials.steel,'Связь между боковинами стойки');
      if(i+1<levels.length)beam(mast,mastCorner(y,-1,end),mastCorner(levels[i+1],1,end),.021,materials.structure,'Раскос торцевой грани');
    }
  }
  for(const z of [-.175,.175])cyl(mast,.061,.075,[-.132,.960,z],materials.dark,'Корпус опоры оси стрелы');
  const boom=group('Решётчатая стрела',turntable,'B пространственные боковины / C раскосы и оси');
  boom.position.set(-.132,.960,0);
  const tipX=-1.49, tipY=.26;
  function boomNode(i,upper,side){
    const t=i/4, y0=upper?0:-.51, y1=upper?tipY+.043:tipY-.043;
    return [tipX*t,y0+(y1-y0)*t,side*(.237-.133*t)];
  }
  for(const side of [-1,1]){
    for(const upper of [false,true])beam(boom,boomNode(0,upper,side),boomNode(4,upper,side),.039,materials.structure,'Продольный пояс стрелы');
    for(let i=0;i<=4;i++){
      beam(boom,boomNode(i,true,side),boomNode(i,false,side),.028,materials.structure,'Стойка панели');
      if(i<4)beam(boom,boomNode(i,i%2===0,side),boomNode(i+1,i%2!==0,side),.025,materials.structure,'Диагональ панели');
    }
    cyl(boom,.054,.036,[0,0,side*.237],materials.steel,'Проушина пяты');
    cyl(boom,.063,.032,[tipX,tipY,side*.104],materials.steel,'Проушина оголовка');
  }
  for(let i=0;i<=4;i++)for(const upper of [true,false]){
    // The root stays open around the support; an outboard frame closes each bay.
    if(i>0||upper)beam(boom,boomNode(i,upper,-1),boomNode(i,upper,1),.030,materials.steel,'Поперечная связь панели');
    if(i>0 && i<4 && upper)beam(boom,boomNode(i,true,-1),boomNode(i+1,true,1),.018,materials.steel,'Диагональ верхней плоскости');
  }
  cyl(boom,.038,.527,[0,0,0],materials.structure,'Палец наклона стрелы');

  const grab=group('Подвес и грейфер',boom,'A function / B outline / C mechanism');grab.position.set(-1.49,.26,0);
  cyl(grab,.035,.268,[0,0,0],materials.structure,'Палец подвеса');
  for(const z of [-.062,.062]){
    plate(grab,[[-.054,.028],[.054,.028],[.047,-.135],[-.047,-.135]],.019,z-.0095,materials.steel,'Щека серьги');
  }
  cyl(grab,.082,.128,[0,-.157,0],materials.structure,'Корпус подвеса','y');
  cyl(grab,.055,.093,[0,-.251,0],materials.steel,'Шейка подвеса','y');
  const head=group('Открытая рамка грейфера',grab,'B контур, C устройство осей');
  box(head,[.193,.030,.246],[0,-.286,0],materials.dark,'Верхняя траверса');
  const pivotX=.143, pivotY=-.575, halfWidth=.170;
  for(const side of [-1,1]){
    for(const end of [-1,1]){
      beam(head,[end*.080,-.286,side*.109],[end*pivotX,pivotY,side*.187],.030,materials.dark,'Наклонная стойка рамки');
      cyl(head,.044,.026,[end*pivotX,pivotY,side*.187],materials.steel,'Неподвижная проушина челюсти');
    }
    beam(head,[-pivotX,pivotY,side*.187],[pivotX,pivotY,side*.187],.032,materials.dark,'Балка между осями');
  }
  const jaws=[];
  for(const sign of [-1,1]){
    const jaw=group('Ковшевая челюсть '+sign,grab,'B ковшеобразная форма / C геометрия и шарнир');
    jaw.position.set(sign*pivotX,pivotY,0);
    // One folded outer skin carries both end plates. Opposed lips meet at closure.
    const skin=[[.050,-.040],[.133,-.113],[.136,-.216],[.104,-.268],[.030,-.307],[-pivotX,-.329]];
    const profile=[[0,.016],...skin].map(([x,y])=>[sign*x,y]);
    for(const z of [-halfWidth,halfWidth-.012])plate(jaw,profile,.012,z,materials.dark,'Боковая щека челюсти');
    for(let i=1;i<skin.length;i++){
      const [a,b]=skin.slice(i-1,i+1), dx=sign*(b[0]-a[0]),dy=b[1]-a[1];
      const s=box(jaw,[Math.hypot(dx,dy),.012,halfWidth*2],[sign*(a[0]+b[0])/2,(a[1]+b[1])/2,0],materials.steel,'Лист ковшеобразной челюсти');
      s.rotation.z=Math.atan2(dy,dx);
    }
    cyl(jaw,.028,.413,[0,0,0],materials.structure,'Палец челюсти');
    jaws.push({jaw,sign});
  }

  const loader=group('Фронтальный погрузчик',root,'A две степени подвижности / B внешний рычаг / C связи');
  loader.position.set(-.105,.543,0);
  const armZ=.765, bucketPin=[1.40,-.08];
  for(const sign of [-1,1]){
    const z=sign*armZ;
    cyl(body,.071,.323,[loader.position.x,loader.position.y,sign*.625],materials.dark,'Бортовая опора подъёма');
    cyl(loader,.046,.082,[0,0,z],materials.structure,'Палец рычага подъёма');
    const outline=[[-.060,.045],[.055,.067],[.39,-.005],[1.12,-.080],[1.394,-.038],[1.443,-.063],[1.435,-.119],[1.10,-.141],[.35,-.067],[-.044,-.050]];
    plate(loader,outline,.046,z-.023,materials.dark,'Наружный подъёмный рычаг');
    plate(loader,[[.15,.008],[.25,.105],[.35,.104],[.41,-.019]],.025,z-.0125,materials.steel,'Верхняя проушина тяги');
  }
  const scoop=group('Открытый ковш',loader,'B открытый листовой ковш / C оси и лист');
  scoop.position.set(...bucketPin,0);
  const cheek=[[-.091,.228],[.117,.206],[.364,.055],[.535,-.230],[.553,-.267],[-.060,-.267],[-.117,-.206]];
  for(const z of [-.745,.726])plate(scoop,cheek,.019,z,materials.dark,'Боковина ковша');
  // Cross section through the back and bottom; adjacent sheets share the bend line.
  const folded=[[-.091,.228],[-.117,-.206],[-.060,-.267],[.553,-.267]];
  for(let i=1;i<folded.length;i++){
    const [a,b]=folded.slice(i-1,i+1),dx=b[0]-a[0],dy=b[1]-a[1];
    const s=box(scoop,[Math.hypot(dx,dy),.018,1.49],[(a[0]+b[0])/2,(a[1]+b[1])/2,0],materials.steel,'Гнутый лист ковша');
    s.rotation.z=Math.atan2(dy,dx);
  }
  box(scoop,[.061,.019,1.50],[.532,-.269,0],materials.structure,'Режущая кромка');
  cyl(scoop,.039,1.59,[0,0,0],materials.steel,'Ось ковша');
  const tiltLinks=[];
  for(const sign of [-1,1]){
    const z=sign*armZ;
    plate(scoop,[[-.063,-.012],[.040,-.028],[.061,.153],[.025,.197],[-.036,.159]],.026,z-.013,materials.dark,'Плечо наклона ковша');
    const anchor=new T.Vector3(.300,.080,z),eye=new T.Vector3(.026,.155,z);
    cyl(loader,.029,.065,anchor.toArray(),materials.structure,'Палец начала тяги');
    cyl(scoop,.029,.065,eye.toArray(),materials.structure,'Палец наклона');
    const rod=mesh(loader,new T.CylinderGeometry(.013,.013,1,12),materials.structure,'Тяга наклона, схема C');
    const sleeve=mesh(loader,new T.CylinderGeometry(.024,.024,.31,16),materials.steel,'Наружная часть тяги, схема C');
    tiltLinks.push({anchor,eye,rod,sleeve});
  }
  const up=new T.Vector3(0,1,0);
  function updateTiltLinks(){
    scoop.updateMatrix();
    for(const {anchor,eye,rod,sleeve} of tiltLinks){
      const end=eye.clone().applyMatrix4(scoop.matrix),delta=end.clone().sub(anchor);
      const span=delta.length(),axis=delta.normalize();
      rod.position.copy(anchor).lerp(end,.5);rod.scale.y=span;
      rod.quaternion.setFromUnitVectors(up,axis);
      sleeve.position.copy(anchor).addScaledVector(axis,.155);sleeve.quaternion.copy(rod.quaternion);
    }
  }

  // Cylindrical camera-like housings visible. The two bright front discs may be lamps.
  const upper=group('Верхний цилиндрический корпус камеры',turntable,'B housing / A two cameras overall');upper.position.set(.12,1.17,0);upper.rotation.z=-.35;
  cyl(upper,.125,.40,[0,0,0],materials.structure,'Цилиндрический корпус','x');
  cyl(upper,.105,.017,[.21,0,0],materials.dark,'Торец корпуса','x');
  beam(turntable,[.1,.97,0],[.12,1.15,0],.045,materials.steel,'Опора верхней камеры');
  const front=group('Оборудование на конце у ковша',root,'B silhouettes; exact function C');
  box(front,[.36,.040,.70],[.756,.790,0],materials.steel,'Площадка переднего оборудования');
  for(const x of [.672,.823]){
    box(front,[.035,.065,.082],[x,.835,0],materials.steel,'Седло цилиндрического корпуса');
  }
  cyl(front,.085,.30,[.773,.931,0],materials.structure,'Низкий цилиндрический корпус','x');
  cyl(front,.068,.009,[.927,.931,0],materials.dark,'Торцевая вставка','x');
  for(const z of [-.238,.238]){
    beam(front,[.807,.803,z],[.878,.884,z],.027,materials.steel,'Кронштейн круглого элемента');
    cyl(front,.085,.054,[.889,.913,z],materials.dark,'Обод переднего элемента','x');
    cyl(front,.071,.009,[.920,.913,z],materials.structure,'Светлый круглый диск, назначение C','x');
  }
  const cablePath=new T.CatmullRomCurve3([[-.96,.68,.08],[-1.06,.50,.10],[-1.32,.19,.18]].map(p=>new T.Vector3(...p)));
  mesh(body,new T.TubeGeometry(cablePath,24,.012,6,false),materials.dark,'Кабель: видимый вывод, трасса C');
  const defaults={yaw:0,boom:0,loader:0,tip:0,grab:0,track:0};let state={...defaults};
  function setPose(p={}){
    state={...state,...p};for(const [k,v] of Object.entries(state))if(!Number.isFinite(v))throw Error('Nonfinite pose '+k);
    const rad=T.MathUtils.degToRad;turntable.rotation.y=rad(state.yaw);boom.rotation.z=rad(state.boom);grab.rotation.z=-boom.rotation.z;
    loader.rotation.z=rad(state.loader);scoop.rotation.z=rad(state.tip);updateTiltLinks();
    for(const {jaw,sign} of jaws)jaw.rotation.z=sign*rad(state.grab);
    setTrackPhase(state.track*.015);root.updateMatrixWorld(true);return {...state};
  }
  function auditPose(){root.updateMatrixWorld(true);const probe=new T.Vector3(.49,-.283,0);scoop.localToWorld(probe);const g=new T.Vector3(0,-.90,0);grab.localToWorld(g);return {bucketClearance:probe.y-.12,grappleClearance:g.y-.12,fullCollisionTest:false};}
  setPose();root.userData={version:'1986-v6',basis:'B external topology from identified figs6,9',allDimensions:'C',units:'arbitrary scene units',historicallyCalibrated:false,roadWheelsPerSide:7};
  return {root,sections,objects,materials,setPose,auditPose,defaults,mechanisms:{turntable,boom,grab,loader,scoop},sourceProfile:()=>({wheelXs,wheelRadius,wheelY,endWheels,shoeThickness,cleatHeight,width,pitch,length,onBelt,contour,dimensionsVerified:false})};
}
