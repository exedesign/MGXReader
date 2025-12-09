// Test script for image generation functionality
const AIHandler = require('./src/renderer/utils/aiHandler.js').default;

async function testImageGeneration() {
  console.log('🧪 Testing Gemini Image Generation...');
  
  // Use your actual API key (replace with yours)
  const apiKey = 'AIzaSyC8EPYEUQc0PDp3BpX5lQOOhY0wfkghgtUQ';
  
  const aiHandler = new AIHandler({
    provider: 'gemini',
    apiKey: apiKey,
    imageModel: 'gemini-3-pro-image-preview'
  });
  
  try {
    console.log('🎨 Generating test character image...');
    
    const result = await aiHandler.generateImage(
      'Professional character portrait of a young diplomat, 25-30 years old, wearing Ottoman-era official clothing, energetic expression, cinematic portrait, professional lighting, 4K quality',
      {
        character: 'test',
        aspectRatio: '3:4',
        imageSize: '2K'
      }
    );
    
    console.log('✅ Image generation result:', {
      success: result.success,
      hasImageData: !!result.imageData,
      mimeType: result.mimeType,
      dataLength: result.imageData ? result.imageData.length : 0,
      provider: result.provider
    });
    
    if (result.imageData) {
      console.log('🎉 Image generation successful!');
      console.log('📊 Data preview:', result.imageData.substring(0, 100) + '...');
    }
    
  } catch (error) {
    console.error('❌ Image generation failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testImageGeneration();