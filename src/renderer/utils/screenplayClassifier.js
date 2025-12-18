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
 * Uses coordinate-based detection with font analysis for accurate classification.
 */

// Standard screenplay format layout profiles
export const LAYOUT_PROFILES = {
  FINAL_DRAFT: {
    name: 'Final Draft',
    sceneHeading: { x0Min: 50, x0Max: 100, bold: true, fontSize: 12 },
    character: { x0Min: 180, x0Max: 250, bold: false, allCaps: true },
    dialogue: { x0Min: 120, x0Max: 180 },
    parenthetical: { x0Min: 140, x0Max: 200 },
    action: { x0Min: 50, x0Max: 100 },
    transition: { x0Min: 400, x0Max: 550, allCaps: true }
  },
  CELTX: {
    name: 'Celtx',
    sceneHeading: { x0Min: 60, x0Max: 120, bold: true, fontSize: 12 },
    character: { x0Min: 200, x0Max: 280, allCaps: true },
    dialogue: { x0Min: 130, x0Max: 200 },
    parenthetical: { x0Min: 150, x0Max: 220 },
    action: { x0Min: 60, x0Max: 120 },
    transition: { x0Min: 420, x0Max: 570, allCaps: true }
  },
  WORD: {
    name: 'Microsoft Word (Flexible)',
    sceneHeading: { x0Min: 40, x0Max: 150, bold: true, fontSize: 11 },
    character: { x0Min: 150, x0Max: 300, allCaps: true },
    dialogue: { x0Min: 100, x0Max: 200 },
    parenthetical: { x0Min: 120, x0Max: 220 },
    action: { x0Min: 40, x0Max: 150 },
    transition: { x0Min: 350, x0Max: 600, allCaps: true }
  }
};

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
 * Detect screenplay format based on PDF metadata
 */
export function detectFormat(metadata) {
  const creator = (metadata?.creator || '').toLowerCase();
  const producer = (metadata?.producer || '').toLowerCase();
  
  if (creator.includes('final draft') || producer.includes('final draft')) {
    return LAYOUT_PROFILES.FINAL_DRAFT;
  }
  
  if (creator.includes('celtx') || producer.includes('celtx')) {
    return LAYOUT_PROFILES.CELTX;
  }
  
  if (creator.includes('word') || creator.includes('microsoft') || 
      producer.includes('word') || producer.includes('microsoft')) {
    return LAYOUT_PROFILES.WORD;
  }
  
  // Default to Word (most flexible)
  return LAYOUT_PROFILES.WORD;
}

/**
 * Check if text is all uppercase
 */
function isAllCaps(text) {
  const letters = text.replace(/[^a-zA-ZÀ-ÿ]/g, '');
  if (letters.length === 0) return false;
  return letters === letters.toUpperCase();
}

/**
 * Check if font is bold based on fontName and fontWeight
 */
function isBold(element) {
  const fontName = (element.fontName || '').toLowerCase();
  const fontWeight = element.fontWeight || 1;
  
  return fontName.includes('bold') || 
         fontName.includes('heavy') || 
         fontName.includes('black') ||
         fontWeight >= 1.5;
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
 * Classify a single element
 */
export function classifyElement(element, prevElement = null, profile = LAYOUT_PROFILES.WORD) {
  const text = element.text.trim();
  const bbox = element.bbox;
  
  // Empty or whitespace-only
  if (!text || text.length === 0) {
    return { ...element, type: 'UNKNOWN' };
  }
  
  // Page numbers (short numeric text at top/bottom)
  if (isPageNumber(text) && text.length <= 4) {
    return { ...element, type: 'PAGE_NUMBER' };
  }
  
  // Scene headings (bold, left-aligned, matches pattern)
  if (matchesSceneHeading(text) && 
      bbox.x0 >= profile.sceneHeading.x0Min && 
      bbox.x0 <= profile.sceneHeading.x0Max) {
    
    // Extract scene metadata
    const intExtMatch = text.match(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.|İÇ|DIŞ|INTERIOR|EXTERIOR)/i);
    const intExt = intExtMatch ? intExtMatch[1].replace('.', '').toUpperCase() : 'UNKNOWN';
    
    // Extract location and time
    const parts = text.replace(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.|İÇ|DIŞ)\.?\s*/i, '').split('-');
    const location = parts[0]?.trim() || '';
    const timeOfDay = parts[1]?.trim() || '';
    
    return {
      ...element,
      type: 'SCENE_HEADING',
      intExt,
      location,
      timeOfDay
    };
  }
  
  // Transitions (right-aligned, all caps)
  if (matchesTransition(text) && 
      bbox.x0 >= profile.transition.x0Min && 
      bbox.x0 <= profile.transition.x0Max) {
    return { ...element, type: 'TRANSITION' };
  }
  
  // Parentheticals (wrapped in parentheses)
  if (isParenthetical(text) && 
      bbox.x0 >= profile.parenthetical.x0Min && 
      bbox.x0 <= profile.parenthetical.x0Max) {
    return {
      ...element,
      type: 'PARENTHETICAL',
      character: prevElement?.type === 'CHARACTER' ? prevElement.text : prevElement?.character
    };
  }
  
  // Character names (centered, all caps, not too long)
  if (isAllCaps(text) && 
      text.length >= 2 && 
      text.length <= 30 &&
      bbox.x0 >= profile.character.x0Min && 
      bbox.x0 <= profile.character.x0Max &&
      !matchesTransition(text)) {
    
    // Filter common false positives
    const falsePositives = ['FADE', 'CUT', 'DISSOLVE', 'CONTINUED', 'BACK TO', 
                            'MONTAGE', 'END', 'TITLE', 'CREDITS'];
    if (falsePositives.some(fp => text.includes(fp))) {
      return { ...element, type: 'ACTION' };
    }
    
    return { ...element, type: 'CHARACTER' };
  }
  
  // Dialogue (follows character name, indented)
  if (prevElement?.type === 'CHARACTER' && 
      bbox.x0 >= profile.dialogue.x0Min && 
      bbox.x0 <= profile.dialogue.x0Max) {
    return {
      ...element,
      type: 'DIALOGUE',
      character: prevElement.text
    };
  }
  
  // Dialogue continuation (follows dialogue or parenthetical)
  if ((prevElement?.type === 'DIALOGUE' || prevElement?.type === 'PARENTHETICAL') && 
      bbox.x0 >= profile.dialogue.x0Min && 
      bbox.x0 <= profile.dialogue.x0Max) {
    return {
      ...element,
      type: 'DIALOGUE',
      character: prevElement.character
    };
  }
  
  // Action/description (left-aligned, default)
  if (bbox.x0 >= profile.action.x0Min && 
      bbox.x0 <= profile.action.x0Max) {
    return { ...element, type: 'ACTION' };
  }
  
  // Fallback: Unknown
  return { ...element, type: 'UNKNOWN' };
}

/**
 * Classify all elements in a document
 */
export function classifyElements(elements, metadata = null) {
  const profile = detectFormat(metadata);
  
  console.log(`🎯 Using screenplay profile: ${profile.name}`);
  
  const classified = [];
  let prevElement = null;
  
  for (const element of elements) {
    const classifiedElement = classifyElement(element, prevElement, profile);
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
        elementIds: [element.id]
      };
    } else if (currentScene) {
      // Add element to current scene
      currentScene.elementIds.push(element.id);
      currentScene.endPage = element.page;
      currentScene.endElementId = element.id;
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
