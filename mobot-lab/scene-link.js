const views = ['iso','side','front','top'];
export const tools = ['gripper','breaker-arm','breaker-loader'];

export function photoKey(photo) {
  return photo.file.split('/').at(-1).replace(/\.webp$/, '');
}
function vector(text) {
  if (!text || !/^-?[\d.]+,-?[\d.]+,-?[\d.]+$/.test(text)) return null;
  const v = text.split(',').map(Number), length = Math.hypot(...v);
  return length > .98 && length < 1.02 ? v.map(n => n/length) : null;
}
export function readScene(params, def, photos, parts) {
  const mode = ['drive','parts','photo'].includes(params.get('mode')) ? params.get('mode') : 'drive';
  const photo = Math.max(0,photos.findIndex(p => photoKey(p) === params.get('photo')));
  const part = parts.find(p => p.id === params.get('part'))?.id || parts[0].id;
  const raw = params.get('pose')?.split(',');
  let pose = null;
  if (raw?.length === def.joints.length && raw.every(n => /^-?\d+(\.\d+)?$/.test(n) && Number.isFinite(Number(n)))) {
    pose = Object.fromEntries(def.joints.map(([key,,min,max],i) => [key, Math.max(min, Math.min(max, Number(raw[i])))]));
  }
  const direction = vector(params.get('dir')), up = vector(params.get('up'));
  const safeUp = up && direction && Math.abs(up.reduce((v,n,i)=>v+n*direction[i],0)) < .998 ? up : undefined;
  const zoom = Number(params.get('z'));
  const camera = direction || views.includes(params.get('view')) ? {
    direction, up:safeUp, view:views.includes(params.get('view')) ? params.get('view') : null,
    zoom:zoom >= .4 && zoom <= 5 ? zoom : 1, detail:mode==='parts' && params.get('detail')==='1'
  } : null;
  return {dual:params.get('compare')==='1'||params.get('dual')==='1',mode,photo,part,pose,tool:tools.includes(params.get('tool')) ? params.get('tool') : 'gripper',camera,marks:params.get('marks')==='1',isolated:mode==='parts'&&params.get('isolate')==='1'};
}

// A direct comparison opens the two accepted models in their initial poses.
export function comparisonURL(base) {
  const url=new URL(base);url.search='';url.hash='';url.searchParams.set('compare','1');return url.href;
}

// The accepted longitudinal axes differ by a half-turn around Y. Rotate
// the up vector too, preserving the camera basis at oblique/top views.
export function orientComparisonCamera(state, fromSide, toSide) {
  const sign=toSide/fromSide;
  const rotate=v=>v.map((n,i)=>i===1?n:n*sign);
  return {direction:rotate(state.direction),up:rotate(state.up),zoom:state.zoom};
}

export function sceneURL(base, {year,def,mode,photo,part,pose,tool,camera,marks,isolated,dual}) {
  const url = new URL(base); url.search = ''; url.hash = '';
  const p = url.searchParams; p.set('model',year);
  if (dual === true) p.set('compare','1');
  if (mode !== 'drive') p.set('mode',mode);
  if (mode === 'photo') { p.set('photo',photoKey(photo)); if (marks) p.set('marks','1'); }
  if (mode === 'parts') p.set('part',part);
  if (mode === 'parts' && isolated) p.set('isolate','1');
  if (year===1987 && tool!=='gripper') p.set('tool',tool);
  p.set('pose',def.joints.map(([key])=>+pose[key].toFixed(3)).join(','));
  if (camera) {
    if (camera.view) p.set('view',camera.view);
    else p.set('dir',camera.direction.map(n=>+n.toFixed(4)).join(','));
    if (camera.up.some((n,i)=>Math.abs(n-[0,1,0][i])>.001)) p.set('up',camera.up.map(n=>+n.toFixed(4)).join(','));
    if (Math.abs(camera.zoom-1)>.001) p.set('z',camera.zoom.toFixed(3));
    if (camera.detail && mode==='parts') p.set('detail','1');
  }
  return url.href;
}
