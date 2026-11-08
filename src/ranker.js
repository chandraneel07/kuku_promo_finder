/**
 * Ranker module for Kuku Microdrama Promo Finder
 * Sorts, filters, and categorizes promos into strategic marketing phases.
 */

const POSTING_STRATEGY = {
  PHASE_1: {
    phase: 'Phase 1: Day 1-2 Mass Acquisition (Top-of-Funnel)',
    objective: 'Maximize thumb-stopping CTR and viral outrage/empathy on TikTok & Reels.',
    criteria: 'Primal, instantly understandable tropes requiring zero prior context (Altar Betrayal, Public Slap/Disownment, Shock Proposal).',
    targetArchetypes: ['Altar Betrayal & Public Humiliation', 'The Mysterious Warrior Proposal']
  },
  PHASE_2: {
    phase: 'Phase 2: Day 3-5 Binge Trigger & App Install (Mid-Funnel)',
    objective: 'Drive curiosity-driven app downloads and series search volume.',
    criteria: 'High-stakes physical sacrifice and sadistic ultimatums with impossible dilemmas (Briar crawl, Poison discovery, Dungeon confrontation).',
    targetArchetypes: ['The Barehanded Briar Trial', 'Dungeon Torture & Unyielding Defiance']
  },
  PHASE_3: {
    phase: 'Phase 3: Day 6-8 Paywall & Episode Unlock (Bottom-of-Funnel Conversion)',
    objective: 'Drive coin purchase and VIP subscriptions right before high-intensity series payoff.',
    criteria: 'Grand climax spectacle, explosive identity reveals, and triumphant catharsis (Cathedral Bombing, True Duke Unmasking, Scullery Maid Reversal).',
    targetArchetypes: ['The Secret Duke / Royal Retribution', 'Scullery Maid Reversal']
  }
};

/**
 * Assigns posting phase based on archetype and score
 */
function assignPostingPhase(archetype, score) {
  if (archetype === 'Altar Betrayal & Public Humiliation' || archetype === 'The Mysterious Warrior Proposal') {
    return POSTING_STRATEGY.PHASE_1;
  } else if (archetype === 'The Barehanded Briar Trial' || archetype === 'Dungeon Torture & Unyielding Defiance') {
    return POSTING_STRATEGY.PHASE_2;
  } else if (archetype === 'The Secret Duke / Royal Retribution' || archetype === 'Scullery Maid Reversal') {
    return POSTING_STRATEGY.PHASE_3;
  }
  return POSTING_STRATEGY.PHASE_1;
}

/**
 * Ranks all promos, assigns strategic tags, and formats clean output structures
 */
function rankAndPackagePromos(allPromos) {
  // Sort descending by total score
  const sorted = [...allPromos].sort((a, b) => b.totalScore - a.totalScore);

  const packaged = sorted.map((p, index) => {
    const rank = index + 1;
    const strategy = assignPostingPhase(p.archetype, p.totalScore);

    return {
      rank,
      promoId: p.id,
      episode: typeof p.episodeNumber === 'number' ? `Episode ${p.episodeNumber}` : p.episodeNumber,
      episodeTitle: p.episodeTitle,
      totalDuration: `${p.totalDuration.toFixed(1)}s`,
      totalDurationSec: p.totalDuration,
      scores: {
        total: p.totalScore,
        hook: p.hookScore,
        cliffhanger: p.cliffhangerScore,
        coherence: p.coherenceScore,
        pacing: p.pacingScore
      },
      archetype: p.archetype,
      postingPhase: strategy.phase,
      hook: p.hook,
      cliffhanger: p.cliffhanger,
      whyItWorks: p.whyItWorks,
      segments: p.segments.map(s => ({
        segmentIndex: s.segmentIndex,
        episode: s.episodeNumber,
        sceneNumber: s.sceneNumber,
        start: s.start,
        end: s.end,
        startSec: s.startSec,
        endSec: s.endSec,
        duration: `${s.duration.toFixed(1)}s`
      })),
      scriptExcerpt: p.scriptExcerpt
    };
  });

  return {
    strategyOverview: POSTING_STRATEGY,
    rankedPromos: packaged
  };
}

module.exports = {
  POSTING_STRATEGY,
  rankAndPackagePromos
};
