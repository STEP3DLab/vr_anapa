import * as THREE from './vendor/three.module.min.js';

// Stable envelopes for the complete allowed animation, calculated once at load.
// Each coordinate is a cos(theta) + b sin(theta) + c. Its extrema are exact;
// no per-frame bounds traversal, phase sampling or camera breathing is needed.
// Contract: one animated axis per branch; independent nested animation is unsupported.
export function collectionBounds(world){
  world.scene.updateMatrixWorld(true);
  const animations=new Map(world.animated.map(a=>[a.group,a]));
  return world.models.map(model=>{
    const bounds=new THREE.Box3();
    model.traverse(mesh=>{
      if(!mesh.isMesh)return;
      let parent=mesh,animation;
      while(parent&&parent!==model.parent){if(animations.has(parent)){animation=animations.get(parent);break;}parent=parent.parent;}
      if(!animation){bounds.union(new THREE.Box3().setFromObject(mesh));return;}
      const group=animation.group,axis=animation.kind==='orbit'?'z':'y',initial=group.rotation[axis];
      const matrices=[0,Math.PI/2,Math.PI].map(angle=>{group.rotation[axis]=angle;group.updateWorldMatrix(true,true);return mesh.matrixWorld.clone();});
      group.rotation[axis]=initial;group.updateWorldMatrix(true,true);
      const range=animation.kind==='orbit'?[0,Math.PI*2]:animation.kind==='sputnik'?[-.18,.18]:[-.12,.12];
      const positions=mesh.geometry.attributes.position,point=new THREE.Vector3();
      for(let i=0;i<positions.count;i++){
        point.fromBufferAttribute(positions,i);const [p0,p90,p180]=matrices.map(matrix=>point.clone().applyMatrix4(matrix));
        for(const coordinate of ['x','y','z']){
          const c=(p0[coordinate]+p180[coordinate])/2,a=(p0[coordinate]-p180[coordinate])/2,b=p90[coordinate]-c;
          let min,max;
          if(animation.kind==='orbit'){const radius=Math.hypot(a,b);min=c-radius;max=c+radius;}
          else{
            const value=angle=>a*Math.cos(angle)+b*Math.sin(angle)+c,values=range.map(value),critical=Math.atan2(b,a);
            for(let k=-2;k<=2;k++){const angle=critical+k*Math.PI;if(angle>=range[0]&&angle<=range[1])values.push(value(angle));}
            min=Math.min(...values);max=Math.max(...values);
          }
          bounds.min[coordinate]=Math.min(bounds.min[coordinate],min);bounds.max[coordinate]=Math.max(bounds.max[coordinate],max);
        }
      }
    });
    return bounds.expandByScalar(.001);
  });
}
