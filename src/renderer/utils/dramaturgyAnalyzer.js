/**
 * Advanced Dramaturgy Analysis Engine
 * Implements professional screenplay structure analysis including:
 * - Three-act structure detection
 * - Plot point identification
 * - Tempo and rhythm analysis  
 * - Character arc tracking
 * - Genre and theme detection
 */

export class DramaturgyAnalyzer {
  constructor() {
    this.genres = [
      'Drama', 'Comedy', 'Thriller', 'Horror', 'Action', 'Romance', 'Sci-Fi', 
      'Fantasy', 'Mystery', 'Adventure', 'Crime', 'War', 'Western', 
      'Dokumenter', 'Aile', 'Müzikal', 'Gerilim'
    ];
    
    this.themes = [
      'Love', 'Revenge', 'Redemption', 'Coming of Age', 'Good vs Evil', 
      'Power', 'Sacrifice', 'Family', 'Friendship', 'Betrayal', 'Justice',
      'Aşk', 'İntikam', 'Kurtuluş', 'Büyüme', 'İyi vs Kötü', 'Güç',
      'Fedakarlık', 'Aile', 'Dostluk', 'İhanet', 'Adalet'
    ];

    this.plotPointIndicators = [
      // English
      'suddenly', 'unexpected', 'realizes', 'discovers', 'confronts', 
      'decision', 'turning point', 'climax', 'resolution', 'twist',
      // Turkish  
      'aniden', 'beklenmedik', 'fark eder', 'keşfeder', 'karşılaşır',
      'karar', 'dönüm noktası', 'doruk', 'çözüm', 'sürpriz'
    ];
  }

  /**
   * Main analysis function
   */
  analyzeScreenplay(text, scenes = [], characters = []) {
    const words = text.toLowerCase().split(/\s+/);
    const totalWords = words.length;
    const estimatedPages = Math.ceil(totalWords / 250); // ~250 words per page
    
    return {
      structuralAnalysis: this.analyzeStructure(text, scenes, estimatedPages),
      tempoAnalysis: this.analyzeTempoAndRhythm(text, scenes),
      characterAnalysis: this.analyzeCharacterArcs(text, characters, scenes),
      genreAnalysis: this.analyzeGenreAndThemes(text),
      plotPoints: this.identifyPlotPoints(text, scenes),
      dialogueRatio: this.calculateDialogueRatio(text),
      readabilityScore: this.calculateReadabilityScore(text),
      emotionalCurve: this.analyzeEmotionalCurve(text, scenes),
      paceAnalysis: this.analyzePacing(scenes),
      thematicElements: this.extractThematicElements(text)
    };
  }

  /**
   * Three-act structure analysis
   */
  analyzeStructure(text, scenes, estimatedPages) {
    const totalScenes = scenes.length || this.estimateSceneCount(text);
    const setupEnd = Math.floor(estimatedPages * 0.25); // Page 25% - End of Act 1
    const midpoint = Math.floor(estimatedPages * 0.5);  // Page 50% - Midpoint
    const climaxStart = Math.floor(estimatedPages * 0.75); // Page 75% - Start of Act 3
    
    return {
      totalPages: estimatedPages,
      totalScenes: totalScenes,
      actStructure: {
        act1: {
          pages: `1-${setupEnd}`,
          percentage: 25,
          scenes: Math.floor(totalScenes * 0.25),
          description: 'Setup - Character introduction, world building, inciting incident'
        },
        act2a: {
          pages: `${setupEnd + 1}-${midpoint}`,
          percentage: 25, 
          scenes: Math.floor(totalScenes * 0.25),
          description: 'Rising Action - Obstacles, character development, plot complications'
        },
        act2b: {
          pages: `${midpoint + 1}-${climaxStart}`,
          percentage: 25,
          scenes: Math.floor(totalScenes * 0.25), 
          description: 'Midpoint Twist - Major revelation, stakes raised, new direction'
        },
        act3: {
          pages: `${climaxStart + 1}-${estimatedPages}`,
          percentage: 25,
          scenes: Math.floor(totalScenes * 0.25),
          description: 'Resolution - Climax, falling action, denouement'
        }
      },
      keyStructuralPoints: {
        incitingIncident: { estimatedPage: Math.floor(estimatedPages * 0.12) },
        plotPoint1: { estimatedPage: setupEnd },
        midpoint: { estimatedPage: midpoint },
        plotPoint2: { estimatedPage: climaxStart },
        climax: { estimatedPage: Math.floor(estimatedPages * 0.88) },
        resolution: { estimatedPage: estimatedPages }
      }
    };
  }

  /**
   * Tempo and rhythm analysis
   */
  analyzeTempoAndRhythm(text, scenes) {
    const lines = text.split('\\n');
    const pagesPerMinute = 1; // Standard: 1 page = 1 minute screen time
    
    // Analyze scene lengths
    const sceneLengths = scenes.map(scene => {
      const sceneText = scene.action?.join(' ') + ' ' + scene.dialogue?.join(' ') || '';
      return sceneText.split(/\s+/).length;
    });
    
    const averageSceneLength = sceneLengths.length > 0 
      ? sceneLengths.reduce((a, b) => a + b, 0) / sceneLengths.length 
      : 0;
    
    // Calculate pace indicators
    const actionLines = lines.filter(line => this.isActionLine(line)).length;
    const dialogueLines = lines.filter(line => this.isDialogueLine(line)).length;
    const actionToDialogueRatio = actionLines / (dialogueLines || 1);
    
    return {
      averageSceneLength: Math.round(averageSceneLength),
      estimatedScreenTime: Math.round(text.split(/\s+/).length / 250), // minutes
      paceIndicators: {
        actionToDialogueRatio: Math.round(actionToDialogueRatio * 100) / 100,
        averageLineLength: Math.round(lines.reduce((acc, line) => acc + line.length, 0) / lines.length),
        shortScenes: sceneLengths.filter(len => len < 100).length,
        longScenes: sceneLengths.filter(len => len > 500).length
      },
      rhythmPattern: this.analyzeRhythmPattern(sceneLengths),
      tempoClassification: this.classifyTempo(actionToDialogueRatio, averageSceneLength)
    };
  }

  /**
   * Character arc analysis
   */
  analyzeCharacterArcs(text, characters, scenes) {
    const characterData = characters.map(character => {
      const characterName = typeof character === 'string' ? character : character.name;
      const appearances = this.countCharacterAppearances(text, characterName);
      const dialogueCount = this.countCharacterDialogue(text, characterName);
      const scenePresence = this.calculateScenePresence(scenes, characterName);
      
      return {
        name: characterName,
        totalAppearances: appearances,
        dialogueLines: dialogueCount,
        scenePresence: scenePresence,
        importance: this.classifyCharacterImportance(appearances, dialogueCount, scenePresence),
        arcType: this.identifyCharacterArc(text, characterName),
        emotionalJourney: this.analyzeCharacterEmotions(text, characterName)
      };
    });

    return {
      characters: characterData,
      totalCharacters: characterData.length,
      mainCharacters: characterData.filter(c => c.importance === 'main').length,
      supportingCharacters: characterData.filter(c => c.importance === 'supporting').length,
      ensembleDynamics: this.analyzeEnsembleDynamics(characterData, scenes)
    };
  }

  /**
   * Genre and theme detection using NLP-like analysis
   */
  analyzeGenreAndThemes(text) {
    const words = text.toLowerCase().split(/\s+/);
    const wordFreq = this.calculateWordFrequency(words);
    
    // Genre detection based on keywords
    const genreScores = {};
    const genreKeywords = {
      drama: ['emotion', 'family', 'relationship', 'tears', 'heart', 'feel', 'duygu', 'aile', 'ilişki', 'gözyaşı', 'kalp', 'hissediyor'],
      comedy: ['laugh', 'funny', 'joke', 'humor', 'smile', 'comic', 'gülüyor', 'komik', 'şaka', 'mizah', 'gülümsüyor'],
      thriller: ['danger', 'chase', 'escape', 'threat', 'fear', 'suspense', 'tehlike', 'kovalamaca', 'kaçış', 'tehdit', 'korku'],
      horror: ['scream', 'blood', 'terror', 'nightmare', 'death', 'monster', 'çığlık', 'kan', 'terör', 'kabus', 'ölüm', 'canavar'],
      action: ['fight', 'explosion', 'gun', 'battle', 'war', 'weapon', 'dövüş', 'patlama', 'silah', 'savaş', 'savaş', 'silah'],
      romance: ['love', 'kiss', 'heart', 'romantic', 'wedding', 'marriage', 'aşk', 'öpücük', 'kalp', 'romantik', 'düğün', 'evlilik'],
      scifi: ['space', 'future', 'robot', 'alien', 'technology', 'time', 'uzay', 'gelecek', 'robot', 'uzaylı', 'teknoloji', 'zaman']
    };

    for (const [genre, keywords] of Object.entries(genreKeywords)) {
      genreScores[genre] = keywords.reduce((score, keyword) => {
        return score + (wordFreq[keyword] || 0);
      }, 0);
    }

    // Theme detection
    const themeScores = {};
    const themeKeywords = {
      love: ['love', 'romance', 'heart', 'relationship', 'aşk', 'romantizm', 'kalp', 'ilişki'],
      revenge: ['revenge', 'payback', 'vengeance', 'justice', 'intikam', 'öç', 'intikam', 'adalet'],
      redemption: ['redemption', 'forgiveness', 'second chance', 'salvation', 'kurtuluş', 'affetme', 'ikinci şans', 'kurtuluş'],
      family: ['family', 'father', 'mother', 'brother', 'sister', 'aile', 'baba', 'anne', 'kardeş', 'kardeş'],
      power: ['power', 'control', 'authority', 'dominance', 'güç', 'kontrol', 'otorite', 'hakimiyet']
    };

    for (const [theme, keywords] of Object.entries(themeKeywords)) {
      themeScores[theme] = keywords.reduce((score, keyword) => {
        return score + (wordFreq[keyword] || 0);
      }, 0);
    }

    const primaryGenre = Object.entries(genreScores).sort(([,a], [,b]) => b - a)[0]?.[0] || 'drama';
    const primaryTheme = Object.entries(themeScores).sort(([,a], [,b]) => b - a)[0]?.[0] || 'unknown';
    
    return {
      primaryGenre,
      genreScores,
      primaryTheme,
      themeScores,
      genreConfidence: this.calculateConfidence(genreScores),
      themeConfidence: this.calculateConfidence(themeScores),
      hybridGenres: this.identifyHybridGenres(genreScores)
    };
  }

  /**
   * Plot point identification
   */
  identifyPlotPoints(text, scenes) {
    const plotPoints = [];
    const lines = text.split('\\n');
    
    scenes.forEach((scene, index) => {
      const sceneText = scene.action?.join(' ') + ' ' + scene.dialogue?.join(' ') || '';
      const intensity = this.calculateSceneIntensity(sceneText);
      const hasPlotIndicator = this.plotPointIndicators.some(indicator => 
        sceneText.toLowerCase().includes(indicator)
      );
      
      if (intensity > 0.7 || hasPlotIndicator) {
        plotPoints.push({
          sceneNumber: scene.number || index + 1,
          type: this.classifyPlotPoint(index, scenes.length, intensity),
          intensity,
          description: scene.header || `Scene ${index + 1}`,
          significance: this.calculatePlotSignificance(sceneText, intensity)
        });
      }
    });

    return {
      identifiedPlotPoints: plotPoints,
      totalPlotPoints: plotPoints.length,
      structuralIntegrity: this.assessStructuralIntegrity(plotPoints, scenes.length)
    };
  }

  /**
   * Helper methods
   */

  estimateSceneCount(text) {
    const sceneHeaders = text.match(/^(INT\.|EXT\.|İÇ\.|DIŞ\.)/gm) || [];
    return sceneHeaders.length || Math.floor(text.split(/\s+/).length / 1000); // Fallback estimate
  }

  isActionLine(line) {
    const trimmed = line.trim();
    return trimmed.length > 0 && 
           !this.isSceneHeader(trimmed) && 
           !this.isCharacterName(trimmed) && 
           trimmed === trimmed.toLowerCase();
  }

  isDialogueLine(line) {
    return line.trim().length > 0 && line !== line.toUpperCase();
  }

  isSceneHeader(line) {
    const upper = line.toUpperCase();
    return upper.startsWith('INT.') || upper.startsWith('EXT.') || 
           upper.startsWith('İÇ.') || upper.startsWith('DIŞ.');
  }

  isCharacterName(line) {
    return line === line.toUpperCase() && line.trim().length > 0;
  }

  calculateWordFrequency(words) {
    return words.reduce((freq, word) => {
      freq[word] = (freq[word] || 0) + 1;
      return freq;
    }, {});
  }

  countCharacterAppearances(text, characterName) {
    const regex = new RegExp(`\\b${characterName}\\b`, 'gi');
    return (text.match(regex) || []).length;
  }

  countCharacterDialogue(text, characterName) {
    const lines = text.split('\\n');
    let dialogueCount = 0;
    let currentSpeaker = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (this.isCharacterName(trimmed)) {
        currentSpeaker = trimmed;
      } else if (currentSpeaker === characterName.toUpperCase() && this.isDialogueLine(trimmed)) {
        dialogueCount++;
      }
    }
    
    return dialogueCount;
  }

  calculateScenePresence(scenes, characterName) {
    return scenes.filter(scene => 
      scene.characters?.includes(characterName) || 
      scene.dialogue?.some(d => d.includes(characterName)) ||
      scene.action?.some(a => a.includes(characterName))
    ).length;
  }

  classifyCharacterImportance(appearances, dialogueLines, scenePresence) {
    const totalScore = appearances + (dialogueLines * 2) + (scenePresence * 3);
    if (totalScore > 50) return 'main';
    if (totalScore > 15) return 'supporting';
    return 'minor';
  }

  calculateDialogueRatio(text) {
    const lines = text.split('\\n');
    const dialogueLines = lines.filter(line => this.isDialogueLine(line)).length;
    const actionLines = lines.filter(line => this.isActionLine(line)).length;
    
    return {
      dialogueLines,
      actionLines,
      totalLines: lines.length,
      dialoguePercentage: Math.round((dialogueLines / lines.length) * 100),
      actionPercentage: Math.round((actionLines / lines.length) * 100)
    };
  }

  calculateReadabilityScore(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/);
    const avgWordsPerSentence = words.length / sentences.length;
    const avgSyllablesPerWord = this.estimateAverageSyllables(words);
    
    // Simplified Flesch Reading Ease Score
    const score = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
    
    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      averageWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
      averageSyllablesPerWord: Math.round(avgSyllablesPerWord * 10) / 10,
      readingLevel: this.classifyReadingLevel(score)
    };
  }

  estimateAverageSyllables(words) {
    let totalSyllables = 0;
    for (const word of words) {
      totalSyllables += this.countSyllables(word);
    }
    return totalSyllables / words.length;
  }

  countSyllables(word) {
    // Simple syllable estimation
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

  classifyReadingLevel(score) {
    if (score >= 90) return 'Very Easy';
    if (score >= 80) return 'Easy';
    if (score >= 70) return 'Fairly Easy';
    if (score >= 60) return 'Standard';
    if (score >= 50) return 'Fairly Difficult';
    if (score >= 30) return 'Difficult';
    return 'Very Difficult';
  }

  analyzeRhythmPattern(sceneLengths) {
    if (sceneLengths.length < 3) return 'insufficient_data';
    
    const variance = this.calculateVariance(sceneLengths);
    const mean = sceneLengths.reduce((a, b) => a + b, 0) / sceneLengths.length;
    const coefficient = Math.sqrt(variance) / mean;
    
    if (coefficient < 0.3) return 'steady';
    if (coefficient < 0.6) return 'varied';
    return 'dramatic';
  }

  calculateVariance(numbers) {
    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    return numbers.reduce((acc, num) => acc + Math.pow(num - mean, 2), 0) / numbers.length;
  }

  classifyTempo(actionToDialogueRatio, averageSceneLength) {
    if (actionToDialogueRatio > 1.5 && averageSceneLength < 200) return 'fast';
    if (actionToDialogueRatio < 0.5 && averageSceneLength > 400) return 'slow';
    return 'medium';
  }

  calculateConfidence(scores) {
    const values = Object.values(scores);
    const max = Math.max(...values);
    const sum = values.reduce((a, b) => a + b, 0);
    return sum > 0 ? Math.round((max / sum) * 100) : 0;
  }

  identifyHybridGenres(genreScores) {
    const sorted = Object.entries(genreScores).sort(([,a], [,b]) => b - a);
    return sorted.slice(0, 3).filter(([, score]) => score > 0).map(([genre]) => genre);
  }

  calculateSceneIntensity(sceneText) {
    const intensityWords = [
      'fight', 'explosion', 'chase', 'scream', 'death', 'crisis', 'emergency',
      'dövüş', 'patlama', 'kovalamaca', 'çığlık', 'ölüm', 'kriz', 'acil'
    ];
    
    const words = sceneText.toLowerCase().split(/\s+/);
    const intensityCount = words.filter(word => intensityWords.includes(word)).length;
    return Math.min(1, intensityCount / 10); // Normalize to 0-1
  }

  classifyPlotPoint(index, totalScenes, intensity) {
    const position = index / totalScenes;
    
    if (position < 0.15 && intensity > 0.5) return 'inciting_incident';
    if (position > 0.2 && position < 0.3 && intensity > 0.6) return 'plot_point_1';
    if (position > 0.45 && position < 0.55 && intensity > 0.7) return 'midpoint';
    if (position > 0.7 && position < 0.8 && intensity > 0.6) return 'plot_point_2';
    if (position > 0.85 && intensity > 0.8) return 'climax';
    
    return 'turning_point';
  }

  calculatePlotSignificance(sceneText, intensity) {
    const significanceWords = [
      'reveals', 'discovers', 'realizes', 'decides', 'confronts',
      'ortaya çıkıyor', 'keşfediyor', 'fark ediyor', 'karar veriyor', 'karşılaşıyor'
    ];
    
    const hasSignificantWords = significanceWords.some(word => 
      sceneText.toLowerCase().includes(word)
    );
    
    return hasSignificantWords ? intensity * 1.5 : intensity;
  }

  assessStructuralIntegrity(plotPoints, totalScenes) {
    const expectedPoints = ['inciting_incident', 'plot_point_1', 'midpoint', 'plot_point_2', 'climax'];
    const foundTypes = plotPoints.map(p => p.type);
    const coverage = expectedPoints.filter(type => foundTypes.includes(type)).length;
    
    return {
      score: Math.round((coverage / expectedPoints.length) * 100),
      missingElements: expectedPoints.filter(type => !foundTypes.includes(type)),
      structuralRecommendations: this.generateStructuralRecommendations(coverage, totalScenes)
    };
  }

  generateStructuralRecommendations(coverage, totalScenes) {
    const recommendations = [];
    
    if (coverage < 3) {
      recommendations.push('Consider strengthening key plot points for better dramatic structure');
    }
    
    if (totalScenes < 30) {
      recommendations.push('Screenplay may benefit from additional scenes to develop story');
    } else if (totalScenes > 80) {
      recommendations.push('Consider consolidating scenes for better pacing');
    }
    
    return recommendations;
  }

  // Additional analysis methods would continue here...
  // Including emotional curve analysis, ensemble dynamics, etc.

  analyzeEmotionalCurve(text, scenes) {
    // Placeholder for emotional analysis
    return {
      overallTone: 'balanced',
      emotionalPeaks: [],
      emotionalValleys: [],
      emotionalProgression: 'rising'
    };
  }

  analyzePacing(scenes) {
    return {
      overallPace: 'medium',
      paceChanges: [],
      recommendedAdjustments: []
    };
  }

  analyzeEnsembleDynamics(characterData, scenes) {
    return {
      groupScenes: 0,
      characterInteractions: [],
      relationshipMappings: []
    };
  }

  analyzeCharacterEmotions(text, characterName) {
    return {
      dominantEmotions: ['neutral'],
      emotionalRange: 'moderate',
      emotionalGrowth: 'stable'
    };
  }

  identifyCharacterArc(text, characterName) {
    return 'static'; // Placeholder
  }

  extractThematicElements(text) {
    return {
      symbols: [],
      motifs: [],
      metaphors: []
    };
  }
}

/**
 * Factory function for creating a dramaturgy analyzer
 */
export function createDramaturgyAnalyzer() {
  return new DramaturgyAnalyzer();
}

export default DramaturgyAnalyzer;