// Pantalla d'inici: què toca avui, cerca, filtres (nivell JLPT i kanji/paraules), què es mostra i graella de fitxes.
const Inici = (() => {
  const { html } = U;
  // Cerca i filtres. Es recorden mentre l'app és oberta (no en tornar-la a obrir).
  const state = {
    query: '',
    level: 'all',
    kinds: new Set(), // 'kanji' i/o 'word'; si no n'hi ha cap, es veuen tots dos
  };

  // ---------- Cerca ----------
  const normalize = text => U.hira(String(text).toLowerCase());
  // Text on es busca: significats en tots els idiomes, lectures en kana i en rōmaji, i exemples.
  function searchText(card) {
    const readings = [
      card.reading, card.reading2, ...card.onyomi, ...card.kunyomi.map(Card.plain), ...card.examples.map(e => e.reading),
    ].filter(Boolean);
    return normalize([
      card.kanji,
      ...Object.values(card.meanings).flat(),
      ...readings,
      ...readings.map(U.romaji),
      ...card.examples.map(e => e.word),
    ].join(' '));
  }

  // La llista tal com es veu (cerca + filtres). La fitxa la fa servir per anar a l'anterior i a la següent.
  function visible() {
    const query = normalize(state.query.trim());
    return Store.kanji.filter(card =>
      (state.level === 'all' || Card.level(card) === state.level)
      && (!state.kinds.size || state.kinds.has(Card.kind(card)))
      && (!query || searchText(card).includes(query)));
  }

  // ---------- Pintar ----------
  function render(root) {
    const all = Store.kanji;
    if (!all.length) {
      root.innerHTML = html`<div class="empty"><div class="empty-k" lang="ja" aria-hidden="true">漢字</div>
        <h1>${t('home.emptyTitle')}</h1><p>${t('home.emptyText')}</p>
        <a class="btn primary" href="#/afegir">${t('home.emptyBtn')}</a></div>`;
      return;
    }
    const day = U.today();
    // Els filtres que ja no tenen sentit (cap fitxa d'aquell nivell, cap paraula) es treuen.
    const levels = Card.LEVELS.filter(lv => all.some(card => Card.level(card) === lv));
    const hasWords = all.some(card => Card.isWord(card.kanji));
    if (state.level !== 'all' && !levels.includes(state.level)) state.level = 'all';
    if (!hasWords) state.kinds.clear();

    root.innerHTML = html`
      ${todayStats(all, day)}
      <div class="finder">
        <input type="search" class="search" value="${state.query}" placeholder="${t('home.search')}"
          aria-label="${t('home.search')}" autocomplete="off">
        <div class="chips">${filterChips(levels, hasWords)}</div>
      </div>
      <div class="view-opts"><span>${t('home.show')}</span>
        ${viewSwitch('meanings', t('home.showMeanings'))}${viewSwitch('romaji', t('home.showRomaji'))}</div>
      <p class="found" aria-live="polite"></p>
      <div class="grid${Prefs.view('meanings') ? '' : ' hide-m'}"></div>`;

    const grid = root.querySelector('.grid'), found = root.querySelector('.found');
    function paintGrid() {
      const list = visible();
      grid.innerHTML = html`${list.map(card => Peces.tile(card, day))}`;
      if (list.length === all.length) found.textContent = '';
      else found.textContent = list.length ? t('home.count', { n: list.length, total: all.length }) : t('home.none');
    }
    paintGrid();

    root.querySelector('.search').oninput = e => {
      state.query = e.target.value;
      paintGrid();
    };
    U.onActions(root, {
      level(chip) {
        state.level = chip.dataset.lv;
        root.querySelectorAll('[data-lv]').forEach(c => setPressed(c, c === chip));
        paintGrid();
      },
      // Kanji / Paraules: cada un s'encén i s'apaga; cap encès = tots dos.
      kind(chip) {
        const kind = chip.dataset.kind, on = !state.kinds.has(kind);
        if (on) state.kinds.add(kind);
        else state.kinds.delete(kind);
        setPressed(chip, on);
        paintGrid();
      },
      pref(toggle) {
        if (toggle.dataset.pref === 'romaji') {
          Peces.setRomaji(!Prefs.view('romaji'));
          return;
        }
        const show = Prefs.view('meanings', !Prefs.view('meanings'));
        toggle.setAttribute('aria-checked', show);
        grid.classList.toggle('hide-m', !show);
      },
    });
  }

  // Per repassar avui, noves i total, i el botó de practicar.
  function todayStats(all, day) {
    const due = all.filter(card => Store.isDue(card.kanji, day)).length;
    const fresh = all.filter(card => !Store.prog(card.kanji)).length;
    return html`<section class="today">
        <div class="stat${due ? ' hot' : ''}"><b>${due}</b><span>${t('home.due')}</span></div>
        <div class="stat"><b>${fresh}</b><span>${t('home.new')}</span></div>
        <div class="stat"><b>${all.length}</b><span>${t('home.total')}</span></div>
        <a class="btn primary" href="#/practica">${t('home.practice')}</a>
      </section>`;
  }

  // Botons de filtre: Tots, N5, N4… i, si tens paraules, Kanji i Paraules.
  function filterChips(levels, hasWords) {
    const chip = (attrs, on, label) => html`<button type="button" class="chip${on ? ' on' : ''}" ${attrs} aria-pressed="${on}">${label}</button>`;
    const levelChip = (lv, label) => chip(html`data-act="level" data-lv="${lv}"`, state.level === lv, label);
    const kindChip = (kind, label) => chip(html`data-act="kind" data-kind="${kind}"`, state.kinds.has(kind), label);
    return html`${levelChip('all', t('home.all'))}${levels.map(lv => levelChip(lv, Card.levelName(lv)))}
      ${hasWords ? html`<span class="chips-sep" aria-hidden="true"></span>${[
        kindChip('kanji', t('home.kanjiType')),
        kindChip('word', t('home.wordType')),
      ]}` : ''}`;
  }
  function setPressed(chip, on) {
    chip.classList.toggle('on', on);
    chip.setAttribute('aria-pressed', on);
  }

  // Interruptor sí/no (el mateix component que a Practicar).
  const viewSwitch = (key, label) => html`<label class="toggle small">
    <button type="button" class="switch" role="switch" aria-checked="${Prefs.view(key)}" data-act="pref" data-pref="${key}"><i></i></button>
    <span>${label}</span></label>`;

  return { nav: 'home', render, visible };
})();
