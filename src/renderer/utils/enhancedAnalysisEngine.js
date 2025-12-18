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
   * Generate Hollywood-standard shot list from scenes
   * Each scene is broken down into 5-10 shots with technical specifications
   */
  async generateShotList(scenes, options = {}) {
    const { onProgress = () => {} } = options;
    
    try {
      onProgress({ progress: 0, message: 'Analyzing scenes for shot breakdown...' });
      
      const shotListByScene = [];
      const totalScenes = Math.min(scenes.length, 20); // Limit to first 20 scenes to avoid token overflow
      
      for (let i = 0; i < totalScenes; i++) {
        const scene = scenes[i];
        onProgress({
          progress: (i / totalScenes) * 100,
          message: `Generating shots for Scene ${i + 1}/${totalScenes}...`
        });
        
        // AI prompt for shot breakdown
        const shotPrompt = `As a professional cinematographer and director, break down this scene into 5-10 individual shots.

SCENE:
${scene.text || scene.description || ''}

For each shot, provide:
1. Shot Number (e.g., 1A, 1B, 1C...)
2. Shot Type: (ESTABLISHING, WIDE, MEDIUM, CLOSE-UP, EXTREME CLOSE-UP, OVER THE SHOULDER, POV, INSERT, etc.)
3. Camera Movement: (STATIC, PAN, TILT, DOLLY, TRACK, CRANE, STEADICAM, HANDHELD, etc.)
4. Lens: (WIDE 24mm, NORMAL 35mm, PORTRAIT 50mm, TELEPHOTO 85mm+, etc.)
5. Lighting: (NATURAL, HIGH KEY, LOW KEY, MOTIVATED, PRACTICAL, etc.)
6. Duration: (Estimated seconds)
7. Description: (What we see in this specific shot)
8. Purpose: (Story purpose - establish location, reveal emotion, show action, etc.)

Format your response as JSON array:
[
  {
    "shotNumber": "1A",
    "shotType": "ESTABLISHING SHOT",
    "cameraMovement": "CRANE DOWN",
    "lens": "24mm WIDE",
    "lighting": "NATURAL - GOLDEN HOUR",
    "duration": 8,
    "description": "Aerial view of the city skyline at sunset, camera cranes down to street level",
    "purpose": "Establish location and time of day"
  }
]`;

        try {
          const response = await this.aiHandler.generateContent(shotPrompt);
          const jsonMatch = response.match(/\[[\s\S]*\]/);
          
          if (jsonMatch) {
            const shots = JSON.parse(jsonMatch[0]);
            shotListByScene.push({
              sceneNumber: i + 1,
              sceneHeading: scene.heading || `Scene ${i + 1}`,
              location: scene.location || 'Unknown',
              timeOfDay: scene.timeOfDay || 'Unknown',
              intExt: scene.intExt || 'Unknown',
              shots: shots,
              totalShots: shots.length
            });
          }
        } catch (error) {
          console.error(`Failed to generate shots for scene ${i + 1}:`, error);
          // Continue with next scene on error
        }
      }
      
      onProgress({ progress: 100, message: 'Shot list generation complete!' });
      
      return {
        totalScenes: totalScenes,
        scenesProcessed: shotListByScene.length,
        totalShots: shotListByScene.reduce((sum, scene) => sum + scene.totalShots, 0),
        shotListByScene: shotListByScene,
        metadata: {
          generatedAt: new Date().toISOString(),
          cinematographyStandard: 'Hollywood',
          version: '1.0'
        }
      };
      
    } catch (error) {
      console.error('Shot list generation failed:', error);
      throw error;
    }
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
      // Step 6: Shot List Generation (if scenes are available)
      let shotListAnalysis = null;
      if (scenes && scenes.length > 0 && options.generateShotList) {
        shotListAnalysis = await this.generateShotList(scenes, {
          onProgress: (progressData) => {
            onProgress({
              step: 'shot_list',
              progress: 90 + (progressData.progress * 0.05), // 90-95%
              message: progressData.message
            });
          }
        });
      }

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
        shotListAnalysis, // NEW: Hollywood-standard shot breakdowns
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
          analysisVersion: '4.0-ai-prompts-shots',
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