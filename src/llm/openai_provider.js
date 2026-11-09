const LLMProvider = require('./provider_interface');

class OpenAIProvider extends LLMProvider {
  constructor(config = {}) {
    super({
      name: 'openai',
      model: config.model || 'gpt-4o-mini',
      temperature: config.temperature ?? 0.2,
      max_tokens: config.max_tokens || 2048,
      pricing: { inputPer1k: 0.00015, outputPer1k: 0.0006 }, // gpt-4o-mini pricing
      ...config
    });
    this.apiKey = config.api_key || process.env.OPENAI_API_KEY || '';
    this.baseUrl = (config.base_url || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  }

  async _callRaw(prompt, options = {}) {
    const apiKey = options.apiKey || this.apiKey;
    const baseUrl = (options.baseUrl || this.baseUrl).replace(/\/+$/, '');
    const model = options.model || this.model;

    // For local proxies or Ollama compatibility, an API key might be optional or dummy
    if (!apiKey && !baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1')) {
      throw new Error('OpenAI API key is missing. Set it in Settings or OPENAI_API_KEY env variable.');
    }

    const url = `${baseUrl}/chat/completions`;
    const promptText = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);

    const body = {
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a high-performance screenplay intelligence system for vertical microdrama trailers. You must strictly output valid JSON.'
        },
        {
          role: 'user',
          content: promptText
        }
      ],
      temperature: options.temperature ?? this.temperature,
      max_tokens: options.max_tokens ?? this.maxTokens,
      response_format: { type: 'json_object' }
    };

    const headers = {
      'Content-Type': 'application/json'
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      let parsedMsg = errText;
      try {
        const errJson = JSON.parse(errText);
        parsedMsg = errJson.error?.message || errText;
      } catch (_) {}
      throw new Error(`OpenAI-compatible API Error (${res.status}): ${parsedMsg}`);
    }

    const json = await res.json();
    const choice = json.choices?.[0];
    if (!choice || !choice.message?.content) {
      throw new Error('OpenAI returned an empty completion response.');
    }

    const text = choice.message.content;
    const usage = json.usage || {};

    return {
      text,
      inputTokens: usage.prompt_tokens || Math.ceil(promptText.length / 4),
      outputTokens: usage.completion_tokens || Math.ceil(text.length / 4),
      raw: json
    };
  }
}

module.exports = OpenAIProvider;
