import * as THREE from './vendor/three.module.min.js';

export class Inspection {
  constructor(world){
    this.world=world;this.active=false;this.index=-1;this.dirty=true;this.shadowDirty=true;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#18211c');
    this.scene.environment=world.scene.environment;this.scene.environmentIntensity=.85;
    this.camera=new THREE.PerspectiveCamera(42,1,.03,70);
    this.subject=new THREE.Group();this.scene.add(this.subject);
    this.scene.add(new THREE.HemisphereLight('#ffefd2','#2f4138',1.8));
    for(const [color,intensity,position] of [['#ffe0ac',3.1,[-4,6,5]],['#abc9c4',1.6,[4,2,3]],['#f2b35f',2.2,[1,4,-4]]]){
      const light=new THREE.DirectionalLight(color,intensity);light.position.set(...position);if(position[0]===-4){light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:20});light.shadow.normalBias=.025;}this.scene.add(light);
    }
    const floor=new THREE.Mesh(new THREE.CylinderGeometry(2.7,2.7,.1,64),new THREE.MeshStandardMaterial({color:'#29352c',metalness:.25,roughness:.55}));
    floor.receiveShadow=true;this.floor=floor;this.scene.add(floor);this.target=new THREE.Vector3();this.radius=1;this.distance=6;this.theta=.18;this.elevation=.12;
  }
  open(index){
    const source=this.world.models[index];if(!source)return false;
    this.subject.clear();const model=source.clone(true);this.subject.position.set(0,0,0);this.subject.scale.setScalar(1);this.subject.add(model);
    this.subject.updateMatrixWorld(true);let bounds=new THREE.Box3().setFromObject(this.subject);const size=bounds.getSize(new THREE.Vector3()),scale=3.4/Math.max(size.x,size.y,size.z);
    this.subject.scale.setScalar(scale);this.subject.updateMatrixWorld(true);bounds=new THREE.Box3().setFromObject(this.subject);
    const center=bounds.getCenter(new THREE.Vector3());this.subject.position.copy(center).multiplyScalar(-1);this.subject.updateMatrixWorld(true);
    bounds=new THREE.Box3().setFromObject(this.subject);this.radius=bounds.getBoundingSphere(new THREE.Sphere()).radius;this.height=bounds.max.y-bounds.min.y;
    this.floor.position.y=bounds.min.y-.06;this.index=index;this.active=true;this.shadowDirty=true;this.reset();return true;
  }
  fitDistance(){
    const vertical=THREE.MathUtils.degToRad(this.camera.fov)/2,horizontal=Math.atan(Math.tan(vertical)*this.camera.aspect);
    return this.radius/Math.sin(Math.min(vertical,horizontal))*1.1;
  }
  resize(width,height){const ratio=width/Math.max(height,1);if(!Number.isFinite(ratio)||ratio<=0)return;const oldFit=this.fitDistance();this.camera.aspect=ratio;this.camera.updateProjectionMatrix();this.distance*=this.fitDistance()/oldFit;this.update();}
  reset(){this.theta=.18;this.elevation=.12;this.target.set(0,0,0);this.distance=this.fitDistance();this.update();}
  detail(){this.target.y=this.height*[.22,.25,0,.27][this.index];this.distance=this.fitDistance()*.58;this.elevation=.08;this.update();}
  orbit(dx,dy){this.theta-=dx*.006;this.elevation=THREE.MathUtils.clamp(this.elevation+dy*.005,-.12,1.15);this.update();}
  zoom(factor){if(!Number.isFinite(factor)||factor<=0)return;this.distance=THREE.MathUtils.clamp(this.distance*factor,this.radius*1.12,this.fitDistance()*1.5);this.update();}
  update(){this.dirty=true;const level=this.distance*Math.cos(this.elevation);this.camera.position.set(this.target.x+Math.sin(this.theta)*level,this.target.y+Math.sin(this.elevation)*this.distance,this.target.z+Math.cos(this.theta)*level);this.camera.lookAt(this.target);this.camera.updateMatrixWorld(true);}
  close(){this.active=false;this.subject.clear();}
}
