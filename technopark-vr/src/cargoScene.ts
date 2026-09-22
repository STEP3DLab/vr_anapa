import * as T from 'three';
import {ARM, atBase, solveArm, overlapsBarrier, outsideField, segmentBlocked} from './cargoMath';
import {batchStatic} from './staticBatch';
// Demonstration layout inspired by the Losinoostrovskaya concept, not a surveyed digital twin.
export function createCargoScene(onEvent: (message: string) => void) {
    const root = new T.Group();
    root.name = 'losinka-polygon';
    const geometries: T.BufferGeometry[] = [], materials: T.Material[] = [], textures: T.Texture[] = [];
    function material(color: T.ColorRepresentation, metalness = .1) { const m = new T.MeshStandardMaterial({ color, metalness, roughness: .65 }); materials.push(m); return m; }
    const earth = material('#706b50'), sand = material('#a29372'), asphalt = material('#39464a'), steel = material('#b2b8b5', .65), darkSteel = material('#30383b', .75), body = material('#66665c', .5), red = material('#bb3823', .5), tire = material('#151d1d'), amber = material('#ddaf2f'), lime = material('#bddb76'), forest = material('#41625b');
    const workLight=new T.MeshBasicMaterial({color:0xffce69,toneMapped:false}),statusMat=new T.MeshBasicMaterial({color:0x8fffbd,toneMapped:false});materials.push(workLight,statusMat);
    function mesh(parent: T.Group, geometry: T.BufferGeometry, mat: T.Material, x = 0, y = 0, z = 0) { geometries.push(geometry); const m = new T.Mesh(geometry, mat); m.position.set(x, y, z); parent.add(m); return m; }
    const box = (p: T.Group, m: T.Material, x: number, y: number, z: number, w: number, h: number, d: number) => mesh(p, new T.BoxGeometry(w, h, d), m, x, y, z);
    const cylinder = (p: T.Group, m: T.Material, x: number, y: number, z: number, r: number, h: number) => mesh(p, new T.CylinderGeometry(r, r, h, 16), m, x, y, z);
    function label(text: string, x: number, y: number, z: number, w = 5) { const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 128; const c = canvas.getContext('2d')!; c.fillStyle = '#182c2c'; c.fillRect(0, 0, 1024, 128); c.font = 'bold 38px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#e3ebc4'; c.fillText(text, 512, 64, 980); const tex = new T.CanvasTexture(canvas); tex.colorSpace=T.SRGBColorSpace; tex.generateMipmaps=false;tex.minFilter=T.LinearFilter; textures.push(tex); const mat = new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide, toneMapped:false }); materials.push(mat); return mesh(root, new T.PlaneGeometry(w, w / 8), mat, x, y, z); }
    box(root, earth, 0, -.18, -8, 25, .35, 30);
    box(root, asphalt, 6, .008, -8, 6, .035, 23);
    box(root, sand, -6, .01, -9, 6, .04, 7);
    const rockGeo = new T.IcosahedronGeometry(.14, 0);
    geometries.push(rockGeo);
    const rocks = new T.InstancedMesh(rockGeo, body, 72);
    root.add(rocks);
    const rockTransform = new T.Object3D();
    for (let i = 0; i < 72; i++) {
        rockTransform.position.set(-8.7 + (i * 1.618 % 5.2), .085, -12.2 + (i * .73 % 6));
        rockTransform.scale.set(1, .7, 1.3);
        rockTransform.rotation.y = i;
        rockTransform.updateMatrix();
        rocks.setMatrixAt(i, rockTransform.matrix);
    }
    for (let i = 0; i < 9; i++)
        box(root, lime, 6, .033, 3 - i * 2.4, .12, .012, 1);
    const obstacles = [{ x: -3, z: -6, w: 4, d: .6 }, { x: 5, z: -14, w: 5, d: .6 }, { x: -8, z: -13, w: .6, d: 3 }, { x: 1, z: -18, w: 2, d: 2 }];
    for (const o of obstacles) {
        box(root, body, o.x, .45, o.z, o.w, .9, o.d);
        box(root, amber, o.x, .91, o.z, o.w, .035, o.d);
    }
    // Low triangular ramp; geometry and wheel contact heights use the same function.
    function heightAt(x: number, z: number) { return Math.abs(x) < 2 && z > -13 && z < -7 ? .65 * (1 - Math.abs(z + 10) / 3) : 0; }
    const rampGeo = new T.BufferGeometry();
    rampGeo.setAttribute('position', new T.Float32BufferAttribute([-2, 0, -7, 2, 0, -7, -2, .65, -10, 2, .65, -10, -2, 0, -13, 2, 0, -13], 3));
    rampGeo.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4]);
    rampGeo.computeVertexNormals();
    mesh(root, rampGeo, steel);
    for (const x of [-2, 2])
        for (let i = 0; i < 7; i++)
            box(root, amber, x, heightAt(x * .99, -7 - i) + .04, -7 - i, .09, .08, .28);
    const base = new T.Group();
    base.position.set(0, 0, 2);
    root.add(base);
    box(base, asphalt, 0, .02, 0, 6, .04, 4);
    for (const x of [-3, 3])
        box(base, lime, x, .05, 0, .08, .08, 4);
    for (const z of [-2, 2])
        box(base, lime, 0, .05, z, 6, .08, .08);
    const bayOff=new T.MeshBasicMaterial({color:0x40534a,toneMapped:false}),bayOn=new T.MeshBasicMaterial({color:0x8fffbd,toneMapped:false});materials.push(bayOff,bayOn);
    const deliveryBays:T.Mesh[]=[];for(let i=0;i<3;i++){const bay=box(base,bayOff,-1.9+i*1.9,.055,.55,1.45,.018,1.05);bay.name='cargo-delivery-bay-'+i;bay.userData.dynamic=true;deliveryBays.push(bay);}
    label('БАЗА / ДОСТАВКА ГРУЗОВ', 0, 1.25, 4.1, 4.5);
    label('ЛОСИНКА / ПОЛИГОН НРТК', 0, 4.5, -23, 11);
    label('ДЕМОНСТРАЦИОННАЯ ПЛАНИРОВКА', 0, 3.6, -23, 8);
    label('ГРУНТ И КАМНИ', -6, .8, -13.5, 3);
    label('АСФАЛЬТ', 7, .8, -20, 3);
    label('РАМПА', 0, 1, -14, 2.4);
    // Lightweight perimeter trees and fence.
    for (let i = 0; i < 22; i++) {
        const x = i % 2 ? -12 : 12, z = 5 - Math.floor(i / 2) * 2.6;
        cylinder(root, body, x, .7, z, .1, 1.4);
        mesh(root, new T.ConeGeometry(.85, 2.5, 6), forest, x, 2, z);
    }
    for (const x of [-10.7, 10.7]) {
        box(root, steel, x, .65, -8, .08, .08, 28);
        for (let i = 0; i < 8; i++)
            box(root, steel, x, .5, 5 - i * 4, .08, 1, .08);
    }
    // Six wheel cargo carrier reconstructed stylistically from the supplied reference images.
    const robot = new T.Group();
    robot.name = 'cargo-rover';
    robot.rotation.order = 'YXZ';
    root.add(robot);
    const wheels: T.Mesh[] = [];
    box(robot, body, 0, .85, 0, 1.8, .65, 2.9);
    box(robot, steel, 0, 1.19, .3, 1.8, .1, 2.1);
    // Side armour and top service hatch make the silhouette closer to the supplied CAD views
    // while keeping the rover procedural and inexpensive for a standalone headset.
    for(const side of [-1,1]){
        box(robot,darkSteel,side*.91,.92,-.15,.07,.52,2.28);
        for(const z of [-.84,-.28,.28,.84])box(robot,steel,side*.95,1.04,z,.025,.3,.42);
    }
    box(robot,darkSteel,0,1.29,.72,1.08,.08,.86);
    box(robot,steel,0,1.35,.72,.9,.045,.68);
    for(const x of [-.28,.28])for(const z of [.52,.92])cylinder(robot,darkSteel,x,1.44,z,.025,.14);
    // Front grille, work lights and a compact status beacon improve recognisability from the fixed VR viewpoint.
    box(robot,darkSteel,0,.9,-1.48,1.62,.46,.07);for(const x of [-.58,-.29,0,.29,.58])box(robot,steel,x,.9,-1.525,.055,.32,.025);
    for(const x of [-.56,.56]){const light=cylinder(robot,workLight,x,1.08,-1.53,.085,.035);light.rotation.x=Math.PI/2;}
    const statusLamp=mesh(robot,new T.SphereGeometry(.075,10,6),statusMat,0,1.5,.72);statusLamp.name='cargo-status-lamp';
    box(robot, amber, 0, .9, 1.85, 1.8, .12, 1.05);
    for(const x of [-.9,.9])box(robot, amber, x, 1.02, 1.85, .06,.2,1.05);
    box(robot, amber, 0,1.02,2.35,1.8,.2,.06);
    for(const x of [-.72,.72]){const hinge=cylinder(robot,darkSteel,x,1.02,1.34,.075,.18);hinge.rotation.z=Math.PI/2;}
    for (const x of [-.87, .87])
        box(robot, steel, x, 1.37, .3, .06, .32, 2.1);
    for (let i = 0; i < 5; i++)
        for (const x of [-.55, 0, .55])
            box(robot, body, x, 1.25, -.45 + i * .35, .47, .035, .27);
    const wheelGeo = new T.CylinderGeometry(.51, .51, .34, 20);
    geometries.push(wheelGeo);
    const treadGeo = new T.BoxGeometry(.39, .1, .17);
    geometries.push(treadGeo);
    const tread = new T.InstancedMesh(treadGeo, tire, 72);
    robot.add(tread);
    const rimGeo=new T.TorusGeometry(.31,.035,6,20);geometries.push(rimGeo);const wheelRims=new T.InstancedMesh(rimGeo,steel,6);wheelRims.name='cargo-wheel-rims';robot.add(wheelRims);
    const dummy = new T.Object3D(),rimDummy=new T.Object3D();let rimIndex=0;
    for (const x of [-1.04, 1.04])
        for (const z of [-1, 0, 1]) {
            const w = new T.Mesh(wheelGeo, tire);
            w.name = 'cargo-wheel';
            w.rotation.z = Math.PI / 2;
            w.position.set(x, .53, z);
            robot.add(w);
            wheels.push(w);
            const hub = cylinder(robot, steel, x + Math.sign(x) * .19, .53, z, .28, .045);
            hub.rotation.z = Math.PI / 2;
            rimDummy.position.set(x+Math.sign(x)*.205,.53,z);rimDummy.rotation.set(0,Math.PI/2,0);rimDummy.updateMatrix();wheelRims.setMatrixAt(rimIndex++,rimDummy.matrix);
        }
    const shoulder = new T.Vector3(ARM.shoulder.x,ARM.shoulder.y,ARM.shoulder.z);
    const elbow = new T.Vector3(), tip = new T.Vector3(0,1.25,-3.45);
    // Near-extended parking pose reads closer to the long folded boom in the supplied CAD views.
    const restTip=tip.clone(), deck=new T.Vector3(0,1.31,1.85), up=new T.Vector3(0,1,0);
    cylinder(robot,steel,0,1.29,-.85,.4,.16);
    const turret=cylinder(robot,red,0,1.46,-.85,.28,.3);
    const upper=box(robot,red,0,0,0,.42,1,.26), fore=box(robot,red,0,0,0,.34,1,.23);
    const upperSideA=box(robot,red,0,0,0,.13,1,.38),upperSideB=box(robot,red,0,0,0,.13,1,.38);
    const foreSideA=box(robot,red,0,0,0,.12,1,.33),foreSideB=box(robot,red,0,0,0,.12,1,.33);
    upper.name='cargo-upper-link'; fore.name='cargo-fore-link';
    function beam(m:T.Mesh,a:T.Vector3,b:T.Vector3){
        m.position.copy(a).lerp(b,.5);m.scale.y=a.distanceTo(b);
        m.quaternion.setFromUnitVectors(up,b.clone().sub(a).normalize());
    }
    const pins=[shoulder,elbow,tip].map(()=>cylinder(robot,red,0,0,0,.21,.43));
    const barrel1=cylinder(robot,body,0,0,0,.065,1),rod1=cylinder(robot,steel,0,0,0,.035,1);
    const barrel2=cylinder(robot,body,0,0,0,.06,1),rod2=cylinder(robot,steel,0,0,0,.03,1);
    function hydraulic(barrel:T.Mesh,rod:T.Mesh,a:T.Vector3,b:T.Vector3){
        const middle=a.clone().lerp(b,.55);beam(barrel,a,middle);beam(rod,middle,b);
    }
    const claw=new T.Group();claw.name='cargo-claw';robot.add(claw);
    cylinder(claw,steel,0,.05,0,.17,.23);
    box(claw,steel,0,-.04,0,.62,.12,.34);
    const jaws=[new T.Group(),new T.Group()];
    jaws.forEach((jaw,i)=>{claw.add(jaw);box(jaw,steel,0,-.31,0,.1,.56,.42);
        box(jaw,amber,i===0?.062:-.062,-.31,0,.035,.4,.36);
        box(jaw,steel,i===0?.08:-.08,-.58,0,.22,.075,.42);});
    let jawOpening=.54;
    const packages:T.Mesh[]=[], markers:{beacon:T.Mesh;label:T.Mesh}[]=[];
    const starts=[new T.Vector3(-5,.36,-3),new T.Vector3(6,.36,-10),new T.Vector3(-5,.36,-18)];
    const markerReady=new T.MeshBasicMaterial({color:0x82ffb0,toneMapped:false}),markerWaiting=new T.MeshBasicMaterial({color:0xdab34f,toneMapped:false});
    const navMat=new T.MeshBasicMaterial({color:0xffcf66,toneMapped:false}),baseBeaconMat=new T.MeshBasicMaterial({color:0x8fffbd,transparent:true,opacity:.68,toneMapped:false});
    materials.push(markerReady,markerWaiting,navMat,baseBeaconMat);
    const nav=new T.Group();nav.name='cargo-nav';robot.add(nav);
    const navArrow=mesh(nav,new T.ConeGeometry(.18,.58,3),navMat,0,2.28,-.26);navArrow.rotation.x=-Math.PI/2;
    const navRing=mesh(nav,new T.TorusGeometry(.29,.026,6,28),navMat,0,2.28,0);navRing.rotation.x=Math.PI/2;
    const baseBeacon=new T.Group();baseBeacon.name='cargo-base-beacon';baseBeacon.position.set(0,.105,2);root.add(baseBeacon);
    for(const x of [-3,3])box(baseBeacon,baseBeaconMat,x,0,0,.11,.025,4.05);
    for(const z of [-2,2])box(baseBeacon,baseBeaconMat,0,0,z,6.05,.025,.11);
    baseBeacon.visible=false;
    starts.forEach((p,i)=>{
        const crate=box(root,i===1?lime:amber,p.x,p.y,p.z,.7,.7,.7);crate.name='cargo-package-'+i;crate.userData.dynamic=true;packages.push(crate);
        // Contrast straps make small loads readable from the fixed observation point.
        for(const z of [-.19,.19])box(crate as unknown as T.Group,body,0,.355,z,.71,.012,.055);
        const beacon=mesh(root,new T.RingGeometry(.85,1.0,32),markerWaiting,p.x,.045,p.z);
        beacon.rotation.x=-Math.PI/2;beacon.userData.dynamic=true;
        const plate=label('ГРУЗ '+(i+1),p.x,1.35,p.z,1.8);markers.push({beacon,label:plate});
    });
    const readyBase=box(base,markerReady,0,.055,0,5.8,.012,3.8);readyBase.visible=false;
    const point=new T.Vector3(),local=new T.Vector3(),shoulderWorld=new T.Vector3(),dropScratch=new T.Vector3(),navScratch=new T.Vector3();
    type Job={kind:'pickup'|'unload';item:T.Mesh;t:number;from:T.Vector3;to:T.Vector3;start:T.Vector3;gripped:boolean;released:boolean};
    let job:Job|null=null,carried:T.Mesh|null=null,delivered=0,velocity=0,turnVelocity=0,distance=0,collisions=0,collisionDelay=0,finished=false,navTime=0;
    const wheelPhases=new Array(6).fill(0);
    const smooth=(u:number)=>T.MathUtils.smoothstep(u,0,1);
    function isStopped(){return Math.abs(velocity)<.22&&Math.abs(turnVelocity)<.12;}
    function pickupTarget(){
        robot.updateWorldMatrix(true,false);
        shoulderWorld.copy(shoulder);robot.localToWorld(shoulderWorld);
        const fx=-Math.sin(robot.rotation.y),fz=-Math.cos(robot.rotation.y);
        let best:T.Mesh|null=null,bestDistance=Infinity;
        for(const p of packages){
            if(p.userData.delivered||p===carried)continue;
            p.getWorldPosition(point);const dx=point.x-robot.position.x,dz=point.z-robot.position.z,d=Math.hypot(dx,dz);
            if(d<1.55||d>3.7||(dx*fx+dz*fz)/d<=.58)continue;
            local.copy(point).addScaledVector(up,ARM.gripOffset);robot.worldToLocal(local);
            if(!solveArm(local).reachable||segmentBlocked(shoulderWorld,point,obstacles))continue;
            if(d<bestDistance){bestDistance=d;best=p;}
        }
        return best;
    }
    // Find a reachable free place on the painted base, not an instantaneous teleport to a slot.
    function unloadPoint(){
        if(!atBase(robot.position.x,robot.position.z))return null;
        robot.updateWorldMatrix(true,false);
        for(let i=0;i<20;i++){
            const angle=Math.PI/2+(i%2?1:-1)*Math.ceil(i/2)*Math.PI/10;
            dropScratch.set(Math.sin(angle)*2.3,.36,Math.cos(angle)*2.3);robot.localToWorld(dropScratch);dropScratch.y=.36;
            if(Math.abs(dropScratch.x)>2.8||Math.abs(dropScratch.z-2)>1.8)continue;
            if(packages.some(p=>p.userData.delivered&&p.position.distanceTo(dropScratch)<.9))continue;
            point.copy(dropScratch).addScaledVector(up,ARM.gripOffset);robot.worldToLocal(point);
            const low=solveArm(point),high=solveArm({x:point.x,y:2.65,z:point.z});
            if(low.reachable&&high.reachable)return dropScratch.copy(point);
        }
        return null;
    }
    function guidance(){
        if(finished)return 'ДОСТАВЛЕНО 3/3 · МИССИЯ ВЫПОЛНЕНА';
        if(job)return job.t<1.9?'МАНИПУЛЯТОР: НАВЕДЕНИЕ И ЗАХВАТ':job.t<4?'МАНИПУЛЯТОР: ПЕРЕНОС ГРУЗА':'МАНИПУЛЯТОР: УКЛАДКА И ВОЗВРАТ';
        if(carried){
            if(!atBase(robot.position.x,robot.position.z))return 'ГРУЗ НА ПЛАТФОРМЕ · ВЕРНИТЕСЬ НА ЗЕЛЁНУЮ БАЗУ';
            if(!isStopped())return 'БАЗА · ОТПУСТИТЕ СТИК И ОСТАНОВИТЕСЬ';
            return unloadPoint()?'БАЗА ГОТОВА · КУРОК / ПРОБЕЛ: ВЫГРУЗИТЬ':'ПОДЪЕДЬТЕ В ЦЕНТР БАЗЫ ДЛЯ ВЫГРУЗКИ';
        }
        const target=pickupTarget();
        if(target)return isStopped()?'ГРУЗ '+(packages.indexOf(target)+1)+' ДОСТУПЕН · КУРОК / ПРОБЕЛ: ЗАХВАТ':'ГРУЗ В ЗОНЕ ЗАХВАТА · ОТПУСТИТЕ СТИК';
        const next=packages.filter(p=>!p.userData.delivered).sort((a,b)=>a.position.distanceToSquared(robot.position)-b.position.distanceToSquared(robot.position))[0];
        return next?'ГРУЗ '+(packages.indexOf(next)+1)+' · '+Math.round(next.position.distanceTo(robot.position))+' М · ПОДЪЕДЬТЕ ПЕРЕДНЕЙ ЧАСТЬЮ':'ДОСТАВКА ЗАВЕРШЕНА';
    }
    function reset(){
        carried=null;job=null;delivered=0;velocity=0;turnVelocity=0;distance=0;collisions=0;collisionDelay=0;finished=false;navTime=0;
        deliveryBays.forEach(b=>b.material=bayOff);
        robot.position.set(0,0,1);robot.rotation.set(0,0,0);tip.copy(restTip);jawOpening=.54;wheelPhases.fill(0);nav.visible=true;baseBeacon.visible=false;
        packages.forEach((p,i)=>{root.add(p);p.position.copy(starts[i]);p.rotation.set(0,0,0);p.userData.delivered=false;});
        markers.forEach(m=>{m.beacon.visible=true;m.label.visible=true;});readyBase.visible=false;
    }
    function interact(){
        if(job||finished)return;
        if(!isStopped()){onEvent('ОСТАНОВИТЕ РОБОТА: ОТПУСТИТЕ ЛЕВЫЙ СТИК');return;}
        const target=carried?null:pickupTarget(),drop=carried?unloadPoint():null;
        if(carried&&!drop){onEvent(guidance());return;}
        if(!carried&&!target){onEvent(guidance());return;}
        robot.updateWorldMatrix(true,true);
        const item=carried??target!;
        const from=carried?deck.clone().addScaledVector(up,ARM.gripOffset):robot.worldToLocal(item.getWorldPosition(new T.Vector3()).addScaledVector(up,ARM.gripOffset));
        job={kind:carried?'unload':'pickup',item,t:0,from,to:drop?drop.clone():deck.clone().addScaledVector(up,ARM.gripOffset),start:tip.clone(),gripped:false,released:false};
        velocity=0;turnVelocity=0;onEvent(carried?'ВЫГРУЗКА: МАНИПУЛЯТОР РАБОТАЕТ':'ЗАХВАТ: МАНИПУЛЯТОР РАБОТАЕТ');
    }
    function transfer(a:T.Vector3,b:T.Vector3,u:number){
        const start=Math.atan2(a.x-shoulder.x,-(a.z-shoulder.z)),end=Math.atan2(b.x-shoulder.x,-(b.z-shoulder.z));
        const delta=Math.atan2(Math.sin(end-start),Math.cos(end-start)),angle=start+delta*smooth(u);
        const radius=T.MathUtils.lerp(Math.hypot(a.x-shoulder.x,a.z-shoulder.z),Math.hypot(b.x-shoulder.x,b.z-shoulder.z),smooth(u));
        tip.set(shoulder.x+Math.sin(angle)*radius,2.65,shoulder.z-Math.cos(angle)*radius);
    }
    function animateJob(dt:number){
        if(!job)return;const j=job;j.t+=dt;const t=j.t;
        // Empty approach and return also pass ABOVE the chassis, not through it.
        if(t<.35){tip.copy(j.start);tip.y=T.MathUtils.lerp(j.start.y,2.65,smooth(t/.35));jawOpening=.54;}
        else if(t<1.1)transfer(j.start,j.from,(t-.35)/.75);
        else if(t<1.65){tip.copy(j.from);tip.y=T.MathUtils.lerp(2.65,j.from.y,smooth((t-1.1)/.55));}
        else if(t<1.9){tip.copy(j.from);jawOpening=T.MathUtils.lerp(.54,.405,smooth((t-1.65)/.25));}
        else{
            if(!j.gripped){robot.attach(j.item);carried=j.item;j.gripped=true;}
            if(t<2.5){tip.copy(j.from);tip.y=T.MathUtils.lerp(j.from.y,2.65,smooth((t-1.9)/.6));}
            else if(t<3.4)transfer(j.from,j.to,(t-2.5)/.9);
            else if(t<4){tip.copy(j.to);tip.y=T.MathUtils.lerp(2.65,j.to.y,smooth((t-3.4)/.6));}
            else{
                if(!j.released){
                    tip.copy(j.to);j.item.position.copy(j.to).addScaledVector(up,-ARM.gripOffset);j.item.rotation.set(0,0,0);
                    if(j.kind==='unload'){
                        robot.updateWorldMatrix(true,true);root.attach(j.item);j.item.position.y=.36;j.item.userData.delivered=true;
                        carried=null;delivered++;deliveryBays.forEach((b,i)=>b.material=i<delivered?bayOn:bayOff);onEvent('ДОСТАВЛЕНО '+delivered+'/3');
                    }
                    j.released=true;
                }
                jawOpening=T.MathUtils.lerp(.405,.54,smooth((t-4)/.25));
                if(t<4.25)tip.copy(j.to);
                else if(t<4.65){tip.copy(j.to);tip.y=T.MathUtils.lerp(j.to.y,2.65,smooth((t-4.25)/.4));}
                else if(t<5.4)transfer(j.to,restTip,(t-4.65)/.75);
                else{tip.copy(restTip);tip.y=T.MathUtils.lerp(2.65,restTip.y,smooth((t-5.4)/.5));}
            }
            if(j.gripped&&!j.released){
                j.item.position.copy(tip).addScaledVector(up,-ARM.gripOffset);
                j.item.rotation.set(0,Math.atan2(tip.x-shoulder.x,-(tip.z-shoulder.z)),0);
            }
        }
        if(t>=5.9){job=null;tip.copy(restTip);finished=delivered===3;
            onEvent(finished?'ВСЕ ГРУЗЫ ДОСТАВЛЕНЫ':carried?'ГРУЗ НА ПЛАТФОРМЕ · ВЕРНИТЕСЬ НА БАЗУ':'ЗАХВАТ СВОБОДЕН · НАЙДИТЕ СЛЕДУЮЩИЙ ГРУЗ');}
    }
    function update(dt:number,drive:number,turn:number,active:boolean){
        collisionDelay=Math.max(0,collisionDelay-dt);navTime+=dt;
        const speedFactor=robot.position.x< -3&&robot.position.z< -5&&robot.position.z> -14?.65:1;
        velocity=active&&!job&&!finished?T.MathUtils.damp(velocity,drive*3.3*speedFactor,7,dt):0;
        turnVelocity=active&&!job&&!finished?turn*1.65:0;
        const blocked=(x:number,z:number,yaw:number)=>outsideField(x,z,yaw)||obstacles.some(o=>overlapsBarrier(x,z,yaw,o));
        const yaw=robot.rotation.y+turnVelocity*dt;
        let collision=false;
        if(turnVelocity&&blocked(robot.position.x,robot.position.z,yaw)){turnVelocity=0;collision=true;}else robot.rotation.y=yaw;
        const nx=robot.position.x-Math.sin(robot.rotation.y)*velocity*dt,nz=robot.position.z-Math.cos(robot.rotation.y)*velocity*dt;
        if(velocity&&blocked(nx,nz,robot.rotation.y)){velocity=0;collision=true;}
        else{distance+=Math.hypot(nx-robot.position.x,nz-robot.position.z);robot.position.x=nx;robot.position.z=nz;}
        if(collision&&!collisionDelay){collisions++;collisionDelay=1;onEvent('ПРЕПЯТСТВИЕ · СДАЙТЕ НАЗАД И ОБЪЕДЬТЕ');}
        // Average all six wheel contacts; no discontinuous centre-only height jump at a ramp edge.
        const yawNow=robot.rotation.y,c=Math.cos(yawNow),sn=Math.sin(yawNow);
        const contacts=wheels.map(w=>heightAt(robot.position.x+c*w.position.x+sn*w.position.z,robot.position.z-sn*w.position.x+c*w.position.z));
        const front=(contacts[0]+contacts[3])/2,rear=(contacts[2]+contacts[5])/2,left=(contacts[0]+contacts[1]+contacts[2])/3,right=(contacts[3]+contacts[4]+contacts[5])/3;
        robot.position.y=T.MathUtils.damp(robot.position.y,contacts.reduce((a,b)=>a+b,0)/6,14,dt);
        robot.rotation.x=T.MathUtils.damp(robot.rotation.x,Math.atan2(front-rear,2),14,dt);
        robot.rotation.z=T.MathUtils.damp(robot.rotation.z,Math.atan2(right-left,2.08),14,dt);
        let k=0;
        if(active||dt===0)for(let i=0;i<wheels.length;i++){
            const w=wheels[i];wheelPhases[i]+=(velocity+Math.sign(w.position.x)*turnVelocity*1.04)*dt/.51;
            for(let j=0;j<12;j++){const a=j/12*Math.PI*2+wheelPhases[i];dummy.position.set(w.position.x,.53+Math.cos(a)*.51,w.position.z+Math.sin(a)*.51);dummy.rotation.set(a,0,0);dummy.updateMatrix();tread.setMatrixAt(k++,dummy.matrix);}
        }
        if(active||dt===0)tread.instanceMatrix.needsUpdate=true;
        if(active)animateJob(dt);
        const solution=solveArm(tip);elbow.set(solution.elbow.x,solution.elbow.y,solution.elbow.z);tip.set(solution.wrist.x,solution.wrist.y,solution.wrist.z);
        const turretYaw=Math.atan2(tip.x-shoulder.x,-(tip.z-shoulder.z));turret.rotation.y=turretYaw;
        const tangent=new T.Vector3(Math.cos(turretYaw),0,Math.sin(turretYaw));
        beam(upper,shoulder,elbow);beam(fore,elbow,tip);
        beam(upperSideA,shoulder,elbow);upperSideA.position.addScaledVector(tangent,.22);beam(upperSideB,shoulder,elbow);upperSideB.position.addScaledVector(tangent,-.22);
        beam(foreSideA,elbow,tip);foreSideA.position.addScaledVector(tangent,.18);beam(foreSideB,elbow,tip);foreSideB.position.addScaledVector(tangent,-.18);
        pins.forEach((p,i)=>{p.position.copy([shoulder,elbow,tip][i]);p.quaternion.setFromUnitVectors(up,tangent);});
        const offset=tangent.clone().multiplyScalar(.2);
        hydraulic(barrel1,rod1,shoulder.clone().add(offset).addScaledVector(up,-.12),elbow.clone().add(offset).lerp(shoulder,.22));
        hydraulic(barrel2,rod2,elbow.clone().add(offset).lerp(shoulder,.26),elbow.clone().add(offset).lerp(tip,.45));
        claw.position.copy(tip);claw.rotation.y=turretYaw;jaws[0].position.x=-jawOpening;jaws[1].position.x=jawOpening;
        statusMat.color.set(job?0xffb45f:carried?0x8fffbd:finished?0x72ffe2:0xffd56e);statusLamp.scale.setScalar(job?1+.22*Math.sin(navTime*8):1);
        const target=!carried&&!job?pickupTarget():null;
        markers.forEach((m,i)=>{const available=!packages[i].userData.delivered&&packages[i]!==carried&&job?.item!==packages[i];m.beacon.visible=available;m.label.visible=available;m.beacon.material=packages[i]===target&&isStopped()?markerReady:markerWaiting;});
        readyBase.visible=!!carried&&!job&&isStopped()&&!!unloadPoint();
        baseBeacon.visible=!!carried&&!job&&!finished;baseBeacon.scale.setScalar(1+.025*Math.sin(navTime*4));baseBeaconMat.opacity=.52+.18*(.5+.5*Math.sin(navTime*4));
        nav.visible=!job&&!finished;
        if(nav.visible){
            if(carried)navScratch.set(0,0,2);else{
                let nearest:T.Mesh|null=null,best=Infinity;for(const p of packages)if(!p.userData.delivered&&p!==carried){const d=p.position.distanceToSquared(robot.position);if(d<best){best=d;nearest=p;}}
                if(nearest)nearest.getWorldPosition(navScratch);else nav.visible=false;
            }
            if(nav.visible){robot.worldToLocal(navScratch);nav.rotation.y=Math.atan2(-navScratch.x,-navScratch.z);nav.scale.setScalar(.94+.06*(.5+.5*Math.sin(navTime*5)));navMat.color.set(carried?0x8fffbd:0xffcf66);}
        }
    }
    reset();update(0,0,0,false);
    // Merge rigid chassis details by material. Wheels and every articulated part stay separate for simulation/animation.
    const dynamicRobot=new Set<T.Object3D>([...wheels,turret,upper,fore,upperSideA,upperSideB,foreSideA,foreSideB,...pins,barrel1,rod1,barrel2,rod2,statusLamp]);
    const disposeRobotStatic=batchStatic(robot,dynamicRobot);
    const disposeStatic=batchStatic(root,new Set(packages));
    return {root,robot,packages,reset,update,interact,stop(){velocity=0;turnVelocity=0;},
        get delivered(){return delivered;},get loaded(){return !!carried;},get busy(){return !!job;},get finished(){return finished;},get distance(){return distance;},get collisions(){return collisions;},
        hint:guidance,
        actionLabel(){return job?'Манипулятор работает…':carried?'Выгрузить груз':'Захватить груз';},
        status(){return `Грузы ${delivered}/3 · ${job?'Манипулятор работает':carried?'Груз на платформе':'Захват свободен'} · ${Math.round(distance)} м · Столкновения ${collisions}`;},
        dispose(){disposeStatic();disposeRobotStatic();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
    };
}
