/**
 * Advanced NLP Genre & Theme Detection Engine
 * Uses multiple NLP techniques for sophisticated analysis
 */

import natural from 'natural';
import compromise from 'compromise';
import Sentiment from 'sentiment';

export class GenreThemeAnalyzer {
  constructor() {
    this.stemmer = natural.PorterStemmer;
    this.sentiment = new Sentiment();
    this.tokenizer = new natural.WordTokenizer();
    
    // Initialize genre-specific keywords and patterns
    this.initializeGenrePatterns();
    this.initializeThemePatterns();
    this.initializeTonePatterns();
  }

  /**
   * Initialize genre detection patterns
   */
  initializeGenrePatterns() {
    this.genrePatterns = {
      action: {
        keywords: [
          'fight', 'battle', 'explosion', 'gun', 'chase', 'escape', 'attack', 'weapon',
          'violence', 'combat', 'war', 'army', 'soldier', 'mission', 'danger', 'survival',
          'rescue', 'hostage', 'terrorist', 'spy', 'assassin', 'martial arts', 'shootout',
          'helicopter', 'motorcycle', 'tank', 'bomb', 'grenade', 'sniper', 'commando'
        ],
        phrases: [
          'high speed chase', 'gun battle', 'martial arts', 'special forces', 'black ops',
          'hand to hand combat', 'weapons of mass destruction', 'ticking time bomb'
        ],
        emotions: ['intense', 'adrenaline', 'fear', 'courage', 'determination'],
        weight: 1.0
      },
      
      comedy: {
        keywords: [
          'funny', 'hilarious', 'joke', 'laugh', 'humor', 'comic', 'amusing', 'witty',
          'ridiculous', 'absurd', 'silly', 'goofy', 'clumsy', 'awkward', 'embarrassing',
          'sarcastic', 'ironic', 'parody', 'satire', 'mishap', 'blunder', 'prank'
        ],
        phrases: [
          'bursts out laughing', 'comic relief', 'funny business', 'practical joke',
          'slapstick comedy', 'witty banter', 'comedic timing'
        ],
        emotions: ['joy', 'amusement', 'delight', 'cheerful', 'playful'],
        weight: 1.0
      },

      drama: {
        keywords: [
          'emotion', 'tears', 'cry', 'sorrow', 'pain', 'loss', 'grief', 'heartbreak',
          'struggle', 'conflict', 'family', 'relationship', 'betrayal', 'sacrifice',
          'redemption', 'forgiveness', 'truth', 'justice', 'moral', 'ethical', 'dignity'
        ],
        phrases: [
          'emotional breakdown', 'family drama', 'moral dilemma', 'personal struggle',
          'character development', 'internal conflict', 'life changing moment'
        ],
        emotions: ['sadness', 'melancholy', 'contemplative', 'serious', 'profound'],
        weight: 1.0
      },

      horror: {
        keywords: [
          'scary', 'terrifying', 'nightmare', 'monster', 'ghost', 'demon', 'evil', 'dark',
          'blood', 'death', 'murder', 'kill', 'scream', 'fear', 'terror', 'haunted',
          'supernatural', 'curse', 'zombie', 'vampire', 'witch', 'creepy', 'sinister'
        ],
        phrases: [
          'blood curdling scream', 'supernatural forces', 'evil presence', 'haunted house',
          'ancient curse', 'demonic possession', 'jump scare', 'psychological terror'
        ],
        emotions: ['fear', 'terror', 'dread', 'anxiety', 'suspense'],
        weight: 1.0
      },

      thriller: {
        keywords: [
          'suspense', 'mystery', 'investigation', 'detective', 'clue', 'evidence', 'suspect',
          'conspiracy', 'secret', 'hidden', 'reveal', 'plot', 'twist', 'danger', 'tension',
          'paranoid', 'surveillance', 'stalker', 'blackmail', 'kidnap', 'ransom'
        ],
        phrases: [
          'plot twist', 'red herring', 'smoking gun', 'cat and mouse', 'double cross',
          'psychological thriller', 'edge of your seat', 'nail biting suspense'
        ],
        emotions: ['suspense', 'tension', 'anxiety', 'anticipation', 'uncertainty'],
        weight: 1.0
      },

      romance: {
        keywords: [
          'love', 'heart', 'kiss', 'romantic', 'passion', 'desire', 'attraction', 'beautiful',
          'wedding', 'marriage', 'couple', 'date', 'flowers', 'valentine', 'soulmate',
          'forever', 'destiny', 'charm', 'seduction', 'intimate', 'tender', 'affection'
        ],
        phrases: [
          'love at first sight', 'happily ever after', 'romantic comedy', 'star crossed lovers',
          'forbidden love', 'second chance romance', 'meet cute', 'chemistry between'
        ],
        emotions: ['love', 'passion', 'romantic', 'tender', 'affectionate'],
        weight: 1.0
      },

      scifi: {
        keywords: [
          'future', 'technology', 'robot', 'alien', 'space', 'planet', 'galaxy', 'universe',
          'spacecraft', 'laser', 'computer', 'artificial', 'intelligence', 'experiment',
          'laboratory', 'scientist', 'mutation', 'evolution', 'time travel', 'dimension',
          'cybernetic', 'virtual reality', 'hologram', 'android', 'cyborg'
        ],
        phrases: [
          'artificial intelligence', 'time travel', 'space exploration', 'alien invasion',
          'genetic engineering', 'virtual reality', 'parallel universe', 'distant future'
        ],
        emotions: ['wonder', 'curiosity', 'awe', 'contemplative', 'analytical'],
        weight: 1.0
      },

      fantasy: {
        keywords: [
          'magic', 'wizard', 'witch', 'spell', 'dragon', 'knight', 'castle', 'kingdom',
          'quest', 'sword', 'enchanted', 'mystical', 'legendary', 'prophecy', 'destiny',
          'elf', 'dwarf', 'fairy', 'unicorn', 'portal', 'realm', 'medieval', 'ancient'
        ],
        phrases: [
          'magical powers', 'epic quest', 'mythical creature', 'ancient prophecy',
          'magical kingdom', 'sword and sorcery', 'chosen one', 'dark magic'
        ],
        emotions: ['wonder', 'magical', 'adventurous', 'mystical', 'epic'],
        weight: 1.0
      },

      western: {
        keywords: [
          'cowboy', 'sheriff', 'outlaw', 'horse', 'ranch', 'desert', 'saloon', 'gunfight',
          'frontier', 'wilderness', 'gold', 'mining', 'cattle', 'railroad', 'wagon',
          'indian', 'native', 'tribe', 'lawman', 'bandit', 'six shooter', 'hat', 'boots'
        ],
        phrases: [
          'wild west', 'frontier town', 'cattle drive', 'gold rush', 'high noon showdown',
          'wanted dead or alive', 'law and order', 'cowboy boots'
        ],
        emotions: ['rugged', 'independent', 'traditional', 'adventurous', 'stoic'],
        weight: 1.0
      }
    };
  }

  /**
   * Initialize theme detection patterns
   */
  initializeThemePatterns() {
    this.themePatterns = {
      loveAndRelationships: {
        keywords: [
          'love', 'relationship', 'marriage', 'family', 'friendship', 'romance', 'dating',
          'commitment', 'trust', 'loyalty', 'betrayal', 'jealousy', 'heartbreak', 'divorce',
          'children', 'parents', 'siblings', 'community', 'belonging', 'connection'
        ],
        weight: 1.0
      },
      
      powerAndCorruption: {
        keywords: [
          'power', 'corruption', 'politics', 'government', 'authority', 'control', 'dominance',
          'manipulation', 'greed', 'money', 'wealth', 'corporate', 'conspiracy', 'influence',
          'elite', 'privilege', 'inequality', 'exploitation', 'abuse', 'dictator'
        ],
        weight: 1.0
      },

      survivalAndRedemption: {
        keywords: [
          'survival', 'redemption', 'second chance', 'forgiveness', 'transformation', 'growth',
          'overcoming', 'adversity', 'struggle', 'perseverance', 'resilience', 'hope',
          'healing', 'recovery', 'renewal', 'salvation', 'rebirth', 'change'
        ],
        weight: 1.0
      },

      identityAndSelfDiscovery: {
        keywords: [
          'identity', 'self', 'discovery', 'journey', 'purpose', 'meaning', 'truth', 'authentic',
          'belonging', 'acceptance', 'understanding', 'realization', 'awakening', 'growth',
          'maturity', 'wisdom', 'enlightenment', 'consciousness', 'awareness'
        ],
        weight: 1.0
      },

      justiceAndMorality: {
        keywords: [
          'justice', 'morality', 'ethics', 'right', 'wrong', 'good', 'evil', 'virtue', 'honor',
          'principle', 'values', 'conscience', 'responsibility', 'duty', 'integrity',
          'fairness', 'equality', 'discrimination', 'prejudice', 'bias'
        ],
        weight: 1.0
      },

      freedomAndOppression: {
        keywords: [
          'freedom', 'liberty', 'independence', 'oppression', 'tyranny', 'slavery', 'rebellion',
          'revolution', 'resistance', 'fight', 'escape', 'liberation', 'rights', 'democracy',
          'censorship', 'control', 'surveillance', 'conformity', 'individuality'
        ],
        weight: 1.0
      },

      deathAndMortality: {
        keywords: [
          'death', 'mortality', 'dying', 'grief', 'loss', 'memorial', 'funeral', 'grave',
          'afterlife', 'soul', 'spirit', 'eternal', 'legacy', 'memory', 'remembrance',
          'mourning', 'sorrow', 'acceptance', 'peace', 'closure'
        ],
        weight: 1.0
      },

      technologyAndHumanity: {
        keywords: [
          'technology', 'artificial', 'digital', 'virtual', 'cyber', 'robot', 'machine',
          'computer', 'internet', 'human', 'humanity', 'connection', 'isolation',
          'progress', 'innovation', 'advancement', 'dependency', 'surveillance', 'privacy'
        ],
        weight: 1.0
      }
    };
  }

  /**
   * Initialize tone and mood patterns
   */
  initializeTonePatterns() {
    this.tonePatterns = {
      dark: ['dark', 'grim', 'bleak', 'sinister', 'ominous', 'foreboding', 'menacing'],
      light: ['bright', 'cheerful', 'optimistic', 'uplifting', 'positive', 'hopeful'],
      serious: ['serious', 'grave', 'solemn', 'intense', 'dramatic', 'profound'],
      playful: ['playful', 'whimsical', 'lighthearted', 'fun', 'amusing', 'entertaining'],
      mysterious: ['mysterious', 'enigmatic', 'cryptic', 'puzzling', 'secretive', 'hidden'],
      romantic: ['romantic', 'passionate', 'tender', 'intimate', 'loving', 'affectionate'],
      suspenseful: ['suspenseful', 'tense', 'thrilling', 'gripping', 'edge', 'anticipation']
    };
  }

  /**
   * Analyze genre, themes, and tone of screenplay text
   */
  analyzeGenreAndThemes(text, scenes = [], characters = []) {
    const analysis = {
      genreAnalysis: this.analyzeGenre(text, scenes),
      themeAnalysis: this.analyzeThemes(text, scenes, characters),
      toneAnalysis: this.analyzeTone(text),
      sentimentAnalysis: this.analyzeSentiment(text),
      stylisticAnalysis: this.analyzeWritingStyle(text),
      metadata: {
        analysisDate: new Date().toISOString(),
        textStats: {
          wordCount: this.tokenizer.tokenize(text).length,
          sentenceCount: text.split(/[.!?]+/).length,
          averageWordsPerSentence: 0
        }
      }
    };

    // Calculate average words per sentence
    analysis.metadata.textStats.averageWordsPerSentence = Math.round(
      analysis.metadata.textStats.wordCount / analysis.metadata.textStats.sentenceCount
    );

    return analysis;
  }

  /**
   * Analyze genre using multiple NLP techniques
   */
  analyzeGenre(text, scenes = []) {
    const words = this.tokenizer.tokenize(text.toLowerCase());
    const genreScores = {};
    const genreEvidence = {};

    // Initialize scores
    Object.keys(this.genrePatterns).forEach(genre => {
      genreScores[genre] = 0;
      genreEvidence[genre] = {
        keywords: [],
        phrases: [],
        emotions: [],
        sceneIndicators: []
      };
    });

    // Analyze keywords
    words.forEach(word => {
      Object.entries(this.genrePatterns).forEach(([genre, patterns]) => {
        if (patterns.keywords.includes(word)) {
          genreScores[genre] += patterns.weight;
          genreEvidence[genre].keywords.push(word);
        }
      });
    });

    // Analyze phrases
    Object.entries(this.genrePatterns).forEach(([genre, patterns]) => {
      if (patterns.phrases) {
        patterns.phrases.forEach(phrase => {
          const regex = new RegExp(phrase.replace(/\s+/g, '\\s+'), 'gi');
          const matches = (text.match(regex) || []).length;
          if (matches > 0) {
            genreScores[genre] += matches * 2 * patterns.weight;
            genreEvidence[genre].phrases.push({ phrase, count: matches });
          }
        });
      }
    });

    // Analyze emotional indicators
    Object.entries(this.genrePatterns).forEach(([genre, patterns]) => {
      if (patterns.emotions) {
        patterns.emotions.forEach(emotion => {
          const regex = new RegExp(`\\b${emotion}\\w*\\b`, 'gi');
          const matches = (text.match(regex) || []).length;
          if (matches > 0) {
            genreScores[genre] += matches * 1.5 * patterns.weight;
            genreEvidence[genre].emotions.push({ emotion, count: matches });
          }
        });
      }
    });

    // Analyze scene headers for additional context
    scenes.forEach(scene => {
      if (scene.header) {
        const header = scene.header.toLowerCase();
        Object.entries(this.genrePatterns).forEach(([genre, patterns]) => {
          patterns.keywords.forEach(keyword => {
            if (header.includes(keyword)) {
              genreScores[genre] += patterns.weight * 0.5;
              genreEvidence[genre].sceneIndicators.push(scene.header);
            }
          });
        });
      }
    });

    // Normalize scores and calculate confidence
    const totalScore = Object.values(genreScores).reduce((sum, score) => sum + score, 0);
    const normalizedScores = {};
    
    Object.entries(genreScores).forEach(([genre, score]) => {
      normalizedScores[genre] = totalScore > 0 ? Math.round((score / totalScore) * 100) : 0;
    });

    // Find primary and secondary genres
    const sortedGenres = Object.entries(normalizedScores)
      .sort((a, b) => b[1] - a[1])
      .filter(([genre, score]) => score > 5); // Filter out very low scores

    const primaryGenre = sortedGenres.length > 0 ? sortedGenres[0] : ['unknown', 0];
    const secondaryGenres = sortedGenres.slice(1, 3);

    return {
      primaryGenre: primaryGenre[0],
      primaryGenreScore: primaryGenre[1],
      secondaryGenres: secondaryGenres.map(([genre, score]) => ({ genre, score })),
      allGenreScores: normalizedScores,
      genreConfidence: primaryGenre[1],
      genreEvidence: genreEvidence[primaryGenre[0]] || {},
      recommendations: this.generateGenreRecommendations(normalizedScores, genreEvidence)
    };
  }

  /**
   * Analyze themes in the screenplay
   */
  analyzeThemes(text, scenes = [], characters = []) {
    const words = this.tokenizer.tokenize(text.toLowerCase());
    const themeScores = {};
    const themeEvidence = {};

    // Initialize scores
    Object.keys(this.themePatterns).forEach(theme => {
      themeScores[theme] = 0;
      themeEvidence[theme] = [];
    });

    // Analyze theme keywords
    words.forEach(word => {
      Object.entries(this.themePatterns).forEach(([theme, patterns]) => {
        if (patterns.keywords.includes(word)) {
          themeScores[theme] += patterns.weight;
          themeEvidence[theme].push(word);
        }
      });
    });

    // Normalize scores
    const totalScore = Object.values(themeScores).reduce((sum, score) => sum + score, 0);
    const normalizedScores = {};
    
    Object.entries(themeScores).forEach(([theme, score]) => {
      normalizedScores[theme] = totalScore > 0 ? Math.round((score / totalScore) * 100) : 0;
    });

    // Find dominant themes
    const sortedThemes = Object.entries(normalizedScores)
      .sort((a, b) => b[1] - a[1])
      .filter(([theme, score]) => score > 8); // Filter out very low scores

    const primaryTheme = sortedThemes.length > 0 ? sortedThemes[0] : ['identity', 0];
    const secondaryThemes = sortedThemes.slice(1, 4);

    return {
      primaryTheme: primaryTheme[0],
      primaryThemeScore: primaryTheme[1],
      secondaryThemes: secondaryThemes.map(([theme, score]) => ({ theme, score })),
      allThemeScores: normalizedScores,
      themeConfidence: primaryTheme[1],
      themeEvidence: themeEvidence,
      thematicRecommendations: this.generateThematicRecommendations(normalizedScores)
    };
  }

  /**
   * Analyze tone and mood
   */
  analyzeTone(text) {
    const words = this.tokenizer.tokenize(text.toLowerCase());
    const toneScores = {};
    const toneEvidence = {};

    // Initialize scores
    Object.keys(this.tonePatterns).forEach(tone => {
      toneScores[tone] = 0;
      toneEvidence[tone] = [];
    });

    // Analyze tone indicators
    words.forEach(word => {
      Object.entries(this.tonePatterns).forEach(([tone, keywords]) => {
        if (keywords.includes(word)) {
          toneScores[tone]++;
          toneEvidence[tone].push(word);
        }
      });
    });

    // Find dominant tones
    const sortedTones = Object.entries(toneScores)
      .sort((a, b) => b[1] - a[1])
      .filter(([tone, score]) => score > 0);

    return {
      dominantTones: sortedTones.slice(0, 3).map(([tone, score]) => ({ tone, score })),
      allToneScores: toneScores,
      toneEvidence: toneEvidence,
      overallMood: this.determineMood(sortedTones)
    };
  }

  /**
   * Perform sentiment analysis
   */
  analyzeSentiment(text) {
    const result = this.sentiment.analyze(text);
    
    return {
      score: result.score,
      comparative: result.comparative,
      calculation: result.calculation,
      tokens: result.tokens,
      words: result.words,
      positive: result.positive,
      negative: result.negative,
      interpretation: this.interpretSentiment(result.comparative),
      emotionalRange: this.calculateEmotionalRange(text)
    };
  }

  /**
   * Analyze writing style
   */
  analyzeWritingStyle(text) {
    const doc = compromise(text);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = this.tokenizer.tokenize(text);
    
    // Calculate various metrics
    const avgWordsPerSentence = words.length / sentences.length;
    const avgSyllablesPerWord = this.calculateAverageSyllables(words);
    const complexWords = this.countComplexWords(words);
    
    // Readability scores
    const fleschKincaid = this.calculateFleschKincaid(sentences.length, words.length, avgSyllablesPerWord);
    const gunningFog = this.calculateGunningFog(sentences.length, words.length, complexWords);

    return {
      readabilityScores: {
        fleschKincaid: Math.round(fleschKincaid * 10) / 10,
        gunningFog: Math.round(gunningFog * 10) / 10,
        interpretation: this.interpretReadability(fleschKincaid)
      },
      vocabulary: {
        uniqueWords: new Set(words.map(w => w.toLowerCase())).size,
        totalWords: words.length,
        vocabularyRichness: Math.round((new Set(words.map(w => w.toLowerCase())).size / words.length) * 100),
        complexWords: complexWords,
        averageWordLength: Math.round(words.join('').length / words.length * 10) / 10
      },
      structure: {
        averageWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
        averageSyllablesPerWord: Math.round(avgSyllablesPerWord * 10) / 10,
        sentenceVariety: this.analyzeSentenceVariety(sentences),
        dialogueRatio: this.calculateDialogueRatio(text)
      },
      linguisticFeatures: {
        adjectiveUsage: doc.adjectives().length,
        adverbUsage: doc.adverbs().length,
        nounUsage: doc.nouns().length,
        verbUsage: doc.verbs().length,
        passiveVoice: this.detectPassiveVoice(text),
        formalityLevel: this.assessFormality(words)
      }
    };
  }

  /**
   * Generate genre-specific recommendations
   */
  generateGenreRecommendations(scores, evidence) {
    const recommendations = [];
    const primaryGenre = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    
    if (primaryGenre[1] < 30) {
      recommendations.push('Genre identity is unclear. Consider strengthening specific genre elements.');
    }
    
    if (scores.action > 20 && scores.comedy > 20) {
      recommendations.push('Strong action-comedy hybrid detected. Ensure balanced tone throughout.');
    }
    
    if (scores.horror > 15 && scores.romance > 15) {
      recommendations.push('Horror-romance combination detected. Handle tonal shifts carefully.');
    }
    
    return recommendations;
  }

  /**
   * Generate thematic recommendations
   */
  generateThematicRecommendations(scores) {
    const recommendations = [];
    const themes = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    
    if (themes[0][1] < 25) {
      recommendations.push('Thematic focus could be stronger. Consider deepening key themes.');
    }
    
    if (themes.length > 4 && themes[3][1] > 15) {
      recommendations.push('Multiple themes detected. Consider focusing on 2-3 primary themes.');
    }
    
    return recommendations;
  }

  // Helper methods for calculations
  determineMood(sortedTones) {
    if (sortedTones.length === 0) return 'neutral';
    const dominantTone = sortedTones[0][0];
    const moodMap = {
      dark: 'somber',
      light: 'upbeat',
      serious: 'contemplative',
      playful: 'lighthearted',
      mysterious: 'enigmatic',
      romantic: 'tender',
      suspenseful: 'tense'
    };
    return moodMap[dominantTone] || 'complex';
  }

  interpretSentiment(comparative) {
    if (comparative >= 0.1) return 'positive';
    if (comparative <= -0.1) return 'negative';
    return 'neutral';
  }

  calculateEmotionalRange(text) {
    const sentences = text.split(/[.!?]+/);
    const sentiments = sentences.map(s => this.sentiment.analyze(s).comparative);
    const max = Math.max(...sentiments);
    const min = Math.min(...sentiments);
    return Math.round((max - min) * 100) / 100;
  }

  calculateAverageSyllables(words) {
    return words.reduce((sum, word) => sum + this.countSyllables(word), 0) / words.length;
  }

  countSyllables(word) {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    const matches = word.match(/[aeiouy]{1,2}/g);
    return matches ? matches.length : 1;
  }

  countComplexWords(words) {
    return words.filter(word => this.countSyllables(word) >= 3).length;
  }

  calculateFleschKincaid(sentences, words, avgSyllables) {
    return 206.835 - (1.015 * (words / sentences)) - (84.6 * avgSyllables);
  }

  calculateGunningFog(sentences, words, complexWords) {
    return 0.4 * ((words / sentences) + (100 * (complexWords / words)));
  }

  interpretReadability(score) {
    if (score >= 90) return 'very easy';
    if (score >= 80) return 'easy';
    if (score >= 70) return 'fairly easy';
    if (score >= 60) return 'standard';
    if (score >= 50) return 'fairly difficult';
    if (score >= 30) return 'difficult';
    return 'very difficult';
  }

  analyzeSentenceVariety(sentences) {
    const lengths = sentences.map(s => s.split(/\s+/).length);
    const avg = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avg, 2), 0) / lengths.length;
    return Math.round(Math.sqrt(variance) * 10) / 10;
  }

  calculateDialogueRatio(text) {
    const dialogueLines = text.split('\n').filter(line => 
      line.trim().match(/^[A-Z][A-Z\s]*$/) || 
      line.trim().match(/^\s*[^A-Z\n]/) && !line.trim().match(/^(INT\.|EXT\.|FADE)/)
    );
    const totalLines = text.split('\n').length;
    return Math.round((dialogueLines.length / totalLines) * 100);
  }

  detectPassiveVoice(text) {
    const passivePatterns = [
      /\b(was|were|been|being)\s+\w+ed\b/gi,
      /\b(is|am|are)\s+being\s+\w+ed\b/gi
    ];
    let passiveCount = 0;
    passivePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) passiveCount += matches.length;
    });
    const sentences = text.split(/[.!?]+/).length;
    return Math.round((passiveCount / sentences) * 100);
  }

  assessFormality(words) {
    const formalWords = [
      'furthermore', 'therefore', 'consequently', 'nevertheless', 'moreover',
      'however', 'thus', 'indeed', 'accordingly', 'subsequently'
    ];
    const informalWords = [
      'yeah', 'gonna', 'wanna', 'gotta', 'kinda', 'sorta', 'ain\'t', 'ok', 'hey'
    ];
    
    const formalCount = words.filter(word => formalWords.includes(word.toLowerCase())).length;
    const informalCount = words.filter(word => informalWords.includes(word.toLowerCase())).length;
    
    if (formalCount > informalCount) return 'formal';
    if (informalCount > formalCount) return 'informal';
    return 'neutral';
  }
}

/**
 * Factory function for creating genre theme analyzer
 */
export function createGenreThemeAnalyzer() {
  return new GenreThemeAnalyzer();
}

export default GenreThemeAnalyzer;