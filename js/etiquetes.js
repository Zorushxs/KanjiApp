// Etiquetes per organitzar les fitxes (Números, Temps › Mesos…). Una etiqueta pot anar dins d'una altra, tants
// nivells com vulguis, i una fitxa en pot tenir tantes com vulguis. Dues pantalles:
// - #/etiquetes: totes en arbre i el formulari per crear-ne;
// - #/etiquetes/<id>: una etiqueta. Toques les fitxes per posar-los-la o treure-la, i en pots crear de dins,
//   canviar-ne el nom, moure-la dins d'una altra o esborrar-la.
const Etiquetes = (() => {
  const { html } = U;
  const state = {
    current: '', // etiqueta oberta ('' = la llista)
    query: '',   // cerca de fitxes dins d'una etiqueta
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
      <section class="panel tags-panel"><h2>${t('tags.new')}</h2>${createForm('')}</section>
      <section class="panel tags-panel"><h2>${t('tags.all')}</h2>${treeList(Store.tagTree(), 0)}</section>`;
    U.onActions(root, { back });
  }

  // Arbre d'etiquetes: cada una amb quantes fitxes té (comptant les de dins). base: fondària de la primera.
  function treeList(items, base) {
    if (!items.length) return html`<p class="hint">${base ? t('tags.subNone') : t('tags.none')}</p>`;
    const item = ({ tag, depth }) => html`<li style="--depth: ${depth - base}"><a href="#/etiquetes/${tag.id}">
        <span>${tag.name}</span><small>${Store.cardsInTag(tag.id).length}</small></a></li>`;
    return html`<ul class="tags-tree">${items.map(item)}</ul>`;
  }

  // Crear: a la llista, amb el desplegable «Dins de»; dins d'una etiqueta, a dins d'aquesta.
  function createForm(parent) {
    return html`<form class="tags-form" data-form="create">
        <label class="fld"><span>${t('tags.name')}</span><input name="label" maxlength="40" autocomplete="off"
          placeholder="${t(parent ? 'tags.subPh' : 'tags.namePh')}"></label>
        ${parent ? '' : html`<label class="fld"><span>${t('tags.parent')}</span>${parentSelect('', [])}</label>`}
        <button class="btn primary">${t(parent ? 'tags.createSub' : 'tags.create')}</button>
      </form>`;
  }
  // Desplegable per triar dins de quina etiqueta va (o cap). skip: les que no hi poden sortir.
  function parentSelect(selected, skip) {
    const options = Store.tagTree().filter(item => !skip.includes(item.tag.id));
    return html`<select name="parent"><option value="">${t('tags.root')}</option>${options.map(({ tag }) =>
      html`<option value="${tag.id}"${tag.id === selected ? html` selected` : ''}>${Store.tagLabel(tag.id)}</option>`)}</select>`;
  }

  // ---------- Una etiqueta ----------
  function tagScreen(root, tag) {
    const above = Store.tagPath(tag.id).slice(0, -1);
    const crumbs = above.map(x => html`<a href="#/etiquetes/${x.id}">${x.name}</a> › `);
    root.innerHTML = html`
      ${backBar(t('tags.title'))}
      ${above.length ? html`<p class="tags-crumbs">${crumbs}</p>` : ''}
      <h1 class="h">${tag.name}</h1>
      ${cardsPanel()}
      <section class="panel tags-panel"><h2>${t('tags.sub')}</h2>${treeList(subtree(tag.id), 1 + above.length)}${createForm(tag.id)}</section>
      ${editPanel(tag)}`;
    paintCards(root, tag);
    root.querySelector('.tags-search').oninput = e => {
      state.query = e.target.value;
      paintCards(root, tag);
    };
    U.onActions(root, {
      back,
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
  // Les de dins d'una etiqueta, en arbre (sense ella).
  function subtree(id) {
    const tree = Store.tagTree(), i = tree.findIndex(item => item.tag.id === id), items = [];
    for (let j = i + 1; j < tree.length && tree[j].depth > tree[i].depth; j++) items.push(tree[j]);
    return items;
  }

  // Totes les fitxes; les que tenen l'etiqueta es veuen premudes i un toc la posa o la treu.
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

  // Canviar el nom, moure-la (mai dins d'ella mateixa ni de les seves) i esborrar-la.
  function editPanel(tag) {
    return html`<section class="panel tags-panel"><h2>${t('tags.editTitle')}</h2>
        <form class="tags-form inline" data-form="rename">
          <label class="fld"><span>${t('tags.name')}</span><input name="label" value="${tag.name}" maxlength="40" autocomplete="off"></label>
          <button class="btn">${t('tags.rename')}</button>
        </form>
        <form class="tags-form inline" data-form="move">
          <label class="fld"><span>${t('tags.parent')}</span>${parentSelect(tag.parent, Store.tagBranch(tag.id))}</label>
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
