const promos = require('../outputs/promos_ranked.json');
console.log('Sample excerpt from continuous promo Rank #3:');
console.log(promos[2].scriptExcerpt.slice(0, 300));
console.log('\nSample excerpt from continuous promo Rank #5:');
console.log(promos[4].scriptExcerpt.slice(0, 300));

let minLines = 999;
let maxLines = 0;
promos.forEach(p => {
  const lines = (p.scriptExcerpt || '').split('\n').length;
  if (lines < minLines) minLines = lines;
  if (lines > maxLines) maxLines = lines;
});
console.log('\nMin lines in excerpt:', minLines, 'Max lines in excerpt:', maxLines);
