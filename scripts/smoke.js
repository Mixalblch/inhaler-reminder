const { spawn } = require('child_process');
const electron = require('electron');
const child = spawn(electron, ['.', '--smoke'], { stdio: 'inherit' });
child.on('error', function (e) { console.error('spawn error', e); process.exit(1); });
child.on('exit', function (code) { process.exit(code == null ? 0 : code); });
