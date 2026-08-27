const { app, BrowserWindow, ipcMain, powerMonitor, screen } = require('electron');
const path = require('path');
const config = require('./config');
const i18n = require('./i18n');
const { createTray } = require('./tray');
const scheduler = require('./scheduler');
const history = require('./history');
const { setAutostart, getAutostart } = require('./autostart');

const isSmoke = process.argv.indexOf('--smoke') !== -1;
const isCapture = process.argv.indexOf('--capture-ui') !== -1;
function launchedAtLogin() {
  if (process.argv.indexOf('--autostart') !== -1) return true;
  try {
    return !!app.getLoginItemSettings().wasOpenedAtLogin;
  } catch (e) {
    return false;
  }
}
const captureArg = process.argv.find(function (arg) { return arg.indexOf('--capture-dir=') === 0; });
const captureDir = captureArg ? captureArg.slice('--capture-dir='.length) : null;

if (isCapture) {
  app.setPath('userData', path.join(app.getPath('temp'), 'inhaler-reminder-capture-' + process.pid));
}

let settingsWindow = null;
let notificationWindow = null;
let tray = null;
let quitting = false;
const captureConsoleErrors = [];

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', function () { showSettings(); });
  app.on('before-quit', function () { quitting = true; });
  app.on('window-all-closed', function () { /* keep running in tray */ });
  app.whenReady().then(onReady);
}

function onReady() {
  const cfg = isCapture ? config.set({ appearance: 'light' }) : config.get();
  if (isCapture) history.seedPreview(new Date());
  history.sync(cfg, new Date());
  setAutostart(!!cfg.autostart);
  tray = createTray({
    onOpen: showSettings,
    onQuit: quit,
    onMarkNow: markDoseNow,
    getStrings: function () { return i18n.strings(); },
    getStatus: trayDoseStatus
  });
  createSettingsWindow({ show: isCapture || isSmoke || !launchedAtLogin() });
  createNotificationWindow();
  scheduler.start({
    getConfig: function () { return config.get(); },
    isIdleSeconds: function () {
      try {
        if (typeof powerMonitor.getSystemIdleState === 'function' && powerMonitor.getSystemIdleState(1) === 'locked') {
          return 1000000;
        }
        return powerMonitor.getSystemIdleTime();
      } catch (e) { return 0; }
    },
    onReminder: function (windowKey) { showNotification(windowKey); },
    onPendingCleared: function () { hideNotification(); },
    onDayChange: function (_previousDay, _today, now) {
      history.sync(config.get(), now instanceof Date ? now : new Date());
      hideNotification();
      broadcastHistory();
    },
    getHistoryDay: history.getDay,
    recordConfirmed: function (day, dose, details) {
      history.confirm(day, dose, details);
      broadcastHistory();
    },
    recordMissed: function (day, dose) {
      history.miss(day, dose);
      broadcastHistory();
    },
    undoConfirmed: function (day, dose) {
      history.undoTodayConfirmation(day, dose);
      broadcastHistory();
    },
    onStateChanged: function () {
      if (tray && tray.refresh) tray.refresh();
    }
  });

  try {
    powerMonitor.on('resume', onWake);
    powerMonitor.on('unlock-screen', onWake);
  } catch (e) { /* power events are optional */ }

  if (isCapture && captureDir) {
    setTimeout(captureUi, 900);
  }

  if (isSmoke) {
    console.log('SMOKE_OK');
    setTimeout(function () { app.exit(0); }, 1200);
  }
}

function createSettingsWindow(opts) {
  if (settingsWindow) return;
  const showOnReady = !opts || opts.show !== false;
  const workArea = screen.getPrimaryDisplay().workArea;
  const maxHeight = Math.max(320, workArea.height - 48);
  const desiredHeight = Math.min(968, Math.max(520, workArea.height - 72));
  settingsWindow = new BrowserWindow({
    width: 420,
    height: Math.min(desiredHeight, maxHeight),
    minWidth: 400,
    minHeight: Math.min(400, maxHeight),
    useContentSize: true,
    title: 'Inhaler Reminder',
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#f2f2f0',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  settingsWindow.loadFile(path.join(__dirname, '..', 'renderer', 'settings', 'settings.html'));
  if (isCapture) settingsWindow.webContents.on('console-message', function (_event, level, message) { if (level >= 2) captureConsoleErrors.push('settings: ' + message); });
  settingsWindow.once('ready-to-show', function () {
    if (settingsWindow && showOnReady) settingsWindow.show();
  });
  settingsWindow.on('close', function (e) {
    if (!quitting) { e.preventDefault(); settingsWindow.hide(); }
  });
  settingsWindow.on('closed', function () { settingsWindow = null; });
}

function showSettings() {
  createSettingsWindow();
  if (settingsWindow) { settingsWindow.show(); settingsWindow.focus(); }
}

function createNotificationWindow() {
  if (notificationWindow) return;
  notificationWindow = new BrowserWindow({
    width: 400,
    height: 236,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  notificationWindow.setAlwaysOnTop(true, 'floating');
  notificationWindow.loadFile(path.join(__dirname, '..', 'renderer', 'notification', 'notification.html'));
  if (isCapture) notificationWindow.webContents.on('console-message', function (_event, level, message) { if (level >= 2) captureConsoleErrors.push('notification: ' + message); });
  notificationWindow.on('close', function (e) {
    if (!quitting) {
      e.preventDefault();
      scheduler.snooze();
      hideNotification();
      scheduler.tick();
    }
  });
  notificationWindow.on('closed', function () {
    notificationWindow = null;
    if (!quitting) {
      scheduler.dismiss();
      createNotificationWindow();
    }
  });
}

function showNotification(windowKey) {
  createNotificationWindow();
  if (!notificationWindow) return;
  const cfg = config.get();
  if (!cfg.windows[windowKey]) return;
  const point = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(point);
  const wa = display.workArea;
  const size = notificationWindow.getSize();
  const x = wa.x + wa.width - size[0] - 16;
  const y = wa.y + wa.height - size[1] - 16;
  notificationWindow.setPosition(x, y, false);
  const payload = {
    windowKey: windowKey,
    strings: i18n.strings(),
    soundEnabled: cfg.soundEnabled,
    snoozeMinutes: cfg.snoozeMinutes,
    start: cfg.windows[windowKey].start,
    end: cfg.windows[windowKey].end,
    windows: cfg.windows,
    todayStatus: history.getDay(history.localDayKey(new Date())),
    appearance: cfg.appearance,
    locale: cfg.locale
  };
  const send = function () { notificationWindow.webContents.send('notification:show', payload); };
  if (notificationWindow.webContents.isLoading()) {
    notificationWindow.webContents.once('did-finish-load', send);
  } else {
    send();
  }
  if (typeof notificationWindow.showInactive === 'function') {
    notificationWindow.showInactive();
  } else {
    notificationWindow.show();
  }
}

function hideNotification() {
  if (notificationWindow) notificationWindow.hide();
}

async function captureUi() {
  const fs = require('fs');
  try {
    fs.mkdirSync(captureDir, { recursive: true });
    showNotification('evening');
    await new Promise(function (resolve) { setTimeout(resolve, 650); });
    const settingsInteractions = await settingsWindow.webContents.executeJavaScript(`(async function () {
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      const summary = document.querySelector('.dose-summary');
      summary.click(); await wait(80);
      const editorOpened = !document.getElementById('morningEditor').hidden;
      summary.click();
      const plus = document.querySelector('[data-number-step="5"]');
      const minus = document.querySelector('[data-number-step="-5"]');
      const before = document.getElementById('snooze').value;
      plus.click(); await wait(80); minus.click(); await wait(80);
      const numberRoundTrip = document.getElementById('snooze').value === before;
      document.querySelector('[data-appearance="dark"]').click(); await wait(100);
      const darkApplied = document.documentElement.dataset.theme === 'dark';
      document.querySelector('[data-appearance="light"]').click(); await wait(100);
      const lightApplied = document.documentElement.dataset.theme === 'light';
      document.querySelector('[data-appearance="system"]').click(); await wait(100);
      document.documentElement.dataset.theme = 'light';
      const backdate = document.getElementById('backdateBtn');
      backdate.click(); await wait(120);
      document.getElementById('savedIndicator').classList.remove('visible');
      const backdated = document.getElementById('missedTitle').textContent.length > 0;
      const undoBackdate = document.getElementById('backdateUndoBtn');
      if (undoBackdate && !undoBackdate.hidden) undoBackdate.click();
      else backdate.click();
      await wait(120);
      return { editorOpened, numberRoundTrip, darkApplied, lightApplied, backdated };
    })()`);
    const notificationInteractions = await notificationWindow.webContents.executeJavaScript(`(async function () {
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      document.getElementById('snooze').click(); await wait(60);
      const snoozeOptionsOpened = !document.getElementById('snoozeSheet').hidden;
      document.getElementById('snooze').click();
      document.getElementById('confirm').click(); await wait(140);
      const confirmationShown = !document.getElementById('resultView').hidden;
      document.getElementById('undo').click(); await wait(140);
      const undoRestored = !document.getElementById('idleView').hidden;
      return { snoozeOptionsOpened, confirmationShown, undoRestored };
    })()`);
    const settingsImage = await settingsWindow.webContents.capturePage();
    const notificationImage = await notificationWindow.webContents.capturePage();
    fs.writeFileSync(path.join(captureDir, 'implementation-settings.png'), settingsImage.toPNG());
    fs.writeFileSync(path.join(captureDir, 'implementation-notification.png'), notificationImage.toPNG());
    settingsWindow.setContentSize(400, 680);
    await new Promise(function (resolve) { setTimeout(resolve, 120); });
    const compactLayout = await settingsWindow.webContents.executeJavaScript(`(function () {
      const content = document.querySelector('.content');
      const footer = document.querySelector('.footer').getBoundingClientRect();
      return {
        scrollable: content.scrollHeight > content.clientHeight,
        horizontalOverflow: content.scrollWidth > content.clientWidth,
        footerVisible: footer.top >= 0 && footer.bottom <= window.innerHeight,
        viewport: { width: window.innerWidth, height: window.innerHeight }
      };
    })()`);
    const compactImage = await settingsWindow.webContents.capturePage();
    fs.writeFileSync(path.join(captureDir, 'implementation-settings-compact.png'), compactImage.toPNG());
    fs.writeFileSync(path.join(captureDir, 'console-errors.json'), JSON.stringify(captureConsoleErrors, null, 2));
    fs.writeFileSync(path.join(captureDir, 'interaction-results.json'), JSON.stringify({ settings: settingsInteractions, notification: notificationInteractions, compact: compactLayout }, null, 2));
    console.log('CAPTURE_UI_OK');
    setTimeout(function () { app.exit(0); }, 100);
  } catch (error) {
    console.error('CAPTURE_UI_FAILED', error);
    app.exit(1);
  }
}

function historySummary() {
  return history.summary(config.get(), new Date(), 14);
}

function broadcastHistory() {
  const payload = historySummary();
  broadcast('history:changed', payload);
  if (tray && tray.refresh) tray.refresh();
  return payload;
}

function onWake() {
  history.sync(config.get(), new Date());
  scheduler.tick();
  broadcastHistory();
}

function trayDoseStatus() {
  const cfg = config.get();
  const strings = i18n.strings();
  const key = scheduler.currentDoseKey(new Date());
  if (!key || !cfg.windows[key]) return strings['tray.allDone'] || 'All doses marked';
  const win = cfg.windows[key];
  const doseName = strings['notif.' + key] || key;
  return doseName + ' · ' + win.start + ' — ' + win.end;
}

function markDoseNow() {
  scheduler.confirmNow();
  hideNotification();
  scheduler.tick();
  broadcastHistory();
}

function quit() {
  quitting = true;
  scheduler.stop();
  app.quit();
}

// ---- IPC ----
ipcMain.handle('config:get', function () { return config.get(); });
ipcMain.handle('config:set', function (_e, patch) {
  const cfg = config.set(patch || {});
  if (patch && typeof patch.autostart === 'boolean') setAutostart(cfg.autostart);
  history.sync(cfg, new Date());
  scheduler.tick();
  broadcast('config:changed', cfg);
  broadcastHistory();
  return cfg;
});
ipcMain.handle('i18n:strings', function () { return i18n.strings(); });
ipcMain.handle('i18n:setLocale', function (_e, locale) {
  const cfg = config.set({ locale: locale });
  if (tray && tray.refresh) tray.refresh();
  broadcast('config:changed', cfg);
  broadcastHistory();
  return cfg;
});
ipcMain.handle('autostart:get', function () { return getAutostart(); });
ipcMain.handle('autostart:set', function (_e, enabled) {
  const val = !!enabled;
  setAutostart(val);
  config.set({ autostart: val });
  return val;
});
ipcMain.handle('history:summary', function () { return historySummary(); });
ipcMain.handle('history:backdate', function (_e, payload) {
  const p = payload || {};
  const day = history.getDay(p.date);
  const result = day[p.dose] && day[p.dose].status === 'missed' ? history.confirm(p.date, p.dose, { backdated: true }) : null;
  return { ok: !!result, summary: broadcastHistory() };
});
ipcMain.handle('history:undo-backdate', function (_e, payload) {
  const p = payload || {};
  const result = history.undoBackdate(p.date, p.dose);
  return { ok: !!result, summary: broadcastHistory() };
});
ipcMain.on('window:hide', function () { if (settingsWindow) settingsWindow.hide(); });
ipcMain.on('app:quit', function () { quit(); });
ipcMain.handle('notification:confirm', function () { return scheduler.confirm(); });
ipcMain.handle('notification:undo-confirm', function (_e, dose) { return scheduler.undoConfirmation(dose); });
ipcMain.on('notification:hide', function () { hideNotification(); scheduler.tick(); });
ipcMain.on('notification:snooze', function (_e, minutes) { scheduler.snooze(minutes); });

function broadcast(channel, payload) {
  const wins = BrowserWindow.getAllWindows();
  for (let i = 0; i < wins.length; i++) {
    wins[i].webContents.send(channel, payload);
  }
}
