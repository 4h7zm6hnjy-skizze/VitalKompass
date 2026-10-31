/* VitalKompass 2.0.9: measurement editing and encrypted attachments; network-first code updates and offline fallback. */
const CACHE='vital-kompass-2.0.9-fasting-filter-fix';
const FILES=['./','./index.html','./style.css','./pdf-export.js','./vkpro.js','./app.js','./icon.svg','./icon-192.png','./icon-512.png','./manifest.webmanifest','./version.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('vital-kompass-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const req=e.request;if(req.method!=='GET')return;
 const url=new URL(req.url);if(url.origin!==self.location.origin)return;
 const networkFirst=req.mode==='navigate'||['index.html','app.js','style.css','pdf-export.js','vkpro.js','version.json','sw.js'].some(x=>url.pathname.endsWith('/'+x))||url.pathname.endsWith('/');
 if(networkFirst){e.respondWith(fetch(req,{cache:'no-store'}).then(async response=>{if(response.ok){const cache=await caches.open(CACHE);await cache.put(req,response.clone())}return response}).catch(async()=>{const c=await caches.match(req);if(c)return c;if(req.mode==='navigate')return caches.match('./index.html');return Response.error()}));return}
 e.respondWith(caches.match(req).then(c=>c||fetch(req).then(async response=>{if(response.ok)(await caches.open(CACHE)).put(req,response.clone());return response})));
});
self.addEventListener('message',e=>{if(e.data==='SKIP_WAITING')self.skipWaiting()});
