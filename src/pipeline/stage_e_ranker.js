class StageERanker {
  /**
   * Computes footage Intersection over Union between two promos
   */
  computeIoU(promoA, promoB) {
    // If different episodes completely, overlap is 0
    const epsA = new Set(promoA.segments.map(s => s.episode));
    const epsB = new Set(promoB.segments.map(s => s.episode));
    const commonEps = [...epsA].filter(e => epsB.has(e));
    if (commonEps.length === 0) return 0;

    let totalIntersection = 0;
    let totalUnion = 0;

    for (const ep of commonEps) {
      const segsA = promoA.segments.filter(s => s.episode === ep);
      const segsB = promoB.segments.filter(s => s.episode === ep);

      for (const sa of segsA) {
        for (const sb of segsB) {
          const interStart = Math.max(sa.start_sec, sb.start_sec);
          const interEnd = Math.min(sa.end_sec, sb.end_sec);
          const inter = Math.max(0, interEnd - interStart);

          const unionStart = Math.min(sa.start_sec, sb.start_sec);
          const unionEnd = Math.max(sa.end_sec, sb.end_sec);
          const union = Math.max(0, unionEnd - unionStart);

          totalIntersection += inter;
          totalUnion += union;
        }
      }
    }

    if (totalUnion === 0) return 0;
    return totalIntersection / totalUnion;
  }

  /**
   * Assign funnel phase based on show metadata or episode distribution
   */
  assignFunnelPhase(promo, showMeta = {}) {
    const primaryEp = promo.episodes[0] || 1;
    const totalEps = showMeta.episodes_count || 50;

    // 1. Check custom show funnel phases
    if (showMeta.funnel_phases && Array.isArray(showMeta.funnel_phases) && showMeta.funnel_phases.length > 0) {
      for (let pIdx = 0; pIdx < showMeta.funnel_phases.length; pIdx++) {
        const phase = showMeta.funnel_phases[pIdx];
        const [pStart, pEnd] = phase.episode_range || [1, totalEps];
        if (primaryEp >= pStart && primaryEp <= pEnd) {
          return {
            phase_id: phase.id || `phase_${pIdx + 1}`,
            name: `Phase ${pIdx + 1}: ${phase.name}`,
            description: phase.description || '',
            archetype: phase.archetype || null
          };
        }
      }
    }

    // 2. Default dynamic phase assignment
    const ratio = primaryEp / totalEps;
    if (ratio <= 0.30) {
      return {
        phase_id: 'phase_1',
        name: 'Phase 1: Days 1–2 (Top-of-Funnel)',
        description: 'Immediate stop-scroll hooks requiring zero prior backstory.',
        archetype: null
      };
    } else if (ratio <= 0.70) {
      return {
        phase_id: 'phase_2',
        name: 'Phase 2: Days 3–5 (Mid-Funnel)',
        description: 'Escalating moral dilemmas and physical stakes to motivate series binging.',
        archetype: null
      };
    } else {
      return {
        phase_id: 'phase_3',
        name: 'Phase 3: Days 6–8 (Conversion)',
        description: 'Climactic confrontation and revelations aligned with paywall coin gates.',
        archetype: null
      };
    }
  }

  /**
   * Deduplicate using NMS, rank, assign tiers & funnel phases
   */
  rankAndDedupe(scoredPromos, showMeta = {}, iouThreshold = 0.50) {
    // 1. Sort descending by score
    const sorted = [...scoredPromos].sort((a, b) => (b.final_score || 0) - (a.final_score || 0));

    const kept = [];
    const droppedDuplicates = [];

    for (const cand of sorted) {
      let isDuplicate = false;
      for (const existing of kept) {
        const iou = this.computeIoU(cand, existing);
        if (iou > iouThreshold) {
          isDuplicate = true;
          droppedDuplicates.push({
            dropped_id: cand.candidate_id,
            retained_id: existing.id,
            iou: Math.round(iou * 100) / 100
          });
          break;
        }
      }
      if (!isDuplicate) {
        kept.push(cand);
      }
    }

    // 2. Assign Rank numbers, IDs, Tiers, and Funnel Phases
    const rankedPromos = kept.map((p, idx) => {
      const rank = idx + 1;
      const score = p.final_score;

      let tier = 'Tier C';
      if (score >= 90.0) tier = 'Tier S';
      else if (score >= 80.0) tier = 'Tier A';
      else if (score >= 70.0) tier = 'Tier B';

      const phaseInfo = this.assignFunnelPhase(p, showMeta);

      return {
        id: `PROMO-${String(rank).padStart(3, '0')}`,
        rank,
        episodes: p.episodes,
        duration: p.duration,
        strategy: p.strategy,
        total_score: score,
        tier,
        funnel_phase: phaseInfo.name,
        funnel_description: phaseInfo.description,
        archetype: phaseInfo.archetype || p.archetype,
        segments: p.segments,
        hook: p.hook,
        cliffhanger: p.cliffhanger,
        scores: p.scores,
        why_it_works: p.why_it_works,
        excerpt: p.excerpt
      };
    });

    return {
      promos: rankedPromos,
      total_ranked: rankedPromos.length,
      dropped_duplicates: droppedDuplicates
    };
  }
}

module.exports = new StageERanker();
