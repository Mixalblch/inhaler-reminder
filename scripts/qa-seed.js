// Deterministic state for design QA captures.
//
// Reproduces the exact situation the Claude Design 2a mock depicts: fourteen
// tracked days, this morning confirmed at 09:24, this evening still open, and
// yesterday evening missed — so a capture can be compared with the source.
//
// Development only: `scripts/` is not part of the packaged app.

const os = require('os');
const path = require('path');
const { writeJsonAtomic } = require('../src/main/atomic-store');
const schedule = require('../src/main/schedule');

// Seeding is destructive: it replaces the adherence record wholesale. Refuse to
// do that anywhere but a scratch profile, so a caller that forgets to redirect
// userData fails loudly instead of eating the user's history.
function assertScratchProfile(userDataPath) {
  const target = path.resolve(userDataPath);
  const temp = path.resolve(os.tmpdir());
  const inTemp = target === temp || target.toLowerCase().startsWith(temp.toLowerCase() + path.sep);
  if (!inTemp) {
    throw new Error(
      'refusing to seed outside a temp profile: ' + target +
      '\nCall app.setPath("userData", ...) before seeding.'
    );
  }
}

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
  assertScratchProfile(userDataPath);
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
