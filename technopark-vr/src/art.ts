import * as T from 'three';
/** Instanced kinetic sculpture: 56 titanium petals, three orbital bands and a luminous core. */
export function createArt(){
 const root=new T.Group();root.position.set(0,0,-11.5);
 const silver=new T.MeshStandardMaterial({color:0xc5d1da,metalness:.95,roughness:.2});
 const glow=new T.MeshBasicMaterial({color:0x96ffdf});
 const dark=new T.MeshStandardMaterial({color:0x142a36,metalness:.8,roughness:.24});
 const baseGeo=new T.CylinderGeometry(2.7,3,.32,64),base=new T.Mesh(baseGeo,dark);base.position.y=.16;root.add(base);
 const inlayGeo=new T.TorusGeometry(2.55,.025,6,80),inlay=new T.Mesh(inlayGeo,glow);inlay.rotation.x=Math.PI/2;inlay.position.y=.33;root.add(inlay);
 const coreGeo=new T.IcosahedronGeometry(.65,1),core=new T.Mesh(coreGeo,glow);core.position.y=3.7;root.add(core);
 const petalGeo=new T.BoxGeometry(.13,.66,.38),petals=new T.InstancedMesh(petalGeo,silver,56);root.add(petals);
 petals.instanceMatrix.setUsage(T.DynamicDrawUsage);
 // Bound the whole entrance animation; Three otherwise caches the first frame's bounds.
 petals.boundingSphere=new T.Sphere(new T.Vector3(0,2.8,0),6.3);
 const orbitGeo=new T.TorusGeometry(2.35,.022,8,96),orbits:T.Mesh[]=[];
 for(let i=0;i<3;i++){const o=new T.Mesh(orbitGeo,i===1?silver:glow);o.position.y=3.7;o.rotation.set(i*.7,.5+i,.4);root.add(o);orbits.push(o);}
 const pos=new Float32Array(180*3);for(let i=0;i<180;i++){const a=i*2.39996,r=3.5+(i%7)*.3;pos.set([Math.cos(a)*r,.5+(i%31)/5,Math.sin(a)*r],i*3);}const particlesGeo=new T.BufferGeometry();particlesGeo.setAttribute('position',new T.BufferAttribute(pos,3));const particleMat=new T.PointsMaterial({color:0x8fffe0,size:.025,transparent:true,opacity:.65,depthWrite:false});const dust=new T.Points(particlesGeo,particleMat);root.add(dust);
 const dummy=new T.Object3D();
 return {root,update(t:number,progress=1){const q=T.MathUtils.smoothstep(progress,0,1);core.rotation.set(t*.2,t*.3,0);core.scale.setScalar((.05+.95*q)*(1+Math.sin(t)*.08));for(let i=0;i<56;i++){const u=i/56*Math.PI*2,a=u+t*.17,r=1.65+.25*Math.sin(u*3+t*.5)+(1-q)*3;dummy.position.set(Math.cos(a)*r,(.5+3.2*q)+Math.sin(u*2+t*.2)*1.65*q,Math.sin(a)*r);dummy.rotation.set(u*2+t*.2,-a,u);dummy.scale.setScalar(.15+.85*q);dummy.updateMatrix();petals.setMatrixAt(i,dummy.matrix);}petals.instanceMatrix.needsUpdate=true;orbits.forEach((o,i)=>{o.scale.setScalar(.05+.95*q);o.rotation.y=t*(.08+i*.025)+i;o.rotation.z=t*.06+i;});dust.rotation.y=t*.025;},dispose(){[baseGeo,inlayGeo,coreGeo,petalGeo,orbitGeo,particlesGeo].forEach(g=>g.dispose());[silver,glow,dark,particleMat].forEach(m=>m.dispose());}};
}
