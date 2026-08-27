// Static guards for the design-2a contract.
// Run: npm run design-check

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = function (p) { return fs.readFileSync(path.join(root, p), 'utf8'); };

const ru = require('../src/locales/ru');
const en = require('../src/locales/en');

const settingsHtml = read('src/renderer/settings/settings.html');
const settingsCss = read('src/renderer/settings/settings.css');
const notificationHtml = read('src/renderer/notification/notification.html');
const notificationCss = read('src/renderer/notification/notification.css');

// --- both locales carry the same keys ----------------------------------------
const ruKeys = Object.keys(ru).sort();
const enKeys = Object.keys(en).sort();
const missingInEn = ruKeys.filter(function (k) { return enKeys.indexOf(k) === -1; });
const missingInRu = enKeys.filter(function (k) { return ruKeys.indexOf(k) === -1; });
assert.deepStrictEqual(missingInEn, [], 'keys missing from en.js');
assert.deepStrictEqual(missingInRu, [], 'keys missing from ru.js');
ruKeys.forEach(function (key) {
  assert.ok(String(ru[key]).trim(), 'empty Russian string: ' + key);
  assert.ok(String(en[key]).trim(), 'empty English string: ' + key);
});

// --- schedule captions and dot tooltips keep their own casing ------------------
// One shared string cannot serve both "Ожидает" (row caption) and "ожидает"
// (inside "14 авг · ожидает").
['confirmed', 'pending', 'missed', 'disabled'].forEach(function (state) {
  assert.ok(ru['status.' + state], 'missing status.' + state);
  assert.ok(ru['dot.' + state], 'missing dot.' + state);
});
assert.notStrictEqual(ru['status.pending'], ru['dot.pending'], 'caption and tooltip casing must differ');

// --- nothing user-visible is frozen in one language ---------------------------
const CYRILLIC = /[Ѐ-ӿ]/;
[['settings.html', settingsHtml], ['notification.html', notificationHtml]].forEach(function (pair) {
  const name = pair[0];
  const html = pair[1];
  (html.match(/aria-label="[^"]*"/g) || []).forEach(function (attr) {
    assert.ok(!CYRILLIC.test(attr), name + ' has a hardcoded Russian aria-label: ' + attr);
  });
  (html.match(/title="[^"]*"/g) || []).forEach(function (attr) {
    assert.ok(!CYRILLIC.test(attr), name + ' has a hardcoded Russian title: ' + attr);
  });
});

// Fallback text inside a [data-i18n] element is replaced at runtime; text that
// is not marked for translation is not.
const withoutI18nElements = settingsHtml.replace(/<([a-z0-9]+)[^>]*data-i18n="[^"]*"[^>]*>[^<]*<\/\1>/gi, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<title>[\s\S]*?<\/title>/gi, '');
assert.ok(!CYRILLIC.test(withoutI18nElements), 'settings.html has untranslated Russian text');
assert.ok(!CYRILLIC.test(notificationHtml.replace(/<!--[\s\S]*?-->/g, '')),
  'notification.html must render every string from the locale');

// --- every colour goes through a token ----------------------------------------
// Regression: hardcoded light values outside the token blocks used to leave the
// dark theme with glaring white switches and history dots.
function assertTokenised(name, css) {
  const withoutTokenBlocks = css
    .replace(/:root\s*\{[\s\S]*?\}/g, '')
    .replace(/html\[data-theme="dark"\]\s*\{[\s\S]*?\}/g, '');
  const literals = withoutTokenBlocks.match(/#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)/g) || [];
  const offenders = literals.filter(function (value) {
    // Shadows and overlays are allowed to state their own translucent black.
    return !/^rgba?\(\s*(0|28|255)\s*,/.test(value);
  });
  assert.deepStrictEqual(offenders, [], name + ' has colours outside the theme tokens: ' + offenders.join(', '));
}
assertTokenised('settings.css', settingsCss);
assertTokenised('notification.css', notificationCss);

// --- both themes define the same tokens ----------------------------------------
function tokensOf(css, selector) {
  const block = new RegExp(selector + '\\s*\\{([\\s\\S]*?)\\}').exec(css);
  return block ? (block[1].match(/--[\w-]+(?=\s*:)/g) || []) : [];
}
[['settings.css', settingsCss], ['notification.css', notificationCss]].forEach(function (pair) {
  const dark = tokensOf(pair[1], 'html\\[data-theme="dark"\\]');
  const light = tokensOf(pair[1], ':root');
  dark.forEach(function (token) {
    assert.ok(light.indexOf(token) !== -1, pair[0] + ': ' + token + ' is only defined for dark');
  });
});

// --- design-2a geometry that must not drift -------------------------------------
const GEOMETRY = [
  [settingsCss, /grid-template-rows:\s*52px minmax\(0, 1fr\) 48px/, '52 / flex / 48 shell'],
  [settingsCss, /\.switch\s*\{[^}]*width:\s*44px[^}]*height:\s*26px/, '44 x 26 switch'],
  [settingsCss, /\.day-track\s*\{[^}]*height:\s*8px/, '8px day track'],
  [settingsCss, /font-size:\s*14\.5px/, '14.5px dose title'],
  [settingsCss, /\.segmented button\s*\{[^}]*font-size:\s*12\.5px/, '12.5px segmented'],
  [notificationCss, /border-radius:\s*20px/, '20px reminder shell'],
  [notificationCss, /\.primary\s*\{[^}]*font-size:\s*14\.5px/, '14.5px primary action']
];
GEOMETRY.forEach(function (item) {
  assert.ok(item[1].test(item[0]), 'design geometry drifted: ' + item[2]);
});

// The confirmation tick is drawn, not typed — a glyph renders differently per font.
assert.ok(/stroke-dasharray:\s*30/.test(notificationCss), 'the confirmation tick must draw itself in');
assert.ok(/<path d="M20 6 9 17l-5-5"/.test(notificationHtml), 'the tick must be vector artwork');
assert.ok(/<svg class="chevron"/.test(settingsHtml), 'the chevron must be vector artwork');

// The long "1 час" form belongs to the reminder's snooze buttons. In a stepper
// the design reads "1 ч", so the settings surface must not reach for it.
const settingsJs = read('src/renderer/settings/settings.js');
assert.ok(!/units\.oneHour/.test(settingsJs),
  'settings must format an hour as "1 ч", not the reminder\'s "1 час"');
assert.ok(/units\.oneHour/.test(read('src/renderer/notification/notification.js')),
  'the reminder still needs the long hour form for its snooze buttons');

// The snooze choices sit in the flow above the actions, not in a floating panel.
assert.ok(!/\.snooze-sheet\s*\{[^}]*position:\s*absolute/.test(notificationCss),
  'the snooze sheet must expand inline');

// --- shipping assets ---------------------------------------------------------------
['assets/icon.png', 'assets/tray.png', 'assets/icon-source.svg',
  'assets/fonts/manrope-latin.woff2', 'assets/fonts/manrope-cyrillic.woff2'].forEach(function (asset) {
  assert.ok(fs.existsSync(path.join(root, asset)), 'missing asset: ' + asset);
});

console.log('DESIGN_CHECK_OK');
