/** Geometry shared by cargo guidance, collision checks and the arm animation. Metres. */
export type Point = {x:number; y:number; z:number};
export type Obstacle = {x:number; z:number; w:number; d:number};
export const ARM = {upper:1.4, fore:1.9, shoulder:{x:0,y:1.55,z:-.85}, gripOffset:.48};
export const BASE = {x:0,z:2,w:6,d:4};
export const ROVER = {halfWidth:1.23,halfLength:1.98,offset:.47};
export function atBase(x:number,z:number){return Math.abs(x-BASE.x)<=2.3 && Math.abs(z-BASE.z)<=1.65;}
export function toLocal(x:number,z:number,yaw:number,point:Point):Point {
 const dx=point.x-x,dz=point.z-z,c=Math.cos(yaw),s=Math.sin(yaw);
 return {x:c*dx-s*dz,y:point.y,z:s*dx+c*dz};
}
export function toWorld(x:number,z:number,yaw:number,point:Point):Point {
 const c=Math.cos(yaw),s=Math.sin(yaw);
 return {x:x+c*point.x+s*point.z,y:point.y,z:z-s*point.x+c*point.z};
}
/** Two rigid links in a vertical plane. The elbow always takes the upper solution. */
export function solveArm(goal:Point){
 const p=ARM.shoulder,dx=goal.x-p.x,dy=goal.y-p.y,dz=goal.z-p.z;
 const radial=Math.hypot(dx,dz),distance=Math.hypot(radial,dy);
 const min=Math.abs(ARM.fore-ARM.upper)+.001,max=ARM.upper+ARM.fore-.001;
 const d=Math.max(min,Math.min(max,distance));
 const ux=distance>1e-8?dx/distance:0,uy=distance>1e-8?dy/distance:0,uz=distance>1e-8?dz/distance:-1;
 const a=(ARM.upper**2-ARM.fore**2+d*d)/(2*d),h=Math.sqrt(Math.max(0,ARM.upper**2-a*a));
 // Perpendicular to the target direction, pointing upwards in the arm plane.
 const px=radial>1e-8?-uy*dx/radial:1,py=radial>1e-8?radial/distance:0,pz=radial>1e-8?-uy*dz/radial:0;
 return {elbow:{x:p.x+a*ux+h*px,y:p.y+a*uy+h*py,z:p.z+a*uz+h*pz},
  wrist:{x:p.x+d*ux,y:p.y+d*uy,z:p.z+d*uz},reachable:distance>=min&&distance<=max};
}
/** Separating-axis test for an oriented rover footprint and an axis-aligned barrier. */
export function overlapsBarrier(x:number,z:number,yaw:number,o:Obstacle,margin=.035){
 const c=Math.cos(yaw),s=Math.sin(yaw),dx=x+s*ROVER.offset-o.x,dz=z+c*ROVER.offset-o.z;
 const a=ROVER.halfWidth+margin,b=ROVER.halfLength+margin,ox=o.w/2,oz=o.d/2;
 return Math.abs(dx)<a*Math.abs(c)+b*Math.abs(s)+ox &&
  Math.abs(dz)<a*Math.abs(s)+b*Math.abs(c)+oz &&
  Math.abs(dx*c-dz*s)<a+ox*Math.abs(c)+oz*Math.abs(s) &&
  Math.abs(dx*s+dz*c)<b+ox*Math.abs(s)+oz*Math.abs(c);
}
export function outsideField(x:number,z:number,yaw:number){
 const c=Math.cos(yaw),s=Math.sin(yaw),cx=x+s*ROVER.offset,cz=z+c*ROVER.offset;
 const ex=ROVER.halfWidth*Math.abs(c)+ROVER.halfLength*Math.abs(s),ez=ROVER.halfWidth*Math.abs(s)+ROVER.halfLength*Math.abs(c);
 return Math.abs(cx)+ex>10.55 || cz-ez< -22.1 || cz+ez>5.55;
}
/** A gripper may not acquire a crate through a concrete barrier. */
export function segmentBlocked(a:Point,b:Point,obstacles:Obstacle[]){
 return obstacles.some(o=>{
  let near=0,far=1;
  for(const [start,delta,min,max] of [[a.x,b.x-a.x,o.x-o.w/2-.12,o.x+o.w/2+.12],[a.z,b.z-a.z,o.z-o.d/2-.12,o.z+o.d/2+.12]]){
   if(Math.abs(delta)<1e-8){if(start<min||start>max)return false;}
   else {let t1=(min-start)/delta,t2=(max-start)/delta;if(t1>t2)[t1,t2]=[t2,t1];near=Math.max(near,t1);far=Math.min(far,t2);if(near>far)return false;}
  }
  return true;
 });
}
