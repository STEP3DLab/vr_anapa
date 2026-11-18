import {MathUtils, Vector3} from '../../../../mobot-assets/three.module.min.js';

// Centre the full archival crop inside the viewport, preserving its pixel scale and roll.
export function frameArchive(camera, target, fit, [width,height], viewportAspect){
  const a=MathUtils.degToRad(fit.azimuth), e=MathUtils.degToRad(fit.elevation);
  const roll=MathUtils.degToRad(fit.roll);
  const horizontal=new Vector3(Math.cos(a),0,-Math.sin(a));
  const vertical=new Vector3(-Math.sin(a)*Math.sin(e),Math.cos(e),-Math.cos(a)*Math.sin(e));
  const direction=new Vector3().crossVectors(horizontal,vertical);
  const right=horizontal.clone().multiplyScalar(Math.cos(roll)).addScaledVector(vertical,-Math.sin(roll));
  const up=vertical.multiplyScalar(Math.cos(roll)).addScaledVector(horizontal,Math.sin(roll));
  target.copy(right).multiplyScalar((width/2-fit.cx)/fit.pxPerSceneUnit)
    .addScaledVector(up,(fit.cy-height/2)/fit.pxPerSceneUnit);
  camera.position.copy(target).addScaledVector(direction,9);
  camera.up.copy(up);camera.lookAt(target);
  const half=Math.max(height,width/viewportAspect)/(2*fit.pxPerSceneUnit);
  Object.assign(camera,{left:-half*viewportAspect,right:half*viewportAspect,top:half,bottom:-half,zoom:1});
  camera.updateProjectionMatrix();camera.updateMatrixWorld();
}
