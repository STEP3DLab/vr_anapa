export function driveRobot(x:number,z:number,yaw:number,drive:number,turn:number,dt:number){const angle=yaw+turn*2.4*dt;return {yaw:angle,x:Math.max(-5.7,Math.min(5.7,x-Math.sin(angle)*drive*3.2*dt)),z:Math.max(-12.7,Math.min(-1.3,z-Math.cos(angle)*drive*3.2*dt))};}
export function shotHits(along:number,perpendicular:number){return along>0&&perpendicular<.65+along*.045;}
export function falling(y:number,velocity:number,dt:number){const v=velocity-9.8*dt;return {y:y+v*dt,velocity:v};}
