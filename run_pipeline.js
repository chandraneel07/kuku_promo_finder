const fs = require('fs');
const path = require('path');
const { parseAllEpisodes } = require('./src/parser');
const { findAllPromos } = require('./src/engine');
const { rankAndPackagePromos } = require('./src/ranker');
const { runQualityAudit } = require('./src/quality_check');

const DATA_DIR = 'C:/Users/chand/.gemini/antigravity/scratch/kuku_promo_finder/data/scripts';
const OUTPUT_DIR = 'C:/Users/chand/.gemini/antigravity/scratch/kuku_promo_finder/outputs';

console.log('================================================================');
console.log('          KUKU AI MICRODRAMA PROMO FINDER PIPELINE             ');
console.log('================================================================\n');

const startTime = Date.now();

// 1. Parse Episodes
console.log(`[1/5] Parsing screenplays from: ${DATA_DIR}...`);
const episodes = parseAllEpisodes(DATA_DIR);
console.log(`      Successfully parsed ${episodes.length} episodes.`);

// 2. Run Engine & Candidate Generation
console.log(`\n[2/5] Scanning for candidate promos (20s - 60s windows)...`);
const { promos, continuousCount, multiSegmentCount } = findAllPromos(episodes);
console.log(`      Found ${promos.length} total promo candidates.`);
console.log(`      - Continuous scene stretches: ${continuousCount}`);
console.log(`      - High-impact multi-segment joins: ${multiSegmentCount}`);

// 3. Rank & Package
console.log(`\n[3/5] Scoring, ranking, and classifying marketing archetypes...`);
const { strategyOverview, rankedPromos } = rankAndPackagePromos(promos);
console.log(`      Ranked ${rankedPromos.length} promos across all 50 episodes.`);

// 4. Quality Audit & Failure Diagnostics
console.log(`\n[4/5] Executing automated quality audit and failure mode diagnostics...`);
const auditReport = runQualityAudit(rankedPromos, episodes);
console.log(`      Tier S (Viral Gold, Score >= 90): ${auditReport.tierBreakdown.tierS_ViralGold}`);
console.log(`      Tier A (High Engagement, 80-89):  ${auditReport.tierBreakdown.tierA_HighEngagement}`);
console.log(`      Tier B (Context-Dependent, 70-79): ${auditReport.tierBreakdown.tierB_ContextDependent}`);
console.log(`      Tier C (Needs Recut, < 70):       ${auditReport.tierBreakdown.tierC_NeedsRecut}`);

// 5. Export Files
console.log(`\n[5/5] Exporting raw outputs and structured datasets to ${OUTPUT_DIR}...`);

// JSON Outputs
fs.writeFileSync(path.join(OUTPUT_DIR, 'promos_all.json'), JSON.stringify(promos, null, 2), 'utf8');
fs.writeFileSync(path.join(OUTPUT_DIR, 'promos_ranked.json'), JSON.stringify(rankedPromos, null, 2), 'utf8');
fs.writeFileSync(path.join(OUTPUT_DIR, 'quality_check_report.json'), JSON.stringify(auditReport, null, 2), 'utf8');

// CSV Output
const csvHeaders = [
  'Rank',
  'Promo ID',
  'Episode',
  'Total Duration',
  'Total Score',
  'Archetype',
  'Posting Phase',
  'Segment Count',
  'Segments (Ordered Timestamps)',
  'Hook (0-3s)',
  'Cliffhanger Cut',
  'Why It Works'
];

const csvRows = rankedPromos.map(p => {
  const segStr = p.segments.map(s => `[Ep ${s.episode} ${s.start}-${s.end} (${s.duration})]`).join(' + ');
  const cleanHook = `"${(p.hook || '').replace(/"/g, '""')}"`;
  const cleanCliff = `"${(p.cliffhanger || '').replace(/"/g, '""')}"`;
  const cleanWhy = `"${(p.whyItWorks || '').replace(/"/g, '""')}"`;
  const cleanTitle = `"${(p.archetype || '').replace(/"/g, '""')}"`;
  const cleanPhase = `"${(p.postingPhase || '').replace(/"/g, '""')}"`;

  return [
    p.rank,
    p.promoId,
    `"${p.episode}"`,
    p.totalDuration,
    p.scores.total,
    cleanTitle,
    cleanPhase,
    p.segments.length,
    `"${segStr}"`,
    cleanHook,
    cleanCliff,
    cleanWhy
  ].join(',');
});

const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
fs.writeFileSync(path.join(OUTPUT_DIR, 'promos_ranked.csv'), csvContent, 'utf8');

// Markdown Summary Report
let mdReport = `# Kuku Microdrama Promo Catalog: "I Married a Broken Soldier. He was a Duke"\n\n`;
mdReport += `## Executive Summary\n`;
mdReport += `- **Total Episodes Analyzed:** ${episodes.length}\n`;
mdReport += `- **Total Promos Extracted:** ${rankedPromos.length}\n`;
mdReport += `- **Duration Constraint:** 20.0s to 60.0s (Average: ${(rankedPromos.reduce((a, b) => a + b.totalDurationSec, 0) / rankedPromos.length).toFixed(1)}s)\n`;
mdReport += `- **Processing Time:** ${((Date.now() - startTime) / 1000).toFixed(2)}s\n\n`;

mdReport += `## Strategic Rollout Schedule\n`;
mdReport += `### 1. Phase 1: Day 1-2 Mass Acquisition (Top-of-Funnel)\n`;
mdReport += `*Target Archetypes: Altar Betrayal & Public Humiliation, The Mysterious Warrior Proposal*\n`;
mdReport += `Post these first to maximize thumb-stopping CTR. Cold TikTok scrollers instantly understand bride abandonment and outrageous unfairness without needing any prior plot explanation.\n\n`;

mdReport += `### 2. Phase 2: Day 3-5 Binge Trigger & App Install (Mid-Funnel)\n`;
mdReport += `*Target Archetypes: The Barehanded Briar Trial, Dungeon Torture & Unyielding Defiance*\n`;
mdReport += `Post these to deepen emotional stakes and drive series search volume. Viewers are hooked by physical sacrifice and sadistic ultimatums.\n\n`;

mdReport += `### 3. Phase 3: Day 6-8 Paywall & Episode Unlock (Bottom-of-Funnel Conversion)\n`;
mdReport += `*Target Archetypes: The Secret Duke / Royal Retribution, Scullery Maid Reversal*\n`;
mdReport += `Post these right when free episodes end to trigger paid coin unlocks. Deliver the ultimate wish-fulfillment payoff: the scorned outcast is revealed as the powerful Duchess alongside her War-Hero Duke.\n\n`;

mdReport += `## Top 15 Elite Promos\n\n`;

rankedPromos.slice(0, 15).forEach(p => {
  mdReport += `### Rank #${p.rank}: ${p.promoId} (Score: ${p.scores.total}/100)\n`;
  mdReport += `- **Episode:** ${p.episode} | **Duration:** ${p.totalDuration} | **Archetype:** ${p.archetype}\n`;
  mdReport += `- **Posting Phase:** ${p.postingPhase}\n`;
  mdReport += `- **Segments:**\n`;
  p.segments.forEach(s => {
    mdReport += `  - Segment ${s.segmentIndex}: Ep ${s.episode} Scene ${s.sceneNumber} [${s.start} -> ${s.end}] (${s.duration})\n`;
  });
  mdReport += `- **🪝 Hook (0-3s):** ${p.hook}\n`;
  mdReport += `- **⚡ Cliffhanger Cut:** ${p.cliffhanger}\n`;
  mdReport += `- **💡 Why It Works:** ${p.whyItWorks}\n`;
  mdReport += `- **Score Breakdown:** Hook: ${p.scores.hook}/30 | Cliffhanger: ${p.scores.cliffhanger}/30 | Standalone Coherence: ${p.scores.coherence}/25 | Pacing: ${p.scores.pacing}/15\n\n`;
});

mdReport += `## Quality Check & Failure Mode Diagnostic\n\n`;
mdReport += `### Where the Automated Tool Picks Badly\n`;
mdReport += `1. **The False Action Hook (Visual vs. Text Disconnect):** The tool detects high-emotion dialogue words ("You betrayed me"), but the camera direction is a slow wide shot with seated characters. Editors must verify physical action in the first 3 seconds.\n`;
mdReport += `2. **Context-Blind Lore Traps:** Promos involving complex council paperwork or secondary character politics (e.g. Father Thomas or Lord Sterling's couriers) score well on dialogue intensity but disorient cold TikTok scrollers who lack 30 episodes of backstory.\n`;
mdReport += `3. **Acoustic Boundary Clipping:** Screenplay text end-timestamps cut cleanly on punctuation, but spoken dialogue has natural vocal decay and emotional breath beats. Automated rendering requires a +0.40s audio safety padding.\n`;
mdReport += `4. **Disjoint Cross-Scene Jumps:** Stitching non-contiguous scenes across disparate locations requires transitional sound design (whoosh/flash) to prevent cold viewers from assuming a streaming playback error.\n`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'promos_summary.md'), mdReport, 'utf8');

const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
console.log(`\n================================================================`);
console.log(` Pipeline Complete in ${elapsed}s! All outputs saved to outputs/`);
console.log(`================================================================\n`);
