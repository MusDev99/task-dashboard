import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNotifications, cleanLine, leaveApprovers, parseNotifications, pruneIds, safeInternalPath, unreadCount, BODY_MAX, type Notification } from '../lib/notifications.ts';

const now = new Date('2026-11-04T08:00:00.000Z');
let n = 0;
const id = () => `n${++n}`;

test('safeInternalPath: only in-app paths are followed', () => {
  assert.equal(safeInternalPath('/leave'), '/leave');
  assert.equal(safeInternalPath(' /tasks?view=list '), '/tasks?view=list');
  for (const bad of ['https://evil.test', '//evil.test', '/\\evil', 'javascript:alert(1)', '', null, undefined, 42, '/a b', '/<script>']) {
    assert.equal(safeInternalPath(bad), '/notifications', String(bad));
  }
});

test('cleanLine: one line, no control characters, capped', () => {
  assert.equal(cleanLine('a\n\tb\u0000   c', 50), 'a b c');
  assert.equal(cleanLine(null, 50), '');
  const long = cleanLine('x'.repeat(1000), BODY_MAX);
  assert.equal(long.length, BODY_MAX);
  assert.ok(long.endsWith('…'));
});

test('buildNotifications: one row per distinct recipient, never the actor, blanks dropped', () => {
  const rows = buildNotifications(['a', 'b', 'a', '', ' c ', 'actor'], { kind: 'leave_requested', title: 'T\n1', body: 'B', href: '/leave' }, 'actor', now, id);
  assert.deepEqual(rows.map((r) => r.userId), ['a', 'b', 'c']);
  assert.equal(rows[0].createdAt, '2026-11-04 08:00:00.000');
  assert.equal(rows[0].title, 'T 1');
  assert.equal(rows[0].readAt, '');
  assert.equal(new Set(rows.map((r) => r.id)).size, 3);
  assert.equal(buildNotifications(['x'], { kind: 'task_assigned', title: 't', href: 'https://evil.test' }, '', now, id)[0].href, '/notifications');
  assert.deepEqual(buildNotifications([], { kind: 'task_assigned', title: 't', href: '/tasks' }, '', now, id), []);
});

test('parseNotifications: only my rows, known kinds, newest first, hrefs re-checked', () => {
  const rows = [
    { id: '1', userId: 'me', kind: 'leave_decided', title: 'old', body: '', href: '/leave', createdAt: '2026-11-01 00:00:00.000', readAt: '' },
    { id: '2', userId: 'me', kind: 'task_assigned', title: 'new', body: '', href: 'https://evil.test', createdAt: '2026-11-03 00:00:00.000', readAt: '2026-11-03 01:00:00.000' },
    { id: '3', userId: 'other', kind: 'leave_decided', title: 'x', body: '', href: '/leave', createdAt: '2026-11-04 00:00:00.000', readAt: '' },
    { id: '4', userId: 'me', kind: 'bogus', title: 'x', body: '', href: '/leave', createdAt: '2026-11-04 00:00:00.000', readAt: '' },
  ];
  const mine = parseNotifications(rows, 'me');
  assert.deepEqual(mine.map((r) => r.id), ['2', '1']);
  assert.equal(mine[0].href, '/notifications');
  assert.equal(unreadCount(mine), 1);
});

test('leaveApprovers: active admins and planners plus the lead of the requester\'s teams; never the requester', () => {
  const users = [
    { id: 'adm', access: 'admin', isActive: true }, { id: 'pl', access: 'planner', isActive: true }, { id: 'off', access: 'planner', isActive: false },
    { id: 'ld', access: 'lead', isActive: true }, { id: 'ld2', access: 'lead', isActive: true }, { id: 'req', access: 'member', isActive: true }, { id: 'mem', access: 'member', isActive: true },
  ];
  const teams = [{ id: 'T1', leadId: 'ld' }, { id: 'T2', leadId: 'ld2' }];
  const members = [{ teamId: 'T1', userId: 'req' }, { teamId: 'T2', userId: 'mem' }];
  assert.deepEqual(leaveApprovers('req', users, teams, members).sort(), ['adm', 'ld', 'pl']);
  assert.deepEqual(leaveApprovers('adm', users, teams, members).sort(), ['pl']); // an admin asking is not told about themselves
  assert.deepEqual(leaveApprovers('loner', users, teams, members).sort(), ['adm', 'pl']);
  assert.ok(!leaveApprovers('req', users, [{ id: 'T1', leadId: 'gone' }], members).includes('gone'));
});

test('pruneIds: old read ones go, unread stay, and the cap drops the oldest', () => {
  const mk = (i: number, day: string, readAt = ''): Notification => ({ id: `p${i}`, userId: 'u', kind: 'leave_decided', title: '', body: '', href: '/leave', createdAt: `${day} 00:00:00.000`, readAt });
  const list = [mk(1, '2026-09-01', '2026-09-02 00:00:00.000'), mk(2, '2026-09-01'), mk(3, '2026-10-30', '2026-10-31 00:00:00.000'), mk(4, '2026-11-03')];
  assert.deepEqual(pruneIds(list, now), ['p1']); // 60-day-old read one only; the old unread one stays
  assert.deepEqual(pruneIds(list, now, 30, 2).sort(), ['p1', 'p2']); // cap of 2 keeps the two newest
});
