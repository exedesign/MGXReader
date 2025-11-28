/**
 * Enhanced Analysis Engine
 * Combines AI analysis with prompt-based specialized analysis
 */

import { usePromptStore } from '../store/promptStore';

export class EnhancedAnalysisEngine {
  constructor(aiHandler) {
    this.aiHandler = aiHandler;
  }

  /**
   * Enhanced Screenplay Analysis with AI Prompts
   * Uses specialized prompts for comprehensive results
   */
  async analyzeScreenplayEnhanced(text, scenes = [], characters = [], options = {}) {
    const { onProgress = () => { }, language = 'en' } = options;

    try {
      onProgress({
        step: 'start',
        progress: 0,
        message: 'Starting enhanced screenplay analysis...'
      });

      // Step 1: Basic AI Analysis (Structure, Scenes, Characters)
      onProgress({
        step: 'ai_analysis',
        progress: 10,
        message: 'Running core AI analysis...'
      });

      const aiAnalysis = await this.aiHandler.analyzeScreenplayWithChunking(text, {
        useChunking: options.useChunking,
        language: language,
        onProgress: (progressData) => {
          onProgress({
            step: 'ai_analysis',
            progress: 10 + (progressData.progress * 0.3), // 10-40%
            message: `Core Analysis: ${progressData.message}`
          });
        }
      });

      // Helper to run specialized prompt analysis
      const runSpecializedAnalysis = async (promptKey, stepName, progressStart, progressEnd) => {
        onProgress({
          step: stepName,
          progress: progressStart,
          message: `Running ${stepName} analysis...`
        });

        try {
          // Get prompt from store (accessing state directly as we're outside React component)
          const promptStore = usePromptStore.getState();
          const promptData = promptStore.getPrompt('analysis', promptKey);

          if (!promptData) {
            console.warn(`Prompt ${promptKey} not found, skipping.`);
            return {};
          }

          // Append language instruction
          const systemPrompt = `${promptData.system} Ensure the output is in ${language}.`;
          const userPrompt = `${promptData.user} (Language: ${language})`;

          const resultText = await this.aiHandler.callAI(userPrompt, systemPrompt);

          try {
            // Attempt to parse JSON
            const cleanedResult = resultText.replace(/```json\s*|\s*```/g, '').trim();
            return JSON.parse(cleanedResult);
          } catch (e) {
            console.warn(`Failed to parse JSON for ${stepName}, returning raw text wrapper`, e);
            return { rawText: resultText, error: 'JSON parse failed' };
          }
        } catch (error) {
          console.error(`${stepName} analysis failed:`, error);
          return { error: error.message };
        }
      };

      // Step 2: Genre & Theme Analysis
      const genreThemeAnalysis = await runSpecializedAnalysis('genre', 'genre_theme', 40, 50);

      // Step 3: Competitive Analysis
      const competitiveAnalysis = await runSpecializedAnalysis('competitive', 'competitive', 50, 60);

      // Step 4: Geographic Market Analysis
      const geographicAnalysis = await runSpecializedAnalysis('geographic', 'geographic', 60, 70);

      // Step 5: Trend Analysis
      const trendAnalysis = await runSpecializedAnalysis('trend', 'trends', 70, 80);

      // Step 6: Risk & Opportunity Assessment
      const riskOpportunityAnalysis = await runSpecializedAnalysis('risk', 'risk_assessment', 80, 90);

      // Step 7: Integration
      onProgress({
        step: 'integration',
        progress: 95,
        message: 'Integrating analysis results...'
      });

      const enhancedAnalysis = {
        ...aiAnalysis,
        genreThemeAnalysis,
        competitiveAnalysis,
        geographicAnalysis,
        trendAnalysis,
        riskOpportunityAnalysis,
        enhancedMetrics: {
          qualityScores: {
            overallQuality: competitiveAnalysis.competitiveScore || 75, // Fallback
            structure: 80, // Placeholder or derived
            dialogue: 80   // Placeholder or derived
          },
          marketAnalysis: {
            genre: genreThemeAnalysis.genreAnalysis?.primaryGenre || 'Unknown',
            marketPotential: competitiveAnalysis.marketPosition?.potential?.shortTerm || 'Medium'
          }
        },
        metadata: {
          analysisVersion: '3.0-ai-prompts',
          analysisDate: new Date().toISOString(),
          language: language
        }
      };

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
}

/**
 * Factory function for creating enhanced analysis engine
 */
export function createEnhancedAnalysisEngine(aiHandler) {
  return new EnhancedAnalysisEngine(aiHandler);
}

export default EnhancedAnalysisEngine;