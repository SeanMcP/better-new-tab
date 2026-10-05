import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildMonth, firstDayOfWeek, weekdayLabels } from '../extension/src/calendar.js';

const numbers = (week) => week.map((d) => d.day);

describe('buildMonth', () => {
  test('is always 6 rows of 7', () => {
    for (let month = 0; month < 12; month++) {
      const grid = buildMonth(2026, month);
      assert.equal(grid.weeks.length, 6);
      assert.ok(grid.weeks.every((w) => w.length === 7));
    }
  });

  test('Sunday-first October 2026 (starts Thursday)', () => {
    const grid = buildMonth(2026, 9, { firstDay: 0 });
    assert.deepEqual(numbers(grid.weeks[0]), [27, 28, 29, 30, 1, 2, 3]);
    assert.deepEqual(grid.weeks[0].map((d) => d.inMonth), [false, false, false, false, true, true, true]);
    assert.deepEqual(numbers(grid.weeks[5]), [1, 2, 3, 4, 5, 6, 7]);
  });

  test('Monday-first October 2026', () => {
    const grid = buildMonth(2026, 9, { firstDay: 1 });
    assert.deepEqual(numbers(grid.weeks[0]), [28, 29, 30, 1, 2, 3, 4]);
  });

  test('month starting on the first weekday has no leading days', () => {
    // February 2026 starts on a Sunday.
    const grid = buildMonth(2026, 1, { firstDay: 0 });
    assert.equal(grid.weeks[0][0].day, 1);
    assert.equal(grid.weeks[0][0].inMonth, true);
  });

  test('leap-year February', () => {
    const inMonth = buildMonth(2028, 1).weeks.flat().filter((d) => d.inMonth);
    assert.equal(inMonth.length, 29);
  });

  test('out-of-range months roll across years', () => {
    assert.deepEqual([buildMonth(2026, 12).year, buildMonth(2026, 12).month], [2027, 0]);
    assert.deepEqual([buildMonth(2026, -1).year, buildMonth(2026, -1).month], [2025, 11]);
    assert.deepEqual(numbers(buildMonth(2026, 12, { firstDay: 0 }).weeks[0]), [27, 28, 29, 30, 31, 1, 2]);
  });

  test('flags today only in the right month', () => {
    const today = new Date(2026, 9, 5, 15, 30);
    assert.deepEqual(buildMonth(2026, 9, { today }).weeks.flat().filter((d) => d.isToday).map((d) => d.day), [5]);
    assert.equal(buildMonth(2026, 10, { today }).weeks.flat().some((d) => d.isToday), false);
  });

  test('consecutive days across a DST change', () => {
    // US DST ends 2026-11-01; dates must still step one calendar day at a time.
    const days = buildMonth(2026, 10, { firstDay: 0 }).weeks.flat();
    for (let i = 1; i < days.length; i++) {
      const prev = days[i - 1].date;
      const expected = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1);
      assert.equal(days[i].date.getTime(), expected.getTime());
    }
  });
});

describe('locale helpers', () => {
  test('first day of week', () => {
    assert.equal(firstDayOfWeek('en-US'), 0);
    assert.equal(firstDayOfWeek('en-GB'), 1);
    assert.equal(firstDayOfWeek('de-DE'), 1);
    assert.equal(firstDayOfWeek('not a locale!'), 0);
  });

  test('weekday labels follow the first day', () => {
    assert.deepEqual(weekdayLabels('en-US', 0), ['S', 'M', 'T', 'W', 'T', 'F', 'S']);
    assert.deepEqual(weekdayLabels('en-US', 1), ['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  });
});
