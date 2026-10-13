import * as THREE from './vendor/three.module.min.js';

export async function installMuseumGraphics(world){
  const loader=new THREE.TextureLoader();
  const results=await Promise.allSettled(['portrait','space','energy','engineering'].map(name=>loader.loadAsync('./assets/poster-'+name+'.svg')));
  const failed=results.find(result=>result.status==='rejected');if(failed){results.forEach(result=>{if(result.status==='fulfilled')result.value.dispose();});throw failed.reason;}
  const textures=results.map(result=>result.value);
  const frameMaterial=new THREE.MeshStandardMaterial({color:'#a28a51',metalness:.7,roughness:.34});
  const edgeMaterial=new THREE.MeshStandardMaterial({color:'#26342a',metalness:.15,roughness:.65});
  textures.forEach((texture,i)=>{
    texture.colorSpace=THREE.SRGBColorSpace;
    const group=new THREE.Group();group.name='Museum graphic '+i;group.position.set(9.91,3.85,[-8,-2,4,10][i]);group.rotation.y=-Math.PI/2;
    const backing=new THREE.Mesh(new THREE.BoxGeometry(2.64,3.84,.08),frameMaterial);backing.castShadow=backing.receiveShadow=true;group.add(backing);
    const mount=new THREE.Mesh(new THREE.BoxGeometry(2.52,3.72,.08),edgeMaterial);mount.castShadow=mount.receiveShadow=true;mount.position.z=.025;group.add(mount);
    const print=new THREE.Mesh(new THREE.PlaneGeometry(2.4,3.6),new THREE.MeshBasicMaterial({map:texture}));print.position.z=.074;group.add(print);world.root.add(group);
  });
}
