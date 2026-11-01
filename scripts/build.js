const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const publicDir = path.join(rootDir, 'public');

const filesToCopy = [
  'index.html',
  'app.js',
  'styles.css',
  'emom-timer.js',
  'emom-timer.svg',
  'favicon.png',
  'apple-touch-icon.png',
  'manifest.json',
  'sw.js'
];

const dirsToCopy = [
  'icons',
  'vendor'
];

function copyToTarget(targetDir) {
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(targetDir, { recursive: true });

  for (const file of filesToCopy) {
    const src = path.join(rootDir, file);
    const dest = path.join(targetDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    } else {
      console.warn(`File not found: ${file}`);
    }
  }

  for (const dir of dirsToCopy) {
    const src = path.join(rootDir, dir);
    const dest = path.join(targetDir, dir);
    if (fs.existsSync(src)) {
      fs.cpSync(src, dest, { recursive: true });
    } else {
      console.warn(`Directory not found: ${dir}`);
    }
  }
}

function build() {
  console.log('Building web bundle into dist/ and public/ ...');
  copyToTarget(distDir);
  copyToTarget(publicDir);
  console.log('Build completed successfully.');
}

build();
