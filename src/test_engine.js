const { parseAllEpisodes } = require('./parser');
const { findAllPromos } = require('./engine');

const eps = parseAllEpisodes('C:/Users/chand/.gemini/antigravity/scratch/kuku_promo_finder/data/scripts');
console.log('Parsed episodes:', eps.length);

const results = findAllPromos(eps);
console.log('Total Promos Found:', results.promos.length);
console.log('Continuous:', results.continuousCount, 'Multi-segment:', results.multiSegmentCount);

console.log('\n================ TOP 10 PROMOS ================');
results.promos.slice(0, 10).forEach((p, idx) => {
  console.log(`\nRANK #${idx + 1} | Score: ${p.totalScore} | Ep: ${p.episodeNumber} | Duration: ${p.totalDuration}s`);
  console.log('Archetype:', p.archetype);
  console.log('Hook:', p.hook);
  console.log('Cliffhanger:', p.cliffhanger);
  console.log('Segments:', p.segments.map(s => `[Ep ${s.episodeNumber}: ${s.start} -> ${s.end}] (${s.duration}s)`).join(' + '));
  console.log('Why it works:', p.whyItWorks);
});
