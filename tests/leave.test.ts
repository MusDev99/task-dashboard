import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canDecideLeave, canRevokeLeave, canTransition, cleanLeaveInput, datesBetween, dayBefore, MAX_LEAVE_DAYS, planRevoke, validateLeaveInput, visibleLeave } from '../lib/leave.ts';
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
  assert.ok(!canTransition('pending', 'revoked')); // nothing to take back yet
});

test('canTransition: only approved leave can be revoked, and revoked is final', () => {
  assert.ok(canTransition('approved', 'revoked'));
  for (const from of ['rejected', 'cancelled', 'revoked'] as const) assert.ok(!canTransition(from, 'revoked'), from);
  for (const to of ['approved', 'rejected', 'cancelled', 'pending'] as const) assert.ok(!canTransition('revoked', to), to);
});

test('canRevokeLeave: the requester (own leave) or anyone who could decide it', () => {
  const scope = new Set(['x']);
  assert.ok(canRevokeLeave('member', 'm', 'm', null)); // a member takes back their own leave
  assert.ok(!canRevokeLeave('member', 'm', 'other', null));
  assert.ok(canRevokeLeave('lead', 'l', 'l', scope)); // a lead cancelling their own is allowed (it only frees their days)
  assert.ok(canRevokeLeave('lead', 'l', 'x', scope));
  assert.ok(!canRevokeLeave('lead', 'l', 'outsider', scope));
  assert.ok(canRevokeLeave('planner', 'p', 'x', null) && canRevokeLeave('admin', 'a', 'x', null));
  assert.ok(!canRevokeLeave('member', '', '', null)); // no signed-in person
});

test('dayBefore: month and year edges', () => {
  assert.equal(dayBefore('2026-11-01'), '2026-10-31');
  assert.equal(dayBefore('2026-01-01'), '2025-12-31');
  assert.equal(dayBefore('2028-03-01'), '2028-02-29');
});

const req = { startDate: '2026-11-10', endDate: '2026-11-14', code: 'AL' };
const cells = (dates: string[], code = 'AL') => dates.map((date) => ({ date, code }));
const week = ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14'];

test('planRevoke: leave that has not started is revoked and every day cleared', () => {
  const p = planRevoke(req, '2026-11-04', cells(week));
  assert.equal(p.kind, 'revoked');
  assert.deepEqual(p.clear, week);
  assert.equal(p.untouched, 0);
  assert.equal(p.newEndDate, null);
  assert.equal(planRevoke(req, '2026-11-10', cells(week)).kind, 'revoked'); // starts today: nothing has passed
});

test('planRevoke: leave under way is shortened to end yesterday; past days stay', () => {
  const p = planRevoke(req, '2026-11-12', cells(week));
  assert.equal(p.kind, 'shortened');
  assert.deepEqual(p.clear, ['2026-11-12', '2026-11-13', '2026-11-14']);
  assert.equal(p.futureDays, 3);
  assert.equal(p.newEndDate, '2026-11-11');
});

test('planRevoke: a day changed to another code is left alone and counted; a missing row too', () => {
  const roster = [...cells(['2026-11-10', '2026-11-12', '2026-11-14']), { date: '2026-11-11', code: 'STD' }]; // 13th has no row
  const p = planRevoke(req, '2026-11-04', roster);
  assert.deepEqual(p.clear, ['2026-11-10', '2026-11-12', '2026-11-14']);
  assert.equal(p.untouched, 2);
  assert.equal(p.futureDays, 5);
});

test('planRevoke: finished leave and bad dates do nothing', () => {
  assert.equal(planRevoke(req, '2026-11-15', cells(week)).kind, 'nothing');
  assert.equal(planRevoke({ ...req, startDate: 'x' }, '2026-11-04', []).kind, 'nothing');
  assert.equal(planRevoke(req, '2026-11-14', cells(week)).kind, 'shortened'); // last day still counts as remaining
  assert.deepEqual(planRevoke(req, '2026-11-14', cells(week)).clear, ['2026-11-14']);
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
