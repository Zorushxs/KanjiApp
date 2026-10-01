// Ordre de traços animat amb dades de KanjiVG (© Ulrich Apel, CC BY-SA 3.0, https://kanjivg.tagaini.net).
// De l'SVG descarregat només se'n llegeixen els camins i els números; el dibuix el fa aquest codi.
const Traces = (() => {
  const { html } = U;
  const BASE ='https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@r20260714/kanji/';
  const NS = 'http://www.w3.org/2000/svg';
  const PATH = /^[MmLlHhVvCcSsQqTtAaZz0-9.,eE\s-]+$/;
  const cache = new Map();
  const file = ch => ch.codePointAt(0).toString(16).padStart(5, '0') + '.svg';
  const order = el => parseInt((/-s(\d+)$/.exec(el.id || '') || [])[1], 10) || 0;

  function parse(xml) {
    const doc = new DOMParser().parseFromString(xml, 'image/svg+xml');
    if (doc.querySelector('parsererror')) throw new Error('parse');
    const strokes = [...doc.querySelectorAll('path')].filter(p => /-s\d+$/.test(p.id))
      .sort((a, b) => order(a) - order(b)).map(p => p.getAttribute('d') || '').filter(d => PATH.test(d));
    const nums = [...doc.querySelectorAll('text')].map(tx => {
      const m = /matrix\(1 0 0 1 ([\d.]+) ([\d.]+)\)/.exec(tx.getAttribute('transform') || '');
      return m && { x: m[1], y: m[2], n: parseInt(tx.textContent, 10) || 0 };
    }).filter(x => x && x.n).sort((a, b) => a.n - b.n);
    if (!strokes.length) throw new Error('empty');
    return { strokes, nums };
  }
  // null = KanjiVG no té aquest kanji. Si falla la xarxa no es guarda a la memòria cau, per poder-ho reintentar.
  function load(ch) {
    if (!cache.has(ch)) {
      cache.set(ch, fetch(BASE + file(ch)).then(r => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text().then(parse);
      }).catch(e => { cache.delete(ch); throw e; }));
    }
    return cache.get(ch);
  }

  const el = (name, attrs, parent) => {
    const x = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([k, v]) => x.setAttribute(k, v));
    if (parent) parent.appendChild(x);
    return x;
  };
  function draw(box, { strokes, nums }) {
    const svg = el('svg', { viewBox: '0 0 109 109', class: 'so-svg', role: 'img', 'aria-label': t('card.strokeOrder') });
    el('path', { d: 'M54.5 3V106M3 54.5H106', class: 'so-grid' }, svg);
    const ghost = el('g', { class: 'so-ghost' }, svg), ink = el('g', { class: 'so-ink' }, svg), num = el('g', { class: 'so-num' }, svg);
    strokes.forEach(d => { el('path', { d }, ghost); el('path', { d }, ink); });
    nums.forEach(({ x, y, n }) => { el('text', { x, y }, num).textContent = n; });
    box.replaceChildren(svg);
    play(box);
  }
  // Dibuixa els traços un darrere l'altre; cada número apareix quan comença el seu traç.
  function play(box) {
    const paths = [...box.querySelectorAll('.so-ink path')], texts = [...box.querySelectorAll('.so-num text')];
    if (!paths.length) return;
    [...paths, ...texts].forEach(x => x.getAnimations && x.getAnimations().forEach(a => a.cancel()));
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches || !paths[0].animate;
    let at = 250;
    paths.forEach((p, i) => {
      const len = p.getTotalLength() + 1;
      p.style.strokeDasharray = `${len} ${len}`; p.style.strokeDashoffset = '0';
      if (still) return;
      const dur = 220 + len * 9;
      p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: dur, delay: at, easing: 'ease-in-out', fill: 'backwards' });
      if (texts[i]) texts[i].animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, delay: at, fill: 'backwards' });
      at += dur + 160;
    });
  }
  // Pinta l'ordre de traços de ch dins de box. expected: els traços que diu la fitxa (si no coincideixen, avisa).
  function mount(box, ch, expected) {
    const message = key => html`<p class="so-msg">${t(key)}</p>`;
    box.innerHTML = message('card.soLoading');
    load(ch).then(data => {
      if (!box.isConnected) return; // ja has canviat de pantalla
      if (!data) {
        box.innerHTML = message('card.soMissing');
        return;
      }
      draw(box, data);
      if (expected && expected !== data.strokes.length) {
        box.insertAdjacentHTML('beforeend',
          html`<p class="so-warn">${t('card.soMismatch', { a: expected, b: data.strokes.length })}</p>`);
      }
    }, () => {
      if (!box.isConnected) return;
      box.innerHTML = html`${message('card.soOffline')}
        <button type="button" class="btn small" data-act="so-retry">${t('card.soRetry')}</button>`;
    });
  }
  return { mount, play };
})();
