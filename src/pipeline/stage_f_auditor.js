const fs = require('fs');
const path = require('path');
const factory = require('../llm/factory');

class StageFAuditor {
  constructor() {
    this.promptTemplatePath = path.join(__dirname, '..', '..', 'prompts', 'stage_f_quality_audit.md');
  }

  getPromptTemplate() {
    if (fs.existsSync(this.promptTemplatePath)) {
      return fs.readFileSync(this.promptTemplatePath, 'utf8');
    }
    return 'Audit candidate {{candidate_id}} with duration {{total_duration}}s excerpt: {{candidate_excerpt}}';
  }

  async auditPromo(promo, options = {}) {
    const provider = factory.getProviderForStage('stage_f_audit');

    // 1. Code-based deterministic checks
    const codeFlags = {
      duration_violation: promo.duration < 20.0 || promo.duration > 60.0,
      lore_trap: false,
      false_action_hook: false,
      acoustic_truncation_risk: false,
      mid_sentence_cut: false
    };

    const textLower = (promo.excerpt || '').toLowerCase();
    if (textLower.includes('council') || textLower.includes('petition') || textLower.includes('parish deed') || textLower.includes('estate ledger')) {
      codeFlags.lore_trap = true;
    }
    if ((textLower.includes('tea') || textLower.includes('seated') || textLower.includes('sitting')) && 
        !textLower.includes('slap') && !textLower.includes('blade') && !textLower.includes('explosion') && !textLower.includes('shout')) {
      codeFlags.false_action_hook = true;
    }

    // 2. LLM-as-Judge Call
    let template = this.getPromptTemplate();
    const prompt = template
      .replace(/{{candidate_id}}/g, promo.id)
      .replace(/{{total_duration}}/g, String(promo.duration))
      .replace(/{{hook_claim}}/g, promo.hook?.text || 'Opening hook')
      .replace(/{{cliffhanger_claim}}/g, promo.cliffhanger?.text || 'Terminal cliffhanger')
      .replace(/{{candidate_excerpt}}/g, (promo.excerpt || '').substring(0, 4000));

    const schema = {
      type: 'object',
      required: ['audit_status', 'flags', 'critique'],
      properties: {
        audit_status: { type: 'string' },
        flags: { type: 'object' },
        critique: { type: 'string' },
        recommendation: { type: 'string' },
        suggested_editorial_fix: { type: 'string' }
      }
    };

    const res = await provider.generateJSON(prompt, schema, options);
    const llmData = res.data;

    const mergedFlags = {
      false_action_hook: Boolean(codeFlags.false_action_hook || llmData.flags?.false_action_hook),
      lore_trap: Boolean(codeFlags.lore_trap || llmData.flags?.lore_trap),
      acoustic_truncation_risk: Boolean(codeFlags.acoustic_truncation_risk || llmData.flags?.acoustic_truncation_risk),
      mid_sentence_cut: Boolean(llmData.flags?.mid_sentence_cut),
      duration_violation: Boolean(codeFlags.duration_violation || llmData.flags?.duration_violation)
    };

    let finalStatus = llmData.audit_status || 'pass';
    if (mergedFlags.duration_violation) finalStatus = 'fail';
    else if (mergedFlags.false_action_hook || mergedFlags.lore_trap) {
      if (finalStatus === 'pass') finalStatus = 'warn';
    }

    return {
      promo_id: promo.id,
      audit_status: finalStatus,
      flags: mergedFlags,
      critique: llmData.critique || 'Evaluated for stop-scroll retention and closure.',
      recommendation: llmData.recommendation || (finalStatus === 'pass' ? 'Approved for Primary Social Ads' : 'Review Before Release'),
      suggested_editorial_fix: llmData.suggested_editorial_fix || 'Ensure +0.40s audio fade hold on terminal dialogue.',
      tokens: res.tokens,
      fromCache: res.fromCache
    };
  }

  /**
   * Run audit across all ranked promos and compile report with worst 10 picks
   */
  async auditAllPromos(rankedPromos, options = {}) {
    const auditMap = {};
    const failureCounts = {
      false_action_hook: 0,
      lore_trap: 0,
      acoustic_truncation_risk: 0,
      mid_sentence_cut: 0,
      duration_violation: 0
    };

    let passCount = 0;
    let warnCount = 0;
    let failCount = 0;

    for (const p of rankedPromos) {
      const auditRes = await this.auditPromo(p, options);
      auditMap[p.id] = auditRes;

      if (auditRes.audit_status === 'pass') passCount++;
      else if (auditRes.audit_status === 'warn') warnCount++;
      else failCount++;

      for (const [flagKey, val] of Object.entries(auditRes.flags)) {
        if (val && failureCounts[flagKey] !== undefined) {
          failureCounts[flagKey]++;
        }
      }
    }

    // Find the worst 10 picks (lowest score or flagged with defects)
    const sortedWorst = [...rankedPromos]
      .sort((a, b) => {
        const auditA = auditMap[a.id];
        const auditB = auditMap[b.id];
        const penaltyA = (auditA?.audit_status === 'fail' ? 20 : auditA?.audit_status === 'warn' ? 10 : 0);
        const penaltyB = (auditB?.audit_status === 'fail' ? 20 : auditB?.audit_status === 'warn' ? 10 : 0);
        return ((a.total_score || 0) - penaltyA) - ((b.total_score || 0) - penaltyB);
      })
      .slice(0, 10)
      .map(p => ({
        id: p.id,
        rank: p.rank,
        episodes: p.episodes,
        duration: p.duration,
        total_score: p.total_score,
        tier: p.tier,
        audit_status: auditMap[p.id]?.audit_status || 'warn',
        defect_reason: auditMap[p.id]?.critique || 'Weak opening retention or excessive narrative lore.',
        suggested_fix: auditMap[p.id]?.suggested_editorial_fix || 'Swap opening frame for close-up shot.'
      }));

    return {
      summary: {
        total_audited: rankedPromos.length,
        pass_count: passCount,
        warn_count: warnCount,
        fail_count: failCount,
        pass_rate_pct: Math.round((passCount / (rankedPromos.length || 1)) * 100)
      },
      failure_counts_by_type: failureCounts,
      worst_10_picks: sortedWorst,
      detailed_audits: auditMap
    };
  }
}

module.exports = new StageFAuditor();
