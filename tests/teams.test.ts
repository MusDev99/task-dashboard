import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanTeamInput, validateTeam } from '../lib/team-validation.ts';
import { membersByTeam, teamsByUser, toTeamOptions, toTeamRows } from '../lib/teams.ts';

const users = [
  { id: 'u1', isActive: true },
  { id: 'u2', isActive: true },
  { id: 'u3', isActive: false },
];
const teams = [{ id: 't1', name: 'Ramp Ops' }];
const ok = { name: 'Cargo', description: '', color: '#6c63ff', leadId: '', memberIds: ['u1'] };

test('cleans input: trims, collapses spaces, lowercases colour, dedupes members', () => {
  const c = cleanTeamInput({ name: '  Night   Crew ', description: ' x ', color: '#6C63FF', leadId: ' u1 ', memberIds: ['u1', ' u1', '', 'u2'] });
  assert.deepEqual(c, { name: 'Night Crew', description: 'x', color: '#6c63ff', leadId: 'u1', memberIds: ['u1', 'u2'] });
  assert.deepEqual(cleanTeamInput({}).memberIds, []);
});

test('accepts a valid team', () => {
  assert.deepEqual(validateTeam(ok, users, teams), {});
});

test('requires a unique name (case-insensitive) but allows keeping your own', () => {
  assert.ok(validateTeam({ ...ok, name: '' }, users, teams).name);
  assert.ok(validateTeam({ ...ok, name: 'ramp ops' }, users, teams).name);
  assert.equal(validateTeam({ ...ok, name: 'ramp ops' }, users, teams, { id: 't1', memberIds: [] }).name, undefined);
  assert.ok(validateTeam({ ...ok, name: 'x'.repeat(61) }, users, teams).name);
});

test('checks colour and description length', () => {
  assert.ok(validateTeam({ ...ok, color: 'red' }, users, teams).color);
  assert.ok(validateTeam({ ...ok, description: 'x'.repeat(501) }, users, teams).description);
});

test('members: at least one, must exist, inactive only if already a member', () => {
  assert.ok(validateTeam({ ...ok, memberIds: [] }, users, teams).memberIds);
  assert.ok(validateTeam({ ...ok, memberIds: ['ghost'] }, users, teams).memberIds);
  assert.ok(validateTeam({ ...ok, memberIds: ['u3'] }, users, teams).memberIds);
  assert.equal(validateTeam({ ...ok, memberIds: ['u3'] }, users, teams, { id: 't9', memberIds: ['u3'] }).memberIds, undefined);
});

test('lead must be a member', () => {
  assert.ok(validateTeam({ ...ok, leadId: 'u2' }, users, teams).leadId);
  assert.equal(validateTeam({ ...ok, memberIds: ['u1', 'u2'], leadId: 'u2' }, users, teams).leadId, undefined);
});

test('a person can be in several teams; helpers group both ways', () => {
  const members = [
    { id: 'a_u1', teamId: 'a', userId: 'u1', addedAt: '' },
    { id: 'b_u1', teamId: 'b', userId: 'u1', addedAt: '' },
    { id: 'b_gone', teamId: 'b', userId: 'gone', addedAt: '' },
  ];
  assert.deepEqual(teamsByUser(members).get('u1'), ['a', 'b']);
  assert.deepEqual(membersByTeam(members).get('b'), ['u1', 'gone']);
  const base = { description: '', leadId: null, color: '#6c63ff', createdAt: '', updatedAt: '' };
  const rows = toTeamRows([{ id: 'b', name: 'B', ...base }], members, new Set(['u1']));
  assert.deepEqual(rows[0].memberIds, ['u1']);
  const opts = toTeamOptions([{ id: 'b', name: 'Zeta', ...base }, { id: 'a', name: 'Alpha', ...base }], members);
  assert.deepEqual(opts.map((o) => o.name), ['Alpha', 'Zeta']);
});

test('cleanTeamInput tolerates junk payloads', () => {
  assert.deepEqual(cleanTeamInput(null), { name: '', description: '', color: '', leadId: '', memberIds: [] });
  assert.deepEqual(cleanTeamInput({ name: 5, memberIds: 'u1' } as never).memberIds, []);
});
