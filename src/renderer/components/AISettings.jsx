import React, { useState } from 'react';
import { useAIStore } from '../store/aiStore';
import { usePromptStore } from '../store/promptStore';
import { AI_PROVIDERS, AIHandler, OPENAI_MODELS, GEMINI_MODELS, MLX_MODELS } from '../utils/aiHandler';
import ProvidersTab from './ProvidersTab';
import PromptsTab from './PromptsTab';

export default function AISettings({ onClose, initialTab = 'prompts' }) {
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

  const {
    getPromptTypes,
    getPrompt,
    getAllPrompts,
    saveCustomPrompt,
    deleteCustomPrompt,
    setActivePrompt,
    activePrompts,
    defaultPrompts
  } = usePromptStore();

  const [testStatus, setTestStatus] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab); // 'providers' veya 'prompts'

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
    onClose();
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestStatus(null);

    try {
      let testConfig;

      switch (provider) {
        case AI_PROVIDERS.OPENAI:
          testConfig = {
            provider,
            apiKey: localOpenAIKey,
            model: localOpenAIModel,
            temperature,
            maxTokens,
          };
          break;
        case AI_PROVIDERS.GEMINI:
          console.log('🔍 Gemini Test Debug:', {
            provider,
            localGeminiKey: localGeminiKey ? localGeminiKey.substring(0, 8) + '...' : 'none',
            localGeminiModel,
            storeGeminiModel: geminiModel,
            temperature,
            maxTokens,
          });
          testConfig = {
            provider,
            apiKey: localGeminiKey,
            model: localGeminiModel,
            temperature,
            maxTokens,
          };
          break;
        case AI_PROVIDERS.LOCAL:
          testConfig = {
            provider,
            localEndpoint: localEndpointInput,
            model: localModelInput,
            temperature: localTempInput,
            maxTokens,
          };
          break;
        case AI_PROVIDERS.MLX:
          testConfig = {
            provider,
            mlxEndpoint: mlxEndpointInput,
            model: mlxModelInput,
            temperature: mlxTempInput,
            maxTokens,
          };
          break;
        default:
          throw new Error('Unsupported provider');
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
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={onClose}
    >
      <div 
        className="bg-cinema-dark border border-cinema-gray rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl relative z-[10000]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-cinema-dark border-b border-cinema-gray p-6 z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-cinema-accent flex items-center gap-2">
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                AI Configuration
              </h2>
              <p className="text-sm text-cinema-text-dim mt-1">
                Configure AI providers and customize analysis prompts
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-cinema-text-dim hover:text-white transition-colors p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex gap-1 bg-cinema-bg rounded-lg p-1">
            <button
              onClick={() => setActiveTab('providers')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'providers'
                  ? 'bg-cinema-accent text-black'
                  : 'text-cinema-text-dim hover:text-white hover:bg-cinema-gray'
              }`}
            >
              AI Providers
            </button>
            <button
              onClick={() => setActiveTab('prompts')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'prompts'
                  ? 'bg-cinema-accent text-black'
                  : 'text-cinema-text-dim hover:text-white hover:bg-cinema-gray'
              }`}
            >
              AI Analiz Ayarları
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'providers' && (
            <ProvidersTab 
              provider={provider}
              setProvider={setProvider}
              localOpenAIKey={localOpenAIKey}
              setLocalOpenAIKey={setLocalOpenAIKey}
              localOpenAIModel={localOpenAIModel}
              setLocalOpenAIModel={setLocalOpenAIModel}
              localGeminiKey={localGeminiKey}
              setLocalGeminiKey={setLocalGeminiKey}
              localGeminiModel={localGeminiModel}
              setLocalGeminiModel={setLocalGeminiModel}
              localEndpointInput={localEndpointInput}
              setLocalEndpointInput={setLocalEndpointInput}
              localModelInput={localModelInput}
              setLocalModelInput={setLocalModelInput}
              localTempInput={localTempInput}
              setLocalTempInput={setLocalTempInput}
              mlxEndpointInput={mlxEndpointInput}
              setMLXEndpointInput={setMLXEndpointInput}
              mlxModelInput={mlxModelInput}
              setMLXModelInput={setMLXModelInput}
              mlxTempInput={mlxTempInput}
              setMLXTempInput={setMLXTempInput}
              temperature={temperature}
              setTemperature={setTemperature}
              maxTokens={maxTokens}
              setMaxTokens={setMaxTokens}
              handleTest={handleTest}
              isTesting={isTesting}
              testStatus={testStatus}
            />
          )}
          
          {activeTab === 'prompts' && (
            <PromptsTab 
              getPromptTypes={getPromptTypes}
              getPrompt={getPrompt}
              getAllPrompts={getAllPrompts}
              saveCustomPrompt={saveCustomPrompt}
              deleteCustomPrompt={deleteCustomPrompt}
              setActivePrompt={setActivePrompt}
              activePrompts={activePrompts}
              defaultPrompts={defaultPrompts}
            />
          )}
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
            {activeTab === 'providers' && (
              <button onClick={handleSave} className="btn-primary">
                Save Settings
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}