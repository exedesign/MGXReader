/**
 * AI Service - Wrapper around AIHandler with store integration
 */

import { AIHandler, SCREENPLAY_PROMPTS } from './aiHandler';
import { useAIStore } from '../store/aiStore';

/**
 * Get configured AI handler instance
 */
export function getAIHandler() {
  const config = useAIStore.getState().getCurrentConfig();
  
  if (!config) {
    throw new Error('AI provider not configured. Please configure in Settings.');
  }
  
  return new AIHandler(config);
}

/**
 * Correct grammar in screenplay text
 */
export async function correctScreenplayText(text) {
  const handler = getAIHandler();
  const { system, buildUserPrompt } = SCREENPLAY_PROMPTS.GRAMMAR_CORRECTION;
  
  try {
    const correctedText = await handler.generateText(
      system,
      buildUserPrompt(text),
      { maxTokens: 8000 }
    );
    
    return {
      success: true,
      text: correctedText,
    };
  } catch (error) {
    console.error('Grammar correction failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Analyze screenplay for production breakdown
 */
export async function analyzeScreenplay(text) {
  const handler = getAIHandler();
  const { system, buildUserPrompt } = SCREENPLAY_PROMPTS.SCENE_ANALYSIS;
  
  try {
    const response = await handler.generateText(
      system,
      buildUserPrompt(text),
      { maxTokens: 8000 }
    );
    
    // Parse JSON response
    const cleanedResponse = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const analysisData = JSON.parse(cleanedResponse);
    
    return {
      success: true,
      data: analysisData,
    };
  } catch (error) {
    console.error('Screenplay analysis failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Test AI connection
 */
export async function testAIConnection() {
  try {
    const handler = getAIHandler();
    return await handler.testConnection();
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export default {
  getAIHandler,
  correctScreenplayText,
  analyzeScreenplay,
  testAIConnection,
};
