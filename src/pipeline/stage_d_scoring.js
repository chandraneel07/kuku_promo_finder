// Stage D: Scoring
// This module scores each promo candidate using an LLM provider.
// It expects candidate objects from stage_c_candidate_assembly.js and returns
// a list of scored promos with detailed reasons per metric.

import path from 'path';
import fs from 'fs';
import { getProvider } from '../llm/factory.js';
import { loadSettings } from '../settings.js'; // assume utility to load settings

/**
 * Load candidates generated in Stage C.
 */
function loadCandidates(showId, runId) {
  const candPath = path.resolve('data', 'shows', String(showId), 'runs', String(runId), 'candidates.json');
  if (!fs.existsSync(candPath)) {
    throw new Error(`Candidates file not found: ${candPath}`);
  }
  const { candidates } = JSON.parse(fs.readFileSync(candPath, 'utf-8'));
  return candidates;
}

/**
 * Build prompt for a single candidate.
 * The prompt is stored under prompts/stage_d_scoring.md and may contain placeholders.
 */
function buildPrompt(candidate) {
  // Simple inline prompt – real implementation could read a markdown template.
  const segmentsDesc = candidate.segments
    .map((s, idx) => `Segment ${idx + 1}: Episode ${s.episode}, ${s.startTs} – ${s.endTs}, type ${s.type}`)
    .join('\n');
  return `You are evaluating a micro‑drama promo consisting of the following segments:\n${segmentsDesc}\n\nScore the promo on these criteria (0‑10 each) and provide a short reason for each score. Return JSON matching the schema below.\n\nSchema:\n{\n  "hook": {"score": number, "reason": string},\n  "cliffhanger": {"score": number, "reason": string},\n  "standalone": {"score": number, "reason": string},\n  "intensity": {"score": number, "reason": string}\n}\n\nRemember: total duration is ${candidate.totalSec}s.`;
}

/**
 * Compute final aggregate score using weighted formula from settings (default weights).
 */
function computeAggregate(scores, weights) {
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const weightedSum =
    scores.hook.score * weights.hook +
    scores.cliffhanger.score * weights.cliffhanger +
    scores.standalone.score * weights.standalone +
    scores.intensity.score * weights.intensity;
  // Scale to 0‑100
  return Math.round((weightedSum / (totalWeight * 10)) * 100);
}

/**
 * Main function – generates scores for all candidates.
 */
export async function generateScores(showId, runId) {
  const candidates = loadCandidates(showId, runId);
  const settings = loadSettings(); // expects { scoringWeights: {hook:30,...} }
  const defaultWeights = { hook: 30, cliffhanger: 30, standalone: 25, intensity: 15 };
  const weights = settings?.scoringWeights || defaultWeights;
  const provider = getProvider(); // uses settings internally

  const scored = [];
  for (const cand of candidates) {
    const prompt = buildPrompt(cand);
    const schema = {
      type: 'object',
      properties: {
        hook: { type: 'object', properties: { score: { type: 'integer', minimum: 0, maximum: 10 }, reason: { type: 'string' } }, required: ['score', 'reason'] },
        cliffhanger: { type: 'object', properties: { score: { type: 'integer', minimum: 0, maximum: 10 }, reason: { type: 'string' } }, required: ['score', 'reason'] },
        standalone: { type: 'object', properties: { score: { type: 'integer', minimum: 0, maximum: 10 }, reason: { type: 'string' } }, required: ['score', 'reason'] },
        intensity: { type: 'object', properties: { score: { type: 'integer', minimum: 0, maximum: 10 }, reason: { type: 'string' } }, required: ['score', 'reason'] },
      },
      required: ['hook', 'cliffhanger', 'standalone', 'intensity'],
    };
    try {
      const result = await provider.generateJSON(prompt, schema, { temperature: 0.2 });
      const aggregate = computeAggregate(result, weights);
      scored.push({ candidate: cand, scores: result, aggregateScore: aggregate });
    } catch (e) {
      // On failure, record error and continue.
      scored.push({ candidate: cand, error: e.message });
    }
  }

  // Persist results.
  const outDir = path.resolve('data', 'shows', String(showId), 'runs', String(runId));
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'scored_promos.json');
  fs.writeFileSync(outPath, JSON.stringify({ scoredPromos: scored }, null, 2));
  return scored;
}

// Simple CLI for manual testing.
if (require.main === module) {
  (async () => {
    const [showId, runId] = process.argv.slice(2);
    if (!showId || !runId) {
      console.error('Usage: node stage_d_scoring.js <showId> <runId>');
      process.exit(1);
    }
    try {
      const res = await generateScores(showId, runId);
      console.log(`Scored ${res.length} candidates`);
    } catch (err) {
      console.error('Error:', err);
    }
  })();
}
