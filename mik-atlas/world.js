import * as THREE from './vendor/three.module.min.js';

export const EXHIBITS = [
  {title:'Монумент эпохи',category:'01 / ИСТОРИЯ И ИСКУССТВО',description:'Центральный экспонат — цифровая копия бюста Владимира Ильича Ленина по реальному 3D-скану. Реальная скульптурная пластика, характерные черты лица и следы поверхности сохранены в модели; бронзовый материал разработан для экспозиции.',fact:'3D-скан: fractalnoise. Адаптация для VR: оптимизация геометрии до 60 000 треугольников, гладкие нормали и бронзовый материал. Лицензия CC BY-NC-SA 4.0.',position:[0,0,-9],view:[0,0,-3.6],target:[0,3.7,-9],label:['В. И. ЛЕНИН','МОНУМЕНТ ЭПОХИ','3D-скан: fractalnoise · CC BY-NC-SA 4.0']},
  {title:'За пределы Земли',category:'02 / КОСМОС',description:'4 октября 1957 года на орбиту был выведен первый искусственный спутник Земли. Простая сфера с четырьмя антеннами стала одним из самых узнаваемых образов инженерии XX века.',fact:'Посмотрите на форму: лаконичная оболочка, четыре антенны и задача, которая изменила представление о возможном. Здесь показан учебный макет.',position:[-5.2,0,-1.5],view:[-5.2,0,3.5],target:[-5.2,2.6,-1.5],label:['СПУТНИК-1','4 ОКТЯБРЯ 1957','Первый искусственный спутник Земли']},
  {title:'Сила невидимого',category:'03 / НАУКА И ЭНЕРГИЯ',description:'Орбиты, ядро и свет — художественный образ атома. В советской визуальной культуре он стал знаком научного прогресса и надежды на новые источники энергии.',fact:'Это символическая модель: электронные орбитали реального атома не похожи на планетные траектории. Вопрос для обсуждения: где заканчивается образ и начинается физика?',position:[5.2,0,-1.5],view:[5.2,0,3.5],target:[5.2,2.35,-1.5],label:['ЭНЕРГИЯ АТОМА','СИМВОЛ НАУЧНОГО ПРОГРЕССА','Художественная, не физическая модель']},
  {title:'Человек и машина',category:'04 / ИНЖЕНЕРИЯ И ФАНТАЗИЯ',description:'Робот-смотритель МИК — вымышленный экспонат в духе советской научной фантастики. Эмалевый корпус, металлические шарниры и световой визор соединяют индустриальную форму и дружелюбный характер.',fact:'Задание инженеру: придумайте полезную функцию робота в колледже. Какие датчики, приводы и алгоритмы ему понадобятся?',position:[-5.2,0,6.8],view:[-5.2,0,11.7],target:[-5.2,1.9,6.8],label:['СМОТРИТЕЛЬ МИК','ЧЕЛОВЕК И МАШИНА','Концепт робота-помощника']}
];

export const HALL_PILLARS=[-8.8,8.8].flatMap(x=>[-11,-5,1,7,12].map(z=>[x,z]));

export function isWalkable(x,z){
  if(Math.abs(x)>8.5||z < -12.3||z>12.3)return false;
  if(HALL_PILLARS.some(([px,pz])=>Math.hypot(x-px,z-pz)<.94))return false;
  return !EXHIBITS.some((e,i)=>Math.hypot(x-e.position[0],z-e.position[2])<(i===0?2.1:1.65));
}

export function buildWorld(){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#868779');scene.fog=new THREE.Fog('#868779',27,60);
  const root=new THREE.Group();scene.add(root);
  const interactive=[],animated=[],colliders=[];
  const mat=(color,metalness=0,roughness=.7)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
  const stone=mat('#ddd4bb',.08,.48), dark=mat('#5c6657',.32,.34), red=mat('#a67963',.28,.36), bronze=mat('#8c713d',.7,.38),bronzeLight=mat('#b29251',.65,.36), chrome=mat('#adbaad',.85,.23), enamel=mat('#d8d4b6',.35,.36),black=mat('#1c2926',.45,.36);
  const glow=new THREE.MeshBasicMaterial({color:'#ffdda1'}), redGlow=new THREE.MeshBasicMaterial({color:'#d7683d'});
  const geo={sphere:new THREE.SphereGeometry(1,24,16),box:new THREE.BoxGeometry(1,1,1),cyl:new THREE.CylinderGeometry(1,1,1,32),cone:new THREE.ConeGeometry(1,1,32)};
  function mesh(g,m,p=[0,0,0],s=[1,1,1],parent=root){const o=new THREE.Mesh(g,m);o.position.set(...p);o.scale.set(...s);parent.add(o);return o;}
  const box=(p,s,m=stone,parent=root)=>mesh(geo.box,m,p,s,parent);
  const sphere=(p,s,m=bronze,parent=root)=>mesh(geo.sphere,m,p,s,parent);
  const cylinder=(p,r,h,m=bronze,parent=root)=>mesh(geo.cyl,m,p,[r,h,r],parent);
  function rod(a,b,r,m,parent=root){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),d=end.clone().sub(start);const o=cylinder(start.clone().add(end).multiplyScalar(.5).toArray(),r,d.length(),m,parent);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return o;}
  function torus(radius,tube,p,m,parent=root,rx=0,ry=0,rz=0){const o=mesh(new THREE.TorusGeometry(radius,tube,8,64),m,p,[1,1,1],parent);o.rotation.set(rx,ry,rz);return o;}
  function textPlate(lines,w,h,p,parent=root,opts={}){
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=Math.round(1024*h/w);const c=canvas.getContext('2d');
    c.fillStyle=opts.bg||'#ece0c3';c.fillRect(0,0,canvas.width,canvas.height);c.strokeStyle=opts.border||'#9e5b38';c.lineWidth=5;c.strokeRect(16,16,canvas.width-32,canvas.height-32);c.textAlign='center';c.textBaseline='middle';
    lines.forEach((l,i)=>{c.font=`${i===0?'700':'400'} ${Math.min(i===0?65:29,canvas.height*(i===0?.36:.2))}px Arial`;c.fillStyle=opts.color||(i===0?'#9b3d28':'#4b493b');c.fillText(l,512,canvas.height*(lines.length===1?.5:lines.length===2?.35+i*.36:.3+i*.23),950);});
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const o=mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}),p,[1,1,1],parent);return o;
  }
  const hemisphere=new THREE.HemisphereLight('#ffedc8','#424c41',1.25);scene.add(hemisphere);
  const sun=new THREE.DirectionalLight('#ffdfab',3.2);sun.position.set(5,13,7);scene.add(sun);
  const fill=new THREE.DirectionalLight('#a0c3bd',1.2);fill.position.set(-9,6,-3);scene.add(fill);
  // Instanced stone floor, brass inlays and the red central runner.
  const matrix=new THREE.Matrix4();
  [stone,dark].forEach((material,parity)=>{
    const tiles=[];for(let x=-5;x<5;x++)for(let z=-7;z<7;z++)if((x+z+20)%2===parity)tiles.push([x*2+1,-.12,z*2+1]);
    const im=new THREE.InstancedMesh(geo.box,material,tiles.length);tiles.forEach((p,i)=>{matrix.compose(new THREE.Vector3(...p),new THREE.Quaternion(),new THREE.Vector3(1.985,.24,1.985));im.setMatrixAt(i,matrix);});root.add(im);
  });
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,28),new THREE.MeshBasicMaterial({visible:false}));floor.rotation.x=-Math.PI/2;floor.position.y=.008;root.add(floor);
  box([0,.016,1],[2.4,.03,24],red);for(const x of [-1.25,1.25])box([x,.035,1],[.055,.02,24],bronzeLight);
  box([0,4,-14],[21,8,.5],stone);box([-10.3,4,0],[.5,8,28],stone);box([10.3,4,0],[.5,8,28],stone);box([0,4,14],[21,8,.5],stone);
  for(const x of [-10,10]){box([x,.55,0],[.14,1.1,28],dark);box([x,1.15,0],[.18,.08,28],bronze);}
  box([0,.55,-13.7],[20,1.1,.2],dark);
  // Tall ribbed columns and a glazed, luminous roof.
  for(const [x,z] of HALL_PILLARS){
    cylinder([x,.2,z],.68,.4,dark);cylinder([x,3.75,z],.43,6.7,stone);cylinder([x,7.2,z],.65,.25,bronze);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;rod([x+Math.cos(a)*.43,.5,z+Math.sin(a)*.43],[x+Math.cos(a)*.43,7,z+Math.sin(a)*.43],.025,bronze);}
    const l=box([x,3.5,z+.48],[.12,1.9,.08],glow);l.name='architectural-light';
  }
  for(let z=-12;z<=12;z+=4){box([0,8,z],[20,.15,.13],bronze);box([0,7.85,z],[18,.08,.035],glow);}
  for(let x=-8;x<=8;x+=4)box([x,8,0],[.12,.15,28],bronze);
  box([0,8.15,0],[20,.05,28],new THREE.MeshBasicMaterial({color:'#c9d7c2',transparent:true,opacity:.26,side:THREE.DoubleSide}));
  // Central ring, banners and friezes.
  torus(3.65,.18,[0,4,-13.35],bronze);torus(3.46,.035,[0,4,-13.28],glow);
  for(const x of [-6.2,6.2]){box([x,4.3,-13.35],[1.6,6.4,.07],red);box([x,7.56,-13.25],[1.9,.09,.09],bronze);textPlate(['МИК','НАУКА','ИСКУССТВО'],1.28,2.3,[x,4.6,-13.25],root,{bg:'#873b2c',border:'#bd9b58',color:'#ecd9af'});}
  textPlate(['АТЛАС БУДУЩЕГО','ИСТОРИЯ ИДЕЙ · ТЕХНОЛОГИИ · ЧЕЛОВЕК'],7.4,1.0,[0,7.2,-13.02]);
  textPlate(['АТЛАС БУДУЩЕГО','КОЛЛЕКЦИЯ МИК'],5,1.2,[0,3.2,13.62]).rotation.y=Math.PI;
  const chandelier=new THREE.Group();chandelier.position.set(0,6.45,-2);root.add(chandelier);
  for(let i=0;i<3;i++)torus(1.4,.035,[0,0,0],bronzeLight,chandelier,i*.8,i*.7);
  sphere([0,0,0],[.23,.23,.23],glow,chandelier);rod([0,6.5,-2],[0,8,-2],.035,bronze);
  // Wall displays with abstract constructive reliefs.
  for(const side of [-1])for(const z of [-8,-2,4,10]){
    const g=new THREE.Group();g.position.set(side*9.96,3.8,z);g.rotation.y=-side*Math.PI/2;root.add(g);
    box([0,0,0],[3.2,3.6,.12],dark,g);torus(1.1,.055,[0,0,.12],bronzeLight,g);rod([-1,-1,.15],[1,1,.15],.045,redGlow,g);sphere([0,0,.2],[.3,.3,.1],bronzeLight,g);
    box([0,-1.95,0],[3.45,.08,.4],bronze,g);
  }
  const groups=EXHIBITS.map((e,i)=>{
    const g=new THREE.Group();g.position.set(...e.position);g.userData.exhibit=i;root.add(g);
    cylinder([0,.12,0],i===0?2:1.45,.24,dark,g);cylinder([0,.26,0],i===0?1.82:1.3,.06,bronze,g);
    if(i===0){box([0,1.15,0],[1.65,1.75,1.45],red,g);box([0,2.08,0],[1.87,.16,1.62],bronze,g);}
    else{cylinder([0,.65,0],1,.73,stone,g);cylinder([0,1.05,0],1.05,.07,bronze,g);}
    const plate=textPlate([e.label[0],String(i+1).padStart(2,'0')+' / КОЛЛЕКЦИЯ МИК'],1.8,.48,[0,.77,1.38],g);plate.rotation.x=-.13;
    interactive.push(g);colliders.push({x:e.position[0],z:e.position[2],r:i===0?2.1:1.65});return g;
  });
  // The central portrait is loaded from the attributed scan in sculpture.js.
  // Sputnik: reflective sphere with a visible equator and four antennae.
  const sputnik=new THREE.Group();sputnik.position.set(0,3.03,0);sputnik.rotation.z=.2;groups[1].add(sputnik);
  sphere([0,0,0],[.59,.59,.59],chrome,sputnik);torus(.592,.012,[0,0,0],bronze,sputnik,Math.PI/2);
  for(const [x,z] of [[-.33,-.28],[.33,-.28],[-.33,.28],[.33,.28]])rod([x,-.42,z],[x*2.9,-1.75,z*3.5],.018,chrome,sputnik);
  rod([0,3.64,0],[0,6.4,0],.01,bronze,groups[1]);animated.push({group:sputnik,kind:'sputnik'});
  // Symbolic orbital sculpture.
  const atom=new THREE.Group();atom.position.y=2.65;groups[2].add(atom);
  for(let i=0;i<3;i++){const orbit=new THREE.Group();orbit.rotation.set(i*Math.PI/3,.55,0);atom.add(orbit);torus(1.1,.024,[0,0,0],bronzeLight,orbit);const electron=sphere([1.1,0,0],[.075,.075,.075],glow,orbit);animated.push({group:orbit,kind:'orbit',speed:.2+i*.08});}
  sphere([0,0,0],[.27,.27,.27],new THREE.MeshStandardMaterial({color:'#ba542b',metalness:.4,roughness:.32,emissive:'#7f290e',emissiveIntensity:.28}),atom);for(const p of [[.2,.07,.04],[-.12,.18,.07],[0,-.17,.16]])sphere(p,[.16,.16,.16],bronzeLight,atom);
  rod([0,1.08,0],[0,2.4,0],.055,bronze,groups[2]);
  // Friendly mechanical attendant, original design.
  const robot=new THREE.Group();robot.position.y=1.38;robot.scale.setScalar(.78);groups[3].add(robot);
  cylinder([0,.27,0],.44,.28,chrome,robot);sphere([0,.93,0],[.58,.75,.35],enamel,robot);cylinder([0,1.65,0],.12,.18,chrome,robot);
  sphere([0,2.05,0],[.48,.45,.4],enamel,robot);box([0,2.06,.36],[.7,.16,.12],black,robot);
  for(const x of [-.18,.18])box([x,2.07,.429],[.12,.035,.03],glow,robot);
  box([0,1.86,.39],[.22,.025,.028],bronze,robot);textPlate(['МИК'],.45,.24,[0,1.15,.347],robot);
  for(const side of [-1,1]){
    sphere([side*.62,1.3,0],[.16,.16,.16],chrome,robot);rod([side*.65,1.23,0],[side*.8,.76,.03],.11,enamel,robot);sphere([side*.8,.73,.03],[.13,.13,.13],bronze,robot);
    rod([side*.8,.7,.03],[side*.79,.37,.15],.095,chrome,robot);sphere([side*.79,.27,.15],[.13,.15,.13],enamel,robot);
    cylinder([side*.26,.02,0],.13,.4,chrome,robot);sphere([side*.26,-.2,.12],[.22,.15,.3],dark,robot);
  }
  animated.push({group:robot,kind:'robot'});
  // Museum pedestals: concentric brass steps, fluted stone and compact spot housings.
  groups.forEach((g,i)=>{
    const radius=i===0?1.83:1.32;
    torus(radius,.025,[0,.3,0],bronzeLight,g,Math.PI/2);
    for(let k=0;k<18;k++){const a=k*Math.PI/9;const r=i===0?1.81:1.28;rod([Math.cos(a)*r,.08,Math.sin(a)*r],[Math.cos(a)*r,.24,Math.sin(a)*r],.012,bronzeLight,g);}
    for(const side of [-1,1]){cylinder([side*1.24,.43,.9],.085,.12,black,g);const lamp=mesh(new THREE.CircleGeometry(.062,16),glow,[side*1.24,.496,.9],[1,1,1],g);lamp.rotation.x=-Math.PI/2;}
  });
  // Recesses, stepped cornices and architraves bring a monumental scale.
  for(const y of [7.45,7.7]){box([-9.92,y,0],[.35,.13,28],bronze);box([9.92,y,0],[.35,.13,28],bronze);box([0,y,-13.64],[20,.13,.35],bronze);}
  for(const x of [-3.4,3.4]){rod([x,.18,-12.1],[x,6.8,-12.1],.065,bronzeLight);cylinder([x,.28,-12.1],.32,.16,dark);}
  // Constructivist sculptural reliefs: industry and flight, set into the side walls.
  for(const side of [-1,1]){
    const relief=new THREE.Group();relief.position.set(side*9.72,3.8,7);relief.rotation.y=-side*Math.PI/2;root.add(relief);
    box([0,0,-.03],[3.3,3.9,.13],red,relief);
    const gear=torus(.85,.12,[0,-.35,.18],bronzeLight,relief);
    for(let i=0;i<12;i++){const a=i*Math.PI/6;const tooth=box([Math.cos(a)*.94,Math.sin(a)*.94-.35,.18],[.29,.19,.22],bronzeLight,relief);tooth.rotation.z=a;}
    if(side<0){rod([-.7,-1.15,.3],[.8,1.18,.3],.07,bronzeLight,relief);box([.52,.99,.33],[1.15,.27,.24],bronzeLight,relief).rotation.z=-.55;}
    else {const rocket=mesh(geo.cone,bronzeLight,[.25,.68,.36],[.22,.75,.12],relief);rocket.rotation.z=-.45;for(let i=0;i<3;i++)rod([-.15+i*.12,-.1,.26],[-.6+i*.12,-1.25,.26],.025,bronzeLight,relief);}
  }
  // Sputnik assembly details: equatorial bolts and antenna sleeves.
  for(let i=0;i<16;i++){const a=i*Math.PI/8;sphere([Math.cos(a)*.585,0,Math.sin(a)*.585],[.017,.017,.017],bronze,sputnik);}
  for(const [x,z] of [[-.33,-.28],[.33,-.28],[-.33,.28],[.33,.28]])rod([x,-.42,z],[x*1.35,-.62,z*1.4],.038,bronze,sputnik);
  // A mechanical, not cartoon, finish for the original caretaker.
  for(let i=0;i<5;i++)box([0,.86-i*.065,.336],[.35,.018,.025],black,robot);
  for(const side of [-1,1]){torus(.16,.028,[side*.62,1.3,0],bronzeLight,robot,0,Math.PI/2);for(let i=0;i<3;i++)rod([side*.79+(i-1)*.058,.23,.22],[side*.79+(i-1)*.058,.06,.24],.025,chrome,robot);}
  // Floor destination medallions are visual wayfinding; teleport also works on free floor.
  EXHIBITS.forEach((e,i)=>{const p=[e.view[0],.05,e.view[2]];torus(.34,.017,p,bronzeLight,root,Math.PI/2);const plate=textPlate([String(i+1).padStart(2,'0')],.38,.22,[p[0],.06,p[2]],root);plate.rotation.x=-Math.PI/2;});
  scene.updateMatrixWorld(true);
  return {scene,interactive,animated,floor,colliders,groups,models:[null,sputnik,atom,robot],sun,fill,hemisphere,root,materials:{glow,redGlow,stone,dark,red,bronze,bronzeLight,chrome,enamel}};
}
