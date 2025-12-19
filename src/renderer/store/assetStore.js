import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * ASSET STORE
 * Manages consistent visual assets for Character and Location consistency.
 * Stores "Anchor Images" and "Master Shots".
 */
const useAssetStore = create(
  persist(
    (set, get) => ({
      // State
      characterAssets: {}, // { charName: { anchorImage: 'base64...', description: '...', physicalTraits: {} } }
      locationAssets: {},  // { locationName: { masterShot: 'base64...', style: '...' } }

      // Actions
      setCharacterAnchor: (charName, imageData, traits = {}) => {
        set((state) => ({
          characterAssets: {
            ...state.characterAssets,
            [charName]: {
              anchorImage: imageData,
              physicalTraits: traits,
              updatedAt: Date.now()
            }
          }
        }));
      },

      setLocationMaster: (locationName, imageData) => {
        set((state) => ({
          locationAssets: {
            ...state.locationAssets,
            [locationName]: {
              masterShot: imageData,
              updatedAt: Date.now()
            }
          }
        }));
      },

      getCharacterAnchor: (charName) => {
        return get().characterAssets[charName];
      },

      getLocationMaster: (locationName) => {
        return get().locationAssets[locationName];
      },

      removeCharacterAsset: (charName) => {
        set((state) => {
          const newAssets = { ...state.characterAssets };
          delete newAssets[charName];
          return { characterAssets: newAssets };
        });
      },

      clearAllAssets: () => set({ characterAssets: {}, locationAssets: {} })
    }),
    {
      name: 'asset-storage', // localStorage key
      getStorage: () => localStorage,
    }
  )
);

export default useAssetStore;
