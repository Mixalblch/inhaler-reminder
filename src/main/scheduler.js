let timer = null;
let state = null;
let pendingWindow = null;
let options = null;

function currentNow() {
  if (options && typeof options.now === 'function') {
    const value = options.now();
    return value instanceof Date ? value : new Date();
  }
  return new Date();
}

function dayKey(value) {
  const d = value instanceof Date ? value : currentNow();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function minutesOfDay(now) {
  return now.getHours() * 60 + now.getMinutes();
}

function parseTime(s) {
  const parts = String(s || '').split(':');
  return Number(parts[0]) * 60 + Number(parts[1]);
}

function freshState(now) {
  const current = now instanceof Date ? now : currentNow();
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

function clearPending(reason) {
  const key = pendingWindow;
  pendingWindow = null;
  if (key && options && options.onPendingCleared) options.onPendingCleared(key, reason);
}

function fire(key) {
  if (!state || !state.windows[key]) return false;
  if (pendingWindow && pendingWindow !== key) return false;
  state.windows[key].status = 'fired';
  pendingWindow = key;
  if (options.onReminder) options.onReminder(key);
  changed();
  return true;
}

function miss(key) {
  if (!state || !state.windows[key]) return;
  const ws = state.windows[key];
  if (ws.status === 'confirmed' || ws.status === 'missed' || ws.status === 'skipped') return;
  ws.status = 'skipped';
  if (pendingWindow === key) clearPending('missed');
  if (options.recordMissed) options.recordMissed(state.day, key);
  changed();
}

function rollover(now) {
  const today = dayKey(now);
  if (!state || state.day !== today) {
    if (state && options && options.onDayChange) options.onDayChange(state.day, today, now);
    if (pendingWindow) clearPending('day-change');
    state = freshState(now);
    return true;
  }
  return false;
}

function tick() {
  const now = currentNow();
  rollover(now);
  const cfg = options.getConfig();
  const nowMin = minutesOfDay(now);
  const idle = options.isIdleSeconds ? options.isIdleSeconds() : 0;
  const idleThreshold = cfg.idleThresholdSeconds != null ? cfg.idleThresholdSeconds : 300;
  const active = idle < idleThreshold;
  const keys = ['morning', 'evening'];

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const win = cfg.windows && cfg.windows[key];
    const ws = state.windows[key];
    if (!ws) continue;
    if (!win || !win.enabled) {
      if (ws.status === 'fired' || ws.status === 'snoozed') {
        ws.status = 'pending';
        ws.snoozeUntil = 0;
        if (pendingWindow === key) clearPending('disabled');
        changed();
      } else if (pendingWindow === key) {
        clearPending('disabled');
      }
      continue;
    }
    if (ws.status === 'confirmed' || ws.status === 'missed' || ws.status === 'skipped') continue;

    const startMin = parseTime(win.start);
    const endMin = parseTime(win.end);
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || startMin >= endMin) continue;

    const graceMinutes = cfg.graceMinutes != null ? cfg.graceMinutes : 120;
    const deadline = endMin + graceMinutes;
    const pastDeadline = nowMin > deadline;

    if (ws.status === 'snoozed') {
      if (pastDeadline) {
        miss(key);
        continue;
      }
      if (active && now.getTime() >= ws.snoozeUntil) fire(key);
      continue;
    }

    if (ws.status === 'fired') {
      if (pastDeadline) miss(key);
      continue;
    }

    if (nowMin >= startMin && nowMin <= endMin) {
      if (active) fire(key);
    } else if (nowMin > endMin) {
      if (!pastDeadline) {
        if (active) fire(key);
      } else {
        miss(key);
      }
    }
  }
}

function start(opts) {
  stop();
  options = opts;
  pendingWindow = null;
  state = freshState(currentNow());
  tick();
  timer = setInterval(tick, 10000);
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
  pendingWindow = null;
}

function confirm() {
  rollover(currentNow());
  const confirmedKey = pendingWindow;
  if (!pendingWindow || !state || !state.windows[pendingWindow]) {
    return null;
  }
  state.windows[pendingWindow].status = 'confirmed';
  if (options.recordConfirmed) options.recordConfirmed(state.day, pendingWindow, { backdated: false });
  pendingWindow = null;
  changed();
  return confirmedKey;
}

function snooze(minutes) {
  rollover(currentNow());
  if (pendingWindow && state) {
    const cfg = options.getConfig();
    const requested = Number(minutes);
    const mins = Number.isFinite(requested) ? Math.min(180, Math.max(1, Math.round(requested))) : (cfg.snoozeMinutes != null ? cfg.snoozeMinutes : 15);
    state.windows[pendingWindow].status = 'snoozed';
    state.windows[pendingWindow].snoozeUntil = currentNow().getTime() + mins * 60000;
  }
  pendingWindow = null;
  changed();
}

function dismiss() {
  rollover(currentNow());
  if (!pendingWindow || !state || !state.windows[pendingWindow]) return false;
  if (state.windows[pendingWindow].status !== 'fired') return false;
  state.windows[pendingWindow].status = 'pending';
  pendingWindow = null;
  changed();
  return true;
}

function currentDoseKey(now) {
  if (pendingWindow) return pendingWindow;
  if (!state) return null;
  const cfg = options.getConfig();
  const nowMin = minutesOfDay(now || currentNow());
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
  rollover(currentNow());
  const key = currentDoseKey(currentNow());
  if (!key || !state) return null;
  state.windows[key].status = 'confirmed';
  pendingWindow = null;
  if (options.recordConfirmed) options.recordConfirmed(state.day, key, { backdated: false });
  changed();
  return key;
}

function undoConfirmation(key) {
  rollover(currentNow());
  if (!state || !key || !state.windows[key] || state.windows[key].status !== 'confirmed') return false;
  state.windows[key].status = 'fired';
  pendingWindow = key;
  if (options.undoConfirmed) options.undoConfirmed(state.day, key);
  changed();
  return true;
}

function nextReminder(cfg, now, st) {
  const config = cfg || (options && options.getConfig ? options.getConfig() : null);
  const snapshot = st || state;
  if (!config) return null;
  const keys = ['morning', 'evening'];
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const win = config.windows && config.windows[key];
    if (!win || !win.enabled) continue;
    const ws = snapshot && snapshot.windows && snapshot.windows[key];
    if (ws && (ws.status === 'confirmed' || ws.status === 'missed' || ws.status === 'skipped')) continue;
    return { when: 'today', time: win.start, key: key };
  }
  for (let j = 0; j < keys.length; j++) {
    const win = config.windows && config.windows[keys[j]];
    if (win && win.enabled) return { when: 'tomorrow', time: win.start, key: keys[j] };
  }
  return null;
}

function getState() { return state; }
function getPendingWindow() { return pendingWindow; }

module.exports = {
  start: start,
  stop: stop,
  confirm: confirm,
  confirmNow: confirmNow,
  undoConfirmation: undoConfirmation,
  snooze: snooze,
  dismiss: dismiss,
  getState: getState,
  getPendingWindow: getPendingWindow,
  currentDoseKey: currentDoseKey,
  nextReminder: nextReminder,
  tick: tick
};
