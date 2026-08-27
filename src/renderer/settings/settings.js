// Inhaler Reminder — settings page.
// Vanilla JS only. Talks to the main process exclusively through window.api.

(function () {
  'use strict';

  var MINUTES_PER_DAY = 1440;

  var STR = {};
  var config = null;
  var history = null;
  var savedTimer = null;
  var clockTimer = null;
  var backdated = null;   // { date, dose } while the undo affordance is showing

  function t(key) { return STR[key] || key; }
  function el(id) { return document.getElementById(id); }
  function fill(template, values) {
    return String(template).replace(/\{(\w+)\}/g, function (match, name) {
      return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : match;
    });
  }

  function locale() { return (config && config.locale === 'en') ? 'en' : 'ru'; }

  // ---------- time helpers ----------

  function toMinutes(value) {
    var parts = String(value || '00:00').split(':');
    return Number(parts[0]) * 60 + Number(parts[1]);
  }

  function fromMinutes(value) {
    var total = ((Math.round(value) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
  }

  function formatDuration(minutes) {
    var value = Math.max(0, Number(minutes) || 0);
    if (value >= 60) {
      var hours = Math.floor(value / 60);
      var rest = value % 60;
      if (rest === 0) {
        return hours === 1 && STR['units.oneHour'] ? t('units.oneHour') : hours + ' ' + t('units.hours');
      }
      return hours + ' ' + t('units.hours') + ' ' + rest + ' ' + t('units.minutes');
    }
    return value + ' ' + t('units.minutes');
  }

  function parseDay(dayKey) {
    var parts = String(dayKey).split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12);
  }

  function shortDate(dayKey) {
    return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short' })
      .format(parseDay(dayKey)).replace('.', '');
  }

  function longDate(dayKey) {
    return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long' }).format(parseDay(dayKey));
  }

  function clockTime(value) {
    return new Date(value).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  }

  // ---------- persistence ----------

  function showSaved() {
    var indicator = el('savedIndicator');
    indicator.classList.add('visible');
    clearTimeout(savedTimer);
    savedTimer = setTimeout(function () { indicator.classList.remove('visible'); }, 1700);
  }

  function saveConfig(patch) {
    return window.api.setConfig(patch).then(function (cfg) {
      config = cfg;
      renderControls();
      showSaved();
      return cfg;
    }).catch(function (error) {
      console.error('setConfig failed', error);
    });
  }

  // ---------- theme ----------

  function applyTheme() {
    var appearance = (config && config.appearance) || 'system';
    var dark = appearance === 'dark' ||
      (appearance === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelectorAll('[data-appearance]').forEach(function (button) {
      button.setAttribute('aria-checked', String(button.dataset.appearance === appearance));
    });
  }

  // ---------- rendering ----------

  function renderTexts() {
    document.title = t('app.fullName');
    document.documentElement.lang = locale();
    document.querySelectorAll('[data-i18n]').forEach(function (node) {
      node.textContent = t(node.dataset.i18n);
    });
    // Assistive labels are localized too — they used to be frozen in Russian.
    document.querySelectorAll('[data-i18n-aria]').forEach(function (node) {
      node.setAttribute('aria-label', t(node.dataset.i18nAria));
    });
  }

  function setValue(control, value) {
    if (control && document.activeElement !== control) control.value = String(value == null ? '' : value);
  }

  function setChecked(control, value) {
    if (control && document.activeElement !== control) control.checked = !!value;
  }

  // The day track is a 24-hour scale, so the bands land exactly where the design
  // places them for the default schedule and stay truthful when it changes.
  function renderDayTrack() {
    ['morning', 'evening'].forEach(function (dose) {
      var win = config.windows[dose];
      var band = document.querySelector('.track-window.' + dose);
      if (!band) return;
      var start = toMinutes(win.start);
      var end = Math.max(start, toMinutes(win.end));
      band.style.left = (start / MINUTES_PER_DAY * 100) + '%';
      band.style.width = ((end - start) / MINUTES_PER_DAY * 100) + '%';
      band.style.display = win.enabled ? '' : 'none';
    });
    var now = new Date();
    var position = ((now.getHours() * 60 + now.getMinutes()) / MINUTES_PER_DAY * 100) + '%';
    el('trackNow').style.left = position;
    el('trackNowPulse').style.left = position;
  }

  function renderControls() {
    if (!config) return;
    ['morning', 'evening'].forEach(function (dose) {
      var win = config.windows[dose];
      setChecked(el(dose + 'Enabled'), win.enabled);
      setValue(el(dose + 'Start'), win.start);
      setValue(el(dose + 'End'), win.end);
      el(dose + 'StartValue').textContent = win.start;
      el(dose + 'EndValue').textContent = win.end;
      el(dose + 'Range').textContent = win.start + ' — ' + win.end;
    });

    setValue(el('snooze'), config.snoozeMinutes);
    setValue(el('grace'), config.graceMinutes);
    el('snoozeValue').textContent = formatDuration(config.snoozeMinutes);
    el('graceValue').textContent = formatDuration(config.graceMinutes);

    setChecked(el('soundEnabled'), config.soundEnabled);
    setChecked(el('autostart'), config.autostart);

    document.querySelectorAll('[data-locale]').forEach(function (button) {
      button.setAttribute('aria-checked', String(button.dataset.locale === config.locale));
    });

    renderDayTrack();
    applyTheme();
  }

  function statusLabel(entry) {
    if (!entry || !entry.status) return t('status.pending');
    if (entry.status === 'confirmed') {
      return entry.at
        ? fill(t('status.confirmedAt'), { time: clockTime(entry.at) })
        : t('status.confirmed');
    }
    return t('status.' + entry.status) || t('status.pending');
  }

  function renderHistoryRow(targetId, dose) {
    var target = el(targetId);
    target.textContent = '';
    history.days.forEach(function (day) {
      var status = day[dose];
      var dot = document.createElement('span');
      dot.className = 'history-dot ' + status;
      dot.title = shortDate(day.date) + ' · ' + t('dot.' + status);
      target.appendChild(dot);
    });
  }

  // Picks the headline from real state rather than assuming a fixed narrative.
  function todayCopy() {
    var status = history.todayStatus;
    var order = ['morning', 'evening'];
    var enabled = order.filter(function (dose) { return config.windows[dose].enabled; });

    if (!enabled.length) {
      return { headline: t('today.nothingScheduled'), description: t('today.allOff') };
    }

    var waiting = enabled.filter(function (dose) {
      var entry = status[dose];
      return !entry || entry.status === 'pending';
    });

    if (waiting.length) {
      var next = waiting[0];
      var win = config.windows[next];
      return {
        headline: waiting.length > 1 ? t('today.bothRemaining') : t('today.' + next + 'Remaining'),
        description: fill(t('today.window'), { start: win.start, end: win.end })
      };
    }

    var confirmed = enabled.filter(function (dose) {
      return status[dose] && status[dose].status === 'confirmed';
    });

    if (confirmed.length === enabled.length) {
      var first = config.windows[enabled[0]];
      return {
        headline: enabled.length > 1 ? t('today.complete') : t('today.morningDone'),
        description: fill(t('today.nextTomorrow'), { time: first.start })
      };
    }

    return { headline: t('today.reviewDay'), description: t('history.missedDescription') };
  }

  function renderToday() {
    if (!history || !config) return;

    var copy = todayCopy();
    el('todayHeadline').textContent = copy.headline;
    el('todayDescription').textContent = copy.description;

    ['morning', 'evening'].forEach(function (dose) {
      var entry = history.todayStatus[dose];
      var state = entry && entry.status ? entry.status : (config.windows[dose].enabled ? 'pending' : 'disabled');
      el(dose + 'TodayDot').className = state;
      el(dose + 'TodayDot').title = t('dot.' + state);
      el(dose + 'Status').textContent = statusLabel(entry);
    });

    renderHistoryRow('morningHistory', 'morning');
    renderHistoryRow('eveningHistory', 'evening');

    el('historyScore').textContent = history.trackedCount
      ? history.confirmedCount + ' ' + t('history.of') + ' ' + history.trackedCount
      : t('history.noData');

    var days = history.days;
    el('historyStartDate').textContent = shortDate(days[0].date);
    el('historyMiddleDate').textContent = String(parseDay(days[Math.floor(days.length / 2)].date).getDate());
    el('historyEndDate').textContent = shortDate(days[days.length - 1].date);

    renderNotice();
  }

  function renderNotice() {
    var missedCard = el('missedCard');
    var backdatedRow = el('backdatedRow');

    if (backdated) {
      missedCard.hidden = true;
      backdatedRow.hidden = false;
      el('backdatedText').textContent = t('settings.' + backdated.dose) + ', ' +
        longDate(backdated.date) + ' — ' + t('history.backdatedTitle').toLowerCase();
      el('undoBackdateBtn').textContent = t('history.undo');
      return;
    }

    backdatedRow.hidden = true;
    var target = history.latestMissed;
    if (!target) { missedCard.hidden = true; return; }

    missedCard.hidden = false;
    el('missedTitle').textContent = fill(t('history.missedOn'), {
      dose: t('settings.' + target.dose),
      date: longDate(target.date)
    });
    el('missedDescription').textContent = t('history.missedDescription');
    el('backdateBtn').textContent = t('history.mark');
  }

  // ---------- events ----------

  function windowPatch(target, value) {
    var dose = target.indexOf('morning') === 0 ? 'morning' : 'evening';
    var field = target.indexOf('Start') !== -1 ? 'start' : 'end';
    var patch = { windows: {} };
    patch.windows[dose] = {};
    patch.windows[dose][field] = value;
    return patch;
  }

  function bindEvents() {
    ['morning', 'evening'].forEach(function (dose) {
      el(dose + 'Enabled').addEventListener('change', function () {
        var patch = { windows: {} };
        patch.windows[dose] = { enabled: el(dose + 'Enabled').checked };
        saveConfig(patch);
      });
    });

    ['morningStart', 'morningEnd', 'eveningStart', 'eveningEnd'].forEach(function (id) {
      el(id).addEventListener('change', function () {
        if (el(id).value) saveConfig(windowPatch(id, el(id).value));
      });
    });

    document.querySelectorAll('[data-time-step]').forEach(function (button) {
      button.addEventListener('click', function () {
        var id = button.dataset.target;
        var next = fromMinutes(toMinutes(el(id).value) + Number(button.dataset.timeStep));
        saveConfig(windowPatch(id, next));
      });
    });

    document.querySelectorAll('[data-number-step]').forEach(function (button) {
      button.addEventListener('click', function () {
        var input = el(button.dataset.target);
        var next = Math.min(
          Number(input.max),
          Math.max(Number(input.min), Number(input.value) + Number(button.dataset.numberStep))
        );
        var patch = {};
        patch[button.dataset.target === 'snooze' ? 'snoozeMinutes' : 'graceMinutes'] = next;
        saveConfig(patch);
      });
    });

    el('snooze').addEventListener('change', function () {
      saveConfig({ snoozeMinutes: Number(el('snooze').value) });
    });
    el('grace').addEventListener('change', function () {
      saveConfig({ graceMinutes: Number(el('grace').value) });
    });

    // Rows expand in place; the card never opens anything on top of itself.
    document.querySelectorAll('.dose-summary').forEach(function (button) {
      button.addEventListener('click', function () {
        var editor = el(button.dataset.editor);
        var open = button.getAttribute('aria-expanded') === 'true';
        button.setAttribute('aria-expanded', String(!open));
        editor.classList.toggle('open', !open);
      });
    });

    el('soundEnabled').addEventListener('change', function () {
      saveConfig({ soundEnabled: el('soundEnabled').checked });
    });

    el('autostart').addEventListener('change', function () {
      window.api.setAutostart(el('autostart').checked).then(function (value) {
        config.autostart = value;
        setChecked(el('autostart'), value);
        showSaved();
      });
    });

    document.querySelectorAll('[data-appearance]').forEach(function (button) {
      button.addEventListener('click', function () {
        saveConfig({ appearance: button.dataset.appearance });
      });
    });

    document.querySelectorAll('[data-locale]').forEach(function (button) {
      button.addEventListener('click', function () {
        if (config.locale === button.dataset.locale) return;
        window.api.setLocale(button.dataset.locale)
          .then(function (cfg) { config = cfg; return refreshStrings(); })
          .then(function () { renderTexts(); renderControls(); renderToday(); showSaved(); });
      });
    });

    el('backdateBtn').addEventListener('click', function () {
      var target = history.latestMissed;
      if (!target) return;
      window.api.backdateDose(target.date, target.dose).then(function (result) {
        if (!result || !result.ok) return;
        history = result.summary;
        backdated = target;
        renderToday();
        showSaved();
      });
    });

    el('undoBackdateBtn').addEventListener('click', function () {
      if (!backdated) return;
      var target = backdated;
      window.api.undoBackdate(target.date, target.dose).then(function (result) {
        if (!result || !result.ok) return;
        history = result.summary;
        backdated = null;
        renderToday();
        showSaved();
      });
    });

    el('quitBtn').addEventListener('click', function () { window.api.quit(); });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      if (config && config.appearance === 'system') applyTheme();
    });
  }

  function refreshStrings() {
    return window.api.getStrings().then(function (dict) { STR = dict || {}; });
  }

  function handleConfigChanged(cfg) {
    var localeChanged = config && config.locale !== cfg.locale;
    config = cfg;
    var work = localeChanged ? refreshStrings().then(renderTexts) : Promise.resolve();
    work.then(function () { renderControls(); renderToday(); });
  }

  async function init() {
    try {
      STR = await window.api.getStrings();
      config = await window.api.getConfig();
      history = await window.api.getHistorySummary();

      window.api.onConfigChanged(handleConfigChanged);
      window.api.onHistoryChanged(function (summary) {
        history = summary;
        // A dose resolved elsewhere (tray, reminder) retires the undo affordance.
        if (backdated) {
          var entry = summary.todayStatus[backdated.dose];
          if (backdated.date === summary.today && (!entry || entry.status !== 'confirmed')) backdated = null;
        }
        renderToday();
      });

      renderTexts();
      renderControls();
      renderToday();
      bindEvents();

      // Keeps the "now" marker honest without redrawing the whole page.
      clockTimer = setInterval(renderDayTrack, 60000);
    } catch (error) {
      console.error('Failed to initialise settings page', error);
    }
  }

  window.addEventListener('beforeunload', function () {
    clearInterval(clockTimer);
    clearTimeout(savedTimer);
  });

  init();
})();
