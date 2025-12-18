/**
 * Token Usage Tracker
 * Centralized utility for tracking token and image generation costs
 */

import { trackPeriodSpending, checkBudgetLimits } from './budgetAlarm.js';

/**
 * Update token usage in localStorage
 * @param {Object} params - Update parameters
 * @param {Object} params.cost - Cost information from API response
 * @param {Object} params.usage - Usage metadata from API response
 * @param {string} params.model - Model name used
 * @param {string} params.analysisType - Type of analysis or operation
 * @param {number} params.estimatedTokens - Estimated tokens (for text generation)
 */
export function updateTokenUsage({ cost, usage, model, analysisType = 'image_generation', estimatedTokens = 0 }) {
  // Get current token usage from localStorage
  const saved = localStorage.getItem('mgxreader_token_usage');
  let tokenUsage = {
    totalTokens: 0,
    totalCost: 0,
    estimatedTokens: 0,
    byModel: {},
    byAnalysisType: {},
    requestCount: 0,
    accuracy: []
  };

  if (saved) {
    try {
      tokenUsage = JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse saved token usage:', e);
    }
  }

  // Calculate actual tokens (or use imageCount for images)
  const actualTokens = usage?.totalTokenCount || usage?.imageCount || 0;
  const costAmount = cost?.total || 0;

  // Update totals
  tokenUsage.totalTokens += actualTokens;
  tokenUsage.totalCost += costAmount;
  tokenUsage.estimatedTokens += estimatedTokens;
  tokenUsage.requestCount += 1;

  // Update by model
  if (!tokenUsage.byModel[model]) {
    tokenUsage.byModel[model] = { tokens: 0, cost: 0, requests: 0 };
  }
  tokenUsage.byModel[model].tokens += actualTokens;
  tokenUsage.byModel[model].cost += costAmount;
  tokenUsage.byModel[model].requests += 1;

  // Update by analysis type
  if (!tokenUsage.byAnalysisType[analysisType]) {
    tokenUsage.byAnalysisType[analysisType] = { tokens: 0, cost: 0 };
  }
  tokenUsage.byAnalysisType[analysisType].tokens += actualTokens;
  tokenUsage.byAnalysisType[analysisType].cost += costAmount;

  // Update accuracy (only for text generation with estimates)
  if (estimatedTokens > 0 && actualTokens > 0) {
    tokenUsage.accuracy.push({
      estimated: estimatedTokens,
      actual: actualTokens
    });
    
    // Keep only last 100 accuracy records
    if (tokenUsage.accuracy.length > 100) {
      tokenUsage.accuracy = tokenUsage.accuracy.slice(-100);
    }
  }

  // Save to localStorage
  localStorage.setItem('mgxreader_token_usage', JSON.stringify(tokenUsage));
  
  // Track period spending for budget alarms
  if (costAmount > 0) {
    trackPeriodSpending(costAmount);
    
    // Check budget limits and show warning if needed
    const budgetCheck = checkBudgetLimits(tokenUsage);
    if (budgetCheck.warnings.length > 0) {
      // Dispatch custom event for budget warnings
      window.dispatchEvent(new CustomEvent('budgetWarning', { 
        detail: budgetCheck 
      }));
    }
  }
  
  // Trigger storage event for UI updates
  window.dispatchEvent(new Event('storage'));
  
  // Dispatch custom event for same-tab token usage updates
  window.dispatchEvent(new CustomEvent('tokenUsageUpdated', {
    detail: tokenUsage
  }));

  console.log('📊 Token usage updated:', {
    model,
    analysisType,
    tokens: actualTokens,
    cost: `$${costAmount.toFixed(6)}`,
    totalCost: `$${tokenUsage.totalCost.toFixed(6)}`
  });

  return tokenUsage;
}

/**
 * Reset token usage statistics
 */
export function resetTokenUsage() {
  localStorage.removeItem('mgxreader_token_usage');
  window.dispatchEvent(new Event('storage'));
  console.log('🗑️ Token usage statistics reset');
}

/**
 * Get current token usage statistics
 * @returns {Object} - Token usage data
 */
export function getTokenUsage() {
  const saved = localStorage.getItem('mgxreader_token_usage');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse saved token usage:', e);
    }
  }
  
  return {
    totalTokens: 0,
    totalCost: 0,
    estimatedTokens: 0,
    byModel: {},
    byAnalysisType: {},
    requestCount: 0,
    accuracy: []
  };
}

/**
 * Export token usage data as JSON
 * @returns {string} - JSON string of token usage
 */
export function exportTokenUsage() {
  const usage = getTokenUsage();
  return JSON.stringify(usage, null, 2);
}

/**
 * Import token usage data from JSON
 * @param {string} jsonData - JSON string to import
 * @returns {boolean} - Success status
 */
export function importTokenUsage(jsonData) {
  try {
    const data = JSON.parse(jsonData);
    
    // Validate structure
    if (!data.totalTokens && data.totalTokens !== 0) {
      throw new Error('Invalid token usage data structure');
    }
    
    localStorage.setItem('mgxreader_token_usage', JSON.stringify(data));
    window.dispatchEvent(new Event('storage'));
    console.log('✅ Token usage data imported successfully');
    return true;
  } catch (e) {
    console.error('❌ Failed to import token usage data:', e);
    return false;
  }
}
