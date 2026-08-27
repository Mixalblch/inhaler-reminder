const assert = require('assert');
const { normalize, DEFAULTS } = require('../src/main/config');

const inverted = normalize({
  windows: {
    morning: { enabled: true, start: '22:00', end: '06:00' },
    evening: { enabled: true, start: '21:00', end: '18:00' }
  }
});
assert.strictEqual(inverted.windows.morning.start, DEFAULTS.windows.morning.start);
assert.strictEqual(inverted.windows.morning.end, DEFAULTS.windows.morning.end);
assert.strictEqual(inverted.windows.evening.start, DEFAULTS.windows.evening.start);
assert.strictEqual(inverted.windows.evening.end, DEFAULTS.windows.evening.end);

const valid = normalize({
  windows: { morning: { enabled: true, start: '08:30', end: '11:00' } }
});
assert.strictEqual(valid.windows.morning.start, '08:30');
assert.strictEqual(valid.windows.morning.end, '11:00');

const idle = normalize({ idleThresholdSeconds: 30 });
assert.ok(idle.idleThresholdSeconds >= 60, 'hidden 30s idle default must not stay that aggressive');

const explicit = normalize({ idleThresholdSeconds: 120 });
assert.strictEqual(explicit.idleThresholdSeconds, 120);

console.log('CONFIG_TEST_OK');
