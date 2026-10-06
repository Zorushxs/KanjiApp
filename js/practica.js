// Pràctica amb repetició espaiada (sistema Leitner de 5 caixes). Les caixes i els dies són a store.js.
// Dues pantalles: la preparació (#/practica) i la sessió (#/practica/sessio), que acaba amb un resum.
const Practica = (() => {
  const { html } = U;
  const MODES = ['k2m', 'm2k']; // kanji → significat/lectura · significat → kanji
  const SIZES = [10, 15, 20];
  const GRADES = ['no', 'yes', 'doubt']; // ordre a la pantalla i tecles 1-2-3
  const KINDS = ['all', 'kanji', 'word'];

  // Opcions de la preparació, recordades en aquest navegador.
  const saved = Prefs.get('practice') || {};
  const options = {
    mode: MODES.includes(saved.mode) ? saved.mode : 'k2m',
    size: SIZES.includes(saved.size) ? saved.size : 15,
    level: typeof saved.level === 'string' ? saved.level : 'all',
    kind: KINDS.includes(saved.kind) ? saved.kind : 'all',
    again: saved.again === true, // tornar a practicar les d'avui
  };
  const saveOptions = () => Prefs.set('practice', options);

  // Sessió en curs, o null:
  // { free, mode, queue: [{ ch, rep }], i, flipped, res: { no, yes, doubt }, failed: [ch], done }
  // free: repàs lliure (no desa res) · rep: segona passada d'una fallada · i: posició a la cua.
  let session = null, root = null, screen = 'setup';
  let openBox = null; // la caixa oberta a la preparació (se'n veuen les fitxes), o null

  // Les fitxes que entren segons els filtres de nivell i de tipus.
  const pool = () => Store.kanji.filter(card =>
    (options.level === 'all' || Card.level(card) === options.level)
    && (options.kind === 'all' || Card.kind(card) === options.kind));
  const boxOf = ch => { const progress = Store.prog(ch); return progress ? progress.box : 0; };
  const daysText = n => (n === 1 ? t('date.tomorrow') : t('pr.days', { n }));

  function render(screenRoot, arg) {
    root = screenRoot;
    if (arg === 'sessio') {
      if (!session) { // p. ex. després de recarregar la pàgina
        App.replace('#/practica');
        return;
      }
      screen = 'session';
      if (session.done) summary();
      else paintCard();
      return;
    }
    screen = 'setup';
    setup();
  }

  // ---------- Preparació ----------
  function setup() {
    const all = Store.kanji;
    if (!all.length) {
      root.innerHTML = html`<h1 class="h">${t('pr.title')}</h1><div class="empty"><p>${t('pr.empty')}</p>
        <a class="btn primary" href="#/afegir">${t('nav.add')}</a></div>`;
      return;
    }
    // Els filtres que ja no tenen sentit (cap fitxa d'aquell nivell, cap paraula) es treuen.
    const levels = Card.LEVELS.filter(lv => all.some(card => Card.level(card) === lv));
    const hasWords = all.some(card => Card.isWord(card.kanji));
    if (options.level !== 'all' && !levels.includes(options.level)) options.level = 'all';
    if (!hasWords) options.kind = 'all';

    const cards = pool(), day = U.today();
    const due = cards.filter(card => Store.isDue(card.kanji, day)).length;
    const fresh = cards.filter(card => !Store.prog(card.kanji)).length;
    const today = options.again ? cards.filter(card => Store.doneToday(card.kanji)).length : 0;
    const count = Math.min(options.size, due + fresh + today);
    const boxes = [0, 1, 2, 3, 4, 5].map(box => cards.filter(card => boxOf(card.kanji) === box).length);

    root.innerHTML = html`
      <h1 class="h">${t('pr.title')}</h1>
      <section class="panel">
        <p class="big-line">${t('pr.dueNew', { due, new: fresh }) + (options.again ? ' · ' + t('pr.todayCount', { n: today }) : '')}</p>
        <div class="bx">${boxes.map((n, box) => html`<button type="button" class="b${box}" data-act="box" data-box="${box}"
          aria-pressed="${openBox === box}"><b>${n}</b><span>${box ? t('pr.box', { n: box }) : t('pr.boxNew')}</span></button>`)}</div>
        ${boxCards(cards, day)}
        <p class="hint">${t('pr.explain')}</p>
      </section>
      <section class="panel setup">
        ${setupFields(levels, hasWords)}
        <div class="toggle">
          <button type="button" class="switch" role="switch" aria-checked="${options.again}" data-act="again"
            aria-labelledby="againLbl" aria-describedby="againHint"><i></i></button>
          <div><span id="againLbl" class="toggle-l">${t('pr.againToggle')}</span><p id="againHint" class="hint">${t('pr.againHint')}</p></div>
        </div>
        ${count ? html`<button type="button" class="btn primary big" data-act="start">${t('pr.start', { n: count })}</button>`
          : html`<p class="big-line">${cards.length ? t('pr.allDone') : t('pr.nothing')}</p>
             ${cards.length ? html`<button type="button" class="btn big" data-act="free">${t('pr.free')}</button>
               <p class="hint">${t('pr.freeHint')}</p>` : ''}`}
      </section>`;

    // Un canvi d'opció torna a pintar la pantalla (els números canvien) i deixa el focus on era.
    root.onchange = e => {
      const radio = e.target;
      if (!['mode', 'size', 'level', 'kind'].includes(radio.name)) return;
      options[radio.name] = radio.name === 'size' ? +radio.value : radio.value;
      saveOptions();
      setup();
      const focused = root.querySelector(`input[name="${radio.name}"]:checked`);
      if (focused) focused.focus();
    };
    U.onActions(root, {
      again() {
        options.again = !options.again;
        saveOptions();
        setup();
        root.querySelector('.switch').focus();
      },
      box(el) {
        const box = +el.dataset.box;
        openBox = openBox === box ? null : box;
        setup();
        root.querySelector(`.bx [data-box="${box}"]`).focus();
      },
      start: () => start(false),
      free: () => start(true),
    });
  }

  // Les fitxes de la caixa oberta, amb les mateixes rajoles que l'inici.
  function boxCards(cards, day) {
    if (openBox === null) return '';
    const inBox = cards.filter(card => boxOf(card.kanji) === openBox);
    if (!inBox.length) return html`<p class="hint bx-empty">${t('pr.boxEmpty')}</p>`;
    return html`<div class="grid bx-cards">${inBox.map(card => Peces.tile(card, day))}</div>`;
  }

  // Grups de botons d'opció: mode, quantes, nivell (si n'hi ha més d'un) i tipus (si tens paraules).
  function setupFields(levels, hasWords) {
    const radio = (name, value, label) => html`<label><input type="radio" name="${name}" value="${value}"
      ${options[name] === value ? html` checked` : ''}><span>${label}</span></label>`;
    const group = (legend, radios) => html`<fieldset><legend>${legend}</legend><div class="seg">${radios}</div></fieldset>`;
    return html`
      ${group(t('pr.mode'), MODES.map(mode => radio('mode', mode, t('pr.mode.' + mode))))}
      ${group(t('pr.size'), SIZES.map(size => radio('size', size, String(size))))}
      ${levels.length > 1 ? group(t('pr.level'), [
        radio('level', 'all', t('home.all')),
        ...levels.map(lv => radio('level', lv, Card.levelName(lv))),
      ]) : ''}
      ${hasWords ? group(t('pr.kind'), [
        radio('kind', 'all', t('home.all')),
        radio('kind', 'kanji', t('home.kanjiType')),
        radio('kind', 'word', t('home.wordType')),
      ]) : ''}`;
  }

  // Primer les que toquen (les més endarrerides i de caixes baixes), després les noves i, si l'interruptor
  // és actiu, les que ja has practicat avui; i es barregen. El repàs lliure agafa les de caixes més baixes
  // i no desa res.
  function start(free) {
    const cards = pool(), day = U.today();
    let list;
    if (free) {
      list = U.shuffle(cards.slice()).sort((a, b) => boxOf(a.kanji) - boxOf(b.kanji)).slice(0, options.size);
    } else {
      const due = cards.filter(card => Store.isDue(card.kanji, day)).sort((a, b) => {
        const pa = Store.prog(a.kanji), pb = Store.prog(b.kanji);
        return pa.due.localeCompare(pb.due) || pa.box - pb.box;
      });
      const fresh = cards.filter(card => !Store.prog(card.kanji));
      const again = options.again ? U.shuffle(cards.filter(card => Store.doneToday(card.kanji))) : [];
      list = due.concat(fresh, again).slice(0, options.size);
    }
    if (!list.length) return;
    session = {
      free,
      mode: options.mode,
      queue: U.shuffle(list.map(card => ({ ch: card.kanji, rep: false }))),
      i: 0,
      flipped: false,
      res: { no: 0, doubt: 0, yes: 0 },
      failed: [],
      done: false,
    };
    location.hash = '#/practica/sessio';
  }

  // ---------- Sessió ----------
  // Totes les lectures (la principal, destacada) amb el rōmaji al costat.
  function readings(card) {
    if (!card.onyomi.length && !card.kunyomi.length) return ''; // les paraules només tenen la lectura principal
    const line = (label, list, format) => (list.length
      ? html`<span class="rl"><small>${label}</small><span lang="ja">${Peces.readingList(card, list, { format })}</span><span
          class="ros">${Peces.roList(list)}</span></span>`
      : '');
    const lines = [line(t('card.on'), card.onyomi), line(t('card.kun'), card.kunyomi, Peces.kun)];
    return html`<div class="reads">${lines}</div>${Peces.say(Card.readingsToSay(card), t('card.listenReadings'))}`;
  }
  // La lectura que s'aprèn primer (camp "reading"), amb el rōmaji i la veu. Les fitxes antigues no en tenen.
  function mainReading(card) {
    if (!card.reading) return '';
    return html`<div class="ans-main">${Peces.mainHtml(card)}${Peces.say(Card.mains(card).join('、'), t('card.listenMain'))}</div>`;
  }
  const meanings = card => I18n.list(card.meanings).join(' · ');
  const bigKanji = card => html`<div class="big-k${Card.sizeClass(card.kanji)}" lang="ja">${card.kanji}</div>`;

  // Davant: el kanji (k2m) o el significat (m2k).
  const front = card => (session.mode === 'm2k' ? html`<div class="big-m">${meanings(card)}</div>` : bigKanji(card));
  // Revers: el que no hi havia davant, la lectura principal, totes les lectures, la mnemotècnia i l'enllaç a la fitxa.
  function back(card) {
    const emoji = card.emoji ? html` <span aria-hidden="true">${card.emoji}</span>` : '';
    const mnemonic = I18n.tr(card.mnemonic);
    const top = session.mode === 'm2k' ? bigKanji(card) : html`<div class="ans-m">${meanings(card)}${emoji}</div>`;
    return html`${top}${mainReading(card)}<div class="ans-r">${readings(card)}</div>
      ${mnemonic ? html`<p class="ans-mn">${mnemonic}</p>` : ''}<a class="lnk" href="${Card.href(card.kanji)}">${t('pr.seeCard')}</a>`;
  }

  function paintCard() {
    // Per si n'has esborrat alguna a mitja sessió.
    while (session.i < session.queue.length && !Store.get(session.queue[session.i].ch)) session.i++;
    if (session.i >= session.queue.length) {
      summary();
      return;
    }
    const item = session.queue[session.i], card = Store.get(item.ch), total = session.queue.length;
    // Sota cada botó, quan tornarà (no surt al repàs lliure ni a la segona passada d'una fallada).
    const when = grade => {
      if (session.free || item.rep) return '';
      const days = Store.nextDays(item.ch, grade);
      return html`<small>${days === null ? t('pr.keep') : daysText(days)}</small>`;
    };
    const flipped = session.flipped;
    root.innerHTML = html`
      <div class="ses-top">
        <button type="button" class="btn ghost" data-act="quit">${U.ICON.close}<span>${t('pr.quit')}</span></button>
        <div class="pbar" role="progressbar" aria-label="${t('pr.progress')}" aria-valuemin="0" aria-valuemax="${total}"
          aria-valuenow="${session.i}"><i style="width:${(session.i / total) * 100}%"></i></div>
        <span class="pos">${session.i + 1}/${total}</span>
      </div>
      <div class="ses-tags">${session.free ? html`<span class="tag">${t('pr.freeTag')}</span>` : ''}${Peces.romajiBtn()}</div>
      <div class="flash${flipped ? ' open' : ''}" ${flipped
        ? html`tabindex="-1"`
        : html`role="button" tabindex="0" data-act="flip" aria-label="${t('pr.flipLabel')}"`}>
        ${item.rep ? html`<span class="again">${t('pr.again')}</span>` : ''}
        <p class="q">${t('pr.q.' + session.mode)}</p>
        ${front(card)}
        ${flipped ? html`<div class="rev">${back(card)}</div>` : ''}
      </div>
      <div class="answer">
        ${flipped
          ? html`<div class="grade">${GRADES.map(grade => html`<button type="button" class="btn ${grade}" data-act="grade"
              data-g="${grade}"><span>${t('pr.' + grade)}</span>${when(grade)}</button>`)}</div>`
          : html`<button type="button" class="btn primary big" data-act="flip">${t('pr.flip')}</button>`}
        <p class="keys">${t('pr.keys')}</p>
      </div>`;
    if (flipped) root.querySelector('.flash').focus({ preventScroll: true });
    U.onActions(root, {
      grade: button => answer(button.dataset.g),
      flip,
      quit() {
        session = null;
        App.back();
      },
    });
  }

  // Gira la targeta: es plega, es pinta el revers i es desplega.
  function flip() {
    if (!session || session.flipped || session.done) return;
    session.flipped = true;
    const flash = root.querySelector('.flash');
    if (!flash || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      paintCard();
      return;
    }
    flash.classList.add('turn');
    setTimeout(() => {
      if (screen !== 'session' || !session) return; // has sortit mentre girava
      paintCard();
      root.querySelector('.flash').classList.add('unturn');
    }, 140);
  }

  // Només compta la primera resposta. Si falles, surt un altre cop al final de la sessió (sense tornar a puntuar).
  function answer(grade) {
    if (!session || !session.flipped) return;
    const item = session.queue[session.i];
    Store.tally(); // el calendari compta totes les respostes
    if (!item.rep) {
      session.res[grade]++;
      if (!session.free) Store.review(item.ch, grade);
      if (grade === 'no') {
        session.failed.push(item.ch);
        session.queue.push({ ch: item.ch, rep: true });
      }
    }
    session.i++;
    session.flipped = false;
    paintCard();
  }

  function summary() {
    session.done = true;
    const result = grade => html`<div class="r-${grade}"><b>${session.res[grade]}</b><span>${t('pr.' + grade)}</span></div>`;
    const failed = session.failed.map(ch => Store.get(ch)).filter(Boolean);
    root.innerHTML = html`
      <section class="panel summary">
        <h1 class="h">${t('pr.done')}</h1>
        ${session.free ? html`<p class="tag">${t('pr.freeTag')}</p>` : ''}
        <div class="res">${GRADES.map(result)}</div>
        ${failed.length
          ? html`<h2>${t('pr.toReview')}</h2><div class="grid">${failed.map(card => Peces.tile(card))}</div>`
          : html`<p class="big-line">${t('pr.perfect')}</p>`}
        <div class="row"><button type="button" class="btn primary" data-act="again">${t('pr.another')}</button>
          <a class="btn" href="#/">${t('pr.home')}</a></div>
      </section>`;
    U.onActions(root, {
      again() {
        session = null;
        location.hash = '#/practica';
      },
    });
  }

  // Espai o Retorn giren la targeta; 1, 2 i 3 responen No, Sí i Dubte.
  function key(e) {
    if (screen !== 'session' || !session || session.done) return;
    if (e.key === ' ' || e.key === 'Enter') {
      if (e.target.closest && e.target.closest('button, a')) return; // el botó ja respon sol
      if (!session.flipped) {
        e.preventDefault();
        flip();
      }
    } else if (session.flipped && ['1', '2', '3'].includes(e.key)) {
      e.preventDefault();
      answer(GRADES[+e.key - 1]);
    }
  }

  return { nav: 'practice', render, key };
})();
