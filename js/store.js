// Estat en memòria i únic lloc que el canvia. Hi ha aquestes parts:
// - "kanji": les fitxes (kanji sols i paraules);
// - "progress": el progrés de pràctica de cada fitxa, a part perquè regenerar-la no l'esborri;
// - "history": quantes respostes has donat cada dia (per al calendari);
// - "tags" i "cardTags": les etiquetes (en arbre: una pot anar dins d'una altra) i les que té cada fitxa,
//   també a part del contingut.
// Cada canvi es desa amb Almacen al cap de 400 ms.
const Store = (() => {
  let data = { version: 1, kanji: [], progress: {}, history: {}, tags: [], cardTags: {} };
  let saveTimer = null, onStatus = () => {};

  const DAYS = [0, 1, 3, 7, 14, 30]; // dies fins al proper repàs segons la caixa (1-5)
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const natural = v => (Number.isInteger(v) && v > 0 ? v : 0);
  const isObject = v => !!v && typeof v === 'object';
  const TAG_ID = /^t\d{1,9}$/;
  const TAG_MAX = 40; // llargada màxima del nom d'una etiqueta

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
    const tags = normTags(input && input.tags);
    const cardTags = normCardTags(input && input.cardTags, seen, tags);
    return { version: 1, kanji, progress, history, tags, cardTags };
  }

  // Etiquetes: { id, name, parent }, amb parent '' per a les principals. Les que tenen un pare que no existeix
  // o fan un cercle (A dins de B i B dins de A) passen a ser principals.
  function normTags(input) {
    const tags = [], ids = new Set();
    (Array.isArray(input) ? input : []).forEach(raw => {
      if (!isObject(raw) || !TAG_ID.test(raw.id) || ids.has(raw.id)) return;
      const name = tagName(raw.name);
      if (!name) return;
      ids.add(raw.id);
      tags.push({ id: raw.id, name, parent: typeof raw.parent === 'string' ? raw.parent : '' });
    });
    tags.forEach(tag => {
      if (tag.parent && (!ids.has(tag.parent) || inLoop(tags, tag))) tag.parent = '';
    });
    return tags;
  }
  // Pujant de pare en pare, es torna a trobar la mateixa etiqueta?
  function inLoop(tags, tag) {
    const byId = new Map(tags.map(x => [x.id, x]));
    let parent = byId.get(tag.parent);
    for (let steps = 0; parent && steps <= tags.length; steps++) {
      if (parent === tag) return true;
      parent = byId.get(parent.parent);
    }
    return false;
  }
  // Les etiquetes de cada fitxa: només de fitxes i etiquetes que existeixen, i sense repetir.
  function normCardTags(input, cards, tags) {
    const ids = new Set(tags.map(tag => tag.id)), cardTags = {};
    Object.keys(isObject(input) ? input : {}).forEach(ch => {
      const list = Array.isArray(input[ch]) ? [...new Set(input[ch].filter(id => ids.has(id)))] : [];
      if (cards.has(ch) && list.length) cardTags[ch] = list;
    });
    return cardTags;
  }
  // Nom net: una línia, sense caràcters de control i com a molt TAG_MAX caràcters.
  const tagName = name => (typeof name === 'string' ? name : '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TAG_MAX);

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

  // ---------- Arbre d'etiquetes ----------
  const findTag = id => data.tags.find(tag => tag.id === id) || null;
  // Per ordre alfabètic, amb els números en ordre (2 abans que 10) i sense mirar majúscules ni accents.
  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  const childrenOf = parent => data.tags.filter(tag => tag.parent === parent).sort(byName);
  // L'etiqueta i totes les de dins (i les de dins d'aquestes…).
  function branchOf(id) {
    if (!findTag(id)) return [];
    const ids = [id];
    for (let i = 0; i < ids.length; i++) childrenOf(ids[i]).forEach(tag => ids.push(tag.id));
    return ids;
  }
  // Ja n'hi ha una amb aquest nom (sense mirar majúscules ni accents) dins del mateix pare?
  const nameTaken = (name, parent, exceptId) => childrenOf(parent)
    .some(tag => tag.id !== exceptId && byName(tag, { name }) === 0);
  const nextTagId = () => 't' + (Math.max(0, ...data.tags.map(tag => +tag.id.slice(1))) + 1);

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
      delete data.cardTags[ch];
      persist();
    },

    // ---------- Etiquetes ----------
    get tags() { return data.tags; },
    tag: findTag,
    // Les de dins d'una etiqueta ('' = les principals), per ordre alfabètic.
    tagChildren: childrenOf,
    tagBranch: branchOf,
    // De la principal fins a aquesta: [Temps, Mesos].
    tagPath(id) {
      const path = [];
      for (let tag = findTag(id); tag && path.length <= data.tags.length; tag = findTag(tag.parent)) path.unshift(tag);
      return path;
    },
    // El camí en text: «Temps › Mesos».
    tagLabel(id) { return this.tagPath(id).map(tag => tag.name).join(' › '); },
    // Totes, en arbre: cada una seguida de les de dins, amb la fondària (0 = principal).
    tagTree() {
      const tree = [];
      const walk = (parent, depth) => childrenOf(parent).forEach(tag => {
        tree.push({ tag, depth });
        walk(tag.id, depth + 1);
      });
      walk('', 0);
      return tree;
    },
    // Les etiquetes que li has posat a una fitxa (no les de més amunt de l'arbre).
    cardTags: ch => data.cardTags[ch] || [],
    // Les fitxes que tenen l'etiqueta o alguna de les de dins.
    cardsInTag(id) {
      const branch = new Set(branchOf(id));
      return data.kanji.filter(card => (data.cardTags[card.kanji] || []).some(x => branch.has(x)));
    },
    // Crear, canviar el nom i moure tornen { error } (clau d'i18n) si no es pot; crear també torna { id }.
    addTag(name, parent = '') {
      const clean = tagName(name);
      if (!clean) return { error: 'tags.empty' };
      if (parent && !findTag(parent)) parent = '';
      if (nameTaken(clean, parent)) return { error: 'tags.taken' };
      const id = nextTagId();
      data.tags.push({ id, name: clean, parent });
      persist();
      return { id };
    },
    renameTag(id, name) {
      const tag = findTag(id), clean = tagName(name);
      if (!tag) return { error: 'tags.notFound' };
      if (!clean) return { error: 'tags.empty' };
      if (nameTaken(clean, tag.parent, id)) return { error: 'tags.taken' };
      tag.name = clean;
      persist();
      return {};
    },
    // A dins d'una altra ('' = principal), però mai dins d'ella mateixa ni de les seves.
    moveTag(id, parent) {
      const tag = findTag(id);
      if (!tag) return { error: 'tags.notFound' };
      if (parent && (!findTag(parent) || branchOf(id).includes(parent))) return { error: 'tags.loop' };
      if (nameTaken(tag.name, parent, id)) return { error: 'tags.taken' };
      tag.parent = parent;
      persist();
      return {};
    },
    // Esborra l'etiqueta i les de dins, i les treu de les fitxes (les fitxes no s'esborren).
    removeTag(id) {
      const gone = new Set(branchOf(id));
      if (!gone.size) return;
      data.tags = data.tags.filter(tag => !gone.has(tag.id));
      Object.keys(data.cardTags).forEach(ch => {
        const list = data.cardTags[ch].filter(x => !gone.has(x));
        if (list.length) data.cardTags[ch] = list;
        else delete data.cardTags[ch];
      });
      persist();
    },
    // Posa (on = true) o treu una etiqueta d'una fitxa.
    setCardTag(ch, id, on) {
      if (findIndex(ch) < 0 || !findTag(id)) return;
      const list = (data.cardTags[ch] || []).filter(x => x !== id);
      if (on) list.push(id);
      if (list.length) data.cardTags[ch] = list;
      else delete data.cardTags[ch];
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
