// The cache and the fetch handler are confined to this laboratory's directory.
const prefix='mobot-lab:'+self.registration.scope+':';
const cacheName=prefix+'2026-11-27.4-unified-navigation';
const files=[
  'index.html','style.css','app.js','catalog.js','evidence.js','inspection.js','registrations.js',
  'scene-link.js','archive.js','presentation.js','viewer.js','xr.js','icons.js','mark.svg',
  'dual.js','isolation.js','research.js','research-ui.js','pose-check.js','engine/contact.js',
  'data/1986-passport.json','data/1987-passport.json','data/release-data.json',
  'downloads/README-RU.txt','downloads/manifest.json',
  'engine/three.core.min.js','engine/three.module.min.js','engine/controls/OrbitControls.js',
  'engine/orthographic-raster.js','engine/qr.js',
  'models/mobot-ch-hv-1986-research-v6-model.js','models/mobot-ch-hv-1986-research-v7-model.js',
  'models/mobot-engineering-v23-model.js','models/mobot-kinematics-v15.js',
  'media/inter.woff','media/sktbpr.png','media/rgsu.png','media/1986-overview.webp','media/1987-overview.webp',
  'media/1986-fig6.webp','media/1986-fig9.webp','media/1987-before-dispatch.webp','media/1987-front.webp',
  'media/1987-snow-side.webp','media/1987-breaker.webp','media/archive/1986-operator.webp',
  'media/archive/1986-transport.webp','media/archive/1987-pair.webp','media/archive/1987-demonstration.webp'
];
const assets=new Set(files.map(file=>new URL(file,self.registration.scope).href));
const entry=new URL('index.html',self.registration.scope).href;
async function cacheAll() {
  const cache=await caches.open(cacheName);
  await cache.addAll([...assets].map(url=>new Request(url,{cache:'reload'})));
}
self.addEventListener('message',event=>{
  if(event.data!=='refresh-exhibition'||!event.ports[0])return;
  event.waitUntil(cacheAll().then(
    ()=>event.ports[0].postMessage({saved:true}),
    ()=>event.ports[0].postMessage({saved:false})
  ));
});
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    await cacheAll();
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const name of await caches.keys()) if(name.startsWith(prefix)&&name!==cacheName)await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);url.search='';url.hash='';
  const key=request.mode==='navigate'&&(url.href===self.registration.scope||url.href===entry)?entry:url.href;
  if(!assets.has(key))return;
  event.respondWith((async()=>{
    const cache=await caches.open(cacheName);
    return (await cache.match(key))||fetch(request);
  })());
});
