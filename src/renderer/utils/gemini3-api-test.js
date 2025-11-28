/**
 * Gemini 3 Pro API Test Suite
 * Tests all features: text generation, thinking level, image generation
 */

import AIHandler, { AI_PROVIDERS, GEMINI_MODELS, GEMINI_PREVIEW_MODELS } from './aiHandler.js';

const API_KEY = process.env.GEMINI_API_KEY || '';

console.log('='.repeat(60));
console.log('🧪 GEMINI 3 PRO API TEST SUITE');
console.log('='.repeat(60));

// Test 1: Model Lists
console.log('\n📋 Test 1: Model Lists');
console.log('─'.repeat(60));

console.log('\n✅ GEMINI_MODELS:');
GEMINI_MODELS.forEach((model, i) => {
  const recommended = model.recommended ? ' ⭐ RECOMMENDED' : '';
  console.log(`  ${i + 1}. ${model.name}${recommended}`);
  console.log(`     ID: ${model.id}`);
  console.log(`     Context: ${model.contextWindow.toLocaleString()} tokens`);
  if (model.inputTokens) console.log(`     Input Rate: $${model.inputTokens} per 1M`);
  if (model.outputTokens) console.log(`     Output Rate: $${model.outputTokens} per 1M`);
});

console.log('\n✅ GEMINI_PREVIEW_MODELS:');
GEMINI_PREVIEW_MODELS.forEach((model, i) => {
  const recommended = model.recommended ? ' ⭐ RECOMMENDED' : '';
  console.log(`  ${i + 1}. ${model.name}${recommended}`);
  console.log(`     ID: ${model.id}`);
});

// Test 2: API Key Validation
console.log('\n\n🔑 Test 2: API Key Validation');
console.log('─'.repeat(60));

if (!API_KEY) {
  console.error('❌ ERROR: GEMINI_API_KEY environment variable not set!');
  console.log('   Set it with: $env:GEMINI_API_KEY = "your-api-key"');
  console.log('   Then run: npm test');
  process.exit(1);
}

console.log('✅ API Key found');
console.log(`   Length: ${API_KEY.length} characters`);
console.log(`   Prefix: ${API_KEY.substring(0, 4)}...${API_KEY.substring(-4)}`);

// Test 3: AIHandler Configuration
console.log('\n\n⚙️  Test 3: AIHandler Configuration');
console.log('─'.repeat(60));

const handler = new AIHandler({
  provider: AI_PROVIDERS.GEMINI,
  apiKey: API_KEY,
  model: 'gemini-3-pro-preview',
  temperature: 1.0
});

console.log('✅ AIHandler created successfully');
console.log(`   Provider: ${handler.provider}`);
console.log(`   Model: ${handler.model}`);
console.log(`   Temperature: ${handler.temperature}`);

// Test 4: Text Generation with Thinking
console.log('\n\n🤖 Test 4: Text Generation with Thinking (Gemini 3 Pro)');
console.log('─'.repeat(60));

async function testTextGeneration() {
  try {
    console.log('\n📝 Testing text generation with thinking level...');
    
    const response = await handler.generateText(
      'Sen profesyonel senaryo analizidir.',
      'Aşağıdaki kısa senaryo açısından 3 ana sahne belirle:\n\nKARAPER\nAçık havada bir parkta, gündüz. İki karakter oturuyor.\nBiri diğerine şarkı söylüyor.\nBirden yağmur başlıyor.\nHızlı çıkıyorlar.\n\nSahneleri JSON formatında döndür.',
      {
        maxTokens: 1000,
        temperature: 1.0
      }
    );
    
    console.log('✅ Response received:');
    console.log(response);
    
    return true;
  } catch (error) {
    console.error('❌ Text generation failed:');
    console.error(`   Error: ${error.message}`);
    if (error.response?.data) {
      console.error(`   API Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return false;
  }
}

// Test 5: Image Generation
console.log('\n\n🎨 Test 5: Image Generation (Imagen-3)');
console.log('─'.repeat(60));

async function testImageGeneration() {
  try {
    console.log('\n🖼️  Testing image generation...');
    
    const result = await handler.generateImage(
      'A cinematic scene: Two people sitting in a park during daytime, one singing to the other, peaceful atmosphere, artistic',
      { size: '1024x1024' }
    );
    
    if (result.success) {
      console.log('✅ Image generated successfully');
      console.log(`   Provider: ${result.provider}`);
      console.log(`   Model: ${result.model}`);
      console.log(`   Image URL: ${result.imageUrl.substring(0, 100)}...`);
      console.log(`   Generated at: ${result.generatedAt}`);
      return true;
    } else {
      console.error('❌ Image generation failed:');
      console.error(`   Error: ${result.error}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Image generation error:');
    console.error(`   Error: ${error.message}`);
    if (error.response?.data) {
      console.error(`   API Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return false;
  }
}

// Test 6: Process Prompt (Simplified Interface)
console.log('\n\n📌 Test 6: Process Prompt Method');
console.log('─'.repeat(60));

async function testProcessPrompt() {
  try {
    console.log('\n🔧 Testing processPrompt method...');
    
    const result = await handler.processPrompt(
      'Sen bir senaryo analisti.Verilen metin tarafından temsil edilen senaryonun title\'ını öner.\n\nSenaryo: İki kişi parkta oturuyor. Biri şarkı söylüyor. Yağmur başlıyor.'
    );
    
    console.log('✅ Process prompt result:');
    console.log(result);
    return true;
  } catch (error) {
    console.error('❌ Process prompt failed:');
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

// Test 7: Connection Test
console.log('\n\n🔗 Test 7: Connection Test');
console.log('─'.repeat(60));

async function testConnection() {
  try {
    console.log('\n🌐 Testing API connection...');
    
    const result = await handler.testConnection();
    
    if (result.success) {
      console.log('✅ Connection successful');
      console.log(`   Response: ${result.response}`);
      console.log(`   Provider: ${result.provider}`);
      return true;
    } else {
      console.error('❌ Connection failed:');
      console.error(`   Error: ${result.error}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Connection error:');
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

// Main Test Runner
async function runAllTests() {
  const results = {
    modelLists: true,
    textGeneration: false,
    imageGeneration: false,
    processPrompt: false,
    connection: false
  };
  
  console.log('\n\n🚀 STARTING ALL TESTS...\n');
  
  // Test connection first
  results.connection = await testConnection();
  
  if (!results.connection) {
    console.log('\n\n⚠️  Connection failed, skipping other tests.');
    console.log('Please check your API key and internet connection.');
    process.exit(1);
  }
  
  // Test text generation
  results.textGeneration = await testTextGeneration();
  
  // Test image generation
  results.imageGeneration = await testImageGeneration();
  
  // Test process prompt
  results.processPrompt = await testProcessPrompt();
  
  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;
  
  console.log('\nResults:');
  console.log(`  ✅ Model Lists:       PASS`);
  console.log(`  ${results.connection ? '✅' : '❌'} Connection:        ${results.connection ? 'PASS' : 'FAIL'}`);
  console.log(`  ${results.textGeneration ? '✅' : '❌'} Text Generation:   ${results.textGeneration ? 'PASS' : 'FAIL'}`);
  console.log(`  ${results.imageGeneration ? '✅' : '❌'} Image Generation:  ${results.imageGeneration ? 'PASS' : 'FAIL'}`);
  console.log(`  ${results.processPrompt ? '✅' : '❌'} Process Prompt:    ${results.processPrompt ? 'PASS' : 'FAIL'}`);
  
  console.log(`\n📈 Score: ${passed}/${total} tests passed`);
  console.log('='.repeat(60));
  
  return passed === total;
}

// Run tests if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { testConnection, testTextGeneration, testImageGeneration, testProcessPrompt };
