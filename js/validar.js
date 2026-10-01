// Llegeix la resposta de la IA, en valida els camps i li dona la forma exacta d'una fitxa (kanji o paraula).
// Aquí es neteja tot el text i, a més, les pantalles l'escapen en pintar-lo: no ens refiem mai del contingut.
//
// Ordre: extract() treu el JSON del text → check() revisa cada fitxa (coerce() li dona la forma) →
// review() diu si cada una és nova, actualitzada, igual o té errors.
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
  // Què pot anar al camp "kanji": un kanji sol o una paraula japonesa (kanji, kana o barreja), sense espais.
  const WORD = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー々〆]{1,15}$/u;

  const TXT = 400, LONG = 650; // longitud màxima dels textos explicatius (origen i curiositat, més llargs)
  const LANGS = ['ca', 'es', 'en']; // idiomes del contingut (els que demana el prompt)

  const isCard = text => typeof text === 'string' && (HAN.test(text) || WORD.test(text));
  const isKana = text => READ.test(text);

  // ---------- Donar forma (coerce) ----------
  // Avisos sense repetir: { k: clau de i18n, p: valors }.
  function notes() {
    const list = [];
    return {
      list,
      add(key, params) {
        const id = key + JSON.stringify(params || {});
        if (!list.some(x => x.id === id)) list.push({ id, k: key, p: params });
      },
    };
  }
  // Text net d'una línia: sense caràcters de control ni espais repetits, i retallat a max (amb avís).
  function str(value, max, warn) {
    if (typeof value === 'number') value = String(value);
    if (typeof value !== 'string') return '';
    let text = value.replace(CTRL, ' ').replace(/\s+/g, ' ').trim();
    if (text.length > max) {
      text = text.slice(0, max).trimEnd() + '…';
      if (warn) warn.add('val.long');
    }
    return text;
  }
  // Un valor per idioma de contingut: { ca, es, en }.
  const byLang = fn => Object.fromEntries(LANGS.map(lang => [lang, fn(lang)]));
  // Un text per idioma. Si arriba un text sol, serveix per a tots.
  const pair = (value, max, warn) => byLang(lang => str(typeof value === 'string' ? value : value && value[lang], max, warn));
  // Llista de paraules curtes, sense repetir i com a màxim 8. També accepta «a, b; c».
  function words(value, max, warn) {
    const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,、;]/) : [];
    return [...new Set(items.map(x => str(x, max, warn)).filter(Boolean))].slice(0, 8);
  }
  // Enter entre lo i hi, o null. Accepta "4" i "N5".
  function int(value, lo, hi) {
    const n = typeof value === 'string' ? Number(value.trim().replace(/^N/i, '')) : value;
    return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
  }
  const noSpaces = text => text.replace(/\s/g, '');

  // Dona la forma exacta a qualsevol objecte, sense jutjar-ne el contingut. També serveix per carregar l'arxiu.
  function coerce(input, warn) {
    const o = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const meanings = o.meanings;
    const sentence = o.sentence && typeof o.sentence === 'object' ? o.sentence : {};
    const examples = (Array.isArray(o.examples) ? o.examples : [])
      .filter(e => e && typeof e === 'object')
      .slice(0, 6)
      .map(e => ({ word: str(e.word, 30, warn), reading: str(e.reading, 60, warn), meaning: pair(e.meaning, 120, warn) }))
      .filter(e => e.word);
    return {
      kanji: str(o.kanji, 20),
      // Si arriba una llista sola (sense idiomes), es considera anglès.
      meanings: Array.isArray(meanings) || typeof meanings === 'string'
        ? byLang(lang => (lang === 'en' ? words(meanings, 60, warn) : []))
        : byLang(lang => words(meanings && meanings[lang], 60, warn)),
      onyomi: words(o.onyomi, 20, warn).map(noSpaces),
      kunyomi: words(o.kunyomi, 20, warn).map(noSpaces),
      reading: noSpaces(str(o.reading, 20, warn)), // la lectura que s'aprèn primer (一 → いち)
      reading2: noSpaces(str(o.reading2, 20, warn)), // segona lectura principal, opcional i només triada per tu (七: しち / なな)
      strokes: int(o.strokes, 1, 64),
      jlpt: int(o.jlpt, 1, 5),
      emoji: str(o.emoji, 64),
      origin: pair(o.origin, LONG, warn),
      mnemonic: pair(o.mnemonic, TXT, warn),
      examples,
      sentence: {
        jp: str(sentence.jp, 150, warn),
        reading: str(sentence.reading, 250, warn),
        romaji: str(sentence.romaji, 300, warn),
        meaning: pair(sentence.meaning, 250, warn),
      },
      trivia: pair(o.trivia, LONG, warn),
      verified: Card.VERIFIED.includes(o.verified) ? o.verified : false,
      edited: o.edited === true, // l'has corregida tu des de la fitxa
      mainByUser: o.mainByUser === true, // la lectura principal l'has triada tu
    };
  }

  // ---------- Revisió estricta (check) ----------
  // Revisa un element que ve de la IA. Torna { item, kanji, errors, warnings }: amb errors, item és null
  // (no es desa); els avisos es mostren però la fitxa es desa igualment.
  function check(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { item: null, kanji: '', errors: [{ k: 'val.notObject' }], warnings: [] };
    }
    const warn = notes(), errors = [];
    const card = coerce(raw, warn);
    // Això només ho poses tu, des de la fitxa.
    card.verified = false;
    card.edited = false;
    card.mainByUser = false;
    card.reading2 = '';

    if (!isCard(card.kanji)) errors.push({ k: 'val.kanji', p: { v: card.kanji || '—' } });
    if (LANGS.every(lang => !card.meanings[lang].length)) errors.push({ k: 'val.meanings' });
    const word = isCard(card.kanji) && Card.isWord(card.kanji);
    if (word) {
      // Les paraules no tenen on/kun ni traços.
      card.onyomi = [];
      card.kunyomi = [];
      card.strokes = null;
    } else {
      checkKanjiReadings(raw, card, errors, warn);
    }
    if (card.jlpt === null && raw.jlpt != null && raw.jlpt !== '' && raw.jlpt !== 0) warn.add('val.jlpt');
    if (card.emoji && !EMOJI.test(card.emoji)) {
      card.emoji = '';
      warn.add('val.emoji');
    }
    checkExamples(raw, card, warn);
    checkMainReading(card, word, errors, warn);
    checkLanguages(card, warn);
    return { item: errors.length ? null : card, kanji: card.kanji, errors, warnings: warn.list };
  }

  // On'yomi en katakana, kun'yomi en hiragana, almenys una lectura, i el nombre de traços.
  function checkKanjiReadings(raw, card, errors, warn) {
    if (!card.onyomi.length && !card.kunyomi.length) errors.push({ k: 'val.readings' });
    card.onyomi.forEach(v => { if (!ON.test(v)) errors.push({ k: 'val.on', p: { v } }); });
    card.kunyomi.forEach(v => { if (!KUN.test(v)) errors.push({ k: 'val.kun', p: { v } }); });
    if (card.strokes === null) {
      const missing = raw.strokes == null || raw.strokes === '';
      if (missing) warn.add('val.noStrokes');
      else errors.push({ k: 'val.strokes' });
    }
  }

  // Exemples amb japonès i lectura en kana (els altres es treuen), i frase d'exemple.
  function checkExamples(raw, card, warn) {
    const given = Array.isArray(raw.examples) ? Math.min(raw.examples.length, 5) : 0;
    card.examples = card.examples.filter(e => JP.test(e.word) && KANA.test(e.reading)).slice(0, 5);
    if (card.examples.length < given) warn.add('val.example');
    if (HAN.test(card.kanji)) {
      card.examples.forEach(e => {
        if (!e.word.includes(card.kanji)) warn.add('val.exampleNoKanji', { v: e.word });
      });
    }
    if (card.sentence.reading && !KANA.test(card.sentence.reading)) warn.add('val.sentenceReading');
    if (card.sentence.romaji && !ROMA.test(card.sentence.romaji)) {
      card.sentence.romaji = '';
      warn.add('val.romaji');
    }
  }

  // Lectura principal, en kana. D'un kanji, es desa en hiragana i hauria de ser una de les seves lectures;
  // d'una paraula és obligatòria (és com es llegeix tota la paraula) i es deixa tal com ve.
  function checkMainReading(card, word, errors, warn) {
    if (word) {
      if (!READ.test(card.reading)) errors.push({ k: 'val.wordReading' });
      return;
    }
    if (!card.reading) {
      warn.add('val.noReading');
    } else if (!READ.test(card.reading)) {
      warn.add('val.reading', { v: card.reading });
      card.reading = '';
    } else {
      card.reading = U.hira(card.reading);
      if (!Card.mainCandidates(card).includes(card.reading)) warn.add('val.readingNotListed', { v: card.reading });
    }
  }

  // Avís per cada idioma que falta en algun text que sí que és en un altre idioma.
  function checkLanguages(card, warn) {
    const texts = [card.mnemonic, card.origin, card.trivia, card.sentence.meaning, ...card.examples.map(e => e.meaning)];
    const hasSome = byLangValue => LANGS.some(lang => byLangValue[lang] && byLangValue[lang].length);
    LANGS.forEach(lang => {
      const meaningMissing = !card.meanings[lang].length && hasSome(card.meanings);
      const textMissing = texts.some(p => !p[lang] && hasSome(p));
      if (meaningMissing || textMissing) warn.add('val.missing.' + lang);
    });
  }

  // ---------- Treure el JSON de la resposta (extract) ----------
  // Si la resposta s'ha tallat (és massa llarga) o té algun tros mal format, aprofita les fitxes { … } de la
  // llista que han arribat senceres. Recorre el text tenint en compte les cometes i els escapaments.
  const BACKSLASH = String.fromCharCode(92);
  function salvage(text) {
    const listStart = text.indexOf('['), out = [];
    if (listStart < 0) return out;
    let depth = 0, start = -1, inString = false, escaped = false;
    for (let i = listStart + 1; i < text.length; i++) {
      const c = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (c === BACKSLASH) escaped = true;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') {
        inString = true;
      } else if (c === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (c === '}' && depth > 0) {
        depth--;
        if (depth === 0) {
          try { out.push(JSON.parse(text.slice(start, i + 1))); } catch {}
        }
      } else if (c === ']' && depth === 0) {
        break;
      }
    }
    return out;
  }

  // Treu el JSON de la resposta: un o més blocs ```json, o el tros entre el primer [ { i l'últim ] }.
  // Si el bloc no es tanca (resposta tallada), se n'aprofiten les fitxes senceres i la llista es marca «partial».
  function extract(text) {
    const s = String(text || '');
    const blocks = [...s.matchAll(/```[a-zA-Z]*[ \t]*\r?\n?([\s\S]*?)```/g)].map(m => m[1].trim()).filter(Boolean);
    const unclosed = /```[a-zA-Z]*[ \t]*\r?\n([\s\S]*)$/.exec(s);
    const out = [];
    for (const block of blocks.length ? blocks : [cut(unclosed ? unclosed[1] : s)]) {
      let data;
      try {
        data = JSON.parse(block);
      } catch (e) {
        try {
          data = JSON.parse(block.replace(/,\s*([\]}])/g, '$1')); // comes finals, un error típic
        } catch {
          data = salvage(block);
          if (!data.length) throw new Error(t('add.badJson', { msg: e.message }));
          out.partial = true;
        }
      }
      if (data && !Array.isArray(data) && Array.isArray(data.kanji)) data = data.kanji; // un arxiu exportat
      else if (data && typeof data === 'object' && !Array.isArray(data)) data = [data]; // una fitxa sola
      if (!Array.isArray(data)) throw new Error(t('add.notList'));
      out.push(...data);
    }
    return out;
  }
  // Sense blocs ```: el tros entre el primer [ o { i l'últim ] o }.
  function cut(s) {
    const a = s.search(/[[{]/), b = Math.max(s.lastIndexOf(']'), s.lastIndexOf('}'));
    if (a < 0) throw new Error(t('add.noJson'));
    return b > a ? s.slice(a, b + 1) : s.slice(a);
  }
  // Text que Claude escriu fora dels blocs ```json (per exemple, l'avís de paraules que s'escriuen en kana).
  // Només si la resposta porta blocs; si no, tot és JSON. Es neteja i es retalla com qualsevol altre text.
  function note(text) {
    const s = String(text || '');
    if (!/```/.test(s)) return '';
    return str(s.replace(/```[a-zA-Z]*[ \t]*\r?\n?[\s\S]*?(```|$)/g, ' '), 400);
  }

  // ---------- Previsualització (review) ----------
  // Cada element amb el seu estat: new | upd | same | err. get(kanji) torna la fitxa que ja tens.
  const same = (a, b) => JSON.stringify({ ...a, verified: false }) === JSON.stringify(b);
  function review(text, get) {
    const raws = extract(text), rows = raws.map(check);
    rows.partial = !!raws.partial; // la resposta s'ha tallat: només hi ha les fitxes que han arribat senceres
    // Si un kanji surt dues vegades, val l'últim.
    const lastIndex = new Map();
    rows.forEach((row, i) => { if (row.item) lastIndex.set(row.item.kanji, i); });
    rows.forEach((row, i) => {
      if (!row.item) {
        row.status = 'err';
        return;
      }
      if (lastIndex.get(row.item.kanji) !== i) {
        row.status = 'err';
        row.item = null;
        row.errors.push({ k: 'val.dup' });
        return;
      }
      const old = get(row.item.kanji);
      // Es compara amb el que quedaria en desar-la: les lectures principals que havies triat es mantenen.
      const kept = old && old.mainByUser ? Card.keptMains(old, row.item) : [];
      const merged = kept.length ? { ...row.item, reading: kept[0], reading2: kept[1] || '', mainByUser: true } : row.item;
      row.status = !old ? 'new' : same(old, merged) ? 'same' : 'upd';
      if (row.status === 'upd') addUpdateWarnings(row, old, kept);
    });
    return rows;
  }
  // Què perds (o què es manté) si actualitzes una fitxa que ja tenies.
  function addUpdateWarnings(row, old, kept) {
    if (old.verified === true) row.warnings.push({ k: 'add.loseVerified' });
    if (old.edited) row.warnings.push({ k: 'add.loseEdits' });
    if (!kept.length) return;
    if (Card.isWord(row.item.kanji)) row.warnings.push({ k: 'add.keepsReading2', p: { v: kept[1] } });
    else row.warnings.push({ k: kept.length > 1 ? 'add.keepsMains' : 'add.keepsMain', p: { v: kept.join(' / ') } });
  }

  return { coerce, check, extract, review, note, isCard, isKana };
})();
