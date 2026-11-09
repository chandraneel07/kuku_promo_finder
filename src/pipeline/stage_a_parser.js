const fs = require('fs');
const path = require('path');

function timestampToSeconds(tsStr) {
  if (!tsStr) return null;
  const cleaned = tsStr.replace(/[()]/g, '').trim();
  const parts = cleaned.split(':');
  if (parts.length === 2) {
    const min = parseFloat(parts[0]);
    const sec = parseFloat(parts[1]);
    if (isNaN(min) || isNaN(sec)) return null;
    return min * 60 + sec;
  } else if (parts.length === 3) {
    const hr = parseFloat(parts[0]);
    const min = parseFloat(parts[1]);
    const sec = parseFloat(parts[2]);
    if (isNaN(hr) || isNaN(min) || isNaN(sec)) return null;
    return hr * 3600 + min * 60 + sec;
  }
  const direct = parseFloat(cleaned);
  return isNaN(direct) ? null : direct;
}

function secondsToTimestamp(seconds) {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2);
  const padMin = String(mins).padStart(2, '0');
  const padSec = parseFloat(secs) < 10 ? '0' + secs : secs;
  return `${padMin}:${padSec}`;
}

class StageAParser {
  /**
   * Parse a single episode text content
   */
  parseEpisodeContent(rawText, fallbackEpisodeNum = 1) {
    let episodeNumber = fallbackEpisodeNum;
    let episodeTitle = `Episode ${episodeNumber}`;
    let logline = '';
    let continuityNotes = '';

    const epNumMatch = rawText.match(/EPISODE(?:\s+NUMBER)?:\s*(Episode\s*(\d+).*)/i) ||
                       rawText.match(/^#*\s*Episode\s+(\d+)/im);
    if (epNumMatch) {
      if (epNumMatch[2]) {
        episodeNumber = parseInt(epNumMatch[2], 10);
        episodeTitle = epNumMatch[1].trim();
      } else if (epNumMatch[1]) {
        episodeNumber = parseInt(epNumMatch[1], 10);
        episodeTitle = `Episode ${episodeNumber}`;
      }
    }

    const loglineMatch = rawText.match(/EPISODE LOGLINE:\s*(.*)/i);
    if (loglineMatch) logline = loglineMatch[1].trim();

    const contMatch = rawText.match(/CONTINUITY NOTES:\s*([\s\S]*?)(?=--- SCRIPT START ---|SCENE \d+|$)/i);
    if (contMatch) continuityNotes = contMatch[1].trim();

    // Find script body
    const scriptStartIdx = rawText.indexOf('--- SCRIPT START ---');
    const scriptContent = scriptStartIdx !== -1 
      ? rawText.substring(scriptStartIdx + '--- SCRIPT START ---'.length)
      : rawText;

    const scenes = [];
    const sceneRegex = /SCENE\s+(\d+)\s*\r?\n(?:Scene heading:\s*(.*?)\s*\r?\n)?(?:Scene start:\s*(.*?)\s*\r?\n)?(?:Scene end:\s*(.*?)\s*\r?\n)?Actions and dialogue:\s*\r?\n([\s\S]*?)(?=(?:SCENE\s+\d+|--- SCRIPT END ---|$))/gi;
    
    let sceneMatch;
    let fallbackSceneIdx = 1;

    while ((sceneMatch = sceneRegex.exec(scriptContent)) !== null) {
      const sceneNum = parseInt(sceneMatch[1], 10) || fallbackSceneIdx;
      const heading = (sceneMatch[2] || `SCENE ${sceneNum}`).trim();
      const startTimeStr = (sceneMatch[3] || '').trim();
      const endTimeStr = (sceneMatch[4] || '').trim();
      const rawBody = sceneMatch[5] || '';

      const startSec = timestampToSeconds(startTimeStr);
      const endSec = timestampToSeconds(endTimeStr);

      const parsedBlocks = this.parseSceneBlocks(rawBody, sceneNum, startSec ?? 0.0, endSec ?? 60.0, episodeNumber);

      scenes.push({
        scene_id: `SCENE_${String(sceneNum).padStart(2, '0')}`,
        scene_number: sceneNum,
        heading,
        scene_start_ts: startTimeStr || null,
        scene_end_ts: endTimeStr || null,
        start_sec: startSec,
        end_sec: endSec,
        blocks_count: parsedBlocks.length,
        blocks: parsedBlocks
      });
      fallbackSceneIdx++;
    }

    // Fallback: If no "SCENE XX" markers matched, treat whole body as single scene
    if (scenes.length === 0) {
      const lines = scriptContent.split(/\r?\n/).filter(l => l.trim().length > 0);
      const parsedBlocks = this.parseSceneBlocks(scriptContent, 1, 0.0, 60.0, episodeNumber);
      scenes.push({
        scene_id: 'SCENE_01',
        scene_number: 1,
        heading: `EPISODE ${episodeNumber} - COMPLETE SCENE`,
        scene_start_ts: '00:00.00',
        scene_end_ts: '01:00.00',
        start_sec: 0.0,
        end_sec: 60.0,
        blocks_count: parsedBlocks.length,
        blocks: parsedBlocks
      });
    }

    return {
      episode: episodeNumber,
      title: episodeTitle,
      logline,
      continuity_notes: continuityNotes,
      scenes_count: scenes.length,
      scenes
    };
  }

  /**
   * Parse dialogue, action, camera, and sound cues inside a scene
   */
  parseSceneBlocks(rawBody, sceneNum, sceneStartSec, sceneEndSec, epNum) {
    const blocks = [];
    const blockRegex = /\*\*([^*]+)\*\*:?\s*(\([0-9:.]+\))?\s*(.*?)(?=\n\s*\*\*|\n\s*---|$(?!\n))/gs;

    let match;
    let blockIdx = 1;
    let rollingSec = sceneStartSec;

    while ((match = blockRegex.exec(rawBody)) !== null) {
      const tagRaw = match[1].trim();
      const inlineTs = match[2] ? match[2].trim() : null;
      let text = (match[3] || '').trim();

      const parsedInlineSec = inlineTs ? timestampToSeconds(inlineTs) : null;
      let timestampFlag = 'verified';

      if (parsedInlineSec !== null) {
        rollingSec = parsedInlineSec;
      } else {
        timestampFlag = 'interpolated';
      }

      // Determine block type
      let type = 'dialogue';
      let speaker = null;
      let camera = null;
      let action = null;

      const upperTag = tagRaw.toUpperCase();
      if (upperTag.includes('CAMERA') || upperTag.includes('SHOT') || upperTag.includes('CLOSE UP') || upperTag.includes('WIDE SHOT') || upperTag.includes('PUSH IN')) {
        type = 'camera';
        camera = text;
      } else if (upperTag.includes('ACTION') || upperTag.includes('SFX') || upperTag.includes('SOUND') || upperTag.includes('MUSIC')) {
        type = upperTag.includes('SFX') || upperTag.includes('SOUND') ? 'sound' : 'action';
        action = text;
      } else {
        type = 'dialogue';
        speaker = tagRaw;
      }

      // Calculate approximate duration based on word count
      const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
      const durationSec = Math.max(1.2, (wordCount / 2.5)); // ~150 wpm speech rate

      const blockStart = rollingSec;
      const blockEnd = Math.min(sceneEndSec || (rollingSec + durationSec), rollingSec + durationSec);
      rollingSec = blockEnd;

      blocks.push({
        id: `EP${String(epNum).padStart(2, '0')}_S${String(sceneNum).padStart(2, '0')}_B${String(blockIdx).padStart(3, '0')}`,
        type,
        speaker,
        text,
        camera,
        action,
        start: Math.round(blockStart * 100) / 100,
        end: Math.round(blockEnd * 100) / 100,
        duration: Math.round((blockEnd - blockStart) * 100) / 100,
        timestamp_flag: timestampFlag
      });
      blockIdx++;
    }

    return blocks;
  }

  /**
   * Parse all screenplay files for a show
   */
  parseShowScreenplays(showDir, parsedOutputDir) {
    if (!fs.existsSync(parsedOutputDir)) {
      fs.mkdirSync(parsedOutputDir, { recursive: true });
    }

    const screenplaysDir = path.join(showDir, 'screenplays');
    if (!fs.existsSync(screenplaysDir)) {
      throw new Error(`Screenplays directory not found at: ${screenplaysDir}`);
    }

    const files = fs.readdirSync(screenplaysDir)
      .filter(f => f.endsWith('.txt') || f.endsWith('.md'))
      .sort((a, b) => {
        const numA = parseInt((a.match(/\d+/) || [0])[0], 10);
        const numB = parseInt((b.match(/\d+/) || [0])[0], 10);
        return numA - numB;
      });

    const parsedEpisodes = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = path.join(screenplaysDir, file);
      const rawText = fs.readFileSync(filePath, 'utf8');
      const epParsed = this.parseEpisodeContent(rawText, i + 1);

      const outFileName = `ep_${String(epParsed.episode).padStart(2, '0')}.json`;
      fs.writeFileSync(path.join(parsedOutputDir, outFileName), JSON.stringify(epParsed, null, 2), 'utf8');
      parsedEpisodes.push(epParsed);
    }

    return parsedEpisodes;
  }
}

module.exports = new StageAParser();
