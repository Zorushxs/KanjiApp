// Arrencada, rutes (#/...), tema, idioma, estat de desat, arxiu i exportar/importar.
// Cada pantalla és un objecte { nav, render(root, arg), key(e) }: nav diu quina pestanya s'encén,
// render pinta la pantalla dins de root i key (opcional) rep les tecles.
const App = (() => {
  const { $, html } = U;
  const ROUTES = { '': Inici, k: Fitxa, afegir: Afegir, practica: Practica, calendari: Calendari };
  let current = null;       // pantalla que es veu
  let lastHash = null;      // per saber si es repinta la mateixa pantalla
  let saveState = 'saved';  // saving | saved | error

  // ---------- Historial ----------
  // Cada entrada de l'historial guarda la seva posició (i) per saber si «tornar» queda dins de l'app.
  let historyIndex = null, replacing = false;
  function stamp() {
    const saved = history.state;
    if (saved && Number.isInteger(saved.i)) {
      historyIndex = saved.i;
    } else {
      if (historyIndex === null) historyIndex = 0;
      else if (!replacing) historyIndex++;
      history.replaceState({ i: historyIndex }, '');
    }
    replacing = false;
  }
  // Canvia de pantalla sense afegir una entrada a l'historial (fitxa anterior i següent).
  function replace(hash) {
    replacing = true;
    location.replace(hash);
  }
  // Enrere dins de l'app; si has entrat directament en aquesta pantalla, a l'inici.
  function back() {
    if (historyIndex > 0) history.back();
    else location.hash = '#/';
  }

  // ---------- Rutes ----------
  function route() {
    stamp();
    const [name, ...rest] = location.hash.replace(/^#\/?/, '').split('/');
    let arg = rest.join('/');
    try { arg = decodeURIComponent(arg); } catch {}
    current = ROUTES[name] || Inici;
    // Si es repinta la mateixa pantalla (p. ex. en canviar d'idioma), els desplegables oberts es queden oberts.
    const samePage = location.hash === lastHash;
    const reopen = samePage ? [...$('#view').querySelectorAll('details[data-fold][open]')].map(d => d.dataset.fold) : [];
    const root = document.createElement('div');
    root.className = 'screen';
    $('#view').replaceChildren(root);
    current.render(root, arg);
    reopen.forEach(fold => {
      const details = root.querySelector(`details[data-fold="${fold}"]`);
      if (details) details.open = true;
    });
    document.querySelectorAll('[data-nav]').forEach(link => {
      const on = link.dataset.nav === current.nav;
      link.classList.toggle('on', on);
      if (on) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    if (!samePage) {
      lastHash = location.hash;
      scrollTo(0, 0);
    }
    renderBanner();
    renderBadge();
  }
  window.addEventListener('hashchange', route);

  // ---------- Tecles i clics de tota l'app ----------
  // Les tecles van a la pantalla, excepte si escrius en un camp o hi ha Ctrl, Alt o Cmd.
  document.addEventListener('keydown', e => {
    const target = e.target.closest ? e.target : document.body;
    if (!current || !current.key || e.ctrlKey || e.metaKey || e.altKey) return;
    if (target.closest('input, textarea, select')) return;
    current.key(e);
  });
  // Botons de veu (data-say) i de rōmaji (data-romaji-toggle), a qualsevol pantalla.
  document.addEventListener('click', e => {
    const sayButton = e.target.closest('[data-say]');
    if (sayButton) Veu.say(sayButton.dataset.say).catch(() => U.toast(t('card.noAudio'), 'warn'));
    if (e.target.closest('[data-romaji-toggle]')) Peces.setRomaji(!Prefs.view('romaji'));
  });

  // ---------- Tema, rōmaji i idioma ----------
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    Prefs.set('theme', theme);
  }
  if (!document.documentElement.dataset.theme) {
    setTheme(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  $('#themeBtn').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  Peces.setRomaji(Prefs.view('romaji'));

  // Un botó per cada idioma d'i18n.js, amb el nom de l'idioma escrit en el mateix idioma.
  $('#langs').innerHTML = html`${I18n.langs.map(lang => html`<button type="button" data-lang="${lang}" lang="${lang}"
    title="${I18n.name(lang)}" aria-label="${I18n.name(lang)}">${lang.toUpperCase()}</button>`)}`;
  function renderLangs() {
    document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === I18n.lang));
  }
  $('#langs').onclick = e => {
    const button = e.target.closest('[data-lang]');
    if (!button || button.dataset.lang === I18n.lang) return;
    I18n.set(button.dataset.lang);
    renderLangs();
    renderState(saveState);
    route();
  };

  // ---------- Estat de desat i fitxes per repassar ----------
  function renderState(state) {
    saveState = state;
    const dest = Almacen.mode === 'file' ? Almacen.name : t('file.browser');
    const el = $('#saveState');
    if (state === 'saving') el.textContent = t('file.saving');
    else if (state === 'error') el.textContent = t('file.error');
    else el.textContent = t('file.savedIn', { dest });
    el.dataset.s = state;
  }
  function renderBadge() {
    const day = U.today(), badge = $('#dueBadge');
    const due = Store.kanji.filter(card => Store.isDue(card.kanji, day)).length;
    badge.textContent = due;
    badge.hidden = !due;
  }
  Store.onStatus(state => {
    renderState(state);
    renderBadge();
  });

  // ---------- Avís de l'arxiu (només a l'inici, per no molestar mentre practiques) ----------
  function renderBanner() {
    const banner = $('#banner'), mode = Almacen.mode;
    const hide = current !== Inici || mode === 'file' || (mode === 'local' && !Almacen.canFile && Prefs.get('notice'));
    if (hide) {
      banner.hidden = true;
      banner.innerHTML = '';
      return;
    }
    if (mode === 'permiso') {
      banner.innerHTML = html`<p>${t('file.permiso', { name: Almacen.name })}</p>
        <button type="button" class="btn primary" data-act="reconnect">${t('file.reconnect')}</button>`;
    } else if (Almacen.canFile) {
      banner.innerHTML = html`<p>${t('file.local')}</p>
        <button type="button" class="btn primary" data-act="create">${t('file.create')}</button><button
          type="button" class="btn" data-act="open">${t('file.open')}</button>`;
    } else {
      banner.innerHTML = html`<p>${t('file.noFS')}</p><button type="button" class="icon-btn" data-act="dismiss"
        title="${t('file.dismiss')}" aria-label="${t('file.dismiss')}">${U.ICON.close}</button>`;
    }
    banner.hidden = false;
  }
  U.onActions($('#banner'), {
    reconnect: () => connect(Almacen.reconnect),
    create: () => connect(() => Almacen.create(Store.snapshot())),
    open: () => connect(Almacen.open),
    dismiss() {
      Prefs.set('notice', true);
      renderBanner();
    },
  });

  // ---------- Arxiu ----------
  // Connecta amb un arxiu (obrir, crear o tornar a donar permís) i en carrega les dades si en té.
  async function connect(action) {
    try {
      const result = await action();
      if (result.data && Array.isArray(result.data.kanji) && result.data.kanji.length) Store.load(result.data);
      else if (result.data === null || result.data === undefined) await Store.flush(); // arxiu nou o buit: s'hi desa el que tens
      route();
      renderState('saved');
    } catch (e) {
      if (e.name !== 'AbortError') alert(t('file.openFail', { msg: e.message })); // AbortError: has tancat el selector
    }
  }
  $('#fileBtn').onclick = () => {
    if (!Almacen.canFile) {
      alert(t('file.noPicker'));
      return;
    }
    connect(() => (confirm(t('file.ask')) ? Almacen.open() : Almacen.create(Store.snapshot())));
  };

  // ---------- Exportar / importar ----------
  $('#exportBtn').onclick = () => {
    const json = JSON.stringify(Store.snapshot(), null, 2);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    link.download = 'kanji.json';
    link.click();
    URL.revokeObjectURL(link.href);
  };
  $('#importBtn').onclick = () => $('#importInput').click();
  $('#importInput').onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.kanji)) throw new Error(t('file.importNoList'));
      if (!confirm(t('file.importConfirm'))) return;
      Store.load(data);
      await Store.flush();
      route();
      renderState('saved');
    } catch (err) {
      alert(t('file.importFail', { msg: err.message }));
    } finally {
      e.target.value = ''; // per poder tornar a triar el mateix arxiu
    }
  };

  // ---------- Arrencada ----------
  (async () => {
    try {
      const result = await Almacen.init();
      Store.load(result.data);
    } catch (e) {
      console.error(e);
    }
    I18n.apply();
    renderLangs();
    renderState('saved');
    route();
  })();

  return { back, replace };
})();
