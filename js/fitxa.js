// Fitxa d'un kanji o d'una paraula: significats, lectures amb veu, ordre de traços (kanji) o kanji que la
// formen (paraula), exemples, mnemotècnia i verificació.
const Fitxa = (() => {
  const { esc } = U;
  let prev = null, next = null;
  let enter = ''; // després de lliscar: per quin costat entra la fitxa nova ('right' o 'left')
  let editing = null, picks = [], picksStart = ''; // fitxa en mode edició; lectures principals triades (màx. 2) i les de l'inici
  let cur = null, paintVerNow = null; // fitxa que es veu i com repintar-ne la verificació (per a les tecles V i E)
  window.addEventListener('hashchange', () => { editing = null; }); // en anar a una altra pantalla es deixa d'editar

  function render(root, arg) {
    const k = Store.get(arg);
    if (!k) {
      root.innerHTML = `<div class="empty"><p>${esc(t('card.notFound'))}</p><a class="btn" href="#/">${esc(t('card.back'))}</a></div>`;
      prev = next = null; return;
    }
    const ch = k.kanji, tr = I18n.tr, p = Store.prog(ch), s = k.sentence, word = U.isWord(ch), ed = editing === ch;
    cur = ch; paintVerNow = null;
    let list = Inici.visible(); if (!list.includes(k)) list = Store.kanji;
    const i = list.indexOf(k); prev = list[i - 1] || null; next = list[i + 1] || null;

    const nav = (x, label, dir) => x && !ed
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
      ${ed ? editSheet(k, word) : `<article class="sheet">
        <div class="col">
          <section class="panel hero">
            ${k.reading ? U.say(U.mains(k).join('、'), t('card.listenMain')) : U.say([...k.onyomi, ...k.kunyomi].map(U.plain).join('、'), t('card.listenReadings'))}
            ${k.emoji ? `<span class="emoji" aria-hidden="true">${esc(k.emoji)}</span>` : ''}
            <div class="hero-k${U.size(ch)}" lang="ja">${esc(ch)}</div>
            <h1 class="means">${esc(I18n.list(k.meanings).join(' · '))}</h1>
            ${k.reading ? `<p class="main-r"><small>${esc(t(word ? 'card.wordReading' : U.mains(k).length > 1 ? 'card.mains' : 'card.main'))}</small> ${U.mainHtml(k)}</p>` : ''}
            <div class="facts">
              ${word ? `<span class="pill">${esc(t('card.word'))}</span>` : ''}
              ${k.jlpt ? `<span class="pill">N${k.jlpt}</span>` : ''}
              ${k.strokes ? `<span class="pill">${esc(t('card.strokes', { n: k.strokes }))}</span>` : ''}
              <span class="pill">${esc(status)}</span>
              ${k.edited ? `<span class="pill">✎ ${esc(t('card.edited'))}</span>` : ''}
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
            <p class="keys">${esc(t('ver.keys'))}</p>
            <div class="row">
              <button type="button" class="btn" data-act="edit">✎ ${esc(t('card.edit'))}</button>
              <a class="btn" href="${U.jisho(ch)}" target="_blank" rel="noopener">${esc(t('card.jisho'))} ↗</a>
              <a class="btn" href="#/afegir/${encodeURIComponent(word ? '「' + ch + '」' : ch)}">${esc(t('card.regen'))}</a>
              <button type="button" class="btn danger" data-act="delete">${esc(t('card.delete'))}</button>
            </div>
          </section>
        </div>
      </article>`}`;

    root.onclick = e => {
      const r = e.target.closest('[data-replace]');
      if (r) { e.preventDefault(); App.replace(r.getAttribute('href')); return; }
      if (e.target.closest('[data-back]')) { e.preventDefault(); App.back(); return; }
      const mc = e.target.closest('[data-main-v]');
      if (mc) { // lectura principal: es tria o es treu; com a màxim dues, numerades per ordre
        const v = mc.dataset.mainV, i = picks.indexOf(v), full = i < 0 && picks.length >= 2;
        if (i >= 0) picks.splice(i, 1); else if (!full) picks.push(v);
        paintMain(root); root.querySelector('[data-main-max]').hidden = !full;
        return;
      }
      const b = e.target.closest('[data-act]'); if (!b) return;
      const act = b.dataset.act;
      if (act === 'edit') { editing = ch; render(root, ch); root.querySelector('[data-e="meanings"]').focus(); }
      else if (act === 'cancel') { editing = null; render(root, ch); }
      else if (act === 'save') {
        const r2 = save(root, k); if (!r2) return;
        editing = null; render(root, ch); U.toast(t(r2 === 'same' ? 'card.noChanges' : 'card.saved'));
      }
      else if (act === 'replay') Traces.play(root.querySelector('.so'));
      else if (act === 'so-retry') Traces.mount(root.querySelector('.so'), ch, k.strokes);
      else if (act === 'verify') { // per verificar → verificat → té errors → per verificar
        const all = Validar.VERIFIED;
        Store.setVerified(ch, all[(all.indexOf(k.verified) + 1) % all.length]); paintVer();
      }
      else if (act === 'delete' && confirm(t('card.deleteConfirm', { k: ch }))) {
        Store.remove(ch); U.toast(t('card.deleted', { k: ch })); App.back();
      }
    };
    if (ed) { // en canviar les lectures, s'actualitzen les opcions de lectura principal
      root.oninput = e => { if (/^(onyomi|kunyomi)$/.test(e.target.dataset.e || '')) paintMain(root); };
      return;
    }

    // Botó de verificació de tres estats i la pastilla de dalt (que no surt mentre està per verificar).
    const paintVer = () => {
      const v = U.ver(k.verified), btn = root.querySelector('[data-act="verify"]'), pill = root.querySelector('[data-ver-pill]');
      btn.className = `btn ver ver-${v.cls}`;
      btn.textContent = `${v.icon} ${t(v.key)}`;
      btn.setAttribute('aria-label', t('ver.label', { s: t(v.key) }));
      pill.className = `pill ver-${v.cls}`; pill.textContent = `${v.icon} ${t(v.key)}`; pill.hidden = v.cls === 'pending';
    };
    paintVer(); paintVerNow = paintVer;
    const so = root.querySelector('.so'); // només a les fitxes de kanji
    if (so) Traces.mount(so, ch, k.strokes);
    if (enter) { root.querySelector('.sheet').classList.add('enter-' + enter); enter = ''; }
    swipe(root);
  }

  // ---------- Mode edició ----------
  // Es corregeixen els textos de l'idioma de la interfície (els altres no es toquen) i es tria la lectura principal.
  const field = (label, input, hint = '') => `<label class="efld"><span>${esc(label)}</span>${input}${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;
  const inp = (key, value, attrs = '') => `<input data-e="${key}" value="${esc(value)}" autocomplete="off" ${attrs}>`;
  const area = (key, value, ph) => `<textarea data-e="${key}" rows="3" placeholder="${esc(ph)}">${esc(value)}</textarea>`;
  const splitList = s => String(s).split(/[,、，;]/).map(x => x.trim()).filter(Boolean);
  // Una opció per cada lectura (ニチ, た.べる…) amb el valor que es desa com a principal (にち, たべる).
  const mainOptions = (on, kun) => {
    const seen = new Set();
    return [...on, ...kun].map(r => ({ r, v: U.hira(U.plain(r)) })).filter(o => o.v && !seen.has(o.v) && seen.add(o.v));
  };
  // Botons de lectura principal: premut = triada; el número diu si és la 1a o la 2a.
  const mainChips = opts => opts.map(o => {
    const n = picks.indexOf(o.v) + 1;
    return `<button type="button" class="mchip" data-main-v="${esc(o.v)}" aria-pressed="${n > 0}"><span lang="ja">${esc(o.r)}</span>${n ? `<b>${n}</b>` : ''}</button>`;
  }).join('');
  // Si canvies les lectures, les opcions es refan i les triades que ja no hi són es treuen.
  function paintMain(root) {
    const opts = mainOptions(splitList(root.querySelector('[data-e="onyomi"]').value), splitList(root.querySelector('[data-e="kunyomi"]').value));
    picks = picks.filter(v => opts.some(o => o.v === v));
    root.querySelector('[data-main]').innerHTML = mainChips(opts);
  }

  function editSheet(k, word) {
    const l = I18n.lang, s = k.sentence;
    const own = p => (p && p[l]) || '', ph = p => (own(p) ? '' : I18n.tr(p)); // si en aquest idioma és buit, l'altre de pista
    const opts = word ? [] : mainOptions(k.onyomi, k.kunyomi);
    // Les lectures principals que ja té (una o dues), com a opcions: にち, o た per た.べる.
    const optFor = r => opts.find(o => o.v === r || U.hira(String(o.r).split('.')[0].replace(/-/g, '')) === r);
    picks = U.mains(k).map(optFor).filter(Boolean).map(o => o.v);
    picksStart = JSON.stringify(picks);
    const jlpt = `<select data-e="jlpt"><option value="">${esc(t('home.noLevel'))}</option>${[5, 4, 3, 2, 1].map(n => `<option value="${n}"${k.jlpt === n ? ' selected' : ''}>N${n}</option>`).join('')}</select>`;
    const save = `<button type="button" class="btn primary" data-act="save">✓ ${esc(t('card.save'))}</button>`, cancel = `<button type="button" class="btn" data-act="cancel">${esc(t('card.cancel'))}</button>`;
    return `<article class="sheet editing">
      <p class="edit-note">${esc(t('card.editing', { lang: I18n.name(l) }))}</p>
      <div class="edit-errors" role="alert" hidden></div>
      <div class="col">
        <section class="panel hero">
          <div class="hero-k${U.size(k.kanji)}" lang="ja">${esc(k.kanji)}</div>
          ${field(t('card.meanings'), inp('meanings', (k.meanings[l] || []).join(', '), `placeholder="${esc(I18n.list(k.meanings).join(', '))}"`), t('card.listHint'))}
          ${word ? field(t('card.wordReading'), inp('reading', k.reading, 'lang="ja"')) + field(t('card.wordReading2'), inp('reading2', k.reading2, 'lang="ja"')) : ''}
          <div class="erow">
            ${field('Emoji', inp('emoji', k.emoji))}
            ${field('JLPT', jlpt)}
            ${word ? '' : field(t('card.strokesLabel'), inp('strokes', k.strokes || '', 'inputmode="numeric"'))}
          </div>
        </section>
        ${word ? '' : `<section class="panel">
          <h2>${esc(t('card.readings'))}</h2>
          ${field(t('card.on'), inp('onyomi', k.onyomi.join(', '), 'lang="ja"'), t('card.listHint'))}
          ${field(t('card.kun'), inp('kunyomi', k.kunyomi.join(', '), 'lang="ja"'), t('card.listHint'))}
          <fieldset class="main-pick"><legend>${esc(t('card.mainPick'))}</legend><div class="mchips" data-main>${mainChips(opts)}</div>
            <p class="warn" data-main-max hidden>${esc(t('card.mainMax'))}</p></fieldset>
        </section>`}
      </div>
      <div class="col">
        <section class="panel mnemo"><h2>${esc(t('card.mnemonic'))}</h2>${area('mnemonic', own(k.mnemonic), ph(k.mnemonic))}</section>
        ${k.examples.length ? `<section class="panel"><h2>${esc(t('card.examples'))}</h2>${k.examples.map((e, i) => `<div class="eex">
          ${field(t('card.exWord'), inp(`ex.${i}.word`, e.word, 'lang="ja"'))}
          ${field(t('card.exReading'), inp(`ex.${i}.reading`, e.reading, 'lang="ja"'))}
          ${field(t('card.exMeaning'), inp(`ex.${i}.meaning`, own(e.meaning), `placeholder="${esc(ph(e.meaning))}"`))}</div>`).join('')}
          <p class="hint">${esc(t('card.exDeleteHint'))}</p></section>` : ''}
        <section class="panel"><h2>${esc(t('card.sentence'))}</h2>
          ${field(t('card.sentJp'), inp('s.jp', s.jp, 'lang="ja"'))}
          ${field(t('card.sentReading'), inp('s.reading', s.reading, 'lang="ja"'))}
          ${field(t('home.showRomaji'), inp('s.romaji', s.romaji))}
          ${field(t('card.sentMeaning'), inp('s.meaning', own(s.meaning), `placeholder="${esc(ph(s.meaning))}"`))}
        </section>
        <section class="panel"><h2>${esc(t('card.origin'))}</h2>${area('origin', own(k.origin), ph(k.origin))}</section>
        <section class="panel"><h2>${esc(t('card.trivia'))}</h2>${area('trivia', own(k.trivia), ph(k.trivia))}</section>
        <section class="panel check"><div class="row">${save}${cancel}</div></section>
      </div>
    </article>
    <div class="edit-bar" role="toolbar" aria-label="${esc(t('card.editingShort'))}"><span>✎ ${esc(t('card.editingShort'))}</span>${cancel}${save}</div>`;
  }

  // Desa les correccions. Torna false si hi ha errors (es mostren a dalt), 'same' si no has canviat res, o true.
  // Avisos que, si els escrius tu, són errors (no es desa res a mitges):
  const HARD = { 'val.example': 'card.exInvalid', 'val.emoji': 'card.emojiInvalid', 'val.romaji': 'card.romajiInvalid',
    'val.sentenceReading': 'val.sentenceReading', 'val.readingNotListed': 'card.mainMissing' };
  function save(root, k) {
    const v = key => { const el = root.querySelector(`[data-e="${key}"]`); return el ? el.value.trim() : ''; };
    const l = I18n.lang, word = U.isWord(k.kanji), raw = JSON.parse(JSON.stringify(k));
    raw.meanings[l] = splitList(v('meanings'));
    raw.emoji = v('emoji'); raw.jlpt = v('jlpt') ? +v('jlpt') : null;
    if (word) raw.reading = v('reading');
    else { raw.onyomi = splitList(v('onyomi')); raw.kunyomi = splitList(v('kunyomi')); raw.strokes = v('strokes') ? +v('strokes') : null; }
    // Lectures principals: d'un kanji, les que has triat (una o dues); d'una paraula, els dos camps de text.
    const mainChanged = !word && JSON.stringify(picks) !== picksStart, extra = [];
    if (mainChanged && !picks.length) extra.push(t('card.mainNone'));
    if (mainChanged && picks.length) raw.reading = picks[0];
    if (word && v('reading2') && !Validar.isKana(v('reading2'))) extra.push(t('card.reading2Invalid'));
    raw.mnemonic[l] = v('mnemonic'); raw.origin[l] = v('origin'); raw.trivia[l] = v('trivia');
    raw.examples = raw.examples.map((e, i) => ({ ...e, word: v(`ex.${i}.word`), reading: v(`ex.${i}.reading`), meaning: { ...e.meaning, [l]: v(`ex.${i}.meaning`) } }))
      .filter(e => e.word || e.reading); // buidar la paraula i la lectura = treure l'exemple
    raw.sentence = { ...raw.sentence, jp: v('s.jp'), reading: v('s.reading'), romaji: v('s.romaji'), meaning: { ...raw.sentence.meaning, [l]: v('s.meaning') } };

    const c = Validar.check(raw);
    const errs = [...extra, ...c.errors.map(x => t(x.k, x.p)), ...c.warnings.filter(w => HARD[w.k]).map(w => t(HARD[w.k], w.p))];
    if (errs.length) {
      const box = root.querySelector('.edit-errors');
      box.hidden = false;
      box.innerHTML = `<p>${esc(t('card.editErrors'))}</p><ul>${errs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
      box.scrollIntoView({ block: 'center' });
      return false;
    }
    const item = c.item, keep = { verified: k.verified, edited: k.edited, mainByUser: k.mainByUser };
    item.reading2 = word ? v('reading2') : mainChanged ? picks[1] || '' : k.reading2; // check() la buida: només la poses tu
    // «Corregida» només si has canviat algun text (no només les lectures principals d'un kanji).
    const neutral = word ? {} : { reading: k.reading, reading2: k.reading2 };
    const textChanged = JSON.stringify({ ...item, ...keep, ...neutral }) !== JSON.stringify(k);
    if (!textChanged && !mainChanged) return 'same';
    Object.assign(item, keep, { edited: k.edited || textChanged, mainByUser: k.mainByUser || mainChanged || (word && !!item.reading2) });
    Store.update(k.kanji, item);
    return true;
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
  // Teclat (ordinador): ← → fitxa anterior i següent; V «Verificat» i E «Té errors» (si ja ho era, torna a «Per
  // verificar»). Amb la mà esquerra marques i amb la dreta passes de fitxa.
  function key(e) {
    if (editing) return; // mentre edites, les tecles no fan res
    const kk = e.key.toLowerCase();
    if ((kk === 'v' || kk === 'e') && cur && Store.get(cur)) {
      e.preventDefault();
      const want = kk === 'v' ? true : 'error';
      Store.setVerified(cur, Store.get(cur).verified === want ? false : want);
      if (paintVerNow) paintVerNow();
      U.toast(`${cur} · ${t(U.ver(Store.get(cur).verified).key)}`);
      return;
    }
    const x = e.key === 'ArrowLeft' ? prev : e.key === 'ArrowRight' ? next : null;
    if (x) { e.preventDefault(); App.replace(U.kanjiHref(x.kanji)); }
  }
  return { nav: 'home', render, key };
})();
