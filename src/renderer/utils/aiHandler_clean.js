/**
 * AIHandler - Unified AI Gateway
 * Supports: OpenAI, Google Gemini, Local AI (Ollama/LM Studio)
 */

import axios from 'axios';
import { splitTextForAnalysis, getOptimalChunkSize } from './textProcessing.js';
import { createEnhancedAnalysisEngine } from './enhancedAnalysisEngine.js';

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
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1000000, fast: true, recommended: true },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 2000000 },
  { id: 'gemini-1.5-flash-001', name: 'Gemini 1.5 Flash V1', contextWindow: 1000000, fast: true },
  { id: 'gemini-1.5-pro-001', name: 'Gemini 1.5 Pro V1', contextWindow: 2000000 },
  { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro (Legacy)', contextWindow: 32768 },
];

// Dedicated image generation models - WORKING MODELS ONLY
export const GEMINI_IMAGE_MODELS = [
  { id: 'text-to-description', name: 'Text Description (Gemini)', description: 'Metinsel gorsel aciklama - gorsel uretimi OpenAI fallback', working: true },
];

// OpenAI image models for comparison
export const OPENAI_IMAGE_MODELS = [
  { id: 'dall-e-3', name: 'DALL-E 3', recommended: true, description: 'OpenAI en gelismis gorsel modeli' },
  { id: 'dall-e-2', name: 'DALL-E 2', description: 'Onceki nesil DALL-E modeli' },
];

class AIHandler {
  constructor(config = {}) {
    this.provider = config.provider || AI_PROVIDERS.OPENAI;
    this.openaiApiKey = config.openaiApiKey || '';
    this.apiKey = config.geminiApiKey || '';
    this.model = config.model || 'gpt-4o';
    this.imageModel = config.imageModel || 'dall-e-3';
    this.localEndpoint = config.localEndpoint || 'http://localhost:11434';
    this.localModel = config.localModel || 'llama3';
    this.temperature = config.temperature || 0.3;
    this.maxTokens = config.maxTokens || 4000;
  }

  async generateText(systemPrompt, userPrompt, options = {}) {
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

  async generateImage(prompt, options = {}) {
    console.log('Image generation request:', { provider: this.provider, prompt: prompt.substring(0, 50) });
    
    try {
      switch (this.provider) {
        case AI_PROVIDERS.OPENAI:
          const { size = '1024x1024', quality = 'standard', style = 'natural', model = 'dall-e-3' } = options;
          return await this.generateImageOpenAI(prompt, { size, quality, style, model });

        case AI_PROVIDERS.GEMINI:
          try {
            return await this.generateImageGemini(prompt, options);
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

  async generateImageGemini(prompt, options = {}) {
    console.log('Gemini Image Generation:', {
      prompt: prompt.substring(0, 100) + '...',
      hasOpenAIKey: !!this.openaiApiKey,
      hasGeminiKey: !!this.apiKey
    });

    // Gemini henuz public image API saglamiyor, OpenAI fallback yap
    if (this.openaiApiKey) {
      console.log('OpenAI DALL-E fallback...');
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
          note: 'Gemini image API henuz mevcut degil, OpenAI DALL-E kullanildi'
        };
      } catch (openaiError) {
        console.error('OpenAI fallback hata:', openaiError);
        throw new Error('Gorsel uretimi basarisiz: ' + openaiError.message);
      }
    } else {
      // API key eksikse hata mesaji
      throw new Error('Gorsel uretim basarisiz: Gemini image API henuz public degil. Lutfen OpenAI API key ekleyin.');
    }
  }

  async generateImageOpenAI(prompt, options = {}) {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key is required for image generation');
    }

    const { model = 'dall-e-3', size = '1024x1024', quality = 'standard', style = 'natural' } = options;

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/images/generations',
        {
          model: model,
          prompt: prompt,
          size: size,
          quality: quality,
          style: style,
          n: 1,
        },
        {
          headers: {
            'Authorization': 'Bearer ' + this.openaiApiKey,
            'Content-Type': 'application/json',
          },
          timeout: 120000,
        }
      );

      if (response.data && response.data.data && response.data.data.length > 0) {
        const imageData = response.data.data[0];
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
      console.error('OpenAI Image Generation Error:', error);
      throw error;
    }
  }

  async callOpenAI(systemPrompt, userPrompt, temperature, maxTokens) {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: temperature,
        max_tokens: maxTokens,
      },
      {
        headers: {
          'Authorization': 'Bearer ' + this.openaiApiKey,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    return response.data.choices[0].message.content;
  }

  async callGemini(systemPrompt, userPrompt, temperature, maxTokens) {
    if (!this.apiKey) {
      throw new Error('Google API key is required');
    }

    // API key debug bilgisi
    const keyPrefix = this.apiKey.substring(0, 10);
    const keySuffix = this.apiKey.substring(this.apiKey.length - 5);
    console.log(`🔑 Using Gemini API key: ${keyPrefix}...${keySuffix} (length: ${this.apiKey.length})`);

    // Stable model list - try lightweight models first to avoid quota issues
    const models = [
      'gemini-1.5-flash',    // Fastest, least quota usage
      'gemini-1.5-pro',     // More capable but more quota
      'gemini-pro'                 // Fallback to older stable model
    ];

    let lastError = null;
    
    for (const model of models) {
      try {
        console.log('🎯 Trying Gemini model:', model);

        // API v1beta endpoint - More stable for Gemini models
        const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + this.apiKey;

        // Debug logging
        console.log('Gemini API Debug:', {
          model,
          apiUrl: apiUrl.replace(this.apiKey, '***'),
          systemPromptLength: systemPrompt ? systemPrompt.length : 0,
          userPromptLength: userPrompt ? userPrompt.length : 0
        });

        const result = await this.makeGeminiRequestWithRetry(apiUrl, systemPrompt, userPrompt, temperature, maxTokens, model);
        console.log(`✅ ${model} successful!`);
        return result;

      } catch (error) {
        console.log(`❌ ${model} failed:`, error.message);
        lastError = error;
        
        // If not quota error, don't try other models
        if (!error.message.includes('quota') && !error.message.includes('429') && !error.message.includes('Too Many Requests')) {
          throw error;
        }
        
        // If last model also fails, throw error
        if (model === models[models.length - 1]) {
          throw new Error(`All Gemini models hit quota limit. Please wait a few minutes and try again. Last error: ${error.message}`);
        }
        
        console.log(`📝 Quota error (${model}), trying next model...`);
        // Short delay between model attempts
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw lastError || new Error('All Gemini models failed');
  }

  async makeGeminiRequestWithRetry(apiUrl, systemPrompt, userPrompt, temperature, maxTokens, modelName) {
    const maxRetries = 2;
    const baseDelay = 1500;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 ${modelName} - Attempt ${attempt}/${maxRetries}`);
        return await this.makeGeminiRequest(apiUrl, systemPrompt, userPrompt, temperature, maxTokens);
      } catch (error) {
        console.log(`❌ ${modelName} attempt ${attempt} failed:`, error.message);

        if (!error.message.includes('quota') && !error.message.includes('429') && !error.message.includes('Too Many Requests')) {
          throw error;
        }

        if (attempt === maxRetries) {
          throw error;
        }

        const delay = baseDelay * attempt;
        console.log(`⏳ ${modelName} waiting ${delay}ms...`);
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
              text: systemPrompt + "\n\n" + userPrompt,
            },
          ],
        },
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
        throw new Error(`HTTP ${response.status}: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();

      if (data.candidates && data.candidates.length > 0) {
        const candidate = data.candidates[0];

        // Check if response was blocked
        if (candidate.finishReason === 'SAFETY') {
          throw new Error('Response blocked by Gemini safety filters. Try rephrasing your request.');
        }

        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          return candidate.content.parts[0].text;
        }
      }

      throw new Error('No valid response from Gemini API');
    } catch (error) {
      console.error('Gemini API Error:', {
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
        throw new Error(`Gemini API zaman aşımı: İstek çok uzun sürdü (5+ dakika). Lütfen daha kısa bir metin deneyin veya tekrar deneyin.`);
      }
      
      // Network hatalarını işle
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`Gemini API'ye bağlanılamıyor: ${error.message}`);
      }
      
      throw new Error(`Gemini API Hatası: ${error.message || 'Bilinmeyen hata'}`);
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
        timeout: 120000,
      }
    );

    return response.data.response;
  }
}

export default AIHandler;