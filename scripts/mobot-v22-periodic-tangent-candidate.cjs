// Numerical candidate for periodic track tangent. Does not modify v22; no actual Three/WebGL runtime.
'use strict';
const fs=require('node:fs'),path=require('node:path');
function analyze(source,kinematics){
 const datum=Number(kinematics.match(/groundY:\s*([\d.]+)/)[1]);
 const start=source.indexOf('  const pixelScale ='),end=source.indexOf('  const path=new THREE.CurvePath();');
 if(start<0||end<=start||!source.includes('tangent=path.getTangent(t)'))throw Error('Unexpected v22 source');
 const {p,w,padHalf,cleatOffset,cleatHalf}=new Function('PROFILE_V15',source.slice(start,end)+'\nreturn {p:sourceTrackProfile,w:[...lowerWheels,...endWheels],padHalf,cleatOffset,cleatHalf};')({groundY:datum});
 const cum=[0];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];cum.push(cum.at(-1)+Math.hypot(b[0]-a[0],b[1]-a[1]));}
 const P=cum.at(-1),h=1e-4,count=114;
 const wrap=t=>((t%1)+1)%1,clamp=t=>Math.min(1,Math.max(0,t));
 function point(t){const d=t*P;let lo=0,hi=p.length;while(lo+1<hi){const mid=(lo+hi)>>1;if(cum[mid]<=d)lo=mid;else hi=mid;}const a=p[lo],b=p[(lo+1)%p.length],u=(d-cum[lo])/(cum[lo+1]-cum[lo]);return [a[0]+u*(b[0]-a[0]),a[1]+u*(b[1]-a[1])];}
 function direction(t,periodic){const f=periodic?wrap:clamp;const a=point(f(t-h)),b=point(f(t+h));const x=b[0]-a[0],y=b[1]-a[1],l=Math.hypot(x,y);return [x/l,y/l];}
 function angle(a,b){return Math.abs(Math.atan2(a[0]*b[1]-a[1]*b[0],a[0]*b[0]+a[1]*b[1]))*180/Math.PI;}
 function evalAt(t,periodic){const [x,y]=point(t),[c,s]=direction(t,periodic),hx=P/count*.91/2,chx=P/count*.62/2;let gap=Infinity;for(const q of w){const dx=q.x-x,dy=q.y-y;const u=Math.max(0,Math.abs(dx*c+dy*s)-hx),v=Math.max(0,Math.abs(-dx*s+dy*c)-padHalf);gap=Math.min(gap,Math.hypot(u,v)-q.r);}return {pad:y-Math.abs(s)*hx-Math.abs(c)*padHalf,cleat:y+c*cleatOffset-Math.abs(s)*chx-Math.abs(c)*cleatHalf,gap};}
 const acc=()=>({minPad:Infinity,minCleat:Infinity,minWheelGap:Infinity});
 const global=[acc(),acc()],seam=[acc(),acc()];let maxElsewhere=0,maxChange=0;
 function add(a,v){a.minPad=Math.min(a.minPad,v.pad);a.minCleat=Math.min(a.minCleat,v.cleat);a.minWheelGap=Math.min(a.minWheelGap,v.gap);}
 for(let i=0;i<30000;i++){const t=i/30000;for(let mode=0;mode<2;mode++)add(global[mode],evalAt(t,!!mode));if(t>h&&t<1-h)maxElsewhere=Math.max(maxElsewhere,angle(direction(t,false),direction(t,true)));}
 for(let i=0;i<=2000;i++){const u=-h+h*2*i/2000,t=wrap(u);for(let mode=0;mode<2;mode++)add(seam[mode],evalAt(t,!!mode));maxChange=Math.max(maxChange,angle(direction(t,false),direction(t,true)));}
 const baselineJump=angle(direction(0,false),direction(1,false)),candidateJump=angle(direction(0,true),direction(1,true));
 const nearJump=angle(direction(1-1e-8,true),direction(1e-8,true));
 const result={modelOnly:true,sourceVertices:p.length,P,datum,finiteDifferenceNormalizedStep:h,linkCount:count,denseSamples:30000,seamSamples:2001,baselineJump,candidateJump,nearJump,maxElsewhere,maxChange,global:{baseline:global[0],candidate:global[1]},seam:{baseline:seam[0],candidate:seam[1]},actualThreeRuntime:false,physicalScaleKnown:false};
 if(Math.abs(baselineJump-3.75)>1e-5||candidateJump>1e-7||maxElsewhere>1e-7||nearJump>.001||Math.abs(global[0].minCleat-global[1].minCleat)>1e-7||seam[1].minWheelGap<0)throw Error(JSON.stringify(result));
 return result;
}
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
console.log(JSON.stringify(analyze(read('mobot-engineering-v22-model.js'),read('mobot-kinematics-v15.js')),null,2));
