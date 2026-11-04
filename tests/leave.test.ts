import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canDecideLeave, canTransition, cleanLeaveInput, datesBetween, MAX_LEAVE_DAYS, validateLeaveInput, visibleLeave } from '../lib/leave.ts';
import { ACCESS_LEVELS, can } from '../lib/access.ts';

const ctx = (over = {}) => ({
  today: '2026-11-04',
  leaveCodes: [{ code: 'AL', active: true }, { code: 'OLD', active: false }],
  existing: [] as { id: string; startDate: string; endDate: string; status: string }[],
  ...over,
});
const input = (over = {}) => ({ startDate: '2026-11-10', endDate: '2026-11-12', code: 'AL', note: '', ...over });

test('datesBetween: inclusive, crosses month and leap day, empty on bad input', () => {
  assert.deepEqual(datesBetween('2026-11-29', '2026-12-02'), ['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02']);
  assert.deepEqual(datesBetween('2028-02-28', '2028-03-01'), ['2028-02-28', '2028-02-29', '2028-03-01']);
  assert.deepEqual(datesBetween('2026-11-05', '2026-11-05'), ['2026-11-05']);
  assert.deepEqual(datesBetween('2026-11-06', '2026-11-05'), []);
  assert.deepEqual(datesBetween('2026-02-30', '2026-03-02'), []);
});

test('cleanLeaveInput: trims, upper-cases the code, a missing end means a single day', () => {
  assert.deepEqual(cleanLeaveInput({ startDate: ' 2026-11-10 ', endDate: '', code: ' al ', note: '  family \n  trip ' }), { startDate: '2026-11-10', endDate: '2026-11-10', code: 'AL', note: 'family trip' });
  assert.deepEqual(cleanLeaveInput({}), { startDate: '', endDate: '', code: '', note: '' });
});

test('validateLeaveInput: a valid request has no errors', () => {
  assert.deepEqual(validateLeaveInput(input(), ctx()), {});
  assert.deepEqual(validateLeaveInput(input({ startDate: '2026-11-04', endDate: '2026-11-04' }), ctx()), {}); // today is allowed
});

test('validateLeaveInput: type, dates and note', () => {
  assert.ok(validateLeaveInput(input({ code: 'ZZ' }), ctx()).code);
  assert.ok(validateLeaveInput(input({ code: 'OLD' }), ctx()).code);
  assert.ok(validateLeaveInput(input({ startDate: '' }), ctx()).startDate);
  assert.ok(validateLeaveInput(input({ startDate: '2026-11-03', endDate: '2026-11-05' }), ctx()).startDate); // past
  assert.ok(validateLeaveInput(input({ startDate: '2028-01-01', endDate: '2028-01-02' }), ctx()).startDate); // too far ahead
  assert.ok(validateLeaveInput(input({ endDate: '2026-11-09' }), ctx()).endDate); // before start
  assert.ok(validateLeaveInput(input({ endDate: '2027-02-01' }), ctx()).endDate); // longer than the maximum
  assert.equal(MAX_LEAVE_DAYS, 62);
  assert.ok(validateLeaveInput(input({ note: 'x'.repeat(201) }), ctx()).note);
});

test('validateLeaveInput: overlaps with pending/approved requests are refused; rejected/cancelled and edits are not', () => {
  const mine = (status: string, id = 'r1') => ({ id, startDate: '2026-11-11', endDate: '2026-11-20', status });
  assert.ok(validateLeaveInput(input(), ctx({ existing: [mine('pending')] })).startDate);
  assert.ok(validateLeaveInput(input(), ctx({ existing: [mine('approved')] })).startDate);
  assert.deepEqual(validateLeaveInput(input(), ctx({ existing: [mine('rejected')] })), {});
  assert.deepEqual(validateLeaveInput(input(), ctx({ existing: [mine('cancelled')] })), {});
  assert.deepEqual(validateLeaveInput(input(), ctx({ existing: [mine('pending')], ignoreId: 'r1' })), {});
  assert.deepEqual(validateLeaveInput(input({ startDate: '2026-11-21', endDate: '2026-11-22' }), ctx({ existing: [mine('approved')] })), {}); // adjacent
});

test('canDecideLeave: admin/planner any; lead only their teams and never themselves; member never', () => {
  const scope = new Set(['x', 'lead1']);
  assert.ok(canDecideLeave('admin', 'a', 'x', null));
  assert.ok(canDecideLeave('planner', 'p', 'x', null));
  assert.ok(canDecideLeave('lead', 'lead1', 'x', scope));
  assert.ok(!canDecideLeave('lead', 'lead1', 'outsider', scope));
  assert.ok(!canDecideLeave('lead', 'lead1', 'lead1', scope)); // own request
  assert.ok(!canDecideLeave('lead', 'lead1', 'x', null));
  assert.ok(!canDecideLeave('member', 'm', 'm', null));
  assert.ok(!canDecideLeave('lead', '', 'x', scope)); // auth bypass has no uid
});

test('canTransition: only pending moves', () => {
  assert.ok(canTransition('pending', 'approved') && canTransition('pending', 'rejected') && canTransition('pending', 'cancelled'));
  assert.ok(!canTransition('approved', 'rejected') && !canTransition('rejected', 'approved') && !canTransition('cancelled', 'approved'));
  assert.ok(!canTransition('pending', 'pending'));
});

test('visibleLeave: members own, leads own + teams, planners/admins all', () => {
  const rows = [{ userId: 'm' }, { userId: 'x' }, { userId: 'o' }];
  assert.deepEqual(visibleLeave(rows, 'member', 'm', null), [{ userId: 'm' }]);
  assert.deepEqual(visibleLeave(rows, 'lead', 'm', new Set(['x'])).map((r) => r.userId), ['m', 'x']);
  assert.equal(visibleLeave(rows, 'planner', 'p', null).length, 3);
  assert.equal(visibleLeave(rows, 'admin', 'a', null).length, 3);
});

test('capabilities: everyone may request leave; admin, planner and lead may decide', () => {
  assert.deepEqual(ACCESS_LEVELS.filter((l) => can(l, 'leave.request')), ['admin', 'planner', 'lead', 'member']);
  assert.deepEqual(ACCESS_LEVELS.filter((l) => can(l, 'leave.decide')), ['admin', 'planner', 'lead']);
});
