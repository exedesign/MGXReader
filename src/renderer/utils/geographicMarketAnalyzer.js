/**
 * Geographic Market Analysis Engine
 * Analyzes regional market performance and audience preferences
 */

export class GeographicMarketAnalyzer {
  constructor() {
    this.initializeRegionalData();
    this.initializeCulturalFactors();
    this.initializeLanguageMarkets();
    this.initializeDistributionChannels();
  }

  /**
   * Initialize regional market data
   */
  initializeRegionalData() {
    this.regionalMarkets = {
      northAmerica: {
        regions: ['US', 'Canada', 'Mexico'],
        marketSize: 42.5, // Billion USD
        demographics: {
          primaryAge: '18-49',
          ethnicComposition: { 'white': 60, 'hispanic': 18, 'black': 14, 'asian': 8 },
          incomeDistribution: { 'high': 35, 'middle': 45, 'low': 20 },
          urbanRural: { 'urban': 82, 'suburban': 15, 'rural': 3 }
        },
        genrePreferences: {
          action: 1.2, comedy: 1.1, drama: 0.9, horror: 1.3, thriller: 1.0,
          romance: 0.8, scifi: 1.1, fantasy: 1.0, western: 1.2
        },
        culturalFactors: ['individualism', 'diversity', 'technology_adoption', 'fast_paced_lifestyle'],
        seasonality: {
          summer: { multiplier: 1.4, preferences: ['action', 'comedy', 'scifi'] },
          fall: { multiplier: 1.1, preferences: ['thriller', 'horror', 'drama'] },
          winter: { multiplier: 1.2, preferences: ['drama', 'romance', 'family'] },
          spring: { multiplier: 0.9, preferences: ['comedy', 'romance', 'fantasy'] }
        },
        distributionChannels: {
          theatrical: 0.45, streaming: 0.35, digital: 0.15, physical: 0.05
        },
        marketTrends: ['streaming_dominance', 'franchise_fatigue', 'diverse_representation']
      },

      europe: {
        regions: ['UK', 'Germany', 'France', 'Spain', 'Italy', 'Nordic', 'Eastern'],
        marketSize: 38.2,
        demographics: {
          primaryAge: '25-54',
          ethnicComposition: { 'white': 85, 'middle_eastern': 5, 'african': 4, 'asian': 3, 'other': 3 },
          incomeDistribution: { 'high': 42, 'middle': 48, 'low': 10 },
          urbanRural: { 'urban': 75, 'suburban': 20, 'rural': 5 }
        },
        genrePreferences: {
          action: 0.9, comedy: 1.0, drama: 1.3, horror: 0.8, thriller: 1.1,
          romance: 1.0, scifi: 0.9, fantasy: 0.9, western: 0.6
        },
        culturalFactors: ['art_house_appreciation', 'subtitles_acceptance', 'historical_consciousness'],
        seasonality: {
          summer: { multiplier: 1.0, preferences: ['comedy', 'action', 'family'] },
          fall: { multiplier: 1.2, preferences: ['drama', 'thriller', 'art_house'] },
          winter: { multiplier: 1.3, preferences: ['drama', 'romance', 'historical'] },
          spring: { multiplier: 0.8, preferences: ['comedy', 'light_drama'] }
        },
        distributionChannels: {
          theatrical: 0.55, streaming: 0.25, digital: 0.15, physical: 0.05
        },
        marketTrends: ['local_content_preference', 'festival_circuit_importance', 'art_house_revival']
      },

      asia: {
        regions: ['China', 'Japan', 'South Korea', 'India', 'Southeast Asia'],
        marketSize: 35.8,
        demographics: {
          primaryAge: '18-44',
          ethnicComposition: { 'han_chinese': 40, 'japanese': 15, 'korean': 8, 'indian': 25, 'other': 12 },
          incomeDistribution: { 'high': 25, 'middle': 35, 'low': 40 },
          urbanRural: { 'urban': 60, 'suburban': 25, 'rural': 15 }
        },
        genrePreferences: {
          action: 1.4, comedy: 1.2, drama: 1.0, horror: 0.7, thriller: 1.0,
          romance: 1.3, scifi: 1.2, fantasy: 1.1, western: 0.3
        },
        culturalFactors: ['family_values', 'honor_themes', 'collectivism', 'respect_for_elders'],
        seasonality: {
          summer: { multiplier: 1.2, preferences: ['action', 'family', 'comedy'] },
          fall: { multiplier: 0.9, preferences: ['drama', 'romance'] },
          winter: { multiplier: 1.4, preferences: ['family', 'romance', 'historical'] },
          spring: { multiplier: 1.0, preferences: ['action', 'adventure'] }
        },
        distributionChannels: {
          theatrical: 0.65, streaming: 0.20, digital: 0.10, physical: 0.05
        },
        marketTrends: ['local_language_preference', 'mobile_first_consumption', 'social_viewing']
      },

      latinAmerica: {
        regions: ['Brazil', 'Mexico', 'Argentina', 'Colombia', 'Chile', 'Peru'],
        marketSize: 12.3,
        demographics: {
          primaryAge: '18-39',
          ethnicComposition: { 'mestizo': 45, 'white': 30, 'indigenous': 15, 'black': 8, 'other': 2 },
          incomeDistribution: { 'high': 15, 'middle': 35, 'low': 50 },
          urbanRural: { 'urban': 78, 'suburban': 15, 'rural': 7 }
        },
        genrePreferences: {
          action: 1.1, comedy: 1.4, drama: 1.2, horror: 0.9, thriller: 0.8,
          romance: 1.5, scifi: 0.7, fantasy: 0.8, western: 0.6
        },
        culturalFactors: ['family_centric', 'religious_values', 'music_dance_importance', 'melodrama_appreciation'],
        seasonality: {
          summer: { multiplier: 1.1, preferences: ['comedy', 'family', 'romance'] },
          fall: { multiplier: 1.0, preferences: ['drama', 'thriller'] },
          winter: { multiplier: 1.2, preferences: ['family', 'drama', 'romance'] },
          spring: { multiplier: 0.9, preferences: ['comedy', 'action'] }
        },
        distributionChannels: {
          theatrical: 0.50, streaming: 0.30, digital: 0.15, physical: 0.05
        },
        marketTrends: ['local_stories_preference', 'family_viewing', 'music_integration']
      },

      middleEast: {
        regions: ['Saudi Arabia', 'UAE', 'Israel', 'Turkey', 'Egypt', 'Iran'],
        marketSize: 8.7,
        demographics: {
          primaryAge: '20-45',
          ethnicComposition: { 'arab': 65, 'persian': 15, 'turkish': 12, 'jewish': 5, 'other': 3 },
          incomeDistribution: { 'high': 35, 'middle': 40, 'low': 25 },
          urbanRural: { 'urban': 85, 'suburban': 12, 'rural': 3 }
        },
        genrePreferences: {
          action: 1.2, comedy: 1.1, drama: 1.3, horror: 0.5, thriller: 1.0,
          romance: 0.9, scifi: 0.8, fantasy: 1.0, western: 0.4
        },
        culturalFactors: ['religious_sensitivity', 'family_honor', 'tradition_modernity_balance'],
        seasonality: {
          summer: { multiplier: 0.8, preferences: ['family', 'comedy'] },
          fall: { multiplier: 1.1, preferences: ['drama', 'action'] },
          winter: { multiplier: 1.3, preferences: ['family', 'drama'] },
          spring: { multiplier: 1.0, preferences: ['comedy', 'romance'] }
        },
        distributionChannels: {
          theatrical: 0.60, streaming: 0.25, digital: 0.12, physical: 0.03
        },
        marketTrends: ['cultural_authenticity', 'family_friendly_content', 'regional_production']
      },

      africa: {
        regions: ['South Africa', 'Nigeria', 'Kenya', 'Morocco', 'Egypt'],
        marketSize: 4.2,
        demographics: {
          primaryAge: '16-35',
          ethnicComposition: { 'black_african': 80, 'arab': 10, 'white': 5, 'mixed': 3, 'other': 2 },
          incomeDistribution: { 'high': 10, 'middle': 25, 'low': 65 },
          urbanRural: { 'urban': 45, 'suburban': 25, 'rural': 30 }
        },
        genrePreferences: {
          action: 1.3, comedy: 1.4, drama: 1.3, horror: 0.8, thriller: 0.9,
          romance: 1.2, scifi: 0.6, fantasy: 0.7, western: 0.5
        },
        culturalFactors: ['oral_storytelling_tradition', 'community_values', 'music_dance_integral'],
        seasonality: {
          summer: { multiplier: 0.9, preferences: ['family', 'comedy'] },
          fall: { multiplier: 1.0, preferences: ['drama', 'action'] },
          winter: { multiplier: 1.2, preferences: ['family', 'drama', 'music'] },
          spring: { multiplier: 1.1, preferences: ['comedy', 'romance'] }
        },
        distributionChannels: {
          theatrical: 0.40, streaming: 0.35, digital: 0.15, physical: 0.10
        },
        marketTrends: ['local_language_content', 'mobile_consumption', 'nollywood_influence']
      }
    };
  }

  /**
   * Initialize cultural sensitivity factors
   */
  initializeCulturalFactors() {
    this.culturalSensitivities = {
      religious: {
        regions: ['middleEast', 'parts_of_africa', 'parts_of_asia'],
        restrictions: ['explicit_content', 'religious_criticism', 'alcohol_drugs'],
        adaptations: ['content_modification', 'alternative_versions', 'cultural_consulting']
      },
      political: {
        regions: ['china', 'parts_of_middleEast', 'russia'],
        restrictions: ['government_criticism', 'historical_revisionism', 'separatist_themes'],
        adaptations: ['content_review', 'political_sensitivity_check', 'local_partnerships']
      },
      social: {
        regions: ['all'],
        considerations: ['gender_roles', 'family_values', 'social_hierarchy', 'generational_gaps'],
        adaptations: ['cultural_localization', 'sensitivity_review', 'focus_groups']
      },
      language: {
        dubbing_markets: ['france', 'germany', 'spain', 'italy', 'china', 'japan'],
        subtitle_markets: ['nordics', 'netherlands', 'eastern_europe', 'parts_of_asia'],
        original_language_preference: ['uk', 'ireland', 'australia', 'new_zealand']
      }
    };
  }

  /**
   * Initialize language and localization data
   */
  initializeLanguageMarkets() {
    this.languageMarkets = {
      english: {
        native_speakers: 380000000,
        total_speakers: 1500000000,
        primary_markets: ['US', 'UK', 'Canada', 'Australia', 'New Zealand'],
        secondary_markets: ['India', 'Philippines', 'South Africa', 'Nigeria'],
        market_value: 45.2,
        content_export_strength: 0.95
      },
      mandarin: {
        native_speakers: 918000000,
        total_speakers: 1100000000,
        primary_markets: ['China', 'Taiwan', 'Singapore'],
        secondary_markets: ['Malaysia', 'overseas_chinese_communities'],
        market_value: 28.5,
        content_export_strength: 0.45
      },
      spanish: {
        native_speakers: 460000000,
        total_speakers: 500000000,
        primary_markets: ['Mexico', 'Spain', 'Argentina', 'Colombia', 'Peru'],
        secondary_markets: ['US_hispanic', 'Chile', 'Ecuador'],
        market_value: 15.8,
        content_export_strength: 0.65
      },
      hindi: {
        native_speakers: 341000000,
        total_speakers: 600000000,
        primary_markets: ['India'],
        secondary_markets: ['Nepal', 'Fiji', 'overseas_indian_communities'],
        market_value: 8.2,
        content_export_strength: 0.35
      },
      arabic: {
        native_speakers: 422000000,
        total_speakers: 450000000,
        primary_markets: ['Saudi Arabia', 'Egypt', 'UAE', 'Morocco'],
        secondary_markets: ['Algeria', 'Iraq', 'Syria', 'Jordan'],
        market_value: 6.5,
        content_export_strength: 0.40
      },
      french: {
        native_speakers: 280000000,
        total_speakers: 300000000,
        primary_markets: ['France', 'Canada_Quebec'],
        secondary_markets: ['Belgium', 'Switzerland', 'West_Africa'],
        market_value: 5.8,
        content_export_strength: 0.75
      }
    };
  }

  /**
   * Initialize distribution channels by region
   */
  initializeDistributionChannels() {
    this.distributionData = {
      theatrical: {
        strongMarkets: ['northAmerica', 'europe', 'asia', 'middleEast'],
        emergingMarkets: ['latinAmerica', 'africa'],
        keyFactors: ['cinema_infrastructure', 'disposable_income', 'cultural_habits'],
        seasonality_impact: 'high'
      },
      streaming: {
        dominantPlatforms: {
          global: ['Netflix', 'Amazon_Prime', 'Disney+'],
          regional: ['Hotstar_India', 'iQiyi_China', 'Globo_Brazil', 'OSN_MiddleEast']
        },
        growth_regions: ['latinAmerica', 'africa', 'asia'],
        mature_markets: ['northAmerica', 'europe'],
        mobile_first: ['africa', 'parts_of_asia', 'india']
      },
      digital: {
        platforms: ['iTunes', 'Google_Play', 'Vudu', 'regional_platforms'],
        strongMarkets: ['northAmerica', 'europe', 'urban_asia'],
        growth_potential: 'moderate',
        piracy_concerns: ['parts_of_asia', 'eastern_europe', 'parts_of_africa']
      }
    };
  }

  /**
   * Analyze geographic market potential for a screenplay
   */
  analyzeGeographicMarkets(screenplayAnalysis, options = {}) {
    const { targetBudget = 50000000, releaseStrategy = 'global', includeCulturalAnalysis = true } = options;

    const analysis = {
      globalPotential: this.calculateGlobalPotential(screenplayAnalysis),
      regionalAnalysis: this.analyzeRegionalMarkets(screenplayAnalysis),
      culturalSuitability: includeCulturalAnalysis ? this.analyzeCulturalSuitability(screenplayAnalysis) : null,
      languageMarkets: this.analyzeLanguageOpportunities(screenplayAnalysis),
      distributionStrategy: this.recommendDistributionStrategy(screenplayAnalysis, targetBudget),
      seasonalTiming: this.analyzeOptimalTiming(screenplayAnalysis),
      marketPenetration: this.assessMarketPenetration(screenplayAnalysis),
      revenueProjections: this.projectRegionalRevenues(screenplayAnalysis, targetBudget),
      riskAssessment: this.assessGeographicRisks(screenplayAnalysis),
      localizationNeeds: this.assessLocalizationRequirements(screenplayAnalysis),
      strategicRecommendations: [],
      metadata: {
        analysisDate: new Date().toISOString(),
        dataVersion: '2024.1',
        currency: 'USD',
        confidence: 0.78
      }
    };

    // Generate strategic recommendations
    analysis.strategicRecommendations = this.generateGeographicRecommendations(analysis);

    return analysis;
  }

  /**
   * Calculate global market potential score
   */
  calculateGlobalPotential(screenplay) {
    const genre = screenplay.genreThemeAnalysis?.genreAnalysis?.primaryGenre;
    const themes = screenplay.genreThemeAnalysis?.themeAnalysis;
    const quality = screenplay.enhancedMetrics?.qualityScores;

    let globalScore = 50; // Base score

    // Genre appeal across regions
    if (genre) {
      const genreAppeal = this.calculateGenreGlobalAppeal(genre);
      globalScore += genreAppeal * 0.3;
    }

    // Universal themes bonus
    if (this.hasUniversalThemes(themes)) {
      globalScore += 15;
    }

    // Quality factor
    if (quality?.overallQuality > 75) {
      globalScore += 10;
    }

    // Cultural barriers penalty
    if (this.hasCulturalBarriers(screenplay)) {
      globalScore -= 10;
    }

    // Language dependency
    if (this.isLanguageDependent(screenplay)) {
      globalScore -= 8;
    }

    return Math.min(100, Math.max(0, Math.round(globalScore)));
  }

  /**
   * Analyze individual regional markets
   */
  analyzeRegionalMarkets(screenplay) {
    const regionalAnalysis = {};

    Object.entries(this.regionalMarkets).forEach(([region, data]) => {
      regionalAnalysis[region] = {
        marketScore: this.calculateRegionalScore(screenplay, data),
        genreAlignment: this.assessGenreAlignment(screenplay, data.genrePreferences),
        demographicFit: this.assessDemographicFit(screenplay, data.demographics),
        culturalCompatibility: this.assessCulturalCompatibility(screenplay, data.culturalFactors),
        seasonalOptimization: this.findOptimalSeason(screenplay, data.seasonality),
        distributionChannels: this.optimizeDistribution(screenplay, data.distributionChannels),
        revenueProjection: this.projectRegionalRevenue(screenplay, data),
        marketRisks: this.identifyRegionalRisks(screenplay, data),
        opportunityRating: this.rateOpportunity(screenplay, data)
      };
    });

    return regionalAnalysis;
  }

  /**
   * Calculate regional market score
   */
  calculateRegionalScore(screenplay, regionalData) {
    const genre = screenplay.genreThemeAnalysis?.genreAnalysis?.primaryGenre;
    const quality = screenplay.enhancedMetrics?.qualityScores?.overallQuality || 50;
    
    let score = 50; // Base score

    // Genre preference alignment
    if (genre && regionalData.genrePreferences[genre]) {
      score += (regionalData.genrePreferences[genre] - 1) * 30;
    }

    // Quality bonus
    score += (quality - 50) * 0.4;

    // Market size factor
    const marketSizeBonus = Math.log(regionalData.marketSize) * 5;
    score += marketSizeBonus;

    return Math.min(100, Math.max(0, Math.round(score)));
  }

  /**
   * Analyze cultural suitability
   */
  analyzeCulturalSuitability(screenplay) {
    const themes = screenplay.genreThemeAnalysis?.themeAnalysis;
    const dialogue = screenplay.dialogueAnalysis;
    
    return {
      religiousSensitivity: this.assessReligiousSensitivity(screenplay),
      politicalSensitivity: this.assessPoliticalSensitivity(screenplay),
      socialCompatibility: this.assessSocialCompatibility(screenplay),
      languageBarriers: this.assessLanguageBarriers(screenplay),
      adaptationRequirements: this.identifyAdaptationNeeds(screenplay),
      riskLevel: this.calculateCulturalRisk(screenplay)
    };
  }

  /**
   * Recommend optimal distribution strategy
   */
  recommendDistributionStrategy(screenplay, targetBudget) {
    const globalPotential = this.calculateGlobalPotential(screenplay);
    const genre = screenplay.genreThemeAnalysis?.genreAnalysis?.primaryGenre;
    
    let strategy = {
      primaryStrategy: 'regional',
      releasePattern: 'staggered',
      platforms: [],
      timing: {},
      budgetAllocation: {}
    };

    // Determine primary strategy based on potential and budget
    if (globalPotential > 75 && targetBudget > 75000000) {
      strategy.primaryStrategy = 'global_simultaneous';
      strategy.platforms = ['theatrical', 'premium_streaming'];
    } else if (globalPotential > 60) {
      strategy.primaryStrategy = 'regional_expansion';
      strategy.platforms = ['theatrical', 'streaming'];
    } else {
      strategy.primaryStrategy = 'selective_markets';
      strategy.platforms = ['streaming', 'digital'];
    }

    return strategy;
  }

  /**
   * Generate strategic recommendations
   */
  generateGeographicRecommendations(analysis) {
    const recommendations = [];

    // Global potential recommendations
    if (analysis.globalPotential < 60) {
      recommendations.push({
        priority: 'high',
        category: 'market_focus',
        recommendation: 'Focus on 2-3 key regional markets rather than global release',
        impact: 'major'
      });
    }

    // Regional opportunity recommendations
    const topRegions = Object.entries(analysis.regionalAnalysis)
      .sort((a, b) => b[1].marketScore - a[1].marketScore)
      .slice(0, 3);

    if (topRegions.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'market_prioritization',
        recommendation: `Prioritize ${topRegions.map(r => r[0]).join(', ')} markets for maximum ROI`,
        impact: 'moderate'
      });
    }

    // Cultural adaptation recommendations
    if (analysis.culturalSuitability?.riskLevel === 'high') {
      recommendations.push({
        priority: 'high',
        category: 'localization',
        recommendation: 'Significant cultural adaptation required for key markets',
        impact: 'major'
      });
    }

    return recommendations;
  }

  // Helper methods (abbreviated for space)
  calculateGenreGlobalAppeal(genre) {
    const appealMap = {
      action: 85, comedy: 70, drama: 75, horror: 60, thriller: 80,
      romance: 65, scifi: 75, fantasy: 70, western: 45
    };
    return appealMap[genre] || 60;
  }

  hasUniversalThemes(themes) {
    const universalThemes = ['love', 'family', 'survival', 'justice', 'redemption'];
    const primaryTheme = themes?.primaryTheme;
    return universalThemes.some(theme => 
      primaryTheme?.toLowerCase().includes(theme) || theme.includes(primaryTheme?.toLowerCase())
    );
  }

  hasCulturalBarriers(screenplay) {
    // Check for culturally specific references, language dependencies, etc.
    return false; // Simplified
  }

  isLanguageDependent(screenplay) {
    // Check for wordplay, cultural references that don't translate
    return false; // Simplified
  }

  assessGenreAlignment(screenplay, preferences) { return 'high'; }
  assessDemographicFit(screenplay, demographics) { return 'good'; }
  assessCulturalCompatibility(screenplay, factors) { return 'compatible'; }
  findOptimalSeason(screenplay, seasonality) { return 'summer'; }
  optimizeDistribution(screenplay, channels) { return channels; }
  projectRegionalRevenue(screenplay, data) { return data.marketSize * 0.1; }
  identifyRegionalRisks(screenplay, data) { return []; }
  rateOpportunity(screenplay, data) { return 'moderate'; }
  
  assessReligiousSensitivity(screenplay) { return 'low'; }
  assessPoliticalSensitivity(screenplay) { return 'low'; }
  assessSocialCompatibility(screenplay) { return 'high'; }
  assessLanguageBarriers(screenplay) { return 'moderate'; }
  identifyAdaptationNeeds(screenplay) { return []; }
  calculateCulturalRisk(screenplay) { return 'low'; }
  
  analyzeLanguageOpportunities(screenplay) { return {}; }
  analyzeOptimalTiming(screenplay) { return {}; }
  assessMarketPenetration(screenplay) { return {}; }
  projectRegionalRevenues(screenplay, budget) { return {}; }
  assessGeographicRisks(screenplay) { return {}; }
  assessLocalizationRequirements(screenplay) { return {}; }
}

/**
 * Factory function for creating geographic market analyzer
 */
export function createGeographicMarketAnalyzer() {
  return new GeographicMarketAnalyzer();
}

export default GeographicMarketAnalyzer;