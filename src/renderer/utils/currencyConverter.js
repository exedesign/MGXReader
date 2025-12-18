/**
 * Currency Converter Utility
 * Fetches real-time exchange rates and converts USD to TRY/EUR
 * Uses exchangerate-api.com free tier (1500 requests/month)
 */

const EXCHANGE_RATE_API_KEY = 'free'; // Free tier doesn't require key
const CACHE_KEY = 'mgxreader_exchange_rates';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Supported currencies
 */
export const CURRENCIES = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar' },
  TRY: { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro' },
};

/**
 * Get cached exchange rates from localStorage
 * @returns {Object|null} - Cached rates or null if expired/not found
 */
function getCachedRates() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const data = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is still valid
    if (now - data.timestamp < CACHE_DURATION) {
      return data.rates;
    }
    
    // Cache expired
    return null;
  } catch (error) {
    console.warn('Failed to read cached exchange rates:', error);
    return null;
  }
}

/**
 * Save exchange rates to localStorage
 * @param {Object} rates - Exchange rates object
 */
function cacheRates(rates) {
  try {
    const data = {
      rates,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to cache exchange rates:', error);
  }
}

/**
 * Fetch latest exchange rates from API
 * @returns {Promise<Object>} - Exchange rates (USD base)
 */
async function fetchExchangeRates() {
  try {
    // Try primary API (exchangerate-api.com)
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    
    if (!response.ok) {
      throw new Error(`Exchange rate API returned ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.rates) {
      throw new Error('Invalid response from exchange rate API');
    }

    return {
      TRY: data.rates.TRY || 32.50, // Fallback to approximate rate
      EUR: data.rates.EUR || 0.92,
    };
  } catch (error) {
    console.warn('Failed to fetch exchange rates from primary API:', error);
    
    // Try backup API (api.fxratesapi.com)
    try {
      const backupResponse = await fetch('https://api.fxratesapi.com/latest?base=USD&currencies=TRY,EUR');
      const backupData = await backupResponse.json();
      
      if (backupData.rates) {
        return {
          TRY: backupData.rates.TRY || 32.50,
          EUR: backupData.rates.EUR || 0.92,
        };
      }
    } catch (backupError) {
      console.warn('Backup API also failed:', backupError);
    }

    // Ultimate fallback: Use approximate rates (as of December 2025)
    console.warn('Using fallback exchange rates');
    return {
      TRY: 32.50, // Approximate USD to TRY
      EUR: 0.92,  // Approximate USD to EUR
    };
  }
}

/**
 * Get current exchange rates (from cache or API)
 * @param {boolean} forceRefresh - Force fetch from API
 * @returns {Promise<Object>} - Exchange rates object
 */
export async function getExchangeRates(forceRefresh = false) {
  // Try cache first
  if (!forceRefresh) {
    const cached = getCachedRates();
    if (cached) {
      return cached;
    }
  }

  // Fetch fresh rates
  console.log('🌐 Fetching fresh exchange rates...');
  const rates = await fetchExchangeRates();
  
  // Cache the results
  cacheRates(rates);
  
  console.log('✅ Exchange rates updated:', rates);
  return rates;
}

/**
 * Convert USD amount to target currency
 * @param {number} usdAmount - Amount in USD
 * @param {string} targetCurrency - Target currency code (TRY, EUR, USD)
 * @returns {Promise<number>} - Converted amount
 */
export async function convertFromUSD(usdAmount, targetCurrency = 'USD') {
  if (targetCurrency === 'USD') {
    return usdAmount;
  }

  const rates = await getExchangeRates();
  const rate = rates[targetCurrency];

  if (!rate) {
    console.warn(`Unknown currency: ${targetCurrency}, defaulting to USD`);
    return usdAmount;
  }

  return usdAmount * rate;
}

/**
 * Format currency amount with proper symbol and precision
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (USD, TRY, EUR)
 * @returns {string} - Formatted currency string
 */
export function formatCurrency(amount, currency = 'USD') {
  const currencyInfo = CURRENCIES[currency] || CURRENCIES.USD;
  
  // Safety check for undefined or null
  if (amount === undefined || amount === null || isNaN(amount)) {
    return `${currencyInfo.symbol}0.00`;
  }
  
  // Determine precision based on currency and amount
  let precision;
  if (amount === 0) return `${currencyInfo.symbol}0.00`;
  
  // TRY için daha az hassasiyet (2 hane) - daha büyük değerler
  if (currency === 'TRY') {
    precision = 2;
  } else {
    // USD ve EUR için daha hassas (küçük değerler için)
    if (amount >= 0.01) precision = 4;
    else if (amount >= 0.0001) precision = 6;
    else if (amount >= 0.000001) precision = 8;
    else precision = 10;
  }

  const formatted = amount.toFixed(precision);
  
  // Add currency symbol
  if (currency === 'USD') {
    return `$${formatted}`;
  } else if (currency === 'EUR') {
    return `€${formatted}`;
  } else if (currency === 'TRY') {
    return `${formatted}₺`;
  }
  
  return `${currencyInfo.symbol}${formatted}`;
}

/**
 * Get currency preference from localStorage
 * @returns {string} - Currency code (USD, TRY, EUR)
 */
export function getSavedCurrencyPreference() {
  try {
    return localStorage.getItem('mgxreader_currency_preference') || 'USD';
  } catch (error) {
    return 'USD';
  }
}

/**
 * Save currency preference to localStorage
 * @param {string} currency - Currency code to save
 */
export function saveCurrencyPreference(currency) {
  try {
    localStorage.setItem('mgxreader_currency_preference', currency);
    
    // Dispatch custom event for currency changes
    window.dispatchEvent(new CustomEvent('currencyChanged', {
      detail: { currency }
    }));
  } catch (error) {
    console.warn('Failed to save currency preference:', error);
  }
}
