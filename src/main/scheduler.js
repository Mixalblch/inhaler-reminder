let timer = null;
let state = null;
let pendingWindow = null;
let options = null;

function dayKey() {
  const d = new Date();
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

function freshState() {
  return {
    day: dayKey(),
    windows: {
      morning: { status: 'pending', snoozeUntil: 0 },
      evening: { status: 'pending', snoozeUntil: 0 }
    }
  };
}

function fire(key) {
  state.windows[key].status = 'fired';
  pendingWindow = key;
  if (options.onReminder) options.onReminder(key);
}

function tick() {
  const now = new Date();
  const today = dayKey();
  if (!state || state.day !== today) {
    state = freshState();
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
    if (ws.status === 'confirmed' || ws.status === 'skipped') continue;

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
      }
    }
  }
}

function start(opts) {
  stop();
  options = opts;
  state = freshState();
  timer = setInterval(tick, 10000);
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
}

function confirm() {
  if (pendingWindow && state) {
    state.windows[pendingWindow].status = 'confirmed';
  }
  pendingWindow = null;
}

function snooze() {
  if (pendingWindow && state) {
    const cfg = options.getConfig();
    const mins = cfg.snoozeMinutes != null ? cfg.snoozeMinutes : 15;
    state.windows[pendingWindow].status = 'snoozed';
    state.windows[pendingWindow].snoozeUntil = Date.now() + mins * 60000;
  }
  pendingWindow = null;
}

function getState() { return state; }

module.exports = { start: start, stop: stop, confirm: confirm, snooze: snooze, getState: getState };
