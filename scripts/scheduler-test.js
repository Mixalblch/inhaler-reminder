const assert = require('assert');
const scheduler = require('../src/main/scheduler');

const OrigDate = Date;
let now = new Date(2026, 7, 27, 10, 0, 0, 0);

function MockDate(...args) {
  if (args.length === 0) return new OrigDate(now.getTime());
  return new OrigDate(...args);
}
MockDate.now = function () { return now.getTime(); };
MockDate.parse = OrigDate.parse;
MockDate.UTC = OrigDate.UTC;
Object.setPrototypeOf(MockDate, OrigDate);
MockDate.prototype = OrigDate.prototype;

function setNow(y, m, d, h, min) {
  now = new Date(y, m, d, h, min, 0, 0);
}

const events = [];
const cfg = {
  graceMinutes: 30,
  idleThresholdSeconds: 300,
  snoozeMinutes: 15,
  windows: {
    morning: { enabled: true, start: '09:00', end: '12:00' },
    evening: { enabled: true, start: '18:00', end: '21:00' }
  }
};

function start(idleSeconds) {
  events.length = 0;
  scheduler.start({
    getConfig: function () { return cfg; },
    isIdleSeconds: function () { return idleSeconds; },
    now: function () { return new OrigDate(now.getTime()); },
    onReminder: function (key) { events.push({ type: 'reminder', key: key, at: now.toISOString() }); },
    recordMissed: function (day, dose) { events.push({ type: 'missed', day: day, dose: dose }); },
    recordConfirmed: function (day, dose) { events.push({ type: 'confirmed', day: day, dose: dose }); },
    onDayChange: function (previousDay) { events.push({ type: 'dayChange', previousDay: previousDay }); },
    getHistoryDay: function () { return {}; }
  });
}

function status(dose) {
  return scheduler.getState().windows[dose].status;
}

function missed(dose) {
  return events.filter(function (e) { return e.type === 'missed' && e.dose === dose; });
}

function reminders(dose) {
  return events.filter(function (e) { return e.type === 'reminder' && e.key === dose; });
}

global.Date = MockDate;

try {
  setNow(2026, 7, 27, 10, 0);
  start(0);
  assert.strictEqual(status('morning'), 'fired', 'morning fires while user is present in window');
  assert.strictEqual(reminders('morning').length, 1);

  setNow(2026, 7, 27, 14, 0);
  scheduler.tick();
  assert.strictEqual(status('morning'), 'skipped', 'fired morning expires after grace and is marked missed');
  assert.strictEqual(missed('morning').length, 1, 'expired fired dose is recorded as missed');

  scheduler.stop();

  setNow(2026, 7, 27, 10, 0);
  cfg.windows.morning = { enabled: true, start: '09:00', end: '20:00' };
  cfg.windows.evening = { enabled: true, start: '18:00', end: '21:00' };
  start(0);
  assert.strictEqual(status('morning'), 'fired');
  setNow(2026, 7, 27, 18, 5);
  scheduler.tick();
  assert.strictEqual(status('morning'), 'fired', 'already-shown morning is not replaced by evening');
  assert.strictEqual(status('evening'), 'pending', 'evening waits until the visible reminder is cleared');
  assert.strictEqual(reminders('evening').length, 0);
  assert.strictEqual(scheduler.confirm(), 'morning');
  scheduler.tick();
  assert.strictEqual(status('evening'), 'fired', 'evening fires after morning is confirmed');
  assert.strictEqual(scheduler.confirm(), 'evening');
  scheduler.stop();

  cfg.windows.morning = { enabled: true, start: '09:00', end: '12:00' };
  cfg.windows.evening = { enabled: true, start: '18:00', end: '21:00' };
  setNow(2026, 7, 27, 10, 0);
  start(0);
  assert.strictEqual(status('morning'), 'fired');
  setNow(2026, 7, 28, 0, 5);
  scheduler.tick();
  assert.ok(events.some(function (e) { return e.type === 'dayChange' && e.previousDay === '2026-08-27'; }), 'day rollover notifies so history can close yesterday');
  assert.strictEqual(scheduler.getState().day, '2026-08-28');
  assert.notStrictEqual(status('morning'), 'fired', 'pendingWindow from yesterday does not keep today fired before the window');
  const confirmed = scheduler.confirm();
  assert.strictEqual(confirmed, null, 'stale leftover confirm after midnight does not mark today');
  scheduler.stop();

  setNow(2026, 7, 27, 10, 0);
  start(0);
  scheduler.dismiss();
  assert.strictEqual(status('morning'), 'pending', 'dismissing the reminder without action returns it to pending');
  scheduler.tick();
  assert.strictEqual(status('morning'), 'fired', 'dismissed dose can fire again while still in window');
  scheduler.stop();

  setNow(2026, 7, 27, 10, 0);
  cfg.windows.evening = { enabled: false, start: '18:00', end: '21:00' };
  start(0);
  assert.strictEqual(scheduler.confirm(), 'morning');
  assert.strictEqual(status('morning'), 'confirmed');
  scheduler.stop();
  cfg.windows.evening = { enabled: true, start: '18:00', end: '21:00' };

  setNow(2026, 7, 27, 10, 0);
  cfg.windows.morning = { enabled: true, start: '09:00', end: '20:00' };
  cfg.windows.evening = { enabled: true, start: '18:00', end: '21:00' };
  start(0);
  assert.strictEqual(status('morning'), 'fired');
  cfg.windows.morning = { enabled: false, start: '09:00', end: '20:00' };
  scheduler.tick();
  assert.notStrictEqual(scheduler.getPendingWindow(), 'morning', 'disabling the visible dose releases pendingWindow');
  setNow(2026, 7, 27, 18, 5);
  scheduler.tick();
  assert.strictEqual(status('evening'), 'fired', 'evening can fire after the shown morning window is disabled');
  scheduler.confirm();
  cfg.windows.morning = { enabled: true, start: '09:00', end: '20:00' };
  scheduler.tick();
  assert.strictEqual(status('morning'), 'fired', 're-enabling a dose the same day lets it fire again');
  scheduler.stop();
  cfg.windows.morning = { enabled: true, start: '09:00', end: '12:00' };
  cfg.windows.evening = { enabled: true, start: '18:00', end: '21:00' };

  setNow(2026, 7, 27, 10, 0);
  start(0);
  const dose = scheduler.confirm();
  assert.strictEqual(dose, 'morning');
  assert.strictEqual(scheduler.undoConfirmation('morning'), true);
  assert.strictEqual(status('morning'), 'fired');
  assert.strictEqual(scheduler.confirm(), 'morning', 'Done still works immediately after Undo');
  scheduler.stop();

  setNow(2026, 7, 27, 18, 5);
  start(0);
  assert.strictEqual(status('evening'), 'fired');
  scheduler.stop();
  setNow(2026, 7, 27, 10, 0);
  start(0);
  assert.strictEqual(status('morning'), 'fired', 'start() does not keep a leftover pendingWindow from a previous run');
  assert.strictEqual(scheduler.confirm(), 'morning');
  scheduler.stop();

  setNow(2026, 7, 27, 10, 0);
  start(0);
  setNow(2026, 7, 28, 0, 5);
  assert.strictEqual(scheduler.confirm(), null, 'confirm after midnight without a tick does not mark today');
  scheduler.stop();

  console.log('SCHEDULER_TEST_OK');
} finally {
  scheduler.stop();
  global.Date = OrigDate;
}
