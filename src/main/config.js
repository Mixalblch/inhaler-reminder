const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { writeJsonAtomic, readJsonWithBackup } = require('./atomic-store');

const DEFAULTS = {
  version: 1,
  locale: 'ru',
  appearance: 'system',
  soundEnabled: true,
  autostart: false,
  snoozeMinutes: 15,
  graceMinutes: 120,
  idleThresholdSeconds: 30,
  windows: {
    morning: { enabled: true, start: '09:00', end: '12:00' },
    evening: { enabled: true, start: '18:00', end: '21:00' }
  }
};

let configPath = null;
let cached = null;

function configFilePath() {
  if (!configPath) {
    configPath = path.join(app.getPath('userData'), 'config.json');
  }
  return configPath;
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function isValidTime(s) {
  if (typeof s !== 'string' || s.length !== 5) return false;
  if (s.charAt(2) !== ':') return false;
  const h = Number(s.slice(0, 2));
  const m = Number(s.slice(3, 5));
  return Number.isInteger(h) && Number.isInteger(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function toMinutes(value) {
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
}

// A window must be a forward range inside one day. If a patch would invert it,
// the whole window falls back rather than leaving an unreachable schedule.
function normalizeWindow(w, def) {
  const src = (w && typeof w === 'object') ? w : {};
  const start = isValidTime(src.start) ? src.start : def.start;
  const end = isValidTime(src.end) ? src.end : def.end;
  const ordered = toMinutes(start) < toMinutes(end);
  return {
    enabled: typeof src.enabled === 'boolean' ? src.enabled : def.enabled,
    start: ordered ? start : def.start,
    end: ordered ? end : def.end
  };
}

// `fallback` keeps a partial patch from resetting untouched fields to DEFAULTS.
function normalize(input, fallback) {
  const src = (input && typeof input === 'object') ? input : {};
  const base = (fallback && typeof fallback === 'object') ? fallback : DEFAULTS;
  const w = (src.windows && typeof src.windows === 'object') ? src.windows : {};
  return {
    version: 1,
    locale: (src.locale === 'en' || src.locale === 'ru') ? src.locale : base.locale,
    appearance: (src.appearance === 'system' || src.appearance === 'light' || src.appearance === 'dark')
      ? src.appearance
      : base.appearance,
    soundEnabled: typeof src.soundEnabled === 'boolean' ? src.soundEnabled : base.soundEnabled,
    autostart: typeof src.autostart === 'boolean' ? src.autostart : base.autostart,
    snoozeMinutes: clampInt(src.snoozeMinutes, 1, 180, base.snoozeMinutes),
    graceMinutes: clampInt(src.graceMinutes, 0, 360, base.graceMinutes),
    idleThresholdSeconds: clampInt(src.idleThresholdSeconds, 5, 600, base.idleThresholdSeconds),
    windows: {
      morning: normalizeWindow(w.morning, base.windows.morning),
      evening: normalizeWindow(w.evening, base.windows.evening)
    }
  };
}

function load() {
  if (cached) return cached;
  cached = normalize(readJsonWithBackup(configFilePath()), DEFAULTS);
  return cached;
}

function save() {
  const cfg = load();
  fs.mkdirSync(path.dirname(configFilePath()), { recursive: true });
  writeJsonAtomic(configFilePath(), cfg);
  return cfg;
}

function get() { return load(); }

function set(patch) {
  const current = load();
  const p = (patch && typeof patch === 'object') ? patch : {};
  let windows = current.windows;
  if (p.windows && typeof p.windows === 'object') {
    windows = {
      morning: Object.assign({}, current.windows.morning, p.windows.morning || {}),
      evening: Object.assign({}, current.windows.evening, p.windows.evening || {})
    };
  }
  const merged = Object.assign({}, current, p, { windows: windows });
  cached = normalize(merged, current);
  save();
  return cached;
}

function setFilePathForTests(target) {
  configPath = target;
  cached = null;
}

function resetForTests() {
  configPath = null;
  cached = null;
}

module.exports = {
  get: get,
  set: set,
  save: save,
  DEFAULTS: DEFAULTS,
  _setFilePathForTests: setFilePathForTests,
  _resetForTests: resetForTests
};
