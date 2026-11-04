import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRoster, weekStartOf, type RuleCode, type RuleLimits } from '../lib/roster-rules.ts';

const codes = new Map<string, RuleCode>([
  ['DS', { type: 'shift', hours: 8, start: '09:00', end: '17:00' }],
  ['NS', { type: 'shift', hours: 8, start: '22:00', end: '06:00' }],
  ['AL', { type: 'leave', hours: 0 }],
]);
const off: RuleLimits = { maxConsecutiveDays: 0, minRestHours: 0, maxWeeklyHours: 0 };
const day = (userId: string, date: string, code = 'DS') => ({ userId, date, code });
const range = (from: number, to: number, code = 'DS') => Array.from({ length: to - from + 1 }, (_, i) => day('u', `2026-11-${String(from + i).padStart(2, '0')}`, code));
const win = { from: '2026-11-01', to: '2026-11-30' };

test('weekStartOf: Monday and Sunday weeks', () => {
  assert.equal(weekStartOf('2026-11-04', 1), '2026-11-02'); // Wed → Mon
  assert.equal(weekStartOf('2026-11-04', 0), '2026-11-01'); // Wed → Sun
  assert.equal(weekStartOf('2026-11-02', 1), '2026-11-02');
});

test('consecutive: flags the day that breaks the limit, once per run; leave breaks a run', () => {
  const limits = { ...off, maxConsecutiveDays: 5 };
  const v = checkRoster(range(1, 7), codes, limits, 1, win);
  assert.deepEqual(v.map((x) => [x.rule, x.date]), [['consecutive', '2026-11-06']]);
  assert.match(v[0].detail, /7 working days in a row \(limit 5\)/);
  // a leave day in the middle splits 7 days into 3 + 3
  const split = [...range(1, 3), day('u', '2026-11-04', 'AL'), ...range(5, 7)];
  assert.equal(checkRoster(split, codes, limits, 1, win).length, 0);
  assert.equal(checkRoster(range(1, 5), codes, limits, 1, win).length, 0); // exactly at the limit is fine
});

test('consecutive: a run that began last month still counts (context) but is reported only in its own month', () => {
  const limits = { ...off, maxConsecutiveDays: 5 };
  const entries = [...range(28, 30).map((e) => ({ ...e, date: e.date.replace('2026-11', '2026-10') })), ...range(1, 4)];
  entries.push(day('u', '2026-10-31'));
  // run: Oct 28–31 + Nov 1–4 = 8 days; breaking day = Nov 2 (6th day)
  assert.deepEqual(checkRoster(entries, codes, limits, 1, win).map((v) => v.date), ['2026-11-02']);
  assert.equal(checkRoster(entries, codes, limits, 1, { from: '2026-10-01', to: '2026-10-31' }).length, 0);
});

test('rest: night shift into a morning shift is too short; overnight end is handled', () => {
  const limits = { ...off, minRestHours: 11 };
  // NS 22:00→06:00 on the 3rd, DS 09:00 on the 4th = 3 h rest
  const v = checkRoster([day('u', '2026-11-03', 'NS'), day('u', '2026-11-04', 'DS')], codes, limits, 1, win);
  assert.deepEqual(v.map((x) => [x.rule, x.date]), [['rest', '2026-11-04']]);
  assert.match(v[0].detail, /^3 h rest/);
  // DS 17:00 end → DS 09:00 next day = 16 h, fine
  assert.equal(checkRoster([day('u', '2026-11-03'), day('u', '2026-11-04')], codes, limits, 1, win).length, 0);
  // not consecutive days → not checked
  assert.equal(checkRoster([day('u', '2026-11-03', 'NS'), day('u', '2026-11-05', 'DS')], codes, limits, 1, win).length, 0);
});

test('weekly hours: over the limit flagged at the week start (clipped to the window)', () => {
  const limits = { ...off, maxWeeklyHours: 40 };
  const sixDays = range(2, 7); // Mon–Sat = 48 h
  const v = checkRoster(sixDays, codes, limits, 1, win);
  assert.deepEqual(v.map((x) => [x.rule, x.date]), [['weekly', '2026-11-02']]);
  assert.match(v[0].detail, /48 h in the week of 2026-11-02 \(limit 40 h\)/);
  assert.equal(checkRoster(range(2, 6), codes, limits, 1, win).length, 0); // 40 h exactly
  // week that starts before the window is clipped to the window start
  const clipped = checkRoster(range(26, 31).map((e) => ({ ...e, date: e.date.replace('2026-11', '2026-10') })).concat([day('u', '2026-11-01')]), codes, limits, 1, win); // Mon 26 Oct – Sun 1 Nov = 56 h
  assert.deepEqual(clipped.map((x) => x.date), ['2026-11-01']);
});

test('all rules off (0) report nothing; unknown codes are ignored; users are independent', () => {
  assert.equal(checkRoster(range(1, 30), codes, off, 1, win).length, 0);
  assert.equal(checkRoster([day('u', '2026-11-01', 'ZZ')], codes, { ...off, maxConsecutiveDays: 1 }, 1, win).length, 0);
  const two = [...range(1, 7), ...range(1, 3).map((e) => ({ ...e, userId: 'v' }))];
  assert.deepEqual(checkRoster(two, codes, { ...off, maxConsecutiveDays: 5 }, 1, win).map((x) => x.userId), ['u']);
});
