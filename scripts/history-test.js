// Adherence store: persistence, recovery, and status transitions.
// Run: npm run test:history

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const history = require('../src/main/history');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inhaler-history-'));
const file = path.join(dir, 'history.json');
history._setFilePathForTests(file);

const config = {
  graceMinutes: 120,
  windows: {
    morning: { enabled: true, start: '09:00', end: '12:00' },
    evening: { enabled: true, start: '18:00', end: '21:00' }
  }
};

const morning = new Date(2026, 7, 27, 10, 0);

// --- today opens as pending; untracked days stay unknown ---------------------
let summary = history.summary(config, morning, 14);
assert.strictEqual(summary.today, '2026-08-27');
assert.strictEqual(summary.todayStatus.morning.status, 'pending');
assert.strictEqual(summary.todayStatus.evening.status, 'pending');
assert.strictEqual(summary.trackedCount, 2, 'only today is tracked so far');
assert.strictEqual(summary.days[0].morning, 'unknown', 'days before install are not invented as missed');

// --- confirming and missing ---------------------------------------------------
history.confirm('2026-08-27', 'morning', { at: '2026-08-27T09:24:00.000Z' });
history.miss('2026-08-26', 'evening');
summary = history.summary(config, morning, 14);
assert.strictEqual(summary.confirmedCount, 1);
assert.strictEqual(summary.trackedCount, 3);
assert.deepStrictEqual(summary.latestMissed, { date: '2026-08-26', dose: 'evening' });

// --- backdating a missed dose, and undoing it --------------------------------
assert.ok(history.confirm('2026-08-26', 'evening', { backdated: true }));
assert.strictEqual(history.getDay('2026-08-26').evening.status, 'confirmed');
assert.ok(history.undoBackdate('2026-08-26', 'evening'));
assert.strictEqual(history.getDay('2026-08-26').evening.status, 'missed');
assert.strictEqual(history.undoBackdate('2026-08-26', 'evening'), null, 'undo does not apply twice');

// --- undoing a live confirmation ---------------------------------------------
assert.ok(history.undoTodayConfirmation('2026-08-27', 'morning'));
assert.strictEqual(history.getDay('2026-08-27').morning.status, 'pending');
history.confirm('2026-08-27', 'morning', { at: '2026-08-27T09:24:00.000Z' });

// --- a snooze is persisted ----------------------------------------------------
const until = morning.getTime() + 30 * 60000;
assert.ok(history.setSnooze('2026-08-27', 'evening', until));
history._setFilePathForTests(file);   // force a reload from disk
assert.strictEqual(history.getDay('2026-08-27').evening.snoozeUntil, until, 'the snooze survives a reload');
assert.ok(history.clearSnooze('2026-08-27', 'evening'));
assert.strictEqual(history.getDay('2026-08-27').evening.snoozeUntil, 0);

// --- the catch-up deadline rolls a dose to missed -----------------------------
history.sync(config, new Date(2026, 7, 27, 23, 30));
assert.strictEqual(history.getDay('2026-08-27').evening.status, 'missed', 'past 21:00 + 120m the dose is missed');
assert.strictEqual(history.getDay('2026-08-27').morning.status, 'confirmed', 'a confirmed dose is untouched');

// --- widening the schedule reopens it -----------------------------------------
const widened = JSON.parse(JSON.stringify(config));
widened.windows.evening.end = '23:45';
history.reconcileScheduleChange(widened, new Date(2026, 7, 27, 23, 30));
assert.strictEqual(history.getDay('2026-08-27').evening.status, 'pending', 'a reachable dose reopens');

// A backdated confirmation must not be reopened by a schedule change.
history.confirm('2026-08-27', 'evening', { backdated: true });
history.reconcileScheduleChange(widened, new Date(2026, 7, 27, 23, 30));
assert.strictEqual(history.getDay('2026-08-27').evening.status, 'confirmed');

// --- disabled windows leave the denominator ------------------------------------
const eveningOff = JSON.parse(JSON.stringify(config));
eveningOff.windows.evening.enabled = false;
history._resetForTests();
const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'inhaler-history2-'));
history._setFilePathForTests(path.join(dir2, 'history.json'));
const offSummary = history.summary(eveningOff, morning, 14);
assert.strictEqual(offSummary.todayStatus.evening.status, 'disabled');
assert.strictEqual(offSummary.trackedCount, 1, 'a disabled dose is not counted against the user');

// --- corrupt file falls back to the backup -------------------------------------
history._setFilePathForTests(file);
assert.ok(fs.existsSync(file + '.bak'), 'writes keep a recovery copy');
fs.writeFileSync(file, '{ this is not json', 'utf8');
history._setFilePathForTests(file);
assert.strictEqual(history.getDay('2026-08-27').morning.status, 'confirmed', 'a corrupt store recovers from backup');

// --- garbage input normalises instead of throwing --------------------------------
const cleaned = history.normalize({ days: { 'not-a-date': { morning: { status: 'bogus' } }, '2026-08-27': 'nope' } });
assert.deepStrictEqual(cleaned.days, {}, 'invalid days are dropped');

history._resetForTests();
fs.rmSync(dir, { recursive: true, force: true });
fs.rmSync(dir2, { recursive: true, force: true });
console.log('HISTORY_TEST_OK');
