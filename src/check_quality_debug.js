const { parseAllEpisodes } = require('./parser');
const { findAllPromos } = require('./engine');

const eps = parseAllEpisodes('C:/Users/chand/.gemini/antigravity/scratch/kuku_promo_finder/data/scripts');
const { promos } = findAllPromos(eps);

console.log('Inspecting potential quality issues across', promos.length, 'promos...\n');

const issues = {
  loreHeavy: [],
  shortDuration: [],
  weakCliffhanger: [],
  monologueHeavy: [],
  vagueHook: []
};

promos.forEach((p, idx) => {
  const text = (p.hook + ' ' + p.cliffhanger + ' ' + (p.scriptExcerpt || '')).toLowerCase();

  // 1. Check for obscure secondary character names without protagonist
  const obscureChars = ['seamus', 'vaughn', 'constable', 'father thomas', 'scout', 'driver'];
  const hasObscure = obscureChars.some(c => text.includes(c));
  const hasLead = text.includes('juliana') || text.includes('alexander') || text.includes('gerald') || text.includes('catherine');
  if (hasObscure && !hasLead) {
    issues.loreHeavy.push({ rank: idx + 1, id: p.id, ep: p.episodeNumber, reason: 'Obscure secondary lore without main leads' });
  }

  // 2. Short duration (<25s) risk
  if (p.totalDuration < 25.0) {
    issues.shortDuration.push({ rank: idx + 1, id: p.id, ep: p.episodeNumber, duration: p.totalDuration, reason: 'Under 25s: may lack narrative runway' });
  }

  // 3. Vague Hook
  if (p.hook.length < 25 || p.hook.includes('Dramatic opening scene setup')) {
    issues.vagueHook.push({ rank: idx + 1, id: p.id, ep: p.episodeNumber, hook: p.hook, reason: 'Weak or generic opening hook' });
  }

  // 4. Weak Cliffhanger
  if (p.cliffhangerScore < 12) {
    issues.weakCliffhanger.push({ rank: idx + 1, id: p.id, ep: p.episodeNumber, cliff: p.cliffhanger, reason: 'Low unresolved tension at cut' });
  }
});

console.log('Quality Check Summary:');
console.log('- Obscure Lore Traps:', issues.loreHeavy.length);
console.log('- Ultra-short Promos (<25s):', issues.shortDuration.length);
console.log('- Vague Hooks:', issues.vagueHook.length);
console.log('- Weak Cliffhangers:', issues.weakCliffhanger.length);

console.log('\nSample Lore-Heavy Candidates (False Positives):');
issues.loreHeavy.slice(0, 5).forEach(i => console.log(`  Rank #${i.rank} (${i.id}): ${i.reason}`));

console.log('\nSample Ultra-Short Candidates:');
issues.shortDuration.slice(0, 5).forEach(i => console.log(`  Rank #${i.rank} (${i.id}) [${i.duration}s]: ${i.reason}`));
