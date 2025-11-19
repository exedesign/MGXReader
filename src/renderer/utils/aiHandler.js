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
  { id: 'gemini-3.0-pro', name: 'Gemini 3.0 Pro - New! 🚀', contextWindow: 2000000, recommended: true },
  { id: 'gemini-3.0-deep-think', name: 'Gemini 3.0 Deep Think - Reasoning 🧠', contextWindow: 1000000 },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash - Fast', contextWindow: 1000000, fast: true },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextWindow: 2000000 },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', contextWindow: 1000000, fast: true },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', contextWindow: 1000000 },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1000000, fast: true },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 2000000 },
];

export const MLX_MODELS = [
  { id: 'mlx-community/Llama-3.2-3B-Instruct-4bit', name: 'Llama 3.2 3B (4-bit) - Fast', contextWindow: 128000, recommended: true },
  { id: 'mlx-community/Llama-3.2-1B-Instruct-4bit', name: 'Llama 3.2 1B (4-bit) - Ultra Fast', contextWindow: 128000 },
  { id: 'mlx-community/Meta-Llama-3.1-8B-Instruct-4bit', name: 'Llama 3.1 8B (4-bit)', contextWindow: 128000 },
  { id: 'mlx-community/Mistral-7B-Instruct-v0.3-4bit', name: 'Mistral 7B v0.3 (4-bit)', contextWindow: 32000 },
  { id: 'mlx-community/gemma-2-2b-it-4bit', name: 'Gemma 2 2B (4-bit)', contextWindow: 8000 },
  { id: 'mlx-community/Qwen2.5-7B-Instruct-4bit', name: 'Qwen 2.5 7B (4-bit)', contextWindow: 32000 },
];

export class AIHandler {
  constructor(config) {
    this.provider = config.provider || AI_PROVIDERS.OPENAI;
    this.apiKey = config.apiKey || '';
    this.model = config.model || '';
    this.localEndpoint = config.localEndpoint || 'http://localhost:11434';
    this.localModel = config.localModel || 'llama3';
    this.mlxEndpoint = config.mlxEndpoint || 'http://localhost:8080';
    this.mlxModel = config.mlxModel || 'mlx-community/Llama-3.2-3B-Instruct-4bit';
    this.temperature = config.temperature || 0.3;

    // Initialize advanced analysis engines
    // Initialize advanced analysis engines
    this.enhancedAnalysisEngine = createEnhancedAnalysisEngine(this);
  }

  /**
   * Main method to call AI based on provider
   */
  async generateText(systemPrompt, userPrompt, options = {}) {
    const temperature = options.temperature || this.temperature;
    const maxTokens = options.maxTokens || 4000;

    try {
      switch (this.provider) {
        case AI_PROVIDERS.OPENAI:
          return await this.callOpenAI(systemPrompt, userPrompt, temperature, maxTokens);

        case AI_PROVIDERS.GEMINI:
          return await this.callGemini(systemPrompt, userPrompt, temperature, maxTokens);

        case AI_PROVIDERS.LOCAL:
          return await this.callLocalAI(systemPrompt, userPrompt, temperature, maxTokens);

        case AI_PROVIDERS.MLX:
          return await this.callMLX(systemPrompt, userPrompt, temperature, maxTokens);

        default:
          throw new Error(`Unknown AI provider: ${this.provider}`);
      }
    } catch (error) {
      console.error(`AI Generation Error (${this.provider}):`, error);
      throw error;
    }
  }

  /**
   * OpenAI API Call
   */
  async callOpenAI(systemPrompt, userPrompt, temperature, maxTokens) {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: this.model || 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
      }
    );

    return response.data.choices[0].message.content;
  }

  /**
   * Google Gemini API Call (Updated to v1beta API - November 2025)
   * Using latest Gemini 2.5 models with proper system instruction support
   */
  async callGemini(systemPrompt, userPrompt, temperature, maxTokens) {
    if (!this.apiKey) {
      throw new Error('Google API key is required');
    }

    // Use the latest v1beta API endpoint
    let model = this.model || 'gemini-2.5-flash';

    // Model names are correct for v1beta API
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    // Debug logging
    console.log('Gemini API Debug:', {
      model,
      apiUrl,
      apiKeyLength: this.apiKey ? this.apiKey.length : 0,
      apiKeyPrefix: this.apiKey ? this.apiKey.substring(0, 8) + '...' : 'none'
    });

    // Gemini v1beta API format with proper system instruction support
    const requestBody = {
      systemInstruction: {
        parts: [{
          text: systemPrompt
        }]
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: userPrompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: temperature || 0.7,
        maxOutputTokens: maxTokens || 8192,
        topP: 0.95,
        topK: 40,
        responseMimeType: 'text/plain',
        candidateCount: 1,
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_ONLY_HIGH',
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_ONLY_HIGH',
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_ONLY_HIGH',
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_ONLY_HIGH',
        },
        {
          category: 'HARM_CATEGORY_CIVIC_INTEGRITY',
          threshold: 'BLOCK_ONLY_HIGH',
        },
      ],
    };

    try {
      console.log('Making Gemini API request...');
      const response = await axios.post(
        apiUrl,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          timeout: 60000, // 60 seconds timeout
        }
      );

      console.log('Gemini API Response Status:', response.status);
      console.log('Gemini API Response Data:', response.data);

      // Handle response
      if (response.data.candidates && response.data.candidates.length > 0) {
        const candidate = response.data.candidates[0];

        // Check if response was blocked
        if (candidate.finishReason === 'SAFETY') {
          throw new Error('Response blocked by Gemini safety filters. Try rephrasing your request.');
        }

        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          return candidate.content.parts[0].text;
        }
      }

      // Handle empty or invalid response
      if (response.data.promptFeedback) {
        throw new Error(`Gemini API Error: ${response.data.promptFeedback.blockReason || 'Invalid response'}`);
      }

      throw new Error('No valid response from Gemini API');
    } catch (error) {
      console.error('Gemini API Error Details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        model: model,
        apiUrl: apiUrl,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers
        }
      });

      if (error.response) {
        // API returned an error response
        const status = error.response.status;
        const errorData = error.response.data;

        if (status === 400) {
          if (errorData?.error?.message?.includes('model not found')) {
            throw new Error(`Gemini Model '${model}' not found. Please check if the model exists in your region.`);
          }
          if (errorData?.error?.message?.includes('API key')) {
            throw new Error('Invalid Gemini API key. Please check your API key.');
          }
        }

        if (status === 403) {
          throw new Error('Gemini API access denied. Please check your API key permissions.');
        }

        if (status === 429) {
          throw new Error('Gemini API rate limit exceeded. Please try again later.');
        }

        const errorMessage = errorData?.error?.message || error.response.statusText;
        throw new Error(`Gemini API Error (${status}): ${errorMessage}`);
      }

      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new Error('Network error: Cannot connect to Gemini API. Please check your internet connection.');
      }

      throw error;
    }
  }

  /**
   * Local AI (Ollama/LM Studio) API Call
   */
  async callLocalAI(systemPrompt, userPrompt, temperature, maxTokens) {
    const endpoint = this.localEndpoint.endsWith('/')
      ? `${this.localEndpoint}api/generate`
      : `${this.localEndpoint}/api/generate`;

    // Ollama format
    const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;

    const response = await axios.post(
      endpoint,
      {
        model: this.localModel,
        prompt: combinedPrompt,
        stream: false,
        options: {
          temperature,
          num_predict: maxTokens,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 120000, // 2 minutes timeout for local models
      }
    );

    return response.data.response;
  }

  /**
   * Apple MLX API Call (mlx-lm server)
   * Optimized for Apple Silicon (M1/M2/M3/M4)
   */
  async callMLX(systemPrompt, userPrompt, temperature, maxTokens) {
    const endpoint = this.mlxEndpoint.endsWith('/')
      ? `${this.mlxEndpoint}v1/chat/completions`
      : `${this.mlxEndpoint}/v1/chat/completions`;

    // OpenAI-compatible format
    const response = await axios.post(
      endpoint,
      {
        model: this.mlxModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
        stream: false,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 120000, // 2 minutes timeout for local inference
      }
    );

    return response.data.choices[0].message.content;
  }

  /**
   * Test connection to AI provider
   */
  async testConnection() {
    try {
      console.log(`Testing ${this.provider} connection...`);

      // Simple test for different providers
      let testPrompt, systemPrompt;

      if (this.provider === AI_PROVIDERS.GEMINI) {
        systemPrompt = 'You are a helpful assistant. Respond concisely.';
        testPrompt = 'Say "OK" if you can read this message.';
      } else {
        systemPrompt = 'You are a helpful assistant.';
        testPrompt = 'Reply with only the word "OK" if you can read this.';
      }

      const response = await this.generateText(
        systemPrompt,
        testPrompt,
        { maxTokens: 20, temperature: 0 }
      );

      console.log(`${this.provider} test successful:`, response);

      return {
        success: true,
        response: response.trim(),
        provider: this.provider,
      };
    } catch (error) {
      console.error(`${this.provider} test failed:`, error);

      return {
        success: false,
        error: error.message,
        provider: this.provider,
      };
    }
  }

  /**
   * Get available models for current provider
   */
  getAvailableModels() {
    switch (this.provider) {
      case AI_PROVIDERS.OPENAI:
        return OPENAI_MODELS;
      case AI_PROVIDERS.GEMINI:
        return GEMINI_MODELS;
      case AI_PROVIDERS.MLX:
        return MLX_MODELS;
      case AI_PROVIDERS.LOCAL:
        return [
          { id: 'llama3', name: 'Llama 3' },
          { id: 'mistral', name: 'Mistral' },
          { id: 'gemma', name: 'Gemma' },
          { id: 'codellama', name: 'Code Llama' },
          { id: 'phi3', name: 'Phi-3' },
        ];
      default:
        return [];
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    Object.assign(this, newConfig);
  }

  /**
   * Correct grammar in text with configurable levels
   * @param {string} text - Text to correct
   * @param {object} options - Correction options
   * @returns {Promise<string>} - Corrected text
   */
  async correctGrammar(text, options = {}) {
    const {
      level = GRAMMAR_LEVELS.STANDARD,
      useChunking = true,
      maxChunkSize = 3000, // Smaller chunks for grammar correction
      onProgress = () => { },
    } = options;

    try {
      // For small texts or when chunking is disabled, process directly
      if (!useChunking || text.length <= maxChunkSize) {
        onProgress({ step: 'correcting', progress: 0, message: 'Correcting grammar...' });

        const systemPrompt = SCREENPLAY_PROMPTS.GRAMMAR_CORRECTION.system[level];
        const userPrompt = SCREENPLAY_PROMPTS.GRAMMAR_CORRECTION.buildUserPrompt(text, level);

        const correctedText = await this.generateText(systemPrompt, userPrompt, {
          maxTokens: Math.min(4000, Math.ceil(text.length * 1.2)), // Allow some expansion
          temperature: 0.1, // Low temperature for consistent corrections
        });

        // Cloud LLM'lerin yorum cevaplarını temizle
        const cleanedResult = this.cleanCloudLLMComments(correctedText.trim());

        onProgress({ step: 'complete', progress: 100, message: 'Grammar correction complete' });
        return cleanedResult;
      }

      // Split large text into chunks
      onProgress({
        step: 'chunking',
        progress: 5,
        message: 'Splitting text into chunks...'
      });

      const chunks = this.splitTextForGrammarCorrection(text, maxChunkSize);

      onProgress({
        step: 'correcting_chunks',
        progress: 10,
        message: `Correcting ${chunks.length} chunks...`
      });

      const correctedChunks = [];
      const totalChunks = chunks.length;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        onProgress({
          step: 'correcting_chunk',
          progress: 10 + (i / totalChunks) * 80,
          message: `Correcting chunk ${i + 1} of ${totalChunks}...`,
          currentChunk: i + 1,
          totalChunks: totalChunks,
        });

        try {
          const systemPrompt = SCREENPLAY_PROMPTS.GRAMMAR_CORRECTION.system[level];
          const userPrompt = SCREENPLAY_PROMPTS.GRAMMAR_CORRECTION.buildUserPrompt(chunk.text, level);

          const correctedChunk = await this.generateText(systemPrompt, userPrompt, {
            maxTokens: Math.min(4000, Math.ceil(chunk.text.length * 1.2)),
            temperature: 0.1,
          });

          // Cloud LLM yorumlarını temizle
          const cleanedChunk = this.cleanCloudLLMComments(correctedChunk.trim());

          correctedChunks.push({
            ...chunk,
            correctedText: cleanedChunk,
          });

          // Rate limiting delay for API providers
          if (i < chunks.length - 1 && this.provider !== AI_PROVIDERS.LOCAL && this.provider !== AI_PROVIDERS.MLX) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }

        } catch (chunkError) {
          console.warn(`Chunk ${i + 1} correction failed:`, chunkError);
          // Keep original text if correction fails
          correctedChunks.push({
            ...chunk,
            correctedText: chunk.text,
            error: chunkError.message,
          });
        }
      }

      onProgress({
        step: 'combining',
        progress: 95,
        message: 'Combining corrected chunks...'
      });

      // Combine corrected chunks back into full text
      const finalText = correctedChunks
        .map(chunk => chunk.correctedText)
        .join(chunk => chunk.preserveSpacing ? '\n\n' : ' '); // Maintain original spacing

      onProgress({
        step: 'complete',
        progress: 100,
        message: 'Grammar correction complete'
      });

      return finalText;

    } catch (error) {
      console.error('Grammar correction failed:', error);
      onProgress({
        step: 'error',
        progress: 0,
        message: `Correction failed: ${error.message}`
      });
      throw error;
    }
  }

  /**
   * Cloud LLM'lerin yorum cevaplarını temizle (sadece düzeltme sonucunu al)
   * @param {string} text - LLM'den gelen cevap
   * @returns {string} - Temizlenmiş metin
   */
  cleanCloudLLMComments(text) {
    // Cloud provider kontrolü
    if (this.provider !== AI_PROVIDERS.OPENAI && this.provider !== AI_PROVIDERS.GEMINI) {
      return text; // Local provider'lar için temizleme yapma
    }

    // Yaygın LLM yorum kalıplarını temizle
    let cleaned = text;

    // "Harika bir metin! Bu metni..." tarzı başlangıçları kaldır
    cleaned = cleaned.replace(/^.*?(düzeltme|düzenleme|analiz|geliştirme).*?(yaptım|yapıyorum|sunuyorum).*?[:.!]\s*/i, '');

    // "İşte geliştirilmiş versiyon:" tarzı ifadeleri kaldır
    cleaned = cleaned.replace(/^.*?(işte|burada|aşağıda).*?(geliştirilmiş|düzeltilmiş|düzenlenmiş).*?(versiyon|metin|sonuç).*?[:.!]\s*/im, '');

    // "Sizin için düzeltmeyi yaptım" tarzı ifadeleri kaldır
    cleaned = cleaned.replace(/^.*?(sizin için|size).*?(düzeltme|düzenleme).*?(yaptım|hazırladım).*?[:.!]\s*/im, '');

    // "Bu metni daha etkileyici..." tarzı açıklamaları kaldır
    cleaned = cleaned.replace(/^.*?(bu metni|metni).*?(daha|daha etkileyici|akıcı|edebi).*?[:.!]\s*/im, '');

    // Başlangıçtaki genel açıklamaları temizle
    cleaned = cleaned.replace(/^[^.!?]*?(düzeltme|analiz|geliştirme|iyileştirme)[^.!?]*?[.!?]\s*/i, '');

    return cleaned.trim();
  }

  /**
   * Split text for grammar correction (preserves paragraph structure)
   * @param {string} text - Text to split
   * @param {number} maxChunkSize - Maximum chunk size in characters
   * @returns {Array} - Array of text chunks
   */
  splitTextForGrammarCorrection(text, maxChunkSize) {
    const chunks = [];

    // Split by paragraphs first to preserve structure
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

    let currentChunk = '';
    let chunkIndex = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      const combinedLength = currentChunk.length + paragraph.length + 2; // +2 for line breaks

      if (combinedLength <= maxChunkSize || currentChunk.length === 0) {
        // Add paragraph to current chunk
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      } else {
        // Save current chunk and start new one
        if (currentChunk.length > 0) {
          chunks.push({
            index: chunkIndex++,
            text: currentChunk.trim(),
            preserveSpacing: true,
          });
        }

        // Check if single paragraph is too large
        if (paragraph.length > maxChunkSize) {
          // Split large paragraph by sentences
          const sentences = this.splitParagraphBySentences(paragraph, maxChunkSize);
          for (const sentence of sentences) {
            chunks.push({
              index: chunkIndex++,
              text: sentence.trim(),
              preserveSpacing: false,
            });
          }
          currentChunk = '';
        } else {
          currentChunk = paragraph;
        }
      }
    }

    // Add remaining chunk
    if (currentChunk.length > 0) {
      chunks.push({
        index: chunkIndex,
        text: currentChunk.trim(),
        preserveSpacing: true,
      });
    }

    return chunks;
  }

  /**
   * Split a large paragraph by sentences
   * @param {string} paragraph - Paragraph to split
   * @param {number} maxSize - Maximum size per chunk
   * @returns {Array} - Array of sentence chunks
   */
  splitParagraphBySentences(paragraph, maxSize) {
    const sentences = paragraph.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      const combinedLength = currentChunk.length + trimmedSentence.length + 2;

      if (combinedLength <= maxSize || currentChunk.length === 0) {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
      } else {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.trim() + '.');
        }
        currentChunk = trimmedSentence;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.trim() + '.');
    }

    return chunks;
  }

  /**
   * Analyze screenplay with intelligent chunking for token management
   * @param {string} text - Full screenplay text
   * @param {object} options - Analysis options
   * @returns {Promise<object>} - Analysis result
   */
  async analyzeScreenplayWithChunking(text, options = {}) {
    const {
      useChunking = true,
      onProgress = () => { },
      forceChunking = false,
    } = options;

    try {
      // Determine if chunking is needed
      const shouldChunk = this.shouldUseChunking(text, forceChunking);

      if (!useChunking || !shouldChunk) {
        onProgress({ step: 'analyzing', progress: 0, message: 'Analyzing screenplay...' });
        const result = await this.analyzeScreenplay(text);
        onProgress({ step: 'complete', progress: 100, message: 'Analysis complete' });
        return result;
      }

      // Get optimal chunk configuration for current provider
      const chunkConfig = getOptimalChunkSize(this.provider, this.model);

      onProgress({
        step: 'chunking',
        progress: 5,
        message: 'Splitting screenplay into manageable chunks...'
      });

      // Split text into chunks
      const chunks = splitTextForAnalysis(text, chunkConfig);

      if (chunks.length === 0) {
        throw new Error('Failed to create text chunks');
      }

      if (chunks.length === 1) {
        // Single chunk, use regular analysis
        onProgress({ step: 'analyzing', progress: 10, message: 'Analyzing screenplay...' });
        const result = await this.analyzeScreenplay(chunks[0].text);
        onProgress({ step: 'complete', progress: 100, message: 'Analysis complete' });
        return result;
      }

      onProgress({
        step: 'analyzing_chunks',
        progress: 10,
        message: `Analyzing ${chunks.length} chunks...`
      });

      // Analyze each chunk
      const chunkResults = [];
      const totalChunks = chunks.length;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        onProgress({
          step: 'analyzing_chunk',
          progress: 10 + (i / totalChunks) * 70,
          message: `Analyzing chunk ${i + 1} of ${totalChunks}...`,
          currentChunk: i + 1,
          totalChunks: totalChunks,
        });

        try {
          const chunkResult = await this.analyzeChunk(chunk, i + 1, totalChunks);
          chunkResults.push({
            ...chunkResult,
            chunkIndex: i,
            chunkInfo: {
              type: chunk.type,
              scenes: chunk.scenes || [],
              wordCount: chunk.wordCount,
              tokenEstimate: chunk.tokenEstimate,
            },
          });

          // Rate limiting delay
          if (i < chunks.length - 1 && this.provider !== AI_PROVIDERS.LOCAL && this.provider !== AI_PROVIDERS.MLX) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

        } catch (chunkError) {
          console.warn(`Chunk ${i + 1} analysis failed:`, chunkError);
          chunkResults.push({
            error: chunkError.message,
            chunkIndex: i,
            chunkInfo: {
              type: chunk.type,
              scenes: chunk.scenes || [],
              wordCount: chunk.wordCount,
              tokenEstimate: chunk.tokenEstimate,
            },
          });
        }
      }

      onProgress({
        step: 'combining',
        progress: 85,
        message: 'Combining analysis results...'
      });

      // Combine results
      const combinedResult = this.combineChunkAnalyses(chunkResults, text);

      onProgress({
        step: 'complete',
        progress: 100,
        message: 'Analysis complete'
      });

      return combinedResult;

    } catch (error) {
      console.error('Chunked analysis failed:', error);
      onProgress({
        step: 'error',
        progress: 0,
        message: `Analysis failed: ${error.message}`
      });
      throw error;
    }
  }

  /**
   * Analyze a single screenplay (without chunking)
   * @param {string} text - Screenplay text
   * @returns {Promise<object>} - Analysis result
   */
  async analyzeScreenplay(text) {
    const systemPrompt = SCREENPLAY_PROMPTS.SCENE_ANALYSIS.system;
    const userPrompt = SCREENPLAY_PROMPTS.SCENE_ANALYSIS.buildUserPrompt(text);

    // Cloud providers can handle larger responses
    const isCloudProvider = this.provider === AI_PROVIDERS.OPENAI || this.provider === AI_PROVIDERS.GEMINI;
    const maxTokens = isCloudProvider ? 8000 : 4000;

    console.log(`Analyzing screenplay with ${this.provider}, maxTokens: ${maxTokens}`);

    const response = await this.generateText(systemPrompt, userPrompt, {
      maxTokens,
      temperature: 0.1,
    });

    try {
      const cleanedResponse = response.replace(/```json\s*|\s*```/g, '').trim();
      return JSON.parse(cleanedResponse);
    } catch (error) {
      console.error('Failed to parse analysis response:', error);
      throw new Error('Failed to parse analysis data');
    }
  }

  /**
   * Analyze with custom prompt and chunking support
   * @param {string} text - Text to analyze
   * @param {object} options - Analysis options
   * @returns {Promise<string>} - Analysis result
   */
  async analyzeWithCustomPrompt(text, options = {}) {
    const {
      systemPrompt,
      userPrompt,
      useChunking = false,
      onProgress = () => { },
      language = 'en'
    } = options;

    if (!systemPrompt || !userPrompt) {
      throw new Error('Both systemPrompt and userPrompt are required for custom analysis');
    }

    onProgress({
      step: 'start',
      progress: 0,
      message: 'Starting custom analysis...'
    });

    try {
      // Cloud APIs (OpenAI, Gemini) have large context windows - no chunking needed
      const isCloudProvider = this.provider === AI_PROVIDERS.OPENAI || this.provider === AI_PROVIDERS.GEMINI;
      const shouldUseChunking = useChunking && !isCloudProvider && text.length > 6000; // Lower threshold for local AI

      if (!shouldUseChunking) {
        // Single prompt analysis - recommended for cloud providers
        onProgress({
          step: 'analyzing',
          progress: 50,
          message: 'Analyzing with custom prompt...'
        });

        const combinedUserPrompt = `${userPrompt}\n\nIMPORTANT: Provide the response in ${language} language.\n\nText to analyze:\n${text}`;
        const maxTokens = isCloudProvider ? 8000 : 4000; // Cloud providers can handle larger responses

        const result = await this.generateText(systemPrompt, combinedUserPrompt, {
          maxTokens,
          temperature: 0.1,
        });

        // Cloud provider'lar için yorum cevaplarını temizle
        const cleanedResult = this.cleanCloudLLMComments(result);

        onProgress({
          step: 'complete',
          progress: 100,
          message: 'Custom analysis complete!'
        });

        return cleanedResult;
      } else {
        // Chunked analysis - only for local providers with long text
        onProgress({
          step: 'info',
          progress: 5,
          message: 'Using chunked analysis for local provider...'
        });
        return await this.analyzeWithCustomPromptChunked(text, systemPrompt, userPrompt, onProgress, language);
      }
    } catch (error) {
      onProgress({
        step: 'error',
        progress: 0,
        message: `Custom analysis failed: ${error.message}`
      });
      throw error;
    }
  }

  /**
   * Analyze with custom prompt using chunking
   * @param {string} text - Text to analyze
   * @param {string} systemPrompt - System prompt
   * @param {string} userPrompt - User prompt template
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<string>} - Combined analysis result
   */
  async analyzeWithCustomPromptChunked(text, systemPrompt, userPrompt, onProgress, language = 'en') {
    const chunks = this.chunkText(text, {
      preserveScenes: false, // For custom analysis, simple chunking is usually better
      maxTokens: 2000 // Smaller chunks for local AI reliability
    });

    const chunkResults = [];
    const totalChunks = chunks.length;

    onProgress({
      step: 'chunking',
      progress: 10,
      message: `Split into ${totalChunks} chunks. Analyzing...`
    });

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkNumber = i + 1;

      onProgress({
        step: 'chunk',
        progress: 10 + (60 * i / totalChunks),
        message: `Analyzing chunk ${chunkNumber}/${totalChunks}...`,
        chunkNumber,
        totalChunks
      });

      const combinedUserPrompt = `${userPrompt}

This is chunk ${chunkNumber} of ${totalChunks} from a larger text. Please analyze this section. IMPORTANT: Provide the response in ${language} language.

${chunk.text}`;

      const chunkResult = await this.generateText(systemPrompt, combinedUserPrompt, {
        maxTokens: 2000,
        temperature: 0.1,
      });

      chunkResults.push({
        chunkNumber,
        content: chunkResult,
        metadata: chunk.metadata
      });

      // Add small delay to prevent rate limiting
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    onProgress({
      step: 'combining',
      progress: 80,
      message: 'Combining chunk results...'
    });

    // Combine all chunk results
    const combinedResult = await this.combineCustomPromptResults(chunkResults, systemPrompt, language);

    onProgress({
      step: 'complete',
      progress: 100,
      message: 'Custom analysis complete!'
    });

    return combinedResult;
  }

  /**
   * Combine results from custom prompt chunks
   * @param {Array} chunkResults - Results from each chunk
   * @param {string} systemPrompt - Original system prompt for context
   * @param {string} language - Language for the output
   * @returns {Promise<string>} - Combined result
   */
  async combineCustomPromptResults(chunkResults, systemPrompt, language = 'en') {
    const combinerSystemPrompt = `You are an expert text analyst. Your task is to combine and synthesize analysis results from multiple chunks of text into a comprehensive final analysis.

Original analysis instructions: ${systemPrompt}

Please create a cohesive, comprehensive analysis by:
1. Identifying common themes and patterns across chunks
2. Removing redundancy while preserving important details
3. Creating a logical flow and structure
4. Maintaining the analytical depth and quality

IMPORTANT: The final output MUST be in ${language} language.`;

    const chunkSummaries = chunkResults.map(result =>
      `Chunk ${result.chunkNumber}:\n${result.content}\n`
    ).join('\n---\n\n');

    const combinerUserPrompt = `Please combine and synthesize these analysis results into a comprehensive final analysis:

${chunkSummaries}`;

    return await this.generateText(combinerSystemPrompt, combinerUserPrompt, {
      maxTokens: 4000,
      temperature: 0.1,
    });
  }

  /**
   * Analyze a single chunk
   * @param {object} chunk - Text chunk with metadata
   * @param {number} chunkNumber - Current chunk number
   * @param {number} totalChunks - Total number of chunks
   * @returns {Promise<object>} - Chunk analysis result
   */
  async analyzeChunk(chunk, chunkNumber, totalChunks) {
    const systemPrompt = `You are a professional screenplay analyst. You are analyzing chunk ${chunkNumber} of ${totalChunks} from a larger screenplay. Focus on this specific section but be aware it's part of a larger work.

Return a valid JSON object with the following structure:
{
  "scenes": [
    {
      "number": 1,
      "header": "INT. BEDROOM - NIGHT",
      "intExt": "INT",
      "location": "BEDROOM", 
      "timeOfDay": "NIGHT",
      "characters": ["CHARACTER1", "CHARACTER2"],
      "estimatedDuration": 2,
      "description": "Brief scene description",
      "chunkRelative": true
    }
  ],
  "locations": [
    {
      "name": "BEDROOM",
      "type": "INT", 
      "sceneCount": 1,
      "estimatedShootingDays": 0.5
    }
  ],
  "characters": [
    {
      "name": "CHARACTER NAME",
      "sceneCount": 5,
      "description": "Brief character description"
    }
  ],
  "equipment": [
    {
      "item": "Camera crane",
      "scenes": [1, 5],
      "reason": "High angle shot mentioned" 
    }
  ],
  "partialSummary": {
    "scenesInChunk": 3,
    "estimatedChunkRuntime": 15,
    "newCharactersIntroduced": ["CHARACTER1"],
    "keyEvents": ["Brief description of important events in this chunk"]
  }
}

Return ONLY valid JSON, no additional text.`;

    const userPrompt = `Analyze this screenplay chunk and provide a detailed breakdown. This is chunk ${chunkNumber} of ${totalChunks}:

${chunk.text}`;

    const response = await this.generateText(systemPrompt, userPrompt, {
      maxTokens: 3000,
      temperature: 0.1,
    });

    try {
      const cleanedResponse = response.replace(/```json\s*|\s*```/g, '').trim();
      return JSON.parse(cleanedResponse);
    } catch (error) {
      console.error('Failed to parse chunk analysis response:', error);
      throw new Error(`Failed to parse chunk ${chunkNumber} analysis data`);
    }
  }

  /**
   * Determine if chunking should be used based on text size and provider capabilities
   * @param {string} text - Text to analyze
   * @param {boolean} forceChunking - Force chunking regardless of size
   * @returns {boolean} - Whether to use chunking
   */
  shouldUseChunking(text, forceChunking = false) {
    if (forceChunking) return true;

    // Cloud providers (OpenAI, Gemini) have very large context windows
    // No need for chunking - they handle long texts efficiently
    if (this.provider === AI_PROVIDERS.OPENAI || this.provider === AI_PROVIDERS.GEMINI) {
      console.log(`Skipping chunking for cloud provider: ${this.provider} (large context window)`);
      return false;
    }

    // Only chunk for local providers with moderately long texts
    const thresholds = {
      [AI_PROVIDERS.LOCAL]: 8000,   // ~2000 tokens (local models benefit from smaller chunks)
      [AI_PROVIDERS.MLX]: 8000,     // ~2000 tokens (local models benefit from smaller chunks)
    };

    const threshold = thresholds[this.provider] || 20000;
    const shouldChunk = text.length > threshold;

    if (shouldChunk) {
      console.log(`Text length ${text.length} > threshold ${threshold}, using chunking for local provider`);
    }

    return shouldChunk;
  }

  /**
   * Combine multiple chunk analyses into a single comprehensive result
   * @param {Array} chunkResults - Array of chunk analysis results
   * @param {string} originalText - Original full text for reference
   * @returns {object} - Combined analysis result
   */
  combineChunkAnalyses(chunkResults, originalText) {
    const validResults = chunkResults.filter(result => !result.error);

    if (validResults.length === 0) {
      throw new Error('No valid chunk analyses to combine');
    }

    // Combine scenes
    const allScenes = [];
    let sceneNumberOffset = 0;

    for (const result of validResults) {
      if (result.scenes) {
        const adjustedScenes = result.scenes.map(scene => ({
          ...scene,
          number: scene.number + sceneNumberOffset,
          chunkIndex: result.chunkIndex,
        }));
        allScenes.push(...adjustedScenes);
        sceneNumberOffset = Math.max(sceneNumberOffset, ...result.scenes.map(s => s.number));
      }
    }

    // Combine and deduplicate locations
    const locationMap = new Map();
    for (const result of validResults) {
      if (result.locations) {
        for (const location of result.locations) {
          const key = `${location.type}-${location.name}`;
          if (locationMap.has(key)) {
            const existing = locationMap.get(key);
            existing.sceneCount += location.sceneCount;
            existing.estimatedShootingDays += location.estimatedShootingDays;
          } else {
            locationMap.set(key, { ...location });
          }
        }
      }
    }

    // Combine and deduplicate characters
    const characterMap = new Map();
    for (const result of validResults) {
      if (result.characters) {
        for (const character of result.characters) {
          if (characterMap.has(character.name)) {
            const existing = characterMap.get(character.name);
            existing.sceneCount += character.sceneCount;
            // Keep the most detailed description
            if (character.description && character.description.length > existing.description.length) {
              existing.description = character.description;
            }
          } else {
            characterMap.set(character.name, { ...character });
          }
        }
      }
    }

    // Combine equipment
    const allEquipment = [];
    for (const result of validResults) {
      if (result.equipment) {
        allEquipment.push(...result.equipment.map(eq => ({
          ...eq,
          chunkIndex: result.chunkIndex,
        })));
      }
    }

    // Create combined summary
    const totalScenes = allScenes.length;
    const estimatedRuntime = validResults.reduce((sum, result) => {
      return sum + (result.partialSummary?.estimatedChunkRuntime || 0);
    }, 0);

    // Estimate shooting days based on locations and scenes
    const estimatedShootingDays = Array.from(locationMap.values()).reduce((sum, loc) => {
      return sum + (loc.estimatedShootingDays || 0);
    }, 0);

    return {
      scenes: allScenes,
      locations: Array.from(locationMap.values()),
      characters: Array.from(characterMap.values()),
      equipment: allEquipment,
      summary: {
        totalScenes,
        estimatedRuntime: Math.round(estimatedRuntime),
        estimatedShootingDays: Math.round(estimatedShootingDays * 10) / 10,
        chunksAnalyzed: validResults.length,
        chunksWithErrors: chunkResults.length - validResults.length,
      },
      chunkingInfo: {
        totalChunks: chunkResults.length,
        successfulChunks: validResults.length,
        failedChunks: chunkResults.length - validResults.length,
        chunkDetails: chunkResults.map(result => ({
          chunkIndex: result.chunkIndex,
          success: !result.error,
          error: result.error,
          chunkInfo: result.chunkInfo,
        })),
      },
    };
  }

  /**
   * Enhanced Screenplay Analysis
   * Combines AI analysis with advanced NLP processing
   */
  async analyzeScreenplayEnhanced(text, scenes = [], characters = [], options = {}) {
    return await this.enhancedAnalysisEngine.analyzeScreenplayEnhanced(
      text,
      scenes,
      characters,
      options
    );
  }
}

/**
 * Grammar correction levels for different use cases
 */
export const GRAMMAR_LEVELS = {
  BASIC: 'basic',
  STANDARD: 'standard',
  ADVANCED: 'advanced',
  PRESERVE_STYLE: 'preserve_style',
};

/**
 * Specialized prompts for screenplay tasks
 */
export const SCREENPLAY_PROMPTS = {
  GRAMMAR_CORRECTION: {
    system: {
      [GRAMMAR_LEVELS.BASIC]: `Sen bir metin düzeltme asistanısın. SADECE açık yazım hatalarını düzelt, METNİN TAMAMINI AYNEN KORU.

KESİN KURALLAR:
- SADECE yanlış yazılmış kelimeleri düzelt (örn: "teh" → "the", "oalcak" → "olacak")
- SADECE bariz dilbilgisi hatalarını düzelt
- TÜM metni AYNEN koru - hiçbir kelime, cümle veya satır kaybetme
- TÜM formatı AYNEN koru
- Cümleleri yeniden YAZMA
- YORUM YAPMA, açıklama EKLEME
- Girdi metnin TAMAMEN aynı uzunlukta olmasını sağla
- SADECE düzeltilmiş metni döndür

You are a text correction assistant. Fix ONLY obvious typos, KEEP ALL TEXT EXACTLY.

STRICT RULES:
- Fix ONLY misspelled words
- Fix ONLY obvious grammar errors
- Keep ALL text EXACTLY - do not lose any words, sentences, or lines
- Keep ALL formatting EXACTLY
- Do NOT rewrite sentences
- Do NOT add comments
- Ensure output is EXACTLY same length as input
- Return ONLY the corrected text`,

      [GRAMMAR_LEVELS.STANDARD]: `Sen profesyonel bir metin editörüsün. SADECE yazım hatalarını düzelt, METNİ TAMAMEN KORU.

KESİN KURALLAR:
- HER SATIRI AYNEN koru - hiçbir satır kaybetme
- TÜM formatı koru (sahne başlıkları, karakter isimleri, parantezler)
- SADECE yazım, dilbilgisi, noktalama hatalarını düzelt
- Yazım stilini DEĞİŞTİRME
- Sahne ekleme/çıkarma YAPMA
- YORUM YAPMA, açıklama EKLEME
- Girdi ile çıktı aynı uzunlukta olmalı
- SADECE düzeltilmiş metni döndür

You are a professional text editor. Fix ONLY typos, keep text COMPLETELY intact.

STRICT RULES:
- Keep EVERY LINE EXACTLY - do not lose any lines
- Keep ALL formatting
- Fix ONLY spelling, grammar, punctuation errors
- Do NOT change style
- Do NOT add/remove content
- Do NOT add comments
- Output must be same length as input
- Return ONLY corrected text`,

      [GRAMMAR_LEVELS.ADVANCED]: `Sen profesyonel senaryo editörüsün. Düzelt ama TÜM içeriği AYNEN koru.

KESİN KURALLAR:
- TÜM format yapısını AYNEN koru
- HER KELİMEYİ koru - hiçbir kelime kaybetme
- Yazarın sesini koru
- Tüm sahne başlıklarını, karakter isimlerini koru
- SADECE düzeltilmiş metni döndür, yorum EKLEME
- Girdi ve çıktı aynı uzunlukta olmalı

You are a professional screenplay editor. Fix but keep ALL content EXACTLY.

STRICT RULES:
- Keep ALL format structure EXACTLY
- Keep EVERY WORD - do not lose any words
- Maintain author's voice
- Preserve all scene headers, character names
- Return ONLY corrected text, NO comments
- Input and output must be same length`,

      [GRAMMAR_LEVELS.PRESERVE_STYLE]: `Sen nazik bir metin editörüsün. SADECE açık hataları düzelt, TÜM metni AYNEN koru.

NE DÜZELT:
- Yanlış yazılmış kelimeler ("teh" → "the", "oalcak" → "olacak")
- Temel dilbilgisi hataları

NE DEĞİŞTİRME:
- Yazım stili
- Cümle yapısı
- Kelime seçimleri
- Format
- HİÇBİR YORUMLAMA YAPMA
- Hiçbir içerik kaybetme

SADECE düzeltilmiş metni döndür, girdi uzunluğunu koru.

You are a gentle text editor. Fix ONLY clear mistakes, keep ALL text EXACTLY.

Return ONLY corrected text, preserve input length.`,
    },

    buildUserPrompt: (text, level = GRAMMAR_LEVELS.STANDARD) => {
      const prompts = {
        [GRAMMAR_LEVELS.BASIC]: `SADECE bariz yazım hatalarını düzelt, TÜM metni AYNEN koru, YORUM YAPMA, AYNI UZUNLUKTA DÖNDÜR:\n\nFix ONLY obvious typos, keep ALL text EXACTLY, NO comments, RETURN SAME LENGTH:\n\n${text}`,
        [GRAMMAR_LEVELS.STANDARD]: `SADECE yazım hatalarını düzelt, TÜM içeriği AYNEN koru, YORUMLAMA, AYNI UZUNLUKTA:\n\nFix ONLY typos, keep ALL content EXACTLY, NO interpretation, SAME LENGTH:\n\n${text}`,
        [GRAMMAR_LEVELS.ADVANCED]: `Düzelt ama TÜM kelime ve satırları AYNEN koru, YORUM YOK, AYNI UZUNLUK:\n\nFix but keep ALL words and lines EXACTLY, NO comments, SAME LENGTH:\n\n${text}`,
        [GRAMMAR_LEVELS.PRESERVE_STYLE]: `SADECE açık hataları düzelt, geri kalanı AYNEN koru, YORUM YAPMA, AYNI UZUNLUK:\n\nFix ONLY clear errors, keep rest EXACTLY, NO comments, SAME LENGTH:\n\n${text}`,
      };

      return prompts[level] || prompts[GRAMMAR_LEVELS.STANDARD];
    },
  },

  SCENE_ANALYSIS: {
    system: `You are an expert screenplay analyst and production coordinator. Analyze the provided screenplay and extract structured information for production planning.

Return a valid JSON object with the following structure:
{
  "scenes": [
    {
      "number": 1,
      "header": "INT. BEDROOM - NIGHT",
      "intExt": "INT",
      "location": "BEDROOM",
      "timeOfDay": "NIGHT",
      "characters": ["CHARACTER1"],
      "estimatedDuration": 2,
      "description": "Brief scene description"
    }
  ],
  "locations": [
    {
      "name": "BEDROOM",
      "type": "INT",
      "sceneCount": 1,
      "estimatedShootingDays": 0.5
    }
  ],
  "characters": [
    {
      "name": "CHARACTER NAME",
      "sceneCount": 5,
      "description": "Brief character description"
    }
  ],
  "equipment": [
    {
      "item": "Camera crane",
      "scenes": [1, 5],
      "reason": "High angle shot mentioned"
    }
  ],
  "summary": {
    "totalScenes": 10,
    "estimatedRuntime": 90,
    "estimatedShootingDays": 15
  }
}

Return ONLY valid JSON, no additional text or markdown.`,

    buildUserPrompt: (text) =>
      `Analyze this screenplay and provide a detailed breakdown:\n\n${text.substring(0, 50000)}`,
  },
};

export default AIHandler;
