#!/usr/bin/env node
// End-to-end check of revoking approved leave in a real browser (fake Google + in-memory data store).
// Seeds approved leave: Bob's future block, Cy's leave already under way (one day since changed by a planner),
// Bob's finished leave, and Cy's far-future block. Needs `npm run build` first and Playwright.
// Run: node scripts/e2e/revoke.e2e.mjs
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { dayPlus as d, startHarness } from './harness.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');

const LEAVE_HEAD = ['id', 'userId', 'startDate', 'endDate', 'code', 'note', 'status', 'decidedBy', 'decidedAt', 'decisionNote', 'createdAt', 'updatedAt'];
const approved = (id, userId, start, end) => [id, userId, start, end, 'AL', '', 'approved', 'u-ann', '2026-10-01 00:00:00.000', '', '2026-10-01 00:00:00.000', '2026-10-01 00:00:00.000'];
const ROSTER_HEAD = ['id', 'userId', 'date', 'type', 'code', 'updatedAt'];
const cell = (userId, date, code = 'AL', type = 'leave') => [`${userId}_${date}`, userId, date, type, code, '2026-10-01 00:00:00.000'];
const days = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => d(a + i));

const { dir, table, plus, signIn, check, until, stop, finish } = await startHarness({
  prefix: 'revoke-e2e', port: 4397,
  people: [['u-root', 'root@airasia.com', 'Root Admin', 'admin'], ['u-ann', 'ann@airasia.com', 'Ann Planner', 'planner'], ['u-bob', 'bob@airasia.com', 'Bob Member', 'member'], ['u-cy', 'cy@airasia.com', 'Cy Member', 'member']],
  seed: {
    leave_requests: [
      LEAVE_HEAD,
      approved('R1', 'u-bob', d(5), d(7)), // not started
      approved('R2', 'u-cy', d(-2), d(2)), // under way
      approved('R3', 'u-bob', d(-10), d(-8)), // finished
      approved('R4', 'u-cy', d(20), d(21)), // far future (phone dialog check)
    ],
    roster: [
      ROSTER_HEAD,
      ...days(5, 7).map((x) => cell('u-bob', x)),
      ...days(-2, 2).map((x) => cell('u-cy', x, x === d(1) ? 'STD' : 'AL', x === d(1) ? 'shift' : 'leave')), // a planner changed tomorrow to a work shift
      ...days(-10, -8).map((x) => cell('u-bob', x)),
      ...days(20, 21).map((x) => cell('u-cy', x)),
    ],
  },
});

const req = (id) => table('leave_requests').find((r) => r.id === id);
const rosterOf = (userId) => table('roster').filter((r) => r.userId === userId);
const notesFor = (userId, kind) => table('notifications').filter((n) => n.userId === userId && n.kind === kind);

const browser = await chromium.launch();
try {
  // ── Bob (member) takes back his own approved leave ──
  const bob = await signIn(browser, 'bob@airasia.com');
  const bp = bob.page;
  await bp.waitForSelector('h1:has-text("Leave")');
  check("Bob sees only his own two requests", (await bp.locator('tbody tr').count()) === 2 && (await bp.locator('text=Cy Member').count()) === 0);
  check('only the leave that has not ended offers "Cancel leave" (the finished one does not)', (await bp.getByRole('button', { name: /Cancel approved leave for Bob/ }).count()) === 1);
  await bp.getByRole('button', { name: /Cancel approved leave for Bob/ }).click();
  const dlg = bp.getByRole('alertdialog');
  await dlg.waitFor();
  const text = (await dlg.textContent()) ?? '';
  check('the dialog says exactly what leaves the roster (3 remaining days)', /3 remaining days/.test(text) && text.includes(plus(5)) && text.includes(plus(7)));
  check('Cancel is the default focus ("Keep leave")', await bp.evaluate(() => document.activeElement?.textContent === 'Keep leave'));
  await bp.keyboard.press('Escape');
  await dlg.waitFor({ state: 'detached' });
  check('Escape closes it and changes nothing', req('R1').status === 'approved' && rosterOf('u-bob').length === 6);

  await bp.getByRole('button', { name: /Cancel approved leave for Bob/ }).click();
  await dlg.waitFor();
  await bp.fill('#rv-note', 'Plans changed');
  await dlg.getByRole('button', { name: 'Cancel leave', exact: true }).click();
  await bp.waitForSelector('text=Leave cancelled: 3 roster days cleared', { timeout: 15000 }).catch(() => {});
  check('R1 is revoked by Bob himself, with his reason', await until(() => req('R1').status === 'revoked'), `${req('R1').status} by ${req('R1').decidedBy}: ${req('R1').decisionNote}`);
  check('R1 roster days are gone; his finished leave (past) is untouched', rosterOf('u-bob').length === 3 && rosterOf('u-bob').every((r) => r.date < plus(0)), rosterOf('u-bob').map((r) => r.date).join(','));
  check('approvers were told he cancelled; he was not told about his own action', notesFor('u-ann', 'leave_revoked').length === 1 && notesFor('u-root', 'leave_revoked').length === 1 && notesFor('u-bob', 'leave_revoked').length === 0 && /cancelled approved leave/.test(notesFor('u-ann', 'leave_revoked')[0].title));
  check('the list shows it as Revoked with no further buttons', (await bp.locator('.badge:has-text("Revoked")').count()) >= 1 && (await bp.getByRole('button', { name: /approved leave for/ }).count()) === 0);

  // ── Ann (planner) shortens Cy's leave that is already under way ──
  const ann = await signIn(browser, 'ann@airasia.com');
  const ap = ann.page;
  await ap.waitForSelector('text=Cy Member');
  const revokes = await ap.getByRole('button', { name: /Revoke approved leave for/ }).count();
  check('planner can revoke the two unfinished approved leaves (Cy\'s), not the finished or already revoked', revokes === 2, `${revokes} Revoke buttons`);
  // Approved rows are listed newest start first: Cy's far-future block (R4), then the leave under way (R2).
  await ap.getByRole('button', { name: /Revoke approved leave for Cy/ }).last().click();
  const adlg = ap.getByRole('alertdialog');
  await adlg.waitFor();
  const atext = (await adlg.textContent()) ?? '';
  check('the dialog for leave under way says passed days stay and the new end date', /already passed stay/.test(atext) && atext.includes(plus(-1)) && /3 remaining days/.test(atext), atext.slice(0, 220));
  await ap.fill('#rv-note', 'Coverage needed');
  await adlg.getByRole('button', { name: 'Revoke leave', exact: true }).click();
  await ap.waitForSelector('text=Leave shortened', { timeout: 15000 }).catch(() => {});
  const shortened = await until(() => req('R2').endDate === plus(-1));
  check('R2 now ends yesterday and stays approved, with a note of what changed', shortened && req('R2').status === 'approved' && req('R2').decisionNote.startsWith('Shortened from'), `${req('R2').status} ${req('R2').startDate}..${req('R2').endDate}: ${req('R2').decisionNote}`);
  const cy = rosterOf('u-cy').filter((r) => r.date < plus(10)).map((r) => `${r.date}:${r.code}`).sort();
  check('past days stay, today and +2 are cleared, and the day a planner changed (+1 STD) is left alone', JSON.stringify(cy) === JSON.stringify([`${plus(-2)}:AL`, `${plus(-1)}:AL`, `${plus(1)}:STD`]), cy.join(' '));
  check('the toast says one day was left as it is', (await ap.locator('text=1 day was changed since').count()) >= 1);
  check('Cy was told his leave was shortened', notesFor('u-cy', 'leave_revoked').length === 1 && /shortened/.test(notesFor('u-cy', 'leave_revoked')[0].title) && /Coverage needed/.test(notesFor('u-cy', 'leave_revoked')[0].body));
  check('the shortened leave offers no further revoke (it has ended)', (await ap.getByRole('button', { name: /Revoke approved leave for Cy/ }).count()) === 1); // only R4 remains

  // ── Cy (member): sees his own, cannot revoke someone else's ──
  const cyp = (await signIn(browser, 'cy@airasia.com')).page;
  await cyp.waitForSelector('h1:has-text("Leave")');
  check("Cy sees only his own requests and may cancel only the one still ahead", (await cyp.locator('text=Bob Member').count()) === 0 && (await cyp.getByRole('button', { name: /Cancel approved leave for Cy/ }).count()) === 1);

  // ── Audit + phone ──
  const audit = table('audit_log').filter((e) => e.entity === 'leave');
  check('both revocations are audit-logged with what was cleared', audit.some((e) => /Cancelled their approved AL leave/.test(e.summary) && /3 roster days cleared/.test(e.summary)) && audit.some((e) => /Shortened AL leave/.test(e.summary) && /2 roster days cleared, 1 left as they were/.test(e.summary)), audit.map((e) => e.summary).join(' | '));
  const root = await signIn(browser, 'root@airasia.com', { width: 375, height: 800 });
  const rp = root.page;
  await rp.waitForSelector('h1:has-text("Leave")');
  await rp.getByRole('button', { name: /Revoke approved leave for Cy/ }).click();
  await rp.getByRole('alertdialog').waitFor();
  await rp.waitForTimeout(800); // the sheet slides in; measure once it has settled
  const box = await rp.getByRole('alertdialog').boundingBox();
  check('at 375px the dialog is fully on screen and the page does not scroll sideways', !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 375 && box.y + box.height <= 800 && !(await rp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), JSON.stringify(box));
  await rp.screenshot({ path: join(dir, 'revoke-375.png') });
  await rp.keyboard.press('Escape');
  await root.ctx.close(); await ann.ctx.close(); await bob.ctx.close();
} finally {
  await browser.close();
  stop();
}
finish('revoke');
