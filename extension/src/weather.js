// Weather from Open-Meteo (free, no API key): https://open-meteo.com

import { icons } from './icons.js';
import { storage } from './storage.js';

// Open-Meteo refreshes current conditions every 15 minutes, so a newer response would be identical.
export const CACHE_TTL = 15 * 60 * 1000;
const KEYS = { location: 'weatherLocation', unit: 'weatherUnit', cache: 'weatherCache' };

// Regions that use Fahrenheit by default.
const FAHRENHEIT_REGIONS = new Set(['US', 'LR', 'MM', 'BS', 'BZ', 'KY', 'PW', 'FM', 'MH']);

export function defaultUnit(locale) {
  try {
    const region = new Intl.Locale(locale).maximize().region;
    return FAHRENHEIT_REGIONS.has(region) ? 'fahrenheit' : 'celsius';
  } catch {
    return 'celsius';
  }
}

/** Maps a WMO weather code to a label and icon name. */
export function describeWeather(code, isDay = true) {
  if (code === 0) return { label: 'Clear', icon: isDay ? 'clear' : 'clearNight' };
  if (code === 1) return { label: 'Mostly clear', icon: isDay ? 'clear' : 'clearNight' };
  if (code === 2) return { label: 'Partly cloudy', icon: isDay ? 'partly' : 'partlyNight' };
  if (code === 3) return { label: 'Overcast', icon: 'cloud' };
  if (code === 45 || code === 48) return { label: 'Fog', icon: 'fog' };
  if (code >= 51 && code <= 57) return { label: code >= 56 ? 'Freezing drizzle' : 'Drizzle', icon: 'drizzle' };
  if (code >= 61 && code <= 67) {
    const label = code >= 66 ? 'Freezing rain' : code === 65 ? 'Heavy rain' : code === 61 ? 'Light rain' : 'Rain';
    return { label, icon: 'rain' };
  }
  if (code >= 71 && code <= 77) return { label: code === 75 ? 'Heavy snow' : 'Snow', icon: 'snow' };
  if (code >= 80 && code <= 82) return { label: code === 82 ? 'Heavy showers' : 'Showers', icon: 'rain' };
  if (code === 85 || code === 86) return { label: 'Snow showers', icon: 'snow' };
  if (code >= 95 && code <= 99) return { label: 'Thunderstorm', icon: 'storm' };
  return { label: 'Unknown', icon: 'cloud' };
}

export function forecastUrl({ latitude, longitude }) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: '7',
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

export function geocodeUrl(query) {
  const params = new URLSearchParams({ name: query, count: '6', language: 'en', format: 'json' });
  return `https://geocoding-api.open-meteo.com/v1/search?${params}`;
}

/** "YYYY-MM-DD" → local Date at midnight (not UTC, which would shift the day). */
export function parseDay(isoDay) {
  const [y, m, d] = isoDay.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Open-Meteo returns °C and km/h by default; we fetch once and convert for display. */
export function toUnit(celsius, unit) {
  if (celsius == null) return null;
  return unit === 'fahrenheit' ? (celsius * 9) / 5 + 32 : celsius;
}

export function windText(kmh, unit) {
  if (kmh == null) return '';
  return unit === 'fahrenheit' ? `${Math.round(kmh / 1.609344)} mph` : `${Math.round(kmh)} km/h`;
}

export function parseForecast(json) {
  const { current, daily } = json;
  return {
    current: {
      temperature: current.temperature_2m,
      feelsLike: current.apparent_temperature,
      code: current.weather_code,
      isDay: current.is_day === 1,
      wind: current.wind_speed_10m,
    },
    days: daily.time.map((day, i) => ({
      day,
      code: daily.weather_code[i],
      max: daily.temperature_2m_max[i],
      min: daily.temperature_2m_min[i],
      precipitation: daily.precipitation_probability_max?.[i] ?? null,
    })),
  };
}

export function placeLabel(result) {
  const region = result.admin1 && result.admin1 !== result.name ? result.admin1 : result.country;
  return region ? `${result.name}, ${region}` : result.name;
}

export function cacheKey(location) {
  return `${location.latitude.toFixed(3)},${location.longitude.toFixed(3)}`;
}

export function isFresh(cache, key, now = Date.now()) {
  return Boolean(cache && cache.key === key && now - cache.fetchedAt < CACHE_TTL);
}

export const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const round = (n) => (n == null || Number.isNaN(n) ? '–' : Math.round(n));

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// ---- Widget ---------------------------------------------------------------------------------

export async function mountWeather(root, { locale = navigator.language } = {}) {
  let location = await storage.get(KEYS.location);
  let unit = (await storage.get(KEYS.unit)) ?? defaultUnit(locale);
  const dayFormat = new Intl.DateTimeFormat(locale, { weekday: 'short' });

  root.innerHTML = `
    <header class="card-header weather-header">
      <button type="button" class="weather-place" aria-label="Change location">
        ${icons.location}<span class="weather-place-name"></span>
      </button>
      <div class="unit-toggle" role="group" aria-label="Temperature unit">
        <button type="button" data-unit="fahrenheit">°F</button>
        <button type="button" data-unit="celsius">°C</button>
      </div>
    </header>
    <div class="weather-body"></div>
  `;

  const placeName = root.querySelector('.weather-place-name');
  const body = root.querySelector('.weather-body');

  function syncHeader() {
    placeName.textContent = location ? location.name : 'Set location';
    for (const button of root.querySelectorAll('[data-unit]')) {
      button.setAttribute('aria-pressed', String(button.dataset.unit === unit));
    }
  }

  let lastForecast = null;
  // City search results for this page's lifetime; place names don't change.
  const searchCache = new Map();

  function renderForecast(forecast) {
    lastForecast = forecast;
    const { current, days } = forecast;
    const t = (celsius) => round(toUnit(celsius, unit));
    const now = describeWeather(current.code, current.isDay);
    const today = days[0];
    body.innerHTML = `
      <div class="weather-now">
        <div class="weather-now-icon">${icons[now.icon]}</div>
        <div class="weather-now-temp">${t(current.temperature)}°</div>
        <div class="weather-now-detail">
          <div class="weather-now-label">${now.label}</div>
          <div class="muted">Feels like ${t(current.feelsLike)}° · H ${t(today?.max)}° L ${t(today?.min)}°</div>
          <div class="muted">Wind ${windText(current.wind, unit)}</div>
        </div>
      </div>
      <ol class="weather-days">
        ${days
          .map((d, i) => {
            const info = describeWeather(d.code, true);
            const name = i === 0 ? 'Today' : dayFormat.format(parseDay(d.day));
            const rain = d.precipitation >= 10 ? `<span class="weather-rain">${d.precipitation}%</span>` : '<span class="weather-rain"></span>';
            return `<li title="${info.label}">
              <span class="weather-day-name">${name}</span>
              <span class="weather-day-icon">${icons[info.icon]}</span>
              ${rain}
              <span class="weather-day-temps"><strong>${t(d.max)}°</strong> <span class="muted">${t(d.min)}°</span></span>
            </li>`;
          })
          .join('')}
      </ol>
    `;
  }

  function renderMessage(message, { retry = false } = {}) {
    body.innerHTML = `
      <div class="weather-message">
        <p>${message}</p>
        ${retry ? '<button type="button" class="pill-button" data-action="retry">Try again</button>' : ''}
        <button type="button" class="pill-button" data-action="change">Choose location</button>
      </div>`;
  }

  let inflight = null; // { key, request }

  async function load({ force = false } = {}) {
    syncHeader();
    if (!location) {
      renderPicker();
      return;
    }
    const key = cacheKey(location);
    const cache = await storage.get(KEYS.cache);
    if (cache?.key === key) renderForecast(cache.data); // show stale data immediately
    if (!force && isFresh(cache, key)) return;
    if (cache?.key !== key) body.innerHTML = '<p class="muted weather-loading">Loading forecast…</p>';

    try {
      // Overlapping loads (e.g. page load plus a visibilitychange) share one request.
      if (inflight?.key !== key) {
        const request = fetchJson(forecastUrl(location)).then(async (json) => {
          const data = parseForecast(json);
          await storage.set(KEYS.cache, { key, fetchedAt: Date.now(), data });
          return data;
        });
        inflight = { key, request };
        request.finally(() => {
          if (inflight?.request === request) inflight = null;
        }).catch(() => {});
      }
      renderForecast(await inflight.request);
    } catch (error) {
      console.warn('Weather fetch failed', error);
      if (cache?.key !== key) renderMessage("Couldn't load the forecast.", { retry: true });
    }
  }

  async function setLocation(next) {
    location = next;
    await storage.set(KEYS.location, location);
    load();
  }

  function renderPicker() {
    body.innerHTML = `
      <form class="weather-picker" autocomplete="off">
        <label class="visually-hidden" for="weather-search">City</label>
        <input id="weather-search" name="query" type="search" placeholder="Search for a city" required>
        <ul class="weather-results" role="listbox"></ul>
        <div class="weather-picker-actions">
          <button type="button" class="pill-button" data-action="geolocate">${icons.location} Use my location</button>
          ${location ? '<button type="button" class="pill-button" data-action="cancel">Cancel</button>' : ''}
        </div>
        <p class="muted weather-picker-status" aria-live="polite"></p>
      </form>`;

    const form = body.querySelector('form');
    const input = form.query;
    const results = form.querySelector('.weather-results');
    const status = form.querySelector('.weather-picker-status');
    let found = [];
    let searchTimer;
    let searchId = 0;

    async function search() {
      const query = input.value.trim();
      const id = ++searchId;
      if (query.length < 2) {
        results.innerHTML = '';
        return;
      }
      try {
        if (!searchCache.has(query.toLowerCase())) searchCache.set(query.toLowerCase(), fetchJson(geocodeUrl(query)));
        const json = await searchCache.get(query.toLowerCase()).catch((error) => {
          searchCache.delete(query.toLowerCase()); // don't cache failures
          throw error;
        });
        if (id !== searchId) return; // a newer search started
        found = json.results ?? [];
        status.textContent = found.length ? '' : 'No matches.';
        results.innerHTML = found
          .map(
            (r, i) =>
              `<li><button type="button" data-index="${i}">${escapeHtml(r.name)}<span class="muted">${escapeHtml([r.admin1, r.country].filter(Boolean).join(', '))}</span></button></li>`,
          )
          .join('');
      } catch {
        status.textContent = "Couldn't search right now.";
      }
    }

    input.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(search, 250);
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearTimeout(searchTimer);
      await search();
      results.querySelector('button')?.focus();
    });
    results.addEventListener('click', (event) => {
      const index = event.target.closest('[data-index]')?.dataset.index;
      if (index == null) return;
      const r = found[Number(index)];
      setLocation({ name: placeLabel(r), latitude: r.latitude, longitude: r.longitude });
    });
    form.addEventListener('click', (event) => {
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (action === 'cancel') load();
      if (action === 'geolocate') {
        status.textContent = 'Finding you…';
        navigator.geolocation.getCurrentPosition(
          ({ coords }) => setLocation({ name: 'My location', latitude: coords.latitude, longitude: coords.longitude }),
          () => (status.textContent = 'Location unavailable. Try searching instead.'),
          { timeout: 10_000, maximumAge: 60 * 60 * 1000 },
        );
      }
    });
    input.focus();
  }

  root.addEventListener('click', (event) => {
    if (event.target.closest('.weather-place')) {
      renderPicker();
      return;
    }
    const unitButton = event.target.closest('[data-unit]');
    if (unitButton && unitButton.dataset.unit !== unit) {
      unit = unitButton.dataset.unit;
      storage.set(KEYS.unit, unit);
      syncHeader();
      if (lastForecast && body.querySelector('.weather-now')) renderForecast(lastForecast);
      return;
    }
    const action = event.target.closest('.weather-message [data-action]')?.dataset.action;
    if (action === 'retry') load({ force: true });
    if (action === 'change') renderPicker();
  });

  // Refresh when coming back to a tab that's been open a while.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && location) load();
  });

  load();
}
