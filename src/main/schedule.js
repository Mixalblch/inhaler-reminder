// Pure time helpers shared by the scheduler and the history store.
//
// Both subsystems decide "is this dose still reachable?" and they must answer
// identically — otherwise history can record a dose as missed while the
// scheduler still intends to remind about it.

const DOSES = ['morning', 'evening'];

function parseTime(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
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
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  return localDayKey(d) === key ? d : null;
}

function windowFor(config, dose) {
  const windows = config && config.windows;
  return (windows && windows[dose]) || null;
}

function isEnabled(config, dose) {
  const win = windowFor(config, dose);
  return !!(win && win.enabled);
}

function graceMinutes(config) {
  const value = Number(config && config.graceMinutes);
  return Number.isFinite(value) ? Math.max(0, value) : 120;
}

// Last minute-of-day at which this dose may still be reminded about or confirmed.
// Capped at end-of-day: a dose never rolls over into tomorrow.
function deadlineMinutes(config, dose) {
  const win = windowFor(config, dose);
  if (!win) return 0;
  return Math.min(1439, parseTime(win.end) + graceMinutes(config));
}

function isReachable(config, dose, now) {
  if (!isEnabled(config, dose)) return false;
  return minutesOfDay(toDate(now)) <= deadlineMinutes(config, dose);
}

// True once the window has opened — before that the dose is scheduled, not due.
function isDue(config, dose, now) {
  const win = windowFor(config, dose);
  if (!win) return false;
  return minutesOfDay(toDate(now)) >= parseTime(win.start);
}

// Doses ordered by start time, so "next reminder" follows the clock rather than
// the morning/evening naming.
function orderedDoses(config) {
  return DOSES.filter(function (dose) {
    return isEnabled(config, dose);
  }).map(function (dose) {
    const win = windowFor(config, dose);
    return { dose: dose, start: win.start, end: win.end, startMinutes: parseTime(win.start) };
  }).sort(function (a, b) {
    return a.startMinutes - b.startMinutes || DOSES.indexOf(a.dose) - DOSES.indexOf(b.dose);
  });
}

module.exports = {
  DOSES: DOSES,
  parseTime: parseTime,
  formatTime: formatTime,
  minutesOfDay: minutesOfDay,
  localDayKey: localDayKey,
  dateFromDayKey: dateFromDayKey,
  windowFor: windowFor,
  isEnabled: isEnabled,
  graceMinutes: graceMinutes,
  deadlineMinutes: deadlineMinutes,
  isReachable: isReachable,
  isDue: isDue,
  orderedDoses: orderedDoses,
  toDate: toDate
};
