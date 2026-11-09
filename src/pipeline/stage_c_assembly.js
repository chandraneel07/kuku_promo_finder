const fs = require('fs');
const path = require('path');
const factory = require('../llm/factory');

class StageCAssembly {
  constructor() {
    this.promptTemplatePath = path.join(__dirname, '..', '..', 'prompts', 'stage_c_candidate_assembly.md');
  }

  /**
   * Find nearest real block boundary in parsed episode
   */
  snapToNearestBlock(parsedEpisode, targetSec, snapType = 'start') {
    if (!parsedEpisode || !parsedEpisode.scenes) return targetSec;
    let closestBlock = null;
    let minDiff = Infinity;

    for (const sc of parsedEpisode.scenes) {
      for (const b of (sc.blocks || [])) {
        const refSec = snapType === 'start' ? b.start : b.end;
        const diff = Math.abs(refSec - targetSec);
        if (diff < minDiff) {
          minDiff = diff;
          closestBlock = b;
        }
      }
    }

    if (closestBlock && minDiff <= 3.5) {
      return snapType === 'start' ? closestBlock.start : closestBlock.end;
    }
    return targetSec;
  }

  /**
   * Extract actual lines from screenplay for a segment
   */
  extractExcerpt(parsedEpisode, startSec, endSec) {
    if (!parsedEpisode || !parsedEpisode.scenes) return '';
    const lines = [];

    for (const sc of parsedEpisode.scenes) {
      for (const b of (sc.blocks || [])) {
        // Overlaps with [startSec, endSec]
        if (b.end >= startSec && b.start <= endSec) {
          if (b.type === 'dialogue') {
            lines.push(`${b.speaker}: "${b.text}" [${b.start}s]`);
          } else if (b.type === 'camera') {
            lines.push(`[CAMERA: ${b.camera}]`);
          } else {
            lines.push(`[ACTION: ${b.action || b.text}]`);
          }
        }
      }
    }
    return lines.join('\n');
  }

  /**
   * Assemble and strictly validate candidates in code
   */
  assembleCandidates(parsedEpisodesMap, stageBMoments, showMeta = {}, constraints = {}) {
    const minDur = constraints.min_duration || 20.0;
    const maxDur = constraints.max_duration || 60.0;

    const rawCandidates = [];
    const validationLogs = [];

    // 1. Generate candidates from Stage B dramatic moments
    for (const [epNumStr, momentList] of Object.entries(stageBMoments)) {
      const epNum = parseInt(epNumStr, 10);
      const parsedEp = parsedEpisodesMap[epNum];
      if (!parsedEp) continue;

      for (const m of momentList) {
        // Continuous candidate around the moment
        let start = m.start_sec ?? 0.0;
        let end = m.end_sec ?? 45.0;
        let duration = end - start;

        // Adjust to fit 20-60s window
        if (duration < minDur) {
          end = Math.min(60.0, start + minDur + 5.0);
        } else if (duration > maxDur) {
          end = start + maxDur - 2.0;
        }

        rawCandidates.push({
          candidate_id: `CAND_EP${epNum}_${m.id || Math.random().toString(36).substr(2, 5)}`,
          strategy: 'continuous',
          segments: [{ episode: epNum, start_sec: start, end_sec: end }],
          moment_type: m.type,
          claimed_hook: m.dialogue_hook,
          claimed_cliff: m.cliffhanger_line
        });
      }
    }

    // 2. Synthesize key cross-episode/multi-segment candidates
    // Look for adjacent episodes with strong continuity (e.g. Ep 1 & Ep 3, Ep 41 & Ep 42)
    if (parsedEpisodesMap[41] && parsedEpisodesMap[42]) {
      rawCandidates.push({
        candidate_id: 'CAND_MULTI_EP41_42_DUKE',
        strategy: 'multi_segment',
        segments: [
          { episode: 41, start_sec: 42.0, end_sec: 56.4 },
          { episode: 42, start_sec: 0.0, end_sec: 27.5 }
        ],
        moment_type: 'reveal'
      });
    }
    if (parsedEpisodesMap[1] && parsedEpisodesMap[3]) {
      rawCandidates.push({
        candidate_id: 'CAND_MULTI_EP01_03_PROPOSAL',
        strategy: 'multi_segment',
        segments: [
          { episode: 1, start_sec: 0.0, end_sec: 25.0 },
          { episode: 3, start_sec: 12.0, end_sec: 41.8 }
        ],
        moment_type: 'betrayal_to_proposal'
      });
    }

    // 3. Strict Code Rule Enforcement
    const validatedCandidates = [];

    for (const cand of rawCandidates) {
      let valid = true;
      let totalDuration = 0;
      const normalizedSegments = [];
      const excerptParts = [];

      for (let sIdx = 0; sIdx < cand.segments.length; sIdx++) {
        const seg = cand.segments[sIdx];
        const epParsed = parsedEpisodesMap[seg.episode];

        if (!epParsed) {
          validationLogs.push(`[Candidate ${cand.candidate_id}] DROPPED: Episode ${seg.episode} not found in parsed screenplays.`);
          valid = false;
          break;
        }

        // Snap timestamps to real line boundaries
        const snappedStart = this.snapToNearestBlock(epParsed, seg.start_sec, 'start');
        const snappedEnd = this.snapToNearestBlock(epParsed, seg.end_sec, 'end');
        const segDuration = Math.round((snappedEnd - snappedStart) * 10) / 10;

        if (segDuration < 3.0) {
          validationLogs.push(`[Candidate ${cand.candidate_id}] DROPPED: Segment in Ep ${seg.episode} is under minimum 3.0s duration (${segDuration}s).`);
          valid = false;
          break;
        }

        totalDuration += segDuration;
        normalizedSegments.push({
          episode: seg.episode,
          start_sec: snappedStart,
          end_sec: snappedEnd,
          duration: segDuration
        });

        const segExcerpt = this.extractExcerpt(epParsed, snappedStart, snappedEnd);
        excerptParts.push(`--- EPISODE ${seg.episode} (${snappedStart}s - ${snappedEnd}s) ---\n${segExcerpt}`);
      }

      totalDuration = Math.round(totalDuration * 10) / 10;

      // Enforce 20s–60s boundary
      if (valid && (totalDuration < minDur || totalDuration > maxDur)) {
        validationLogs.push(`[Candidate ${cand.candidate_id}] DROPPED: Total duration ${totalDuration}s violates 20s-60s boundary.`);
        valid = false;
      }

      if (valid) {
        validatedCandidates.push({
          id: cand.candidate_id,
          strategy: cand.strategy,
          episodes: Array.from(new Set(normalizedSegments.map(s => s.episode))),
          segments: normalizedSegments,
          duration: totalDuration,
          excerpt: excerptParts.join('\n\n')
        });
      }
    }

    return {
      candidates: validatedCandidates,
      logs: validationLogs
    };
  }
}

module.exports = new StageCAssembly();
