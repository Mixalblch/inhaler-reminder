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
assert.strictEqual(cfg.windows.morning.start, '09:00');

// --- a partial patch leaves everything else alone -----------------------------
// Regression: patching one field used to reset untouched fields to defaults.
config.set({ locale: 'en', snoozeMinutes: 45 });
cfg = config.set({ soundEnabled: false });
assert.strictEqual(cfg.locale, 'en', 'an unrelated patch keeps the locale');
assert.strictEqual(cfg.snoozeMinutes, 45, 'an unrelated patch keeps the snooze');
assert.strictEqual(cfg.soundEnabled, false);

// --- clamping ------------------------------------------------------------------
assert.strictEqual(config.set({ snoozeMinutes: 9999 }).snoozeMinutes, 180);
assert.strictEqual(config.set({ snoozeMinutes: -5 }).snoozeMinutes, 1);
assert.strictEqual(config.set({ graceMinutes: 9999 }).graceMinutes, 360);
assert.strictEqual(config.set({ snoozeMinutes: 'abc' }).snoozeMinutes, 1, 'nonsense keeps the previous value');

// --- enumerations ---------------------------------------------------------------
assert.strictEqual(config.set({ appearance: 'dark' }).appearance, 'dark');
assert.strictEqual(config.set({ appearance: 'neon' }).appearance, 'dark', 'an unknown appearance is ignored');
assert.strictEqual(config.set({ locale: 'de' }).locale, 'en', 'an unsupported locale is ignored');

// --- window ranges ---------------------------------------------------------------
config.set({ windows: { morning: { start: '09:00', end: '12:00' } } });
let windows = config.set({ windows: { morning: { start: '10:30' } } }).windows;
assert.strictEqual(windows.morning.start, '10:30');
assert.strictEqual(windows.morning.end, '12:00', 'patching the start keeps the end');

windows = config.set({ windows: { morning: { start: '23:45' } } }).windows;
assert.strictEqual(windows.morning.start, '10:30', 'an inverted range is rejected');
assert.strictEqual(windows.morning.end, '12:00');

windows = config.set({ windows: { morning: { start: '25:99' } } }).windows;
assert.strictEqual(windows.morning.start, '10:30', 'an invalid time is rejected');

windows = config.set({ windows: { evening: { enabled: false } } }).windows;
assert.strictEqual(windows.evening.enabled, false);
assert.strictEqual(windows.morning.enabled, true, 'the other window is untouched');

// --- persistence -------------------------------------------------------------------
const onDisk = JSON.parse(fs.readFileSync(file, 'utf8'));
assert.strictEqual(onDisk.windows.morning.start, '10:30');
config._setFilePathForTests(file);
assert.strictEqual(config.get().windows.morning.start, '10:30', 'settings survive a reload');

// --- a corrupt file falls back rather than crashing ----------------------------------
fs.writeFileSync(file, 'not json at all', 'utf8');
config._setFilePathForTests(file);
assert.strictEqual(config.get().windows.morning.start, '10:30', 'a corrupt config recovers from backup');

config._resetForTests();
fs.rmSync(dir, { recursive: true, force: true });
console.log('CONFIG_TEST_OK');
