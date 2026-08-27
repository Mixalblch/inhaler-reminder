const fs = require('fs');
const path = require('path');
const { atomicWrite } = require('./atomic-write');

const DEFAULTS = {
  version: 1,
  locale: 'ru',
  soundEnabled: true,
  autostart: false,
  appearance: 'system',
  snoozeMinutes: 15,
  graceMinutes: 120,
  idleThresholdSeconds: 300,
  windows: {
    morning: { enabled: true, start: '09:00', end: '12:00' },
    evening: { enabled: true, start: '18:00', end: '21:00' }
  }
};

let configPath = null;
let cached = null;

function configFilePath() {
  if (!configPath) {
    const { app } = require('electron');
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

function minutesOf(s) {
  return Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
}

function normalizeWindow(w, def) {
  const src = (w && typeof w === 'object') ? w : {};
  let start = isValidTime(src.start) ? src.start : def.start;
  let end = isValidTime(src.end) ? src.end : def.end;
  if (minutesOf(start) >= minutesOf(end)) {
    start = def.start;
    end = def.end;
  }
  return {
    enabled: typeof src.enabled === 'boolean' ? src.enabled : def.enabled,
    start: start,
    end: end
  };
}

function normalizeIdle(value) {
  if (value == null || value === '') return DEFAULTS.idleThresholdSeconds;
  const n = clampInt(value, 5, 600, DEFAULTS.idleThresholdSeconds);
  if (n < 60) return DEFAULTS.idleThresholdSeconds;
  return n;
}

function normalize(input) {
  if (!input || typeof input !== 'object') input = {};
  const w = (input.windows && typeof input.windows === 'object') ? input.windows : {};
  return {
    version: 1,
    locale: (input.locale === 'en') ? 'en' : 'ru',
    soundEnabled: typeof input.soundEnabled === 'boolean' ? input.soundEnabled : DEFAULTS.soundEnabled,
    autostart: typeof input.autostart === 'boolean' ? input.autostart : DEFAULTS.autostart,
    appearance: (input.appearance === 'light' || input.appearance === 'dark') ? input.appearance : 'system',
    snoozeMinutes: clampInt(input.snoozeMinutes, 1, 180, DEFAULTS.snoozeMinutes),
    graceMinutes: clampInt(input.graceMinutes, 0, 360, DEFAULTS.graceMinutes),
    idleThresholdSeconds: normalizeIdle(input.idleThresholdSeconds),
    windows: {
      morning: normalizeWindow(w.morning, DEFAULTS.windows.morning),
      evening: normalizeWindow(w.evening, DEFAULTS.windows.evening)
    }
  };
}

function load() {
  if (cached) return cached;
  try {
    const raw = fs.readFileSync(configFilePath(), 'utf8');
    cached = normalize(JSON.parse(raw));
  } catch (e) {
    cached = normalize(null);
  }
  return cached;
}

function save() {
  const cfg = load();
  atomicWrite(configFilePath(), JSON.stringify(cfg, null, 2));
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
  cached = normalize(merged);
  save();
  return cached;
}

function setFilePathForTests(target) {
  configPath = target;
  cached = null;
}

function resetForTests() {
  cached = null;
  configPath = null;
}

module.exports = {
  get: get,
  set: set,
  save: save,
  normalize: normalize,
  DEFAULTS: DEFAULTS,
  _setFilePathForTests: setFilePathForTests,
  _resetForTests: resetForTests
};
