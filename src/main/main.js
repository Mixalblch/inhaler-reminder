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
  if (cfg.autostart) setAutostart(true);
  tray = createTray({
    onOpen: showSettings,
    onQuit: quit,
    onMarkNow: markDoseNow,
    getStrings: function () { return i18n.strings(); },
    getStatus: trayDoseStatus
  });
  createSettingsWindow();
  createNotificationWindow();
  scheduler.start({
    getConfig: function () { return config.get(); },
    isIdleSeconds: function () {
      try { return powerMonitor.getSystemIdleTime(); } catch (e) { return 0; }
    },
    onReminder: function (windowKey) { showNotification(windowKey); },
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

  if (isCapture && captureDir) {
    setTimeout(captureUi, 900);
  }

  if (isSmoke) {
    console.log('SMOKE_OK');
    setTimeout(function () { app.exit(0); }, 1200);
  }
}

function createSettingsWindow() {
  if (settingsWindow) return;
  const workArea = screen.getPrimaryDisplay().workArea;
  const desiredHeight = Math.min(968, Math.max(680, workArea.height - 72));
  settingsWindow = new BrowserWindow({
    width: 420,
    height: desiredHeight,
    minWidth: 400,
    minHeight: 680,
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
  settingsWindow.once('ready-to-show', function () { if (settingsWindow) settingsWindow.show(); });
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
  notificationWindow.on('closed', function () { notificationWindow = null; });
}

function showNotification(windowKey) {
  createNotificationWindow();
  if (!notificationWindow) return;
  const wa = screen.getPrimaryDisplay().workArea;
  const size = notificationWindow.getSize();
  const x = wa.x + wa.width - size[0] - 16;
  const y = wa.y + wa.height - size[1] - 16;
  notificationWindow.setPosition(x, y, false);
  const payload = {
    windowKey: windowKey,
    strings: i18n.strings(),
    soundEnabled: config.get().soundEnabled,
    snoozeMinutes: config.get().snoozeMinutes,
    start: config.get().windows[windowKey].start,
    end: config.get().windows[windowKey].end,
    appearance: config.get().appearance,
    locale: config.get().locale
  };
  const send = function () { notificationWindow.webContents.send('notification:show', payload); };
  if (notificationWindow.webContents.isLoading()) {
    notificationWindow.webContents.once('did-finish-load', send);
  } else {
    send();
  }
  notificationWindow.show();
  notificationWindow.focus();
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
      backdate.click(); await wait(120);
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

function trayDoseStatus() {
  const cfg = config.get();
  const state = scheduler.getState();
  const strings = i18n.strings();
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  let selected = null;
  ['morning', 'evening'].forEach(function (dose) {
    const win = cfg.windows[dose];
    const current = state && state.windows && state.windows[dose];
    if (!win || !win.enabled || (current && current.status === 'confirmed')) return;
    const start = Number(win.start.slice(0, 2)) * 60 + Number(win.start.slice(3));
    if (!selected || (start <= nowMinutes && start >= selected.start) || (selected.start > nowMinutes && start < selected.start)) {
      selected = { dose: dose, start: start, win: win };
    }
  });
  if (!selected) return strings['tray.allDone'] || 'All doses marked';
  const doseName = strings['notif.' + selected.dose] || selected.dose;
  return doseName + ' · ' + selected.win.start + ' — ' + selected.win.end;
}

function markDoseNow() {
  scheduler.confirmNow();
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
ipcMain.on('notification:hide', function () { hideNotification(); });
ipcMain.on('notification:snooze', function (_e, minutes) { scheduler.snooze(minutes); });

function broadcast(channel, payload) {
  const wins = BrowserWindow.getAllWindows();
  for (let i = 0; i < wins.length; i++) {
    wins[i].webContents.send(channel, payload);
  }
}
