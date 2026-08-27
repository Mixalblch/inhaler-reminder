// Design-QA capture harness.
//
// The reminder is fired through the real scheduler rather than by calling the
// window directly — otherwise `pendingWindow` is never set and Confirm/Undo
// silently no-op, which makes the interaction results meaningless.
//
// Development only: `scripts/` is not part of the packaged app.

const fs = require('fs');
const path = require('path');
const { seed } = require('./qa-seed');
const scheduler = require('../src/main/scheduler');
const schedule = require('../src/main/schedule');

// The state the design source depicts, so captures are comparable with it.
const DESIGN_STATE = {
  locale: 'ru',
  appearance: 'system',
  soundEnabled: true,
  autostart: false,
  snoozeMinutes: 15,
  graceMinutes: 120,
  windows: {
    morning: { enabled: true, start: '09:00', end: '12:00' },
    evening: { enabled: true, start: '18:00', end: '21:00' }
  }
};

const errors = [];

function prepare(ctx) {
  seed(ctx.app.getPath('userData'), new Date());
  ctx.config.set(DESIGN_STATE);
}

function wait(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function watchConsole(win, tag) {
  if (!win) return;
  win.webContents.on('console-message', function (_e, level, message) {
    if (level >= 2) errors.push(tag + ': ' + message);
  });
}

async function shoot(win, file) {
  const image = await win.webContents.capturePage();
  fs.writeFileSync(file, image.toPNG());
}

// Forces the rendered theme without changing the stored preference, so the
// "Система" segment stays selected exactly as the design shows it.
function forceTheme(win, theme) {
  return win.webContents.executeJavaScript(
    'document.documentElement.dataset.theme = ' + JSON.stringify(theme) + '; true'
  );
}

async function settingsChecks(win) {
  return win.webContents.executeJavaScript(`(async function () {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const out = {};

    const summary = document.querySelector('.dose-summary');
    summary.click(); await wait(120);
    out.editorOpens = document.getElementById('morningEditor').classList.contains('open')
      && summary.getAttribute('aria-expanded') === 'true';
    summary.click(); await wait(120);
    out.editorCloses = !document.getElementById('morningEditor').classList.contains('open');

    const before = document.getElementById('snoozeValue').textContent;
    document.querySelector('[data-number-step="5"]').click(); await wait(140);
    const bumped = document.getElementById('snoozeValue').textContent;
    document.querySelector('[data-number-step="-5"]').click(); await wait(140);
    out.stepperRoundTrip = bumped !== before
      && document.getElementById('snoozeValue').textContent === before;

    document.querySelector('[data-appearance="dark"]').click(); await wait(160);
    out.darkApplies = document.documentElement.dataset.theme === 'dark';
    document.querySelector('[data-appearance="system"]').click(); await wait(160);
    out.systemRestores = document.querySelector('[data-appearance="system"]')
      .getAttribute('aria-checked') === 'true';

    const backdate = document.getElementById('backdateBtn');
    const missedBefore = document.getElementById('missedTitle').textContent;
    backdate.click(); await wait(260);
    out.backdateShowsUndo = !document.getElementById('backdatedRow').hidden;
    document.getElementById('undoBackdateBtn').click(); await wait(260);
    out.backdateUndoRestores = !document.getElementById('missedCard').hidden
      && document.getElementById('missedTitle').textContent === missedBefore;

    const content = document.querySelector('.content');
    out.noHorizontalOverflow = content.scrollWidth <= content.clientWidth;
    document.getElementById('savedIndicator').classList.remove('visible');
    return out;
  })()`);
}

async function notificationChecks(win) {
  return win.webContents.executeJavaScript(`(async function () {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const out = {};

    document.getElementById('snoozeBtn').click(); await wait(120);
    out.snoozeSheetOpens = !document.getElementById('snoozeSheet').hidden;
    document.getElementById('snoozeBtn').click(); await wait(120);
    out.snoozeSheetCloses = document.getElementById('snoozeSheet').hidden;

    document.getElementById('confirmBtn').click(); await wait(320);
    out.confirmShowsResult = !document.getElementById('resultView').hidden;

    document.getElementById('undoBtn').click(); await wait(320);
    out.undoRestoresIdle = !document.getElementById('idleView').hidden
      && document.getElementById('resultView').hidden;
    return out;
  })()`);
}

// Moves the evening window over the current time so the scheduler fires it for
// real. The displayed range is therefore live data, not the mock's 18:00—21:00.
function makeEveningDue(config) {
  const now = new Date();
  const start = Math.max(0, schedule.minutesOfDay(now) - 60);
  return config.set({
    windows: { evening: { enabled: true, start: schedule.formatTime(start), end: schedule.formatTime(start + 180) } }
  });
}

function run(ctx) {
  setTimeout(function () { capture(ctx); }, 900);
}

async function capture(ctx) {
  const config = require('../src/main/config');
  const dir = ctx.dir;
  const settings = ctx.settingsWindow();
  watchConsole(settings, 'settings');
  watchConsole(ctx.notificationWindow(), 'notification');

  try {
    fs.mkdirSync(dir, { recursive: true });

    await forceTheme(settings, 'light');
    await wait(200);
    await shoot(settings, path.join(dir, 'impl-settings-light.png'));

    await forceTheme(settings, 'dark');
    await wait(200);
    await shoot(settings, path.join(dir, 'impl-settings-dark.png'));
    await forceTheme(settings, 'light');
    await wait(150);

    const settingsResults = await settingsChecks(settings);
    await wait(150);
    await forceTheme(settings, 'light');

    // --- reminder, fired through the scheduler ---
    makeEveningDue(config);
    scheduler.reload();
    await wait(700);

    const notification = ctx.notificationWindow();
    const firedForReal = !!(notification && notification.isVisible());
    await forceTheme(notification, 'light');
    await wait(200);
    await shoot(notification, path.join(dir, 'impl-notification-light.png'));

    await forceTheme(notification, 'dark');
    await wait(200);
    await shoot(notification, path.join(dir, 'impl-notification-dark.png'));
    await forceTheme(notification, 'light');
    await wait(150);

    const notificationResults = await notificationChecks(notification);

    // --- compact window ---
    settings.setContentSize(400, 620);
    await wait(250);
    const compact = await settings.webContents.executeJavaScript(`(function () {
      const content = document.querySelector('.content');
      const footer = document.querySelector('.footer').getBoundingClientRect();
      return {
        scrolls: content.scrollHeight > content.clientHeight,
        horizontalOverflow: content.scrollWidth > content.clientWidth,
        footerVisible: footer.bottom <= window.innerHeight + 1
      };
    })()`);
    await shoot(settings, path.join(dir, 'impl-settings-compact.png'));

    fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify({
      firedThroughScheduler: firedForReal,
      settings: settingsResults,
      notification: notificationResults,
      compact: compact,
      consoleErrors: errors
    }, null, 2));

    console.log('CAPTURE_OK');
    setTimeout(function () { ctx.app.exit(0); }, 120);
  } catch (error) {
    console.error('CAPTURE_FAILED', error);
    ctx.app.exit(1);
  }
}

module.exports = { prepare: prepare, run: run };
