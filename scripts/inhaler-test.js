// Dose counter: decrement, low milestones, undo, replace.
// Run: npm run test:inhaler

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const inhaler = require('../src/main/inhaler');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inhaler-'));
const file = path.join(dir, 'inhaler.json');
inhaler._setFilePathForTests(file);

// fresh state
let s = inhaler.get();
assert.deepStrictEqual(s, { total: 0, remaining: 0, warnedAt: null });

// replace sets total and remaining, clears warning
s = inhaler.setTotal(120);
assert.deepStrictEqual(s, { total: 120, remaining: 120, warnedAt: null });

// use decrements by one puff, no low warning above 20
s = inhaler.use(1);
assert.strictEqual(s.remaining, 119);
assert.strictEqual(s.low, null);

inhaler.setTotal(25);
assert.strictEqual(inhaler.use(1).remaining, 24);
assert.strictEqual(inhaler.use(1).remaining, 23);
assert.strictEqual(inhaler.use(1).remaining, 22);
assert.strictEqual(inhaler.use(1).remaining, 21);
s = inhaler.use(1);
assert.strictEqual(s.remaining, 20);
assert.strictEqual(s.low, 20, 'crossing to 20 warns');

// no repeat at the same milestone; next even milestone warns
s = inhaler.use(1);
assert.strictEqual(s.remaining, 19);
assert.strictEqual(s.low, null, 'odd counts do not warn');
s = inhaler.use(1);
assert.strictEqual(s.remaining, 18);
assert.strictEqual(s.low, 18);

// undo gives the puff back, capped at total
s = inhaler.undo(1);
assert.strictEqual(s.remaining, 19);

// puffs per dose = 2 decrements by 2
inhaler.setTotal(120);
s = inhaler.use(2);
assert.strictEqual(s.remaining, 118);

// reaching 0 warns and clamps
inhaler.setTotal(2);
assert.strictEqual(inhaler.use(1).remaining, 1);
s = inhaler.use(1);
assert.strictEqual(s.remaining, 0);
assert.strictEqual(s.low, 0);
assert.strictEqual(inhaler.use(1).remaining, 0, 'clamps at zero');

// persistence
inhaler.setTotal(120);
inhaler.use(1);
inhaler._setFilePathForTests(file);
assert.strictEqual(inhaler.get().remaining, 119, 'counter survives reload');

inhaler._resetForTests();
fs.rmSync(dir, { recursive: true, force: true });
console.log('INHALER_TEST_OK');
