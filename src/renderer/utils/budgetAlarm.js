/**
 * Budget Alarm System for Token Usage
 * Allows users to set spending limits and receive warnings
 */

/**
 * Get budget settings from localStorage
 * @returns {Object} Budget settings
 */
export function getBudgetSettings() {
  const saved = localStorage.getItem('mgxreader_budget_settings');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse budget settings:', e);
    }
  }
  
  return {
    enabled: false,
    dailyLimit: 1.00,      // USD
    weeklyLimit: 5.00,     // USD
    monthlyLimit: 20.00,   // USD
    warningThreshold: 80,  // Percentage
    lastResetDate: new Date().toISOString(),
    previousDebt: 0,       // USD - Önceki API borcunuz
    debtSetDate: null,     // Borç girildiği tarih
    balanceLimit: 0        // USD - Opsiyonel maksimum harcama limiti
  };
}

/**
 * Save budget settings to localStorage
 * @param {Object} settings - Budget settings
 */
export function saveBudgetSettings(settings) {
  localStorage.setItem('mgxreader_budget_settings', JSON.stringify(settings));
  window.dispatchEvent(new Event('storage'));
}

/**
 * Check if budget limit is exceeded
 * @param {Object} tokenUsage - Current token usage data
 * @returns {Object} Warning information
 */
export function checkBudgetLimits(tokenUsage) {
  const settings = getBudgetSettings();
  
  if (!settings.enabled) {
    return { exceeded: false, warnings: [] };
  }
  
  const warnings = [];
  const { totalCost } = tokenUsage;
  
  // Calculate usage periods
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const weekStart = getWeekStart(now);
  const monthStart = getMonthStart(now);
  
  // Get period usage from localStorage
  const periodUsage = getPeriodUsage();
  
  // Daily limit check
  const dailyUsage = periodUsage[today] || 0;
  const dailyPercent = (dailyUsage / settings.dailyLimit) * 100;
  
  if (dailyPercent >= settings.warningThreshold) {
    warnings.push({
      type: 'daily',
      current: dailyUsage,
      limit: settings.dailyLimit,
      percent: dailyPercent,
      exceeded: dailyPercent >= 100
    });
  }
  
  // Weekly limit check
  const weeklyUsage = calculateWeeklyUsage(periodUsage, weekStart);
  const weeklyPercent = (weeklyUsage / settings.weeklyLimit) * 100;
  
  if (weeklyPercent >= settings.warningThreshold) {
    warnings.push({
      type: 'weekly',
      current: weeklyUsage,
      limit: settings.weeklyLimit,
      percent: weeklyPercent,
      exceeded: weeklyPercent >= 100
    });
  }
  
  // Monthly limit check
  const monthlyUsage = calculateMonthlyUsage(periodUsage, monthStart);
  const monthlyPercent = (monthlyUsage / settings.monthlyLimit) * 100;
  
  if (monthlyPercent >= settings.warningThreshold) {
    warnings.push({
      type: 'monthly',
      current: monthlyUsage,
      limit: settings.monthlyLimit,
      percent: monthlyPercent,
      exceeded: monthlyPercent >= 100
    });
  }
  
  // Balance limit check (total accumulated cost: previous debt + program usage)
  if (settings.balanceLimit && settings.balanceLimit > 0) {
    const totalAccumulatedCost = settings.previousDebt + totalCost;
    const balancePercent = (totalAccumulatedCost / settings.balanceLimit) * 100;
    
    if (balancePercent >= settings.warningThreshold) {
      warnings.push({
        type: 'balance',
        current: totalAccumulatedCost,
        limit: settings.balanceLimit,
        percent: balancePercent,
        exceeded: balancePercent >= 100
      });
    }
  }
  
  return {
    exceeded: warnings.some(w => w.exceeded),
    warnings: warnings
  };
}

/**
 * Track spending per period
 * @param {number} cost - Cost to add (USD)
 */
export function trackPeriodSpending(cost) {
  const today = new Date().toISOString().split('T')[0];
  const periodUsage = getPeriodUsage();
  
  periodUsage[today] = (periodUsage[today] || 0) + cost;
  
  localStorage.setItem('mgxreader_period_usage', JSON.stringify(periodUsage));
}

/**
 * Get period usage data from localStorage
 * @returns {Object} Period usage data
 */
function getPeriodUsage() {
  const saved = localStorage.getItem('mgxreader_period_usage');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse period usage:', e);
    }
  }
  return {};
}

/**
 * Get week start date (Monday)
 * @param {Date} date - Current date
 * @returns {string} ISO date string
 */
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

/**
 * Get month start date
 * @param {Date} date - Current date
 * @returns {string} ISO date string
 */
function getMonthStart(date) {
  const d = new Date(date);
  d.setDate(1);
  return d.toISOString().split('T')[0];
}

/**
 * Calculate weekly usage
 * @param {Object} periodUsage - Period usage data
 * @param {string} weekStart - Week start date
 * @returns {number} Total weekly usage
 */
function calculateWeeklyUsage(periodUsage, weekStart) {
  const weekStartDate = new Date(weekStart);
  let total = 0;
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStartDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    total += periodUsage[dateStr] || 0;
  }
  
  return total;
}

/**
 * Calculate monthly usage
 * @param {Object} periodUsage - Period usage data
 * @param {string} monthStart - Month start date
 * @returns {number} Total monthly usage
 */
function calculateMonthlyUsage(periodUsage, monthStart) {
  const monthStartDate = new Date(monthStart);
  const nextMonth = new Date(monthStartDate);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  
  let total = 0;
  const currentDate = new Date(monthStartDate);
  
  while (currentDate < nextMonth && currentDate <= new Date()) {
    const dateStr = currentDate.toISOString().split('T')[0];
    total += periodUsage[dateStr] || 0;
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return total;
}

/**
 * Get total accumulated cost (previous debt + program usage)
 * @returns {number} Total cost in USD
 */
export function getTotalAccumulatedCost() {
  const settings = getBudgetSettings();
  const tokenUsage = JSON.parse(localStorage.getItem('mgxreader_token_usage') || '{"totalCost": 0}');
  
  return settings.previousDebt + tokenUsage.totalCost;
}

/**
 * Reset period usage (for testing or manual reset)
 */
export function resetPeriodUsage() {
  localStorage.removeItem('mgxreader_period_usage');
  console.log('🗑️ Period usage reset');
}
