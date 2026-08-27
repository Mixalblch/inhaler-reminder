// Decides when a reminder is shown.
//
// The persistent record lives in history.js; this module keeps only the
// transient layer on top of it — which dose is on screen right now, and when a
// snoozed dose becomes due again.

const schedule = require('./schedule');

const TICK_MS = 10000;
const DOSES = schedule.DOSES;

let timer = null;
let state = null;
let pendingWindow = null;
let options = null;

function config() {
  return options.getConfig();
}

function historyDay(key) {
  return (options.getHistoryDay ? options.getHistoryDay(key) : null) || {};
}

// Rebuilds the in-memory view from what was persisted, so a restart does not
// re-fire a dose the user already handled or resurrect an expired snooze.
function freshState(now) {
  const current = schedule.toDate(now);
  const key = schedule.localDayKey(current);
  const persisted = historyDay(key);
  const windows = {};

  DOSES.forEach(function (dose) {
    const entry = persisted[dose];
    if (entry && (entry.status === 'confirmed' || entry.status === 'missed' || entry.status === 'disabled')) {
      windows[dose] = { status: entry.status, snoozeUntil: 0 };
      return;
    }
    const until = entry && Number(entry.snoozeUntil);
    if (Number.isFinite(until) && until > current.getTime()) {
      windows[dose] = { status: 'snoozed', snoozeUntil: until };
      return;
    }
    windows[dose] = { status: 'pending', snoozeUntil: 0 };
  });

  return { day: key, windows: windows };
}

function changed() {
  if (options && options.onStateChanged) options.onStateChanged(state);
}

function markMissed(dose) {
  state.windows[dose].status = 'missed';
  state.windows[dose].snoozeUntil = 0;
  if (options.recordMissed) options.recordMissed(state.day, dose);
}

// Returns false when another reminder already owns the screen; that dose stays
// queued and is retried on a later tick.
function fire(dose) {
  if (pendingWindow && pendingWindow !== dose) return false;
  state.windows[dose].status = 'fired';
  state.windows[dose].snoozeUntil = 0;
  pendingWindow = dose;
  if (options.clearSnooze) options.clearSnooze(state.day, dose);
  if (options.onReminder) options.onReminder(dose);
  changed();
  return true;
}

function tick() {
  const now = new Date();
  const today = schedule.localDayKey(now);
  if (!state || state.day !== today) {
    pendingWindow = null;
    state = freshState(now);
  }

  const cfg = config();
  const idle = options.isIdleSeconds ? options.isIdleSeconds() : 0;
  const threshold = cfg.idleThresholdSeconds != null ? cfg.idleThresholdSeconds : 30;
  const atKeyboard = idle < threshold;

  for (let i = 0; i < DOSES.length; i++) {
    const dose = DOSES[i];
    const ws = state.windows[dose];

    if (!schedule.isEnabled(cfg, dose)) {
      if (ws.status === 'pending' || ws.status === 'snoozed') ws.status = 'disabled';
      continue;
    }
    if (ws.status === 'disabled') ws.status = 'pending';
    if (ws.status === 'confirmed' || ws.status === 'missed') continue;

    // A dose on screen keeps the screen; anything else that claimed `fired`
    // without resolving is returned to the queue.
    if (ws.status === 'fired') {
      if (pendingWindow === dose) continue;
      ws.status = 'pending';
    }

    const reachable = schedule.isReachable(cfg, dose, now);

    if (ws.status === 'snoozed') {
      if (!reachable) { markMissed(dose); changed(); continue; }
      if (now.getTime() >= ws.snoozeUntil && fire(dose)) break;
      continue;
    }

    if (!reachable) { markMissed(dose); changed(); continue; }
    // Wait for the user to be at the keyboard rather than firing into an empty room.
    if (schedule.isDue(cfg, dose, now) && atKeyboard && fire(dose)) break;
  }
}

function start(opts) {
  stop();
  options = opts;
  state = freshState(new Date());
  tick();
  timer = setInterval(tick, TICK_MS);
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
}

// Re-derives everything after the schedule changed under us.
function reload() {
  pendingWindow = null;
  state = freshState(new Date());
  tick();
  changed();
  return state;
}

function confirm() {
  const dose = pendingWindow;
  if (!dose || !state) return null;
  state.windows[dose].status = 'confirmed';
  state.windows[dose].snoozeUntil = 0;
  pendingWindow = null;
  if (options.recordConfirmed) options.recordConfirmed(state.day, dose, { backdated: false });
  changed();
  return dose;
}

// Snoozing may not push a dose past the point where history would call it
// missed, otherwise the two records contradict each other.
function snooze(minutes) {
  const dose = pendingWindow;
  pendingWindow = null;
  if (!dose || !state) { changed(); return null; }

  const cfg = config();
  const requested = Number(minutes);
  const wanted = Number.isFinite(requested)
    ? Math.min(180, Math.max(1, Math.round(requested)))
    : (cfg.snoozeMinutes != null ? cfg.snoozeMinutes : 15);

  const now = new Date();
  const deadline = schedule.deadlineMinutes(cfg, dose);
  const remaining = deadline - schedule.minutesOfDay(now);
  if (remaining <= 0) { markMissed(dose); changed(); return null; }

  const granted = Math.min(wanted, remaining);
  const until = now.getTime() + granted * 60000;
  state.windows[dose].status = 'snoozed';
  state.windows[dose].snoozeUntil = until;
  if (options.recordSnoozed) options.recordSnoozed(state.day, dose, until);
  changed();
  return granted;
}

// The reminder window was dismissed without a choice — treat it as a snooze.
function dismiss() {
  if (!pendingWindow) return false;
  snooze(config().snoozeMinutes);
  return true;
}

// Which dose the tray should talk about: the one on screen, else the next one
// still open today.
function currentDoseKey(now) {
  if (pendingWindow) return pendingWindow;
  if (!state) return null;
  const cfg = config();
  const at = schedule.toDate(now);
  const open = schedule.orderedDoses(cfg).filter(function (item) {
    const ws = state.windows[item.dose];
    if (!ws || ws.status === 'confirmed' || ws.status === 'missed' || ws.status === 'disabled') return false;
    return schedule.isReachable(cfg, item.dose, at);
  });
  if (!open.length) return null;
  // A dose whose window has already opened is what `tick` will fire next, so the
  // tray must name that one rather than the next one on the clock.
  const due = open.filter(function (item) { return schedule.isDue(cfg, item.dose, at); });
  return (due.length ? due[0] : open[0]).dose;
}

function confirmNow() {
  const dose = currentDoseKey(new Date());
  if (!dose || !state) return null;
  state.windows[dose].status = 'confirmed';
  state.windows[dose].snoozeUntil = 0;
  pendingWindow = null;
  if (options.recordConfirmed) options.recordConfirmed(state.day, dose, { backdated: false });
  changed();
  return dose;
}

function undoConfirmation(dose) {
  if (!state || !dose || !state.windows[dose] || state.windows[dose].status !== 'confirmed') return false;
  state.windows[dose].status = 'pending';
  if (options.undoConfirmed) options.undoConfirmed(state.day, dose);
  changed();
  return true;
}

function getState() { return state; }

module.exports = {
  start: start,
  stop: stop,
  reload: reload,
  tick: tick,
  confirm: confirm,
  confirmNow: confirmNow,
  undoConfirmation: undoConfirmation,
  snooze: snooze,
  dismiss: dismiss,
  currentDoseKey: currentDoseKey,
  getState: getState
};
