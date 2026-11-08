// İnternetsiz çalışma: ilk açılışta her şeyi telefona kaydeder.
// Strateji: önce kayıttakini göster, arkada internetten yenisini al (bir sonraki açılışta güncel olur).
const ONBELLEK = "okurken-v20261108-125948";
const TEMEL = [
  "./", "index.html", "style.css", "app.js", "sozluk.json", "manifest.json",
  "hikayeler/liste.json", "ikonlar/ikon-180.png", "ikonlar/ikon-192.png", "ikonlar/ikon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(ONBELLEK);
    await c.addAll(TEMEL);
    // Bütün hikâyeleri de indir
    const liste = await (await fetch("hikayeler/liste.json")).json();
    await c.addAll(liste.map((h) => h.dosya));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const ad of await caches.keys()) if (ad !== ONBELLEK) await caches.delete(ad);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith((async () => {
    const c = await caches.open(ONBELLEK);
    const kayitli = await c.match(e.request, { ignoreSearch: true });
    const yeni = fetch(e.request).then((cevap) => {
      if (cevap.ok) c.put(e.request, cevap.clone());
      return cevap;
    }).catch(() => kayitli);
    return kayitli || yeni;
  })());
});
