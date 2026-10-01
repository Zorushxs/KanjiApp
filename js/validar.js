// Llegeix la resposta de la IA, en valida els camps i li dona la forma exacta d'una fitxa (kanji o paraula).
// Aquí es neteja tot el text i, a més, les pantalles l'escapen en pintar-lo: no ens refiem mai del contingut.
const Validar = (() => {
  const HAN = /^\p{Script=Han}$/u;
  const JP = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
  const ON = /^[\p{Script=Katakana}ー・.\-]+$/u;
  const KUN = /^[\p{Script=Hiragana}ー.\-]+$/u;
  const KANA = /^[\p{Script=Hiragana}\p{Script=Katakana}ー・、。，．！？!?,.\s「」『』〜～…\-]+$/u;
  const EMOJI = /^[^\p{L}\p{N}\s<>&"'`]{1,16}$/u;
  const CTRL = /[\u0000-\u001f\u007f\u200b\u200c\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;
  const READ = /^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u; // lectura principal: només kana
  const ROMA = /^[A-Za-zĀāĪīŪūĒēŌō'’\s.,!?;:"()-]+$/; // rōmaji de la frase
  const TXT = 400, LONG = 650; // longitud màxima dels textos explicatius (origen i curiositat, més llargs)
  const LANGS = ['ca', 'es', 'en']; // idiomes del contingut (els que demana el prompt)
  const VERIFIED = [false, true, 'error']; // per verificar · verificat · té errors
  // Què pot anar al camp "kanji": un kanji sol o una paraula japonesa (kanji, kana o barreja), sense espais.
  const WORD = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー々〆]{1,15}$/u;
  const isCard = s => typeof s === 'string' && (HAN.test(s) || WORD.test(s));
  const isWord = s => isCard(s) && !HAN.test(s);

  // Avisos sense repetir: { k: clau de i18n, p: valors }.
  const notes = () => {
    const list = [];
    return { list, add(k, p) { const id = k + JSON.stringify(p || {}); if (!list.some(x => x.id === id)) list.push({ id, k, p }); } };
  };
  function str(v, max, n) {
    if (typeof v === 'number') v = String(v);
    if (typeof v !== 'string') return '';
    let s = v.replace(CTRL, ' ').replace(/\s+/g, ' ').trim();
    if (s.length > max) { s = s.slice(0, max).trimEnd() + '…'; if (n) n.add('val.long'); }
    return s;
  }
  // Un text per idioma de contingut: { ca, es, en }. Si arriba un text sol, serveix per a tots.
  const byLang = fn => Object.fromEntries(LANGS.map(l => [l, fn(l)]));
  const pair = (v, max, n) => byLang(l => str(typeof v === 'string' ? v : v && v[l], max, n));
  const items = v => Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,、;]/) : [];
  const words = (v, max, n) => [...new Set(items(v).map(x => str(x, max, n)).filter(Boolean))].slice(0, 8);
  const int = (v, lo, hi) => {
    const x = typeof v === 'string' ? Number(v.trim().replace(/^N/i, '')) : v;
    return Number.isInteger(x) && x >= lo && x <= hi ? x : null;
  };

  // Dona la forma exacta a qualsevol objecte, sense jutjar-ne el contingut. També serveix per carregar l'arxiu.
  function coerce(o, n) {
    o = o && typeof o === 'object' && !Array.isArray(o) ? o : {};
    const m = o.meanings, s = o.sentence && typeof o.sentence === 'object' ? o.sentence : {};
    return {
      kanji: str(o.kanji, 20),
      meanings: Array.isArray(m) || typeof m === 'string'
        ? byLang(l => (l === 'en' ? words(m, 60, n) : []))
        : byLang(l => words(m && m[l], 60, n)),
      onyomi: words(o.onyomi, 20, n).map(r => r.replace(/\s/g, '')),
      kunyomi: words(o.kunyomi, 20, n).map(r => r.replace(/\s/g, '')),
      reading: str(o.reading, 20, n).replace(/\s/g, ''), // la lectura que s'aprèn primer (一 → いち)
      reading2: str(o.reading2, 20, n).replace(/\s/g, ''), // una segona lectura principal, opcional i només triada per tu (七: しち / なな)
      strokes: int(o.strokes, 1, 64),
      jlpt: int(o.jlpt, 1, 5),
      emoji: str(o.emoji, 64),
      origin: pair(o.origin, LONG, n),
      mnemonic: pair(o.mnemonic, TXT, n),
      examples: (Array.isArray(o.examples) ? o.examples : []).filter(e => e && typeof e === 'object').slice(0, 6)
        .map(e => ({ word: str(e.word, 30, n), reading: str(e.reading, 60, n), meaning: pair(e.meaning, 120, n) }))
        .filter(e => e.word),
      sentence: { jp: str(s.jp, 150, n), reading: str(s.reading, 250, n), romaji: str(s.romaji, 300, n), meaning: pair(s.meaning, 250, n) },
      trivia: pair(o.trivia, LONG, n),
      verified: VERIFIED.includes(o.verified) ? o.verified : false,
      edited: o.edited === true, // l'has corregida tu des de la fitxa
      mainByUser: o.mainByUser === true, // la lectura principal l'has triada tu
    };
  }
  // Totes les lectures d'un kanji tal com poden ser la principal: ニチ → にち, た.べる → たべる i た, -び → び.
  const readings = k => [...k.onyomi, ...k.kunyomi].flatMap(r => [U.plain(r), r.split('.')[0].replace(/-/g, '')]).map(U.hira);
  // En regenerar: de les lectures principals que havies triat (una o dues), les que encara hi són.
  // D'una paraula, la lectura és la nova i es conserva la segona que hi havies posat (si no és la mateixa).
  const keptMains = (old, k) => (isWord(k.kanji)
    ? (k.reading && old.reading2 && old.reading2 !== k.reading ? [k.reading, old.reading2] : [])
    : [old.reading, old.reading2].filter(r => r && readings(k).includes(r)));
  const isKana = s => READ.test(s);

  // Revisió estricta d'un element que ve de la IA: errors (no es desa) i avisos (es desa igualment).
  function check(raw) {
    const n = notes(), errors = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { item: null, kanji: '', errors: [{ k: 'val.notObject' }], warnings: [] };
    const k = coerce(raw, n);
    k.verified = false; k.edited = false; k.mainByUser = false; k.reading2 = ''; // això només ho poses tu, des de la fitxa
    // Una fitxa és un kanji sol o una paraula (学校, 食べる, じゃがいも): les paraules no tenen on/kun ni traços.
    const word = isWord(k.kanji);
    if (!isCard(k.kanji)) errors.push({ k: 'val.kanji', p: { v: k.kanji || '—' } });
    if (LANGS.every(l => !k.meanings[l].length)) errors.push({ k: 'val.meanings' });
    if (word) { k.onyomi = []; k.kunyomi = []; k.strokes = null; }
    else {
      if (!k.onyomi.length && !k.kunyomi.length) errors.push({ k: 'val.readings' });
      k.onyomi.forEach(v => { if (!ON.test(v)) errors.push({ k: 'val.on', p: { v } }); });
      k.kunyomi.forEach(v => { if (!KUN.test(v)) errors.push({ k: 'val.kun', p: { v } }); });
      if (k.strokes === null) {
        if (raw.strokes == null || raw.strokes === '') n.add('val.noStrokes'); else errors.push({ k: 'val.strokes' });
      }
    }
    if (k.jlpt === null && raw.jlpt != null && raw.jlpt !== '' && raw.jlpt !== 0) n.add('val.jlpt');
    if (k.emoji && !EMOJI.test(k.emoji)) { k.emoji = ''; n.add('val.emoji'); }

    const given = Array.isArray(raw.examples) ? Math.min(raw.examples.length, 5) : 0;
    k.examples = k.examples.filter(e => JP.test(e.word) && KANA.test(e.reading)).slice(0, 5);
    if (k.examples.length < given) n.add('val.example');
    if (!word) k.examples.forEach(e => { if (HAN.test(k.kanji) && !e.word.includes(k.kanji)) n.add('val.exampleNoKanji', { v: e.word }); });
    if (k.sentence.reading && !KANA.test(k.sentence.reading)) n.add('val.sentenceReading');
    if (k.sentence.romaji && !ROMA.test(k.sentence.romaji)) { k.sentence.romaji = ''; n.add('val.romaji'); }

    // Lectura principal: en kana. D'un kanji, es desa en hiragana i hauria de ser una de les seves lectures;
    // d'una paraula és obligatòria (és com es llegeix tota la paraula) i es deixa tal com ve.
    if (word) { if (!READ.test(k.reading)) { errors.push({ k: 'val.wordReading' }); } }
    else if (!k.reading) n.add('val.noReading');
    else if (!READ.test(k.reading)) { n.add('val.reading', { v: k.reading }); k.reading = ''; }
    else {
      k.reading = U.hira(k.reading);
      if (!readings(k).includes(k.reading)) n.add('val.readingNotListed', { v: k.reading });
    }

    const texts = [k.mnemonic, k.origin, k.trivia, k.sentence.meaning, ...k.examples.map(e => e.meaning)];
    const some = p => LANGS.some(l => p[l] && p[l].length);
    LANGS.forEach(l => {
      if ((!k.meanings[l].length && some(k.meanings)) || texts.some(p => !p[l] && some(p))) n.add('val.missing.' + l);
    });
    return { item: errors.length ? null : k, kanji: k.kanji, errors, warnings: n.list };
  }

  // Si la resposta s'ha tallat (és massa llarga) o té algun tros mal format, aprofita les fitxes { … } de la
  // llista que han arribat senceres. Recorre el text tenint en compte les cometes i els escapaments.
  const BS = String.fromCharCode(92);
  function salvage(b) {
    const a = b.indexOf('['), out = [];
    if (a < 0) return out;
    let depth = 0, start = -1, inStr = false, esc = false;
    for (let i = a + 1; i < b.length; i++) {
      const c = b[i];
      if (inStr) { if (esc) esc = false; else if (c === BS) esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === '{') { if (depth === 0) start = i; depth++; }
      else if (c === '}' && depth > 0) {
        depth--;
        if (depth === 0) { try { out.push(JSON.parse(b.slice(start, i + 1))); } catch {} }
      } else if (c === ']' && depth === 0) break;
    }
    return out;
  }

  // Treu el JSON de la resposta: un o més blocs ```json, o el tros entre el primer [ { i l'últim ] }.
  // Si el bloc no es tanca (resposta tallada), se n'aprofiten les fitxes senceres i la llista es marca «partial».
  function extract(text) {
    const s = String(text || '');
    const blocks = [...s.matchAll(/```[a-zA-Z]*[ \t]*\r?\n?([\s\S]*?)```/g)].map(m => m[1].trim()).filter(Boolean);
    const open = /```[a-zA-Z]*[ \t]*\r?\n([\s\S]*)$/.exec(s);
    const out = [];
    for (const b of blocks.length ? blocks : [cut(open ? open[1] : s)]) {
      let d;
      try { d = JSON.parse(b); }
      catch (e) {
        try { d = JSON.parse(b.replace(/,\s*([\]}])/g, '$1')); } // comes finals, un error típic
        catch {
          d = salvage(b);
          if (!d.length) throw new Error(t('add.badJson', { msg: e.message }));
          out.partial = true;
        }
      }
      if (d && !Array.isArray(d) && Array.isArray(d.kanji)) d = d.kanji;
      else if (d && typeof d === 'object' && !Array.isArray(d)) d = [d];
      if (!Array.isArray(d)) throw new Error(t('add.notList'));
      out.push(...d);
    }
    return out;
  }
  // Text que Claude escriu fora dels blocs ```json (per exemple, l'avís de paraules que s'escriuen en kana).
  // Només si la resposta porta blocs; si no, tot és JSON. Es neteja i es retalla com qualsevol altre text.
  function note(text) {
    const s = String(text || '');
    return /```/.test(s) ? str(s.replace(/```[a-zA-Z]*[ \t]*\r?\n?[\s\S]*?(```|$)/g, ' '), 400) : '';
  }
  function cut(s) {
    const a = s.search(/[[{]/), b = Math.max(s.lastIndexOf(']'), s.lastIndexOf('}'));
    if (a < 0) throw new Error(t('add.noJson'));
    return b > a ? s.slice(a, b + 1) : s.slice(a);
  }

  // Previsualització: cada element amb el seu estat (new | upd | same | err). get(ch) torna el kanji actual.
  const same = (a, b) => JSON.stringify({ ...a, verified: false }) === JSON.stringify(b);
  function review(text, get) {
    const raws = extract(text), rows = raws.map(check), last = new Map();
    rows.partial = !!raws.partial; // la resposta s'ha tallat: només hi ha les fitxes que han arribat senceres
    rows.forEach((r, i) => { if (r.item) last.set(r.item.kanji, i); });
    rows.forEach((r, i) => {
      if (!r.item) { r.status = 'err'; return; }
      if (last.get(r.item.kanji) !== i) { r.status = 'err'; r.item = null; r.errors.push({ k: 'val.dup' }); return; }
      const old = get(r.item.kanji);
      // Es compara amb el que quedaria en desar-la: les lectures principals que havies triat es mantenen.
      const kept = old && old.mainByUser ? keptMains(old, r.item) : [];
      const merged = kept.length ? { ...r.item, reading: kept[0], reading2: kept[1] || '', mainByUser: true } : r.item;
      r.status = !old ? 'new' : same(old, merged) ? 'same' : 'upd';
      if (r.status === 'upd' && old.verified === true) r.warnings.push({ k: 'add.loseVerified' });
      if (r.status === 'upd' && old.edited) r.warnings.push({ k: 'add.loseEdits' });
      if (r.status === 'upd' && kept.length) {
        r.warnings.push(isWord(r.item.kanji) ? { k: 'add.keepsReading2', p: { v: kept[1] } }
          : { k: kept.length > 1 ? 'add.keepsMains' : 'add.keepsMain', p: { v: kept.join(' / ') } });
      }
    });
    return rows;
  }
  return { coerce, check, extract, review, note, isCard, isWord, isKana, readings, keptMains, VERIFIED };
})();
