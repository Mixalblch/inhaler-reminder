const fs = require('fs');

function atomicWrite(file, data) {
  const tmp = file + '.tmp';
  fs.mkdirSync(require('path').dirname(file), { recursive: true });
  fs.writeFileSync(tmp, data, 'utf8');
  try {
    fs.renameSync(tmp, file);
  } catch (e) {
    fs.copyFileSync(tmp, file);
    try { fs.unlinkSync(tmp); } catch (e2) { /* tmp leftover is harmless */ }
  }
}

module.exports = { atomicWrite };
