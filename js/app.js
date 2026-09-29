// Arrencada, rutes (#/...), tema, idioma, estat de desat, arxiu i exportar/importar.
const App = (() => {
  const { $, esc } = U;
  const ROUTES = { '': Inici, k: Fitxa, afegir: Afegir, practica: Practica, calendari: Calendari };
  let current = null, lastHash = null, idx = null, replacing = false, saveState = 'saved';

  // ---------- Rutes ----------
  // Cada entrada de l'historial guarda la seva posició (i) per saber si "tornar" queda dins de l'app.
  function stamp() {
    const st = history.state;
    if (st && Number.isInteger(st.i)) idx = st.i;
    else { idx = idx === null ? 0 : replacing ? idx : idx + 1; history.replaceState({ i: idx }, ''); }
    replacing = false;
  }
  function route() {
    stamp();
    const [name, ...rest] = location.hash.replace(/^#\/?/, '').split('/');
    let arg = rest.join('/'); try { arg = decodeURIComponent(arg); } catch {}
    current = ROUTES[name] || Inici;
    // Si es repinta la mateixa pantalla (p. ex. en canviar d'idioma), els desplegables oberts es queden oberts.
    const reopen = location.hash === lastHash ? [...$('#view').querySelectorAll('details[data-fold][open]')].map(d => d.dataset.fold) : [];
    const root = document.createElement('div'); root.className = 'screen';
    $('#view').replaceChildren(root);
    current.render(root, arg);
    reopen.forEach(f => { const d = root.querySelector(`details[data-fold="${f}"]`); if (d) d.open = true; });
    document.querySelectorAll('[data-nav]').forEach(a => {
      const on = a.dataset.nav === current.nav;
      a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (location.hash !== lastHash) { lastHash = location.hash; scrollTo(0, 0); }
    renderBanner(); renderBadge();
  }
  window.addEventListener('hashchange', route);
  const replace = h => { replacing = true; location.replace(h); };
  const back = () => (idx > 0 ? history.back() : (location.hash = '#/'));

  document.addEventListener('keydown', e => {
    const el = e.target.closest ? e.target : document.body;
    if (!current || !current.key || e.ctrlKey || e.metaKey || e.altKey || el.closest('input, textarea, select')) return;
    current.key(e);
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-say]'); if (!b) return;
    Veu.say(b.dataset.say).catch(() => U.toast(t('card.noAudio'), 'warn'));
  });

  // ---------- Tema i idioma ----------
  const setTheme = th => { document.documentElement.dataset.theme = th; try { localStorage.setItem('kanji:tema', th); } catch {} };
  if (!document.documentElement.dataset.theme) setTheme(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  $('#themeBtn').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');

  // Un botó per cada idioma d'i18n.js, amb el nom de l'idioma escrit en el mateix idioma.
  $('#langs').innerHTML = I18n.langs.map(l => `<button type="button" data-lang="${l}" lang="${l}" title="${esc(I18n.name(l))}" aria-label="${esc(I18n.name(l))}">${l.toUpperCase()}</button>`).join('');
  const renderLangs = () => document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === I18n.lang));
  $('#langs').onclick = e => {
    const b = e.target.closest('[data-lang]'); if (!b || b.dataset.lang === I18n.lang) return;
    I18n.set(b.dataset.lang); renderLangs(); renderState(saveState); route();
  };

  // ---------- Estat de desat i avisos d'arxiu ----------
  function renderState(s) {
    saveState = s;
    const dest = Almacen.mode === 'file' ? Almacen.name : t('file.browser');
    $('#saveState').textContent = s === 'saving' ? t('file.saving') : s === 'error' ? t('file.error') : t('file.savedIn', { dest });
    $('#saveState').dataset.s = s;
  }
  function renderBadge() {
    const day = U.today(), n = Store.kanji.filter(k => Store.isDue(k.kanji, day)).length, b = $('#dueBadge');
    b.textContent = n; b.hidden = !n;
  }
  Store.onStatus(s => { renderState(s); renderBadge(); });

  const dismissed = () => { try { return localStorage.getItem('kanji:avis') === '1'; } catch { return false; } };
  // L'avís només surt a l'inici, per no molestar mentre practiques.
  function renderBanner() {
    const b = $('#banner'), m = Almacen.mode;
    if (current !== Inici || m === 'file' || (m === 'local' && !Almacen.canFile && dismissed())) { b.hidden = true; b.innerHTML = ''; return; }
    if (m === 'permiso') {
      b.innerHTML = `<p>${esc(t('file.permiso', { name: Almacen.name }))}</p><button type="button" class="btn primary" data-b="reconnect">${esc(t('file.reconnect'))}</button>`;
    } else if (Almacen.canFile) {
      b.innerHTML = `<p>${esc(t('file.local'))}</p>
        <button type="button" class="btn primary" data-b="create">${esc(t('file.create'))}</button><button type="button" class="btn" data-b="open">${esc(t('file.open'))}</button>`;
    } else {
      b.innerHTML = `<p>${esc(t('file.noFS'))}</p><button type="button" class="icon-btn" data-b="dismiss" title="${esc(t('file.dismiss'))}" aria-label="${esc(t('file.dismiss'))}">${U.ICON.close}</button>`;
    }
    b.hidden = false;
  }
  $('#banner').onclick = e => {
    const a = e.target.closest('[data-b]'); if (!a) return;
    const k = a.dataset.b;
    if (k === 'reconnect') connect(Almacen.reconnect);
    else if (k === 'create') connect(() => Almacen.create(Store.snapshot()));
    else if (k === 'open') connect(Almacen.open);
    else if (k === 'dismiss') { try { localStorage.setItem('kanji:avis', '1'); } catch {} renderBanner(); }
  };
  async function connect(fn) {
    try {
      const r = await fn();
      if (r.data && Array.isArray(r.data.kanji) && r.data.kanji.length) Store.load(r.data);
      else if (r.data === null || r.data === undefined) await Store.flush();
      route(); renderState('saved');
    } catch (e) { if (e.name !== 'AbortError') alert(t('file.openFail', { msg: e.message })); }
  }
  $('#fileBtn').onclick = () => Almacen.canFile
    ? connect(() => confirm(t('file.ask')) ? Almacen.open() : Almacen.create(Store.snapshot()))
    : alert(t('file.noPicker'));

  // ---------- Exportar / importar ----------
  $('#exportBtn').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(Store.snapshot(), null, 2)], { type: 'application/json' }));
    a.download = 'kanji.json'; a.click(); URL.revokeObjectURL(a.href);
  };
  $('#importBtn').onclick = () => $('#importInput').click();
  $('#importInput').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d || !Array.isArray(d.kanji)) throw new Error(t('file.importNoList'));
      if (!confirm(t('file.importConfirm'))) return;
      Store.load(d); await Store.flush(); route(); renderState('saved');
    } catch (err) { alert(t('file.importFail', { msg: err.message })); }
    finally { e.target.value = ''; }
  };

  // ---------- Arrencada ----------
  (async () => {
    try { const r = await Almacen.init(); Store.load(r.data); } catch (e) { console.error(e); }
    I18n.apply(); renderLangs(); renderState('saved'); route();
  })();
  return { back, replace };
})();
