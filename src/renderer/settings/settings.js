// Inhaler Reminder — settings page.
// Vanilla JS only. Talks to the main process exclusively through window.api.

(function () {
  'use strict';

  var MINUTES_PER_DAY = 1440;

  var STR = {};
  var config = null;
  var history = null;
  var inhaler = null;
  var savedTimer = null;
  var clockTimer = null;
  var backdated = null;   // { date, id } while a retroactive mark's undo affordance shows
  var lastWindowsSig = null;

  function t(key) { return STR[key] || key; }
  function el(id) { return document.getElementById(id); }
  function fill(template, values) {
    return String(template).replace(/\{(\w+)\}/g, function (match, name) {
      return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : match;
    });
  }

  function locale() { return (config && config.locale) || 'ru'; }

  // ---------- time helpers ----------

  function toMinutes(value) {
    var parts = String(value || '00:00').split(':');
    return Number(parts[0]) * 60 + Number(parts[1]);
  }

  // "15 мин" / "1 ч" / "1 ч 30 мин".
  function formatDuration(minutes) {
    var value = Math.max(0, Number(minutes) || 0);
    if (value < 60) return value + ' ' + t('units.minutes');
    var hours = Math.floor(value / 60);
    var rest = value % 60;
    if (rest === 0) return hours + ' ' + t('units.hours');
    return hours + ' ' + t('units.hours') + ' ' + rest + ' ' + t('units.minutes');
  }

  function parseDay(dayKey) {
    var parts = String(dayKey).split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12);
  }

  function shortDate(dayKey) {
    var text = new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short' }).format(parseDay(dayKey));
    return text.replace(/\./g, '');
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
      renderAll();
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
  }

  // ---------- helpers ----------

  function setValue(control, value) {
    if (control && document.activeElement !== control) control.value = String(value == null ? '' : value);
  }

  function setChecked(control, value) {
    if (control && document.activeElement !== control) control.checked = !!value;
  }

  function windowDisplayName(win, index) {
    return win.name || fill(t('schedule.windowNamePlaceholder'), { n: index + 1 });
  }

  function nextWindowId(windows) {
    var max = 0;
    windows.forEach(function (w) {
      var m = /^w(\d+)$/.exec(String(w.id || ''));
      if (m) max = Math.max(max, Number(m[1]));
    });
    return 'w' + (max + 1);
  }

  // ---------- rendering: texts ----------

  function renderTexts() {
    document.title = t('app.fullName');
    document.documentElement.lang = locale();
    document.querySelectorAll('[data-i18n]').forEach(function (node) {
      node.textContent = t(node.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (node) {
      node.setAttribute('aria-label', t(node.dataset.i18nAria));
    });
    // A locale switch must re-localise the schedule rows too.
    lastWindowsSig = null;
  }

  // ---------- rendering: schedule ----------

  function windowsSignature() {
    return config.windows.map(function (w) {
      return w.id + '|' + w.name + '|' + w.enabled + '|' + w.start + '|' + w.end;
    }).join('~');
  }

  function buildTimeField(field, win, label) {
    var wrap = document.createElement('div');
    wrap.className = 'time-field';

    var span = document.createElement('span');
    span.className = 'time-label';
    span.textContent = label;
    wrap.appendChild(span);

    var input = document.createElement('input');
    input.type = 'time';
    input.className = 'time-input';
    input.dataset.field = field;
    input.dataset.id = win.id;
    input.value = win[field];
    input.setAttribute('aria-label', label);
    wrap.appendChild(input);

    return wrap;
  }

  function buildWindowRow(win, index, total) {
    var row = document.createElement('div');
    row.className = 'window-row';
    row.dataset.id = win.id;

    var top = document.createElement('div');
    top.className = 'window-row-top';

    var dot = document.createElement('span');
    dot.className = 'dose-dot band-' + (index % 2);
    dot.setAttribute('aria-hidden', 'true');
    top.appendChild(dot);

    var name = document.createElement('input');
    name.type = 'text';
    name.className = 'text-input window-name';
    name.dataset.field = 'name';
    name.dataset.id = win.id;
    name.placeholder = fill(t('schedule.windowNamePlaceholder'), { n: index + 1 });
    name.setAttribute('aria-label', t('schedule.windowNameLabel'));
    name.value = win.name;
    top.appendChild(name);

    var switchLabel = document.createElement('label');
    switchLabel.className = 'switch';
    var enabled = document.createElement('input');
    enabled.type = 'checkbox';
    enabled.dataset.field = 'enabled';
    enabled.dataset.id = win.id;
    enabled.checked = win.enabled;
    enabled.setAttribute('aria-label', windowDisplayName(win, index));
    var slider = document.createElement('span');
    slider.className = 'slider';
    switchLabel.appendChild(enabled);
    switchLabel.appendChild(slider);
    top.appendChild(switchLabel);

    var remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-button';
    remove.dataset.action = 'remove';
    remove.dataset.id = win.id;
    remove.textContent = t('schedule.removeWindow');
    remove.setAttribute('aria-label', t('a11y.removeWindow'));
    remove.disabled = total <= 1;
    top.appendChild(remove);

    row.appendChild(top);

    var times = document.createElement('div');
    times.className = 'window-row-times';
    times.appendChild(buildTimeField('start', win, t('settings.from')));
    times.appendChild(buildTimeField('end', win, t('settings.to')));
    row.appendChild(times);

    return row;
  }

  function renderSchedule() {
    var sig = windowsSignature();
    if (sig === lastWindowsSig) return;
    lastWindowsSig = sig;

    var list = el('scheduleList');
    var active = document.activeElement;
    var focusId = null;
    var focusField = null;
    if (active && list.contains(active) && active.dataset && active.dataset.field) {
      focusId = active.dataset.id;
      focusField = active.dataset.field;
    }

    list.textContent = '';

    config.windows.forEach(function (win, index) {
      list.appendChild(buildWindowRow(win, index, config.windows.length));
    });

    if (focusId && focusField && focusField !== 'name') {
      var next = list.querySelector('[data-id="' + focusId + '"][data-field="' + focusField + '"]');
      if (next) next.focus();
    }
  }

  // ---------- rendering: counter ----------

  function renderCounter() {
    if (!inhaler) return;
    var total = Number(inhaler.total) || 0;
    var remaining = Number(inhaler.remaining) || 0;
    el('counterRemaining').textContent = String(remaining);
    el('counterOf').textContent = t('counter.of') + ' ' + total;
    var pct = total > 0 ? Math.min(100, Math.max(0, Math.round(remaining / total * 100))) : 0;
    el('counterBar').style.width = pct + '%';
    el('counterEmpty').hidden = remaining !== 0;
  }

  // ---------- rendering: today ----------

  function renderDayTrack() {
    var track = el('dayTrack');
    track.textContent = '';
    if (!config) return;

    config.windows.forEach(function (win, index) {
      var band = document.createElement('span');
      band.className = 'track-window band-' + (index % 2);
      var start = toMinutes(win.start);
      var end = Math.max(start, toMinutes(win.end));
      band.style.left = (start / MINUTES_PER_DAY * 100) + '%';
      band.style.width = ((end - start) / MINUTES_PER_DAY * 100) + '%';
      if (!win.enabled) band.style.display = 'none';
      track.appendChild(band);
    });

    var now = new Date();
    var position = ((now.getHours() * 60 + now.getMinutes()) / MINUTES_PER_DAY * 100) + '%';
    var marker = document.createElement('span');
    marker.className = 'track-now';
    marker.style.left = position;
    track.appendChild(marker);
    var pulse = document.createElement('span');
    pulse.className = 'track-now-pulse';
    pulse.style.left = position;
    track.appendChild(pulse);
  }

  function renderTodayDots() {
    var container = el('todayDots');
    container.textContent = '';
    config.windows.forEach(function (w) {
      var entry = history.todayStatus[w.id];
      var state = entry && entry.status ? entry.status : (w.enabled ? 'pending' : 'disabled');
      var dot = document.createElement('span');
      dot.className = state;
      dot.title = t('dot.' + state);
      container.appendChild(dot);
    });
  }

  // Picks the headline from real state rather than assuming a fixed narrative.
  function todayCopy() {
    var status = history.todayStatus || {};
    var enabled = config.windows.filter(function (w) { return w.enabled; });

    if (!enabled.length) {
      return { headline: t('today.nothingScheduled'), description: t('today.allOff') };
    }

    var remaining = enabled.filter(function (w) {
      var entry = status[w.id];
      var s = entry && entry.status ? entry.status : 'pending';
      return s === 'pending';
    });

    if (remaining.length) {
      var next = remaining[0];
      var entry = status[next.id];
      if (entry && Number(entry.snoozeUntil) > Date.now()) {
        var minutes = Math.max(1, Math.round((Number(entry.snoozeUntil) - Date.now()) / 60000));
        return {
          headline: fill(t('today.dosesRemaining'), { n: remaining.length }),
          description: fill(t('today.snoozed'), { duration: formatDuration(minutes) })
        };
      }
      return {
        headline: fill(t('today.dosesRemaining'), { n: remaining.length }),
        description: fill(t('today.window'), { start: next.start, end: next.end })
      };
    }

    var confirmed = enabled.filter(function (w) {
      var entry = status[w.id];
      return entry && entry.status === 'confirmed';
    });

    if (confirmed.length === enabled.length) {
      return { headline: t('today.complete'), description: '' };
    }

    return { headline: t('today.reviewDay'), description: t('history.missedDescription') };
  }

  function renderToday() {
    if (!history || !config) return;
    var copy = todayCopy();
    el('todayHeadline').textContent = copy.headline;
    el('todayDescription').textContent = copy.description;
    el('todayDescription').hidden = !copy.description;
    renderTodayDots();
    renderDayTrack();
  }

  // ---------- rendering: history ----------

  function historyStillBackdated(summary, target) {
    var found = false;
    summary.days.forEach(function (d) {
      if (d.date === target.date && d[target.id] === 'confirmed') found = true;
    });
    return found;
  }

  function actionButton(action, date, id, label) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cell-action';
    btn.dataset.action = action;
    btn.dataset.date = date;
    btn.dataset.id = id;
    btn.textContent = label;
    return btn;
  }

  function renderHistory() {
    if (!history || !config) return;
    var table = el('historyTable');
    table.textContent = '';

    var windows = config.windows;

    var header = document.createElement('div');
    header.className = 'history-row history-header';
    var headerDate = document.createElement('span');
    headerDate.className = 'history-date';
    header.appendChild(headerDate);
    windows.forEach(function (w, i) {
      var cell = document.createElement('span');
      cell.className = 'history-cell history-col';
      cell.textContent = windowDisplayName(w, i);
      header.appendChild(cell);
    });
    table.appendChild(header);

    // Most recent day on top.
    for (var i = history.days.length - 1; i >= 0; i--) {
      var day = history.days[i];
      var row = document.createElement('div');
      row.className = 'history-row';

      var date = document.createElement('span');
      date.className = 'history-date';
      date.textContent = shortDate(day.date);
      row.appendChild(date);

      windows.forEach(function (w) {
        var cell = document.createElement('span');
        cell.className = 'history-cell';

        var status = day[w.id] || 'unknown';
        var dot = document.createElement('span');
        dot.className = 'history-dot ' + status;
        dot.title = shortDate(day.date) + ' · ' + t('dot.' + status);
        cell.appendChild(dot);

        if (status === 'missed') {
          cell.appendChild(actionButton('mark', day.date, w.id, t('history.mark')));
        } else if (backdated && backdated.date === day.date && backdated.id === w.id) {
          cell.appendChild(actionButton('undo', day.date, w.id, t('history.undo')));
        }

        row.appendChild(cell);
      });

      table.appendChild(row);
    }

    el('historyScore').textContent = history.trackedCount
      ? history.confirmedCount + ' ' + t('history.of') + ' ' + history.trackedCount
      : t('history.noData');
  }

  function renderData() {
    renderToday();
    renderHistory();
  }

  // ---------- rendering: controls ----------

  function renderControls() {
    if (!config) return;

    renderSchedule();

    setValue(el('snooze'), config.snoozeMinutes);
    setValue(el('grace'), config.graceMinutes);
    el('snoozeValue').textContent = formatDuration(config.snoozeMinutes);
    el('graceValue').textContent = formatDuration(config.graceMinutes);

    setChecked(el('soundEnabled'), config.soundEnabled);
    setChecked(el('autostart'), config.autostart);

    el('puffsSelect').value = String(config.puffsPerDose);
    el('languageSelect').value = config.locale;

    document.querySelectorAll('[data-appearance]').forEach(function (button) {
      button.setAttribute('aria-checked', String(button.dataset.appearance === config.appearance));
    });

    applyTheme();
  }

  function renderAll() {
    renderControls();
    renderCounter();
    renderData();
  }

  // ---------- events ----------

  function updateWindow(id, field, value) {
    var windows = config.windows.map(function (w) {
      if (w.id !== id) return w;
      var next = { id: w.id, name: w.name, enabled: w.enabled, start: w.start, end: w.end };
      next[field] = value;
      return next;
    });
    saveConfig({ windows: windows });
  }

  function removeWindow(id) {
    if (config.windows.length <= 1) return;
    var windows = config.windows.filter(function (w) { return w.id !== id; });
    saveConfig({ windows: windows });
  }

  function addWindow() {
    var windows = config.windows.concat([{
      id: nextWindowId(config.windows), name: '', enabled: true, start: '09:00', end: '10:00'
    }]);
    saveConfig({ windows: windows });
  }

  function bindEvents() {
    el('scheduleList').addEventListener('change', function (event) {
      var target = event.target;
      if (!target || !target.dataset || !target.dataset.field) return;
      var field = target.dataset.field;
      var id = target.dataset.id;
      if (field === 'enabled') {
        updateWindow(id, 'enabled', target.checked);
      } else {
        if (!target.value) return;
        updateWindow(id, field, target.value);
      }
    });

    el('scheduleList').addEventListener('click', function (event) {
      var target = event.target;
      var btn = target && target.closest ? target.closest('[data-action="remove"]') : null;
      if (!btn) return;
      removeWindow(btn.dataset.id);
    });

    el('addWindowBtn').addEventListener('click', addWindow);

    el('historyTable').addEventListener('click', function (event) {
      var target = event.target;
      var btn = target && target.closest ? target.closest('[data-action]') : null;
      if (!btn) return;
      var action = btn.dataset.action;
      var date = btn.dataset.date;
      var id = btn.dataset.id;
      if (action === 'mark') {
        window.api.backdateDose(date, id).then(function (result) {
          if (!result || !result.ok) return;
          history = result.summary;
          backdated = { date: date, id: id };
          renderData();
          showSaved();
        });
      } else if (action === 'undo') {
        window.api.undoBackdate(date, id).then(function (result) {
          if (!result || !result.ok) return;
          history = result.summary;
          backdated = null;
          renderData();
          showSaved();
        });
      }
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

    el('puffsSelect').addEventListener('change', function () {
      var value = Number(el('puffsSelect').value);
      if (value === 1 || value === 2) saveConfig({ puffsPerDose: value });
    });

    el('soundEnabled').addEventListener('change', function () {
      saveConfig({ soundEnabled: el('soundEnabled').checked });
    });

    el('autostart').addEventListener('change', function () {
      window.api.setAutostart(el('autostart').checked).then(function (value) {
        if (config) config.autostart = value;
        setChecked(el('autostart'), value);
        showSaved();
      });
    });

    document.querySelectorAll('[data-appearance]').forEach(function (button) {
      button.addEventListener('click', function () {
        saveConfig({ appearance: button.dataset.appearance });
      });
    });

    el('languageSelect').addEventListener('change', function () {
      var loc = el('languageSelect').value;
      if (!loc || (config && config.locale === loc)) return;
      window.api.setLocale(loc)
        .then(function (cfg) { config = cfg; return refreshStrings(); })
        .then(function () { renderTexts(); renderAll(); showSaved(); });
    });

    el('replaceToggle').addEventListener('click', function () {
      el('replaceForm').hidden = false;
      el('replaceTotal').value = '';
      el('replaceTotal').focus();
    });

    el('replaceCancel').addEventListener('click', function () {
      el('replaceForm').hidden = true;
    });

    el('replaceSave').addEventListener('click', function () {
      var total = Number(el('replaceTotal').value);
      if (!Number.isFinite(total) || total < 1 || total > 9999) return;
      window.api.replaceInhaler(Math.round(total)).then(function (state) {
        inhaler = state;
        el('replaceForm').hidden = true;
        renderCounter();
        showSaved();
      });
    });

    el('replaceTotal').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        el('replaceSave').click();
      }
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
    work.then(function () { renderAll(); });
  }

  async function init() {
    try {
      STR = await window.api.getStrings();
      config = await window.api.getConfig();
      history = await window.api.getHistorySummary();
      inhaler = await window.api.getInhaler();

      window.api.onConfigChanged(handleConfigChanged);
      window.api.onHistoryChanged(function (summary) {
        history = summary;
        if (backdated && !historyStillBackdated(summary, backdated)) backdated = null;
        renderData();
      });
      window.api.onInhalerChanged(function (state) {
        inhaler = state;
        renderCounter();
      });

      renderTexts();
      renderAll();
      bindEvents();

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
