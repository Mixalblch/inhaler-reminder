const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { writeJsonAtomic, readJsonWithBackup } = require('./atomic-store');

const DEFAULTS = {
  version: 2,
  locale: 'ru',
  appearance: 'system',
  soundEnabled: true,
  autostart: false,
  snoozeMinutes: 15,
  graceMinutes: 120,
  idleThresholdSeconds: 30,
  puffsPerDose: 1,
  windows: [
    { id: 'w1', name: '', enabled: true, start: '09:00', end: '12:00' }
  ]
};

const LOCALES = ['ru', 'en', 'ja', 'zh'];

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

// A window must be a forward range inside one day.
function normalizeWindow(w) {
  const src = (w && typeof w === 'object') ? w : {};
  const start = isValidTime(src.start) ? src.start : '09:00';
  const end = isValidTime(src.end) ? src.end : '12:00';
  const ordered = toMinutes(start) < toMinutes(end);
  return {
    name: typeof src.name === 'string' ? src.name.slice(0, 40) : '',
    enabled: typeof src.enabled === 'boolean' ? src.enabled : true,
    start: ordered ? start : '09:00',
    end: ordered ? end : '12:00'
  };
}

// Stable ids: existing ids are kept; missing or duplicate ids get the next
// available wN, so deleting one window never renumbers the others.
function normalizeWindows(raw) {
  const src = Array.isArray(raw) ? raw : [];
  const used = {};
  const result = [];
  src.forEach(function (w) {
    const win = normalizeWindow(w);
    let id = (w && typeof w === 'object' && typeof w.id === 'string' && w.id) ? w.id : '';
    if (!id || used[id]) {
      let n = 1;
      while (used['w' + n]) n++;
      id = 'w' + n;
    }
    used[id] = true;
    win.id = id;
    result.push(win);
  });
  if (!result.length) {
    result.push({ id: 'w1', name: '', enabled: true, start: '09:00', end: '12:00' });
  }
  return result;
}

function normalize(input, fallback) {
  const src = (input && typeof input === 'object') ? input : {};
  const base = (fallback && typeof fallback === 'object') ? fallback : DEFAULTS;
  return {
    version: 2,
    locale: LOCALES.indexOf(src.locale) !== -1 ? src.locale : base.locale,
    appearance: (src.appearance === 'system' || src.appearance === 'light' || src.appearance === 'dark')
      ? src.appearance
      : base.appearance,
    soundEnabled: typeof src.soundEnabled === 'boolean' ? src.soundEnabled : base.soundEnabled,
    autostart: typeof src.autostart === 'boolean' ? src.autostart : base.autostart,
    snoozeMinutes: clampInt(src.snoozeMinutes, 1, 180, base.snoozeMinutes),
    graceMinutes: clampInt(src.graceMinutes, 0, 360, base.graceMinutes),
    idleThresholdSeconds: clampInt(src.idleThresholdSeconds, 5, 600, base.idleThresholdSeconds),
    puffsPerDose: clampInt(src.puffsPerDose, 1, 2, base.puffsPerDose),
    windows: normalizeWindows(src.windows)
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
  if (Array.isArray(p.windows)) windows = p.windows;
  const merged = Object.assign({}, current, p, { windows: windows });
  cached = normalize(merged, current);
  save();
  return cached;
}

function setFilePathForTests(target) { configPath = target; cached = null; }
function resetForTests() { configPath = null; cached = null; }

module.exports = { get: get, set: set, save: save, DEFAULTS: DEFAULTS, _setFilePathForTests: setFilePathForTests, _resetForTests: resetForTests };
