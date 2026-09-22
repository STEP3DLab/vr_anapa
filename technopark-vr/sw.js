const CACHE='technopark-vr-v11-4';
const CORE=['./','./index.html','./app.js','./app.css','./game.css','./favicon.svg'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('technopark-vr-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  const scope=new URL('./',self.location.href);
  if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
  const relative=url.pathname.slice(scope.pathname.length);
  if(!['','index.html','app.js','app.css','game.css','favicon.svg'].includes(relative)&&!relative.startsWith('draco/'))return;
  // Query strings choose app state; they must not create an unlimited number of cache entries.
  const cacheKey=request.mode==='navigate'?new URL('index.html',scope).href:url.origin+url.pathname;
  event.respondWith(fetch(request).then(response=>{
    if(response&&response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(cacheKey,copy)).catch(()=>{}));}
    return response;
  }).catch(()=>caches.match(request,{ignoreSearch:true}).then(hit=>hit||(request.mode==='navigate'?caches.match('./index.html'):Response.error()))));
});
