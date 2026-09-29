// Calendari mensual de pràctica: cada dia es pinta segons quantes respostes hi vas donar (més intens = més pràctica).
const Calendari = (() => {
  const { esc } = U;
  const LEVELS = [1, 10, 20, 40, 60]; // respostes mínimes de cada nivell de color (1-5)
  let y = null, m = null, rootRef = null; // mes que es veu (m: 0-11) i la pantalla on es pinta
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const level = n => LEVELS.filter(x => n >= x).length;
  const range = (a, b) => (b ? `${a}–${b}` : `${a}+`);

  // Dies seguits practicant fins avui (o fins ahir, si avui encara no has practicat).
  function streak(h) {
    const d = new Date(); let n = 0;
    if (!h[iso(d)]) d.setDate(d.getDate() - 1);
    while (h[iso(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function render(root) {
    const now = new Date();
    if (y === null) { y = now.getFullYear(); m = now.getMonth(); }
    const h = Store.history, today = U.today(), thisMonth = y === now.getFullYear() && m === now.getMonth();
    const first = new Date(y, m, 1), size = new Date(y, m + 1, 0).getDate(), lead = (first.getDay() + 6) % 7; // setmana de dilluns a diumenge
    const days = Array.from({ length: size }, (_, i) => new Date(y, m, i + 1));
    const count = d => h[iso(d)] || 0;
    const practiced = days.filter(count).length, answers = days.reduce((a, d) => a + count(d), 0), st = streak(h);
    const week = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(I18n.locale, { weekday: 'short' })); // l'1-1-2024 era dilluns
    const cell = d => {
      const n = count(d), lv = level(n), key = iso(d), date = d.toLocaleDateString(I18n.locale, { day: 'numeric', month: 'long' });
      const label = t(n ? (n === 1 ? 'cal.cell1' : 'cal.cellN') : 'cal.cell0', { date, n });
      return `<li class="day${lv ? ' l' + lv : ''}${key === today ? ' is-today' : ''}${key > today ? ' future' : ''}" title="${esc(label)}">
        <b aria-hidden="true">${d.getDate()}</b>${n ? `<span aria-hidden="true">${n}</span>` : ''}<span class="sr">${esc(label)}</span></li>`;
    };
    const stat = (n, label) => `<div class="stat"><b>${n}</b><span>${esc(label)}</span></div>`;
    root.innerHTML = `
      <h1 class="h">${esc(t('cal.title'))}</h1>
      <section class="today cal-stats">
        ${stat(practiced, t('cal.days'))}${stat(answers, t('cal.answers'))}${stat(st, t(st === 1 ? 'cal.streak1' : 'cal.streak'))}
      </section>
      <section class="panel cal">
        <div class="cal-head">
          <button type="button" class="icon-btn" data-cal="prev" aria-label="${esc(t('cal.prev'))}" title="${esc(t('cal.prev'))}">${U.ICON.left}</button>
          <h2 class="cal-title" aria-live="polite">${esc(first.toLocaleDateString(I18n.locale, { month: 'long', year: 'numeric' }))}</h2>
          ${thisMonth ? '' : `<button type="button" class="btn small" data-cal="today">${esc(t('cal.today'))}</button>`}
          <button type="button" class="icon-btn" data-cal="next" aria-label="${esc(t('cal.next'))}" title="${esc(t('cal.next'))}"${thisMonth ? ' disabled' : ''}>${U.ICON.right}</button>
        </div>
        <div class="cal-week" aria-hidden="true">${week.map(w => `<span>${esc(w)}</span>`).join('')}</div>
        <ol class="cal-grid">${'<li class="blank" aria-hidden="true"></li>'.repeat(lead)}${days.map(cell).join('')}</ol>
        <div class="cal-legend"><span class="cap">${esc(t('cal.legend'))}</span>
          <ul>${['0', ...LEVELS.map((x, i) => range(x, LEVELS[i + 1] && LEVELS[i + 1] - 1))].map((r, i) => `<li><i${i ? ` class="l${i}"` : ''}></i>${r}</li>`).join('')}</ul></div>
        <p class="hint">${esc(Object.keys(h).length ? t('cal.hint') : t('cal.empty'))}</p>
      </section>`;
    root.onclick = e => {
      const b = e.target.closest('[data-cal]'); if (!b) return;
      move(b.dataset.cal); render(root);
    };
    rootRef = root;
  }
  function move(dir) {
    const now = new Date();
    if (dir === 'today') { y = now.getFullYear(); m = now.getMonth(); return; }
    const d = new Date(y, m + (dir === 'next' ? 1 : -1), 1);
    if (d > now) return; // no hi ha res a veure en el futur
    y = d.getFullYear(); m = d.getMonth();
  }
  // Fletxes del teclat: mes anterior i següent.
  function key(e) {
    const dir = e.key === 'ArrowLeft' ? 'prev' : e.key === 'ArrowRight' ? 'next' : null;
    if (dir && rootRef) { e.preventDefault(); move(dir); render(rootRef); }
  }
  return { nav: 'calendar', render, key };
})();
