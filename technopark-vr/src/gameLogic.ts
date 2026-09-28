export function driveRobot(x:number,z:number,yaw:number,drive:number,turn:number,dt:number){const angle=yaw+turn*2.4*dt;return {yaw:angle,x:Math.max(-5.7,Math.min(5.7,x-Math.sin(angle)*drive*3.2*dt)),z:Math.max(-12.7,Math.min(-1.3,z-Math.cos(angle)*drive*3.2*dt))};}
type Point3={x:number;y:number;z:number};
/** First contact of a pellet's travelled segment with a spherical target. */
export function sweptSphereHit(start:Point3,end:Point3,center:Point3,radius:number){
 const vx=end.x-start.x,vy=end.y-start.y,vz=end.z-start.z;
 const mx=start.x-center.x,my=start.y-center.y,mz=start.z-center.z;
 const a=vx*vx+vy*vy+vz*vz,c=mx*mx+my*my+mz*mz-radius*radius;
 if(c<=0)return 0;
 if(a<1e-10)return null;
 const b=mx*vx+my*vy+mz*vz,discriminant=b*b-a*c;
 if(b>=0||discriminant<0)return null;
 const t=(-b-Math.sqrt(discriminant))/a;
 return t>=0&&t<=1?t:null;
}
/** A few grazing pellets chip armour; a dense pattern gives at most one full hit per shell. */
export function pelletDamage(pellets:number,armour:'light'|'armored'|'flagship'){
 return Math.min(1,Math.max(0,pellets)/(armour==='light'?3:armour==='armored'?4:5));
}
export function falling(y:number,velocity:number,dt:number){const v=velocity-9.8*dt;return {y:y+v*dt,velocity:v};}
