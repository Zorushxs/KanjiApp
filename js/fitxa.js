// Fitxa d'un kanji o d'una paraula: significats, lectures amb veu, ordre de traços (kanji) o kanji que la
// formen (paraula), exemples, mnemotècnia, etiquetes i verificació. Té un mode edició per corregir els textos.
const Fitxa = (() => {
  const { html } = U;
  const state = {
    current: null,    // kanji de la fitxa que es veu
    prev: null,       // fitxa anterior i següent de la llista (per a les fletxes i per lliscar)
    next: null,
    enter: '',        // després de lliscar: per quin costat entra la fitxa nova ('right' o 'left')
    editing: null,    // kanji de la fitxa en mode edició, o null
    picks: [],        // en editar: lectures principals triades (màx. 2), en ordre
    picksStart: '',   // les que hi havia en començar a editar (per saber si n'has canviat)
  };
  let paintVerification = null; // repinta la verificació de la fitxa que es veu (per a les tecles V i E)
  window.addEventListener('hashchange', () => { state.editing = null; }); // en anar a una altra pantalla es deixa d'editar

  function render(root, arg) {
    const card = Store.get(arg);
    if (!card) {
      root.innerHTML = html`<div class="empty"><p>${t('card.notFound')}</p><a class="btn" href="#/">${t('card.back')}</a></div>`;
      state.prev = state.next = null;
      return;
    }
    state.current = card.kanji;
    paintVerification = null;
    // L'anterior i la següent, dins de la llista que es veu a l'inici (amb la cerca i els filtres).
    let list = Inici.visible();
    if (!list.includes(card)) list = Store.kanji;
    const index = list.indexOf(card);
    state.prev = list[index - 1] || null;
    state.next = list[index + 1] || null;

    const editing = state.editing === card.kanji;
    root.innerHTML = html`${topBar(index + 1, list.length, editing)}${editing ? editSheet(card) : sheet(card)}`;
    U.onActions(root, actions(root, card));
    if (editing) {
      // En canviar les lectures, s'actualitzen les opcions de lectura principal.
      root.oninput = e => { if (/^(onyomi|kunyomi)$/.test(e.target.dataset.e || '')) paintMainChips(root); };
      return;
    }
    root.oninput = null;
    paintVerification = () => paintVerified(root, card);
    paintVerification();
    const strokes = root.querySelector('.so'); // només a les fitxes de kanji
    if (strokes) Traces.mount(strokes, card.kanji, card.strokes);
    if (state.enter) {
      root.querySelector('.sheet').classList.add('enter-' + state.enter);
      state.enter = '';
    }
    swipe(root);
  }

  // Què fa cada botó (data-act) de la fitxa, en mode normal i en mode edició.
  function actions(root, card) {
    const ch = card.kanji;
    return {
      go(link, e) { // fitxa anterior o següent, sense omplir l'historial
        e.preventDefault();
        App.replace(link.getAttribute('href'));
      },
      back(link, e) {
        e.preventDefault();
        App.back();
      },
      edit() {
        state.editing = ch;
        render(root, ch);
        root.querySelector('[data-e="meanings"]').focus();
      },
      cancel() {
        state.editing = null;
        render(root, ch);
      },
      save() {
        const result = saveEdit(root, card);
        if (!result) return;
        state.editing = null;
        render(root, ch);
        U.toast(t(result === 'same' ? 'card.noChanges' : 'card.saved'));
      },
      // Lectura principal (en editar): es tria o es treu; com a màxim dues, numerades per ordre.
      main(chip) {
        const value = chip.dataset.mainV, i = state.picks.indexOf(value);
        const full = i < 0 && state.picks.length >= 2;
        if (i >= 0) state.picks.splice(i, 1);
        else if (!full) state.picks.push(value);
        paintMainChips(root);
        root.querySelector('[data-main-max]').hidden = !full;
      },
      replay: () => Traces.play(root.querySelector('.so')),
      'so-retry': () => Traces.mount(root.querySelector('.so'), ch, card.strokes),
      verify() {
        Store.setVerified(ch, Card.nextVerified(card.verified));
        paintVerified(root, card);
      },
      delete() {
        if (!confirm(t('card.deleteConfirm', { k: ch }))) return;
        Store.remove(ch);
        U.toast(t('card.deleted', { k: ch }));
        App.back();
      },
    };
  }

  // ---------- Barra de dalt ----------
  function topBar(position, total, editing) {
    const arrow = (card, label, dir) => (card && !editing
      ? html`<a class="icon-btn" href="${Card.href(card.kanji)}" data-act="go" aria-label="${label}" title="${label}">${U.ICON[dir]}</a>`
      : html`<span class="icon-btn off" aria-hidden="true">${U.ICON[dir]}</span>`);
    return html`<div class="bar">
        <a class="btn ghost back" href="#/" data-act="back">${U.ICON.left}<span>${t('card.back')}</span></a>
        ${Peces.romajiBtn()}
        <span class="pos">${position} / ${total}</span>
        ${arrow(state.prev, t('card.prev'), 'left')}${arrow(state.next, t('card.next'), 'right')}
      </div>`;
  }

  // ---------- Fitxa (mode normal) ----------
  function sheet(card) {
    const word = Card.isWord(card.kanji);
    return html`<article class="sheet">
        <div class="col">
          ${heroPanel(card, word)}
          ${word ? wordKanjiPanel(card) : html`${readingsPanel(card)}${strokesPanel()}`}
        </div>
        <div class="col">
          ${mnemonicPanel(card)}
          ${examplesPanel(card)}
          ${sentencePanel(card)}
          ${foldPanel('origin', t('card.origin'), I18n.tr(card.origin))}
          ${foldPanel('trivia', t('card.trivia'), I18n.tr(card.trivia))}
          ${tagsPanel(card)}
          ${checkPanel(card, word)}
        </div>
      </article>`;
  }

  // El kanji gran, els significats, la lectura principal, les dades (JLPT, traços, caixa…) i les estadístiques.
  function heroPanel(card, word) {
    const progress = Store.prog(card.kanji), mains = Card.mains(card);
    const listen = card.reading
      ? Peces.say(mains.join('、'), t('card.listenMain'))
      : Peces.say(Card.readingsToSay(card), t('card.listenReadings'));
    const mainLabel = word ? 'card.wordReading' : mains.length > 1 ? 'card.mains' : 'card.main';
    const status = progress ? t('card.box', { box: progress.box, date: U.fmtDate(progress.due) }) : t('card.new');
    return html`<section class="panel hero">
        ${listen}
        ${card.emoji ? html`<span class="emoji" aria-hidden="true">${card.emoji}</span>` : ''}
        <div class="hero-k${Card.sizeClass(card.kanji)}" lang="ja">${card.kanji}</div>
        <h1 class="means">${I18n.list(card.meanings).join(' · ')}</h1>
        ${card.reading ? html`<p class="main-r"><small>${t(mainLabel)}</small> ${Peces.mainHtml(card)}</p>` : ''}
        <div class="facts">
          ${word ? html`<span class="pill">${t('card.word')}</span>` : ''}
          ${card.jlpt ? html`<span class="pill">N${card.jlpt}</span>` : ''}
          ${card.strokes ? html`<span class="pill">${t('card.strokes', { n: card.strokes })}</span>` : ''}
          <span class="pill">${status}</span>
          ${card.edited ? html`<span class="pill">✎ ${t('card.edited')}</span>` : ''}
          <span class="pill" data-ver-pill hidden></span>
        </div>
        ${progress ? html`<p class="stats">${t('card.stats', { seen: progress.seen, fails: progress.fails })}</p>` : ''}
      </section>`;
  }

  // On'yomi i kun'yomi, cada un amb el seu rōmaji i la seva veu; la principal, destacada.
  function readingsPanel(card) {
    const row = (label, hint, readings, format) => html`<div class="rd">
        <span class="rd-l">${label} <small>${hint}</small></span>
        <span class="rd-v" lang="ja">${readings.length
          ? Peces.readingList(card, readings, { format, separator: html`<span class="sep">、</span>`, title: t('card.mainHint') })
          : t('card.none')}</span>
        ${readings.length ? html`<span class="rd-ro">${Peces.roList(readings)}</span>` : ''}
        ${Peces.say(readings.map(Card.plain).join('、'))}</div>`;
    return html`<section class="panel">
        <h2>${t('card.readings')}</h2>
        ${row(t('card.on'), t('card.onHint'), card.onyomi)}
        ${row(t('card.kun'), t('card.kunHint'), card.kunyomi, Peces.kun)}
      </section>`;
  }

  // L'ordre de traços es pinta després (Traces.mount), quan ja hi ha el contenidor .so.
  function strokesPanel() {
    return html`<section class="panel strokes">
        <h2>${t('card.strokeOrder')}<button type="button" class="icon-btn" data-act="replay"
          title="${t('card.replay')}" aria-label="${t('card.replay')}">${U.ICON.replay}</button></h2>
        <div class="so" data-act="replay"></div>
        <p class="credit">${t('card.soCredit')} <a href="https://kanjivg.tagaini.net" target="_blank" rel="noopener">KanjiVG</a>
          · © Ulrich Apel · <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a></p>
      </section>`;
  }

  // Paraules: en lloc de lectures i traços, els kanji que la formen (enllaçats si els tens).
  function wordKanjiPanel(card) {
    const kanji = [...new Set(card.kanji.match(/\p{Script=Han}/gu) || [])];
    const part = ch => {
      const own = Store.get(ch);
      const meaning = own ? I18n.list(own.meanings)[0] || '' : t('card.notInCollection');
      const inner = html`<span lang="ja">${ch}</span><small>${meaning}</small>`;
      return own ? html`<a class="kpart" href="${Card.href(ch)}">${inner}</a>` : html`<span class="kpart off">${inner}</span>`;
    };
    return html`<section class="panel"><h2>${t('card.wordKanji')}</h2>${kanji.length
      ? html`<div class="kparts">${kanji.map(part)}</div>`
      : html`<p class="hint">${t('card.kanaOnly')}</p>`}</section>`;
  }

  function mnemonicPanel(card) {
    const text = I18n.tr(card.mnemonic);
    if (!text) return '';
    return html`<section class="panel mnemo"><h2>${t('card.mnemonic')}</h2><p>${text}</p></section>`;
  }

  function examplesPanel(card) {
    if (!card.examples.length) return '';
    const item = e => html`<li>
        <span class="ex-w" lang="ja">${Peces.mark(e.word, card.kanji)}</span><span
          class="ex-r"><span lang="ja">${e.reading}</span> ${Peces.ro(e.reading)}</span>
        <span class="ex-m">${I18n.tr(e.meaning)}</span>${Peces.say(e.reading)}</li>`;
    return html`<section class="panel"><h2>${t('card.examples')}</h2><ul class="ex">${card.examples.map(item)}</ul></section>`;
  }

  function sentencePanel(card) {
    const s = card.sentence;
    if (!s.jp) return '';
    return html`<section class="panel"><h2>${t('card.sentence')}${Peces.say(s.reading || s.jp)}</h2>
        <p class="sent-jp" lang="ja">${Peces.mark(s.jp, card.kanji)}</p>
        ${s.reading ? html`<p class="sent-r" lang="ja">${s.reading}</p>` : ''}
        ${s.romaji ? html`<p class="sent-ro ro" lang="ja-Latn">${s.romaji}</p>` : ''}<p class="sent-m">${I18n.tr(s.meaning)}</p></section>`;
  }

  // Text llarg plegat (origen i curiositat). data-fold: App el manté obert si es torna a pintar la pantalla.
  function foldPanel(id, title, text) {
    if (!text) return '';
    return html`<details class="panel fold" data-fold="${id}"><summary>${title}</summary><p>${text}</p></details>`;
  }

  // Etiquetes de la fitxa, amb el camí (Temps › Mesos). «Canviar» porta a la pantalla d'etiquetes, on es
  // gestionen totes (aquí la llista es faria massa llarga).
  function tagsPanel(card) {
    const own = Store.cardTags(card.kanji);
    const tags = Store.tagTree().filter(item => own.includes(item.tag.id));
    return html`<section class="panel card-tags">
        <h2>${t('tags.title')}<a class="btn small" href="#/etiquetes">${t('tags.change')}</a></h2>
        ${tags.length
          ? html`<div class="card-tag-list">${tags.map(item => html`<span class="pill">${Store.tagLabel(item.tag.id)}</span>`)}</div>`
          : html`<p class="hint">${t('tags.cardNone')}</p>`}
      </section>`;
  }

  // Verificació, editar, Jisho, regenerar i esborrar.
  function checkPanel(card, word) {
    const regenerate = '#/afegir/' + encodeURIComponent(word ? '「' + card.kanji + '」' : card.kanji);
    return html`<section class="panel check">
        <h2>${t('card.check')}</h2>
        <button type="button" class="btn ver" data-act="verify"></button>
        <p class="hint">${t('ver.hint')}</p>
        <p class="keys">${t('ver.keys')}</p>
        <div class="row">
          <button type="button" class="btn" data-act="edit">✎ ${t('card.edit')}</button>
          <a class="btn" href="${Card.jisho(card.kanji)}" target="_blank" rel="noopener">${t('card.jisho')} ↗</a>
          <a class="btn" href="${regenerate}">${t('card.regen')}</a>
          <button type="button" class="btn danger" data-act="delete">${t('card.delete')}</button>
        </div>
      </section>`;
  }

  // Botó de verificació de tres estats i la pastilla de dalt (que no surt mentre està per verificar).
  function paintVerified(root, card) {
    const ver = Card.verState(card.verified), label = `${ver.icon} ${t(ver.key)}`;
    const button = root.querySelector('[data-act="verify"]'), pill = root.querySelector('[data-ver-pill]');
    button.className = `btn ver ver-${ver.cls}`;
    button.textContent = label;
    button.setAttribute('aria-label', t('ver.label', { s: t(ver.key) }));
    pill.className = `pill ver-${ver.cls}`;
    pill.textContent = label;
    pill.hidden = ver.cls === 'pending';
  }

  // ---------- Mode edició ----------
  // Es corregeixen els textos de l'idioma de la interfície (els altres no es toquen) i es tria la lectura principal.
  const field = (label, input, hint = '') =>
    html`<label class="efld"><span>${label}</span>${input}${hint ? html`<small>${hint}</small>` : ''}</label>`;
  const input = (key, value, attrs = '') => html`<input data-e="${key}" value="${value}" autocomplete="off" ${attrs}>`;
  const textarea = (key, value, placeholder) => html`<textarea data-e="${key}" rows="3" placeholder="${placeholder}">${value}</textarea>`;
  const splitList = text => String(text).split(/[,、，;]/).map(x => x.trim()).filter(Boolean);

  // Una opció per cada lectura (ニチ, た.べる…) amb el valor que es desa com a principal (にち, たべる).
  function mainOptions(onyomi, kunyomi) {
    const seen = new Set();
    return [...onyomi, ...kunyomi]
      .map(reading => ({ reading, value: U.hira(Card.plain(reading)) }))
      .filter(o => o.value && !seen.has(o.value) && seen.add(o.value));
  }
  // Botons de lectura principal: premut = triada; el número diu si és la 1a o la 2a.
  const mainChips = options => options.map(o => {
    const n = state.picks.indexOf(o.value) + 1;
    return html`<button type="button" class="mchip" data-act="main" data-main-v="${o.value}"
      aria-pressed="${n > 0}"><span lang="ja">${o.reading}</span>${n ? html`<b>${n}</b>` : ''}</button>`;
  });
  // Si canvies les lectures, les opcions es refan i les triades que ja no hi són es treuen.
  function paintMainChips(root) {
    const value = key => root.querySelector(`[data-e="${key}"]`).value;
    const options = mainOptions(splitList(value('onyomi')), splitList(value('kunyomi')));
    state.picks = state.picks.filter(v => options.some(o => o.value === v));
    root.querySelector('[data-main]').innerHTML = html`${mainChips(options)}`;
  }

  function editSheet(card) {
    const lang = I18n.lang, word = Card.isWord(card.kanji);
    // El text en aquest idioma; si és buit, el d'un altre idioma surt de pista (placeholder).
    const own = texts => (texts && texts[lang]) || '';
    const hintFor = texts => (own(texts) ? '' : I18n.tr(texts));
    const options = word ? [] : mainOptions(card.onyomi, card.kunyomi);
    // Les lectures principals que ja té (una o dues), com a opcions: にち, o た per た.べる.
    const optionFor = reading => options.find(o => o.value === reading || U.hira(Card.stem(o.reading)) === reading);
    state.picks = Card.mains(card).map(optionFor).filter(Boolean).map(o => o.value);
    state.picksStart = JSON.stringify(state.picks);

    const s = card.sentence;
    const jlpt = html`<select data-e="jlpt"><option value="">${t('home.noLevel')}</option>${[5, 4, 3, 2, 1].map(n =>
      html`<option value="${n}"${card.jlpt === n ? html` selected` : ''}>N${n}</option>`)}</select>`;
    const saveBtn = html`<button type="button" class="btn primary" data-act="save">✓ ${t('card.save')}</button>`;
    const cancelBtn = html`<button type="button" class="btn" data-act="cancel">${t('card.cancel')}</button>`;
    const example = (e, i) => html`<div class="eex">
        ${field(t('card.exWord'), input(`ex.${i}.word`, e.word, html`lang="ja"`))}
        ${field(t('card.exReading'), input(`ex.${i}.reading`, e.reading, html`lang="ja"`))}
        ${field(t('card.exMeaning'), input(`ex.${i}.meaning`, own(e.meaning), html`placeholder="${hintFor(e.meaning)}"`))}</div>`;

    return html`<article class="sheet editing">
      <p class="edit-note">${t('card.editing', { lang: I18n.name(lang) })}</p>
      <div class="edit-errors" role="alert" hidden></div>
      <div class="col">
        <section class="panel hero">
          <div class="hero-k${Card.sizeClass(card.kanji)}" lang="ja">${card.kanji}</div>
          ${field(t('card.meanings'), input('meanings', (card.meanings[lang] || []).join(', '),
            html`placeholder="${I18n.list(card.meanings).join(', ')}"`), t('card.listHint'))}
          ${word ? html`${field(t('card.wordReading'), input('reading', card.reading, html`lang="ja"`))}
            ${field(t('card.wordReading2'), input('reading2', card.reading2, html`lang="ja"`))}` : ''}
          <div class="erow">
            ${field('Emoji', input('emoji', card.emoji))}
            ${field('JLPT', jlpt)}
            ${word ? '' : field(t('card.strokesLabel'), input('strokes', card.strokes || '', html`inputmode="numeric"`))}
          </div>
        </section>
        ${word ? '' : html`<section class="panel">
          <h2>${t('card.readings')}</h2>
          ${field(t('card.on'), input('onyomi', card.onyomi.join(', '), html`lang="ja"`), t('card.listHint'))}
          ${field(t('card.kun'), input('kunyomi', card.kunyomi.join(', '), html`lang="ja"`), t('card.listHint'))}
          <fieldset class="main-pick"><legend>${t('card.mainPick')}</legend><div class="mchips" data-main>${mainChips(options)}</div>
            <p class="warn" data-main-max hidden>${t('card.mainMax')}</p></fieldset>
        </section>`}
      </div>
      <div class="col">
        <section class="panel mnemo"><h2>${t('card.mnemonic')}</h2>${textarea('mnemonic', own(card.mnemonic), hintFor(card.mnemonic))}</section>
        ${card.examples.length ? html`<section class="panel"><h2>${t('card.examples')}</h2>${card.examples.map(example)}
          <p class="hint">${t('card.exDeleteHint')}</p></section>` : ''}
        <section class="panel"><h2>${t('card.sentence')}</h2>
          ${field(t('card.sentJp'), input('s.jp', s.jp, html`lang="ja"`))}
          ${field(t('card.sentReading'), input('s.reading', s.reading, html`lang="ja"`))}
          ${field(t('home.showRomaji'), input('s.romaji', s.romaji))}
          ${field(t('card.sentMeaning'), input('s.meaning', own(s.meaning), html`placeholder="${hintFor(s.meaning)}"`))}
        </section>
        <section class="panel"><h2>${t('card.origin')}</h2>${textarea('origin', own(card.origin), hintFor(card.origin))}</section>
        <section class="panel"><h2>${t('card.trivia')}</h2>${textarea('trivia', own(card.trivia), hintFor(card.trivia))}</section>
        <section class="panel check"><div class="row">${saveBtn}${cancelBtn}</div></section>
      </div>
    </article>
    <div class="edit-bar" role="toolbar" aria-label="${t('card.editingShort')}"><span>✎ ${t('card.editingShort')}</span>${[
      cancelBtn,
      saveBtn,
    ]}</div>`;
  }

  // Avisos de Validar.check que, si els escrius tu, són errors (no es desa res a mitges).
  const HARD = {
    'val.example': 'card.exInvalid',
    'val.emoji': 'card.emojiInvalid',
    'val.romaji': 'card.romajiInvalid',
    'val.sentenceReading': 'val.sentenceReading',
    'val.readingNotListed': 'card.mainMissing',
  };

  // Desa les correccions. Torna false si hi ha errors (es mostren a dalt), 'same' si no has canviat res, o true.
  function saveEdit(root, card) {
    const value = key => {
      const el = root.querySelector(`[data-e="${key}"]`);
      return el ? el.value.trim() : '';
    };
    const lang = I18n.lang, word = Card.isWord(card.kanji);
    const edited = JSON.parse(JSON.stringify(card)); // còpia que s'omple amb el formulari

    edited.meanings[lang] = splitList(value('meanings'));
    edited.emoji = value('emoji');
    edited.jlpt = value('jlpt') ? +value('jlpt') : null;
    if (word) {
      edited.reading = value('reading');
    } else {
      edited.onyomi = splitList(value('onyomi'));
      edited.kunyomi = splitList(value('kunyomi'));
      edited.strokes = value('strokes') ? +value('strokes') : null;
    }
    edited.mnemonic[lang] = value('mnemonic');
    edited.origin[lang] = value('origin');
    edited.trivia[lang] = value('trivia');
    edited.examples = edited.examples
      .map((e, i) => ({
        ...e,
        word: value(`ex.${i}.word`),
        reading: value(`ex.${i}.reading`),
        meaning: { ...e.meaning, [lang]: value(`ex.${i}.meaning`) },
      }))
      .filter(e => e.word || e.reading); // buidar la paraula i la lectura = treure l'exemple
    edited.sentence = {
      ...edited.sentence,
      jp: value('s.jp'),
      reading: value('s.reading'),
      romaji: value('s.romaji'),
      meaning: { ...edited.sentence.meaning, [lang]: value('s.meaning') },
    };

    // Lectures principals: d'un kanji, les que has triat (una o dues); d'una paraula, els dos camps de text.
    const mainChanged = !word && JSON.stringify(state.picks) !== state.picksStart;
    const extraErrors = [];
    if (mainChanged && !state.picks.length) extraErrors.push(t('card.mainNone'));
    if (mainChanged && state.picks.length) edited.reading = state.picks[0];
    if (word && value('reading2') && !Validar.isKana(value('reading2'))) extraErrors.push(t('card.reading2Invalid'));

    const checked = Validar.check(edited);
    const errors = [
      ...extraErrors,
      ...checked.errors.map(x => t(x.k, x.p)),
      ...checked.warnings.filter(w => HARD[w.k]).map(w => t(HARD[w.k], w.p)),
    ];
    if (errors.length) {
      showErrors(root, errors);
      return false;
    }

    const item = checked.item;
    // check() buida la segona lectura principal, perquè només la poses tu: es torna a posar.
    item.reading2 = word ? value('reading2') : mainChanged ? state.picks[1] || '' : card.reading2;
    // «Corregida» només si has canviat algun text (no només les lectures principals d'un kanji).
    const keep = { verified: card.verified, edited: card.edited, mainByUser: card.mainByUser };
    const ignoreMains = word ? {} : { reading: card.reading, reading2: card.reading2 };
    const textChanged = JSON.stringify({ ...item, ...keep, ...ignoreMains }) !== JSON.stringify(card);
    if (!textChanged && !mainChanged) return 'same';
    Object.assign(item, keep, {
      edited: card.edited || textChanged,
      mainByUser: card.mainByUser || mainChanged || (word && !!item.reading2),
    });
    Store.update(card.kanji, item);
    return true;
  }
  function showErrors(root, errors) {
    const box = root.querySelector('.edit-errors');
    box.hidden = false;
    box.innerHTML = html`<p>${t('card.editErrors')}</p><ul>${errors.map(x => html`<li>${x}</li>`)}</ul>`;
    box.scrollIntoView({ block: 'center' });
  }

  // ---------- Lliscar (pantalles tàctils) ----------
  // Cap a l'esquerra, la fitxa següent; cap a la dreta, l'anterior. La fitxa segueix el dit; si no arribes prou
  // lluny, torna al seu lloc, i a la primera i l'última fa resistència. Només compten els gestos clarament
  // horitzontals (el desplaçament vertical va com sempre) i no els que comencen a la vora, que són el gest
  // d'«enrere» del mòbil. A l'ordinador no fa res.
  function swipe(root) {
    const sheetEl = root.querySelector('.sheet');
    if (!sheetEl || !matchMedia('(pointer: coarse)').matches) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches, EDGE = 24;
    let x0 = 0, y0 = 0, dx = 0;
    let mode = 'y'; // '' (encara no se sap) · 'x' (lliscant) · 'y' (ignorat)
    const reset = () => {
      sheetEl.style.transition = 'transform .18s ease-out';
      sheetEl.style.transform = '';
      mode = 'y';
    };
    sheetEl.addEventListener('touchstart', e => {
      const touch = e.touches[0];
      if (e.touches.length > 1 || touch.clientX < EDGE || touch.clientX > innerWidth - EDGE) {
        mode = 'y';
        return;
      }
      x0 = touch.clientX;
      y0 = touch.clientY;
      dx = 0;
      mode = '';
      sheetEl.style.transition = 'none';
    }, { passive: true });
    sheetEl.addEventListener('touchmove', e => {
      if (mode === 'y') return;
      const touch = e.touches[0], mx = touch.clientX - x0, my = touch.clientY - y0;
      if (!mode) {
        if (Math.abs(mx) < 10 && Math.abs(my) < 10) return;
        mode = Math.abs(mx) > Math.abs(my) * 1.2 ? 'x' : 'y';
        if (mode === 'y') return;
      }
      dx = mx;
      const stuck = (dx < 0 && !state.next) || (dx > 0 && !state.prev); // no n'hi ha cap més per aquest costat
      if (!still) sheetEl.style.transform = `translateX(${stuck ? dx * 0.25 : dx}px)`;
    }, { passive: true });
    sheetEl.addEventListener('touchend', () => {
      if (mode !== 'x') return;
      const target = dx < 0 ? state.next : state.prev, width = root.clientWidth || innerWidth;
      if (!target || Math.abs(dx) < Math.min(90, width * 0.22)) {
        reset();
        return;
      }
      state.enter = dx < 0 ? 'right' : 'left';
      mode = 'y';
      if (still) {
        App.replace(Card.href(target.kanji));
        return;
      }
      sheetEl.style.transition = 'transform .17s ease-in';
      sheetEl.style.transform = `translateX(${dx < 0 ? -width : width}px)`;
      setTimeout(() => App.replace(Card.href(target.kanji)), 170);
    });
    sheetEl.addEventListener('touchcancel', () => { if (mode === 'x') reset(); });
  }

  // ---------- Teclat (ordinador) ----------
  // ← → fitxa anterior i següent; V «Verificat» i E «Té errors» (si ja ho era, torna a «Per verificar»).
  // Amb la mà esquerra marques i amb la dreta passes de fitxa. Mentre edites, les tecles no fan res.
  function key(e) {
    if (state.editing) return;
    const letter = e.key.toLowerCase();
    const card = state.current && Store.get(state.current);
    if ((letter === 'v' || letter === 'e') && card) {
      e.preventDefault();
      const wanted = letter === 'v' ? true : 'error';
      Store.setVerified(card.kanji, card.verified === wanted ? false : wanted);
      if (paintVerification) paintVerification();
      U.toast(`${card.kanji} · ${t(Card.verState(card.verified).key)}`);
      return;
    }
    const target = e.key === 'ArrowLeft' ? state.prev : e.key === 'ArrowRight' ? state.next : null;
    if (target) {
      e.preventDefault();
      App.replace(Card.href(target.kanji));
    }
  }

  return { nav: 'home', render, key };
})();
