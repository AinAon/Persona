const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'mobile-web');

const files = [
  'index.html',
  'user.html',
  'emotion-manager.html',
  'emotion-prompts.ko.js',
  'icon.png',
  'icon_emo.png',
];

const dirs = [
  'assets',
  'js',
];

function copyFile(rel) {
  const src = path.join(root, rel);
  const dest = path.join(out, rel);
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(rel) {
  const src = path.join(root, rel);
  const dest = path.join(out, rel);
  if (!fs.existsSync(src)) return;
  fs.cpSync(src, dest, { recursive: true });
}

fs.mkdirSync(out, { recursive: true });
files.forEach(copyFile);
dirs.forEach(copyDir);

console.log(`Prepared mobile web assets in ${out}`);
