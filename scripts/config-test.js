// Config validation and partial-patch semantics.
// Run: npm run test:config

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const config = require('../src/main/config');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inhaler-config-'));
const file = path.join(dir, 'config.json');
config._setFilePathForTests(file);

// --- defaults ----------------------------------------------------------------
let cfg = config.get();
assert.strictEqual(cfg.locale, 'ru');
assert.strictEqual(cfg.appearance, 'system');
assert.strictEqual(cfg.snoozeMinutes, 15);
assert.strictEqual(cfg.graceMinutes, 120);
assert.strictEqual(cfg.puffsPerDose, 1);
assert.strictEqual(Array.isArray(cfg.windows), true);
assert.strictEqual(cfg.windows.length, 1);
assert.strictEqual(cfg.windows[0].id, 'w1');
assert.strictEqual(cfg.windows[0].start, '09:00');

// --- a partial patch leaves everything else alone -----------------------------
config.set({ locale: 'en', snoozeMinutes: 45 });
cfg = config.set({ soundEnabled: false });
assert.strictEqual(cfg.locale, 'en');
assert.strictEqual(cfg.snoozeMinutes, 45);
assert.strictEqual(cfg.soundEnabled, false);

// --- clamping ------------------------------------------------------------------
assert.strictEqual(config.set({ snoozeMinutes: 9999 }).snoozeMinutes, 180);
assert.strictEqual(config.set({ snoozeMinutes: -5 }).snoozeMinutes, 1);
assert.strictEqual(config.set({ graceMinutes: 9999 }).graceMinutes, 360);
assert.strictEqual(config.set({ snoozeMinutes: 'abc' }).snoozeMinutes, 1);
assert.strictEqual(config.set({ puffsPerDose: 2 }).puffsPerDose, 2);
assert.strictEqual(config.set({ puffsPerDose: 5 }).puffsPerDose, 2, 'puffs clamps to 2');

// --- enumerations ---------------------------------------------------------------
assert.strictEqual(config.set({ appearance: 'dark' }).appearance, 'dark');
assert.strictEqual(config.set({ appearance: 'neon' }).appearance, 'dark');
assert.strictEqual(config.set({ locale: 'ja' }).locale, 'ja');
assert.strictEqual(config.set({ locale: 'zh' }).locale, 'zh');
assert.strictEqual(config.set({ locale: 'de' }).locale, 'zh', 'unsupported locale ignored');

// --- windows list ---------------------------------------------------------------
config.set({ windows: [
  { id: 'w1', name: '', enabled: true, start: '09:00', end: '12:00' },
  { id: 'w2', name: 'Sleep', enabled: true, start: '21:00', end: '23:00' }
] });
let windows = config.get().windows;
assert.strictEqual(windows.length, 2);
assert.strictEqual(windows[1].name, 'Sleep');
assert.strictEqual(windows[1].start, '21:00');

windows = config.set({ windows: [
  { id: 'w1', name: '', enabled: true, start: '10:30', end: '12:00' },
  { id: 'w2', name: 'Sleep', enabled: true, start: '21:00', end: '23:00' }
] }).windows;
assert.strictEqual(windows[0].start, '10:30');
assert.strictEqual(windows[1].start, '21:00');

// inverted range rejected
windows = config.set({ windows: [{ id: 'w1', name: '', enabled: true, start: '23:45', end: '12:00' }] }).windows;
assert.strictEqual(windows[0].start, '09:00', 'an inverted range is rejected');

// missing ids get assigned sequentially
windows = config.set({ windows: [
  { name: 'X', enabled: true, start: '08:00', end: '09:00' },
  { name: 'Y', enabled: true, start: '20:00', end: '21:00' }
] }).windows;
assert.strictEqual(windows[0].id, 'w1');
assert.strictEqual(windows[1].id, 'w2');

// empty list falls back to one default window
windows = config.set({ windows: [] }).windows;
assert.strictEqual(windows.length, 1);
assert.strictEqual(windows[0].id, 'w1');

// --- persistence -------------------------------------------------------------------
config.set({ windows: [{ id: 'w1', name: '', enabled: true, start: '10:30', end: '12:00' }] });
config.set({ windows: [{ id: 'w1', name: '', enabled: true, start: '10:30', end: '12:00' }] });
const onDisk = JSON.parse(fs.readFileSync(file, 'utf8'));
assert.strictEqual(onDisk.windows[0].start, '10:30');
config._setFilePathForTests(file);
assert.strictEqual(config.get().windows[0].start, '10:30');

// --- corrupt file falls back --------------------------------------------------------
fs.writeFileSync(file, 'not json at all', 'utf8');
config._setFilePathForTests(file);
assert.strictEqual(config.get().windows[0].start, '10:30');

config._resetForTests();
fs.rmSync(dir, { recursive: true, force: true });
console.log('CONFIG_TEST_OK');
