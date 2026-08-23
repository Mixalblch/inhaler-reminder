const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const settingsHtml = read('src/renderer/settings/settings.html');
const settingsCss = read('src/renderer/settings/settings.css');
const notificationHtml = read('src/renderer/notification/notification.html');
const notificationCss = read('src/renderer/notification/notification.css');
const en = require(path.join(root, 'src', 'locales', 'en.js'));
const ru = require(path.join(root, 'src', 'locales', 'ru.js'));

const ids = [
  'savedIndicator', 'morningEnabled', 'morningStart', 'morningEnd',
  'eveningEnabled', 'eveningStart', 'eveningEnd', 'snooze', 'grace',
  'soundEnabled', 'language', 'autostart', 'quitBtn', 'prefsTitle'
];

for (const id of ids) {
  const matches = settingsHtml.match(new RegExp(`id=["']${id}["']`, 'g')) || [];
  assert.strictEqual(matches.length, 1, `settings must preserve exactly one #${id}`);
}

for (const id of ['card', 'notif-title', 'notif-chip', 'notif-body', 'confirm', 'snooze']) {
  const matches = notificationHtml.match(new RegExp(`id=["']${id}["']`, 'g')) || [];
  assert.strictEqual(matches.length, 1, `notification must preserve exactly one #${id}`);
}

assert.match(settingsHtml, /THESIS: Breath Console/);
assert.match(notificationHtml, /THESIS: Breath Console/);
assert.match(settingsHtml, /class="app-rail"/);
assert.match(notificationHtml, /class="notification-art"/);
assert.match(settingsHtml, /assets\/inhaler-illustration\.png/);
assert.match(notificationHtml, /assets\/inhaler-illustration\.png/);
assert.match(settingsHtml, /aria-labelledby="morningLabel"/);
assert.match(settingsHtml, /aria-labelledby="eveningLabel"/);
assert.match(settingsHtml, /aria-labelledby="soundLabel"/);
assert.match(settingsHtml, /for="language"/);
assert.match(settingsHtml, /aria-labelledby="autostartLabel"/);
assert.match(settingsHtml, /data-i18n="app\.name"/);
assert.match(settingsHtml, /data-i18n="settings\.localTray"/);
assert.match(settingsHtml, /aria-labelledby="railName"/);
assert.ok(en['settings.localTray'] && ru['settings.localTray'], 'rail metadata must be localized');
assert.ok(fs.existsSync(path.join(root, 'assets', 'inhaler-illustration.png')), 'shipping inhaler asset must exist');
assert.ok(fs.existsSync(path.join(root, 'assets', 'fonts', 'manrope-latin.woff2')), 'local Latin display font must exist');
assert.ok(fs.existsSync(path.join(root, 'assets', 'fonts', 'manrope-cyrillic.woff2')), 'local Cyrillic display font must exist');

for (const [name, css] of [['settings', settingsCss], ['notification', notificationCss]]) {
  assert.doesNotMatch(css, /backdrop-filter|radial-gradient|linear-gradient/, `${name} CSS must remove glass and decorative gradients`);
  assert.match(css, /:focus-visible/, `${name} CSS must preserve keyboard focus`);
  assert.match(css, /prefers-reduced-motion/, `${name} CSS must honor reduced motion`);
}

console.log('DESIGN_CHECK_OK');
