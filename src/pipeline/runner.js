const fs = require('fs');
const path = require('path');
const stageA = require('./stage_a_parser');
const stageB = require('./stage_b_analyzer');
const stageC = require('./stage_c_assembly');
const stageD = require('./stage_d_scorer');
const stageE = require('./stage_e_ranker');
const stageF = require('./stage_f_auditor');
const factory = require('../llm/factory');

class PipelineRunner {
  constructor() {
    this.showsBaseDir = path.join(__dirname, '..', '..', 'data', 'shows');
  }

  ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  /**
   * Run end-to-end pipeline on a show
   */
  async runShowPipeline(showId, options = {}, onProgress = null) {
    const startTime = Date.now();
    const showDir = path.join(this.showsBaseDir, showId);
    if (!fs.existsSync(showDir)) {
      throw new Error(`Show directory not found for ID: ${showId}`);
    }

    const showJsonPath = path.join(showDir, 'show.json');
    let showMeta = {};
    if (fs.existsSync(showJsonPath)) {
      showMeta = JSON.parse(fs.readFileSync(showJsonPath, 'utf8'));
    }

    const settings = factory.getSettings();
    const activeProvider = settings.active_provider || 'mock';
    const activeModel = settings.providers?.[activeProvider]?.model || 'default';

    const runId = `run_${Date.now()}_${activeProvider}`;
    const runDir = path.join(showDir, 'runs', runId);
    this.ensureDir(runDir);

    const logMessages = [];
    const log = (msg) => {
      const entry = `[${new Date().toISOString()}] ${msg}`;
      logMessages.push(entry);
      console.log(`[Pipeline:${showId}] ${msg}`);
      if (onProgress) {
        onProgress({
          type: 'log',
          message: msg,
          timestamp: new Date().toISOString()
        });
      }
    };

    let totalTokens = { input: 0, output: 0, cost: 0 };
    const trackTokens = (t) => {
      if (!t) return;
      totalTokens.input += t.input || 0;
      totalTokens.output += t.output || 0;
      totalTokens.cost += t.cost || 0;
    };

    log(`Starting promo discovery pipeline for show '${showMeta.title || showId}' with provider '${activeProvider}' (model: ${activeModel}).`);

    // ==========================================
    // STAGE A: PARSE SCREENPLAYS
    // ==========================================
    log(`[Stage A] Parsing screenplays into normalized block schemas...`);
    if (onProgress) onProgress({ stage: 'Stage A: Parsing', pct: 10, currentEpisode: 0, totalEpisodes: showMeta.episodes_count || 50 });

    const parsedOutputDir = path.join(showDir, 'parsed');
    let parsedEpisodes = [];

    try {
      parsedEpisodes = stageA.parseShowScreenplays(showDir, parsedOutputDir);
      log(`[Stage A] Successfully parsed ${parsedEpisodes.length} episodes.`);
    } catch (parseErr) {
      log(`[Stage A Warning] ${parseErr.message}. Attempting to load existing parsed files...`);
      if (fs.existsSync(parsedOutputDir)) {
        const files = fs.readdirSync(parsedOutputDir).filter(f => f.endsWith('.json'));
        for (const f of files) {
          parsedEpisodes.push(JSON.parse(fs.readFileSync(path.join(parsedOutputDir, f), 'utf8')));
        }
      }
    }

    if (parsedEpisodes.length === 0) {
      throw new Error('No parsed episodes available to process.');
    }

    const parsedMap = {};
    for (const ep of parsedEpisodes) parsedMap[ep.episode] = ep;

    // Filter episodes if options specify single episode or subset
    const targetEpisodes = options.episode
      ? parsedEpisodes.filter(e => e.episode === parseInt(options.episode, 10))
      : parsedEpisodes;

    // ==========================================
    // STAGE B: EPISODE ANALYSIS
    // ==========================================
    log(`[Stage B] Running episode analysis with rolling context across ${targetEpisodes.length} episodes...`);
    const stageBMoments = {};
    let rollingContext = 'First episode of the season.';

    for (let i = 0; i < targetEpisodes.length; i++) {
      const ep = targetEpisodes[i];
      const pct = 15 + Math.round(((i + 1) / targetEpisodes.length) * 35);
      if (onProgress) {
        onProgress({
          stage: 'Stage B: Analysis',
          pct,
          currentEpisode: ep.episode,
          totalEpisodes: targetEpisodes.length,
          tokens: totalTokens
        });
      }

      try {
        const analysisRes = await stageB.analyzeEpisode(ep, showMeta, rollingContext, options);
        trackTokens(analysisRes.tokens);
        stageBMoments[ep.episode] = analysisRes.analysis.key_moments || [];
        rollingContext = analysisRes.analysis.summary || rollingContext;
        log(`[Stage B] Ep ${ep.episode}: Extracted ${stageBMoments[ep.episode].length} moments (${analysisRes.fromCache ? 'cached' : 'computed'}).`);
      } catch (epErr) {
        log(`[Stage B Error] Ep ${ep.episode} analysis failed: ${epErr.message}`);
      }
    }

    // ==========================================
    // STAGE C: CANDIDATE ASSEMBLY
    // ==========================================
    log(`[Stage C] Assembling and strictly verifying candidate windows (20s–60s rules)...`);
    if (onProgress) onProgress({ stage: 'Stage C: Assembly', pct: 55, tokens: totalTokens });

    const assemblyRes = stageC.assembleCandidates(parsedMap, stageBMoments, showMeta, settings.constraints || {});
    for (const l of assemblyRes.logs) log(l);
    log(`[Stage C] Assembled ${assemblyRes.candidates.length} valid candidate promos.`);

    // ==========================================
    // STAGE D: SCORING
    // ==========================================
    log(`[Stage D] Scoring candidate promos using structured LLM rubric + code formula...`);
    const scoredCandidates = [];
    const scoringWeights = settings.scoring_weights || { hook: 30, cliffhanger: 30, standalone: 25, intensity: 15 };

    for (let cIdx = 0; cIdx < assemblyRes.candidates.length; cIdx++) {
      const cand = assemblyRes.candidates[cIdx];
      const pct = 55 + Math.round(((cIdx + 1) / assemblyRes.candidates.length) * 20);
      if (onProgress) {
        onProgress({
          stage: 'Stage D: Scoring',
          pct,
          currentCandidate: cIdx + 1,
          totalCandidates: assemblyRes.candidates.length,
          tokens: totalTokens
        });
      }

      try {
        const scoreRes = await stageD.scoreCandidate(cand, showMeta, scoringWeights, options);
        trackTokens(scoreRes.tokens);
        scoredCandidates.push({
          ...cand,
          ...scoreRes
        });
      } catch (scoreErr) {
        log(`[Stage D Error] Candidate ${cand.id} scoring failed: ${scoreErr.message}`);
      }
    }

    // ==========================================
    // STAGE E: DEDUPLICATION & RANKING
    // ==========================================
    log(`[Stage E] Running Non-Maximum Suppression (IoU < 0.50), quality tiers & funnel assignment...`);
    if (onProgress) onProgress({ stage: 'Stage E: Ranking', pct: 80, tokens: totalTokens });

    const rankRes = stageE.rankAndDedupe(scoredCandidates, showMeta, settings.constraints?.dedupe_iou_threshold || 0.50);
    log(`[Stage E] Retained ${rankRes.promos.length} unique promos (dropped ${rankRes.dropped_duplicates.length} duplicate windows).`);

    // ==========================================
    // STAGE F: QUALITY AUDIT (LLM-as-Judge)
    // ==========================================
    log(`[Stage F] Running adversarial quality audit & compiling failure mode diagnostics...`);
    if (onProgress) onProgress({ stage: 'Stage F: Quality Audit', pct: 90, tokens: totalTokens });

    const auditReport = await stageF.auditAllPromos(rankRes.promos, options);
    log(`[Stage F] Quality audit complete: Pass=${auditReport.summary.pass_count}, Warn=${auditReport.summary.warn_count}, Fail=${auditReport.summary.fail_count}.`);

    // Merge audit status into promo objects
    const finalPromos = rankRes.promos.map(p => ({
      ...p,
      audit: auditReport.detailed_audits[p.id] || { audit_status: 'pass' }
    }));

    // ==========================================
    // SAVE RUN OUTPUTS
    // ==========================================
    log(`Saving versioned run artifacts to ${runDir}...`);

    // 1. promos.json
    fs.writeFileSync(path.join(runDir, 'promos.json'), JSON.stringify(finalPromos, null, 2), 'utf8');

    // 2. audit.json
    fs.writeFileSync(path.join(runDir, 'audit.json'), JSON.stringify(auditReport, null, 2), 'utf8');

    // 3. promos.csv
    const csvRows = [
      'Rank,Promo ID,Episodes,Duration (s),Total Score,Tier,Funnel Phase,Archetype,Hook Type,Cliffhanger Type,Why It Works,Segments'
    ];
    for (const p of finalPromos) {
      const segSummary = p.segments.map(s => `Ep${s.episode}:${s.start_sec}-${s.end_sec}`).join(' | ');
      const escapeCsv = (str) => `"${String(str || '').replace(/"/g, '""')}"`;
      csvRows.push([
        p.rank,
        p.id,
        escapeCsv(p.episodes.join(', ')),
        p.duration,
        p.total_score,
        p.tier,
        escapeCsv(p.funnel_phase),
        escapeCsv(p.archetype),
        escapeCsv(p.hook?.type || p.hook?.text),
        escapeCsv(p.cliffhanger?.type || p.cliffhanger?.text),
        escapeCsv(p.why_it_works),
        escapeCsv(segSummary)
      ].join(','));
    }
    fs.writeFileSync(path.join(runDir, 'promos.csv'), csvRows.join('\n'), 'utf8');

    // 4. meta.json
    const elapsedSec = Math.round((Date.now() - startTime) / 100) / 10;
    const avgScore = finalPromos.length > 0
      ? Math.round((finalPromos.reduce((acc, p) => acc + (p.total_score || 0), 0) / finalPromos.length) * 10) / 10
      : 0;

    const runMeta = {
      run_id: runId,
      show_id: showId,
      created_at: new Date().toISOString(),
      elapsed_sec: elapsedSec,
      provider: activeProvider,
      model: activeModel,
      promos_found: finalPromos.length,
      avg_score: avgScore,
      tokens: totalTokens,
      weights: scoringWeights
    };
    fs.writeFileSync(path.join(runDir, 'meta.json'), JSON.stringify(runMeta, null, 2), 'utf8');

    // 5. run_log.txt
    log(`Pipeline execution finished in ${elapsedSec}s. Found ${finalPromos.length} promos.`);
    fs.writeFileSync(path.join(runDir, 'run_log.txt'), logMessages.join('\n'), 'utf8');

    // Update show.json
    showMeta.promos_found = finalPromos.length;
    showMeta.avg_score = avgScore;
    showMeta.last_run_id = runId;
    showMeta.status = 'ready';
    fs.writeFileSync(showJsonPath, JSON.stringify(showMeta, null, 2), 'utf8');

    if (onProgress) {
      onProgress({
        stage: 'Completed',
        pct: 100,
        runId,
        promosFound: finalPromos.length,
        avgScore,
        elapsedSec,
        tokens: totalTokens
      });
    }

    return {
      run_id: runId,
      show_id: showId,
      promos: finalPromos,
      audit: auditReport,
      meta: runMeta,
      run_dir: runDir
    };
  }
}

module.exports = new PipelineRunner();
