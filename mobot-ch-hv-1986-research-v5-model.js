// Derived from research-v4. Coordinate units are arbitrary, NOT millimetres.
// Observations: Ovchinnikov/Batanov/Mingaleev (2019), pp74–75, figures6,9.
// B: visible topology; C: ALL dimensions, hidden parts, axes and motion limits.
export function makeMobot1986(T) {
  const root=new T.Group(); root.name='Мобот-Ч-ХВ 1986 / v5';
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
  const wheelXs=[-.65,-.44,-.23,-.02,.19,.40,.61],wheelRadius=.092;
  // Seven features seen in fig6; symmetric far side and evenly spaced scene axles are C.
  const contour=[[-.83,.71],[.0,.71],[.79,.69],[.95,.57],[.96,.45],[.76,.22],[.61,.145],[-.65,.145],[-.84,.25],[-1.0,.46],[-.99,.59]];
  const modules=[];
  for(const sign of [-1,1]){
    const g=group('Борт '+sign,running,'B exterior / C axles');g.position.z=sign*.59;
    for(const x of wheelXs){
      cyl(g,wheelRadius,.12,[x,.26,0],materials.dark,'Нижний каток');
      cyl(g,.067,.018,[x,.26,sign*.071],materials.steel,'Видимый диск');
      cyl(g,.026,.025,[x,.26,sign*.085],materials.structure,'Ступица');
    }
    for(const [x,y,r] of [[-.84,.52,.145],[.81,.51,.13]]){
      cyl(g,r,.12,[x,y,0],materials.dark,'Поднятое крайнее колесо');
      cyl(g,r*.79,.025,[x,y,sign*.072],materials.steel,'Диск крайнего колеса');
    }
    box(g,[1.55,.055,.065],[0,.63,0],materials.steel,'Открытая верхняя бортовая балка');
    // No invented rocker pairing. Interior support geometry remains unresolved.
    const path=new T.CatmullRomCurve3(contour.map(([x,y])=>new T.Vector3(x,y,0)),true,'centripetal');
    path.arcLengthDivisions=400;const length=path.getLength(),count=94;
    const belt=new T.InstancedMesh(new T.BoxGeometry(length/count*.92,.038,.275),materials.tracks,count);
    belt.name='Отдельные траки: шаг условный';g.add(belt);objects.push(belt);
    const cleats=new T.InstancedMesh(new T.BoxGeometry(length/count*.35,.018,.282),materials.steel,count);
    cleats.name='Поперечные рёбра: профиль условный';g.add(cleats);objects.push(cleats);
    modules.push({path,length,count,belt,cleats});
  }
  const dummy=new T.Object3D();
  function setTrackPhase(phase=0){for(const m of modules){for(let i=0;i<m.count;i++){
    const t=((i/m.count+phase/m.length)%1+1)%1,p=m.path.getPointAt(t),d=m.path.getTangentAt(t),a=Math.atan2(d.y,d.x);
    dummy.position.copy(p);dummy.rotation.set(0,0,a);dummy.updateMatrix();m.belt.setMatrixAt(i,dummy.matrix);
    // Clockwise contour: left normal points OUTWARD.
    dummy.position.set(p.x-Math.sin(a)*.026,p.y+Math.cos(a)*.026,0);dummy.updateMatrix();m.cleats.setMatrixAt(i,dummy.matrix);
  }m.belt.instanceMatrix.needsUpdate=true;m.cleats.instanceMatrix.needsUpdate=true;}}
  setTrackPhase();
  const body=group('Рама и округлый кожух',root,'B contours in fig6');
  box(body,[1.83,.095,1.04],[0,.745,0],materials.steel,'Несущая платформа');
  box(body,[1.67,.16,.88],[0,.60,0],materials.dark,'Центральная рама');
  const hood=[[-.98,.80],[-.98,.86]];
  for(let i=0;i<=20;i++){const a=Math.PI-i*Math.PI/20;hood.push([-.53+.45*Math.cos(a),.86+.27*Math.sin(a)]);}
  hood.push([-.08,.80]);plate(body,hood,.83,-.415,materials.dark,'Округлый задний кожух, внешняя оболочка');
  // Visible shape B; interpreting internals as a cable reel would be C, so not shown.
  const turntable=group('Поворотная опора',root,'B appearance; yaw inferred from figs6,9');turntable.position.set(.29,.83,0);
  cyl(turntable,.28,.09,[0,0,0],materials.steel,'Поворотное основание','y');
  const mast=group('Высокая решётчатая стойка',turntable,'B');
  for(const z of [-.21,.21]){
    for(const x of [-.17,.17])beam(mast,[x,.06,z],[x,.99,z],.042,materials.structure,'Продольный элемент стойки');
    for(let i=0;i<3;i++){
      const y=.08+i*.30;
      beam(mast,[-.17,y,z],[.17,y+.30,z],.027,materials.structure,'Диагональ стойки');
      beam(mast,[-.17,y,z],[.17,y,z],.034,materials.steel,'Поперечина стойки');
    }
    beam(mast,[-.17,.98,z],[.17,.98,z],.045,materials.steel,'Верхняя площадка');
  }
  for(const y of [.08,.98])for(const x of [-.17,.17])beam(mast,[x,y,-.21],[x,y,.21],.037,materials.structure,'Поперечная связь стойки');
  const boom=group('Решётчатая стрела',turntable,'B topology');boom.position.set(-.12,.96,0);
  // Two tapering truss cheeks, not a solid telescopic beam. Section sizes are C.
  const top=[[0,.01],[-1.49,.26]],bottom=[[.09,-.59],[-1.49,.26]],zs=[-.22,.22];
  const lerp=(p,t)=>[p[0][0]+t*(p[1][0]-p[0][0]),p[0][1]+t*(p[1][1]-p[0][1])];
  for(const z of zs){
    beam(boom,[...top[0],z],[...top[1],z],.039,materials.structure,'Верхний пояс фермы');
    beam(boom,[...bottom[0],z],[...bottom[1],z],.039,materials.structure,'Нижний пояс фермы');
    for(let i=0;i<4;i++){
      const a=lerp(top,i/4),b=lerp(bottom,i/4),c=lerp(bottom,(i+1)/4);
      beam(boom,[...a,z],[...b,z],.027,materials.structure,'Стойка фермы');
      beam(boom,[...a,z],[...c,z],.025,materials.structure,'Диагональ фермы');
    }
  }
  for(const t of [0,.5,1]){const a=lerp(top,t);beam(boom,[...a,-.22],[...a,.22],.032,materials.steel,'Поперечная связь стрелы');}
  cyl(boom,.075,.51,[0,0,0],materials.steel,'Условная ось наклона');
  const grab=group('Подвес и грейфер',boom,'A function / B outline / C mechanism');grab.position.set(-1.49,.26,0);
  cyl(grab,.068,.45,[0,0,0],materials.steel,'Поперечный шарнир');
  cyl(grab,.075,.24,[0,-.15,0],materials.structure,'Вертикальный промежуточный узел','y');
  const head=group('Открытая рамка грейфера',grab,'B');
  for(const z of [-.17,.17]){
    for(const s of [-1,1])beam(head,[s*.09,-.28,z*.75],[s*.23,-.60,z],.028,materials.dark,'Наклонная стойка подвеса');
    beam(head,[-.09,-.28,z*.75],[.09,-.28,z*.75],.034,materials.dark,'Верх рамы');
    beam(head,[-.23,-.60,z],[.23,-.60,z],.028,materials.dark,'Низ рамы');
  }
  const jaws=[];
  for(const sign of [-1,1]){
    const jaw=group('Ковшевая челюсть '+sign,grab,'B bucket-like outline / C hinges');jaw.position.set(sign*.13,-.56,0);
    for(const z of [-.17,.153])plate(jaw,[[0,0],[sign*.14,-.10],[sign*.11,-.31],[-sign*.13,-.34],[-sign*.11,-.29],[sign*.08,-.26],[sign*.10,-.12]],.017,z,materials.dark,'Боковина челюсти');
    box(jaw,[.24,.024,.34],[-sign*.01,-.32,0],materials.steel,'Днище челюсти');
    box(jaw,[.025,.20,.34],[sign*.12,-.20,0],materials.dark,'Наружная стенка');
    cyl(jaw,.034,.40,[0,0,0],materials.structure,'Условная ось створки');jaws.push({jaw,sign});
  }
  const loader=group('Фронтальный погрузчик',root,'A function / B side arms / C axes');loader.position.set(-.10,.54,0);
  for(const z of [-.765,.765]){
    beam(loader,[0,0,z],[1.40,-.08,z],.048,materials.steel,'Наружный подъёмный рычаг');
    beam(loader,[.12,.15,z],[1.39,.02,z],.023,materials.structure,'Продольная тяга: C');
    cyl(loader,.068,.10,[0,0,z],materials.steel,'Опора погрузчика');
  }
  const scoop=group('Открытый ковш',loader,'B exterior / C sheet shape');scoop.position.set(1.40,-.08,0);
  box(scoop,[.59,.025,1.36],[.21,-.26,0],materials.steel,'Днище ковша');
  const back=box(scoop,[.032,.48,1.36],[-.08,-.02,0],materials.dark,'Наклонная задняя стенка');back.rotation.z=-.15;
  for(const z of [-.69,.67])plate(scoop,[[-.12,-.27],[.52,-.27],[.28,.06],[-.10,.24]],.02,z,materials.dark,'Трапециевидная боковина ковша');
  box(scoop,[.075,.025,1.43],[.49,-.27,0],materials.structure,'Сплошная кромка без вымышленных зубьев');
  cyl(scoop,.045,1.58,[0,0,0],materials.steel,'Ось ковша');
  // Cylindrical camera-like housings visible. The two bright front discs may be lamps.
  const upper=group('Верхний цилиндрический корпус камеры',turntable,'B housing / A two cameras overall');upper.position.set(.12,1.17,0);upper.rotation.z=-.35;
  cyl(upper,.125,.40,[0,0,0],materials.structure,'Цилиндрический корпус','x');
  cyl(upper,.105,.017,[.21,0,0],materials.dark,'Торец корпуса','x');
  beam(turntable,[.1,.97,0],[.12,1.15,0],.045,materials.steel,'Опора верхней камеры');
  const front=group('Оборудование на конце у ковша',root,'B silhouettes; exact function C');
  cyl(front,.085,.30,[.78,.94,0],materials.structure,'Низкий цилиндрический корпус','x');
  for(const z of [-.24,.24])cyl(front,.082,.035,[.91,.91,z],materials.structure,'Круглый фронтальный элемент, назначение не установлено','x');
  box(front,[.30,.055,.68],[.75,.82,0],materials.steel,'Площадка оборудования');
  const cablePath=new T.CatmullRomCurve3([[-.96,.68,.08],[-1.06,.50,.10],[-1.32,.19,.18]].map(p=>new T.Vector3(...p)));
  mesh(body,new T.TubeGeometry(cablePath,24,.012,6,false),materials.dark,'Кабель: видимый вывод, трасса C');
  const defaults={yaw:0,boom:0,loader:0,tip:0,grab:0,track:0};let state={...defaults};
  function setPose(p={}){
    state={...state,...p};for(const [k,v] of Object.entries(state))if(!Number.isFinite(v))throw Error('Nonfinite pose '+k);
    const rad=T.MathUtils.degToRad;turntable.rotation.y=rad(state.yaw);boom.rotation.z=rad(state.boom);grab.rotation.z=-boom.rotation.z;
    loader.rotation.z=rad(state.loader);scoop.rotation.z=rad(state.tip);
    for(const {jaw,sign} of jaws)jaw.rotation.z=sign*rad(state.grab);
    setTrackPhase(state.track*.015);root.updateMatrixWorld(true);return {...state};
  }
  function auditPose(){root.updateMatrixWorld(true);const probe=new T.Vector3(.49,-.283,0);scoop.localToWorld(probe);const g=new T.Vector3(0,-.90,0);grab.localToWorld(g);return {bucketClearance:probe.y-.12,grappleClearance:g.y-.12,fullCollisionTest:false};}
  setPose();root.userData={version:'1986-v5',basis:'B external topology from identified figs6,9',allDimensions:'C',units:'arbitrary scene units',historicallyCalibrated:false,roadWheelsPerSide:7};
  return {root,sections,objects,materials,setPose,auditPose,defaults,mechanisms:{turntable,boom,grab,loader,scoop},sourceProfile:()=>({wheelXs,wheelRadius,wheelY:.26,contour,dimensionsVerified:false})};
}
