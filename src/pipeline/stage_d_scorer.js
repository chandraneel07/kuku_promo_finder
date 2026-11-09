const fs = require('fs');
const path = require('path');
const factory = require('../llm/factory');

class StageDScorer {
  constructor() {
    this.promptTemplatePath = path.join(__dirname, '..', '..', 'prompts', 'stage_d_scoring.md');
  }

  getPromptTemplate() {
    if (fs.existsSync(this.promptTemplatePath)) {
      return fs.readFileSync(this.promptTemplatePath, 'utf8');
    }
    return 'Score candidate {{candidate_id}} duration {{total_duration}}s excerpt: {{candidate_excerpt}}';
  }

  async scoreCandidate(candidate, showMeta = {}, weights = {}, options = {}) {
    const provider = factory.getProviderForStage('stage_d_scoring');

    const wHook = weights.hook ?? 30;
    const wCliff = weights.cliffhanger ?? 30;
    const wStand = weights.standalone ?? 25;
    const wInten = weights.intensity ?? 15;
    const wTotal = (wHook + wCliff + wStand + wInten) || 100;

    let template = this.getPromptTemplate();
    const prompt = template
      .replace(/{{show_title}}/g, showMeta.title || 'Microdrama Series')
      .replace(/{{candidate_id}}/g, candidate.id)
      .replace(/{{episodes_list}}/g, candidate.episodes.join(', '))
      .replace(/{{total_duration}}/g, String(candidate.duration))
      .replace(/{{strategy}}/g, candidate.strategy)
      .replace(/{{candidate_excerpt}}/g, candidate.excerpt.substring(0, 6000));

    const schema = {
      type: 'object',
      required: ['scores', 'archetype', 'why_it_works'],
      properties: {
        scores: {
          type: 'object',
          required: ['hook_strength', 'cliffhanger_suspense', 'standalone_coherence', 'emotional_intensity']
        },
        archetype: { type: 'string' },
        why_it_works: { type: 'string' }
      }
    };

    const res = await provider.generateJSON(prompt, schema, options);
    const evalData = res.data;

    const sHook = evalData.scores?.hook_strength ?? 75;
    const sCliff = evalData.scores?.cliffhanger_suspense ?? 75;
    const sStand = evalData.scores?.standalone_coherence ?? 75;
    const sInten = evalData.scores?.emotional_intensity ?? 75;

    // Deterministic formula in CODE
    const finalScore = Math.round(
      ((sHook * wHook + sCliff * wCliff + sStand * wStand + sInten * wInten) / wTotal) * 10
    ) / 10;

    return {
      candidate_id: candidate.id,
      final_score: finalScore,
      scores: {
        hook_strength: sHook,
        cliffhanger_suspense: sCliff,
        standalone_coherence: sStand,
        emotional_intensity: sInten
      },
      archetype: evalData.archetype || 'Dramatic Confrontation',
      hook: {
        text: evalData.hook_evaluation?.exact_hook_text || candidate.claimed_hook || 'Opening scene conflict',
        score: sHook,
        reason: evalData.hook_evaluation?.reason || 'Instant hook'
      },
      cliffhanger: {
        text: evalData.cliffhanger_evaluation?.exact_cut_text || candidate.claimed_cliff || 'Suspense cut',
        score: sCliff,
        reason: evalData.cliffhanger_evaluation?.reason || 'Open question'
      },
      standalone: evalData.standalone_evaluation || { score: sStand, reason: 'Self-contained' },
      why_it_works: evalData.why_it_works || 'High stakes confrontation with clean resolution cutoff.',
      tokens: res.tokens,
      fromCache: res.fromCache
    };
  }
}

module.exports = new StageDScorer();
