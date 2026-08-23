const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

function iconFile() {
  const trayPng = path.join(__dirname, '..', '..', 'assets', 'tray.png');
  if (fs.existsSync(trayPng)) return trayPng;
  const iconPng = path.join(__dirname, '..', '..', 'assets', 'icon.png');
  if (fs.existsSync(iconPng)) return iconPng;
  return null;
}

function buildImage() {
  const p = iconFile();
  if (!p) return null;
  const img = nativeImage.createFromPath(p);
  if (img.isEmpty()) return null;
  return img.resize({ width: 16, height: 16 });
}

function createTray(options) {
  const img = buildImage();
  if (!img) {
    console.warn('No tray icon found; tray disabled.');
    return { refresh: function () {} };
  }
  const tray = new Tray(img);
  const refresh = function () {
    const s = options.getStrings();
    tray.setToolTip(s['tray.tooltip'] || 'Inhaler Reminder');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: s['tray.open'], click: options.onOpen },
      { type: 'separator' },
      { label: s['tray.quit'], click: options.onQuit }
    ]));
  };
  tray.on('double-click', options.onOpen);
  refresh();
  return { refresh: refresh };
}

module.exports = { createTray };
