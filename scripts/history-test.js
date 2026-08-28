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
  windows: [
    { id: 'w1', name: '', enabled: true, start: '09:00', end: '12:00' },
    { id: 'w2', name: '', enabled: true, start: '18:00', end: '21:00' }
  ]
};

const morning = new Date(2026, 7, 27, 10, 0);

// --- today opens as pending; untracked days stay unknown ---------------------
let summary = history.summary(config, morning, 14);
assert.strictEqual(summary.today, '2026-08-27');
assert.strictEqual(summary.todayStatus.w1.status, 'pending');
assert.strictEqual(summary.todayStatus.w2.status, 'pending');
assert.strictEqual(summary.trackedCount, 2, 'only today is tracked so far');
assert.strictEqual(summary.days[0].w1, 'unknown', 'days before install are not invented as missed');

// --- confirming and missing ---------------------------------------------------
history.confirm('2026-08-27', 'w1', { at: '2026-08-27T09:24:00.000Z' });
history.miss('2026-08-26', 'w2');
summary = history.summary(config, morning, 14);
assert.strictEqual(summary.confirmedCount, 1);
assert.strictEqual(summary.trackedCount, 3);
assert.deepStrictEqual(summary.latestMissed, { date: '2026-08-26', id: 'w2' });

// --- backdating a missed dose, and undoing it --------------------------------
assert.ok(history.confirm('2026-08-26', 'w2', { backdated: true }));
assert.strictEqual(history.getDay('2026-08-26').w2.status, 'confirmed');
assert.ok(history.undoBackdate('2026-08-26', 'w2'));
assert.strictEqual(history.getDay('2026-08-26').w2.status, 'missed');
assert.strictEqual(history.undoBackdate('2026-08-26', 'w2'), null, 'undo does not apply twice');

// --- undoing a live confirmation ---------------------------------------------
assert.ok(history.undoTodayConfirmation('2026-08-27', 'w1'));
assert.strictEqual(history.getDay('2026-08-27').w1.status, 'pending');
history.confirm('2026-08-27', 'w1', { at: '2026-08-27T09:24:00.000Z' });

// --- a snooze is persisted ----------------------------------------------------
const until = morning.getTime() + 30 * 60000;
assert.ok(history.setSnooze('2026-08-27', 'w2', until));
history._setFilePathForTests(file);
assert.strictEqual(history.getDay('2026-08-27').w2.snoozeUntil, until, 'the snooze survives a reload');
assert.ok(history.clearSnooze('2026-08-27', 'w2'));
assert.strictEqual(history.getDay('2026-08-27').w2.snoozeUntil, 0);

// --- the catch-up deadline rolls a dose to missed -----------------------------
history.sync(config, new Date(2026, 7, 27, 23, 30));
assert.strictEqual(history.getDay('2026-08-27').w2.status, 'missed', 'past 21:00 + 120m the dose is missed');
assert.strictEqual(history.getDay('2026-08-27').w1.status, 'confirmed', 'a confirmed dose is untouched');

// --- widening the schedule reopens it -----------------------------------------
const widened = JSON.parse(JSON.stringify(config));
widened.windows[1].end = '23:45';
history.reconcileScheduleChange(widened, new Date(2026, 7, 27, 23, 30));
assert.strictEqual(history.getDay('2026-08-27').w2.status, 'pending', 'a reachable dose reopens');

history.confirm('2026-08-27', 'w2', { backdated: true });
history.reconcileScheduleChange(widened, new Date(2026, 7, 27, 23, 30));
assert.strictEqual(history.getDay('2026-08-27').w2.status, 'confirmed');

// --- disabled windows leave the denominator ------------------------------------
const eveningOff = JSON.parse(JSON.stringify(config));
eveningOff.windows[1].enabled = false;
history._resetForTests();
const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'inhaler-history2-'));
history._setFilePathForTests(path.join(dir2, 'history.json'));
const offSummary = history.summary(eveningOff, morning, 14);
assert.strictEqual(offSummary.todayStatus.w2.status, 'disabled');
assert.strictEqual(offSummary.trackedCount, 1, 'a disabled dose is not counted against the user');

// --- corrupt file falls back to the backup -------------------------------------
history._setFilePathForTests(file);
assert.ok(fs.existsSync(file + '.bak'));
fs.writeFileSync(file, '{ this is not json', 'utf8');
history._setFilePathForTests(file);
assert.strictEqual(history.getDay('2026-08-27').w1.status, 'confirmed');

// --- garbage input normalises instead of throwing --------------------------------
const cleaned = history.normalize({ days: { 'not-a-date': { w1: { status: 'bogus' } }, '2026-08-27': 'nope' } });
assert.deepStrictEqual(cleaned.days, {}, 'invalid days are dropped');

history._resetForTests();
fs.rmSync(dir, { recursive: true, force: true });
fs.rmSync(dir2, { recursive: true, force: true });
console.log('HISTORY_TEST_OK');
