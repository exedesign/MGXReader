/**
 * Enhanced Analysis Engine
 * Combines AI analysis with advanced NLP processing
 */

import { createGenreThemeAnalyzer } from './genreThemeAnalyzer.js';
import { createCompetitiveAnalysisEngine } from './competitiveAnalysisEngine.js';
import { createGeographicMarketAnalyzer } from './geographicMarketAnalyzer.js';
import { createTrendAnalysisEngine } from './trendAnalysisEngine.js';
import { createRiskOpportunityEngine } from './riskOpportunityEngine.js';

export class EnhancedAnalysisEngine {
  constructor(aiHandler, dramaturgyAnalyzer, characterDialogueAnalyzer) {
    this.aiHandler = aiHandler;
    this.dramaturgyAnalyzer = dramaturgyAnalyzer;
    this.characterDialogueAnalyzer = characterDialogueAnalyzer;
    this.genreThemeAnalyzer = createGenreThemeAnalyzer();
    this.competitiveAnalysisEngine = createCompetitiveAnalysisEngine();
    this.geographicMarketAnalyzer = createGeographicMarketAnalyzer();
    this.trendAnalysisEngine = createTrendAnalysisEngine();
    this.riskOpportunityEngine = createRiskOpportunityEngine();
  }

  /**
   * Enhanced Screenplay Analysis with Advanced NLP
   * Combines AI analysis with local NLP processing for comprehensive results
   */
  async analyzeScreenplayEnhanced(text, scenes = [], characters = [], options = {}) {
    const { onProgress = () => {} } = options;

    try {
      onProgress({ 
        step: 'start', 
        progress: 0, 
        message: 'Starting enhanced screenplay analysis...' 
      });

      // Step 1: Basic AI Analysis
      onProgress({ 
        step: 'ai_analysis', 
        progress: 10, 
        message: 'Running AI-powered analysis...' 
      });
      
      const aiAnalysis = await this.aiHandler.analyzeScreenplayWithChunking(text, {
        useChunking: options.useChunking,
        language: options.language,
        onProgress: (progressData) => {
          onProgress({
            step: 'ai_analysis',
            progress: 10 + (progressData.progress * 0.4), // 10-50%
            message: `AI Analysis: ${progressData.message}`
          });
        }
      });

      // Step 2: Dramaturgy Analysis
      onProgress({ 
        step: 'dramaturgy', 
        progress: 50, 
        message: 'Analyzing screenplay structure and dramaturgy...' 
      });

      const dramaturgyAnalysis = this.dramaturgyAnalyzer.analyzeScreenplay(
        text, 
        aiAnalysis.scenes || scenes, 
        aiAnalysis.characters || characters
      );

      // Step 3: Character & Dialogue Analysis
      onProgress({ 
        step: 'character_dialogue', 
        progress: 70, 
        message: 'Analyzing characters and dialogue quality...' 
      });

      const characterDialogueAnalysis = this.characterDialogueAnalyzer.analyzeCharactersAndDialogue(
        text,
        aiAnalysis.scenes || scenes,
        aiAnalysis.characters?.map(c => c.name) || characters
      );

      // Step 4: Genre & Theme Analysis
      onProgress({ 
        step: 'genre_theme', 
        progress: 78, 
        message: 'Analyzing genre, themes, and writing style...' 
      });

      const genreThemeAnalysis = this.genreThemeAnalyzer.analyzeGenreAndThemes(
        text,
        aiAnalysis.scenes || scenes,
        aiAnalysis.characters || characters
      );

      // Step 5: Competitive Analysis
      onProgress({ 
        step: 'competitive', 
        progress: 85, 
        message: 'Analyzing competitive position and market opportunities...' 
      });

      // Create preliminary analysis object for competitive analysis
      const preliminaryAnalysis = {
        ...aiAnalysis,
        dramaturgy: dramaturgyAnalysis,
        characterAnalysis: characterDialogueAnalysis.characterAnalysis,
        dialogueAnalysis: characterDialogueAnalysis.dialogueAnalysis,
        genreThemeAnalysis: genreThemeAnalysis
      };

      const competitiveAnalysis = this.competitiveAnalysisEngine.analyzeCompetitivePosition(preliminaryAnalysis);

      // Step 6: Geographic Market Analysis
      onProgress({ 
        step: 'geographic', 
        progress: 90, 
        message: 'Analyzing geographic market potential and regional strategies...' 
      });

      const geographicAnalysis = this.geographicMarketAnalyzer.analyzeGeographicMarkets(preliminaryAnalysis);

      // Step 7: Trend Analysis
      onProgress({ 
        step: 'trends', 
        progress: 92, 
        message: 'Analyzing industry trends and market positioning...' 
      });

      const trendAnalysis = this.trendAnalysisEngine.analyzeTrendAlignment(preliminaryAnalysis);

      // Step 8: Risk & Opportunity Assessment
      onProgress({ 
        step: 'risk_assessment', 
        progress: 95, 
        message: 'Assessing risks and identifying opportunities...' 
      });

      const riskOpportunityAnalysis = this.riskOpportunityEngine.assessRiskAndOpportunities(preliminaryAnalysis);

      // Step 9: Enhanced Analysis Integration
      onProgress({ 
        step: 'integration', 
        progress: 85, 
        message: 'Integrating analysis results...' 
      });

      const enhancedAnalysis = this.integrateAnalysisResults(
        aiAnalysis, 
        dramaturgyAnalysis, 
        characterDialogueAnalysis,
        genreThemeAnalysis,
        competitiveAnalysis,
        geographicAnalysis,
        trendAnalysis,
        riskOpportunityAnalysis,
        text
      );

      // Step 10: Generate Recommendations
      onProgress({ 
        step: 'recommendations', 
        progress: 95, 
        message: 'Generating recommendations...' 
      });

      enhancedAnalysis.recommendations = this.generateEnhancedRecommendations(enhancedAnalysis);

      onProgress({ 
        step: 'complete', 
        progress: 100, 
        message: 'Enhanced analysis complete!' 
      });

      return enhancedAnalysis;

    } catch (error) {
      console.error('Enhanced analysis failed:', error);
      onProgress({ 
        step: 'error', 
        progress: 0, 
        message: `Enhanced analysis failed: ${error.message}` 
      });
      throw error;
    }
  }

  /**
   * Integrate results from multiple analysis engines
   */
  integrateAnalysisResults(aiAnalysis, dramaturgyAnalysis, characterDialogueAnalysis, genreThemeAnalysis, competitiveAnalysis, geographicAnalysis, trendAnalysis, riskOpportunityAnalysis, text) {
    const integrated = {
      // Basic AI analysis (scenes, locations, equipment, etc.)
      ...aiAnalysis,
      
      // Enhanced with dramaturgy insights
      dramaturgy: dramaturgyAnalysis,
      
      // Enhanced character and dialogue analysis
      characterAnalysis: characterDialogueAnalysis.characterAnalysis,
      dialogueAnalysis: characterDialogueAnalysis.dialogueAnalysis,
      relationshipAnalysis: characterDialogueAnalysis.relationshipAnalysis,
      
      // Advanced NLP genre and theme analysis
      genreThemeAnalysis: genreThemeAnalysis,
      
      // Competitive analysis and market positioning
      competitiveAnalysis: competitiveAnalysis,
      
      // Geographic market analysis and regional strategies
      geographicAnalysis: geographicAnalysis,
      
      // Industry trend analysis and timing recommendations
      trendAnalysis: trendAnalysis,
      
      // Risk assessment and opportunity identification
      riskOpportunityAnalysis: riskOpportunityAnalysis,
      
      // Integrated metrics
      enhancedMetrics: {
        scriptLength: {
          pages: dramaturgyAnalysis.structuralAnalysis?.totalPages || 0,
          scenes: dramaturgyAnalysis.structuralAnalysis?.totalScenes || 0,
          characters: characterDialogueAnalysis.characterAnalysis?.statistics?.totalCharacters || 0,
          estimatedRuntime: dramaturgyAnalysis.structuralAnalysis?.totalPages || 0 // 1 page ≈ 1 minute
        },
        
        qualityScores: {
          structuralIntegrity: dramaturgyAnalysis.plotPoints?.structuralIntegrity?.score || 0,
          dialogueQuality: characterDialogueAnalysis.dialogueAnalysis?.overallQuality?.score || 0,
          readabilityScore: dramaturgyAnalysis.readabilityScore?.score || 0,
          characterDevelopment: this.calculateCharacterDevelopmentScore(characterDialogueAnalysis),
          overallQuality: 0 // Will be calculated
        },
        
        productionMetrics: {
          complexity: this.calculateProductionComplexity(aiAnalysis),
          estimatedBudget: this.estimateProductionBudget(aiAnalysis),
          shootingDaysEstimate: aiAnalysis.summary?.estimatedShootingDays || 0,
          crewSize: this.estimateCrewSize(aiAnalysis)
        },
        
        marketAnalysis: {
          genre: genreThemeAnalysis.genreAnalysis?.primaryGenre || 'Unknown',
          genreConfidence: genreThemeAnalysis.genreAnalysis?.genreConfidence || 0,
          secondaryGenres: genreThemeAnalysis.genreAnalysis?.secondaryGenres || [],
          themes: genreThemeAnalysis.themeAnalysis?.primaryTheme || 'Unknown',
          themeConfidence: genreThemeAnalysis.themeAnalysis?.themeConfidence || 0,
          secondaryThemes: genreThemeAnalysis.themeAnalysis?.secondaryThemes || [],
          tone: genreThemeAnalysis.toneAnalysis?.dominantTones?.[0]?.tone || 'neutral',
          sentiment: genreThemeAnalysis.sentimentAnalysis?.interpretation || 'neutral',
          targetAudience: this.analyzeTargetAudience(genreThemeAnalysis.genreAnalysis),
          marketPotential: this.assessMarketPotential(genreThemeAnalysis.genreAnalysis),
          writingQuality: genreThemeAnalysis.stylisticAnalysis?.readabilityScores?.fleschKincaid || 0,
          competitiveScore: competitiveAnalysis.competitiveScore || 0,
          marketPosition: competitiveAnalysis.marketPosition?.position || 'unknown',
          competitiveAdvantage: competitiveAnalysis.uniquenessAnalysis?.overallUniqueness || 0,
          trendAlignment: competitiveAnalysis.trendAlignment?.overall || 0,
          globalPotential: geographicAnalysis.globalPotential || 0,
          primaryMarkets: this.extractPrimaryMarkets(geographicAnalysis),
          distributionStrategy: geographicAnalysis.distributionStrategy?.primaryStrategy || 'unknown'
        }
      },
      
      // Additional metadata
      metadata: {
        analysisVersion: '2.0-enhanced-nlp',
        analysisDate: new Date().toISOString(),
        analysisEngines: ['AI', 'Dramaturgy', 'CharacterDialogue', 'GenreTheme', 'Competitive', 'Geographic', 'Trend', 'RiskOpportunity'],
        textStats: {
          wordCount: text.split(/\s+/).length,
          lineCount: text.split('\n').length,
          characterCount: text.length,
          uniqueWords: genreThemeAnalysis.stylisticAnalysis?.vocabulary?.uniqueWords || 0,
          vocabularyRichness: genreThemeAnalysis.stylisticAnalysis?.vocabulary?.vocabularyRichness || 0
        }
      }
    };

    // Calculate overall quality score
    integrated.enhancedMetrics.qualityScores.overallQuality = Math.round(
      (integrated.enhancedMetrics.qualityScores.structuralIntegrity * 0.3 +
       integrated.enhancedMetrics.qualityScores.dialogueQuality * 0.3 +
       integrated.enhancedMetrics.qualityScores.readabilityScore * 0.2 +
       integrated.enhancedMetrics.qualityScores.characterDevelopment * 0.2)
    );

    return integrated;
  }

  /**
   * Generate comprehensive recommendations based on enhanced analysis
   */
  generateEnhancedRecommendations(analysis) {
    const recommendations = {
      structural: [],
      dialogue: [],
      character: [],
      production: [],
      marketing: [],
      genre: [],
      thematic: [],
      style: [],
      competitive: [],
      geographic: [],
      trend: [],
      risk: []
    };

    const quality = analysis.enhancedMetrics.qualityScores;
    const dramaturgy = analysis.dramaturgy;
    const dialogue = analysis.dialogueAnalysis;

    // Structural recommendations
    if (quality.structuralIntegrity < 70) {
      recommendations.structural.push('Consider strengthening key plot points for better dramatic structure');
    }
    
    if (dramaturgy.structuralAnalysis?.totalScenes < 30) {
      recommendations.structural.push('Screenplay may benefit from additional scenes to develop story');
    } else if (dramaturgy.structuralAnalysis?.totalScenes > 80) {
      recommendations.structural.push('Consider consolidating scenes for better pacing');
    }

    if (dramaturgy.plotPoints?.structuralIntegrity?.missingElements?.length > 0) {
      recommendations.structural.push(`Missing key structural elements: ${dramaturgy.plotPoints.structuralIntegrity.missingElements.join(', ')}`);
    }

    // Dialogue recommendations
    if (quality.dialogueQuality < 70) {
      recommendations.dialogue.push('Dialogue quality could be improved - consider more natural, character-specific speech patterns');
    }

    if (dialogue.overallQuality?.recommendations) {
      recommendations.dialogue.push(...dialogue.overallQuality.recommendations);
    }

    if (dialogue.ratioAnalysis?.dialoguePercentage > 70) {
      recommendations.dialogue.push('Heavy dialogue - consider balancing with more visual storytelling');
    } else if (dialogue.ratioAnalysis?.dialoguePercentage < 30) {
      recommendations.dialogue.push('Light on dialogue - consider developing character interactions');
    }

    // Character recommendations
    const charStats = analysis.characterAnalysis?.statistics;
    if (charStats?.mainCharacters < 1) {
      recommendations.character.push('No clear main character identified - consider strengthening protagonist role');
    } else if (charStats?.mainCharacters > 3) {
      recommendations.character.push('Multiple main characters detected - ensure each has sufficient development');
    }

    if (charStats?.minorCharacters > charStats?.mainCharacters * 3) {
      recommendations.character.push('Many minor characters - consider consolidating roles for clarity');
    }

    // Production recommendations
    const production = analysis.enhancedMetrics.productionMetrics;
    if (production.complexity > 8) {
      recommendations.production.push('High production complexity - consider budget implications');
    }

    if (analysis.locations?.length > 15) {
      recommendations.production.push('Many locations - consider consolidating for budget efficiency');
    }

    if (analysis.equipment?.length > 20) {
      recommendations.production.push('Extensive equipment needs - ensure proper budgeting and scheduling');
    }

    // Marketing recommendations
    const market = analysis.enhancedMetrics.marketAnalysis;
    if (market.genreConfidence < 60) {
      recommendations.marketing.push('Genre identity unclear - consider strengthening genre elements for market positioning');
    }

    if (market.marketPotential === 'low') {
      recommendations.marketing.push('Limited market potential - consider unique selling propositions or niche targeting');
    }

    // Genre recommendations
    const genre = analysis.genreThemeAnalysis?.genreAnalysis;
    if (genre?.genreConfidence < 60) {
      recommendations.genre.push('Genre identity unclear - consider strengthening genre-specific elements');
    }

    if (genre?.recommendations?.length > 0) {
      recommendations.genre.push(...genre.recommendations);
    }

    // Thematic recommendations
    const themes = analysis.genreThemeAnalysis?.themeAnalysis;
    if (themes?.thematicRecommendations?.length > 0) {
      recommendations.thematic.push(...themes.thematicRecommendations);
    }

    if (themes?.themeConfidence < 25) {
      recommendations.thematic.push('Themes need development - consider deepening thematic elements');
    }

    // Writing style recommendations
    const style = analysis.genreThemeAnalysis?.stylisticAnalysis;
    if (style?.readabilityScores?.fleschKincaid < 30) {
      recommendations.style.push('Text is very difficult to read - consider simplifying sentence structure');
    } else if (style?.readabilityScores?.fleschKincaid > 90) {
      recommendations.style.push('Text may be too simple for target audience - consider adding complexity');
    }

    if (style?.vocabulary?.vocabularyRichness < 30) {
      recommendations.style.push('Limited vocabulary diversity - consider using more varied word choices');
    }

    if (style?.structure?.averageWordsPerSentence > 25) {
      recommendations.style.push('Sentences are quite long - consider breaking them up for clarity');
    }

    if (style?.linguisticFeatures?.passiveVoice > 20) {
      recommendations.style.push('High passive voice usage - consider using more active voice for engagement');
    }

    // Competitive recommendations
    const competitive = analysis.competitiveAnalysis;
    if (competitive?.competitiveScore < 50) {
      recommendations.competitive.push('Low competitive score - significant improvements needed for market success');
    }

    if (competitive?.marketPosition?.position === 'longshot') {
      recommendations.competitive.push('Current market position is weak - consider targeting niche markets or festivals');
    }

    if (competitive?.trendAlignment?.overall < 40) {
      recommendations.competitive.push('Poor alignment with current trends - consider updating themes for market relevance');
    }

    if (competitive?.uniquenessAnalysis?.overallUniqueness < 60) {
      recommendations.competitive.push('Limited uniqueness - strengthen distinctive elements to stand out in marketplace');
    }

    if (competitive?.strategicRecommendations?.length > 0) {
      recommendations.competitive.push(...competitive.strategicRecommendations.map(rec => rec.recommendation));
    }

    // Geographic recommendations
    const geographic = analysis.geographicAnalysis;
    if (geographic?.globalPotential < 50) {
      recommendations.geographic.push('Low global potential - focus on specific regional markets for better ROI');
    }

    if (geographic?.strategicRecommendations?.length > 0) {
      recommendations.geographic.push(...geographic.strategicRecommendations.map(rec => rec.recommendation));
    }

    if (geographic?.culturalSuitability?.riskLevel === 'high') {
      recommendations.geographic.push('High cultural sensitivity - significant localization required for key markets');
    }

    // Trend recommendations
    const trend = analysis.trendAnalysis;
    if (trend?.overallTrendScore < 60) {
      recommendations.trend.push('Poor trend alignment - consider incorporating current market trends');
    }

    if (trend?.strategicRecommendations?.length > 0) {
      recommendations.trend.push(...trend.strategicRecommendations.map(rec => rec.recommendation));
    }

    // Risk and opportunity recommendations
    const risk = analysis.riskOpportunityAnalysis;
    if (risk?.overallRiskScore > 70) {
      recommendations.risk.push('High risk profile - implement comprehensive risk mitigation strategies');
    }

    if (risk?.strategicRecommendations?.length > 0) {
      recommendations.risk.push(...risk.strategicRecommendations.map(rec => rec.recommendation));
    }

    if (risk?.opportunityAnalysis?.prioritized?.length > 0) {
      const topOpportunity = risk.opportunityAnalysis.prioritized[0];
      recommendations.risk.push(`Priority opportunity: ${topOpportunity.type || 'market expansion'}`);
    }

    return recommendations;
  }

  // Helper methods for enhanced analysis
  calculateCharacterDevelopmentScore(characterDialogueAnalysis) {
    const stats = characterDialogueAnalysis.characterAnalysis?.statistics;
    if (!stats) return 0;
    
    // Base score on character distribution and development
    const mainCharRatio = stats.mainCharacters / (stats.totalCharacters || 1);
    const avgDialogue = stats.averageDialoguePerCharacter || 0;
    
    return Math.min(100, Math.round((mainCharRatio * 50) + (Math.min(avgDialogue / 20, 1) * 50)));
  }

  calculateProductionComplexity(aiAnalysis) {
    let complexity = 0;
    
    // Add complexity based on various factors
    complexity += (aiAnalysis.locations?.length || 0) * 0.5;
    complexity += (aiAnalysis.equipment?.length || 0) * 0.3;
    complexity += (aiAnalysis.vfxRequirements?.length || 0) * 1.5;
    complexity += (aiAnalysis.sfxRequirements?.length || 0) * 0.8;
    
    return Math.min(10, complexity);
  }

  extractPrimaryMarkets(geographicAnalysis) {
    if (!geographicAnalysis?.regionalAnalysis) return [];
    
    return Object.entries(geographicAnalysis.regionalAnalysis)
      .sort((a, b) => b[1].marketScore - a[1].marketScore)
      .slice(0, 3)
      .map(([market, data]) => ({ market, score: data.marketScore }));
  }

  estimateProductionBudget(aiAnalysis) {
    // Simplified budget estimation
    const baselineBudget = 50000; // Base indie film budget
    let budgetMultiplier = 1;
    
    budgetMultiplier += (aiAnalysis.locations?.length || 0) * 0.1;
    budgetMultiplier += (aiAnalysis.characters?.length || 0) * 0.05;
    budgetMultiplier += (aiAnalysis.vfxRequirements?.length || 0) * 0.5;
    
    return Math.round(baselineBudget * budgetMultiplier);
  }

  estimateCrewSize(aiAnalysis) {
    // Base crew size
    let crewSize = 8; // Minimal crew
    
    // Adjust based on complexity
    crewSize += Math.min((aiAnalysis.locations?.length || 0) / 3, 5);
    crewSize += Math.min((aiAnalysis.equipment?.length || 0) / 5, 8);
    crewSize += (aiAnalysis.vfxRequirements?.length || 0) * 2;
    
    return Math.round(crewSize);
  }

  analyzeTargetAudience(genreAnalysis) {
    const genreAudienceMap = {
      drama: 'Adult (25-54)',
      comedy: 'Young Adult/Adult (18-44)',
      thriller: 'Adult (18-54)',
      horror: 'Young Adult (18-34)',
      action: 'Young Adult/Adult (16-44)',
      romance: 'Adult (22-54)',
      scifi: 'Young Adult/Adult (16-44)',
      fantasy: 'Teen/Young Adult (13-34)'
    };
    
    return genreAudienceMap[genreAnalysis?.primaryGenre?.toLowerCase()] || 'General Audience';
  }

  assessMarketPotential(genreAnalysis) {
    const confidence = genreAnalysis?.genreConfidence || 0;
    const popularGenres = ['action', 'comedy', 'thriller', 'horror'];
    const genre = genreAnalysis?.primaryGenre?.toLowerCase();
    
    if (confidence > 70 && popularGenres.includes(genre)) {
      return 'high';
    } else if (confidence > 50) {
      return 'medium';
    } else {
      return 'low';
    }
  }
}

/**
 * Factory function for creating enhanced analysis engine
 */
export function createEnhancedAnalysisEngine(aiHandler, dramaturgyAnalyzer, characterDialogueAnalyzer) {
  return new EnhancedAnalysisEngine(aiHandler, dramaturgyAnalyzer, characterDialogueAnalyzer);
}

export default EnhancedAnalysisEngine;