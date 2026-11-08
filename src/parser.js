const fs = require('fs');
const path = require('path');

/**
 * Converts timestamp string "MM:SS.SS" or "HH:MM:SS.SS" to float seconds
 */
function timestampToSeconds(tsStr) {
  if (!tsStr) return 0;
  const cleaned = tsStr.replace(/[()]/g, '').trim();
  const parts = cleaned.split(':');
  if (parts.length === 2) {
    const min = parseFloat(parts[0]);
    const sec = parseFloat(parts[1]);
    return min * 60 + sec;
  } else if (parts.length === 3) {
    const hr = parseFloat(parts[0]);
    const min = parseFloat(parts[1]);
    const sec = parseFloat(parts[2]);
    return hr * 3600 + min * 60 + sec;
  }
  return parseFloat(cleaned) || 0;
}

/**
 * Formats float seconds into "MM:SS.SS"
 */
function secondsToTimestamp(seconds) {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2);
  const padMin = String(mins).padStart(2, '0');
  const padSec = parseFloat(secs) < 10 ? '0' + secs : secs;
  return `${padMin}:${padSec}`;
}

/**
 * Parses an individual episode screenplay file
 */
function parseScreenplay(filePath) {
  const rawText = fs.readFileSync(filePath, 'utf8');

  let episodeNumber = 0;
  let episodeTitle = '';
  let logline = '';
  let continuityNotes = '';

  // Extract metadata
  const epNumMatch = rawText.match(/EPISODE NUMBER:\s*(Episode\s*(\d+).*)/i);
  if (epNumMatch) {
    episodeTitle = epNumMatch[1].trim();
    episodeNumber = parseInt(epNumMatch[2], 10);
  } else {
    const filenameMatch = path.basename(filePath).match(/episode-(\d+)/i);
    episodeNumber = filenameMatch ? parseInt(filenameMatch[1], 10) : 1;
    episodeTitle = `Episode ${episodeNumber}`;
  }

  const loglineMatch = rawText.match(/EPISODE LOGLINE:\s*(.*)/i);
  if (loglineMatch) logline = loglineMatch[1].trim();

  const contMatch = rawText.match(/CONTINUITY NOTES:\s*([\s\S]*?)(?=--- SCRIPT START ---|SCENE \d+|$)/i);
  if (contMatch) continuityNotes = contMatch[1].trim();

  // Find scenes
  const scriptStartIdx = rawText.indexOf('--- SCRIPT START ---');
  const scriptContent = scriptStartIdx !== -1 
    ? rawText.substring(scriptStartIdx + '--- SCRIPT START ---'.length)
    : rawText;
  
  // Split by SCENE XX
  const sceneRegex = /SCENE\s+(\d+)\s*\r?\nScene heading:\s*(.*?)\s*\r?\nScene start:\s*(.*?)\s*\r?\nScene end:\s*(.*?)\s*\r?\nActions and dialogue:\s*\r?\n([\s\S]*?)(?=(?:SCENE\s+\d+|--- SCRIPT END ---|$))/gi;
  
  const scenes = [];
  let sceneMatch;
  
  while ((sceneMatch = sceneRegex.exec(scriptContent)) !== null) {
    const sceneNum = parseInt(sceneMatch[1], 10);
    const heading = sceneMatch[2].trim();
    const startTimeStr = sceneMatch[3].trim();
    const endTimeStr = sceneMatch[4].trim();
    const sceneBody = sceneMatch[5].trim();
    
    const startSec = timestampToSeconds(startTimeStr);
    const endSec = timestampToSeconds(endTimeStr);

    // Parse atomic blocks in sceneBody
    const blockRegex = /\*\*([^*]+)\*\*:?\s*\r?\nStart:\s*\(([^\)]+)\)\s*\|\s*End:\s*\(([^\)]+)\)\s*\r?\n([\s\S]*?)(?=(?:\*\*[^*]+\*\*:?\s*\r?\nStart:|$))/gi;
    
    const blocks = [];
    let bMatch;
    
    while ((bMatch = blockRegex.exec(sceneBody)) !== null) {
      const rawHeader = bMatch[1].replace(/:$/, '').trim();
      const bStartStr = bMatch[2].trim();
      const bEndStr = bMatch[3].trim();
      const text = bMatch[4].trim().replace(/\r/g, '');

      const bStartSec = timestampToSeconds(bStartStr);
      const bEndSec = timestampToSeconds(bEndStr);

      let type = 'DIALOGUE';
      let speaker = null;
      let emotion = null;

      if (rawHeader === 'CAMERA') {
        type = 'CAMERA';
      } else if (rawHeader === 'ACTION') {
        type = 'ACTION';
      } else if (rawHeader === 'SOUND FX') {
        type = 'SOUND_FX';
      } else {
        type = 'DIALOGUE';
        const toneMatch = rawHeader.match(/^([^(]+)(?:\(([^)]+)\))?$/);
        if (toneMatch) {
          speaker = toneMatch[1].trim();
          emotion = toneMatch[2] ? toneMatch[2].trim() : null;
        } else {
          speaker = rawHeader;
        }
      }

      blocks.push({
        id: `ep${episodeNumber}_s${sceneNum}_b${blocks.length + 1}`,
        type,
        speaker,
        emotion,
        rawHeader,
        startStr: bStartStr,
        endStr: bEndStr,
        startSec: bStartSec,
        endSec: bEndSec,
        duration: parseFloat((bEndSec - bStartSec).toFixed(2)),
        text
      });
    }

    scenes.push({
      sceneNumber: sceneNum,
      heading,
      startStr: startTimeStr,
      endStr: endTimeStr,
      startSec,
      endSec,
      duration: parseFloat((endSec - startSec).toFixed(2)),
      blocks
    });
  }

  // Calculate episode duration
  let maxTime = 0;
  scenes.forEach(s => {
    if (s.endSec > maxTime) maxTime = s.endSec;
  });

  return {
    filePath,
    filename: path.basename(filePath),
    episodeNumber,
    episodeTitle,
    logline,
    continuityNotes,
    durationSec: maxTime,
    durationStr: secondsToTimestamp(maxTime),
    scenes
  };
}

/**
 * Parses all episodes in a directory
 */
function parseAllEpisodes(dirPath) {
  const files = fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.txt'))
    .sort((a, b) => {
      const numA = (a.match(/\d+/) || [0])[0];
      const numB = (b.match(/\d+/) || [0])[0];
      return parseInt(numA, 10) - parseInt(numB, 10);
    });

  const episodes = [];
  for (const f of files) {
    const fullPath = path.join(dirPath, f);
    episodes.push(parseScreenplay(fullPath));
  }
  return episodes;
}

module.exports = {
  timestampToSeconds,
  secondsToTimestamp,
  parseScreenplay,
  parseAllEpisodes
};
