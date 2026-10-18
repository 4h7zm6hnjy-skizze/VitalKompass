const CACHE='vital-kompass-1.4.0';const FILES=['./','./index.html','./style.css','./app.js','./icon.svg','./icon-192.png','./icon-512.png','./manifest.webmanifest','./version.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('vital-kompass-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;
const url=new URL(e.request.url);if(url.pathname.endsWith('/version.json')||e.request.mode==='navigate'){e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{if(r.ok&&e.request.mode==='navigate')caches.open(CACHE).then(c=>c.put(e.request,r.clone()));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));return}
e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(response=>{if(response.ok)caches.open(CACHE).then(c=>c.put(e.request,response.clone()));return response}))) });
self.addEventListener('message',e=>{if(e.data==='SKIP_WAITING')self.skipWaiting()});
