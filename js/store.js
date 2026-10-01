// Estat en memòria: el contingut ("kanji": fitxes de kanji sols i de paraules), el progrés de pràctica
// ("progress", pel camp "kanji" de cada fitxa) i quantes
// respostes has donat cada dia ("history", per al calendari). El progrés viu a part perquè regenerar
// un kanji no l'esborri. Desa només amb Almacen.
const Store = (() => {
  let data = { version: 1, kanji: [], progress: {}, history: {} }, timer = null, onStatus = () => {};
  const DAYS = [0, 1, 3, 7, 14, 30]; // dies fins al proper repàs segons la caixa (1-5)
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const nat = v => (Number.isInteger(v) && v > 0 ? v : 0);

  function norm(d) {
    const kanji = [], seen = new Set();
    (Array.isArray(d && d.kanji) ? d.kanji : []).forEach(o => {
      const k = Validar.coerce(o);
      if (Validar.isCard(k.kanji) && !seen.has(k.kanji)) { seen.add(k.kanji); kanji.push(k); }
    });
    const progress = {}, src = d && d.progress && typeof d.progress === 'object' ? d.progress : {};
    Object.keys(src).forEach(ch => {
      const p = src[ch];
      if (!Validar.isCard(ch) || !p || typeof p !== 'object') return;
      progress[ch] = { box: Math.min(5, Math.max(1, parseInt(p.box, 10) || 1)), due: DATE.test(p.due) ? p.due : U.today(), seen: nat(p.seen), fails: nat(p.fails) };
      if (DATE.test(p.last)) progress[ch].last = p.last; // últim dia que l'has practicat
    });
    const history = {}, h = d && d.history && typeof d.history === 'object' ? d.history : {};
    Object.keys(h).forEach(day => { if (DATE.test(day) && nat(h[day])) history[day] = h[day]; });
    return { version: 1, kanji, progress, history };
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
  // Si ja l'has practicat avui (repàs extra), només compta si el falles: no puja dues caixes el mateix dia.
  const doneToday = p => !!p && p.last === U.today();
  const nextBox = (p, g) => (g === 'yes' ? Math.min(5, (p ? p.box : 1) + 1) : g === 'doubt' ? (p ? p.box : 1) : 1);

  return {
    get kanji() { return data.kanji; },
    get history() { return data.history; },
    onStatus(fn) { onStatus = fn; },
    load(d) { data = norm(d); },
    get: ch => data.kanji.find(k => k.kanji === ch),
    prog: ch => data.progress[ch] || null,
    isDue(ch, day) { const p = data.progress[ch]; return !!p && p.due <= (day || U.today()); },
    // Ja practicat avui i sense que toqui (per al repàs extra del mateix dia).
    doneToday(ch) { const p = data.progress[ch]; return doneToday(p) && !this.isDue(ch); },
    // Fusiona per caràcter: els nous van al final, els existents se substitueixen al seu lloc. El progrés no es toca.
    merge(list) {
      let added = 0, updated = 0;
      list.forEach(k => {
        const i = data.kanji.findIndex(x => x.kanji === k.kanji);
        if (i < 0) { data.kanji.push(k); added++; return; }
        // Si les lectures principals (una o dues) les havies triat tu i encara hi són, es queden les teves.
        const old = data.kanji[i], kept = old.mainByUser ? Validar.keptMains(old, k) : [];
        if (kept.length) { k.reading = kept[0]; k.reading2 = kept[1] || ''; k.mainByUser = true; }
        data.kanji[i] = k; updated++;
      });
      if (added + updated) persist();
      return { added, updated };
    },
    // Verificació: false (per verificar) · true (verificat) · 'error' (té errors).
    setVerified(ch, v) { const k = data.kanji.find(x => x.kanji === ch); if (k) { k.verified = Validar.VERIFIED.includes(v) ? v : false; persist(); } },
    // Correccions fetes a mà des de la fitxa: se substitueix el contingut i el progrés no es toca.
    update(ch, k) { const i = data.kanji.findIndex(x => x.kanji === ch); if (i >= 0) { data.kanji[i] = k; persist(); } },
    remove(ch) { data.kanji = data.kanji.filter(k => k.kanji !== ch); delete data.progress[ch]; persist(); },
    // Dies fins al proper repàs si respons g; null si no canviaria res (repàs extra encertat o dubtós).
    nextDays(ch, g) { const p = data.progress[ch]; return doneToday(p) && g !== 'no' ? null : DAYS[nextBox(p, g)]; },
    review(ch, g) {
      const p = data.progress[ch], today = U.today();
      const keep = doneToday(p) && g !== 'no', box = keep ? p.box : nextBox(p, g);
      data.progress[ch] = {
        box, due: keep ? p.due : U.addDays(DAYS[box]),
        seen: (p ? p.seen : 0) + 1, fails: (p ? p.fails : 0) + (g === 'no' ? 1 : 0), last: today,
      };
      persist();
    },
    // Una resposta més avui (per al calendari). Compta totes: repàs lliure i repeticions incloses.
    tally() { const d = U.today(); data.history[d] = (data.history[d] || 0) + 1; persist(); },
    snapshot: () => data,
    flush: () => Almacen.save(data),
  };
})();
