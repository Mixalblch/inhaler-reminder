module.exports = {
  'app.name': 'Inhaler',
  'app.fullName': 'Inhaler Reminder',

  // --- Today ---
  'today.label': 'Today',
  'today.bothRemaining': 'Two doses today',
  'today.morningRemaining': 'Morning dose remaining',
  'today.eveningRemaining': 'Evening dose remaining',
  'today.complete': 'Both doses taken',
  'today.morningDone': 'Morning dose taken',
  'today.nothingScheduled': 'No reminders today',
  'today.window': 'We will remind you between {start} and {end}, once you are at the computer',
  'today.snoozed': 'Snoozed — back in {duration}',
  'today.nextTomorrow': 'Next reminder — tomorrow at {time}',
  'today.eveningOff': 'The evening reminder is off',
  'today.morningOff': 'The morning reminder is off',
  'today.allOff': 'Both reminders are off',
  'today.reviewDay': 'Day complete',

  // --- History ---
  'history.title': 'Last 14 days',
  'history.of': 'of',
  'history.noData': 'no data yet',
  'history.morningRow': 'morning',
  'history.eveningRow': 'evening',
  'history.missedDescription': 'It happens. You can mark it retroactively.',
  'history.mark': 'Mark',
  'history.undo': 'Undo',
  'history.backdatedTitle': 'Marked retroactively',
  'history.backdatedDescription': 'Saved to your local history.',
  'history.missedOn': '{dose}, {date} — missed',

  // Schedule row captions — sentence case.
  'status.confirmed': 'Taken',
  'status.confirmedAt': 'Taken at {time}',
  'status.pending': 'Waiting',
  'status.missed': 'Missed',
  'status.disabled': 'Off',

  // History dot tooltips — lower case, used inside "14 Aug · taken".
  'dot.confirmed': 'taken',
  'dot.pending': 'waiting',
  'dot.missed': 'missed',
  'dot.disabled': 'off',
  'dot.unknown': 'no data',

  // --- Schedule ---
  'settings.schedule': 'Schedule',
  'settings.morning': 'Morning',
  'settings.evening': 'Evening',
  'settings.from': 'Start',
  'settings.to': 'End',
  'schedule.morningToggle': 'Remind me in the morning',
  'schedule.eveningToggle': 'Remind me in the evening',

  // --- Reminders ---
  'settings.notifications': 'Reminders',
  'settings.snoozeShort': 'Snooze for',
  'settings.graceShort': 'Catch up within',
  'settings.graceHint': 'A reminder waits until you are at the computer. If the interval passed without you, it arrives within this time, and then the day is quietly marked as missed.',

  // --- Application ---
  'settings.preferences': 'Application',
  'settings.sound': 'Sound',
  'settings.autostart': 'Start with Windows',
  'settings.appearance': 'Appearance',
  'settings.language': 'Language',
  'appearance.system': 'System',
  'appearance.light': 'Light',
  'appearance.dark': 'Dark',
  'settings.saved': 'Saved',
  'settings.minimizeHint': 'Closing hides the app to the tray',
  'settings.quit': 'Quit',

  'units.minutes': 'min',
  'units.hours': 'h',
  'units.oneHour': '1 h',

  // --- Reminder window ---
  'notif.title': 'Time to use your inhaler',
  'notif.morning': 'Morning dose',
  'notif.evening': 'Evening dose',
  'notif.body': 'As prescribed by your doctor. Mark it once you have.',
  'notif.confirm': 'Done',
  'notif.snooze': 'Later',
  'notif.doneAt': 'Marked at {time}',
  'notif.nextToday': 'Next reminder — today at {time}',
  'notif.nextTomorrow': 'Next reminder — tomorrow at {time}',
  'notif.noNext': 'No further reminders scheduled',
  'notif.snoozedFor': 'Back in {duration}',
  'notif.windowWillClose': 'This window closes on its own. You can still mark the dose now.',

  // --- Tray ---
  'tray.nextDose': 'Next dose',
  'tray.markNow': 'Mark dose now',
  'tray.settings': 'Settings…',
  'tray.allDone': 'All doses marked',
  'tray.quit': 'Quit',
  'tray.tooltip': 'Inhaler Reminder',

  // --- Accessibility (screen readers only) ---
  'a11y.history': 'Adherence history for the last 14 days',
  'a11y.appearance': 'Appearance',
  'a11y.language': 'Interface language',
  'a11y.timeEarlier': '15 minutes earlier',
  'a11y.timeLater': '15 minutes later',
  'a11y.decrease': 'Decrease',
  'a11y.increase': 'Increase',
  'a11y.expandMorning': 'Morning reminder settings',
  'a11y.expandEvening': 'Evening reminder settings'
};
