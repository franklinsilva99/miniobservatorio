/* Service Worker: permite abrir el portal sin conexión con el servidor web.
   · Aplicación (HTML/CSS/JS): red primero; si falla, copia en caché.
   · Productos: NO se cachean aquí; los gestiona js/datos/repositorio.js
     (valida cada archivo y guarda solo la última versión válida). */
const CACHE = "pc-app-v1";
const APP = ["./", "index.html", "css/portal.css", "js/app.js", "js/config.js",
  "js/datos/contrato.js", "js/datos/repositorio.js", "js/datos/modelo.js",
  "js/ui/util.js", "js/ui/estado.js", "js/ui/graficos.js", "js/ui/mosaico.js", "js/ui/detalle.js", "js/geo/peru.js"];

self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));

self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  if (u.pathname.includes("/productos/")) return; // productos: siempre a la red
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const c = r.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("index.html"))));
});
