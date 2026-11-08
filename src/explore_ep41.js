const fs = require('fs');
const content41 = fs.readFileSync('C:/Users/chand/.gemini/antigravity/scratch/kuku_promo_finder/data/scripts/episode-041-Episode 1686801.txt', 'utf8');
const lines41 = content41.split('\n');
console.log('EPISODE 41 sample (first 60 lines of script):');
console.log(lines41.slice(0, 60).join('\n'));
console.log('\nEPISODE 41 sample (last 40 lines):');
console.log(lines41.slice(-40).join('\n'));
