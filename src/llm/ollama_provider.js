const LLMProvider = require('./provider_interface');

class OllamaProvider extends LLMProvider {
  constructor(config = {}) {
    super({
      name: 'ollama',
      model: config.model || 'llama3.2:3b',
      temperature: config.temperature ?? 0.2,
      pricing: { inputPer1k: 0.0, outputPer1k: 0.0 }, // Local model is free
      ...config
    });
    this.baseUrl = (config.base_url || process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, '');
  }

  async _callRaw(prompt, options = {}) {
    const baseUrl = (options.baseUrl || this.baseUrl).replace(/\/+$/, '');
    const model = options.model || this.model;
    const url = `${baseUrl}/api/generate`;

    const promptText = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);

    const body = {
      model,
      prompt: `${promptText}\n\nStrict output: Return valid JSON matching the requested schema.`,
      format: 'json',
      stream: false,
      options: {
        temperature: options.temperature ?? this.temperature
      }
    };

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (netErr) {
      throw new Error(`Could not connect to Ollama at ${baseUrl}. Is Ollama running? (${netErr.message})`);
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Ollama API Error (${res.status}): ${errText}`);
    }

    const json = await res.json();
    const text = json.response;
    if (!text) {
      throw new Error('Ollama returned empty response string.');
    }

    return {
      text,
      inputTokens: json.prompt_eval_count || Math.ceil(promptText.length / 4),
      outputTokens: json.eval_count || Math.ceil(text.length / 4),
      raw: json
    };
  }
}

module.exports = OllamaProvider;
