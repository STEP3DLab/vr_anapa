import * as THREE from './vendor/three.module.min.js';

// One unshadowed key, one floor halo and a single particle draw; no game state.
export class GalleryAtmosphere{
  constructor(world,exhibits,{reduced=false}={}){
    this.exhibits=exhibits;this.reduced=reduced;this.time=0;this.pulse=0;this.energy=0;
    this.root=new THREE.Group();this.root.name='Gallery light';world.scene.add(this.root);
    this.key=new THREE.SpotLight('#ffe1aa',95,17,.58,.9,1.8);this.root.add(this.key,this.key.target);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'#fff6de');gradient.addColorStop(.18,'#fff1cd');gradient.addColorStop(1,'#ffffff00');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
    const sprite=new THREE.CanvasTexture(canvas);sprite.colorSpace=THREE.SRGBColorSpace;
    const geometry=new THREE.BufferGeometry(),positions=new Float32Array(480*3);let seed=1957;
    const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<480;i++)positions.set([(random()-.5)*17,random()*7.3,(random()-.5)*25],i*3);
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    this.dust=new THREE.Points(geometry,new THREE.PointsMaterial({map:sprite,color:'#eace9a',size:.034,opacity:.24,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));this.root.add(this.dust);
    this.halo=new THREE.Mesh(new THREE.PlaneGeometry(6.3,6.3),new THREE.MeshBasicMaterial({map:sprite,color:'#ffd09a',opacity:.12,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));this.halo.rotation.x=-Math.PI/2;this.root.add(this.halo);this.focus(-1);
  }
  focus(index){
    const exhibit=this.exhibits[Math.max(0,index)];this.key.position.set(exhibit.position[0]+2.6,6.6,exhibit.position[2]+3.2);this.key.target.position.set(...exhibit.target);this.halo.position.set(exhibit.position[0],.048,exhibit.position[2]);this.pulse=this.reduced?0:1;
  }
  configure(quality,xr=false){this.dust.geometry.setDrawRange(0,quality==='detail'&&!xr?480:160);}
  update(dt){
    if(!this.reduced)this.time+=dt;this.pulse=Math.max(0,this.pulse-dt*.42);
    const soft=Math.sin(this.pulse*Math.PI);this.energy=soft*.12;
    this.key.intensity=95+soft*32;this.halo.material.opacity=.1+soft*.09;
    if(!this.reduced){this.dust.rotation.y=Math.sin(this.time*.025)*.008;this.dust.position.y=Math.sin(this.time*.08)*.1;}
  }
}
