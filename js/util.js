// Utilitats compartides: DOM, escapament, dates, kana, icones i avisos.
const U = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Dates locals en format AAAA-MM-DD, que es poden comparar com a text.
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => iso(new Date());
  const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
  function fmtDate(s) {
    if (s <= today()) return t('date.today');
    if (s === addDays(1)) return t('date.tomorrow');
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(I18n.locale, { day: 'numeric', month: 'short' });
  }

  const hira = s => String(s).replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const plain = r => String(r).replace(/[.\-]/g, ''); // た.べる → たべる (per a la veu i la cerca)

  // Taula hiragana → rōmaji (Hepburn), feta per files: か → k + a, etc.
  const RO = { や: 'ya', ゆ: 'yu', よ: 'yo', わ: 'wa', を: 'o', ん: 'n', ゔ: 'vu', ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o', ゃ: 'ya', ゅ: 'yu', ょ: 'yo', ゎ: 'wa' };
  Object.entries({ '': 'あいうえお', k: 'かきくけこ', s: 'さしすせそ', t: 'たちつてと', n: 'なにぬねの', h: 'はひふへほ', m: 'まみむめも',
    r: 'らりるれろ', g: 'がぎぐげご', z: 'ざじずぜぞ', d: 'だぢづでど', b: 'ばびぶべぼ', p: 'ぱぴぷぺぽ' })
    .forEach(([c, row]) => [...row].forEach((k, i) => { RO[k] = c + 'aiueo'[i]; }));
  Object.assign(RO, { し: 'shi', ち: 'chi', つ: 'tsu', ふ: 'fu', じ: 'ji', ぢ: 'ji', づ: 'zu' });
  const SMALL_Y = { ゃ: 'a', ゅ: 'u', ょ: 'o' }, SMALL_V = { ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o' };
  const PUNCT = { '、': ', ', '。': '. ', '・': ' ', '！': '! ', '？': '? ', '「': '"', '」': '"', '　': ' ' };
  // Kana → rōmaji tal com s'escriu amb el teclat: おう → ou, ー repeteix la vocal, っ dobla la consonant,
  // ん davant de vocal → n'. Serveix per a lectures i paraules soltes: no separa paraules ni sap que
  // la partícula は es diu «wa» (per això el rōmaji de les frases el dona Claude).
  function romaji(text) {
    const h = hira(text), syl = [];
    for (let i = 0; i < h.length; i++) {
      const c = h[i], nx = h[i + 1];
      let r = RO[c];
      if (c === 'っ' || c === 'ー' || r === undefined) { syl.push({ c, r: PUNCT[c] ?? c }); continue; }
      if (SMALL_Y[nx] && /[^aeiou]i$/.test(r)) { const b = r.slice(0, -1); r = (/(sh|ch|j)$/.test(b) ? b : b + 'y') + SMALL_Y[nx]; i++; }
      else if (SMALL_V[nx] && /[aeiou]$/.test(r)) { r = (c === 'う' ? 'w' : r.slice(0, -1)) + SMALL_V[nx]; i++; }
      syl.push({ c, r });
    }
    return syl.map(({ c, r }, i) => {
      const next = (syl[i + 1] || {}).r || '', prev = (syl[i - 1] || {}).r || '';
      if (c === 'っ') return /^[a-z]/.test(next) ? (next.startsWith('ch') ? 't' : next[0]) : '';
      if (c === 'ー') return /[aeiou]$/.test(prev) ? prev.slice(-1) : '-';
      if (c === 'ん' && /^[aeiouy]/.test(next)) return "n'";
      return r;
    }).join('').trim();
  }
  // Rōmaji petit al costat del kana. Les lectures kun porten un punt (た.べる) que no es llegeix.
  const ro = text => (text ? `<span class="ro" lang="ja-Latn">${esc(romaji(String(text).replace(/\./g, '')))}</span>` : '');
  // Una llista de lectures en un sol bloc de rōmaji (així, si l'amagues, no hi queden comes soltes).
  const roList = arr => (arr.length ? `<span class="ro" lang="ja-Latn">${arr.map(r => esc(romaji(String(r).replace(/\./g, '')))).join(', ')}</span>` : '');
  // Les lectures principals d'una fitxa: la primera i, si l'has triada, la segona (七: しち / なな).
  const mains = k => [k.reading, k.reading2].filter(Boolean);
  // La lectura principal en kana amb el seu rōmaji; si n'hi ha dues, «しち shichi / なな nana».
  const mainHtml = k => mains(k).map(r => `<span lang="ja">${esc(r)}</span> ${ro(r)}`).join('<span class="sep"> / </span>');
  // És una lectura principal (camps "reading" i "reading2")? Val la paraula sencera (たべる) o només l'arrel (た).
  const isMain = (k, r) => [plain(r), String(r).split('.')[0].replace(/-/g, '')].some(x => mains(k).includes(hira(x)));
  // Kun'yomi amb l'okurigana (el que va després del punt) més clar.
  const kun = r => { const [a, b] = String(r).split('.'); return esc(a) + (b ? `<span class="oku">${esc(b)}</span>` : ''); };
  // Ressalta el kanji dins d'una paraula o frase. ch sempre és un kanji validat, no cal escapar-lo.
  const mark = (text, ch) => esc(text).split(ch).join(`<mark>${ch}</mark>`);
  // Una fitxa és una paraula si no és un sol kanji (学校, 食べる, じゃがいも).
  const isWord = s => !/^\p{Script=Han}$/u.test(String(s));
  // Classe de mida per a les paraules llargues (perquè hi càpiguen a la graella, la fitxa i la pràctica).
  const size = s => { const n = [...String(s)].length; return n < 2 ? '' : n === 2 ? ' w2' : n === 3 ? ' w3' : ' w4'; };
  const jisho = ch => 'https://jisho.org/search/' + encodeURIComponent(isWord(ch) ? ch : ch + ' #kanji');
  const kanjiHref = ch => '#/k/' + encodeURIComponent(ch);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  const svg = body => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
  const ICON = {
    speaker: svg('<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>'),
    replay: svg('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/>'),
    left: svg('<path d="M14.5 6l-6 6 6 6"/>'),
    right: svg('<path d="M9.5 6l6 6-6 6"/>'),
    close: svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
  };
  // Estat de verificació d'una fitxa (camp "verified"): classe CSS, clau de text i icona.
  const VER = {
    false: { cls: 'pending', key: 'ver.pending', icon: '○' },
    true: { cls: 'ok', key: 'ver.ok', icon: '✓' },
    error: { cls: 'err', key: 'ver.err', icon: '✗' },
  };
  const ver = v => VER[String(v)] || VER.false;
  const say = (text, label) => text
    ? `<button type="button" class="say" data-say="${esc(text)}" title="${esc(label || t('card.listen'))}" aria-label="${esc(label || t('card.listen'))}">${ICON.speaker}</button>`
    : '';

  // Preferències de visualització, recordades en aquest navegador: significats a la graella i rōmaji a tot arreu.
  const PREFS = 'kanji:vista', DEFAULT = { meanings: true, romaji: true };
  const prefs = (() => { try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(PREFS)) }; } catch { return { ...DEFAULT }; } })();
  function pref(k, v) {
    if (v === undefined) return prefs[k];
    prefs[k] = v; try { localStorage.setItem(PREFS, JSON.stringify(prefs)); } catch {}
    return v;
  }

  // Rōmaji visible o amagat a tota l'app: el CSS amaga els .ro segons <html data-romaji>, i els controls
  // (interruptor de l'inici i botó «Rōmaji» de la fitxa i la pràctica) es posen tots al mateix estat.
  function setRomaji(v) {
    pref('romaji', v);
    document.documentElement.dataset.romaji = v ? 'on' : 'off';
    document.querySelectorAll('[data-romaji-toggle]').forEach(b => b.setAttribute('aria-pressed', v));
    document.querySelectorAll('[data-pref="romaji"]').forEach(b => b.setAttribute('aria-checked', v));
  }
  const romajiBtn = () => `<button type="button" class="tag tag-btn" data-romaji-toggle aria-pressed="${pref('romaji')}">${esc(t('home.showRomaji'))}</button>`;

  let tt = null;
  function toast(msg, kind) {
    const el = $('#toast'); el.textContent = msg; el.dataset.kind = kind || ''; el.hidden = false;
    clearTimeout(tt); tt = setTimeout(() => { el.hidden = true; }, Math.max(3500, msg.length * 60)); // els llargs, més estona
  }
  return { $, esc, today, addDays, fmtDate, hira, plain, romaji, ro, roList, mains, mainHtml, isMain, isWord, size, pref, setRomaji, romajiBtn, kun, mark, jisho, kanjiHref, shuffle, ICON, ver, say, toast };
})();
