module.exports = {
  'app.name': 'Ингалятор',
  'app.fullName': 'Напоминание об ингаляторе',

  // --- Сегодня ---
  'today.label': 'Сегодня',
  'today.bothRemaining': 'Сегодня две дозы',
  'today.morningRemaining': 'Осталась утренняя доза',
  'today.eveningRemaining': 'Осталась вечерняя доза',
  'today.complete': 'Обе дозы приняты',
  'today.morningDone': 'Утренняя доза принята',
  'today.nothingScheduled': 'На сегодня напоминаний нет',
  'today.window': 'Напомним между {start} и {end}, когда вы будете за компьютером',
  'today.snoozed': 'Отложено — вернёмся через {duration}',
  'today.nextTomorrow': 'Следующее напоминание — завтра в {time}',
  'today.eveningOff': 'Вечернее напоминание выключено',
  'today.morningOff': 'Утреннее напоминание выключено',
  'today.allOff': 'Оба напоминания выключены',
  'today.reviewDay': 'День завершён',

  // --- История ---
  'history.title': 'Последние 14 дней',
  'history.of': 'из',
  'history.noData': 'пока нет данных',
  'history.morningRow': 'утро',
  'history.eveningRow': 'вечер',
  'history.missedDescription': 'Бывает. Можно отметить задним числом.',
  'history.mark': 'Отметить',
  'history.undo': 'Отменить',
  'history.backdatedTitle': 'Отмечено задним числом',
  'history.backdatedDescription': 'Запись сохранена в локальной истории.',
  'history.missedOn': '{dose}, {date} — пропущено',

  // Подписи строк расписания — с заглавной буквы.
  'status.confirmed': 'Принято',
  'status.confirmedAt': 'Принято в {time}',
  'status.pending': 'Ожидает',
  'status.missed': 'Пропущено',
  'status.disabled': 'Выключено',

  // Подсказки к точкам истории — со строчной, внутри фразы «14 авг · принято».
  'dot.confirmed': 'принято',
  'dot.pending': 'ожидает',
  'dot.missed': 'пропущено',
  'dot.disabled': 'выключено',
  'dot.unknown': 'нет данных',

  // --- Расписание ---
  'settings.schedule': 'Расписание',
  'settings.morning': 'Утро',
  'settings.evening': 'Вечер',
  'settings.from': 'Начало',
  'settings.to': 'Конец',
  'schedule.morningToggle': 'Напоминать утром',
  'schedule.eveningToggle': 'Напоминать вечером',

  // --- Напоминания ---
  'settings.notifications': 'Напоминания',
  'settings.snoozeShort': 'Отложить на',
  'settings.graceShort': 'Догонять в течение',
  'settings.graceHint': 'Напоминание ждёт, пока вы за компьютером. Если интервал прошёл без вас — придёт в течение этого времени, затем день тихо помечается как пропущенный.',

  // --- Приложение ---
  'settings.preferences': 'Приложение',
  'settings.sound': 'Звук',
  'settings.autostart': 'Запуск с Windows',
  'settings.appearance': 'Оформление',
  'settings.language': 'Язык',
  'appearance.system': 'Система',
  'appearance.light': 'Светлая',
  'appearance.dark': 'Тёмная',
  'settings.saved': 'Сохранено',
  'settings.minimizeHint': 'Закрытие сворачивает в трей',
  'settings.quit': 'Выйти',

  'units.minutes': 'мин',
  'units.hours': 'ч',
  'units.oneHour': '1 час',

  // --- Уведомление ---
  'notif.title': 'Пора использовать ингалятор',
  'notif.morning': 'Утренняя доза',
  'notif.evening': 'Вечерняя доза',
  'notif.body': 'Согласно назначению врача. Отметьте, когда сделаете.',
  'notif.confirm': 'Готово',
  'notif.snooze': 'Позже',
  'notif.doneAt': 'Отмечено в {time}',
  'notif.nextToday': 'Следующее напоминание — сегодня в {time}',
  'notif.nextTomorrow': 'Следующее напоминание — завтра в {time}',
  'notif.noNext': 'Больше напоминаний не запланировано',
  'notif.snoozedFor': 'Вернусь через {duration}',
  'notif.windowWillClose': 'Окно закроется само. Можно отметить приём и сейчас.',

  // --- Трей ---
  'tray.nextDose': 'Следующая доза',
  'tray.markNow': 'Отметить приём сейчас',
  'tray.settings': 'Настройки…',
  'tray.allDone': 'Все дозы отмечены',
  'tray.quit': 'Выйти',
  'tray.tooltip': 'Напоминание об ингаляторе',

  // --- Доступность (только для скринридеров) ---
  'a11y.history': 'История приёмов за последние 14 дней',
  'a11y.appearance': 'Оформление',
  'a11y.language': 'Язык интерфейса',
  'a11y.timeEarlier': 'Раньше на 15 минут',
  'a11y.timeLater': 'Позже на 15 минут',
  'a11y.decrease': 'Уменьшить',
  'a11y.increase': 'Увеличить',
  'a11y.expandMorning': 'Настройки утреннего напоминания',
  'a11y.expandEvening': 'Настройки вечернего напоминания'
};
