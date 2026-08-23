const { contextBridge, ipcRenderer } = require('electron');

function on(channel, cb) {
  const handler = function (_event, payload) { cb(payload); };
  ipcRenderer.on(channel, handler);
  return function () { ipcRenderer.removeListener(channel, handler); };
}

contextBridge.exposeInMainWorld('api', {
  getConfig: function () { return ipcRenderer.invoke('config:get'); },
  setConfig: function (patch) { return ipcRenderer.invoke('config:set', patch); },
  getStrings: function () { return ipcRenderer.invoke('i18n:strings'); },
  setLocale: function (locale) { return ipcRenderer.invoke('i18n:setLocale', locale); },
  getAutostart: function () { return ipcRenderer.invoke('autostart:get'); },
  setAutostart: function (enabled) { return ipcRenderer.invoke('autostart:set', enabled); },
  hideToTray: function () { ipcRenderer.send('window:hide'); },
  quit: function () { ipcRenderer.send('app:quit'); },
  confirmInhalation: function () { ipcRenderer.send('notification:confirm'); },
  snooze: function () { ipcRenderer.send('notification:snooze'); },
  onNotification: function (cb) { return on('notification:show', cb); },
  onConfigChanged: function (cb) { return on('config:changed', cb); }
});
