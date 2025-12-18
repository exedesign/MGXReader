import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { analysisStorageService } from '../utils/analysisStorageService';

export const useScriptStore = create(
  persist(
    (set, get) => ({
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

  // Storyboard state  
  isStoryboardProcessing: false,
  storyboardProgress: null,

  // Analysis data (current script)
  analysisData: null,
  scenes: [],
  characters: [],
  locations: [],
  equipment: [],

  // Helper function for fuzzy project title matching
  normalizeProjectTitle: (title) => {
    if (!title) return '';
    return title
      .toLowerCase()
      .replace(/[''\u2019]/g, "'") // Normalize apostrophes
      .replace(/[i̇ı]/g, 'i') // Normalize Turkish i
      .replace(/[çğöşü]/g, match => ({ 'ç': 'c', 'ğ': 'g', 'ö': 'o', 'ş': 's', 'ü': 'u' })[match])
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/\.pdf$/i, '') // Remove .pdf
      .replace(/[^a-z0-9\s]/g, '') // Remove special chars
      .trim();
  },

  // Enhanced fuzzy project title matching
  findSimilarProjectTitle: (newTitle) => {
    const { scripts } = get();
    const normalizedNew = get().normalizeProjectTitle(newTitle);
    
    if (!normalizedNew) return null;
    
    // Get all existing project titles
    const existingTitles = [...new Set(
      scripts
        .map(s => s.structure?.projectTitle || s.structure?.seriesTitle)
        .filter(Boolean)
    )];
    
    // Find best match
    let bestMatch = null;
    let highestSimilarity = 0.7; // Minimum similarity threshold
    
    existingTitles.forEach(existingTitle => {
      const normalizedExisting = get().normalizeProjectTitle(existingTitle);
      
      // Calculate similarity (simple word overlap)
      const newWords = new Set(normalizedNew.split(/\s+/));
      const existingWords = new Set(normalizedExisting.split(/\s+/));
      
      const intersection = new Set([...newWords].filter(x => existingWords.has(x)));
      const union = new Set([...newWords, ...existingWords]);
      
      const similarity = intersection.size / union.size;
      
      // Also check if one is substring of another
      const substringMatch = normalizedNew.includes(normalizedExisting) || 
                           normalizedExisting.includes(normalizedNew);
      
      const finalSimilarity = substringMatch ? Math.max(similarity, 0.8) : similarity;
      
      if (finalSimilarity > highestSimilarity) {
        highestSimilarity = finalSimilarity;
        bestMatch = existingTitle;
      }
    });
    
    return bestMatch;
  },

  // Multi-script management actions
  addScript: (scriptData) => {
    const structure = scriptData.structure || {};
    
    // Enhanced project matching with fuzzy logic
    const candidateProjectTitle = structure.projectTitle || structure.seriesTitle;
    const similarProjectTitle = get().findSimilarProjectTitle(candidateProjectTitle);
    
    // Use the existing similar title if found, otherwise use the new one
    const finalProjectTitle = similarProjectTitle || candidateProjectTitle;
    
    console.log('🔍 Project title matching:', {
      candidate: candidateProjectTitle,
      foundSimilar: similarProjectTitle,
      final: finalProjectTitle,
      method: similarProjectTitle ? 'fuzzy-match' : 'new-project'
    });
    
    // Check if this script belongs to an existing project
    const existingProjectScript = get().findProjectScript({ projectTitle: finalProjectTitle });
    
    const newScript = {
      id: uuidv4(),
      title: scriptData.title || scriptData.fileName || 'Untitled Script',
      fileName: scriptData.fileName,
      name: scriptData.fileName, // Add name property for consistency
      scriptText: scriptData.scriptText,
      cleanedText: scriptData.cleanedText || scriptData.scriptText,
      pageCount: scriptData.pageCount || 0,
      metadata: scriptData.metadata || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      
      // ✨ NEW: Structured elements with coordinates (Phase 1 - Coordinate-based parsing)
      elements: scriptData.elements || [],  // Array of { id, type, text, page, bbox, fontName, fontSize }
      
      // Enhanced project structure
      structure: {
        type: structure.type || 'single',
        projectTitle: finalProjectTitle || structure.seriesTitle || null,
        title: structure.title || scriptData.title || scriptData.fileName,
        chapterNumber: structure.chapterNumber || structure.episodeNumber || null,
        chapterTitle: structure.chapterTitle || null,
        seriesTitle: structure.seriesTitle || null,
        episodeNumber: structure.episodeNumber || null,
        seasonNumber: structure.seasonNumber || null,
        chapters: structure.chapters || [],
        scenes: structure.scenes || []
      },
      
      // Analysis data
      analysisData: scriptData.analysisData || null,
      scenes: scriptData.scenes || [],
      characters: scriptData.characters || [],
      locations: scriptData.locations || [],
      equipment: scriptData.equipment || [],
      
      // Status
      status: 'imported',
      progress: 100,
      
      // Project grouping
      projectGroup: finalProjectTitle || structure.seriesTitle || null
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

  // Find if a script belongs to an existing project
  findProjectScript: (structure) => {
    const { scripts } = get();
    const projectTitle = structure.projectTitle || structure.seriesTitle;
    
    if (!projectTitle) return null;
    
    return scripts.find(script => 
      script.structure?.projectTitle === projectTitle ||
      script.structure?.seriesTitle === projectTitle
    );
  },

  // Get scripts grouped by project
  getGroupedScripts: () => {
    const { scripts } = get();
    const grouped = {};
    const ungrouped = [];
    
    scripts.forEach(script => {
      // 🎯 Yeni sistem: projectGroup kullan
      const projectTitle = script.projectGroup || 
                          script.structure?.projectTitle || 
                          script.structure?.seriesTitle ||
                          script.metadata?.projectTitle;
      
      if (projectTitle) {
        // Use fuzzy matching to find existing group
        const existingGroupKey = Object.keys(grouped).find(key => {
          const similarity = get().normalizeProjectTitle(key) === get().normalizeProjectTitle(projectTitle);
          return similarity || get().findSimilarProjectTitle(projectTitle) === key;
        });
        
        const groupKey = existingGroupKey || projectTitle;
        
        if (!grouped[groupKey]) {
          grouped[groupKey] = [];
        }
        grouped[groupKey].push(script);
      } else {
        ungrouped.push(script);
      }
    });
    
    // Sort chapters/episodes within each project
    Object.keys(grouped).forEach(projectTitle => {
      grouped[projectTitle].sort((a, b) => {
        const aNum = a.chapterNumber || a.structure?.chapterNumber || a.structure?.episodeNumber || 0;
        const bNum = b.chapterNumber || b.structure?.chapterNumber || b.structure?.episodeNumber || 0;
        return aNum - bNum;
      });
    });
    
    return { grouped, ungrouped };
  },

  // Get project summary
  getProjectSummary: (projectTitle) => {
    const { scripts } = get();
    const projectScripts = scripts.filter(script => 
      script.structure?.projectTitle === projectTitle ||
      script.structure?.seriesTitle === projectTitle
    );
    
    if (projectScripts.length === 0) return null;
    
    const chapters = projectScripts
      .filter(script => script.structure?.chapterNumber || script.structure?.episodeNumber)
      .sort((a, b) => {
        const aNum = a.structure?.chapterNumber || a.structure?.episodeNumber || 0;
        const bNum = b.structure?.chapterNumber || b.structure?.episodeNumber || 0;
        return aNum - bNum;
      });
    
    return {
      title: projectTitle,
      totalChapters: chapters.length,
      chapters: chapters.map(script => ({
        id: script.id,
        number: script.structure?.chapterNumber || script.structure?.episodeNumber,
        title: script.structure?.chapterTitle || script.structure?.title,
        fileName: script.fileName,
        status: script.status,
        pageCount: script.pageCount
      })),
      type: projectScripts[0]?.structure?.type || 'series',
      createdAt: Math.min(...projectScripts.map(s => new Date(s.createdAt).getTime())),
      updatedAt: Math.max(...projectScripts.map(s => new Date(s.updatedAt).getTime()))
    };
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
    
    // Ensure backward compatibility: add name property if missing
    if (!script.name && script.fileName) {
      script.name = script.fileName;
      get().updateScript(scriptId, { name: script.fileName });
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
  setScriptText: async (text, metadata = null) => {
    const { currentScriptId, originalFileName } = get();
    
    // Update legacy state
    set({
      scriptText: text,
      cleanedText: text, // Initially same as original
      metadata,
      error: null,
    });
    
    // Try to load existing analysis from persistent storage
    if (originalFileName) {
      try {
        const existingAnalysis = await analysisStorageService.loadAnalysis(text, originalFileName);
        if (existingAnalysis) {
          console.log('Loaded existing analysis from storage');
          set({
            analysisData: existingAnalysis,
            scenes: existingAnalysis?.scenes || [],
            characters: existingAnalysis?.characters || [],
            locations: existingAnalysis?.locations || [],
            equipment: existingAnalysis?.equipment || [],
          });
          
          // Update current script if exists
          if (currentScriptId) {
            get().updateScript(currentScriptId, {
              analysisData: existingAnalysis,
              scenes: existingAnalysis?.scenes || [],
              characters: existingAnalysis?.characters || [],
              locations: existingAnalysis?.locations || [],
              equipment: existingAnalysis?.equipment || []
            });
          }
        }
      } catch (error) {
        console.error('Failed to load existing analysis:', error);
      }
    }
    
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

  setAnalysisData: async (data) => {
    const { currentScriptId, scriptText, originalFileName } = get();
    
    // Update legacy state
    set({
      analysisData: data,
      scenes: data?.scenes || [],
      characters: data?.characters || [],
      locations: data?.locations || [],
      equipment: data?.equipment || [],
    });
    
    // Save analysis to persistent storage
    if (scriptText && originalFileName && data) {
      try {
        await analysisStorageService.saveAnalysis(scriptText, originalFileName, data);
        console.log('Analysis saved to persistent storage');
      } catch (error) {
        console.error('Failed to save analysis to persistent storage:', error);
      }
    }
    
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
      analysisProgress: null,
      analysisAbortController: null 
    });
  },

  cancelAnalysis: () => {
    const { analysisAbortController } = get();
    if (analysisAbortController) {
      analysisAbortController.abort();
      console.log('🚫 Analysis cancelled by user');
    }
    set({ 
      isAnalyzing: false,
      analysisProgress: null,
      analysisAbortController: null 
    });
  },

  setAnalysisAbortController: (controller) => {
    set({ analysisAbortController: controller });
  },

  // Storyboard progress actions
  setStoryboardProgress: (progress) => {
    set({ 
      isStoryboardProcessing: !!progress,
      storyboardProgress: progress 
    });
  },

  setIsStoryboardProcessing: (processing) => {
    set({ isStoryboardProcessing: processing });
  },

  clearStoryboardProgress: () => {
    set({ 
      isStoryboardProcessing: false,
      storyboardProgress: null,
      storyboardAbortController: null 
    });
  },

  cancelStoryboard: () => {
    const { storyboardAbortController } = get();
    if (storyboardAbortController) {
      storyboardAbortController.abort();
      console.log('🚫 Storyboard generation cancelled by user');
    }
    set({ 
      isStoryboardProcessing: false,
      storyboardProgress: null,
      storyboardAbortController: null 
    });
  },

  setStoryboardAbortController: (controller) => {
    set({ storyboardAbortController: controller });
  },
    }),
    {
      name: 'mgx-script-store',
      partialize: (state) => ({
        // Persist only essential data, excluding temporary states
        scripts: state.scripts,
        currentScriptId: state.currentScriptId,
        
        // Persist analysis data for current script
        analysisData: state.analysisData,
        scenes: state.scenes,
        characters: state.characters,
        locations: state.locations,
        equipment: state.equipment,
        
        // Persist script content
        scriptText: state.scriptText,
        cleanedText: state.cleanedText,
        originalFileName: state.originalFileName,
        pageCount: state.pageCount,
        metadata: state.metadata,
        
        // Persist page tracking
        pageBreaks: state.pageBreaks,
        wordsPerPage: state.wordsPerPage,
        originalPageRatio: state.originalPageRatio,
        isPageTrackingEnabled: state.isPageTrackingEnabled,
      }),
      // Exclude temporary states from persistence
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...persistedState,
        // Reset temporary states on load
        isLoading: false,
        error: null,
        isImporting: false,
        importProgress: null,
        isAnalyzing: false,
        analysisProgress: null,
        analysisAbortController: null,
        isStoryboardProcessing: false,
        storyboardProgress: null,
        storyboardAbortController: null,
        currentView: 'editor', // Reset to default view
      }),
      // Cleanup handler after rehydration
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error) {
            console.error('❌ Store rehydration hatası:', error);
            return;
          }
          
          console.log('🔄 Store rehydration tamamlandı, temizlik kontrol ediliyor...');
          
          // Clean up analysis data for deleted scripts
          if (state?.scripts) {
            const existingScriptIds = new Set(state.scripts.map(s => s.id));
            
            // Check if current script still exists
            if (state.currentScriptId && !existingScriptIds.has(state.currentScriptId)) {
              console.log('⚠️ Aktif script bulunamadı, temizleniyor...');
              state.currentScriptId = null;
              state.analysisData = null;
              state.scenes = [];
              state.characters = [];
              state.locations = [];
              state.equipment = [];
              state.scriptText = null;
              state.cleanedText = null;
              state.originalFileName = null;
            }
            
            // Clean orphaned localStorage keys
            const keysToCheck = ['mgx_analysis_', 'mgx_storyboard_', 'analysis_checkpoint_', 'temp_'];
            let cleanedCount = 0;
            
            for (let i = localStorage.length - 1; i >= 0; i--) {
              const key = localStorage.key(i);
              if (!key) continue;
              
              const isAnalysisKey = keysToCheck.some(prefix => key.startsWith(prefix));
              if (isAnalysisKey) {
                const scriptStillExists = Array.from(existingScriptIds).some(scriptId => 
                  key.includes(scriptId) || key.includes(scriptId.substring(0, 8))
                );
                
                if (!scriptStillExists) {
                  localStorage.removeItem(key);
                  cleanedCount++;
                  console.log(`  ❌ Temizlendi: ${key}`);
                }
              }
            }
            
            if (cleanedCount > 0) {
              console.log(`✅ Rehydration temizliği: ${cleanedCount} eski kayıt silindi`);
            }
          }
        };
      }
    }
  )
);
