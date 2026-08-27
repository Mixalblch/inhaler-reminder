const { app, BrowserWindow, ipcMain, powerMonitor, screen, nativeTheme } = require('electron');
const path = require('path');
const config = require('./config');
const i18n = require('./i18n');
const schedule = require('./schedule');
const history = require('./history');
const scheduler = require('./scheduler');
const { createTray } = require('./tray');
const { setAutostart, getAutostart } = require('./autostart');

const isSmoke = process.argv.indexOf('--smoke') !== -1;
const startHidden = process.argv.indexOf('--hidden') !== -1;
const captureArg = process.argv.find(function (a) { return a.indexOf('--capture-dir=') === 0; });
const captureDir = captureArg ? captureArg.slice('--capture-dir='.length) : null;

const SETTINGS_WIDTH = 420;
const SETTINGS_HEIGHT = 968;
const NOTIFICATION_WIDTH = 400;
const NOTIFICATION_HEIGHT = 236;

let settingsWindow = null;
let notificationWindow = null;
let tray = null;
let quitting = false;

// Design-QA runs get their own profile so a capture never touches real data.
if (captureDir) {
  app.setPath('userData', path.join(app.getPath('temp'), 'inhaler-qa-' + process.pid));
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  // A second launch hands over to the running copy. Say so under --smoke:
  // otherwise the check exits 0 without having started anything.
  if (isSmoke) console.log('SMOKE_SKIPPED another instance is already running');
  app.quit();
} else {
  app.on('second-instance', function () { showSettings(); });
  app.on('before-quit', function () { quitting = true; });
  app.on('window-all-closed', function () { /* keep running in tray */ });
  // Without this a failure in onReady is swallowed as an unhandled rejection:
  // the process lingers with no tray, no window, and no message.
  app.whenReady().then(onReady).catch(function (error) {
    console.error('Failed to start:', error);
    app.exit(1);
  });
}

function onReady() {
  if (captureDir) require('../../scripts/qa-capture').prepare({ config: config, app: app });
  const cfg = config.get();
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
      // A QA capture runs unattended, so the "is the user here?" input is
      // stubbed. The scheduling logic itself is exercised unchanged.
      if (captureDir) return 0;
      try { return powerMonitor.getSystemIdleTime(); } catch (e) { return 0; }
    },
    getHistoryDay: history.getDay,
    onReminder: showNotification,
    recordConfirmed: function (day, dose, details) {
      history.confirm(day, dose, details);
      broadcastHistory();
    },
    recordMissed: function (day, dose) {
      history.miss(day, dose);
      broadcastHistory();
    },
    recordSnoozed: history.setSnooze,
    clearSnooze: history.clearSnooze,
    undoConfirmed: function (day, dose) {
      history.undoTodayConfirmation(day, dose);
      broadcastHistory();
    },
    onDayChanged: function () {
      // Open today's entries for the new day and push the fresh record to the
      // settings window, which would otherwise keep rendering yesterday.
      history.sync(config.get(), new Date());
      broadcastHistory();
    },
    onStateChanged: function () {
      if (tray && tray.refresh) tray.refresh();
    }
  });

  // "System" appearance has to follow the OS while the app is running.
  nativeTheme.on('updated', function () {
    if (config.get().appearance === 'system') broadcast('config:changed', config.get());
  });

  if (captureDir) {
    require('../../scripts/qa-capture').run({
      dir: captureDir,
      app: app,
      settingsWindow: function () { return settingsWindow; },
      notificationWindow: function () { return notificationWindow; }
    });
  }

  if (isSmoke) {
    console.log('SMOKE_OK');
    setTimeout(function () { app.exit(0); }, 1200);
  }
}

// ---- windows ----

function createSettingsWindow() {
  if (settingsWindow) return;
  const workArea = screen.getPrimaryDisplay().workArea;
  settingsWindow = new BrowserWindow({
    width: SETTINGS_WIDTH,
    height: Math.min(SETTINGS_HEIGHT, Math.max(600, workArea.height - 72)),
    minWidth: 380,
    minHeight: 480,
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
  settingsWindow.once('ready-to-show', function () {
    if (settingsWindow && !startHidden) settingsWindow.show();
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
    width: NOTIFICATION_WIDTH,
    height: NOTIFICATION_HEIGHT,
    useContentSize: true,
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
  notificationWindow.on('closed', function () {
    notificationWindow = null;
    // Closing the reminder is a deferral, not a silent dismissal.
    if (!quitting) scheduler.dismiss();
  });
}

// Which reminder follows this one — used for "next reminder" in the confirmation.
function nextReminderAfter(dose, cfg) {
  const order = schedule.orderedDoses(cfg);
  if (!order.length) return null;
  const index = order.findIndex(function (item) { return item.dose === dose; });
  if (index === -1) return { day: 'tomorrow', time: order[0].start };
  if (index + 1 < order.length) return { day: 'today', time: order[index + 1].start };
  return { day: 'tomorrow', time: order[0].start };
}

function showNotification(dose) {
  createNotificationWindow();
  if (!notificationWindow) return;

  const wa = screen.getPrimaryDisplay().workArea;
  const size = notificationWindow.getSize();
  notificationWindow.setPosition(
    wa.x + wa.width - size[0] - 16,
    wa.y + wa.height - size[1] - 16,
    false
  );

  const cfg = config.get();
  const win = cfg.windows[dose];
  const payload = {
    windowKey: dose,
    strings: i18n.strings(),
    locale: cfg.locale,
    appearance: cfg.appearance,
    soundEnabled: cfg.soundEnabled,
    snoozeMinutes: cfg.snoozeMinutes,
    start: win.start,
    end: win.end,
    nextReminder: nextReminderAfter(dose, cfg)
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

// ---- shared state ----

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
  const strings = i18n.strings();
  const dose = scheduler.currentDoseKey(new Date());
  if (!dose || !cfg.windows[dose]) return null;
  const name = strings['notif.' + dose] || dose;
  return name + ' · ' + cfg.windows[dose].start + ' — ' + cfg.windows[dose].end;
}

function markDoseNow() {
  const dose = scheduler.confirmNow();
  // The reminder must not linger once its dose has been marked elsewhere.
  if (dose) hideNotification();
  broadcastHistory();
}

function quit() {
  quitting = true;
  scheduler.stop();
  if (tray && tray.destroy) tray.destroy();
  app.quit();
}

function broadcast(channel, payload) {
  BrowserWindow.getAllWindows().forEach(function (win) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  });
}

// ---- IPC ----

ipcMain.handle('config:get', function () { return config.get(); });

ipcMain.handle('config:set', function (_e, patch) {
  const cfg = config.set(patch || {});
  if (patch && typeof patch.autostart === 'boolean') setAutostart(cfg.autostart);

  const scheduleChanged = !!(patch && (patch.windows ||
    Object.prototype.hasOwnProperty.call(patch, 'graceMinutes')));

  if (scheduleChanged) {
    hideNotification();
    // Widening a window can make a dose reachable again before the scheduler
    // rebuilds its view from history, so reconcile first.
    history.reconcileScheduleChange(cfg, new Date());
  }
  history.sync(cfg, new Date());
  if (scheduleChanged) scheduler.reload();

  broadcast('config:changed', cfg);
  broadcastHistory();
  return cfg;
});

ipcMain.handle('i18n:strings', function () { return i18n.strings(); });

ipcMain.handle('i18n:setLocale', function (_e, locale) {
  const cfg = config.set({ locale: locale });
  if (tray && tray.refresh) tray.refresh();
  broadcast('config:changed', cfg);
  return cfg;
});

ipcMain.handle('autostart:get', function () { return getAutostart(); });

ipcMain.handle('autostart:set', function (_e, enabled) {
  const value = !!enabled;
  setAutostart(value);
  const cfg = config.set({ autostart: value });
  broadcast('config:changed', cfg);
  return cfg.autostart;
});

ipcMain.handle('history:summary', function () { return historySummary(); });

ipcMain.handle('history:backdate', function (_e, payload) {
  const p = payload || {};
  const day = history.getDay(p.date);
  const entry = day[p.dose];
  const result = entry && entry.status === 'missed'
    ? history.confirm(p.date, p.dose, { backdated: true })
    : null;
  return { ok: !!result, summary: broadcastHistory() };
});

ipcMain.handle('history:undo-backdate', function (_e, payload) {
  const p = payload || {};
  const result = history.undoBackdate(p.date, p.dose);
  return { ok: !!result, summary: broadcastHistory() };
});

ipcMain.handle('notification:confirm', function () { return scheduler.confirm(); });
ipcMain.handle('notification:undo-confirm', function (_e, dose) { return scheduler.undoConfirmation(dose); });
ipcMain.handle('notification:snooze', function (_e, minutes) { return scheduler.snooze(minutes); });

ipcMain.on('notification:hide', function () { hideNotification(); });
ipcMain.on('window:hide', function () { if (settingsWindow) settingsWindow.hide(); });
ipcMain.on('app:quit', function () { quit(); });
