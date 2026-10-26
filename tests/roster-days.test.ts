import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthDays } from '../app/roster/days.ts';

test('monthDays: one entry per day with weekday labels', () => {
  const days = monthDays('2026-10', '2026-10-26');
  assert.equal(days.length, 31);
  assert.deepEqual(days[0], { d: 1, date: '2026-10-01', short: 'T', mid: 'Thu', longLabel: 'Thursday 1', weekend: false, isToday: false });
  assert.equal(days[2].weekend, true); // Sat 3 Oct
  assert.equal(days[3].weekend, true); // Sun 4 Oct
  assert.deepEqual(days.filter((d) => d.isToday).map((d) => d.date), ['2026-10-26']);
});

test('monthDays: leap February and no "today" outside the month', () => {
  assert.equal(monthDays('2028-02', '2026-10-26').length, 29);
  assert.equal(monthDays('2026-02', '2026-10-26').some((d) => d.isToday), false);
});
