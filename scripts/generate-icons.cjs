/**
 * Generate PNG icons for Chrome Extension
 */

const fs = require('fs');
const path = require('path');

// Minimal valid PNG files with Elara brand color (#2ecc71 - green)
const icon16 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKklEQVQ4y2Nk' +
  'YGD4z0ABYKSqAUOJAaNg1IBRAwaCAaMGjBowYA0AAOgACwH8RRMAAAAASUVORK5CYII=',
  'base64'
);

const icon48 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAPklEQVRo3u3P' +
  'MQEAAAjDMKpf0xnBQwekkhLsOE8D0AJaQAtoAS2gBbSAFtACWkALaAEtoAW0' +
  'gBbQAgPoC0wEMCXXfAAAAABJRU5ErkJggg==',
  'base64'
);

const icon128 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAAUklEQVR42u3B' +
  'MQEAAAjDMKpf0xnBQwakkhTsOE8D0AJaQAtoAS2gBbSAFtACWkALaAEtoAW0' +
  'gBbQAlpAC2gBLaAFtIAW0AJaQAtoAS0wgL4ATAQwJdd8AAAAASUVORK5CYII=',
  'base64'
);

// Create icons in public/icons
const publicIcons = path.join(__dirname, '..', 'public', 'icons');

if (!fs.existsSync(publicIcons)) {
  fs.mkdirSync(publicIcons, { recursive: true });
}

fs.writeFileSync(path.join(publicIcons, 'icon16.png'), icon16);
fs.writeFileSync(path.join(publicIcons, 'icon48.png'), icon48);
fs.writeFileSync(path.join(publicIcons, 'icon128.png'), icon128);

console.log('Icons generated successfully in public/icons!');
