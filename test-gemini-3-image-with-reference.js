/**
 * Gemini 3 Pro Image Preview Test with Reference Images
 * Tests the new implementation for reference image support
 */

import AIHandler, { AI_PROVIDERS } from './src/renderer/utils/aiHandler.js';
import fs from 'fs';
import path from 'path';

// Test configuration
const GEMINI_API_KEY = 'YOUR_API_KEY_HERE'; // Replace with your actual API key
const TEST_CHARACTER = {
  name: 'Selim Bey',
  description: 'Orta yaşlı, güçlü karakter, ciddi bakış',
  age: '45',
  role: 'İş adamı'
};

// Function to convert image to base64
function imageToBase64(imagePath) {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64 = imageBuffer.toString('base64');
    const mimeType = path.extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
    return {
      data: `data:${mimeType};base64,${base64}`,
      mimeType: mimeType
    };
  } catch (error) {
    console.error('Error reading image:', error);
    return null;
  }
}

async function testGemini3ProImageGeneration() {
  console.log('🎨 Testing Gemini 3 Pro Image Preview with Reference Images...\n');

  // Create AI handler
  const aiHandler = new AIHandler({
    provider: AI_PROVIDERS.GEMINI,
    apiKey: GEMINI_API_KEY,
    model: 'gemini-3-pro-image-preview', // Use the new image generation model
    temperature: 0.7
  });

  try {
    // Test 1: Basic image generation
    console.log('📝 Test 1: Basic Character Image Generation');
    console.log('Character:', TEST_CHARACTER.name);
    
    const prompt1 = `Professional character portrait of ${TEST_CHARACTER.name}, ${TEST_CHARACTER.description}, ${TEST_CHARACTER.age} years old, ${TEST_CHARACTER.role}, cinematic portrait, professional lighting, 4K quality, detailed facial features`;
    
    console.log('Prompt:', prompt1);
    console.log('Generating image...');

    const startTime = Date.now();
    const result1 = await aiHandler.generateImage(prompt1, {
      aspectRatio: '3:4',
      imageSize: '2K'
    });
    const elapsed = Date.now() - startTime;

    if (result1 && result1.imageData) {
      console.log(`✅ Success! Image generated in ${elapsed}ms`);
      console.log(`📊 Image details:`);
      console.log(`   - MIME Type: ${result1.mimeType}`);
      console.log(`   - Data length: ${result1.imageData.length} characters`);
      console.log(`   - Timestamp: ${result1.timestamp}`);
      
      // Save image
      const imageBuffer = Buffer.from(result1.imageData, 'base64');
      const fileName = `test-output-${TEST_CHARACTER.name.replace(/\s+/g, '-')}-basic.png`;
      fs.writeFileSync(fileName, imageBuffer);
      console.log(`💾 Image saved as: ${fileName}`);
    } else {
      console.log('❌ Failed to generate image');
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Test 2: Image generation with reference image (if available)
    console.log('📝 Test 2: Image Generation with Reference Images');
    
    // Look for reference images in current directory
    const possibleReferenceImages = [
      'test-reference-1.jpg',
      'test-reference-1.png', 
      'reference.jpg',
      'reference.png',
      'character-ref.jpg',
      'character-ref.png'
    ];

    let referenceImages = [];
    for (const imageName of possibleReferenceImages) {
      if (fs.existsSync(imageName)) {
        const imageData = imageToBase64(imageName);
        if (imageData) {
          referenceImages.push({
            data: imageData.data,
            mimeType: imageData.mimeType,
            name: imageName
          });
          console.log(`📸 Found reference image: ${imageName}`);
        }
      }
    }

    if (referenceImages.length > 0) {
      const prompt2 = `Professional character portrait of ${TEST_CHARACTER.name}, similar style and composition to the reference images, ${TEST_CHARACTER.description}, cinematic portrait, professional lighting, 4K quality`;
      
      console.log(`Using ${referenceImages.length} reference image(s)`);
      console.log('Prompt:', prompt2);
      console.log('Generating image with references...');

      const startTime2 = Date.now();
      const result2 = await aiHandler.generateImage(prompt2, {
        aspectRatio: '3:4',
        imageSize: '2K',
        referenceImages: referenceImages
      });
      const elapsed2 = Date.now() - startTime2;

      if (result2 && result2.imageData) {
        console.log(`✅ Success! Image with references generated in ${elapsed2}ms`);
        console.log(`📊 Image details:`);
        console.log(`   - MIME Type: ${result2.mimeType}`);
        console.log(`   - Data length: ${result2.imageData.length} characters`);
        console.log(`   - Reference count: ${referenceImages.length}`);
        
        // Save image
        const imageBuffer2 = Buffer.from(result2.imageData, 'base64');
        const fileName2 = `test-output-${TEST_CHARACTER.name.replace(/\s+/g, '-')}-with-references.png`;
        fs.writeFileSync(fileName2, imageBuffer2);
        console.log(`💾 Image saved as: ${fileName2}`);
      } else {
        console.log('❌ Failed to generate image with references');
      }
    } else {
      console.log('⚠️ No reference images found. Put test-reference-1.jpg or reference.jpg in the current directory to test reference image support.');
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Test 3: Multiple aspect ratios
    console.log('📝 Test 3: Different Aspect Ratios');
    
    const aspectRatios = ['1:1', '16:9', '3:4'];
    
    for (const ratio of aspectRatios) {
      console.log(`Testing aspect ratio: ${ratio}`);
      
      const prompt3 = `Simple portrait of ${TEST_CHARACTER.name}, ${ratio} composition, professional lighting`;
      
      try {
        const result3 = await aiHandler.generateImage(prompt3, {
          aspectRatio: ratio,
          imageSize: '1K' // Smaller for faster testing
        });

        if (result3 && result3.imageData) {
          const fileName3 = `test-output-${ratio.replace(':', 'x')}.png`;
          const imageBuffer3 = Buffer.from(result3.imageData, 'base64');
          fs.writeFileSync(fileName3, imageBuffer3);
          console.log(`✅ ${ratio} image saved as: ${fileName3}`);
        }
      } catch (error) {
        console.log(`❌ Failed to generate ${ratio} image: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }

  console.log('\n🎯 Test completed!');
  console.log('\n📋 Instructions:');
  console.log('1. Replace GEMINI_API_KEY with your actual API key');
  console.log('2. Put reference images in this directory (test-reference-1.jpg, reference.jpg, etc.)');
  console.log('3. Run: node test-gemini-3-image-with-reference.js');
  console.log('4. Check generated images in the current directory');
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testGemini3ProImageGeneration();
}

export default testGemini3ProImageGeneration;