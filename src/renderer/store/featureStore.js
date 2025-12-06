import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useFeatureStore = create(
    persist(
        (set, get) => ({
            features: {
                enable_ai_analysis: true,
                enable_storyboard: true,
                enable_canvas: true,
            },

            toggleFeature: (featureName) =>
                set((state) => ({
                    features: {
                        ...state.features,
                        [featureName]: !state.features[featureName]
                    }
                })),

            setFeature: (featureName, value) =>
                set((state) => ({
                    features: {
                        ...state.features,
                        [featureName]: value
                    }
                })),

            isFeatureEnabled: (featureName) => {
                return get().features[featureName] || false;
            },

            getEnabledFeatures: () => {
                const features = get().features;
                return Object.keys(features).filter(key => features[key]);
            },

            getDisabledFeatures: () => {
                const features = get().features;
                return Object.keys(features).filter(key => !features[key]);
            },

            resetFeatures: () =>
                set({
                    features: {
                        enable_ai_analysis: true,
                        enable_storyboard: true,
                        enable_canvas: true,
                    }
                }),

            // Kaynak tasarrufu için modül metadata
            moduleMetadata: {
                enable_ai_analysis: {
                    name: 'Analiz',
                    description: 'Yapay zeka destekli özellikler: Analiz, Görsel Üretimi, Metin İşleme',
                    estimatedMemory: '30-50 MB',
                    apiUsage: 'Orta'
                },
                enable_storyboard: {
                    name: 'Storyboard',
                    description: 'Görselleştirme ve storyboard oluşturma araçları',
                    estimatedMemory: '50-100 MB',
                    apiUsage: 'Yüksek'
                }
            },

            getModuleInfo: (featureName) => {
                return get().moduleMetadata[featureName] || null;
            }
        }),
        {
            name: 'feature-storage', // name of the item in the storage (must be unique)
        }
    )
);
