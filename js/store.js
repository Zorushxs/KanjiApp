// Estat en memòria i únic lloc que el canvia. Hi ha tres parts:
// - "kanji": les fitxes (kanji sols i paraules);
// - "progress": el progrés de pràctica de cada fitxa, a part perquè regenerar-la no l'esborri;
// - "history": quantes respostes has donat cada dia (per al calendari).
// Cada canvi es desa amb Almacen al cap de 400 ms.
const Store = (() => {
  let data = { version: 1, kanji: [], progress: {}, history: {} };
  let saveTimer = null, onStatus = () => {};

  const DAYS = [0, 1, 3, 7, 14, 30]; // dies fins al proper repàs segons la caixa (1-5)
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const natural = v => (Number.isInteger(v) && v > 0 ? v : 0);
  const isObject = v => !!v && typeof v === 'object';

  // ---------- Carregar ----------
  // Neteja les dades que arriben de l'arxiu: fitxes amb la forma bona i sense repetir, progrés i historial vàlids.
  function norm(input) {
    const kanji = [], seen = new Set();
    (Array.isArray(input && input.kanji) ? input.kanji : []).forEach(raw => {
      const card = Validar.coerce(raw);
      if (Validar.isCard(card.kanji) && !seen.has(card.kanji)) {
        seen.add(card.kanji);
        kanji.push(card);
      }
    });

    const progress = {}, savedProgress = isObject(input && input.progress) ? input.progress : {};
    Object.keys(savedProgress).forEach(ch => {
      const p = savedProgress[ch];
      if (!Validar.isCard(ch) || !isObject(p)) return;
      progress[ch] = {
        box: Math.min(5, Math.max(1, parseInt(p.box, 10) || 1)),
        due: DATE.test(p.due) ? p.due : U.today(),
        seen: natural(p.seen),
        fails: natural(p.fails),
      };
      if (DATE.test(p.last)) progress[ch].last = p.last; // últim dia que l'has practicat
    });

    const history = {}, savedHistory = isObject(input && input.history) ? input.history : {};
    Object.keys(savedHistory).forEach(day => {
      if (DATE.test(day) && natural(savedHistory[day])) history[day] = savedHistory[day];
    });
    return { version: 1, kanji, progress, history };
  }

  // ---------- Desar ----------
  function persist() {
    clearTimeout(saveTimer);
    onStatus('saving');
    saveTimer = setTimeout(async () => {
      saveTimer = null;
      try {
        await Almacen.save(data);
        onStatus('saved');
      } catch (e) {
        console.error(e);
        onStatus('error');
      }
    }, 400);
  }
  // Si tanques la pestanya o canvies d'app just després d'un canvi, desa sense esperar.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden' || !saveTimer) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    Almacen.save(data).then(() => onStatus('saved'), e => { console.error(e); onStatus('error'); });
  });

  // ---------- Leitner ----------
  // Encert → puja una caixa; dubte → es queda; error → caixa 1. Una fitxa nova compta com a caixa 1.
  // Si ja l'has practicat avui (repàs extra), només compta si la falles: no puja dues caixes el mateix dia.
  const practicedToday = progress => !!progress && progress.last === U.today();
  function nextBox(progress, grade) {
    const box = progress ? progress.box : 1;
    if (grade === 'yes') return Math.min(5, box + 1);
    if (grade === 'doubt') return box;
    return 1;
  }
  const keepsBox = (progress, grade) => practicedToday(progress) && grade !== 'no';

  const findIndex = ch => data.kanji.findIndex(card => card.kanji === ch);

  return {
    get kanji() { return data.kanji; },
    get history() { return data.history; },
    onStatus(fn) { onStatus = fn; },
    load(input) { data = norm(input); },
    snapshot: () => data,
    flush: () => Almacen.save(data),

    // ---------- Fitxes ----------
    get: ch => data.kanji.find(card => card.kanji === ch),
    // Fusiona per caràcter: les noves van al final i les que ja tens se substitueixen al seu lloc.
    // El progrés no es toca.
    merge(list) {
      let added = 0, updated = 0;
      list.forEach(card => {
        const i = findIndex(card.kanji);
        if (i < 0) {
          data.kanji.push(card);
          added++;
          return;
        }
        // Si les lectures principals (una o dues) les havies triat tu i encara hi són, es queden les teves.
        const old = data.kanji[i];
        const kept = old.mainByUser ? Card.keptMains(old, card) : [];
        if (kept.length) {
          card.reading = kept[0];
          card.reading2 = kept[1] || '';
          card.mainByUser = true;
        }
        data.kanji[i] = card;
        updated++;
      });
      if (added + updated) persist();
      return { added, updated };
    },
    // Correccions fetes a mà des de la fitxa: se substitueix el contingut i el progrés no es toca.
    update(ch, card) {
      const i = findIndex(ch);
      if (i < 0) return;
      data.kanji[i] = card;
      persist();
    },
    // Verificació: false (per verificar) · true (verificat) · 'error' (té errors).
    setVerified(ch, verified) {
      const card = data.kanji[findIndex(ch)];
      if (!card) return;
      card.verified = Card.VERIFIED.includes(verified) ? verified : false;
      persist();
    },
    // Nou ordre per a les fitxes de la llista (arrossegant-les a l'inici). Si hi ha un filtre, només es
    // mouen entre els llocs que ocupaven: les que no es veuen es queden on eren.
    reorder(order) {
      const moving = new Set(order);
      const slots = data.kanji.map((card, i) => (moving.has(card.kanji) ? i : -1)).filter(i => i >= 0);
      if (slots.length !== order.length) return;
      const cards = order.map(ch => data.kanji[findIndex(ch)]);
      if (slots.every((slot, n) => data.kanji[slot] === cards[n])) return;
      slots.forEach((slot, n) => { data.kanji[slot] = cards[n]; });
      persist();
    },
    remove(ch) {
      data.kanji = data.kanji.filter(card => card.kanji !== ch);
      delete data.progress[ch];
      persist();
    },

    // ---------- Progrés ----------
    prog: ch => data.progress[ch] || null,
    isDue(ch, day) {
      const progress = data.progress[ch];
      return !!progress && progress.due <= (day || U.today());
    },
    // Ja practicada avui i sense que toqui (per al repàs extra del mateix dia).
    doneToday(ch) { return practicedToday(data.progress[ch]) && !this.isDue(ch); },
    // Dies fins al proper repàs si respons grade; null si no canviaria res (repàs extra encertat o dubtós).
    nextDays(ch, grade) {
      const progress = data.progress[ch];
      return keepsBox(progress, grade) ? null : DAYS[nextBox(progress, grade)];
    },
    review(ch, grade) {
      const progress = data.progress[ch], keep = keepsBox(progress, grade);
      const box = keep ? progress.box : nextBox(progress, grade);
      data.progress[ch] = {
        box,
        due: keep ? progress.due : U.addDays(DAYS[box]),
        seen: (progress ? progress.seen : 0) + 1,
        fails: (progress ? progress.fails : 0) + (grade === 'no' ? 1 : 0),
        last: U.today(),
      };
      persist();
    },
    // Una resposta més avui (per al calendari). Compta totes: repàs lliure i repeticions incloses.
    tally() {
      const day = U.today();
      data.history[day] = (data.history[day] || 0) + 1;
      persist();
    },
  };
})();
