// Pure time helpers shared by the scheduler and the history store.

function parseTime(value) {
  const s = String(value || '');
  if (s.length !== 5 || s.charAt(2) !== ':') return 0;
  const h = Number(s.slice(0, 2));
  const m = Number(s.slice(3, 5));
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) return 0;
  return h * 60 + m;
}

function formatTime(minutes) {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
}

function minutesOfDay(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function toDate(value) {
  if (value instanceof Date) return value;
  return new Date(value == null ? Date.now() : value);
}

function localDayKey(value) {
  const d = toDate(value);
  return d.getFullYear() +
    '-' + String(d.getMonth() + 1).padStart(2, '0') +
    '-' + String(d.getDate()).padStart(2, '0');
}

// Noon anchor keeps the date stable across DST transitions.
function dateFromDayKey(key) {
  const s = String(key || '');
  const parts = s.split('-');
  if (parts.length !== 3) return null;
  if (parts[0].length !== 4 || parts[1].length !== 2 || parts[2].length !== 2) return null;
  const y = Number(parts[0]);
  const mo = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return null;
  const date = new Date(y, mo - 1, d, 12, 0, 0, 0);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return localDayKey(date) === s ? date : null;
}

function windowIds(config) {
  const wins = (config && Array.isArray(config.windows)) ? config.windows : [];
  return wins.map(function (w) { return w.id; });
}

function windowFor(config, id) {
  const wins = (config && Array.isArray(config.windows)) ? config.windows : [];
  for (let i = 0; i < wins.length; i++) {
    if (wins[i].id === id) return wins[i];
  }
  return null;
}

function isEnabled(config, id) {
  const win = windowFor(config, id);
  return !!(win && win.enabled);
}

function graceMinutes(config) {
  const value = Number(config && config.graceMinutes);
  return Number.isFinite(value) ? Math.max(0, value) : 120;
}

function deadlineMinutes(config, id) {
  const win = windowFor(config, id);
  if (!win) return 0;
  return Math.min(1439, parseTime(win.end) + graceMinutes(config));
}

function isReachable(config, id, now) {
  if (!isEnabled(config, id)) return false;
  return minutesOfDay(toDate(now)) <= deadlineMinutes(config, id);
}

function isDue(config, id, now) {
  const win = windowFor(config, id);
  if (!win) return false;
  return minutesOfDay(toDate(now)) >= parseTime(win.start);
}

function orderedWindows(config) {
  return windowIds(config).filter(function (id) {
    return isEnabled(config, id);
  }).map(function (id) {
    const win = windowFor(config, id);
    return { id: id, name: win.name, start: win.start, end: win.end, startMinutes: parseTime(win.start) };
  }).sort(function (a, b) {
    return a.startMinutes - b.startMinutes;
  });
}

module.exports = {
  parseTime: parseTime,
  formatTime: formatTime,
  minutesOfDay: minutesOfDay,
  localDayKey: localDayKey,
  dateFromDayKey: dateFromDayKey,
  windowIds: windowIds,
  windowFor: windowFor,
  isEnabled: isEnabled,
  graceMinutes: graceMinutes,
  deadlineMinutes: deadlineMinutes,
  isReachable: isReachable,
  isDue: isDue,
  orderedWindows: orderedWindows,
  toDate: toDate
};
