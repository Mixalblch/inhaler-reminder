const fs = require('fs');
const path = require('path');

const DOSES = ['morning', 'evening'];
const VALID_STATUSES = ['pending', 'confirmed', 'missed', 'disabled'];

let filePathOverride = null;
let cached = null;

function localDayKey(value) {
  const d = value instanceof Date ? value : new Date(value == null ? Date.now() : value);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function dateFromDayKey(key) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  return localDayKey(d) === key ? d : null;
}

function historyFilePath() {
  if (filePathOverride) return filePathOverride;
  const { app } = require('electron');
  return path.join(app.getPath('userData'), 'history.json');
}

function normalizeDose(value) {
  const src = value && typeof value === 'object' ? value : {};
  const status = VALID_STATUSES.indexOf(src.status) !== -1 ? src.status : 'pending';
  return {
    status: status,
    at: typeof src.at === 'string' ? src.at : null,
    backdated: status === 'confirmed' && !!src.backdated
  };
}

function normalize(input) {
  const src = input && typeof input === 'object' ? input : {};
  const rawDays = src.days && typeof src.days === 'object' ? src.days : {};
  const days = {};

  Object.keys(rawDays).forEach(function (key) {
    if (!dateFromDayKey(key)) return;
    const raw = rawDays[key] && typeof rawDays[key] === 'object' ? rawDays[key] : {};
    const day = {};
    DOSES.forEach(function (dose) {
      if (raw[dose]) day[dose] = normalizeDose(raw[dose]);
    });
    if (Object.keys(day).length) days[key] = day;
  });

  return { version: 1, days: days };
}

function load() {
  if (cached) return cached;
  try {
    cached = normalize(JSON.parse(fs.readFileSync(historyFilePath(), 'utf8')));
  } catch (e) {
    cached = normalize(null);
  }
  return cached;
}

function save() {
  const store = load();
  const target = historyFilePath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(store, null, 2), 'utf8');
  return store;
}

function minutesOfDay(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function parseTime(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

function ensureToday(config, now) {
  const store = load();
  const key = localDayKey(now);
  const day = store.days[key] || {};
  let changed = !store.days[key];

  DOSES.forEach(function (dose) {
    const win = config && config.windows && config.windows[dose];
    const existing = day[dose];
    if (win && win.enabled) {
      if (!existing || existing.status === 'disabled') {
        day[dose] = { status: 'pending', at: null, backdated: false };
        changed = true;
      }
    } else if (!existing) {
      day[dose] = { status: 'disabled', at: null, backdated: false };
      changed = true;
    } else if (existing.status === 'pending') {
      day[dose] = { status: 'disabled', at: null, backdated: false };
      changed = true;
    }
  });

  store.days[key] = day;
  return changed;
}

function sync(config, value) {
  const now = value instanceof Date ? value : new Date(value == null ? Date.now() : value);
  const store = load();
  const today = localDayKey(now);
  let changed = ensureToday(config, now);

  Object.keys(store.days).forEach(function (key) {
    if (key >= today) return;
    DOSES.forEach(function (dose) {
      const entry = store.days[key][dose];
      if (entry && entry.status === 'pending') {
        store.days[key][dose] = { status: 'missed', at: null, backdated: false };
        changed = true;
      }
    });
  });

  const day = store.days[today];
  const nowMinutes = minutesOfDay(now);
  DOSES.forEach(function (dose) {
    const win = config && config.windows && config.windows[dose];
    const entry = day && day[dose];
    if (!win || !win.enabled || !entry || entry.status !== 'pending') return;
    const deadline = parseTime(win.end) + Number(config.graceMinutes || 0);
    if (nowMinutes > deadline) {
      day[dose] = { status: 'missed', at: null, backdated: false };
      changed = true;
    }
  });

  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 120, 12);
  const cutoffKey = localDayKey(cutoff);
  Object.keys(store.days).forEach(function (key) {
    if (key < cutoffKey) {
      delete store.days[key];
      changed = true;
    }
  });

  if (changed) save();
  return changed;
}

function getDay(key) {
  const day = load().days[key] || {};
  const out = {};
  DOSES.forEach(function (dose) {
    out[dose] = day[dose] ? Object.assign({}, day[dose]) : null;
  });
  return out;
}

function recordStatus(dayKey, dose, status, options) {
  if (!dateFromDayKey(dayKey) || DOSES.indexOf(dose) === -1) return null;
  const store = load();
  const day = store.days[dayKey] || {};
  const opts = options || {};
  day[dose] = {
    status: status,
    at: status === 'confirmed' ? (opts.at || new Date().toISOString()) : null,
    backdated: status === 'confirmed' && !!opts.backdated
  };
  store.days[dayKey] = day;
  save();
  return Object.assign({}, day[dose]);
}

function confirm(dayKey, dose, options) {
  return recordStatus(dayKey, dose, 'confirmed', options);
}

function miss(dayKey, dose) {
  return recordStatus(dayKey, dose, 'missed');
}

function undoBackdate(dayKey, dose) {
  const entry = load().days[dayKey] && load().days[dayKey][dose];
  if (!entry || entry.status !== 'confirmed' || !entry.backdated) return null;
  return recordStatus(dayKey, dose, 'missed');
}

function undoTodayConfirmation(dayKey, dose) {
  const entry = load().days[dayKey] && load().days[dayKey][dose];
  if (!entry || entry.status !== 'confirmed' || entry.backdated) return null;
  return recordStatus(dayKey, dose, 'pending');
}

function summary(config, value, count) {
  const now = value instanceof Date ? value : new Date(value == null ? Date.now() : value);
  sync(config, now);
  const store = load();
  const length = Math.max(1, Math.min(60, Number(count) || 14));
  const days = [];
  let confirmedCount = 0;
  let trackedCount = 0;
  let latestMissed = null;

  for (let offset = length - 1; offset >= 0; offset--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset, 12);
    const key = localDayKey(d);
    const stored = store.days[key] || {};
    const item = { date: key, morning: 'unknown', evening: 'unknown' };
    DOSES.forEach(function (dose) {
      const entry = stored[dose];
      if (entry) item[dose] = entry.status;
      if (entry && (entry.status === 'confirmed' || entry.status === 'missed' || entry.status === 'pending')) {
        trackedCount += 1;
        if (entry.status === 'confirmed') confirmedCount += 1;
      }
      if (entry && entry.status === 'missed') {
        latestMissed = { date: key, dose: dose };
      }
    });
    days.push(item);
  }

  return {
    days: days,
    confirmedCount: confirmedCount,
    trackedCount: trackedCount,
    latestMissed: latestMissed,
    today: localDayKey(now),
    todayStatus: getDay(localDayKey(now))
  };
}

function setFilePathForTests(target) {
  filePathOverride = target;
  cached = null;
}

function resetForTests() {
  cached = null;
  filePathOverride = null;
}

function seedPreview(value) {
  const now = value instanceof Date ? value : new Date();
  const store = { version: 1, days: {} };
  for (let offset = 13; offset >= 0; offset--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset, 9, 24);
    const key = localDayKey(d);
    store.days[key] = {
      morning: { status: (offset === 8 ? 'missed' : 'confirmed'), at: offset === 8 ? null : d.toISOString(), backdated: false },
      evening: { status: (offset === 11 || offset === 1 ? 'missed' : 'confirmed'), at: (offset === 11 || offset === 1) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 20, 14).toISOString(), backdated: false }
    };
  }
  const today = localDayKey(now);
  store.days[today].morning = { status: 'confirmed', at: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 24).toISOString(), backdated: false };
  store.days[today].evening = { status: 'pending', at: null, backdated: false };
  cached = store;
  save();
}

module.exports = {
  localDayKey: localDayKey,
  normalize: normalize,
  sync: sync,
  summary: summary,
  getDay: getDay,
  confirm: confirm,
  miss: miss,
  undoBackdate: undoBackdate,
  undoTodayConfirmation: undoTodayConfirmation,
  seedPreview: seedPreview,
  _setFilePathForTests: setFilePathForTests,
  _resetForTests: resetForTests
};
