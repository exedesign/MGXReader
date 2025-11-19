/**
 * AIHandler - Unified AI Gateway
 * Supports: OpenAI, Google Gemini, Local AI (Ollama/LM Studio)
 */

import axios from 'axios';

export const AI_PROVIDERS = {
  OPENAI: 'openai',
  GEMINI: 'gemini',
  LOCAL: 'local',
  MLX: 'mlx',
};

export const OPENAI_MODELS = [
  { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo', contextWindow: 128000 },
  { id: 'gpt-4', name: 'GPT-4', contextWindow: 8192 },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', contextWindow: 16385 },
];

export const GEMINI_MODELS = [
  { id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro (Latest)', contextWindow: 2000000, recommended: true },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 2000000 },
  { id: 'gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash (Latest)', contextWindow: 1000000 },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1000000 },
  { id: 'gemini-pro', name: 'Gemini Pro (Legacy)', contextWindow: 32000 },
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
        model: this.model || 'gpt-4-turbo-preview',
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
   * Google Gemini API Call (Updated to v1 API - November 2025)
   */
  async callGemini(systemPrompt, userPrompt, temperature, maxTokens) {
    if (!this.apiKey) {
      throw new Error('Google API key is required');
    }

    // Use the latest v1 API endpoint
    const model = this.model || 'gemini-1.5-pro-latest';
    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`;

    // Gemini v1 API format with system instruction support
    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${systemPrompt}\n\n${userPrompt}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: temperature,
        maxOutputTokens: maxTokens,
        topP: 0.95,
        topK: 40,
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_NONE',
        },
      ],
    };

    try {
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
      if (error.response) {
        // API returned an error response
        const errorMessage = error.response.data?.error?.message || error.response.statusText;
        throw new Error(`Gemini API Error (${error.response.status}): ${errorMessage}`);
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
        timeout: 180000, // 3 minutes timeout for local inference (increased from 2 min)
      }
    );

    return response.data.choices[0].message.content;
  }

  /**
   * Chunk-based Analysis for Local Models (MLX, Ollama)
   * Splits long text into manageable chunks for better analysis
   */
  async analyzeWithChunks(systemPrompt, fullText, options = {}) {
    const {
      chunkSize = 3000, // ~3000 characters per chunk (~750 words)
      overlapSize = 300, // Overlap to maintain context
      maxTokensPerChunk = 2000,
      temperature = this.temperature,
    } = options;

    // Check if we need chunking (only for MLX and LOCAL providers)
    const needsChunking = (this.provider === AI_PROVIDERS.MLX || this.provider === AI_PROVIDERS.LOCAL) 
                          && fullText.length > chunkSize;

    if (!needsChunking) {
      // For short texts or cloud providers, use normal flow
      return await this.generateText(systemPrompt, fullText, { temperature, maxTokens: 4000 });
    }

    console.log(`📦 Chunking enabled: Text length ${fullText.length} chars`);

    // Split text into chunks
    const chunks = this._splitIntoChunks(fullText, chunkSize, overlapSize);
    console.log(`📦 Created ${chunks.length} chunks for analysis`);

    // Analyze each chunk
    const chunkResults = [];
    for (let i = 0; i < chunks.length; i++) {
      console.log(`📦 Analyzing chunk ${i + 1}/${chunks.length}...`);
      
      const chunkPrompt = `${systemPrompt}

IMPORTANT: You are analyzing PART ${i + 1} of ${chunks.length} of a larger screenplay.
Focus on extracting structured data from this section only.

Text to analyze:
${chunks[i]}`;

      try {
        const result = await this.generateText(
          'You are a screenplay analysis expert.',
          chunkPrompt,
          { temperature, maxTokens: maxTokensPerChunk }
        );
        chunkResults.push(result);
        
        // Delay between chunks - longer for local models
        const delay = (this.provider === AI_PROVIDERS.MLX || this.provider === AI_PROVIDERS.LOCAL) ? 1000 : 300;
        console.log(`⏳ Waiting ${delay}ms before next chunk...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (error) {
        console.error(`❌ Error analyzing chunk ${i + 1}:`, error.message);
        // Don't add error chunks to results - just skip them
        console.warn(`⚠️ Skipping chunk ${i + 1} due to error`);
      }
    }

    // Merge results
    console.log(`📦 Merging ${chunkResults.length} chunk results...`);
    const mergedResult = await this._mergeChunkResults(systemPrompt, chunkResults, temperature);
    
    return mergedResult;
  }

  /**
   * Split text into overlapping chunks
   */
  _splitIntoChunks(text, chunkSize, overlapSize) {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const chunk = text.substring(start, end);
      
      // Try to break at sentence boundaries
      let breakPoint = end;
      if (end < text.length) {
        const lastPeriod = chunk.lastIndexOf('.');
        const lastNewline = chunk.lastIndexOf('\n\n');
        breakPoint = Math.max(lastPeriod, lastNewline);
        
        if (breakPoint > start + (chunkSize * 0.7)) {
          chunks.push(text.substring(start, start + breakPoint + 1));
          start = start + breakPoint + 1 - overlapSize;
        } else {
          chunks.push(chunk);
          start = end - overlapSize;
        }
      } else {
        chunks.push(chunk);
        break;
      }
    }

    return chunks;
  }

  /**
   * Merge chunk analysis results into a coherent final analysis
   * Simplified merge strategy for better reliability
   */
  async _mergeChunkResults(systemPrompt, chunkResults, temperature) {
    console.log(`📦 Starting merge of ${chunkResults.length} chunks...`);
    
    // For MLX and local models, use simple concatenation strategy
    // instead of AI merge to avoid timeout and complexity
    if (this.provider === AI_PROVIDERS.MLX || this.provider === AI_PROVIDERS.LOCAL) {
      console.log('📦 Using simple merge strategy for local model...');
      return this._simpleChunkMerge(chunkResults);
    }

    // For cloud providers, try AI-based merge with shorter timeout
    try {
      const mergePrompt = `Merge these screenplay analysis parts into ONE JSON.
Parts: ${chunkResults.length}

${chunkResults.slice(0, 5).map((r, i) => `Part ${i + 1}:\n${r.substring(0, 500)}`).join('\n\n')}

Return only valid JSON.`;

      const merged = await this.generateText(
        'You are merging screenplay data.',
        mergePrompt,
        { temperature: 0.1, maxTokens: 2000 }
      );
      return merged;
    } catch (error) {
      console.error('AI merge failed, using simple merge:', error);
      return this._simpleChunkMerge(chunkResults);
    }
  }

  /**
   * Simple merge strategy: combine all chunk results manually
   */
  _simpleChunkMerge(chunkResults) {
    console.log('📦 Performing simple manual merge...');
    
    const merged = {
      scenes: [],
      locations: [],
      characters: [],
      equipment: [],
      summary: {
        totalScenes: 0,
        estimatedRuntime: 0,
        estimatedShootingDays: 0
      }
    };

    // Extract data from each chunk result
    for (let i = 0; i < chunkResults.length; i++) {
      try {
        const cleaned = chunkResults[i]
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        
        const data = JSON.parse(cleaned);
        
        // Merge scenes
        if (data.scenes && Array.isArray(data.scenes)) {
          merged.scenes.push(...data.scenes);
        }
        
        // Merge locations (with deduplication)
        if (data.locations && Array.isArray(data.locations)) {
          data.locations.forEach(loc => {
            if (!merged.locations.find(l => l.name === loc.name)) {
              merged.locations.push(loc);
            }
          });
        }
        
        // Merge characters (with deduplication)
        if (data.characters && Array.isArray(data.characters)) {
          data.characters.forEach(char => {
            const existing = merged.characters.find(c => c.name === char.name);
            if (existing) {
              existing.sceneCount += (char.sceneCount || 0);
            } else {
              merged.characters.push(char);
            }
          });
        }
        
        // Merge equipment
        if (data.equipment && Array.isArray(data.equipment)) {
          merged.equipment.push(...data.equipment);
        }
        
        console.log(`📦 Merged chunk ${i + 1}/${chunkResults.length}`);
      } catch (err) {
        console.warn(`⚠️ Could not parse chunk ${i + 1}, skipping:`, err.message);
      }
    }

    // Update summary
    merged.summary.totalScenes = merged.scenes.length;
    merged.summary.estimatedRuntime = merged.scenes.length * 2; // 2 min per scene
    merged.summary.estimatedShootingDays = Math.ceil(merged.scenes.length / 5); // 5 scenes per day

    console.log('✅ Merge complete:', {
      scenes: merged.scenes.length,
      characters: merged.characters.length,
      locations: merged.locations.length,
      equipment: merged.equipment.length
    });

    return JSON.stringify(merged, null, 2);
  }

  /**
   * Test connection to AI provider
   */
  async testConnection() {
    try {
      const testPrompt = 'Reply with only the word "OK" if you can read this.';
      const response = await this.generateText(
        'You are a helpful assistant.',
        testPrompt,
        { maxTokens: 10 }
      );
      
      return {
        success: true,
        response: response.trim(),
        provider: this.provider,
      };
    } catch (error) {
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
}

/**
 * Specialized prompts for screenplay tasks
 */
export const SCREENPLAY_PROMPTS = {
  GRAMMAR_CORRECTION: {
    system: `You are an expert screenplay editor. Your task is to correct grammar and spelling errors in screenplay text while maintaining the original formatting, structure, and style. 

IMPORTANT RULES:
- Keep ALL formatting intact (scene headings, character names, parentheticals, etc.)
- Only fix obvious grammar, spelling, and punctuation errors
- Do NOT change the writing style or creative choices
- Do NOT add or remove scenes
- Preserve the screenplay format (INT/EXT, character names in CAPS, etc.)
- Return ONLY the corrected text, no explanations`,
    
    buildUserPrompt: (text) => 
      `Please correct any grammar and spelling errors in the following screenplay text:\n\n${text}`,
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
