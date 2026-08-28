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
  getInhaler: function () { return ipcRenderer.invoke('inhaler:get'); },
  replaceInhaler: function (total) { return ipcRenderer.invoke('inhaler:replace', total); },
  getHistorySummary: function () { return ipcRenderer.invoke('history:summary'); },
  backdateDose: function (date, id) { return ipcRenderer.invoke('history:backdate', { date: date, dose: id }); },
  undoBackdate: function (date, id) { return ipcRenderer.invoke('history:undo-backdate', { date: date, dose: id }); },
  hideToTray: function () { ipcRenderer.send('window:hide'); },
  quit: function () { ipcRenderer.send('app:quit'); },
  confirmInhalation: function () { return ipcRenderer.invoke('notification:confirm'); },
  undoInhalation: function (id) { return ipcRenderer.invoke('notification:undo-confirm', id); },
  hideNotification: function () { ipcRenderer.send('notification:hide'); },
  snooze: function (minutes) { ipcRenderer.send('notification:snooze', minutes); },
  onNotification: function (cb) { return on('notification:show', cb); },
  onConfigChanged: function (cb) { return on('config:changed', cb); },
  onHistoryChanged: function (cb) { return on('history:changed', cb); },
  onInhalerChanged: function (cb) { return on('inhaler:changed', cb); }
});
