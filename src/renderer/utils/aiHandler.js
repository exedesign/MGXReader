/**
 * AIHandler - Unified AI Gateway
 * Supports: OpenAI, Google Gemini, Local AI (Ollama/LM Studio)
 */

import axios from 'axios';
import { createEnhancedAnalysisEngine } from './enhancedAnalysisEngine.js';
import useAssetStore from '../store/assetStore.js';

// Set global axios timeout to prevent default 18s timeout
axios.defaults.timeout = 300000; // 5 minutes

/**
 * Gemini Context Caching System
 * Caches screenplay text to reduce token costs and API quota usage
 * TTL: 1 hour (3600 seconds)
 */
class GeminiContextCache {
  constructor() {
    this.caches = new Map(); // scriptHash -> { cacheId, ttl, createdAt }
  }

  /**
   * Create a cached content entry for screenplay text
   * @param {string} apiKey - Gemini API key
   * @param {string} model - Model name
   * @param {string} scriptText - Full screenplay text
   * @param {string} scriptHash - Unique hash for the script
   * @returns {Promise<string>} - Cache ID
   */
  async createCache(apiKey, model, scriptText, scriptHash) {
    // Check if cache already exists
    const existing = this.caches.get(scriptHash);
    if (existing && (Date.now() - existing.createdAt < existing.ttl * 1000)) {
      console.log('✅ Reusing existing cache:', existing.cacheId);
      return existing.cacheId;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/cachedContents`;

    const requestBody = {
      model: `models/${model}`,
      contents: [{
        role: 'user',
        parts: [{
          text: `Bu bir senaryo metnidir. Aşağıdaki analizlerde bu metni referans al:\n\n${scriptText}`
        }]
      }],
      systemInstruction: {
        parts: [{
          text: 'Sen profesyonel bir senaryo analiz uzmanısın. Verilen senaryo metnini derinlemesine analiz ediyorsun.'
        }]
      },
      ttl: '3600s', // 1 hour cache
      displayName: `screenplay_${scriptHash.substring(0, 8)}`
    };

    try {
      console.log('🔄 Creating Gemini context cache...');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Cache creation failed: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const cacheId = data.name; // Format: "cachedContents/abc123"

      // Store cache metadata
      this.caches.set(scriptHash, {
        cacheId: cacheId,
        ttl: 3600,
        createdAt: Date.now(),
        model: model
      });

      console.log('✅ Context cache created:', cacheId);
      return cacheId;

    } catch (error) {
      console.error('❌ Cache creation error:', error.message);
      // Fallback: continue without cache
      return null;
    }
  }

  /**
   * Get cache ID for a script
   */
  getCacheId(scriptHash) {
    const cache = this.caches.get(scriptHash);
    if (cache && (Date.now() - cache.createdAt < cache.ttl * 1000)) {
      return cache.cacheId;
    }
    return null;
  }

  /**
   * Clear expired caches
   */
  clearExpired() {
    const now = Date.now();
    for (const [hash, cache] of this.caches.entries()) {
      if (now - cache.createdAt >= cache.ttl * 1000) {
        this.caches.delete(hash);
        console.log('🗑️ Expired cache cleared:', hash);
      }
    }
  }
}

export const AI_PROVIDERS = {
  OPENAI: 'openai',
  GEMINI: 'gemini',
  LOCAL: 'local',
  MLX: 'mlx',
};

export const OPENAI_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, recommended: true },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', contextWindow: 128000 },
  { id: 'gpt-4', name: 'GPT-4', contextWindow: 8192 },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', contextWindow: 16385 },
];

export const GEMINI_MODELS = [
  // Gemini 3 Series - EN AKILLI MODELLER
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview 🌟', contextWindow: 2000000, maxOutput: 8192, description: 'En akıllı model - Çok formatlı anlama konusunda dünyanın en iyisi', recommended: true, stable: false, preview: true },

  // Gemini 2.5 Series - HIZLI VE AKILLI (Kararlı Sürümler)
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash ⚡', contextWindow: 1000000, maxOutput: 8192, fast: true, description: 'Fiyat-performans açısından en iyi - Hızlı ve çok yönlü', stable: true },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite 🚀', contextWindow: 1000000, maxOutput: 8192, fast: true, description: 'Ultra hızlı - Maliyet verimliliği için optimize edilmiş', stable: true },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro 🧠', contextWindow: 2000000, maxOutput: 8192, description: 'Gelişmiş düşünme - Kod, matematik ve STEM problemleri için', stable: true },

  // Gemini 2.0 Series - İKİNCİ NESİL (Kararlı Sürümler)
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1000000, maxOutput: 8192, fast: true, description: 'İkinci nesil çalışkan model', stable: true },
  { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash-Lite', contextWindow: 1000000, maxOutput: 8192, fast: true, description: 'İkinci nesil küçük ve güçlü model', stable: true },

  // Gemini 1.5 Series - BİRİNCİ NESİL (Kararlı Sürümler)
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 2000000, maxOutput: 8192, description: 'Kararlı ve güçlü model', stable: true },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1000000, maxOutput: 8192, fast: true, description: 'Hızlı ve ekonomik', stable: true },
];

// Image Generation Models - Verified Available (https://ai.google.dev/gemini-api/docs/image-generation)
export const GEMINI_IMAGE_MODELS = [
  // Gemini Native Image Generation - v1beta API uyumlu (ACTIVE)
  { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image Preview 🍌 Pro', description: 'Profesyonel görsel üretim - 14 referans görsel, 4K çözünürlük, Google Search', recommended: true, maxReferenceImages: 14, maxResolution: '4K', features: ['google_search', 'thinking_mode', 'multi_turn'], stable: false, preview: true },
  { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image 🍌', description: 'Hızlı ve verimli görsel üretim - 3 referans görsel, 1K çözünürlük', fast: true, maxReferenceImages: 3, maxResolution: '1K', stable: true },

  // Imagen 4.0 Series - DEPRECATED (API tarafından desteklenmiyor - v1beta endpoint'i mevcut değil)
  { id: 'imagen-4.0-generate-001', name: 'Imagen 4.0 Standard ⚠️ Deprecated', description: 'API tarafından desteklenmiyor - Gemini modelleri kullanın', deprecated: true, disabled: true },
  { id: 'imagen-4.0-fast-generate-001', name: 'Imagen 4.0 Fast ⚠️ Deprecated', description: 'API tarafından desteklenmiyor - Gemini modelleri kullanın', deprecated: true, disabled: true },
  { id: 'imagen-4.0-ultra-generate-001', name: 'Imagen 4.0 Ultra ⚠️ Deprecated', description: 'API tarafından desteklenmiyor - Gemini modelleri kullanın', deprecated: true, disabled: true },

  // Imagen 3.0 Series - LEGACY (Sınırlı destek - generateImages endpoint kullanıyor)
  { id: 'imagen-3.0-generate-001', name: 'Imagen 3.0 ⚠️ Legacy', description: 'Eski nesil model - Yeni projeler için Gemini önerilir', deprecated: true, legacy: true },
];

// Image Understanding Models - Verified Available (https://ai.google.dev/gemini-api/docs/vision)
export const GEMINI_IMAGE_UNDERSTANDING_MODELS = [
  // Gemini 3 Series - EN AKILLI (v1beta API)
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview 🌟', description: 'En akıllı çok formatlı model - Görsel açıklama, sınıflandırma, soru-yanıt', recommended: true, features: ['caption', 'classification', 'vqa', 'ocr'], stable: false, preview: true },

  // Gemini 2.5 Series (v1beta API - Kararlı)
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash ⚡', description: 'Hızlı görsel anlama - 3600 görsel/istek', fast: true, maxImages: 3600, features: ['segmentation', 'object_detection'], stable: true },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro 🧠', description: 'Gelişmiş görsel analiz - Segmentasyon ve nesne algılama', features: ['segmentation', 'object_detection', 'spatial_understanding'], maxImages: 3600, stable: true },

  // Gemini 2.0 Series (v1beta API - Kararlı)
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Gelişmiş nesne algılama - İkinci nesil', features: ['object_detection'], maxImages: 3600, stable: true },

  // Gemini 1.5 Series (v1beta API - Kararlı)
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Kararlı çok formatlı model', stable: true, maxImages: 3600 },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Hızlı ve ekonomik görsel anlama', fast: true, stable: true, maxImages: 3600 },
];

/**
 * Gemini API Fiyatlandırma (Aralık 2025)
 * Kaynak: https://ai.google.dev/pricing
 * Fiyatlar: USD per 1M tokens
 */
/**
 * Gemini API Fiyatlandırma (Aralık 2025)
 * Kaynak: https://ai.google.dev/gemini-api/docs/pricing?hl=tr
 * Tüm fiyatlar USD / 1M token cinsinden
 * Güncelleme: 15 Aralık 2025
 */
export const GEMINI_PRICING = {
  // Gemini 2.5 Serisi
  'gemini-2.5-pro': { input: 1.25, output: 10.00, cached: 0.125 },
  'gemini-2.5-flash': { input: 0.30, output: 2.50, cached: 0.03 },
  'gemini-2.5-flash-preview-09-2025': { input: 0.30, output: 2.50, cached: 0.03 },
  'gemini-2.5-flash-lite': { input: 0.10, output: 0.40, cached: 0.01 },
  'gemini-2.5-flash-lite-preview-09-2025': { input: 0.10, output: 0.40, cached: 0.01 },

  // Gemini 2.0 Serisi
  'gemini-2.0-flash': { input: 0.10, output: 0.40, cached: 0.025 },
  'gemini-2.0-flash-lite': { input: 0.075, output: 0.30, cached: 0 },
  'gemini-2.0-flash-exp': { input: 0, output: 0, cached: 0 }, // Free experimental

  // Gemini 1.5 Serisi (Legacy)
  'gemini-1.5-pro': { input: 1.25, output: 10.00, cached: 0.125 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30, cached: 0.01875 },
  'gemini-1.5-flash-8b': { input: 0.0375, output: 0.15, cached: 0.009375 },

  // Gemini 3 Serisi (Preview)
  'gemini-3-pro-preview': { input: 2.00, output: 12.00, cached: 0.20 },
  'gemini-pro': { input: 0.50, output: 1.50, cached: 0.125 },

  // Image Generation Models (per image, not per token)
  'gemini-3-pro-image-preview': { perImage: 0.134 },
  'gemini-2.5-flash-image': { perImage: 0.039 },
  'imagen-3.0-generate-002': { perImage: 0.03 },
  'imagen-4.0-fast-generate-001': { perImage: 0.02 },
  'imagen-4.0-generate-001': { perImage: 0.04 },
  'imagen-4.0-ultra-generate-001': { perImage: 0.06 },
};

/**
 * Calculate cost for Gemini API usage
 * @param {string} model - Model ID
 * @param {Object} usage - Usage metadata from API
 * @param {number} usage.promptTokenCount - Input tokens
 * @param {number} usage.candidatesTokenCount - Output tokens  
 * @param {number} usage.cachedContentTokenCount - Cached tokens
 * @returns {Object} - Cost breakdown
 */
export function calculateGeminiCost(model, usage) {
  const pricing = GEMINI_PRICING[model];
  if (!pricing) {
    return { total: 0, breakdown: { error: 'Unknown model pricing' } };
  }

  // Image generation models
  if (pricing.perImage) {
    return {
      total: pricing.perImage,
      breakdown: {
        perImage: pricing.perImage,
        currency: 'USD'
      }
    };
  }

  // Text generation models
  const inputTokens = usage.promptTokenCount || 0;
  const outputTokens = usage.candidatesTokenCount || 0;
  const cachedTokens = usage.cachedContentTokenCount || 0;

  const inputCost = (inputTokens / 1000000) * pricing.input;
  const outputCost = (outputTokens / 1000000) * pricing.output;
  const cachedCost = (cachedTokens / 1000000) * pricing.cached;

  return {
    total: inputCost + outputCost + cachedCost,
    breakdown: {
      input: inputCost,
      output: outputCost,
      cached: cachedCost,
      currency: 'USD'
    },
    tokens: {
      input: inputTokens,
      output: outputTokens,
      cached: cachedTokens,
      total: inputTokens + outputTokens + cachedTokens
    }
  };
}

// OpenAI Pricing (USD per image)
export const OPENAI_PRICING = {
  'dall-e-3': {
    standard: { '1024x1024': 0.040, '1024x1792': 0.080, '1792x1024': 0.080 },
    hd: { '1024x1024': 0.080, '1024x1792': 0.120, '1792x1024': 0.120 }
  },
  'dall-e-2': {
    standard: { '256x256': 0.016, '512x512': 0.018, '1024x1024': 0.020 }
  }
};

/**
 * Calculate cost for OpenAI DALL-E usage
 * @param {string} model - Model ID (dall-e-3, dall-e-2)
 * @param {string} size - Image size (1024x1024, etc.)
 * @param {string} quality - Quality level (standard, hd)
 * @returns {Object} - Cost breakdown
 */
export function calculateOpenAICost(model, size = '1024x1024', quality = 'standard') {
  const pricing = OPENAI_PRICING[model];
  if (!pricing) {
    return { total: 0, breakdown: { error: 'Unknown model pricing' } };
  }

  let cost = 0;
  if (model === 'dall-e-3') {
    cost = pricing[quality]?.[size] || pricing.standard['1024x1024'];
  } else if (model === 'dall-e-2') {
    cost = pricing.standard[size] || pricing.standard['1024x1024'];
  }

  return {
    total: cost,
    breakdown: {
      perImage: cost,
      size: size,
      quality: quality,
      currency: 'USD'
    }
  };
}

// OpenAI image models for comparison
export const OPENAI_IMAGE_MODELS = [
  { id: 'dall-e-3', name: 'DALL-E 3', recommended: true, description: 'OpenAI en gelismis gorsel modeli' },
  { id: 'dall-e-2', name: 'DALL-E 2', description: 'Onceki nesil DALL-E modeli' },
];

// MLX Local Models
export const MLX_MODELS = [
  { id: 'mlx-community/Llama-3.2-3B-Instruct-4bit', name: 'Llama 3.2 3B (4-bit)', contextWindow: 8192, recommended: true },
  { id: 'mlx-community/Llama-3.1-8B-Instruct-4bit', name: 'Llama 3.1 8B (4-bit)', contextWindow: 16384 },
  { id: 'mlx-community/Qwen2.5-7B-Instruct-4bit', name: 'Qwen 2.5 7B (4-bit)', contextWindow: 32768 },
];

class AIHandler {
  constructor(config = {}) {
    this.provider = config.provider || AI_PROVIDERS.OPENAI;
    this.openaiApiKey = config.openaiApiKey || '';
    // Handle both apiKey and geminiApiKey for backward compatibility
    this.apiKey = config.apiKey || config.geminiApiKey || '';
    this.model = config.model || (config.provider === AI_PROVIDERS.GEMINI ? 'gemini-3-pro-preview' : 'gpt-4o');

    // CRITICAL: Use provider-specific image model from config
    // This MUST match the model selected in AI Settings
    if (config.provider === AI_PROVIDERS.GEMINI) {
      this.geminiImageModel = config.imageModel || 'gemini-2.5-flash-image';
      this.imageModel = this.geminiImageModel; // Alias for compatibility
      console.log('🎯 AIHandler initialized with Gemini image model:', this.geminiImageModel);
    } else if (config.provider === AI_PROVIDERS.OPENAI) {
      this.openaiImageModel = config.imageModel || 'dall-e-3';
      this.imageModel = this.openaiImageModel; // Alias for compatibility
      console.log('🎯 AIHandler initialized with OpenAI image model:', this.openaiImageModel);
    } else {
      this.imageModel = config.imageModel || 'dall-e-3';
    }
    this.localEndpoint = config.localEndpoint || 'http://localhost:11434';
    this.localModel = config.localModel || 'llama3';
    this.temperature = config.temperature || 0.3;
    // Token limiti yok - AI isteği kadar uzun çıktı üretebilir

    // API Rate Limiting - son istek zamanını takip et
    this.lastApiCall = 0;
    this.minDelayBetweenCalls = 1000; // 1 saniye minimum bekleme
    this.requestQueue = [];
    this.isProcessingQueue = false;

    // Context Cache System for Gemini
    this.contextCache = new GeminiContextCache();
  }

  // Rate limiting helper - API çağrıları arasında minimum bekleme süresi
  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastApiCall;

    if (timeSinceLastCall < this.minDelayBetweenCalls) {
      const waitTime = this.minDelayBetweenCalls - timeSinceLastCall;
      console.log(`⏳ Rate limit koruması: ${waitTime}ms bekleniyor...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastApiCall = Date.now();
  }

  async generateText(systemPrompt, userPrompt, options = {}) {
    // Rate limiting kontrolü
    await this.waitForRateLimit();

    const temperature = options.temperature || this.temperature;
    const includeMetadata = options.includeMetadata || false;

    try {
      let result;
      switch (this.provider) {
        case AI_PROVIDERS.OPENAI:
          if (!this.openaiApiKey) {
            throw new Error('OpenAI API key is required');
          }
          const openaiResult = await this.callOpenAI(systemPrompt, userPrompt, temperature);
          result = typeof openaiResult === 'string'
            ? { text: openaiResult, usage: null, model: this.model, provider: this.provider }
            : openaiResult;
          break;

        case AI_PROVIDERS.GEMINI:
          if (!this.apiKey) {
            throw new Error('Gemini API key is required');
          }
          const geminiResult = await this.callGemini(systemPrompt, userPrompt, temperature);
          result = geminiResult; // Already returns { text, usage, model }

          // Calculate cost if usage metadata exists
          if (result.usage && result.usage.promptTokenCount) {
            result.cost = calculateGeminiCost(result.model, result.usage);
          }
          break;

        case AI_PROVIDERS.LOCAL:
          const localResult = await this.callLocalAI(systemPrompt, userPrompt, temperature);
          result = typeof localResult === 'string'
            ? { text: localResult, usage: null, model: this.model, provider: this.provider }
            : localResult;
          break;

        default:
          throw new Error('Unsupported AI provider: ' + this.provider);
      }

      // Backward compatibility: return text only unless includeMetadata is true
      return includeMetadata ? result : result.text;
    } catch (error) {
      console.error('AI Generation Error:', error);
      throw error;
    }
  }

  /**
   * DEPRECATED: mergePartialResults - Chunking kaldırıldı
   */
  mergePartialResults(results) {
    // Artık chunking yok, direkt döndür
    return results;
  }

  async generateImage(prompt, options = {}) {
    // Rate limiting kontrolü
    await this.waitForRateLimit();

    // Validate prompt parameter
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Prompt must be a valid string for image generation');
    }

    console.log('Image generation request:', { provider: this.provider, prompt: prompt.substring(0, 50) });

    try {
      // Handle character-specific image generation with Consistency
      if (options.character) {
        console.log('🎭 Character image generation for:', options.character);
        const assets = useAssetStore.getState().characterAssets;
        const anchor = assets[options.character];

        if (anchor && anchor.anchorImage) {
          console.log('🔗 Found Anchor Image for', options.character);
          // If no manual reference provided, use the anchor
          if (!options.referenceImages) {
            options.referenceImages = [{
              inlineData: {
                data: anchor.anchorImage,
                mimeType: 'image/jpeg'
              }
            }];
          }
          // Add physical traits to prompt if available
          if (anchor.physicalTraits) {
            // prompt += ` (Character traits: ${anchor.physicalTraits})`;
          }
        }
      }

      // Handle Location Consistency
      if (options.location) {
        const locAssets = useAssetStore.getState().locationAssets;
        const locMaster = locAssets[options.location];
        if (locMaster && locMaster.masterShot && !options.referenceImages) {
          console.log('🔗 Found Master Shot for Location:', options.location);
          options.referenceImages = [{
            inlineData: {
              data: locMaster.masterShot,
              mimeType: 'image/jpeg'
            }
          }];
        }
      }

      // Handle reference image for "similar character" approach
      let enhancedPrompt = prompt;

      // Enforce Technical Prompts (Cinematic Style)
      // Only add if not already present
      if (!enhancedPrompt.toLowerCase().includes('cinematic')) {
        enhancedPrompt = `Cinematic shot, ${enhancedPrompt}`;
      }
      if (!enhancedPrompt.toLowerCase().includes('lens')) {
        enhancedPrompt += `, 35mm lens, f/1.8, professional lighting, 8k resolution`;
      }

      if (options.referenceImage) {
        console.log('🖼️ Reference image provided (Manual override)');
        enhancedPrompt = prompt + ', use reference image as style guide';
      }

      switch (this.provider) {
        case AI_PROVIDERS.OPENAI:
          const { size = '1024x1024', quality = 'standard', style = 'natural', model = 'dall-e-3' } = options;
          return await this.generateImageOpenAI(enhancedPrompt, { size, quality, style, model });

        case AI_PROVIDERS.GEMINI:
          try {
            return await this.generateImageGemini(enhancedPrompt, options);
          } catch (error) {
            console.error('Gemini image generation failed:', error);
            throw error;
          }

        default:
          throw new Error('Image generation not supported for provider: ' + this.provider);
      }
    } catch (error) {
      console.error('Image Generation Error:', error);
      throw error;
    }
  }

  async analyzeImageGemini(imageData, prompt = "Bu görseli detaylı bir şekilde analiz et ve açıkla.", options = {}) {
    console.log('Gemini Vision Analysis:', {
      hasGeminiKey: !!this.apiKey,
      imageSize: imageData?.length || 0,
      prompt: prompt.substring(0, 100)
    });

    if (!this.apiKey) {
      throw new Error('Gemini API key gerekli. Lütfen ayarlardan API key ekleyin.');
    }

    // Use Gemini 2.5 Flash for vision analysis (fast and accurate)
    const model = options.model || 'gemini-2.5-flash';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    // Strip data URL prefix if present
    const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;

    const requestBody = {
      contents: [{
        parts: [
          {
            text: prompt
          },
          {
            inlineData: {
              mimeType: options.mimeType || 'image/jpeg',
              data: base64Data
            }
          }
        ]
      }],
      generationConfig: {
        temperature: options.temperature || 0.7
        // maxOutputTokens yok - sınırsız çıktı
      }
    };

    try {
      console.log('🔍 Calling Gemini Vision API...');

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(options.timeout || 60000) // 1 minute timeout
      });

      console.log('API Response Status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP ${response.status}: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      console.log('API Response received');
      console.log('🔍 Full API Response:', JSON.stringify(data, null, 2));

      // Gemini API yanıt yapısını parse et
      if (data.candidates && data.candidates.length > 0) {
        const candidate = data.candidates[0];

        // Yöntem 1: content.parts yapısı
        if (candidate.content && candidate.content.parts) {
          const textParts = candidate.content.parts.filter(part => part.text);
          if (textParts.length > 0) {
            const analysisText = textParts.map(part => part.text).join('\n');
            console.log('✅ Analysis extracted from content.parts');
            return {
              success: true,
              analysis: analysisText,
              provider: 'gemini',
              model: model,
              analyzedAt: new Date().toISOString()
            };
          }
        }

        // Yöntem 2: Doğrudan text alanı
        if (candidate.text) {
          console.log('✅ Analysis extracted from candidate.text');
          return {
            success: true,
            analysis: candidate.text,
            provider: 'gemini',
            model: model,
            analyzedAt: new Date().toISOString()
          };
        }

        // Yöntem 3: output alanı
        if (candidate.output) {
          console.log('✅ Analysis extracted from candidate.output');
          return {
            success: true,
            analysis: candidate.output,
            provider: 'gemini',
            model: model,
            analyzedAt: new Date().toISOString()
          };
        }
      }

      console.error('❌ Unexpected response structure:', JSON.stringify(data, null, 2));
      throw new Error('API\'den geçerli analiz yanıtı alınamadı. Lütfen konsol loglarını kontrol edin.');
    } catch (error) {
      console.error('Image Analysis Error:', error.message);

      if (error.message?.includes('timeout')) {
        throw new Error('Analiz zaman aşımına uğradı. Lütfen tekrar deneyin.');
      } else if (error.message?.includes('403') || error.message?.includes('401')) {
        throw new Error('API anahtarı geçersiz veya yetki yok.');
      }

      throw new Error('Görsel analizi başarısız: ' + error.message);
    }
  }

  async generateImageGemini(prompt, options = {}) {
    if (!this.apiKey) {
      throw new Error('Gemini API key gerekli. Lutfen ayarlardan API key ekleyin.');
    }

    // CRITICAL: ONLY use model from constructor (which comes from store)
    // Never allow options.model to override the store-selected model
    const model = this.geminiImageModel || 'gemini-2.5-flash-image';

    if (options.model && options.model !== model) {
      console.warn('⚠️ IGNORED model override attempt:', options.model, '→ Using store model:', model);
    }

    console.log('🎯 Gemini Image Generation with STORE model:', {
      prompt: prompt.substring(0, 100) + '...',
      hasGeminiKey: !!this.apiKey,
      storeModel: model,
      ignoredOptionsModel: options.model || 'none'
    });

    // Updated API endpoint format for Gemini Native and Imagen models
    let apiUrl, requestBody;

    // Check if it's a Gemini Native Image model (uses generateContent)
    if (model.includes('gemini') && model.includes('image')) {
      // Gemini Native Image Generation - uses generateContent API
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

      // Model-specific capabilities based on AI Settings selection
      let modelCapabilities = {
        maxReferenceImages: 3,  // Default for Flash models
        supportedSizes: ['1K'], // Default
        defaultTemperature: 1.0
      };

      // Configure based on selected model
      if (model === 'gemini-3-pro-image-preview') {
        modelCapabilities = {
          maxReferenceImages: 14,  // Pro supports more references
          supportedSizes: ['1K', '2K', '4K'], // Pro supports larger sizes
          defaultTemperature: 1.0
        };
        console.log('🎨 Using Gemini 3 Pro Image: 14 refs, up to 4K resolution');
      } else if (model === 'gemini-2.5-flash-image') {
        modelCapabilities = {
          maxReferenceImages: 3,
          supportedSizes: ['1K'], // Flash limited to 1K
          defaultTemperature: 1.0
        };
        console.log('⚡ Using Gemini 2.5 Flash Image: 3 refs, 1K resolution, faster generation');
      }

      // Validate and adjust image size based on model capabilities
      let requestedSize = options.imageSize || "1K";
      if (!modelCapabilities.supportedSizes.includes(requestedSize)) {
        console.warn(`⚠️ ${model} doesn't support ${requestedSize}, using 1K instead`);
        requestedSize = "1K";
      }

      // Validate temperature (0.0 - 2.0 for image generation)
      let temperature = options.temperature || modelCapabilities.defaultTemperature;
      if (temperature < 0.0 || temperature > 2.0) {
        console.warn(`⚠️ Temperature ${temperature} out of range, clamping to 0.0-2.0`);
        temperature = Math.max(0.0, Math.min(2.0, temperature));
      }

      // Base configuration for all Gemini image models
      const generationConfig = {
        temperature: temperature
      };

      // Add image config if needed
      const imageConfig = {
        aspectRatio: "1:1",  // Default aspect ratio
        imageSize: requestedSize
      };

      requestBody = {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          ...generationConfig,
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: imageConfig
        }
      };

      // Add reference images if provided (respecting model limits)
      if (options.referenceImages && Array.isArray(options.referenceImages)) {
        const imageCount = Math.min(options.referenceImages.length, modelCapabilities.maxReferenceImages);

        if (options.referenceImages.length > modelCapabilities.maxReferenceImages) {
          console.warn(`⚠️ ${model} supports max ${modelCapabilities.maxReferenceImages} references, using first ${imageCount}`);
        }

        for (let i = 0; i < imageCount; i++) {
          const refImage = options.referenceImages[i];
          requestBody.contents[0].parts.push({
            inlineData: {
              mimeType: refImage.mimeType || 'image/jpeg',
              data: refImage.data
            }
          });
        }
        console.log(`🖼️ Added ${imageCount}/${modelCapabilities.maxReferenceImages} reference images to ${model}`);
      }
    } else {
      // Imagen 4.0 API (v1beta) - uses generateImages (DEPRECATED - API tarafından desteklenmiyor)
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateImages?key=${this.apiKey}`;
      requestBody = {
        prompt: prompt,
        config: {
          numberOfImages: options.numberOfImages || 1,
          imageSize: options.imageSize || "1K",
          personGeneration: "allow_adult"
        }
      };
    }

    try {
      console.log('📤 API Request:', {
        url: apiUrl.replace(this.apiKey, '***'),
        model: model,
        prompt: (typeof prompt === 'string' ? prompt.substring(0, 100) : String(prompt).substring(0, 100)) + '...',
        requestSize: JSON.stringify(requestBody).length
      });

      // Log full request body for debugging
      console.log('📦 Full Request Body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(options.timeout || 600000) // 10 minutes default timeout for image generation
      });

      console.log('📥 API Response Status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ API Error Response:', JSON.stringify(errorData, null, 2));
        throw new Error(`HTTP ${response.status}: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      console.log('API Response Data Keys:', Object.keys(data || {}));

      // Handle ALL Gemini native image generation models (gemini-3-pro-image, gemini-2.5-flash-image, etc.)
      if (model.includes('gemini') && model.includes('image')) {
        if (data.candidates && data.candidates.length > 0) {
          const candidate = data.candidates[0];
          if (candidate.content && candidate.content.parts) {
            // Find image parts - API uses both inline_data and inlineData formats
            const imageParts = candidate.content.parts.filter(part =>
              part.inline_data || part.inlineData
            );

            if (imageParts.length > 0) {
              const imagePart = imageParts[0];
              // Support both camelCase and snake_case formats
              const imageData = imagePart.inline_data || imagePart.inlineData;

              console.log(`✅ ${model}: ${imageParts.length} görsel oluşturuldu`);
              // Calculate cost for image generation
              const cost = calculateGeminiCost(model, { imageCount: 1 });
              console.log(`💰 Image generation cost: $${cost.total.toFixed(6)} USD (${model})`);

              return {
                success: true,
                imageData: imageData.data,
                mimeType: imageData.mimeType || imageData.mime_type || 'image/jpeg',
                provider: 'gemini',
                model: model,
                originalPrompt: prompt,
                generatedAt: new Date().toISOString(),
                totalImages: imageParts.length,
                cost: cost,
                usage: { imageCount: 1, model: model }
              };
            }
          }
        }
      }
      // Handle Imagen 4.0 response (legacy format)
      else if (model.includes('imagen')) {
        if (data.generated_images && data.generated_images.length > 0) {
          const generatedImage = data.generated_images[0];

          // Calculate cost for image generation
          const cost = calculateGeminiCost(model, { imageCount: 1 });
          console.log(`✅ ${model}: Görsel oluşturuldu - Cost: $${cost.total.toFixed(6)} USD`);

          return {
            success: true,
            imageData: generatedImage.image,
            mimeType: generatedImage.mime_type || 'image/jpeg',
            provider: 'gemini',
            model: model,
            originalPrompt: prompt,
            generatedAt: new Date().toISOString(),
            cost: cost,
            usage: { imageCount: 1, model: model }
          };
        }
      }

      console.error('❌ API yanıtı beklenmeyen formatta:', JSON.stringify(data, null, 2));
      throw new Error('API\'den geçerli görsel yanıtı alınamadı');
    } catch (error) {
      console.error('Image Generation Error:', {
        message: error.message,
        model: model,
      });

      // Hata türlerini kontrol et
      if (error.message?.includes('404')) {
        throw new Error(`Model bulunamadı: ${model}. Model adını kontrol edin.`);
      } else if (error.message?.includes('403') || error.message?.includes('401')) {
        throw new Error('API anahtarı geçersiz veya yetki yok. API anahtarınızı kontrol edin.');
      } else if (error.message?.includes('400')) {
        throw new Error('API isteği geçersiz: ' + error.message);
      } else if (error.message?.includes('timeout')) {
        throw new Error('İstek zaman aşımına uğradı. Lütfen tekrar deneyin.');
      }

      // Gemini Internal Fallback (Imagen 4.0/Gemini 3 -> Imagen 3.0)
      if ((model.includes('imagen-4.0') || model.includes('gemini-3')) &&
        (error.message?.includes('404') || error.message?.includes('400') || error.message?.includes('503') || error.message?.includes('overloaded')) &&
        model !== 'imagen-3.0-generate-001') {
        console.log(`⚠️ ${model} failed, falling back to stable Imagen 3.0...`);
        try {
          return await this.generateImageGemini(prompt, {
            ...options,
            model: 'imagen-3.0-generate-001',
            thinkingLevel: undefined // Imagen 3 doesn't support thinking_level
          });
        } catch (fallbackError) {
          console.log('❌ Imagen 3.0 fallback also failed:', fallbackError.message);
          // Allow execution to continue to OpenAI fallback
        }
      }

      // OpenAI DALL-E fallback
      if (this.openaiApiKey) {
        console.log('🔄 OpenAI DALL-E fallback aktif...');
        try {
          const result = await this.generateImageOpenAI(prompt, {
            model: 'dall-e-3',
            size: options.size || '1024x1024',
            quality: options.quality || 'standard',
            style: options.style || 'natural'
          });

          return {
            ...result,
            provider: 'openai-fallback',
            note: 'Gemini gorsel uretimi basarisiz, OpenAI DALL-E kullanildi'
          };
        } catch (openaiError) {
          throw new Error('Gorsel uretimi basarisiz: ' + openaiError.message);
        }
      }

      throw new Error('Gemini Image API hatasi: ' + error.message);
    }
  }

  async generateImageOpenAI(prompt, options = {}) {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key is required for image generation');
    }

    const { model = 'dall-e-3', size = '1024x1024', quality = 'standard', style = 'natural' } = options;

    console.log(`🎨 OpenAI Image Generation with ${model}:`, {
      prompt: prompt.substring(0, 100) + '...',
      size, quality, style
    });

    const maxRetries = 3;
    const baseDelay = 3000; // 3 saniye başlangıç bekleme süresi (image generation için daha uzun)

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 OpenAI Image ${model} - Deneme ${attempt}/${maxRetries}`);

        const response = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + this.openaiApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            prompt: prompt,
            size: size,
            quality: quality,
            style: style,
            n: 1,
          }),
          signal: AbortSignal.timeout(300000) // 5 dakika timeout
        });

        if (!response.ok) {
          const errorData = await response.text();
          const statusCode = response.status;

          if (statusCode === 429) {
            console.log(`⚠️ OpenAI Image API Rate limit (429) - deneme ${attempt}/${maxRetries}`);

            // Son deneme ise hata fırlat
            if (attempt === maxRetries) {
              throw new Error(`OpenAI Image API rate limit aşıldı. Birkaç dakika bekleyip tekrar deneyin. Status: ${statusCode}`);
            }

            // Exponential backoff ile bekleme
            const delay = baseDelay * Math.pow(2, attempt - 1);
            console.log(`⏳ OpenAI Image rate limit için ${delay}ms bekleniyor...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          } else {
            // Rate limit değilse direkt hata fırlat
            throw new Error(`OpenAI Image API Error: HTTP ${statusCode}: ${errorData}`);
          }
        }

        const data = await response.json();
        console.log(`✅ OpenAI Image ${model} başarılı!`);

        if (data && data.data && data.data.length > 0) {
          const imageData = data.data[0];

          // Calculate cost for OpenAI image generation
          const cost = calculateOpenAICost(model, size, quality);
          console.log(`💰 OpenAI image generation cost: $${cost.total.toFixed(6)} USD (${model}, ${size}, ${quality})`);
          return {
            success: true,
            imageUrl: imageData.url,
            provider: 'openai',
            model: model,
            revisedPrompt: imageData.revised_prompt || prompt,
            originalPrompt: prompt,
            generatedAt: new Date().toISOString(),
            cost: cost,
            usage: { imageCount: 1, model: model, size: size, quality: quality }
          };
        }

        throw new Error('No image data received from OpenAI');

      } catch (error) {
        console.log(`❌ OpenAI Image ${model} deneme ${attempt} başarısız:`, error.message);

        // Network error veya 429/rate limit hatasını kontrol et
        const isRateLimit = error.message.includes('429') ||
          error.message.includes('Too Many Requests') ||
          error.message.includes('rate limit') ||
          (error.name === 'TypeError' && error.message.includes('fetch'));

        if (!isRateLimit) {
          // Rate limit değilse hemen fırlat
          throw error;
        }

        // Son deneme ise hata fırlat
        if (attempt === maxRetries) {
          throw new Error(`OpenAI Image API: Maksimum deneme sayısına ulaşıldı. ${error.message}`);
        }

        // Exponential backoff ile bekleme
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`⏳ OpenAI Image retry için ${delay}ms bekleniyor...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async callOpenAI(systemPrompt, userPrompt, temperature) {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key is required');
    }

    // API key debug bilgisi
    const keyPrefix = this.openaiApiKey.substring(0, 10);
    const keySuffix = this.openaiApiKey.substring(this.openaiApiKey.length - 5);
    console.log(`🔑 Using OpenAI API key: ${keyPrefix}...${keySuffix} (length: ${this.openaiApiKey.length})`);
    console.log(`🎯 Using OpenAI model: ${this.model}`);

    const maxRetries = 3;
    const baseDelay = 2000; // 2 saniye başlangıç bekleme süresi

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 OpenAI ${this.model} - Deneme ${attempt}/${maxRetries}`);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + this.openaiApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: temperature
            // max_tokens kaldırıldı - sınırsız çıktı
          }),
          signal: AbortSignal.timeout(300000) // 5 dakika timeout
        });

        if (!response.ok) {
          const errorData = await response.text();
          const statusCode = response.status;

          if (statusCode === 429) {
            console.log(`⚠️ OpenAI Rate limit (429) - deneme ${attempt}/${maxRetries}`);

            // Son deneme ise hata fırlat
            if (attempt === maxRetries) {
              throw new Error(`OpenAI API rate limit aşıldı. Birkaç dakika bekleyip tekrar deneyin. Status: ${statusCode}`);
            }

            // Exponential backoff ile bekleme
            const delay = baseDelay * Math.pow(2, attempt - 1);
            console.log(`⏳ OpenAI rate limit için ${delay}ms bekleniyor...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue; // Bir sonraki deneme için loop'a devam et
          } else {
            // Rate limit değilse direkt hata fırlat
            throw new Error(`OpenAI API Error: HTTP ${statusCode}: ${errorData}`);
          }
        }

        const data = await response.json();
        console.log(`✅ OpenAI ${this.model} başarılı!`);
        return data.choices[0].message.content;

      } catch (error) {
        console.log(`❌ OpenAI ${this.model} deneme ${attempt} başarısız:`, error.message);

        // Network error veya 429/rate limit hatasını kontrol et
        const isRateLimit = error.message.includes('429') ||
          error.message.includes('Too Many Requests') ||
          error.message.includes('rate limit') ||
          (error.name === 'TypeError' && error.message.includes('fetch'));

        if (!isRateLimit) {
          // Rate limit değilse hemen fırlat
          throw error;
        }

        // Son deneme ise hata fırlat
        if (attempt === maxRetries) {
          throw new Error(`OpenAI API: Maksimum deneme sayısına ulaşıldı. ${error.message}`);
        }

        // Exponential backoff ile bekleme
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`⏳ OpenAI retry için ${delay}ms bekleniyor...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Call Gemini API with optional context cache support
   * @param {string} systemPrompt - System instruction
   * @param {string} userPrompt - User prompt
   * @param {number} temperature - Temperature setting
   * @param {string|null} cacheId - Optional cache ID for context caching
   * @returns {Promise<string>} - Generated text
   */
  async callGeminiWithCache(systemPrompt, userPrompt, temperature, cacheId = null) {
    if (!this.apiKey) {
      throw new Error('Google API key is required');
    }

    const selectedModel = this.model;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${this.apiKey}`;

    console.log('Gemini API Debug:', {
      model: selectedModel,
      systemPromptLength: systemPrompt ? systemPrompt.length : 0,
      userPromptLength: userPrompt ? userPrompt.length : 0,
      usingCache: !!cacheId
    });

    const requestBody = {
      // Cache kullanıldığında sadece userPrompt gönder (systemPrompt cache'de)
      // Cache yoksa hem systemPrompt hem userPrompt gönder
      contents: [{
        role: 'user',
        parts: [{
          text: cacheId
            ? userPrompt  // Cache varsa sadece user prompt
            : (systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt)  // Cache yoksa full prompt
        }]
      }],
      generationConfig: {
        temperature: temperature || 0.7,
        // maxOutputTokens kaldırıldı - sınırsız çıktı
        topP: 0.95,
        topK: 40,
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_LOW_AND_ABOVE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_LOW_AND_ABOVE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_LOW_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_LOW_AND_ABOVE" }
      ]
    };

    // Add cache reference if available
    if (cacheId) {
      requestBody.cachedContent = cacheId;
      console.log('✅ Using cached content:', cacheId, '- Sadece user prompt gönderiliyor (system prompt cache\'de)');
    }

    try {
      const result = await this.makeGeminiRequestWithRetry(apiUrl, requestBody, selectedModel);
      console.log(`✅ ${selectedModel} başarılı!`);
      return result;
    } catch (error) {
      console.error('❌ Cached request failed:', error.message);
      throw error;
    }
  }

  async callGemini(systemPrompt, userPrompt, temperature) {
    // Use callGeminiWithCache without cache for backwards compatibility
    return this.callGeminiWithCache(systemPrompt, userPrompt, temperature, null, null);
  }

  async makeGeminiRequestWithRetry(apiUrl, requestBodyOrSystemPrompt, userPromptOrModelName, temperatureOrUndefined, maxTokensOrUndefined, modelNameOrUndefined) {
    // Support both old signature (6 params) and new signature (3 params with requestBody)
    let requestBody, modelName;

    if (typeof requestBodyOrSystemPrompt === 'object') {
      // New signature: (apiUrl, requestBody, modelName)
      requestBody = requestBodyOrSystemPrompt;
      modelName = userPromptOrModelName;
    } else {
      // Old signature: (apiUrl, systemPrompt, userPrompt, temperature, maxTokens, modelName)
      const systemPrompt = requestBodyOrSystemPrompt;
      const userPrompt = userPromptOrModelName;
      const temperature = temperatureOrUndefined;
      modelName = modelNameOrUndefined;

      requestBody = {
        contents: [{
          role: 'user',
          parts: [{ text: systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt }]
        }],
        generationConfig: {
          temperature: temperature || 0.7,
          // maxOutputTokens kaldırıldı - sınırsız çıktı
          topP: 0.95,
          topK: 40,
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_LOW_AND_ABOVE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_LOW_AND_ABOVE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_LOW_AND_ABOVE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_LOW_AND_ABOVE" }
        ]
      };
    }
    const maxRetries = 3; // 5'ten 3'e düşürdüm
    const baseDelay = 5000; // 3s'den 5s'ye çıkardım

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 ${modelName} - Deneme ${attempt}/${maxRetries}`);
        return await this.makeGeminiRequest(apiUrl, requestBody);
      } catch (error) {
        console.log(`❌ ${modelName} deneme ${attempt} başarısız:`, error.message);

        // Quota veya rate limit hatalarını tespit et
        const isQuotaError = error.message?.includes('quota') ||
          error.message?.includes('429') ||
          error.message?.includes('508') ||
          error.message?.includes('Too Many Requests');

        // Son deneme ise hata fırlat
        if (attempt === maxRetries) {
          if (isQuotaError) {
            throw new Error(`🚫 Gemini API rate limit aşıldı. Lütfen 30 saniye bekleyip tekrar deneyin.\n\nDetay: ${error.message}`);
          }
          throw error;
        }

        // Quota hatalarında çok daha uzun bekleme
        let delay;
        if (isQuotaError) {
          delay = baseDelay * (3 + attempt) * 3; // 24s, 36s, 48s gibi uzun süreler
          console.log(`🔄 [${modelName}] Rate limit koruması - ${Math.round(delay / 1000)}s bekleniyor... (${attempt}/${maxRetries})`);
        } else {
          // Normal exponential backoff
          delay = baseDelay * Math.pow(2, attempt - 1);
          console.log(`⏳ [${modelName}] Yeniden deneme - ${Math.round(delay / 1000)}s bekleniyor... (${attempt}/${maxRetries})`);
        }

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async makeGeminiRequest(apiUrl, requestBodyOrSystemPrompt, userPromptOrUndefined, temperatureOrUndefined, maxTokensOrUndefined) {
    // Support both old signature and new signature with requestBody
    let requestBody;

    if (typeof requestBodyOrSystemPrompt === 'object') {
      // New signature: requestBody is passed directly
      requestBody = requestBodyOrSystemPrompt;
    } else {
      // Old signature: build requestBody from individual params
      const systemPrompt = requestBodyOrSystemPrompt;
      const userPrompt = userPromptOrUndefined;
      const temperature = temperatureOrUndefined;

      requestBody = {
        contents: [{
          role: 'user',
          parts: [{ text: systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt }]
        }],
        generationConfig: {
          temperature: temperature || 0.7,
          // maxOutputTokens kaldırıldı - sınırsız çıktı
          topP: 0.95,
          topK: 40,
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_LOW_AND_ABOVE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_LOW_AND_ABOVE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_LOW_AND_ABOVE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_LOW_AND_ABOVE" }
        ]
      };
    }

    // Direct API call using fetch for better browser compatibility
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 dakika timeout

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Özel hata mesajları
        let errorMessage = `HTTP ${response.status}: ${errorData.error?.message || response.statusText}`;

        if (response.status === 429) {
          errorMessage = `🔄 Rate limit koruması aktif - İstekler yavaşlatılıyor. Normal bir durumdur.`;
        } else if (response.status === 508) {
          errorMessage = `⏰ Gemini API günlük limitine ulaşıldı. Lütfen yarın tekrar deneyin.`;
        } else if (errorData.error?.message?.includes('quota')) {
          errorMessage = `⚠️ API quota limitine ulaşıldı. Daha az sıklıkla istek gönderin.`;
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data.candidates && data.candidates.length > 0) {
        const candidate = data.candidates[0];

        // Check if response was blocked
        if (candidate.finishReason === 'SAFETY') {
          throw new Error('Yanıt Gemini güvenlik filtreleri tarafından engellendi. Lütfen isteğinizi yeniden ifade edin.');
        }

        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          // Extract usage metadata
          const usageMetadata = data.usageMetadata || {};
          const textResponse = candidate.content.parts[0].text;

          // Calculate cost
          let calculatedCost = null;
          if (usageMetadata.promptTokenCount) {
            calculatedCost = calculateGeminiCost(this.model, usageMetadata);
            console.log(`✅ Gemini başarılı! Model: ${this.model}`);
            console.log(`📊 Token Kullanımı:`, {
              input: usageMetadata.promptTokenCount,
              output: usageMetadata.candidatesTokenCount,
              cached: usageMetadata.cachedContentTokenCount || 0,
              total: usageMetadata.totalTokenCount
            });
            console.log(`💰 Maliyet: $${calculatedCost.total.toFixed(6)} USD`);
          }

          return {
            text: textResponse,
            usage: usageMetadata,
            model: this.model,
            cost: calculatedCost
          };
        }
      }

      throw new Error('Gemini 3 Pro API\'den geçerli yanıt alınamadı');
    } catch (error) {
      console.error(`❌ Gemini 3 Pro API Error:`, {
        message: error.message,
        name: error.name
      });

      // HTTP hata kodlarını kontrol et
      if (error.message.includes('HTTP 429') || error.message.includes('quota')) {
        throw new Error(`Gemini API kullanım limitine ulaşıldı. Lütfen birkaç dakika bekleyip tekrar deneyin veya API anahtarınızı kontrol edin.`);
      }

      if (error.message.includes('HTTP 401')) {
        throw new Error(`Gemini API anahtarı geçersiz. Lütfen API anahtarınızı kontrol edin.`);
      }

      if (error.message.includes('HTTP 403')) {
        throw new Error(`Gemini API erişim izni yok. API anahtarı yetkilerini kontrol edin.`);
      }

      // Timeout/Abort hatalarını özel olarak işle
      if (error.name === 'AbortError') {
        throw new Error(`Gemini 3 Pro API zaman aşımı: İstek çok uzun sürdü (5+ dakika). Lütfen daha kısa bir metin deneyin veya tekrar deneyin.`);
      }

      // Network hatalarını işle
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`Gemini 3 Pro API'ye bağlanılamıyor: ${error.message}`);
      }

      throw new Error(`Gemini 3 Pro API Hatası: ${error.message || 'Bilinmeyen hata'}`);
    }
  }

  async callLocalAI(systemPrompt, userPrompt, temperature) {
    const endpoint = this.localEndpoint.endsWith('/')
      ? this.localEndpoint + "api/generate"
      : this.localEndpoint + "/api/generate";

    const combinedPrompt = systemPrompt + "\n\n" + userPrompt;

    const response = await axios.post(
      endpoint,
      {
        model: this.localModel,
        prompt: combinedPrompt,
        stream: false,
        options: {
          temperature: temperature
          // num_predict kaldırıldı - sınırsız çıktı
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 300000, // 5 dakika - uzun analizler için
      }
    );

    return response.data.response;
  }

  /**
   * Analyze text with custom prompts
   * Used by AnalysisPanel for multi-analysis workflow
   * @param {string} text - The text to analyze
   * @param {object} options - Analysis options
   * 
   * NOT: Chunking tamamen kaldırıldı - tüm text tek seferde işlenir
   */
  async analyzeWithCustomPrompt(text, options = {}) {
    console.log('✅ analyzeWithCustomPrompt called!', { textLength: text?.length, options });

    const {
      systemPrompt = 'Sen bir senaryo analiz uzmanısın.',
      userPrompt = '',
      onProgress = null,
      includeMetadata = false
      // maxTokens yok - sınırsız çıktı
    } = options;

    // Tüm metni tek seferde analiz et - chunking yok
    const fullPrompt = userPrompt.replace(/\{\{text\}\}/g, text);

    if (onProgress) {
      onProgress({ message: 'Analiz yapılıyor...', progress: 50 });
    }

    const result = await this.generateText(systemPrompt, fullPrompt, {
      includeMetadata,
      temperature: options.temperature
      // maxTokens yok - sınırsız çıktı
    });

    if (onProgress) {
      onProgress({ message: 'Tamamlandı', progress: 100 });
    }

    return result;
  }



  /**
   * Generate images using Gemini 3 Pro Image Preview
   * Supports reference images (up to 14 images)
   * Updated to match official Gemini 3 Pro Image Preview API format (November 2025)
   */
  async _deprecated_generateImage(prompt, options = {}) {
    // Only support Gemini for image generation currently
    if (this.provider !== AI_PROVIDERS.GEMINI) {
      throw new Error('Görsel üretme sadece Gemini provider ile desteklenmektedir');
    }

    if (!this.apiKey) {
      throw new Error('Gemini API anahtarı gerekli');
    }

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      throw new Error('Görsel açıklaması (prompt) gerekli');
    }

    try {
      console.log('🎨 Generating image with Gemini 3 Pro Image Preview...');

      // Use the exact model name from Google documentation
      const imageModel = 'gemini-3-pro-image-preview';

      // Prepare request body for Gemini 3 Pro Image Preview API
      // Based on official Google documentation format
      const requestBody = {
        contents: [{
          parts: []
        }],
        generationConfig: {
          temperature: options.temperature || 0.7,
          topP: 0.8,
          topK: 40,
          // maxOutputTokens kaldırıldı - sınırsız çıktı
          // Response modalities MUST be at this level for Gemini 3 Pro Image
          response_modalities: ['TEXT', 'IMAGE']
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
        ]
      };

      // Add image configuration if specified (CORRECT PLACEMENT in generationConfig)
      if (options.imageSize) {
        requestBody.generationConfig.image_config = {};

        // Valid values: "1K", "2K", "4K" (note: capital K required)
        requestBody.generationConfig.image_config.image_size = options.imageSize;
      }

      // Add text prompt first
      requestBody.contents[0].parts.push({
        text: prompt.trim()
      });

      // Add reference images if provided (up to 14 images as per Gemini 3 Pro spec)
      if (options.referenceImages && Array.isArray(options.referenceImages)) {
        const maxImages = Math.min(options.referenceImages.length, 14);

        for (let i = 0; i < maxImages; i++) {
          const refImage = options.referenceImages[i];
          if (refImage && refImage.data && refImage.mimeType) {
            let base64Data = refImage.data;

            // Remove data URL prefix if present (data:image/png;base64,)
            if (base64Data.includes(',')) {
              base64Data = base64Data.split(',')[1];
            }

            requestBody.contents[0].parts.push({
              inlineData: {
                mimeType: refImage.mimeType,
                data: base64Data
              }
            });
          }
        }

        console.log(`📸 Added ${maxImages} reference image(s) to Gemini 3 Pro Image request`);
      }

      // Use the correct API endpoint format for Gemini 3 Pro Image Preview
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent`;

      console.log('🌐 Calling Gemini 3 Pro Image API...', {
        model: imageModel,
        endpoint: url,
        hasReferenceImages: !!(options.referenceImages?.length),
        imageSize: options.imageSize
      });

      const response = await axios.post(url, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey
        },
        timeout: 180000 // 3 minutes timeout for image generation
      });

      console.log('📡 Gemini 3 Pro Image API Response Status:', response.status);

      if (response.status !== 200) {
        throw new Error(`Gemini API returned status ${response.status}: ${response.statusText}`);
      }

      const data = response.data;
      console.log('📦 API Response structure:', {
        hasCandidates: !!(data.candidates),
        candidatesLength: data.candidates?.length || 0,
        firstCandidateKeys: data.candidates?.[0] ? Object.keys(data.candidates[0]) : [],
        finishReason: data.candidates?.[0]?.finishReason
      });

      if (data.candidates && data.candidates.length > 0) {
        const candidate = data.candidates[0];

        // Check if response was blocked
        if (candidate.finishReason === 'SAFETY') {
          throw new Error('Görsel üretimi Gemini güvenlik filtreleri tarafından engellendi. Lütfen açıklamayı değiştirin.');
        }

        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          // Look for image data in parts
          for (const part of candidate.content.parts) {
            // Check for both inline_data and inlineData formats
            const imageData = part.inline_data || part.inlineData;
            if (imageData && imageData.data && imageData.mimeType) {
              console.log('✅ Image generated successfully!');
              return {
                success: true,
                imageData: imageData.data,
                mimeType: imageData.mimeType,
                provider: 'gemini-3-pro-image',
                model: imageModel,
                prompt: prompt,
                timestamp: new Date().toISOString()
              };
            }

            // Also check for thought_signature which might contain image data
            if (part.thought_signature) {
              console.log('🤔 Found thought signature (thinking process)');
              // This might be part of the thinking process, continue checking
            }
          }

          // Log all parts for debugging
          console.log('🔍 Response parts analysis:');
          candidate.content.parts.forEach((part, index) => {
            console.log(`Part ${index}:`, {
              hasText: !!part.text,
              hasInlineData: !!(part.inline_data || part.inlineData),
              hasThoughtSignature: !!part.thought_signature,
              isThought: !!part.thought,
              keys: Object.keys(part)
            });
          });
        }
      }

      // Enhanced error message with response structure
      const responseStructure = JSON.stringify(data, null, 2).substring(0, 500);
      throw new Error(`Gemini 3 Pro Image API'den geçerli görsel verisi alınamadı. Response: ${responseStructure}...`);
    } catch (error) {
      console.error('❌ Gemini Image Generation Error:', {
        message: error.message,
        name: error.name,
        prompt: prompt.substring(0, 100) + '...',
        responseStatus: error.response?.status,
        responseData: error.response?.data
      });

      // Provide more specific error messages
      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;

        if (status === 400) {
          const errorMsg = errorData?.error?.message || 'API isteği hatalı';
          throw new Error(`🚫 Geçersiz istek (400): ${errorMsg}`);
        } else if (status === 401) {
          throw new Error('🔑 Gemini API anahtarı geçersiz veya eksik');
        } else if (status === 403) {
          throw new Error('🚫 Gemini API erişimi reddedildi. Kotanızı veya izinlerinizi kontrol edin.');
        } else if (status === 404) {
          throw new Error(`🔍 Model bulunamadı: ${imageModel}. Model adını kontrol edin.`);
        } else if (status === 429) {
          throw new Error('⏳ Gemini API rate limit aşıldı. Lütfen biraz bekleyin.');
        } else {
          throw new Error(`🌐 Gemini API hatası (${status}): ${errorData?.error?.message || error.message}`);
        }
      }

      throw error;
    }
  }
}

export default AIHandler;