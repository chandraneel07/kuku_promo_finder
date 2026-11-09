const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class LLMCache {
  constructor(cacheDir) {
    this.cacheDir = cacheDir || path.join(__dirname, '..', '..', 'data', 'cache', 'llm');
    this.ensureDir();
  }

  ensureDir() {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
    } catch (e) {
      console.warn('[LLMCache] Could not create cache directory:', e.message);
    }
  }

  generateKey(model, prompt, schema = null, options = {}) {
    const payload = JSON.stringify({
      model: model || 'default',
      prompt: typeof prompt === 'string' ? prompt : JSON.stringify(prompt),
      schema: schema || null,
      temperature: options.temperature ?? 0.2
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  get(key) {
    try {
      const filePath = path.join(this.cacheDir, `${key}.json`);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn(`[LLMCache] Error reading cache key ${key}:`, e.message);
    }
    return null;
  }

  set(key, value) {
    try {
      this.ensureDir();
      const filePath = path.join(this.cacheDir, `${key}.json`);
      fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
    } catch (e) {
      console.warn(`[LLMCache] Error writing cache key ${key}:`, e.message);
    }
  }

  clear() {
    try {
      if (fs.existsSync(this.cacheDir)) {
        const files = fs.readdirSync(this.cacheDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            fs.unlinkSync(path.join(this.cacheDir, file));
          }
        }
      }
    } catch (e) {
      console.warn('[LLMCache] Error clearing cache:', e.message);
    }
  }
}

module.exports = new LLMCache();
