const cache = require('./cache');

class LLMProvider {
  constructor(config = {}) {
    this.config = config;
    this.name = config.name || 'base';
    this.model = config.model || 'default';
    this.temperature = config.temperature ?? 0.2;
    this.maxTokens = config.max_tokens || 2048;
    this.pricing = config.pricing || { inputPer1k: 0.0001, outputPer1k: 0.0004 }; // default cheap rates
  }

  /**
   * Abstract call implemented by subclasses:
   * Returns: { text: string, inputTokens?: number, outputTokens?: number, raw?: any }
   */
  async _callRaw(prompt, options = {}) {
    throw new Error(`_callRaw() not implemented by ${this.constructor.name}`);
  }

  /**
   * Main entrypoint with schema validation, auto-retry, and hash-based caching
   */
  async generateJSON(prompt, schema = null, options = {}) {
    const useCache = options.useCache !== false;
    const maxRetries = options.maxRetries ?? 2;
    const model = options.model || this.model;
    const cacheKey = cache.generateKey(model, prompt, schema, {
      temperature: options.temperature ?? this.temperature
    });

    if (useCache) {
      const cached = cache.get(cacheKey);
      if (cached && cached.data) {
        return {
          ...cached,
          fromCache: true
        };
      }
    }

    let currentPrompt = prompt;
    let lastError = null;
    let accumulatedTokens = { input: 0, output: 0, cost: 0 };

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const rawRes = await this._callRaw(currentPrompt, { ...options, model });
        
        const inTokens = rawRes.inputTokens || Math.ceil(JSON.stringify(currentPrompt).length / 4);
        const outTokens = rawRes.outputTokens || Math.ceil((rawRes.text || '').length / 4);
        accumulatedTokens.input += inTokens;
        accumulatedTokens.output += outTokens;
        accumulatedTokens.cost += this.calculateCost(inTokens, outTokens);

        // Parse JSON (strip markdown code fences if present)
        let cleaned = (rawRes.text || '').trim();
        if (cleaned.startsWith('```json')) {
          cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
        } else if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        let parsed;
        try {
          parsed = JSON.parse(cleaned);
        } catch (jsonErr) {
          throw new Error(`Invalid JSON output: ${jsonErr.message}. Output was: ${cleaned.substring(0, 150)}...`);
        }

        // Schema validation
        if (schema) {
          const validation = this.validateSchema(parsed, schema);
          if (!validation.valid) {
            throw new Error(`Schema validation failed: ${validation.errors.join('; ')}`);
          }
        }

        const result = {
          data: parsed,
          model,
          tokens: accumulatedTokens,
          attempts: attempt + 1,
          fromCache: false
        };

        if (useCache) {
          cache.set(cacheKey, result);
        }

        return result;
      } catch (err) {
        lastError = err;
        console.warn(`[${this.name}] Attempt ${attempt + 1}/${maxRetries + 1} failed: ${err.message}`);

        if (attempt < maxRetries) {
          // Feed the error and invalid response back into the prompt
          currentPrompt = `${prompt}\n\n[PREVIOUS ATTEMPT RETURNED AN ERROR: ${err.message}. Please strictly return valid JSON matching the exact schema without extra conversational commentary.]`;
        }
      }
    }

    throw new Error(`[${this.name}] Failed after ${maxRetries + 1} attempts. Last error: ${lastError.message}`);
  }

  validateSchema(data, schema) {
    const errors = [];
    if (!schema || typeof schema !== 'object') return { valid: true };

    if (schema.type === 'object') {
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        errors.push(`Expected object, got ${Array.isArray(data) ? 'array' : typeof data}`);
        return { valid: false, errors };
      }
      if (schema.required && Array.isArray(schema.required)) {
        for (const reqKey of schema.required) {
          if (data[reqKey] === undefined) {
            errors.push(`Missing required property: '${reqKey}'`);
          }
        }
      }
      if (schema.properties) {
        for (const [propKey, propSchema] of Object.entries(schema.properties)) {
          if (data[propKey] !== undefined) {
            const sub = this.validateSchema(data[propKey], propSchema);
            if (!sub.valid) {
              errors.push(...sub.errors.map(e => `${propKey}.${e}`));
            }
          }
        }
      }
    } else if (schema.type === 'array') {
      if (!Array.isArray(data)) {
        errors.push(`Expected array, got ${typeof data}`);
        return { valid: false, errors };
      }
      if (schema.items && data.length > 0) {
        for (let i = 0; i < Math.min(data.length, 3); i++) {
          const sub = this.validateSchema(data[i], schema.items);
          if (!sub.valid) {
            errors.push(...sub.errors.map(e => `[${i}].${e}`));
          }
        }
      }
    } else if (schema.type === 'string') {
      if (typeof data !== 'string') errors.push(`Expected string, got ${typeof data}`);
    } else if (schema.type === 'number') {
      if (typeof data !== 'number' || isNaN(data)) errors.push(`Expected number, got ${typeof data}`);
    } else if (schema.type === 'boolean') {
      if (typeof data !== 'boolean') errors.push(`Expected boolean, got ${typeof data}`);
    }

    return { valid: errors.length === 0, errors };
  }

  calculateCost(inTokens, outTokens) {
    const inCost = (inTokens / 1000) * (this.pricing.inputPer1k || 0.0001);
    const outCost = (outTokens / 1000) * (this.pricing.outputPer1k || 0.0004);
    return Math.round((inCost + outCost) * 100000) / 100000;
  }
}

module.exports = LLMProvider;
