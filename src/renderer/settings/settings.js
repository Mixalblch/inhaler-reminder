(function () {
  'use strict';

  var STR = {};
  var config = null;
  var historySummary = null;
  var savedTimer = null;
  var backdateUndoTarget = null;

  function t(key) { return STR[key] || key; }
  function el(id) { return document.getElementById(id); }
  var controls = {
    morningEnabled: el('morningEnabled'), morningStart: el('morningStart'), morningEnd: el('morningEnd'),
    eveningEnabled: el('eveningEnabled'), eveningStart: el('eveningStart'), eveningEnd: el('eveningEnd'),
    snooze: el('snooze'), grace: el('grace'), soundEnabled: el('soundEnabled'), language: el('language'),
    autostart: el('autostart'), quitBtn: el('quitBtn')
  };

  function currentLocale() { return config && config.locale === 'en' ? 'en' : 'ru'; }
  function showSaved() {
    var indicator = el('savedIndicator');
    indicator.classList.add('visible');
    clearTimeout(savedTimer);
    savedTimer = setTimeout(function () { indicator.classList.remove('visible'); }, 1400);
  }
  function applyTheme() {
    var appearance = config && config.appearance ? config.appearance : 'system';
    var dark = appearance === 'dark' || (appearance === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelectorAll('[data-appearance]').forEach(function (button) {
      button.setAttribute('aria-checked', String(button.dataset.appearance === appearance));
    });
  }
  function saveConfig(patch) {
    return window.api.setConfig(patch).then(function (cfg) {
      config = cfg; renderControls(); showSaved(); return cfg;
    }).catch(function (error) { console.error('setConfig failed', error); });
  }
  function setValue(control, value) { if (control && document.activeElement !== control) control.value = String(value == null ? '' : value); }
  function setChecked(control, value) { if (control && document.activeElement !== control) control.checked = !!value; }
  function renderControls() {
    if (!config) return;
    var morning = config.windows.morning;
    var evening = config.windows.evening;
    setChecked(controls.morningEnabled, morning.enabled); setValue(controls.morningStart, morning.start); setValue(controls.morningEnd, morning.end);
    setChecked(controls.eveningEnabled, evening.enabled); setValue(controls.eveningStart, evening.start); setValue(controls.eveningEnd, evening.end);
    setValue(controls.snooze, config.snoozeMinutes); setValue(controls.grace, config.graceMinutes);
    el('graceValue').textContent = formatDuration(config.graceMinutes);
    setChecked(controls.soundEnabled, config.soundEnabled); setChecked(controls.autostart, config.autostart); setValue(controls.language, config.locale);
    document.querySelectorAll('[data-locale]').forEach(function (button) { button.setAttribute('aria-checked', String(button.dataset.locale === config.locale)); });
    el('morningRange').textContent = morning.start + ' — ' + morning.end;
    el('eveningRange').textContent = evening.start + ' — ' + evening.end;
    applyTheme();
  }
  function renderTexts() {
    document.title = t('app.name');
    document.documentElement.lang = currentLocale();
    document.querySelectorAll('[data-i18n]').forEach(function (node) { node.textContent = t(node.dataset.i18n); });
  }
  function parseDay(dayKey) {
    var parts = dayKey.split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12);
  }
  function formatDuration(minutes) {
    var value = Number(minutes) || 0;
    if (value > 0 && value % 60 === 0) return (value / 60) + ' ' + t('units.hours');
    return value + ' ' + t('units.minutes');
  }
  function shortDate(dayKey) { return new Intl.DateTimeFormat(currentLocale(), { day: 'numeric', month: 'short' }).format(parseDay(dayKey)).replace('.', ''); }
  function longDate(dayKey) { return new Intl.DateTimeFormat(currentLocale(), { day: 'numeric', month: 'long' }).format(parseDay(dayKey)); }
  function statusClass(entry) { return entry && entry.status ? entry.status : (entry || 'unknown'); }
  function statusText(entry) {
    var status = statusClass(entry);
    if (status === 'confirmed') {
      if (entry.at) return t('history.confirmedAt').replace('{time}', new Date(entry.at).toLocaleTimeString(currentLocale(), { hour: '2-digit', minute: '2-digit' }));
      return t('history.confirmed');
    }
    if (status === 'missed') return t('history.missed');
    if (status === 'disabled') return t('history.disabled');
    return t('history.pending');
  }
  function renderHistoryRow(targetId, dose) {
    var target = el(targetId);
    target.textContent = '';
    historySummary.days.forEach(function (day) {
      var dot = document.createElement('span');
      dot.className = 'history-dot ' + day[dose];
      dot.title = shortDate(day.date) + ' · ' + t('history.' + day[dose]);
      dot.setAttribute('aria-label', dot.title);
      target.appendChild(dot);
    });
  }
  function renderToday() {
    if (!historySummary || !config) return;
    var morning = historySummary.todayStatus.morning || { status: config.windows.morning.enabled ? 'pending' : 'disabled' };
    var evening = historySummary.todayStatus.evening || { status: config.windows.evening.enabled ? 'pending' : 'disabled' };
    var ms = statusClass(morning); var es = statusClass(evening); var headline; var description;
    if (ms === 'confirmed' && es === 'confirmed') { headline = t('today.complete'); description = t('today.completeDescription'); }
    else if (ms === 'confirmed' && es === 'pending') { headline = t('today.eveningRemaining'); description = t('today.reminderWindow').replace('{start}', config.windows.evening.start).replace('{end}', config.windows.evening.end); }
    else if (ms === 'pending') { headline = t('today.morningRemaining'); description = t('today.reminderWindow').replace('{start}', config.windows.morning.start).replace('{end}', config.windows.morning.end); }
    else if (es === 'pending') { headline = t('today.eveningRemaining'); description = t('today.reminderWindow').replace('{start}', config.windows.evening.start).replace('{end}', config.windows.evening.end); }
    else { headline = t('today.review'); description = t('today.reviewDescription'); }
    el('todayHeadline').textContent = headline; el('todayDescription').textContent = description;
    el('morningTodayDot').className = ms; el('eveningTodayDot').className = es;
    el('morningStatus').textContent = statusText(morning); el('eveningStatus').textContent = statusText(evening);
    renderHistoryRow('morningHistory', 'morning'); renderHistoryRow('eveningHistory', 'evening');
    el('historyScore').textContent = historySummary.trackedCount ? (historySummary.confirmedCount + ' ' + t('history.of') + ' ' + historySummary.trackedCount) : t('history.noData');
    var days = historySummary.days;
    el('historyStartDate').textContent = shortDate(days[0].date); el('historyMiddleDate').textContent = parseDay(days[6].date).getDate(); el('historyEndDate').textContent = shortDate(days[days.length - 1].date);
    renderMissedCard();
  }
  function renderMissedCard() {
    var card = el('missedCard'); var target = backdateUndoTarget || historySummary.latestMissed;
    if (!target) { card.hidden = true; return; }
    card.hidden = false;
    if (backdateUndoTarget) {
      el('missedTitle').textContent = t('history.backdatedTitle'); el('missedDescription').textContent = t('history.backdatedDescription'); el('backdateBtn').textContent = t('history.undo');
    } else {
      el('missedTitle').textContent = t('settings.' + target.dose) + ', ' + longDate(target.date) + ' — ' + t('history.missed');
      el('missedDescription').textContent = t('history.missedDescription'); el('backdateBtn').textContent = t('history.mark');
    }
  }
  function toMinutes(value) { var parts = value.split(':'); return Number(parts[0]) * 60 + Number(parts[1]); }
  function fromMinutes(value) { var total = (value % 1440 + 1440) % 1440; return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0'); }
  function windowPatchFor(target, value) {
    var dose = target.indexOf('morning') === 0 ? 'morning' : 'evening'; var field = target.indexOf('Start') !== -1 ? 'start' : 'end'; var patch = { windows: {} };
    patch.windows[dose] = {}; patch.windows[dose][field] = value; return patch;
  }
  function bindEvents() {
    controls.morningEnabled.addEventListener('change', function () { saveConfig({ windows: { morning: { enabled: controls.morningEnabled.checked } } }); });
    controls.eveningEnabled.addEventListener('change', function () { saveConfig({ windows: { evening: { enabled: controls.eveningEnabled.checked } } }); });
    ['morningStart','morningEnd','eveningStart','eveningEnd'].forEach(function (id) { controls[id].addEventListener('change', function () { if (controls[id].value) saveConfig(windowPatchFor(id, controls[id].value)); }); });
    document.querySelectorAll('[data-time-step]').forEach(function (button) { button.addEventListener('click', function () { var target = controls[button.dataset.target]; var value = fromMinutes(toMinutes(target.value) + Number(button.dataset.timeStep)); target.value = value; saveConfig(windowPatchFor(button.dataset.target, value)); }); });
    document.querySelectorAll('.dose-summary').forEach(function (button) { button.addEventListener('click', function () { var editor = el(button.dataset.editor); var open = button.getAttribute('aria-expanded') === 'true'; button.setAttribute('aria-expanded', String(!open)); editor.hidden = open; }); });
    document.querySelectorAll('[data-number-step]').forEach(function (button) { button.addEventListener('click', function () { var target = controls[button.dataset.target]; var next = Math.min(Number(target.max), Math.max(Number(target.min), Number(target.value) + Number(button.dataset.numberStep))); target.value = String(next); var patch = {}; patch[button.dataset.target === 'snooze' ? 'snoozeMinutes' : 'graceMinutes'] = next; saveConfig(patch); }); });
    controls.snooze.addEventListener('change', function () { saveConfig({ snoozeMinutes: Number(controls.snooze.value) }); });
    controls.grace.addEventListener('change', function () { saveConfig({ graceMinutes: Number(controls.grace.value) }); });
    controls.soundEnabled.addEventListener('change', function () { saveConfig({ soundEnabled: controls.soundEnabled.checked }); });
    controls.autostart.addEventListener('change', function () { window.api.setAutostart(controls.autostart.checked).then(function (value) { config.autostart = value; showSaved(); }); });
    controls.language.addEventListener('change', function () { window.api.setLocale(controls.language.value).then(function (cfg) { config = cfg; return refreshStrings(); }).then(function () { renderTexts(); renderControls(); renderToday(); showSaved(); }); });
    document.querySelectorAll('[data-locale]').forEach(function (button) { button.addEventListener('click', function () { controls.language.value = button.dataset.locale; controls.language.dispatchEvent(new Event('change')); }); });
    controls.quitBtn.addEventListener('click', function () { window.api.quit(); });
    document.querySelectorAll('[data-appearance]').forEach(function (button) { button.addEventListener('click', function () { saveConfig({ appearance: button.dataset.appearance }); }); });
    el('backdateBtn').addEventListener('click', function () {
      var target = backdateUndoTarget || historySummary.latestMissed; if (!target) return;
      var action = backdateUndoTarget ? window.api.undoBackdate(target.date, target.dose) : window.api.backdateDose(target.date, target.dose);
      action.then(function (result) { if (!result || !result.ok) return; historySummary = result.summary; backdateUndoTarget = backdateUndoTarget ? null : target; renderToday(); });
    });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (config && config.appearance === 'system') applyTheme(); });
  }
  function refreshStrings() { return window.api.getStrings().then(function (dict) { STR = dict || {}; }); }
  function handleConfigChanged(cfg) {
    var localeChanged = config && config.locale !== cfg.locale; config = cfg;
    var work = localeChanged ? refreshStrings().then(renderTexts) : Promise.resolve(); work.then(function () { renderControls(); renderToday(); });
  }
  async function init() {
    try {
      STR = await window.api.getStrings(); config = await window.api.getConfig(); historySummary = await window.api.getHistorySummary();
      window.api.onConfigChanged(handleConfigChanged); window.api.onHistoryChanged(function (summary) { historySummary = summary; renderToday(); });
      renderTexts(); renderControls(); renderToday(); bindEvents();
    } catch (error) { console.error('Failed to initialise settings page', error); }
  }
  init();
})();
