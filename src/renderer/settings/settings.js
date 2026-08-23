// Inhaler Reminder — settings page.
// Vanilla JS only. Talks to the main process exclusively through window.api.

var STR = {};

function t(k) {
  return STR[k] || k;
}

var config = null;
var savedTimer = null;

var savedIndicator = document.getElementById('savedIndicator');
var morningEnabled = document.getElementById('morningEnabled');
var morningStart = document.getElementById('morningStart');
var morningEnd = document.getElementById('morningEnd');
var eveningEnabled = document.getElementById('eveningEnabled');
var eveningStart = document.getElementById('eveningStart');
var eveningEnd = document.getElementById('eveningEnd');
var snooze = document.getElementById('snooze');
var grace = document.getElementById('grace');
var soundEnabled = document.getElementById('soundEnabled');
var language = document.getElementById('language');
var autostart = document.getElementById('autostart');
var quitBtn = document.getElementById('quitBtn');
var prefsTitle = document.getElementById('prefsTitle');

function currentLocale() {
  return (config && config.locale === 'en') ? 'en' : 'ru';
}

function showSaved() {
  if (!savedIndicator) return;
  savedIndicator.classList.add('visible');
  if (savedTimer) clearTimeout(savedTimer);
  savedTimer = setTimeout(function () {
    savedIndicator.classList.remove('visible');
  }, 1400);
}

function saveConfig(patch) {
  return window.api.setConfig(patch).then(function (cfg) {
    config = cfg;
    showSaved();
    return cfg;
  }).catch(function (err) {
    console.error('setConfig failed', err);
  });
}

function changeLocale(locale) {
  return window.api.setLocale(locale).then(function (cfg) {
    config = cfg;
    showSaved();
    return cfg;
  }).catch(function (err) {
    console.error('setLocale failed', err);
  });
}

function saveAutostart(enabled) {
  return window.api.setAutostart(enabled).then(function (val) {
    config = Object.assign({}, config, { autostart: val });
    if (autostart) autostart.checked = !!val;
    showSaved();
    return val;
  }).catch(function (err) {
    console.error('setAutostart failed', err);
  });
}

function setChecked(el, value) {
  if (!el) return;
  if (document.activeElement === el) return;
  var want = !!value;
  if (el.checked !== want) el.checked = want;
}

function setValue(el, value) {
  if (!el) return;
  if (document.activeElement === el) return;
  var s = String(value == null ? '' : value);
  if (el.value !== s) el.value = s;
}

function renderControls() {
  if (!config) return;
  var w = config.windows || {};
  var m = w.morning || {};
  var e = w.evening || {};
  setChecked(morningEnabled, m.enabled);
  setValue(morningStart, m.start);
  setValue(morningEnd, m.end);
  setChecked(eveningEnabled, e.enabled);
  setValue(eveningStart, e.start);
  setValue(eveningEnd, e.end);
  setValue(snooze, config.snoozeMinutes);
  setValue(grace, config.graceMinutes);
  setChecked(soundEnabled, config.soundEnabled);
  setValue(language, config.locale);
  setChecked(autostart, config.autostart);
}

function renderTexts() {
  document.title = t('settings.title');
  var els = document.querySelectorAll('[data-i18n]');
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    el.textContent = t(el.getAttribute('data-i18n'));
  }
  document.documentElement.lang = currentLocale();
}

function bindNumber(el, key, min, max) {
  el.addEventListener('input', function () {
    if (el.value === '') return;
    var v = parseInt(el.value, 10);
    if (!isFinite(v)) return;
    v = Math.min(max, Math.max(min, v));
    if (v !== config[key]) {
      var patch = {};
      patch[key] = v;
      saveConfig(patch);
    }
  });
  el.addEventListener('change', function () {
    var v = parseInt(el.value, 10);
    if (el.value === '' || !isFinite(v)) {
      el.value = String(config[key]);
      return;
    }
    v = Math.min(max, Math.max(min, v));
    el.value = String(v);
    if (v !== config[key]) {
      var patch = {};
      patch[key] = v;
      saveConfig(patch);
    }
  });
}

function bindEvents() {
  morningEnabled.addEventListener('change', function () {
    saveConfig({ windows: { morning: { enabled: morningEnabled.checked } } });
  });
  morningStart.addEventListener('change', function () {
    if (morningStart.value) saveConfig({ windows: { morning: { start: morningStart.value } } });
  });
  morningEnd.addEventListener('change', function () {
    if (morningEnd.value) saveConfig({ windows: { morning: { end: morningEnd.value } } });
  });

  eveningEnabled.addEventListener('change', function () {
    saveConfig({ windows: { evening: { enabled: eveningEnabled.checked } } });
  });
  eveningStart.addEventListener('change', function () {
    if (eveningStart.value) saveConfig({ windows: { evening: { start: eveningStart.value } } });
  });
  eveningEnd.addEventListener('change', function () {
    if (eveningEnd.value) saveConfig({ windows: { evening: { end: eveningEnd.value } } });
  });

  bindNumber(snooze, 'snoozeMinutes', 1, 180);
  bindNumber(grace, 'graceMinutes', 0, 360);

  soundEnabled.addEventListener('change', function () {
    saveConfig({ soundEnabled: soundEnabled.checked });
  });

  language.addEventListener('change', function () {
    var val = language.value;
    if (val === 'ru' || val === 'en') changeLocale(val);
  });

  autostart.addEventListener('change', function () {
    saveAutostart(autostart.checked);
  });

  quitBtn.addEventListener('click', function () {
    window.api.quit();
  });
}

function refreshStrings() {
  return window.api.getStrings().then(function (dict) {
    STR = dict || {};
    return STR;
  });
}

function handleConfigChanged(cfg) {
  var prevLocale = config ? config.locale : null;
  config = cfg;
  if (prevLocale !== cfg.locale) {
    refreshStrings().then(function () {
      renderTexts();
      renderControls();
    });
  } else {
    renderControls();
  }
}

async function init() {
  try {
    STR = await window.api.getStrings();
    config = await window.api.getConfig();
    window.api.onConfigChanged(handleConfigChanged);
    renderTexts();
    renderControls();
    bindEvents();
  } catch (err) {
    console.error('Failed to initialise settings page', err);
  }
}

init();
