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
ensureDir(path.join(BASE_DIR, 'data'));

// 1. Copy web/index.html
const indexSrc = path.join(BASE_DIR, 'web', 'index.html');
copyFile(indexSrc, path.join(PUBLIC_DIR, 'index.html'));
copyFile(indexSrc, path.join(DOCS_DIR, 'index.html'));
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
  copyFile(src, path.join(BASE_DIR, 'data', f));
});

// Also create a data_static/ directory for static servers opening root index.html
ensureDir(path.join(BASE_DIR, 'data_static'));
ensureDir(path.join(BASE_DIR, 'data_static', 'data'));
dataFiles.forEach(f => {
  copyFile(path.join(BASE_DIR, 'outputs', f), path.join(BASE_DIR, 'data_static', 'data', f));
});

// 3. Copy PDF and HTML solution doc
const pdfSrc = path.join(BASE_DIR, 'Kuku_Problem_1_Solution_Doc.pdf');
copyFile(pdfSrc, path.join(PUBLIC_DIR, 'Kuku_Problem_1_Solution_Doc.pdf'));
copyFile(pdfSrc, path.join(DOCS_DIR, 'Kuku_Problem_1_Solution_Doc.pdf'));

const docSrc = path.join(BASE_DIR, 'solution_doc.html');
copyFile(docSrc, path.join(PUBLIC_DIR, 'solution_doc.html'));
copyFile(docSrc, path.join(DOCS_DIR, 'solution_doc.html'));

const zipSrc = path.join(BASE_DIR, 'kuku_problem_1_outputs_pack.zip');
copyFile(zipSrc, path.join(PUBLIC_DIR, 'kuku_problem_1_outputs_pack.zip'));
copyFile(zipSrc, path.join(DOCS_DIR, 'kuku_problem_1_outputs_pack.zip'));

const docMdSrc = path.join(BASE_DIR, 'PROJECT_DOCUMENTATION.md');
copyFile(docMdSrc, path.join(PUBLIC_DIR, 'PROJECT_DOCUMENTATION.md'));
copyFile(docMdSrc, path.join(DOCS_DIR, 'PROJECT_DOCUMENTATION.md'));

console.log('\nDeployment assets ready in public/, docs/, and root!');
