// Trossos d'HTML que fan servir diverses pantalles: rōmaji, lectures, botó de veu, rajola d'una fitxa…
// Tots tornen html`…` (vegeu util.js), que ja escapa el text.
const Peces = (() => {
  const { html, join } = U;

  // ---------- Rōmaji ----------
  // Rōmaji petit al costat del kana. Les lectures kun porten un punt (た.べる) que no es llegeix.
  const romajiOf = text => U.romaji(String(text).replace(/\./g, ''));
  const ro = text => (text ? html`<span class="ro" lang="ja-Latn">${romajiOf(text)}</span>` : '');
  // Una llista de lectures en un sol bloc de rōmaji (així, si l'amagues, no hi queden comes soltes).
  const roList = readings => (readings.length
    ? html`<span class="ro" lang="ja-Latn">${readings.map(romajiOf).join(', ')}</span>`
    : '');

  // Rōmaji visible o amagat a tota l'app: el CSS amaga els .ro segons <html data-romaji>, i tots els
  // controls (interruptor de l'inici i botó «Rōmaji» de la fitxa i la pràctica) es posen al mateix estat.
  function setRomaji(visible) {
    Prefs.view('romaji', visible);
    document.documentElement.dataset.romaji = visible ? 'on' : 'off';
    document.querySelectorAll('[data-romaji-toggle]').forEach(b => b.setAttribute('aria-pressed', visible));
    document.querySelectorAll('[data-pref="romaji"]').forEach(b => b.setAttribute('aria-checked', visible));
  }
  const romajiBtn = () => html`<button type="button" class="tag tag-btn" data-romaji-toggle
    aria-pressed="${Prefs.view('romaji')}">${t('home.showRomaji')}</button>`;

  // ---------- Lectures ----------
  // Kun'yomi amb l'okurigana (el que va després del punt) més clar: た<span>べる</span>.
  function kun(reading) {
    const [stem, okurigana] = String(reading).split('.');
    return html`${stem}${okurigana ? html`<span class="oku">${okurigana}</span>` : ''}`;
  }
  // Una llista de lectures (on o kun) amb les principals destacades. format: com es pinta cada lectura.
  function readingList(card, readings, { format = r => r, separator = '、', title = '' } = {}) {
    const one = r => (Card.isMain(card, r)
      ? html`<b class="is-main"${title ? html` title="${title}"` : ''}>${format(r)}</b>`
      : format(r));
    return join(readings.map(one), separator);
  }
  // La lectura principal en kana amb el seu rōmaji; si n'hi ha dues, «しち shichi / なな nana».
  const mainHtml = card => join(
    Card.mains(card).map(r => html`<span lang="ja">${r}</span> ${ro(r)}`),
    html`<span class="sep"> / </span>`,
  );

  // Ressalta el kanji (o la paraula) dins d'un exemple o una frase.
  const mark = (text, part) => join(String(text).split(part), html`<mark>${part}</mark>`);

  // ---------- Botons ----------
  const say = (text, label) => {
    if (!text) return '';
    const name = label || t('card.listen');
    return html`<button type="button" class="say" data-say="${text}" title="${name}" aria-label="${name}">${U.ICON.speaker}</button>`;
  };

  // ---------- Rajola d'una fitxa ----------
  // Per a la graella de l'inici (amb day: es veu la caixa, si toca avui i la verificació) i per al
  // resum de la pràctica (sense day: només el kanji i el significat).
  function tile(card, day) {
    const meaning = I18n.list(card.meanings)[0] || '';
    const kanji = html`<span class="tile-k${Card.sizeClass(card.kanji)}" lang="ja">${card.kanji}</span>`;
    if (!day) {
      return html`<a class="tile" href="${Card.href(card.kanji)}">${kanji}<span class="tile-m">${meaning}</span></a>`;
    }
    const progress = Store.prog(card.kanji), box = progress ? progress.box : 0;
    const due = !!progress && progress.due <= day;
    const ver = Card.verState(card.verified), checked = ver.cls !== 'pending';
    const title = [
      box ? t('tile.box', { n: box }) : t('tile.new'),
      due ? t('tile.due') : '',
      checked ? t(ver.key) : '',
    ].filter(Boolean).join(' · ');
    const boxes = [1, 2, 3, 4, 5].map(i => html`<i${i <= box ? html` class="f"` : ''}></i>`);
    return html`<a class="tile${due ? ' due' : ''}" href="${Card.href(card.kanji)}" title="${title}" data-k="${card.kanji}">
      ${checked ? html`<span class="tile-ver ver-${ver.cls}" aria-hidden="true">${ver.icon}</span>` : ''}
      ${kanji}
      <span class="tile-m">${meaning}</span>
      <span class="boxes" aria-hidden="true">${boxes}</span>
    </a>`;
  }

  return { ro, roList, setRomaji, romajiBtn, kun, readingList, mainHtml, mark, say, tile };
})();
