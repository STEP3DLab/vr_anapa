import * as THREE from './vendor/three.module.min.js';

const corePosition=new THREE.Vector3(0,4.65,-2),gold=new THREE.Color('#ffc679'),ice=new THREE.Color('#76ded7');
const additive=(color,opacity=1)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
const surfaceVertex=`varying vec3 vNormal;varying vec3 vEye;varying vec3 vPosition;void main(){vec4 p=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vEye=-p.xyz;vPosition=position;gl_Position=projectionMatrix*p;}`;
const surfaceFragment=`uniform float uTime;uniform float uCharge;varying vec3 vNormal;varying vec3 vEye;varying vec3 vPosition;
void main(){float rim=pow(1.-abs(dot(normalize(vNormal),normalize(vEye))),2.2);float bands=pow(.5+.5*sin(vPosition.y*35.-uTime*1.3),14.);vec3 color=mix(vec3(.18,.64,.63),vec3(1.,.57,.2),uCharge);gl_FragColor=vec4(color*(1.2+rim*2.),(.1+rim*.6+bands*.13));
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;

export class AtlasEffects{
  constructor(world,exhibits,{reduced=false}={}){
    this.world=world;this.reduced=reduced;this.time=0;this.energy=0;this.detail=true;this.xr=false;
    this.root=new THREE.Group();this.root.name='Atlas energy installation';world.scene.add(this.root);this.nodes=[];this.rings=[];this.links=[];this.packets=[];
    const metal=new THREE.MeshStandardMaterial({color:'#ae8e58',metalness:.88,roughness:.23});
    this.gold=additive(gold.clone().multiplyScalar(2),.8);this.cyan=additive(ice.clone().multiplyScalar(1.7),.7);
    this.core=new THREE.Group();this.core.position.copy(corePosition);this.root.add(this.core);
    const orb=new THREE.Mesh(new THREE.IcosahedronGeometry(.54,2),new THREE.MeshPhysicalMaterial({color:'#253c38',metalness:1,roughness:.12,clearcoat:1,clearcoatRoughness:.18}));this.core.add(orb);this.orb=orb;
    this.hologram=new THREE.Mesh(new THREE.SphereGeometry(.79,36,24),new THREE.ShaderMaterial({vertexShader:surfaceVertex,fragmentShader:surfaceFragment,uniforms:{uTime:{value:0},uCharge:{value:0}},transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));this.core.add(this.hologram);
    for(let i=0;i<4;i++){
      const group=new THREE.Group();group.rotation.set(i*.73,.4+i*.6,i*.35);this.core.add(group);this.rings.push(group);
      const rim=new THREE.Mesh(new THREE.TorusGeometry(1.02+i*.15,.028,8,96),metal);group.add(rim);
      const glow=new THREE.Mesh(new THREE.TorusGeometry(1.02+i*.15,.009,6,96),i%2?this.cyan:this.gold);glow.position.z=.034;group.add(glow);
      const bead=new THREE.Mesh(new THREE.SphereGeometry(.065,12,8),i%2?this.gold:this.cyan);bead.position.x=1.02+i*.15;group.add(bead);
    }
    this.light=new THREE.PointLight('#ffd59a',45,17,2);this.light.position.copy(corePosition);this.root.add(this.light);
    this.halo=new THREE.Mesh(new THREE.PlaneGeometry(5,5),new THREE.ShaderMaterial({uniforms:{uStrength:{value:.3}},transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform float uStrength;void main(){float r=length(vUv-.5);float a=exp(-r*r*27.)*(1.-smoothstep(.25,.5,r));gl_FragColor=vec4(1.,.56,.22,a*uStrength);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'}));this.halo.position.copy(corePosition);this.root.add(this.halo);
    this.waves=[];
    for(let i=0;i<3;i++){const wave=new THREE.Mesh(new THREE.RingGeometry(.94,1,128),additive(gold,.0));wave.rotation.x=-Math.PI/2;wave.position.set(0,.08+i*.003,-2);this.root.add(wave);this.waves.push(wave);}
    this.beams=new THREE.Group();this.root.add(this.beams);
    for(const x of [-7,7])for(const z of [-8,3,10]){
      const beam=new THREE.Mesh(new THREE.ConeGeometry(1.5,6.9,24,1,true),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,uniforms:{uOpacity:{value:.045}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform float uOpacity;void main(){float edge=pow(sin(vUv.x*3.14159265),2.);gl_FragColor=vec4(.9,.78,.52,edge*pow(vUv.y,1.2)*uOpacity);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'}));beam.position.set(x,4.0,z);this.beams.add(beam);
    }
    exhibits.forEach((e,i)=>{
      const g=new THREE.Group();g.position.set(e.position[0],.075,e.position[2]);this.root.add(g);
      const ring=new THREE.Mesh(new THREE.RingGeometry(i?1.5:2.05,i?1.55:2.1,96),additive(ice,.18));ring.rotation.x=-Math.PI/2;g.add(ring);
      const node=new THREE.Mesh(new THREE.OctahedronGeometry(.18,0),new THREE.MeshStandardMaterial({color:'#c39c63',metalness:.7,roughness:.2,emissive:'#5ac7c0',emissiveIntensity:.5}));node.position.set(e.position[0]+(i?1.72:2.27),1.35,e.position[2]+1.45);node.userData.gameStation=i;this.root.add(node);this.nodes.push(node);
      const orbit=new THREE.Mesh(new THREE.TorusGeometry(.3,.012,6,40),this.gold);orbit.position.copy(node.position);orbit.rotation.x=.7;this.root.add(orbit);
      const path=new THREE.CatmullRomCurve3([new THREE.Vector3(...e.position).add(new THREE.Vector3(0,2.2,0)),new THREE.Vector3(e.position[0]*.7,5.65,e.position[2]*.55),corePosition.clone()]);
      const link=new THREE.Mesh(new THREE.TubeGeometry(path,48,.014,5,false),additive(ice,.65));link.visible=false;this.root.add(link);
      const packet=new THREE.Mesh(new THREE.SphereGeometry(.055,8,6),this.gold);packet.visible=false;this.root.add(packet);
      this.links.push({link,ring,node,orbit,path});this.packets.push(packet);
    });
    this.makeParticles();this.makeBurst();
  }
  makeParticles(){
    const count=1500,positions=new Float32Array(count*3),seeds=new Float32Array(count);let seed=1957;
    const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<count;i++){positions.set([(rand()-.5)*18,rand()*7.7,(rand()-.5)*26],i*3);seeds[i]=rand();}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));
    const material=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uEnergy:{value:0},uScale:{value:300}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:`attribute float aSeed;uniform float uTime;uniform float uEnergy;uniform float uScale;varying float vAlpha;void main(){vec3 p=position;p.y=mod(p.y+uTime*(.055+aSeed*.09),7.7);p.x+=sin(uTime*.12+aSeed*30.)*.18;vec4 view=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*view;gl_PointSize=clamp((.022+aSeed*.025)*uScale/max(.2,-view.z),1.,9.);vAlpha=.22+aSeed*.32+uEnergy*.24;}`,
      fragmentShader:`varying float vAlpha;void main(){float r=length(gl_PointCoord-.5);float a=1.-smoothstep(.02,.5,r);gl_FragColor=vec4(1.,.74,.36,a*a*vAlpha);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`});
    this.dust=new THREE.Points(geometry,material);this.dust.frustumCulled=false;this.root.add(this.dust);
  }
  makeBurst(){
    this.burstLife=0;this.burstPositions=new Float32Array(180*3);this.velocities=new Float32Array(180*3);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(this.burstPositions,3));
    const c=document.createElement('canvas');c.width=c.height=32;const ctx=c.getContext('2d'),gr=ctx.createRadialGradient(16,16,0,16,16,16);gr.addColorStop(0,'white');gr.addColorStop(.2,'#fff4c9');gr.addColorStop(1,'transparent');ctx.fillStyle=gr;ctx.fillRect(0,0,32,32);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    this.burst=new THREE.Points(g,new THREE.PointsMaterial({map:texture,color:gold.clone().multiplyScalar(1.8),size:.11,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));this.burst.frustumCulled=false;this.burst.visible=false;this.root.add(this.burst);
  }
  trigger(index,large=false){
    if(this.reduced)return;const p=large?corePosition:this.nodes[index].position;
    for(let i=0;i<180;i++){const a=i*2.399963,y=1-2*(i+.5)/180,r=Math.sqrt(1-y*y),speed=(large?2.5:1)*(1+(i%7)*.14);this.burstPositions.set(p.toArray(),i*3);this.velocities.set([Math.cos(a)*r*speed,y*speed,Math.sin(a)*r*speed],i*3);}
    this.burstLife=large?3:1.25;this.burstMax=this.burstLife;this.burst.visible=true;this.burst.geometry.attributes.position.needsUpdate=true;
  }
  configure(quality,xr=false){this.detail=quality==='detail';this.xr=xr;this.dust.geometry.setDrawRange(0,this.detail&&!xr?1500:420);this.beams.visible=this.detail&&!xr;}
  pick(raycaster){const hit=raycaster.intersectObjects(this.nodes,false)[0];return hit?{...hit,type:'station',id:hit.object.userData.gameStation}:null;}
  update(dt,camera,game){
    if(!this.reduced)this.time+=dt;
    const playing=game.active,charged=playing?game.charged:0,finale=playing&&['celebrating','complete'].includes(game.phase);
    const target=finale?1:charged*.18;this.energy+=(target-this.energy)*Math.min(1,dt*1.4);
    const t=this.time;this.hologram.material.uniforms.uTime.value=t;this.hologram.material.uniforms.uCharge.value=this.energy;
    this.hologram.scale.setScalar(1+this.energy*.16);this.orb.rotation.y=t*.08;
    this.rings.forEach((ring,i)=>{ring.rotation.y=.4+i*.6+t*(i%2?-.12:.09)*(1+this.energy*1.6);ring.rotation.z=i*.35+t*.06*(i%2?-1:1);});
    camera.getWorldQuaternion(this.halo.quaternion);this.halo.material.uniforms.uStrength.value=.22+this.energy*.25;this.light.intensity=45+this.energy*100;
    this.dust.material.uniforms.uTime.value=t;this.dust.material.uniforms.uEnergy.value=this.energy;
    this.links.forEach((item,i)=>{
      const on=playing&&game.locks[i]===3;item.link.visible=on;this.packets[i].visible=on;
      item.ring.material.color.copy(on?gold:ice);item.ring.material.opacity=on ? .8 : .15;
      item.node.material.emissiveIntensity=on?2.4:playing&&i===game.index?1.2:.35;item.node.rotation.y=t*.35;item.orbit.rotation.z=t*.23;
      if(on)this.packets[i].position.copy(item.path.getPointAt(this.reduced ? .5 : (t*.17+i*.19)%1));
    });
    this.waves.forEach((wave,i)=>{const phase=this.reduced ? .5 : (t*.09+i/3)%1;wave.scale.setScalar(1+phase*10);wave.material.opacity=finale?Math.sin(phase*Math.PI)*.3:this.energy*.055;});
    if(this.burstLife>0){this.burstLife=Math.max(0,this.burstLife-dt);this.burst.material.opacity=this.burstLife/this.burstMax;for(let i=0;i<180;i++){this.velocities[i*3+1]-=dt*.65;for(let j=0;j<3;j++)this.burstPositions[i*3+j]+=this.velocities[i*3+j]*dt;}this.burst.geometry.attributes.position.needsUpdate=true;if(this.burstLife===0)this.burst.visible=false;}
  }
}
