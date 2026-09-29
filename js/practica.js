// Pràctica amb repetició espaiada (sistema Leitner de 5 caixes). Les caixes i els dies són a store.js.
const Practica = (() => {
  const { esc } = U;
  const KEY = 'kanji:practica', MODES = ['k2m', 'm2k', 'read'], SIZES = [10, 15, 20], GRADES = ['no', 'doubt', 'yes'];
  const LEVELS = ['n5', 'n4', 'n3', 'n2', 'n1', 'none'];
  let prefs = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
  prefs = { mode: MODES.includes(prefs.mode) ? prefs.mode : 'k2m', size: SIZES.includes(prefs.size) ? prefs.size : 15, level: typeof prefs.level === 'string' ? prefs.level : 'all' };
  const savePrefs = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch {} };
  // Sessió: { free, mode, queue: [{ ch, rep }], i, flipped, res, failed, done }. rep = segona passada d'una fallada.
  let s = null, root = null, screen = 'setup';
  const lv = k => (k.jlpt ? 'n' + k.jlpt : 'none');
  const pool = () => Store.kanji.filter(k => prefs.level === 'all' || lv(k) === prefs.level);
  const boxOf = ch => { const p = Store.prog(ch); return p ? p.box : 0; };
  const days = n => (n === 1 ? t('date.tomorrow') : t('pr.days', { n }));

  function render(r, arg) {
    root = r;
    if (arg === 'sessio') {
      if (!s) { App.replace('#/practica'); return; } // p. ex. després de recarregar la pàgina
      screen = 'session'; return s.done ? summary() : paint();
    }
    screen = 'setup'; setup();
  }

  // ---------- Preparació ----------
  function setup() {
    const all = Store.kanji;
    if (!all.length) {
      root.innerHTML = `<h1 class="h">${esc(t('pr.title'))}</h1><div class="empty"><p>${esc(t('pr.empty'))}</p><a class="btn primary" href="#/afegir">${esc(t('nav.add'))}</a></div>`;
      return;
    }
    const levels = LEVELS.filter(l => all.some(k => lv(k) === l));
    if (prefs.level !== 'all' && !levels.includes(prefs.level)) prefs.level = 'all';
    const P = pool(), day = U.today();
    const due = P.filter(k => Store.isDue(k.kanji, day)).length, fresh = P.filter(k => !Store.prog(k.kanji)).length;
    const n = Math.min(prefs.size, due + fresh);
    const boxes = [0, 1, 2, 3, 4, 5].map(b => P.filter(k => boxOf(k.kanji) === b).length);
    const radio = (name, v, label, on) => `<label><input type="radio" name="${name}" value="${v}"${on ? ' checked' : ''}><span>${esc(label)}</span></label>`;
    const field = (name, legend, opts) => `<fieldset><legend>${esc(legend)}</legend><div class="seg">${opts.join('')}</div></fieldset>`;
    root.innerHTML = `
      <h1 class="h">${esc(t('pr.title'))}</h1>
      <section class="panel">
        <p class="big-line">${esc(t('pr.dueNew', { due, new: fresh }))}</p>
        <div class="bx">${boxes.map((c, b) => `<div class="b${b}"><b>${c}</b><span>${esc(b ? t('pr.box', { n: b }) : t('pr.boxNew'))}</span></div>`).join('')}</div>
        <p class="hint">${esc(t('pr.explain'))}</p>
      </section>
      <section class="panel setup">
        ${field('mode', t('pr.mode'), MODES.map(m => radio('mode', m, t('pr.mode.' + m), prefs.mode === m)))}
        ${field('size', t('pr.size'), SIZES.map(z => radio('size', z, String(z), prefs.size === z)))}
        ${levels.length > 1 ? field('level', t('pr.level'), [radio('level', 'all', t('home.all'), prefs.level === 'all'),
          ...levels.map(l => radio('level', l, l === 'none' ? t('home.noLevel') : l.toUpperCase(), prefs.level === l))]) : ''}
        ${n ? `<button type="button" class="btn primary big" data-act="start">${esc(t('pr.start', { n }))}</button>`
          : `<p class="big-line">${esc(P.length ? t('pr.allDone') : t('pr.nothing'))}</p>
             ${P.length ? `<button type="button" class="btn big" data-act="free">${esc(t('pr.free'))}</button><p class="hint">${esc(t('pr.freeHint'))}</p>` : ''}`}
      </section>`;
    root.onchange = e => {
      const i = e.target;
      if (i.name === 'mode') prefs.mode = i.value;
      else if (i.name === 'size') prefs.size = +i.value;
      else if (i.name === 'level') prefs.level = i.value;
      else return;
      savePrefs(); setup();
      const f = root.querySelector(`input[name="${i.name}"]:checked`); if (f) f.focus();
    };
    root.onclick = e => { const b = e.target.closest('[data-act]'); if (b) start(b.dataset.act === 'free'); };
  }

  // Primer els que toquen (els més endarrerits i de caixes baixes), després els nous; i es barregen.
  // El repàs lliure agafa els de caixes més baixes i no desa res.
  function start(free) {
    const P = pool(), day = U.today();
    let list;
    if (free) list = U.shuffle(P.slice()).sort((a, b) => boxOf(a.kanji) - boxOf(b.kanji)).slice(0, prefs.size);
    else {
      const due = P.filter(k => Store.isDue(k.kanji, day)).sort((a, b) => {
        const x = Store.prog(a.kanji), y = Store.prog(b.kanji);
        return x.due.localeCompare(y.due) || x.box - y.box;
      });
      list = due.concat(P.filter(k => !Store.prog(k.kanji))).slice(0, prefs.size);
    }
    if (!list.length) return;
    s = { free, mode: prefs.mode, queue: U.shuffle(list.map(k => ({ ch: k.kanji, rep: false }))), i: 0, flipped: false, res: { no: 0, doubt: 0, yes: 0 }, failed: [], done: false };
    location.hash = '#/practica/sessio';
  }

  // ---------- Sessió ----------
  function reads(k) {
    const line = (label, arr, fmt) => arr.length ? `<span><small>${esc(label)}</small> ${arr.map(fmt).join('、')}</span>` : '';
    return `<div class="reads" lang="ja">${line(t('card.on'), k.onyomi, esc)}${line(t('card.kun'), k.kunyomi, U.kun)}</div>` +
      U.say([...k.onyomi, ...k.kunyomi].map(U.plain).join('、'), t('card.listenReadings'));
  }
  function back(k) {
    const means = esc(I18n.list(k.meanings).join(' · ')), emoji = k.emoji ? ` <span aria-hidden="true">${esc(k.emoji)}</span>` : '';
    const mn = I18n.tr(k.mnemonic), ex = k.examples[0];
    let main;
    if (s.mode === 'k2m') main = `<div class="ans-m">${means}${emoji}</div><div class="ans-r">${reads(k)}</div>`;
    else if (s.mode === 'm2k') main = `<div class="big-k" lang="ja">${esc(k.kanji)}</div><div class="ans-r">${reads(k)}</div>`;
    else {
      main = `<div class="ans-r big">${reads(k)}</div><div class="ans-m small">${means}${emoji}</div>` +
        (ex ? `<p class="ans-ex"><span lang="ja">${U.mark(ex.word, k.kanji)}</span> <span lang="ja">${esc(ex.reading)}</span> · ${esc(I18n.tr(ex.meaning))}</p>` : '');
    }
    return main + (mn ? `<p class="ans-mn">${esc(mn)}</p>` : '') + `<a class="lnk" href="${U.kanjiHref(k.kanji)}">${esc(t('pr.seeCard'))}</a>`;
  }
  function paint() {
    while (s.i < s.queue.length && !Store.get(s.queue[s.i].ch)) s.i++; // per si n'has esborrat algun a mitja sessió
    if (s.i >= s.queue.length) return summary();
    const it = s.queue[s.i], k = Store.get(it.ch), total = s.queue.length;
    const front = s.mode === 'm2k'
      ? `<div class="big-m">${esc(I18n.list(k.meanings).join(' · '))}</div>`
      : `<div class="big-k" lang="ja">${esc(k.kanji)}</div>`;
    const hint = g => (s.free || it.rep ? '' : `<small>${esc(days(Store.nextDays(it.ch, g)))}</small>`);
    root.innerHTML = `
      <div class="ses-top">
        <button type="button" class="btn ghost" data-act="quit">${U.ICON.close}<span>${esc(t('pr.quit'))}</span></button>
        <div class="pbar" role="progressbar" aria-label="${esc(t('pr.progress'))}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${s.i}"><i style="width:${(s.i / total) * 100}%"></i></div>
        <span class="pos">${s.i + 1}/${total}</span>
      </div>
      ${s.free ? `<p class="tag">${esc(t('pr.freeTag'))}</p>` : ''}
      <div class="flash${s.flipped ? ' open' : ''}" ${s.flipped ? 'tabindex="-1"' : `role="button" tabindex="0" data-act="flip" aria-label="${esc(t('pr.flipLabel'))}"`}>
        ${it.rep ? `<span class="again">${esc(t('pr.again'))}</span>` : ''}
        <p class="q">${esc(t('pr.q.' + s.mode))}</p>
        ${front}
        ${s.flipped ? `<div class="rev">${back(k)}</div>` : ''}
      </div>
      <div class="answer">
        ${s.flipped
          ? `<div class="grade">${GRADES.map(g => `<button type="button" class="btn ${g}" data-g="${g}"><span>${esc(t('pr.' + g))}</span>${hint(g)}</button>`).join('')}</div>`
          : `<button type="button" class="btn primary big" data-act="flip">${esc(t('pr.flip'))}</button>`}
        <p class="keys">${esc(t('pr.keys'))}</p>
      </div>`;
    if (s.flipped) root.querySelector('.flash').focus({ preventScroll: true });
    root.onclick = e => {
      if (e.target.closest('[data-say], a')) return;
      const b = e.target.closest('[data-g], [data-act]'); if (!b) return;
      if (b.dataset.g) answer(b.dataset.g);
      else if (b.dataset.act === 'flip') flip();
      else if (b.dataset.act === 'quit') { s = null; App.back(); }
    };
  }
  function flip() {
    if (!s || s.flipped || s.done) return;
    s.flipped = true;
    const card = root.querySelector('.flash');
    if (!card || matchMedia('(prefers-reduced-motion: reduce)').matches) return paint();
    card.classList.add('turn'); // es plega, es pinta el revers i es desplega
    setTimeout(() => { if (screen !== 'session' || !s) return; paint(); root.querySelector('.flash').classList.add('unturn'); }, 140);
  }
  // Només compta la primera resposta. Si falles, surt un altre cop al final de la sessió (sense tornar a puntuar).
  function answer(g) {
    if (!s || !s.flipped) return;
    const it = s.queue[s.i];
    if (!it.rep) {
      s.res[g]++;
      if (!s.free) Store.review(it.ch, g);
      if (g === 'no') { s.failed.push(it.ch); s.queue.push({ ch: it.ch, rep: true }); }
    }
    s.i++; s.flipped = false; paint();
  }
  function summary() {
    s.done = true;
    const cell = g => `<div class="r-${g}"><b>${s.res[g]}</b><span>${esc(t('pr.' + g))}</span></div>`;
    const failed = s.failed.map(ch => Store.get(ch)).filter(Boolean);
    root.innerHTML = `
      <section class="panel summary">
        <h1 class="h">${esc(t('pr.done'))}</h1>
        ${s.free ? `<p class="tag">${esc(t('pr.freeTag'))}</p>` : ''}
        <div class="res">${GRADES.map(cell).join('')}</div>
        ${failed.length
          ? `<h2>${esc(t('pr.toReview'))}</h2><div class="grid">${failed.map(k => `<a class="tile" href="${U.kanjiHref(k.kanji)}"><span class="tile-k" lang="ja">${esc(k.kanji)}</span><span class="tile-m">${esc(I18n.list(k.meanings)[0] || '')}</span></a>`).join('')}</div>`
          : `<p class="big-line">${esc(t('pr.perfect'))}</p>`}
        <div class="row"><button type="button" class="btn primary" data-act="again">${esc(t('pr.another'))}</button><a class="btn" href="#/">${esc(t('pr.home'))}</a></div>
      </section>`;
    root.onclick = e => { if (e.target.closest('[data-act="again"]')) { s = null; location.hash = '#/practica'; } };
  }
  function key(e) {
    if (screen !== 'session' || !s || s.done) return;
    if (e.key === ' ' || e.key === 'Enter') {
      if (e.target.closest && e.target.closest('button, a')) return; // el botó ja respon sol
      if (!s.flipped) { e.preventDefault(); flip(); }
    } else if (s.flipped && ['1', '2', '3'].includes(e.key)) { e.preventDefault(); answer(GRADES[+e.key - 1]); }
  }
  return { nav: 'practice', render, key };
})();
