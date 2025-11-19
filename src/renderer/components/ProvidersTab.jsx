import React from 'react';
import { AI_PROVIDERS, OPENAI_MODELS, GEMINI_MODELS, MLX_MODELS } from '../utils/aiHandler';
import { useAIStore } from '../store/aiStore';

export default function ProvidersTab({
  provider,
  setProvider,
  localOpenAIKey,
  setLocalOpenAIKey,
  localOpenAIModel,
  setLocalOpenAIModel,
  localGeminiKey,
  setLocalGeminiKey,
  localGeminiModel,
  setLocalGeminiModel,
  localEndpointInput,
  setLocalEndpointInput,
  localModelInput,
  setLocalModelInput,
  localTempInput,
  setLocalTempInput,
  mlxEndpointInput,
  setMLXEndpointInput,
  mlxModelInput,
  setMLXModelInput,
  mlxTempInput,
  setMLXTempInput,
  temperature,
  setTemperature,
  maxTokens,
  setMaxTokens,
  handleTest,
  isTesting,
  testStatus
}) {
  const { resetGeminiModel } = useAIStore();

  const handleResetGemini = () => {
    resetGeminiModel();
    setLocalGeminiModel('gemini-2.0-flash');
  };

  return (
    <div className="space-y-6">
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
          <h3 className="text-lg font-semibold text-cinema-accent">OpenAI Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="text-cinema-text font-medium block mb-2">
                API Key
              </label>
              <input
                type="password"
                value={localOpenAIKey}
                onChange={(e) => setLocalOpenAIKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-4 py-3 bg-cinema-gray border border-cinema-gray-light rounded-lg text-cinema-text focus:outline-none focus:border-cinema-accent transition-colors"
              />
            </div>
            <div>
              <label className="text-cinema-text font-medium block mb-2">
                Model
              </label>
              <select
                value={localOpenAIModel}
                onChange={(e) => setLocalOpenAIModel(e.target.value)}
                className="w-full px-4 py-3 bg-cinema-gray border border-cinema-gray-light rounded-lg text-cinema-text focus:outline-none focus:border-cinema-accent transition-colors"
              >
                {OPENAI_MODELS.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name} {model.recommended && '(Recommended)'}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Gemini Configuration */}
      {provider === AI_PROVIDERS.GEMINI && (
        <div className="space-y-4 p-4 bg-cinema-gray/30 rounded-lg border border-cinema-gray">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-cinema-accent">Google Gemini Configuration</h3>
              <button
                onClick={handleResetGemini}
                className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-xs font-medium transition-colors"
                title="Reset to latest working model"
              >
                🔄 Reset Model
              </button>
            </div>
            <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
              ✨ Updated Nov 2025
            </span>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-cinema-text font-medium block mb-2">
                Google API Key
              </label>
              <input
                type="password"
                value={localGeminiKey}
                onChange={(e) => setLocalGeminiKey(e.target.value)}
                placeholder="AIza..."
                className="w-full px-4 py-3 bg-cinema-gray border border-cinema-gray-light rounded-lg text-cinema-text focus:outline-none focus:border-cinema-accent transition-colors"
              />
              <p className="text-xs text-cinema-text-dim mt-2">
                Get your API key from{' '}
                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-cinema-accent hover:underline"
                >
                  Google AI Studio
                </a>
              </p>
            </div>
            <div>
              <label className="text-cinema-text font-medium block mb-2">
                Model
              </label>
              <select
                value={localGeminiModel}
                onChange={(e) => setLocalGeminiModel(e.target.value)}
                className="w-full px-4 py-3 bg-cinema-gray border border-cinema-gray-light rounded-lg text-cinema-text focus:outline-none focus:border-cinema-accent transition-colors"
              >
                {GEMINI_MODELS.filter(model => !model.deprecated).map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name} {model.recommended && '⭐ Recommended'} 
                    {model.new && ' 🆕 New!'} 
                    {model.fast && ' ⚡ Fast'}
                  </option>
                ))}
              </select>
              <p className="text-xs text-cinema-text-dim mt-2">
                💡 Gemini 2.5 Flash is perfect for quick analysis, Pro for complex scripts
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MLX Configuration */}
      {provider === AI_PROVIDERS.MLX && (
        <div className="space-y-4 p-4 bg-cinema-gray/30 rounded-lg border border-cinema-gray">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-cinema-accent">🍎 Apple MLX Configuration</h3>
            <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">
              M1/M2/M3/M4 Only
            </span>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-cinema-text font-medium block mb-2">
                MLX Server Endpoint
              </label>
              <input
                type="text"
                value={mlxEndpointInput}
                onChange={(e) => setMLXEndpointInput(e.target.value)}
                placeholder="http://localhost:8080"
                className="w-full px-4 py-3 bg-cinema-gray border border-cinema-gray-light rounded-lg text-cinema-text focus:outline-none focus:border-cinema-accent transition-colors"
              />
              <p className="text-xs text-cinema-text-dim mt-2">
                Run MLX LM with: <code className="bg-cinema-gray px-2 py-1 rounded">mlx_lm.server --model &lt;model_name&gt;</code>
              </p>
            </div>
            <div>
              <label className="text-cinema-text font-medium block mb-2">
                Model Name
              </label>
              <select
                value={mlxModelInput}
                onChange={(e) => setMLXModelInput(e.target.value)}
                className="w-full px-4 py-3 bg-cinema-gray border border-cinema-gray-light rounded-lg text-cinema-text focus:outline-none focus:border-cinema-accent transition-colors"
              >
                {MLX_MODELS.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name} {model.recommended && '(Recommended for Mac)'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-cinema-text font-medium block mb-2">
                Temperature: {mlxTempInput}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={mlxTempInput}
                onChange={(e) => setMLXTempInput(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Local AI Configuration */}
      {provider === AI_PROVIDERS.LOCAL && (
        <div className="space-y-4 p-4 bg-cinema-gray/30 rounded-lg border border-cinema-gray">
          <h3 className="text-lg font-semibold text-cinema-accent">Local AI Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="text-cinema-text font-medium block mb-2">
                Local Endpoint
              </label>
              <input
                type="text"
                value={localEndpointInput}
                onChange={(e) => setLocalEndpointInput(e.target.value)}
                placeholder="http://localhost:11434"
                className="w-full px-4 py-3 bg-cinema-gray border border-cinema-gray-light rounded-lg text-cinema-text focus:outline-none focus:border-cinema-accent transition-colors"
              />
            </div>
            <div>
              <label className="text-cinema-text font-medium block mb-2">
                Model Name
              </label>
              <input
                type="text"
                value={localModelInput}
                onChange={(e) => setLocalModelInput(e.target.value)}
                placeholder="llama3.1:latest"
                className="w-full px-4 py-3 bg-cinema-gray border border-cinema-gray-light rounded-lg text-cinema-text focus:outline-none focus:border-cinema-accent transition-colors"
              />
            </div>
            <div>
              <label className="text-cinema-text font-medium block mb-2">
                Temperature: {localTempInput}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={localTempInput}
                onChange={(e) => setLocalTempInput(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Global Settings */}
      <div className="space-y-4 p-4 bg-cinema-gray/20 rounded-lg border border-cinema-gray-light">
        <h3 className="text-lg font-semibold text-cinema-text">Global AI Settings</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-cinema-text font-medium block mb-2">
              Temperature: {temperature}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-cinema-text-dim mt-1">
              Lower = More focused, Higher = More creative
            </p>
          </div>
          <div>
            <label className="text-cinema-text font-medium block mb-2">
              Max Tokens
            </label>
            <input
              type="number"
              min="100"
              max="32000"
              step="100"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-cinema-gray border border-cinema-gray-light rounded-lg text-cinema-text focus:outline-none focus:border-cinema-accent transition-colors"
            />
            <p className="text-xs text-cinema-text-dim mt-1">
              Maximum response length
            </p>
          </div>
        </div>
      </div>

      {/* Test Connection */}
      <div className="p-4 bg-cinema-gray/10 rounded-lg border border-cinema-gray-light">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-cinema-text">Test Connection</h3>
          <button
            onClick={handleTest}
            disabled={isTesting}
            className="px-4 py-2 bg-cinema-accent text-black rounded-lg hover:bg-cinema-accent-light transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isTesting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8Z" />
                </svg>
                Testing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                Test Connection
              </>
            )}
          </button>
        </div>
        <p className="text-sm text-cinema-text-dim mb-4">
          Test your AI configuration with a simple query
        </p>
        
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
  );
}