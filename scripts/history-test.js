const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const history = require('../src/main/history');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inhaler-history-'));
const file = path.join(tempDir, 'history.json');
const config = {
  graceMinutes: 120,
  windows: {
    morning: { enabled: true, start: '09:00', end: '12:00' },
    evening: { enabled: true, start: '18:00', end: '21:00' }
  }
};

history._setFilePathForTests(file);

const morning = new Date(2026, 7, 27, 10, 0);
history.sync(config, morning);
let summary = history.summary(config, morning, 14);
assert.strictEqual(summary.today, '2026-08-27');
assert.strictEqual(summary.todayStatus.morning.status, 'pending');
assert.strictEqual(summary.todayStatus.evening.status, 'pending');
assert.strictEqual(summary.trackedCount, 2);

history.confirm('2026-08-27', 'morning', { at: '2026-08-27T09:24:00.000Z' });
history.miss('2026-08-26', 'evening');
summary = history.summary(config, morning, 14);
assert.strictEqual(summary.confirmedCount, 1);
assert.strictEqual(summary.trackedCount, 3);
assert.deepStrictEqual(summary.latestMissed, { date: '2026-08-26', dose: 'evening' });

history.confirm('2026-08-26', 'evening', { backdated: true, at: '2026-08-27T10:05:00.000Z' });
assert.strictEqual(history.getDay('2026-08-26').evening.backdated, true);
history.undoBackdate('2026-08-26', 'evening');
assert.strictEqual(history.getDay('2026-08-26').evening.status, 'missed');

history._setFilePathForTests(file);
assert.strictEqual(history.getDay('2026-08-27').morning.status, 'confirmed');

const late = new Date(2026, 7, 27, 23, 30);
history.sync(config, late);
assert.strictEqual(history.getDay('2026-08-27').evening.status, 'missed');
assert.strictEqual(history.getDay('2026-08-27').morning.status, 'confirmed');

const file2 = path.join(tempDir, 'history-complete.json');
const morningOnly = {
  graceMinutes: 120,
  windows: {
    morning: { enabled: true, start: '09:00', end: '12:00' },
    evening: { enabled: false, start: '18:00', end: '21:00' }
  }
};
history._resetForTests();
history._setFilePathForTests(file2);
history.sync(morningOnly, morning);
history.confirm('2026-08-27', 'morning');
summary = history.summary(morningOnly, morning, 14);
assert.strictEqual(summary.todayComplete, true, 'disabled evening does not block today complete');
assert.strictEqual(summary.todayStatus.evening.status, 'disabled');

const file3 = path.join(tempDir, 'history-rollover.json');
history._resetForTests();
history._setFilePathForTests(file3);
history.sync(config, new Date(2026, 7, 27, 10, 0));
assert.strictEqual(history.getDay('2026-08-27').evening.status, 'pending');
summary = history.summary(config, new Date(2026, 7, 28, 9, 0), 14);
assert.strictEqual(history.getDay('2026-08-27').evening.status, 'missed', 'pending yesterday becomes missed on next-day sync');

history._resetForTests();
fs.rmSync(tempDir, { recursive: true, force: true });
console.log('HISTORY_TEST_OK');
