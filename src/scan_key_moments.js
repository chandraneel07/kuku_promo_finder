const { parseAllEpisodes } = require('./parser');
const eps = parseAllEpisodes('C:/Users/chand/.gemini/antigravity/scratch/kuku_promo_finder/data/scripts');

const keyEpisodes = [1, 2, 3, 5, 7, 10, 12, 13, 16, 18, 22, 28, 31, 32, 34, 39, 41, 42, 45, 47, 50];

console.log('--- SCANNING KEY EPISODES FOR DRAMATIC CLIMAXES ---');
keyEpisodes.forEach(epNum => {
  const ep = eps.find(e => e.episodeNumber === epNum);
  if (!ep) return;
  console.log(`\nEPISODE ${epNum} (${ep.durationStr}): ${ep.logline}`);
  ep.scenes.forEach(s => {
    // Find sound fx or high emotion blocks
    const highlights = s.blocks.filter(b => {
      const txt = (b.text + ' ' + (b.rawHeader || '')).toLowerCase();
      return b.type === 'SOUND_FX' || txt.includes('cliffhanger') || txt.includes('cut to black') || txt.includes('explosion') || txt.includes('slap') || txt.includes('kneel') || txt.includes('briar') || txt.includes('iron') || txt.includes('we will not');
    });
    if (highlights.length > 0) {
      console.log(`  Scene ${s.sceneNumber} (${s.startStr} - ${s.endStr}) Highlights:`);
      highlights.slice(0, 3).forEach(h => console.log(`    [${h.startStr} - ${h.endStr}] ${h.rawHeader}: ${h.text.slice(0, 80)}`));
    }
  });
});
