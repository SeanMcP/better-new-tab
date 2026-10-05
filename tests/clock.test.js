import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultHour12, formatClock, zoneCity } from '../extension/src/clock.js';

const instant = new Date(Date.UTC(2026, 9, 5, 18, 7, 9)); // 18:07:09 UTC

test('12-hour time splits off the day period', () => {
  const view = formatClock(instant, { locale: 'en-US', timeZone: 'America/New_York', hour12: true, showSeconds: false });
  assert.equal(view.time, '2:07');
  assert.equal(view.period, 'PM');
  assert.equal(view.date, 'Monday, October 5');
});

test('24-hour time with seconds', () => {
  const view = formatClock(instant, { locale: 'en-GB', timeZone: 'Europe/London', hour12: false, showSeconds: true });
  assert.equal(view.time, '19:07:09');
  assert.equal(view.period, '');
});

test('time zone changes the date too', () => {
  const view = formatClock(instant, { locale: 'en-US', timeZone: 'Pacific/Kiritimati', hour12: false, showSeconds: false });
  assert.equal(view.date, 'Tuesday, October 6');
});

test('automatic hour cycle follows the locale', () => {
  assert.equal(defaultHour12('en-US'), true);
  assert.equal(defaultHour12('de-DE'), false);
  const auto = formatClock(instant, { locale: 'de-DE', timeZone: 'Europe/Berlin', hour12: null, showSeconds: false });
  assert.equal(auto.time, '20:07');
});

test('zone city labels', () => {
  assert.equal(zoneCity('Asia/Tokyo'), 'Tokyo');
  assert.equal(zoneCity('America/Argentina/Buenos_Aires'), 'Buenos Aires');
});
