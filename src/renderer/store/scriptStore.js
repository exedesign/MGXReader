import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export const useScriptStore = create((set, get) => ({
  // Multi-script management
  scripts: [], // Array of script objects
  currentScriptId: null, // ID of currently active script
  
  // Legacy single script data (for backward compatibility)
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
  
  // Import state
  isImporting: false,
  importProgress: null,

  // Analysis state
  isAnalyzing: false,
  analysisProgress: null,

  // Analysis data (current script)
  analysisData: null,
  scenes: [],
  characters: [],
  locations: [],
  equipment: [],

  // Multi-script management actions
  addScript: (scriptData) => {
    const newScript = {
      id: uuidv4(),
      title: scriptData.title || scriptData.fileName || 'Untitled Script',
      fileName: scriptData.fileName,
      scriptText: scriptData.scriptText,
      cleanedText: scriptData.cleanedText || scriptData.scriptText,
      pageCount: scriptData.pageCount || 0,
      metadata: scriptData.metadata || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Scene/chapter structure
      structure: scriptData.structure || {
        chapters: [], // For series: [{title: "Episode 1", scenes: [...]}]
        scenes: [], // For single script: [{title: "Scene 1", content: "..."}]
        type: scriptData.structure?.type || 'single' // 'single', 'series', 'movie'
      },
      // Analysis data
      analysisData: scriptData.analysisData || null,
      scenes: scriptData.scenes || [],
      characters: scriptData.characters || [],
      locations: scriptData.locations || [],
      equipment: scriptData.equipment || [],
      // Status
      status: 'imported', // 'importing', 'imported', 'processing', 'analyzed', 'error'
      progress: 100
    };
    
    const { scripts } = get();
    const updatedScripts = [...scripts, newScript];
    
    set({
      scripts: updatedScripts,
      currentScriptId: newScript.id
    });
    
    // Update legacy state for current script
    get().switchToScript(newScript.id);
    
    return newScript.id;
  },

  removeScript: (scriptId) => {
    const { scripts, currentScriptId } = get();
    const updatedScripts = scripts.filter(script => script.id !== scriptId);
    
    let newCurrentScriptId = currentScriptId;
    if (currentScriptId === scriptId) {
      newCurrentScriptId = updatedScripts.length > 0 ? updatedScripts[0].id : null;
    }
    
    set({
      scripts: updatedScripts,
      currentScriptId: newCurrentScriptId
    });
    
    // Update legacy state
    if (newCurrentScriptId) {
      get().switchToScript(newCurrentScriptId);
    } else {
      get().clearScript();
    }
  },

  updateScript: (scriptId, updates) => {
    const { scripts } = get();
    const updatedScripts = scripts.map(script => 
      script.id === scriptId 
        ? { ...script, ...updates, updatedAt: new Date().toISOString() }
        : script
    );
    
    set({ scripts: updatedScripts });
    
    // Update legacy state if this is current script
    if (get().currentScriptId === scriptId) {
      const updatedScript = updatedScripts.find(s => s.id === scriptId);
      get().updateLegacyState(updatedScript);
    }
  },

  switchToScript: (scriptId) => {
    const { scripts } = get();
    const script = scripts.find(s => s.id === scriptId);
    
    if (!script) {
      console.error('Script not found:', scriptId);
      return;
    }
    
    set({ currentScriptId: scriptId });
    get().updateLegacyState(script);
  },

  updateLegacyState: (script) => {
    if (!script) return;
    
    set({
      scriptText: script.scriptText,
      cleanedText: script.cleanedText,
      originalFileName: script.fileName,
      pageCount: script.pageCount,
      metadata: script.metadata,
      analysisData: script.analysisData,
      scenes: script.scenes,
      characters: script.characters,
      locations: script.locations,
      equipment: script.equipment
    });
  },

  getCurrentScript: () => {
    const { scripts, currentScriptId } = get();
    return scripts.find(script => script.id === currentScriptId) || null;
  },

  // Bulk import management
  startBulkImport: () => {
    set({
      isImporting: true,
      importProgress: { total: 0, completed: 0, current: null, errors: [] }
    });
  },

  updateImportProgress: (progress) => {
    set({
      importProgress: {
        ...get().importProgress,
        ...progress
      }
    });
  },

  finishBulkImport: () => {
    set({
      isImporting: false,
      importProgress: null
    });
  },

  // Scene/Chapter management for current script
  updateScriptStructure: (structure) => {
    const { currentScriptId } = get();
    if (!currentScriptId) return;
    
    get().updateScript(currentScriptId, { structure });
  },

  addChapterToScript: (scriptId, chapter) => {
    const { scripts } = get();
    const script = scripts.find(s => s.id === scriptId);
    if (!script) return;
    
    const newChapter = {
      id: uuidv4(),
      title: chapter.title || `Chapter ${(script.structure?.chapters?.length || 0) + 1}`,
      scenes: chapter.scenes || [],
      createdAt: new Date().toISOString(),
      ...chapter
    };
    
    const updatedStructure = {
      ...script.structure,
      chapters: [...(script.structure?.chapters || []), newChapter]
    };
    
    get().updateScript(scriptId, { structure: updatedStructure });
    return newChapter.id;
  },

  addSceneToScript: (scriptId, scene, chapterId = null) => {
    const { scripts } = get();
    const script = scripts.find(s => s.id === scriptId);
    if (!script) return;
    
    const newScene = {
      id: uuidv4(),
      title: scene.title || `Scene ${(script.structure?.scenes?.length || 0) + 1}`,
      content: scene.content || '',
      characters: scene.characters || [],
      locations: scene.locations || [],
      duration: scene.duration || null,
      createdAt: new Date().toISOString(),
      ...scene
    };
    
    let updatedStructure = { ...script.structure };
    
    if (chapterId) {
      // Add to specific chapter
      updatedStructure.chapters = updatedStructure.chapters.map(chapter =>
        chapter.id === chapterId
          ? { ...chapter, scenes: [...(chapter.scenes || []), newScene] }
          : chapter
      );
    } else {
      // Add to main scenes array
      updatedStructure.scenes = [...(updatedStructure.scenes || []), newScene];
    }
    
    get().updateScript(scriptId, { structure: updatedStructure });
    return newScene.id;
  },

  // Actions (updated to work with current script)
  setScriptText: (text, metadata = null) => {
    const { currentScriptId } = get();
    
    // Update legacy state
    set({
      scriptText: text,
      cleanedText: text, // Initially same as original
      metadata,
      error: null,
    });
    
    // Update current script if exists
    if (currentScriptId) {
      get().updateScript(currentScriptId, {
        scriptText: text,
        cleanedText: text,
        metadata
      });
    }
    
    // Calculate and store original page ratio
    const ratio = get().calculatePageRatio();
    if (ratio) {
      get().setOriginalPageRatio(ratio);
    }
  },

  setCleanedText: (text) => {
    const { currentScriptId } = get();
    
    // Update legacy state
    set({ cleanedText: text });
    
    // Update current script if exists
    if (currentScriptId) {
      get().updateScript(currentScriptId, { cleanedText: text });
    }
    
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

  setAnalysisData: (data) => {
    const { currentScriptId } = get();
    
    // Update legacy state
    set({
      analysisData: data,
      scenes: data?.scenes || [],
      characters: data?.characters || [],
      locations: data?.locations || [],
      equipment: data?.equipment || [],
    });
    
    // Update current script if exists
    if (currentScriptId) {
      get().updateScript(currentScriptId, {
        analysisData: data,
        scenes: data?.scenes || [],
        characters: data?.characters || [],
        locations: data?.locations || [],
        equipment: data?.equipment || []
      });
    }
  },

  clearScript: () => {
    set({
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
    });
  },

  clearAllScripts: () => {
    set({
      scripts: [],
      currentScriptId: null,
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
      isImporting: false,
      importProgress: null,
      isAnalyzing: false,
      analysisProgress: null
    });
  },

  // Analysis progress actions
  setAnalysisProgress: (progress) => {
    set({ 
      isAnalyzing: !!progress,
      analysisProgress: progress 
    });
  },

  setIsAnalyzing: (analyzing) => {
    set({ isAnalyzing: analyzing });
  },

  clearAnalysisProgress: () => {
    set({ 
      isAnalyzing: false,
      analysisProgress: null 
    });
  },
}));
