/**
 * Asset Store - Global Visual Consistency Management
 * 
 * Stores approved character images, physical descriptions, costume data,
 * and reference images for maintaining visual consistency across all shots.
 * 
 * Hollywood Standard: Single source of truth for all visual assets
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAssetStore = create(
  persist(
    (set, get) => ({
      // Character Assets
      characters: {},
      // {
      //   "JOHN DOE": {
      //     name: "JOHN DOE",
      //     approvedImages: [
      //       { id: "img-1", url: "base64...", type: "portrait", approved: true, generatedAt: "..." }
      //     ],
      //     physicalDescription: {
      //       age: "35",
      //       height: "6'2\"",
      //       build: "Athletic",
      //       hair: "Dark brown, short",
      //       eyes: "Blue",
      //       skin: "Tanned",
      //       distinctiveFeatures: "Scar on left cheek"
      //     },
      //     costumes: [
      //       {
      //         id: "costume-1",
      //         name: "Police Uniform",
      //         description: "Dark blue police uniform with badge",
      //         scenes: [1, 3, 5, 7],
      //         referenceImages: ["base64..."]
      //       }
      //     ],
      //     notes: "Lead character. Detective with troubled past."
      //   }
      // }

      // Location Assets
      locations: {},
      // {
      //   "DOWNTOWN PRECINCT": {
      //     name: "DOWNTOWN PRECINCT",
      //     approvedImages: [],
      //     description: "Modern police station with glass facade",
      //     type: "INT",
      //     timeOfDay: ["DAY", "NIGHT"],
      //     scenes: [1, 4, 8],
      //     referenceImages: []
      //   }
      // }

      // Props and Objects
      props: {},
      // {
      //   "MURDER WEAPON": {
      //     name: "MURDER WEAPON",
      //     approvedImages: [],
      //     description: "Chrome .45 caliber handgun",
      //     scenes: [12, 15, 20],
      //     notes: "Key evidence. Must appear consistently."
      //   }
      // }

      // Global Reference Library
      referenceLibrary: [],
      // [
      //   {
      //     id: "ref-1",
      //     type: "character" | "location" | "prop" | "mood" | "style",
      //     name: "Film Noir Lighting Reference",
      //     url: "base64...",
      //     tags: ["lighting", "noir", "high-contrast"],
      //     notes: "Target lighting style for interrogation scenes"
      //   }
      // ]

      // Project Metadata
      projectMetadata: {
        projectName: '',
        genre: '',
        visualStyle: '',
        colorPalette: [],
        cinematographyNotes: ''
      },

      // ===== CHARACTER OPERATIONS =====

      addCharacter: (characterName, data = {}) => {
        set((state) => ({
          characters: {
            ...state.characters,
            [characterName]: {
              name: characterName,
              approvedImages: [],
              physicalDescription: data.physicalDescription || {},
              costumes: [],
              notes: data.notes || '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          }
        }));
      },

      updateCharacter: (characterName, updates) => {
        set((state) => ({
          characters: {
            ...state.characters,
            [characterName]: {
              ...state.characters[characterName],
              ...updates,
              updatedAt: new Date().toISOString()
            }
          }
        }));
      },

      addCharacterImage: (characterName, imageData) => {
        set((state) => {
          const character = state.characters[characterName];
          if (!character) return state;

          return {
            characters: {
              ...state.characters,
              [characterName]: {
                ...character,
                approvedImages: [
                  ...character.approvedImages,
                  {
                    id: `img-${Date.now()}`,
                    url: imageData.url,
                    type: imageData.type || 'portrait',
                    approved: imageData.approved !== false,
                    generatedAt: new Date().toISOString(),
                    prompt: imageData.prompt || '',
                    metadata: imageData.metadata || {}
                  }
                ],
                updatedAt: new Date().toISOString()
              }
            }
          };
        });
      },

      removeCharacterImage: (characterName, imageId) => {
        set((state) => {
          const character = state.characters[characterName];
          if (!character) return state;

          return {
            characters: {
              ...state.characters,
              [characterName]: {
                ...character,
                approvedImages: character.approvedImages.filter(img => img.id !== imageId),
                updatedAt: new Date().toISOString()
              }
            }
          };
        });
      },

      updateCharacterPhysicalDescription: (characterName, description) => {
        set((state) => ({
          characters: {
            ...state.characters,
            [characterName]: {
              ...state.characters[characterName],
              physicalDescription: {
                ...state.characters[characterName]?.physicalDescription,
                ...description
              },
              updatedAt: new Date().toISOString()
            }
          }
        }));
      },

      addCostume: (characterName, costumeData) => {
        set((state) => {
          const character = state.characters[characterName];
          if (!character) return state;

          return {
            characters: {
              ...state.characters,
              [characterName]: {
                ...character,
                costumes: [
                  ...character.costumes,
                  {
                    id: `costume-${Date.now()}`,
                    name: costumeData.name,
                    description: costumeData.description,
                    scenes: costumeData.scenes || [],
                    referenceImages: costumeData.referenceImages || [],
                    createdAt: new Date().toISOString()
                  }
                ],
                updatedAt: new Date().toISOString()
              }
            }
          };
        });
      },

      // ===== LOCATION OPERATIONS =====

      addLocation: (locationName, data = {}) => {
        set((state) => ({
          locations: {
            ...state.locations,
            [locationName]: {
              name: locationName,
              approvedImages: [],
              description: data.description || '',
              type: data.type || 'INT',
              timeOfDay: data.timeOfDay || [],
              scenes: data.scenes || [],
              referenceImages: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          }
        }));
      },

      updateLocation: (locationName, updates) => {
        set((state) => ({
          locations: {
            ...state.locations,
            [locationName]: {
              ...state.locations[locationName],
              ...updates,
              updatedAt: new Date().toISOString()
            }
          }
        }));
      },

      addLocationImage: (locationName, imageData) => {
        set((state) => {
          const location = state.locations[locationName];
          if (!location) return state;

          return {
            locations: {
              ...state.locations,
              [locationName]: {
                ...location,
                approvedImages: [
                  ...location.approvedImages,
                  {
                    id: `img-${Date.now()}`,
                    url: imageData.url,
                    timeOfDay: imageData.timeOfDay || 'DAY',
                    approved: imageData.approved !== false,
                    generatedAt: new Date().toISOString(),
                    prompt: imageData.prompt || ''
                  }
                ],
                updatedAt: new Date().toISOString()
              }
            }
          };
        });
      },

      // ===== PROP OPERATIONS =====

      addProp: (propName, data = {}) => {
        set((state) => ({
          props: {
            ...state.props,
            [propName]: {
              name: propName,
              approvedImages: [],
              description: data.description || '',
              scenes: data.scenes || [],
              notes: data.notes || '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          }
        }));
      },

      updateProp: (propName, updates) => {
        set((state) => ({
          props: {
            ...state.props,
            [propName]: {
              ...state.props[propName],
              ...updates,
              updatedAt: new Date().toISOString()
            }
          }
        }));
      },

      // ===== REFERENCE LIBRARY =====

      addReference: (referenceData) => {
        set((state) => ({
          referenceLibrary: [
            ...state.referenceLibrary,
            {
              id: `ref-${Date.now()}`,
              type: referenceData.type,
              name: referenceData.name,
              url: referenceData.url,
              tags: referenceData.tags || [],
              notes: referenceData.notes || '',
              createdAt: new Date().toISOString()
            }
          ]
        }));
      },

      removeReference: (referenceId) => {
        set((state) => ({
          referenceLibrary: state.referenceLibrary.filter(ref => ref.id !== referenceId)
        }));
      },

      // ===== PROJECT METADATA =====

      updateProjectMetadata: (metadata) => {
        set((state) => ({
          projectMetadata: {
            ...state.projectMetadata,
            ...metadata
          }
        }));
      },

      // ===== UTILITY FUNCTIONS =====

      getCharacterByName: (characterName) => {
        return get().characters[characterName] || null;
      },

      getLocationByName: (locationName) => {
        return get().locations[locationName] || null;
      },

      getPropByName: (propName) => {
        return get().props[propName] || null;
      },

      getAllCharacters: () => {
        return Object.values(get().characters);
      },

      getAllLocations: () => {
        return Object.values(get().locations);
      },

      getAllProps: () => {
        return Object.values(get().props);
      },

      getCharacterForScene: (sceneNumber) => {
        const characters = get().characters;
        return Object.values(characters).filter(char =>
          char.costumes.some(costume => costume.scenes.includes(sceneNumber))
        );
      },

      // ===== BULK IMPORT =====

      importFromAnalysis: (analysis) => {
        const { characters = [], locations = [], scenes = [] } = analysis;

        // Import characters
        characters.forEach(char => {
          const characterName = char.name?.toUpperCase() || char;
          if (typeof characterName === 'string' && !get().characters[characterName]) {
            get().addCharacter(characterName, {
              physicalDescription: char.description || {},
              notes: char.role || ''
            });
          }
        });

        // Import locations from scenes
        scenes.forEach((scene, idx) => {
          const locationName = scene.location || `SCENE ${idx + 1}`;
          if (!get().locations[locationName]) {
            get().addLocation(locationName, {
              type: scene.intExt || 'INT',
              timeOfDay: [scene.timeOfDay || 'DAY'],
              scenes: [idx + 1],
              description: scene.description || ''
            });
          }
        });
      },

      // ===== RESET =====

      resetAssets: () => {
        set({
          characters: {},
          locations: {},
          props: {},
          referenceLibrary: [],
          projectMetadata: {
            projectName: '',
            genre: '',
            visualStyle: '',
            colorPalette: [],
            cinematographyNotes: ''
          }
        });
      }
    }),
    {
      name: 'mgx-asset-store',
      version: 1,
      migrate: (persistedState, version) => {
        // Migration logic for future versions
        return persistedState;
      }
    }
  )
);

export default useAssetStore;
