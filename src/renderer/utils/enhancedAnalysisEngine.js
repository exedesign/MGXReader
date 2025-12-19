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
    const { onProgress = () => { } } = options;

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

        // AI prompt for shot breakdown (Director's Cut)
        const shotPrompt = `You are a cinematic director planning coverage for this scene.
Create a concise 3-5 shot list that tells the story effectively.

SCENE:
${scene.text || scene.description || ''}

REQUIREMENTS:
- Create exactly 3-5 essential shots.
- Include at least one MASTER SHOT (Wide) to establish geography.
- Include Mediums/Over-the-Shoulders for key interactions.
- Include Close-ups for critical emotional beats or details.

OUTPUT FORMAT (JSON Array):
[
  {
    "shotNumber": "1",
    "shotType": "MASTER SHOT", 
    "cameraMovement": "STATIC",
    "lens": "24mm",
    "lighting": "NATURAL",
    "description": "Wide view of the room showing character positions.",
    "purpose": "Establish geography and mood"
  },
  {
    "shotNumber": "2",
    "shotType": "MEDIUM SHOT",
    "cameraMovement": "PAN LEFT",
    "lens": "50mm",
    "description": "Tracking [Character Name] as they cross the room.",
    "purpose": "Follow action"
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
   * HİBRİT DOĞRULAMA (Hybrid Verification)
   * Parser'ın emin olamadığı (sınırda kalan) satırlar için Gemini 1.5 Flash kontrolü
   * @param {string} line - Analiz edilecek satır
   * @param {string} context - Önceki ve sonraki 2 satır
   */
  async verifyLineType(line, context) {
    // Gemini 1.5 Flash (Hızlı ve Ucuz) kullan
    const prompt = `Analiz edilen senaryo satırı: "${line}"
Bağlam (Context):
${context}

Soru: Bu satır bir "DIALOGUE" (Diyalog) mu yoksa "ACTION" (Aksiyon/Tasvir) mi?
Sadece tek kelime cevap ver: DIALOGUE veya ACTION.`;

    try {
      // AI Handler üzerinden hızlı model çağrısı (varsa 1.5-flash)
      const result = await this.aiHandler.generateContent(prompt, {
        model: 'gemini-1.5-flash',
        temperature: 0.0
      });

      const answer = result.trim().toUpperCase();
      if (answer.includes('DIALOGUE')) return 'DIALOGUE';
      if (answer.includes('ACTION')) return 'ACTION';
      return 'UNKNOWN';
    } catch (e) {
      console.warn('Verification failed:', e);
      return 'UNKNOWN';
    }
  }
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