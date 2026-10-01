// Utilitats generals: DOM, HTML segur, dates, kana → rōmaji, icones, clics i avisos.
// Les regles de les fitxes són a card.js, i els trossos d'HTML que comparteixen les pantalles, a peces.js.
const U = (() => {
  const $ = (selector, root = document) => root.querySelector(selector);

  // ---------- HTML segur ----------
  const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ENTITIES[c]);

  // Un tros d'HTML ja construït, que no s'ha de tornar a escapar.
  class Html {
    constructor(text) { this.text = text; }
    toString() { return this.text; }
  }
  // Marca un text com a HTML segur (per exemple, una icona SVG fixa).
  const raw = text => new Html(String(text ?? ''));

  // Converteix un valor en HTML: el text s'escapa; l'HTML (html`…` o raw) es deixa tal qual;
  // una llista s'uneix sense separador; null i undefined no pinten res. true i false s'escriuen
  // (aria-pressed="${on}"); per a les condicions, fes servir cond ? html`…` : ''.
  function toHtml(value) {
    if (value instanceof Html) return value.text;
    if (Array.isArray(value)) return value.map(toHtml).join('');
    if (value === null || value === undefined) return '';
    return esc(value);
  }

  // Plantilla que escapa sola tot el que hi poses: html`<p class="hint">${text}</p>`.
  // Torna un Html, que es pot posar dins d'un altre html`…` o assignar a innerHTML.
  function html(strings, ...values) {
    let out = strings[0];
    values.forEach((value, i) => { out += toHtml(value) + strings[i + 1]; });
    return new Html(out);
  }

  // Uneix una llista amb un separador (text o HTML).
  const join = (items, separator) => new Html(items.map(toHtml).join(toHtml(separator)));

  // ---------- Clics ----------
  // Cada element amb data-act="nom" crida actions.nom(element, event). Si l'element és dins d'un altre
  // amb data-act, guanya el de més endins.
  function onActions(root, actions) {
    root.onclick = event => {
      const el = event.target.closest('[data-act]');
      if (!el || !root.contains(el)) return;
      const action = actions[el.dataset.act];
      if (action) action(el, event);
    };
  }

  // ---------- Dates ----------
  // Dates locals en format AAAA-MM-DD, que es poden comparar com a text.
  const pad = n => String(n).padStart(2, '0');
  const iso = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const today = () => iso(new Date());
  function addDays(n) {
    const date = new Date();
    date.setDate(date.getDate() + n);
    return iso(date);
  }
  // «avui», «demà» o la data curta (3 d’oct.).
  function fmtDate(day) {
    if (day <= today()) return t('date.today');
    if (day === addDays(1)) return t('date.tomorrow');
    const [year, month, date] = day.split('-').map(Number);
    return new Date(year, month - 1, date).toLocaleDateString(I18n.locale, { day: 'numeric', month: 'short' });
  }

  // ---------- Kana i rōmaji ----------
  // Katakana → hiragana (ニチ → にち).
  const hira = text => String(text).replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));

  // Taula hiragana → rōmaji (Hepburn), feta per files: か → k + a, etc.
  const RO = {
    や: 'ya', ゆ: 'yu', よ: 'yo', わ: 'wa', を: 'o', ん: 'n', ゔ: 'vu',
    ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o', ゃ: 'ya', ゅ: 'yu', ょ: 'yo', ゎ: 'wa',
  };
  const ROWS = {
    '': 'あいうえお', k: 'かきくけこ', s: 'さしすせそ', t: 'たちつてと', n: 'なにぬねの',
    h: 'はひふへほ', m: 'まみむめも', r: 'らりるれろ', g: 'がぎぐげご', z: 'ざじずぜぞ',
    d: 'だぢづでど', b: 'ばびぶべぼ', p: 'ぱぴぷぺぽ',
  };
  Object.entries(ROWS).forEach(([consonant, row]) => {
    [...row].forEach((kana, i) => { RO[kana] = consonant + 'aiueo'[i]; });
  });
  Object.assign(RO, { し: 'shi', ち: 'chi', つ: 'tsu', ふ: 'fu', じ: 'ji', ぢ: 'ji', づ: 'zu' });
  const SMALL_Y = { ゃ: 'a', ゅ: 'u', ょ: 'o' };
  const SMALL_VOWEL = { ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o' };
  const PUNCT = { '、': ', ', '。': '. ', '・': ' ', '！': '! ', '？': '? ', '「': '"', '」': '"', '　': ' ' };

  // Kana → rōmaji tal com s'escriu amb el teclat: おう → ou, ー repeteix la vocal, っ dobla la consonant,
  // ん davant de vocal → n'. Serveix per a lectures i paraules soltes: no separa paraules ni sap que
  // la partícula は es diu «wa» (per això el rōmaji de les frases el dona Claude).
  function romaji(text) {
    // 1. Síl·labes: cada kana amb el seu rōmaji, ajuntant-hi les petites (き + ゃ → kya).
    const kana = hira(text), syllables = [];
    for (let i = 0; i < kana.length; i++) {
      const c = kana[i], next = kana[i + 1];
      let r = RO[c];
      if (c === 'っ' || c === 'ー' || r === undefined) {
        syllables.push({ c, r: PUNCT[c] ?? c });
        continue;
      }
      if (SMALL_Y[next] && /[^aeiou]i$/.test(r)) { // きゃ → kya, しゃ → sha
        const base = r.slice(0, -1);
        r = (/(sh|ch|j)$/.test(base) ? base : base + 'y') + SMALL_Y[next];
        i++;
      } else if (SMALL_VOWEL[next] && /[aeiou]$/.test(r)) { // ティ → ti, ファ → fa, ウィ → wi
        r = (c === 'う' ? 'w' : r.slice(0, -1)) + SMALL_VOWEL[next];
        i++;
      }
      syllables.push({ c, r });
    }
    // 2. Els signes que depenen del veí: っ, ー i ん.
    return syllables.map(({ c, r }, i) => {
      const next = (syllables[i + 1] || {}).r || '', prev = (syllables[i - 1] || {}).r || '';
      if (c === 'っ') return /^[a-z]/.test(next) ? (next.startsWith('ch') ? 't' : next[0]) : '';
      if (c === 'ー') return /[aeiou]$/.test(prev) ? prev.slice(-1) : '-';
      if (c === 'ん' && /^[aeiouy]/.test(next)) return "n'";
      return r;
    }).join('').trim();
  }

  // ---------- Altres ----------
  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  const svg = body => raw(`<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`);
  const ICON = {
    speaker: svg('<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>'),
    replay: svg('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/>'),
    left: svg('<path d="M14.5 6l-6 6 6 6"/>'),
    right: svg('<path d="M9.5 6l6 6-6 6"/>'),
    close: svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
  };

  // Missatge breu a baix de la pantalla. Els llargs es queden més estona.
  let toastTimer = null;
  function toast(message, kind) {
    const el = $('#toast');
    el.textContent = message;
    el.dataset.kind = kind || '';
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, Math.max(3500, message.length * 60));
  }

  return {
    $, esc, html, raw, join, onActions,
    iso, today, addDays, fmtDate,
    hira, romaji,
    shuffle, ICON, toast,
  };
})();
