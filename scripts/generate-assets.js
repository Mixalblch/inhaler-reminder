const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const crcTable = (function () {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

function roundedRectSDF(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}

function circleSDF(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}

function coverage(d) {
  return clamp(0.5 - d, 0, 1);
}

function blend(buf, i, col, a) {
  const da = buf[i + 3] / 255;
  const oa = a + da * (1 - a);
  if (oa <= 0) return;
  for (let k = 0; k < 3; k++) {
    const sc = col[k];
    const dc = buf[i + k];
    const oc = (sc * a + dc * da * (1 - a)) / oa;
    buf[i + k] = Math.round(oc);
  }
  buf[i + 3] = Math.round(oa * 255);
}

function drawIcon(S) {
  const buf = Buffer.alloc(S * S * 4);
  const bgTop = [32, 201, 175];
  const bgBot = [8, 111, 144];
  const cx = S / 2;
  const bgR = S * 0.22;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const i = (y * S + x) * 4;
      const d0 = roundedRectSDF(px, py, cx, cx, S / 2, S / 2, bgR);
      const a0 = coverage(d0);
      const t = (x + y) / (2 * (S - 1));
      const r = Math.round(bgTop[0] + (bgBot[0] - bgTop[0]) * t);
      const g = Math.round(bgTop[1] + (bgBot[1] - bgTop[1]) * t);
      const b = Math.round(bgTop[2] + (bgBot[2] - bgTop[2]) * t);
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = Math.round(a0 * 255);
    }
  }

  const white = [255, 255, 255];
  const puff = [214, 244, 246];

  const rects = [
    [cx, S * 0.52, S * 0.14, S * 0.19, S * 0.055],
    [cx, S * 0.28, S * 0.16, S * 0.045, S * 0.022],
    [S * 0.47, S * 0.63, S * 0.21, S * 0.05, S * 0.025],
    [S * 0.25, S * 0.63, S * 0.04, S * 0.08, S * 0.02]
  ];
  for (let k = 0; k < rects.length; k++) {
    const r = rects[k];
    const hw = r[2], hh = r[3], rad = r[4];
    const minX = Math.max(0, Math.floor(r[0] - hw - 2));
    const maxX = Math.min(S - 1, Math.ceil(r[0] + hw + 2));
    const minY = Math.max(0, Math.floor(r[1] - hh - 2));
    const maxY = Math.min(S - 1, Math.ceil(r[1] + hh + 2));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d = roundedRectSDF(x + 0.5, y + 0.5, r[0], r[1], hw, hh, rad);
        const a = coverage(d);
        if (a > 0) blend(buf, (y * S + x) * 4, white, a);
      }
    }
  }

  const puffs = [
    [S * 0.17, S * 0.58, S * 0.040],
    [S * 0.13, S * 0.63, S * 0.048],
    [S * 0.17, S * 0.68, S * 0.040]
  ];
  for (let k = 0; k < puffs.length; k++) {
    const p = puffs[k];
    const minX = Math.max(0, Math.floor(p[0] - p[2] - 2));
    const maxX = Math.min(S - 1, Math.ceil(p[0] + p[2] + 2));
    const minY = Math.max(0, Math.floor(p[1] - p[2] - 2));
    const maxY = Math.min(S - 1, Math.ceil(p[1] + p[2] + 2));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d = circleSDF(x + 0.5, y + 0.5, p[0], p[1], p[2]);
        const a = coverage(d) * 0.9;
        if (a > 0) blend(buf, (y * S + x) * 4, puff, a);
      }
    }
  }

  return buf;
}

const assetsDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(assetsDir, { recursive: true });
fs.writeFileSync(path.join(assetsDir, 'icon.png'), encodePNG(256, 256, drawIcon(256)));
fs.writeFileSync(path.join(assetsDir, 'tray.png'), encodePNG(32, 32, drawIcon(32)));
console.log('Generated assets/icon.png (256) and assets/tray.png (32)');
