import * as xmljs from 'xml2js';
import * as cheerio from 'cheerio';
import JSZip from 'jszip';

/**
 * Advanced screenplay format parser supporting multiple professional formats
 * - Final Draft (.fdx)
 * - Celtx (.celtx) 
 * - Standard text formats (.txt, .docx)
 */

export class ScreenplayParser {
  constructor() {
    this.parser = new xmljs.Parser();
  }

  /**
   * Main parsing function that detects format and routes to appropriate parser
   */
  async parseFile(fileBuffer, fileName) {
    const extension = fileName.toLowerCase().split('.').pop();
    
    try {
      switch (extension) {
        case 'fdx':
          return await this.parseFinalDraft(fileBuffer);
        case 'celtx':
          return await this.parseCeltx(fileBuffer);
        case 'txt':
          return this.parseText(fileBuffer.toString('utf-8'));
        case 'docx':
          return await this.parseDocx(fileBuffer);
        default:
          throw new Error(`Unsupported file format: ${extension}`);
      }
    } catch (error) {
      console.error(`Failed to parse ${extension} file:`, error);
      throw new Error(`Failed to parse screenplay file: ${error.message}`);
    }
  }

  /**
   * Parse Final Draft (.fdx) files
   * Final Draft uses XML format with specific structure
   */
  async parseFinalDraft(buffer) {
    try {
      const xmlContent = buffer.toString('utf-8');
      const result = await this.parser.parseStringPromise(xmlContent);
      
      const finalDraft = result.FinalDraft || result.finaldraft;
      if (!finalDraft) {
        throw new Error('Invalid Final Draft file structure');
      }

      const content = finalDraft.Content?.[0];
      if (!content) {
        throw new Error('No content found in Final Draft file');
      }

      let screenplay = {
        title: this.extractTitle(finalDraft),
        author: this.extractAuthor(finalDraft),
        scenes: [],
        characters: new Set(),
        locations: new Set(),
        text: '',
        metadata: {
          format: 'Final Draft',
          version: finalDraft.$.Version || 'Unknown'
        }
      };

      // Parse paragraphs (scenes, dialogue, action, etc.)
      const paragraphs = content.Paragraph || [];
      let currentScene = null;
      let sceneNumber = 1;

      for (const paragraph of paragraphs) {
        const type = paragraph.$.Type;
        const text = this.extractTextFromParagraph(paragraph);
        
        screenplay.text += text + '\\n';

        switch (type) {
          case 'Scene Heading':
            if (currentScene) {
              screenplay.scenes.push(currentScene);
            }
            currentScene = {
              number: sceneNumber++,
              header: text,
              dialogue: [],
              action: [],
              characters: new Set(),
              ...this.parseSceneHeader(text)
            };
            screenplay.locations.add(this.extractLocation(text));
            break;

          case 'Character':
            if (currentScene && text.trim()) {
              const characterName = text.trim().replace(/\\(.*\\)/, '').trim();
              screenplay.characters.add(characterName);
              currentScene.characters.add(characterName);
            }
            break;

          case 'Dialogue':
            if (currentScene && text.trim()) {
              currentScene.dialogue.push(text);
            }
            break;

          case 'Action':
            if (currentScene && text.trim()) {
              currentScene.action.push(text);
            }
            break;
        }
      }

      // Add the last scene
      if (currentScene) {
        screenplay.scenes.push(currentScene);
      }

      // Convert sets to arrays
      screenplay.characters = Array.from(screenplay.characters);
      screenplay.locations = Array.from(screenplay.locations);
      screenplay.scenes = screenplay.scenes.map(scene => ({
        ...scene,
        characters: Array.from(scene.characters)
      }));

      return screenplay;
      
    } catch (error) {
      throw new Error(`Final Draft parsing error: ${error.message}`);
    }
  }

  /**
   * Parse Celtx (.celtx) files
   * Celtx files are ZIP archives containing HTML and other resources
   */
  async parseCeltx(buffer) {
    try {
      const zip = await JSZip.loadAsync(buffer);
      
      // Find the main script file (usually script.html or index.html)
      let scriptFile = null;
      const possibleFiles = ['script.html', 'index.html', 'content.html'];
      
      for (const fileName of possibleFiles) {
        if (zip.files[fileName]) {
          scriptFile = zip.files[fileName];
          break;
        }
      }

      if (!scriptFile) {
        // Try to find any HTML file
        const htmlFiles = Object.keys(zip.files).filter(name => name.endsWith('.html'));
        if (htmlFiles.length > 0) {
          scriptFile = zip.files[htmlFiles[0]];
        }
      }

      if (!scriptFile) {
        throw new Error('No script content found in Celtx file');
      }

      const htmlContent = await scriptFile.async('text');
      const $ = cheerio.load(htmlContent);

      let screenplay = {
        title: this.extractCeltxTitle($),
        author: this.extractCeltxAuthor($),
        scenes: [],
        characters: new Set(),
        locations: new Set(),
        text: '',
        metadata: {
          format: 'Celtx',
          version: 'Unknown'
        }
      };

      // Parse screenplay elements
      let currentScene = null;
      let sceneNumber = 1;

      // Celtx uses CSS classes to identify screenplay elements
      $('.sceneheading, .character, .dialogue, .action, .parenthetical').each((index, element) => {
        const $el = $(element);
        const className = $el.attr('class');
        const text = $el.text().trim();
        
        if (!text) return;

        screenplay.text += text + '\\n';

        switch (className) {
          case 'sceneheading':
            if (currentScene) {
              screenplay.scenes.push(currentScene);
            }
            currentScene = {
              number: sceneNumber++,
              header: text,
              dialogue: [],
              action: [],
              characters: new Set(),
              ...this.parseSceneHeader(text)
            };
            screenplay.locations.add(this.extractLocation(text));
            break;

          case 'character':
            if (currentScene && text) {
              const characterName = text.replace(/\\(.*\\)/, '').trim();
              screenplay.characters.add(characterName);
              currentScene.characters.add(characterName);
            }
            break;

          case 'dialogue':
            if (currentScene) {
              currentScene.dialogue.push(text);
            }
            break;

          case 'action':
            if (currentScene) {
              currentScene.action.push(text);
            }
            break;
        }
      });

      // Add the last scene
      if (currentScene) {
        screenplay.scenes.push(currentScene);
      }

      // Convert sets to arrays
      screenplay.characters = Array.from(screenplay.characters);
      screenplay.locations = Array.from(screenplay.locations);
      screenplay.scenes = screenplay.scenes.map(scene => ({
        ...scene,
        characters: Array.from(scene.characters)
      }));

      return screenplay;
      
    } catch (error) {
      throw new Error(`Celtx parsing error: ${error.message}`);
    }
  }

  /**
   * Parse standard text files
   */
  parseText(content) {
    const lines = content.split('\\n');
    
    let screenplay = {
      title: this.extractTitleFromText(lines),
      author: this.extractAuthorFromText(lines),
      scenes: [],
      characters: new Set(),
      locations: new Set(),
      text: content,
      metadata: {
        format: 'Text',
        version: '1.0'
      }
    };

    // Simple parsing for text files
    let currentScene = null;
    let sceneNumber = 1;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Scene heading detection (basic patterns)
      if (this.isSceneHeading(trimmed)) {
        if (currentScene) {
          screenplay.scenes.push(currentScene);
        }
        currentScene = {
          number: sceneNumber++,
          header: trimmed,
          dialogue: [],
          action: [],
          characters: new Set(),
          ...this.parseSceneHeader(trimmed)
        };
        screenplay.locations.add(this.extractLocation(trimmed));
      }
      // Character name detection (uppercase, possibly with parenthetical)
      else if (this.isCharacterName(trimmed)) {
        if (currentScene) {
          const characterName = trimmed.replace(/\\(.*\\)/, '').trim();
          screenplay.characters.add(characterName);
          currentScene.characters.add(characterName);
        }
      }
      // Dialogue or action
      else if (currentScene) {
        if (this.isDialogue(trimmed)) {
          currentScene.dialogue.push(trimmed);
        } else {
          currentScene.action.push(trimmed);
        }
      }
    }

    // Add the last scene
    if (currentScene) {
      screenplay.scenes.push(currentScene);
    }

    // Convert sets to arrays
    screenplay.characters = Array.from(screenplay.characters);
    screenplay.locations = Array.from(screenplay.locations);
    screenplay.scenes = screenplay.scenes.map(scene => ({
      ...scene,
      characters: Array.from(scene.characters)
    }));

    return screenplay;
  }

  /**
   * Helper functions for parsing
   */

  extractTextFromParagraph(paragraph) {
    if (paragraph.Text) {
      if (Array.isArray(paragraph.Text)) {
        return paragraph.Text.map(t => t._ || t).join('');
      }
      return paragraph.Text._ || paragraph.Text;
    }
    return '';
  }

  extractTitle(finalDraft) {
    try {
      return finalDraft.TitlePage?.[0]?.Content?.[0]?.Paragraph?.find(
        p => p.$.Type === 'Title'
      )?.Text?.[0]?._ || finalDraft.TitlePage?.[0]?.Content?.[0]?.Paragraph?.find(
        p => p.$.Type === 'Title'
      )?.Text?.[0] || 'Untitled Screenplay';
    } catch {
      return 'Untitled Screenplay';
    }
  }

  extractAuthor(finalDraft) {
    try {
      return finalDraft.TitlePage?.[0]?.Content?.[0]?.Paragraph?.find(
        p => p.$.Type === 'Credit'
      )?.Text?.[0]?._ || finalDraft.TitlePage?.[0]?.Content?.[0]?.Paragraph?.find(
        p => p.$.Type === 'Credit'
      )?.Text?.[0] || 'Unknown Author';
    } catch {
      return 'Unknown Author';
    }
  }

  extractCeltxTitle($) {
    return $('.title').first().text().trim() || 'Untitled Screenplay';
  }

  extractCeltxAuthor($) {
    return $('.author, .credit').first().text().trim() || 'Unknown Author';
  }

  extractTitleFromText(lines) {
    for (const line of lines.slice(0, 10)) {
      const trimmed = line.trim();
      if (trimmed && !this.isSceneHeading(trimmed) && !this.isCharacterName(trimmed)) {
        return trimmed;
      }
    }
    return 'Untitled Screenplay';
  }

  extractAuthorFromText(lines) {
    const authorKeywords = ['by', 'written by', 'author', 'yazar', 'yazan'];
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      const line = lines[i].trim().toLowerCase();
      for (const keyword of authorKeywords) {
        if (line.includes(keyword)) {
          const nextLine = lines[i + 1]?.trim();
          if (nextLine) return nextLine;
        }
      }
    }
    return 'Unknown Author';
  }

  parseSceneHeader(header) {
    const parts = header.split(' - ');
    let intExt = 'UNKNOWN';
    let location = '';
    let timeOfDay = '';

    if (parts.length >= 1) {
      const firstPart = parts[0].trim();
      if (firstPart.startsWith('INT.') || firstPart.startsWith('İÇ.')) {
        intExt = 'INTERIOR';
        location = firstPart.substring(4).trim();
      } else if (firstPart.startsWith('EXT.') || firstPart.startsWith('DIŞ.')) {
        intExt = 'EXTERIOR';
        location = firstPart.substring(4).trim();
      }
    }

    if (parts.length >= 2) {
      timeOfDay = parts[1].trim();
    }

    return { intExt, location, timeOfDay };
  }

  extractLocation(sceneHeader) {
    const parsed = this.parseSceneHeader(sceneHeader);
    return parsed.location || sceneHeader.split(' - ')[0]?.replace(/^(INT\\.|EXT\\.|İÇ\\.|DIŞ\\.)/, '').trim() || 'Unknown Location';
  }

  isSceneHeading(line) {
    const upper = line.toUpperCase();
    // Çoklu dil sahne başlıkları: SAHNE/SCENE/SZENE/SCÈNE/ESCENA/SCENA/CENA + rakam (boşluklu veya boşluksuz)
    const sceneNumberPattern = /^(SAHNE|SCENE|SZENE|SCÈNE|ESCENA|SCENA|CENA)\s*\d+/i;
    
    return upper.startsWith('INT.') || 
           upper.startsWith('EXT.') || 
           upper.startsWith('İÇ.') || 
           upper.startsWith('DIŞ.') ||
           sceneNumberPattern.test(upper) ||
           /^[A-Z\\s\\.\\-]+\\s+(DAY|NIGHT|MORNING|EVENING|GECE|GÜNDÜZ|SABAH|AKŞAM)/.test(upper);
  }

  isCharacterName(line) {
    // Character names are usually all caps, centered, and not scene headings
    return line === line.toUpperCase() && 
           line.length > 1 && 
           line.length < 50 && 
           !this.isSceneHeading(line) &&
           !/^[0-9]/.test(line) &&
           !/\\.(com|org|net|edu)$/.test(line.toLowerCase());
  }

  isDialogue(line) {
    // Simple heuristic: if it's not all caps and follows a character name, it's probably dialogue
    return line !== line.toUpperCase() && line.length > 3;
  }

  /**
   * Parse DOCX files (placeholder - would need more complex implementation)
   */
  async parseDocx(buffer) {
    // For now, treat as text extraction
    // In a full implementation, you'd use a library like mammoth.js
    const content = buffer.toString('utf-8');
    return this.parseText(content);
  }
}

/**
 * Factory function for easy usage
 */
export function createScreenplayParser() {
  return new ScreenplayParser();
}

/**
 * Convenience function for parsing a file
 */
export async function parseScreenplayFile(fileBuffer, fileName) {
  const parser = createScreenplayParser();
  return await parser.parseFile(fileBuffer, fileName);
}

export default ScreenplayParser;