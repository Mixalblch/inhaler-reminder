let timer = null;
let state = null;
let pendingWindow = null;
let options = null;

function dayKey(value) {
  const d = value instanceof Date ? value : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function minutesOfDay(now) {
  return now.getHours() * 60 + now.getMinutes();
}

function parseTime(s) {
  const parts = s.split(':');
  return Number(parts[0]) * 60 + Number(parts[1]);
}

function freshState(now) {
  const current = now instanceof Date ? now : new Date();
  const key = dayKey(current);
  const persisted = options && options.getHistoryDay ? options.getHistoryDay(key) : {};
  function initial(dose) {
    const entry = persisted && persisted[dose];
    if (entry && (entry.status === 'confirmed' || entry.status === 'missed')) return entry.status;
    return 'pending';
  }
  return {
    day: key,
    windows: {
      morning: { status: initial('morning'), snoozeUntil: 0 },
      evening: { status: initial('evening'), snoozeUntil: 0 }
    }
  };
}

function changed() {
  if (options && options.onStateChanged) options.onStateChanged(getState());
}

function fire(key) {
  state.windows[key].status = 'fired';
  pendingWindow = key;
  if (options.onReminder) options.onReminder(key);
  changed();
}

function tick() {
  const now = new Date();
  const today = dayKey();
  if (!state || state.day !== today) {
    state = freshState(now);
  }
  const cfg = options.getConfig();
  const nowMin = minutesOfDay(now);
  const idle = options.isIdleSeconds ? options.isIdleSeconds() : 0;
  const idleThreshold = cfg.idleThresholdSeconds != null ? cfg.idleThresholdSeconds : 30;
  const active = idle < idleThreshold;

  const keys = ['morning', 'evening'];
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const win = cfg.windows && cfg.windows[key];
    if (!win || !win.enabled) continue;
    const ws = state.windows[key];
    if (ws.status === 'confirmed' || ws.status === 'missed' || ws.status === 'skipped') continue;

    if (ws.status === 'snoozed') {
      if (now.getTime() >= ws.snoozeUntil) fire(key);
      continue;
    }

    if (ws.status === 'fired') continue;

    // pending
    const startMin = parseTime(win.start);
    const endMin = parseTime(win.end);
    const graceMinutes = cfg.graceMinutes != null ? cfg.graceMinutes : 120;

    if (nowMin >= startMin && nowMin <= endMin) {
      if (active) fire(key);
    } else if (nowMin > endMin) {
      const endPlusGrace = endMin + graceMinutes;
      if (nowMin <= endPlusGrace) {
        if (active) fire(key);
      } else {
        ws.status = 'skipped';
        if (options.recordMissed) options.recordMissed(today, key);
        changed();
      }
    }
  }
}

function start(opts) {
  stop();
  options = opts;
  state = freshState(new Date());
  tick();
  timer = setInterval(tick, 10000);
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
}

function confirm() {
  const confirmedKey = pendingWindow;
  if (pendingWindow && state) {
    state.windows[pendingWindow].status = 'confirmed';
    if (options.recordConfirmed) options.recordConfirmed(state.day, pendingWindow, { backdated: false });
  }
  pendingWindow = null;
  changed();
  return confirmedKey;
}

function snooze(minutes) {
  if (pendingWindow && state) {
    const cfg = options.getConfig();
    const requested = Number(minutes);
    const mins = Number.isFinite(requested) ? Math.min(180, Math.max(1, Math.round(requested))) : (cfg.snoozeMinutes != null ? cfg.snoozeMinutes : 15);
    state.windows[pendingWindow].status = 'snoozed';
    state.windows[pendingWindow].snoozeUntil = Date.now() + mins * 60000;
  }
  pendingWindow = null;
  changed();
}

function currentDoseKey(now) {
  if (pendingWindow) return pendingWindow;
  if (!state) return null;
  const cfg = options.getConfig();
  const nowMin = minutesOfDay(now || new Date());
  let candidate = null;
  ['morning', 'evening'].forEach(function (key) {
    const win = cfg.windows && cfg.windows[key];
    const ws = state.windows[key];
    if (!win || !win.enabled || !ws || (ws.status !== 'pending' && ws.status !== 'fired' && ws.status !== 'snoozed')) return;
    const start = parseTime(win.start);
    if (!candidate || (start <= nowMin && start >= candidate.start) || (candidate.start > nowMin && start < candidate.start)) {
      candidate = { key: key, start: start };
    }
  });
  return candidate ? candidate.key : null;
}

function confirmNow() {
  const key = currentDoseKey(new Date());
  if (!key || !state) return null;
  state.windows[key].status = 'confirmed';
  pendingWindow = null;
  if (options.recordConfirmed) options.recordConfirmed(state.day, key, { backdated: false });
  changed();
  return key;
}

function undoConfirmation(key) {
  if (!state || !key || !state.windows[key] || state.windows[key].status !== 'confirmed') return false;
  state.windows[key].status = 'pending';
  if (options.undoConfirmed) options.undoConfirmed(state.day, key);
  changed();
  return true;
}

function getState() { return state; }

module.exports = {
  start: start,
  stop: stop,
  confirm: confirm,
  confirmNow: confirmNow,
  undoConfirmation: undoConfirmation,
  snooze: snooze,
  getState: getState,
  tick: tick
};
