const promos = require('../outputs/promos_ranked.json');
console.log('Total promos:', promos.length);
let missingOrShort = 0;
promos.forEach((p, idx) => {
  const lineCount = (p.scriptExcerpt || '').split('\n').filter(Boolean).length;
  if (lineCount < 4) {
    missingOrShort++;
    if (missingOrShort <= 10) {
      console.log('Rank #' + p.rank + ' (' + p.promoId + ') lines: ' + lineCount);
      console.log('Excerpt preview:', p.scriptExcerpt);
    }
  }
});
console.log('Total missing or short excerpts (< 4 lines):', missingOrShort);
