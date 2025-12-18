/**
 * Token Estimation Utility for Gemini API
 * Provides accurate token count estimation before API calls
 * Supports Turkish and English text with different multipliers
 */

/**
 * Estimates token count for given text
 * Uses word-based calculation with language-specific multipliers
 * 
 * @param {string} text - Text to estimate tokens for
 * @returns {number} Estimated token count
 */
export function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  
  const trimmedText = text.trim();
  if (trimmedText.length === 0) return 0;
  
  // Calculate basic metrics
  const chars = trimmedText.length;
  const words = trimmedText.split(/\s+/).length;
  
  // Detect Turkish content using character frequency
  // Turkish has unique characters: ğ, ü, ş, ı, ö, ç (and uppercase variants)
  const turkishChars = (trimmedText.match(/[ğüşıöçĞÜŞİÖÇ]/g) || []).length;
  const turkishRatio = chars > 0 ? turkishChars / chars : 0;
  const isTurkish = turkishRatio > 0.02; // If >2% Turkish chars, consider it Turkish
  
  // Base token calculation
  // English: ~1.3 tokens per word (avg word length ~4.5 chars)
  // Turkish: ~1.5 tokens per word (more complex morphology, agglutination)
  const wordMultiplier = isTurkish ? 1.5 : 1.3;
  let estimatedTokens = Math.ceil(words * wordMultiplier);
  
  // JSON/structured content adds overhead
  const hasJsonStructure = trimmedText.includes('{') || trimmedText.includes('[');
  if (hasJsonStructure) {
    estimatedTokens = Math.ceil(estimatedTokens * 1.15);
  }
  
  // Code blocks and markdown formatting add overhead
  const hasCodeBlocks = trimmedText.includes('```') || trimmedText.includes('`');
  if (hasCodeBlocks) {
    estimatedTokens = Math.ceil(estimatedTokens * 1.1);
  }
  
  return estimatedTokens;
}

/**
 * Gets accurate token count using Gemini API's countTokens endpoint
 * Falls back to estimation if API call fails
 * 
 * @param {string} text - Text to count tokens for
 * @param {string} model - Gemini model name (e.g., 'gemini-2.5-flash')
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<number>} Accurate token count
 */
export async function getAccurateTokenCount(text, model, apiKey) {
  if (!text || !model || !apiKey) {
    return estimateTokens(text);
  }
  
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:countTokens?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text }
            ]
          }
        ]
      })
    });
    
    if (!response.ok) {
      console.warn(`Token count API failed with status ${response.status}, using estimation`);
      return estimateTokens(text);
    }
    
    const data = await response.json();
    return data.totalTokens || estimateTokens(text);
    
  } catch (error) {
    console.warn('Token count API error, using estimation:', error.message);
    return estimateTokens(text);
  }
}

/**
 * Estimates tokens for multiple text segments
 * Useful for prompt + system + user text estimation
 * 
 * @param {string[]} textSegments - Array of text segments
 * @returns {number} Total estimated tokens
 */
export function estimateMultipleSegments(textSegments) {
  if (!Array.isArray(textSegments)) return 0;
  
  return textSegments.reduce((total, segment) => {
    return total + estimateTokens(segment);
  }, 0);
}

/**
 * Estimates output tokens based on analysis type
 * Different analysis types produce different output lengths
 * 
 * @param {string} analysisType - Type of analysis
 * @param {number} inputTokens - Estimated input tokens (for context)
 * @returns {number} Estimated output tokens
 */
export function estimateOutputTokens(analysisType, inputTokens = 0) {
  // Conservative estimates based on analysis complexity
  const outputEstimates = {
    'character_analysis': 2500,
    'structure_analysis': 2000,
    'dialogue_analysis': 2200,
    'scene_analysis': 1800,
    'theme_analysis': 2000,
    'pacing_analysis': 1500,
    'visual_analysis': 1800,
    'conflict_analysis': 1600,
    'emotional_arc_analysis': 1900,
    'world_building_analysis': 2100,
    'default': 2000
  };
  
  return outputEstimates[analysisType] || outputEstimates.default;
}

/**
 * Calculates token estimation accuracy by comparing estimate vs actual
 * Used for improving estimation algorithm over time
 * 
 * @param {number} estimatedTokens - Estimated token count
 * @param {number} actualTokens - Actual token count from API response
 * @returns {Object} Accuracy metrics
 */
export function calculateEstimationAccuracy(estimatedTokens, actualTokens) {
  if (!actualTokens || actualTokens === 0) {
    return { accuracy: 0, error: 0, errorPercent: 0 };
  }
  
  const error = Math.abs(estimatedTokens - actualTokens);
  const errorPercent = (error / actualTokens) * 100;
  const accuracy = Math.max(0, 100 - errorPercent);
  
  return {
    accuracy: Math.round(accuracy * 100) / 100,
    error,
    errorPercent: Math.round(errorPercent * 100) / 100,
    overestimated: estimatedTokens > actualTokens
  };
}

/**
 * Stores estimation accuracy data for learning
 * 
 * @param {Object} accuracyData - Accuracy metrics to store
 */
export function storeEstimationAccuracy(accuracyData) {
  try {
    const existing = localStorage.getItem('mgxreader_token_estimation_accuracy');
    const history = existing ? JSON.parse(existing) : [];
    
    history.push({
      ...accuracyData,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 100 entries
    if (history.length > 100) {
      history.shift();
    }
    
    localStorage.setItem('mgxreader_token_estimation_accuracy', JSON.stringify(history));
  } catch (error) {
    console.warn('Failed to store estimation accuracy:', error);
  }
}

/**
 * Gets average estimation accuracy from historical data
 * 
 * @returns {Object} Average accuracy metrics
 */
export function getAverageAccuracy() {
  try {
    const existing = localStorage.getItem('mgxreader_token_estimation_accuracy');
    if (!existing) return null;
    
    const history = JSON.parse(existing);
    if (history.length === 0) return null;
    
    const avgAccuracy = history.reduce((sum, entry) => sum + entry.accuracy, 0) / history.length;
    const avgError = history.reduce((sum, entry) => sum + entry.errorPercent, 0) / history.length;
    
    return {
      averageAccuracy: Math.round(avgAccuracy * 100) / 100,
      averageErrorPercent: Math.round(avgError * 100) / 100,
      sampleSize: history.length
    };
  } catch (error) {
    console.warn('Failed to get average accuracy:', error);
    return null;
  }
}
