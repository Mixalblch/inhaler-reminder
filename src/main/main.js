const { app, BrowserWindow, ipcMain, powerMonitor, screen } = require('electron');
const path = require('path');
const config = require('./config');
const i18n = require('./i18n');
const { createTray } = require('./tray');
const scheduler = require('./scheduler');
const { setAutostart, getAutostart } = require('./autostart');

const isSmoke = process.argv.indexOf('--smoke') !== -1;

let settingsWindow = null;
let notificationWindow = null;
let tray = null;
let quitting = false;

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
  const cfg = config.get();
  if (cfg.autostart) setAutostart(true);
  tray = createTray({ onOpen: showSettings, onQuit: quit, getStrings: function () { return i18n.strings(); } });
  createSettingsWindow();
  createNotificationWindow();
  scheduler.start({
    getConfig: function () { return config.get(); },
    isIdleSeconds: function () {
      try { return powerMonitor.getSystemIdleTime(); } catch (e) { return 0; }
    },
    onReminder: function (windowKey) { showNotification(windowKey); }
  });

  if (isSmoke) {
    console.log('SMOKE_OK');
    setTimeout(function () { app.exit(0); }, 1200);
  }
}

function createSettingsWindow() {
  if (settingsWindow) return;
  settingsWindow = new BrowserWindow({
    width: 480,
    height: 680,
    minWidth: 420,
    minHeight: 580,
    title: 'Inhaler Reminder',
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  settingsWindow.loadFile(path.join(__dirname, '..', 'renderer', 'settings', 'settings.html'));
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
    width: 380,
    height: 230,
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
    soundEnabled: config.get().soundEnabled
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
  broadcast('config:changed', cfg);
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
  const val = !!enabled;
  setAutostart(val);
  config.set({ autostart: val });
  return val;
});
ipcMain.on('window:hide', function () { if (settingsWindow) settingsWindow.hide(); });
ipcMain.on('app:quit', function () { quit(); });
ipcMain.on('notification:confirm', function () { scheduler.confirm(); hideNotification(); });
ipcMain.on('notification:snooze', function () { scheduler.snooze(); hideNotification(); });

function broadcast(channel, payload) {
  const wins = BrowserWindow.getAllWindows();
  for (let i = 0; i < wins.length; i++) {
    wins[i].webContents.send(channel, payload);
  }
}
