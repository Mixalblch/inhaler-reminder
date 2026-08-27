// Deterministic state for design QA captures.
//
// Reproduces the exact situation the Claude Design 2a mock depicts: fourteen
// tracked days, this morning confirmed at 09:24, this evening still open, and
// yesterday evening missed — so a capture can be compared with the source.
//
// Development only: `scripts/` is not part of the packaged app.

const path = require('path');
const { writeJsonAtomic } = require('../src/main/atomic-store');
const schedule = require('../src/main/schedule');

// Matches the mock's own arrays. 't' taken, 'm' missed, 'p' pending.
const MORNING = ['t', 't', 't', 't', 't', 'm', 't', 't', 't', 't', 't', 't', 't', 't'];
const EVENING = ['t', 't', 'm', 't', 't', 't', 't', 't', 't', 't', 't', 't', 'm', 'p'];

function entry(code, day, hour, minute) {
  if (code === 't') {
    return {
      status: 'confirmed',
      at: new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute).toISOString(),
      backdated: false,
      snoozeUntil: 0
    };
  }
  if (code === 'm') return { status: 'missed', at: null, backdated: false, snoozeUntil: 0 };
  return { status: 'pending', at: null, backdated: false, snoozeUntil: 0 };
}

function seed(userDataPath, now) {
  const today = now instanceof Date ? now : new Date();
  const days = {};

  for (let i = 0; i < MORNING.length; i++) {
    const offset = MORNING.length - 1 - i;
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset, 12);
    days[schedule.localDayKey(day)] = {
      morning: entry(MORNING[i], day, 9, 24),
      evening: entry(EVENING[i], day, 20, 14)
    };
  }

  writeJsonAtomic(path.join(userDataPath, 'history.json'), { version: 1, days: days });
}

module.exports = { seed: seed };
