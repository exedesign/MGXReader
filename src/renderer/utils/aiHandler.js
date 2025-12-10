/**
 * AIHandler - Unified AI Gateway
 * Supports: OpenAI, Google Gemini, Local AI (Ollama/LM Studio)
 */

import axios from 'axios';
import { splitTextForAnalysis, getOptimalChunkSize } from './textProcessing.js';
import { createEnhancedAnalysisEngine } from './enhancedAnalysisEngine.js';

// Set global axios timeout to prevent default 18s timeout
axios.defaults.timeout = 300000; // 5 minutes

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
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview 🌟', contextWindow: 2000000, maxOutput: 8192, description: 'En akıllı model - Çok formatlı anlama konusunda dünyanın en iyisi', recommended: true },

  // Gemini 2.5 Series - HIZLI VE AKILLI
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash ⚡', contextWindow: 1000000, maxOutput: 8192, fast: true, description: 'Fiyat-performans açısından en iyi - Hızlı ve çok yönlü' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite 🚀', contextWindow: 1000000, maxOutput: 8192, fast: true, description: 'Ultra hızlı - Maliyet verimliliği için optimize edilmiş' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro 🧠', contextWindow: 2000000, maxOutput: 8192, description: 'Gelişmiş düşünme - Kod, matematik ve STEM problemleri için' },

  // Gemini 2.0 Series - İKİNCİ NESİL
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1000000, maxOutput: 8192, fast: true, description: 'İkinci nesil çalışkan model' },
  { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash-Lite', contextWindow: 1000000, maxOutput: 8192, fast: true, description: 'İkinci nesil küçük ve güçlü model' },

  // Gemini 1.5 Series - KARAR LI MODELLER
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 2000000, maxOutput: 8192, description: 'Kararlı ve güçlü model' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1000000, maxOutput: 8192, fast: true, description: 'Hızlı ve ekonomik' },
];

// Image Generation Models - Verified Available (https://ai.google.dev/gemini-api/docs/image-generation)
export const GEMINI_IMAGE_MODELS = [
  // Gemini Native Image Generation - NANO BANANA & NANO BANANA PRO (ACTIVE)
  { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image Preview 🍌 Pro', description: 'Profesyonel görsel üretim - 14 referans görsel, 4K çözünürlük, Google Search', recommended: true, maxReferenceImages: 14, maxResolution: '4K', features: ['google_search', 'thinking_mode', 'multi_turn'] },
  { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image 🍌', description: 'Hızlı ve verimli görsel üretim - 3 referans görsel, 1K çözünürlük', fast: true, maxReferenceImages: 3, maxResolution: '1K' },

  // Imagen 4.0 Series - DEPRECATED (API tarafından desteklenmiyor)
  { id: 'imagen-4.0-generate-001', name: 'Imagen 4.0 Standard ⚠️ Deprecated', description: 'API tarafından desteklenmiyor - Gemini modelleri kullanın', deprecated: true, disabled: true },
  { id: 'imagen-4.0-fast-generate-001', name: 'Imagen 4.0 Fast ⚠️ Deprecated', description: 'API tarafından desteklenmiyor - Gemini modelleri kullanın', deprecated: true, disabled: true },
  { id: 'imagen-4.0-ultra-generate-001', name: 'Imagen 4.0 Ultra ⚠️ Deprecated', description: 'API tarafından desteklenmiyor - Gemini modelleri kullanın', deprecated: true, disabled: true },

  // Imagen 3.0 Series - LEGACY (Sınırlı destek)
  { id: 'imagen-3.0-generate-001', name: 'Imagen 3.0 ⚠️ Legacy', description: 'Eski nesil model - Yeni projeler için Gemini önerilir', deprecated: true },
];

// Image Understanding Models - Verified Available (https://ai.google.dev/gemini-api/docs/image-understanding)
export const GEMINI_IMAGE_UNDERSTANDING_MODELS = [
  // Gemini 3 Series - EN AKILLI
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview 🌟', description: 'En akıllı çok formatı model - Görsel açıklama, sınıflandırma, soru-yanıt', recommended: true, features: ['caption', 'classification', 'vqa', 'ocr'] },

  // Gemini 2.5 Series
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash ⚡', description: 'Hızlı görsel anlama - 3600 görsel/istek', fast: true, maxImages: 3600, features: ['segmentation', 'object_detection'] },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro 🧠', description: 'Gelişmiş görsel analiz - Segmentasyon ve nesne algılama', features: ['segmentation', 'object_detection', 'spatial_understanding'] },

  // Gemini 2.0 Series
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Gelişmiş nesne algılama - İkinci nesil', features: ['object_detection'], maxImages: 3600 },

  // Gemini 1.5 Series
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Kararlı çok formatı model', stable: true, maxImages: 3600 },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Hızlı ve ekonomik görsel anlama', fast: true, stable: true, maxImages: 3600 },
];

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
    this.maxTokens = config.maxTokens || 4000;

    // API Rate Limiting - son istek zamanını takip et
    this.lastApiCall = 0;
    this.minDelayBetweenCalls = 1000; // 1 saniye minimum bekleme
    this.requestQueue = [];
    this.isProcessingQueue = false;
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
    const maxTokens = options.maxTokens || this.maxTokens;

    try {
      switch (this.provider) {
        case AI_PROVIDERS.OPENAI:
          if (!this.openaiApiKey) {
            throw new Error('OpenAI API key is required');
          }
          return await this.callOpenAI(systemPrompt, userPrompt, temperature, maxTokens);

        case AI_PROVIDERS.GEMINI:
          if (!this.apiKey) {
            throw new Error('Gemini API key is required');
          }
          return await this.callGemini(systemPrompt, userPrompt, temperature, maxTokens);

        case AI_PROVIDERS.LOCAL:
          return await this.callLocalAI(systemPrompt, userPrompt, temperature, maxTokens);

        default:
          throw new Error('Unsupported AI provider: ' + this.provider);
      }
    } catch (error) {
      console.error('AI Generation Error:', error);
      throw error;
    }
  }

  /**
   * Parçalı sonuçları birleştir (2/1, 2/2 formatındaki sonuçlar için)
   * @param {Array} chunks - Chunk sonuçları
   * @returns {Array} Birleştirilmiş chunks
   */
  mergePartialResults(chunks) {
    const merged = [];
    const partialGroups = new Map(); // key: base_id, value: array of parts

    chunks.forEach(chunk => {
      const result = chunk.result;

      // Parçalı sonuç formatını kontrol et: "X/Y" veya "KAPSAMLI ANALİZ (X/Y"
      const partialMatch = result.match(/(?:KAPSAMLI ANALİZ|PART|BÖLÜM)?\s*\(?\s*(\d+)\s*\/\s*(\d+)/i);

      if (partialMatch) {
        const currentPart = parseInt(partialMatch[1]);
        const totalParts = parseInt(partialMatch[2]);

        console.log(`🔍 Parçalı sonuç tespit edildi: ${currentPart}/${totalParts}`);

        // Grup ID'si oluştur (sahne bilgisi veya chunk numarası)
        const groupId = `${chunk.chunkNumber}_total${totalParts}`;

        if (!partialGroups.has(groupId)) {
          partialGroups.set(groupId, []);
        }

        partialGroups.get(groupId).push({
          ...chunk,
          partNumber: currentPart,
          totalParts: totalParts,
          // Başlık kısmını temizle
          result: result.replace(/(?:KAPSAMLI ANALİZ|PART|BÖLÜM)?\s*\(?\s*\d+\s*\/\s*\d+[^\n]*/i, '').trim()
        });
      } else {
        // Normal sonuç, direkt ekle
        merged.push(chunk);
      }
    });

    // Parçalı grupları birleştir
    partialGroups.forEach((parts, groupId) => {
      // Parça numarasına göre sırala
      parts.sort((a, b) => a.partNumber - b.partNumber);

      const totalParts = parts[0].totalParts;

      // Tüm parçalar mevcut mu kontrol et
      if (parts.length === totalParts) {
        console.log(`✅ ${groupId}: ${parts.length}/${totalParts} parça birleştiriliyor`);

        // Tüm parçaları birleştir
        const mergedResult = parts.map(p => p.result).join('\n\n');

        merged.push({
          ...parts[0],
          result: mergedResult,
          isMerged: true,
          mergedFrom: parts.length
        });
      } else {
        console.warn(`⚠️ ${groupId}: Eksik parça! ${parts.length}/${totalParts}`);
        // Eksik parçalar varsa mevcut olanları ekle
        parts.forEach(part => merged.push(part));
      }
    });

    return merged;
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
      // Handle character-specific image generation
      if (options.character) {
        console.log('🎭 Character image generation for:', options.character);
      }

      // Handle reference image for "similar character" approach
      let enhancedPrompt = prompt;
      if (options.referenceImage) {
        console.log('🖼️ Reference image provided for character generation');
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
            inline_data: {
              mime_type: options.mimeType || 'image/jpeg',
              data: base64Data
            }
          }
        ]
      }],
      generationConfig: {
        temperature: options.temperature || 0.7,
        maxOutputTokens: options.maxOutputTokens || 2048
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
        response_modalities: ["IMAGE"],
        temperature: temperature,
        image_config: {
          image_size: requestedSize
        }
      };

      requestBody = {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: generationConfig,
        safetySettings: [
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_LOW_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_LOW_AND_ABOVE"
          }
        ]
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
            inline_data: {
              mime_type: refImage.mimeType || 'image/jpeg',
              data: refImage.data
            }
          });
        }
        console.log(`🖼️ Added ${imageCount}/${modelCapabilities.maxReferenceImages} reference images to ${model}`);
      }
    } else {
      // Imagen 4.0 API (v1beta) - uses generateImages
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateImages?key=${this.apiKey}`;
      requestBody = {
        prompt: prompt,
        config: {
          number_of_images: options.numberOfImages || 1,
          image_size: options.imageSize || "1K",
          person_generation: "allow_adult"
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
              return {
                success: true,
                imageData: imageData.data,
                mimeType: imageData.mimeType || imageData.mime_type || 'image/jpeg',
                provider: 'gemini',
                model: model,
                originalPrompt: prompt,
                generatedAt: new Date().toISOString(),
                totalImages: imageParts.length
              };
            }
          }
        }
      }
      // Handle Imagen 4.0 response (legacy format)
      else if (model.includes('imagen')) {
        if (data.generated_images && data.generated_images.length > 0) {
          const generatedImage = data.generated_images[0];
          console.log(`✅ ${model}: Görsel oluşturuldu`);
          return {
            success: true,
            imageData: generatedImage.image,
            mimeType: generatedImage.mime_type || 'image/jpeg',
            provider: 'gemini',
            model: model,
            originalPrompt: prompt,
            generatedAt: new Date().toISOString()
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
          return {
            success: true,
            imageUrl: imageData.url,
            provider: 'openai',
            model: model,
            revisedPrompt: imageData.revised_prompt || prompt,
            originalPrompt: prompt,
            generatedAt: new Date().toISOString(),
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

  async callOpenAI(systemPrompt, userPrompt, temperature, maxTokens) {
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
            temperature: temperature,
            max_tokens: maxTokens,
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

  async callGemini(systemPrompt, userPrompt, temperature, maxTokens) {
    if (!this.apiKey) {
      throw new Error('Google API key is required');
    }

    // API key debug bilgisi
    const keyPrefix = this.apiKey.substring(0, 10);
    const keySuffix = this.apiKey.substring(this.apiKey.length - 5);
    console.log(`🔑 Using Gemini API key: ${keyPrefix}...${keySuffix} (length: ${this.apiKey.length})`);

    // Sadece seçili modeli kullan - fallback yok
    const selectedModel = this.model;
    console.log(`🎯 Using selected model: ${selectedModel}`);

    try {
      // API v1beta endpoint - More stable for Gemini models
      const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' + selectedModel + ':generateContent?key=' + this.apiKey;

      // Debug logging
      console.log('Gemini API Debug:', {
        model: selectedModel,
        apiUrl: apiUrl.replace(this.apiKey, '***'),
        systemPromptLength: systemPrompt ? systemPrompt.length : 0,
        userPromptLength: userPrompt ? userPrompt.length : 0
      });

      const result = await this.makeGeminiRequestWithRetry(apiUrl, systemPrompt, userPrompt, temperature, maxTokens, selectedModel);
      console.log(`✅ ${selectedModel} başarılı!`);
      return result;

    } catch (error) {
      console.log(`❌ ${selectedModel} başarısız:`, error.message);
      throw error;
    }
  }

  async makeGeminiRequestWithRetry(apiUrl, systemPrompt, userPrompt, temperature, maxTokens, modelName) {
    const maxRetries = 3; // 5'ten 3'e düşürdüm
    const baseDelay = 5000; // 3s'den 5s'ye çıkardım

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 ${modelName} - Deneme ${attempt}/${maxRetries}`);
        return await this.makeGeminiRequest(apiUrl, systemPrompt, userPrompt, temperature, maxTokens);
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

  async makeGeminiRequest(apiUrl, systemPrompt, userPrompt, temperature, maxTokens) {
    // Gemini v1beta API format
    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: temperature || 0.7,
        maxOutputTokens: maxTokens || 8192,
        topP: 0.95,
        topK: 40,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_LOW_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_LOW_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_LOW_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_LOW_AND_ABOVE"
        }
      ]
    };

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
          console.log(`✅ Gemini 3 Pro başarılı!`);
          return candidate.content.parts[0].text;
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

  async callLocalAI(systemPrompt, userPrompt, temperature, maxTokens) {
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
          temperature: temperature,
          num_predict: maxTokens,
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
   */
  async analyzeWithCustomPrompt(text, options = {}) {
    console.log('✅ analyzeWithCustomPrompt called!', { textLength: text?.length, options });

    const {
      systemPrompt = 'Sen bir senaryo analiz uzmanısın.',
      userPrompt = '',
      useChunking = false,
      onProgress = null
    } = options;

    // Enable chunking for moderately long texts (>15000 chars) to analyze complete scripts
    if (!useChunking && text.length < 15000) {
      // Direct analysis for shorter texts
      const fullPrompt = userPrompt.replace(/\{\{text\}\}/g, text);

      if (onProgress) {
        onProgress({ message: 'Analiz yapılıyor...', progress: 50 });
      }

      const result = await this.generateText(systemPrompt, fullPrompt);

      if (onProgress) {
        onProgress({ message: 'Tamamlandı', progress: 100 });
      }

      return result;
    }

    // Use chunking for long texts or when explicitly requested
    console.log(`📝 Script length: ${text.length} characters - Using chunking for complete analysis`);

    // Get optimal chunk size for current Gemini model
    const chunkOptions = getOptimalChunkSize('gemini', this.model || 'gemini-2.5-flash');
    const chunks = splitTextForAnalysis(text, {
      ...chunkOptions,
      maxTokens: 6000,  // Larger chunks for better context
      overlapTokens: 600, // Proportional overlap
      preserveScenes: true // Maintain screenplay structure
    });

    const totalChunks = chunks.length;
    console.log(`🔄 Script split into ${totalChunks} chunks for complete analysis`);

    let chunkResults = [];

    // Analyze each chunk with scene context
    for (let i = 0; i < totalChunks; i++) {
      const chunk = chunks[i];
      const chunkNumber = i + 1;

      if (onProgress) {
        onProgress({
          message: `Bölüm ${chunkNumber}/${totalChunks} analiz ediliyor... (${chunk.scenes?.length || 0} sahne)`,
          progress: (i / totalChunks) * 80, // Leave 20% for final synthesis
          chunkNumber,
          totalChunks,
          currentChunk: {
            scenes: chunk.scenes?.length || 0,
            wordCount: chunk.wordCount,
            type: chunk.type
          }
        });
      }

      console.log(`🔍 Analyzing chunk ${chunkNumber}/${totalChunks}: ${chunk.wordCount} words, ${chunk.scenes?.length || 0} scenes`);

      // Create chunk-specific prompt with context
      const chunkContext = chunk.scenes?.length > 0 ?
        `\n\nBU BÖLÜM HAKKİNDA:\n- Bölüm ${chunkNumber}/${totalChunks}\n- ${chunk.scenes.length} sahne içeriyor\n- ${chunk.type === 'scene-based' ? 'Sahne sınırları korundu' : 'Paragraf bazlı bölümleme'}\n` :
        `\n\nBU BÖLÜM HAKKİNDA:\n- Bölüm ${chunkNumber}/${totalChunks}\n- ${chunk.wordCount} kelime\n`;

      const chunkPrompt = userPrompt.replace(/\{\{text\}\}/g, chunk.text) + chunkContext;

      try {
        console.log(`⏳ Starting analysis for chunk ${chunkNumber} (${chunk.tokenEstimate} tokens estimated)`);

        const chunkResult = await this.generateText(systemPrompt, chunkPrompt);

        chunkResults.push({
          chunkIndex: i,
          chunkNumber,
          result: chunkResult,
          scenes: chunk.scenes || [],
          wordCount: chunk.wordCount,
          tokenEstimate: chunk.tokenEstimate,
          type: chunk.type
        });

        console.log(`✅ Chunk ${chunkNumber} completed: ${chunkResult.length} characters`);
      } catch (error) {
        console.error(`❌ Error analyzing chunk ${chunkNumber}:`, error);

        // Daha detaylı hata tanımları
        const isTimeoutError = error.message?.includes('timeout') || error.code === 'ECONNABORTED';
        const isQuotaError = error.message?.includes('quota') || error.message?.includes('429') || error.message?.includes('508');
        const isRateLimit = error.message?.includes('Too Many Requests');
        const isAPIError = error.response?.status >= 400;

        let errorMessage = `Bölüm ${chunkNumber} analiz hatası`;

        if (isQuotaError) {
          errorMessage += ' (API quota limiti aşıldı - birkaç dakika bekleyin)';
        } else if (isRateLimit) {
          errorMessage += ' (Çok fazla istek - 30 saniye bekleyin)';
        } else if (isTimeoutError) {
          errorMessage += ' (Zaman aşımı - bölüm çok büyük olabilir)';
        } else if (isAPIError) {
          errorMessage += ` (API Hatası: ${error.response?.status})`;
        } else {
          errorMessage += `: ${error.message}`;
        }

        chunkResults.push({
          chunkIndex: i,
          chunkNumber,
          result: errorMessage,
          error: true,
          errorType: isQuotaError ? 'quota' : (isRateLimit ? 'rate_limit' : (isTimeoutError ? 'timeout' : (isAPIError ? 'api' : 'unknown'))),
          scenes: chunk.scenes || [],
          wordCount: chunk.wordCount
        });
      }
    }

    // Final synthesis step - combine all chunk analyses
    if (onProgress) {
      onProgress({
        message: 'Tüm bölümler analiz edildi, sentez yapılıyor...',
        progress: 85,
        phase: 'synthesis'
      });
    }

    console.log(`🎯 Synthesizing ${chunkResults.length} chunk analyses into final result`);

    // Filter out invalid chunks and check for meaningful content
    const successfulChunks = chunkResults.filter(cr => {
      if (cr.error) return false;

      // Skip chunks with only synthesis prompts or template text
      const result = cr.result.toLowerCase();
      if (result.includes('bölüm analiz sonuçları') ||
        result.includes('***') ||
        result.includes('lütfen yukarıdaki') ||
        result.length < 50) {
        console.warn(`Skipping invalid chunk ${cr.chunkNumber}: contains template text`);
        return false;
      }
      return true;
    });

    const errorCount = chunkResults.length - successfulChunks.length;

    // If no valid chunks, return fallback
    if (successfulChunks.length === 0) {
      console.warn('No valid chunks found, returning error message');
      return 'Analiz sırasında teknik bir sorun oluştu. Lütfen daha kısa bir metin ile tekrar deneyin.';
    }

    // 🔄 AKILLI BİRLEŞTİRME: Parçalı sonuçları kontrol et ve birleştir
    console.log('🔍 Parçalı sonuç kontrolü yapılıyor...');
    const mergedChunks = this.mergePartialResults(successfulChunks);
    console.log(`✅ ${successfulChunks.length} parça -> ${mergedChunks.length} birleştirilmiş sonuç`);

    const synthesisPrompt = `Bu senaryonun ${mergedChunks.length} farklı parçada yapılan analizlerini tek kapsamlı analiz haline getir:

${mergedChunks.map((chunk, idx) =>
      `${idx + 1}. PARÇA ANALİZİ:\n${chunk.result.substring(0, 1000)}${chunk.result.length > 1000 ? '...' : ''}\n`
    ).join('\n')}\n\nYukarıdaki parça analizlerini birleştirerek tek final analiz oluştur:`;

    // Additional safety check for synthesis prompt length
    if (synthesisPrompt.length > 20000) {
      console.warn('Synthesis prompt too long, using fallback concatenation');
      const fallbackResult = mergedChunks.map(chunk => chunk.result).join('\n\n---\n\n');

      if (onProgress) {
        onProgress({
          message: 'Analiz tamamlandı (parça birleştirme)',
          progress: 100,
          phase: 'completed-fallback'
        });
      }

      return fallbackResult;
    }

    try {
      const finalResult = await this.generateText(
        'Sen uzman bir analiz editörüsün. Parça analizlerini tek tutarlı analiz haline getirirsin.',
        synthesisPrompt
      );

      // Check if result contains synthesis prompt artifacts
      const resultLower = finalResult.toLowerCase();
      if (resultLower.includes('parça analizi') ||
        resultLower.includes('yukarıdaki') ||
        resultLower.includes('birleştir')) {
        console.warn('Synthesis result contains prompt artifacts, using fallback');
        throw new Error('Synthesis returned prompt text');
      }

      if (onProgress) {
        onProgress({
          message: 'Kapsamlı analiz tamamlandı!',
          progress: 100,
          phase: 'completed',
          chunksAnalyzed: successfulChunks.length,
          totalChunks: totalChunks,
          errors: errorCount
        });
      }

      console.log(`✅ Complete script analysis finished: ${successfulChunks.length}/${totalChunks} chunks successful`);

      return finalResult;

    } catch (synthesisError) {
      console.error('❌ Synthesis error:', synthesisError);

      // Fallback: return concatenated results
      const fallbackResult = successfulChunks.map(chunk => chunk.result).join('\n\n---\n\n');

      if (onProgress) {
        onProgress({
          message: 'Analiz tamamlandı (sentez hatası, ham sonuçlar döndürüldü)',
          progress: 100,
          phase: 'completed-fallback'
        });
      }

      return `KAPSAMLI ANALİZ (${successfulChunks.length}/${totalChunks} bölüm):\n\n` + fallbackResult;
    }
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
          maxOutputTokens: 8192,
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
              inline_data: {
                mime_type: refImage.mimeType,
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