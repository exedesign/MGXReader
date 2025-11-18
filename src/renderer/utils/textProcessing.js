/**
 * Clean extracted PDF text by removing headers, footers, and page numbers
 * @param {string} rawText - Raw text from PDF
 * @returns {string} - Cleaned text
 */
export function cleanScreenplayText(rawText) {
  if (!rawText) return '';

  let text = rawText;

  // Remove page numbers (standalone numbers on a line)
  text = text.replace(/^\s*\d+\s*$/gm, '');

  // Remove common screenplay headers/footers
  text = text.replace(/^\s*(CONTINUED|CONTINUED:)\s*$/gim, '');
  text = text.replace(/^\s*\(\s*CONTINUED\s*\)\s*$/gim, '');

  // Remove multiple consecutive blank lines (keep max 2)
  text = text.replace(/\n{4,}/g, '\n\n\n');

  // Remove leading/trailing whitespace from lines while preserving indentation
  text = text.split('\n').map(line => line.trimEnd()).join('\n');

  // Remove excessive spaces (more than 2 consecutive spaces)
  text = text.replace(/ {3,}/g, '  ');

  return text.trim();
}

/**
 * Parse screenplay text into structured scenes
 * @param {string} text - Screenplay text
 * @returns {Array} - Array of scene objects
 */
export function parseScenes(text) {
  if (!text) return [];

  const scenes = [];
  const sceneHeaderRegex = /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s+(.+?)\s*-\s*(DAY|NIGHT|MORNING|AFTERNOON|EVENING|DUSK|DAWN|LATER|CONTINUOUS)/gim;

  const lines = text.split('\n');
  let currentScene = null;
  let lineIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(sceneHeaderRegex);

    if (match) {
      // Save previous scene if exists
      if (currentScene) {
        currentScene.endLine = lineIndex - 1;
        scenes.push(currentScene);
      }

      // Start new scene
      currentScene = {
        sceneNumber: scenes.length + 1,
        header: line.trim(),
        startLine: lineIndex,
        endLine: null,
        intExt: match[1].replace('.', ''),
        location: match[2].trim(),
        timeOfDay: match[3],
        text: '',
      };
    }

    if (currentScene) {
      currentScene.text += line + '\n';
    }

    lineIndex++;
  }

  // Add last scene
  if (currentScene) {
    currentScene.endLine = lineIndex - 1;
    scenes.push(currentScene);
  }

  return scenes;
}

/**
 * Extract character names from screenplay text
 * @param {string} text - Screenplay text
 * @returns {Array} - Array of unique character names
 */
export function extractCharacters(text) {
  if (!text) return [];

  // Character names in screenplays are typically in ALL CAPS on their own line
  const characterRegex = /^\s{20,}([A-Z][A-Z\s.']+[A-Z])\s*$/gm;
  const characters = new Set();

  let match;
  while ((match = characterRegex.exec(text)) !== null) {
    const name = match[1].trim();
    // Filter out common false positives
    if (
      name.length > 2 &&
      name.length < 30 &&
      !name.includes('FADE') &&
      !name.includes('CUT') &&
      !name.includes('DISSOLVE') &&
      !name.includes('CONTINUED')
    ) {
      characters.add(name);
    }
  }

  return Array.from(characters).sort();
}

/**
 * Estimate script duration based on page count
 * @param {number} pageCount - Number of pages
 * @returns {object} - Duration estimation
 */
export function estimateDuration(pageCount) {
  const minutesPerPage = 1;
  const totalMinutes = pageCount * minutesPerPage;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return {
    totalMinutes,
    hours,
    minutes,
    formatted: `${hours}h ${minutes}m`,
  };
}

/**
 * Format text for speed reading (word by word)
 * @param {string} text - Text to format
 * @returns {Array} - Array of words
 */
export function formatForSpeedReading(text) {
  if (!text) return [];

  return text
    .split(/\s+/)
    .filter(word => word.length > 0)
    .map((word, index) => ({
      id: index,
      text: word,
      length: word.length,
    }));
}

/**
 * Parse words with rich metadata for advanced RSVP reading
 * Converts text into structured word objects with page tracking and unique IDs
 * @param {string} text - Full screenplay text
 * @param {number} estimatedPageBreak - Approximate words per page (default: 250)
 * @returns {Array} - Array of word objects: {id: "uuid", word: "string", page: number, originalIndex: number}
 */
export function parseWordsWithMetadata(text, estimatedPageBreak = 250) {
  if (!text) return [];

  // Split text into words
  const words = text.split(/\s+/).filter(word => word.length > 0);

  // Generate unique IDs and calculate page numbers
  return words.map((word, index) => {
    // Calculate page based on word count (screenplay standard: ~1 page = 1 minute = ~250 words)
    const page = Math.floor(index / estimatedPageBreak) + 1;

    return {
      id: `word-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      word: word,
      page: page,
      originalIndex: index,
    };
  });
}

/**
 * Extract page breaks from PDF metadata if available
 * @param {string} text - Full text with potential page markers
 * @returns {Array} - Array of page boundary indices
 */
export function extractPageBoundaries(text) {
  const pageMarkers = [];
  const lines = text.split('\n');
  let wordCount = 0;

  lines.forEach((line, lineIndex) => {
    // Look for common PDF page markers or form feeds
    if (line.match(/^\s*\f\s*$/) || line.match(/^\s*PAGE\s+\d+\s*$/i)) {
      pageMarkers.push(wordCount);
    }
    // Count words in current line
    wordCount += line.split(/\s+/).filter(w => w.length > 0).length;
  });

  return pageMarkers;
}

/**
 * Calculate reading time
 * @param {number} wordCount - Number of words
 * @param {number} wpm - Words per minute
 * @returns {object} - Reading time estimation
 */
export function calculateReadingTime(wordCount, wpm = 250) {
  const totalMinutes = Math.ceil(wordCount / wpm);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return {
    totalMinutes,
    hours,
    minutes,
    formatted: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
  };
}
