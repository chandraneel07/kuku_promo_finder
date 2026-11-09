const LLMProvider = require('./provider_interface');

class MockProvider extends LLMProvider {
  constructor(config = {}) {
    super({
      name: 'mock',
      model: 'deterministic-heuristic-v1',
      temperature: 0,
      pricing: { inputPer1k: 0.0, outputPer1k: 0.0 },
      ...config
    });
  }

  async _callRaw(prompt, options = {}) {
    // Artificial slight delay for realistic UI responsiveness (10-30ms)
    await new Promise(r => setTimeout(r, 20));

    const promptStr = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
    const lower = promptStr.toLowerCase();

    // 1. Connection test ping
    if (lower.includes('ping_test') || lower.includes('test connection')) {
      return {
        text: JSON.stringify({
          status: 'ok',
          provider: 'mock',
          model: this.model,
          message: 'Offline Deterministic Mock provider ready. Zero API key required.'
        }),
        inputTokens: 25,
        outputTokens: 30
      };
    }

    // 2. Stage B: Episode Analysis
    if (lower.includes('stage b') || lower.includes('episode dramatic analysis') || lower.includes('episode analysis')) {
      return this._mockStageB(promptStr);
    }

    // 3. Stage C: Candidate Assembly
    if (lower.includes('stage c') || lower.includes('candidate assembly') || lower.includes('candidate promo assembly')) {
      return this._mockStageC(promptStr);
    }

    // 4. Stage D: Scoring
    if (lower.includes('stage d') || lower.includes('structured promo scoring') || lower.includes('score candidate')) {
      return this._mockStageD(promptStr);
    }

    // 5. Stage F: Quality Audit
    if (lower.includes('stage f') || lower.includes('quality audit') || lower.includes('audit candidate')) {
      return this._mockStageF(promptStr);
    }

    // Generic fallback mock
    return {
      text: JSON.stringify({
        status: 'success',
        result: 'Mock response generated successfully',
        timestamp: new Date().toISOString()
      }),
      inputTokens: 50,
      outputTokens: 40
    };
  }

  _mockStageB(promptStr) {
    // Extract episode number if present
    const epMatch = promptStr.match(/Episode\s*#?(\d+)/i) || promptStr.match(/"episode":\s*(\d+)/i);
    const epNum = epMatch ? parseInt(epMatch[1], 10) : 1;

    const data = {
      episode: epNum,
      summary: `Episode ${epNum} escalates key conflicts between protagonist and antagonists with immediate emotional stakes.`,
      characters: ['Juliana', 'Alexander', 'Gerald', 'Lady Clarissa'],
      key_moments: [
        {
          id: `MOMENT_EP${epNum}_01`,
          type: epNum % 3 === 0 ? 'betrayal' : epNum % 2 === 0 ? 'reveal' : 'confrontation',
          start_sec: 2.0,
          end_sec: 24.5,
          description: 'High-intensity opening conflict and emotional challenge.',
          dialogue_hook: 'Look me in the eye and say that again.',
          emotional_tone: 'anger/shock'
        },
        {
          id: `MOMENT_EP${epNum}_02`,
          type: 'cliffhanger',
          start_sec: 32.0,
          end_sec: 54.0,
          description: 'Unresolved standoff right before scene transition.',
          dialogue_hook: 'If you take one more step, there is no turning back.',
          emotional_tone: 'suspense'
        }
      ],
      rolling_context_notes: `Episode ${epNum} establishes immediate tension following previous encounters.`
    };

    return {
      text: JSON.stringify(data),
      inputTokens: 450,
      outputTokens: 180
    };
  }

  _mockStageC(promptStr) {
    const data = {
      candidates: [
        {
          candidate_id: 'CAND_MOCK_01',
          strategy: 'continuous',
          segments: [
            { episode: 1, start_sec: 0.0, end_sec: 45.0, duration: 45.0 }
          ],
          total_duration: 45.0,
          hook_target: { start_sec: 0.0, end_sec: 3.0, expected_stimulus: 'slap/insult' },
          cliffhanger_target: { start_sec: 42.0, end_sec: 45.0, expected_suspense: 'unresolved proposal' }
        },
        {
          candidate_id: 'CAND_MOCK_02',
          strategy: 'multi_segment',
          segments: [
            { episode: 1, start_sec: 0.0, end_sec: 25.0, duration: 25.0 },
            { episode: 3, start_sec: 12.0, end_sec: 38.0, duration: 26.0 }
          ],
          total_duration: 51.0,
          hook_target: { start_sec: 0.0, end_sec: 3.0, expected_stimulus: 'altar rejection' },
          cliffhanger_target: { start_sec: 47.0, end_sec: 51.0, expected_suspense: 'stranger proposal' }
        }
      ]
    };

    return {
      text: JSON.stringify(data),
      inputTokens: 600,
      outputTokens: 250
    };
  }

  _mockStageD(promptStr) {
    // Generate deterministic variation based on content in prompt
    let hook = 88;
    let cliff = 90;
    let standalone = 84;
    let intensity = 86;
    let archetype = 'Altar Betrayal & Public Humiliation';

    if (promptStr.includes('explosion') || promptStr.includes('Duke') || promptStr.includes('regalia')) {
      hook = 96;
      cliff = 95;
      standalone = 89;
      intensity = 95;
      archetype = 'The Secret Duke / Royal Retribution';
    } else if (promptStr.includes('briar') || promptStr.includes('blackthorn')) {
      hook = 91;
      cliff = 92;
      standalone = 82;
      intensity = 90;
      archetype = 'The Barehanded Briar Trial';
    } else if (promptStr.includes('proposal') || promptStr.includes('marry')) {
      hook = 92;
      cliff = 94;
      standalone = 90;
      intensity = 88;
      archetype = 'The Mysterious Warrior Proposal';
    }

    const data = {
      scores: {
        hook_strength: hook,
        cliffhanger_suspense: cliff,
        standalone_coherence: standalone,
        emotional_intensity: intensity
      },
      archetype: archetype,
      hook_evaluation: {
        score: hook,
        detected_triggers: ['dialogue shock', 'sudden physical movement'],
        reason: 'Immediate stop-scroll impact in first 1.5 seconds.'
      },
      cliffhanger_evaluation: {
        score: cliff,
        detected_crescendo: 'abrupt cut on unresolved dilemma',
        reason: 'High psychological tension left hanging at terminal frame.'
      },
      standalone_evaluation: {
        score: standalone,
        lore_burden: 'low',
        reason: 'Universal emotional dynamic; cold viewers grasp hero vs villain immediately.'
      },
      why_it_works: 'Strong emotional polarity with rapid escalation and zero redundant backstory.'
    };

    return {
      text: JSON.stringify(data),
      inputTokens: 520,
      outputTokens: 210
    };
  }

  _mockStageF(promptStr) {
    // Analyze if prompt candidate has known issues
    const isWeak = promptStr.includes('council') || promptStr.includes('deed') || promptStr.includes('Father Thomas');

    const data = {
      audit_status: isWeak ? 'warn' : 'pass',
      flags: {
        false_action_hook: false,
        lore_trap: isWeak,
        acoustic_truncation_risk: false,
        mid_sentence_cut: false,
        duration_violation: false
      },
      critique: isWeak
        ? 'Contains secondary institutional lore references that may confuse top-of-funnel cold viewers.'
        : 'Passes quality audit. Hook occurs in 0-3s, cut lands cleanly on speaker pause, and core conflict is self-evident.',
      recommendation: isWeak
        ? 'Retargeting only: Reserve for mid-season viewers who have context.'
        : 'Primary Top-of-Funnel candidate: Approved for paid social ad campaigns.'
    };

    return {
      text: JSON.stringify(data),
      inputTokens: 400,
      outputTokens: 160
    };
  }
}

module.exports = MockProvider;
