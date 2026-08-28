const config = require('./config');

const SUPPORTED = ['ru', 'en', 'ja', 'zh'];

function loadLocale(locale) {
  const loc = SUPPORTED.indexOf(locale) !== -1 ? locale : 'ru';
  try {
    return require('../locales/' + loc + '.js');
  } catch (e) {
    return require('../locales/ru.js');
  }
}

function strings() {
  return loadLocale(config.get().locale);
}

module.exports = { strings: strings, loadLocale: loadLocale };
