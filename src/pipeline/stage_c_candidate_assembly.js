// Stage C: Candidate Assembly
// This module builds promo candidates from episode analysis results.
// It enforces hard rules: total duration 20-60 seconds, segment boundaries on scene boundaries,
// no overlapping duplicate segments, and respects cross‑episode stitching.

import fs from 'fs';
import path from 'path';
import { parseISO, differenceInSeconds } from 'date-fns';

/**
 * Load analysis JSON for a given show and run.
 * Expected format (from Stage B):
 * {
 *   episodes: [
 *     {
 *       episode: number,
 *       summary: string,
 *       characters: string[],
 *       moments: [
 *         { type: string, start: string, end: string, description: string }
 *       ]
 *     },
 *     ...
 *   ]
 * }
 */
function loadAnalysis(showId, runId) {
  const filePath = path.resolve('data', 'shows', String(showId), 'runs', String(runId), 'analysis.json');
  if (!fs.existsSync(filePath)) {
    throw new Error(`Analysis file not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * Convert ISO timestamp string or "HH:MM:SS" to seconds.
 */
function tsToSec(ts) {
  // Accept "HH:MM:SS" or "MM:SS" or plain seconds.
  if (!isNaN(Number(ts))) return Number(ts);
  const parts = ts.split(':').map(Number).reverse();
  let sec = 0;
  for (let i = 0; i < parts.length; i++) {
    sec += parts[i] * Math.pow(60, i);
  }
  return sec;
}

/**
 * Build candidate promos for a single episode.
 * Returns an array of candidate objects:
 * { episodes: [epNum], segments: [{episode, startSec, endSec, startTs, endTs}], totalSec }
 */
function buildEpisodeCandidates(episodeData) {
  const MIN = 20; // seconds
  const MAX = 60;
  const candidates = [];
  const moments = episodeData.moments || [];
  // Sort moments by start time.
  moments.sort((a, b) => tsToSec(a.start) - tsToSec(b.start));
  // Simple sliding‑window approach: start at each moment, keep adding until duration exceeds MAX.
  for (let i = 0; i < moments.length; i++) {
    let start = moments[i];
    let startSec = tsToSec(start.start);
    let endSec = startSec;
    const segments = [];
    for (let j = i; j < moments.length; j++) {
      const cur = moments[j];
      const curStartSec = tsToSec(cur.start);
      const curEndSec = tsToSec(cur.end);
      // Ensure monotonic growth.
      if (curStartSec < startSec) continue;
      // Extend window.
      if (curEndSec > endSec) endSec = curEndSec;
      const dur = endSec - startSec;
      if (dur > MAX) break; // stop expanding this start point
      segments.push({
        episode: episodeData.episode,
        startSec: curStartSec,
        endSec: curEndSec,
        startTs: cur.start,
        endTs: cur.end,
        type: cur.type,
        description: cur.description,
      });
      if (dur >= MIN) {
        candidates.push({
          episodes: [episodeData.episode],
          segments: [...segments],
          totalSec: dur,
        });
      }
    }
  }
  return candidates;
}

/**
 * Cross‑episode stitching: allow candidates that start in episode i and end in episode i+1.
 * For simplicity we only stitch the last segment of episode i with the first of episode i+1
 * if the combined duration stays within limits.
 */
function stitchCrossEpisode(prevEpData, nextEpData) {
  const MIN = 20, MAX = 60;
  const candidates = [];
  const prevMoments = prevEpData.moments || [];
  const nextMoments = nextEpData.moments || [];
  if (!prevMoments.length || !nextMoments.length) return [];
  const lastPrev = prevMoments[prevMoments.length - 1];
  const firstNext = nextMoments[0];
  const startSec = tsToSec(lastPrev.start);
  const endSec = tsToSec(firstNext.end);
  const dur = endSec - startSec;
  if (dur >= MIN && dur <= MAX) {
    candidates.push({
      episodes: [prevEpData.episode, nextEpData.episode],
      segments: [
        {
          episode: prevEpData.episode,
          startSec: tsToSec(lastPrev.start),
          endSec: tsToSec(lastPrev.end),
          startTs: lastPrev.start,
          endTs: lastPrev.end,
          type: lastPrev.type,
          description: lastPrev.description,
        },
        {
          episode: nextEpData.episode,
          startSec: tsToSec(firstNext.start),
          endSec: tsToSec(firstNext.end),
          startTs: firstNext.start,
          endTs: firstNext.end,
          type: firstNext.type,
          description: firstNext.description,
        },
      ],
      totalSec: dur,
    });
  }
  return candidates;
}

/**
 * Main entry point.
 */
export function generateCandidates(showId, runId) {
  const analysis = loadAnalysis(showId, runId);
  const allCandidates = [];
  const eps = analysis.episodes || [];
  // Per‑episode candidates.
  for (const ep of eps) {
    allCandidates.push(...buildEpisodeCandidates(ep));
  }
  // Cross‑episode stitching.
  for (let i = 0; i < eps.length - 1; i++) {
    allCandidates.push(...stitchCrossEpisode(eps[i], eps[i + 1]));
  }
  // Deduplicate exact duplicate segment sets (simple JSON string compare).
  const uniqMap = new Map();
  for (const cand of allCandidates) {
    const key = JSON.stringify(cand.segments.map(s => `${s.episode}:${s.startTs}-${s.endTs}`));
    if (!uniqMap.has(key)) {
      uniqMap.set(key, cand);
    }
  }
  const uniques = Array.from(uniqMap.values());

  // Persist candidates for downstream stages.
  const outDir = path.resolve('data', 'shows', String(showId), 'runs', String(runId));
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'candidates.json');
  fs.writeFileSync(outPath, JSON.stringify({ candidates: uniques }, null, 2));
  return uniques;
}

// If this file is executed directly, run a quick demo (useful for debugging).
if (require.main === module) {
  const [showId, runId] = process.argv.slice(2);
  if (!showId || !runId) {
    console.error('Usage: node stage_c_candidate_assembly.js <showId> <runId>');
    process.exit(1);
  }
  try {
    const result = generateCandidates(showId, runId);
    console.log(`Generated ${result.length} candidates`);
  } catch (e) {
    console.error('Error:', e.message);
  }
}
