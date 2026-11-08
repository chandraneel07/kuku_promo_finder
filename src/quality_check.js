/**
 * Quality Checker and Failure Mode Diagnostic Module
 * Evaluates promo candidate quality, identifies algorithmic blind spots,
 * and pinpoints where the automated tool picks badly.
 */

function runQualityAudit(allPromos, episodes) {
  const auditReport = {
    totalEvaluated: allPromos.length,
    tierBreakdown: {
      tierS_ViralGold: 0,       // Score >= 90: pristine viral gold, flawless hook & cliffhanger
      tierA_HighEngagement: 0,   // Score 80-89: strong performers, great standalone appeal
      tierB_ContextDependent: 0, // Score 70-79: decent tension, requires slight editorial trim
      tierC_NeedsRecut: 0        // Score < 70: flawed, static intro or weak cliffhanger
    },
    failureModesIdentified: {
      falseActionHooks: [],
      loreTraps: [],
      acousticBoundaryClipping: [],
      disjointJumpCuts: []
    },
    editorActionItems: []
  };

  allPromos.forEach(p => {
    const totalScore = p.scores ? p.scores.total : (p.totalScore || 0);

    // 1. Tier Categorization
    if (totalScore >= 90) auditReport.tierBreakdown.tierS_ViralGold++;
    else if (totalScore >= 80) auditReport.tierBreakdown.tierA_HighEngagement++;
    else if (totalScore >= 70) auditReport.tierBreakdown.tierB_ContextDependent++;
    else auditReport.tierBreakdown.tierC_NeedsRecut++;

    const textLower = (p.hook + ' ' + p.cliffhanger + ' ' + (p.scriptExcerpt || '')).toLowerCase();

    // 2. Failure Mode 1: Static Staging / False Action Hook
    // Dialogue is dramatic, but camera/action is wide or seated
    const hookScore = p.scores ? p.scores.hook : (p.hookScore || 0);
    if (hookScore >= 18 && (p.scriptExcerpt || '').includes('seated') && !(p.scriptExcerpt || '').includes('punches') && !(p.scriptExcerpt || '').includes('explosion')) {
      if (auditReport.failureModesIdentified.falseActionHooks.length < 5) {
        auditReport.failureModesIdentified.falseActionHooks.push({
          promoId: p.promoId || p.id,
          episode: p.episode,
          score: totalScore,
          hook: p.hook,
          issue: 'Dialogue sounds intense, but physical staging is static (seated conversation). Low scroll-stopping power on TikTok.',
          recommendation: 'Human editor must cut straight to the tight close-up punch-in at +1.8s rather than the opening wide shot.'
        });
      }
    }

    // 3. Failure Mode 2: Context-Blind Lore Burden
    if (textLower.includes('father thomas') || textLower.includes('ecclesiastical') || textLower.includes('council')) {
      if (!textLower.includes('duke') && !textLower.includes('explosion')) {
        if (auditReport.failureModesIdentified.loreTraps.length < 5) {
          auditReport.failureModesIdentified.loreTraps.push({
            promoId: p.promoId || p.id,
            episode: p.episode,
            score: totalScore,
            issue: 'Relies on complex institutional / church lore that confuses cold viewers who have never seen earlier episodes.',
            recommendation: 'Reserve this promo for mid-season retargeting; do not run as Top-of-Funnel acquisition ad.'
          });
        }
      }
    }

    // 4. Failure Mode 3: Acoustic Boundary Clipping Risk
    const cliffScore = p.scores ? p.scores.cliffhanger : (p.cliffhangerScore || 0);
    p.segments.forEach(seg => {
      const segDur = seg.startSec && seg.endSec ? (seg.endSec - seg.startSec) : parseFloat(seg.duration || 0);
      if (Math.abs(segDur - Math.round(segDur)) < 0.05 && cliffScore < 15) {
        if (auditReport.failureModesIdentified.acousticBoundaryClipping.length < 5) {
          auditReport.failureModesIdentified.acousticBoundaryClipping.push({
            promoId: p.promoId || p.id,
            episode: p.episode,
            segmentIndex: seg.segmentIndex,
            timestamp: seg.end,
            issue: 'Abrupt timestamp boundary risk: cut point aligns with written text end but risks clipping lingering vocal decay or actor breath.',
            recommendation: 'Add +0.40s audio pad buffer during automated NLE / FFmpeg timeline rendering.'
          });
        }
      }
    });

    // 5. Failure Mode 4: Disjoint Multi-Segment Jump Cuts
    if (p.segments.length > 1) {
      if (p.segments[0].sceneNumber !== p.segments[1].sceneNumber && p.segments[0].episode === p.segments[1].episode) {
        auditReport.failureModesIdentified.disjointJumpCuts.push({
          promoId: p.promoId || p.id,
          episode: p.episode,
          issue: 'Intra-episode multi-segment stitches two separate scenes without visual transition.',
          recommendation: 'Add a 0.2s white-flash or whoosh sound effect between segments to prevent cold viewer confusion.'
        });
      }
    }
  });

  auditReport.editorActionItems = [
    'Always verify visual action in 0-3s window: discard candidates where actors are stationary or seated.',
    'Apply +0.4s audio decay padding on all automated cuts to prevent clipped syllables.',
    'Keep Top-of-Funnel ads strictly focused on the 3 core archetypes: Altar Betrayal, Secret Duke Retribution, and Briar Trial.',
    'Run human review on Tier B (70-79) candidates before pushing to paid TikTok / Meta ad spend.'
  ];

  return auditReport;
}

module.exports = {
  runQualityAudit
};
