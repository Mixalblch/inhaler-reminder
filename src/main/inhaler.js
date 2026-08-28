// Persistent dose counter for the active inhaler.

const { app } = require('electron');
const path = require('path');
const { writeJsonAtomic, readJsonWithBackup } = require('./atomic-store');

let filePathOverride = null;
let cached = null;

function filePath() {
  if (filePathOverride) return filePathOverride;
  return path.join(app.getPath('userData'), 'inhaler.json');
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function normalize(input) {
  const src = (input && typeof input === 'object') ? input : {};
  const total = clampInt(src.total, 0, 9999, 0);
  return {
    total: total,
    remaining: clampInt(src.remaining, 0, total, 0),
    warnedAt: (typeof src.warnedAt === 'number' && src.warnedAt >= 0) ? Math.round(src.warnedAt) : null
  };
}

function load() {
  if (!cached) cached = normalize(readJsonWithBackup(filePath()));
  return cached;
}

function save() {
  writeJsonAtomic(filePath(), load());
  return load();
}

function get() { return load(); }

function setTotal(value) {
  const total = clampInt(value, 0, 9999, 0);
  cached = { total: total, remaining: total, warnedAt: null };
  save();
  return cached;
}

function use(puffsPerDose) {
  const puffs = clampInt(puffsPerDose, 1, 2, 1);
  const s = load();
  const remaining = Math.max(0, s.remaining - puffs);
  let low = null;
  if (remaining <= 20 && remaining % 2 === 0) {
    const warned = (s.warnedAt == null) ? 21 : s.warnedAt;
    if (remaining < warned) low = remaining;
  }
  cached = { total: s.total, remaining: remaining, warnedAt: (low == null) ? s.warnedAt : low };
  save();
  return { total: cached.total, remaining: cached.remaining, low: low };
}

function undo(puffsPerDose) {
  const puffs = clampInt(puffsPerDose, 1, 2, 1);
  const s = load();
  const remaining = Math.min(s.total, s.remaining + puffs);
  cached = { total: s.total, remaining: remaining, warnedAt: s.warnedAt };
  save();
  return cached;
}

function setFilePathForTests(target) { filePathOverride = target; cached = null; }
function resetForTests() { filePathOverride = null; cached = null; }

module.exports = {
  get: get,
  setTotal: setTotal,
  use: use,
  undo: undo,
  normalize: normalize,
  _setFilePathForTests: setFilePathForTests,
  _resetForTests: resetForTests
};
