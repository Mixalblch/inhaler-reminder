// Crash-safe JSON persistence shared by config and history.
//
// A plain writeFileSync can leave a truncated file if the process dies mid-write,
// which would silently reset the user's schedule or adherence record. Every write
// goes to a temp file, keeps the previous good copy as `.bak`, then renames into
// place — rename is atomic on NTFS and POSIX alike.

const fs = require('fs');
const path = require('path');

function readJson(target) {
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

function readJsonWithBackup(target) {
  try {
    return readJson(target);
  } catch (e) {
    try {
      return readJson(target + '.bak');
    } catch (backupError) {
      return null;
    }
  }
}

function writeJsonAtomic(target, value) {
  const temporary = target + '.tmp-' + process.pid;
  const backup = target + '.bak';
  fs.mkdirSync(path.dirname(target), { recursive: true });

  // Only demote the current file to backup once we know it parses; otherwise a
  // corrupt file would overwrite the last known-good copy.
  try {
    readJson(target);
    fs.copyFileSync(target, backup);
  } catch (e) { /* nothing worth preserving */ }

  try {
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(temporary, target);
  } finally {
    try {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    } catch (cleanupError) { /* best effort */ }
  }
  return value;
}

module.exports = { readJson, readJsonWithBackup, writeJsonAtomic };
