const { app } = require('electron');

// Launching at login should land the app in the tray, not pop the settings
// window in the user's face — hence `--hidden`.
//
// A portable build runs from a temp unpack directory, so the login entry has to
// point at the original .exe that PORTABLE_EXECUTABLE_FILE reports. In dev the
// executable is Electron itself, so the app path has to be passed along.
function launchSpec() {
  const executable = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
  const args = app.isPackaged ? ['--hidden'] : ['"' + app.getAppPath() + '"', '--hidden'];
  return { path: executable, args: args };
}

function setAutostart(enabled) {
  try {
    const spec = launchSpec();
    app.setLoginItemSettings({ openAtLogin: !!enabled, path: spec.path, args: spec.args });
  } catch (e) {
    console.error('setAutostart failed:', e);
  }
}

function getAutostart() {
  try {
    const spec = launchSpec();
    return !!app.getLoginItemSettings({ path: spec.path, args: spec.args }).openAtLogin;
  } catch (e) {
    return false;
  }
}

module.exports = { setAutostart, getAutostart, _launchSpec: launchSpec };
