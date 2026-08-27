// Inhaler Reminder — always-on-top reminder window.
// Vanilla JS only. Talks to the main process exclusively through window.api.

(function () {
  'use strict';

  var AUTO_SNOOZE_MS = 5 * 60 * 1000;   // untouched reminders defer themselves
  var RESULT_MS = 4500;                 // how long the confirmation stays up
  var LEAVE_MS = 200;

  var STR = {};
  var payload = null;
  var confirmedDose = null;
  var autoTimer = null;
  var hideTimer = null;
  var leaveTimer = null;

  var card = document.getElementById('card');
  var idleView = document.getElementById('idleView');
  var resultView = document.getElementById('resultView');
  var sheet = document.getElementById('snoozeSheet');
  var snoozeBtn = document.getElementById('snoozeBtn');

  function t(key) { return STR[key] || key; }
  function text(id, value) { document.getElementById(id).textContent = value; }
  function fill(template, values) {
    return String(template).replace(/\{(\w+)\}/g, function (match, name) {
      return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : match;
    });
  }

  function clearTimers() {
    clearTimeout(autoTimer);
    clearTimeout(hideTimer);
    clearTimeout(leaveTimer);
  }

  function formatDuration(minutes) {
    var value = Math.max(0, Number(minutes) || 0);
    if (value < 60) return value + ' ' + t('units.minutes');
    var hours = Math.floor(value / 60);
    var rest = value % 60;
    if (rest === 0) return hours + ' ' + t('units.hours');
    return hours + ' ' + t('units.hours') + ' ' + rest + ' ' + t('units.minutes');
  }

  // The snooze buttons carry the long form ("1 час"); a stepper readout would
  // be too cramped for it, so it is not used by formatDuration.
  function snoozeChoiceLabel(minutes) {
    return minutes === 60 ? t('units.oneHour') : formatDuration(minutes);
  }

  function applyTheme(appearance) {
    var dark = appearance === 'dark' ||
      (appearance === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }

  function closeSheet() {
    sheet.hidden = true;
    snoozeBtn.setAttribute('aria-expanded', 'false');
  }

  function showIdle() {
    idleView.hidden = false;
    idleView.classList.remove('snoozed');
    resultView.hidden = true;
    closeSheet();
  }

  function showResult(title, subtitle, undoVisible) {
    idleView.hidden = true;
    resultView.hidden = false;
    text('resultTitle', title);
    text('resultSubtitle', subtitle);
    document.getElementById('undoBtn').hidden = !undoVisible;
  }

  function hideSoon(delay) {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      card.classList.add('is-leaving');
      leaveTimer = setTimeout(function () { window.api.hideNotification(); }, LEAVE_MS);
    }, delay);
  }

  function playChime() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var context = new Ctx();
      var now = context.currentTime;
      [[659.25, 0, .16, .12], [880, .15, .26, .1]].forEach(function (item) {
        var osc = context.createOscillator();
        var gain = context.createGain();
        osc.type = 'sine';
        osc.frequency.value = item[0];
        gain.gain.setValueAtTime(.0001, now + item[1]);
        gain.gain.exponentialRampToValueAtTime(item[3], now + item[1] + .02);
        gain.gain.exponentialRampToValueAtTime(.0001, now + item[1] + item[2]);
        osc.connect(gain);
        gain.connect(context.destination);
        osc.start(now + item[1]);
        osc.stop(now + item[1] + item[2] + .05);
      });
      setTimeout(function () { try { context.close(); } catch (e) { /* already closed */ } }, 900);
    } catch (error) { /* sound is optional */ }
  }

  function render(next) {
    payload = next;
    STR = payload.strings || {};
    confirmedDose = null;
    document.documentElement.lang = payload.locale === 'en' ? 'en' : 'ru';
    applyTheme(payload.appearance || 'system');
    showIdle();

    var morning = payload.windowKey === 'morning';
    text('doseChip', morning ? t('notif.morning') : t('notif.evening'));
    text('doseWindow', payload.start + ' — ' + payload.end);
    text('notifTitle', t('notif.title'));
    text('notifBody', t('notif.body'));
    text('confirmBtn', t('notif.confirm'));
    text('snoozeBtn', t('notif.snooze'));
    text('undoBtn', t('history.undo'));

    sheet.querySelectorAll('[data-snooze]').forEach(function (button) {
      button.textContent = snoozeChoiceLabel(Number(button.dataset.snooze));
    });
  }

  function onNotification(next) {
    if (!next) return;
    clearTimers();
    card.classList.remove('is-leaving', 'is-visible');
    void card.offsetWidth;              // restart the entry animation
    card.classList.add('is-visible');
    render(next);
    if (payload.soundEnabled) playChime();

    autoTimer = setTimeout(function () {
      window.api.snooze(payload.snoozeMinutes);
      hideSoon(0);
    }, AUTO_SNOOZE_MS);
  }

  function nextReminderText() {
    var next = payload && payload.nextReminder;
    if (!next) return t('notif.noNext');
    return fill(t(next.day === 'today' ? 'notif.nextToday' : 'notif.nextTomorrow'), { time: next.time });
  }

  document.getElementById('confirmBtn').addEventListener('click', function () {
    clearTimers();
    window.api.confirmInhalation().then(function (dose) {
      confirmedDose = dose || payload.windowKey;
      var now = new Date().toLocaleTimeString(document.documentElement.lang, { hour: '2-digit', minute: '2-digit' });
      showResult(fill(t('notif.doneAt'), { time: now }), nextReminderText(), true);
      hideSoon(RESULT_MS);
    });
  });

  snoozeBtn.addEventListener('click', function () {
    var open = sheet.hidden;
    sheet.hidden = !open;
    snoozeBtn.setAttribute('aria-expanded', String(open));
  });

  sheet.querySelectorAll('[data-snooze]').forEach(function (button) {
    button.addEventListener('click', function () {
      clearTimers();
      var requested = Number(button.dataset.snooze);
      window.api.snooze(requested).then(function (granted) {
        // The main process may shorten a snooze so it cannot outlive the
        // catch-up deadline — report what was actually granted.
        var minutes = Number(granted) > 0 ? Number(granted) : requested;
        showResult(
          fill(t('notif.snoozedFor'), { duration: formatDuration(minutes) }),
          t('notif.windowWillClose'),
          false
        );
        hideSoon(1600);
      });
    });
  });

  document.getElementById('undoBtn').addEventListener('click', function () {
    clearTimers();
    window.api.undoInhalation(confirmedDose).then(function (ok) {
      if (!ok) { hideSoon(0); return; }
      confirmedDose = null;
      showIdle();
      // Undo puts the reminder back in play, so the auto-defer clock restarts.
      autoTimer = setTimeout(function () {
        window.api.snooze(payload.snoozeMinutes);
        hideSoon(0);
      }, AUTO_SNOOZE_MS);
    });
  });

  // On "System", the OS can flip while the reminder is on screen; without this
  // the window keeps whatever theme it opened with.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
    if (payload && (payload.appearance || 'system') === 'system') applyTheme('system');
  });

  if (window.api && typeof window.api.onNotification === 'function') {
    window.api.onNotification(onNotification);
  }
})();
