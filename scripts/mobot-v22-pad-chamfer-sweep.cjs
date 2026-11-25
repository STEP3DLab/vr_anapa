// Research only: sample adjacent convex pad profiles, no historical dimensions.
'use strict';
const fs=require('node:fs'),path=require('node:path');
function analyze(source,kinematics){
 const datum=Number(kinematics.match(/groundY:\s*([\d.]+)/)[1]);
 const start=source.indexOf('  const pixelScale ='),end=source.indexOf('  const path=new THREE.CurvePath();');
 if(start<0||end<=start||!source.includes('tangent=path.getTangent(t)'))throw Error('Unexpected baseline');
 const {p,w,padHalf,cleatOffset,cleatHalf}=new Function('PROFILE_V15',source.slice(start,end)+'\nreturn {p:sourceTrackProfile,w:[...lowerWheels,...endWheels],padHalf,cleatOffset,cleatHalf};')({groundY:datum});
 const cum=[0];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];cum.push(cum.at(-1)+Math.hypot(b[0]-a[0],b[1]-a[1]));}
 const P=cum.at(-1),N=114,pitch=P/N,h=1e-4,hx=pitch*.91/2,hy=padHalf;
 const wrap=t=>((t%1)+1)%1;
 function point(t){const d=wrap(t)*P;let lo=0,hi=p.length;while(lo+1<hi){const mid=(lo+hi)>>1;if(cum[mid]<=d)lo=mid;else hi=mid;}const a=p[lo],b=p[(lo+1)%p.length],u=(d-cum[lo])/(cum[lo+1]-cum[lo]);return [a[0]+u*(b[0]-a[0]),a[1]+u*(b[1]-a[1])];}
 function pose(t){const a=point(t-h),b=point(t+h),[x,y]=point(t),dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy);return [x,y,dx/l,dy/l];}
 function profile(d){return d===0?[[-hx,-hy],[hx,-hy],[hx,hy],[-hx,hy]]:[[-hx+d,-hy],[hx-d,-hy],[hx,-hy+d],[hx,hy],[-hx,hy],[-hx,-hy+d]];}
 function world(poly,[x,y,c,s]){return poly.map(([u,v])=>[x+c*u-s*v,y+s*u+c*v]);}
 function sat(a,b){let best=-Infinity;for(const poly of [a,b])for(let i=0;i<poly.length;i++){const [x,y]=poly[i], [X,Y]=poly[(i+1)%poly.length],l=Math.hypot(X-x,Y-y),u=(Y-y)/l,v=(x-X)/l;let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;for(const [r,s] of a){let q=r*u+s*v;amin=Math.min(amin,q);amax=Math.max(amax,q);}for(const [r,s] of b){let q=r*u+s*v;bmin=Math.min(bmin,q);bmax=Math.max(bmax,q);}best=Math.max(best,bmin-amax,amin-bmax);}return best;}
 const cleat=[[-pitch*.62/2,cleatOffset-cleatHalf],[pitch*.62/2,cleatOffset-cleatHalf],[pitch*.62/2,cleatOffset+cleatHalf],[-pitch*.62/2,cleatOffset+cleatHalf]];
 function area(poly){let a=0;for(let i=0;i<poly.length;i++){let [x,y]=poly[i],[u,v]=poly[(i+1)%poly.length];a+=x*v-y*u;}return Math.abs(a)/2;}
 const sampleCount=40000,ts=Array.from({length:sampleCount},(_,i)=>i/sampleCount);
 // Include actual polygon breakpoints and finite difference transition endpoints for both adjacent pads.
 for(const d of cum){for(const shift of [0,-1/N])for(const e of [-h,0,h])for(const eps of [-1e-8,0,1e-8])ts.push(wrap(d/P+shift+e+eps));}
 const poses=ts.map(t=>[pose(t),pose(t+1/N)]);
 const result=[];
 for(const d of [0,.001,.002,.003,.004,.005,.006,.007,.008,.009,.010]){
  const poly=profile(d);let minGap=Infinity,minPadY=Infinity,minCleatY=Infinity,minCrossGap=Infinity,collisions=0,where=null;
  for(let i=0;i<poses.length;i++){
   const [a,b]=poses[i],A=world(poly,a),B=world(poly,b),C=world(cleat,a),D=world(cleat,b);
   const g=sat(A,B);if(g<minGap){minGap=g;where=ts[i];}if(g< -1e-9)collisions++;
   minCrossGap=Math.min(minCrossGap,sat(A,D),sat(C,B),sat(C,D));
   for(const v of A)minPadY=Math.min(minPadY,v[1]);for(const v of C)minCleatY=Math.min(minCleatY,v[1]);
  }
  result.push({chamferScene:d,removedSectionFraction:1-area(poly)/(4*hx*hy),minGap,collisions,minCrossGap,minPadY,minCleatY,worstT:where});
 }
 return {modelOnly:true,physicalScaleKnown:false,P,N,pitch,sourceVertices:p.length,datum,h,samples:ts.length,profileType:'two inner-side 45-degree corner cuts, outer face and maximum width preserved',wheelClearanceNonRegression:'each candidate cross-section is a subset of the baseline rectangle at the same pose',result};
}
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
console.log(JSON.stringify(analyze(read('mobot-engineering-v22-model.js'),read('mobot-kinematics-v15.js')),null,2));
