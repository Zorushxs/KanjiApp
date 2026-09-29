// Afegir kanji en tres passos: copiar el prompt → Claude.ai → enganxar la resposta, revisar-la i desar-la.
const Afegir = (() => {
  const { esc } = U;
  const GROUPS = ['new', 'upd', 'same', 'err'];
  let input = '', paste = '', rows = null, error = '', done = '', lastArg = '', timer = null;
  let regen = new Set(); // kanji que ja tens però que vols tornar a generar
  const pick = s => [...new Set(String(s).match(/\p{Script=Han}/gu) || [])];
  // Van al prompt els nous i els que ja tens només si els has marcat per regenerar.
  const forPrompt = () => pick(input).filter(ch => !Store.get(ch) || regen.has(ch));

  function render(root, arg) {
    if (arg && arg !== lastArg) { input = arg; regen = new Set(pick(arg)); paste = ''; rows = null; error = ''; done = ''; } // ve de "Regenerar"
    lastArg = arg || '';
    root.innerHTML = `
      <h1 class="h">${esc(t('add.title'))}</h1>
      <section class="panel step">
        <h2><span class="n">1</span>${esc(t('add.step1'))}</h2>
        <p class="hint">${esc(t('add.step1Hint'))}</p>
        <input class="kin" lang="ja" value="${esc(input)}" placeholder="${esc(t('add.inputPh'))}" aria-label="${esc(t('add.inputLabel'))}" autocomplete="off" autocapitalize="off" spellcheck="false">
        <div class="picked"></div>
        <div class="row">
          <button type="button" class="btn primary" data-act="copy">${esc(t('add.copy'))}</button>
          <a class="btn" href="https://claude.ai/new" target="_blank" rel="noopener">${esc(t('add.openClaude'))} ↗</a>
        </div>
        <details class="pview"><summary>${esc(t('add.showPrompt'))}</summary><textarea class="ptext" rows="12" readonly aria-label="Prompt"></textarea></details>
      </section>
      <section class="panel step">
        <h2><span class="n">2</span>${esc(t('add.step2'))}</h2>
        <p class="hint">${esc(t('add.step2Hint'))}</p>
        <textarea class="paste" rows="7" placeholder="${esc(t('add.pastePh'))}" aria-label="${esc(t('add.pasteLabel'))}" spellcheck="false">${esc(paste)}</textarea>
        <div class="row"><button type="button" class="btn" data-act="review">${esc(t('add.review'))}</button></div>
        <p class="err" role="alert"></p>
      </section>
      <section class="panel step result" hidden></section>`;
    const $ = s => root.querySelector(s);
    paintPicked($);
    paintResult($);

    $('.kin').oninput = e => { input = e.target.value; paintPicked($); paintResult($); };
    $('.paste').oninput = e => {
      paste = e.target.value; done = '';
      clearTimeout(timer); timer = setTimeout(() => { runReview(); paintResult($); }, 350);
    };
    root.onclick = e => {
      const c = e.target.closest('[data-ch]');
      if (c) { const ch = c.dataset.ch; if (regen.has(ch)) regen.delete(ch); else regen.add(ch); paintPicked($); paintResult($); return; }
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'copy') copy($);
      else if (b.dataset.act === 'review') { clearTimeout(timer); runReview(); paintResult($); }
      else if (b.dataset.act === 'apply') {
        const r = Store.merge(rows.filter(x => x.status === 'new' || x.status === 'upd').map(x => x.item));
        done = t('add.applied', { a: r.added, u: r.updated });
        input = ''; paste = ''; rows = null; error = ''; regen = new Set();
        U.toast(done); render(root, lastArg);
      }
    };
  }

  // Xips: els nous, fixos; els que ja tens, en gris i tocables per incloure'ls (regenerar) o treure'ls.
  function chip(ch) {
    if (!Store.get(ch)) return `<span class="kchip" lang="ja">${esc(ch)}</span>`;
    const on = regen.has(ch);
    return `<button type="button" class="kchip ${on ? 'regen' : 'has'}" lang="ja" data-ch="${esc(ch)}" aria-pressed="${on}" title="${esc(t(on ? 'add.regenChip' : 'add.exists'))}">${esc(ch)}${on ? ' ↻' : ''}</button>`;
  }
  function paintPicked($) {
    const ks = pick(input), go = forPrompt(), box = $('.picked');
    const has = ks.some(ch => Store.get(ch));
    box.innerHTML = ks.map(chip).join('') +
      (has ? `<p class="hint">${esc(go.length ? t('add.existsLegend') : t('add.allExist'))}</p>` : '') +
      (has && go.length ? `<p class="hint"><b>${esc(t('add.inPrompt', { n: go.length }))}</b></p>` : '') +
      (go.length > 12 ? `<p class="warn">${esc(t('add.tooMany'))}</p>` : '');
    $('.ptext').value = go.length ? Prompt.build(go) : '';
  }
  async function copy($) {
    const ks = pick(input), go = forPrompt();
    if (!ks.length) { U.toast(t('add.none'), 'warn'); $('.kin').focus(); return; }
    if (!go.length) { U.toast(t('add.allExist'), 'warn'); return; }
    try { await navigator.clipboard.writeText(Prompt.build(go)); U.toast(t('add.copied')); }
    catch { // sense permís de porta-retalls: obre el prompt perquè el copiïs a mà
      const d = $('.pview'), ta = $('.ptext'); d.open = true; ta.focus(); ta.select();
      U.toast(t('add.copyFail'), 'warn');
    }
  }
  function runReview() {
    rows = null; error = '';
    if (!paste.trim()) return;
    try { rows = Validar.review(paste, Store.get); } catch (e) { error = e.message; }
  }

  function row(r) {
    const msgs = [...r.errors.map(x => `<li class="e">${esc(t(x.k, x.p))}</li>`), ...r.warnings.map(x => `<li class="w">${esc(t(x.k, x.p))}</li>`)].join('');
    const m = r.item ? I18n.list(r.item.meanings).join(', ') : '';
    return `<li><span class="rk" lang="ja">${esc(r.kanji || '?')}</span><span class="rm">${esc(m)}</span>${msgs ? `<ul class="msgs">${msgs}</ul>` : ''}</li>`;
  }
  function paintResult($) {
    $('.err').textContent = error;
    const box = $('.result');
    if (done && !rows) {
      box.hidden = false;
      box.innerHTML = `<p class="ok-line">✓ ${esc(done)}</p><a class="btn" href="#/">${esc(t('add.goHome'))}</a>`;
      return;
    }
    if (!rows) { box.hidden = true; box.innerHTML = ''; return; }
    const by = g => rows.filter(r => r.status === g), n = by('new').length + by('upd').length;
    const got = new Set(rows.map(r => r.kanji)), missing = forPrompt().filter(ch => !got.has(ch));
    box.hidden = false;
    box.innerHTML = `<h2><span class="n">3</span>${esc(t('add.step3'))}</h2>
      ${missing.length ? `<p class="warn">${esc(t('add.missing', { list: missing.join(' ') }))}</p>` : ''}
      ${GROUPS.map(g => {
        const list = by(g); if (!list.length) return '';
        return `<div class="grp g-${g}"><h3>${esc(t('add.grp.' + g))} <span class="num">${list.length}</span></h3>
          ${g === 'upd' ? `<p class="hint">${esc(t('add.keepsProgress'))}</p>` : ''}
          <ul class="rows">${list.map(row).join('')}</ul></div>`;
      }).join('')}
      <div class="row">${n
        ? `<button type="button" class="btn primary" data-act="apply">${esc(t('add.apply', { n }))}</button>`
        : `<p class="hint">${esc(t('add.nothing'))}</p>`}</div>`;
  }
  return { nav: 'add', render };
})();
