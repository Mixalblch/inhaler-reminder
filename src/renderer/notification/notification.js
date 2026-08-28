// Inhaler Reminder — always-on-top notification popup.
// Vanilla JS only. Talks to the main process exclusively through window.api.

(function () {
  'use strict';

  var AUTO_SNOOZE_MS = 5 * 60 * 1000;   // 'dose' reminders defer themselves
  var AUTO_HIDE_MS = 20 * 1000;         // 'low' warnings close themselves
  var LEAVE_MS = 200;                   // exit-animation duration

  var STR = {};
  var payload = null;
  var autoTimer = null;
  var leaveTimer = null;

  var card = document.getElementById('card');
  var doseMeta = document.getElementById('doseMeta');
  var confirmBtn = document.getElementById('confirmBtn');
  var snoozeBtn = document.getElementById('snoozeBtn');
  var okBtn = document.getElementById('okBtn');
  var nextLine = document.getElementById('nextLine');

  function t(k) { return STR[k] || k; }
  function text(id, value) { document.getElementById(id).textContent = value; }
  function replace(template, name, value) {
    return String(template).replace('{' + name + '}', String(value));
  }

  function clearTimers() {
    clearTimeout(autoTimer);
    clearTimeout(leaveTimer);
  }

  // Plays the exit animation, then runs the action (which hides or snoozes).
  function fadeOut(action) {
    card.classList.add('is-leaving');
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(action, LEAVE_MS);
  }

  function applyTheme(appearance) {
    var dark = appearance === 'dark' ||
      (appearance === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
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

  function nextReminderText(next) {
    if (!next) return t('notif.noNext');
    var key = next.day === 'today' ? 'notif.nextToday' : 'notif.nextTomorrow';
    return replace(t(key), 'time', next.time);
  }

  function renderDose(next) {
    var chip = next.windowName
      ? next.windowName
      : replace(t('notif.unnamed'), 'n', next.windowIndex);
    var snoozeMinutes = Number(next.snoozeMinutes) > 0 ? Number(next.snoozeMinutes) : 15;

    doseMeta.hidden = false;
    nextLine.hidden = false;
    confirmBtn.hidden = false;
    snoozeBtn.hidden = false;
    okBtn.hidden = true;

    text('doseChip', chip);
    text('doseBadge', replace(t('notif.dosesLeft'), 'n', next.remaining));
    text('notifTitle', t('notif.title'));
    text('notifBody', t('notif.body'));
    text('confirmBtn', t('notif.confirm'));
    text('snoozeBtn', t('notif.snooze'));
    text('nextLine', nextReminderText(next.nextReminder));

    autoTimer = setTimeout(function () {
      fadeOut(function () { window.api.snooze(snoozeMinutes); });
    }, AUTO_SNOOZE_MS);
  }

  function renderLow(next) {
    doseMeta.hidden = true;
    nextLine.hidden = true;
    confirmBtn.hidden = true;
    snoozeBtn.hidden = true;
    okBtn.hidden = false;

    if (next.remaining === 0) {
      text('notifTitle', t('notif.emptyTitle'));
      text('notifBody', t('notif.emptyBody'));
    } else {
      text('notifTitle', t('notif.lowTitle'));
      text('notifBody', replace(t('notif.lowBody'), 'n', next.remaining));
    }
    text('okBtn', t('notif.ok'));

    autoTimer = setTimeout(function () {
      fadeOut(function () { window.api.hideNotification(); });
    }, AUTO_HIDE_MS);
  }

  function onNotification(next) {
    if (!next) return;
    clearTimers();
    payload = next;
    STR = next.strings || {};
    document.documentElement.lang = next.locale || 'ru';
    applyTheme(next.appearance || 'system');

    card.classList.remove('is-leaving', 'is-visible');
    void card.offsetWidth;              // restart the entry animation
    card.classList.add('is-visible');

    if (next.kind === 'low') {
      renderLow(next);
    } else {
      renderDose(next);
    }

    if (next.soundEnabled) playChime();
  }

  confirmBtn.addEventListener('click', function () {
    clearTimers();
    window.api.confirmInhalation().catch(function () { /* window may be closing */ });
  });

  snoozeBtn.addEventListener('click', function () {
    clearTimers();
    var minutes = payload && Number(payload.snoozeMinutes) > 0 ? Number(payload.snoozeMinutes) : 15;
    fadeOut(function () { window.api.snooze(minutes); });
  });

  okBtn.addEventListener('click', function () {
    clearTimers();
    fadeOut(function () { window.api.hideNotification(); });
  });

  // On "System", the OS can flip while the reminder is on screen.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
    if (payload && (payload.appearance || 'system') === 'system') applyTheme('system');
  });

  if (window.api && typeof window.api.onNotification === 'function') {
    window.api.onNotification(onNotification);
  }
})();
