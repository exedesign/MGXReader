import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import AIHandler, { AI_PROVIDERS } from '../utils/aiHandler';

export const useAIStore = create(
  persist(
    (set, get) => ({
      // Current AI Configuration
      provider: AI_PROVIDERS.OPENAI,
      
      // OpenAI Configuration
      openaiApiKey: '',
      openaiModel: 'gpt-4-turbo-preview',
      
      // Gemini Configuration
      geminiApiKey: '',
      geminiModel: 'gemini-2.0-flash',
      
      // Local AI Configuration
      localEndpoint: 'http://localhost:11434',
      localModel: 'llama3',
      localTemperature: 0.3,
      
      // MLX Configuration (Apple Silicon)
      mlxEndpoint: 'http://localhost:8080',
      mlxModel: 'mlx-community/Llama-3.2-3B-Instruct-4bit',
      mlxTemperature: 0.3,
      
      // General Settings
      temperature: 0.3,
      maxTokens: 4000,
      
      // Connection Status
      isConnected: false,
      lastTestedProvider: null,
      
      // Actions
      setProvider: (provider) => set({ provider }),
      
      setOpenAIConfig: (apiKey, model) => set({
        openaiApiKey: apiKey,
        openaiModel: model || get().openaiModel,
      }),
      
      setGeminiConfig: (apiKey, model) => set({
        geminiApiKey: apiKey,
        geminiModel: model || get().geminiModel,
      }),
      
      setLocalConfig: (endpoint, model, temperature) => set({
        localEndpoint: endpoint || get().localEndpoint,
        localModel: model || get().localModel,
        localTemperature: temperature !== undefined ? temperature : get().localTemperature,
      }),
      
      setMLXConfig: (endpoint, model, temperature) => set({
        mlxEndpoint: endpoint || get().mlxEndpoint,
        mlxModel: model || get().mlxModel,
        mlxTemperature: temperature !== undefined ? temperature : get().mlxTemperature,
      }),
      
      setTemperature: (temperature) => set({ temperature }),
      
      setMaxTokens: (maxTokens) => set({ maxTokens }),
      
      // Individual setters for ease of use
      setOpenAIKey: (apiKey) => set({ openaiApiKey: apiKey }),
      setOpenAIModel: (model) => set({ openaiModel: model }),
      setGeminiKey: (apiKey) => set({ geminiApiKey: apiKey }),
      setGeminiModel: (model) => set({ geminiModel: model }),
      setCustomEndpoint: (endpoint) => set({ localEndpoint: endpoint }),
      setCustomModel: (model) => set({ localModel: model }),
      setCustomTemperature: (temperature) => set({ localTemperature: temperature }),
      
      // Get config object for ProvidersTab
      getConfig: () => {
        const state = get();
        return {
          openai: {
            apiKey: state.openaiApiKey,
            model: state.openaiModel,
          },
          gemini: {
            apiKey: state.geminiApiKey,
            model: state.geminiModel,
          },
          local: {
            endpoint: state.localEndpoint,
            model: state.localModel,
            temperature: state.localTemperature,
          },
          mlx: {
            endpoint: state.mlxEndpoint,
            model: state.mlxModel,
            temperature: state.mlxTemperature,
          },
          temperature: state.temperature,
          maxTokens: state.maxTokens,
        };
      },
      
      setConnectionStatus: (isConnected, provider) => set({
        isConnected,
        lastTestedProvider: provider,
      }),
      
      // Get current AI configuration
      getCurrentConfig: () => {
        const state = get();
        
        switch (state.provider) {
          case AI_PROVIDERS.OPENAI:
            return {
              provider: AI_PROVIDERS.OPENAI,
              apiKey: state.openaiApiKey,
              model: state.openaiModel,
              temperature: state.temperature,
            };
          
          case AI_PROVIDERS.GEMINI:
            return {
              provider: AI_PROVIDERS.GEMINI,
              apiKey: state.geminiApiKey,
              model: state.geminiModel,
              temperature: state.temperature,
            };
          
          case AI_PROVIDERS.LOCAL:
            return {
              provider: AI_PROVIDERS.LOCAL,
              localEndpoint: state.localEndpoint,
              localModel: state.localModel,
              temperature: state.localTemperature,
            };
          
          case AI_PROVIDERS.MLX:
            return {
              provider: AI_PROVIDERS.MLX,
              mlxEndpoint: state.mlxEndpoint,
              mlxModel: state.mlxModel,
              temperature: state.mlxTemperature,
            };
          
          default:
            return null;
        }
      },
      
      // Check if current provider is configured
      isConfigured: () => {
        const state = get();
        
        switch (state.provider) {
          case AI_PROVIDERS.OPENAI:
            return !!state.openaiApiKey;
          
          case AI_PROVIDERS.GEMINI:
            return !!state.geminiApiKey;
          
          case AI_PROVIDERS.LOCAL:
            return !!state.localEndpoint && !!state.localModel;
          
          case AI_PROVIDERS.MLX:
            return !!state.mlxEndpoint && !!state.mlxModel;
          
          default:
            return false;
        }
      },
      
      // Reset all settings
      resetSettings: () => set({
        provider: AI_PROVIDERS.OPENAI,
        openaiApiKey: '',
        openaiModel: 'gpt-4-turbo-preview',
        geminiApiKey: '',
        geminiModel: 'gemini-2.0-flash',
        localEndpoint: 'http://localhost:11434',
        localModel: 'llama3',
        localTemperature: 0.3,
        mlxEndpoint: 'http://localhost:8080',
        mlxModel: 'mlx-community/Llama-3.2-3B-Instruct-4bit',
        mlxTemperature: 0.3,
        temperature: 0.3,
        maxTokens: 4000,
        isConnected: false,
        lastTestedProvider: null,
      }),

      // Reset Gemini model to current working model  
      resetGeminiModel: () => set({
        geminiModel: 'gemini-2.0-flash'
      }),

      // Get configured AI handler instance
      getAIHandler: () => {
        const state = get();
        return new AIHandler({
          provider: state.provider,
          apiKey: state.provider === AI_PROVIDERS.OPENAI ? state.openaiApiKey :
                  state.provider === AI_PROVIDERS.GEMINI ? state.geminiApiKey : '',
          model: state.provider === AI_PROVIDERS.OPENAI ? state.openaiModel :
                 state.provider === AI_PROVIDERS.GEMINI ? state.geminiModel :
                 state.provider === AI_PROVIDERS.LOCAL ? state.localModel :
                 state.provider === AI_PROVIDERS.MLX ? state.mlxModel : '',
          localEndpoint: state.localEndpoint,
          localModel: state.localModel,
          mlxEndpoint: state.mlxEndpoint,
          mlxModel: state.mlxModel,
          temperature: state.temperature,
        });
      },
    }),
    {
      name: 'scriptmaster-ai-settings',
      // Only persist sensitive data in electron-store, not in localStorage
      partialize: (state) => ({
        provider: state.provider,
        openaiApiKey: state.openaiApiKey,
        openaiModel: state.openaiModel,
        geminiApiKey: state.geminiApiKey,
        geminiModel: state.geminiModel,
        localEndpoint: state.localEndpoint,
        localModel: state.localModel,
        localTemperature: state.localTemperature,
        mlxEndpoint: state.mlxEndpoint,
        mlxModel: state.mlxModel,
        mlxTemperature: state.mlxTemperature,
        temperature: state.temperature,
        maxTokens: state.maxTokens,
      }),
    }
  )
);
