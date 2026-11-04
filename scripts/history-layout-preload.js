const { contextBridge, ipcRenderer } = require('electron');
const api = {};
['getStrings','getConfig','getHistorySummary','getInhaler','setConfig','setLocale','backdateDose','undoBackdate'].forEach(name => {
  api[name] = (...args) => ipcRenderer.invoke('layout-fixture', name, args);
});
['onConfigChanged','onHistoryChanged','onInhalerChanged','quit'].forEach(name => { api[name] = () => {}; });
contextBridge.exposeInMainWorld('api', api);
