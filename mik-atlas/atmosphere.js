import * as THREE from './vendor/three.module.min.js';

// Procedural material textures: no remote maps or CDN dependencies.
export function stoneTexture(base,vein,repeat=3){
  const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');
  ctx.fillStyle=base;ctx.fillRect(0,0,512,512);
  let seed=1970;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<13000;i++){ctx.fillStyle=`rgba(255,242,204,${random()*.05})`;ctx.fillRect(random()*512,random()*512,1+random()*3,1+random()*3);}
  for(let j=0;j<14;j++){ctx.beginPath();const x=random()*580-30;ctx.moveTo(x,0);for(let y=0;y<=512;y+=8)ctx.lineTo(x+Math.sin(y*.018+j)*35+Math.sin(y*.047)*6+y*.21,y);ctx.strokeStyle=vein;ctx.lineWidth=j%3===0?1.5:.55;ctx.stroke();}
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(repeat,repeat);return tex;
}

export function installAtmosphere(renderer,world){
  const scene=world.scene;
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;const c=canvas.getContext('2d');
  const grad=c.createLinearGradient(0,0,0,512);grad.addColorStop(0,'#b8c8cf');grad.addColorStop(.32,'#fff1ce');grad.addColorStop(.49,'#b2a480');grad.addColorStop(.55,'#454237');grad.addColorStop(1,'#191e1a');c.fillStyle=grad;c.fillRect(0,0,1024,512);
  for(let x=40;x<1024;x+=180){c.fillStyle='#fff8df';c.fillRect(x,70,34,120);c.fillStyle='#be915b';c.fillRect(x+37,70,4,120);}
  const texture=new THREE.CanvasTexture(canvas);texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.SRGBColorSpace;
  const pmrem=new THREE.PMREMGenerator(renderer);const env=pmrem.fromEquirectangular(texture);scene.environment=env.texture;scene.environmentIntensity=.7;texture.dispose();pmrem.dispose();
  const marble=stoneTexture('#c9bea4','rgba(73,69,52,.18)',2),red=stoneTexture('#713d30','rgba(245,190,127,.2)',2),dark=stoneTexture('#384238','rgba(190,174,126,.1)',3);
  world.materials.stone.map=marble;world.materials.red.map=red;world.materials.dark.map=dark;
  scene.traverse(o=>{if(o.isMesh){const materials=Array.isArray(o.material)?o.material:[o.material];if(materials.every(m=>!m.isMeshBasicMaterial&&!m.transparent)){o.castShadow=true;o.receiveShadow=true;}}});
  const sun=world.sun;sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);sun.shadow.camera.left=-14;sun.shadow.camera.right=14;sun.shadow.camera.top=17;sun.shadow.camera.bottom=-17;sun.shadow.camera.near=.5;sun.shadow.camera.far=50;sun.shadow.bias=-.0008;sun.shadow.normalBias=.035;sun.shadow.radius=3;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  // A quiet permanent accent on the central portrait, with no extra shadow map.
  const key=new THREE.SpotLight('#ffe3b1',35,18,.55,.75,1.8);key.position.set(2.8,7.2,-4);key.target.position.set(0,3.8,-9);scene.add(key,key.target);
  world.dayMode=true;
  world.setLighting=(day)=>{
    world.dayMode=day;world.hemisphere.intensity=day?1.25:.72;sun.intensity=day?3.3:1.05;world.fill.intensity=day ? .75 : .5;
    scene.environmentIntensity=day ? .7 : .45;key.intensity=day?35:42;
    const bg=day?'#868779':'#20261f';scene.background.set(bg);scene.fog.color.set(bg);
    renderer.toneMappingExposure=day?1.05:1.13;
  };
  world.setLighting(true);
  world.environmentTarget=env;
}
