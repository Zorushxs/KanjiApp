// Afegir kanji en tres passos: copiar el prompt → Claude.ai → enganxar la resposta, revisar-la i desar-la.
// Pas 1, dues maneres: escriure tu els kanji ('own') o que Claude en triï de nous que no tinguis ('more').
const Afegir = (() => {
  const { html } = U;
  const GROUPS = ['new', 'upd', 'same', 'have', 'err']; // ordre dels grups a la previsualització
  const saved = Prefs.get('add') || {};
  const state = {
    mode: saved.mode === 'more' ? 'more' : 'own',
    // Pas 1, «Trio els kanjis»: el que escrius i els que ja tens però vols tornar a generar.
    input: '',
    regen: new Set(),
    // Pas 1, «Claude tria els kanjis»: quants (text del camp), temàtica i paraules concretes.
    count: '',
    theme: '',
    words: '',
    // Pas 2 i 3: la resposta enganxada i la seva revisió.
    paste: '',
    rows: null,    // files de Validar.review, o null si encara no n'hi ha
    note: '',      // text de Claude fora del JSON
    error: '',     // el JSON no es pot llegir
    done: '',      // missatge després de desar
    lastArg: '',   // l'argument de la ruta (#/afegir/日), per saber si véns de «Regenerar»
    timer: null,   // espera abans de revisar mentre enganxes o escrius
  };

  // Kanji sols (cada kanji que escriguis) i paraules senceres entre 「」 (「学校」, 「じゃがいも」).
  function pick(text) {
    const out = [];
    String(text).replace(/「([^」]*)」|\p{Script=Han}/gu, (match, word) => {
      const item = word === undefined ? match : word.trim();
      if (Validar.isCard(item) && !out.includes(item)) out.push(item);
      return '';
    });
    return out;
  }
  // Quants kanji de la temàtica (1-30). El camp és buit amb un 10 d'exemple: buit vol dir 10.
  const count = () => Math.min(30, Math.max(1, parseInt(state.count, 10) || 10));
  // Van al prompt els nous i els que ja tens només si els has marcat per regenerar.
  const forPrompt = () => pick(state.input).filter(ch => !Store.get(ch) || state.regen.has(ch));
  function promptText() {
    if (state.mode === 'own') return forPrompt().length ? Prompt.cards(forPrompt()) : '';
    const all = Store.kanji.map(card => card.kanji);
    return Prompt.more({
      have: all.filter(x => !Card.isWord(x)),
      haveWords: all.filter(Card.isWord),
      n: count(),
      theme: state.theme,
      words: state.words,
    });
  }
  // Els kanji o paraules que has demanat i que no són a la resposta (p. ex. perquè s'ha tallat).
  function missingList() {
    if (state.mode !== 'own' || !state.rows) return [];
    return forPrompt().filter(ch => !state.rows.some(row => row.kanji === ch));
  }

  // ---------- Pintar ----------
  function render(root, arg) {
    if (arg && arg !== state.lastArg) startRegenerate(arg);
    state.lastArg = arg || '';
    root.innerHTML = html`
      <h1 class="h">${t('add.title')}</h1>
      ${step1()}
      <section class="panel step">
        <h2><span class="n">2</span>${t('add.step2')}</h2>
        <p class="hint">${t('add.step2Hint')}</p>
        <textarea class="paste" rows="7" placeholder="${t('add.pastePh')}" aria-label="${t('add.pasteLabel')}"
          spellcheck="false">${state.paste}</textarea>
        <div class="row"><button type="button" class="btn" data-act="review">${t('add.review')}</button></div>
        <p class="err" role="alert"></p>
      </section>
      <section class="panel step result" hidden></section>`;
    const $ = selector => root.querySelector(selector);
    const repaint = () => { paintPicked($); paintResult($); };
    repaint();
    bindInputs($, repaint);

    root.onchange = e => {
      if (e.target.name !== 'amode') return;
      state.mode = e.target.value;
      Prefs.set('add', { mode: state.mode });
      $('.mode-own').hidden = $('.pview').hidden = state.mode !== 'own';
      $('.mode-more').hidden = state.mode !== 'more';
      paintPicked($);
      if (state.rows) {
        runReview();
        paintResult($);
      }
    };
    U.onActions(root, {
      // Xip d'un kanji que ja tens: entra o surt del prompt (per regenerar-lo).
      regen(chip) {
        const ch = chip.dataset.ch;
        if (state.regen.has(ch)) state.regen.delete(ch);
        else state.regen.add(ch);
        repaint();
      },
      copy: () => copy($),
      'copy-missing': () => clip($, Prompt.cards(missingList())),
      review() {
        clearTimeout(state.timer);
        runReview();
        paintResult($);
      },
      apply() {
        const toSave = state.rows.filter(row => row.status === 'new' || row.status === 'upd').map(row => row.item);
        const result = Store.merge(toSave);
        Object.assign(state, { input: '', paste: '', rows: null, error: '', regen: new Set(), theme: '', words: '' });
        state.done = t('add.applied', { a: result.added, u: result.updated });
        U.toast(state.done);
        render(root, state.lastArg);
      },
    });
  }

  // Véns de «Regenerar» d'una fitxa (#/afegir/日): el kanji ja és al camp i marcat per regenerar.
  function startRegenerate(arg) {
    Object.assign(state, { mode: 'own', input: arg, regen: new Set(pick(arg)), paste: '', rows: null, error: '', done: '' });
  }

  function step1() {
    const mode = state.mode, have = Store.kanji.length;
    const radio = (value, label) => html`<label><input type="radio" name="amode" value="${value}"
      ${mode === value ? html` checked` : ''}><span>${label}</span></label>`;
    const hidden = on => (on ? '' : html` hidden`);
    return html`<section class="panel step">
        <h2><span class="n">1</span>${t('add.step1')}</h2>
        <div class="seg" role="radiogroup" aria-label="${t('add.modeLabel')}">${[
          radio('own', t('add.modeOwn')),
          radio('more', t('add.modeMore')),
        ]}</div>
        <div class="mode-own"${hidden(mode === 'own')}>
          <p class="hint">${t('add.step1Hint')}</p>
          <input class="kin" lang="ja" value="${state.input}" placeholder="${t('add.inputPh')}" aria-label="${t('add.inputLabel')}"
            autocomplete="off" autocapitalize="off" spellcheck="false">
          <div class="picked"></div>
        </div>
        <div class="mode-more"${hidden(mode === 'more')}>
          <p class="hint">${have ? t('add.moreHint', { n: have }) : t('add.moreHint0')}</p>
          <div class="fields">
            <label class="fld"><span>${t('add.theme')}</span><input class="more-theme" value="${state.theme}"
              placeholder="${t('add.themePh')}" autocomplete="off"></label>
            <label class="fld"><span>${t('add.howMany')}</span><input class="more-n" type="text" inputmode="numeric"
              pattern="[0-9]*" maxlength="2" autocomplete="off" value="${state.count}" placeholder="10"></label>
            <label class="fld wide"><span>${t('add.words')}</span><input class="more-words" value="${state.words}"
              placeholder="${t('add.wordsPh')}" autocomplete="off">
              <small class="hint">${t('add.wordsHint')}</small></label>
          </div>
        </div>
        <div class="row">
          <button type="button" class="btn primary" data-act="copy">${t('add.copy')}</button>
          <a class="btn" href="https://claude.ai/new" target="_blank" rel="noopener">${t('add.openClaude')} ↗</a>
        </div>
        <details class="pview" data-fold="prompt"${hidden(mode === 'own')}><summary>${t('add.showPrompt')}</summary>
          <textarea class="ptext" rows="12" readonly aria-label="Prompt"></textarea></details>
      </section>`;
  }

  // Cada camp desa el que escrius a state (per no perdre-ho si la pantalla es torna a pintar).
  function bindInputs($, repaint) {
    $('.kin').oninput = e => {
      state.input = e.target.value;
      repaint();
    };
    // Camp de text (sense fletxetes) amb teclat numèric: només s'hi queden les xifres.
    $('.more-n').oninput = e => {
      e.target.value = e.target.value.replace(/\D/g, '');
      state.count = e.target.value;
    };
    $('.more-theme').oninput = e => { state.theme = e.target.value; };
    $('.more-words').oninput = e => { state.words = e.target.value; };
    // La resposta es revisa sola quan deixes d'escriure o d'enganxar.
    $('.paste').oninput = e => {
      state.paste = e.target.value;
      state.done = '';
      clearTimeout(state.timer);
      state.timer = setTimeout(() => {
        runReview();
        paintResult($);
      }, 350);
    };
  }

  // ---------- Pas 1: kanji triats i prompt ----------
  // Xips: els nous, fixos; els que ja tens, en gris i tocables per incloure'ls (regenerar) o treure'ls.
  function chip(ch) {
    if (!Store.get(ch)) return html`<span class="kchip" lang="ja">${ch}</span>`;
    const on = state.regen.has(ch);
    return html`<button type="button" class="kchip ${on ? 'regen' : 'has'}" lang="ja" data-act="regen" data-ch="${ch}"
      aria-pressed="${on}" title="${t(on ? 'add.regenChip' : 'add.exists')}">${ch}${on ? ' ↻' : ''}</button>`;
  }
  function paintPicked($) {
    const picked = pick(state.input), inPrompt = forPrompt();
    const hasSome = picked.some(ch => Store.get(ch));
    $('.picked').innerHTML = html`${picked.map(chip)}
      ${hasSome ? html`<p class="hint">${inPrompt.length ? t('add.existsLegend') : t('add.allExist')}</p>` : ''}
      ${hasSome && inPrompt.length ? html`<p class="hint"><b>${t('add.inPrompt', { n: inPrompt.length })}</b></p>` : ''}`;
    $('.ptext').value = state.mode === 'own' ? promptText() : '';
  }
  function copy($) {
    if (state.mode === 'own') {
      if (!pick(state.input).length) {
        U.toast(t('add.none'), 'warn');
        $('.kin').focus();
        return;
      }
      if (!forPrompt().length) {
        U.toast(t('add.allExist'), 'warn');
        return;
      }
    }
    clip($, promptText());
  }
  async function clip($, text) {
    try {
      await navigator.clipboard.writeText(text);
      U.toast(t('add.copied'));
    } catch { // sense permís de porta-retalls: ensenya el prompt perquè el copiïs a mà
      const details = $('.pview'), textarea = $('.ptext');
      textarea.value = text;
      details.hidden = false;
      details.open = true;
      textarea.focus();
      textarea.select();
      U.toast(t('add.copyFail'), 'warn');
    }
  }

  // ---------- Pas 3: revisió ----------
  // Si Claude tria els kanji i en torna algun que ja tens, no es toca (grup 'have').
  function runReview() {
    Object.assign(state, { rows: null, note: '', error: '' });
    if (!state.paste.trim()) return;
    try {
      state.rows = Validar.review(state.paste, Store.get);
      state.note = Validar.note(state.paste);
      if (state.mode === 'more') {
        state.rows.forEach(row => { if (row.status === 'upd' || row.status === 'same') row.status = 'have'; });
      }
    } catch (e) {
      state.error = e.message;
    }
  }

  // Una fila de la previsualització: kanji, significats, lectura principal, errors i avisos.
  function resultRow(row) {
    const messages = [
      ...row.errors.map(x => html`<li class="e">${t(x.k, x.p)}</li>`),
      ...row.warnings.map(x => html`<li class="w">${t(x.k, x.p)}</li>`),
    ];
    const meanings = row.item ? I18n.list(row.item.meanings).join(', ') : '';
    const reading = row.item && row.item.reading
      ? html` · <span lang="ja">${row.item.reading}</span> ${Peces.ro(row.item.reading)}` : '';
    return html`<li><span class="rk" lang="ja">${row.kanji || '?'}</span><span class="rm">${meanings}${reading}</span>${messages.length
      ? html`<ul class="msgs">${messages}</ul>` : ''}</li>`;
  }

  function paintResult($) {
    $('.err').textContent = state.error;
    const box = $('.result'), rows = state.rows;
    if (state.done && !rows) {
      box.hidden = false;
      box.innerHTML = html`<p class="ok-line">✓ ${state.done}</p><a class="btn" href="#/">${t('add.goHome')}</a>`;
      return;
    }
    if (!rows) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    const byStatus = status => rows.filter(row => row.status === status);
    const toSave = byStatus('new').length + byStatus('upd').length;
    const missing = missingList(), complete = rows.filter(row => row.item).length;
    const group = status => {
      const list = byStatus(status);
      if (!list.length) return '';
      return html`<div class="grp g-${status}"><h3>${t('add.grp.' + status)} <span class="num">${list.length}</span></h3>
          ${status === 'upd' ? html`<p class="hint">${t('add.keepsProgress')}</p>` : ''}
          <ul class="rows">${list.map(resultRow)}</ul></div>`;
    };
    box.hidden = false;
    box.innerHTML = html`<h2><span class="n">3</span>${t('add.step3')}</h2>
      ${state.note ? html`<p class="note"><b>${t('add.note')}:</b> ${state.note}</p>` : ''}
      ${rows.partial ? html`<p class="warn">${t('add.partial', { n: complete })}</p>` : ''}
      ${missing.length ? html`<div class="missing"><p class="warn">${t('add.missing', { list: missing.join(' ') })}</p>
        <button type="button" class="btn small" data-act="copy-missing">${t('add.copyMissing')}</button></div>` : ''}
      ${GROUPS.map(group)}
      <div class="row">${toSave
        ? html`<button type="button" class="btn primary" data-act="apply">${t('add.apply', { n: toSave })}</button>`
        : html`<p class="hint">${t('add.nothing')}</p>`}</div>`;
  }

  return { nav: 'add', render };
})();
