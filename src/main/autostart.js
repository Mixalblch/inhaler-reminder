const { app } = require('electron');

function setAutostart(enabled) {
  try {
    app.setLoginItemSettings({ openAtLogin: !!enabled });
  } catch (e) {
    console.error('setAutostart failed:', e);
  }
}

function getAutostart() {
  try {
    return !!app.getLoginItemSettings().openAtLogin;
  } catch (e) {
    return false;
  }
}

module.exports = { setAutostart, getAutostart };
