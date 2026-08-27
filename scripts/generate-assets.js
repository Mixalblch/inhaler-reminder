const { spawnSync } = require('child_process');
const path = require('path');
const electron = require('electron');

const result = spawnSync(electron, [path.join(__dirname, 'render-icon.js')], { stdio: 'inherit' });
process.exit(result.status == null ? 1 : result.status);
