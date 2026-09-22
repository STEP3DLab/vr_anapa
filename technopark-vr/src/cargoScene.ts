import * as T from 'three';
// Demonstration layout inspired by the Losinoostrovskaya concept, not a surveyed digital twin.
export function createCargoScene(onEvent:(message:string)=>void){
 const root=new T.Group();root.name='losinka-polygon';
 const geometries:T.BufferGeometry[]=[],materials:T.Material[]=[],textures:T.Texture[]=[];
 function material(color:T.ColorRepresentation,metalness=.1){const m=new T.MeshStandardMaterial({color,metalness,roughness:.65});materials.push(m);return m;}
 const earth=material('#706b50'),sand=material('#a29372'),asphalt=material('#39464a'),steel=material('#b2b8b5',.65),body=material('#66665c',.5),red=material('#bb3823',.5),tire=material('#151d1d'),amber=material('#ddaf2f'),lime=material('#bddb76'),forest=material('#41625b');
 function mesh(parent:T.Group,geometry:T.BufferGeometry,mat:T.Material,x=0,y=0,z=0){geometries.push(geometry);const m=new T.Mesh(geometry,mat);m.position.set(x,y,z);parent.add(m);return m;}
 const box=(p:T.Group,m:T.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>mesh(p,new T.BoxGeometry(w,h,d),m,x,y,z);
 const cylinder=(p:T.Group,m:T.Material,x:number,y:number,z:number,r:number,h:number)=>mesh(p,new T.CylinderGeometry(r,r,h,16),m,x,y,z);
 function label(text:string,x:number,y:number,z:number,w=5){const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;const c=canvas.getContext('2d')!;c.fillStyle='#182c2c';c.fillRect(0,0,1024,128);c.font='bold 38px Arial';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#e3ebc4';c.fillText(text,512,64,980);const tex=new T.CanvasTexture(canvas);textures.push(tex);const mat=new T.MeshBasicMaterial({map:tex,side:T.DoubleSide});materials.push(mat);return mesh(root,new T.PlaneGeometry(w,w/8),mat,x,y,z);}
 box(root,earth,0,-.18,-8,25,.35,30);box(root,asphalt,6,.008,-8,6,.035,23);box(root,sand,-6,.01,-9,6,.04,7);
 const rockGeo=new T.IcosahedronGeometry(.14,0);geometries.push(rockGeo);const rocks=new T.InstancedMesh(rockGeo,body,72);root.add(rocks);const rockTransform=new T.Object3D();for(let i=0;i<72;i++){rockTransform.position.set(-8.7+(i*1.618%5.2),.085,-12.2+(i*.73%6));rockTransform.scale.set(1,.7,1.3);rockTransform.rotation.y=i;rockTransform.updateMatrix();rocks.setMatrixAt(i,rockTransform.matrix);}
 for(let i=0;i<9;i++)box(root,lime,6,.033,3-i*2.4,.12,.012,1);
 const obstacles=[{x:-3,z:-6,w:4,d:.6},{x:5,z:-14,w:5,d:.6},{x:-8,z:-13,w:.6,d:3},{x:1,z:-18,w:2,d:2}];
 for(const o of obstacles){box(root,body,o.x,.45,o.z,o.w,.9,o.d);box(root,amber,o.x,.91,o.z,o.w,.035,o.d);}
 // Low triangular ramp; geometry and wheel contact heights use the same function.
 function heightAt(x:number,z:number){return Math.abs(x)<2&&z>-13&&z< -7?.65*(1-Math.abs(z+10)/3):0;}
 const rampGeo=new T.BufferGeometry();rampGeo.setAttribute('position',new T.Float32BufferAttribute([-2,0,-7,2,0,-7,-2,.65,-10,2,.65,-10,-2,0,-13,2,0,-13],3));rampGeo.setIndex([0,1,2,1,3,2,2,3,4,3,5,4]);rampGeo.computeVertexNormals();mesh(root,rampGeo,steel);
 for(const x of [-2,2])for(let i=0;i<7;i++)box(root,amber,x,heightAt(x*.99,-7-i)+.04,-7-i,.09,.08,.28);
 const base=new T.Group();base.position.set(0,0,2);root.add(base);box(base,asphalt,0,.02,0,6,.04,4);for(const x of [-3,3])box(base,lime,x,.05,0,.08,.08,4);for(const z of [-2,2])box(base,lime,0,.05,z,6,.08,.08);
 label('БАЗА / ДОСТАВКА ГРУЗОВ',0,1.25,4.1,4.5);label('ЛОСИНКА / ПОЛИГОН НРТК',0,4.5,-23,11);label('ДЕМОНСТРАЦИОННАЯ ПЛАНИРОВКА',0,3.6,-23,8);label('ГРУНТ И КАМНИ',-6,.8,-13.5,3);label('АСФАЛЬТ',7,.8,-20,3);label('РАМПА',0,1,-14,2.4);
 // Lightweight perimeter trees and fence.
 for(let i=0;i<22;i++){const x=i%2?-12:12,z=5-Math.floor(i/2)*2.6;cylinder(root,body,x,.7,z,.1,1.4);mesh(root,new T.ConeGeometry(.85,2.5,6),forest,x,2,z);}
 for(const x of [-10.7,10.7]){box(root,steel,x,.65,-8,.08,.08,28);for(let i=0;i<8;i++)box(root,steel,x,.5,5-i*4,.08,1,.08);}
 // Six wheel cargo carrier reconstructed stylistically from the supplied reference images.
 const robot=new T.Group();robot.name='cargo-rover';robot.rotation.order='YXZ';root.add(robot);const wheels:T.Mesh[]=[];
 box(robot,body,0,.85,0,1.8,.65,2.9);box(robot,steel,0,1.19,.3,1.8,.1,2.1);box(robot,amber,0,.72,1.9,1.8,.12,1.05);
 for(const x of [-.87,.87])box(robot,steel,x,1.37,.3,.06,.32,2.1);
 for(let i=0;i<5;i++)for(const x of [-.55,0,.55])box(robot,body,x,1.25,-.45+i*.35,.47,.035,.27);
 const wheelGeo=new T.CylinderGeometry(.51,.51,.34,20);geometries.push(wheelGeo);const treadGeo=new T.BoxGeometry(.39,.1,.17);geometries.push(treadGeo);const tread=new T.InstancedMesh(treadGeo,tire,72);robot.add(tread);const dummy=new T.Object3D();
 let wheelPhase=0;for(const x of [-1.04,1.04])for(const z of [-1,0,1]){const w=new T.Mesh(wheelGeo,tire);w.name='cargo-wheel';w.rotation.z=Math.PI/2;w.position.set(x,.53,z);robot.add(w);wheels.push(w);const hub=cylinder(robot,steel,x+Math.sign(x)*.19,.53,z,.28,.045);hub.rotation.z=Math.PI/2;}
 const shoulder=new T.Vector3(0,1.55,-.8),elbow=new T.Vector3(0,2.3,-1.1);cylinder(robot,steel,0,1.29,-.8,.4,.16);cylinder(robot,red,0,1.46,-.8,.28,.3);
 const upper=box(robot,red,0,0,0,.28,1,.28),fore=box(robot,red,0,0,0,.22,1,.22),piston=box(robot,steel,0,0,0,.075,1,.075);
 function beam(m:T.Mesh,a:T.Vector3,b:T.Vector3){m.position.copy(a).lerp(b,.5);m.scale.y=a.distanceTo(b);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());}
 const claw=new T.Group();robot.add(claw);box(claw,steel,0,0,0,.4,.16,.35);const jaws=[box(claw,amber,-.25,-.2,0,.12,.4,.36),box(claw,amber,.25,-.2,0,.12,.4,.36)];
 const packages:T.Mesh[]=[];const starts=[new T.Vector3(-5,.36,-3),new T.Vector3(6,.36,-10),new T.Vector3(-5,.36,-18)];
 starts.forEach((p,i)=>{const crate=box(root,i===1?lime:amber,p.x,p.y,p.z,.7,.7,.7);crate.name='cargo-package-'+i;packages.push(crate);const beacon=cylinder(root,lime,p.x,.025,p.z,.85,.025);label('ГРУЗ '+(i+1),p.x,1.3,p.z,1.8);});
 let carried:T.Mesh|null=null,delivered=0,busy=0,pickupStart=new T.Vector3(),velocity=0,distance=0,collisions=0,collisionDelay=0,finished=false;
 function reset(){carried=null;delivered=0;busy=0;velocity=0;distance=0;collisions=0;collisionDelay=0;finished=false;robot.position.set(0,0,1);robot.rotation.set(0,0,0);packages.forEach((p,i)=>{root.add(p);p.position.copy(starts[i]);p.rotation.set(0,0,0);p.userData.delivered=false;});}
 function interact(){if(busy||finished)return;if(Math.abs(velocity)>.35){onEvent('ОСТАНОВИТЕ РОБОТА ПЕРЕД ЗАХВАТОМ');return;}if(carried){if(Math.hypot(robot.position.x,robot.position.z-2)>2.5){onEvent('ГРУЗ НА БОРТУ / ВЕРНИТЕСЬ НА БАЗУ');return;}root.attach(carried);carried.position.set(-1.5+delivered*1.1,.4,3);carried.rotation.set(0,0,0);carried.userData.delivered=true;carried=null;delivered++;if(delivered===3){finished=true;onEvent('ВСЕ ГРУЗЫ ДОСТАВЛЕНЫ');}else onEvent('ДОСТАВЛЕНО '+delivered+'/3 / НАЙДИТЕ СЛЕДУЮЩИЙ ГРУЗ');return;}
 const forward=new T.Vector3(-Math.sin(robot.rotation.y),0,-Math.cos(robot.rotation.y));const target=packages.filter(p=>!p.userData.delivered).map(p=>({p,v:p.position.clone().sub(robot.position).setY(0)})).filter(({v})=>v.length()<3.9&&v.length()>1&&v.clone().normalize().dot(forward)>.65).sort((a,b)=>a.v.length()-b.v.length())[0];if(!target){onEvent('ПОДЪЕДЬТЕ К ГРУЗУ ПЕРЕДНИМ ЗАХВАТОМ');return;}
 robot.updateWorldMatrix(true,true);robot.attach(target.p);carried=target.p;pickupStart.copy(carried.position);busy=1.3;onEvent('ЗАХВАТ / ПОГРУЗКА НА ПЛАТФОРМУ');}
 function update(dt:number,drive:number,turn:number,active:boolean){collisionDelay=Math.max(0,collisionDelay-dt);const speedFactor=robot.position.x< -3&&robot.position.z< -5&&robot.position.z> -14?.65:1;velocity=active?T.MathUtils.damp(velocity,!busy&&!finished?drive*3.3*speedFactor:0,5,dt):0;if(active&&!busy&&!finished)robot.rotation.y+=turn*1.65*dt;
 const candidate=robot.position.clone();candidate.x-=Math.sin(robot.rotation.y)*velocity*dt;candidate.z-=Math.cos(robot.rotation.y)*velocity*dt;const blocked=Math.abs(candidate.x)>9.5||candidate.z< -21||candidate.z>4.5||obstacles.some(o=>Math.abs(candidate.x-o.x)<o.w/2+1&&Math.abs(candidate.z-o.z)<o.d/2+1.35);
 if(blocked&&Math.abs(velocity)>.05){velocity=0;if(!collisionDelay){collisions++;collisionDelay=1;onEvent('ПРЕПЯТСТВИЕ / СДАЙТЕ НАЗАД И ОБЪЕДЬТЕ');}}else{distance+=robot.position.distanceTo(candidate);robot.position.x=candidate.x;robot.position.z=candidate.z;}
 robot.position.y=heightAt(robot.position.x,robot.position.z);const f=new T.Vector3(-Math.sin(robot.rotation.y),0,-Math.cos(robot.rotation.y));robot.rotation.x=Math.atan2(heightAt(robot.position.x+f.x,robot.position.z+f.z)-heightAt(robot.position.x-f.x,robot.position.z-f.z),2);
 wheelPhase+=velocity*dt/.51;let k=0;for(const w of wheels){for(let j=0;j<12;j++){const a=j/12*Math.PI*2+wheelPhase;dummy.position.set(w.position.x,.53+Math.cos(a)*.51,w.position.z+Math.sin(a)*.51);dummy.rotation.set(a,0,0);dummy.updateMatrix();tread.setMatrixAt(k++,dummy.matrix);}}tread.instanceMatrix.needsUpdate=true;
 if(busy&&carried){busy=Math.max(0,busy-dt);const u=1-busy/1.3;carried.position.copy(pickupStart).lerp(new T.Vector3(0,1.65,.5),T.MathUtils.smoothstep(u,0,1));carried.position.y+=Math.sin(u*Math.PI)*.6;carried.rotation.set(0,0,0);}
 const tip=carried?carried.position.clone().add(new T.Vector3(0,.48,0)):new T.Vector3(0,.95,-2.2);beam(upper,shoulder,elbow);beam(fore,elbow,tip);beam(piston,shoulder.clone().add(new T.Vector3(.2,0,0)),elbow.clone().add(new T.Vector3(.2,-.2,0)));claw.position.copy(tip);jaws[0].position.x=carried?-.4:-.28;jaws[1].position.x=carried?.4:.28;
 }
 reset();update(0,0,0,false);
 return {root,robot,packages,reset,update,interact,get delivered(){return delivered;},get loaded(){return !!carried;},get busy(){return busy>0;},get finished(){return finished;},get distance(){return distance;},get collisions(){return collisions;},status(){return `Грузы ${delivered}/3 · ${carried?'Груз на борту':'Захват свободен'} · ${Math.round(distance)} м · Ошибки ${collisions}`;},dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}
