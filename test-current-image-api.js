/**
 * Test Current Image Generation API
 * Run this to test your current API setup
 */

const GEMINI_API_KEY = 'YOUR_API_KEY_HERE'; // Buraya API key'inizi yazın

async function testImageGeneration() {
  const model = 'gemini-2.5-flash-image';
  const prompt = 'A professional character portrait, cinematic lighting';

  console.log('🧪 Testing Image Generation API...');
  console.log('📝 Model:', model);
  console.log('📝 Prompt:', prompt);

  try {
    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        response_modalities: ["IMAGE"],
        temperature: 1.0,
        image_config: {
          aspect_ratio: "1:1",
          image_size: "1K"
        }
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_LOW_AND_ABOVE"
        }
      ]
    };

    console.log('\n📦 Request Body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      }
    );

    console.log('\n📡 Response Status:', response.status);

    const data = await response.json();
    
    if (!response.ok) {
      console.error('\n❌ API Error:', data);
      console.error('\n🔍 Error Details:', JSON.stringify(data, null, 2));
      return;
    }

    console.log('\n✅ Success! Response:', JSON.stringify(data, null, 2));

    // Check for image data
    const candidate = data.candidates?.[0];
    if (candidate?.content?.parts) {
      const imageParts = candidate.content.parts.filter(part => 
        part.inline_data || part.inlineData
      );
      
      console.log(`\n🖼️ Found ${imageParts.length} image(s) in response`);
      
      if (imageParts.length > 0) {
        console.log('✅ Image generation successful!');
      } else {
        console.log('⚠️ No images found in response');
      }
    }

  } catch (error) {
    console.error('\n💥 Exception:', error.message);
    console.error(error);
  }
}

// Run the test
testImageGeneration();
