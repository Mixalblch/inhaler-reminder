const config = require('./config');

function loadLocale(locale) {
  const loc = (locale === 'en') ? 'en' : 'ru';
  try {
    return require('../locales/' + loc + '.js');
  } catch (e) {
    return require('../locales/ru.js');
  }
}

function strings() {
  return loadLocale(config.get().locale);
}

module.exports = { strings, loadLocale };
