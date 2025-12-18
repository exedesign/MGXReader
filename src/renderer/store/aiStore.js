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
      geminiModel: 'gemini-2.5-flash', // En hızlı ve güncel model
      geminiImageModel: 'gemini-2.5-flash-image', // Nano Banana - Fast and efficient
      geminiImageSize: '1K', // 1K, 2K, 4K (4K only for Pro)

      // OpenAI Configuration  
      openaiApiKey: '',
      openaiModel: 'gpt-4-turbo-preview',
      openaiImageModel: 'dall-e-3', // Dedicated image model
      openaiImageSize: '1024x1024', // 1024x1024, 1024x1792, 1792x1024
      openaiImageQuality: 'standard', // standard, hd

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
      setGeminiImageSettings: (size) => set({
        geminiImageSize: size || get().geminiImageSize,
      }),
      setOpenAIImageSettings: (size, quality) => set({
        openaiImageSize: size || get().openaiImageSize,
        openaiImageQuality: quality || get().openaiImageQuality,
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
        set({
          geminiModel: model,
          ...(imageModel && { geminiImageModel: imageModel })
        });
        console.log(`✅ Gemini model set to: ${model}`);
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
          temperature: state.temperature
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
          geminiModel: 'gemini-2.5-flash'
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
      analyzeImage: async (imageData, prompt, options = {}) => {
        const state = get();

        try {
          if (!state.geminiApiKey) {
            throw new Error('Gemini API key gerekli. Lütfen ayarlardan API key ekleyin.');
          }

          const handler = new AIHandler({
            provider: AI_PROVIDERS.GEMINI,
            apiKey: state.geminiApiKey,
            model: state.geminiModel,
            temperature: state.temperature
          });

          console.log('🔍 Analyzing image with Gemini Vision...');
          const result = await handler.analyzeImageGemini(imageData, prompt, options);
          return result;

        } catch (error) {
          console.error('Image analysis failed:', error);
          throw error;
        }
      },

      generateImage: async (prompt, options = {}) => {
        const state = get();

        try {
          state.setGeneratingImage(true);

          // CRITICAL: Force use of store-selected image model AND settings
          // Remove any model override from options to ensure store settings are respected
          const imageOptions = { 
            ...options,
            // Apply store image generation settings ONLY if not provided by component
            imageSize: options.imageSize || state.geminiImageSize,
            // OpenAI settings (will be used if fallback to OpenAI)
            size: options.size || state.openaiImageSize,
            quality: options.quality || state.openaiImageQuality
          };
          delete imageOptions.model; // Remove any component-level model override

          // Debug: Log API keys status and settings
          console.log('🔍 API Keys Status:', {
            geminiKey: state.geminiApiKey ? `${state.geminiApiKey.substring(0, 10)}...` : 'NOT SET',
            openaiKey: state.openaiApiKey ? `${state.openaiApiKey.substring(0, 10)}...` : 'NOT SET',
            geminiImageModel: state.geminiImageModel,
            openaiImageModel: state.openaiImageModel,
            provider: state.provider
          });

          console.log('🎯 FORCING STORE MODELS & SETTINGS - No overrides allowed:', {
            geminiImageModel: state.geminiImageModel,
            geminiImageSize: state.geminiImageSize,
            openaiImageModel: state.openaiImageModel,
            openaiImageSize: state.openaiImageSize,
            openaiImageQuality: state.openaiImageQuality,
            optionsModel: options.model ? '⚠️ IGNORED: ' + options.model : 'none'
          });

          // Try Google Gemini first, then OpenAI as fallback
          const providers = [];

          if (state.geminiApiKey) {
            console.log('✅ Adding Gemini provider with STORE model:', state.geminiImageModel);
            providers.push({
              type: AI_PROVIDERS.GEMINI,
              handler: new AIHandler({
                provider: AI_PROVIDERS.GEMINI,
                apiKey: state.geminiApiKey,
                model: state.geminiModel,
                imageModel: state.geminiImageModel, // ALWAYS use store model
                temperature: state.temperature
              })
            });
          } else {
            console.warn('⚠️ Gemini API key not found!');
          }

          if (state.openaiApiKey) {
            console.log('✅ Adding OpenAI provider with STORE model:', state.openaiImageModel);
            providers.push({
              type: AI_PROVIDERS.OPENAI,
              handler: new AIHandler({
                provider: AI_PROVIDERS.OPENAI,
                apiKey: state.openaiApiKey,
                model: state.openaiModel,
                imageModel: state.openaiImageModel, // ALWAYS use store model
                temperature: state.temperature
              })
            });
          }

          if (providers.length === 0) {
            const errorMsg = '❌ API anahtarı bulunamadı! Lütfen Ayarlar > AI Sağlayıcı Ayarları\'ndan Gemini API anahtarınızı ekleyin.';
            console.error(errorMsg);
            throw new Error(errorMsg);
          }

          // Try providers in order
          let lastError;
          for (const providerInfo of providers) {
            try {
              console.log(`🚀 Trying image generation with: ${providerInfo.type}`);
              console.log(`📝 Prompt length: ${prompt.length} chars`);
              console.log(`🖼️ Reference images: ${imageOptions.referenceImages?.length || 0}`);

              // Use cleaned options without model override
              const result = await providerInfo.handler.generateImage(prompt, imageOptions);
              console.log(`✅ Success with ${providerInfo.type}!`);
              return result;
            } catch (error) {
              console.error(`❌ Image generation failed with ${providerInfo.type}:`, error.message);
              lastError = error;
              console.log(`⏭️ Trying next provider...`);
              continue;
            }
          }

          // All providers failed
          const errorDetails = lastError?.message || 'Bilinmeyen hata';
          console.error('💥 All providers failed! Last error:', errorDetails);
          throw lastError || new Error('Tüm sağlayıcılar başarısız oldu');

        } catch (error) {
          console.error('💥 Image generation error:', {
            message: error.message,
            stack: error.stack?.split('\n')[0]
          });
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

        // Fix invalid Gemini 3 models (Auto-migration)
        if (state.provider === AI_PROVIDERS.GEMINI &&
          (currentModel === 'gemini-3-pro-preview' || currentModel === 'gemini-3-pro-image-preview')) {
          const newModel = currentModel.includes('image') ? 'gemini-2.5-flash-image' : 'gemini-2.5-flash';
          console.log(`🔧 Auto-migration: invalid model ${currentModel} → ${newModel}`);

          // Update store directly
          set(state => {
            if (currentModel.includes('image')) return { geminiImageModel: newModel };
            return { geminiModel: newModel };
          });

          if (!currentModel.includes('image')) {
            currentModel = newModel;
          }
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
        temperature: state.temperature
      }),
    }
  )
);
