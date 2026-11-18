import * as T from '../../../../mobot-assets/three.module.min.js';
export function deckCamera(v){
  // Complete the observed projected X and Z columns to orthogonal camera rows
  // of equal length. Image Y points down; world Y points up.
  const [xx,xy]=v.longitudinal,[zx,zy]=v.transverse;
  const A=xx**2+zx**2,B=xy**2+zy**2,C=xx*xy+zx*zy;
  const scale2=(A+B+Math.hypot(A-B,2*C))/2;
  const yy=-Math.sqrt(scale2-B),yx=-C/yy;
  const scale=Math.sqrt(scale2);
  const right=new T.Vector3(xx,yx,zx).divideScalar(scale);
  const up=new T.Vector3(-xy,-yy,-zy).divideScalar(scale);
  if(Math.abs(right.dot(up))>=1e-10)throw Error('Invalid deck camera basis');
  const backward=right.clone().cross(up);
  const camera=new T.OrthographicCamera(-500,500,v.imageHeight/2,-v.imageHeight/2,.01,50);
  camera.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(right,up,backward));
  camera.zoom=scale;
  // Rear, upper, near corner of the v21 deck plate (unchanged on v22).
  camera.position.set(.855,.663+.047/2,-.675).addScaledVector(backward,10)
    .addScaledVector(right,(500-v.deckOrigin[0])/scale)
    .addScaledVector(up,(v.deckOrigin[1]-v.imageHeight/2)/scale);
  camera.updateProjectionMatrix();camera.updateMatrixWorld();
  return camera;
}
