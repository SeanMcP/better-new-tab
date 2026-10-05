import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CACHE_TTL, cacheKey, defaultUnit, describeWeather, escapeHtml, forecastUrl, isFresh, parseDay, parseForecast, placeLabel,
  toUnit, windText,
} from '../extension/src/weather.js';

test('default unit by region', () => {
  assert.equal(defaultUnit('en-US'), 'fahrenheit');
  assert.equal(defaultUnit('en'), 'fahrenheit'); // "en" maximizes to en-Latn-US
  assert.equal(defaultUnit('en-GB'), 'celsius');
  assert.equal(defaultUnit('fr-FR'), 'celsius');
});

test('WMO codes map to labels and icons', () => {
  assert.deepEqual(describeWeather(0, true), { label: 'Clear', icon: 'clear' });
  assert.equal(describeWeather(0, false).icon, 'clearNight');
  assert.equal(describeWeather(2, false).icon, 'partlyNight');
  assert.equal(describeWeather(45).icon, 'fog');
  assert.equal(describeWeather(53).icon, 'drizzle');
  assert.equal(describeWeather(65).label, 'Heavy rain');
  assert.equal(describeWeather(81).icon, 'rain');
  assert.equal(describeWeather(75).icon, 'snow');
  assert.equal(describeWeather(96).icon, 'storm');
  assert.equal(describeWeather(1234).label, 'Unknown');
});

test('forecast URL fetches metric (converted locally)', () => {
  const url = new URL(forecastUrl({ latitude: 45.5, longitude: -122.6 }));
  assert.equal(url.host, 'api.open-meteo.com');
  assert.equal(url.searchParams.get('latitude'), '45.5');
  assert.equal(url.searchParams.has('temperature_unit'), false);
  assert.equal(url.searchParams.get('forecast_days'), '7');
});

test('unit conversion', () => {
  assert.equal(toUnit(0, 'fahrenheit'), 32);
  assert.equal(toUnit(100, 'fahrenheit'), 212);
  assert.equal(toUnit(-40, 'fahrenheit'), -40);
  assert.equal(toUnit(21.5, 'celsius'), 21.5);
  assert.equal(toUnit(null, 'fahrenheit'), null);
  assert.equal(windText(16.09344, 'fahrenheit'), '10 mph');
  assert.equal(windText(12.4, 'celsius'), '12 km/h');
});

test('parses an Open-Meteo response', () => {
  const json = {
    current: { temperature_2m: 60.6, apparent_temperature: 59.5, weather_code: 0, wind_speed_10m: 7.7, is_day: 1 },
    daily: {
      time: ['2026-10-05', '2026-10-06'],
      weather_code: [3, 61],
      temperature_2m_max: [70.6, 59.9],
      temperature_2m_min: [52.5, 41.8],
      precipitation_probability_max: [5, 80],
    },
  };
  const forecast = parseForecast(json);
  assert.equal(forecast.current.temperature, 60.6);
  assert.equal(forecast.current.isDay, true);
  assert.equal(forecast.days.length, 2);
  assert.deepEqual(forecast.days[1], { day: '2026-10-06', code: 61, max: 59.9, min: 41.8, precipitation: 80 });
});

test('parseDay is local midnight', () => {
  const d = parseDay('2026-10-05');
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()], [2026, 9, 5, 0]);
});

test('place labels', () => {
  assert.equal(placeLabel({ name: 'Portland', admin1: 'Oregon', country: 'United States' }), 'Portland, Oregon');
  assert.equal(placeLabel({ name: 'Singapore', admin1: 'Singapore', country: 'Singapore' }), 'Singapore, Singapore');
  assert.equal(placeLabel({ name: 'Monaco', country: 'Monaco' }), 'Monaco, Monaco');
  assert.equal(placeLabel({ name: 'Nowhere' }), 'Nowhere');
});

test('cache freshness', () => {
  const key = cacheKey({ latitude: 1.23456, longitude: 2 });
  assert.equal(key, '1.235,2.000');
  const now = 1_000_000_000;
  assert.equal(isFresh({ key, fetchedAt: now - CACHE_TTL + 1 }, key, now), true);
  assert.equal(isFresh({ key, fetchedAt: now - CACHE_TTL }, key, now), false);
  assert.equal(isFresh({ key: 'other', fetchedAt: now }, key, now), false);
  assert.equal(isFresh(undefined, key, now), false);
});

test('escapes HTML from API results', () => {
  assert.equal(escapeHtml('<img src=x onerror="a">&\''), '&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;');
});
