// Fitxa d'un kanji o d'una paraula: significats, lectures amb veu, ordre de traços (kanji) o kanji que la
// formen (paraula), exemples, mnemotècnia i verificació.
const Fitxa = (() => {
  const { esc } = U;
  let prev = null, next = null;
  let enter = ''; // després de lliscar: per quin costat entra la fitxa nova ('right' o 'left')

  function render(root, arg) {
    const k = Store.get(arg);
    if (!k) {
      root.innerHTML = `<div class="empty"><p>${esc(t('card.notFound'))}</p><a class="btn" href="#/">${esc(t('card.back'))}</a></div>`;
      prev = next = null; return;
    }
    const ch = k.kanji, tr = I18n.tr, p = Store.prog(ch), s = k.sentence, word = U.isWord(ch);
    let list = Inici.visible(); if (!list.includes(k)) list = Store.kanji;
    const i = list.indexOf(k); prev = list[i - 1] || null; next = list[i + 1] || null;

    const nav = (x, label, dir) => x
      ? `<a class="icon-btn" href="${U.kanjiHref(x.kanji)}" data-replace aria-label="${esc(label)}" title="${esc(label)}">${U.ICON[dir]}</a>`
      : `<span class="icon-btn off" aria-hidden="true">${U.ICON[dir]}</span>`;
    // Cada lectura amb el seu rōmaji a sota; la principal, destacada.
    const one = (r, fmt) => U.isMain(k, r) ? `<b class="is-main" title="${esc(t('card.mainHint'))}">${fmt(r)}</b>` : fmt(r);
    const rd = (label, hint, arr, fmt) => `<div class="rd">
        <span class="rd-l">${esc(label)} <small>${esc(hint)}</small></span>
        <span class="rd-v" lang="ja">${arr.length ? arr.map(r => one(r, fmt)).join('<span class="sep">、</span>') : esc(t('card.none'))}</span>
        ${arr.length ? `<span class="rd-ro">${U.roList(arr)}</span>` : ''}
        ${U.say(arr.map(U.plain).join('、'))}</div>`;
    const sec = (cls, title, body, extra = '') => body ? `<section class="panel ${cls}"><h2>${esc(title)}${extra}</h2>${body}</section>` : '';
    const fold = (id, title, text) => text ? `<details class="panel fold" data-fold="${id}"><summary>${esc(title)}</summary><p>${esc(text)}</p></details>` : '';
    const examples = k.examples.map(e => `<li>
        <span class="ex-w" lang="ja">${U.mark(e.word, ch)}</span><span class="ex-r"><span lang="ja">${esc(e.reading)}</span> ${U.ro(e.reading)}</span>
        <span class="ex-m">${esc(tr(e.meaning))}</span>${U.say(e.reading)}</li>`).join('');
    const sentence = s.jp ? `<p class="sent-jp" lang="ja">${U.mark(s.jp, ch)}</p>
        ${s.reading ? `<p class="sent-r" lang="ja">${esc(s.reading)}</p>` : ''}
        ${s.romaji ? `<p class="sent-ro ro" lang="ja-Latn">${esc(s.romaji)}</p>` : ''}<p class="sent-m">${esc(tr(s.meaning))}</p>` : '';
    const status = p ? t('card.box', { box: p.box, date: U.fmtDate(p.due) }) : t('card.new');
    // Paraules: en lloc de lectures on/kun i ordre de traços, els kanji que la formen (enllaçats si els tens).
    const parts = [...new Set(ch.match(/\p{Script=Han}/gu) || [])].map(c => {
      const x = Store.get(c), m = x ? I18n.list(x.meanings)[0] || '' : t('card.notInCollection');
      return x ? `<a class="kpart" href="${U.kanjiHref(c)}"><span lang="ja">${esc(c)}</span><small>${esc(m)}</small></a>`
        : `<span class="kpart off"><span lang="ja">${esc(c)}</span><small>${esc(m)}</small></span>`;
    }).join('');
    const kanjiPanel = word
      ? `<section class="panel"><h2>${esc(t('card.wordKanji'))}</h2>${parts ? `<div class="kparts">${parts}</div>` : `<p class="hint">${esc(t('card.kanaOnly'))}</p>`}</section>`
      : `<section class="panel">
            <h2>${esc(t('card.readings'))}</h2>
            ${rd(t('card.on'), t('card.onHint'), k.onyomi, esc)}
            ${rd(t('card.kun'), t('card.kunHint'), k.kunyomi, U.kun)}
          </section>
          <section class="panel strokes">
            <h2>${esc(t('card.strokeOrder'))}<button type="button" class="icon-btn" data-act="replay" title="${esc(t('card.replay'))}" aria-label="${esc(t('card.replay'))}">${U.ICON.replay}</button></h2>
            <div class="so" data-act="replay"></div>
            <p class="credit">${esc(t('card.soCredit'))} <a href="https://kanjivg.tagaini.net" target="_blank" rel="noopener">KanjiVG</a>
              · © Ulrich Apel · <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a></p>
          </section>`;

    root.innerHTML = `
      <div class="bar">
        <a class="btn ghost back" href="#/" data-back>${U.ICON.left}<span>${esc(t('card.back'))}</span></a>
        ${U.romajiBtn()}
        <span class="pos">${i + 1} / ${list.length}</span>
        ${nav(prev, t('card.prev'), 'left')}${nav(next, t('card.next'), 'right')}
      </div>
      <article class="sheet">
        <div class="col">
          <section class="panel hero">
            ${k.reading ? U.say(k.reading, t('card.listenMain')) : U.say([...k.onyomi, ...k.kunyomi].map(U.plain).join('、'), t('card.listenReadings'))}
            ${k.emoji ? `<span class="emoji" aria-hidden="true">${esc(k.emoji)}</span>` : ''}
            <div class="hero-k${U.size(ch)}" lang="ja">${esc(ch)}</div>
            <h1 class="means">${esc(I18n.list(k.meanings).join(' · '))}</h1>
            ${k.reading ? `<p class="main-r"><small>${esc(t(word ? 'card.wordReading' : 'card.main'))}</small> <span lang="ja">${esc(k.reading)}</span> ${U.ro(k.reading)}</p>` : ''}
            <div class="facts">
              ${word ? `<span class="pill">${esc(t('card.word'))}</span>` : ''}
              ${k.jlpt ? `<span class="pill">N${k.jlpt}</span>` : ''}
              ${k.strokes ? `<span class="pill">${esc(t('card.strokes', { n: k.strokes }))}</span>` : ''}
              <span class="pill">${esc(status)}</span>
              <span class="pill" data-ver-pill hidden></span>
            </div>
            ${p ? `<p class="stats">${esc(t('card.stats', { seen: p.seen, fails: p.fails }))}</p>` : ''}
          </section>
          ${kanjiPanel}
        </div>
        <div class="col">
          ${sec('mnemo', t('card.mnemonic'), tr(k.mnemonic) ? `<p>${esc(tr(k.mnemonic))}</p>` : '')}
          ${sec('', t('card.examples'), examples ? `<ul class="ex">${examples}</ul>` : '')}
          ${sec('', t('card.sentence'), sentence, U.say(s.reading || s.jp))}
          ${fold('origin', t('card.origin'), tr(k.origin))}
          ${fold('trivia', t('card.trivia'), tr(k.trivia))}
          <section class="panel check">
            <h2>${esc(t('card.check'))}</h2>
            <button type="button" class="btn ver" data-act="verify"></button>
            <p class="hint">${esc(t('ver.hint'))}</p>
            <div class="row">
              <a class="btn" href="${U.jisho(ch)}" target="_blank" rel="noopener">${esc(t('card.jisho'))} ↗</a>
              <a class="btn" href="#/afegir/${encodeURIComponent(word ? '「' + ch + '」' : ch)}">${esc(t('card.regen'))}</a>
              <button type="button" class="btn danger" data-act="delete">${esc(t('card.delete'))}</button>
            </div>
          </section>
        </div>
      </article>`;

    // Botó de verificació de tres estats i la pastilla de dalt (que no surt mentre està per verificar).
    const paintVer = () => {
      const v = U.ver(k.verified), btn = root.querySelector('[data-act="verify"]'), pill = root.querySelector('[data-ver-pill]');
      btn.className = `btn ver ver-${v.cls}`;
      btn.textContent = `${v.icon} ${t(v.key)}`;
      btn.setAttribute('aria-label', t('ver.label', { s: t(v.key) }));
      pill.className = `pill ver-${v.cls}`; pill.textContent = `${v.icon} ${t(v.key)}`; pill.hidden = v.cls === 'pending';
    };
    paintVer();
    const so = root.querySelector('.so'); // només a les fitxes de kanji
    if (so) Traces.mount(so, ch, k.strokes);
    if (enter) { root.querySelector('.sheet').classList.add('enter-' + enter); enter = ''; }
    swipe(root);
    root.onclick = e => {
      const r = e.target.closest('[data-replace]');
      if (r) { e.preventDefault(); App.replace(r.getAttribute('href')); return; }
      if (e.target.closest('[data-back]')) { e.preventDefault(); App.back(); return; }
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'replay') Traces.play(so);
      else if (b.dataset.act === 'so-retry') Traces.mount(so, ch, k.strokes);
      else if (b.dataset.act === 'verify') { // per verificar → verificat → té errors → per verificar
        const all = Validar.VERIFIED;
        Store.setVerified(ch, all[(all.indexOf(k.verified) + 1) % all.length]); paintVer();
      }
      else if (b.dataset.act === 'delete' && confirm(t('card.deleteConfirm', { k: ch }))) {
        Store.remove(ch); U.toast(t('card.deleted', { k: ch })); App.back();
      }
    };
  }
  // Lliscar amb el dit, només a les pantalles tàctils (a l'ordinador no canvia res): cap a l'esquerra, la fitxa
  // següent; cap a la dreta, l'anterior. La fitxa segueix el dit; si no arribes prou lluny, torna al seu lloc,
  // i a la primera i l'última fa resistència. Només compten els gestos clarament horitzontals (el desplaçament
  // vertical va com sempre) i no els que comencen a la vora, que són el gest d'«enrere» del mòbil.
  function swipe(root) {
    const sheet = root.querySelector('.sheet');
    if (!sheet || !matchMedia('(pointer: coarse)').matches) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches, EDGE = 24;
    let x0 = 0, y0 = 0, dx = 0, mode = 'y'; // mode: '' (encara no se sap) · 'x' (lliscant) · 'y' (ignorat)
    const reset = () => { sheet.style.transition = 'transform .18s ease-out'; sheet.style.transform = ''; mode = 'y'; };
    sheet.addEventListener('touchstart', e => {
      const p = e.touches[0];
      if (e.touches.length > 1 || p.clientX < EDGE || p.clientX > innerWidth - EDGE) { mode = 'y'; return; }
      x0 = p.clientX; y0 = p.clientY; dx = 0; mode = '';
      sheet.style.transition = 'none';
    }, { passive: true });
    sheet.addEventListener('touchmove', e => {
      if (mode === 'y') return;
      const p = e.touches[0], mx = p.clientX - x0, my = p.clientY - y0;
      if (!mode) {
        if (Math.abs(mx) < 10 && Math.abs(my) < 10) return;
        mode = Math.abs(mx) > Math.abs(my) * 1.2 ? 'x' : 'y';
        if (mode === 'y') return;
      }
      dx = mx;
      const stuck = (dx < 0 && !next) || (dx > 0 && !prev); // no n'hi ha cap més per aquest costat
      if (!still) sheet.style.transform = `translateX(${stuck ? dx * 0.25 : dx}px)`;
    }, { passive: true });
    sheet.addEventListener('touchend', () => {
      if (mode !== 'x') return;
      const to = dx < 0 ? next : prev, width = root.clientWidth || innerWidth;
      if (!to || Math.abs(dx) < Math.min(90, width * 0.22)) { reset(); return; }
      enter = dx < 0 ? 'right' : 'left'; mode = 'y';
      if (still) { App.replace(U.kanjiHref(to.kanji)); return; }
      sheet.style.transition = 'transform .17s ease-in';
      sheet.style.transform = `translateX(${dx < 0 ? -width : width}px)`;
      setTimeout(() => App.replace(U.kanjiHref(to.kanji)), 170);
    });
    sheet.addEventListener('touchcancel', () => { if (mode === 'x') reset(); });
  }
  // Fletxes del teclat: kanji anterior i següent.
  function key(e) {
    const x = e.key === 'ArrowLeft' ? prev : e.key === 'ArrowRight' ? next : null;
    if (x) { e.preventDefault(); App.replace(U.kanjiHref(x.kanji)); }
  }
  return { nav: 'home', render, key };
})();
