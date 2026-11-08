const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function run() {
  try {
    const html = await fetchUrl('https://kuku.app');
    const cssMatches = [...html.matchAll(/href="(\/_next\/static\/css\/[^"]+\.css)"/g)].map(m => m[1]);
    console.log('CSS files:', cssMatches);
    
    // Check Next.js font variables in html
    const fontVars = html.match(/__variable_[a-z0-9]+/g);
    console.log('Font variables in HTML:', fontVars);

    // Look for colors, font families in HTML body/next data
    const colorHexes = [...html.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map(m => m[0]);
    console.log('Unique Hex colors in HTML:', [...new Set(colorHexes)].slice(0, 25));

    for (const cssPath of cssMatches) {
      const css = await fetchUrl('https://kuku.app' + cssPath);
      console.log('\n--- Checking CSS:', cssPath, 'Length:', css.length);
      const fonts = css.match(/font-family:[^;}]+/g);
      if (fonts) console.log('Fonts found:', [...new Set(fonts)].slice(0, 10));
      
      const rootVars = css.match(/--[a-zA-Z0-9_-]+:[^;]+/g);
      if (rootVars) console.log('Variables sample:', [...new Set(rootVars)].slice(0, 20));

      const hexes = [...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map(m => m[0]);
      console.log('Sample Hex colors in CSS:', [...new Set(hexes)].slice(0, 20));
    }
  } catch (err) {
    console.error('Error fetching kuku.app:', err);
  }
}

run();
