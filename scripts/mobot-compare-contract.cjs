// Fast dependency/markup/release gate; does not claim to test WebGL or physical hardware.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(base,p),'utf8');
const html=read('mobot-compare.html');
const app=read('mobot-assets/compare-v1.js');
const styles=read('mobot-assets/compare-v1.css');
const main=read('mobot-demo.html');
const latest=read('mobot-latest.html');
const release=JSON.parse(read('mobot-demo-release-2026-11-18.json'));
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'duplicate compare element IDs');
const required=['sync','syncStatus','zoomIn','zoomOut','reset','pose86','pose87','node86','node87','tool87','focus86','focus87','canvas86','canvas87','stage86','stage87','fallback86','fallback87','status86','status87','note86','note87'];
for(const id of required){
 assert(ids.includes(id),'required view control missing '+id);
 if(!id.startsWith('stage'))assert(app.includes("'"+id+"'")||app.includes("'"+id.replace(/(?:86|87)$/,'')+"'"),'unhandled control '+id);
}
const refs=[...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map(m=>m[1]);
const paths=refs.filter(ref=>ref.startsWith('./')).map(ref=>ref.split('#')[0].split('?')[0]);
for(const item of paths){
 const absolute=path.resolve(base,item);
 assert(absolute.startsWith(base+path.sep),'path escapes repository '+item);
 assert(fs.existsSync(absolute),'missing resource '+item);
}
assert(html.includes('Ч-ХВ-2')&&html.includes('Ч-ХВ'),'comparison is between two named machines');
assert(app.includes("makeMobot1986(T)")&&app.includes("makeMobot(T,"),'comparison must instantiate two distinct model implementations');
assert(app.includes('new T.WebGLRenderer'),'actual WebGL comparison renderer required');
assert(app.includes("getContext('webgl2'"),'explicit WebGL2 capability check required');
assert(app.includes("T.Raycaster()"),'clickable structural node support required');
assert(app.includes("window.__mobotCompareQA"),'browser test surface required');
assert(styles.includes('@media(max-width:720px)'), 'mobile breakpoint missing');
assert(main.includes('href="./mobot-compare.html"'),'comparison missing from landing page');
assert(latest.includes('mobot-engineering-v20.html'),'latest must point to v20');
assert(fs.existsSync(path.join(base,'mobot-engineering-v17.html')),'archived v17 must be preserved');
assert(release.comparison.page.endsWith('/mobot-compare.html'),'comparison not registered in release');
const report={gate:'comparison-static-contract',resourceCount:paths.length,elementCount:ids.length,current:'1987-v20',archived:'1987-v17',twoDistinctModels:true,scope:'static dependency/semantic checks, not browser render or historical metrology'};
console.log(JSON.stringify(report,null,2));
