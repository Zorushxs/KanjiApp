// Estat en memòria: el contingut ("kanji") i el progrés de pràctica ("progress"), units pel caràcter.
// El progrés viu a part perquè regenerar un kanji no l'esborri. Desa només amb Almacen.
const Store = (() => {
  let data = { version: 1, kanji: [], progress: {} }, timer = null, onStatus = () => {};
  const DAYS = [0, 1, 3, 7, 14, 30]; // dies fins al proper repàs segons la caixa (1-5)
  const HAN = /^\p{Script=Han}$/u, DATE = /^\d{4}-\d{2}-\d{2}$/;
  const nat = v => (Number.isInteger(v) && v > 0 ? v : 0);

  function norm(d) {
    const kanji = [], seen = new Set();
    (Array.isArray(d && d.kanji) ? d.kanji : []).forEach(o => {
      const k = Validar.coerce(o);
      if (HAN.test(k.kanji) && !seen.has(k.kanji)) { seen.add(k.kanji); kanji.push(k); }
    });
    const progress = {}, src = d && d.progress && typeof d.progress === 'object' ? d.progress : {};
    Object.keys(src).forEach(ch => {
      const p = src[ch];
      if (!HAN.test(ch) || !p || typeof p !== 'object') return;
      progress[ch] = { box: Math.min(5, Math.max(1, parseInt(p.box, 10) || 1)), due: DATE.test(p.due) ? p.due : U.today(), seen: nat(p.seen), fails: nat(p.fails) };
    });
    return { version: 1, kanji, progress };
  }
  function persist() {
    clearTimeout(timer); onStatus('saving');
    timer = setTimeout(async () => {
      timer = null;
      try { await Almacen.save(data); onStatus('saved'); } catch (e) { console.error(e); onStatus('error'); }
    }, 400);
  }
  // Si tanques la pestanya o canvies d'app just després d'un canvi, desa sense esperar.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden' || !timer) return;
    clearTimeout(timer); timer = null;
    Almacen.save(data).then(() => onStatus('saved'), e => { console.error(e); onStatus('error'); });
  });

  // Leitner: encert → puja una caixa; dubte → es queda; error → caixa 1. Un kanji nou compta com a caixa 1.
  const nextBox = (p, g) => (g === 'yes' ? Math.min(5, (p ? p.box : 1) + 1) : g === 'doubt' ? (p ? p.box : 1) : 1);

  return {
    get kanji() { return data.kanji; },
    onStatus(fn) { onStatus = fn; },
    load(d) { data = norm(d); },
    get: ch => data.kanji.find(k => k.kanji === ch),
    prog: ch => data.progress[ch] || null,
    isDue(ch, day) { const p = data.progress[ch]; return !!p && p.due <= (day || U.today()); },
    // Fusiona per caràcter: els nous van al final, els existents se substitueixen al seu lloc. El progrés no es toca.
    merge(list) {
      let added = 0, updated = 0;
      list.forEach(k => {
        const i = data.kanji.findIndex(x => x.kanji === k.kanji);
        if (i < 0) { data.kanji.push(k); added++; } else { data.kanji[i] = k; updated++; }
      });
      if (added + updated) persist();
      return { added, updated };
    },
    // Verificació: false (per verificar) · true (verificat) · 'error' (té errors).
    setVerified(ch, v) { const k = data.kanji.find(x => x.kanji === ch); if (k) { k.verified = Validar.VERIFIED.includes(v) ? v : false; persist(); } },
    remove(ch) { data.kanji = data.kanji.filter(k => k.kanji !== ch); delete data.progress[ch]; persist(); },
    nextDays: (ch, g) => DAYS[nextBox(data.progress[ch], g)],
    review(ch, g) {
      const p = data.progress[ch], box = nextBox(p, g);
      data.progress[ch] = { box, due: U.addDays(DAYS[box]), seen: (p ? p.seen : 0) + 1, fails: (p ? p.fails : 0) + (g === 'no' ? 1 : 0) };
      persist();
    },
    snapshot: () => data,
    flush: () => Almacen.save(data),
  };
})();
