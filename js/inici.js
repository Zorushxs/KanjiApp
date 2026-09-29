// Pantalla d'inici: què toca avui, cerca, filtre per nivell JLPT i graella de kanji.
const Inici = (() => {
  const { esc } = U;
  const LEVELS = ['n5', 'n4', 'n3', 'n2', 'n1', 'none'];
  let q = '', level = 'all';
  const lv = k => (k.jlpt ? 'n' + k.jlpt : 'none');
  const lvName = l => (l === 'none' ? t('home.noLevel') : l.toUpperCase());
  const norm = s => U.hira(String(s).toLowerCase());
  const hay = k => norm([k.kanji, ...k.meanings.ca, ...k.meanings.en, ...k.onyomi, ...k.kunyomi.map(U.plain),
    ...k.examples.map(e => e.word + ' ' + e.reading)].join(' '));

  // La llista tal com es veu (cerca + nivell). La fitxa la fa servir per anar a l'anterior i al següent.
  function visible() {
    const nq = norm(q.trim());
    return Store.kanji.filter(k => (level === 'all' || lv(k) === level) && (!nq || hay(k).includes(nq)));
  }
  function tile(k, day) {
    const p = Store.prog(k.kanji), box = p ? p.box : 0, due = !!p && p.due <= day, m = I18n.list(k.meanings)[0] || '';
    const v = U.ver(k.verified), checked = v.cls !== 'pending';
    const title = [box ? t('tile.box', { n: box }) : t('tile.new'), due ? t('tile.due') : '', checked ? t(v.key) : ''].filter(Boolean).join(' · ');
    return `<a class="tile${due ? ' due' : ''}" href="${U.kanjiHref(k.kanji)}" title="${esc(title)}">
      ${checked ? `<span class="tile-ver ver-${v.cls}" aria-hidden="true">${v.icon}</span>` : ''}
      <span class="tile-k" lang="ja">${esc(k.kanji)}</span>
      <span class="tile-m">${esc(m)}</span>
      <span class="boxes" aria-hidden="true">${[1, 2, 3, 4, 5].map(i => `<i${i <= box ? ' class="f"' : ''}></i>`).join('')}</span>
    </a>`;
  }
  function render(root) {
    const all = Store.kanji;
    if (!all.length) {
      root.innerHTML = `<div class="empty"><div class="empty-k" lang="ja" aria-hidden="true">漢字</div>
        <h1>${esc(t('home.emptyTitle'))}</h1><p>${esc(t('home.emptyText'))}</p>
        <a class="btn primary" href="#/afegir">${esc(t('home.emptyBtn'))}</a></div>`;
      return;
    }
    const day = U.today(), due = all.filter(k => Store.isDue(k.kanji, day)).length, fresh = all.filter(k => !Store.prog(k.kanji)).length;
    const levels = LEVELS.filter(l => all.some(k => lv(k) === l));
    if (level !== 'all' && !levels.includes(level)) level = 'all';
    const chip = (l, label) => `<button type="button" class="chip${level === l ? ' on' : ''}" data-lv="${l}" aria-pressed="${level === l}">${esc(label)}</button>`;
    root.innerHTML = `
      <section class="today">
        <div class="stat${due ? ' hot' : ''}"><b>${due}</b><span>${esc(t('home.due'))}</span></div>
        <div class="stat"><b>${fresh}</b><span>${esc(t('home.new'))}</span></div>
        <div class="stat"><b>${all.length}</b><span>${esc(t('home.total'))}</span></div>
        <a class="btn primary" href="#/practica">${esc(t('home.practice'))}</a>
      </section>
      <div class="finder">
        <input type="search" class="search" value="${esc(q)}" placeholder="${esc(t('home.search'))}" aria-label="${esc(t('home.search'))}" autocomplete="off">
        <div class="chips">${chip('all', t('home.all'))}${levels.map(l => chip(l, lvName(l))).join('')}</div>
      </div>
      <p class="found" aria-live="polite"></p>
      <div class="grid"></div>`;
    const grid = root.querySelector('.grid'), found = root.querySelector('.found');
    function paint() {
      const list = visible();
      grid.innerHTML = list.map(k => tile(k, day)).join('');
      found.textContent = list.length === all.length ? '' : list.length ? t('home.count', { n: list.length, total: all.length }) : t('home.none');
    }
    paint();
    root.querySelector('.search').oninput = e => { q = e.target.value; paint(); };
    root.querySelector('.chips').onclick = e => {
      const b = e.target.closest('[data-lv]'); if (!b) return;
      level = b.dataset.lv;
      root.querySelectorAll('[data-lv]').forEach(c => { c.classList.toggle('on', c === b); c.setAttribute('aria-pressed', c === b); });
      paint();
    };
  }
  return { nav: 'home', render, visible };
})();
