// Pantalla d'inici: què toca avui, cerca, filtres (nivell JLPT i kanji/paraules), què es mostra i les fitxes,
// totes en una graella o agrupades per categories (plegables).
const Inici = (() => {
  const { html } = U;
  // Cerca i filtres. Es recorden mentre l'app és oberta (no en tornar-la a obrir).
  const state = {
    query: '',
    level: 'all',
    kinds: new Set(), // 'kanji' i/o 'word'; si no n'hi ha cap, es veuen tots dos
    open: new Set(), // vista per categories: els grups oberts (ids de categoria, o 'none')
    sorting: false, // mode «Reordenar» (només a l'ordinador): les fitxes es poden arrossegar
  };
  let screen = null; // la pantalla pintada, per a les tecles
  let repaint = null; // torna a pintar les fitxes de la pantalla (per al mode «Reordenar» per categories)
  // «Sense categoria»: no es desa enlloc, es calcula cada vegada (els ids de les categories són t1, t2…).
  const UNTAGGED = 'none';
  const untagged = card => !Store.cardTags(card.kanji).length;

  // ---------- Cerca ----------
  // Minúscules, sense accents (numeros = números, kyo = kyō) i el katakana com a hiragana.
  const normalize = text => U.hira(String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC'));
  // Text on es busca: significats en tots els idiomes, lectures en kana i en rōmaji, exemples i etiquetes
  // (amb les de més amunt: una fitxa de «Mesos» també surt si busques «Temps»).
  function searchText(card) {
    const readings = [
      card.reading, card.reading2, ...card.onyomi, ...card.kunyomi.map(Card.plain), ...card.examples.map(e => e.reading),
    ].filter(Boolean);
    const tags = untagged(card) ? [t('tags.untagged')] : Store.cardTags(card.kanji).map(id => Store.tagLabel(id));
    return normalize([
      card.kanji,
      ...Object.values(card.meanings).flat(),
      ...readings,
      ...readings.map(U.romaji),
      ...card.examples.map(e => e.word),
      ...tags,
    ].join(' '));
  }
  // La fitxa coincideix amb el que has escrit al cercador? (També la fa servir la pantalla d'etiquetes.)
  const matches = (card, query) => !query.trim() || searchText(card).includes(normalize(query.trim()));

  // La llista tal com es veu (cerca + filtres). La fitxa la fa servir per anar a l'anterior i a la següent.
  function visible() {
    return Store.kanji.filter(card =>
      (state.level === 'all' || Card.level(card) === state.level)
      && (!state.kinds.size || state.kinds.has(Card.kind(card)))
      && matches(card, state.query));
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
        <div class="chips home-view">${viewChips()}</div>
      </div>
      <div class="view-opts"><span>${t('home.show')}</span>
        ${viewSwitch('meanings', t('home.showMeanings'))}${viewSwitch('romaji', t('home.showRomaji'))}
        <button type="button" class="tag tag-btn verify-all-btn" data-act="verifyAll" hidden></button>
        ${canSort() ? sortButton() : ''}</div>
      <p class="found" aria-live="polite"></p>
      <div class="home-cards${Prefs.view('meanings') ? '' : ' hide-m'}"><div class="grid"></div><div class="cat-view"></div></div>`;

    const grid = root.querySelector('.grid'), catView = root.querySelector('.cat-view'), found = root.querySelector('.found');
    // Totes en una graella, o per categories. «Reordenar» mou les fitxes o, per categories, les categories (en
    // A-Z no, perquè l'ordre és l'alfabètic).
    function paintGrid() {
      const list = visible(), byCategory = Prefs.view('byCategory');
      grid.hidden = byCategory;
      catView.hidden = !byCategory;
      const sortBtn = root.querySelector('.sort-btn');
      if (sortBtn) sortBtn.hidden = byCategory && Prefs.view('alphaCategories');
      // La vista amagada es buida, perquè no hi quedin rajoles velles.
      catView.innerHTML = byCategory ? categoryGroups(list, day) : '';
      grid.innerHTML = byCategory ? '' : html`${list.map(card => Peces.tile(card, day))}`;
      if (list.length === all.length) found.textContent = '';
      else found.textContent = list.length ? t('home.count', { n: list.length, total: all.length }) : t('home.none');
      paintVerifyAll(list);
    }
    // «✓ Verificar totes (N)»: només si n'hi ha de per verificar entre les que es veuen.
    const verifyAll = root.querySelector('.verify-all-btn');
    function paintVerifyAll(list) {
      const n = list.filter(card => card.verified === false).length;
      verifyAll.hidden = !n;
      verifyAll.textContent = '✓ ' + t('home.verifyAll', { n });
    }
    screen = root;
    repaint = paintGrid;
    state.sorting = false;
    paintGrid();
    if (canSort()) {
      sortable(grid, paintGrid);
      sortableCategories(catView, paintGrid);
    }

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
      // «Totes» o «Per categories» (es recorda).
      view(chip) {
        if (state.sorting) setSorting(false);
        Prefs.view('byCategory', chip.dataset.byCategory === 'true');
        root.querySelectorAll('[data-act="view"]').forEach(c => setPressed(c, c === chip));
        paintGrid();
      },
      // Obre o plega un grup de la vista per categories.
      group(head) {
        const id = head.dataset.group;
        if (state.open.has(id)) state.open.delete(id);
        else state.open.add(id);
        paintGrid();
        root.querySelector(`.cat-head[data-group="${id}"]`).focus();
      },
      // Desplega o plega tots els grups (també les subcategories).
      groupsAll() {
        const ids = groupIds(visible());
        if (ids.every(id => state.open.has(id))) state.open.clear();
        else ids.forEach(id => state.open.add(id));
        paintGrid();
        root.querySelector('.cat-all').focus();
      },
      // Categories en el teu ordre o A-Z (es recorda i val a tot arreu).
      catOrder(chip) {
        if (state.sorting) setSorting(false);
        Prefs.view('alphaCategories', chip.dataset.alpha === 'true');
        paintGrid();
        root.querySelector(`[data-act="catOrder"][data-alpha="${chip.dataset.alpha}"]`).focus();
      },
      sort() {
        setSorting(!state.sorting);
      },
      // Verifica de cop les que es veuen i estan per verificar, després de confirmar-ho en una finestra.
      async verifyAll() {
        const list = visible(), pending = list.filter(card => card.verified === false), n = pending.length;
        if (!n) return;
        const filtered = list.length < all.length;
        const sure = await U.ask({
          title: t('home.verifyAskTitle', { n }),
          text: t(filtered ? 'home.verifyAskFiltered' : 'home.verifyAskAll'),
          body: html`<div class="ask-tiles">${pending.map(card => Peces.tile(card))}</div>`,
          ok: t('home.verifyAskOk', { n }),
          cancel: t('card.cancel'),
        });
        if (!sure) return;
        const done = Store.verifyPending(list.map(card => card.kanji));
        paintGrid();
        U.toast(t('home.verifiedAll', { n: done }));
      },
      pref(toggle) {
        if (toggle.dataset.pref === 'romaji') {
          Peces.setRomaji(!Prefs.view('romaji'));
          return;
        }
        const show = Prefs.view('meanings', !Prefs.view('meanings'));
        toggle.setAttribute('aria-checked', show);
        root.querySelector('.home-cards').classList.toggle('hide-m', !show);
      },
    });
  }

  // ---------- Ordenar arrossegant ----------
  // Només a l'ordinador (ratolí): al mòbil, arrossegar faria nosa per moure's per la pàgina.
  const canSort = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
  // Botó «Reordenar [R]»: s'encén amb un clic o amb la tecla R (a l'esquerra del teclat, que el ratolí és a la dreta),
  // i s'apaga igual o amb Esc.
  const sortButton = () => html`<button type="button" class="tag tag-btn sort-btn" data-act="sort"
    aria-pressed="${state.sorting}" title="${t('home.sortHint')}">${t('home.sort')} <kbd>R</kbd></button>`;
  function setSorting(on) {
    const byCategory = Prefs.view('byCategory');
    state.sorting = on;
    screen.querySelector('.grid').classList.toggle('sortable', on && !byCategory);
    screen.querySelector('.sort-btn').setAttribute('aria-pressed', on);
    if (byCategory) repaint(); // les categories es pinten com una llista de capçaleres per arrossegar
    if (on) U.toast(t(byCategory ? 'home.sortCatsHint' : 'home.sortHint'));
  }
  function key(e) {
    if (!screen || !screen.querySelector('.sort-btn:not([hidden])')) return;
    const letter = e.key.toLowerCase();
    if (letter === 'r' || (e.key === 'Escape' && state.sorting)) {
      e.preventDefault();
      setSorting(letter === 'r' ? !state.sorting : false);
    }
  }
  // En mode «Reordenar», agafes una rajola (no se selecciona el text) i, mentre la mous, les altres es fan
  // a lloc. En deixar-la anar es desa l'ordre; si la deixes fora de la graella (o prems Esc), tot torna
  // com era. Un clic no obre la fitxa, perquè no hi entris sense voler.
  function sortable(grid, repaint) {
    let dragged = null, dropped = false;
    grid.addEventListener('click', e => {
      if (state.sorting && e.target.closest('.tile')) e.preventDefault();
    });
    grid.addEventListener('dragstart', e => {
      if (!state.sorting) return;
      dragged = e.target.closest('.tile');
      if (!dragged) return;
      dropped = false;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragged.dataset.k);
      // La classe es posa després perquè la imatge que s'arrossega no surti transparent.
      setTimeout(() => dragged && dragged.classList.add('dragging'));
    });
    grid.addEventListener('dragover', e => {
      if (!dragged) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const target = e.target.closest('.tile');
      if (!target || target === dragged) return;
      const tiles = [...grid.children];
      const after = tiles.indexOf(dragged) < tiles.indexOf(target);
      target.insertAdjacentElement(after ? 'afterend' : 'beforebegin', dragged);
    });
    grid.addEventListener('drop', e => {
      e.preventDefault();
      dropped = true;
    });
    grid.addEventListener('dragend', () => {
      if (!dragged) return;
      dragged.classList.remove('dragging');
      dragged = null;
      if (!dropped) repaint();
      else Store.reorder([...grid.children].map(tile => tile.dataset.k));
    });
  }

  // Per categories, en mode «Reordenar»: agafes una categoria i la mous entre les altres principals, o una
  // subcategoria entre les de la seva categoria (per canviar-la de categoria hi ha «Moure», a la pantalla de
  // categories). En deixar-la anar es desa l'ordre; si la deixes fora (o prems Esc), tot torna com era.
  function sortableCategories(view, repaint) {
    let dragged = null, dropped = false;
    view.addEventListener('dragstart', e => {
      if (!state.sorting) return;
      dragged = e.target.closest('.cat[draggable="true"]');
      if (!dragged) return;
      dropped = false;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragged.dataset.group);
      setTimeout(() => dragged && dragged.classList.add('dragging'));
    });
    view.addEventListener('dragover', e => {
      if (!dragged) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const siblings = [...dragged.parentElement.children];
      const target = siblings.find(el => el !== dragged && el.contains(e.target));
      if (!target) return;
      const after = siblings.indexOf(dragged) < siblings.indexOf(target);
      target.insertAdjacentElement(after ? 'afterend' : 'beforebegin', dragged);
    });
    view.addEventListener('drop', e => {
      e.preventDefault();
      dropped = true;
    });
    view.addEventListener('dragend', () => {
      if (!dragged) return;
      const list = dragged.parentElement;
      dragged.classList.remove('dragging');
      dragged = null;
      if (!dropped) repaint();
      else Store.reorderTags([...list.children].map(el => el.dataset.group));
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
  // «Veure: Totes | Per categories» i l'enllaç per gestionar les categories.
  function viewChips() {
    const byCategory = Prefs.view('byCategory');
    const chip = (value, label) => html`<button type="button" class="chip${value === byCategory ? ' on' : ''}" data-act="view"
      data-by-category="${value}" aria-pressed="${value === byCategory}">${label}</button>`;
    return html`<span class="home-view-l">${t('home.view')}</span>${chip(false, t('home.viewAll'))}${chip(true, t('home.viewCats'))}
      <a class="home-cats-edit" href="#/etiquetes">${t('tags.manage')}</a>`;
  }

  // ---------- Per categories ----------
  // «Sense categoria» i cada categoria, plegades. En obrir-ne una surten les fitxes que hi són directament i les
  // seves subcategories, també plegables. Només compten les fitxes que es veuen amb la cerca i els filtres, i els
  // grups buits no surten; mentre cerques, tots estan oberts. Una fitxa amb dues categories surt a totes dues.
  function categoryGroups(list, day) {
    if (state.sorting) return sortTree();
    const shown = new Set(list), searching = !!state.query.trim();
    const isOpen = id => searching || state.open.has(id);
    const tiles = cards => (cards.length ? html`<div class="grid">${cards.map(card => Peces.tile(card, day))}</div>` : '');
    const inBranch = id => Store.cardsInTag(id).filter(card => shown.has(card));
    const direct = id => list.filter(card => Store.cardTags(card.kanji).includes(id));
    const group = (id, name, cards, body, sub) => {
      if (!cards.length) return '';
      const open = isOpen(id);
      return html`<section class="cat${sub ? ' cat-sub' : ''}">
          <button type="button" class="cat-head" data-act="group" data-group="${id}" aria-expanded="${open}">
            <span class="cat-name">${name}</span><span class="cat-n">${cards.length}</span></button>
          ${open ? html`<div class="cat-body">${body()}</div>` : ''}
        </section>`;
    };
    const subGroup = sub => group(sub.id, sub.name, inBranch(sub.id), () => tiles(inBranch(sub.id)), true);
    const withoutCategory = list.filter(untagged);
    const groups = [
      group(UNTAGGED, t('tags.untagged'), withoutCategory, () => tiles(withoutCategory)),
      ...Store.tagChildren('').map(tag => group(tag.id, tag.name, inBranch(tag.id),
        () => html`${tiles(direct(tag.id))}${Store.tagChildren(tag.id).map(subGroup)}`)),
    ];
    if (!groups.some(Boolean)) return '';
    return html`<div class="cat-tools">${Peces.orderChips()}${searching ? '' : openAllButton(list)}</div>${groups}`;
  }
  // Mode «Reordenar»: totes les categories (també les que ara no tenen fitxes que es vegin), només les capçaleres,
  // i cada principal amb les seves subcategories a dins. «Sense categoria» no hi surt: sempre va la primera.
  function sortTree() {
    const item = (tag, sub) => {
      const subs = sub ? [] : Store.tagChildren(tag.id);
      return html`<section class="cat${sub ? ' cat-sub' : ''}" draggable="true" data-group="${tag.id}">
          <div class="cat-head cat-drag"><span class="cat-name">${tag.name}</span>
            <span class="cat-n">${Store.cardsInTag(tag.id).length}</span></div>
          ${subs.length ? html`<div class="cat-body cat-subs">${subs.map(x => item(x, true))}</div>` : ''}
        </section>`;
    };
    return html`<div class="cat-sortable">${Store.tagChildren('').map(tag => item(tag, false))}</div>`;
  }
  // Els grups que surten (els que tenen alguna fitxa de les que es veuen), amb les subcategories.
  function groupIds(list) {
    const shown = new Set(list);
    const hasCards = id => Store.cardsInTag(id).some(card => shown.has(card));
    const ids = Store.tagTree().filter(item => item.depth < 2 && hasCards(item.tag.id)).map(item => item.tag.id);
    return list.some(untagged) ? [UNTAGGED, ...ids] : ids;
  }
  // «Desplegar totes» si n'hi ha alguna de plegada; «Plegar totes» si ja estan totes obertes.
  function openAllButton(list) {
    const allOpen = groupIds(list).every(id => state.open.has(id));
    return html`<button type="button" class="tag tag-btn cat-all" data-act="groupsAll"
      aria-pressed="${allOpen}">${t(allOpen ? 'home.closeAll' : 'home.openAll')}</button>`;
  }

  function setPressed(chip, on) {
    chip.classList.toggle('on', on);
    chip.setAttribute('aria-pressed', on);
  }

  // Interruptor sí/no (el mateix component que a Practicar).
  const viewSwitch = (key, label) => html`<label class="toggle small">
    <button type="button" class="switch" role="switch" aria-checked="${Prefs.view(key)}" data-act="pref" data-pref="${key}"><i></i></button>
    <span>${label}</span></label>`;

  // Obre l'inici per categories amb un grup obert (des de la pantalla de categories, per a «Sense categoria»).
  function showGroup(id) {
    Prefs.view('byCategory', true);
    state.open.add(id);
    location.hash = '#/';
  }

  return { nav: 'home', render, key, visible, matches, showGroup, UNTAGGED };
})();
