import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchUser, whatsappLink } from '../lib/registration.ts';

const users = [
  { id: '1', email: 'Ann@AirAsia.com', googleId: null, isActive: true },
  { id: '2', email: 'bob@airasia.com', googleId: 'sub-bob', isActive: true },
  { id: '3', email: 'cat@airasia.com', googleId: null, isActive: false },
];

test('matches by email case-insensitively and asks to bind the Google id', () => {
  const m = matchUser(users, { sub: 'sub-ann', email: ' ann@airasia.COM ' });
  assert.equal(m.kind, 'ok');
  assert.equal(m.kind === 'ok' && m.user.id, '1');
  assert.equal(m.kind === 'ok' && m.bindGoogleId, true);
});

test('matches by Google sub first, even if the email changed', () => {
  const m = matchUser(users, { sub: 'sub-bob', email: 'bob.new@airasia.com' });
  assert.equal(m.kind === 'ok' && m.user.id, '2');
  assert.equal(m.kind === 'ok' && m.bindGoogleId, false);
});

test('a row bound to another Google account is not taken over by email', () => {
  assert.equal(matchUser(users, { sub: 'someone-else', email: 'bob@airasia.com' }).kind, 'not_registered');
});

test('unknown and empty directories are not registered; deactivated users are reported', () => {
  assert.equal(matchUser(users, { sub: 's', email: 'nobody@airasia.com' }).kind, 'not_registered');
  assert.equal(matchUser([], { sub: 's', email: 'ann@airasia.com' }).kind, 'not_registered');
  assert.equal(matchUser(users, { sub: 's', email: 'cat@airasia.com' }).kind, 'inactive');
});

test('whatsapp link keeps digits only and encodes the message', () => {
  assert.equal(whatsappLink('+60 12-345 6789', 'Hi & hello'), 'https://wa.me/60123456789?text=Hi%20%26%20hello');
  assert.equal(whatsappLink('', 'x'), null);
  assert.equal(whatsappLink('abc', 'x'), null);
});
