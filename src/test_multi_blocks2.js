const { parseAllEpisodes } = require('./parser');
const eps = parseAllEpisodes('C:/Users/chand/.gemini/antigravity/scratch/kuku_promo_finder/data/scripts');

const ep1 = eps.find(e => e.episodeNumber === 1);
const ep3 = eps.find(e => e.episodeNumber === 3);
const ep12 = eps.find(e => e.episodeNumber === 12);

console.log('EPISODE 1 (110.0 to 137.0):');
const b1 = ep1.scenes[0].blocks.filter(b => b.startSec < 138.0 && b.endSec > 110.0);
b1.forEach(b => console.log(`  [${b.startStr}-${b.endStr}] ${b.rawHeader}: ${b.text.slice(0, 80)}`));

console.log('\nEPISODE 3 (118.0 to 145.75):');
// ep3 has 3 scenes, let's find which scene has blocks around 118-146s
let b3 = [];
ep3.scenes.forEach(s => {
  s.blocks.filter(b => b.startSec < 146.0 && b.endSec > 118.0).forEach(b => b3.push(b));
});
b3.forEach(b => console.log(`  [${b.startStr}-${b.endStr}] ${b.rawHeader}: ${b.text.slice(0, 80)}`));

console.log('\nEPISODE 12 (15.0 to 38.0 and 58.0 to 87.2):');
const b12_1 = ep12.scenes[0].blocks.filter(b => b.startSec < 38.0 && b.endSec > 15.0);
const b12_2 = ep12.scenes[0].blocks.filter(b => b.startSec < 87.3 && b.endSec > 58.0);
console.log('Seg 1 count:', b12_1.length, 'Seg 2 count:', b12_2.length);
