const { parseAllEpisodes } = require('./parser');
const eps = parseAllEpisodes('C:/Users/chand/.gemini/antigravity/scratch/kuku_promo_finder/data/scripts');

const ep41 = eps.find(e => e.episodeNumber === 41);
const ep42 = eps.find(e => e.episodeNumber === 42);

console.log('EPISODE 41 (01:17.50 to 01:36.09):');
const b41 = ep41.scenes[0].blocks.filter(b => b.startSec < 96.1 && b.endSec > 77.0);
b41.forEach(b => console.log(`  [${b.startStr}-${b.endStr}] ${b.rawHeader}: ${b.text.slice(0, 90)}`));

console.log('\nEPISODE 42 (00:00.00 to 00:23.40):');
const b42 = ep42.scenes[0].blocks.filter(b => b.startSec < 23.5 && b.endSec >= 0);
b42.forEach(b => console.log(`  [${b.startStr}-${b.endStr}] ${b.rawHeader}: ${b.text.slice(0, 90)}`));
