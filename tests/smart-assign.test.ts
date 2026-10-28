import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt, cleanSuggestInput, experience, parseAiRanking, rankByRules, ruleScore, SUGGESTIONS, type Candidate } from '../lib/smart-assign.ts';

const avail = (userId: string, o: Partial<Candidate['availability']> = {}): Candidate['availability'] => ({
  userId, workingDays: 5, leave: [], unscheduledDays: 0, totalDays: 5, openPoints: 0, openTasks: 0, warning: null, ...o,
});
const cand = (userId: string, name: string, a: Partial<Candidate['availability']> = {}, history: Candidate['history'] = []): Candidate =>
  ({ userId, name, role: 'Engineer', availability: avail(userId, a), history });
const task = cleanSuggestInput({ title: 'Fix check-in kiosk printer', labels: ['Kiosk'], startDate: '2026-11-02', dueDate: '2026-11-06' });

test('cleans input: trims, bounds, lowercases + dedupes labels, drops bad dates and ids', () => {
  const c = cleanSuggestInput({ title: '  Fix   it ', description: ' d ', labels: ['A', ' a', '', 3, 'B'], storyPoints: -1, startDate: '2026-1-1', dueDate: ' 2026-11-06 ', taskId: '  ', teamId: 't1' });
  assert.deepEqual(c, { title: 'Fix it', description: 'd', labels: ['a', 'b'], storyPoints: null, startDate: null, dueDate: '2026-11-06', taskId: null, teamId: 't1' });
  assert.equal(cleanSuggestInput({ title: 'x'.repeat(500) }).title.length, 140);
  assert.equal(cleanSuggestInput({ labels: Array.from({ length: 30 }, (_, i) => `l${i}`) }).labels.length, 10);
  assert.deepEqual(cleanSuggestInput({}).labels, []);
});

test('experience matches past labels and title words (case-insensitive)', () => {
  const xp = experience(task, [{ title: 'Replace kiosk PRINTER ribbon', labels: ['kiosk'] }]);
  assert.deepEqual(xp.labels, ['kiosk']);
  assert.ok(xp.words.includes('printer') && xp.words.includes('kiosk'));
});

test('rule score: available + light load beats on-leave, and leave is explained', () => {
  const free = ruleScore(cand('u1', 'Ana'), task, 10);
  const leave = ruleScore(cand('u2', 'Ben', { workingDays: 2, leave: [{ code: 'AL', days: 3 }] }), task, 10);
  assert.equal(free.score, 80); // 50 availability + 30 workload + 0 experience
  assert.ok(leave.score < free.score);
  assert.ok(leave.reasons[0].startsWith('On leave AL 3d'));
});

test('rule score: no dates is neutral, not rostered sinks, scores stay in 0–100', () => {
  const noDates = cleanSuggestInput({ title: 'x' });
  assert.equal(ruleScore(cand('u1', 'A', { totalDays: 0, workingDays: 0 }), noDates, 0).score, 55);
  const off = ruleScore(cand('u1', 'A', { workingDays: 0 }), task, 0);
  assert.equal(off.score, 35);
  assert.ok(off.reasons.includes('Not rostered during this task'));
  const best = ruleScore(cand('u1', 'A', {}, [{ title: 'kiosk printer jam', labels: ['kiosk'] }]), task, 0);
  assert.ok(best.score <= 100 && best.reasons.some((r) => r.includes('Has worked on kiosk')));
});

test('rankByRules orders by score, then lighter load, then name', () => {
  const ranked = rankByRules([
    cand('u1', 'Zed', { openPoints: 8, openTasks: 2 }),
    cand('u2', 'Amy', { workingDays: 0 }),
    cand('u3', 'Bob'),
    cand('u4', 'Al'),
  ], task);
  assert.deepEqual(ranked.map((s) => s.userId), ['u4', 'u3', 'u1', 'u2']);
});

test('buildPrompt pseudonymises candidates (no names or user ids leave the server)', () => {
  const list = [cand('user-123', 'Siti Aminah'), cand('user-456', 'John Tan')];
  const rules = new Map(rankByRules(list, task).map((s) => [s.userId, s]));
  const { aliases, user } = buildPrompt(task, list, rules);
  assert.equal(aliases.get('P1'), 'user-123');
  assert.ok(!user.includes('Siti') && !user.includes('user-123') && !user.includes('John'));
  assert.ok(user.includes('"P2"') && user.includes('Fix check-in kiosk printer'));
});

test('parseAiRanking keeps known, unique ids with rule scores, caps at 3, and scrubs aliases', () => {
  const list = ['a', 'b', 'c', 'd'].map((id) => cand(id, id.toUpperCase()));
  const rules = new Map(rankByRules(list, task).map((s) => [s.userId, s]));
  const aliases = new Map([['P1', 'a'], ['P2', 'b'], ['P3', 'c'], ['P4', 'd']]);
  const raw = JSON.stringify({ suggestions: [
    { candidate: 'p2', reason: 'Free all week, unlike P1.' },
    { candidate: 'P2', reason: 'dup' },
    { candidate: 'P9', reason: 'unknown' },
    { candidate: 'P4', reason: 'ok' }, { candidate: 'P1', reason: 'ok' }, { candidate: 'P3', reason: 'ok' },
  ] });
  const out = parseAiRanking(raw, aliases, rules)!;
  assert.deepEqual(out.map((s) => s.userId), ['b', 'd', 'a']);
  assert.equal(out.length, SUGGESTIONS);
  assert.equal(out[0].reasons[0], 'Free all week, unlike another candidate.');
  assert.equal(out[0].score, rules.get('b')!.score);
});

test('parseAiRanking returns null for unusable output (caller falls back to rules)', () => {
  const aliases = new Map([['P1', 'a']]);
  assert.equal(parseAiRanking('not json', aliases, new Map()), null);
  assert.equal(parseAiRanking('{"suggestions": "x"}', aliases, new Map()), null);
  assert.equal(parseAiRanking('{"suggestions": [{"candidate": "P7", "reason": "x"}]}', aliases, new Map()), null);
});
