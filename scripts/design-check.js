// Static guards for the current design contract.
// Run: npm run design-check

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = function (p) { return fs.readFileSync(path.join(root, p), 'utf8'); };

const locales = ['ru', 'en', 'ja', 'zh'];
const dicts = {};
locales.forEach(function (l) { dicts[l] = require('../src/locales/' + l); });
const reference = Object.keys(dicts.ru).sort();
locales.forEach(function (l) {
  const keys = Object.keys(dicts[l]).sort();
  assert.deepStrictEqual(keys.filter(function (k) { return reference.indexOf(k) === -1; }), [], l + ' has extra keys');
  assert.deepStrictEqual(reference.filter(function (k) { return keys.indexOf(k) === -1; }), [], l + ' is missing keys');
  reference.forEach(function (k) {
    assert.ok(String(dicts[l][k]).trim(), 'empty ' + l + ' string: ' + k);
  });
});

['notif.unnamed', 'notif.lowBody', 'notif.dosesLeft', 'today.dosesRemaining'].forEach(function (k) {
  assert.ok(String(dicts.ru[k]).indexOf('{n}') !== -1, 'ru.' + k + ' must keep {n}');
});

['settings', 'notification'].forEach(function (dir) {
  ['html', 'css', 'js'].forEach(function (ext) {
    const f = 'src/renderer/' + dir + '/' + dir + '.' + ext;
    assert.ok(read(f).length > 200, f + ' is unexpectedly small');
  });
});

['settings', 'notification'].forEach(function (dir) {
  ['html', 'css', 'js'].forEach(function (ext) {
    const f = 'src/renderer/' + dir + '/' + dir + '.' + ext;
    const text = read(f);
    assert.ok(text.indexOf('http://') === -1, f + ' must not load over http');
    assert.ok(text.indexOf('https://') === -1, f + ' must not load over https');
    assert.ok(text.indexOf('fonts.googleapis') === -1, f + ' must not use a font CDN');
  });
});

['settings.css', 'notification.css'].forEach(function (f) {
  const dir = f.indexOf('settings') !== -1 ? 'settings' : 'notification';
  const css = read('src/renderer/' + dir + '/' + f);
  assert.ok(css.indexOf(':focus-visible') !== -1, f + ' keeps focus-visible');
  assert.ok(css.indexOf('prefers-reduced-motion') !== -1, f + ' honors reduced motion');
});

['settings.js', 'notification.js'].forEach(function (f) {
  const dir = f.indexOf('settings') !== -1 ? 'settings' : 'notification';
  const js = read('src/renderer/' + dir + '/' + f);
  assert.ok(js.indexOf(String.fromCharCode(96)) === -1, f + ' must not contain backticks');
  assert.ok(js.indexOf('$' + '{') === -1, f + ' must not contain interpolation');
});

const settingsHtml = read('src/renderer/settings/settings.html');
const notificationHtml = read('src/renderer/notification/notification.html');
assert.ok(settingsHtml.indexOf('counter') !== -1, 'settings.html must expose the dose counter');
assert.ok(settingsHtml.indexOf('addWindow') !== -1, 'settings.html must expose an add-window control');
assert.ok(notificationHtml.indexOf('confirm') !== -1, 'notification.html must have a confirm control');
assert.ok(notificationHtml.indexOf('snooze') !== -1, 'notification.html must have a snooze control');
assert.ok(notificationHtml.indexOf('ok') !== -1, 'notification.html must have the low-dose OK control');

['assets/icon.png', 'assets/tray.png', 'assets/icon-source.svg',
  'assets/fonts/manrope-latin.woff2', 'assets/fonts/manrope-cyrillic.woff2'].forEach(function (a) {
  assert.ok(fs.existsSync(path.join(root, a)), 'missing asset: ' + a);
});

console.log('DESIGN_CHECK_OK');
