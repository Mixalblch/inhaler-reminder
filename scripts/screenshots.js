// Renders the README screenshots.
//
//   npm run screenshots
//
// Unlike the QA capture, this shows the schedule at its nominal 09:00—12:00 /
// 18:00—21:00 rather than whatever window happened to fire, so the images read
// as the product rather than as a test run.
//
// Development only: `scripts/` is not part of the packaged app.

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

// Must happen before anything reads a path: seeding a staged schedule and a
// fake history into the real profile would overwrite the user's own settings
// and adherence record.
app.setPath('userData', path.join(app.getPath('temp'), 'inhaler-screenshots-' + process.pid));

const config = require('../src/main/config');
const i18n = require('../src/main/i18n');
const { seed } = require('./qa-seed');

const OUT = path.join(__dirname, '..', 'docs', 'screenshots');

const BASE = {
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

// Registered before either window loads; the renderers talk only through these.
function serveIpc() {
  const { ipcMain } = require('electron');
  const history = require('../src/main/history');
  ipcMain.handle('config:get', function () { return config.get(); });
  ipcMain.handle('config:set', function (_e, patch) { return config.set(patch || {}); });
  ipcMain.handle('i18n:strings', function () { return i18n.strings(); });
  ipcMain.handle('history:summary', function () { return history.summary(config.get(), new Date(), 14); });
  ipcMain.handle('history:backdate', function () { return { ok: false, summary: null }; });
  ipcMain.handle('history:undo-backdate', function () { return { ok: false, summary: null }; });
  ipcMain.handle('autostart:get', function () { return false; });
  ipcMain.handle('autostart:set', function () { return false; });
  ipcMain.handle('i18n:setLocale', function (_e, locale) { return config.set({ locale: locale }); });
}

function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// The window has to be on screen: Chromium throttles rAF in a hidden window, so
// CSS transitions never advance and switches would be captured mid-animation,
// stuck on their pre-checked frame.
function makeWindow(width, height, background) {
  return new BrowserWindow({
    width: width,
    height: height,
    show: false,
    useContentSize: true,
    transparent: background === null,
    frame: background !== null,
    backgroundColor: background === null ? '#00000000' : background,
    webPreferences: {
      preload: path.join(__dirname, '..', 'src', 'main', 'preload.js'),
      contextIsolation: true,
      sandbox: true
    }
  });
}

async function theme(win, value) {
  await win.webContents.executeJavaScript(
    'document.documentElement.dataset.theme = ' + JSON.stringify(value) + '; true'
  );
  await wait(220);
}

async function shoot(win, name) {
  const image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, name + '.png'), image.toPNG());
  console.log('docs/screenshots/' + name + '.png');
}

function reminderPayload(locale, appearance) {
  return {
    windowKey: 'evening',
    strings: i18n.strings(),
    locale: locale,
    appearance: appearance,
    soundEnabled: false,
    snoozeMinutes: 15,
    start: '18:00',
    end: '21:00',
    nextReminder: { day: 'tomorrow', time: '09:00' }
  };
}

app.whenReady().then(async function () {
  fs.mkdirSync(OUT, { recursive: true });
  seed(app.getPath('userData'), new Date());
  serveIpc();

  const settings = makeWindow(420, 968, '#f2f2f0');
  const reminder = makeWindow(400, 236, null);
  settings.showInactive();
  reminder.showInactive();
  await reminder.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'notification', 'notification.html'));

  for (const locale of ['ru', 'en']) {
    config.set(Object.assign({ locale: locale }, BASE));

    await settings.loadFile(path.join(__dirname, '..', 'src', 'renderer', 'settings', 'settings.html'));
    await wait(800);
    await theme(settings, 'light');
    await shoot(settings, 'settings-' + locale + '-light');

    reminder.webContents.send('notification:show', reminderPayload(locale, 'light'));
    await wait(500);
    await theme(reminder, 'light');
    await shoot(reminder, 'reminder-' + locale + '-light');

    // One dark pair is enough to show the theme carries through.
    if (locale === 'ru') {
      await theme(settings, 'dark');
      await shoot(settings, 'settings-' + locale + '-dark');
      await theme(reminder, 'dark');
      await shoot(reminder, 'reminder-' + locale + '-dark');
    }
  }

  app.exit(0);
});
