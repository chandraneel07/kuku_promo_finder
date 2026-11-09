const LLMProvider = require('./provider_interface');

class AnthropicProvider extends LLMProvider {
  constructor(config = {}) {
    super({
      name: 'anthropic',
      model: config.model || 'claude-3-5-sonnet-20241022',
      temperature: config.temperature ?? 0.2,
      max_tokens: config.max_tokens || 2048,
      pricing: { inputPer1k: 0.003, outputPer1k: 0.015 },
      ...config
    });
    this.apiKey = config.api_key || process.env.ANTHROPIC_API_KEY || '';
  }

  async _callRaw(prompt, options = {}) {
    const apiKey = options.apiKey || this.apiKey;
    if (!apiKey) {
      throw new Error('Anthropic API key is missing. Set it in Settings or ANTHROPIC_API_KEY env variable.');
    }

    const model = options.model || this.model;
    const url = 'https://api.anthropic.com/v1/messages';
    const promptText = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);

    const body = {
      model,
      max_tokens: options.max_tokens ?? this.maxTokens,
      temperature: options.temperature ?? this.temperature,
      system: 'You are an expert microdrama screenplay promo discoverer. Respond ONLY with valid, parseable JSON conforming to the requested schema. Do not enclose in markdown ticks if possible, or use standard ```json blocks.',
      messages: [
        {
          role: 'user',
          content: `${promptText}\n\nStrict requirement: Output pure JSON only.`
        }
      ]
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      let parsedMsg = errText;
      try {
        const errJson = JSON.parse(errText);
        parsedMsg = errJson.error?.message || errText;
      } catch (_) {}
      throw new Error(`Anthropic API Error (${res.status}): ${parsedMsg}`);
    }

    const json = await res.json();
    const textPart = json.content?.find(c => c.type === 'text');
    if (!textPart || !textPart.text) {
      throw new Error('Anthropic returned an empty message text part.');
    }

    const text = textPart.text;
    const usage = json.usage || {};

    return {
      text,
      inputTokens: usage.input_tokens || Math.ceil(promptText.length / 4),
      outputTokens: usage.output_tokens || Math.ceil(text.length / 4),
      raw: json
    };
  }
}

module.exports = AnthropicProvider;
