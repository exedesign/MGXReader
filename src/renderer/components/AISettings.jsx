import React, { useState } from 'react';
import { useAIStore } from '../store/aiStore';
import { AI_PROVIDERS, AIHandler, OPENAI_MODELS, GEMINI_MODELS, MLX_MODELS } from '../utils/aiHandler';

export default function AISettings({ onClose }) {
  const {
    provider,
    openaiApiKey,
    openaiModel,
    geminiApiKey,
    geminiModel,
    localEndpoint,
    localModel,
    localTemperature,
    mlxEndpoint,
    mlxModel,
    mlxTemperature,
    temperature,
    maxTokens,
    setProvider,
    setOpenAIConfig,
    setGeminiConfig,
    setLocalConfig,
    setMLXConfig,
    setTemperature,
    setMaxTokens,
    getCurrentConfig,
    isConfigured,
  } = useAIStore();

  const [testStatus, setTestStatus] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  // Local state for form inputs
  const [localOpenAIKey, setLocalOpenAIKey] = useState(openaiApiKey);
  const [localOpenAIModel, setLocalOpenAIModel] = useState(openaiModel);
  const [localGeminiKey, setLocalGeminiKey] = useState(geminiApiKey);
  const [localGeminiModel, setLocalGeminiModel] = useState(geminiModel);
  const [localEndpointInput, setLocalEndpointInput] = useState(localEndpoint);
  const [localModelInput, setLocalModelInput] = useState(localModel);
  const [localTempInput, setLocalTempInput] = useState(localTemperature);
  const [mlxEndpointInput, setMLXEndpointInput] = useState(mlxEndpoint);
  const [mlxModelInput, setMLXModelInput] = useState(mlxModel);
  const [mlxTempInput, setMLXTempInput] = useState(mlxTemperature);

  const handleSave = () => {
    switch (provider) {
      case AI_PROVIDERS.OPENAI:
        setOpenAIConfig(localOpenAIKey, localOpenAIModel);
        break;
      case AI_PROVIDERS.GEMINI:
        setGeminiConfig(localGeminiKey, localGeminiModel);
        break;
      case AI_PROVIDERS.LOCAL:
        setLocalConfig(localEndpointInput, localModelInput, localTempInput);
        break;
      case AI_PROVIDERS.MLX:
        setMLXConfig(mlxEndpointInput, mlxModelInput, mlxTempInput);
        break;
    }
    alert('Settings saved successfully!');
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestStatus(null);

    try {
      // Create temporary config for testing
      let testConfig = { provider };

      switch (provider) {
        case AI_PROVIDERS.OPENAI:
          testConfig = {
            ...testConfig,
            apiKey: localOpenAIKey,
            model: localOpenAIModel,
            temperature,
          };
          break;
        case AI_PROVIDERS.GEMINI:
          testConfig = {
            ...testConfig,
            apiKey: localGeminiKey,
            model: localGeminiModel,
            temperature,
          };
          break;
        case AI_PROVIDERS.LOCAL:
          testConfig = {
            ...testConfig,
            localEndpoint: localEndpointInput,
            localModel: localModelInput,
            temperature: localTempInput,
          };
          break;
        case AI_PROVIDERS.MLX:
          testConfig = {
            ...testConfig,
            mlxEndpoint: mlxEndpointInput,
            mlxModel: mlxModelInput,
            temperature: mlxTempInput,
          };
          break;
      }

      const handler = new AIHandler(testConfig);
      const result = await handler.testConnection();

      setTestStatus(result);
    } catch (error) {
      setTestStatus({
        success: false,
        error: error.message,
        provider,
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-cinema-dark border border-cinema-gray rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-cinema-dark border-b border-cinema-gray p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold text-cinema-accent flex items-center gap-2">
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              AI Provider Settings
            </h2>
            <p className="text-sm text-cinema-text-dim mt-1">
              Configure your AI model for screenplay analysis
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-cinema-gray rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Provider Selection */}
          <div className="space-y-3">
            <label className="text-cinema-text font-semibold block">
              AI Provider
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full px-4 py-3 bg-cinema-gray border border-cinema-gray-light rounded-lg text-cinema-text focus:outline-none focus:border-cinema-accent transition-colors"
            >
              <option value={AI_PROVIDERS.OPENAI}>OpenAI (GPT-4, GPT-3.5)</option>
              <option value={AI_PROVIDERS.GEMINI}>Google Gemini (Recommended for long scripts)</option>
              <option value={AI_PROVIDERS.MLX}>🍎 Apple MLX (M1/M2/M3/M4) - Ultra Fast & Private</option>
              <option value={AI_PROVIDERS.LOCAL}>Local AI (Ollama/LM Studio) - Privacy Mode</option>
            </select>
          </div>

          {/* OpenAI Configuration */}
          {provider === AI_PROVIDERS.OPENAI && (
            <div className="space-y-4 p-4 bg-cinema-gray/30 rounded-lg border border-cinema-gray">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-cinema-accent" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                <h3 className="text-lg font-semibold text-cinema-text">OpenAI Configuration</h3>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-cinema-text-dim">API Key</label>
                <input
                  type="password"
                  value={localOpenAIKey}
                  onChange={(e) => setLocalOpenAIKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-4 py-2 bg-cinema-black border border-cinema-gray-light rounded-lg text-cinema-text focus:outline-none focus:border-cinema-accent"
                />
                <p className="text-xs text-cinema-text-dim">
                  Get your API key from{' '}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cinema-accent hover:underline"
                  >
                    platform.openai.com
                  </a>
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-cinema-text-dim">Model</label>
                <select
                  value={localOpenAIModel}
                  onChange={(e) => setLocalOpenAIModel(e.target.value)}
                  className="w-full px-4 py-2 bg-cinema-black border border-cinema-gray-light rounded-lg text-cinema-text focus:outline-none focus:border-cinema-accent"
                >
                  {OPENAI_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} ({(model.contextWindow / 1000).toFixed(0)}K context)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Gemini Configuration */}
          {provider === AI_PROVIDERS.GEMINI && (
            <div className="space-y-4 p-4 bg-cinema-gray/30 rounded-lg border border-cinema-gray">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-cinema-accent" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                <h3 className="text-lg font-semibold text-cinema-text">Google Gemini Configuration</h3>
              </div>

              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 mb-3">
                <p className="text-sm text-blue-300 flex items-start gap-2">
                  <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                  </svg>
                  <span>
                    Gemini 1.5 Pro offers <strong>1M tokens context window</strong> - ideal for analyzing entire feature-length screenplays!
                  </span>
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-cinema-text-dim">API Key</label>
                <input
                  type="password"
                  value={localGeminiKey}
                  onChange={(e) => setLocalGeminiKey(e.target.value)}
                  placeholder="AIza..."
                  className="w-full px-4 py-2 bg-cinema-black border border-cinema-gray-light rounded-lg text-cinema-text focus:outline-none focus:border-cinema-accent"
                />
                <p className="text-xs text-cinema-text-dim">
                  Get your API key from{' '}
                  <a
                    href="https://makersuite.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cinema-accent hover:underline"
                  >
                    Google AI Studio
                  </a>
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-cinema-text-dim">Model</label>
                <select
                  value={localGeminiModel}
                  onChange={(e) => setLocalGeminiModel(e.target.value)}
                  className="w-full px-4 py-2 bg-cinema-black border border-cinema-gray-light rounded-lg text-cinema-text focus:outline-none focus:border-cinema-accent"
                >
                  {GEMINI_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} ({(model.contextWindow / 1000).toFixed(0)}K context)
                      {model.recommended ? ' ⭐ Recommended' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Local AI Configuration */}
          {provider === AI_PROVIDERS.LOCAL && (
            <div className="space-y-4 p-4 bg-cinema-gray/30 rounded-lg border border-cinema-gray">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-cinema-accent" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 13H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-6c0-.55-.45-1-1-1zM7 19c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM20 3H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1zM7 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
                </svg>
                <h3 className="text-lg font-semibold text-cinema-text">Local AI Configuration</h3>
              </div>

              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 mb-3">
                <p className="text-sm text-green-300 flex items-start gap-2">
                  <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
                  </svg>
                  <span>
                    <strong>Privacy Mode:</strong> Your scripts never leave your computer. Requires Ollama or LM Studio installed.
                  </span>
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-cinema-text-dim">Endpoint URL</label>
                <input
                  type="text"
                  value={localEndpointInput}
                  onChange={(e) => setLocalEndpointInput(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="w-full px-4 py-2 bg-cinema-black border border-cinema-gray-light rounded-lg text-cinema-text focus:outline-none focus:border-cinema-accent"
                />
                <p className="text-xs text-cinema-text-dim">
                  Default Ollama endpoint. For LM Studio, use: http://localhost:1234
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-cinema-text-dim">Model Name</label>
                <input
                  type="text"
                  value={localModelInput}
                  onChange={(e) => setLocalModelInput(e.target.value)}
                  placeholder="llama3"
                  className="w-full px-4 py-2 bg-cinema-black border border-cinema-gray-light rounded-lg text-cinema-text focus:outline-none focus:border-cinema-accent"
                />
                <p className="text-xs text-cinema-text-dim">
                  Examples: llama3, mistral, gemma, phi3. Run <code className="bg-cinema-black px-1 rounded">ollama list</code> to see installed models.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-cinema-text-dim">Temperature</label>
                  <span className="text-cinema-accent font-bold">{localTempInput.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={localTempInput}
                  onChange={(e) => setLocalTempInput(parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-cinema-text-dim">
                  <span>Precise (0.0)</span>
                  <span>Balanced (1.0)</span>
                  <span>Creative (2.0)</span>
                </div>
              </div>
            </div>
          )}

          {/* MLX Configuration */}
          {provider === AI_PROVIDERS.MLX && (
            <div className="space-y-4 p-4 bg-cinema-gray/30 rounded-lg border border-cinema-gray">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-cinema-accent" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.6 11.48l-5.07-5.07c-.39-.39-1.03-.39-1.42 0L5.64 11.9c-.39.39-.39 1.03 0 1.42l5.07 5.07c.39.39 1.03.39 1.42 0l5.47-5.49c.39-.38.39-1.02 0-1.42zm-4.24 4.95L9.53 12.6l3.83-3.83 3.83 3.83-3.83 3.83z" />
                </svg>
                <h3 className="text-lg font-semibold text-cinema-text">Apple MLX Configuration</h3>
              </div>

              <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-lg p-3 mb-3">
                <p className="text-sm text-purple-200 flex items-start gap-2">
                  <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 12c0-1.1-.9-2-2-2V7c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v3c-1.1 0-2 .9-2 2s.9 2 2 2v3c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-3c1.1 0 2-.9 2-2zm-8 0c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z" />
                  </svg>
                  <span>
                    <strong>🍎 Apple Silicon Optimized:</strong> Lightning-fast inference on M1/M2/M3/M4 chips with unified memory. 
                    No data leaves your Mac - 100% private & offline.
                  </span>
                </p>
              </div>

              <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-3 mb-3">
                <p className="text-sm text-yellow-200 flex items-start gap-2">
                  <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                  </svg>
                  <span>
                    <strong>Requirements:</strong> Install MLX LM server first:
                    <code className="block mt-1 bg-cinema-black px-2 py-1 rounded text-xs">
                      pip install mlx-lm<br/>
                      mlx_lm.server --model mlx-community/Llama-3.2-3B-Instruct-4bit
                    </code>
                  </span>
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-cinema-text-dim">MLX Server Endpoint</label>
                <input
                  type="text"
                  value={mlxEndpointInput}
                  onChange={(e) => setMLXEndpointInput(e.target.value)}
                  placeholder="http://localhost:8080"
                  className="w-full px-4 py-2 bg-cinema-black border border-cinema-gray-light rounded-lg text-cinema-text focus:outline-none focus:border-cinema-accent"
                />
                <p className="text-xs text-cinema-text-dim">
                  Default MLX server endpoint (port 8080)
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-cinema-text-dim">Model</label>
                <select
                  value={mlxModelInput}
                  onChange={(e) => setMLXModelInput(e.target.value)}
                  className="w-full px-4 py-2 bg-cinema-black border border-cinema-gray-light rounded-lg text-cinema-text focus:outline-none focus:border-cinema-accent"
                >
                  {MLX_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} ({(model.contextWindow / 1000).toFixed(0)}K context)
                      {model.recommended ? ' ⭐ Recommended' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-cinema-text-dim">
                  4-bit quantized models optimized for Apple Silicon. Llama 3.2 3B offers best balance of speed and quality.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-cinema-text-dim">Temperature</label>
                  <span className="text-cinema-accent font-bold">{mlxTempInput.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={mlxTempInput}
                  onChange={(e) => setMLXTempInput(parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-cinema-text-dim">
                  <span>Precise (0.0)</span>
                  <span>Balanced (1.0)</span>
                  <span>Creative (2.0)</span>
                </div>
              </div>

              <div className="bg-cinema-black/50 border border-cinema-gray rounded-lg p-3">
                <p className="text-xs text-cinema-text-dim mb-2">
                  <strong className="text-cinema-text">Quick Start:</strong>
                </p>
                <ol className="text-xs text-cinema-text-dim space-y-1 list-decimal list-inside">
                  <li>Open Terminal</li>
                  <li>Run: <code className="bg-cinema-gray px-1 rounded">pip install mlx-lm</code></li>
                  <li>Start server: <code className="bg-cinema-gray px-1 rounded">mlx_lm.server --model {mlxModelInput}</code></li>
                  <li>Test connection below</li>
                </ol>
              </div>
            </div>
          )}

          {/* Test Connection */}
          <div className="space-y-3">
            <button
              onClick={handleTestConnection}
              disabled={isTesting}
              className="w-full btn-secondary flex items-center justify-center gap-2"
            >
              {isTesting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-cinema-accent border-t-transparent"></div>
                  Testing Connection...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                  Test Connection
                </>
              )}
            </button>

            {testStatus && (
              <div
                className={`p-4 rounded-lg border ${
                  testStatus.success
                    ? 'bg-green-900/20 border-green-500/30'
                    : 'bg-red-900/20 border-red-500/30'
                }`}
              >
                <p
                  className={`text-sm ${
                    testStatus.success ? 'text-green-300' : 'text-red-300'
                  }`}
                >
                  {testStatus.success ? (
                    <>
                      ✅ Connection successful! Response: "{testStatus.response}"
                    </>
                  ) : (
                    <>
                      ❌ Connection failed: {testStatus.error}
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-cinema-dark border-t border-cinema-gray p-6 flex justify-between items-center">
          <div className="text-xs text-cinema-text-dim">
            {isConfigured() ? (
              <span className="flex items-center gap-2 text-green-400">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                Configuration complete
              </span>
            ) : (
              <span className="text-yellow-400">⚠️ Please configure your AI provider</span>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button onClick={handleSave} className="btn-primary">
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
