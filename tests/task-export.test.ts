import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tasksToRows, TASK_EXPORT_HEADER } from '../app/tasks/export.ts';

const base = { description: '', storyPoints: null, assigneeId: null, labels: [], links: [], startDate: null, dueDate: null, createdAt: '', updatedAt: '' };
const people = new Map([['u1', { name: 'Aisha -', email: 'a@x.com' }]]);

test('tasksToRows: header, parent code for subtasks, labels and status names', () => {
  const rows = tasksToRows(
    [
      { ...base, id: 't1', code: 'TSK-0001', parentId: null, title: 'Plan', status: 'todo', assigneeId: 'u1', storyPoints: 3, labels: ['ops', 'crew'], links: [{ url: 'https://a.example', label: 'a' }] },
      { ...base, id: 't2', code: 'TSK-0002', parentId: 't1', title: 'Sub', status: 'weird' },
    ],
    people,
    (k) => (k === 'todo' ? 'To do' : k),
    (n) => n.replace(/ -$/, ''),
  );
  assert.deepEqual(rows[0], TASK_EXPORT_HEADER);
  assert.deepEqual(rows[1], ['TSK-0001', '', 'Plan', 'To do', 'Aisha', 'a@x.com', '3', '', '', 'ops; crew', 'https://a.example']);
  assert.deepEqual(rows[2], ['TSK-0002', 'TSK-0001', 'Sub', 'weird', '', '', '', '', '', '', '']);
});

test('tasksToRows: empty list still gives the header row', () => {
  assert.equal(tasksToRows([], new Map(), (k) => k).length, 1);
});
