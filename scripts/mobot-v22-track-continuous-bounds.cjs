// Continuous numerical bounds for v22 research track candidates, not historic dimensions.
'use strict';
const fs=require('node:fs'),path=require('node:path');

function analyze(source,kin){
 const datum=Number(kin.match(/groundY:\s*([\d.]+)/)[1]);
 const start=source.indexOf('  const pixelScale ='),end=source.indexOf('  const path=new THREE.CurvePath();');
 if(start<0||end<=start)throw Error('Unexpected model');
 const {p,padHalf,cleatOffset,cleatHalf}=new Function('PROFILE_V15',source.slice(start,end)+'\nreturn {p:sourceTrackProfile,padHalf,cleatOffset,cleatHalf};')({groundY:datum});
 const cum=[0];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];cum.push(cum.at(-1)+Math.hypot(b[0]-a[0],b[1]-a[1]));}
 const P=cum.at(-1),N=114,h=1e-4,hx=P/N*.91/2,cx=P/N*.62/2;
 const wrap=t=>((t%1)+1)%1;
 function pt(t){const d=wrap(t)*P;let lo=0,hi=p.length;while(lo+1<hi){let m=(lo+hi)>>1;if(cum[m]<=d)lo=m;else hi=m;}const a=p[lo],b=p[(lo+1)%p.length],u=(d-cum[lo])/(cum[lo+1]-cum[lo]);return [a[0]+u*(b[0]-a[0]),a[1]+u*(b[1]-a[1])];}
 function pose(t){const a=pt(t-h),b=pt(t+h),v=pt(t),dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy);return {x:v[0],y:v[1],c:dx/l,s:dy/l};}
 function breaks(offsets){const b=[0,1];for(const d of cum)for(const off of offsets)for(const e of [-h,0,h])b.push(wrap(d/P+off+e));return b.sort((a,b)=>a-b).filter((x,i,a)=>!i||x-a[i-1]>1e-14);}
 function poly(r,pose){const {x,y,c,s}=pose;return r.map(([u,v])=>[x+c*u-s*v,y+s*u+c*v]);}
 function radius(r){return Math.max(...r.map(([u,v])=>Math.hypot(u,v)));}
 const pad=[[-hx+.004,-padHalf],[hx-.004,-padHalf],[hx,-padHalf+.004],[hx,padHalf],[-hx,padHalf],[-hx,-padHalf+.004]];
 const rectangle=[[-hx,-padHalf],[hx,-padHalf],[hx,padHalf],[-hx,padHalf]];
 const cleat=(cut=0,d=0)=>{const low=cleatOffset-cleatHalf,high=cleatOffset+cleatHalf-cut;return d?[[-cx,low],[cx,low],[cx,high-d],[cx-d,high],[-cx+d,high],[-cx,high-d]]:[[-cx,low],[cx,low],[cx,high],[-cx,high]];};
 // On intervals split at all center and chord breakpoints, center and chord are affine.
 // Nonopposite endpoint chord directions enclose every interior normalized direction.
 // Bound every vertex displacement from the midpoint by center arc length plus radius times angular chord.
 const ang=(a,b)=>Math.abs(Math.atan2(a.c*b.s-a.s*b.c,a.c*b.c+a.s*b.s));
 function movement(a,m,b,r,dt){const angle=ang(a,b);if(angle>=Math.PI-1e-6)throw Error('Unbounded tangent interval');return P*dt/2+2*r*Math.sin(Math.max(ang(a,m),ang(m,b))/2)+1e-10;}
 function minY(r,tol=2e-8){const rr=radius(r),br=breaks([0]),f=q=>Math.min(...poly(r,q).map(v=>v[1]));let upper=Infinity,lower=Infinity,where=0,leaves=0,splits=0;
  function visit(a,b,A,B){const t=(a+b)/2,M=pose(t),v=f(M);for(const [u,q] of [[a,A],[t,M],[b,B]]){const val=f(q);if(val<upper){upper=val;where=u;}}
   // Exact linear center ordinate and angular sector projection bound for each vertex.
   const lowY=Math.min(A.y,B.y);
   const L=lowY+Math.min(...r.map(([u,w])=>{
    const len=Math.hypot(u,w),d1=u*A.s+w*A.c,d2=u*B.s+w*B.c;
    if(len===0)return 0;
    const anti={c:-w/len,s:-u/len};
    return ang(A,anti)+ang(anti,B)<=ang(A,B)+1e-12?-len:Math.min(d1,d2);
   }))-1e-10;
   if(L>=upper-tol){lower=Math.min(lower,L);leaves++;return;}
   if(b-a<1e-13)throw Error('min bound not converged');
   splits++;visit(a,t,A,M);visit(t,b,M,B);
  }
  for(let i=0;i<br.length-1;i++)visit(br[i],br[i+1],pose(br[i]),pose(br[i+1]));
  return {lowerBound:lower,sampledUpper:upper,uncertainty:upper-lower,where,leaves,splits};
 }
 function sat(a,b){let best=-Infinity;for(const r of [a,b])for(let i=0;i<r.length;i++){const [x,y]=r[i],[X,Y]=r[(i+1)%r.length],l=Math.hypot(X-x,Y-y),u=(Y-y)/l,v=(x-X)/l;let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;for(const [r,s] of a){const q=r*u+s*v;amin=Math.min(amin,q);amax=Math.max(amax,q);}for(const [r,s] of b){const q=r*u+s*v;bmin=Math.min(bmin,q);bmax=Math.max(bmax,q);}best=Math.max(best,bmin-amax,amin-bmax);}return best;}
 function certify(r,s,target=1e-5){const rr=radius(r),ss=radius(s),br=breaks([0,-1/N]);let lower=Infinity,sampleMin=Infinity,leaves=0,splits=0;
  function visit(a,b,A,B,C,D){const t=(a+b)/2,M=pose(t),Q=pose(t+1/N),g=sat(poly(r,M),poly(s,Q));sampleMin=Math.min(sampleMin,g);
   const L=g-movement(A,M,B,rr,b-a)-movement(C,Q,D,ss,b-a);
   if(L>target){lower=Math.min(lower,L);leaves++;return;}
   if(g<=target||b-a<1e-12)throw Error('Insufficient gap: '+g+' at '+t);
   splits++;visit(a,t,A,M,C,Q);visit(t,b,M,B,Q,D);
  }
  for(let i=0;i<br.length-1;i++){const a=br[i],b=br[i+1];visit(a,b,pose(a),pose(b),pose(a+1/N),pose(b+1/N));}
  return {lowerBound:lower,sampleMin,leaves,splits,target};
 }
 const ground={original:minY(cleat()),outerCenter:minY([[0,cleatOffset+cleatHalf]]),outerChamfer006:minY(cleat(0,.006)),inset0011:minY(cleat(.0011)),inset0012:minY(cleat(.0012)),pad:minY(pad)};
 const adjacent={padPad:certify(pad,pad),padCleat:certify(pad,cleat()),cleatPad:certify(cleat(),pad),cleatCleat:certify(cleat(),cleat())};
 return {modelOnly:true,physicalScaleKnown:false,datum,P,N,h,vertices:p.length,method:'piecewise affine center/chord; angular-sector displacement bound; adaptive subdivision and fixed midpoint separating axis; conservative numerical bound, not formal interval arithmetic',ground,adjacent};
}

const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
console.log(JSON.stringify(analyze(read('mobot-engineering-v22-model.js'),read('mobot-kinematics-v15.js')),null,2));
