// Cap total pixels as well as DPR: a 4K/5K monitor must not allocate giant HDR targets.
export function renderPixelRatio(width,height,dpr,quality,maxSize=4096){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return 1;
  const profile=typeof quality==='object'&&quality?quality:{budget:quality==='smooth'?1_000_000:2_400_000,cap:quality==='smooth'?1:1.5};
  const budget=Math.max(1,Math.min(2_400_000,profile.budget)),cap=Math.max(.1,Math.min(1.5,profile.cap));
  return Math.min(Math.max(.1,Number.isFinite(dpr)?dpr:1),cap,Math.sqrt(budget/(width*height)),maxSize/Math.max(width,height));
}
