import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCESS_LEVELS, can, canEditTeam, canSetTaskStatus, isAccessLevel, ledUserIds, parseAccess, removesLastAdmin, rosterRefused,
} from '../lib/access.ts';

test('parseAccess: known levels (any case / spacing), anything else is least privilege', () => {
  assert.equal(parseAccess(' Planner '), 'planner');
  assert.equal(parseAccess('ADMIN'), 'admin');
  assert.equal(parseAccess(''), 'member');
  assert.equal(parseAccess(null), 'member');
  assert.equal(parseAccess('superuser'), 'member');
  assert.ok(isAccessLevel('lead'));
  assert.ok(!isAccessLevel('Lead'));
});

test('matrix: who can do what', () => {
  const allowed = (cap: Parameters<typeof can>[1]) => ACCESS_LEVELS.filter((l) => can(l, cap));
  assert.deepEqual(allowed('users.edit'), ['admin']);
  assert.deepEqual(allowed('settings.edit'), ['admin']);
  assert.deepEqual(allowed('settings.view'), ['admin', 'planner']);
  assert.deepEqual(allowed('roster.bulk'), ['admin', 'planner']);
  assert.deepEqual(allowed('roster.edit'), ['admin', 'planner', 'lead']);
  assert.deepEqual(allowed('tasks.edit'), ['admin', 'planner', 'lead']);
  assert.deepEqual(allowed('teams.manage'), ['admin', 'planner']);
  assert.deepEqual(allowed('users.view'), ['admin', 'planner', 'lead']);
  assert.deepEqual(allowed('tasks.statusOwn'), ['admin', 'planner', 'lead', 'member']);
});

const teams = [{ id: 'A', leadId: 'L' }, { id: 'B', leadId: 'other' }];
const members = [
  { teamId: 'A', userId: 'L' }, { teamId: 'A', userId: 'x' }, { teamId: 'A', userId: 'y' },
  { teamId: 'B', userId: 'y' }, { teamId: 'B', userId: 'z' },
];

test('lead scope: everyone in the teams they lead, incl. people also in other teams', () => {
  assert.deepEqual([...ledUserIds('L', teams, members)].sort(), ['L', 'x', 'y']);
  assert.equal(ledUserIds('nobody', teams, members).size, 0);
});

test('roster: leads are refused people outside their teams; planners/admins never; members always', () => {
  const scope = ledUserIds('L', teams, members);
  assert.deepEqual(rosterRefused('lead', ['x', 'y', 'z', 'z'], scope), ['z']);
  assert.deepEqual(rosterRefused('lead', ['x'], scope), []);
  assert.deepEqual(rosterRefused('lead', ['x'], null), ['x']);
  assert.deepEqual(rosterRefused('planner', ['z'], null), []);
  assert.deepEqual(rosterRefused('member', ['me', 'me'], null), ['me']);
});

test('task status: members only on their own tasks', () => {
  assert.ok(canSetTaskStatus('member', 'u1', 'u1'));
  assert.ok(!canSetTaskStatus('member', 'u1', 'u2'));
  assert.ok(!canSetTaskStatus('member', 'u1', null));
  assert.ok(!canSetTaskStatus('member', '', null)); // no uid never matches an unassigned task
  assert.ok(canSetTaskStatus('lead', 'u1', 'u2'));
});

test('teams: leads edit only teams they lead; planners any', () => {
  assert.ok(canEditTeam('lead', 'L', { leadId: 'L' }));
  assert.ok(!canEditTeam('lead', 'L', { leadId: 'other' }));
  assert.ok(!canEditTeam('lead', '', { leadId: null }));
  assert.ok(canEditTeam('planner', 'p', { leadId: 'other' }));
  assert.ok(!canEditTeam('member', 'L', { leadId: 'L' }));
});

test('last active admin cannot be demoted, deactivated or deleted', () => {
  const users = [
    { id: 'a', access: 'admin' as const, isActive: true },
    { id: 'b', access: 'admin' as const, isActive: false },
    { id: 'c', access: 'planner' as const, isActive: true },
  ];
  assert.ok(removesLastAdmin(users, 'a', { access: 'planner', isActive: true }));
  assert.ok(removesLastAdmin(users, 'a', { access: 'admin', isActive: false }));
  assert.ok(removesLastAdmin(users, 'a', null));
  assert.ok(!removesLastAdmin(users, 'a', { access: 'admin', isActive: true }));
  assert.ok(!removesLastAdmin(users, 'c', null));
  // A second active admin makes it safe.
  const two = [...users, { id: 'd', access: 'admin' as const, isActive: true }];
  assert.ok(!removesLastAdmin(two, 'a', null));
  // Promoting someone else is always allowed.
  assert.ok(!removesLastAdmin(users, 'c', { access: 'admin', isActive: true }));
});
