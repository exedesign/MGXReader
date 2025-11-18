import { create } from 'zustand';

export const useScriptStore = create((set) => ({
  // Script data
  scriptText: null,
  cleanedText: null,
  originalFileName: null,
  pageCount: 0,
  metadata: null,

  // UI State
  currentView: 'editor', // 'editor', 'analysis', 'reader'
  isLoading: false,
  error: null,

  // Analysis data
  analysisData: null,
  scenes: [],
  characters: [],
  locations: [],
  equipment: [],

  // Actions
  setScriptText: (text, metadata = null) => set({
    scriptText: text,
    cleanedText: text, // Initially same as original
    metadata,
    error: null,
  }),

  setCleanedText: (text) => set({ cleanedText: text }),

  setOriginalFileName: (fileName) => set({ originalFileName: fileName }),

  setPageCount: (count) => set({ pageCount: count }),

  setCurrentView: (view) => set({ currentView: view }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  setAnalysisData: (data) => set({
    analysisData: data,
    scenes: data?.scenes || [],
    characters: data?.characters || [],
    locations: data?.locations || [],
    equipment: data?.equipment || [],
  }),

  clearScript: () => set({
    scriptText: null,
    cleanedText: null,
    originalFileName: null,
    pageCount: 0,
    metadata: null,
    analysisData: null,
    scenes: [],
    characters: [],
    locations: [],
    equipment: [],
    currentView: 'editor',
    error: null,
  }),
}));
