const LLMProvider = require('./provider_interface');

class GeminiProvider extends LLMProvider {
  constructor(config = {}) {
    super({
      name: 'gemini',
      model: config.model || 'gemini-2.0-flash',
      temperature: config.temperature ?? 0.2,
      max_tokens: config.max_tokens || 2048,
      pricing: { inputPer1k: 0.0001, outputPer1k: 0.0004 }, // Gemini Flash pricing
      ...config
    });
    this.apiKey = config.api_key || process.env.GEMINI_API_KEY || '';
  }

  async _callRaw(prompt, options = {}) {
    const apiKey = options.apiKey || this.apiKey;
    if (!apiKey) {
      throw new Error('Gemini API key is missing. Set it in Settings or GEMINI_API_KEY env variable.');
    }

    const model = options.model || this.model;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const promptText = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);

    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: promptText }]
        }
      ],
      generationConfig: {
        temperature: options.temperature ?? this.temperature,
        maxOutputTokens: options.max_tokens ?? this.maxTokens,
        responseMimeType: 'application/json'
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      let parsedMsg = errText;
      try {
        const errJson = JSON.parse(errText);
        parsedMsg = errJson.error?.message || errText;
      } catch (_) {}
      throw new Error(`Gemini API Error (${res.status}): ${parsedMsg}`);
    }

    const json = await res.json();
    const candidate = json.candidates?.[0];
    if (!candidate || !candidate.content?.parts?.[0]?.text) {
      throw new Error('Gemini returned an empty response candidate.');
    }

    const text = candidate.content.parts[0].text;
    const usage = json.usageMetadata || {};

    return {
      text,
      inputTokens: usage.promptTokenCount || Math.ceil(promptText.length / 4),
      outputTokens: usage.candidatesTokenCount || Math.ceil(text.length / 4),
      raw: json
    };
  }
}

module.exports = GeminiProvider;
