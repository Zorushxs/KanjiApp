// Service worker: fa que l'app (instal·lada com a PWA o no) funcioni sense connexió.
// - Fitxers de l'app: primer la xarxa (amb connexió sempre arriba la versió nova) i, si no n'hi ha, la còpia guardada.
//   En instal·lar-se, guarda index.html i tot el que hi apareix (els CSS i JS amb el seu ?v=N). De cada fitxer
//   només en queda la darrera versió.
// - Ordre de traços (KanjiVG): primer la còpia guardada, perquè el fitxer d'una versió no canvia mai.
//   Traces.keep (js/traces.js) els guarda per endavant per a les fitxes que tens.
const SHELL = 'kanji-app';
const TRACES = 'kanji-traces';
const KANJIVG = 'https://cdn.jsdelivr.net/gh/KanjiVG/';
const ROOT = new URL('./', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil(saveShell().catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (request.url.startsWith(KANJIVG)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (new URL(request.url).origin !== location.origin) return;
  event.respondWith(networkFirst(request));
});

// index.html (desat com a l'arrel de l'app, que és com s'obre) i tots els fitxers que carrega.
async function saveShell() {
  const cache = await caches.open(SHELL);
  const page = await fetch(ROOT, { cache: 'reload' });
  if (!page.ok) return;
  const text = await page.clone().text();
  await cache.put(ROOT, page);
  const files = [...text.matchAll(/(?:src|href)="([^"#:]+)"/g)].map(match => new URL(match[1], ROOT).href);
  await Promise.all(files.map(async url => {
    const response = await fetch(url, { cache: 'reload' });
    if (response.ok) await keep(cache, url, response);
  }));
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL);
  const key = request.mode === 'navigate' ? pageKey(request.url) : request.url;
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') await keep(cache, key, response.clone());
    return response;
  } catch (error) {
    const saved = await cache.match(key) || await cache.match(key, { ignoreSearch: true });
    if (saved) return saved;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(TRACES);
  const saved = await cache.match(request.url);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok) await cache.put(request.url, response.clone());
  return response;
}

// L'app s'obre com a «./» o com a «./index.html», i amb qualsevol ?…: totes dues són la mateixa pàgina.
function pageKey(url) {
  const page = new URL(url);
  page.search = '';
  page.hash = '';
  return page.href === ROOT || page.href === ROOT + 'index.html' ? ROOT : page.href;
}

// Desa la resposta i esborra les versions velles del mateix fitxer (el mateix camí amb un altre ?v=N).
async function keep(cache, url, response) {
  const path = new URL(url).pathname;
  const old = (await cache.keys()).filter(saved => saved.url !== url && new URL(saved.url).pathname === path);
  await Promise.all(old.map(saved => cache.delete(saved)));
  await cache.put(url, response);
}
