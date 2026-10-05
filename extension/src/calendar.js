// Browsable month calendar.

export const ROWS = 6;
export const COLUMNS = 7;

/**
 * First day of the week for a locale, as 0 (Sunday) – 6 (Saturday).
 * Intl reports ISO numbering (1 = Monday … 7 = Sunday).
 */
export function firstDayOfWeek(locale) {
  try {
    const loc = new Intl.Locale(locale);
    const info = loc.getWeekInfo?.() ?? loc.weekInfo;
    if (info?.firstDay) return info.firstDay % 7;
  } catch {
    // Unknown locale: fall through.
  }
  return 0;
}

/** Narrow weekday labels ("S", "M", …) ordered to start on `firstDay`. */
export function weekdayLabels(locale, firstDay) {
  const format = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
  // 2023-01-01 was a Sunday.
  return Array.from({ length: 7 }, (_, i) => format.format(new Date(2023, 0, 1 + ((firstDay + i) % 7))));
}

export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * A fixed 6×7 grid for the month containing (year, month).
 * `month` may be out of range (e.g. -1 or 12); Date normalizes it across years.
 */
export function buildMonth(year, month, { firstDay = 0, today = new Date() } = {}) {
  const first = new Date(year, month, 1);
  const leading = (first.getDay() - firstDay + 7) % 7;
  const days = [];
  for (let i = 0; i < ROWS * COLUMNS; i++) {
    // Constructing from parts (not adding milliseconds) keeps this correct across DST changes.
    const date = new Date(first.getFullYear(), first.getMonth(), 1 - leading + i);
    days.push({
      date,
      day: date.getDate(),
      inMonth: date.getMonth() === first.getMonth(),
      isToday: sameDay(date, today),
    });
  }
  const weeks = [];
  for (let i = 0; i < days.length; i += COLUMNS) weeks.push(days.slice(i, i + COLUMNS));
  return { year: first.getFullYear(), month: first.getMonth(), weeks };
}

// ---- Widget ---------------------------------------------------------------------------------

export function mountCalendar(root, { locale = navigator.language, now = () => new Date() } = {}) {
  const firstDay = firstDayOfWeek(locale);
  const labels = weekdayLabels(locale, firstDay);
  const titleFormat = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  const dayFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'full' });

  let offset = 0; // months from the current month

  root.innerHTML = `
    <header class="card-header calendar-header">
      <h2 class="calendar-title" aria-live="polite"></h2>
      <div class="calendar-nav">
        <button type="button" class="pill-button" data-action="today" hidden>Today</button>
        <button type="button" class="icon-button" data-action="prev" aria-label="Previous month">‹</button>
        <button type="button" class="icon-button" data-action="next" aria-label="Next month">›</button>
      </div>
    </header>
    <div class="calendar-grid" role="grid">
      <div class="calendar-weekdays" role="row">
        ${labels.map((label) => `<span role="columnheader">${label}</span>`).join('')}
      </div>
      <div class="calendar-days"></div>
    </div>
  `;

  const title = root.querySelector('.calendar-title');
  const daysEl = root.querySelector('.calendar-days');
  const todayButton = root.querySelector('[data-action="today"]');

  function render() {
    const today = now();
    const grid = buildMonth(today.getFullYear(), today.getMonth() + offset, { firstDay, today });
    title.textContent = titleFormat.format(new Date(grid.year, grid.month, 1));
    todayButton.hidden = offset === 0;
    daysEl.innerHTML = grid.weeks
      .map(
        (week) =>
          `<div class="calendar-week" role="row">${week
            .map((d) => {
              const classes = ['calendar-day', d.inMonth ? '' : 'is-outside', d.isToday ? 'is-today' : '']
                .filter(Boolean)
                .join(' ');
              const current = d.isToday ? ' aria-current="date"' : '';
              return `<span class="${classes}" role="gridcell" title="${dayFormat.format(d.date)}"${current}>${d.day}</span>`;
            })
            .join('')}</div>`,
      )
      .join('');
  }

  root.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'prev') offset -= 1;
    else if (action === 'next') offset += 1;
    else if (action === 'today') offset = 0;
    else return;
    render();
  });

  // Scroll over the calendar to browse months.
  let wheelLock = 0;
  root.addEventListener(
    'wheel',
    (event) => {
      if (Math.abs(event.deltaY) < 10 || event.timeStamp - wheelLock < 250) return;
      event.preventDefault();
      wheelLock = event.timeStamp;
      offset += event.deltaY > 0 ? 1 : -1;
      render();
    },
    { passive: false },
  );

  render();
  return { render };
}
