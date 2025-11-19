import { create } from 'zustand';

export const useScriptStore = create((set, get) => ({
  // Script data
  scriptText: null,
  cleanedText: null,
  originalFileName: null,
  pageCount: 0,
  metadata: null,
  
  // Page tracking
  pageBreaks: [], // Array of word indices where pages break
  wordsPerPage: [], // Array showing word count per page
  originalPageRatio: null, // Original page distribution ratio
  isPageTrackingEnabled: true,

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
  setScriptText: (text, metadata = null) => {
    set({
      scriptText: text,
      cleanedText: text, // Initially same as original
      metadata,
      error: null,
    });
    
    // Calculate and store original page ratio
    const ratio = get().calculatePageRatio();
    if (ratio) {
      get().setOriginalPageRatio(ratio);
    }
  },

  setCleanedText: (text) => {
    set({ cleanedText: text });
    // Update page tracking when cleaned text changes
    if (get().isPageTrackingEnabled) {
      get().updatePageTracking(text);
    }
  },

  setOriginalFileName: (fileName) => set({ originalFileName: fileName }),

  setPageCount: (count) => set({ pageCount: count }),

  // Page tracking functions
  setPageBreaks: (breaks) => set({ pageBreaks: breaks }),
  
  setWordsPerPage: (wordsPerPage) => set({ wordsPerPage }),
  
  setOriginalPageRatio: (ratio) => set({ originalPageRatio: ratio }),
  
  calculatePageRatio: () => {
    const state = get();
    if (!state.scriptText || state.pageCount === 0) return null;
    
    const totalWords = state.scriptText.split(/\s+/).filter(w => w.length > 0).length;
    return {
      totalWords,
      pageCount: state.pageCount,
      wordsPerPage: totalWords / state.pageCount,
      ratio: totalWords / state.pageCount
    };
  },
  
  // Update page tracking when text changes
  updatePageTracking: (newText) => {
    const state = get();
    if (!state.originalPageRatio) return;
    
    const newWords = newText.split(/\s+/).filter(w => w.length > 0);
    const newTotalWords = newWords.length;
    const originalWordsPerPage = state.originalPageRatio.wordsPerPage;
    
    // Calculate new page breaks maintaining original ratio
    const newPageBreaks = [];
    const newWordsPerPage = [];
    
    for (let page = 1; page <= state.pageCount; page++) {
      const expectedWordsInPage = Math.round(originalWordsPerPage);
      const pageStartIndex = (page - 1) * expectedWordsInPage;
      const pageEndIndex = Math.min(pageStartIndex + expectedWordsInPage, newTotalWords);
      
      if (page < state.pageCount) {
        newPageBreaks.push(pageEndIndex);
      }
      newWordsPerPage.push(pageEndIndex - pageStartIndex);
    }
    
    set({ 
      pageBreaks: newPageBreaks,
      wordsPerPage: newWordsPerPage
    });
  },

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
