// Boots the app and insists it actually started.
//
//   npm run smoke
//
// Electron exits 0 when a second instance hands over to a running copy, so
// checking the exit code alone lets the smoke test pass without testing
// anything. This requires the app to announce itself.

const { spawn } = require('child_process');
const electron = require('electron');

const TIMEOUT_MS = 30000;
let output = '';

// Extra arguments are forwarded, so the check can be pointed at a scratch
// profile (--user-data-dir=...) while a real copy is running.
const child = spawn(electron, ['.', '--smoke'].concat(process.argv.slice(2)), {
  stdio: ['ignore', 'pipe', 'pipe']
});

const timer = setTimeout(function () {
  console.error('SMOKE FAILED: the app did not finish within ' + (TIMEOUT_MS / 1000) + 's');
  child.kill();
  process.exit(1);
}, TIMEOUT_MS);

function collect(chunk) {
  const text = String(chunk);
  output += text;
  process.stdout.write(text);
}

child.stdout.on('data', collect);
child.stderr.on('data', collect);

child.on('error', function (error) {
  clearTimeout(timer);
  console.error('SMOKE FAILED: could not launch Electron:', error.message);
  process.exit(1);
});

child.on('exit', function (code) {
  clearTimeout(timer);

  if (output.indexOf('SMOKE_SKIPPED') !== -1) {
    console.error('\nSMOKE FAILED: the app is already running, so nothing was tested.');
    console.error('Quit Inhaler Reminder from the tray and run this again.');
    process.exit(1);
  }

  if (output.indexOf('SMOKE_OK') === -1) {
    console.error('\nSMOKE FAILED: the app exited (' + code + ') without reporting a successful start.');
    process.exit(1);
  }

  if (code) {
    console.error('\nSMOKE FAILED: the app started but exited with code ' + code + '.');
    process.exit(1);
  }

  process.exit(0);
});
