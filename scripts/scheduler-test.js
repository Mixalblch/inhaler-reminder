// Scheduler behaviour under a controlled clock.
// Run: npm run test:scheduler

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'scheduler.js'), 'utf8');
const schedule = require('../src/main/schedule');

const RealDate = Date;
let clock = new RealDate(2026, 7, 27, 20, 0, 0);

function FakeDate() {
  const args = Array.prototype.slice.call(arguments);
  if (!(this instanceof FakeDate)) return RealDate.apply(null, args);
  return args.length
    ? new (Function.prototype.bind.apply(RealDate, [null].concat(args)))()
    : new RealDate(clock.getTime());
}
FakeDate.now = function () { return clock.getTime(); };
FakeDate.prototype = RealDate.prototype;

function at(h, m) { clock = new RealDate(2026, 7, 27, h, m, 0); }

function loadScheduler() {
  const sandbox = {
    module: { exports: {} },
    exports: {},
    require: function (id) {
      if (id === './schedule') return schedule;
      throw new Error('unexpected require: ' + id);
    },
    Date: FakeDate,
    setInterval: function () { return 1; },
    clearInterval: function () {},
    console: console
  };
  vm.runInNewContext(source, sandbox, { filename: 'scheduler.js' });
  return sandbox.module.exports;
}

function harness(cfg, day) {
  const events = { reminders: [], missed: [], snoozes: [] };
  const options = {
    getConfig: function () { return cfg; },
    isIdleSeconds: function () { return 0; },
    getHistoryDay: function () { return day; },
    onReminder: function (id) { events.reminders.push(id); },
    recordConfirmed: function (_k, id) { day[id] = { status: 'confirmed', snoozeUntil: 0 }; },
    recordMissed: function (_k, id) { day[id] = { status: 'missed', snoozeUntil: 0 }; events.missed.push(id); },
    recordSnoozed: function (_k, id, until) {
      day[id] = { status: 'pending', snoozeUntil: until };
      events.snoozes.push({ id: id, until: until });
    },
    clearSnooze: function (_k, id) { if (day[id]) day[id].snoozeUntil = 0; },
    undoConfirmed: function (_k, id) { day[id] = { status: 'pending', snoozeUntil: 0 }; },
    onStateChanged: function () {}
  };
  return { events: events, options: options };
}

const BASE = {
  snoozeMinutes: 15,
  graceMinutes: 120,
  idleThresholdSeconds: 30,
  windows: [
    { id: 'w1', name: '', enabled: true, start: '09:00', end: '12:00' },
    { id: 'w2', name: '', enabled: true, start: '18:00', end: '21:00' }
  ]
};

function cloneConfig(patch) {
  const cfg = JSON.parse(JSON.stringify(BASE));
  return Object.assign(cfg, patch || {});
}

// --- one reminder at a time; the second is queued, not dropped ---------------
at(20, 0);
{
  const cfg = cloneConfig();
  cfg.windows[0] = { id: 'w1', name: '', enabled: true, start: '18:00', end: '21:00' };
  const day = {};
  const h = harness(cfg, day);
  const s = loadScheduler();
  s.start(h.options);
  assert.deepStrictEqual(h.events.reminders, ['w1'], 'only one overlapping reminder fires');
  assert.strictEqual(s.confirm(), 'w1');
  s.tick();
  assert.deepStrictEqual(h.events.reminders, ['w1', 'w2'], 'the queued dose fires next');
  assert.strictEqual(s.confirm(), 'w2');
  assert.strictEqual(s.currentDoseKey(clock), null, 'nothing is pending once both are confirmed');
}

// --- a snooze may not outlive the catch-up deadline --------------------------
at(20, 55);
{
  const cfg = cloneConfig();
  cfg.windows[0].enabled = false;
  const day = {};
  const h = harness(cfg, day);
  const s = loadScheduler();
  s.start(h.options);
  assert.deepStrictEqual(h.events.reminders, ['w2']);

  const granted = s.snooze(180);
  const deadline = schedule.deadlineMinutes(cfg, 'w2');
  assert.strictEqual(granted, deadline - (20 * 60 + 55), 'the snooze is clamped to the deadline');

  const until = h.events.snoozes[0].until;
  const untilMinutes = new RealDate(until).getHours() * 60 + new RealDate(until).getMinutes();
  assert.ok(untilMinutes <= deadline, 'a snooze never points past the deadline');

  at(23, 30);
  s.tick();
  assert.deepStrictEqual(h.events.reminders, ['w2'], 'no reminder fires after the deadline');
  assert.deepStrictEqual(h.events.missed, ['w2'], 'the elapsed dose is recorded as missed');
}

// --- a snooze survives a restart --------------------------------------------
at(20, 0);
{
  const cfg = cloneConfig();
  cfg.windows[0].enabled = false;
  const day = {};
  const first = harness(cfg, day);
  const s1 = loadScheduler();
  s1.start(first.options);
  s1.snooze(30);
  assert.strictEqual(day.w2.status, 'pending');
  assert.ok(day.w2.snoozeUntil > clock.getTime());

  const second = harness(cfg, day);
  const s2 = loadScheduler();
  s2.start(second.options);
  assert.deepStrictEqual(second.events.reminders, [], 'a live snooze is not re-fired on restart');
  assert.strictEqual(s2.getState().windows.w2.status, 'snoozed');

  at(20, 31);
  s2.tick();
  assert.deepStrictEqual(second.events.reminders, ['w2'], 'it fires once the snooze elapses');
  assert.strictEqual(day.w2.snoozeUntil, 0, 'firing clears the stored snooze');

  assert.strictEqual(s2.dismiss(), true, 'closing the window defers rather than dismisses');
  assert.strictEqual(s2.getState().windows.w2.status, 'snoozed');
}

// --- confirm / undo round trip ----------------------------------------------
at(20, 0);
{
  const cfg = cloneConfig();
  cfg.windows[0].enabled = false;
  const day = {};
  const h = harness(cfg, day);
  const s = loadScheduler();
  s.start(h.options);
  const id = s.confirm();
  assert.strictEqual(id, 'w2');
  assert.strictEqual(s.getState().windows.w2.status, 'confirmed');
  assert.strictEqual(s.undoConfirmation(id), true, 'a confirmation is reversible');
  assert.strictEqual(s.getState().windows.w2.status, 'pending');
  assert.strictEqual(s.undoConfirmation('w1'), false, 'undo only applies to a confirmed dose');
}

// --- widening the schedule reopens a dose missed earlier today ---------------
at(20, 0);
{
  const cfg = cloneConfig({ graceMinutes: 0 });
  cfg.windows[0].enabled = false;
  cfg.windows[1] = { id: 'w2', name: '', enabled: true, start: '18:00', end: '19:00' };
  const day = {};
  const h = harness(cfg, day);
  const s = loadScheduler();
  s.start(h.options);
  assert.strictEqual(s.getState().windows.w2.status, 'missed');
  assert.strictEqual(s.currentDoseKey(clock), null, 'a missed dose is not offered by the tray');

  cfg.windows[1].end = '21:00';
  day.w2 = { status: 'pending', snoozeUntil: 0 };
  s.reload();
  assert.deepStrictEqual(h.events.reminders, ['w2'], 'the reopened dose becomes eligible again');
}

// --- a disabled window never fires ------------------------------------------
at(20, 0);
{
  const cfg = cloneConfig();
  cfg.windows[0].enabled = false;
  cfg.windows[1].enabled = false;
  const day = {};
  const h = harness(cfg, day);
  const s = loadScheduler();
  s.start(h.options);
  assert.deepStrictEqual(h.events.reminders, [], 'disabled windows stay silent');
  assert.strictEqual(s.currentDoseKey(clock), null);
}

// --- an idle user is not interrupted ----------------------------------------
at(20, 0);
{
  const cfg = cloneConfig();
  cfg.windows[0].enabled = false;
  const day = {};
  const h = harness(cfg, day);
  h.options.isIdleSeconds = function () { return 600; };
  const s = loadScheduler();
  s.start(h.options);
  assert.deepStrictEqual(h.events.reminders, [], 'nothing fires while the user is away');
  h.options.isIdleSeconds = function () { return 0; };
  s.tick();
  assert.deepStrictEqual(h.events.reminders, ['w2'], 'it fires once they return');
}

// --- the tray names the dose that will actually fire next --------------------
at(13, 0);
{
  const cfg = cloneConfig();
  const day = {};
  const h = harness(cfg, day);
  h.options.isIdleSeconds = function () { return 600; };
  const s = loadScheduler();
  s.start(h.options);
  assert.strictEqual(s.currentDoseKey(clock), 'w1', 'an overdue-but-reachable dose comes first');

  at(8, 0);
  assert.strictEqual(s.currentDoseKey(clock), 'w1', 'before any window, the earliest is next');
  at(15, 0);
  assert.strictEqual(s.currentDoseKey(clock), 'w2', 'once morning expires, evening is next');
}

// --- midnight rollover tells the app --------------------------------------
at(23, 58);
{
  const cfg = cloneConfig();
  const day = {
    w1: { status: 'confirmed', snoozeUntil: 0 },
    w2: { status: 'confirmed', snoozeUntil: 0 }
  };
  const h = harness(cfg, day);
  const rolled = [];
  h.options.onDayChanged = function (key) { rolled.push(key); };
  const s = loadScheduler();
  s.start(h.options);
  assert.strictEqual(s.getState().day, '2026-08-27');
  assert.deepStrictEqual(rolled, [], 'starting up is not a rollover');

  clock = new RealDate(2026, 7, 28, 0, 5, 0);
  s.tick();
  assert.strictEqual(s.getState().day, '2026-08-28', 'the scheduler moves to the new day');
  assert.deepStrictEqual(rolled, ['2026-08-28'], 'the app is told the day changed');

  s.tick();
  assert.deepStrictEqual(rolled, ['2026-08-28'], 'a rollover is announced once, not every tick');
}

console.log('SCHEDULER_TEST_OK');
