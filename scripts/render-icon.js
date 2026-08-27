const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(function () {
  const assets = path.join(__dirname, '..', 'assets');
  const source = path.join(assets, 'icon-source.svg');
  const window = new BrowserWindow({ width: 256, height: 256, useContentSize: true, frame: false, transparent: true, show: false });
  return window.loadFile(source).then(function () { return window.webContents.capturePage(); }).then(function (image) {
    if (image.isEmpty()) throw new Error('Could not render assets/icon-source.svg');
    fs.writeFileSync(path.join(assets, 'icon.png'), image.toPNG());
    fs.writeFileSync(path.join(assets, 'tray.png'), image.resize({ width: 32, height: 32, quality: 'best' }).toPNG());
    console.log('ICON_RENDER_OK');
    app.exit(0);
  });
}).catch(function (error) {
  console.error(error);
  app.exit(1);
});
