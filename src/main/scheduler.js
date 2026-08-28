// Decides when a reminder is shown.
//
// The persistent record lives in history.js; this module keeps only the
// transient layer on top of it — which window is on screen right now, and when
// a snoozed window becomes due again.

const schedule = require('./schedule');

const TICK_MS = 10000;

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

  schedule.windowIds(config()).forEach(function (id) {
    const entry = persisted[id];
    if (entry && (entry.status === 'confirmed' || entry.status === 'missed' || entry.status === 'disabled')) {
      windows[id] = { status: entry.status, snoozeUntil: 0 };
      return;
    }
    const until = entry && Number(entry.snoozeUntil);
    if (Number.isFinite(until) && until > current.getTime()) {
      windows[id] = { status: 'snoozed', snoozeUntil: until };
      return;
    }
    windows[id] = { status: 'pending', snoozeUntil: 0 };
  });

  return { day: key, windows: windows };
}

function changed() {
  if (options && options.onStateChanged) options.onStateChanged(state);
}

function markMissed(id) {
  state.windows[id].status = 'missed';
  state.windows[id].snoozeUntil = 0;
  if (options.recordMissed) options.recordMissed(state.day, id);
}

// Returns false when another reminder already owns the screen; that window
// stays queued and is retried on a later tick.
function fire(id) {
  if (pendingWindow && pendingWindow !== id) return false;
  state.windows[id].status = 'fired';
  state.windows[id].snoozeUntil = 0;
  pendingWindow = id;
  if (options.clearSnooze) options.clearSnooze(state.day, id);
  if (options.onReminder) options.onReminder(id);
  changed();
  return true;
}

function tick() {
  const now = new Date();
  const today = schedule.localDayKey(now);
  if (!state || state.day !== today) {
    const rolled = !!state && state.day !== today;
    pendingWindow = null;
    state = freshState(now);
    if (rolled && options.onDayChanged) options.onDayChanged(today);
    if (rolled) changed();
  }

  const cfg = config();
  const idle = options.isIdleSeconds ? options.isIdleSeconds() : 0;
  const threshold = cfg.idleThresholdSeconds != null ? cfg.idleThresholdSeconds : 30;
  const atKeyboard = idle < threshold;

  const ids = schedule.windowIds(cfg);
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const ws = state.windows[id];

    if (!schedule.isEnabled(cfg, id)) {
      if (ws.status === 'pending' || ws.status === 'snoozed') ws.status = 'disabled';
      continue;
    }
    if (ws.status === 'disabled') ws.status = 'pending';
    if (ws.status === 'confirmed' || ws.status === 'missed') continue;

    if (ws.status === 'fired') {
      if (pendingWindow === id) continue;
      ws.status = 'pending';
    }

    const reachable = schedule.isReachable(cfg, id, now);

    if (ws.status === 'snoozed') {
      if (!reachable) { markMissed(id); changed(); continue; }
      if (now.getTime() >= ws.snoozeUntil && fire(id)) break;
      continue;
    }

    if (!reachable) { markMissed(id); changed(); continue; }
    // Wait for the user to be at the keyboard rather than firing into an empty room.
    if (schedule.isDue(cfg, id, now) && atKeyboard && fire(id)) break;
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
  const id = pendingWindow;
  if (!id || !state) return null;
  state.windows[id].status = 'confirmed';
  state.windows[id].snoozeUntil = 0;
  pendingWindow = null;
  if (options.recordConfirmed) options.recordConfirmed(state.day, id, { backdated: false });
  changed();
  return id;
}

function snooze(minutes) {
  const id = pendingWindow;
  pendingWindow = null;
  if (!id || !state) { changed(); return null; }

  const cfg = config();
  const requested = Number(minutes);
  const wanted = Number.isFinite(requested)
    ? Math.min(180, Math.max(1, Math.round(requested)))
    : (cfg.snoozeMinutes != null ? cfg.snoozeMinutes : 15);

  const now = new Date();
  const deadline = schedule.deadlineMinutes(cfg, id);
  const remaining = deadline - schedule.minutesOfDay(now);
  if (remaining <= 0) { markMissed(id); changed(); return null; }

  const granted = Math.min(wanted, remaining);
  const until = now.getTime() + granted * 60000;
  state.windows[id].status = 'snoozed';
  state.windows[id].snoozeUntil = until;
  if (options.recordSnoozed) options.recordSnoozed(state.day, id, until);
  changed();
  return granted;
}

function dismiss() {
  if (!pendingWindow) return false;
  snooze(config().snoozeMinutes);
  return true;
}

function currentDoseKey(now) {
  if (pendingWindow) return pendingWindow;
  if (!state) return null;
  const cfg = config();
  const at = schedule.toDate(now);
  const open = schedule.orderedWindows(cfg).filter(function (item) {
    const ws = state.windows[item.id];
    if (!ws || ws.status === 'confirmed' || ws.status === 'missed' || ws.status === 'disabled') return false;
    return schedule.isReachable(cfg, item.id, at);
  });
  if (!open.length) return null;
  const due = open.filter(function (item) { return schedule.isDue(cfg, item.id, at); });
  return (due.length ? due[0] : open[0]).id;
}

function confirmNow() {
  const id = currentDoseKey(new Date());
  if (!id || !state) return null;
  state.windows[id].status = 'confirmed';
  state.windows[id].snoozeUntil = 0;
  pendingWindow = null;
  if (options.recordConfirmed) options.recordConfirmed(state.day, id, { backdated: false });
  changed();
  return id;
}

function undoConfirmation(id) {
  if (!state || !id || !state.windows[id] || state.windows[id].status !== 'confirmed') return false;
  state.windows[id].status = 'pending';
  if (options.undoConfirmed) options.undoConfirmed(state.day, id);
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
