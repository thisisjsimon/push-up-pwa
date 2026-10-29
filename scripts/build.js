const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

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

function build() {
  console.log('Building web bundle into dist/ ...');
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  for (const file of filesToCopy) {
    const src = path.join(rootDir, file);
    const dest = path.join(distDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`Copied ${file}`);
    } else {
      console.warn(`File not found: ${file}`);
    }
  }

  for (const dir of dirsToCopy) {
    const src = path.join(rootDir, dir);
    const dest = path.join(distDir, dir);
    if (fs.existsSync(src)) {
      fs.cpSync(src, dest, { recursive: true });
      console.log(`Copied ${dir}/`);
    } else {
      console.warn(`Directory not found: ${dir}`);
    }
  }

  console.log('Build completed successfully.');
}

build();
