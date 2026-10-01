// Pantalla d'inici: què toca avui, cerca, filtres (nivell JLPT i kanji/paraules), què es mostra i graella de fitxes.
const Inici = (() => {
  const { esc } = U;
  const LEVELS = ['n5', 'n4', 'n3', 'n2', 'n1', 'none'];
  let q = '', level = 'all';
  const kinds = new Set(); // 'kanji' i/o 'word'; si no n'hi ha cap, es veuen tots dos
  const lv = k => (k.jlpt ? 'n' + k.jlpt : 'none');
  const kind = k => (U.isWord(k.kanji) ? 'word' : 'kanji');
  const lvName = l => (l === 'none' ? t('home.noLevel') : l.toUpperCase());
  const norm = s => U.hira(String(s).toLowerCase());
  // Text on es busca: significats en tots els idiomes, lectures en kana i en rōmaji, i exemples.
  const hay = k => {
    const reads = [k.reading, ...k.onyomi, ...k.kunyomi.map(U.plain), ...k.examples.map(e => e.reading)].filter(Boolean);
    return norm([k.kanji, ...Object.values(k.meanings).flat(), ...reads, ...reads.map(U.romaji), ...k.examples.map(e => e.word)].join(' '));
  };

  // La llista tal com es veu (cerca + filtres). La fitxa la fa servir per anar a l'anterior i al següent.
  function visible() {
    const nq = norm(q.trim());
    return Store.kanji.filter(k => (level === 'all' || lv(k) === level) && (!kinds.size || kinds.has(kind(k))) && (!nq || hay(k).includes(nq)));
  }
  function tile(k, day) {
    const p = Store.prog(k.kanji), box = p ? p.box : 0, due = !!p && p.due <= day, m = I18n.list(k.meanings)[0] || '';
    const v = U.ver(k.verified), checked = v.cls !== 'pending';
    const title = [box ? t('tile.box', { n: box }) : t('tile.new'), due ? t('tile.due') : '', checked ? t(v.key) : ''].filter(Boolean).join(' · ');
    return `<a class="tile${due ? ' due' : ''}" href="${U.kanjiHref(k.kanji)}" title="${esc(title)}">
      ${checked ? `<span class="tile-ver ver-${v.cls}" aria-hidden="true">${v.icon}</span>` : ''}
      <span class="tile-k${U.size(k.kanji)}" lang="ja">${esc(k.kanji)}</span>
      <span class="tile-m">${esc(m)}</span>
      <span class="boxes" aria-hidden="true">${[1, 2, 3, 4, 5].map(i => `<i${i <= box ? ' class="f"' : ''}></i>`).join('')}</span>
    </a>`;
  }
  // Interruptor sí/no (el mateix component que a Practicar).
  const sw = (key, label) => `<label class="toggle small"><button type="button" class="switch" role="switch" aria-checked="${U.pref(key)}" data-pref="${key}"><i></i></button><span>${esc(label)}</span></label>`;

  function render(root) {
    const all = Store.kanji;
    if (!all.length) {
      root.innerHTML = `<div class="empty"><div class="empty-k" lang="ja" aria-hidden="true">漢字</div>
        <h1>${esc(t('home.emptyTitle'))}</h1><p>${esc(t('home.emptyText'))}</p>
        <a class="btn primary" href="#/afegir">${esc(t('home.emptyBtn'))}</a></div>`;
      return;
    }
    const day = U.today(), due = all.filter(k => Store.isDue(k.kanji, day)).length, fresh = all.filter(k => !Store.prog(k.kanji)).length;
    const levels = LEVELS.filter(l => all.some(k => lv(k) === l)), hasWords = all.some(k => kind(k) === 'word');
    if (level !== 'all' && !levels.includes(level)) level = 'all';
    if (!hasWords) kinds.clear();
    const chip = (l, label) => `<button type="button" class="chip${level === l ? ' on' : ''}" data-lv="${l}" aria-pressed="${level === l}">${esc(label)}</button>`;
    const kchip = (k, label) => `<button type="button" class="chip${kinds.has(k) ? ' on' : ''}" data-kind="${k}" aria-pressed="${kinds.has(k)}">${esc(label)}</button>`;
    root.innerHTML = `
      <section class="today">
        <div class="stat${due ? ' hot' : ''}"><b>${due}</b><span>${esc(t('home.due'))}</span></div>
        <div class="stat"><b>${fresh}</b><span>${esc(t('home.new'))}</span></div>
        <div class="stat"><b>${all.length}</b><span>${esc(t('home.total'))}</span></div>
        <a class="btn primary" href="#/practica">${esc(t('home.practice'))}</a>
      </section>
      <div class="finder">
        <input type="search" class="search" value="${esc(q)}" placeholder="${esc(t('home.search'))}" aria-label="${esc(t('home.search'))}" autocomplete="off">
        <div class="chips">${chip('all', t('home.all'))}${levels.map(l => chip(l, lvName(l))).join('')}
          ${hasWords ? `<span class="chips-sep" aria-hidden="true"></span>${kchip('kanji', t('home.kanjiType'))}${kchip('word', t('home.wordType'))}` : ''}</div>
      </div>
      <div class="view-opts"><span>${esc(t('home.show'))}</span>${sw('meanings', t('home.showMeanings'))}${sw('romaji', t('home.showRomaji'))}</div>
      <p class="found" aria-live="polite"></p>
      <div class="grid${U.pref('meanings') ? '' : ' hide-m'}"></div>`;
    const grid = root.querySelector('.grid'), found = root.querySelector('.found');
    function paint() {
      const list = visible();
      grid.innerHTML = list.map(k => tile(k, day)).join('');
      found.textContent = list.length === all.length ? '' : list.length ? t('home.count', { n: list.length, total: all.length }) : t('home.none');
    }
    paint();
    root.querySelector('.search').oninput = e => { q = e.target.value; paint(); };
    root.querySelector('.chips').onclick = e => {
      const b = e.target.closest('[data-lv]'), k = e.target.closest('[data-kind]');
      if (b) {
        level = b.dataset.lv;
        root.querySelectorAll('[data-lv]').forEach(c => { c.classList.toggle('on', c === b); c.setAttribute('aria-pressed', c === b); });
      } else if (k) { // Kanji / Paraules: cada un s'encén i s'apaga; cap encès = tots dos
        const on = !kinds.has(k.dataset.kind);
        if (on) kinds.add(k.dataset.kind); else kinds.delete(k.dataset.kind);
        k.classList.toggle('on', on); k.setAttribute('aria-pressed', on);
      } else return;
      paint();
    };
    root.querySelector('.view-opts').onclick = e => {
      const s = e.target.closest('[data-pref]'); if (!s) return;
      if (s.dataset.pref === 'romaji') { U.setRomaji(!U.pref('romaji')); return; }
      const v = U.pref('meanings', !U.pref('meanings'));
      s.setAttribute('aria-checked', v); grid.classList.toggle('hide-m', !v);
    };
  }
  return { nav: 'home', render, visible };
})();
