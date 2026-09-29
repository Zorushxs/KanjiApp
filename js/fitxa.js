// Fitxa d'un kanji: significats, lectures amb veu, ordre de traços, exemples, mnemotècnia i verificació.
const Fitxa = (() => {
  const { esc } = U;
  let prev = null, next = null;

  function render(root, arg) {
    const k = Store.get(arg);
    if (!k) {
      root.innerHTML = `<div class="empty"><p>${esc(t('card.notFound'))}</p><a class="btn" href="#/">${esc(t('card.back'))}</a></div>`;
      prev = next = null; return;
    }
    const ch = k.kanji, tr = I18n.tr, p = Store.prog(ch), s = k.sentence;
    let list = Inici.visible(); if (!list.includes(k)) list = Store.kanji;
    const i = list.indexOf(k); prev = list[i - 1] || null; next = list[i + 1] || null;

    const nav = (x, label, dir) => x
      ? `<a class="icon-btn" href="${U.kanjiHref(x.kanji)}" data-replace aria-label="${esc(label)}" title="${esc(label)}">${U.ICON[dir]}</a>`
      : `<span class="icon-btn off" aria-hidden="true">${U.ICON[dir]}</span>`;
    const rd = (label, hint, arr, fmt) => `<div class="rd">
        <span class="rd-l">${esc(label)} <small>${esc(hint)}</small></span>
        <span class="rd-v" lang="ja">${arr.length ? arr.map(fmt).join('<span class="sep">、</span>') : esc(t('card.none'))}</span>
        ${U.say(arr.map(U.plain).join('、'))}</div>`;
    const sec = (cls, title, body, extra = '') => body ? `<section class="panel ${cls}"><h2>${esc(title)}${extra}</h2>${body}</section>` : '';
    const fold = (id, title, text) => text ? `<details class="panel fold" data-fold="${id}"><summary>${esc(title)}</summary><p>${esc(text)}</p></details>` : '';
    const examples = k.examples.map(e => `<li>
        <span class="ex-w" lang="ja">${U.mark(e.word, ch)}</span><span class="ex-r" lang="ja">${esc(e.reading)}</span>
        <span class="ex-m">${esc(tr(e.meaning))}</span>${U.say(e.reading)}</li>`).join('');
    const sentence = s.jp ? `<p class="sent-jp" lang="ja">${U.mark(s.jp, ch)}</p>
        ${s.reading ? `<p class="sent-r" lang="ja">${esc(s.reading)}</p>` : ''}<p class="sent-m">${esc(tr(s.meaning))}</p>` : '';
    const status = p ? t('card.box', { box: p.box, date: U.fmtDate(p.due) }) : t('card.new');

    root.innerHTML = `
      <div class="bar">
        <a class="btn ghost back" href="#/" data-back>${U.ICON.left}<span>${esc(t('card.back'))}</span></a>
        <span class="pos">${i + 1} / ${list.length}</span>
        ${nav(prev, t('card.prev'), 'left')}${nav(next, t('card.next'), 'right')}
      </div>
      <article class="sheet">
        <div class="col">
          <section class="panel hero">
            ${U.say([...k.onyomi, ...k.kunyomi].map(U.plain).join('、'), t('card.listenReadings'))}
            ${k.emoji ? `<span class="emoji" aria-hidden="true">${esc(k.emoji)}</span>` : ''}
            <div class="hero-k" lang="ja">${esc(ch)}</div>
            <h1 class="means">${esc(I18n.list(k.meanings).join(' · '))}</h1>
            <div class="facts">
              ${k.jlpt ? `<span class="pill">N${k.jlpt}</span>` : ''}
              ${k.strokes ? `<span class="pill">${esc(t('card.strokes', { n: k.strokes }))}</span>` : ''}
              <span class="pill">${esc(status)}</span>
              <span class="pill" data-ver-pill hidden></span>
            </div>
            ${p ? `<p class="stats">${esc(t('card.stats', { seen: p.seen, fails: p.fails }))}</p>` : ''}
          </section>
          <section class="panel">
            <h2>${esc(t('card.readings'))}</h2>
            ${rd(t('card.on'), t('card.onHint'), k.onyomi, esc)}
            ${rd(t('card.kun'), t('card.kunHint'), k.kunyomi, U.kun)}
          </section>
          <section class="panel strokes">
            <h2>${esc(t('card.strokeOrder'))}<button type="button" class="icon-btn" data-act="replay" title="${esc(t('card.replay'))}" aria-label="${esc(t('card.replay'))}">${U.ICON.replay}</button></h2>
            <div class="so" data-act="replay"></div>
            <p class="credit">${esc(t('card.soCredit'))} <a href="https://kanjivg.tagaini.net" target="_blank" rel="noopener">KanjiVG</a>
              · © Ulrich Apel · <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a></p>
          </section>
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
              <a class="btn" href="#/afegir/${encodeURIComponent(ch)}">${esc(t('card.regen'))}</a>
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
    const so = root.querySelector('.so');
    Traces.mount(so, ch, k.strokes);
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
  // Fletxes del teclat: kanji anterior i següent.
  function key(e) {
    const x = e.key === 'ArrowLeft' ? prev : e.key === 'ArrowRight' ? next : null;
    if (x) { e.preventDefault(); App.replace(U.kanjiHref(x.kanji)); }
  }
  return { nav: 'home', render, key };
})();
