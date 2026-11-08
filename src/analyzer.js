/**
 * Analyzer module for Kuku Microdrama Promo Finder
 * Evaluates Screenplay Segments for Hook Strength, Cliffhanger Suspense, 
 * Standalone Coherence, and Pacing.
 */

const { secondsToTimestamp } = require('./parser');

// Hook Lexicons
const PHYSICAL_HOOK_KEYWORDS = [
  'slap', 'strike', 'punches', 'grab', 'grabs', 'seize', 'seizes', 'choke', 'shove', 'shoves',
  'drag', 'drags', 'kneel', 'kneels', 'drops to one knee', 'ring', 'blade', 'sword', 'sabre',
  'dagger', 'weapon', 'iron', 'red-hot', 'burn', 'flames', 'fire', 'explosion', 'detonation',
  'blast', 'shatter', 'shatters', 'manacle', 'manacled', 'chains', 'tear', 'tears', 'rip',
  'mud', 'blood', 'laceration', 'bleed', 'poison', 'witchcraft', 'gallows', 'hang'
];

const VERBAL_HOOK_KEYWORDS = [
  'turn around', 'not anymore', 'reject', 'plainness', 'low value', 'disown', 'disowned',
  'strip', 'arrest', 'hang', 'witchcraft', 'poison', 'who are you', 'you already know',
  'will you marry me', 'touch my wife', 'crawl', 'briars', 'blackthorn', 'beggar',
  'imposter', 'treason', 'conspiracy', 'duchess', 'duke', 'kill', 'die'
];

const EMOTIONAL_HIGH_WORDS = [
  'cruel', 'cold', 'commanding', 'imperious', 'sadistic', 'haughty', 'furious', 'hysterical',
  'breathless', 'terrified', 'resoled', 'defiant', 'unyielding', 'mocking', 'sneering', 'spiteful'
];

const CLIFFHANGER_KEYWORDS = [
  'cliffhanger', 'cut to black', 'swells', 'peak', 'drone', 'screams', 'gasps', 'detonation',
  'will you marry me', 'who are you', 'we will not', 'arrest', 'halt', 'shatters',
  'unfolds', 'unresolved', 'unearths', 'freeze', 'stares in horror', 'hardening'
];

/**
 * Extracts blocks within a given time range [startSec, endSec]
 */
function getBlocksInRange(scene, startSec, endSec) {
  return scene.blocks.filter(b => {
    // Overlaps if block start is before window end, and block end is after window start
    return b.startSec < endSec && b.endSec > startSec;
  });
}

/**
 * Analyzes the first 3-4 seconds of a segment for hook potential
 */
function evaluateHook(blocks, startSec) {
  const hookEndSec = startSec + 3.5;
  const hookBlocks = blocks.filter(b => b.startSec <= hookEndSec);
  
  let hookScore = 0;
  let hookDetails = [];
  let physicalFound = false;
  let verbalFound = false;
  let soundFound = false;

  for (const b of hookBlocks) {
    const textLower = (b.text + ' ' + (b.rawHeader || '')).toLowerCase();
    
    // Check Sound FX
    if (b.type === 'SOUND_FX') {
      if (textLower.includes('detonation') || textLower.includes('explosion') || textLower.includes('shatter') || textLower.includes('screams')) {
        hookScore += 12;
        soundFound = true;
        hookDetails.push(`Auditory Shock: ${b.text}`);
      } else {
        hookScore += 6;
        hookDetails.push(`Sound Trigger: ${b.text}`);
      }
    }

    // Check Physical Action
    if (b.type === 'ACTION' || b.type === 'CAMERA') {
      for (const kw of PHYSICAL_HOOK_KEYWORDS) {
        if (textLower.includes(kw)) {
          hookScore += 10;
          physicalFound = true;
          hookDetails.push(`Visual Shock: ${kw.toUpperCase()} in action (${b.text.slice(0, 70)}...)`);
          break;
        }
      }
    }

    // Check Dialogue
    if (b.type === 'DIALOGUE') {
      // Speaker emotional tone
      if (b.emotion) {
        const emoLower = b.emotion.toLowerCase();
        for (const emo of EMOTIONAL_HIGH_WORDS) {
          if (emoLower.includes(emo)) {
            hookScore += 5;
            hookDetails.push(`High Emotion: ${b.speaker} (${b.emotion})`);
            break;
          }
        }
      }

      // Shock dialogue keywords
      for (const kw of VERBAL_HOOK_KEYWORDS) {
        if (textLower.includes(kw)) {
          hookScore += 10;
          verbalFound = true;
          hookDetails.push(`Shock Dialogue: ${b.text.slice(0, 80)}`);
          break;
        }
      }
    }
  }

  // Cap hook score at 30
  hookScore = Math.min(30, hookScore);

  let hookSummary = '';
  if (hookBlocks.length > 0) {
    const primary = hookBlocks.find(b => b.type === 'DIALOGUE' || b.type === 'ACTION') || hookBlocks[0];
    if (primary.type === 'DIALOGUE') {
      hookSummary = `${primary.speaker}: ${primary.text}`;
    } else {
      hookSummary = primary.text.slice(0, 110);
    }
  } else {
    hookSummary = 'Dramatic opening scene setup';
  }

  return {
    score: hookScore,
    summary: hookSummary,
    details: hookDetails,
    physicalFound,
    verbalFound,
    soundFound
  };
}

/**
 * Analyzes the final 3-5 seconds of a segment for cliffhanger suspense
 */
function evaluateCliffhanger(blocks, endSec) {
  const cliffStartSec = Math.max(0, endSec - 4.5);
  const cliffBlocks = blocks.filter(b => b.endSec >= cliffStartSec);

  let cliffScore = 0;
  let cliffDetails = [];
  let isExplicitCliffhanger = false;
  let isQuestionCliffhanger = false;

  for (const b of cliffBlocks) {
    const textLower = (b.text + ' ' + (b.rawHeader || '')).toLowerCase();

    // Check explicit cliffhanger cues in sound or camera
    for (const kw of CLIFFHANGER_KEYWORDS) {
      if (textLower.includes(kw)) {
        if (kw.includes('cliffhanger') || kw.includes('cut to black') || kw.includes('swells to an ominous')) {
          cliffScore += 15;
          isExplicitCliffhanger = true;
          cliffDetails.push(`Crescendo / Blackout Cut: ${b.text}`);
        } else {
          cliffScore += 8;
          cliffDetails.push(`Suspense Trigger: ${kw}`);
        }
        break;
      }
    }

    // Check unanswered questions or shocking final lines
    if (b.type === 'DIALOGUE') {
      if (b.text.includes('?')) {
        cliffScore += 10;
        isQuestionCliffhanger = true;
        cliffDetails.push(`Unresolved Question: ${b.text}`);
      } else if (textLower.includes('will you marry me') || textLower.includes('who are you') || textLower.includes('we will not')) {
        cliffScore += 12;
        cliffDetails.push(`High Stake Statement: ${b.text}`);
      }
    }

    // Check weapon or physical confrontation at end
    if (b.type === 'ACTION' && (textLower.includes('sword') || textLower.includes('blade') || textLower.includes('kneel') || textLower.includes('iron') || textLower.includes('smoke'))) {
      cliffScore += 8;
      cliffDetails.push(`Suspended Action: ${b.text.slice(0, 60)}...`);
    }
  }

  // Cap cliffhanger score at 30
  cliffScore = Math.min(30, cliffScore);

  let cliffSummary = '';
  if (cliffBlocks.length > 0) {
    const finalBlock = cliffBlocks[cliffBlocks.length - 1];
    if (finalBlock.type === 'DIALOGUE') {
      cliffSummary = `Cuts on ${finalBlock.speaker}'s line: ${finalBlock.text}`;
    } else {
      cliffSummary = `Cuts as: ${finalBlock.text.slice(0, 110)}`;
    }
  } else {
    cliffSummary = 'Cuts at peak emotional intensity';
  }

  return {
    score: cliffScore,
    summary: cliffSummary,
    details: cliffDetails,
    isExplicitCliffhanger,
    isQuestionCliffhanger
  };
}

/**
 * Evaluates standalone coherence and lore burden
 */
function evaluateStandaloneCoherence(blocks, episode) {
  let score = 15; // baseline moderate coherence
  const fullText = blocks.map(b => (b.speaker || '') + ' ' + b.text).join(' ').toLowerCase();

  // Clear archetypal tropes boost cold comprehension:
  let archetype = 'General Melodrama';
  
  if (fullText.includes('marry') && (fullText.includes('sister') || fullText.includes('cathedral') || fullText.includes('altar') || fullText.includes('gown'))) {
    score += 8;
    archetype = 'Altar Betrayal & Public Humiliation';
  } else if (fullText.includes('duke') || fullText.includes('ashburn') || fullText.includes('ashburton') || fullText.includes('imposter') || fullText.includes('explosion')) {
    score += 8;
    archetype = 'The Secret Duke / Royal Retribution';
  } else if (fullText.includes('blackthorn') || fullText.includes('briars') || fullText.includes('signet ring') || fullText.includes('hang')) {
    score += 8;
    archetype = 'The Barehanded Briar Trial';
  } else if (fullText.includes('kneel') && (fullText.includes('propose') || fullText.includes('proposal') || fullText.includes('wife'))) {
    score += 7;
    archetype = 'The Mysterious Warrior Proposal';
  } else if (fullText.includes('red-hot') || fullText.includes('witchcraft') || fullText.includes('dungeon') || fullText.includes('iron')) {
    score += 6;
    archetype = 'Dungeon Torture & Unyielding Defiance';
  }

  // Penalize obscure lore dependencies that confuse cold viewers
  const obscureLoreWords = ['father thomas', 'seamus', 'vaughn', 'dowager', 'prudence', 'ecclesiastical trial', 'parish ledger'];
  let lorePenalty = 0;
  for (const word of obscureLoreWords) {
    if (fullText.includes(word) && !fullText.includes('duke') && !fullText.includes('juliana')) {
      lorePenalty += 3;
    }
  }
  score = Math.max(5, Math.min(25, score - lorePenalty));

  return {
    score,
    archetype,
    lorePenalty
  };
}

/**
 * Calculates optimal pacing and duration curve score (0-15 pts)
 * Sweet spot is 35s to 50s. Hard constraints: 20s to 60s.
 */
function evaluatePacing(totalDuration, blockCount) {
  if (totalDuration < 20.0 || totalDuration > 60.0) {
    return 0; // invalid promo
  }

  let durationScore = 10;
  if (totalDuration >= 35.0 && totalDuration <= 50.0) {
    durationScore = 15; // peak sweet spot
  } else if (totalDuration >= 28.0 && totalDuration <= 55.0) {
    durationScore = 12;
  } else {
    durationScore = 8;
  }

  // Pacing: check event density (blocks per second)
  const density = blockCount / totalDuration;
  if (density < 0.15) {
    // very slow dragging shot with few events
    durationScore = Math.max(5, durationScore - 3);
  }

  return durationScore;
}

/**
 * Generates an executive "Why it works" marketing line
 */
function generateWhyItWorks(archetype, hook, cliff, duration) {
  if (archetype === 'Altar Betrayal & Public Humiliation') {
    return 'Taps directly into viral outrage algorithms: a vulnerable bride humiliated at the altar creates immediate moral polarization, while her unyielding dignity hooks the viewer to demand Gerald\'s downfall.';
  } else if (archetype === 'The Secret Duke / Royal Retribution') {
    return 'Peak wish-fulfillment and power reversal: scrolling viewers are instantly halted by the explosive clash between corrupt aristocrats and the revealed true Duke backed by mutinous royal guards.';
  } else if (archetype === 'The Barehanded Briar Trial') {
    return 'Visceral emotional stakes: the cruel ultimatum to crawl through blackthorn briars barehanded triggers deep empathy and outrage, forcing cold viewers to watch her fight for her husband.';
  } else if (archetype === 'The Mysterious Warrior Proposal') {
    return 'Classic romantic disruption trope: immediately transforms public abandonment into thrilling intrigue as an imposing scarred stranger shocks high society with an unexpected marriage proposal.';
  } else if (archetype === 'Dungeon Torture & Unyielding Defiance') {
    return 'High-voltage psychological duel: villainous sadism confronted by unbroken aristocratic pride creates intense suspense before an imminent physical strike.';
  }
  return `Concise ${duration.toFixed(0)}s emotional arc: opens on an immediate scroll-stopping confrontation and cuts precisely before resolution, maximizing curiosity and paywall conversion.`;
}

module.exports = {
  evaluateHook,
  evaluateCliffhanger,
  evaluateStandaloneCoherence,
  evaluatePacing,
  generateWhyItWorks,
  getBlocksInRange
};
