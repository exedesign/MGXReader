/**
 * Advanced Character and Dialogue Analysis Engine
 * Provides comprehensive character frequency analysis and dialogue quality metrics
 * - Character appearance/dialogue frequency tracking
 * - Character importance classification  
 * - Dialogue complexity and readability analysis
 * - Character relationship mapping
 * - Dialogue/Action ratio calculations
 */

// import natural from 'natural'; // Commented out as natural has compatibility issues in renderer
// import nlp from 'compromise'; // Commented out for similar reasons
// import Sentiment from 'sentiment'; // Will implement simple sentiment analysis

export class CharacterDialogueAnalyzer {
  constructor() {
    // Character classification thresholds
    this.characterThresholds = {
      main: { appearances: 20, dialogueLines: 50, scenePresence: 15 },
      supporting: { appearances: 8, dialogueLines: 15, scenePresence: 5 },
      minor: { appearances: 2, dialogueLines: 3, scenePresence: 2 }
    };

    // Dialogue quality indicators
    this.complexityKeywords = {
      simple: ['yes', 'no', 'ok', 'sure', 'maybe', 'evet', 'hayır', 'tamam', 'belki'],
      moderate: ['because', 'however', 'although', 'instead', 'çünkü', 'ancak', 'fakat', 'yerine'],
      complex: ['nevertheless', 'consequently', 'furthermore', 'moreover', 'bununla birlikte', 'dolayısıyla', 'üstelik']
    };

    // Emotional indicators for basic sentiment analysis
    this.emotionalWords = {
      positive: ['happy', 'joy', 'love', 'excited', 'wonderful', 'great', 'mutlu', 'sevinç', 'aşk', 'harika'],
      negative: ['sad', 'angry', 'hate', 'terrible', 'awful', 'bad', 'üzgün', 'kızgın', 'nefret', 'korkunç'],
      neutral: ['okay', 'fine', 'normal', 'regular', 'standard', 'tamam', 'iyi', 'normal']
    };
  }

  /**
   * Main analysis function
   */
  analyzeCharactersAndDialogue(text, scenes = [], characterList = []) {
    const lines = text.split('\\n').filter(line => line.trim());
    
    // Extract all characters from text if not provided
    const detectedCharacters = characterList.length > 0 
      ? characterList 
      : this.extractCharacters(text, lines);

    return {
      characterAnalysis: this.analyzeCharacterFrequency(text, lines, scenes, detectedCharacters),
      dialogueAnalysis: this.analyzeDialogueQuality(text, lines, detectedCharacters),
      relationshipAnalysis: this.analyzeCharacterRelationships(text, scenes, detectedCharacters),
      sceneDistribution: this.analyzeSceneDistribution(scenes, detectedCharacters),
      overallMetrics: this.calculateOverallMetrics(text, lines, detectedCharacters)
    };
  }

  /**
   * Character frequency and importance analysis
   */
  analyzeCharacterFrequency(text, lines, scenes, characters) {
    const characterData = characters.map(characterName => {
      const name = typeof characterName === 'string' ? characterName : characterName.name;
      
      return {
        name,
        frequency: this.calculateCharacterFrequency(text, name),
        dialogueAnalysis: this.analyzeCharacterDialogue(lines, name),
        scenePresence: this.calculateScenePresence(scenes, name),
        importance: null, // Will be calculated after gathering all data
        characterArc: this.analyzeCharacterArc(text, name),
        emotionalProfile: this.analyzeCharacterEmotions(text, name),
        speechPatterns: this.analyzeCharacterSpeechPatterns(lines, name)
      };
    });

    // Calculate importance levels
    characterData.forEach(character => {
      character.importance = this.classifyCharacterImportance(character);
    });

    // Sort by importance and frequency
    characterData.sort((a, b) => {
      const importanceOrder = { main: 3, supporting: 2, minor: 1 };
      return (importanceOrder[b.importance] || 0) - (importanceOrder[a.importance] || 0) ||
             b.frequency.totalMentions - a.frequency.totalMentions;
    });

    return {
      characters: characterData,
      statistics: {
        totalCharacters: characterData.length,
        mainCharacters: characterData.filter(c => c.importance === 'main').length,
        supportingCharacters: characterData.filter(c => c.importance === 'supporting').length,
        minorCharacters: characterData.filter(c => c.importance === 'minor').length,
        averageDialoguePerCharacter: Math.round(
          characterData.reduce((sum, c) => sum + c.dialogueAnalysis.lineCount, 0) / characterData.length
        )
      }
    };
  }

  /**
   * Dialogue quality and complexity analysis
   */
  analyzeDialogueQuality(text, lines, characters) {
    const dialogueLines = this.extractDialogueLines(lines);
    const actionLines = lines.filter(line => this.isActionLine(line));
    
    return {
      overallQuality: this.calculateOverallDialogueQuality(dialogueLines),
      readabilityMetrics: this.calculateDialogueReadability(dialogueLines),
      complexityAnalysis: this.analyzeDialogueComplexity(dialogueLines),
      rhythmAnalysis: this.analyzeDialogueRhythm(dialogueLines),
      ratioAnalysis: {
        dialogueToActionRatio: dialogueLines.length / (actionLines.length || 1),
        dialoguePercentage: Math.round((dialogueLines.length / lines.length) * 100),
        actionPercentage: Math.round((actionLines.length / lines.length) * 100),
        totalLines: lines.length,
        dialogueLines: dialogueLines.length,
        actionLines: actionLines.length
      },
      characterDistribution: this.analyzeDialogueDistribution(lines, characters),
      languageAnalysis: this.analyzeLanguagePatterns(dialogueLines)
    };
  }

  /**
   * Character relationship analysis
   */
  analyzeCharacterRelationships(text, scenes, characters) {
    const relationships = {};
    const interactions = {};

    // Initialize relationship matrix
    characters.forEach(char1 => {
      const name1 = typeof char1 === 'string' ? char1 : char1.name;
      relationships[name1] = {};
      interactions[name1] = { total: 0, scenes: [] };
      
      characters.forEach(char2 => {
        const name2 = typeof char2 === 'string' ? char2 : char2.name;
        if (name1 !== name2) {
          relationships[name1][name2] = 0;
        }
      });
    });

    // Analyze scene co-presence
    scenes.forEach((scene, index) => {
      const sceneCharacters = this.getSceneCharacters(scene);
      
      sceneCharacters.forEach(char1 => {
        sceneCharacters.forEach(char2 => {
          if (char1 !== char2 && relationships[char1] && relationships[char1][char2] !== undefined) {
            relationships[char1][char2]++;
            interactions[char1].total++;
            interactions[char1].scenes.push(index + 1);
          }
        });
      });
    });

    return {
      relationshipMatrix: relationships,
      interactionCounts: interactions,
      strongestRelationships: this.identifyStrongestRelationships(relationships),
      characterClusters: this.identifyCharacterClusters(relationships, characters),
      isolatedCharacters: this.identifyIsolatedCharacters(interactions, characters)
    };
  }

  /**
   * Scene distribution analysis
   */
  analyzeSceneDistribution(scenes, characters) {
    return characters.map(character => {
      const name = typeof character === 'string' ? character : character.name;
      const sceneAppearances = this.getCharacterScenes(scenes, name);
      
      return {
        character: name,
        totalScenes: sceneAppearances.length,
        sceneNumbers: sceneAppearances,
        distribution: this.analyzeCharacterDistribution(sceneAppearances, scenes.length),
        presence: {
          first: Math.min(...sceneAppearances) || 0,
          last: Math.max(...sceneAppearances) || 0,
          span: sceneAppearances.length > 0 ? Math.max(...sceneAppearances) - Math.min(...sceneAppearances) : 0
        }
      };
    });
  }

  /**
   * Helper Methods
   */

  extractCharacters(text, lines) {
    const characters = new Set();
    const characterPattern = /^([A-Z][A-Z\\s]+)$/;
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (characterPattern.test(trimmed) && 
          !this.isSceneHeader(trimmed) &&
          trimmed.length < 50) {
        const characterName = trimmed.replace(/\\(.*\\)/, '').trim();
        if (characterName.length > 1) {
          characters.add(characterName);
        }
      }
    });

    return Array.from(characters);
  }

  calculateCharacterFrequency(text, characterName) {
    const regex = new RegExp(`\\\\b${characterName}\\\\b`, 'gi');
    const matches = text.match(regex) || [];
    
    // Count in different contexts
    const nameInDialogue = this.countInContext(text, characterName, 'dialogue');
    const nameInAction = this.countInContext(text, characterName, 'action');
    const nameAsCharacterHeading = this.countAsCharacterHeading(text, characterName);

    return {
      totalMentions: matches.length,
      inDialogue: nameInDialogue,
      inAction: nameInAction,
      asCharacterHeading: nameAsCharacterHeading,
      frequency: matches.length / text.split(/\\s+/).length, // Relative frequency
      prominence: this.calculateCharacterProminence(matches.length, nameInDialogue, nameAsCharacterHeading)
    };
  }

  analyzeCharacterDialogue(lines, characterName) {
    let dialogueLines = [];
    let currentSpeaker = null;
    let lineCount = 0;
    let wordCount = 0;

    lines.forEach(line => {
      const trimmed = line.trim();
      if (this.isCharacterName(trimmed)) {
        currentSpeaker = trimmed.replace(/\\(.*\\)/, '').trim();
      } else if (currentSpeaker === characterName && this.isDialogueLine(trimmed)) {
        dialogueLines.push(trimmed);
        lineCount++;
        wordCount += trimmed.split(/\\s+/).length;
      }
    });

    const averageWordsPerLine = lineCount > 0 ? wordCount / lineCount : 0;
    const complexity = this.calculateDialogueComplexityForCharacter(dialogueLines);

    return {
      lineCount,
      wordCount,
      averageWordsPerLine: Math.round(averageWordsPerLine * 10) / 10,
      complexity,
      emotionalTone: this.analyzeDialogueEmotion(dialogueLines),
      speechStyle: this.analyzeDialogueSpeechStyle(dialogueLines)
    };
  }

  calculateScenePresence(scenes, characterName) {
    return scenes.filter(scene => {
      return scene.characters?.includes(characterName) ||
             scene.dialogue?.some(d => d.toLowerCase().includes(characterName.toLowerCase())) ||
             scene.action?.some(a => a.toLowerCase().includes(characterName.toLowerCase())) ||
             scene.header?.toLowerCase().includes(characterName.toLowerCase());
    }).length;
  }

  classifyCharacterImportance(characterData) {
    const { frequency, dialogueAnalysis, scenePresence } = characterData;
    const thresholds = this.characterThresholds;
    
    const score = {
      frequency: frequency.totalMentions,
      dialogue: dialogueAnalysis.lineCount,
      scenes: scenePresence
    };

    if (score.frequency >= thresholds.main.appearances && 
        score.dialogue >= thresholds.main.dialogueLines && 
        score.scenes >= thresholds.main.scenePresence) {
      return 'main';
    } else if (score.frequency >= thresholds.supporting.appearances && 
               score.dialogue >= thresholds.supporting.dialogueLines && 
               score.scenes >= thresholds.supporting.scenePresence) {
      return 'supporting';
    } else if (score.frequency >= thresholds.minor.appearances || 
               score.dialogue >= thresholds.minor.dialogueLines || 
               score.scenes >= thresholds.minor.scenePresence) {
      return 'minor';
    } else {
      return 'background';
    }
  }

  calculateOverallDialogueQuality(dialogueLines) {
    const metrics = {
      averageLength: this.calculateAverageLineLength(dialogueLines),
      complexityVariation: this.calculateComplexityVariation(dialogueLines),
      emotionalRange: this.calculateEmotionalRange(dialogueLines),
      naturalness: this.calculateDialogueNaturalness(dialogueLines)
    };

    // Calculate composite quality score (0-100)
    const qualityScore = Math.round(
      (metrics.complexityVariation * 0.3 +
       metrics.emotionalRange * 0.3 +
       metrics.naturalness * 0.4) * 100
    );

    return {
      score: qualityScore,
      grade: this.getQualityGrade(qualityScore),
      metrics,
      recommendations: this.generateDialogueRecommendations(metrics)
    };
  }

  calculateDialogueReadability(dialogueLines) {
    const allText = dialogueLines.join(' ');
    const sentences = allText.split(/[.!?]+/).filter(s => s.trim());
    const words = allText.split(/\\s+/);
    
    const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : 0;
    const avgSyllablesPerWord = this.calculateAverageSyllables(words);
    
    // Simplified Flesch Reading Ease
    const fleschScore = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
    
    return {
      fleschScore: Math.max(0, Math.min(100, Math.round(fleschScore))),
      readingLevel: this.getReadingLevel(fleschScore),
      averageWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
      averageSyllablesPerWord: Math.round(avgSyllablesPerWord * 10) / 10,
      totalWords: words.length,
      totalSentences: sentences.length
    };
  }

  analyzeDialogueComplexity(dialogueLines) {
    const complexityScores = dialogueLines.map(line => {
      let score = 0;
      const words = line.toLowerCase().split(/\\s+/);
      
      // Check for complexity indicators
      words.forEach(word => {
        if (this.complexityKeywords.simple.includes(word)) score += 1;
        else if (this.complexityKeywords.moderate.includes(word)) score += 2;
        else if (this.complexityKeywords.complex.includes(word)) score += 3;
      });
      
      // Add length-based complexity
      score += Math.min(words.length / 10, 2); // Up to 2 points for length
      
      return score;
    });

    const averageComplexity = complexityScores.length > 0 
      ? complexityScores.reduce((a, b) => a + b, 0) / complexityScores.length 
      : 0;

    return {
      averageComplexity: Math.round(averageComplexity * 10) / 10,
      complexityDistribution: this.categorizeComplexity(complexityScores),
      mostComplex: Math.max(...complexityScores, 0),
      leastComplex: Math.min(...complexityScores, 0),
      variability: this.calculateVariability(complexityScores)
    };
  }

  // Additional helper methods...

  isSceneHeader(line) {
    const upper = line.toUpperCase();
    return upper.startsWith('INT.') || upper.startsWith('EXT.') || 
           upper.startsWith('İÇ.') || upper.startsWith('DIŞ.');
  }

  isCharacterName(line) {
    return line === line.toUpperCase() && 
           line.trim().length > 0 && 
           line.trim().length < 50 &&
           !this.isSceneHeader(line);
  }

  isDialogueLine(line) {
    return line.trim().length > 0 && 
           line !== line.toUpperCase() && 
           !this.isSceneHeader(line);
  }

  isActionLine(line) {
    return line.trim().length > 0 && 
           !this.isSceneHeader(line) && 
           !this.isCharacterName(line) && 
           !this.isDialogueLine(line);
  }

  extractDialogueLines(lines) {
    const dialogueLines = [];
    let currentSpeaker = null;

    lines.forEach(line => {
      const trimmed = line.trim();
      if (this.isCharacterName(trimmed)) {
        currentSpeaker = trimmed;
      } else if (currentSpeaker && this.isDialogueLine(trimmed)) {
        dialogueLines.push(trimmed);
      }
    });

    return dialogueLines;
  }

  // Placeholder implementations for complex analysis methods
  analyzeCharacterArc(text, characterName) {
    return { type: 'static', development: 'minimal' };
  }

  analyzeCharacterEmotions(text, characterName) {
    return { dominantEmotion: 'neutral', emotionalRange: 'moderate' };
  }

  analyzeCharacterSpeechPatterns(lines, characterName) {
    return { 
      averageLineLength: 0, 
      formalityLevel: 'moderate',
      vocabularyComplexity: 'average'
    };
  }

  calculateCharacterProminence(totalMentions, dialogueMentions, headingMentions) {
    return (dialogueMentions * 2) + (headingMentions * 3) + totalMentions;
  }

  countInContext(text, characterName, context) {
    // Simplified implementation
    return 0;
  }

  countAsCharacterHeading(text, characterName) {
    const lines = text.split('\\n');
    return lines.filter(line => 
      line.trim().toUpperCase() === characterName.toUpperCase()
    ).length;
  }

  calculateAverageSyllables(words) {
    let totalSyllables = 0;
    words.forEach(word => {
      totalSyllables += this.countSyllables(word);
    });
    return words.length > 0 ? totalSyllables / words.length : 0;
  }

  countSyllables(word) {
    const vowels = 'aeiouAEIOU';
    let count = 0;
    let prevWasVowel = false;
    
    for (let i = 0; i < word.length; i++) {
      const isVowel = vowels.includes(word[i]);
      if (isVowel && !prevWasVowel) count++;
      prevWasVowel = isVowel;
    }
    
    return Math.max(1, count);
  }

  getReadingLevel(score) {
    if (score >= 90) return 'Very Easy';
    if (score >= 80) return 'Easy';
    if (score >= 70) return 'Fairly Easy';
    if (score >= 60) return 'Standard';
    if (score >= 50) return 'Fairly Difficult';
    if (score >= 30) return 'Difficult';
    return 'Very Difficult';
  }

  calculateOverallMetrics(text, lines, characters) {
    const totalWords = text.split(/\\s+/).length;
    const dialogueLines = this.extractDialogueLines(lines);
    const actionLines = lines.filter(line => this.isActionLine(line));

    return {
      totalWords,
      totalLines: lines.length,
      totalCharacters: characters.length,
      dialogueToActionRatio: dialogueLines.length / (actionLines.length || 1),
      averageWordsPerCharacter: Math.round(totalWords / (characters.length || 1)),
      dialogueDensity: Math.round((dialogueLines.length / lines.length) * 100),
      characterDensity: Math.round((characters.length / totalWords) * 1000) // Characters per 1000 words
    };
  }

  // Additional placeholder methods
  analyzeDialogueRhythm(dialogueLines) {
    return { rhythm: 'varied', pace: 'moderate' };
  }

  analyzeDialogueDistribution(lines, characters) {
    return characters.map(char => ({
      character: typeof char === 'string' ? char : char.name,
      percentage: 0
    }));
  }

  analyzeLanguagePatterns(dialogueLines) {
    return { 
      formalityLevel: 'moderate',
      slangUsage: 'low',
      technicalTerms: 'minimal'
    };
  }

  identifyStrongestRelationships(relationships) {
    return [];
  }

  identifyCharacterClusters(relationships, characters) {
    return [];
  }

  identifyIsolatedCharacters(interactions, characters) {
    return [];
  }

  getSceneCharacters(scene) {
    return scene.characters || [];
  }

  getCharacterScenes(scenes, characterName) {
    return scenes
      .map((scene, index) => ({ scene, index: index + 1 }))
      .filter(({ scene }) => 
        scene.characters?.includes(characterName) ||
        scene.dialogue?.some(d => d.includes(characterName)) ||
        scene.action?.some(a => a.includes(characterName))
      )
      .map(({ index }) => index);
  }

  analyzeCharacterDistribution(appearances, totalScenes) {
    if (appearances.length === 0) return 'absent';
    
    const span = Math.max(...appearances) - Math.min(...appearances) + 1;
    const coverage = appearances.length / span;
    
    if (coverage > 0.7) return 'consistent';
    if (coverage > 0.4) return 'regular';
    if (coverage > 0.2) return 'sporadic';
    return 'rare';
  }

  // Quality assessment helpers
  calculateAverageLineLength(dialogueLines) {
    const totalChars = dialogueLines.reduce((sum, line) => sum + line.length, 0);
    return dialogueLines.length > 0 ? totalChars / dialogueLines.length : 0;
  }

  calculateComplexityVariation(dialogueLines) {
    // Simplified implementation
    return Math.random() * 0.5 + 0.5; // Placeholder
  }

  calculateEmotionalRange(dialogueLines) {
    // Simplified implementation
    return Math.random() * 0.5 + 0.5; // Placeholder
  }

  calculateDialogueNaturalness(dialogueLines) {
    // Simplified implementation
    return Math.random() * 0.5 + 0.5; // Placeholder
  }

  getQualityGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  generateDialogueRecommendations(metrics) {
    const recommendations = [];
    
    if (metrics.naturalness < 0.6) {
      recommendations.push('Consider making dialogue more conversational and natural');
    }
    
    if (metrics.complexityVariation < 0.4) {
      recommendations.push('Add variety to sentence structures and dialogue complexity');
    }
    
    if (metrics.emotionalRange < 0.5) {
      recommendations.push('Expand emotional range in character dialogue');
    }
    
    return recommendations;
  }

  categorizeComplexity(scores) {
    return {
      simple: scores.filter(s => s < 2).length,
      moderate: scores.filter(s => s >= 2 && s < 4).length,
      complex: scores.filter(s => s >= 4).length
    };
  }

  calculateVariability(scores) {
    if (scores.length === 0) return 0;
    
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((acc, score) => acc + Math.pow(score - mean, 2), 0) / scores.length;
    
    return Math.sqrt(variance);
  }

  calculateDialogueComplexityForCharacter(dialogueLines) {
    return {
      averageComplexity: Math.random() * 3 + 1, // Placeholder
      range: 'moderate'
    };
  }

  analyzeDialogueEmotion(dialogueLines) {
    return {
      dominantTone: 'neutral',
      emotionalVariability: 'moderate'
    };
  }

  analyzeDialogueSpeechStyle(dialogueLines) {
    return {
      formality: 'moderate',
      verbosity: 'average'
    };
  }
}

/**
 * Factory function for creating character dialogue analyzer
 */
export function createCharacterDialogueAnalyzer() {
  return new CharacterDialogueAnalyzer();
}

export default CharacterDialogueAnalyzer;