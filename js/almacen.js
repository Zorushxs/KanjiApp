// Capa de persistència (còpia de MasterProject). Si algun dia canvies a SQLite o a un servidor, només
// toques aquest arxiu. Modes: 'local' (només al navegador), 'file' (arxiu JSON al disc i còpia al
// navegador) i 'permiso' (hi ha un arxiu, però el navegador torna a demanar permís).
const Almacen = (() => {
  const LS = 'kanji:dades';
  const canFile = 'showSaveFilePicker' in window && 'showOpenFilePicker' in window;
  const PICKER = { types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }] };
  let handle = null, mode = 'local';

  // ---------- IndexedDB: hi guardem la referència a l'arxiu (no es pot desar a localStorage) ----------
  const db = () => new Promise((ok, ko) => {
    const request = indexedDB.open('kanji-app', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('kv');
    request.onsuccess = () => ok(request.result);
    request.onerror = () => ko(request.error);
  });
  async function kvGet(key) {
    try {
      const d = await db();
      return await new Promise(ok => {
        const q = d.transaction('kv').objectStore('kv').get(key);
        q.onsuccess = () => ok(q.result);
        q.onerror = () => ok(null);
      });
    } catch {
      return null;
    }
  }
  async function kvSet(key, value) {
    try {
      const d = await db();
      await new Promise(ok => {
        const tx = d.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(value, key);
        tx.oncomplete = ok;
        tx.onerror = ok;
      });
    } catch {}
  }

  // ---------- Lectura ----------
  async function readFile() {
    const text = await (await handle.getFile()).text();
    return text.trim() ? JSON.parse(text) : null;
  }
  // Llegeix l'arxiu; si ja no existeix, oblida la referència en lloc de tornar-lo a crear en desar.
  async function safeRead() {
    try {
      return { ok: true, data: await readFile() };
    } catch (e) {
      if (e.name !== 'NotFoundError') throw e;
      handle = null;
      await kvSet('handle', null);
      mode = 'local';
      return { ok: false };
    }
  }
  function readLocal() {
    try { return JSON.parse(localStorage.getItem(LS)); } catch { return null; }
  }
  // Amb permís: llegeix l'arxiu (o, si ha desaparegut, la còpia del navegador).
  async function readWithPermission() {
    const r = await safeRead();
    if (r.ok) {
      mode = 'file';
      return { mode, data: r.data };
    }
    return { mode: 'local', data: readLocal() };
  }

  // ---------- Accions ----------
  async function init() {
    handle = canFile ? await kvGet('handle') : null;
    if (!handle) {
      mode = 'local';
      return { mode, data: readLocal() };
    }
    if (await handle.queryPermission({ mode: 'readwrite' }) === 'granted') return readWithPermission();
    mode = 'permiso';
    return { mode, data: readLocal() };
  }
  async function reconnect() {
    if (await handle.requestPermission({ mode: 'readwrite' }) === 'granted') return readWithPermission();
    return { mode, data: null };
  }
  async function open() {
    [handle] = await showOpenFilePicker(PICKER);
    await kvSet('handle', handle);
    mode = 'file';
    return { mode, data: await readFile() };
  }
  async function create(data) {
    handle = await showSaveFilePicker({ ...PICKER, suggestedName: 'kanji.json' });
    await kvSet('handle', handle);
    mode = 'file';
    await save(data);
    return { mode };
  }
  // Sempre a la còpia del navegador; i, si hi ha arxiu, també a l'arxiu.
  async function save(data) {
    const json = JSON.stringify(data, null, 2);
    try {
      localStorage.setItem(LS, json);
    } catch (e) {
      if (mode !== 'file') throw e; // si no hi ha arxiu, és l'única còpia: l'error s'ha de veure
    }
    if (mode === 'file') {
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
    }
  }

  return {
    init, reconnect, open, create, save, canFile,
    get mode() { return mode; },
    get name() { return handle && handle.name; },
  };
})();
