import {Group, Quaternion, Vector3} from 'three';

/** Move the observation station only on an explicit recenter/scene transition.
 * Tracking position, eye height, pitch and roll remain owned by WebXR. */
export function alignStation(rig:Group, position:{x:number;y:number;z:number}, orientation:{x:number;y:number;z:number;w:number}, stationY:number, stationZ:number){
 const forward=new Vector3(0,0,-1).applyQuaternion(new Quaternion(orientation.x,orientation.y,orientation.z,orientation.w));
 const yaw=Math.hypot(forward.x,forward.z)>.01?Math.atan2(-forward.x,-forward.z):0;
 rig.rotation.set(0,-yaw,0);
 const c=Math.cos(-yaw),s=Math.sin(-yaw);
 rig.position.set(-position.x*c-position.z*s,stationY,stationZ+position.x*s-position.z*c);
 rig.updateMatrixWorld(true);
}

export function neutralGamepad(gamepad?:Gamepad){
 if(!gamepad)return true;
 return gamepad.axes.every(v=>!Number.isFinite(v)||Math.abs(v)<=.25)&&
  (gamepad.buttons??[]).every(b=>!b.pressed&&!(b.value>.15));
}

/** Rescale the dead zone so the first movement is gentle, not a speed jump. */
export function axisValue(value:number|undefined,deadZone=.15){
 if(!Number.isFinite(value)||Math.abs(value!)<=deadZone)return 0;
 return Math.sign(value!)*Math.min(1,(Math.abs(value!)-deadZone)/(1-deadZone));
}
