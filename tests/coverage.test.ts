import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appliesOn, computeCoverage, type CoverageTarget } from '../lib/coverage.ts';

const people = [
  { id: 'a', locationId: 'KUL', isActive: true },
  { id: 'b', locationId: 'KUL', isActive: true },
  { id: 'c', locationId: 'PEN', isActive: true },
  { id: 'd', locationId: 'KUL', isActive: false },
];
const t = (over: Partial<CoverageTarget> = {}): CoverageTarget => ({ id: 't1', locationId: 'KUL', code: 'NS', days: 'every', minStaff: 2, active: true, ...over });
// 2026-11-02 is a Monday, 2026-11-07 a Saturday
const dates = ['2026-11-02', '2026-11-07'];

test('appliesOn: every / weekdays / weekends', () => {
  assert.ok(appliesOn('every', '2026-11-07'));
  assert.ok(appliesOn('weekdays', '2026-11-02'));
  assert.ok(!appliesOn('weekdays', '2026-11-07'));
  assert.ok(appliesOn('weekends', '2026-11-08')); // Sunday
  assert.ok(!appliesOn('weekends', '2026-11-02'));
});

test('computeCoverage: reports days below the minimum and counts only eligible people', () => {
  const entries = [
    { userId: 'a', date: '2026-11-02', code: 'NS' },
    { userId: 'b', date: '2026-11-02', code: 'NS' }, // meets 2
    { userId: 'a', date: '2026-11-07', code: 'NS' },
    { userId: 'c', date: '2026-11-07', code: 'NS' }, // other location: not counted
    { userId: 'd', date: '2026-11-07', code: 'NS' }, // inactive: not counted
  ];
  assert.deepEqual(computeCoverage(dates, [t()], people, entries), [
    { targetId: 't1', date: '2026-11-07', code: 'NS', locationId: 'KUL', have: 1, need: 2 },
  ]);
});

test('computeCoverage: all-locations target, weekday filter and inactive targets', () => {
  const entries = [{ userId: 'c', date: '2026-11-02', code: 'NS' }];
  assert.equal(computeCoverage(dates, [t({ locationId: '', minStaff: 1, days: 'weekdays' })], people, entries).length, 0);
  assert.deepEqual(computeCoverage(dates, [t({ locationId: '', minStaff: 1, days: 'weekends' })], people, entries).map((g) => g.date), ['2026-11-07']);
  assert.equal(computeCoverage(dates, [t({ active: false })], people, []).length, 0);
});

test('computeCoverage: a location with nobody rostered is a gap every applicable day, sorted by date', () => {
  const gaps = computeCoverage(dates, [t({ code: 'DS' }), t({ id: 't2', code: 'NS' })], people, []);
  assert.deepEqual(gaps.map((g) => `${g.date} ${g.code}`), ['2026-11-02 DS', '2026-11-02 NS', '2026-11-07 DS', '2026-11-07 NS']);
});

import { validateCoverageRecord, validateCoverageRefs } from '../lib/coverage.ts';

const rec = (over: Record<string, string | number | boolean> = {}) => ({ id: 'x', locationId: 'KUL', code: 'NS', days: 'every', minStaff: 3, active: true, ...over });

test('validateCoverageRecord: minimum, shift, days and duplicates', () => {
  assert.deepEqual(validateCoverageRecord(rec(), []), {});
  assert.ok(validateCoverageRecord(rec({ minStaff: 0 }), []).minStaff);
  assert.ok(validateCoverageRecord(rec({ minStaff: 2.5 }), []).minStaff);
  assert.ok(validateCoverageRecord(rec({ minStaff: NaN }), []).minStaff);
  assert.ok(validateCoverageRecord(rec({ code: '' }), []).code);
  assert.ok(validateCoverageRecord(rec({ days: 'sometimes' }), []).days);
  assert.ok(validateCoverageRecord(rec(), [rec({ id: 'y' })]).code); // same shift + location + days
  assert.deepEqual(validateCoverageRecord(rec(), [rec({ id: 'y', days: 'weekends' })]), {}); // different days is fine
});

test('validateCoverageRefs: real shift/location; inactive only if already used by this target', () => {
  const shifts = [{ code: 'NS', active: true }, { code: 'OLD', active: false }];
  const locs = [{ id: 'KUL', active: true }, { id: 'GONE', active: false }];
  assert.deepEqual(validateCoverageRefs(rec(), shifts, locs, null), {});
  assert.ok(validateCoverageRefs(rec({ code: 'ZZ' }), shifts, locs, null).code);
  assert.ok(validateCoverageRefs(rec({ code: 'OLD' }), shifts, locs, null).code);
  assert.deepEqual(validateCoverageRefs(rec({ code: 'OLD' }), shifts, locs, rec({ code: 'OLD' })), {}); // already on it: allowed
  assert.ok(validateCoverageRefs(rec({ locationId: 'nope' }), shifts, locs, null).locationId);
  assert.ok(validateCoverageRefs(rec({ locationId: 'GONE' }), shifts, locs, null).locationId);
  assert.deepEqual(validateCoverageRefs(rec({ locationId: '' }), shifts, locs, null), {}); // all locations
});
