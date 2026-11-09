const fs = require('fs');
const path = require('path');

class EvalService {
  constructor() {
    this.showsBaseDir = path.join(__dirname, '..', '..', 'data', 'shows');
  }

  getEvalFilePath(showId) {
    return path.join(this.showsBaseDir, showId, 'eval.json');
  }

  getGoldSet(showId) {
    const filePath = this.getEvalFilePath(showId);
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    } catch (e) {
      console.warn(`[EvalService] Error reading gold set for ${showId}:`, e.message);
    }
    return {
      show_id: showId,
      description: 'Gold Standard Benchmark Promos curated by human editors',
      gold_promos: []
    };
  }

  saveGoldSet(showId, goldSetData) {
    const filePath = this.getEvalFilePath(showId);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const payload = {
      show_id: showId,
      updated_at: new Date().toISOString(),
      description: goldSetData.description || 'Gold Standard Benchmark Promos curated by human editors',
      gold_promos: goldSetData.gold_promos || []
    };

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    return payload;
  }

  /**
   * Evaluate a set of ranked promos against the gold standard
   */
  evaluatePromos(showId, rankedPromos = []) {
    const goldData = this.getGoldSet(showId);
    const goldPromos = goldData.gold_promos || [];

    if (goldPromos.length === 0) {
      return {
        has_gold_set: false,
        message: 'No gold standard labels entered for this show yet. Enter gold promos to compute Precision@10/20 and boundary errors.',
        gold_count: 0
      };
    }

    const top10 = rankedPromos.slice(0, 10);
    const top20 = rankedPromos.slice(0, 20);

    let matchedTop10Count = 0;
    let matchedTop20Count = 0;
    const boundaryErrors = [];

    const detailedBreakdown = goldPromos.map(gold => {
      let matchedInTop10 = false;
      let matchedInTop20 = false;
      let matchedPromo = null;
      let bestBoundaryError = Infinity;

      for (let i = 0; i < top20.length; i++) {
        const p = top20[i];
        const hasEpisode = p.episodes.includes(gold.target_episode);
        if (!hasEpisode) continue;

        // Check timestamp proximity
        const primarySeg = p.segments.find(s => s.episode === gold.target_episode) || p.segments[0];
        if (!primarySeg) continue;

        const startDiff = Math.abs(primarySeg.start_sec - gold.expected_start_sec);
        const endDiff = Math.abs(primarySeg.end_sec - gold.expected_end_sec);
        const avgDiff = (startDiff + endDiff) / 2;

        const tol = gold.acceptable_tolerance_sec || 3.0;

        // Check dialogue match if available
        let dialogueMatch = false;
        if (gold.key_dialogue) {
          const goldTextLower = gold.key_dialogue.toLowerCase();
          const pTextLower = (p.excerpt || p.hook?.text || p.cliffhanger?.text || '').toLowerCase();
          if (pTextLower.includes(goldTextLower)) {
            dialogueMatch = true;
          }
        }

        if (avgDiff <= tol * 2.5 || dialogueMatch) {
          matchedPromo = p;
          bestBoundaryError = avgDiff;
          if (i < 10) matchedInTop10 = true;
          matchedInTop20 = true;
          break;
        }
      }

      if (matchedInTop10) matchedTop10Count++;
      if (matchedInTop20) matchedTop20Count++;
      if (matchedPromo && bestBoundaryError !== Infinity) {
        boundaryErrors.push(bestBoundaryError);
      }

      return {
        gold_id: gold.id,
        name: gold.name,
        target_episode: gold.target_episode,
        expected_window: `${gold.expected_start_sec}s - ${gold.expected_end_sec}s (${gold.expected_duration}s)`,
        key_dialogue: gold.key_dialogue,
        matched: Boolean(matchedPromo),
        matched_promo_id: matchedPromo ? matchedPromo.id : null,
        matched_rank: matchedPromo ? matchedPromo.rank : null,
        in_top_10: matchedInTop10,
        in_top_20: matchedInTop20,
        boundary_error_sec: matchedPromo ? Math.round(bestBoundaryError * 10) / 10 : null
      };
    });

    const meanBoundaryError = boundaryErrors.length > 0
      ? Math.round((boundaryErrors.reduce((a, b) => a + b, 0) / boundaryErrors.length) * 10) / 10
      : 0;

    const precision10 = Math.round((matchedTop10Count / Math.min(10, goldPromos.length)) * 100);
    const precision20 = Math.round((matchedTop20Count / Math.min(20, goldPromos.length)) * 100);

    return {
      has_gold_set: true,
      gold_count: goldPromos.length,
      evaluated_promos_count: rankedPromos.length,
      precision_top_10_pct: precision10,
      precision_top_20_pct: precision20,
      matched_top_10: matchedTop10Count,
      matched_top_20: matchedTop20Count,
      mean_boundary_error_sec: meanBoundaryError,
      detailed_breakdown: detailedBreakdown
    };
  }
}

module.exports = new EvalService();
