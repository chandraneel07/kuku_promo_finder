const fs = require('fs');
const path = require('path');
const factory = require('../llm/factory');

class StageBAnalyzer {
  constructor() {
    this.promptTemplatePath = path.join(__dirname, '..', '..', 'prompts', 'stage_b_episode_analysis.md');
  }

  getPromptTemplate() {
    if (fs.existsSync(this.promptTemplatePath)) {
      return fs.readFileSync(this.promptTemplatePath, 'utf8');
    }
    return 'Analyze Episode {{episode_number}} of {{show_title}}. Rolling context: {{rolling_context}}. Script: {{screenplay_text}}';
  }

  async analyzeEpisode(parsedEp, showMeta = {}, rollingContext = 'First episode of the season.', options = {}) {
    const provider = factory.getProviderForStage('stage_b_analysis');

    // Build raw screenplay text representation for the LLM
    let scriptText = '';
    for (const sc of (parsedEp.scenes || [])) {
      scriptText += `\n[${sc.heading || sc.scene_id}] (Start: ${sc.scene_start_ts || '00:00'}, End: ${sc.scene_end_ts || '01:00'})\n`;
      for (const b of (sc.blocks || [])) {
        if (b.type === 'dialogue') {
          scriptText += `${b.speaker}: "${b.text}" (${b.start}s - ${b.end}s)\n`;
        } else if (b.type === 'camera') {
          scriptText += `[CAMERA: ${b.camera}] (${b.start}s)\n`;
        } else {
          scriptText += `[ACTION: ${b.action || b.text}] (${b.start}s)\n`;
        }
      }
    }

    let template = this.getPromptTemplate();
    const prompt = template
      .replace(/{{show_title}}/g, showMeta.title || 'Microdrama Series')
      .replace(/{{target_market}}/g, showMeta.target_market || 'Global Vertical Audiences')
      .replace(/{{episode_number}}/g, String(parsedEp.episode))
      .replace(/{{rolling_context}}/g, rollingContext)
      .replace(/{{screenplay_text}}/g, scriptText.trim().substring(0, 8000));

    const schema = {
      type: 'object',
      required: ['episode', 'summary', 'key_moments'],
      properties: {
        episode: { type: 'number' },
        summary: { type: 'string' },
        characters: { type: 'array' },
        key_moments: { type: 'array' },
        rolling_context_notes: { type: 'string' }
      }
    };

    const res = await provider.generateJSON(prompt, schema, options);
    return {
      episode: parsedEp.episode,
      analysis: res.data,
      tokens: res.tokens,
      fromCache: res.fromCache
    };
  }
}

module.exports = new StageBAnalyzer();
