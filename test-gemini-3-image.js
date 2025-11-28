// Gemini 3 Pro Image API Test
// Test gemini-3-pro-image-preview model for image generation

import axios from 'axios';

const GEMINI_API_KEY = 'YOUR_API_KEY_HERE'; // Replace with actual key
const MODEL = 'gemini-3-pro-image-preview';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

async function testGeminiImageGeneration() {
  console.log('🎨 Testing Gemini 3 Pro Image Generation...\n');

  const prompt = 'A cyberpunk cityscape at night, neon lights, rain, cinematic composition, 4K quality';

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: prompt
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.8,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192
    },
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH", 
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      }
    ]
  };

  try {
    console.log('📤 Sending request to:', API_URL);
    console.log('📝 Prompt:', prompt);
    console.log('\n⏳ Waiting for response...\n');

    const response = await axios.post(API_URL, requestBody, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 120000 // 2 minutes
    });

    console.log('✅ Response received!\n');

    if (response.data.candidates && response.data.candidates.length > 0) {
      const candidate = response.data.candidates[0];

      console.log('🔍 Finish Reason:', candidate.finishReason);
      
      if (candidate.finishReason === 'SAFETY') {
        console.error('❌ Response blocked by safety filters!');
        console.log('Safety Ratings:', candidate.safetyRatings);
        return;
      }

      if (candidate.content && candidate.content.parts) {
        console.log('📦 Parts received:', candidate.content.parts.length);

        // Look for inline image data
        const imagePart = candidate.content.parts.find(part => part.inlineData);
        
        if (imagePart && imagePart.inlineData) {
          console.log('\n🎉 IMAGE GENERATION SUCCESSFUL!');
          console.log('📊 MIME Type:', imagePart.inlineData.mimeType);
          console.log('📏 Data Length:', imagePart.inlineData.data.length, 'characters');
          console.log('💾 Base64 Data Preview:', imagePart.inlineData.data.substring(0, 100) + '...');
          
          // Test base64 decode
          try {
            const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
            console.log('✅ Base64 decode successful!');
            console.log('📦 Image size:', buffer.length, 'bytes', '≈', Math.round(buffer.length / 1024), 'KB');
            
            // You can save this to file:
            // import fs from 'fs';
            // fs.writeFileSync('test-output.png', buffer);
            // console.log('💾 Image saved to test-output.png');
          } catch (decodeErr) {
            console.error('❌ Base64 decode failed:', decodeErr.message);
          }
          
          return {
            success: true,
            imageData: imagePart.inlineData.data,
            mimeType: imagePart.inlineData.mimeType,
            prompt: prompt
          };
        } else {
          console.log('❓ No inline image data found in response');
          console.log('📦 Parts structure:', JSON.stringify(candidate.content.parts, null, 2));
        }
      }
    }

    console.error('❌ No valid candidates in response');
    console.log('📄 Full response:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('\n❌ ERROR:');
    console.error('Message:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Status Text:', error.response.statusText);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
    
    if (error.code === 'ECONNABORTED') {
      console.error('⏱️ Request timed out after 2 minutes');
    }
  }
}

// Test different prompts
async function testMultiplePrompts() {
  const prompts = [
    'A cyberpunk cityscape at night, neon lights, rain, cinematic composition',
    'Medieval castle on a cliff, sunset, dramatic clouds, fantasy art style',
    'Futuristic spaceship interior, sci-fi, clean design, blue lighting',
    'Film noir detective in dark alley, 1940s style, black and white, dramatic shadows'
  ];

  console.log('🧪 Testing multiple prompts...\n');

  for (let i = 0; i < prompts.length; i++) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`TEST ${i + 1}/${prompts.length}`);
    console.log('='.repeat(80));
    
    const result = await testGeminiImageGeneration(prompts[i]);
    
    if (result && result.success) {
      console.log('✅ Test passed!');
    } else {
      console.log('❌ Test failed!');
    }
    
    // Wait 5 seconds between requests to avoid rate limits
    if (i < prompts.length - 1) {
      console.log('\n⏳ Waiting 5 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Check API key availability
function checkAPIKey() {
  if (GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
    console.error('❌ ERROR: Please replace YOUR_API_KEY_HERE with your actual Gemini API key');
    console.log('\n📖 How to get API key:');
    console.log('1. Go to https://aistudio.google.com/app/apikey');
    console.log('2. Sign in with Google account');
    console.log('3. Click "Get API Key"');
    console.log('4. Copy the key and replace YOUR_API_KEY_HERE in this file');
    return false;
  }
  return true;
}

// Main execution
if (checkAPIKey()) {
  console.log('🚀 Starting Gemini 3 Pro Image API Test\n');
  testGeminiImageGeneration()
    .then(() => {
      console.log('\n✨ Test completed!');
    })
    .catch(err => {
      console.error('\n💥 Fatal error:', err);
    });
  
  // Uncomment to test multiple prompts:
  // testMultiplePrompts();
} else {
  console.log('\n🛑 Test aborted - API key required');
}
