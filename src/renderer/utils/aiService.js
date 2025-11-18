import axios from 'axios';

/**
 * Call OpenAI API for text correction or analysis
 * @param {string} apiKey - OpenAI API key
 * @param {string} prompt - The prompt to send
 * @param {string} systemPrompt - System prompt
 * @returns {Promise<string>} - API response
 */
export async function callOpenAI(apiKey, prompt, systemPrompt = 'You are a helpful assistant.') {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
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
export async function analyzeScreenplay(text, apiKey, provider = 'openai') {
  const systemPrompt = `You are an expert screenplay analyst and production coordinator. Analyze the provided screenplay and extract structured information for production planning. Return a valid JSON object only, no additional text.`;

  const prompt = `Analyze this screenplay and provide a detailed breakdown in the following JSON format:

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
