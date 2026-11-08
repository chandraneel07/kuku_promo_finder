const fs = require('fs');
const content42 = fs.readFileSync('C:/Users/chand/.gemini/antigravity/scratch/kuku_promo_finder/data/scripts/episode-042-Episode 1686802.txt', 'utf8');
const lines42 = content42.split('\n');
console.log('EPISODE 42 sample (first 60 lines of script):');
console.log(lines42.slice(0, 60).join('\n'));
