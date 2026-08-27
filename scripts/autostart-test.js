// Login-item arguments for dev and portable builds.
// Run: npm run test:autostart

const assert = require('assert');
const path = require('path');
const Module = require('module');

// Stub `electron` so the module can be exercised outside a running app.
const fakeApp = { isPackaged: false, getAppPath: function () { return 'C:\\dev\\inhaler'; } };
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request) {
  if (request === 'electron') return 'electron-stub';
  return originalResolve.apply(this, arguments);
};
require.cache['electron-stub'] = { id: 'electron-stub', filename: 'electron-stub', loaded: true, exports: { app: fakeApp } };

const autostart = require(path.join(__dirname, '..', 'src', 'main', 'autostart.js'));

// --- development: Electron needs the app path -------------------------------
let spec = autostart._launchSpec();
assert.deepStrictEqual(spec.args, ['"C:\\dev\\inhaler"', '--hidden'],
  'a dev launch passes the app path and starts hidden');

// --- packaged: the executable is the app ------------------------------------
fakeApp.isPackaged = true;
spec = autostart._launchSpec();
assert.deepStrictEqual(spec.args, ['--hidden'], 'a packaged launch only needs --hidden');
assert.strictEqual(spec.path, process.execPath);

// --- portable: point at the original .exe, not the temp unpack --------------
process.env.PORTABLE_EXECUTABLE_FILE = 'D:\\Apps\\InhalerReminder.exe';
spec = autostart._launchSpec();
assert.strictEqual(spec.path, 'D:\\Apps\\InhalerReminder.exe',
  'a portable build registers the launcher the user actually keeps');
delete process.env.PORTABLE_EXECUTABLE_FILE;

// Starting hidden is what keeps login from flashing the settings window.
assert.ok(autostart._launchSpec().args.indexOf('--hidden') !== -1);

Module._resolveFilename = originalResolve;
console.log('AUTOSTART_TEST_OK');
