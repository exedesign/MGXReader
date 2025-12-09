const https = require('https');

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error("❌ Error: GEMINI_API_KEY environment variable is not set.");
    process.exit(1);
}

function makeRequest(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
        }).on('error', reject);
    });
}

async function listModels() {
    console.log("🔍 Listing Available Gemini Models...");
    console.log(`🔑 Key: ...${API_KEY.slice(-4)}`);

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

    try {
        const response = await makeRequest(url);

        if (response.status === 200) {
            if (response.data.models) {
                console.log(`✅ Found ${response.data.models.length} models:`);
                response.data.models.forEach(m => {
                    console.log(`   - ${m.name} (${m.displayName})`);
                    if (m.supportedGenerationMethods) {
                        console.log(`     Methods: ${m.supportedGenerationMethods.join(', ')}`);
                    }
                });
            } else {
                console.log("⚠️ No models found in response.");
                console.log(response.data);
            }
        } else {
            console.log(`❌ Error listing models (${response.status}):`);
            console.log(JSON.stringify(response.data, null, 2));
        }
    } catch (err) {
        console.log(`❌ Connection Error: ${err.message}`);
    }
}

listModels();
