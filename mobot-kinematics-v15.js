/*
 * MOBOT CH-HV-2 — canonical planar research geometry v15.
 * Shared by WebGL assembly and GPU-independent SVG atlas.
 * No metric calibration. No verified joint dimensions/angle limits.
 * Historical sources: https://sktbpr.ru/content/mrk-mobot-ch-hv-2
 * Implementation basis: photo-derived procedural v13 geometry, NOT factory drawings.
 */
export const PROFILE_V15={
  version:"v15",
  robot:"Мобот-Ч-ХВ-2 (1987)",
  calibrated:false,
  units:"arbitrary model scene units, NOT metres",
  groundY:0.14,
  nominalTrackLength:1.78,
  trackContour:[
    [-.64,.79],[-.04,.79],[.57,.79],[.72,.70],[.85,.54],[.87,.42],
    [.74,.23],[.55,.15],[0,.14],[-.58,.15],[-.77,.23],[-.91,.42],[-.87,.56],[-.76,.71]
  ],
  wheelXs:[-.56,-.395,-.23,-.065,.10,.265,.43],
  wheelY:.25,
  armPivot:[-.14,1.18],
  armDistalLocal:[-1.20,.99],
  loaderPivot:[.28,.65],
  scoopRelative:[-1.0,-.13],
  // 7 transverse sections × 3 lip/underside positions = 21 probe points.
  // The ARCHIVAL demonstration photo does not establish the nine protruding teeth
  // hypothesised in older models; model a continuous wear edge instead.
  // These coordinates remain scene-only geometry hypotheses.
  probes:[
    ...Array.from({length:7},(_,i)=>{
      const z=(i-3)*.2, section=i+1;
      return [
        {label:"Кромка "+section+" · передняя",x:-.87,y:-.255,z},
        {label:"Кромка "+section+" · переходная",x:-.81,y:-.240,z},
        {label:"Лист ковша "+section+" · нижняя",x:-.74,y:-.220,z}
      ];
    }).flat()
  ],
  warning:"Photographic reconstruction and nominal pivots. This is NOT a collision simulator or manufacturing drawing."
};
export function rotate2D(p,a) {
  const c=Math.cos(a),s=Math.sin(a);
  return [p[0]*c-p[1]*s,p[0]*s+p[1]*c];
}
export function add2D(a,b){return [a[0]+b[0],a[1]+b[1]];}
export function projectBladePoint(probe,lift,tip,profile=PROFILE_V15){
  const local=add2D(profile.scoopRelative,rotate2D([probe.x,probe.y],tip));
  const world=add2D(profile.loaderPivot,rotate2D(local,lift));
  return {label:probe.label,x:world[0],y:world[1],z:probe.z};
}
export function auditBucketPose(liftRad=0,tipRad=0,profile=PROFILE_V15){
  const pts=profile.probes.map(p=>projectBladePoint(p,liftRad,tipRad,profile));
  if(!pts.length)throw Error("No bucket probe points");
  const lowest=pts.reduce((a,b)=>b.y<a.y?b:a,pts[0]);
  const highest=pts.reduce((a,b)=>b.y>a.y?b:a,pts[0]);
  const plane=profile.groundY;
  const below=pts.filter(p=>p.y<plane-.005);
  return {
    version:profile.version,
    jointAnglesDeg:{lift:+(liftRad*180/Math.PI).toFixed(3),tip:+(tipRad*180/Math.PI).toFixed(3)},
    probeCount:pts.length,
    lowestPoint:{...lowest},highestPoint:{...highest},
    minClearanceScene:lowest.y-plane,
    negativeProbeCount:below.length,
    potentialGroundCrossing:below.length>0,
    datum:{name:"crawler-bottom projected level",heightScene:plane,physicalScaleKnown:false},
    samplePoints:pts,
    certifiedCollisionFree:false,
    assumption:"Uncalibrated 2D rigid parent-child rotations; sampling is not triangle-mesh interference."
  };
}
export function sweepBucketEnvelope(liftMin=-18,liftMax=28,tipMin=-38,tipMax=38,step=2,profile=PROFILE_V15){
  const degToRad=Math.PI/180;
  const d=Math.max(1,Math.min(10,Math.abs(step)));
  const cases=[];
  for(let l=liftMin;l<=liftMax+1e-9;l+=d){
    for(let t=tipMin;t<=tipMax+1e-9;t+=d){
      const p=auditBucketPose(l*degToRad,t*degToRad,profile);
      cases.push({liftDeg:l,tipDeg:t,minClearanceScene:p.minClearanceScene,
        potentialGroundCrossing:p.potentialGroundCrossing,negativeProbeCount:p.negativeProbeCount});
    }
  }
  const worst=cases.reduce((a,b)=>a===null||b.minClearanceScene<a.minClearanceScene?b:a,null);
  const violations=cases.filter(p=>p.potentialGroundCrossing);
  return {revision:profile.version,modelUnitsOnly:true,sampleStepDegrees:d,samples:cases.length,
    potentialGroundCrossings:violations.length,crossingFraction:cases.length?violations.length/cases.length:0,
    worst,certifiedLimits:false,
    warning:"This sampled model-ground result does not establish historical operating limits or real collision."};
}
export function getProfileCopy(profile=PROFILE_V15) {
  return JSON.parse(JSON.stringify(profile));
}
