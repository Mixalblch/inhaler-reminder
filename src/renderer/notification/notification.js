(function () {
  'use strict';

  var STR = {};
  function t(k) {
    return STR[k] || k;
  }

  var AUTO_SNOOZE_MS = 5 * 60 * 1000;
  var FADE_MS = 280;

  var card = document.getElementById('card');
  var titleEl = document.getElementById('notif-title');
  var chipEl = document.getElementById('notif-chip');
  var bodyEl = document.getElementById('notif-body');
  var confirmBtn = document.getElementById('confirm');
  var snoozeBtn = document.getElementById('snooze');

  var autoTimer = null;
  var actionTimer = null;
  var busy = false;

  function callApi(name) {
    if (window.api && typeof window.api[name] === 'function') {
      window.api[name]();
    }
  }

  function setText(el, text) {
    if (el) {
      el.textContent = text;
    }
  }

  function showCard() {
    if (!card) {
      return;
    }
    card.classList.remove('is-leaving');
    card.classList.remove('is-visible');
    void card.offsetWidth; /* force reflow so the entry transition restarts */
    card.classList.add('is-visible');
  }

  function hideCard(done) {
    clearTimeout(actionTimer);
    if (!card) {
      if (done) {
        done();
      }
      return;
    }
    card.classList.remove('is-visible');
    card.classList.add('is-leaving');
    actionTimer = setTimeout(function () {
      if (done) {
        done();
      }
    }, FADE_MS);
  }

  function clearTimers() {
    clearTimeout(autoTimer);
    clearTimeout(actionTimer);
  }

  function dismiss(action) {
    if (busy) {
      return;
    }
    busy = true;
    clearTimers();
    hideCard(function () {
      callApi(action);
      busy = false;
    });
  }

  function playChime() {
    try {
      var AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        return;
      }
      var ctx = new AudioContext();
      var now = ctx.currentTime;

      function tone(freq, start, dur, vol) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + start);
        gain.gain.exponentialRampToValueAtTime(vol, now + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + dur + 0.05);
      }

      tone(659.25, 0, 0.16, 0.16);
      tone(880.0, 0.15, 0.26, 0.13);

      setTimeout(function () {
        try {
          ctx.close();
        } catch (e) {
          /* ignore */
        }
      }, 900);
    } catch (e) {
      /* ignore audio errors */
    }
  }

  function render(payload) {
    STR = payload.strings || {};
    var morning = payload.windowKey === 'morning';

    setText(titleEl, t('notif.title'));
    setText(chipEl, morning ? t('notif.morning') : t('notif.evening'));
    setText(bodyEl, t('notif.body'));
    setText(confirmBtn, t('notif.confirm'));
    setText(snoozeBtn, t('notif.snooze'));

    if (chipEl) {
      if (morning) {
        chipEl.classList.remove('is-evening');
      } else {
        chipEl.classList.add('is-evening');
      }
    }
  }

  function onNotification(payload) {
    if (!payload) {
      return;
    }
    clearTimers();
    busy = false;
    render(payload);
    showCard();

    if (payload.soundEnabled) {
      playChime();
    }

    autoTimer = setTimeout(function () {
      dismiss('snooze');
    }, AUTO_SNOOZE_MS);
  }

  if (confirmBtn) {
    confirmBtn.addEventListener('click', function () {
      dismiss('confirmInhalation');
    });
  }

  if (snoozeBtn) {
    snoozeBtn.addEventListener('click', function () {
      dismiss('snooze');
    });
  }

  if (window.api && typeof window.api.onNotification === 'function') {
    window.api.onNotification(onNotification);
  }
})();
