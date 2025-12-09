const https = require('https');

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error("❌ Error: GEMINI_API_KEY environment variable is not set.");
    console.log("Usage in PowerShell:");
    console.log("   $env:GEMINI_API_KEY='your_key_here'; node scripts/verify-gemini.js");
    process.exit(1);
}

const MODELS_TO_TEST = [
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-3-pro-preview',
    'imagen-3.0-generate-001'
];

function makeRequest(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
        }).on('error', reject);
    });
}

async function testModel(model) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${API_KEY}`;

    try {
        const response = await makeRequest(url);

        if (response.status === 200) {
            console.log(`✅ Model Found: ${model}`);
            console.log(`   Description: ${response.data.description || 'No description'}`);
            return true;
        } else {
            console.log(`❌ Model Error ${model}: ${response.data.error?.message || 'Unknown error'}`);
            return false;
        }
    } catch (err) {
        console.log(`❌ Connection Error ${model}: ${err.message}`);
        return false;
    }
}

async function run() {
    console.log("🔍 Verifying Gemini Models...");
    console.log(`🔑 Using Key (last 4 chars): ...${API_KEY.slice(-4)}`);

    for (const model of MODELS_TO_TEST) {
        await testModel(model);
    }
}

run();
