(function () {
  'use strict';
  var STR = {};
  var payload = null;
  var autoTimer = null;
  var hideTimer = null;
  var confirmedDose = null;
  var card = document.getElementById('card');
  var idleView = document.getElementById('idleView');
  var resultView = document.getElementById('resultView');
  var sheet = document.getElementById('snoozeSheet');
  var confirmBtn = document.getElementById('confirm');
  var snoozeBtn = document.getElementById('snooze');

  function t(key) { return STR[key] || key; }
  function text(id, value) { var node = document.getElementById(id); if (node) node.textContent = value; }
  function clearTimers() { clearTimeout(autoTimer); clearTimeout(hideTimer); }
  function applyTheme(appearance) {
    var dark = appearance === 'dark' || (appearance === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }
  function showIdle() { idleView.hidden = false; resultView.hidden = true; sheet.hidden = true; }
  function showResult(title, subtitle, undoVisible) {
    idleView.hidden = true; resultView.hidden = false; text('resultTitle', title); text('resultSubtitle', subtitle);
    document.getElementById('undo').hidden = !undoVisible;
  }
  function hideSoon(delay) {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { card.classList.add('is-leaving'); setTimeout(function () { window.api.hideNotification(); }, 180); }, delay);
  }
  function playChime() {
    try {
      var AudioContext = window.AudioContext || window.webkitAudioContext; if (!AudioContext) return;
      var context = new AudioContext(); var now = context.currentTime;
      [[659.25,0,.16,.12],[880,.15,.26,.1]].forEach(function (item) { var osc=context.createOscillator(); var gain=context.createGain(); osc.frequency.value=item[0]; gain.gain.setValueAtTime(.0001,now+item[1]); gain.gain.exponentialRampToValueAtTime(item[3],now+item[1]+.02); gain.gain.exponentialRampToValueAtTime(.0001,now+item[1]+item[2]); osc.connect(gain); gain.connect(context.destination); osc.start(now+item[1]); osc.stop(now+item[1]+item[2]+.05); });
      setTimeout(function () { context.close(); }, 900);
    } catch (error) { /* sound is optional */ }
  }
  function render(nextPayload) {
    payload = nextPayload; STR = payload.strings || {}; confirmedDose = null; document.documentElement.lang = payload.locale === 'en' ? 'en' : 'ru'; applyTheme(payload.appearance || 'system'); showIdle();
    var morning = payload.windowKey === 'morning';
    text('notif-chip', morning ? t('notif.morning') : t('notif.evening'));
    text('notif-window', payload.start + ' — ' + payload.end);
    text('notif-title', t('notif.title')); text('notif-body', t('notif.body'));
    text('confirm', t('notif.confirm')); text('snooze', t('notif.snooze')); text('undo', t('history.undo'));
    document.getElementById('doseDot').classList.toggle('morning', morning);
    sheet.querySelectorAll('[data-snooze]').forEach(function (button) {
      var minutes = Number(button.dataset.snooze);
      button.textContent = minutes === 60 ? t('notif.snoozeHour') : t('notif.snoozeMin').replace('{minutes}', String(minutes));
    });
  }
  function outstanding(dose) {
    var windows = payload.windows || {};
    var win = windows[dose];
    if (!win || win.enabled === false) return false;
    var entry = payload.todayStatus && payload.todayStatus[dose];
    var status = entry && entry.status ? entry.status : 'pending';
    return status === 'pending' || status === 'fired' || status === 'snoozed';
  }
  function nextReminderLine(confirmedDose) {
    var windows = payload.windows || {};
    if (confirmedDose === 'morning' && outstanding('evening')) {
      return t('notif.nextToday').replace('{time}', windows.evening.start);
    }
    if (outstanding('morning') && confirmedDose !== 'morning') {
      return t('notif.nextTomorrow').replace('{time}', windows.morning.start);
    }
    if (windows.morning && windows.morning.enabled !== false) {
      return t('notif.nextTomorrow').replace('{time}', windows.morning.start);
    }
    if (windows.evening && windows.evening.enabled !== false) {
      return t('notif.nextTomorrow').replace('{time}', windows.evening.start);
    }
    return t('today.complete');
  }
  function onNotification(nextPayload) {
    if (!nextPayload) return; clearTimers(); card.classList.remove('is-leaving','is-visible'); void card.offsetWidth; card.classList.add('is-visible'); render(nextPayload);
    if (payload.soundEnabled) playChime();
    autoTimer = setTimeout(function () { window.api.snooze(payload.snoozeMinutes); hideSoon(0); }, 5 * 60 * 1000);
  }
  confirmBtn.addEventListener('click', function () {
    clearTimers(); window.api.confirmInhalation().then(function (dose) {
      if (!dose) return;
      confirmedDose = dose;
      var time = new Date().toLocaleTimeString(document.documentElement.lang || 'ru', { hour:'2-digit', minute:'2-digit' });
      showResult(t('notif.doneAt').replace('{time}', time), nextReminderLine(dose), true);
      hideSoon(4500);
    });
  });
  snoozeBtn.addEventListener('click', function () { sheet.hidden = !sheet.hidden; });
  sheet.querySelectorAll('[data-snooze]').forEach(function (button) {
    button.addEventListener('click', function () { var minutes=Number(button.dataset.snooze); clearTimers(); window.api.snooze(minutes); showResult(t('notif.snoozedFor').replace('{minutes}', minutes), t('notif.windowWillClose'), false); hideSoon(900); });
  });
  document.getElementById('undo').addEventListener('click', function () {
    clearTimers(); window.api.undoInhalation(confirmedDose).then(function (ok) {
      if (!ok) return;
      confirmedDose = null;
      showIdle();
      autoTimer = setTimeout(function () { window.api.snooze(payload.snoozeMinutes); hideSoon(0); }, 5 * 60 * 1000);
    });
  });
  if (window.api && typeof window.api.onNotification === 'function') window.api.onNotification(onNotification);
})();
