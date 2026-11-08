const fs = require('fs');
const path = require('path');

const BASE_DIR = __dirname;
const PUBLIC_DIR = path.join(BASE_DIR, 'public');
const DOCS_DIR = path.join(BASE_DIR, 'docs');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied: ${path.relative(BASE_DIR, src)} -> ${path.relative(BASE_DIR, dest)}`);
  }
}

console.log('Preparing deployment assets for Vercel, Netlify, and GitHub Pages...');

// Create directories
ensureDir(PUBLIC_DIR);
ensureDir(path.join(PUBLIC_DIR, 'data'));
ensureDir(DOCS_DIR);
ensureDir(path.join(DOCS_DIR, 'data'));

// 1. Copy web/index.html
const indexSrc = path.join(BASE_DIR, 'web', 'index.html');
copyFile(indexSrc, path.join(PUBLIC_DIR, 'index.html'));
copyFile(indexSrc, path.join(DOCS_DIR, 'index.html'));

// Also copy index.html to root so any static server pointing to root works directly
copyFile(indexSrc, path.join(BASE_DIR, 'index.html'));

// 2. Copy data files
const dataFiles = [
  'promos_ranked.json',
  'quality_check_report.json',
  'promos_ranked.csv',
  'promos_all.json'
];

dataFiles.forEach(f => {
  const src = path.join(BASE_DIR, 'outputs', f);
  copyFile(src, path.join(PUBLIC_DIR, 'data', f));
  copyFile(src, path.join(DOCS_DIR, 'data', f));
});

// Also create a root data/ directory for static servers opening root index.html
ensureDir(path.join(BASE_DIR, 'data_static'));
ensureDir(path.join(BASE_DIR, 'data_static', 'data'));
dataFiles.forEach(f => {
  copyFile(path.join(BASE_DIR, 'outputs', f), path.join(BASE_DIR, 'data_static', 'data', f));
});

// 3. Copy PDF
const pdfSrc = path.join(BASE_DIR, 'Kuku_Problem_1_Solution_Doc.pdf');
copyFile(pdfSrc, path.join(PUBLIC_DIR, 'Kuku_Problem_1_Solution_Doc.pdf'));
copyFile(pdfSrc, path.join(DOCS_DIR, 'Kuku_Problem_1_Solution_Doc.pdf'));

console.log('\nDeployment assets ready in public/, docs/, and root!');
