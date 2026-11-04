import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAuditEntry, cleanSummary, filterAudit, paginate, parseAuditRows, SUMMARY_MAX } from '../lib/audit.ts';
import { ACCESS_LEVELS, can } from '../lib/access.ts';

const actor = { uid: 'u1', level: 'planner' };
const at = new Date('2026-11-04T08:09:10.123Z');

test('buildAuditEntry: stamps UTC time in the stored format and trims the entity id', () => {
  const e = buildAuditEntry(actor, { action: 'create', entity: 'task', entityId: ' t1 ', summary: 'Created TSK-0001' }, at, 'id1');
  assert.deepEqual(e, { id: 'id1', at: '2026-11-04 08:09:10.123', actorId: 'u1', actorLevel: 'planner', action: 'create', entity: 'task', entityId: 't1', summary: 'Created TSK-0001' });
});

test('cleanSummary: one line, no control characters, capped', () => {
  assert.equal(cleanSummary('a\n\tb\u0000  c'), 'a b c');
  assert.equal(cleanSummary(null), '');
  const long = cleanSummary('x'.repeat(1000));
  assert.equal(long.length, SUMMARY_MAX);
  assert.ok(long.endsWith('…'));
});

test('parseAuditRows: skips rows with an unknown action or entity', () => {
  const rows = [
    { id: '1', at: 'a', actorId: 'u', actorLevel: 'admin', action: 'create', entity: 'task', entityId: 't', summary: 'ok' },
    { id: '2', at: 'b', actorId: 'u', actorLevel: 'admin', action: 'hack', entity: 'task', entityId: 't', summary: 'bad' },
    { id: '3', at: 'c', actorId: 'u', actorLevel: 'admin', action: 'update', entity: 'secrets', entityId: 't', summary: 'bad' },
  ];
  assert.deepEqual(parseAuditRows(rows).map((e) => e.id), ['1']);
});

const mk = (id: string, atStr: string, entity: 'task' | 'user', summary: string, actorId = 'u1') =>
  ({ id, at: atStr, actorId, actorLevel: 'admin', action: 'update' as const, entity, entityId: '', summary });

test('filterAudit: newest first, entity filter, text match on summary or person; unknown entity ignored', () => {
  const list = [mk('a', '2026-11-01', 'task', 'Moved TSK-1'), mk('b', '2026-11-03', 'user', 'Changed access', 'u2'), mk('c', '2026-11-02', 'task', 'Deleted TSK-2')];
  const name = (id: string) => (id === 'u2' ? 'Aisha' : 'Budi');
  assert.deepEqual(filterAudit(list, {}, name).map((e) => e.id), ['b', 'c', 'a']);
  assert.deepEqual(filterAudit(list, { entity: 'task' }, name).map((e) => e.id), ['c', 'a']);
  assert.deepEqual(filterAudit(list, { q: ' aisha ' }, name).map((e) => e.id), ['b']);
  assert.deepEqual(filterAudit(list, { q: 'tsk-2' }, name).map((e) => e.id), ['c']);
  assert.equal(filterAudit(list, { entity: 'nope' }, name).length, 3);
});

test('paginate: clamps the page into range', () => {
  const items = Array.from({ length: 53 }, (_, i) => i);
  assert.equal(paginate(items, 1, 20).rows.length, 20);
  assert.equal(paginate(items, 3, 20).rows.length, 13);
  assert.equal(paginate(items, 99, 20).page, 3);
  assert.equal(paginate(items, -4, 20).page, 1);
  assert.deepEqual(paginate([], 1, 20), { rows: [], page: 1, pages: 1, total: 0 });
});

test('audit.view is admin only', () => {
  assert.deepEqual(ACCESS_LEVELS.filter((l) => can(l, 'audit.view')), ['admin']);
});
