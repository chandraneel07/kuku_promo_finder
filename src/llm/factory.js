const fs = require('fs');
const path = require('path');
const MockProvider = require('./mock_provider');
const GeminiProvider = require('./gemini_provider');
const OpenAIProvider = require('./openai_provider');
const AnthropicProvider = require('./anthropic_provider');
const OllamaProvider = require('./ollama_provider');

class LLMFactory {
  constructor() {
    this.settingsPath = path.join(__dirname, '..', '..', 'data', 'settings.json');
    this.instances = new Map();
  }

  getSettings() {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const raw = fs.readFileSync(this.settingsPath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[LLMFactory] Could not load settings, using defaults:', e.message);
    }
    return {
      active_provider: 'mock',
      providers: {
        mock: { id: 'mock', name: 'Offline Deterministic Mock', enabled: true },
        gemini: { id: 'gemini', name: 'Google Gemini', enabled: true, model: 'gemini-2.0-flash' },
        openai: { id: 'openai', name: 'OpenAI / Compatible', enabled: false, model: 'gpt-4o-mini' },
        anthropic: { id: 'anthropic', name: 'Anthropic Claude', enabled: false, model: 'claude-3-5-sonnet-20241022' },
        ollama: { id: 'ollama', name: 'Local Ollama', enabled: false, model: 'llama3.2:3b' }
      }
    };
  }

  saveSettings(newSettings) {
    try {
      const dir = path.dirname(this.settingsPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.settingsPath, JSON.stringify(newSettings, null, 2), 'utf8');
      this.instances.clear(); // invalidate cached instances
      return true;
    } catch (e) {
      console.error('[LLMFactory] Failed to save settings:', e.message);
      return false;
    }
  }

  createProvider(providerId, customConfig = {}) {
    const settings = this.getSettings();
    const providerConfig = {
      ...(settings.providers?.[providerId] || {}),
      ...customConfig
    };

    switch (providerId.toLowerCase()) {
      case 'mock':
        return new MockProvider(providerConfig);
      case 'gemini':
        return new GeminiProvider(providerConfig);
      case 'openai':
        return new OpenAIProvider(providerConfig);
      case 'anthropic':
        return new AnthropicProvider(providerConfig);
      case 'ollama':
        return new OllamaProvider(providerConfig);
      default:
        console.warn(`[LLMFactory] Unknown provider '${providerId}', falling back to Mock.`);
        return new MockProvider(providerConfig);
    }
  }

  /**
   * Get provider for a specific pipeline stage (supports stage-specific model routing)
   */
  getProviderForStage(stageName) {
    const settings = this.getSettings();
    const activeProviderId = settings.active_provider || 'mock';

    // Check if stage has a specific model assigned
    let stageModel = null;
    if (settings.stage_models && settings.stage_models[stageName]) {
      stageModel = settings.stage_models[stageName];
    }

    const cacheKey = `${activeProviderId}_${stageModel || 'default'}`;
    if (!this.instances.has(cacheKey)) {
      const provider = this.createProvider(activeProviderId, stageModel ? { model: stageModel } : {});
      this.instances.set(cacheKey, provider);
    }

    return this.instances.get(cacheKey);
  }

  /**
   * Ping/test provider connection
   */
  async testConnection(providerId, customConfig = {}) {
    const startTime = Date.now();
    try {
      const provider = this.createProvider(providerId, customConfig);
      const res = await provider.generateJSON(
        'PING_TEST: Return a JSON object with {"status": "ok", "provider": "' + providerId + '"} to verify credentials and connectivity.',
        {
          type: 'object',
          required: ['status']
        },
        { useCache: false, maxRetries: 1 }
      );
      const latencyMs = Date.now() - startTime;
      return {
        success: true,
        provider: providerId,
        model: provider.model,
        latencyMs,
        data: res.data,
        tokens: res.tokens
      };
    } catch (err) {
      return {
        success: false,
        provider: providerId,
        latencyMs: Date.now() - startTime,
        error: err.message
      };
    }
  }
}

module.exports = new LLMFactory();
