// Clock with optional time zone, 12/24h and seconds.

import { icons } from './icons.js';
import { createPopover } from './popover.js';
import { storage } from './storage.js';

export const SETTINGS_KEY = 'clockSettings';
export const DEFAULT_SETTINGS = { timeZone: '', hour12: null, showSeconds: false };

export function defaultHour12(locale) {
  const { hourCycle } = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions();
  return hourCycle === 'h11' || hourCycle === 'h12';
}

/** "Asia/Tokyo" → "Tokyo", "America/Argentina/Buenos_Aires" → "Buenos Aires". */
export function zoneCity(timeZone) {
  return timeZone.split('/').pop().replaceAll('_', ' ');
}

/**
 * Formats `date` for display. Returns the time without its day period (AM/PM) so the period
 * can be styled separately.
 */
export function formatClock(date, { locale, timeZone, hour12, showSeconds }) {
  const zone = timeZone || undefined;
  const use12 = hour12 ?? defaultHour12(locale);
  const parts = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined,
    hour12: use12,
    timeZone: zone,
  }).formatToParts(date);

  const period = parts.find((p) => p.type === 'dayPeriod')?.value ?? '';
  const time = parts
    .filter((p) => p.type !== 'dayPeriod')
    .map((p) => p.value)
    .join('')
    .trim();

  const dateText = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: zone,
  }).format(date);

  return { time, period, date: dateText };
}

export function timeZones() {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return [];
  }
}

// ---- Widget ---------------------------------------------------------------------------------

export async function mountClock(root, { toolbar, locale = navigator.language, onDayChange = () => {} } = {}) {
  let settings = { ...DEFAULT_SETTINGS, ...(await storage.get(SETTINGS_KEY)) };
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  root.innerHTML = `
    <div class="clock-face">
      <div class="clock-time"><span class="clock-digits"></span><span class="clock-period"></span></div>
      <div class="clock-date"></div>
    </div>
  `;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'icon-button';
  button.setAttribute('aria-label', 'Clock settings');
  button.innerHTML = icons.gear;

  const form = document.createElement('form');
  form.className = 'popover clock-settings';
  form.setAttribute('aria-label', 'Clock settings');
  form.hidden = true;
  form.innerHTML = `
      <label>Time zone
        <select name="timeZone">
          <option value="">Local (${zoneCity(localZone)})</option>
          ${timeZones()
            .map((zone) => `<option value="${zone}">${zone.replaceAll('_', ' ')}</option>`)
            .join('')}
        </select>
      </label>
      <label>Format
        <select name="hour12">
          <option value="">Automatic</option>
          <option value="true">12-hour</option>
          <option value="false">24-hour</option>
        </select>
      </label>
      <label class="checkbox"><input type="checkbox" name="showSeconds"> Show seconds</label>
  `;
  toolbar.append(button, form);
  createPopover(button, form);

  const digits = root.querySelector('.clock-digits');
  const period = root.querySelector('.clock-period');
  const dateEl = root.querySelector('.clock-date');

  function syncForm() {
    form.timeZone.value = settings.timeZone;
    form.hour12.value = settings.hour12 == null ? '' : String(settings.hour12);
    form.showSeconds.checked = settings.showSeconds;
  }

  let lastLocalDay = new Date().toDateString();
  let timer;

  function tick() {
    const now = new Date();
    const view = formatClock(now, { locale, ...settings });
    digits.textContent = view.time;
    period.textContent = view.period;
    const zoneLabel = settings.timeZone ? ` · ${zoneCity(settings.timeZone)}` : '';
    dateEl.textContent = view.date + zoneLabel;

    if (now.toDateString() !== lastLocalDay) {
      lastLocalDay = now.toDateString();
      onDayChange();
    }
    // Align the next tick to the start of the next second (or minute, without seconds).
    const interval = settings.showSeconds ? 1000 : 60_000;
    clearTimeout(timer);
    timer = setTimeout(tick, interval - (now.getTime() % interval) + 5);
  }

  form.addEventListener('change', () => {
    settings = {
      timeZone: form.timeZone.value,
      hour12: form.hour12.value === '' ? null : form.hour12.value === 'true',
      showSeconds: form.showSeconds.checked,
    };
    storage.set(SETTINGS_KEY, settings);
    tick();
  });

  storage.onChange((key, value) => {
    if (key !== SETTINGS_KEY) return;
    settings = { ...DEFAULT_SETTINGS, ...value };
    syncForm();
    tick();
  });

  // Timers are throttled in background tabs; resync when the tab becomes visible.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tick();
  });

  syncForm();
  tick();
}
