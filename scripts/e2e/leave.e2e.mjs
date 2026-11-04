import { join } from 'node:path';
import { createRequire } from 'node:module';
import { startHarness } from './harness.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const { dir, BASE, table, plus, signIn, check, until, stop, finish } = await startHarness({
  prefix: 'leave-e2e', port: 4399,
  people: [['u-root', 'root@airasia.com', 'Root Admin', 'admin'], ['u-ann', 'ann@airasia.com', 'Ann Planner', 'planner'], ['u-bob', 'bob@airasia.com', 'Bob Member', 'member']],
  // A coverage target nobody meets (no STD shifts rostered) so the Roster panel has something to say.
  seed: { coverage_targets: [['id', 'locationId', 'code', 'days', 'minStaff', 'active'], ['c1', '', 'STD', 'every', 2, true]] },
});

async function request(page, { code, from, to, note }) {
  await page.getByRole('button', { name: /Request leave/ }).first().click();
  await page.selectOption('#lv-code', code);
  await page.fill('#lv-startDate', from);
  await page.fill('#lv-endDate', to);
  if (note) await page.fill('#lv-note', note);
  await page.getByRole('button', { name: 'Send request' }).click();
}

const browser = await chromium.launch();
try {
  // ── Bob (member) requests leave ──
  const bob = await signIn(browser, 'bob@airasia.com');
  const bp = bob.page;
  await bp.waitForSelector('h1:has-text("Leave")');
  check('member sees an empty Leave page with a Request button', (await bp.locator('text=No leave requests yet').count()) === 1 && (await bp.getByRole('button', { name: /Request leave/ }).count()) >= 1);
  await request(bp, { code: 'AL', from: plus(3), to: plus(5), note: 'Family trip' });
  await bp.waitForSelector('text=Requested 3 days of leave', { timeout: 15000 }).catch(() => {});
  let reqs = table('leave_requests');
  check('request is stored as pending for Bob, 3 days', reqs.length === 1 && reqs[0].status === 'pending' && reqs[0].userId === 'u-bob' && reqs[0].startDate === plus(3) && reqs[0].endDate === plus(5) && reqs[0].code === 'AL', JSON.stringify(reqs[0] ?? null));
  check('request shows in his list as Pending with a cancel option', (await bp.locator('.badge:has-text("Pending")').count()) >= 1 && (await bp.getByRole('button', { name: 'Cancel request' }).count()) === 1);
  const memberButtons = await bp.getByRole('button', { name: /^(Approve|Reject) leave for/ }).allTextContents();
  check('a member has no approve / reject buttons', memberButtons.length === 0, memberButtons.join('|'));

  await request(bp, { code: 'AL', from: plus(4), to: plus(6) });
  await bp.waitForSelector('.field-error', { timeout: 15000 }).catch(() => {});
  check('an overlapping request is refused inline', (await bp.locator('.field-error').filter({ hasText: 'already have a pending or approved' }).count()) >= 1);
  check('...and nothing extra was stored', table('leave_requests').length === 1);
  await bp.keyboard.press('Escape');

  // ── Ann (planner) approves ──
  const ann = await signIn(browser, 'ann@airasia.com');
  const ap = ann.page;
  await ap.waitForSelector('text=Bob Member');
  check("planner sees Bob's pending request with Approve / Reject", (await ap.getByRole('button', { name: /Approve leave for Bob/ }).count()) === 1 && (await ap.getByRole('button', { name: /Reject leave for Bob/ }).count()) === 1);
  await ap.getByRole('button', { name: /Approve leave for Bob/ }).click();
  await ap.waitForSelector('text=Approved 3 days', { timeout: 15000 }).catch(() => {});
  reqs = table('leave_requests');
  check('request is approved by Ann', reqs[0].status === 'approved' && reqs[0].decidedBy === 'u-ann', `${reqs[0].status} by ${reqs[0].decidedBy}`);
  const roster = table('roster').filter((r) => r.userId === 'u-bob');
  check('approval wrote AL into the roster for each of the 3 days', roster.length === 3 && roster.every((r) => r.code === 'AL' && r.type === 'leave') && [plus(3), plus(4), plus(5)].every((d) => roster.some((r) => r.date === d && r.id === `u-bob_${d}`)), roster.map((r) => r.date).join(','));
  check('an approved request can no longer be decided', (await ap.getByRole('button', { name: /Approve leave for Bob/ }).count()) === 0);

  // ── Bob: approved can't be cancelled; a second pending request can ──
  await bp.reload();
  await bp.waitForSelector('.badge:has-text("Approved")');
  check('Bob sees it Approved, with no cancel', (await bp.getByRole('button', { name: 'Cancel request' }).count()) === 0);
  await request(bp, { code: 'MC', from: plus(10), to: plus(10) });
  await bp.waitForSelector('text=Requested 1 day of leave', { timeout: 15000 }).catch(() => {});
  await bp.getByRole('button', { name: 'Cancel request' }).click();
  await bp.waitForSelector('text=Request cancelled', { timeout: 15000 }).catch(() => {});
  check('a pending request can be cancelled by its owner', table('leave_requests').some((r) => r.startDate === plus(10) && r.status === 'cancelled'));

  // ── Rejecting with a reason leaves the roster alone ──
  await request(bp, { code: 'AL', from: plus(20), to: plus(21), note: 'Holiday' });
  await bp.waitForSelector('text=Requested 2 days of leave', { timeout: 15000 }).catch(() => {});
  await ap.reload();
  await ap.getByRole('button', { name: /Reject leave for Bob/ }).click();
  await ap.fill('#rj-note', 'Peak season');
  await ap.getByRole('button', { name: 'Reject', exact: true }).click();
  await ap.waitForSelector('text=Rejected the request from Bob', { timeout: 15000 }).catch(() => {});
  const rejected = table('leave_requests').find((r) => r.startDate === plus(20));
  check('rejected with a reason, no roster rows for it', rejected?.status === 'rejected' && rejected.decisionNote === 'Peak season' && !table('roster').some((r) => r.date === plus(20)), JSON.stringify(rejected ?? null));

  // ── Notifications ──
  const notes = table('notifications');
  const byUser = (u, kind) => table('notifications').filter((n) => n.userId === u && n.kind === kind); // always the live table
  check('admin and planner were told about each of the 3 requests; the requester was not', byUser('u-ann', 'leave_requested').length === 3 && byUser('u-root', 'leave_requested').length === 3 && byUser('u-bob', 'leave_requested').length === 0);
  check('Bob was told about both decisions, including the reason', byUser('u-bob', 'leave_decided').length === 2 && notes.some((n) => n.userId === 'u-bob' && n.body.includes('Peak season')));
  check('the person who decided was not told about their own decision', byUser('u-ann', 'leave_decided').length === 0);
  await ap.goto(`${BASE}/notifications`);
  await ap.waitForSelector('h1:has-text("Notifications")');
  check("a person sees only their own notifications (Ann has 3, none of Bob's)", (await ap.locator('.inbox-item').count()) === 3 && (await ap.locator('.inbox-item:has-text("Your leave was")').count()) === 0);

  await bp.goto(`${BASE}/leave`);
  await bp.waitForSelector('.sidebar-link[href="/notifications"] .nav-badge');
  check('Bob\'s menu shows an unread badge of 2', (await bp.locator('.sidebar-link[href="/notifications"] .nav-badge').first().textContent()) === '2');
  await bp.click('.sidebar-link[href="/notifications"]');
  await bp.waitForSelector('.inbox-item.is-unread');
  check('both are listed as unread (dot + "New" text)', (await bp.locator('.inbox-item.is-unread').count()) === 2 && (await bp.locator('.inbox-item.is-unread .badge:has-text("New")').count()) === 2);
  await bp.locator('.inbox-item.is-unread').first().click();
  await bp.waitForURL(`${BASE}/leave`, { timeout: 15000 });
  check('opening one goes to its page and marks only that one read', await until(() => byUser('u-bob', 'leave_decided').filter((n) => n.readAt).length === 1));
  await bp.waitForFunction(() => document.querySelector('.sidebar-link[href="/notifications"] .nav-badge')?.textContent === '1', null, { timeout: 15000 }).catch(() => {});
  check('the badge drops to 1', (await bp.locator('.sidebar-link[href="/notifications"] .nav-badge').first().textContent().catch(() => '')) === '1');
  await bp.click('.sidebar-link[href="/notifications"]');
  await bp.getByRole('button', { name: /Mark all as read/ }).click();
  await bp.waitForSelector('text=All caught up', { timeout: 15000 }).catch(() => {});
  check('"Mark all as read" clears the rest and the badge', (await until(() => byUser('u-bob', 'leave_decided').every((n) => n.readAt))) && (await bp.locator('.sidebar-link[href="/notifications"] .nav-badge').count()) === 0);
  check("marking Bob's notifications did not touch anyone else's", table('notifications').filter((n) => n.userId !== 'u-bob').every((n) => !n.readAt));

  // ── Audit log (admin) and roster panel, at phone width ──
  const audit = table('audit_log');
  check('every step was audit-logged', ['create', 'status'].every((a) => audit.some((e) => e.entity === 'leave' && e.action === a)) && audit.length >= 6, `${audit.length} entries`);
  const admin = await signIn(browser, 'root@airasia.com', { width: 375, height: 800 });
  const rp = admin.page;
  await rp.waitForSelector('.topbar-bell .nav-badge');
  check('on a phone the top-bar bell shows the admin\'s 3 unread', (await rp.locator('.topbar-bell .nav-badge').textContent()) === '3' && /3 unread/.test((await rp.locator('.topbar-bell').getAttribute('aria-label')) ?? ''));
  await rp.goto(`${BASE}/notifications`);
  await rp.waitForSelector('.inbox-item');
  check('notifications at 375px: no horizontal scroll, 44px+ rows', !(await rp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) && (await rp.locator('.inbox-item').first().evaluate((el) => el.getBoundingClientRect().height)) >= 44);
  await rp.screenshot({ path: join(dir, 'notifications-375.png') });
  await rp.goto(`${BASE}/audit`);
  await rp.waitForSelector('h1:has-text("Audit log")');
  check('admin sees the audit log at 375px with no horizontal scroll', !(await rp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)));
  check('audit table collapses to cards on a phone (header hidden)', await rp.evaluate(() => getComputedStyle(document.querySelector('.card-table thead')).display === 'none'));
  check('audit rows name the person', (await rp.locator('text=Bob Member').count()) >= 1);
  await rp.screenshot({ path: join(dir, 'audit-375.png') });
  await rp.goto(`${BASE}/leave`);
  await rp.waitForSelector('h1:has-text("Leave")');
  check('leave page has no horizontal scroll at 375px', !(await rp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)));
  check('leave table collapses to cards on a phone', await rp.evaluate(() => getComputedStyle(document.querySelector('.card-table thead')).display === 'none'));
  await rp.screenshot({ path: join(dir, 'leave-375.png') });
  await rp.goto(`${BASE}/roster`);
  await rp.waitForSelector('text=Coverage & rules');
  const panel = await rp.locator('.insights').textContent();
  check('roster shows coverage gaps for the unmet STD ≥ 2 target', /coverage gaps?/.test(panel ?? ''), (panel ?? '').slice(0, 80));
  await rp.screenshot({ path: join(dir, 'roster-375.png') });
  await admin.ctx.close();

  // planners cannot open the audit log
  await ap.goto(`${BASE}/audit`);
  check('a planner is told they have no access to the audit log', (await ap.locator('text=have access to the audit log').count()) === 1);
  await bob.ctx.close();
  await ann.ctx.close();
} finally {
  await browser.close();
  stop();
}
finish('leave');
