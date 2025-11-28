import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import AIHandler, { AI_PROVIDERS } from '../utils/aiHandler';

export const useAIStore = create(
  persist(
    (set, get) => ({
      // Current AI Configuration
      provider: AI_PROVIDERS.OPENAI,
      
      // Gemini Configuration
      geminiApiKey: '',
      geminiModel: 'gemini-3-pro-preview', // En akıllı model - Gemini 3
      geminiImageModel: 'gemini-3-pro-image-preview', // Updated to newest Gemini 3 Pro Image
      
      // OpenAI Configuration  
      openaiApiKey: '',
      openaiModel: 'gpt-4-turbo-preview',
      openaiImageModel: 'dall-e-3', // Dedicated image model
      
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
      
      // Image Generation Status
      isGeneratingImage: false,
      generatingScenes: new Set(),
      
      // Actions
      setProvider: (provider) => set({ provider }),
      
      setOpenAIConfig: (apiKey, model, imageModel) => set({
        openaiApiKey: apiKey,
        openaiModel: model || get().openaiModel,
        openaiImageModel: imageModel || get().openaiImageModel,
      }),
      
      setGeminiConfig: (apiKey, model, imageModel) => set({
        geminiApiKey: apiKey,
        geminiModel: model || get().geminiModel,
        geminiImageModel: imageModel || get().geminiImageModel,
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
      setOpenAIKey: (apiKey) => {
        console.log('🔑 OpenAI API Key updated:', apiKey ? 'provided' : 'cleared');
        set({ openaiApiKey: apiKey });
      },
      setOpenAIModel: (model, imageModel) => set({ 
        openaiModel: model,
        ...(imageModel && { openaiImageModel: imageModel })
      }),
      setOpenAIImageModel: (imageModel) => set({ openaiImageModel: imageModel }),
      setGeminiKey: (apiKey) => {
        console.log('🔑 Gemini API Key updated:', apiKey ? 'provided' : 'cleared');
        set({ geminiApiKey: apiKey });
      },
      setGeminiModel: (model, imageModel) => {
        // Auto-fix deprecated model names
        let validModel = model;
        if (model === 'gemini-1.5-flash-latest' || model === 'gemini-1.5-flash' || model === 'gemini-1.5-pro') {
          validModel = 'gemini-3-pro-preview';
          console.log(`🔄 Auto-corrected deprecated model ${model} → ${validModel}`);
        }
        
        set({ 
          geminiModel: validModel,
          ...(imageModel && { geminiImageModel: imageModel })
        });
        console.log(`✅ Gemini model set to: ${validModel}`);
      },
      setGeminiImageModel: (imageModel) => set({ geminiImageModel: imageModel }),
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
            imageModel: state.openaiImageModel,
          },
          gemini: {
            apiKey: state.geminiApiKey,
            model: state.geminiModel,
            imageModel: state.geminiImageModel,
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
        geminiModel: 'gemini-3-pro-preview',
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
      resetGeminiModel: () => {
        // Clear localStorage cache for old models
        try {
          localStorage.removeItem('ai-store');
          localStorage.removeItem('gemini-settings');
          localStorage.removeItem('ai-handler-config');
        } catch (e) {
          console.log('Cache clear warning:', e);
        }
        
        set({
          geminiModel: 'gemini-3-pro-preview'
        });
      },

      // Image Generation Methods
      setGeneratingImage: (isGenerating) => set({ isGeneratingImage: isGenerating }),
      
      addGeneratingScene: (sceneId) => set((state) => ({
        generatingScenes: new Set([...state.generatingScenes, sceneId])
      })),
      
      removeGeneratingScene: (sceneId) => set((state) => {
        const newSet = new Set(state.generatingScenes);
        newSet.delete(sceneId);
        return { generatingScenes: newSet };
      }),
      
      clearGeneratingScenes: () => set({ generatingScenes: new Set() }),
      
      // Generate image using current AI provider with Google priority for storyboards
      generateImage: async (prompt, options = {}) => {
        const state = get();
        
        try {
          state.setGeneratingImage(true);
          
          // Try Google Gemini first, then OpenAI as fallback
          const providers = [];
          
          if (state.geminiApiKey) {
            providers.push({
              type: AI_PROVIDERS.GEMINI,
              handler: new AIHandler({
                provider: AI_PROVIDERS.GEMINI,
                apiKey: state.geminiApiKey,
                model: state.geminiModel,
                temperature: state.temperature,
                maxTokens: state.maxTokens
              })
            });
          }
          
          if (state.openaiApiKey) {
            providers.push({
              type: AI_PROVIDERS.OPENAI,
              handler: new AIHandler({
                provider: AI_PROVIDERS.OPENAI,
                apiKey: state.openaiApiKey,
                model: state.openaiModel,
                temperature: state.temperature,
                maxTokens: state.maxTokens
              })
            });
          }
          
          if (providers.length === 0) {
            throw new Error('Hiçbir AI sağlayıcı yapılandırılmamış');
          }
          
          // Try providers in order
          let lastError;
          for (const providerInfo of providers) {
            try {
              console.log(`Trying image generation with: ${providerInfo.type}`);
              const result = await providerInfo.handler.generateImage(prompt, options);
              return result;
            } catch (error) {
              console.warn(`Image generation failed with ${providerInfo.type}:`, error);
              lastError = error;
              continue;
            }
          }
          
          throw lastError || new Error('Tüm sağlayıcılar başarısız oldu');
          
        } catch (error) {
          console.error('Image generation failed:', error);
          throw error;
        } finally {
          state.setGeneratingImage(false);
        }
      },
      
      // Get configured AI handler instance
      getAIHandler: () => {
        const state = get();
        
        // Auto-fix deprecated model names in real-time
        let currentModel = state.provider === AI_PROVIDERS.GEMINI ? state.geminiModel : 
                          state.provider === AI_PROVIDERS.OPENAI ? state.openaiModel :
                          state.provider === AI_PROVIDERS.LOCAL ? state.localModel :
                          state.provider === AI_PROVIDERS.MLX ? state.mlxModel : '';
        
        // Fix deprecated Gemini models
        if (state.provider === AI_PROVIDERS.GEMINI && 
            (currentModel === 'gemini-1.5-flash-latest' || currentModel === 'gemini-1.5-flash' || currentModel === 'gemini-1.5-pro')) {
          currentModel = 'gemini-3-pro-preview';
          console.log(`🔧 Runtime fix: deprecated model → ${currentModel}`);
          // Update store with fixed model
          set({ geminiModel: currentModel });
        }
        
        // Debug: Log what model is actually being used
        console.log('🎯 getAIHandler Debug:', {
          provider: state.provider,
          currentModel: currentModel,
          geminiModel: state.geminiModel,
          openaiModel: state.openaiModel,
          timestamp: new Date().toISOString()
        });
        
        const imageModel = state.provider === AI_PROVIDERS.OPENAI ? state.openaiImageModel :
                          state.provider === AI_PROVIDERS.GEMINI ? state.geminiImageModel : '';
        
        console.log('🏪 Store getAIHandler called:', {
          provider: state.provider,
          geminiModel: state.geminiModel,
          geminiImageModel: state.geminiImageModel,
          openaiModel: state.openaiModel,
          selectedImageModel: imageModel,
          finalModel: currentModel
        });
        
        // Create a fresh instance every time to ensure we have the latest code
        const handler = new AIHandler({
          provider: state.provider,
          openaiApiKey: state.openaiApiKey,
          geminiApiKey: state.geminiApiKey,
          model: currentModel,
          imageModel: imageModel,
          localEndpoint: state.localEndpoint,
          localModel: state.localModel,
          mlxEndpoint: state.mlxEndpoint,
          mlxModel: state.mlxModel,
          temperature: state.temperature,
        });
        
        console.log('🏪 Created AIHandler instance:', {
          hasAnalyzeMethod: typeof handler.analyzeWithCustomPrompt,
          hasGenerateText: typeof handler.generateText,
          hasGenerateImage: typeof handler.generateImage,
          constructor: handler.constructor.name
        });
        
        return handler;
      },
    }),
    {
      name: 'scriptmaster-ai-settings-v2-gemini3',
      // Only persist sensitive data in electron-store, not in localStorage
      partialize: (state) => ({
        provider: state.provider,
        openaiApiKey: state.openaiApiKey,
        openaiModel: state.openaiModel,
        openaiImageModel: state.openaiImageModel,
        geminiApiKey: state.geminiApiKey,
        geminiModel: state.geminiModel,
        geminiImageModel: state.geminiImageModel,
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
