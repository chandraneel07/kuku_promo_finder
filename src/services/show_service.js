const fs = require('fs');
const path = require('path');
const reviewService = require('./review_service');

class ShowService {
  constructor() {
    this.showsBaseDir = path.join(__dirname, '..', '..', 'data', 'shows');
    this.ensureSeedShow();
  }

  ensureSeedShow() {
    try {
      if (!fs.existsSync(this.showsBaseDir)) {
        fs.mkdirSync(this.showsBaseDir, { recursive: true });
      }

      const seedDir = path.join(this.showsBaseDir, 'show_001_duke');
      if (!fs.existsSync(seedDir)) {
        fs.mkdirSync(seedDir, { recursive: true });
      }

      // Check if show.json exists
      const showJsonPath = path.join(seedDir, 'show.json');
      if (!fs.existsSync(showJsonPath)) {
        const seedShow = {
          id: 'show_001_duke',
          title: 'I Married a Broken Soldier. He was a Duke',
          language: 'en',
          target_market: 'US / Global Microdrama Audiences',
          genre: 'Romance / Drama / Royalty / Identity Reveal',
          episodes_count: 50,
          status: 'ready',
          created_at: new Date().toISOString(),
          last_run_id: 'run_001_baseline',
          promos_found: 148,
          avg_score: 78.2,
          funnel_phases: [
            {
              id: 'betrayal',
              name: 'Public Betrayal & Abandonment',
              episode_range: [1, 15],
              archetype: 'Altar Betrayal & Public Humiliation',
              description: 'Self-contained wedding rejection requiring zero viewer backstory (Days 1–2 Top-of-Funnel).'
            },
            {
              id: 'briar_trial',
              name: 'High-Stakes Moral Dilemma',
              episode_range: [16, 35],
              archetype: 'The Barehanded Briar Trial',
              description: 'The blackthorn briar trial and dungeon confrontation (Days 3–5 Mid-Funnel).'
            },
            {
              id: 'ducal_reveal',
              name: 'Climax & Ducal Identity Reveal',
              episode_range: [36, 50],
              archetype: 'The Secret Duke / Royal Retribution',
              description: 'Cathedral entrance breach and unmasking of the true Duke (Days 6–8 Paywall Conversion).'
            }
          ]
        };
        fs.writeFileSync(showJsonPath, JSON.stringify(seedShow, null, 2), 'utf8');
      }

      // Ensure baseline run exists with the 148 promos
      const baselineRunDir = path.join(seedDir, 'runs', 'run_001_baseline');
      if (!fs.existsSync(baselineRunDir)) {
        fs.mkdirSync(baselineRunDir, { recursive: true });

        // Copy from outputs/ if present
        const outputsDir = path.join(__dirname, '..', '..', 'outputs');
        const promosSrc = path.join(outputsDir, 'promos_ranked.json');
        const csvSrc = path.join(outputsDir, 'promos_ranked.csv');
        const auditSrc = path.join(outputsDir, 'quality_check_report.json');

        if (fs.existsSync(promosSrc)) {
          fs.copyFileSync(promosSrc, path.join(baselineRunDir, 'promos.json'));
        }
        if (fs.existsSync(csvSrc)) {
          fs.copyFileSync(csvSrc, path.join(baselineRunDir, 'promos.csv'));
        }
        if (fs.existsSync(auditSrc)) {
          fs.copyFileSync(auditSrc, path.join(baselineRunDir, 'audit.json'));
        }

        const meta = {
          run_id: 'run_001_baseline',
          show_id: 'show_001_duke',
          created_at: '2026-11-08T22:00:00.000Z',
          provider: 'baseline-heuristics',
          model: 'kuku-v1-hybrid',
          promos_found: 148,
          avg_score: 78.2
        };
        fs.writeFileSync(path.join(baselineRunDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
      }
    } catch (e) {
      console.warn('[ShowService] Error initializing seed show:', e.message);
    }
  }

  listShows() {
    this.ensureSeedShow();
    const shows = [];
    if (!fs.existsSync(this.showsBaseDir)) return shows;

    const dirs = fs.readdirSync(this.showsBaseDir);
    for (const d of dirs) {
      const showDir = path.join(this.showsBaseDir, d);
      if (fs.statSync(showDir).isDirectory()) {
        const jsonPath = path.join(showDir, 'show.json');
        if (fs.existsSync(jsonPath)) {
          try {
            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            shows.push(data);
          } catch (_) {}
        }
      }
    }

    return shows.sort((a, b) => (b.promos_found || 0) - (a.promos_found || 0));
  }

  getShow(showId) {
    this.ensureSeedShow();
    const showDir = path.join(this.showsBaseDir, showId);
    if (!fs.existsSync(showDir)) {
      return null;
    }

    const jsonPath = path.join(showDir, 'show.json');
    if (!fs.existsSync(jsonPath)) return null;

    const showMeta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    // Determine latest run
    const runsDir = path.join(showDir, 'runs');
    let runId = showMeta.last_run_id || 'run_001_baseline';
    let runDir = path.join(runsDir, runId);

    if (!fs.existsSync(runDir) && fs.existsSync(runsDir)) {
      const allRuns = fs.readdirSync(runsDir).filter(r => fs.statSync(path.join(runsDir, r)).isDirectory());
      if (allRuns.length > 0) {
        allRuns.sort().reverse();
        runId = allRuns[0];
        runDir = path.join(runsDir, runId);
      }
    }

    let promos = [];
    let auditReport = null;
    let runMeta = null;

    if (fs.existsSync(runDir)) {
      const pPath = path.join(runDir, 'promos.json');
      const aPath = path.join(runDir, 'audit.json');
      const mPath = path.join(runDir, 'meta.json');

      if (fs.existsSync(pPath)) {
        try { promos = JSON.parse(fs.readFileSync(pPath, 'utf8')); } catch (_) {}
      }
      if (fs.existsSync(aPath)) {
        try { auditReport = JSON.parse(fs.readFileSync(aPath, 'utf8')); } catch (_) {}
      }
      if (fs.existsSync(mPath)) {
        try { runMeta = JSON.parse(fs.readFileSync(mPath, 'utf8')); } catch (_) {}
      }
    }

    // Merge human reviews
    const reviews = reviewService.getReviews(showId);
    const mergedPromos = promos.map(p => {
      const r = reviews[p.id];
      return {
        ...p,
        review: r || { status: 'unreviewed' }
      };
    });

    return {
      show: showMeta,
      current_run_id: runId,
      promos: mergedPromos,
      audit: auditReport,
      meta: runMeta,
      reviews
    };
  }

  /**
   * Preview screenplay text before processing
   */
  previewScreenplays(text) {
    if (!text || typeof text !== 'string') {
      return { episodes: 0, scenes: 0, lines: 0, sample_headings: [] };
    }

    // Detect episodes
    const epMatches = text.match(/EPISODE(?:\s+NUMBER)?:\s*(Episode\s*\d+.*)/gi) ||
                      text.match(/^#*\s*Episode\s+\d+/gim) || [];
    const episodeCount = Math.max(1, epMatches.length);

    // Detect scenes
    const sceneMatches = text.match(/SCENE\s+\d+/gi) ||
                         text.match(/INT\.|EXT\./gi) || [];
    const sceneCount = Math.max(episodeCount, sceneMatches.length);

    // Dialogue/Action blocks count
    const blockMatches = text.match(/\*\*[^*]+\*\*:/g) || [];
    const lineCount = blockMatches.length || Math.round(text.split(/\r?\n/).filter(l => l.trim().length > 0).length / 2);

    // Extract first 3 headings
    const headings = (text.match(/Scene heading:\s*(.*)/gi) || [])
      .slice(0, 3)
      .map(h => h.replace(/Scene heading:\s*/i, '').trim());

    return {
      episodes_detected: episodeCount,
      scenes_detected: sceneCount,
      lines_detected: lineCount,
      sample_headings: headings
    };
  }

  /**
   * Create a new show with uploaded files
   */
  createShow(data) {
    const title = (data.title || 'Untitled Microdrama').trim();
    const cleanSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').substring(0, 30);
    const showId = `show_${Date.now().toString().slice(-6)}_${cleanSlug || 'story'}`;

    const showDir = path.join(this.showsBaseDir, showId);
    fs.mkdirSync(showDir, { recursive: true });

    const screenplaysDir = path.join(showDir, 'screenplays');
    fs.mkdirSync(screenplaysDir, { recursive: true });

    let detectedEpisodes = 1;
    let totalText = '';

    // Save uploaded files
    if (data.files && Array.isArray(data.files)) {
      for (let i = 0; i < data.files.length; i++) {
        const file = data.files[i];
        const filename = file.name || `episode_${i + 1}.txt`;
        const content = file.content || '';
        totalText += '\n' + content;
        fs.writeFileSync(path.join(screenplaysDir, filename), content, 'utf8');
      }
    } else if (data.combined_text) {
      // Split combined text by Episode or save as episode_01.txt
      totalText = data.combined_text;
      const epParts = totalText.split(/(?=EPISODE\s+(?:NUMBER:\s*)?Episode\s+\d+|^#*\s*Episode\s+\d+)/im);
      if (epParts.length > 1) {
        for (let i = 0; i < epParts.length; i++) {
          if (epParts[i].trim().length > 0) {
            fs.writeFileSync(path.join(screenplaysDir, `episode_${String(i + 1).padStart(2, '0')}.txt`), epParts[i], 'utf8');
          }
        }
      } else {
        fs.writeFileSync(path.join(screenplaysDir, 'episode_01.txt'), totalText, 'utf8');
      }
    }

    const preview = this.previewScreenplays(totalText);
    detectedEpisodes = preview.episodes_detected;

    const showMeta = {
      id: showId,
      title,
      language: data.language || 'en',
      target_market: data.target_market || 'US / Global Vertical Audiences',
      genre: data.genre || 'Drama / Romance',
      episodes_count: detectedEpisodes,
      status: 'not_processed',
      created_at: new Date().toISOString(),
      promos_found: 0,
      avg_score: 0,
      funnel_phases: data.funnel_phases || [
        {
          id: 'phase_1',
          name: 'Phase 1: Days 1–2 (Top-of-Funnel)',
          episode_range: [1, Math.max(1, Math.round(detectedEpisodes * 0.3))],
          description: 'High-outrage public betrayal hooks requiring zero backstory.'
        },
        {
          id: 'phase_2',
          name: 'Phase 2: Days 3–5 (Mid-Funnel)',
          episode_range: [Math.max(2, Math.round(detectedEpisodes * 0.3) + 1), Math.max(2, Math.round(detectedEpisodes * 0.7))],
          description: 'Moral dilemmas, life-or-death survival, and escalating stakes.'
        },
        {
          id: 'phase_3',
          name: 'Phase 3: Days 6–8 (Conversion)',
          episode_range: [Math.max(3, Math.round(detectedEpisodes * 0.7) + 1), detectedEpisodes],
          description: 'Identity unmasking, climactic confrontations, and paywall coin unlocks.'
        }
      ]
    };

    fs.writeFileSync(path.join(showDir, 'show.json'), JSON.stringify(showMeta, null, 2), 'utf8');
    return {
      show: showMeta,
      preview
    };
  }

  /**
   * Compare two pipeline runs on the same show
   */
  compareRuns(showId, runIdA, runIdB) {
    const showDir = path.join(this.showsBaseDir, showId);
    const runDirA = path.join(showDir, 'runs', runIdA);
    const runDirB = path.join(showDir, 'runs', runIdB);

    if (!fs.existsSync(runDirA) || !fs.existsSync(runDirB)) {
      throw new Error('One or both run directories not found for comparison.');
    }

    const promosA = JSON.parse(fs.readFileSync(path.join(runDirA, 'promos.json'), 'utf8') || '[]');
    const promosB = JSON.parse(fs.readFileSync(path.join(runDirB, 'promos.json'), 'utf8') || '[]');
    const metaA = JSON.parse(fs.readFileSync(path.join(runDirA, 'meta.json'), 'utf8') || '{}');
    const metaB = JSON.parse(fs.readFileSync(path.join(runDirB, 'meta.json'), 'utf8') || '{}');

    // Find overlapping promos (same episode and within 4 seconds)
    const matched = [];
    const unmatchedA = [];
    const unmatchedB = [...promosB];

    for (const pa of promosA) {
      let bestMatch = null;
      let bestDist = Infinity;
      let bestBIdx = -1;

      for (let bIdx = 0; bIdx < unmatchedB.length; bIdx++) {
        const pb = unmatchedB[bIdx];
        if (pa.episodes[0] === pb.episodes[0]) {
          const segA = pa.segments[0] || {};
          const segB = pb.segments[0] || {};
          const dist = Math.abs((segA.start_sec || 0) - (segB.start_sec || 0));
          if (dist < bestDist && dist <= 4.0) {
            bestDist = dist;
            bestMatch = pb;
            bestBIdx = bIdx;
          }
        }
      }

      if (bestMatch) {
        matched.push({
          promo_id_a: pa.id,
          promo_id_b: bestMatch.id,
          episode: pa.episodes[0],
          score_a: pa.total_score,
          score_b: bestMatch.total_score,
          score_delta: Math.round((bestMatch.total_score - pa.total_score) * 10) / 10,
          tier_a: pa.tier,
          tier_b: bestMatch.tier,
          hook_a: pa.hook?.text,
          hook_b: bestMatch.hook?.text
        });
        unmatchedB.splice(bestBIdx, 1);
      } else {
        unmatchedA.push({
          id: pa.id,
          episode: pa.episodes[0],
          score: pa.total_score,
          tier: pa.tier
        });
      }
    }

    const avgDelta = matched.length > 0
      ? Math.round((matched.reduce((acc, m) => acc + m.score_delta, 0) / matched.length) * 10) / 10
      : 0;

    return {
      run_a: { id: runIdA, model: metaA.model, provider: metaA.provider, count: promosA.length, avg_score: metaA.avg_score },
      run_b: { id: runIdB, model: metaB.model, provider: metaB.provider, count: promosB.length, avg_score: metaB.avg_score },
      overlap_count: matched.length,
      overlap_pct: Math.round((matched.length / Math.max(1, promosA.length)) * 100),
      avg_score_delta: avgDelta,
      matched_promos: matched,
      unique_to_a: unmatchedA,
      unique_to_b: unmatchedB.map(p => ({ id: p.id, episode: p.episodes[0], score: p.total_score, tier: p.tier }))
    };
  }

  /**
   * Compare all shows in Library for the comparison table
   */
  compareShows() {
    const shows = this.listShows();
    return shows.map(s => {
      const full = this.getShow(s.id);
      const promos = full?.promos || [];
      const reviews = full?.reviews || {};

      let approvedCount = 0;
      let tierSCount = 0;
      let tierACount = 0;

      for (const p of promos) {
        if (p.tier === 'Tier S') tierSCount++;
        else if (p.tier === 'Tier A') tierACount++;
        if (reviews[p.id]?.status === 'approved' || p.review?.status === 'approved') approvedCount++;
      }

      const yieldPerEpisode = s.episodes_count > 0
        ? Math.round((promos.length / s.episodes_count) * 10) / 10
        : 0;

      const approvalRatePct = promos.length > 0
        ? Math.round((approvedCount / promos.length) * 100)
        : 0;

      return {
        id: s.id,
        title: s.title,
        episodes_count: s.episodes_count || 0,
        promos_found: promos.length,
        yield_per_episode: yieldPerEpisode,
        avg_score: s.avg_score || 0,
        tier_s_count: tierSCount,
        tier_a_count: tierACount,
        approved_count: approvedCount,
        approval_rate_pct: approvalRatePct,
        status: s.status || 'ready'
      };
    });
  }
}

module.exports = new ShowService();
