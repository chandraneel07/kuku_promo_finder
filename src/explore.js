const fs = require('fs');
const path = require('path');

const scriptsDir = 'C:/Users/chand/.gemini/antigravity/scratch/kuku_promo_finder/data/scripts';
const testFiles = ['episode-001-Episode 1671703.txt', 'episode-003-Episode 1671705.txt', 'episode-012-Episode 1671714.txt', 'episode-041-Episode 1678594.txt', 'episode-042-Episode 1678595.txt'];

for (const tf of testFiles) {
  const p = path.join(scriptsDir, tf);
  if (!fs.existsSync(p)) continue;
  const content = fs.readFileSync(p, 'utf8');
  console.log('==================================================');
  console.log('FILE:', tf);
  const epMatch = content.match(/EPISODE NUMBER:\s*(.*)/);
  const logMatch = content.match(/EPISODE LOGLINE:\s*(.*)/);
  console.log('Episode:', epMatch ? epMatch[1] : 'N/A');
  console.log('Logline:', logMatch ? logMatch[1] : 'N/A');
  
  // Show scene headings
  const scenes = content.match(/SCENE \d+[\s\S]*?(?=SCENE \d+|--- SCRIPT END ---|$)/g);
  console.log('Scenes count:', scenes ? scenes.length : 0);
  if (scenes) {
    scenes.forEach(s => {
      const heading = (s.match(/Scene heading:\s*(.*)/) || [])[1] || '';
      const start = (s.match(/Scene start:\s*(.*)/) || [])[1] || '';
      const end = (s.match(/Scene end:\s*(.*)/) || [])[1] || '';
      console.log(`  Scene: "${heading}" [${start} -> ${end}]`);
    });
  }
}
