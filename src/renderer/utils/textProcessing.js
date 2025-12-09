/**
 * Fix encoding issues on the renderer side
 * @param {string} text - Text to fix
 * @returns {string} - Fixed text
 */
function fixRendererEncoding(text) {
  if (!text || typeof text !== 'string') return text;
  
  try {
    // Additional renderer-side encoding fixes
    let fixedText = text;
    
    // Fix additional PDF extraction artifacts
    const additionalFixes = {
      // Smart quotes
      '\u201C': '"',  // left double quote
      '\u201D': '"',  // right double quote
      '\u2018': "'",  // left single quote
      '\u2019': "'",  // right single quote
      // Dashes
      '\u2013': '-',  // en dash
      '\u2014': '-',  // em dash
      // Special characters that might appear garbled
      '\u2026': '...',  // ellipsis
      '\u20AC': 'EUR',  // euro
      '\u00AE': '(R)',  // registered
      '\u00A9': '(C)',  // copyright
      '\u2122': '(TM)', // trademark
      // Turkish characters that might be garbled
      '\u0131': 'ı',  // ı
      '\u0130': 'İ',  // İ
      '\u011F': 'ğ',  // ğ
      '\u011E': 'Ğ',  // Ğ
      '\u015F': 'ş',  // ş
      '\u015E': 'Ş',  // Ş
      '\u00FC': 'ü',  // ü
      '\u00DC': 'Ü',  // Ü
      '\u00F6': 'ö',  // ö
      '\u00D6': 'Ö',  // Ö
      '\u00E7': 'ç',  // ç
      '\u00C7': 'Ç',  // Ç
      // Remove weird spacing artifacts
      '\u00A0': ' ', // non-breaking space
      '\u2000': ' ', // en quad
      '\u2001': ' ', // em quad
      '\u2002': ' ', // en space
      '\u2003': ' ', // em space
      '\u2004': ' ', // three-per-em space
      '\u2005': ' ', // four-per-em space
      '\u2006': ' ', // six-per-em space
      '\u2007': ' ', // figure space
      '\u2008': ' ', // punctuation space
      '\u2009': ' ', // thin space
      '\u200A': ' ', // hair space
    };
    
    // Apply additional fixes
    Object.keys(additionalFixes).forEach(wrongChar => {
      const fixedChar = additionalFixes[wrongChar];
      fixedText = fixedText.replace(new RegExp(wrongChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), fixedChar);
    });
    
    return fixedText;
    
  } catch (error) {
    console.warn('Error fixing renderer encoding:', error);
    return text;
  }
}

/**
 * Clean extracted PDF text by removing headers, footers, and page numbers
 * @param {string} rawText - Raw text from PDF
 * @returns {string} - Cleaned text
 */
export function cleanScreenplayText(rawText) {
  if (!rawText) return '';

  let text = rawText;

  // Fix additional encoding issues that might have been missed
  text = fixRendererEncoding(text);

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
  // Çoklu format sahne başlığı desteği: INT./EXT. + çoklu dil SAHNE/SCENE/SZENE/SCÈNE/ESCENA/SCENA/CENA + rakam (boşluklu/boşluksuz)
  const sceneHeaderRegex = /^(?:(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s+(.+?)\s*-\s*(DAY|NIGHT|MORNING|AFTERNOON|EVENING|DUSK|DAWN|LATER|CONTINUOUS|GÜNDÜZ|GECE|SABAH|AKŞAM|ÖĞLEN)|(?:SAHNE|SCENE|SZENE|SCÈNE|ESCENA|SCENA|CENA)\s*(\d+))/gim;

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

      // Parse scene info based on which group matched
      let intExt = 'UNKNOWN';
      let location = '';
      let timeOfDay = '';

      if (match[1]) {
        // INT./EXT. format matched (groups 1, 2, 3)
        intExt = match[1].replace('.', '');
        location = match[2] ? match[2].trim() : '';
        timeOfDay = match[3] || '';
      } else if (match[4]) {
        // SAHNE/SCENE + number format matched (group 4)
        intExt = 'SCENE';
        location = `Scene ${match[4]}`;
        timeOfDay = '';
      }

      // Start new scene
      currentScene = {
        sceneNumber: scenes.length + 1,
        header: line.trim(),
        startLine: lineIndex,
        endLine: null,
        intExt: intExt,
        location: location,
        timeOfDay: timeOfDay,
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
 * @param {object} pageInfo - Page information from PDF and original ratio
 * @param {number} pageInfo.pageCount - Total pages in original PDF
 * @param {number} pageInfo.totalWords - Total words in original text
 * @param {Array} pageInfo.pageBreaks - Custom page break positions
 * @returns {Array} - Array of word objects: {id: "uuid", word: "string", page: number, originalIndex: number}
 */
export function parseWordsWithMetadata(text, pageInfo = null) {
  if (!text) return [];

  // Split text into words
  const words = text.split(/\s+/).filter(word => word.length > 0);
  const totalWords = words.length;

  let pageBreaks = [];
  let wordsPerPage = 250; // Default fallback

  if (pageInfo && pageInfo.pageCount > 0) {
    // Use original page information to maintain accurate page tracking
    wordsPerPage = Math.round(pageInfo.totalWords / pageInfo.pageCount);
    
    // Use custom page breaks if provided
    if (pageInfo.pageBreaks && pageInfo.pageBreaks.length > 0) {
      pageBreaks = pageInfo.pageBreaks;
    } else {
      // Calculate even distribution based on original ratio
      for (let page = 1; page < pageInfo.pageCount; page++) {
        const breakPoint = Math.round((page * totalWords) / pageInfo.pageCount);
        pageBreaks.push(breakPoint);
      }
    }
  } else {
    // Fallback to estimated page breaks (250 words per page)
    const estimatedPages = Math.ceil(totalWords / wordsPerPage);
    for (let page = 1; page < estimatedPages; page++) {
      pageBreaks.push(page * wordsPerPage);
    }
  }

  // Generate word objects with page information
  return words.map((word, index) => {
    // Determine which page this word belongs to
    let page = 1;
    for (let i = 0; i < pageBreaks.length; i++) {
      if (index >= pageBreaks[i]) {
        page = i + 2;
      } else {
        break;
      }
    }

    return {
      id: `word-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      word: word,
      page: page,
      originalIndex: index,
    };
  });
}

/**
 * Calculate page position for current word index
 * @param {number} currentWordIndex - Current word position
 * @param {Array} words - Array of word objects with page info
 * @returns {object} - Page position information
 */
export function calculatePagePosition(currentWordIndex, words) {
  if (!words || words.length === 0 || currentWordIndex < 0) {
    return { page: 1, progress: 0, totalPages: 1 };
  }

  const currentWord = words[currentWordIndex];
  if (!currentWord) {
    return { page: 1, progress: 0, totalPages: 1 };
  }

  const currentPage = currentWord.page;
  const totalPages = Math.max(...words.map(w => w.page));
  
  // Calculate progress within current page
  const wordsOnCurrentPage = words.filter(w => w.page === currentPage);
  const currentWordOnPage = words.slice(0, currentWordIndex + 1).filter(w => w.page === currentPage).length;
  const pageProgress = wordsOnCurrentPage.length > 0 ? (currentWordOnPage / wordsOnCurrentPage.length) * 100 : 0;

  // Calculate overall progress
  const overallProgress = words.length > 0 ? (currentWordIndex / words.length) * 100 : 0;

  return {
    page: currentPage,
    totalPages: totalPages,
    pageProgress: Math.round(pageProgress),
    overallProgress: Math.round(overallProgress),
    wordsOnPage: wordsOnCurrentPage.length,
    wordPositionOnPage: currentWordOnPage
  };
}

/**
 * Preserve page ratios when text is edited (grammar corrections, etc.)
 * @param {string} originalText - Original text
 * @param {string} editedText - Edited text
 * @param {object} originalPageInfo - Original page information
 * @returns {object} - Updated page information for edited text
 */
export function preservePageRatios(originalText, editedText, originalPageInfo) {
  if (!originalPageInfo || !originalText || !editedText) {
    return null;
  }

  const originalWords = originalText.split(/\s+/).filter(w => w.length > 0);
  const editedWords = editedText.split(/\s+/).filter(w => w.length > 0);
  
  const originalTotalWords = originalWords.length;
  const editedTotalWords = editedWords.length;
  const scaleFactor = editedTotalWords / originalTotalWords;

  // Calculate new page breaks maintaining proportional distribution
  const newPageBreaks = [];
  const newWordsPerPage = [];
  
  let currentWordIndex = 0;
  
  for (let page = 1; page <= originalPageInfo.pageCount; page++) {
    const originalWordsOnPage = originalPageInfo.wordsPerPage ? originalPageInfo.wordsPerPage[page - 1] : 
                                Math.round(originalTotalWords / originalPageInfo.pageCount);
    
    const newWordsOnPage = Math.round(originalWordsOnPage * scaleFactor);
    
    currentWordIndex += newWordsOnPage;
    
    if (page < originalPageInfo.pageCount) {
      newPageBreaks.push(Math.min(currentWordIndex, editedTotalWords));
    }
    
    newWordsPerPage.push(newWordsOnPage);
  }

  return {
    pageCount: originalPageInfo.pageCount,
    totalWords: editedTotalWords,
    pageBreaks: newPageBreaks,
    wordsPerPage: newWordsPerPage,
    scaleFactor: scaleFactor
  };
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

/**
 * Split text into chunks suitable for AI analysis
 * Preserves scene boundaries and maintains context
 * @param {string} text - Full screenplay text
 * @param {object} options - Chunking options
 * @param {number} options.maxTokens - Maximum tokens per chunk (default: 2000)
 * @param {number} options.overlapTokens - Overlap between chunks (default: 200)
 * @param {boolean} options.preserveScenes - Whether to preserve scene boundaries (default: true)
 * @returns {Array} - Array of text chunks with metadata
 */
export function splitTextForAnalysis(text, options = {}) {
  const {
    maxTokens = 2000,
    overlapTokens = 200,
    preserveScenes = true,
  } = options;

  if (!text || text.trim().length === 0) {
    return [];
  }

  // Rough token estimation: 1 token ≈ 4 characters
  const maxChars = maxTokens * 4;
  const overlapChars = overlapTokens * 4;

  const chunks = [];
  
  if (preserveScenes) {
    // Split by scenes first
    const scenes = parseScenes(text);
    
    if (scenes.length === 0) {
      // No scenes found, fall back to paragraph-based chunking
      return splitByParagraphs(text, maxChars, overlapChars);
    }

    let currentChunk = '';
    let currentScenes = [];
    let chunkIndex = 0;

    for (const scene of scenes) {
      const sceneText = scene.text;
      const combinedLength = currentChunk.length + sceneText.length;

      if (combinedLength <= maxChars || currentChunk.length === 0) {
        // Add scene to current chunk
        currentChunk += (currentChunk ? '\n\n' : '') + sceneText;
        currentScenes.push(scene);
      } else {
        // Current chunk is full, save it and start new one
        if (currentChunk.length > 0) {
          chunks.push({
            index: chunkIndex++,
            text: currentChunk.trim(),
            scenes: [...currentScenes],
            wordCount: currentChunk.split(/\s+/).length,
            tokenEstimate: Math.ceil(currentChunk.length / 4),
            type: 'scene-based',
          });
        }

        // Start new chunk with current scene
        currentChunk = sceneText;
        currentScenes = [scene];

        // If single scene is too large, split it further
        if (sceneText.length > maxChars) {
          const sceneParts = splitLargeScene(sceneText, maxChars, overlapChars);
          
          // Add scene parts as separate chunks
          for (let i = 0; i < sceneParts.length; i++) {
            chunks.push({
              index: chunkIndex++,
              text: sceneParts[i].text,
              scenes: [{
                ...scene,
                partIndex: i,
                totalParts: sceneParts.length,
                isPartial: true,
              }],
              wordCount: sceneParts[i].text.split(/\s+/).length,
              tokenEstimate: Math.ceil(sceneParts[i].text.length / 4),
              type: 'scene-part',
            });
          }

          // Reset current chunk
          currentChunk = '';
          currentScenes = [];
        }
      }
    }

    // Add remaining chunk
    if (currentChunk.length > 0) {
      chunks.push({
        index: chunkIndex,
        text: currentChunk.trim(),
        scenes: currentScenes,
        wordCount: currentChunk.split(/\s+/).length,
        tokenEstimate: Math.ceil(currentChunk.length / 4),
        type: 'scene-based',
      });
    }

  } else {
    // Simple paragraph-based chunking
    return splitByParagraphs(text, maxChars, overlapChars);
  }

  return chunks;
}

/**
 * Split text by paragraphs when scene parsing fails
 * @param {string} text - Text to split
 * @param {number} maxChars - Maximum characters per chunk
 * @param {number} overlapChars - Overlap between chunks
 * @returns {Array} - Array of text chunks
 */
function splitByParagraphs(text, maxChars, overlapChars) {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const chunks = [];
  let currentChunk = '';
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const combinedLength = currentChunk.length + paragraph.length + 2; // +2 for line breaks

    if (combinedLength <= maxChars || currentChunk.length === 0) {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    } else {
      // Save current chunk
      if (currentChunk.length > 0) {
        chunks.push({
          index: chunkIndex++,
          text: currentChunk.trim(),
          wordCount: currentChunk.split(/\s+/).length,
          tokenEstimate: Math.ceil(currentChunk.length / 4),
          type: 'paragraph-based',
        });
      }

      // Start new chunk with overlap
      const overlapText = getTextOverlap(currentChunk, overlapChars);
      currentChunk = overlapText + (overlapText ? '\n\n' : '') + paragraph;
    }
  }

  // Add remaining chunk
  if (currentChunk.length > 0) {
    chunks.push({
      index: chunkIndex,
      text: currentChunk.trim(),
      wordCount: currentChunk.split(/\s+/).length,
      tokenEstimate: Math.ceil(currentChunk.length / 4),
      type: 'paragraph-based',
    });
  }

  return chunks;
}

/**
 * Split a large scene into smaller parts
 * @param {string} sceneText - Scene text to split
 * @param {number} maxChars - Maximum characters per part
 * @param {number} overlapChars - Overlap between parts
 * @returns {Array} - Array of scene parts
 */
function splitLargeScene(sceneText, maxChars, overlapChars) {
  const parts = [];
  const sentences = sceneText.split(/[.!?]+\s+/).filter(s => s.trim().length > 0);
  
  let currentPart = '';
  
  for (const sentence of sentences) {
    const combinedLength = currentPart.length + sentence.length + 2;

    if (combinedLength <= maxChars || currentPart.length === 0) {
      currentPart += (currentPart ? '. ' : '') + sentence;
    } else {
      // Save current part
      if (currentPart.length > 0) {
        parts.push({
          text: currentPart.trim() + '.',
        });
      }

      // Start new part with overlap
      const overlapText = getTextOverlap(currentPart, overlapChars);
      currentPart = overlapText + (overlapText ? '. ' : '') + sentence;
    }
  }

  // Add remaining part
  if (currentPart.length > 0) {
    parts.push({
      text: currentPart.trim() + (currentPart.endsWith('.') ? '' : '.'),
    });
  }

  return parts;
}

/**
 * Get overlap text from the end of current chunk
 * @param {string} text - Text to extract overlap from
 * @param {number} overlapChars - Number of characters for overlap
 * @returns {string} - Overlap text
 */
function getTextOverlap(text, overlapChars) {
  if (!text || overlapChars <= 0) return '';
  
  if (text.length <= overlapChars) return text;
  
  // Try to break at word boundary
  const overlapText = text.slice(-overlapChars);
  const spaceIndex = overlapText.indexOf(' ');
  
  if (spaceIndex !== -1) {
    return overlapText.slice(spaceIndex + 1);
  }
  
  return overlapText;
}

/**
 * Estimate optimal chunk size based on AI provider and model
 * @param {string} provider - AI provider ('openai', 'gemini', 'local')
 * @param {string} model - Model name
 * @returns {object} - Recommended chunking options
 */
export function getOptimalChunkSize(provider, model = '') {
  const configs = {
    openai: {
      'gpt-4': { maxTokens: 6000, overlapTokens: 500 },
      'gpt-3.5-turbo': { maxTokens: 3000, overlapTokens: 300 },
      default: { maxTokens: 3000, overlapTokens: 300 },
    },
    gemini: {
      'gemini-2.5-flash': { maxTokens: 4000, overlapTokens: 400 }, // Optimized for reliability
      'gemini-pro': { maxTokens: 6000, overlapTokens: 500 },
      default: { maxTokens: 3000, overlapTokens: 300 }, // Conservative default
    },
    local: {
      // Conservative for local models
      default: { maxTokens: 1500, overlapTokens: 150 },
      'llama': { maxTokens: 2000, overlapTokens: 200 },
      'mistral': { maxTokens: 4000, overlapTokens: 400 },
    },
  };

  const providerConfig = configs[provider] || configs.local;
  const modelConfig = providerConfig[model.toLowerCase()] || providerConfig.default;

  return {
    ...modelConfig,
    preserveScenes: true,
  };
}
