import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDays, monthsOf, myOpenTasks, summarize } from '../lib/my-schedule.ts';

const codes = [
  { code: 'M', label: 'Morning', type: 'shift' as const, hours: 8, start: '06:00', end: '14:00', color: '#000000', paid: true, active: true, sortOrder: 1 },
  { code: 'OFF', label: 'Off', type: 'shift' as const, hours: 0, color: '#000000', paid: true, active: true, sortOrder: 2 },
  { code: 'AL', label: 'Annual leave', type: 'leave' as const, hours: 0, color: '#000000', paid: true, active: true, sortOrder: 3 },
];
const entry = (userId: string, date: string, code: string) => ({ id: `${userId}_${date}`, userId, date, type: 'shift' as const, code, updatedAt: '' });

test('14 days from today across a month end, only my rows, week breaks by week start', () => {
  const entries = [entry('me', '2026-10-30', 'M'), entry('other', '2026-10-30', 'AL'), entry('me', '2026-11-02', 'AL')];
  const days = buildDays(entries, 'me', codes, '2026-10-30', 1);
  assert.equal(days.length, 14);
  assert.equal(days[0].date, '2026-10-30');
  assert.equal(days[13].date, '2026-11-12');
  assert.ok(days[0].isToday);
  assert.equal(days[0].code, 'M'); // not the other person's leave
  assert.equal(days[3].def?.label, 'Annual leave');
  assert.equal(days[1].code, '');
  // 2026-10-30 is a Friday: breaks on the first day and on Mondays (11-02, 11-09).
  assert.deepEqual(days.filter((d) => d.weekBreak).map((d) => d.date), ['2026-10-30', '2026-11-02', '2026-11-09']);
  assert.deepEqual(monthsOf(days), ['2026-10', '2026-11']);
});

test('summary: hours from codes, zero-hour shifts are not working days', () => {
  const entries = [entry('me', '2026-11-01', 'M'), entry('me', '2026-11-02', 'M'), entry('me', '2026-11-03', 'OFF'), entry('me', '2026-11-04', 'AL')];
  const s = summarize(buildDays(entries, 'me', codes, '2026-11-01', 0, 5));
  assert.deepEqual(s, { workingDays: 2, hours: 16, leaveDays: 1, unscheduledDays: 1 });
});

const config = {
  codePrefix: 'TSK', maxLabels: 5, maxLinks: 5, weekStart: 1 as const, storyPoints: [],
  statuses: [
    { key: 'todo', label: 'To do', color: '#000000', open: true, isDefault: true, isDone: false, active: true, sortOrder: 1 },
    { key: 'done', label: 'Done', color: '#000000', open: false, isDefault: false, isDone: true, active: true, sortOrder: 2 },
  ],
};
const task = (id: string, code: string, extra: Partial<{ assigneeId: string | null; status: string; dueDate: string | null; parentId: string | null; title: string }>) => ({
  id, code, parentId: null, title: code, description: '', status: 'todo', storyPoints: null, assigneeId: 'me',
  labels: [], links: [], startDate: null, dueDate: null, createdAt: '', updatedAt: '', ...extra,
});

test('my open tasks: mine only, open only, overdue first then due date then undated', () => {
  const tasks = [
    task('p', 'TSK-0001', { assigneeId: 'other', title: 'Parent' }),
    task('a', 'TSK-0002', { dueDate: '2026-11-10' }),
    task('b', 'TSK-0003', { dueDate: '2026-11-01' }), // overdue
    task('c', 'TSK-0004', {}),
    task('d', 'TSK-0005', { status: 'done', dueDate: '2026-10-01' }),
    task('e', 'TSK-0006', { assigneeId: 'other' }),
    task('f', 'TSK-0007', { parentId: 'p', dueDate: '2026-11-05' }),
  ];
  const mine = myOpenTasks(tasks, 'me', config, '2026-11-03');
  assert.deepEqual(mine.map((m) => m.task.code), ['TSK-0003', 'TSK-0007', 'TSK-0002', 'TSK-0004']);
  assert.ok(mine[0].overdue);
  assert.equal(mine[1].parentTitle, 'Parent');
  assert.deepEqual(myOpenTasks(tasks, '', config, '2026-11-03'), []);
});
