// Calendari mensual de pràctica: cada dia es pinta segons quantes respostes hi vas donar (més intens = més pràctica).
const Calendari = (() => {
  const { html } = U;
  const LEVELS = [1, 10, 20, 40, 60]; // respostes mínimes de cada nivell de color (1-5)
  let year = null, month = null; // mes que es veu (month: 0-11)
  let screenRoot = null;         // on es pinta (per a les fletxes del teclat)

  const colorLevel = answers => LEVELS.filter(min => answers >= min).length;
  const range = (from, to) => (to ? `${from}–${to}` : `${from}+`);

  // Dies seguits practicant fins avui (o fins ahir, si avui encara no has practicat).
  function streak(history) {
    const date = new Date();
    let n = 0;
    if (!history[U.iso(date)]) date.setDate(date.getDate() - 1);
    while (history[U.iso(date)]) {
      n++;
      date.setDate(date.getDate() - 1);
    }
    return n;
  }

  function render(root) {
    const now = new Date();
    if (year === null) {
      year = now.getFullYear();
      month = now.getMonth();
    }
    const history = Store.history;
    const first = new Date(year, month, 1);
    const days = Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) => new Date(year, month, i + 1));
    const answersOn = date => history[U.iso(date)] || 0;
    const practiced = days.filter(answersOn).length;
    const answers = days.reduce((sum, date) => sum + answersOn(date), 0);
    const daysInARow = streak(history);
    const isThisMonth = year === now.getFullYear() && month === now.getMonth();
    const stat = (n, label) => html`<div class="stat"><b>${n}</b><span>${label}</span></div>`;

    root.innerHTML = html`
      <h1 class="h">${t('cal.title')}</h1>
      <section class="today cal-stats">
        ${stat(practiced, t('cal.days'))}${stat(answers, t('cal.answers'))}${stat(daysInARow, t(daysInARow === 1 ? 'cal.streak1' : 'cal.streak'))}
      </section>
      <section class="panel cal">
        <div class="cal-head">
          <button type="button" class="icon-btn" data-act="month" data-cal="prev"
            aria-label="${t('cal.prev')}" title="${t('cal.prev')}">${U.ICON.left}</button>
          <h2 class="cal-title" aria-live="polite">${first.toLocaleDateString(I18n.locale, { month: 'long', year: 'numeric' })}</h2>
          ${isThisMonth ? '' : html`<button type="button" class="btn small" data-act="month" data-cal="today">${t('cal.today')}</button>`}
          <button type="button" class="icon-btn" data-act="month" data-cal="next"
            aria-label="${t('cal.next')}" title="${t('cal.next')}"${isThisMonth ? html` disabled` : ''}>${U.ICON.right}</button>
        </div>
        <div class="cal-week" aria-hidden="true">${weekdayNames().map(name => html`<span>${name}</span>`)}</div>
        <ol class="cal-grid">${blankDays(first)}${days.map(date => dayCell(date, answersOn(date)))}</ol>
        ${legend()}
        <p class="hint">${Object.keys(history).length ? t('cal.hint') : t('cal.empty')}</p>
      </section>`;
    U.onActions(root, { month: button => go(button.dataset.cal) });
    screenRoot = root;
  }

  // Dl, dt, dc… en l'idioma triat. L'1 de gener de 2024 va ser dilluns.
  const weekdayNames = () => Array.from({ length: 7 },
    (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(I18n.locale, { weekday: 'short' }));
  // Caselles buides abans del dia 1 (la setmana va de dilluns a diumenge).
  const blankDays = first => Array((first.getDay() + 6) % 7).fill(html`<li class="blank" aria-hidden="true"></li>`);

  function dayCell(date, answers) {
    const day = U.iso(date), today = U.today(), level = colorLevel(answers);
    const name = date.toLocaleDateString(I18n.locale, { day: 'numeric', month: 'long' });
    const label = t(answers ? (answers === 1 ? 'cal.cell1' : 'cal.cellN') : 'cal.cell0', { date: name, n: answers });
    const classes = ['day', level ? 'l' + level : '', day === today ? 'is-today' : '', day > today ? 'future' : ''];
    return html`<li class="${classes.filter(Boolean).join(' ')}" title="${label}">
        <b aria-hidden="true">${date.getDate()}</b>${answers
          ? html`<span aria-hidden="true">${answers}</span>` : ''}<span class="sr">${label}</span></li>`;
  }

  // Llegenda: cada color amb el rang de respostes que representa (0, 1–9, 10–19…).
  function legend() {
    const ranges = ['0', ...LEVELS.map((min, i) => range(min, LEVELS[i + 1] && LEVELS[i + 1] - 1))];
    return html`<div class="cal-legend"><span class="cap">${t('cal.legend')}</span>
        <ul>${ranges.map((text, i) => html`<li><i${i ? html` class="l${i}"` : ''}></i>${text}</li>`)}</ul></div>`;
  }

  // Mes anterior, següent o l'actual; al futur no s'hi pot anar.
  function go(direction) {
    const now = new Date();
    if (direction === 'today') {
      year = now.getFullYear();
      month = now.getMonth();
    } else {
      const date = new Date(year, month + (direction === 'next' ? 1 : -1), 1);
      if (date > now) return;
      year = date.getFullYear();
      month = date.getMonth();
    }
    render(screenRoot);
  }

  // Fletxes del teclat: mes anterior i següent.
  function key(e) {
    const direction = e.key === 'ArrowLeft' ? 'prev' : e.key === 'ArrowRight' ? 'next' : null;
    if (direction && screenRoot) {
      e.preventDefault();
      go(direction);
    }
  }

  return { nav: 'calendar', render, key };
})();
