import axios from 'axios';
import { splitTextForAnalysis, getOptimalChunkSize } from './textProcessing.js';

/**
 * Call OpenAI API for text correction or analysis
 * @param {string} apiKey - OpenAI API key
 * @param {string} prompt - The prompt to send
 * @param {string} systemPrompt - System prompt
 * @returns {Promise<string>} - API response
        max_tokens: 4000,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw new Error(error.response?.data?.error?.message || 'API call failed');
  }
}

/**
 * Call Claude API for text correction or analysis
 * @param {string} apiKey - Anthropic API key
 * @param {string} prompt - The prompt to send
 * @param {string} systemPrompt - System prompt
 * @returns {Promise<string>} - API response
 */
export async function callClaude(apiKey, prompt, systemPrompt = 'You are a helpful assistant.') {
  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-opus-20240229',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      }
    );

    return response.data.content[0].text;
  } catch (error) {
    console.error('Claude API Error:', error);
    throw new Error(error.response?.data?.error?.message || 'API call failed');
  }
}

/**
 * Correct grammar and spelling in screenplay text
 * @param {string} text - Text to correct
 * @param {string} apiKey - API key
 * @param {string} provider - 'openai' or 'claude'
 * @returns {Promise<string>} - Corrected text
 */
export async function correctText(text, apiKey, provider = 'openai') {
  const systemPrompt = `You are an expert screenplay editor. Correct grammar and spelling errors in the provided screenplay text while maintaining the original formatting, structure, and style. Only fix obvious errors. Return ONLY the corrected text without any explanations or comments.`;

  const prompt = `Please correct any grammar and spelling errors in the following screenplay text:\n\n${text}`;

  if (provider === 'openai') {
    return await callOpenAI(apiKey, prompt, systemPrompt);
  } else {
    return await callClaude(apiKey, prompt, systemPrompt);
  }
}

/**
 * Analyze screenplay and generate breakdown
 * @param {string} text - Screenplay text
 * @param {string} apiKey - API key
 * @param {string} provider - 'openai' or 'claude'
 * @returns {Promise<object>} - Analysis data
 */
export async function analyzeScreenplay(text, apiKey, provider = 'openai', language = 'en') {
  const systemPrompt = `You are an expert screenplay analyst and production coordinator. Analyze the provided screenplay and extract structured information for production planning. Return a valid JSON object only, no additional text. Ensure all text content in the JSON is in ${language} language.`;

  const prompt = `Analyze this screenplay and provide a detailed breakdown in the following JSON format. Ensure all descriptions and text are in ${language}:

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

Screenplay text:

${text.substring(0, 15000)}`;

  let response;
  if (provider === 'openai') {
    response = await callOpenAI(apiKey, prompt, systemPrompt);
  } else {
    response = await callClaude(apiKey, prompt, systemPrompt);
  }

  // Parse JSON response
  try {
    // Remove markdown code blocks if present
    const cleanedResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    return JSON.parse(cleanedResponse);
  } catch (error) {
    console.error('Failed to parse analysis response:', error);
    throw new Error('Failed to parse analysis data');
  }
}

/**
 * Analyze screenplay with chunking support for large texts
 * @param {string} text - Screenplay text
 * @param {string} provider - AI provider
 * @param {string} apiKey - API key
 * @param {object} options - Analysis options
 * @returns {Promise<object>} - Combined analysis result
 */
export async function analyzeScreenplayWithChunking(text, provider, apiKey, options = {}) {
  const {
    useChunking = true,
    onProgress = () => { },
    model = '',
  } = options;

  try {
    // If text is small enough or chunking is disabled, use regular analysis
    if (!useChunking || text.length < 10000) {
      onProgress({ step: 'analyzing', progress: 0, message: 'Analyzing screenplay...' });
      const result = await analyzeScreenplay(text, apiKey, provider, options.language);
      onProgress({ step: 'complete', progress: 100, message: 'Analysis complete' });
      return result;
    }

    // Get optimal chunk size for the provider
    const chunkOptions = getOptimalChunkSize(provider, model);

    onProgress({
      step: 'chunking',
      progress: 5,
      message: 'Splitting screenplay into manageable chunks...'
    });

    // Split text into chunks
    const chunks = splitTextForAnalysis(text, chunkOptions);

    if (chunks.length === 0) {
      throw new Error('No text chunks created');
    }

    if (chunks.length === 1) {
      // Only one chunk, use regular analysis
      onProgress({ step: 'analyzing', progress: 10, message: 'Analyzing screenplay...' });
      const result = await analyzeScreenplay(chunks[0].text, apiKey, provider, options.language);
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
        const chunkResult = await analyzeChunk(chunk, provider, apiKey, i + 1, totalChunks, options.language);
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

        // Add small delay to avoid rate limiting
        if (i < chunks.length - 1) {
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

    // Combine chunk results
    const combinedResult = combineChunkAnalyses(chunkResults, text);

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
 * Analyze a single chunk of text
 * @param {object} chunk - Text chunk with metadata
 * @param {string} provider - AI provider
 * @param {string} apiKey - API key
 * @param {number} chunkNumber - Current chunk number
 * @param {number} totalChunks - Total number of chunks
 * @returns {Promise<object>} - Chunk analysis result
 */
async function analyzeChunk(chunk, provider, apiKey, chunkNumber, totalChunks, language = 'en') {
  const systemPrompt = `You are a professional screenplay analyst. You are analyzing chunk ${chunkNumber} of ${totalChunks} from a larger screenplay. Focus on this specific section but be aware it's part of a larger work. Ensure all output is in ${language}.`;

  const prompt = `Analyze this screenplay chunk and provide a detailed breakdown in the following JSON format. This is chunk ${chunkNumber} of ${totalChunks}, so focus on this section specifically. Ensure all text content is in ${language}:

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

Screenplay chunk text:

${chunk.text}`;

  let response;
  if (provider === 'openai') {
    response = await callOpenAI(apiKey, prompt, systemPrompt);
  } else if (provider === 'gemini') {
    response = await callGemini(apiKey, prompt, systemPrompt);
  } else if (provider === 'local') {
    response = await callLocalAI(prompt, systemPrompt);
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  try {
    const cleanedResponse = response.replace(/```json\s*|\s*```/g, '').trim();
    return JSON.parse(cleanedResponse);
  } catch (error) {
    console.error('Failed to parse chunk analysis response:', error);
    throw new Error(`Failed to parse chunk ${chunkNumber} analysis data`);
  }
}

/**
 * Combine multiple chunk analyses into a single comprehensive result
 * @param {Array} chunkResults - Array of chunk analysis results
 * @param {string} originalText - Original full text for reference
 * @returns {object} - Combined analysis result
 */
function combineChunkAnalyses(chunkResults, originalText) {
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
