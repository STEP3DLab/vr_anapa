// Cap total pixels as well as DPR: a 4K/5K monitor must not allocate giant HDR targets.
export function renderPixelRatio(width,height,dpr,quality,maxSize=4096){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return 1;
  const budget=quality==='smooth'?1_000_000:2_400_000,cap=quality==='smooth'?1:1.5;
  return Math.min(Math.max(.1,Number.isFinite(dpr)?dpr:1),cap,Math.sqrt(budget/(width*height)),maxSize/Math.max(width,height));
}
