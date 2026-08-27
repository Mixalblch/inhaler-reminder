// Renders the shipping rasters from the design-2a icon.
//
//   npm run render-icon
//
// Uses Electron's renderer so the SVG is rasterized by the same engine that
// draws the app — no image dependency, deterministic output.
//
// Development only: `scripts/` is not part of the packaged app.

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const assets = path.join(__dirname, '..', 'assets');

function tile(inner, radius) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
    <defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#17b7a4"/><stop offset="1" stop-color="#0d8578"/>
    </linearGradient></defs>
    <rect x="0" y="0" width="120" height="120" rx="${radius}" fill="url(#t)"/>
    ${inner}
  </svg>`;
}

const BODY = `
  <g transform="rotate(-6 58 42)">
    <rect x="34" y="5" width="30" height="12" rx="4" fill="#c9ced1"/>
    <rect x="30" y="21" width="38" height="47" rx="10" fill="#f8f4ec"/>
    <rect x="69" y="46" width="17" height="18" rx="5" fill="#ee7a56"/>
    __LABEL__
  </g>
  __DOTS__`;

const LABEL = '<rect x="37" y="30" width="24" height="28" rx="7" fill="none" stroke="#b3ac9e" stroke-width="2.6" opacity=".4"/>';
const DOTS = '<circle cx="92" cy="49" r="3.8" fill="#ffffff"/><circle cx="98" cy="58" r="2.4" fill="#ffffff" opacity=".7"/>';

// The label outline is the first detail to go; the cap and mouthpiece are the
// silhouette and stay at every size.
function artwork(size) {
  return '<g transform="translate(-1.2 12) scale(1.02)">' +
    BODY.replace('__LABEL__', size >= 128 ? LABEL : '')
        .replace('__DOTS__', size >= 24 ? DOTS : '') +
    '</g>';
}

const TARGETS = [
  { file: 'icon.png', size: 256, radius: 27 },
  { file: 'tray.png', size: 32, radius: 22 }
];

app.whenReady().then(async function () {
  const win = new BrowserWindow({ width: 300, height: 300, show: false, webPreferences: { offscreen: true } });

  for (const target of TARGETS) {
    const svg = tile(artwork(target.size), target.radius);
    const page = `<!doctype html><meta charset="utf-8">
      <style>html,body{margin:0;background:transparent}
      svg{display:block;width:${target.size}px;height:${target.size}px}</style>${svg}`;
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(page));
    await new Promise(function (r) { setTimeout(r, 220); });
    const image = await win.webContents.capturePage({ x: 0, y: 0, width: target.size, height: target.size });
    fs.writeFileSync(path.join(assets, target.file), image.toPNG());
    console.log('wrote assets/' + target.file + ' (' + target.size + 'px)');
  }

  app.exit(0);
});
