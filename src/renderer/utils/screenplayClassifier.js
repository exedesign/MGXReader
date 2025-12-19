/**
 * Screenplay Element Classifier
 * 
 * Classifies PDF elements (text with coordinates) into screenplay element types:
 * - SCENE_HEADING: Scene headers (INT./EXT.)
 * - CHARACTER: Character names
 * - DIALOGUE: Character dialogue
 * - PARENTHETICAL: Dialogue directions
 * - ACTION: Action/description
 * - TRANSITION: Scene transitions (CUT TO, FADE IN, etc.)
 * - PAGE_NUMBER: Page numbers
 * - UNKNOWN: Unclassified elements
 * 
 * Uses coordinate-based detection with dynamic calibration.
 */

// Scene heading patterns (multi-language)
const SCENE_HEADING_PATTERNS = [
  /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/i,
  /^(INTERIOR|EXTERIOR)/i,
  /^(İÇ|DIŞ|İÇ\/DIŞ)\.?/i, // Turkish
  /^(SAHNE|SCENE|SZENE|SCÈNE|ESCENA|SCENA|CENA)\s*\d+/i
];

// Transition patterns
const TRANSITION_PATTERNS = [
  /^(FADE IN|FADE OUT|FADE TO BLACK|FADE TO|CUT TO|DISSOLVE TO|MATCH CUT TO|SMASH CUT TO|JUMP CUT TO)[:.]?$/i,
  /^(CONTINUED|CONTINUOUS|LATER|MONTAGE|END MONTAGE|INTERCUT|BACK TO)[:.]?$/i
];

// Parenthetical pattern
const PARENTHETICAL_PATTERN = /^\(.+\)$/;

// Page number pattern
const PAGE_NUMBER_PATTERN = /^\d+\.?$/;

/**
 * Check if text is all uppercase
 */
function isAllCaps(text) {
  const letters = text.replace(/[^a-zA-ZÀ-ÿ]/g, '');
  if (letters.length === 0) return false;
  return letters === letters.toUpperCase();
}

/**
 * Check if text matches any scene heading pattern
 */
function matchesSceneHeading(text) {
  return SCENE_HEADING_PATTERNS.some(pattern => pattern.test(text.trim()));
}

/**
 * Check if text matches transition pattern
 */
function matchesTransition(text) {
  return TRANSITION_PATTERNS.some(pattern => pattern.test(text.trim()));
}

/**
 * Check if text is parenthetical
 */
function isParenthetical(text) {
  return PARENTHETICAL_PATTERN.test(text.trim());
}

/**
 * Check if text is page number
 */
function isPageNumber(text) {
  return PAGE_NUMBER_PATTERN.test(text.trim());
}

/**
 * Classify a single element using Calibrated Coordinates
 */
export function classifyElement(element, prevElement, calibration = { globalOffset: 0, SCALE_FACTOR: 1 }) {
  const { globalOffset, SCALE_FACTOR } = calibration;
  const text = element.text.trim();
  const rawX = element.bbox.x0;

  // Dynamic Normalization: Convert to "Character Units" from Left Margin
  const x = Math.max(0, (rawX - globalOffset)) * SCALE_FACTOR;

  // Empty or whitespace-only
  if (!text || text.length === 0) {
    return { ...element, type: 'UNKNOWN', x_char: x };
  }

  // Page numbers (short numeric text, usually very high or low Y, but here checked by content)
  if (isPageNumber(text) && text.length <= 4) {
    // Optional: check Y or alignment. For now content is strong signal.
    return { ...element, type: 'PAGE_NUMBER', x_char: x };
  }

  // Debug logic for classification
  // console.log(`Classifying: "${text.substring(0,10)}..." X=${x.toFixed(1)}`);

  // --- LOGIC GATES ---

  // 1. SCENE HEADING or ACTION (X < 4.5)
  // Most Action and Scene Headers start at the left margin (0 indent).
  if (x < 4.5) {
    if (matchesSceneHeading(text)) {
      // Extract metadata
      const intExtMatch = text.match(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.|İÇ|DIŞ|INTERIOR|EXTERIOR)/i);
      const intExt = intExtMatch ? intExtMatch[1].replace('.', '').toUpperCase() : 'UNKNOWN';

      const parts = text.replace(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.|İÇ|DIŞ)\.?\s*/i, '').split('-');
      const location = parts[0]?.trim() || '';
      const timeOfDay = parts[1]?.trim() || '';

      return {
        ...element,
        type: 'SCENE_HEADING',
        intExt,
        location,
        timeOfDay,
        x_char: x
      };
    } else if (matchesTransition(text)) {
      // Rare: Left aligned transition
      return { ...element, type: 'TRANSITION', x_char: x };
    } else {
      // Default to Action
      return { ...element, type: 'ACTION', x_char: x };
    }
  }

  // 2. CHARACTER (X > 18)
  // Character names are indented significantly (~20-25 chars).
  // Transitions are also right-aligned or indented.
  // Parentheticals are also indented, but usually follow Character or Dialogue.
  if (x > 18) {
    // Transition? (Usually distinct text patterns or very far right)
    if (matchesTransition(text) || x > 45) { // 45 chars is very far right
      return { ...element, type: 'TRANSITION', x_char: x };
    }

    // Character? (All Caps)
    if (isAllCaps(text) && text.length > 1 && text.length < 50 && !isParenthetical(text)) {
      // False positives check
      if (['CONTINUED', 'BACK TO'].some(t => text.includes(t))) {
        return { ...element, type: 'TRANSITION', x_char: x };
      }
      return { ...element, type: 'CHARACTER', x_char: x };
    }

    // Parenthetical?
    if (isParenthetical(text)) {
      return {
        ...element,
        type: 'PARENTHETICAL',
        character: prevElement?.type === 'CHARACTER' ? prevElement.text : prevElement?.character,
        x_char: x
      };
    }

    // Fallback: If not all caps but indented > 18?
    // Could be dual dialogue or weird formatting.
    // Or simple Dialogue if Indent > 18 (e.g. 2.5 inch = 180pts = 25 chars... wait)
    // If Dialogue starts at 2.5 inch, that is 15 chars (vs Margin).
    // If Character starts at 3.7 inch, that is 25 chars.
    // So 18 is between Dialogue and Character?
    // If x > 18 and NOT all caps, it might be Dialogue (if indent is large) or Action (if widely indented).
    // Assuming Dialogue for now if prev was Character.
    if (prevElement?.type === 'CHARACTER' || prevElement?.type === 'DIALOGUE' || prevElement?.type === 'PARENTHETICAL') {
      return { ...element, type: 'DIALOGUE', character: prevElement.character, x_char: x };
    }

    return { ...element, type: 'ACTION', x_char: x }; // Indented Action
  }

  // 3. DIALOGUE (10 < X <= 18)
  // Dialogue is indented, but less than Character.
  if (x >= 8 && x <= 22) { // Relaxed range
    if (isParenthetical(text)) {
      return {
        ...element,
        type: 'PARENTHETICAL',
        character: prevElement?.type === 'CHARACTER' ? prevElement.text : prevElement?.character,
        x_char: x
      };
    }

    if (prevElement?.type === 'CHARACTER' || prevElement?.type === 'DIALOGUE' || prevElement?.type === 'PARENTHETICAL') {
      return {
        ...element,
        type: 'DIALOGUE',
        character: prevElement.character || prevElement.text, // If prev was Character, use its text
        x_char: x
      };
    }
  }

  // Fallback: Action
  return { ...element, type: 'ACTION', x_char: x };
}

/**
 * Classify all elements in a document
 */
export function classifyElements(elements, metadata = null) {
  // 1. Calculate Calibration
  const xValues = elements.map(e => e.bbox?.x0 || 0).filter(x => x > 10).sort((a, b) => a - b);
  const leftMarginBias = xValues.length > 0 ? xValues[0] : 0;

  const sampleX = elements.slice(0, 50).map(e => e.bbox?.x0 || 0).reduce((a, b) => a + b, 0) / 50;
  const isPointSystem = sampleX > 40;

  const PT_TO_CHAR = 1 / 7.2;
  const SCALE_FACTOR = isPointSystem ? PT_TO_CHAR : 1;
  const globalOffset = isPointSystem ? leftMarginBias : 0;

  console.log(`📏 Classifier Calibration: Offset=${globalOffset.toFixed(2)}, Scale=${SCALE_FACTOR.toFixed(3)}`);

  const classified = [];
  let prevElement = null;

  for (const element of elements) {
    const classifiedElement = classifyElement(element, prevElement, { globalOffset, SCALE_FACTOR });

    // Fix Character reference for Dialogue if missed
    if (classifiedElement.type === 'DIALOGUE' && !classifiedElement.character && prevElement?.type === 'CHARACTER') {
      classifiedElement.character = prevElement.text;
    }
    // Propagate character from previous dialogue/parenthetical
    if ((classifiedElement.type === 'DIALOGUE' || classifiedElement.type === 'PARENTHETICAL') && !classifiedElement.character) {
      if (prevElement?.character) {
        classifiedElement.character = prevElement.character;
      }
    }

    classified.push(classifiedElement);
    prevElement = classifiedElement;
  }

  // Statistics
  const stats = classified.reduce((acc, el) => {
    acc[el.type] = (acc[el.type] || 0) + 1;
    return acc;
  }, {});

  console.log('📊 Classification statistics:', stats);

  return classified;
}

/**
 * Group elements into scenes
 */
export function groupIntoScenes(classifiedElements) {
  const scenes = [];
  let currentScene = null;
  let sceneNumber = 0;

  for (const element of classifiedElements) {
    if (element.type === 'SCENE_HEADING') {
      // Save previous scene
      if (currentScene) {
        scenes.push(currentScene);
      }

      // Start new scene
      sceneNumber++;
      currentScene = {
        id: `scene-${sceneNumber}`,
        number: sceneNumber,
        header: element.text,
        intExt: element.intExt || 'UNKNOWN',
        location: element.location || '',
        timeOfDay: element.timeOfDay || '',
        startPage: element.page,
        endPage: element.page,
        startElementId: element.id,
        endElementId: element.id,
        elementIds: [element.id],
        dialogue: [], // Added for compatibility
        action: []
      };
    } else if (currentScene) {
      // Add element to current scene
      currentScene.elementIds.push(element.id);
      currentScene.endPage = element.page;
      currentScene.endElementId = element.id;

      // Collect text
      if (element.type === 'DIALOGUE') {
        currentScene.dialogue.push(element);
      } else if (element.type === 'ACTION') {
        currentScene.action.push(element);
      }
    }
  }

  // Add last scene
  if (currentScene) {
    scenes.push(currentScene);
  }

  console.log(`🎬 Grouped into ${scenes.length} scenes`);

  return scenes;
}

/**
 * Extract characters from classified elements
 */
export function extractCharacters(classifiedElements) {
  const characterSet = new Set();

  for (const element of classifiedElements) {
    if (element.type === 'CHARACTER') {
      // Clean character name (remove extensions like (V.O.), (O.S.))
      const cleanName = element.text
        .replace(/\s*\(.*?\)\s*/g, '')
        .trim();

      if (cleanName.length >= 2) {
        characterSet.add(cleanName);
      }
    }
  }

  return Array.from(characterSet).sort();
}

/**
 * Extract locations from classified elements
 */
export function extractLocations(classifiedElements) {
  const locationSet = new Set();

  for (const element of classifiedElements) {
    if (element.type === 'SCENE_HEADING' && element.location) {
      locationSet.add(element.location);
    }
  }

  return Array.from(locationSet).sort();
}
