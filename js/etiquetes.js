// Categories per organitzar les fitxes (al codi i a les dades es diuen "tags"): Números, Calendari › Mesos…
// Com a molt dos nivells (categoria › subcategoria), i una fitxa en pot tenir tantes com vulguis. Normalment
// les posa Claude en crear les fitxes; aquí es corregeixen. Dues pantalles:
// - #/etiquetes: «Categoritzar amb Claude» (les fitxes que no en tenen), totes en arbre (amb ↑ ↓ per canviar-ne
//   l'ordre) i el formulari per crear-ne;
// - #/etiquetes/<id>: una categoria, amb l'arbre sencer a dalt. Si és principal, s'hi poden crear subcategories;
//   se'n pot canviar el nom, moure-la o esborrar-la, i toques les fitxes per posar-los-la o treure-la.
const Etiquetes = (() => {
  const { html } = U;
  const state = {
    current: '', // categoria oberta ('' = la llista)
    query: '',   // cerca de fitxes dins d'una categoria
    aiPaste: '', // «Categoritzar amb Claude»: la resposta enganxada…
    aiRows: null, // …i el que se'n treu: [{ kanji, categories: [camins] }], o null
    aiError: '',
    timer: null,
  };

  function render(root, arg) {
    if (arg !== state.current) state.query = '';
    state.current = arg || '';
    root.onsubmit = e => {
      e.preventDefault();
      submit(root, e.target);
    };
    if (!arg) {
      listScreen(root);
      return;
    }
    const tag = Store.tag(arg);
    if (!tag) {
      root.innerHTML = html`<div class="empty"><p>${t('tags.notFound')}</p>
        <a class="btn" href="#/etiquetes">${t('tags.title')}</a></div>`;
      return;
    }
    tagScreen(root, tag);
  }

  // Botó de tornar enrere (a la pantalla d'on venies).
  const backBar = label => html`<div class="bar">
      <a class="btn ghost back" href="#/" data-act="back">${U.ICON.left}<span>${label}</span></a></div>`;
  const back = (link, e) => {
    e.preventDefault();
    App.back();
  };

  // ---------- Llista ----------
  function listScreen(root) {
    root.innerHTML = html`
      ${backBar(t('card.back'))}
      <h1 class="h">${t('tags.title')}</h1>
      ${aiPanel()}
      ${treePanel('')}
      <section class="panel tags-panel"><h2>${t('tags.new')}</h2>${createForm('')}</section>`;
    U.onActions(root, { back, ...treeActions(root), ...aiActions(root) });
    const paste = root.querySelector('.tags-ai-paste');
    if (!paste) return;
    paintAi(root);
    paste.oninput = e => {
      state.aiPaste = e.target.value;
      clearTimeout(state.timer);
      state.timer = setTimeout(() => {
        aiReview();
        paintAi(root);
      }, 350);
    };
  }

  // ---------- Categoritzar amb Claude ----------
  // Per a les fitxes sense categoria: copies el prompt, l'enganxes a Claude i n'enganxes aquí la resposta. Abans de
  // desar es veu on va cada fitxa i quines categories són noves. Només se n'afegeixen (no se'n treu cap).
  const withoutCategory = () => Store.kanji.filter(card => !Store.cardTags(card.kanji).length);
  function aiPanel() {
    const n = withoutCategory().length;
    if (!n && !state.aiRows) return '';
    return html`<section class="panel tags-panel tags-ai"><h2>${t('cats.aiTitle')}</h2>
        <p class="hint">${t('cats.aiHint', { n })}</p>
        <div class="row">
          <button type="button" class="btn primary" data-act="aiCopy">${t('add.copy')}</button>
          <a class="btn" href="https://claude.ai/new" target="_blank" rel="noopener">${t('add.openClaude')} ↗</a>
        </div>
        <textarea class="ptext tags-ai-prompt" rows="8" readonly hidden aria-label="Prompt"></textarea>
        <textarea class="paste tags-ai-paste" rows="5" placeholder="${t('add.pastePh')}" aria-label="${t('add.pasteLabel')}"
          spellcheck="false">${state.aiPaste}</textarea>
        <div class="tags-ai-result"></div>
      </section>`;
  }
  // Treu de la resposta les fitxes que tens, amb les seves categories; les altres es compten a part.
  function aiReview() {
    Object.assign(state, { aiRows: null, aiError: '' });
    if (!state.aiPaste.trim()) return;
    try {
      const raws = Validar.extract(state.aiPaste), rows = [];
      raws.forEach(raw => {
        const kanji = raw && typeof raw.kanji === 'string' ? raw.kanji.trim() : '';
        const categories = Validar.categoryPaths(raw && raw.categories);
        if (Store.get(kanji) && categories.length && !rows.some(row => row.kanji === kanji)) rows.push({ kanji, categories });
      });
      rows.skipped = raws.length - rows.length;
      state.aiRows = rows;
    } catch (e) {
      state.aiError = e.message;
    }
  }
  function paintAi(root) {
    const box = root.querySelector('.tags-ai-result'), rows = state.aiRows;
    if (state.aiError || !rows) {
      box.innerHTML = state.aiError ? html`<p class="err" role="alert">${state.aiError}</p>` : '';
      return;
    }
    const created = Store.newTagLabels(rows.flatMap(row => row.categories));
    const label = path => html`${path.join(' › ')}${Store.findTagPath(path) ? '' : html` <em>${t('add.catNew')}</em>`}`;
    const row = item => html`<li><span class="rk" lang="ja">${item.kanji}</span>
        <span class="rm">${U.join(item.categories.map(label), ' · ')}</span></li>`;
    box.innerHTML = html`
      ${created.length ? html`<p class="note">${t('add.catsCreated', { n: created.length, list: created.join(' · ') })}</p>` : ''}
      ${rows.skipped ? html`<p class="warn">${t('cats.aiSkipped', { n: rows.skipped })}</p>` : ''}
      <ul class="rows">${rows.map(row)}</ul>
      <div class="row">${rows.length
        ? html`<button type="button" class="btn primary" data-act="aiApply">${t('cats.aiApply', { n: rows.length })}</button>`
        : html`<p class="hint">${t('add.nothing')}</p>`}</div>`;
  }
  function aiActions(root) {
    return {
      async aiCopy() {
        const prompt = Prompt.categorize(withoutCategory());
        try {
          await navigator.clipboard.writeText(prompt);
          U.toast(t('add.copied'));
        } catch { // sense permís de porta-retalls: ensenya el prompt perquè el copiïs a mà
          const box = root.querySelector('.tags-ai-prompt');
          box.value = prompt;
          box.hidden = false;
          box.focus();
          box.select();
          U.toast(t('add.copyFail'), 'warn');
        }
      },
      aiApply() {
        state.aiRows.forEach(row => {
          const ids = row.categories.map(path => Store.ensureTagPath(path)).filter(Boolean);
          Store.addCardTags(row.kanji, ids);
        });
        const n = state.aiRows.length;
        Object.assign(state, { aiPaste: '', aiRows: null, aiError: '' });
        render(root, '');
        U.toast(t('cats.aiSaved', { n }));
      },
    };
  }

  // ---------- Arbre ----------
  // Totes les categories, també dins d'una (amb aquesta marcada), per veure sempre on ets. current: la categoria
  // oberta ('' a la llista); si és principal, a sota hi ha el formulari per crear-hi subcategories.
  function treePanel(current) {
    const canHaveSubs = current && !Store.tag(current).parent;
    return html`<section class="panel tags-panel"><h2>${t('tags.all')}</h2>${untaggedRow()}${treeList(current)}${
      canHaveSubs ? createForm(current) : ''}</section>`;
  }
  // Què fan els botons de l'arbre: «Sense categoria», anar a una categoria i canviar l'ordre (↑ ↓).
  function treeActions(root) {
    const shift = (button, step) => {
      const id = button.dataset.tag, act = button.dataset.act;
      Store.shiftTag(id, step);
      render(root, state.current);
      const same = root.querySelector(`[data-act="${act}"][data-tag="${id}"]`);
      const other = root.querySelector(`[data-act="${act === 'up' ? 'down' : 'up'}"][data-tag="${id}"]`);
      (same && !same.disabled ? same : other).focus();
    };
    return {
      untagged(link, e) {
        e.preventDefault();
        Inici.showGroup(Inici.UNTAGGED);
      },
      // D'una categoria a una altra sense omplir l'historial: «enrere» surt de les categories.
      go(link, e) {
        if (!state.current) return;
        e.preventDefault();
        App.replace(link.getAttribute('href'));
      },
      up: button => shift(button, -1),
      down: button => shift(button, 1),
    };
  }
  // «Sense categoria»: automàtica, amb les fitxes que no en tenen cap. Va la primera i porta a l'inici, per
  // categories, amb aquest grup obert.
  function untaggedRow() {
    const n = Store.kanji.filter(card => !Store.cardTags(card.kanji).length).length;
    return html`<ul class="tags-tree tags-untagged"><li><a href="#/" data-act="untagged">
        <span>${t('tags.untagged')} <em>${t('tags.auto')}</em></span><small>${n}</small></a>
        <span class="tags-order" aria-hidden="true"></span></li></ul>`;
  }

  // Cada categoria amb quantes fitxes té (comptant les de dins) i els botons ↑ ↓ per canviar-ne l'ordre entre
  // les que són al mateix lloc. La primera no pot pujar i l'última no pot baixar.
  function treeList(current) {
    const tree = Store.tagTree();
    if (!tree.length) return html`<p class="hint">${t('tags.none')}</p>`;
    const item = ({ tag, depth }) => {
      const siblings = Store.tagChildren(tag.parent), i = siblings.indexOf(tag), on = tag.id === current;
      const move = (act, icon, label, off) => html`<button type="button" class="tags-move" data-act="${act}" data-tag="${tag.id}"
        title="${label}" aria-label="${label} · ${tag.name}"${off ? html` disabled` : ''}>${icon}</button>`;
      return html`<li style="--depth: ${depth}"${on ? html` class="on"` : ''}>
          <a href="#/etiquetes/${tag.id}" data-act="go"${on ? html` aria-current="page"` : ''}><span>${tag.name}</span>
            <small>${Store.cardsInTag(tag.id).length}</small></a>
          <span class="tags-order">${move('up', '↑', t('tags.up'), i === 0)}${move('down', '↓', t('tags.down'), i === siblings.length - 1)}</span>
        </li>`;
    };
    return html`<ul class="tags-tree">${tree.map(item)}</ul>`;
  }

  // Crear: a la llista, amb el desplegable «Dins de»; dins d'una categoria principal, a dins d'aquesta.
  function createForm(parent) {
    return html`<form class="tags-form" data-form="create">
        <label class="fld"><span>${t('tags.name')}</span><input name="label" maxlength="40" autocomplete="off"
          placeholder="${t(parent ? 'tags.subPh' : 'tags.namePh')}"></label>
        ${parent ? '' : html`<label class="fld"><span>${t('tags.parent')}</span>${parentSelect('', null)}</label>`}
        <button class="btn primary">${t(parent ? 'tags.createSub' : 'tags.create')}</button>
      </form>`;
  }
  // Desplegable per triar dins de quina categoria principal va (o cap). moving: la que es mou, que no pot anar
  // dins d'ella mateixa i, si té subcategories, només pot ser principal (no hi ha tercer nivell).
  function parentSelect(selected, moving) {
    const roots = moving && Store.tagChildren(moving.id).length ? [] : Store.tagChildren('').filter(tag => tag !== moving);
    return html`<select name="parent"><option value="">${t('tags.root')}</option>${roots.map(tag =>
      html`<option value="${tag.id}"${tag.id === selected ? html` selected` : ''}>${tag.name}</option>`)}</select>`;
  }

  // ---------- Una categoria ----------
  function tagScreen(root, tag) {
    const above = Store.tagPath(tag.id).slice(0, -1);
    const crumbs = above.map(x => html`<a href="#/etiquetes/${x.id}">${x.name}</a> › `);
    root.innerHTML = html`
      ${backBar(t('tags.title'))}
      ${above.length ? html`<p class="tags-crumbs">${crumbs}</p>` : ''}
      <h1 class="h">${tag.name}</h1>
      ${treePanel(tag.id)}
      ${editPanel(tag)}
      ${cardsPanel()}`;
    paintCards(root, tag);
    root.querySelector('.tags-search').oninput = e => {
      state.query = e.target.value;
      paintCards(root, tag);
    };
    U.onActions(root, {
      back,
      ...treeActions(root),
      pick(tile) {
        const on = tile.getAttribute('aria-pressed') !== 'true';
        Store.setCardTag(tile.dataset.k, tag.id, on);
        tile.setAttribute('aria-pressed', on);
        paintCount(root, tag);
      },
      delete() {
        const subs = Store.tagBranch(tag.id).length - 1;
        const question = subs ? t('tags.deleteSubs', { name: tag.name, n: subs }) : t('tags.deleteOne', { name: tag.name });
        if (!confirm(question)) return;
        Store.removeTag(tag.id);
        U.toast(t('tags.deleted', { name: tag.name }));
        App.replace(tag.parent ? '#/etiquetes/' + tag.parent : '#/etiquetes');
      },
    });
  }

  // Totes les fitxes; les que tenen la categoria es veuen premudes i un toc la posa o la treu.
  function cardsPanel() {
    return html`<section class="panel tags-panel"><h2>${t('tags.cards')}</h2>
        <p class="hint tags-hint">${t('tags.tapHint')}</p>
        <input type="search" class="search tags-search" value="${state.query}" placeholder="${t('home.search')}"
          aria-label="${t('home.search')}" autocomplete="off">
        <p class="found tags-count" aria-live="polite"></p>
        <div class="grid tags-grid"></div>
      </section>`;
  }
  function paintCards(root, tag) {
    const list = Store.kanji.filter(card => Inici.matches(card, state.query));
    const grid = root.querySelector('.tags-grid');
    grid.innerHTML = html`${list.map(card => Peces.pickTile(card, Store.cardTags(card.kanji).includes(tag.id)))}`;
    if (!list.length) grid.innerHTML = html`<p class="hint">${Store.kanji.length ? t('home.none') : t('home.emptyTitle')}</p>`;
    paintCount(root, tag);
  }
  function paintCount(root, tag) {
    const n = Store.kanji.filter(card => Store.cardTags(card.kanji).includes(tag.id)).length;
    root.querySelector('.tags-count').textContent = t('tags.count', { n });
  }

  // Canviar el nom, moure-la (dins d'una principal o com a principal) i esborrar-la.
  function editPanel(tag) {
    return html`<section class="panel tags-panel"><h2>${t('tags.editTitle')}</h2>
        <form class="tags-form inline" data-form="rename">
          <label class="fld"><span>${t('tags.name')}</span><input name="label" value="${tag.name}" maxlength="40" autocomplete="off"></label>
          <button class="btn">${t('tags.rename')}</button>
        </form>
        <form class="tags-form inline" data-form="move">
          <label class="fld"><span>${t('tags.parent')}</span>${parentSelect(tag.parent, tag)}</label>
          <button class="btn">${t('tags.move')}</button>
        </form>
        <div class="row"><button type="button" class="btn danger" data-act="delete">${t('tags.delete')}</button></div>
      </section>`;
  }

  // ---------- Formularis ----------
  // Crear, canviar el nom i moure. Si no es pot (nom buit o repetit…), un avís i no es toca res.
  function submit(root, form) {
    const value = name => (form.elements[name] ? form.elements[name].value : '');
    const tag = state.current ? Store.tag(state.current) : null;
    const kind = form.dataset.form;
    let result;
    if (kind === 'create') result = Store.addTag(value('label'), tag ? tag.id : value('parent'));
    else if (kind === 'rename') result = Store.renameTag(tag.id, value('label'));
    else if (kind === 'move') result = Store.moveTag(tag.id, value('parent'));
    else return;
    if (result.error) {
      U.toast(t(result.error, { name: value('label').trim() || (tag && tag.name) }), 'warn');
      return;
    }
    render(root, state.current);
    if (kind === 'create') {
      U.toast(t('tags.created', { name: Store.tag(result.id).name }));
      root.querySelector('[data-form="create"] [name="label"]').focus();
    } else {
      U.toast(t('tags.saved'));
    }
  }

  return { nav: 'home', render };
})();
