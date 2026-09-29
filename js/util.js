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
  // Kun'yomi amb l'okurigana (el que va després del punt) més clar.
  const kun = r => { const [a, b] = String(r).split('.'); return esc(a) + (b ? `<span class="oku">${esc(b)}</span>` : ''); };
  // Ressalta el kanji dins d'una paraula o frase. ch sempre és un kanji validat, no cal escapar-lo.
  const mark = (text, ch) => esc(text).split(ch).join(`<mark>${ch}</mark>`);
  const jisho = ch => 'https://jisho.org/search/' + encodeURIComponent(ch + ' #kanji');
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

  let tt = null;
  function toast(msg, kind) {
    const el = $('#toast'); el.textContent = msg; el.dataset.kind = kind || ''; el.hidden = false;
    clearTimeout(tt); tt = setTimeout(() => { el.hidden = true; }, 3500);
  }
  return { $, esc, today, addDays, fmtDate, hira, plain, kun, mark, jisho, kanjiHref, shuffle, ICON, ver, say, toast };
})();
