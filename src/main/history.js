// Persistent adherence record: one entry per day per window id.
//
// Days the app never tracked stay absent rather than being backfilled as missed.

const { app } = require('electron');
const path = require('path');
const { writeJsonAtomic, readJsonWithBackup } = require('./atomic-store');
const schedule = require('./schedule');

const STATUSES = ['pending', 'confirmed', 'missed', 'disabled'];
const RETENTION_DAYS = 120;

let filePathOverride = null;
let cached = null;

function historyFilePath() {
  if (filePathOverride) return filePathOverride;
  return path.join(app.getPath('userData'), 'history.json');
}

function makeDose(status, extra) {
  const e = extra || {};
  return {
    status: status,
    at: status === 'confirmed' ? (e.at || null) : null,
    backdated: status === 'confirmed' && !!e.backdated,
    snoozeUntil: status === 'pending' && Number(e.snoozeUntil) > 0 ? Number(e.snoozeUntil) : 0
  };
}

function normalizeDose(value) {
  const src = (value && typeof value === 'object') ? value : {};
  const status = STATUSES.indexOf(src.status) !== -1 ? src.status : 'pending';
  return makeDose(status, {
    at: typeof src.at === 'string' ? src.at : null,
    backdated: src.backdated,
    snoozeUntil: Number.isFinite(Number(src.snoozeUntil)) ? Number(src.snoozeUntil) : 0
  });
}

function normalize(input) {
  const src = (input && typeof input === 'object') ? input : {};
  const rawDays = (src.days && typeof src.days === 'object') ? src.days : {};
  const days = {};
  Object.keys(rawDays).forEach(function (key) {
    if (!schedule.dateFromDayKey(key)) return;
    const raw = (rawDays[key] && typeof rawDays[key] === 'object') ? rawDays[key] : {};
    const day = {};
    Object.keys(raw).forEach(function (id) {
      if (raw[id]) day[id] = normalizeDose(raw[id]);
    });
    if (Object.keys(day).length) days[key] = day;
  });
  return { version: 2, days: days };
}

function load() {
  if (!cached) cached = normalize(readJsonWithBackup(historyFilePath()));
  return cached;
}

function save() {
  writeJsonAtomic(historyFilePath(), load());
  return cached;
}

function dayOf(store, key) {
  if (!store.days[key]) store.days[key] = {};
  return store.days[key];
}

// Opens today's entries and mirrors whether each window is currently switched on.
function ensureToday(config, now) {
  const store = load();
  const key = schedule.localDayKey(now);
  const day = dayOf(store, key);
  let changed = false;

  schedule.windowIds(config).forEach(function (id) {
    const enabled = schedule.isEnabled(config, id);
    const existing = day[id];
    if (enabled) {
      if (!existing || existing.status === 'disabled') {
        day[id] = makeDose('pending');
        changed = true;
      }
    } else if (!existing || existing.status === 'pending') {
      day[id] = makeDose('disabled');
      changed = true;
    }
  });

  return changed;
}

// Rolls elapsed doses to missed and prunes beyond the retention horizon.
function sync(config, value) {
  const now = schedule.toDate(value);
  const store = load();
  const today = schedule.localDayKey(now);
  let changed = ensureToday(config, now);

  Object.keys(store.days).forEach(function (key) {
    if (key >= today) return;
    const day = store.days[key];
    Object.keys(day).forEach(function (id) {
      const entry = day[id];
      if (entry && entry.status === 'pending') {
        day[id] = makeDose('missed');
        changed = true;
      }
    });
  });

  const day = store.days[today];
  schedule.windowIds(config).forEach(function (id) {
    const entry = day && day[id];
    if (!entry || entry.status !== 'pending') return;
    if (!schedule.isEnabled(config, id)) return;
    if (!schedule.isReachable(config, id, now)) {
      day[id] = makeDose('missed');
      changed = true;
    }
  });

  const horizon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - RETENTION_DAYS, 12);
  const horizonKey = schedule.localDayKey(horizon);
  Object.keys(store.days).forEach(function (key) {
    if (key < horizonKey) {
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
  Object.keys(day).forEach(function (id) {
    out[id] = Object.assign({}, day[id]);
  });
  return out;
}

function recordStatus(dayKey, id, status, options) {
  if (!schedule.dateFromDayKey(dayKey)) return null;
  if (typeof id !== 'string' || !id) return null;
  if (STATUSES.indexOf(status) === -1) return null;
  const store = load();
  const day = dayOf(store, dayKey);
  const opts = options || {};
  day[id] = makeDose(status, {
    at: status === 'confirmed' ? (opts.at || new Date().toISOString()) : null,
    backdated: opts.backdated,
    snoozeUntil: opts.snoozeUntil
  });
  save();
  return Object.assign({}, day[id]);
}

function confirm(dayKey, id, options) {
  return recordStatus(dayKey, id, 'confirmed', options);
}

function miss(dayKey, id) {
  return recordStatus(dayKey, id, 'missed');
}

function setSnooze(dayKey, id, until) {
  if (!schedule.dateFromDayKey(dayKey)) return null;
  if (typeof id !== 'string' || !id) return null;
  const value = Number(until);
  if (!Number.isFinite(value) || value <= 0) return null;
  const store = load();
  const day = dayOf(store, dayKey);
  const current = day[id];
  if (current && current.status !== 'pending') return null;
  day[id] = makeDose('pending', { snoozeUntil: value });
  save();
  return Object.assign({}, day[id]);
}

function clearSnooze(dayKey, id) {
  const store = load();
  const entry = store.days[dayKey] && store.days[dayKey][id];
  if (!entry || entry.status !== 'pending' || !entry.snoozeUntil) return false;
  entry.snoozeUntil = 0;
  save();
  return true;
}

// Widening a window (or the grace period) makes a dose that was auto-missed
// today reachable again.
function reconcileScheduleChange(config, value) {
  const now = schedule.toDate(value);
  const store = load();
  const today = schedule.localDayKey(now);
  let changed = ensureToday(config, now);
  const day = store.days[today] || {};

  schedule.windowIds(config).forEach(function (id) {
    const entry = day[id];
    if (!entry || entry.status !== 'missed') return;
    if (schedule.isReachable(config, id, now)) {
      day[id] = makeDose('pending');
      changed = true;
    }
  });

  if (changed) save();
  return changed;
}

function undoBackdate(dayKey, id) {
  const entry = load().days[dayKey] && load().days[dayKey][id];
  if (!entry || entry.status !== 'confirmed' || !entry.backdated) return null;
  return recordStatus(dayKey, id, 'missed');
}

function undoTodayConfirmation(dayKey, id) {
  const entry = load().days[dayKey] && load().days[dayKey][id];
  if (!entry || entry.status !== 'confirmed' || entry.backdated) return null;
  return recordStatus(dayKey, id, 'pending');
}

function summary(config, value, count) {
  const now = schedule.toDate(value);
  sync(config, now);
  const store = load();
  const length = Math.max(1, Math.min(60, Number(count) || 14));
  const ids = schedule.windowIds(config);
  const days = [];
  let confirmedCount = 0;
  let trackedCount = 0;
  let latestMissed = null;

  for (let offset = length - 1; offset >= 0; offset--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset, 12);
    const key = schedule.localDayKey(d);
    const stored = store.days[key] || {};
    const item = { date: key };
    ids.forEach(function (id) { item[id] = 'unknown'; });
    ids.forEach(function (id) {
      const entry = stored[id];
      if (!entry) return;
      item[id] = entry.status;
      if (entry.status === 'confirmed' || entry.status === 'missed' || entry.status === 'pending') {
        trackedCount += 1;
        if (entry.status === 'confirmed') confirmedCount += 1;
      }
      if (entry.status === 'missed') latestMissed = { date: key, id: id };
    });
    days.push(item);
  }

  return {
    days: days,
    confirmedCount: confirmedCount,
    trackedCount: trackedCount,
    latestMissed: latestMissed,
    today: schedule.localDayKey(now),
    todayStatus: getDay(schedule.localDayKey(now))
  };
}

function setFilePathForTests(target) {
  filePathOverride = target;
  cached = null;
}

function resetForTests() {
  filePathOverride = null;
  cached = null;
}

module.exports = {
  normalize: normalize,
  sync: sync,
  summary: summary,
  getDay: getDay,
  confirm: confirm,
  miss: miss,
  setSnooze: setSnooze,
  clearSnooze: clearSnooze,
  reconcileScheduleChange: reconcileScheduleChange,
  undoBackdate: undoBackdate,
  undoTodayConfirmation: undoTodayConfirmation,
  _setFilePathForTests: setFilePathForTests,
  _resetForTests: resetForTests
};
