/**
 * Mobot-CH-HV-2 viewer/atlas angle convention v17 · 2026-11-17.
 * Exact physical axes, dimensions and limits are NOT known.
 * This does not alter the inherited v15 photo-derived geometry.
 *
 * v16 displayed positive "bucket lift" by rotating model's lift joint NEGATIVELY,
 * whereas the old SVG atlas treated positive lift as positive Z rotation, falsely
 * describing opposite model poses as the same angle.
 */
import {PROFILE_V15,auditBucketPose,rotate2D,add2D} from './mobot-kinematics-v15.js';
export {rotate2D,add2D};
export const PROFILE_V17={...PROFILE_V15,version:'v17',controlConvention:'positive displayed loader lift means negative model Z rotation',documentedPhysicalAngles:false};
export function viewerAnglesToRadians(liftUpDeg=0,tipDeg=0){
 if(!Number.isFinite(liftUpDeg)||!Number.isFinite(tipDeg)) throw Error('Non-finite model angle');
 return {lift:-liftUpDeg*Math.PI/180,tip:tipDeg*Math.PI/180};
}
export function auditViewerPose(liftUpDeg=0,tipDeg=0){
 const a=viewerAnglesToRadians(liftUpDeg,tipDeg);
 const result=auditBucketPose(a.lift,a.tip,PROFILE_V17);
 return {...result,displayAnglesDeg:{liftUp:liftUpDeg,tip:tipDeg},
   sceneRotationRadians:a,screeningOnly:true,
   convention:'Positive liftUp rotates the loader clockwise in the X/Y schematic, raising its negative-X bucket at neutral pose.'};
}
export function sweepViewerPose(liftMin=-12,liftMax=42,tipMin=-38,tipMax=38,step=2){
 const d=Math.max(1,Math.min(10,Math.abs(step)));
 const cases=[];
 for(let l=liftMin;l<=liftMax+1e-9;l+=d){
   for(let t=tipMin;t<=tipMax+1e-9;t+=d){
     const p=auditViewerPose(l,t);
     cases.push({liftDeg:l,tipDeg:t,minClearanceScene:p.minClearanceScene,
       potentialGroundCrossing:p.potentialGroundCrossing,negativeProbeCount:p.negativeProbeCount});
   }
 }
 const worst=cases.reduce((a,b)=>a===null||b.minClearanceScene<a.minClearanceScene?b:a,null);
 return {revision:'v17',modelUnitsOnly:true,sampleStepDegrees:d,samples:cases.length,
   potentialGroundCrossings:cases.filter(c=>c.potentialGroundCrossing).length,
   worst,certifiedLimits:false,
   warning:'All values are uncalibrated and are not historic travel limits or a mesh collision assessment.'};
}
