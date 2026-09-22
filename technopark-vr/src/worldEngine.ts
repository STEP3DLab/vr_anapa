import * as T from 'three';
import { driveRobot, shotHits, falling } from './gameLogic';
import { createCargoScene } from './cargoScene';
import {batchStatic} from './staticBatch';
import { createArt } from './art';
import { createAudio } from './audio';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
type Mode = 'hub' | 'robot' | 'drones' | 'cargo';
export function createExperience(host: HTMLElement, hooks: {
    status: (s: string) => void;
    scene: (s: string) => void;
    presentation?: (v: boolean) => void;
    paused?: (v:boolean)=>void;
    xr?: (v:boolean)=>void;
    support?: (v:boolean)=>void;
    error?: (message:string)=>void;
    action?: (label:string)=>void;
    hint?: (text:string)=>void;
    phase?: (phase:string)=>void;
    diagnostics?: (data:{fps:number;calls:number;triangles:number;geometries:number;textures:number;xr:boolean;scene:string})=>void;
}) {
    const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', stencil: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local-floor');
    renderer.xr.setFramebufferScaleFactor(1);
    renderer.xr.setFoveation(.65);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    host.appendChild(renderer.domElement);
    const scene = new T.Scene();
    scene.background = new T.Color('#071722');
    scene.fog = new T.FogExp2('#071722', .016);
    const camera = new T.PerspectiveCamera(65, host.clientWidth / host.clientHeight, .05, 150), rig = new T.Group();
    rig.add(camera);
    scene.add(rig);
    scene.add(new T.HemisphereLight(0xb9ecff, 0x273140, 3));
    const sun = new T.DirectionalLight(0xffcc9b, 3);
    sun.position.set(5, 15, 8);
    scene.add(sun);
    const pmrem = new T.PMREMGenerator(renderer), room = new RoomEnvironment(), environment = pmrem.fromScene(room, .04);
    scene.environment = environment.texture;
    room.dispose();
    pmrem.dispose();
    const audioFX = createAudio();
    const cargo = createCargoScene(message => { notify(message); sound(440); });
    const worlds = { hub: new T.Group(), robot: new T.Group(), drones: new T.Group(), cargo: cargo.root };
    Object.values(worlds).forEach(g => scene.add(g));
    const materials: T.Material[] = [], geometries: T.BufferGeometry[] = [], textures: T.Texture[] = [];
    function mat(color: T.ColorRepresentation, metal = .3, glow = false) { const m = new T.MeshStandardMaterial({ color, metalness: metal, roughness: .4, emissive: glow ? color : 0, emissiveIntensity: glow ? 2 : 0 }); materials.push(m); return m; }
    const navy = mat('#142d39'), steel = mat('#98aab7', .8), black = mat('#080f17'), cyan = mat('#52ffe0', .2, true), orange = mat('#ff8b3d', .2, true), lime = mat('#bfe879', .15, true), red = mat('#fa263e'), white = mat('#d9faff');
    function mesh(g: T.Group, geo: T.BufferGeometry, m: T.Material, x = 0, y = 0, z = 0) { geometries.push(geo); const o = new T.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; }
    const box = (g: T.Group, m: T.Material, x: number, y: number, z: number, w: number, h: number, d: number) => mesh(g, new T.BoxGeometry(w, h, d), m, x, y, z);
    const cyl = (g: T.Group, m: T.Material, x: number, y: number, z: number, r: number, h: number, n = 32) => mesh(g, new T.CylinderGeometry(r, r, h, n), m, x, y, z);
    function label(g:T.Group,txt:string,x:number,y:number,z:number,w=3,h=.55,color='#e2fff6',rows=1){
        const c=document.createElement('canvas');c.width=Math.min(2048,Math.max(512,Math.round(w*240)));c.height=Math.max(96,Math.round(c.width*h/w));
        const ctx=c.getContext('2d')!,tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.generateMipmaps=false;tex.minFilter=T.LinearFilter;textures.push(tex);
        const m=new T.MeshBasicMaterial({map:tex,side:T.DoubleSide,toneMapped:false});materials.push(m);
        const o=mesh(g,new T.PlaneGeometry(w,h),m,x,y,z);let previousText='';
        function write(text:string){
            if(text===previousText)return;previousText=text;
            let font=Math.floor(c.height*.66/rows),lines:string[]=[];
            const wrap=()=>{lines=[];for(const paragraph of text.split('\n')){let line='';for(const word of paragraph.split(' ')){const test=line?line+' '+word:word;if(ctx.measureText(test).width>c.width*.92&&line){lines.push(line);line=word;}else line=test;}lines.push(line);}};
            do{ctx.font='600 '+font+'px Arial';wrap();if(lines.length<=rows)break;font--;}while(font>c.height*.32/rows);
            ctx.fillStyle='#081b25';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle=color;ctx.fillRect(0,0,c.width,3);
            ctx.textAlign='center';ctx.textBaseline='middle';const lineHeight=c.height/Math.max(rows,lines.length);
            lines.forEach((line,i)=>ctx.fillText(line,c.width/2,c.height/2+(i-(lines.length-1)/2)*lineHeight));tex.needsUpdate=true;
        }
        write(txt);return {o,write};
    }
    function ground(g: T.Group, size = 40) { box(g, navy, 0, -.16, -8, size, .3, size); if (g === worlds.hub)
        return; const grid = new T.GridHelper(size, size / 2, 0x287477, 0x173b48); grid.position.set(0, .004, -8); g.add(grid); geometries.push(grid.geometry); materials.push(grid.material as T.Material); }
    for (const g of [worlds.hub, worlds.robot, worlds.drones])
        ground(g);
    const art = createArt();
    worlds.hub.add(art.root);
    const hub = worlds.hub;
    for (let i = 0; i < 7; i++) {
        let z = 4 - i * 4;
        for (const x of [-10, 10]) {
            box(hub, steel, x, 3.3, z, .18, 6.6, .18);
            box(hub, cyan, x, 3.3, z + .12, .035, 5.8, .025);
        }
        box(hub, steel, 0, 6.6, z, 20, .15, .2);
        box(hub, cyan, 0, 6.5, z, 17, .025, .055);
    }
    // An open glass pavilion surrounded by a stylized technology campus.
    const glass = new T.MeshPhysicalMaterial({ color: 0x4dbac9, transparent: true, opacity: .1, roughness: .15, side: T.DoubleSide, depthWrite: false });
    materials.push(glass);
    box(hub, glass, -10, 3, -8, .04, 6, 26);
    box(hub, glass, 10, 3, -8, .04, 6, 26);
    for (let i = 0; i < 24; i++) {
        const side = i % 2 ? 1 : -1, x = side * (14 + (i % 4) * 3), z = 8 - Math.floor(i / 2) * 4, h = 3 + (i * 7 % 11);
        box(hub, navy, x, h / 2, z, 2.5, h, 2.7);
        for (let j = 1; j < h; j += 2)
            box(hub, i % 3 ? cyan : orange, x, j, z + 1.36, 1.8, .05, .025);
    }
    for (let i = 0; i < 14; i++) {
        let x = i % 2 ? 11.5 : -11.5, z = 5 - Math.floor(i / 2) * 4;
        cyl(hub, steel, x, .5, z, .09, 1);
        mesh(hub, new T.IcosahedronGeometry(.85, 0), mat(i % 2 ? '#347e78' : '#32755d'), x, 1.5, z);
    }
    label(hub, 'Т Е Х Н О П А Р К  /  Р Г С У', 0, 6.1, -17, 9, .65);
    label(hub, 'Я Д Р О  /  КИНЕТИЧЕСКАЯ СКУЛЬПТУРА', 0, .7, -8.6, 3.6, .32);
    // Curated concentric floor inlays and an architectural sun beyond the pavilion.
    for (const r of [3.2, 3.35, 6, 9]) {
        const line = mesh(hub, new T.TorusGeometry(r, .018, 5, 96), r < 4 ? cyan : steel, 0, .02, -11.5);
        line.rotation.x = Math.PI / 2;
    }
    const sunset = new T.MeshBasicMaterial({ color: 0xffbd8b });
    materials.push(sunset);
    mesh(hub, new T.SphereGeometry(6, 32, 16), sunset, 0, 10, -65);
    for (let i = 0; i < 9; i++)
        box(hub, navy, -32 + i * 8, 1 + (i % 3), -43, 6, 2 + (i % 3) * 2, 8);
    for (const x of [-7.3, 7.3]) {
        box(hub, black, x, .35, -1, 2, .7, 3.6);
        box(hub, steel, x, .73, -1, 2.1, .08, 3.6);
    }
    const actions: T.Object3D[] = [], portals: T.Mesh[] = [], portalGroups:T.Group[] = [], xrOnlyHub:T.Object3D[]=[];
    let portalFocus=-1;
    const xrOnly=(o:T.Object3D)=>{xrOnlyHub.push(o);return o;};
    function action(o: T.Object3D, f: () => void) { o.userData.action = f; actions.push(o); }
    for (const [x, z] of [[0, -3], [-5, -3], [5, -3], [0, 3], [5, -9]]) {
        const pad = cyl(hub, cyan, x, .035, z, .4, .025, 32);
        action(pad, () => { const head = (renderer.xr.isPresenting ? renderer.xr.getCamera() : camera).getWorldPosition(new T.Vector3()); rig.position.x += x - head.x; rig.position.z += z - head.z; audioFX.event('portal'); });
    }
    xrOnly(label(hub, 'ЛЕВЫЙ СТИК: ДВИЖЕНИЕ / ПРАВЫЙ: ПОВОРОТ 30°', 0, 1.2, -1.5, 4, .32).o);
    xrOnly(label(hub, 'ЛУЧ + КУРОК: ПОРТАЛ ИЛИ ТЕЛЕПОРТ НА ПОЛУ', 0, .8, -1.5, 4, .32).o);
    function portal(x: number, mode: Mode, title: string, num: string, m: T.Material, z = -6, yaw = 0) { const p = new T.Group(); p.position.set(x, 0, z); p.rotation.y = yaw; p.userData.baseY=0;p.userData.mode=mode;hub.add(p);portalGroups.push(p); cyl(p, black, 0, .13, 0, 2, .25);const floorRing=mesh(p,new T.TorusGeometry(1.76,.025,5,48),m,0,.27,0);floorRing.rotation.x=Math.PI/2;for(const lane of [-.62,.62])box(p,m,lane,.025,2.1,.045,.018,2.6); for (const a of [-1, 1])
        box(p, m, a * 1.55, 1.9, 0, .12, 3.8, .25); box(p, m, 0, 3.8, 0, 3.2, .12, .25); const pm = new T.ShaderMaterial({ transparent: true, side: T.DoubleSide, uniforms: { time: { value: 0 }, color: { value: new T.Color(mode === 'robot' ? '#27ebca' : mode === 'cargo' ? '#bbdf79' : '#ff883a') } }, vertexShader: 'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'varying vec2 v;uniform float time;uniform vec3 color;void main(){vec2 p=v-.5;float r=length(p*vec2(1.,.75));float a=atan(p.y,p.x);float wave=pow(.5+.5*sin(r*42.-time*2.+a*3.),3.);wave+=.3*pow(.5+.5*sin(a*5.+time*.5+r*22.),8.);float edge=pow(abs(v.x-.5)*2.,5.);gl_FragColor=vec4(color*(.25+wave*.4+edge),.48+edge*.3);}' }); materials.push(pm); const surface = mesh(p, new T.PlaneGeometry(3, 3.6), pm, 0, 1.95, 0); portals.push(surface); action(surface, () => go(mode)); label(p, title, 0, 4.3, .05, 3.7, .55); label(p, num, 0, .65, .08, 2.7, .38); }
    portal(-5.2, 'robot', 'КРАСНЫЙ ТРЕУГОЛЬНИК', '01 / РОБОТ-АРЕНА', cyan);
    portal(5.2, 'drones', 'ОХОТА НА ДРОНОВ', '02 / ВОЗДУШНЫЙ ТИР', orange);
    portal(8, 'cargo', 'ПОЛИГОН ЛОСИНКА', '03 / ГРУЗОВАЯ МИССИЯ', lime, -11, -Math.PI / 2);
    const arena = worlds.robot;
    box(arena, navy, 0, .06, -7, 13, .12, 13);
    for (const x of [-6.7, 6.7]) {
        box(arena, steel, x, .4, -7, .15, .8, 13.5);
        box(arena, cyan, x, .85, -7, .06, .05, 13.5);
    }
    for (const z of [-.3, -13.7]) {
        box(arena, steel, 0, .4, z, 13.5, .8, .15);
        box(arena, cyan, 0, .85, z, 13.5, .05, .06);
    }
    label(arena, 'ДЕЗИНТЕГРАТОР / КРАСНЫЙ ТРЕУГОЛЬНИК', 0, 4, -14, 9, .6);
    const robot = new T.Group();
    robot.name = 'player-robot';
    arena.add(robot);
    robot.scale.setScalar(1.12);
    cyl(robot, black, 0, .23, 0, .73, .3);
    cyl(robot, steel, 0, .42, 0, .67, .15);
    const ring = new T.Group();
    robot.add(ring);
    const rm = mesh(ring, new T.TorusGeometry(.76, .105, 6, 32), steel, 0, .32, 0);
    rm.rotation.x = Math.PI / 2;
    const spinGlow=mesh(ring,new T.TorusGeometry(.79,.028,6,40),cyan,0,.34,0);spinGlow.rotation.x=Math.PI/2;spinGlow.visible=false;spinGlow.name='spinner-glow';
    for (const x of [-.85, .85])
        box(ring, steel, x, .32, 0, .3, .2, .28);
    for (const x of [-.38, .38])
        box(robot, black, x, .51, 0, .2, .035, .38);
    const triangle = new T.Shape();
    triangle.moveTo(0, -.43);
    triangle.lineTo(.39, .3);
    triangle.lineTo(-.39, .3);
    triangle.closePath();
    const mark = mesh(robot, new T.ShapeGeometry(triangle), red, 0, .507, 0);
    mark.rotation.x = -Math.PI / 2;
    box(robot, black, 0, .515, -.06, .065, .02, .25);
    box(robot, black, 0, .516, .14, .065, .02, .06);
    for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6;
        cyl(robot, black, Math.sin(a) * .59, .514, Math.cos(a) * .59, .025, .025, 6);
    }
    const rival = new T.Group();
    rival.name = 'arena-rival';
    arena.add(rival);
    box(rival, navy, 0, .3, 0, 1.4, .5, 1.2);
    box(rival, orange, 0, .54, 0, .9, .06, .7);
    box(rival, steel, 0, .25, -.75, 1.6, .25, .35);
    for (const x of [-.8, .8])
        for (const z of [-.4, .4]) {
            const wheel = cyl(rival, black, x, .23, z, .23, .14, 12);
            wheel.rotation.z = Math.PI / 2;
        }
    const rivalName = label(arena, 'СОПЕРНИК / БУЛЬДОЗЕР', 0, 1.3, -11, 2.8, .3);
    rival.visible = false;
    rivalName.o.visible = false;
    const cells: T.Mesh[] = [], blocks: T.Mesh[] = [];
    for (let i = 0; i < 5; i++)
        cells.push(mesh(arena, new T.OctahedronGeometry(.34), cyan, [-4, 3, -3, 4, 0][i], .62, [-3, -4, -7, -10, -12][i]));
    for (let i = 0; i < 6; i++)
        blocks.push(box(arena, orange, [-4, 1, 4, -2, 2, -4][i], .42, [-5, -6, -8, -10, -12, -12][i], .7, .7, .7));
    // Physical objective board remains readable in VR without opening the side console.
    const arenaCellLamps:T.Mesh[]=[] ,arenaBlockLamps:T.Mesh[]=[];
    for(let i=0;i<5;i++){const lamp=cyl(arena,cyan,-2.4+i*1.2,2.35,-13.45,.11,.08,10);lamp.rotation.x=Math.PI/2;lamp.name='arena-cell-lamp';lamp.userData.dynamic=true;arenaCellLamps.push(lamp);}
    for(let i=0;i<6;i++){const lamp=box(arena,orange,-3+i*1.2,1.95,-13.43,.48,.13,.05);lamp.name='arena-block-lamp';lamp.userData.dynamic=true;arenaBlockLamps.push(lamp);}
    label(arena,'5 ЭНЕРГОЯЧЕЕК  /  6 БЛОКОВ',0,2.75,-13.42,5.4,.34);
    cells.forEach(c => c.name = 'energy-cell');
    blocks.forEach(b => b.name = 'target-block');
    for (let i = 0; i < 3; i++) {
        const stripe = box(arena, steel, 0, .14, -3 - i * 4, 11, .012, .03);
    }
    const range = worlds.drones;
    label(range, 'AERIAL LAB / ДРОН-ТРЕНИРОВКА', 0, 6, -25, 11, 1);
    for (let i = 0; i < 5; i++) {
        box(range, steel, 0, .04, -6 - i * 5, 22, .05, .08);
        for (const x of [-11, 11]) {
            box(range, navy, x, 4, -6 - i * 5, .3, 8, .3);
            box(range, orange, x, 4, -6 - i * 5 + .17, .08, 6, .03);
        }
    }
    for (let i = 0; i < 3; i++) {
        const hoop = mesh(range, new T.TorusGeometry(6 + i, .035, 6, 64), i % 2 ? cyan : orange, 0, 4, -12 - i * 7);
    }
    type Drone = {
        g: T.Group;
        hit: T.Mesh;
        phase: number;
        dead: boolean;
        velocity: number;
        respawn: number;
        hp: number;
        maxHP: number;
        kind: string;
        value: number;
    };
    const drones: Drone[] = [];
    for (let i = 0; i < 9; i++) {
        const g = new T.Group();
        g.name = i === 8 ? 'boss-drone' : 'game-drone';
        range.add(g);
        const hit = box(g, steel, 0, 0, 0, .7, .28, .5);
        box(g, orange, 0, 0, .28, .4, .08, .06);
        box(g, black, 0, 0, 0, 1.6, .08, .1);
        box(g, black, 0, 0, 0, .1, .08, 1.5);
        for (const x of [-.65, .65])
            for (const z of [-.6, .6]) {
                cyl(g, black, x, .06, z, .31, .06, 12);
                const prop = box(g, cyan, x, .1, z, .49, .012, .04);
                prop.name = 'propeller';
            }
        const boss = i === 8, armored = i % 3 === 2;
        const maxHP = boss ? 6 : armored ? 2 : 1;
        g.scale.setScalar(boss ? 2.4 : armored ? 1.35 : i % 3 === 1 ? 1.05 : 1.2);
        if (armored || boss) {
            box(g, navy, 0, .2, 0, .85, .16, .6);
            box(g, boss ? red : orange, 0, .3, 0, .65, .04, .4);
        }
        drones.push({ g, hit, phase: i * 1.31, dead: false, velocity: 0, respawn: 0, hp: maxHP, maxHP, kind: boss ? 'ФЛАГМАН' : armored ? 'БРОНИРОВАННЫЙ' : i % 3 === 1 ? 'СКОРОСТНОЙ' : 'РАЗВЕДЧИК', value: boss ? 600 : armored ? 180 : i % 3 === 1 ? 150 : 100 });
    }
    const trainingHalo=mesh(range,new T.TorusGeometry(.92,.028,6,48),orange,0,2.6,-7);trainingHalo.userData.dynamic=true;trainingHalo.visible=false;
    const ammoLamps:T.Mesh[]=[];for(let i=0;i<6;i++){const lamp=box(range,cyan,-2.25+i*.9,1.05,-4.25,.62,.12,.06);lamp.name='ammo-lamp';lamp.userData.dynamic=true;ammoLamps.push(lamp);}
    const bossBeacon=mesh(range,new T.TorusGeometry(2.3,.055,7,64),red,0,4.2,-23.7);bossBeacon.name='boss-beacon';bossBeacon.userData.dynamic=true;bossBeacon.visible=false;
    const bossCaption=label(range,'ФЛАГМАН · 6 ПОПАДАНИЙ',0,6.9,-23.65,5.2,.42,'#ff9b9b',1);bossCaption.o.visible=false;
    const exhibits: T.Group[] = [];
    for (const [x, model, title, description, destination] of [[-6, robot, 'КРАСНЫЙ ТРЕУГОЛЬНИК', 'КОЛЬЦЕВОЙ СПИННЕР / КОМАНДА ДЕЗИНТЕГРАТОР', 'robot'], [6, drones[0].g, 'ЛАБОРАТОРИЯ БПЛА', 'ИНТЕРАКТИВНАЯ МОДЕЛЬ / ВОЗДУШНЫЙ ТИР', 'drones']] as const) {
        cyl(hub, black, x, .5, -.5, 1.35, 1, 48);
        cyl(hub, steel, x, 1.02, -.5, 1.36, .06, 48);
        const rim = mesh(hub, new T.TorusGeometry(1.3, .02, 6, 64), cyan, x, 1.06, -.5);
        rim.rotation.x = Math.PI / 2;
        const copy = model.clone(true);
        copy.traverse(o => o.name = 'exhibit');
        copy.position.set(x, 1.2, -.5);
        hub.add(copy);
        exhibits.push(copy);
        xrOnly(label(hub, title, x, 2.6, -.55, 2.8, .35).o);
        xrOnly(label(hub, description, x, .7, .88, 2.4, .28).o);
        const enter = label(hub, 'ОТКРЫТЬ ИСПЫТАНИЕ →', x, .3, .88, 2.4, .28);xrOnly(enter.o);
        action(enter.o, () => go(destination));
    }
    function gun() { const g = new T.Group(); box(g, black, 0, 0, -.25, .12, .14, .5); box(g, steel, 0, .04, -.6, .07, .07, .35); box(g, orange, 0, -.03, -.36, .14, .05, .13); const muzzle = mesh(g, new T.IcosahedronGeometry(.12, 0), orange, 0, .04, -.83); muzzle.name = 'muzzle-flash'; muzzle.visible = false; box(g, cyan, 0, .085, -.5, .02, .012, .28); const handle = box(g, navy, 0, -.13, -.06, .09, .22, .12); handle.rotation.x = -.3; return g; }
    const desktopGun = gun();
    camera.add(desktopGun);
    desktopGun.position.set(.3, -.24, -.25);
    const flash = mesh(new T.Group(), new T.IcosahedronGeometry(.13, 0), orange);
    camera.add(flash);
    flash.position.set(.3, -.2, -1);
    flash.visible = false;
    const sparksGeo = new T.BufferGeometry(), sparkPos = new Float32Array(96 * 3), sparkVel = new Float32Array(96 * 3);
    sparksGeo.setAttribute('position', new T.BufferAttribute(sparkPos, 3));
    geometries.push(sparksGeo);
    const sparksMat = new T.PointsMaterial({ color: 0xffc478, size: .08, transparent: true, depthWrite: false });
    materials.push(sparksMat);
    const sparks = new T.Points(sparksGeo, sparksMat);
    sparks.frustumCulled = false;
    scene.add(sparks);
    const tracerGeo=new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3(0,0,-1)]);geometries.push(tracerGeo);const tracerMat=new T.LineBasicMaterial({color:0xffd28f,transparent:true,opacity:.9});materials.push(tracerMat);const tracer=new T.Line(tracerGeo,tracerMat);tracer.name='shot-tracer';tracer.visible=false;tracer.frustumCulled=false;scene.add(tracer);
    let sparkLife = 0,tracerLife=0;
    function burst(p: T.Vector3) { sparkLife = .7; for (let i = 0; i < 96; i++) {
        sparkPos.set([p.x, p.y, p.z], i * 3);
        sparkVel.set([(Math.random() - .5) * 5, Math.random() * 4, (Math.random() - .5) * 5], i * 3);
    } sparksGeo.attributes.position.needsUpdate = true; }
    const fadeMat = new T.MeshBasicMaterial({ color: 0x06131b, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    materials.push(fadeMat);
    const fade = mesh(new T.Group(), new T.PlaneGeometry(20, 20), fadeMat, 0, 0, -.3);
    fade.renderOrder = 999;
    camera.add(fade);
    let transition = 0,transitionTotal=.3;let sceneIntro=0,lastPortalFocus=-1;
    const introRoot=new T.Group();scene.add(introRoot);introRoot.visible=false;
    const introKicker=label(introRoot,'',0,.72,-2.6,3.5,.34,'#baffdf',1),introTitle=label(introRoot,'',0,0,-2.6,5.2,.72,'#f4fff9',2),introHint=label(introRoot,'',0,-.68,-2.6,4.6,.3,'#aac9c5',2);
    const introData:Record<Mode,[string,string,string]>={hub:['ТЕХНОПАРК РГСУ','VR-ПРОСТРАНСТВО','ВЫБЕРИТЕ ПОРТАЛ ИЛИ ИССЛЕДУЙТЕ ХОЛЛ'],robot:['01 / КОНТРОЛЬ','РОБОТ-АРЕНА','ЭНЕРГОЯЧЕЙКИ · БЛОКИ · ДУЭЛЬ'],drones:['02 / РЕАКЦИЯ','ДРОН-ТИР','6 ЗАРЯДОВ · СЕРИИ · ФЛАГМАН'],cargo:['03 / ЛОГИСТИКА','ПОЛИГОН ЛОСИНКА','3 ГРУЗА · МАНИПУЛЯТОР · БАЗА']};
    function startIntro(next:Mode){const d=introData[next];introKicker.write(d[0]);introTitle.write(d[1]);introHint.write(d[2]);introRoot.position.set(0,0,0);introRoot.rotation.set(0,0,0);camera.add(introRoot);sceneIntro=1.75;introRoot.visible=true;}
    const hudRoot = new T.Group();
    scene.add(hudRoot);
    // Minimal spatial mission beacon: one glance shows scene, state and progress without opening a menu.
    const missionBeacon=new T.Group();scene.add(missionBeacon);missionBeacon.visible=false;
    const beaconTop=label(missionBeacon,'',0,.42,0,2.8,.28,'#baffdf',1),beaconMain=label(missionBeacon,'',0,0,0,3.2,.42,'#f4fff9',1),beaconSub=label(missionBeacon,'',0,-.38,0,3,.24,'#9dbab6',1);
    const consoleCue=label(hudRoot,'← ПУЛЬТ И ЗАДАНИЕ',0,0,0,1.6,.24);scene.add(consoleCue.o);
    const hud = label(hudRoot, '', 0, 2.9, -3, 4.6, .92,'#e2fff6',3);
    const guidance = label(hudRoot, '', 0, 1.85, -3, 4.6, .68,'#e2fff6',2);
    const startLabel = label(hudRoot, 'НАЧАТЬ РАУНД', 0, 1.3, -3, 2.1, .4);
    action(startLabel.o, () => paused()?resume():start());
    const back = label(hudRoot, '⌂  ХОЛЛ', -1.5, 2.35, -3, 1.35, .36);
    action(back.o, () => go('hub'));
    const again = label(hudRoot, '↻  ЗАНОВО', 1.5, 2.35, -3, 1.35, .36);
    action(again.o, () => {resume();restart();});
    const demoLabel = label(hub, 'ПРЕЗЕНТАЦИЯ: ВЫКЛ', -2.3, 1.6, -1.5, 2, .32);xrOnly(demoLabel.o);
    action(demoLabel.o, () => setPresentation(!presentation));
    const visitorLabel = label(hub, 'НОВЫЙ ПОСЕТИТЕЛЬ', 2.3, 1.6, -1.5, 2, .32);xrOnly(visitorLabel.o);
    action(visitorLabel.o, () => nextVisitor());
    const lessonLabel = label(hudRoot, 'ОБУЧЕНИЕ', 0, .8, -3, 1.8, .32);
    action(lessonLabel.o, () => {resume();train();});
    const gameDemoLabel = label(hudRoot, 'ПОКАЗ ∞', 2, .8, -3, 1.5, .32);
    action(gameDemoLabel.o, () => setPresentation(!presentation));
    const newGuest = label(hudRoot, 'НОВЫЙ ГОСТЬ', -2, .8, -3, 1.5, .32);
    action(newGuest.o, () => nextVisitor());
    const pauseLabel=label(hudRoot,'ПАУЗА',0,.3,-3,1.7,.32);
    action(pauseLabel.o,()=>paused()?resume():pause('manual',true));
    const handHints: Array<ReturnType<typeof label>> = [];
    const controllers: T.Group[] = [], sources = new Map<T.Group, XRInputSource>(), guns: T.Group[] = [];
    const raycaster = new T.Raycaster(), rotation = new T.Matrix4(), pointScratch=new T.Vector3(), localScratch=new T.Vector3(), forwardScratch=new T.Vector3(), scaleScratch=new T.Vector3(), quatScratch=new T.Quaternion();
    const rays:T.Line[]=[];const tips:T.Mesh[]=[];const hoverTargets:Array<T.Object3D|null>=[null,null];
    function visible(o: T.Object3D) { for (let p: T.Object3D | null = o; p; p = p.parent)
        if (!p.visible)
            return false; return true; }
    function controllerRay(c: T.Group) { c.updateWorldMatrix(true, false); rotation.extractRotation(c.matrixWorld); raycaster.ray.origin.setFromMatrixPosition(c.matrixWorld); raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation); }
    for (let i = 0; i < 2; i++) {
        const c = renderer.xr.getController(i);
        rig.add(c);
        controllers.push(c);
        // Lightweight procedural controller proxy: no external model download and only a few polygons.
        const grip=cyl(c,black,0,-.075,.035,.038,.17,10);grip.rotation.x=.22;
        const gripRing=mesh(c,new T.TorusGeometry(.066,.012,5,18),steel,0,.035,-.005);gripRing.rotation.x=Math.PI/2;
        box(c,i===0?cyan:orange,0,.012,-.075,.055,.018,.055);
        const hint = label(c, '', 0, .15, -.34, .56, .16,'#e2fff6',2);
        hint.o.rotation.x = -.3;
        handHints.push(hint);
        const geom = new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3(0, 0, -1)]);
        geometries.push(geom);
        const lm = new T.LineBasicMaterial({ color: 0x71ffe0, transparent: true, opacity: .6 });
        materials.push(lm);
        const line=new T.Line(geom,lm);line.scale.z=8;c.add(line);rays.push(line);
        const dot=mesh(c,new T.SphereGeometry(.015,8,6),cyan,0,0,-8);dot.visible=false;tips.push(dot);
        const weapon = gun();
        c.add(weapon);
        guns.push(weapon);
        c.addEventListener('connected', (e: any) => { sources.set(c, e.data);neutral.add(e.data); weapon.visible = e.data.handedness === 'right' && mode === 'drones'; });
        c.addEventListener('disconnected', () => {sources.delete(c);hoverTargets[i]=null;});
        c.addEventListener('selectstart', () => { if([...pauseReasons].some(reason=>!['manual','focus'].includes(reason)))return;controllerRay(c); const hit = raycaster.intersectObjects(actions.filter(visible), false)[0]; if (hit) {
            hit.object.userData.action();
            return;
        } if (sources.get(c)?.handedness === 'right') {
            if(paused()){resume();return;}
            if(inputBlocked(sources.get(c)!))return;
            if (mode === 'robot') {
                if (ready)
                    start();
                else
                    spin();
            }
            else if (mode === 'drones')
                shoot(raycaster.ray.clone(), c);
            else if (mode === 'cargo'){
                const wasBusy=cargo.busy;cargoAction();if(!wasBusy&&cargo.busy)pulse(c);
            }
        } });
        c.addEventListener('squeezestart', () => { if (sources.get(c)?.handedness === 'left')
            go('hub');
        else if (mode === 'drones')
            reload(); });
    }
    let entranceAge = 0, roundAge = 0, bossAnnounced = false;
    let presentation = false, training = false, lessonStep = 0, lessonTravel = 0, lessonTurn = 0, lessonSpin = false, health = 3, rivalHealth = 3, duel = false, impactWait = 0, rivalRespawn = 0;
    const learned = { move: false, turn: false, spin: false, shoot: false, reload: false, cargo: false };
    let ready = true, countdown = 0, combo = 0, shots = 0, hits = 0, turnReady = true, muted = false, notice = '', noticeTime = 0;
    let lastCargoCollisions=0,lastCargoDelivered=0;
    let bests: Record<string, number> = { robot: 0, drones: 0, cargo: 0 };
    try {
        bests = { ...bests, ...JSON.parse(localStorage.getItem('technopark-records') || '{}') };
    }
    catch { }
    let mode: Mode = 'hub', seconds = 60, score = 0, ammo = 6, reloading = 0, cooldown = 0, spinning = false, ended = false, elapsed = 0, lastHUD = '', flashTime = 0;
    const keys = new Set<string>();
    const neutral=new WeakSet<XRInputSource>(),pauseReasons=new Set<string>();
    let disposed=false,supported:boolean|undefined,sessionPending=false,lastAction='',lastHint='',lastPhase='',previous=0,diagTime=0,diagFrames=0;
    let observedSession:XRSession|null=null;
    const paused=()=>pauseReasons.size>0;
    function clearInput(){keys.clear();cargo.stop();audioFX.motor(0);for(const source of sources.values())neutral.add(source);}
    function inputBlocked(source:XRInputSource){
        if(!neutral.has(source))return false;
        if(source.gamepad&&source.gamepad.axes.some(a=>Number.isFinite(a)&&Math.abs(a)>.25))return true;
        neutral.delete(source);return false;
    }
    function stick(source:XRInputSource){
        if(paused()||inputBlocked(source))return [0,0];
        const a=source.gamepad?.axes??[],offset=a.length>=4?2:0;
        return [a[offset]??0,a[offset+1]??0].map(v=>Number.isFinite(v)?T.MathUtils.clamp(v,-1,1):0);
    }
    function pause(reason:string,value:boolean){
        const before=paused();if(value)pauseReasons.add(reason);else pauseReasons.delete(reason);
        if(before!==paused()){clearInput();previous=0;hooks.paused?.(paused());updateHUD();}
    }
    function resume(){pauseReasons.delete('manual');pauseReasons.delete('focus');clearInput();previous=0;hooks.paused?.(paused());audioFX.unlock();updateHUD();}
    function pulse(controller:T.Group,strength=.3,duration=65){try{const actuator=(sources.get(controller)?.gamepad as any)?.hapticActuators?.[0];if(actuator)Promise.resolve(actuator.pulse(strength,duration)).catch(()=>{});}catch{}}

    function sound(f: number, d = .08) { audioFX.tone(f, d, 'triangle'); }
    function notify(message: string) { notice = message; noticeTime = 2; }
    function setPresentation(value: boolean) { presentation = value; gameDemoLabel.write(value ? 'ПОКАЗ ∞: ВКЛ' : 'ПОКАЗ ∞: ВЫКЛ'); demoLabel.write(value ? 'ПРЕЗЕНТАЦИЯ: ВКЛ' : 'ПРЕЗЕНТАЦИЯ: ВЫКЛ'); hooks.presentation?.(value); restart(); }
    function welcome() { entranceAge = 0; audioFX.event('portal'); }
    function nextVisitor() { pauseReasons.delete('manual');pauseReasons.delete('focus');hooks.paused?.(paused());welcome(); Object.assign(learned, { move: false, turn: false, spin: false, shoot: false, reload: false, cargo:false }); go('hub'); }
    function train() { if (mode === 'hub')
        return; if (mode === 'cargo') {
        restart();
        ready = false;
        training = true;
        audioFX.unlock();
        updateHUD();
        return;
    } restart(); training = true; ready = false; lessonStep = 0; lessonTravel = 0; lessonTurn = 0; lessonSpin = false; audioFX.unlock(); updateHUD(); }
    function completeLesson() { if(mode==='cargo')learned.cargo=true;restart(); notify('ОБУЧЕНИЕ ПРОЙДЕНО / МОЖНО НАЧИНАТЬ'); sound(880); updateHUD(); }
    function lessonText() { return mode === 'cargo' ? (cargo.loaded ? 'УРОК: ВЕРНИТЕСЬ НА БАЗУ / КУРОК: ВЫГРУЗИТЬ' : 'УРОК: НАЙДИТЕ ГРУЗ / ОСТАНОВИТЕСЬ / КУРОК: ЗАХВАТ') : mode === 'robot' ? (lessonStep === 0 ? 'ОБУЧЕНИЕ 1/2: ПРОЕДЬТЕ И ПОВЕРНИТЕ РОБОТА' : 'ОБУЧЕНИЕ 2/2: ВКЛЮЧИТЕ СПИННЕР / КУРОК ИЛИ ПРОБЕЛ') : (lessonStep === 0 ? 'ОБУЧЕНИЕ 1/2: ПОПАДИТЕ В НЕПОДВИЖНЫЙ ДРОН' : 'ОБУЧЕНИЕ 2/2: ПЕРЕЗАРЯДИТЕ / БОКОВАЯ КНОПКА ИЛИ R'); }
    function start() { if(paused())return; if (mode === 'hub' || (!training && !ready && !ended))
        return; restart(); audioFX.unlock(); ready = false; countdown = 3; startLabel.o.visible = false; sound(660); updateHUD(); }
    const won=()=>mode==='cargo'?cargo.finished:mode==='robot'?rivalHealth<=0:drones[8].hp<=0;
    const resultScore=()=>mode==='cargo'?Math.max(0,cargo.delivered*500+(cargo.finished?Math.ceil(seconds)*5:0)-cargo.collisions*25):mode==='robot'?score*100+(rivalHealth<=0?Math.ceil(seconds)*10:0):score;
    function finish() { if (ended)
        return; ended = true; audioFX.motor(0); const result=resultScore(); if (!presentation)
        bests[mode] = Math.max(bests[mode] || 0, result); if (!presentation)
        try {
            localStorage.setItem('technopark-records', JSON.stringify(bests));
        }
        catch { } audioFX.event(won()?'win':'end'); updateHUD(); }
    function cargoAction(){if(paused())return;if(ready){start();return;}if(ended||countdown)return;cargo.interact();updateHUD();}
    function snap(dir: number) { learned.turn = true; const head = (renderer.xr.isPresenting ? renderer.xr.getCamera() : camera).getWorldPosition(new T.Vector3()); const a = -dir * Math.PI / 6; rig.position.sub(head).applyAxisAngle(new T.Vector3(0, 1, 0), a).add(head); rig.rotation.y += a; }
    function placeView(){
        clearInput();rig.position.set(0,0,0);rig.rotation.set(0,0,0);
        if(!renderer.xr.isPresenting){
            camera.position.set(0,mode==='cargo'?11:mode==='robot'?7:2.6,mode==='cargo'?12:mode==='robot'?8:7);
            camera.lookAt(0,mode==='cargo'||mode==='robot'?0:2.6,-10);
        }else{
            camera.position.set(0,0,0);camera.rotation.set(0,0,0);
            rig.position.set(0,mode==='cargo'?2.8:mode==='robot'?1.5:0,mode==='cargo'?7:mode==='robot'?4:1);
        }
        desktopGun.visible=mode==='drones'&&!renderer.xr.isPresenting;
        guns.forEach((g,i)=>g.visible=mode==='drones'&&sources.get(controllers[i])?.handedness==='right');
        xrOnlyHub.forEach(o=>o.visible=renderer.xr.isPresenting);
        // The desktop already has HTML controls. In VR the console is fixed to the observation station, not the head.
        hudRoot.visible=mode!=='hub'&&renderer.xr.isPresenting;missionBeacon.visible=mode!=='hub'&&renderer.xr.isPresenting;
        const stationY=mode==='cargo'?2.8:mode==='robot'?1.5:0,stationZ=mode==='cargo'?7:mode==='robot'?4:1;
        // Fixed side console: the centre sight line and ground remain unobstructed.
        const consoleYaw=Math.atan2(4.4,3.4),consoleScale=.8;
        hudRoot.rotation.y=consoleYaw;hudRoot.scale.setScalar(consoleScale);
        hudRoot.position.set(-4.4+3*consoleScale*Math.sin(consoleYaw),stationY+2.1,stationZ-3.4+3*consoleScale*Math.cos(consoleYaw));
        consoleCue.o.visible=hudRoot.visible;consoleCue.o.position.set(-1.8,stationY+1.85,stationZ-4.5);
        guidance.write(mode==='cargo'?cargo.hint():lessonText());
        hud.o.position.set(0,.9,-3);guidance.o.position.set(0,-.02,-3);
        startLabel.o.position.set(0,-.66,-3);back.o.position.set(-1.7,-1.13,-3);again.o.position.set(1.7,-1.13,-3);
        lessonLabel.o.position.set(0,-1.65,-3);gameDemoLabel.o.position.set(1.7,-1.65,-3);newGuest.o.position.set(-1.7,-1.65,-3);
        pauseLabel.o.position.set(0,-1.13,-3);
        const beaconY=mode==='cargo'?4.6:mode==='robot'?3.5:2.35,beaconZ=mode==='cargo'?-6.5:mode==='robot'?-10.8:-10.5;missionBeacon.position.set(4.7,beaconY,beaconZ);missionBeacon.rotation.y=-.32;missionBeacon.scale.setScalar(.82);
        scene.updateMatrixWorld(true);
    }
    function go(next:Mode){
        if(disposed)return;scene.background=new T.Color(next==='cargo'?'#192d35':'#071722');scene.fog=new T.FogExp2(next==='cargo'?'#192d35':'#071722',next==='cargo'?.01:.016);renderer.toneMappingExposure=next==='robot'?1.34:next==='drones'?1.25:next==='cargo'?1.08:1.05;transitionTotal=next===mode?.28:.62;transition=transitionTotal;startIntro(next);audioFX.motor(0);audioFX.scene(next);if(next!==mode)audioFX.event('portal');mode=next;
        pauseReasons.delete('manual');pauseReasons.delete('focus');hooks.paused?.(paused());
        Object.entries(worlds).forEach(([name,g])=>g.visible=name===next);placeView();hooks.scene(next);restart();
        if(next!=='hub'){
            const needsTraining=next==='cargo'?!learned.cargo:next==='robot'?!(learned.move&&learned.spin):!(learned.shoot&&learned.reload);
            if(needsTraining)train();
        }
    }
    function restart() { clearInput();cargo.reset();lastCargoCollisions=0;lastCargoDelivered=0; roundAge = 0; bossAnnounced = false; keys.clear(); turnReady = true; training = false; health = 3; rivalHealth = 3; duel = false; impactWait = 0; rivalRespawn = 0; rival.visible = false; rivalName.o.visible = false; rival.position.set(0, 0, -11); audioFX.motor(0); sparkLife = 0; ready = true; countdown = 0; combo = 0; shots = 0; hits = 0; notice = ''; noticeTime = 0; startLabel.o.visible = true; seconds = mode === 'cargo' ? 180 : 60; score = 0; ammo = 6; reloading = 0; cooldown = 0; spinning = false; ended = false; robot.position.set(0, .02, -2); robot.rotation.set(0, 0, 0); cells.forEach(c => c.visible = true); blocks.forEach(c => c.visible = true); drones.forEach(d => { d.dead = false; d.hp = d.maxHP; d.velocity = 0; d.g.visible = d.kind !== 'ФЛАГМАН'; d.g.rotation.set(0, 0, 0); }); updateHUD(); }
    function spin() { if(paused())return; if (mode === 'robot' && !ended && !ready && !countdown) {
        spinning = !spinning;
        learned.spin = true;
        if (training && lessonStep === 1 && spinning)
            lessonSpin = true;
        sound(spinning ? 400 : 150);
        updateHUD();
    } }
    function reload() { if(paused())return; if (mode === 'drones' && !ended && ammo < 6 && !reloading) {
        learned.reload = true;
        reloading = 1.3;
        audioFX.event('reload');
        updateHUD();
    } }
    function shoot(ray: T.Ray, c?: T.Group) { if(paused())return; if (ready) {
        start();
        return;
    } if (ended || countdown || cooldown || reloading)
        return; if (!ammo) {
        reload();
        return;
    } learned.shoot = true; ammo--; shots++; cooldown = .45; flashTime = .065; audioFX.event('shot'); const targets = drones.filter(d => !d.dead && d.g.visible); let best: Drone | undefined, dist = Infinity; for (const d of targets) {
        const p = d.g.getWorldPosition(new T.Vector3());
        const along = p.clone().sub(ray.origin).dot(ray.direction);
        if (shotHits(along, ray.distanceToPoint(p) / d.g.scale.x) && along < dist) {
            best = d;
            dist = along;
        }
    }
    const tracerEnd=ray.at(best?dist:18,new T.Vector3());tracerGeo.setFromPoints([ray.origin.clone(),tracerEnd]);tracer.visible=true;tracerLife=.075;tracerMat.opacity=.92;
    if (best) {
        best.hp--;
        const destroyed = best.hp <= 0;
        best.dead = destroyed;
        if (destroyed) {
            best.velocity = 0;
            best.respawn = best.kind === 'ФЛАГМАН' ? 6 : 2.4;
        }
        if (training) {
            lessonStep = 1;
            notify('ПОПАДАНИЕ! ТЕПЕРЬ ПЕРЕЗАРЯДИТЕ');
        }
        hits++;
        combo++;
        const multiplier = Math.min(4, 1 + Math.floor(combo / 3));
        const award = (destroyed ? best.value : 25) * multiplier;
        score += award;
        burst(best.g.position);
        audioFX.event('hit');
        notify(best.kind + ' ' + (destroyed ? 'СБИТ' : ' / ПРОЧНОСТЬ ' + best.hp) + ' +' + award);
        if (destroyed && best.kind === 'ФЛАГМАН' && !presentation && !training)
            finish();
        if(c)pulse(c);
    }
    else {
        combo = 0;
        notify('ПРОМАХ / СЕРИЯ СБРОШЕНА');
    } updateHUD(); }
    function updateHUD() { let s = entranceAge < 4 && mode === 'hub' ? 'ДОБРО ПОЖАЛОВАТЬ / АКТИВАЦИЯ ЯДРА' : presentation ? 'ПРЕЗЕНТАЦИЯ ∞ / Выберите сцену' : 'Ядро / кинетическая инсталляция · Выберите портал'; if (mode !== 'hub') {
        const progress = mode === 'cargo' ? cargo.status() : mode === 'robot' ? (duel ? `ДУЭЛЬ · Ваша прочность ${health}/3 · Соперник ${rivalHealth}/3` : `Ячейки ${cells.filter(c => !c.visible).length}/5 · Блоки ${blocks.filter(c => !c.visible).length}/6 · ${spinning ? 'Спиннер ВКЛ' : 'Спиннер ВЫКЛ'}`) : `Волна ${Math.min(3, 1 + Math.floor(roundAge / 20))}${roundAge >= 40 ? ' · ФЛАГМАН ' + drones[8].hp + '/6' : ''} · ${score} очков · ${reloading ? 'Перезарядка…' : ammo + '/6 зарядов'} · ×${Math.min(4, 1 + Math.floor(combo / 3))}`;
        s = training ? lessonText() : ready ? 'ГОТОВЫ? НАЖМИТЕ «НАЧАТЬ РАУНД»' : countdown > 0 ? 'СТАРТ ЧЕРЕЗ ' + Math.ceil(countdown) : ended ? (mode === 'cargo' ? (cargo.finished ? 'ДОСТАВЛЕНО 3/3 · ' + Math.ceil(roundAge) + ' С · ОШИБКИ ' + cargo.collisions : 'ВРЕМЯ ВЫШЛО · ' + cargo.delivered + '/3 ГРУЗОВ') : mode === 'robot' ? (rivalHealth <= 0 ? 'ПОБЕДА В ДУЭЛИ' : 'ПОПРОБУЙТЕ ЕЩЁ') : `${drones[8].hp <= 0 ? 'ФЛАГМАН СБИТ' : 'РАУНД ЗАВЕРШЁН'} · ТОЧНОСТЬ ${shots ? Math.round(hits / shots * 100) : 0}%`) + ` · ОЧКИ ${resultScore()} · РЕКОРД ${bests[mode]}` : `${presentation ? 'ДЕМОНСТРАЦИЯ ∞' : Math.ceil(seconds) + ' с'} · ${progress}`;
    } if(paused())s='ПАУЗА · '+s;
    const phase=mode==='hub'?'hub':training?'training':ready?'ready':countdown?'countdown':ended?'ended':'active';if(phase!==lastPhase){lastPhase=phase;hooks.phase?.(phase);}
    startLabel.o.visible=paused()||ready||training||ended;startLabel.write(paused()?'ПРОДОЛЖИТЬ':ended?'ЕЩЁ РАУНД':'НАЧАТЬ РАУНД');
    pauseLabel.write(paused()?'ПРОДОЛЖИТЬ':'ПАУЗА');
    const action=mode==='cargo'?cargo.actionLabel():'';if(action!==lastAction){lastAction=action;hooks.action?.(action);}
    if (s !== lastHUD) {
        lastHUD = s;
        if(mode!=='hub'){
            const title=mode==='cargo'?'03 · ПОЛИГОН ЛОСИНКА':mode==='robot'?'01 · РОБОТ-АРЕНА':'02 · ДРОН-ТИР';
            const state=paused()?'ПАУЗА':training?'ОБУЧЕНИЕ':ready?'ГОТОВ К СТАРТУ':countdown>0?'СТАРТ '+Math.ceil(countdown):ended?'ИТОГ':'МИССИЯ';
            const detail=mode==='cargo'?`ГРУЗЫ ${cargo.delivered}/3 · ${cargo.loaded?'НА ПЛАТФОРМЕ':'ЗАХВАТ СВОБОДЕН'}`:mode==='robot'?(duel?`ДУЭЛЬ · ${rivalHealth}/3 · ВЫ ${health}/3`:`ЯЧЕЙКИ ${cells.filter(c=>!c.visible).length}/5 · БЛОКИ ${blocks.filter(b=>!b.visible).length}/6`):`ЗАРЯДЫ ${ammo}/6 · ОЧКИ ${score}`;
            beaconTop.write(title);beaconMain.write(state);beaconSub.write(detail);
        }
                hooks.status(s);
        hud.write(s); // Text wraps without horizontal glyph distortion.

    } }
    const keyName=(key:string)=>({ArrowUp:'w',ArrowDown:'s',ArrowLeft:'a',ArrowRight:'d'}[key]??key.toLowerCase());
    function down(e:KeyboardEvent){
        const target=e.target as HTMLElement;
        if(target?.closest?.('input,textarea,select,[contenteditable]'))return;
        if(target?.closest?.('button,a')&&(e.code==='Space'||e.key==='Enter'))return;
        if([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))e.preventDefault();
        if(paused()){if(!e.repeat&&(e.code==='Space'||e.key==='Enter'))resume();return;}
        keys.add(keyName(e.key));if(e.repeat)return;
        if(e.code==='Space'){if(mode==='cargo')cargoAction();else if(ready&&mode!=='hub')start();else spin();}
        if(e.key.toLowerCase()==='q')snap(-1);if(e.key.toLowerCase()==='e')snap(1);if(e.key.toLowerCase()==='r')reload();
        if(e.key.toLowerCase()==='p'&&mode!=='hub')pause('manual',true);if(e.key==='Escape')go('hub');
    }
    const up=(e:KeyboardEvent)=>keys.delete(keyName(e.key));
    const blur=()=>{clearInput();if(!renderer.xr.isPresenting)pause('focus',true);};
    const focus=()=>{if(!renderer.xr.isPresenting&&mode==='hub')pause('focus',false);};
    const visibility=()=>{pause('page',document.hidden);if(!document.hidden&&mode!=='hub')pause('manual',true);};
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);window.addEventListener('focus',focus);
    document.addEventListener('visibilitychange',visibility);
    function click(e: PointerEvent) { if(paused())return; audioFX.unlock(); const r = renderer.domElement.getBoundingClientRect(); raycaster.setFromCamera(new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), camera); const hit = raycaster.intersectObjects(actions.filter(visible), false)[0]; if (hit)
        hit.object.userData.action();
    else if (mode === 'drones')
        shoot(raycaster.ray.clone()); }
    let drag: {
        x: number;
        y: number;
        lastX: number;
        lastY: number;
        moved: boolean;
    } | null = null;
    const pointerDown = (e: PointerEvent) => { if (mode === 'hub'&&!paused()&&!renderer.xr.isPresenting) {
        drag = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false };
        renderer.domElement.setPointerCapture(e.pointerId);
    }
    else
        click(e); };
    const pointerMove = (e: PointerEvent) => { if (!drag || mode !== 'hub' || paused() || renderer.xr.isPresenting)
        return; const dx = e.clientX - drag.lastX, dy = e.clientY - drag.lastY; if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5)
        drag.moved = true; if (drag.moved) {
        camera.rotation.order = 'YXZ';
        camera.rotation.y -= dx * .004;
        camera.rotation.x = T.MathUtils.clamp(camera.rotation.x - dy * .004, -1, 1);
    } drag.lastX = e.clientX; drag.lastY = e.clientY; };
    const pointerUp = (e: PointerEvent) => { if (drag && !drag.moved)
        click(e); drag = null; };
    const pointerCancel = () => { drag = null; };
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointermove', pointerMove);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    renderer.domElement.addEventListener('pointercancel', pointerCancel);
    const resize = () => { if (renderer.xr.isPresenting)
        return; camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(host.clientWidth, host.clientHeight); };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    function xrVisibility(){
        if(!observedSession)return;
        const obscured=observedSession.visibilityState!=='visible';
        if(obscured)pause('xr',true);else {pause('manual',true);pause('xr',false);}
    }
    function sessionStart(){
        observedSession=renderer.xr.getSession();observedSession?.addEventListener('visibilitychange',xrVisibility);
        pauseReasons.delete('focus');pauseReasons.delete('xr-switch');placeView();previous=0;hooks.xr?.(true);hooks.paused?.(paused());updateHUD();
    }
    function sessionEnd(){
        observedSession?.removeEventListener('visibilitychange',xrVisibility);observedSession=null;
        pauseReasons.delete('xr');pauseReasons.delete('xr-switch');if(mode!=='hub')pause('manual',true);
        placeView();previous=0;resize();hooks.xr?.(false);updateHUD();
    }
    function contextLost(e:Event){e.preventDefault();pause('context',true);hooks.error?.('Графический контекст потерян. Обновите страницу для восстановления 3D.');}
    function contextRestored(){hooks.error?.('Графический контекст восстановлен. Обновите страницу, чтобы заново подготовить окружение.');}
    renderer.xr.addEventListener('sessionstart',sessionStart);renderer.xr.addEventListener('sessionend',sessionEnd);
    renderer.domElement.addEventListener('webglcontextlost',contextLost);renderer.domElement.addEventListener('webglcontextrestored',contextRestored);
    if(typeof navigator!=='undefined'&&navigator.xr?.isSessionSupported){
        navigator.xr.isSessionSupported('immersive-vr').then(value=>{supported=value;if(!disposed)hooks.support?.(value);}).catch(()=>{if(!disposed)hooks.support?.(false);});
    }else{supported=false;hooks.support?.(false);}
    const disposeBatches=[batchStatic(hub),batchStatic(arena,new Set([...cells,...blocks])),batchStatic(worlds.drones)];
    renderer.setAnimationLoop((t) => {
        const dt = paused()?0:Math.min(previous?(t-previous)/1000:.016,.05);
        previous = t;
        elapsed += dt;
        transition = Math.max(0, transition - dt);
        const fadeProgress=transitionTotal?transition/transitionTotal:0;fadeMat.opacity=Math.min(.94,fadeProgress*1.12);fade.visible=transition>0;
        sceneIntro=Math.max(0,sceneIntro-dt);introRoot.visible=sceneIntro>0&&!renderer.xr.isPresenting;if(introRoot.visible){const q=Math.min(1,(1.75-sceneIntro)/.28),out=Math.min(1,sceneIntro/.42),s=.9+.1*q;introRoot.scale.setScalar(s);introRoot.position.y=.04*(1-q);introRoot.traverse(o=>{const m=(o as T.Mesh).material as T.Material&{opacity?:number;transparent?:boolean};if(m&&'opacity'in m){m.transparent=true;m.opacity=Math.min(q,out);}});}
        if(mode==='hub'){entranceAge=Math.min(4,entranceAge+dt);art.update(elapsed,entranceAge/4);}
        sun.intensity = mode==='hub'?1+2*T.MathUtils.smoothstep(entranceAge,0,4):3.5;
        if(mode==='hub')exhibits.forEach((e, i) => { e.rotation.y = elapsed * .22; e.position.y = 1.2 + Math.sin(elapsed + i) * .06; });
        if (mode !== 'hub' && !ready && !training && !ended && !countdown) {
            roundAge += dt;
            if (mode === 'drones' && roundAge >= 40 && !bossAnnounced) {
                bossAnnounced = true;
                notify('ФИНАЛ: ФЛАГМАН / 6 ПОПАДАНИЙ');
                audioFX.event('portal');
            }
        }
        noticeTime = Math.max(0, noticeTime - dt);
        if (mode !== 'hub')
            guidance.write(noticeTime ? notice : mode==='cargo'?cargo.hint():training ? lessonText() : (mode === 'robot' ? 'ЛЕВЫЙ СТИК: РОБОТ · ПРАВЫЙ КУРОК: СПИННЕР' : 'КУРОК: ОГОНЬ · БОКОВАЯ: ПЕРЕЗАРЯДКА'));
        tracerLife=Math.max(0,tracerLife-dt);tracer.visible=tracerLife>0;if(tracer.visible)tracerMat.opacity=Math.min(.92,tracerLife/.075);
        if (sparkLife > 0) {
            sparkLife -= dt;
            sparks.visible = true;
            sparksMat.opacity = Math.max(0, sparkLife / .7);
            for (let i = 0; i < 96; i++) {
                sparkVel[i * 3 + 1] -= 5 * dt;
                for (let j = 0; j < 3; j++)
                    sparkPos[i * 3 + j] += sparkVel[i * 3 + j] * dt;
            }
            sparksGeo.attributes.position.needsUpdate = true;
        }
        else
            sparks.visible = false;
        for (const src of sources.values())
            if (src.handedness === 'right' && src.gamepad) {
                const [x]=stick(src);
                if (Math.abs(x) < .3)
                    turnReady = true;
                else if (Math.abs(x) > .7 && turnReady) {
                    snap(Math.sign(x));
                    turnReady = false;
                }
            }
        if (countdown > 0) {
            const before = Math.ceil(countdown);
            countdown = Math.max(0, countdown - dt);
            if (Math.ceil(countdown) !== before)
                sound(countdown ? 660 : 990);
        }
        cooldown = Math.max(0, cooldown - dt);
        flashTime = Math.max(0, flashTime - dt);
        flash.visible = flashTime > 0 && !renderer.xr.isPresenting;
        guns.forEach(g => { const m = g.getObjectByName('muzzle-flash'); if (m)
            m.visible = flashTime > 0; g.position.z = flashTime > 0 ? .05 : 0; });
        desktopGun.position.z = -.25 + (flashTime > 0 ? .06 : 0);
        if(mode==='hub'){
            portals.forEach(p => (p.material as T.ShaderMaterial).uniforms.time.value = elapsed);
            const activeCamera=renderer.xr.isPresenting?renderer.xr.getCamera():camera,head=activeCamera.getWorldPosition(pointScratch);activeCamera.getWorldQuaternion(quatScratch);const forward=forwardScratch.set(0,0,-1).applyQuaternion(quatScratch);let best=-1,bestDot=.9;
            portalGroups.forEach((p,i)=>{p.getWorldPosition(localScratch);localScratch.sub(head);const dist=localScratch.length(),dot=localScratch.normalize().dot(forward);if(dist<15&&dot>bestDot){bestDot=dot;best=i;}const target=i===best?1.045:1;p.scale.lerp(scaleScratch.set(target,target,target),Math.min(1,dt*8));p.position.y=p.userData.baseY+(i===best?.035*Math.sin(elapsed*5):0);});portalFocus=best;
            if(portalFocus!==lastPortalFocus){lastPortalFocus=portalFocus;if(portalFocus>=0&&renderer.xr.isPresenting)audioFX.tone(520,.045,'sine',.025);}
        }
        if (mode !== 'hub' && !ended && !ready && !countdown && !training && !presentation) {
            seconds = Math.max(0, seconds - dt);
            if (seconds === 0)
                finish();
        }
        if (reloading) {
            reloading = Math.max(0, reloading - dt);
            if (!reloading) {
                ammo = 6;
                if (training && mode === 'drones' && lessonStep === 1)
                    completeLesson();
            }
        }
        if (mode === 'robot' && !paused() && !ended && !ready && !countdown) {
            let drive = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0), turn = (keys.has('a') ? 1 : 0) - (keys.has('d') ? 1 : 0);
            for (const src of sources.values())
                if (src.handedness === 'left' && src.gamepad) {
                    const [x,y]=stick(src);
                    if (Math.abs(y) > .15)
                        drive = -y;
                    if (Math.abs(x) > .15)
                        turn = -x;
                }
            audioFX.motor(Math.abs(drive) + (spinning ? .7 : 0));
            if (Math.abs(drive) > .1)
                learned.move = true;
            const moved = driveRobot(robot.position.x, robot.position.z, robot.rotation.y, drive, turn, dt);
            if (training) {
                lessonTravel += Math.abs(drive) * 3.2 * dt;
                lessonTurn += Math.abs(turn) * 2.4 * dt;
                if (lessonStep === 0 && lessonTravel > 1 && lessonTurn > .4) {
                    lessonStep = 1;
                    sound(660);
                }
                if (lessonSpin) {
                    completeLesson();
                    updateHUD();
                    renderer.render(scene, camera);
                    return;
                }
            }
            robot.rotation.y = moved.yaw;
            robot.position.x = moved.x;
            robot.position.z = moved.z;
            arenaCellLamps.forEach((lamp,i)=>{const on=cells[i]?.visible!==false;lamp.visible=on;});
            arenaBlockLamps.forEach((lamp,i)=>{const on=blocks[i]?.visible!==false;lamp.visible=on;});
            spinGlow.visible=spinning&&!ended;spinGlow.scale.setScalar(1+.045*Math.sin(elapsed*12));
            if (spinning)
                ring.rotation.y += dt * 22;
            for (const c of cells) {
                c.rotation.y += dt;
                c.position.y = .6 + Math.sin(elapsed * 2 + c.position.x) * .12;
                if (!training && c.visible && Math.hypot(c.position.x - robot.position.x, c.position.z - robot.position.z) < 1) {
                    c.visible = false;
                    score++;
                    controllers.forEach(ctrl=>{if(sources.get(ctrl)?.handedness==='left')pulse(ctrl,.16,35);});
                    sound(700);
                    burst(c.position);
                    notify('ЭНЕРГОЯЧЕЙКА +100');
                }
            }
            for (const b of blocks)
                if (!training && b.visible && spinning && Math.hypot(b.position.x - robot.position.x, b.position.z - robot.position.z) < 1.2) {
                    b.visible = false;
                    score++;
                    controllers.forEach(ctrl=>{if(sources.get(ctrl)?.handedness==='right')pulse(ctrl,.28,55);});
                    audioFX.event('hit');
                    burst(b.position);
                    notify('БЛОК УНИЧТОЖЕН +100');
                }
            if (!training && score === 11 && !duel) {
                duel = true;
                rival.visible = true;
                rivalName.o.visible = true;
                seconds = Math.max(seconds, 35);
                notify('ФИНАЛ: ПОБЕДИТЕ БУЛЬДОЗЕР СПИННЕРОМ');
                audioFX.event('portal');
            }
            if (duel) {
                impactWait = Math.max(0, impactWait - dt);
                if (rivalRespawn > 0) {
                    rivalRespawn -= dt;
                    if (rivalRespawn <= 0) {
                        rivalHealth = 3;
                        rival.visible = true;
                        rival.position.set(0, 0, -11);
                    }
                }
                else {
                    const delta = robot.position.clone().sub(rival.position);
                    delta.y = 0;
                    const distance = delta.length();
                    rival.rotation.y = Math.atan2(-delta.x, -delta.z);
                    if (distance > 1.5)
                        rival.position.addScaledVector(delta.normalize(), dt * 1.25);
                    if (distance < 1.7 && !impactWait) {
                        impactWait = 1.3;
                        burst(robot.position);
                        controllers.forEach(ctrl=>{if(sources.get(ctrl)?.handedness==='right')pulse(ctrl,spinning?.5:.34,90);});
                        audioFX.event('hit');
                        if (spinning) {
                            rivalHealth--;
                            notify('ПОПАДАНИЕ ПО СОПЕРНИКУ');
                        }
                        else if (!presentation) {
                            health--;
                            notify('УДАР! ВКЛЮЧИТЕ СПИННЕР');
                        }
                        const away = robot.position.clone().sub(rival.position).setY(0).normalize();
                        rival.position.addScaledVector(away, -1.3);
                        rival.position.x = T.MathUtils.clamp(rival.position.x, -5.7, 5.7);
                        rival.position.z = T.MathUtils.clamp(rival.position.z, -12.7, -1.3);
                        if (rivalHealth <= 0) {
                            if (presentation) {
                                rival.visible = false;
                                rivalRespawn = 3;
                                notify('ПОБЕДА! НОВЫЙ СОПЕРНИК ЧЕРЕЗ 3 С');
                            }
                            else
                                finish();
                        }
                        if (health <= 0)
                            finish();
                    }
                }
                rivalName.o.position.set(rival.position.x, 1.4, rival.position.z);
                rivalName.write('БУЛЬДОЗЕР ' + rivalHealth + '/3');
            }
        }
        for (let i = 0; i < controllers.length; i++) {
            const hand = sources.get(controllers[i])?.handedness;
            const hint = handHints[i];
            const text = mode!=='hub'&&hand==='left' ? (mode==='cargo' ? `${cargo.delivered}/3 · ${presentation?'ПОКАЗ ∞':Math.ceil(seconds)+' С'} / ПУЛЬТ СЛЕВА` : 'ПУЛЬТ СЛЕВА / БОКОВАЯ: ХОЛЛ') : mode === 'cargo' ? (hand === 'left' ? 'ЛЕВЫЙ СТИК: ХОД И ПОВОРОТ' : 'КУРОК: ЗАХВАТ / ВЫГРУЗКА') : hand === 'left' ? (learned.move ? 'БОКОВАЯ: ХОЛЛ' : 'ЛЕВЫЙ СТИК: ДВИЖЕНИЕ') : mode === 'drones' ? (training && lessonStep === 1 ? 'БОКОВАЯ: ПЕРЕЗАРЯДКА' : !learned.shoot ? 'КУРОК: ВЫСТРЕЛ' : !learned.reload ? 'БОКОВАЯ: ПЕРЕЗАРЯДКА' : !learned.turn ? 'СТИК: ПОВОРОТ 30°' : '') : mode === 'robot' ? (!learned.spin ? 'КУРОК: СПИННЕР' : !learned.turn ? 'СТИК: ПОВОРОТ 30°' : '') : (!learned.turn ? 'СТИК: ПОВОРОТ 30°' : 'КУРОК: ВЫБРАТЬ');
            hint.o.visible = !!text;
            hint.write(text);
        }
        if (mode === 'cargo') {
            let drive = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0), turn = (keys.has('a') ? 1 : 0) - (keys.has('d') ? 1 : 0);
            for (const src of sources.values())
                if (src.handedness === 'left' && src.gamepad) {
                    const [x,y]=stick(src);
                    if (Math.abs(y) > .15)
                        drive = -y;
                    if (Math.abs(x) > .15)
                        turn = -x;
                }
            const active = !paused()&&!ready && !countdown && !ended;
            cargo.update(dt, drive, turn, active);
            if(cargo.collisions>lastCargoCollisions){controllers.forEach(ctrl=>pulse(ctrl,.3,70));lastCargoCollisions=cargo.collisions;}
            if(cargo.delivered>lastCargoDelivered){controllers.forEach(ctrl=>pulse(ctrl,.22,55));lastCargoDelivered=cargo.delivered;}
            audioFX.motor(active&&!cargo.busy?Math.abs(drive):0);
            if(active&&!cargo.busy){if(training&&cargo.delivered>0)completeLesson();else if(cargo.finished)finish();}
        }
        if (mode === 'drones'){
            trainingHalo.visible=training&&!drones[0].dead;trainingHalo.rotation.z+=dt*.45;
            ammoLamps.forEach((lamp,i)=>lamp.visible=i<ammo&&!reloading);bossBeacon.visible=!training&&roundAge>=40&&!ended;bossCaption.o.visible=bossBeacon.visible;if(bossBeacon.visible)bossCaption.write(`ФЛАГМАН · ${drones[8].hp}/6`);bossBeacon.rotation.z+=dt*.18;bossBeacon.scale.setScalar(1+.035*Math.sin(elapsed*3));
            for (let i = 0; i < drones.length; i++) {
                const d = drones[i];
                if (i === 8 && roundAge < 40) {
                    d.g.visible = false;
                    continue;
                }
                if (i === 8 && !d.dead)
                    d.g.visible = true;
                if (training) {
                    d.g.visible = i === 0 && !d.dead;
                    if (i === 0 && !d.dead) {
                        d.g.position.set(0, 2.6, -7);
                        d.g.rotation.set(0, 0, 0);
                    }
                    continue;
                }
                for (const part of d.g.children)
                    if (part.name === 'propeller')
                        part.rotation.y += dt * (d.dead ? 4 : 35);
                if (d.dead) {
                    const fall = falling(d.g.position.y, d.velocity, dt);
                    d.velocity = fall.velocity;
                    d.g.position.y = fall.y;
                    d.g.rotation.z += dt * 3;
                    d.g.rotation.x += dt * 2;
                    d.respawn -= dt;
                    if (d.g.position.y < .3)
                        d.g.visible = false;
                    if (d.respawn <= 0 && !ended) {
                        d.dead = false;
                        d.hp = d.maxHP;
                        d.g.visible = true;
                        d.g.rotation.set(0, 0, 0);
                    }
                }
                else if (!ended) {
                    d.g.position.set(Math.sin(elapsed * (d.kind === 'ФЛАГМАН' ? .22 : (d.kind === 'СКОРОСТНОЙ' ? .55 : .35) + Math.min(2, Math.floor(roundAge / 20)) * .13) + d.phase) * (4 + i * .4), 2.4 + (i % 3) * 1.4 + Math.sin(elapsed + d.phase) * .6, -8 - (i % 4) * 3);
                    d.g.rotation.y = Math.sin(elapsed + d.phase) * .3;
                }
            }
        }
        if (mode === 'hub'&&!paused()) {
            const headCamera = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
            const head = headCamera.getWorldPosition(new T.Vector3());
            let mx = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0), mz = (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0);
            for (const src of sources.values())
                if (src.handedness === 'left' && src.gamepad) {
                    const [x,y]=stick(src);
                    if (Math.abs(x) > .2)
                        mx = x;
                    if (Math.abs(y) > .2)
                        mz = y;
                }
            const direction = headCamera.getWorldDirection(new T.Vector3());
            direction.y = 0;
            direction.normalize();
            const side = new T.Vector3(-direction.z, 0, direction.x);
            const move = side.multiplyScalar(mx).addScaledVector(direction, -mz);
            if (move.length() > .1)
                learned.move = true;
            if (move.length() > 1)
                move.normalize();
            const candidate = head.clone().addScaledVector(move, dt * 2);
            if (Math.hypot(candidate.x, candidate.z + 11.5) > 3)
                rig.position.addScaledVector(move, dt * 2);
            rig.position.x = T.MathUtils.clamp(rig.position.x, -8, 8);
            rig.position.z = T.MathUtils.clamp(rig.position.z, -10, 5);
            if (head.x > 6.6 && Math.abs(head.z + 11) < 1.5)
                go('cargo');
            else if (head.z < -5 && head.z > -7) {
                if (Math.abs(head.x + 5.2) < 1.5)
                    go('robot');
                else if (Math.abs(head.x - 5.2) < 1.5)
                    go('drones');
            }
        }
        for(let i=0;i<controllers.length;i++)if(sources.has(controllers[i])&&controllers[i].visible){
            controllerRay(controllers[i]);const hit=raycaster.intersectObjects(actions.filter(visible),false)[0],target=hit?.object??null;
            if(target!==hoverTargets[i]){hoverTargets[i]=target;if(target)pulse(controllers[i],.08,20);}
            rays[i].scale.z=hit?Math.min(12,hit.distance):8;(rays[i].material as T.LineBasicMaterial).opacity=hit?.9:.42;tips[i].visible=!!hit;
            if(hit){tips[i].position.z=-hit.distance;tips[i].scale.setScalar(Math.max(1,hit.distance*.3));}
        }
        const hintText=mode==='cargo'?cargo.hint():'';if(hintText!==lastHint){lastHint=hintText;hooks.hint?.(hintText);}
        updateHUD();renderer.render(scene,camera);
        if(hooks.diagnostics){diagFrames++;if(t-diagTime>=1000){const info=renderer.info;
            hooks.diagnostics({fps:Math.round(diagFrames*1000/(t-diagTime)),calls:info.render.calls,triangles:info.render.triangles,geometries:info.memory.geometries,textures:info.memory.textures,xr:renderer.xr.isPresenting,scene:mode});diagTime=t;diagFrames=0;}}

    });
    go('hub');
    return {go,restart,welcome,train,cargoAction,setPresentation,nextVisitor,spin,reload,start,turn:snap,
        setPaused(value:boolean){pause('manual',value);},setHelpOpen(value:boolean){pause('help',value);},resume,
        toggleSound(){muted=audioFX.toggle();return muted;},
        key(k:string,on:boolean){if(!paused()&&on)keys.add(k);else keys.delete(k);},
        async enterVR(){
            if(sessionPending||renderer.xr.isPresenting||disposed)return;
            audioFX.unlock();
            if(!navigator.xr||supported===false)throw new Error('VR не поддерживается этим браузером. Откройте эту же HTTPS-ссылку в браузере гарнитуры Quest. На компьютере доступны все сцены без очков.');
            if(window.isSecureContext===false)throw new Error('Для VR требуется HTTPS или localhost.');
            sessionPending=true;pause('xr-switch',true);
            try{
                const session=await navigator.xr.requestSession('immersive-vr',{requiredFeatures:['local-floor']});
                if(disposed){await session.end();return;}
                try{await renderer.xr.setSession(session);}catch(e){await session.end();throw e;}
            }finally{sessionPending=false;if(!disposed)pause('xr-switch',false);}
        },
        async exitVR(){await renderer.xr.getSession()?.end();},
        dispose(){
            disposed=true;renderer.setAnimationLoop(null);
            renderer.xr.removeEventListener('sessionstart',sessionStart);renderer.xr.removeEventListener('sessionend',sessionEnd);
            observedSession?.removeEventListener('visibilitychange',xrVisibility);void renderer.xr.getSession()?.end();
            ro.disconnect();window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);window.removeEventListener('focus',focus);
            document.removeEventListener('visibilitychange',visibility);
            renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointermove',pointerMove);renderer.domElement.removeEventListener('pointerup',pointerUp);renderer.domElement.removeEventListener('pointercancel',pointerCancel);
            renderer.domElement.removeEventListener('webglcontextlost',contextLost);renderer.domElement.removeEventListener('webglcontextrestored',contextRestored);
            disposeBatches.forEach(dispose=>dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
            cargo.dispose();art.dispose();environment.dispose();audioFX.dispose();renderer.dispose();renderer.domElement.remove();
        }
    };
}
