import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useScriptStore } from '../store/scriptStore';
import { useAIStore } from '../store/aiStore';
import { usePromptStore } from '../store/promptStore';
import { useReaderStore } from '../store/readerStore';
import { useFeatureStore } from '../store/featureStore';
import useAssetStore from '../store/assetStore';
import AIHandler, { calculateGeminiCost } from '../utils/aiHandler';
import PDFExportService from '../utils/pdfExportService';
import { analysisStorageService } from '../utils/analysisStorageService';
import { parseCharacterAnalysis, optimizeForStoryboard, generateCharacterSummary } from '../utils/characterAnalysisParser';
import { estimateTokens, estimateOutputTokens } from '../utils/tokenEstimator';
import DynamicDataTable from './DynamicDataTable';
import CostPreviewModal from './CostPreviewModal';
import { updateTokenUsage } from '../utils/tokenTracker';
// jsonValidator kaldırıldı - artık AI'dan gelen JSON'a müdahale edilmiyor

/**
 * Simple hash function for generating cache keys
 * @param {string} str - String to hash
 * @returns {string} - Hash string
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

export default function AnalysisPanel() {
  const { cleanedText, scriptText, analysisData, setAnalysisData, isAnalyzing, analysisProgress, setAnalysisProgress, setIsAnalyzing, clearAnalysisProgress, setAnalysisAbortController, cancelAnalysis, isStoryboardProcessing, storyboardProgress, currentScriptId } = useScriptStore();
  const { isConfigured, provider, getAIHandler, geminiModel } = useAIStore();
  const { getActivePrompt, getPromptTypes, activePrompts, getPrompt, getPromptsByModule } = usePromptStore();
  const { blacklist } = useReaderStore();
  const { t } = useTranslation();

  // Apply blacklist filtering to text for analysis
  const filteredAnalysisText = useMemo(() => {
    const baseText = cleanedText || scriptText;
    if (!blacklist?.length || !baseText) {
      return baseText;
    }

    let filtered = baseText;
    blacklist.forEach(word => {
      const trimmedWord = word?.trim();
      if (trimmedWord && trimmedWord.length > 0) {
        // Escape special regex characters and create regex for word boundaries
        const escapedWord = trimmedWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
        filtered = filtered.replace(regex, '');
      }
    });

    return filtered.replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
  }, [cleanedText, scriptText, blacklist]);

  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'scenes', 'locations', 'characters', 'equipment', 'vfx', 'production', 'evaluation', 'audience', 'custom', 'saved'
  const [useCustomAnalysis, setUseCustomAnalysis] = useState(false);
  const [selectedCustomPrompt, setSelectedCustomPrompt] = useState('character');

  // Token usage tracking with localStorage persistence
  const [sessionTokenUsage, setSessionTokenUsage] = useState(() => {
    const saved = localStorage.getItem('mgxreader_token_usage');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to parse saved token usage:', e);
      }
    }
    return {
      totalTokens: 0,
      totalCost: 0,
      estimatedTokens: 0,
      byModel: {},
      byAnalysisType: {},
      requestCount: 0,
      accuracy: []
    };
  });

  // Persist token usage to localStorage whenever it changes
  useEffect(() => {
    if (sessionTokenUsage.requestCount > 0) {
      localStorage.setItem('mgxreader_token_usage', JSON.stringify(sessionTokenUsage));
    }
  }, [sessionTokenUsage]);

  // Cost preview modal state
  const [showCostPreview, setShowCostPreview] = useState(false);
  const [costEstimates, setCostEstimates] = useState([]);
  const [pendingAnalysisStart, setPendingAnalysisStart] = useState(false);

  const [customResults, setCustomResults] = useState({});
  const [showAnalysisDropdown, setShowAnalysisDropdown] = useState(false);
  const [savedAnalyses, setSavedAnalyses] = useState([]);
  const [loadingSavedAnalyses, setLoadingSavedAnalyses] = useState(false);

  // Multi-analysis selection - Başlangıçta HİÇBİRİ seçili değil
  const [selectedAnalysisTypes, setSelectedAnalysisTypes] = useState(() => {
    const allTypes = {};
    // Get prompts assigned to analysis_panel module
    const analysisPanelPrompts = getPromptsByModule('analysis_panel');

    analysisPanelPrompts.forEach(({ key }) => {
      // Başlangıçta hiçbiri seçili değil
      allTypes[key] = false;
    });

    console.log('📊 Analysis Panel başlatıldı:', analysisPanelPrompts.length, 'analiz mevcut (hiçbiri seçili değil)');
    return allTypes;
  });

  // PromptStore değişikliklerini dinle ve selectedAnalysisTypes'ı güncelle
  useEffect(() => {
    const analysisPanelPrompts = getPromptsByModule('analysis_panel');
    const newTypes = {};

    analysisPanelPrompts.forEach(({ key }) => {
      // Mevcut seçimi koru, yoksa default (non-llama seçili)
      newTypes[key] = selectedAnalysisTypes[key] !== undefined
        ? selectedAnalysisTypes[key]
        : !key.includes('llama');
    });

    // Sadece değişiklik varsa güncelle
    const currentKeys = Object.keys(selectedAnalysisTypes).sort();
    const newKeys = Object.keys(newTypes).sort();

    if (JSON.stringify(currentKeys) !== JSON.stringify(newKeys)) {
      console.log('📊 Analysis Panel seçimleri güncellendi:', newKeys.length, 'analiz türü');
      setSelectedAnalysisTypes(newTypes);
    }
  }, [getPromptsByModule]);

  // Track current script and load existing analysis data
  useEffect(() => {
    // ALWAYS clear customResults when script changes
    console.log('🔄 Script değişti, customResults temizleniyor...');
    setCustomResults({});

    const loadExistingAnalysisData = async () => {
      const currentScript = useScriptStore.getState().getCurrentScript();

      if (!currentScript) {
        // Clear analysis data when no script
        console.log('❌ Script yok, state temizleniyor');
        return;
      }

      const scriptText = currentScript.scriptText || currentScript.cleanedText;
      const fileName = currentScript.fileName || currentScript.name;

      if (!scriptText || !fileName) {
        console.log('❌ Script metni veya dosya adı yok');
        return;
      }

      console.log('🔍 Loading existing analysis for script:', fileName);

      try {
        // Priority 1: Check if analysis data exists in current script store
        if (currentScript.analysisData?.customResults) {
          setCustomResults(currentScript.analysisData.customResults);
          console.log('📋 Loaded analysis from script store:', Object.keys(currentScript.analysisData.customResults).length, 'results');
          return;
        }

        // Priority 2: Try to load from persistent storage
        const existingAnalysis = await analysisStorageService.loadAnalysis(scriptText, fileName);
        if (existingAnalysis?.customResults) {
          setCustomResults(existingAnalysis.customResults);
          setAnalysisData(existingAnalysis);
          console.log('💾 Loaded analysis from persistent storage:', Object.keys(existingAnalysis.customResults).length, 'results');

          // Update script store with loaded analysis
          const { updateScript } = useScriptStore.getState();
          updateScript(currentScript.id, {
            analysisData: existingAnalysis,
            scenes: existingAnalysis?.scenes || [],
            characters: existingAnalysis?.characters || [],
            locations: existingAnalysis?.locations || [],
            equipment: existingAnalysis?.equipment || [],
            updatedAt: new Date().toISOString()
          });
        } else {
          // No existing analysis found
          console.log('✅ No existing analysis found for script - customResults is empty');
        }
      } catch (error) {
        console.error('Failed to load existing analysis:', error);
      }
    };

    loadExistingAnalysisData();
  }, [currentScriptId]); // Reaktif dependency - script her değiştiğinde çalışır

  // Storyboard'dan gelen otomatik analiz seçimi eventi dinle
  // Storyboard'dan geldiğinde otomatik analiz başlatma için flag
  const [shouldAutoStartAnalysis, setShouldAutoStartAnalysis] = useState(false);

  useEffect(() => {
    const handleStoryboardAnalysisSelection = (event) => {
      if (window.storyboardRequestedAnalysis || event?.detail) {
        const { autoStart = false } = event?.detail || {};
        console.log(`🎬 Storyboard için gerekli analizler seçiliyor... (autoStart: ${autoStart})`);

        // Storyboard modülü için tanımlanmış promptları al
        const storyboardPrompts = getPromptsByModule('storyboard');
        const storyboardKeys = storyboardPrompts.map(p => p.key);

        console.log('🎯 Storyboard için gerekli analizler:', storyboardKeys);

        // Mevcut seçimleri koru, sadece storyboard analizlerini güncelle
        setSelectedAnalysisTypes(prevSelection => {
          const newSelection = { ...prevSelection };

          // Önce TÜM analizleri false yap
          Object.keys(newSelection).forEach(key => {
            newSelection[key] = false;
          });

          // Sadece storyboard için gerekli olanları true yap
          storyboardKeys.forEach(key => {
            newSelection[key] = true;
          });

          return newSelection;
        });

        // Flag'i temizle ve (istenirse) otomatik başlatma flag'ini set et
        window.storyboardRequestedAnalysis = false;
        setShouldAutoStartAnalysis(autoStart);
      }
    };

    window.addEventListener('selectStoryboardAnalysis', handleStoryboardAnalysisSelection);

    return () => {
      window.removeEventListener('selectStoryboardAnalysis', handleStoryboardAnalysisSelection);
    };
  }, [getPromptTypes]);

  // State güncellendikten sonra otomatik analiz başlat
  useEffect(() => {
    if (shouldAutoStartAnalysis) {
      const selectedTypes = Object.keys(selectedAnalysisTypes).filter(key => selectedAnalysisTypes[key]);
      console.log('🚀 Otomatik başlatılacak analizler:', selectedTypes);

      if (selectedTypes.length > 0) {
        // Reset progress tracking (storyboard modülüne bildir)
        window.dispatchEvent(new CustomEvent('storyboardAnalysisReset'));

        // Biraz bekle ki state tam güncellensin, sonra maliyet önizlemesi göster
        setTimeout(() => {
          calculateCostEstimate(); // Maliyet önizlemesini göster
          setShouldAutoStartAnalysis(false);
        }, 500);
      } else {
        console.error('❌ Hiç analiz seçilmedi!');
        setShouldAutoStartAnalysis(false);
      }
    }
  }, [shouldAutoStartAnalysis, selectedAnalysisTypes]);

  // 🔄 ARA KAYITTAN DEVAM ET FONKSİYONU
  const continuePartialAnalysis = async (text, remainingTypes, existingResults, abortController) => {
    console.log(`🔄 Ara kayıttan devam: ${remainingTypes.length} analiz kaldı:`, remainingTypes);

    const multiResults = { ...existingResults }; // Mevcut sonuçları koru
    const totalAnalyses = Object.keys(existingResults).length + remainingTypes.length;
    let completed = Object.keys(existingResults).length; // Tamamlanan sayısı
    const aiHandler = getAIHandler();
    const currentScript = useScriptStore.getState().currentScript;

    for (const analysisType of remainingTypes) {
      // Abort check
      if (abortController.signal.aborted) {
        console.log('🚫 Analysis cancelled during continuation');
        break;
      }

      let prompt = getPrompt('analysis', analysisType);
      if (!prompt) {
        // Fallback: Try with different naming conventions
        const fallbackNames = [
          `llama_${analysisType}`,
          analysisType.replace('_', ''),
          analysisType.toLowerCase()
        ];

        for (const fallbackName of fallbackNames) {
          prompt = getPrompt('analysis', fallbackName);
          if (prompt) {
            console.log(`✅ Found prompt with fallback name: ${fallbackName}`);
            break;
          }
        }

        if (!prompt) {
          console.warn(`❌ Prompt not found for analysis type: ${analysisType} (tried: ${analysisType}, ${fallbackNames.join(', ')})`);
          continue;
        }
      }

      try {
        // Update progress before starting analysis
        setAnalysisProgress({
          message: `${prompt.name} analizi yapılıyor... (${completed + 1}/${totalAnalyses}) - DEVAM EDİYOR`,
          progress: ((completed + 0.5) / totalAnalyses) * 100,
          currentType: prompt.name,
          completed: completed,
          total: totalAnalyses
        });

        console.log(`🔄 Devam: ${prompt.name} analizi başlıyor...`);

        // Prompt oluşturma
        const systemPrompt = prompt.systemPrompt || '';
        const fullPrompt = `${prompt.prompt}\n\nMETİN:\n${text}`;

        // Analiz yap
        const nonChunkingTypes = ['character', 'theme', 'dialogue', 'location_analysis', 'competitive'];
        const shouldUseChunking = text.length > 15000 && !nonChunkingTypes.includes(analysisType);

        const analysisResult = await aiHandler.analyzeWithCustomPrompt(text, {
          systemPrompt: systemPrompt,
          userPrompt: fullPrompt,
          useChunking: shouldUseChunking,
          includeMetadata: true,
          abortSignal: abortController.signal,
          onProgress: (progressInfo) => {
            const chunkProgress = progressInfo.progress || 0;
            const overallProgress = ((completed + (chunkProgress / 100)) / totalAnalyses) * 100;

            setAnalysisProgress({
              message: `${prompt.name} - ${progressInfo.message || 'Analiz devam ediyor...'}`,
              progress: overallProgress,
              currentChunk: progressInfo.chunkNumber,
              totalChunks: progressInfo.totalChunks
            });
          }
        });

        // Sonucu kaydet
        multiResults[analysisType] = {
          name: prompt.name,
          type: analysisType,
          result: analysisResult,
          timestamp: new Date().toISOString(),
          wordCount: analysisResult ? analysisResult.length : 0,
          status: 'completed'
        };

        // � Her analiz türü tamamlandığında o türü kaydet (üzerine yaz)
        try {
          const scriptFileName = currentScript?.fileName || currentScript?.name || 'Unknown_Script';
          const projectName = scriptFileName.replace(/\.(pdf|txt|fountain)$/i, '');

          // Sadece bu analiz türünü kaydet
          await analysisStorageService.saveAnalysisByType(
            projectName,
            analysisType,
            multiResults[analysisType],
            {
              originalFileName: currentScript?.originalFileName || scriptFileName,
              fileType: currentScript?.fileType || 'unknown',
              analysisProvider: provider
            }
          );

          console.log(`✅ ${analysisType} kaydedildi (${completed + 1}/${totalAnalyses})`);
        } catch (saveError) {
          console.error(`❌ ${analysisType} kayıt hatası:`, saveError);
        }

        completed++;

        // Progress update after completion
        setAnalysisProgress({
          message: `${prompt.name} tamamlandı! (${completed}/${totalAnalyses})`,
          progress: (completed / totalAnalyses) * 100,
          completed: completed,
          total: totalAnalyses
        });

      } catch (error) {
        console.error(`Devam analiz hatası ${analysisType}:`, error);
        multiResults[analysisType] = {
          name: prompt.name,
          type: analysisType,
          result: `❌ Analiz hatası: ${error.message}`,
          timestamp: new Date().toISOString(),
          wordCount: 0,
          status: 'failed',
          error: error.message
        };
        completed++;
      }
    }

    // Final results
    setCustomResults(multiResults);
    const finalAnalysisData = { customResults: multiResults };
    setAnalysisData(finalAnalysisData);

    // Final save (complete analysis)
    try {
      const scriptFileName = currentScript?.fileName || currentScript?.name || 'Unknown_Script';
      if (currentScript && scriptFileName) {
        // Tüm tamamlanan analiz tiplerini dosya adına ekle
        const completedTypes = Object.keys(multiResults).join('_');
        await analysisStorageService.saveAnalysis(text, scriptFileName, finalAnalysisData, {
          fileName: scriptFileName,
          projectName: `${scriptFileName.replace(/\.(pdf|txt|fountain)$/i, '')}_${completedTypes}`,
          analysisType: 'full',
          originalFileName: currentScript?.originalFileName || scriptFileName,
          fileType: currentScript?.fileType || 'unknown',
          analysisProvider: provider
        });
        console.log('💾 Devam edilen analiz tamamlandı ve kaydedildi!');

        // Notify other components that analysis has been updated
        window.dispatchEvent(new CustomEvent('analysisUpdated', {
          detail: { customResults: multiResults }
        }));
      } else {
        console.warn('⚠️ Script bilgisi eksik, analiz kaydedilemedi');
      }
    } catch (error) {
      console.error('Final save error:', error);
    }

    setActiveTab('custom');
    return multiResults;
  };

  /**
   * Calculate cost estimates for selected analyses
   * Shows cost preview modal before starting analysis
   */
  const calculateCostEstimate = () => {
    if (!isConfigured()) {
      alert(t('analysis.configureFirst', 'Please configure your AI provider in Settings first.'));
      return;
    }

    // Get selected analysis types
    const selectedTypes = Object.entries(selectedAnalysisTypes)
      .filter(([_, isSelected]) => isSelected)
      .map(([type]) => type);

    if (selectedTypes.length === 0) {
      alert('Lütfen en az bir analiz türü seçin.');
      return;
    }

    // Only calculate costs for Gemini provider
    if (provider !== 'gemini') {
      // For non-Gemini providers, skip cost preview and start directly
      handleAnalyze();
      return;
    }

    const text = filteredAnalysisText;
    if (!text || text.trim().length === 0) {
      alert(t('analysis.noTextAvailable', 'No text available for analysis. Please upload a script first.'));
      return;
    }

    // Get language variable
    const currentLanguage = t('language.name', 'Türkçe');

    // Get current Gemini model from store (already available from useAIStore hook)
    const currentGeminiModel = geminiModel || 'gemini-2.0-flash-exp';

    // Check if cache will be used (Gemini only, and text > 32KB)
    const willUseCache = provider === 'gemini' && text.length > 32768;

    // Calculate estimates for each analysis type
    const estimates = selectedTypes.map(type => {
      const prompt = getPrompt('analysis', type);
      const systemPrompt = prompt.system.replace(/{{language}}/g, currentLanguage);
      const userPrompt = prompt.user.replace(/{{language}}/g, currentLanguage);

      // Combine all text that will be sent
      const fullPromptText = systemPrompt + '\n\n' + userPrompt + '\n\n' + text;

      // Estimate input tokens
      const inputTokens = estimateTokens(fullPromptText);

      // Estimate output tokens based on analysis type
      const outputTokens = estimateOutputTokens(type, inputTokens);

      // Get model name
      const model = currentGeminiModel;

      // Simulate token counts for cost calculation
      const cachedTokens = willUseCache ? Math.floor(inputTokens * 0.9) : 0;
      const tokenCounts = {
        promptTokenCount: inputTokens,
        candidatesTokenCount: outputTokens,
        cachedContentTokenCount: cachedTokens
      };

      // Calculate cost
      const costResult = calculateGeminiCost(model, tokenCounts);
      const costWithoutCacheResult = calculateGeminiCost(model, {
        promptTokenCount: inputTokens,
        candidatesTokenCount: outputTokens,
        cachedContentTokenCount: 0
      });

      // Extract total cost from result object
      const cost = costResult?.total || 0;
      const costWithoutCache = costWithoutCacheResult?.total || 0;

      return {
        type,
        inputTokens,
        outputTokens,
        cachedTokens,
        cost,
        costWithoutCache
      };
    });

    setCostEstimates(estimates);
    setShowCostPreview(true);
  };

  /**
   * Handle cost preview confirmation
   * User confirmed the estimated cost, start analysis
   */
  const handleCostPreviewConfirm = () => {
    setShowCostPreview(false);
    setPendingAnalysisStart(true);
    // Start analysis after modal closes
    setTimeout(() => {
      handleAnalyze();
      setPendingAnalysisStart(false);
    }, 100);
  };

  /**
   * Handle cost preview cancellation
   * User cancelled, don't start analysis
   */
  const handleCostPreviewCancel = () => {
    setShowCostPreview(false);
    setCostEstimates([]);
  };

  const handleAnalyze = async () => {
    if (!isConfigured()) {
      alert(t('analysis.configureFirst', 'Please configure your AI provider in Settings first.'));
      return;
    }

    // Create AbortController for cancellation
    const abortController = new AbortController();
    setAnalysisAbortController(abortController);
    setIsAnalyzing(true);

    try {
      // Use filtered text for analysis
      const text = filteredAnalysisText;
      const aiHandler = getAIHandler();

      console.log(`🔍 Starting analysis with provider: ${provider}`);
      console.log('📝 Text to analyze:', text ? `${text.substring(0, 100)}... (${text.length} chars)` : 'NO TEXT!');
      console.log('🔍 AIHandler instance:', aiHandler);
      console.log('🔍 Has analyzeWithCustomPrompt?', typeof aiHandler.analyzeWithCustomPrompt);

      if (!text || text.trim().length === 0) {
        alert('❌ Analiz yapılacak metin bulunamadı! Lütfen bir senaryo yükleyin.');
        setIsAnalyzing(false);
        return;
      }

      // Check if analysis already exists in cache
      const scriptStore = useScriptStore.getState();
      const fileName = scriptStore.currentScript?.fileName || scriptStore.currentScript?.name || 'Unnamed Script';

      // Selected analysis types'ı önce belirle
      const selectedTypes = Object.keys(selectedAnalysisTypes).filter(key => selectedAnalysisTypes[key]);

      console.log('📊 Seçili analiz türleri (selectedAnalysisTypes):', selectedTypes);
      console.log('📋 Tüm selectedAnalysisTypes state:', selectedAnalysisTypes);

      if (selectedTypes.length === 0) {
        alert(t('analysis.selectAtLeastOne', 'Lütfen en az bir analiz türü seçin'));
        setIsAnalyzing(false);
        return;
      }

      // 🔄 Cache kontrolü - sadece TÜM analizler yapılacaksa cache'e bak
      // Kullanıcı belirli analiz türlerini seçmişse (yeniden yapmak istiyor), cache'i atla
      const isFullAnalysis = selectedTypes.length >= 10; // Çoğu analiz seçiliyse full sayılır
      let cachedAnalysis = null;

      if (isFullAnalysis) {
        console.log('📁 Full analiz - cache kontrol ediliyor...');
        cachedAnalysis = await analysisStorageService.loadAnalysis(text, fileName);
      } else {
        console.log('🔄 Belirli analiz türleri seçildi - cache atlanıyor, yeniden analiz yapılacak');
      }

      // If no exact match, try PDF filename matching (only for full analysis)
      if (isFullAnalysis && !cachedAnalysis && fileName.endsWith('.pdf')) {
        const pdfMatch = await analysisStorageService.findAnalysisByFileName(fileName, 0.7);
        if (pdfMatch) {
          const shouldReuse = confirm(
            `"${fileName}" dosyası için önceden yapılmış bir analiz bulundu:\n\n` +
            `📄 ${pdfMatch.fileName}\n` +
            `📅 ${new Date(pdfMatch.timestamp).toLocaleString('tr-TR')}\n` +
            `📊 Benzerlik: ${(pdfMatch.similarity * 100).toFixed(0)}%\n\n` +
            `Bu analizi kullanmak istiyor musunuz? (İptal = Yeni analiz yap)`
          );

          if (shouldReuse) {
            cachedAnalysis = await analysisStorageService.loadAnalysisByKey(pdfMatch.key);
            if (cachedAnalysis) {
              console.log('📁 Reusing PDF-matched analysis:', pdfMatch.fileName);
            }
          }
        }
      }

      if (cachedAnalysis && cachedAnalysis.customResults) {
        console.log('📁 Loading cached/matched analysis...');
        setCustomResults(cachedAnalysis.customResults);
        setAnalysisData(cachedAnalysis);
        setActiveTab('custom');
        setIsAnalyzing(false);
        return;
      }

      // Optimal chunking settings per provider
      const isCloudProvider = provider === 'openai' || provider === 'gemini';
      const useChunking = !isCloudProvider && text.length > 8000; // Lower threshold for chunking

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 Analiz Başlatılıyor');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 Seçili Analiz Sayısı:', selectedTypes.length);
      console.log('📋 Seçili Analizler:', selectedTypes);
      console.log('🔍 selectedAnalysisTypes State:', selectedAnalysisTypes);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      if (selectedTypes.length === 0) {
        console.error('❌ Hiç analiz seçilmedi!');
        alert('❌ Lütfen en az bir analiz türü seçin!');
        setIsAnalyzing(false);
        return;
      }

      // 🆕 STEP 1: Create context cache for Gemini (if using Gemini)
      let cacheId = null;
      const scriptHash = hashString(text); // Simple hash function

      if (provider === 'gemini') {
        console.log('🔄 Creating Gemini context cache for screenplay...');
        try {
          cacheId = await aiHandler.contextCache.createCache(
            aiHandler.apiKey,
            aiHandler.model,
            text,
            scriptHash
          );
          if (cacheId) {
            console.log('✅ Cache created successfully:', cacheId);
          } else {
            console.warn('⚠️ Cache creation returned null, continuing without cache');
          }
        } catch (error) {
          console.warn('⚠️ Cache creation failed, continuing without cache:', error.message);
        }
      }

      // Get language variable first
      const currentLanguage = t('language.name', 'Türkçe');

      // Run multiple analyses
      const multiResults = {};
      const totalAnalyses = selectedTypes.length;
      let completed = 0;

      // 🆕 Optimized rate limiting: 500ms between requests (instead of 1000ms)
      const RATE_LIMIT_DELAY = 500;

      // Initialize a structured analysis summary
      const analysisMetadata = {
        timestamp: new Date().toISOString(),
        selectedTypes: selectedTypes,
        provider: provider,
        totalAnalysisCount: totalAnalyses,
        language: currentLanguage
      };

      for (const analysisType of selectedTypes) {
        const prompt = getPrompt('analysis', analysisType);

        if (!prompt || !prompt.system || !prompt.user) {
          console.warn(`Prompt for ${analysisType} not found, skipping`);
          continue;
        }

        const progressData = {
          message: `${prompt.name} analizi yapılıyor... (${completed + 1}/${totalAnalyses})`,
          progress: (completed / totalAnalyses) * 100,
          currentAnalysis: analysisType,
          currentAnalysisName: prompt.name,
          completed: completed,
          total: totalAnalyses,
          status: 'in-progress'
        };

        setAnalysisProgress(progressData);

        // Broadcast to storyboard module
        window.dispatchEvent(new CustomEvent('storyboardAnalysisProgress', {
          detail: progressData
        }));

        try {
          // Check for cancellation
          if (abortController.signal.aborted) {
            console.log('🚫 Analysis cancelled during loop');
            return;
          }

          // Inject language variable consistently
          const systemPrompt = prompt.system.replace(/{{language}}/g, currentLanguage).replace(/{{lang}}/g, currentLanguage);
          const userPrompt = prompt.user.replace(/{{language}}/g, currentLanguage).replace(/{{lang}}/g, currentLanguage);

          // Use chunking system for complete analysis of long scripts
          let fullPrompt = userPrompt + '\n\n=== SENARYO METNİ ===\n{{text}}';

          console.log(`📄 Script length: ${text.length} characters - Using chunking for complete analysis`);

          setAnalysisProgress({
            message: `${prompt.name} - Kapsamlı analiz başlıyor...`,
            progress: ((completed + 0.5) / totalAnalyses) * 100
          });

          // 🆕 STEP 3: Call AI with cache (for Gemini) or regular call
          let analysisResult;

          console.log(`📝 [${completed + 1}/${totalAnalyses}] Analyzing: ${prompt.name}`);

          if (cacheId && provider === 'gemini') {
            // Use cached context - no need to send full text again
            console.log(`💾 Using cache for ${prompt.name}`);

            const shortPrompt = userPrompt.replace(/{{text}}/g, '').replace(/=== SENARYO METNİ ===/g, '');
            const cacheResult = await aiHandler.callGeminiWithCache(
              systemPrompt,
              shortPrompt,
              0.3,
              cacheId
            );
            // callGeminiWithCache returns object with { text, usage, model }
            analysisResult = typeof cacheResult === 'string' ? cacheResult : cacheResult.text;

            // Track token usage if metadata available
            if (cacheResult.usage) {
              const costValue = cacheResult.cost?.total || 0;
              const actualTokens = cacheResult.usage.totalTokenCount || 0;
              const estimatedTokens = estimateTokens(systemPrompt + '\n\n' + fullPrompt + '\n\n' + text) + estimateOutputTokens(analysisType);

              // Use updateTokenUsage helper for localStorage persistence and budget tracking
              updateTokenUsage({
                cost: cacheResult.cost || { total: costValue },
                usage: cacheResult.usage,
                model: cacheResult.model,
                analysisType: analysisType,
                estimatedTokens: estimatedTokens
              });
            }
          } else {
            // Regular analysis without cache
            console.log(`📄 Standard analysis for ${prompt.name} (no cache)`);
            const nonChunkingTypes = ['character', 'theme', 'dialogue', 'location_analysis', 'competitive'];
            const shouldUseChunking = text.length > 15000 && !nonChunkingTypes.includes(analysisType);

            const fullResult = await aiHandler.analyzeWithCustomPrompt(text, {
              systemPrompt: systemPrompt,
              userPrompt: fullPrompt,
              useChunking: shouldUseChunking,
              includeMetadata: true,
              promptFormat: prompt.outputFormat || 'text',
              abortSignal: abortController.signal,
              onProgress: (progressInfo) => {
                const chunkProgress = progressInfo.progress || 0;
                const overallProgress = ((completed + (chunkProgress / 100)) / totalAnalyses) * 100;

                const progressData = {
                  message: `${prompt.name} - ${progressInfo.message || 'Analiz yapılıyor...'}`,
                  progress: overallProgress,
                  currentAnalysis: analysisType,
                  currentAnalysisName: prompt.name,
                  completed: completed,
                  total: totalAnalyses,
                  status: 'in-progress',
                  chunkProgress: chunkProgress
                };

                setAnalysisProgress(progressData);

                // Save checkpoint
                if (progressInfo.progress === 100) {
                  localStorage.setItem(`analysis_checkpoint_${fileName}`, JSON.stringify({
                    progress: progressData,
                    timestamp: Date.now()
                  }));
                }
              }
            });

            analysisResult = typeof fullResult === 'string' ? fullResult : fullResult.text;

            // Track token usage
            if (fullResult.usage) {
              const costValue = fullResult.cost?.total || 0;
              const actualTokens = fullResult.usage.totalTokenCount || 0;
              const estimatedTokens = estimateTokens(systemPrompt + '\n\n' + fullPrompt + '\n\n' + text) + estimateOutputTokens(analysisType);

              // Use updateTokenUsage helper for localStorage persistence and budget tracking
              updateTokenUsage({
                cost: fullResult.cost || { total: costValue },
                usage: fullResult.usage,
                model: fullResult.model,
                analysisType: analysisType,
                estimatedTokens: estimatedTokens
              });
            }
          }

          // Store result immediately (checkpoint)
          multiResults[analysisType] = {
            name: prompt.name,
            type: analysisType,
            result: analysisResult,
            resultType: typeof analysisResult,
            outputFormat: prompt.outputFormat || 'text',
            timestamp: new Date().toISOString(),
            wordCount: typeof analysisResult === 'string' ? analysisResult.length : JSON.stringify(analysisResult).length,
            status: 'completed',
            provider: provider,
            usedCache: !!cacheId
          };

          // 🆕 STEP 4: Store result immediately (checkpoint)
          multiResults[analysisType] = {
            name: prompt.name,
            type: analysisType,
            result: analysisResult,
            resultType: typeof analysisResult,
            outputFormat: prompt.outputFormat || 'text',
            timestamp: new Date().toISOString(),
            wordCount: typeof analysisResult === 'string' ? analysisResult.length : JSON.stringify(analysisResult).length,
            status: 'completed',
            provider: provider,
            usedCache: !!cacheId
          };

          console.log(`✅ [${completed + 1}/${totalAnalyses}] Completed: ${prompt.name}`);

          // 🔄 ARA KAYIT: Her analiz adımı bittiğinde kaydet
          try {
            const scriptStore = useScriptStore.getState();
            const currentScript = scriptStore.currentScript;
            // Use fileName from parent scope for consistency

            const tempKey = `temp_${new Date().getTime()}_${fileName}`;
            const tempAnalysisData = {
              customResults: { ...multiResults }, // Şu ana kadar tamamlanan analizler
              fileName: fileName,
              analysisDate: new Date().toISOString(),
              isPartialAnalysis: true,
              totalExpectedAnalyses: totalAnalyses,
              completedAnalyses: completed,
              remainingAnalyses: selectedTypes.slice(completed),
              scriptMetadata: {
                fileName: fileName,
                originalFileName: currentScript?.originalFileName || fileName,
                fileType: currentScript?.fileType || 'script',
                analysisProvider: provider
              }
            };

            // 💾 Bu analiz türünü kaydet (üzerine yaz)
            const projectName = fileName.replace(/\.(pdf|txt|fountain)$/i, '');
            await analysisStorageService.saveAnalysisByType(
              projectName,
              analysisType,
              multiResults[analysisType],
              {
                originalFileName: currentScript?.originalFileName || fileName,
                fileType: currentScript?.fileType || 'script',
                analysisProvider: provider
              }
            );

            console.log(`✅ ${analysisType} kaydedildi (${completed}/${totalAnalyses})`);
          } catch (saveError) {
            console.error('Ara kayıt hatası:', saveError);
            // Ara kayıt hatası analizi durdurmaz, devam eder
          }

          completed++;

          // 🆕 Optimized rate limiting: 500ms delay between requests
          if (completed < totalAnalyses) {
            console.log(`⏳ Rate limit delay: ${RATE_LIMIT_DELAY}ms...`);
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
          }

          // Broadcast completion of this analysis
          window.dispatchEvent(new CustomEvent('storyboardAnalysisProgress', {
            detail: {
              message: `${prompt.name} tamamlandı!`,
              progress: (completed / totalAnalyses) * 100,
              currentAnalysis: analysisType,
              currentAnalysisName: prompt.name,
              completed: completed,
              total: totalAnalyses,
              status: 'completed'
            }
          }));
        } catch (error) {
          console.error(`Error analyzing ${analysisType}:`, error);

          // Kullanıcı dostu hata mesajları
          let errorMessage = `❌ ${analysisType} analizi başarısız`;

          if (error.message?.includes('quota')) {
            errorMessage += ' - API quota limitine ulaşıldı';
          } else if (error.message?.includes('429') || error.message?.includes('Too Many Requests')) {
            errorMessage += ' - Rate limit aşıldı (çok fazla istek)';
          } else if (error.message?.includes('508')) {
            errorMessage += ' - Gemini API geçici olarak kullanılamıyor';
          } else if (error.message?.includes('timeout')) {
            errorMessage += ' - Zaman aşımı';
          } else {
            errorMessage += `: ${error.message}`;
          }

          multiResults[analysisType] = {
            name: prompt.name,
            type: analysisType,
            result: errorMessage,
            timestamp: new Date().toISOString(),
            wordCount: 0,
            status: 'failed',
            error: error.message
          };

          // 🔄 HATA DURUMUNDA DA ARA KAYIT
          try {
            const scriptStore = useScriptStore.getState();
            const currentScript = scriptStore.currentScript;
            // Use fileName from parent scope for consistency

            const tempKey = `temp_${new Date().getTime()}_${fileName}`;
            const tempAnalysisData = {
              customResults: { ...multiResults },
              fileName: fileName,
              analysisDate: new Date().toISOString(),
              isPartialAnalysis: true,
              totalExpectedAnalyses: totalAnalyses,
              completedAnalyses: completed,
              remainingAnalyses: selectedTypes.slice(completed),
              lastError: error.message,
              scriptMetadata: {
                fileName: fileName,
                originalFileName: currentScript?.originalFileName || fileName,
                fileType: currentScript?.fileType || 'script',
                analysisProvider: provider
              }
            };

            // 💾 Hata durumunda da kaydedelim (boş sonuç)
            const projectName = fileName.replace(/\.(pdf|txt|fountain)$/i, '');
            await analysisStorageService.saveAnalysisByType(
              projectName,
              analysisType,
              { error: errorMessage, timestamp: new Date().toISOString() },
              {
                originalFileName: currentScript?.originalFileName || fileName,
                fileType: currentScript?.fileType || 'script',
                analysisProvider: provider,
                hasError: true
              }
            );

            console.log(`❌ ${analysisType} hata kaydedildi (${completed}/${totalAnalyses})`);
          } catch (saveError) {
            console.error('Hata durumunda ara kayıt hatası:', saveError);
          }

          completed++;
        }
      }

      // Store results with enhanced structure
      setCustomResults(multiResults);

      // 🎭 Karakter analizini yapılandırılmış formata dönüştür
      let parsedCharacters = [];
      let characterSummary = null;

      if (multiResults['character'] && multiResults['character'].result) {
        console.log('🎭 Karakter analizi parse ediliyor...');
        try {
          const rawCharacterText = multiResults['character'].result;
          parsedCharacters = parseCharacterAnalysis(rawCharacterText);

          // Storyboard için optimize et
          const optimizedCharacters = optimizeForStoryboard(parsedCharacters);

          // Özet rapor oluştur
          characterSummary = generateCharacterSummary(parsedCharacters);

          console.log(`✅ ${parsedCharacters.length} karakter başarıyla parse edildi ve yapılandırıldı`);
          console.log('📊 Karakter özeti:', characterSummary);

          // Parse edilmiş karakterleri multiResults'a ekle
          multiResults['character'] = {
            ...multiResults['character'],
            parsed: true,
            characters: optimizedCharacters,
            summary: characterSummary,
            rawCharacters: parsedCharacters
          };
        } catch (parseError) {
          console.error('❌ Karakter parse hatası:', parseError);
          // Hata durumunda da analiz devam etsin
        }
      }

      // Create comprehensive structure compatible with tab display and PDF export
      const result = {
        isCustomAnalysis: true,
        isMultiAnalysis: true,
        customResults: multiResults,
        selectedTypes,
        metadata: analysisMetadata,
        summary: {
          totalScenes: 0,
          estimatedShootingDays: 0,
          completedAnalysisCount: Object.keys(multiResults).filter(key => multiResults[key].status === 'completed').length,
          failedAnalysisCount: Object.keys(multiResults).filter(key => multiResults[key].status === 'failed').length,
          totalWordCount: Object.values(multiResults).reduce((sum, item) => sum + (item.wordCount || 0), 0)
        },
        scenes: [],
        locations: [],
        characters: parsedCharacters.length > 0 ? optimizeForStoryboard(parsedCharacters) : [],
        equipment: [],
        // Karakter özet bilgisi
        characterSummary: characterSummary,
        // Analysis result overview for consistent reporting
        analysisOverview: {
          provider: provider,
          language: currentLanguage,
          textLength: text.length,
          analysisTypes: selectedTypes,
          timestamp: new Date().toISOString(),
          resultsGenerated: Object.keys(multiResults).length,
          parsedCharacters: parsedCharacters.length
        }
      };

      setAnalysisData(result);

      // Save analysis to storage with metadata
      try {
        const projectName = fileName.replace(/\.(pdf|txt|fountain)$/i, '');
        const scriptMetadata = {
          projectName: projectName, // Clean project name without analysis types!
          analysisType: 'custom',
          originalFileName: scriptStore.currentScript?.name || fileName,
          fileType: fileName.endsWith('.pdf') ? 'pdf' : 'text',
          uploadDate: scriptStore.currentScript?.uploadDate || new Date().toISOString(),
          analysisProvider: provider,
          analysisLanguage: currentLanguage,
          completedAnalysisTypes: Object.keys(multiResults) // Store analysis types as metadata array
        };

        // DO NOT append analysis types to project name - keep it clean!
        await analysisStorageService.saveAnalysis(text, fileName, result, scriptMetadata);
        console.log('✅ Analysis saved to storage with metadata:', projectName, '/', Object.keys(multiResults).length, 'types');

        // Script store'u güncelle - Storyboard'ın hemen erişebilmesi için
        if (scriptStore.currentScript) {
          const { updateScript } = useScriptStore.getState();
          updateScript(scriptStore.currentScript.id, {
            analysisData: result,
            customResults: multiResults
          });
          console.log('✅ Script store güncellendi - customResults:', Object.keys(multiResults));
        }

        // Notify other components that analysis has been updated
        window.dispatchEvent(new CustomEvent('analysisUpdated', {
          detail: { customResults: multiResults }
        }));
      } catch (saveError) {
        console.warn('Failed to save analysis:', saveError);
      }

      // Auto-switch to custom tab
      setActiveTab('custom');
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('🚫 Analysis cancelled by user');
        alert('Analiz iptal edildi.');
      } else {
        console.error('Analysis failed:', error);

        // Kullanıcı dostu hata mesajları
        let userMessage = 'Analiz sırasında bir hata oluştu.';

        if (error.message?.includes('quota')) {
          userMessage = '🚫 API quota limitine ulaşıldı. Lütfen birkaç dakika bekleyip tekrar deneyin.';
        } else if (error.message?.includes('429') || error.message?.includes('Too Many Requests')) {
          userMessage = '⏳ Çok fazla istek gönderildi. Lütfen 30 saniye bekleyip tekrar deneyin.';
        } else if (error.message?.includes('508')) {
          userMessage = '🔄 Gemini API geçici olarak kullanılamıyor. Lütfen birkaç dakika bekleyin.';
        } else if (error.message?.includes('API key')) {
          userMessage = '🔑 API anahtarı sorunu. Lütfen ayarlardan API anahtarınızı kontrol edin.';
        } else if (error.message?.includes('timeout') || error.message?.includes('ECONNABORTED')) {
          userMessage = '⏱️ İstek zaman aşımına uğradı. Lütfen tekrar deneyin.';
        } else if (error.message?.includes('network') || error.message?.includes('ENOTFOUND')) {
          userMessage = '🌐 İnternet bağlantısı sorunu. Lütfen bağlantınızı kontrol edin.';
        }

        alert(`${userMessage}\n\nDetay: ${error.message}`);
      }
    } finally {
      clearAnalysisProgress();
    }
  };

  // Load saved analyses - grouped by project
  const loadSavedAnalyses = async () => {
    setLoadingSavedAnalyses(true);
    try {
      // Load individual analysis files
      const analyses = await analysisStorageService.listAnalyses();
      setSavedAnalyses(analyses);
      console.log(`📁 ${analyses.length} analiz dosyası yüklendi`);
    } catch (error) {
      console.error('Failed to load saved analyses:', error);
    } finally {
      setLoadingSavedAnalyses(false);
    }
  };

  // Load a specific saved analysis
  const loadSavedAnalysis = async (analysisKey) => {
    try {
      // Find the analysis metadata
      const analysisInfo = savedAnalyses.find(a => a.key === analysisKey);
      if (!analysisInfo) return;

      // Load analysis directly by key
      const cachedAnalysis = await analysisStorageService.loadAnalysisByKey(analysisKey);

      if (cachedAnalysis) {
        setCustomResults(cachedAnalysis.customResults || {});
        setAnalysisData(cachedAnalysis);
        setActiveTab('custom');
        console.log('📁 Loaded saved analysis:', analysisInfo.fileName);
      } else {
        alert('Kaydedilmiş analiz yüklenemedi. Dosya mevcut değil.');
      }
    } catch (error) {
      console.error('Failed to load saved analysis:', error);
      alert('Kaydedilmiş analizi yüklemede hata: ' + error.message);
    }
  };

  // Delete a saved analysis - KAPSAMLI TEMİZLEME
  const deleteSavedAnalysis = async (analysisKey) => {
    if (confirm('Bu analizi silmek istediğinizden emin misiniz?')) {
      try {
        console.log('🗑️ Analiz siliniyor:', analysisKey);

        // 1. FileSystem'den sil
        await analysisStorageService.deleteAnalysis(analysisKey);

        // 2. LocalStorage'dan ilgili tüm anahtarları sil (analiz + storyboard verileri)
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (
            key.includes(analysisKey) ||
            (key.startsWith('mgx_analysis_') && key.includes(analysisKey.replace('.json', ''))) ||
            (key.startsWith('analysis_checkpoint_') && key.includes(analysisKey.replace('.json', ''))) ||
            key.startsWith('character_image_') ||
            key.startsWith('location_image_') ||
            key.startsWith('character_reference_') ||
            key.startsWith('location_reference_') ||
            key.startsWith('mgx_storyboard_')
          )) {
            keysToRemove.push(key);
          }
        }

        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
          console.log('🗑️ LocalStorage key silindi:', key);
        });

        // 2.5. IndexedDB'yi de temizle
        if (window.indexedDB) {
          try {
            const deleteRequest = indexedDB.deleteDatabase('StoryboardDB');
            deleteRequest.onsuccess = () => console.log('✅ StoryboardDB silindi');
          } catch (e) {
            console.warn('⚠️ IndexedDB temizlenemedi:', e);
          }
        }

        // 3. Liste yenile
        await loadSavedAnalyses();
        console.log(`✅ Analiz silindi (${1 + keysToRemove.length} kayıt)`);

        // 4. Eğer silinen analiz şu anda yüklüyse, state'i temizle
        const currentScript = useScriptStore.getState().getCurrentScript();
        if (currentScript) {
          const currentKey = analysisStorageService.generateAnalysisKey(
            currentScript.scriptText || currentScript.cleanedText,
            currentScript.fileName || currentScript.name
          );

          if (currentKey === analysisKey || analysisKey.includes(currentScript.name)) {
            setCustomResults({});
            setAnalysisData(null);

            // Script store'dan temizle
            const { updateScript } = useScriptStore.getState();
            updateScript(currentScript.id, {
              analysisData: null,
              customResults: null,
              scenes: [],
              characters: [],
              locations: [],
              equipment: []
            });

            // Diğer componentlere bildir
            window.dispatchEvent(new CustomEvent('analysisCleared'));

            console.log('🗑️ Mevcut analiz state\'ten temizlendi');
          }
        }
      } catch (error) {
        console.error('Failed to delete saved analysis:', error);
        // Hata mesajı alert yerine sadece console'a yazdırılıyor
      }
    }
  };

  // Auto-load cached analysis when component mounts or script changes
  useEffect(() => {
    const autoLoadCachedAnalysis = async () => {
      // Safety checks
      if (!filteredAnalysisText || analysisData) {
        return;
      }

      const scriptStore = useScriptStore.getState();
      const fileName = scriptStore.currentScript?.fileName || scriptStore.currentScript?.name;

      if (!fileName) {
        return;
      }

      console.log('🔍 Auto-loading analysis check for:', fileName);

      try {
        // First try exact match
        let cachedAnalysis = await analysisStorageService.loadAnalysis(filteredAnalysisText, fileName);

        // If no exact match and it's a PDF, try PDF filename matching
        if (!cachedAnalysis && fileName.endsWith('.pdf')) {
          const pdfMatch = await analysisStorageService.findAnalysisByFileName(fileName, 0.7);
          if (pdfMatch) {
            console.log('📁 Found matching cached analysis:', pdfMatch.fileName);
            cachedAnalysis = await analysisStorageService.loadAnalysisByKey(pdfMatch.key);
          }
        }

        if (cachedAnalysis && typeof cachedAnalysis === 'object') {
          console.log('✅ Auto-loaded cached analysis');

          // Restore analysis data
          if (cachedAnalysis.customResults && typeof cachedAnalysis.customResults === 'object') {
            setCustomResults(cachedAnalysis.customResults);
            setActiveTab('custom');
          }
          setAnalysisData(cachedAnalysis);
        }
      } catch (error) {
        console.error('❌ Auto-load failed:', error);
      }
    };

    // Debounce to avoid too many calls
    const timeoutId = setTimeout(() => {
      autoLoadCachedAnalysis();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [filteredAnalysisText]); // Run when text changes

  // Storyboard için gerekli analizlerin yapılıp yapılmadığını kontrol et
  const checkStoryboardAnalysisRequirements = () => {
    if (!analysisData || !analysisData.customResults) {
      return { hasRequired: false, missing: STORYBOARD_REQUIRED_ANALYSIS };
    }

    const existingTypes = Object.keys(analysisData.customResults);
    const missing = STORYBOARD_REQUIRED_ANALYSIS.filter(required =>
      !existingTypes.includes(required)
    );

    return {
      hasRequired: missing.length === 0,
      missing,
      existing: existingTypes.filter(type => STORYBOARD_REQUIRED_ANALYSIS.includes(type))
    };
  };

  // Storyboard için eksik analizleri otomatik yap
  // Sadece belirtilen analiz türleri ile analiz başlatan fonksiyon
  const handleAnalyzeWithSpecificTypes = async (specificTypes) => {
    if (!isConfigured()) {
      throw new Error('AI sağlayıcısı yapılandırılmamış. Lütfen Settings > AI Providers bölümünden API key ekleyin.');
    }

    // Create AbortController for cancellation
    const abortController = new AbortController();
    setAnalysisAbortController(abortController);
    setIsAnalyzing(true);

    try {
      // Use filtered text for analysis
      const text = filteredAnalysisText;
      const aiHandler = getAIHandler();

      console.log(`🔍 Starting specific analysis with provider: ${provider}`);
      console.log('📝 Text to analyze:', text ? `${text.substring(0, 100)}... (${text.length} chars)` : 'NO TEXT!');
      console.log('🎯 Analysis types:', specificTypes);

      if (!text || text.trim().length === 0) {
        throw new Error('Analiz yapılacak metin bulunamadı! Lütfen bir senaryo yükleyin.');
      }

      if (!specificTypes || specificTypes.length === 0) {
        throw new Error('Analiz türü belirtilmedi');
      }

      // Check if analysis already exists in cache
      const scriptStore = useScriptStore.getState();
      const fileName = scriptStore.currentScript?.fileName || scriptStore.currentScript?.name || 'Unnamed Script';

      console.log('Running multi-analysis with specific types:', specificTypes);

      // Get language variable first
      const currentLanguage = t('language.name', 'Türkçe');

      // Run multiple analyses
      const multiResults = {};
      const totalAnalyses = specificTypes.length;
      let completed = 0;

      // Initialize a structured analysis summary
      const analysisMetadata = {
        timestamp: new Date().toISOString(),
        selectedTypes: specificTypes,
        provider: provider,
        totalAnalysisCount: totalAnalyses,
        language: currentLanguage
      };

      for (const analysisType of specificTypes) {
        if (abortController.signal.aborted) {
          console.log('❌ Analysis aborted by user');
          break;
        }

        setAnalysisProgress(prev => ({
          ...prev,
          current: completed,
          total: totalAnalyses,
          currentType: analysisType,
          percentage: Math.round((completed / totalAnalyses) * 100)
        }));

        const typeDisplayName = analysisTypes.find(t => t.key === analysisType)?.label || analysisType;
        console.log(`📄 Script length: ${text.length} characters - Using chunking for complete analysis`);

        try {
          let fullResult = await aiHandler.analyzeWithCustomPrompt(text, {
            analysisType,
            language: currentLanguage,
            displayName: typeDisplayName,
            includeMetadata: true
          });

          let result = typeof fullResult === 'string' ? fullResult : fullResult.text;

          // Track token usage
          if (fullResult.usage) {
            const costValue = fullResult.cost?.total || 0;
            const actualTokens = fullResult.usage.totalTokenCount || 0;
            const estimatedTokens = estimateTokens(text) + estimateOutputTokens(analysisType);

            // Use updateTokenUsage helper for localStorage persistence and budget tracking
            updateTokenUsage({
              cost: fullResult.cost || { total: costValue },
              usage: fullResult.usage,
              model: fullResult.model,
              analysisType: analysisType,
              estimatedTokens: estimatedTokens
            });
          }

          if (result) {
            multiResults[analysisType] = result;
            console.log(`💾 Ara kayıt yapıldı: ${analysisType} analizi tamamlandı (${completed}/${totalAnalyses})`);
          }

          // Ara kayıt yap
          await analysisStorageService.savePartialAnalysis(fileName, {
            type: analysisType,
            result: result,
            metadata: analysisMetadata
          });

        } catch (error) {
          console.error(`Error analyzing ${analysisType}:`, error);

          // Hata ile ara kayıt yap  
          await analysisStorageService.savePartialAnalysis(fileName, {
            type: analysisType,
            error: error.message,
            metadata: analysisMetadata
          });
          console.log(`💾 Hata ile ara kayıt yapıldı: ${analysisType} analizi başarısız (${completed}/${totalAnalyses})`);
        }

        completed++;

        if (!abortController.signal.aborted && completed < totalAnalyses) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      // If aborted, don't process results
      if (abortController.signal.aborted) {
        setIsAnalyzing(false);
        clearAnalysisProgress();
        return null;
      }

      const finalResults = {
        customResults: multiResults,
        metadata: analysisMetadata,
        timestamp: new Date().toISOString()
      };

      // Save final analysis with correct parameters
      const currentScript = useScriptStore.getState().getCurrentScript();
      const scriptFileName = currentScript?.fileName || currentScript?.name || 'Unknown_Script';
      const scriptText = currentScript?.cleanedText || currentScript?.scriptText || text;
      // Tüm tamamlanan analiz tiplerini dosya adına ekle
      const completedTypes = Object.keys(multiResults).join('_');
      await analysisStorageService.saveAnalysis(scriptText, scriptFileName, finalResults, {
        projectName: `${scriptFileName.replace(/\.(pdf|txt|fountain)$/i, '')}_${completedTypes}`,
        analysisType: 'full',
        fileName: scriptFileName,
        originalFileName: currentScript?.originalFileName || scriptFileName,
        fileType: currentScript?.fileType || 'unknown',
        analysisProvider: provider
      });

      setCustomResults(multiResults);
      setAnalysisData(finalResults);
      setActiveTab('custom');

      return finalResults;

    } catch (error) {
      console.error('AI Analysis Error:', error);
      throw error;
    } finally {
      setIsAnalyzing(false);
      clearAnalysisProgress();
      setAnalysisAbortController(null);
    }
  };

  // Storyboard için akıllı analiz başlatma - mevcut analizleri kontrol et ve gerekirse başlat
  // Export function for Storyboard component to use
  window.analysisPanel = {
    checkStoryboardRequirements: checkStoryboardAnalysisRequirements,
    hasAnalysisData: () => !!analysisData && !!analysisData.customResults,
    startAnalysis: handleAnalyze,
    isConfigured: isConfigured,
    hasText: () => !!filteredAnalysisText && filteredAnalysisText.trim().length > 0
  };

  // Load saved analyses when component mounts or when switching to saved tab
  useEffect(() => {
    if (activeTab === 'saved') {
      loadSavedAnalyses();
    }
  }, [activeTab]);

  // Listen for analysis updates from Storyboard panel
  useEffect(() => {
    const handleAnalysisUpdate = (event) => {
      console.log('🔄 Analysis update event received:', event.detail);
      // Refresh saved analyses list
      if (activeTab === 'saved') {
        loadSavedAnalyses();
      }
      // Show notification
      console.log('✅ Storyboard panelinden analiz güncellendi');
    };

    window.addEventListener('analysisUpdated', handleAnalysisUpdate);

    return () => {
      window.removeEventListener('analysisUpdated', handleAnalysisUpdate);
    };
  }, [activeTab]);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef(null);
  const analysisDropdownRef = useRef(null);

  // Close export menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setShowExportMenu(false);
      }
      if (analysisDropdownRef.current && !analysisDropdownRef.current.contains(event.target)) {
        setShowAnalysisDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleExport = async (format = 'json') => {
    if (!analysisData) {
      alert(t('analysis.noDataToExport', 'Henüz analiz verisi yok. Lütfen önce analiz çalıştırın.'));
      return;
    }

    try {
      setShowExportMenu(false);

      if (format === 'pdf') {
        // PDF Export with improved error handling
        console.log('PDF Export başlatılıyor:', analysisData);

        if (!analysisData || Object.keys(analysisData).length === 0) {
          alert('Dışa aktarılacak analiz verisi yok. Lütfen önce analiz çalıştırın.');
          return;
        }

        try {
          const pdfService = new PDFExportService();

          // JSON formatını optimize et ve PDF için işle
          console.log('Analiz verisi JSON formatında işleniyor...');
          const doc = pdfService.exportAnalysis(analysisData);

          if (!doc) {
            throw new Error('PDF belgesi oluşturulamadı');
          }

          const success = await pdfService.save('senaryo-analiz-raporu.pdf');
          if (success) {
            alert(t('analysis.exportSuccess', 'PDF raporu başarıyla kaydedildi! JSON formatı otomatik olarak işlendi.'));
          } else {
            alert('PDF kaydetme işlemi iptal edildi veya başarısız oldu.');
          }
        } catch (error) {
          console.error('PDF Export Error:', error);
          alert(`PDF oluşturulurken hata oluştu: ${error.message}`);
        }
        return;
      }

      if (format === 'docx') {
        alert(`DOCX export özelliği yakında eklenecek. Şimdilik JSON veya PDF formatını kullanabilirsiniz.`);
        return;
      }

      // JSON Export with optimization
      const defaultPath = 'screenplay-analysis.json';
      const filters = [{ name: 'JSON Files', extensions: ['json'] }, { name: 'All Files', extensions: ['*'] }];

      // PDF servisini kullanarak JSON'ı temizle ve optimize et
      const pdfService = new PDFExportService();
      const optimizedData = pdfService.exportAnalysisAsJSON(analysisData);

      console.log('JSON export için veri optimize edildi, boyut:', optimizedData.length, 'karakter');

      if (window.electronAPI && window.electronAPI.saveFile) {
        const filePath = await window.electronAPI.saveFile({
          defaultPath,
          filters,
        });

        if (filePath) {
          await window.electronAPI.saveFileContent({
            filePath,
            data: optimizedData,
          });
          alert(t('analysis.exportSuccess', 'Analiz başarıyla kaydedildi! JSON formatı optimize edildi.'));
        }
      } else {
        // Fallback: Browser download
        const blob = new Blob([optimizedData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultPath;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert(t('analysis.exportSuccess', 'Analiz başarıyla kaydedildi! JSON formatı optimize edildi.'));
      }
    } catch (error) {
      console.error('Export error:', error);
      alert(`Export hatası: ${error.message}`);
      alert(`Export hatası: ${error.message}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-cinema-black relative">
      {/* Toolbar */}
      <div className="bg-cinema-dark border-b border-cinema-gray p-4 relative z-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-cinema-accent">{t('analysis.title')}</h2>
          <div className="flex items-center gap-3">
            {analysisData && !isAnalyzing && (
              <div className="relative" ref={exportMenuRef}>
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="btn-secondary text-sm flex items-center gap-2"
                >
                  💾 {t('analysis.exportAnalysis')}
                  <span className="text-xs">▼</span>
                </button>

                {showExportMenu && (
                  <div className="absolute top-full right-0 mt-1 bg-cinema-dark border border-cinema-gray rounded-lg shadow-lg z-50 min-w-[240px]">
                    <div className="px-3 py-2 text-xs text-cinema-text-dim border-b border-cinema-gray">
                      📤 Export Formatları (JSON Optimized)
                    </div>
                    <button
                      onClick={() => handleExport('json')}
                      className="w-full px-4 py-2 text-left text-sm text-cinema-text hover:bg-cinema-gray transition-colors flex items-center gap-2"
                    >
                      📄 JSON (Optimized Data)
                      <span className="text-xs text-cinema-accent ml-auto">✨ Temiz</span>
                    </button>
                    <button
                      onClick={() => handleExport('pdf')}
                      className="w-full px-4 py-2 text-left text-sm text-cinema-text hover:bg-cinema-gray transition-colors flex items-center gap-2"
                    >
                      📋 PDF (Smart Report)
                      <span className="text-xs text-cinema-accent ml-auto">✨ JSON Parser</span>
                    </button>
                    <button
                      onClick={() => handleExport('docx')}
                      className="w-full px-4 py-2 text-left text-sm text-cinema-text hover:bg-cinema-gray transition-colors flex items-center gap-2 rounded-b-lg"
                    >
                      📝 Word Document
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={calculateCostEstimate}
              disabled={isAnalyzing || !isConfigured()}
              className="btn-primary text-sm disabled:opacity-50 flex items-center gap-2"
              title={!isConfigured() ? 'Configure AI Provider in Settings' : 'Maliyet önizlemesi ile analizi başlat'}
            >
              {isAnalyzing ? (
                <>
                  <span className="inline-block animate-spin mr-2">⏳</span>
                  {analysisProgress?.message || t('analysis.analyzing')}
                </>
              ) : (
                <>
                  {provider === 'gemini' ? '💰' : '🤖'} {t('analysis.runAnalysis')}
                  <span className="text-xs opacity-75">
                    ({provider === 'openai' ? 'OpenAI' : provider === 'gemini' ? 'Gemini + Önizleme' : provider === 'local' ? 'Local' : provider === 'mlx' ? 'MLX' : provider})
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Multi-Analysis Selection */}
        <div className="bg-cinema-gray rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-cinema-text">{t('analysis.selectTypes', 'Analiz Türlerini Seçin')}</h3>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const allTypes = {};
                  getPromptTypes('analysis').forEach(({ key }) => {
                    allTypes[key] = true;
                  });
                  setSelectedAnalysisTypes(allTypes);
                }}
                className="text-xs px-3 py-1.5 bg-cinema-accent/20 hover:bg-cinema-accent/30 text-cinema-accent rounded transition-colors font-medium"
              >
                ✓ Tümünü Seç
              </button>
              <button
                onClick={() => {
                  const allTypes = {};
                  getPromptTypes('analysis').forEach(({ key }) => {
                    allTypes[key] = false;
                  });
                  setSelectedAnalysisTypes(allTypes);
                }}
                className="text-xs px-3 py-1.5 bg-cinema-gray-light hover:bg-cinema-gray text-cinema-text-dim rounded transition-colors"
              >
                ✗ Temizle
              </button>
            </div>
          </div>

          {/* Dropdown Analysis Selection */}
          <div className="relative mb-4" ref={analysisDropdownRef}>
            <button
              onClick={() => setShowAnalysisDropdown(!showAnalysisDropdown)}
              className="w-full bg-cinema-gray-light hover:bg-cinema-gray border-2 border-cinema-gray rounded-lg p-3 flex items-center justify-between transition-all"
            >
              <div className="flex items-center gap-2">
                <span className="text-cinema-accent">📋</span>
                <div className="text-left">
                  <div className="text-sm text-cinema-text font-medium">
                    {Object.keys(selectedAnalysisTypes).filter(key => selectedAnalysisTypes[key]).length} analiz seçili
                  </div>
                  <div className="text-xs text-cinema-text-dim">
                    {Object.keys(selectedAnalysisTypes).filter(key => selectedAnalysisTypes[key]).length === 0
                      ? 'Analiz türü seçin'
                      : `${getPromptTypes('analysis').length} analiz mevcut`
                    }
                  </div>
                </div>
              </div>
              <svg
                className={`w-5 h-5 text-cinema-text-dim transition-transform ${showAnalysisDropdown ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Content */}
            {showAnalysisDropdown && (
              <div className="absolute top-full left-0 right-0 z-50 bg-cinema-dark border-2 border-cinema-gray rounded-lg shadow-2xl max-h-80 overflow-y-auto mt-1">
                <div className="p-3">
                  {/* Standard Analysis Types */}
                  <div className="mb-4">
                    <h4 className="text-xs font-semibold text-cinema-accent uppercase tracking-wide mb-2 px-2">
                      📝 Standart Analizler
                    </h4>
                    <div className="space-y-1">
                      {getPromptTypes('analysis').filter(({ key }) => !key.includes('llama')).sort((a, b) => {
                        // Storyboard modülüne atananları en üste al
                        const storyboardPrompts = getPromptsByModule('storyboard');
                        const storyboardKeys = storyboardPrompts.map(p => p.key);

                        const aInStoryboard = storyboardKeys.includes(a.key);
                        const bInStoryboard = storyboardKeys.includes(b.key);

                        // Her ikisi de storyboard'daysa, storyboard sırasına göre
                        if (aInStoryboard && bInStoryboard) {
                          return storyboardKeys.indexOf(a.key) - storyboardKeys.indexOf(b.key);
                        }
                        // Sadece a storyboard'daysa, a önce gelsin
                        if (aInStoryboard) return -1;
                        // Sadece b storyboard'daysa, b önce gelsin
                        if (bInStoryboard) return 1;
                        // İkisi de storyboard'da değilse, alfabetik sırala
                        return a.name.localeCompare(b.name, 'tr');
                      }).map(({ key, name }) => (
                        <label
                          key={key}
                          className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-all hover:bg-cinema-gray/50 ${selectedAnalysisTypes[key] ? 'bg-cinema-accent/10 border-l-4 border-cinema-accent' : ''
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedAnalysisTypes[key] || false}
                            onChange={(e) => {
                              setSelectedAnalysisTypes({
                                ...selectedAnalysisTypes,
                                [key]: e.target.checked
                              });
                            }}
                            className="w-4 h-4 rounded border-cinema-gray text-cinema-accent focus:ring-cinema-accent focus:ring-offset-0"
                          />
                          <span className={`text-sm flex-1 ${selectedAnalysisTypes[key] ? 'text-cinema-accent font-medium' : 'text-cinema-text'}`}>
                            {name}
                          </span>
                          {selectedAnalysisTypes[key] && (
                            <span className="text-xs text-cinema-accent">✓</span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs bg-cinema-black/30 p-3 rounded">
            <div className="flex items-center gap-2 text-cinema-text-dim">
              <span className="text-base">💡</span>
              <span>
                <strong>Çoklu Analiz:</strong> Seçili analizler sırayla çalıştırılacak ve sonuçlar ayrı görüntülenecek
              </span>
            </div>
            <div className="text-cinema-accent font-bold">
              ⚡ {Object.keys(selectedAnalysisTypes).filter(key => selectedAnalysisTypes[key]).length} analiz seçili
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {!analysisData ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-4">🎬</div>
              <h3 className="text-xl font-bold text-cinema-text mb-2">
                {t('analysis.noAnalysisYet')}
              </h3>
              <p className="text-cinema-text-dim mb-6">
                {t('analysis.noAnalysisYetDesc')}
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            {/* Comprehensive Analysis Results */}
            <>
              {/* Enhanced Summary Cards */}
              {analysisData.isCustomAnalysis ? (
                /* Custom Analysis - Summary cards removed */
                <></>
              ) : (
                /* Standard Analysis Summary */
                <div className="grid grid-cols-4 gap-4 mb-8">
                  <div className="bg-gradient-to-br from-cinema-dark to-cinema-gray p-5 rounded-lg border border-cinema-gray hover:border-cinema-accent/30 transition-colors cursor-pointer"
                    onClick={() => setActiveTab('scenes')}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-2xl">🎬</div>
                      <div className="text-3xl font-bold text-cinema-accent">
                        {analysisData.summary?.totalScenes || analysisData.scenes?.length || 0}
                      </div>
                    </div>
                    <div className="text-sm text-cinema-text-dim">{t('analysis.totalScenes')}</div>
                    <div className="text-xs text-cinema-accent mt-1">{t('common.clickToView')}</div>
                  </div>
                  <div className="bg-gradient-to-br from-cinema-dark to-cinema-gray p-5 rounded-lg border border-cinema-gray hover:border-cinema-accent/30 transition-colors cursor-pointer"
                    onClick={() => setActiveTab('locations')}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-2xl">📍</div>
                      <div className="text-3xl font-bold text-cinema-accent">
                        {analysisData.locations?.length || 0}
                      </div>
                    </div>
                    <div className="text-sm text-cinema-text-dim">{t('analysis.tabs.locations')}</div>
                    <div className="text-xs text-cinema-accent mt-1">{t('common.clickToView')}</div>
                  </div>
                  <div className="bg-gradient-to-br from-cinema-dark to-cinema-gray p-5 rounded-lg border border-cinema-gray hover:border-cinema-accent/30 transition-colors cursor-pointer"
                    onClick={() => setActiveTab('characters')}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-2xl">👥</div>
                      <div className="text-3xl font-bold text-cinema-accent">
                        {analysisData.characters?.length || 0}
                      </div>
                    </div>
                    <div className="text-sm text-cinema-text-dim">{t('analysis.tabs.characters')}</div>
                    <div className="text-xs text-cinema-accent mt-1">{t('common.clickToView')}</div>
                  </div>
                  <div className="bg-gradient-to-br from-cinema-dark to-cinema-gray p-5 rounded-lg border border-cinema-gray hover:border-cinema-accent/30 transition-colors cursor-pointer"
                    onClick={() => setActiveTab('equipment')}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-2xl">🎥</div>
                      <div className="text-3xl font-bold text-cinema-accent">
                        {analysisData.summary?.estimatedShootingDays ||
                          (analysisData.locations?.reduce((acc, loc) => acc + (parseInt(loc.estimatedShootingDays) || 1), 0)) || 0}
                      </div>
                    </div>
                    <div className="text-sm text-cinema-text-dim">{t('analysis.estShootDays')}</div>
                    <div className="text-xs text-cinema-accent mt-1">{t('common.clickToView')}</div>
                  </div>
                </div>
              )}

              {/* Enhanced Tab Navigation */}
              <div className="flex gap-1 mb-6 bg-cinema-gray rounded-xl p-1 overflow-x-auto">
                {[
                  { key: 'overview', label: 'Genel Bakış', icon: '📊', count: null, show: true },
                  { key: 'custom', label: 'Analiz Sonuçları', icon: '🎯', count: analysisData.customResults ? Object.keys(analysisData.customResults).length : 0, show: analysisData.isCustomAnalysis },
                  { key: 'saved', label: 'Kaydedilmiş Analizler', icon: '💾', count: savedAnalyses.length, show: true }
                ].filter(tab => tab.show !== false).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex-shrink-0 px-4 py-3 rounded-lg transition-all font-medium flex items-center justify-center gap-2 ${activeTab === tab.key
                      ? 'bg-cinema-accent text-cinema-black shadow-lg'
                      : 'text-cinema-text hover:bg-cinema-gray-light hover:text-cinema-accent'
                      }`}
                  >
                    <span className="text-lg">{tab.icon}</span>
                    <span>{tab.label}</span>
                    {tab.count !== undefined && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab.key
                        ? 'bg-cinema-black/20 text-cinema-black'
                        : 'bg-cinema-accent/20 text-cinema-accent'
                        }`}>
                        {tab.count || 0}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Enhanced Tab Content */}
              <div className="bg-cinema-dark rounded-xl border border-cinema-gray-light p-6 min-h-[500px]">
                {activeTab === 'overview' && (
                  <OverviewTab analysisData={analysisData} />
                )}
                {activeTab === 'scenes' && (
                  <ScenesTab scenes={analysisData.scenes || []} />
                )}
                {activeTab === 'locations' && (
                  <LocationsTab locations={analysisData.locations || []} />
                )}
                {activeTab === 'characters' && (
                  <CharactersTab characters={analysisData.characters || []} />
                )}
                {activeTab === 'competitive' && (
                  <CompetitiveTab analysis={analysisData.competitiveAnalysis} />
                )}
                {activeTab === 'geographic' && (
                  <GeographicTab analysis={analysisData.geographicAnalysis} />
                )}
                {activeTab === 'trend' && (
                  <TrendTab analysis={analysisData.trendAnalysis} />
                )}
                {activeTab === 'risk' && (
                  <RiskTab analysis={analysisData.riskOpportunityAnalysis} />
                )}
                {activeTab === 'equipment' && (
                  <EquipmentTab equipment={analysisData.equipment || []} />
                )}
                {activeTab === 'vfx' && (
                  <VFXTab
                    vfxRequirements={analysisData.vfxRequirements || []}
                    sfxRequirements={analysisData.sfxRequirements || []}
                  />
                )}
                {activeTab === 'production' && (
                  <VirtualProductionTab
                    virtualProductionSuitability={analysisData.virtualProductionSuitability || {}}
                    shootingTechniques={analysisData.shootingTechniques || []}
                  />
                )}
                {activeTab === 'evaluation' && (
                  <EvaluationTab
                    evaluation={analysisData.evaluation || {}}
                  />
                )}
                {activeTab === 'audience' && (
                  <AudienceTab
                    audienceAnalysis={analysisData.audienceAnalysis || {}}
                  />
                )}
                {activeTab === 'custom' && (
                  <CustomAnalysisTab
                    customResults={analysisData.customResults || {}}
                    activePrompt={analysisData.activeCustomPrompt}
                    onSelectPrompt={setSelectedCustomPrompt}
                  />
                )}
                {activeTab === 'saved' && (
                  <SavedAnalysesTab
                    savedAnalyses={savedAnalyses}
                    setSavedAnalyses={setSavedAnalyses}
                    loadingSavedAnalyses={loadingSavedAnalyses}
                    onLoadAnalysis={loadSavedAnalysis}
                    onDeleteAnalysis={deleteSavedAnalysis}
                    onRefresh={loadSavedAnalyses}
                    setCustomResults={setCustomResults}
                    setAnalysisData={setAnalysisData}
                  />
                )}
              </div>
            </>
          </div>
        )}
      </div>

      {/* Cost Preview Modal */}
      {showCostPreview && (
        <CostPreviewModal
          costEstimates={costEstimates}
          onConfirm={handleCostPreviewConfirm}
          onCancel={handleCostPreviewCancel}
          useCache={costEstimates.some(est => est.cachedTokens > 0)}
        />
      )}

      {/* Analysis Progress Overlay - Placed at end to overlay everything */}
      {isAnalyzing && (
        <div className="absolute inset-0 bg-cinema-black/95 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <div className="text-6xl mb-6 animate-spin">🧠</div>
            <h3 className="text-2xl font-bold text-cinema-accent mb-4">
              🔄 Analiz Devam Ediyor
            </h3>
            <p className="text-cinema-text-dim text-lg mb-4">
              {analysisProgress?.message || 'AI analiz gerçekleştiriyor...'}
            </p>

            {/* Progress Details */}
            {analysisProgress && (
              <div className="bg-cinema-dark/50 rounded-lg p-4 mb-6 border border-cinema-gray">
                {analysisProgress.currentType && (
                  <p className="text-cinema-accent font-medium mb-2">
                    🎯 {analysisProgress.currentType} Analizi
                  </p>
                )}

                {/* Basit Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-cinema-text text-sm font-medium">İlerleme</span>
                    <span className="text-cinema-accent font-bold">
                      {Math.round(analysisProgress.progress || 0)}%
                    </span>
                  </div>

                  {/* Progress Bar Kutusu */}
                  <div className="w-full h-8 bg-cinema-gray/30 border-2 border-cinema-gray rounded-lg overflow-hidden relative">
                    {/* Dolum Çubuğu */}
                    <div
                      className="h-full transition-all duration-500 ease-out relative"
                      style={{
                        width: `${Math.min(analysisProgress.progress || 0, 100)}%`,
                        background: analysisProgress.progress > 80 ? 'linear-gradient(90deg, #10b981, #22c55e)' :
                          analysisProgress.progress > 60 ? 'linear-gradient(90deg, #eab308, #f59e0b)' :
                            analysisProgress.progress > 30 ? 'linear-gradient(90deg, #f97316, #fb923c)' :
                              'linear-gradient(90deg, #ef4444, #f87171)'
                      }}
                    >
                      {/* Animasyon */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                    </div>

                    {/* Yüzde Text */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white text-xs font-bold drop-shadow-md">
                        {Math.round(analysisProgress.progress || 0)}%
                      </span>
                    </div>
                  </div>
                </div>

                {analysisProgress.completed !== undefined && analysisProgress.total && (
                  <p className="text-cinema-text-dim text-sm mb-2">
                    📊 Tamamlanan: {analysisProgress.completed}/{analysisProgress.total}
                  </p>
                )}
                {analysisProgress.currentChunk && analysisProgress.totalChunks && (
                  <p className="text-cinema-text-dim text-sm">
                    📄 Parça: {analysisProgress.currentChunk}/{analysisProgress.totalChunks}
                  </p>
                )}
              </div>
            )}

            <button
              onClick={cancelAnalysis}
              className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors border border-red-500/30 font-medium"
            >
              ✖ İptal Et
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ScenesTab({ scenes }) {
  const { t } = useTranslation();
  if (!scenes || scenes.length === 0) {
    return (
      <div className="text-center py-12 text-cinema-text-dim">
        <div className="text-4xl mb-4">🎬</div>
        <p>{t('scenes.noScenes')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-cinema-accent mb-2">{t('scenes.title')}</h3>
        <p className="text-cinema-text-dim text-sm">
          {t('scenes.desc', { count: scenes.length })}
        </p>
      </div>

      {/* Scenes List */}
      <div className="space-y-4">
        {scenes.map((scene, index) => (
          <div key={index} className="p-5 bg-cinema-gray rounded-lg border border-cinema-gray-light hover:border-cinema-accent/30 transition-colors">
            <div className="flex items-start gap-4">
              <div className="bg-cinema-accent text-cinema-black font-bold text-lg px-3 py-1 rounded-lg min-w-[60px] text-center">
                #{scene.number || index + 1}
              </div>
              <div className="flex-1">
                <h4 className="text-cinema-text font-bold text-lg mb-2">{scene.header || `Scene ${index + 1}`}</h4>
                <p className="text-cinema-text-dim text-sm mb-4 leading-relaxed">{scene.description}</p>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <span className="text-xs text-cinema-text-dim uppercase tracking-wider">{t('scenes.technicalDetails')}</span>
                    <div className="flex gap-2 flex-wrap mt-1">
                      <span className="text-xs px-2 py-1 bg-cinema-black rounded text-cinema-text border border-cinema-gray-light">
                        {scene.intExt || 'N/A'}
                      </span>
                      <span className="text-xs px-2 py-1 bg-cinema-black rounded text-cinema-text border border-cinema-gray-light">
                        {scene.timeOfDay || 'N/A'}
                      </span>
                      <span className="text-xs px-2 py-1 bg-cinema-black rounded text-cinema-text border border-cinema-gray-light">
                        ~{scene.estimatedDuration || '5'} {t('units.min')}
                      </span>
                    </div>
                  </div>
                  {scene.characters && scene.characters.length > 0 && (
                    <div>
                      <span className="text-xs text-cinema-text-dim uppercase tracking-wider">{t('scenes.characters')}</span>
                      <div className="flex gap-1 flex-wrap mt-1">
                        {scene.characters.map((char, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-1 bg-cinema-accent/20 rounded text-cinema-accent border border-cinema-accent/30"
                          >
                            {char}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LocationsTab({ locations }) {
  const { t } = useTranslation();
  const { locationAssets, setLocationMaster } = useAssetStore();

  const handleSetMasterShot = async (locName) => {
    try {
      const filePath = await window.electronAPI.openFile();
      if (filePath) {
        const result = await window.electronAPI.readFile(filePath);
        if (result.success) {
          // Convert to base64 safely
          const blob = new Blob([result.buffer]);
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            setLocationMaster(locName, base64);
          };
          reader.readAsDataURL(blob);
        }
      }
    } catch (e) {
      console.error("Failed to set master shot:", e);
    }
  };

  if (!locations || locations.length === 0) {
    return (
      <div className="text-center py-12 text-cinema-text-dim">
        <div className="text-4xl mb-4">📍</div>
        <p>{t('locations.noLocations')}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-cinema-accent mb-2">{t('locations.title')}</h3>
        <p className="text-cinema-text-dim text-sm">
          {t('locations.desc', { count: locations.length })}
        </p>
      </div>

      {/* Locations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {locations.map((location, index) => {
          const asset = locationAssets[location.name];

          return (
            <div key={index} className="p-5 bg-cinema-gray rounded-lg border border-cinema-gray-light hover:border-cinema-accent/30 transition-colors relative">

              {/* Master Shot UI */}
              <div
                title="Mekân Master Shot (Referans Görsel)"
                className="absolute top-4 right-4 w-24 h-16 rounded-lg bg-black/50 overflow-hidden border border-cinema-gray hover:border-cinema-accent cursor-pointer group z-10 transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSetMasterShot(location.name);
                }}
              >
                {asset?.masterShot ? (
                  <div className="relative w-full h-full">
                    <img src={`data:image/jpeg;base64,${asset.masterShot}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 text-xs text-white">Değiştir</div>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center opacity-50 group-hover:opacity-100">
                    <span className="text-lg">🖼️</span>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-3 mb-4 pr-24">
                <div className="text-2xl">
                  {location.type === 'INTERIOR' ? '🏠' : location.type === 'EXTERIOR' ? '🌍' : '📍'}
                </div>
                <div className="flex-1">
                  <h4 className="text-cinema-text font-bold text-lg mb-1">{location.name || `Location ${index + 1}`}</h4>
                  <span className="text-xs px-2 py-1 bg-cinema-accent/20 rounded text-cinema-accent">
                    {location.type || t('common.unknownType')}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {location.description && (
                  <p className="text-cinema-text-dim text-sm leading-relaxed">{location.description}</p>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-cinema-text-dim">Scenes:</span>
                      <span className="text-cinema-text font-medium">{location.sceneCount || '0'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-cinema-text-dim">Shoot Days:</span>
                      <span className="text-cinema-accent font-bold">
                        {location.estimatedShootingDays || 'TBD'}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {location.requirements && location.requirements.length > 0 && (
                      <div>
                        <span className="text-cinema-text-dim text-xs uppercase tracking-wider">Requirements</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {location.requirements.slice(0, 3).map((req, i) => (
                            <span key={i} className="text-xs px-1 py-0.5 bg-cinema-black rounded text-cinema-text">
                              {req}
                            </span>
                          ))}
                          {location.requirements.length > 3 && (
                            <span className="text-xs text-cinema-text-dim">+{location.requirements.length - 3} more</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CharactersTab({ characters }) {
  const { t } = useTranslation();
  const { characterAssets, setCharacterAnchor } = useAssetStore();

  const handleSetAnchor = async (charName) => {
    try {
      const filePath = await window.electronAPI.openFile();
      if (filePath) {
        const result = await window.electronAPI.readFile(filePath);
        if (result.success) {
          // Convert to base64 safely
          const blob = new Blob([result.buffer]);
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            setCharacterAnchor(charName, base64);
          };
          reader.readAsDataURL(blob);
        }
      }
    } catch (e) {
      console.error("Failed to set anchor:", e);
    }
  };

  if (!characters || characters.length === 0) {
    return (
      <div className="text-center py-12 text-cinema-text-dim">
        <div className="text-4xl mb-4">👥</div>
        <p>Henüz karakter analizi bulunmuyor</p>
        <p className="text-sm mt-2">Analiz sonrasında karakterler burada görüntülenecektir.</p>
      </div>
    );
  }

  // Character statistics
  const getCharacterStats = () => {
    const mainCharacters = characters.filter(char =>
      char.importance === 'main' || char.role === 'main' || char.type === 'protagonist'
    ).length;

    const supportingCharacters = characters.filter(char =>
      char.importance === 'supporting' || char.role === 'supporting'
    ).length;

    const totalDialogue = characters.reduce((sum, char) => {
      return sum + (char.dialogueLines || char.lines || 0);
    }, 0);

    const averageSceneCount = characters.reduce((sum, char) => {
      return sum + (char.sceneCount || char.appearances || 0);
    }, 0) / characters.length;

    return {
      total: characters.length,
      main: mainCharacters,
      supporting: supportingCharacters,
      minor: characters.length - mainCharacters - supportingCharacters,
      totalDialogue: totalDialogue,
      averageScenes: Math.round(averageSceneCount)
    };
  };

  const stats = getCharacterStats();

  return (
    <div className="space-y-6">
      {/* Character Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-cinema-black/50 rounded-xl border border-cinema-gray p-4 text-center">
          <div className="text-2xl font-bold text-cinema-accent mb-1">{stats.total}</div>
          <div className="text-sm text-cinema-text-dim">Toplam Karakter</div>
        </div>
        <div className="bg-cinema-black/50 rounded-xl border border-cinema-gray p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400 mb-1">{stats.main}</div>
          <div className="text-sm text-cinema-text-dim">Ana Karakter</div>
        </div>
        <div className="bg-cinema-black/50 rounded-xl border border-cinema-gray p-4 text-center">
          <div className="text-2xl font-bold text-blue-400 mb-1">{stats.supporting}</div>
          <div className="text-sm text-cinema-text-dim">Yardımcı Karakter</div>
        </div>
        <div className="bg-cinema-black/50 rounded-xl border border-cinema-gray p-4 text-center">
          <div className="text-2xl font-bold text-green-400 mb-1">{stats.averageScenes}</div>
          <div className="text-sm text-cinema-text-dim">Ortalama Sahne</div>
        </div>
      </div>

      {/* Character Analysis */}
      <div className="bg-cinema-black/30 rounded-xl border border-cinema-gray p-6 mb-6">
        <h3 className="text-lg font-semibold text-cinema-text mb-4 flex items-center gap-2">
          📊 Karakter Dağılımı
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-cinema-gray/20 rounded-lg">
            <div className="text-3xl mb-2">⭐</div>
            <div className="text-xl font-bold text-yellow-400">{stats.main}</div>
            <div className="text-sm text-cinema-text-dim">Ana Karakterler</div>
            <div className="text-xs text-cinema-accent mt-1">
              %{Math.round((stats.main / stats.total) * 100)}
            </div>
          </div>
          <div className="text-center p-4 bg-cinema-gray/20 rounded-lg">
            <div className="text-3xl mb-2">👤</div>
            <div className="text-xl font-bold text-blue-400">{stats.supporting}</div>
            <div className="text-sm text-cinema-text-dim">Yardımcı Karakterler</div>
            <div className="text-xs text-cinema-accent mt-1">
              %{Math.round((stats.supporting / stats.total) * 100)}
            </div>
          </div>
          <div className="text-center p-4 bg-cinema-gray/20 rounded-lg">
            <div className="text-3xl mb-2">🎭</div>
            <div className="text-xl font-bold text-gray-400">{stats.minor}</div>
            <div className="text-sm text-cinema-text-dim">Figüran/Küçük</div>
            <div className="text-xs text-cinema-accent mt-1">
              %{Math.round((stats.minor / stats.total) * 100)}
            </div>
          </div>
        </div>
      </div>

      {/* Characters Grid */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-cinema-text mb-4 flex items-center gap-2">
          🎭 Karakter Listesi
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {characters.map((character, index) => {
            const isMain = character.importance === 'main' || character.role === 'main' || character.type === 'protagonist';
            const isSupporting = character.importance === 'supporting' || character.role === 'supporting';
            const asset = characterAssets[character.name];

            return (
              <div key={index} className="bg-cinema-black/30 rounded-xl border border-cinema-gray p-5 hover:border-cinema-accent/30 transition-colors relative">

                {/* Anchor Image UI */}
                <div
                  title="Karakter Görselini Kilitle (Anchor Image)"
                  className="absolute top-4 right-4 w-16 h-16 rounded-lg bg-black/50 overflow-hidden border border-cinema-gray hover:border-cinema-accent cursor-pointer group z-10 transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSetAnchor(character.name);
                  }}
                >
                  {asset?.anchorImage ? (
                    <div className="relative w-full h-full">
                      <img src={`data:image/jpeg;base64,${asset.anchorImage}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 text-xs text-white">Değiştir</div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center opacity-50 group-hover:opacity-100">
                      <span className="text-lg">📸</span>
                    </div>
                  )}
                </div>

                <div className="flex items-start gap-4 mb-4 pr-20">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl ${isMain ? 'bg-yellow-500/20 text-yellow-400' :
                    isSupporting ? 'bg-blue-500/20 text-blue-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                    {isMain ? '⭐' : isSupporting ? '👤' : '🎭'}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-cinema-text font-bold text-xl mb-1">
                      {character.name || `Karakter ${index + 1}`}
                    </h4>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${isMain ? 'bg-yellow-500/20 text-yellow-400' :
                      isSupporting ? 'bg-blue-500/20 text-blue-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                      {isMain ? 'Ana Karakter' : isSupporting ? 'Yardımcı Karakter' : 'Figüran'}
                    </span>
                  </div>
                </div>

                {(character.description || character.analysis) && (
                  <div className="mb-4 p-3 bg-cinema-gray/10 rounded-lg">
                    <p className="text-cinema-text-dim text-sm leading-relaxed">
                      {(character.description || character.analysis || '').substring(0, 150)}
                      {(character.description || character.analysis || '').length > 150 ? '...' : ''}
                    </p>
                  </div>
                )}

                {/* Character Metrics */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center p-2 bg-cinema-gray/10 rounded-lg">
                    <div className="text-lg font-bold text-cinema-accent">
                      {character.sceneCount || character.appearances || 0}
                    </div>
                    <div className="text-xs text-cinema-text-dim">Sahne Sayısı</div>
                  </div>
                  <div className="text-center p-2 bg-cinema-gray/10 rounded-lg">
                    <div className="text-lg font-bold text-cinema-accent">
                      {character.dialogueLines || character.lines || 0}
                    </div>
                    <div className="text-xs text-cinema-text-dim">Diyalog Sayısı</div>
                  </div>
                </div>

                {/* Character Traits */}
                {(character.traits || character.characteristics || character.personality) && (
                  <div className="mb-4">
                    <div className="text-sm text-cinema-accent font-medium mb-2">Özellikler:</div>
                    <div className="flex flex-wrap gap-2">
                      {(character.traits || character.characteristics || character.personality || [])
                        .slice(0, 4)
                        .map((trait, i) => (
                          <span key={i} className="text-xs px-2 py-1 bg-cinema-accent/20 text-cinema-accent rounded">
                            {typeof trait === 'string' ? trait : trait.name || trait.value}
                          </span>
                        ))
                      }
                    </div>
                  </div>
                )}

                {/* Relationships */}
                {character.relationships && character.relationships.length > 0 && (
                  <div>
                    <div className="text-sm text-cinema-accent font-medium mb-2">İlişkiler:</div>
                    <div className="flex flex-wrap gap-1">
                      {character.relationships.slice(0, 3).map((rel, i) => (
                        <span key={i} className="text-xs px-2 py-1 bg-cinema-gray/20 text-cinema-text rounded">
                          {typeof rel === 'string' ? rel : rel.character || rel.name}
                        </span>
                      ))}
                      {character.relationships.length > 3 && (
                        <span className="text-xs text-cinema-text-dim">+{character.relationships.length - 3} more</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Character Arc */}
                {character.arc && (
                  <div className="mt-4 pt-3 border-t border-cinema-gray/30">
                    <div className="text-sm text-cinema-accent font-medium mb-2">Karakter Gelişimi:</div>
                    <p className="text-xs text-cinema-text-dim leading-relaxed">
                      {character.arc.substring(0, 120)}...
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EquipmentTab({ equipment }) {
  if (!equipment || equipment.length === 0) {
    return (
      <div className="text-center py-12 text-cinema-text-dim">
        <div className="text-4xl mb-4">🎬</div>
        <p>{t('equipment.noEquipment')}</p>
      </div>
    );
  }

  // Group equipment by category
  const groupedEquipment = equipment.reduce((acc, item) => {
    const category = item.category || t('common.general');
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {});

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-cinema-accent mb-2">{t('equipment.title')}</h3>
        <p className="text-cinema-text-dim text-sm">
          {t('equipment.desc')}
        </p>
      </div>

      {/* Equipment by Category */}
      <div className="space-y-6">
        {Object.entries(groupedEquipment).map(([category, items]) => (
          <div key={category}>
            <h4 className="text-lg font-bold text-cinema-text mb-4 border-b border-cinema-gray-light pb-2">
              {category} <span className="text-sm font-normal text-cinema-text-dim">({items.length} {t('equipment.items')})</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((item, index) => (
                <div key={index} className="p-4 bg-cinema-gray rounded-lg border border-cinema-gray-light hover:border-cinema-accent/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">
                      {item.category === 'Camera' ? '📹' :
                        item.category === 'Audio' ? '🎤' :
                          item.category === 'Lighting' ? '💡' :
                            item.category === 'Props' ? '🎭' : '🔧'}
                    </div>
                    <div className="flex-1">
                      <h5 className="text-cinema-text font-bold mb-2">{item.item || item.name || 'Equipment'}</h5>
                      <p className="text-cinema-text-dim text-sm mb-3 leading-relaxed">{item.reason || item.description}</p>

                      {item.scenes && item.scenes.length > 0 && (
                        <div className="mb-3">
                          <span className="text-xs text-cinema-text-dim uppercase tracking-wider">{t('equipment.requiredForScenes')}</span>
                          <div className="text-sm text-cinema-text mt-1">
                            {Array.isArray(item.scenes) ? item.scenes.join(', ') : item.scenes}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-center text-xs">
                        <span className={`px-2 py-1 rounded ${item.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                          item.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-green-500/20 text-green-400'
                          }`}>
                          {t(`common.${item.priority?.toLowerCase()}`) || item.priority || t('common.standard')} {t('equipment.priority')}
                        </span>
                        {item.cost && (
                          <span className="text-cinema-text-dim">
                            {t('equipment.estimatedCost')} {item.cost}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomAnalysisTab({ customResults, activePrompt, onSelectPrompt }) {
  const { t } = useTranslation();
  const getPromptTypes = usePromptStore(state => state.getPromptTypes);
  const getPrompt = usePromptStore(state => state.getPrompt);
  const [expandedResults, setExpandedResults] = React.useState({});
  const [analysisStats, setAnalysisStats] = React.useState(null);

  // Calculate analysis statistics
  React.useEffect(() => {
    if (customResults && Object.keys(customResults).length > 0) {
      const stats = {
        total: Object.keys(customResults).length,
        completed: 0,
        failed: 0,
        totalWords: 0,
        avgWordCount: 0,
        successRate: 0
      };

      Object.values(customResults).forEach(result => {
        if (result.status === 'completed') {
          stats.completed++;
        } else if (result.status === 'failed') {
          stats.failed++;
        }
        stats.totalWords += result.wordCount || 0;
      });

      stats.avgWordCount = Math.round(stats.totalWords / stats.total);
      stats.successRate = Math.round((stats.completed / stats.total) * 100);

      setAnalysisStats(stats);
    }
  }, [customResults]);

  if (!customResults || Object.keys(customResults).length === 0) {
    return (
      <div className="text-center py-12 text-cinema-text-dim">
        <div className="text-4xl mb-4">🎯</div>
        <p>Henüz analiz sonucu yok</p>
        <p className="text-sm mt-2">Çoklu analiz seçerek başlayın</p>
      </div>
    );
  }

  const availableResults = Object.keys(customResults);

  // 🔍 JSON VALIDATION & FIXING - Tüm analizleri doğrula
  const [validatedResults, setValidatedResults] = React.useState(customResults || {});
  const [validationReport, setValidationReport] = React.useState(null);

  React.useEffect(() => {
    if (!customResults || typeof customResults !== 'object') {
      setValidatedResults({});
      setValidationReport(null);
      return;
    }

    const keys = Object.keys(customResults);
    if (keys.length === 0) {
      setValidatedResults({});
      setValidationReport(null);
      return;
    }

    // Artık validation yok - AI çıktısı olduğu gibi kullanılıyor
    console.log(`📊 ${keys.length} analiz yüklendi (validation devre dışı)`);
    setValidatedResults(customResults);
    setValidationReport(null);
  }, [customResults]);

  // Analiz ismini kısalt ve düzenle
  const shortenAnalysisName = (name) => {
    if (!name || typeof name !== 'string') return name;

    // Türkçe karakter mapping
    const replacements = {
      'Senaryo Analizi': 'Senaryo',
      'Kapsamlı Analiz': 'Analiz',
      'Detaylı Analiz': 'Analiz',
      'Comprehensive': '',
      'Analysis': '',
      'Analizi': '',
      'İçin': '',
      'için': ''
    };

    let shortened = name;
    Object.keys(replacements).forEach(key => {
      shortened = shortened.replace(new RegExp(key, 'gi'), replacements[key]);
    });

    // Fazla boşlukları temizle
    shortened = shortened.replace(/\s+/g, ' ').trim();

    // Çok uzunsa kısalt (50 karakterden uzun)
    if (shortened.length > 50) {
      // Önemli kelimeleri koru
      const words = shortened.split(' ');
      if (words.length > 5) {
        shortened = words.slice(0, 4).join(' ') + '...';
      } else {
        shortened = shortened.substring(0, 47) + '...';
      }
    }

    return shortened;
  };

  // JSON'u renkli göster
  const formatJSON = (json) => {
    try {
      const jsonString = typeof json === 'string' ? json : JSON.stringify(json, null, 2);

      // Basit syntax highlighting
      return jsonString
        .replace(/("[\w_]+"):/g, '<span class="text-blue-400">$1</span>:')  // Keys
        .replace(/: (".*?")/g, ': <span class="text-green-400">$1</span>')  // String values
        .replace(/: (\d+)/g, ': <span class="text-yellow-400">$1</span>')   // Numbers
        .replace(/: (true|false|null)/g, ': <span class="text-purple-400">$1</span>'); // Booleans/null
    } catch (e) {
      return json;
    }
  };

  const getAnalysisIcon = (promptKey) => {
    if (promptKey.includes('character')) return '👥';
    if (promptKey.includes('location')) return '📍';
    if (promptKey.includes('plot') || promptKey.includes('story')) return '📖';
    if (promptKey.includes('theme')) return '🎭';
    if (promptKey.includes('dialogue')) return '💬';
    if (promptKey.includes('structure')) return '🏗️';
    if (promptKey.includes('production')) return '🎬';
    if (promptKey.includes('cinematography')) return '🎥';
    if (promptKey.includes('visual')) return '🎨';
    if (promptKey.includes('virtual')) return '🖥️';
    if (promptKey.includes('market')) return '📊';
    if (promptKey.includes('audience')) return '🎯';
    if (promptKey.includes('risk')) return '⚠️';
    if (promptKey.includes('budget')) return '💰';
    if (promptKey.includes('technical')) return '🔧';
    return '🎯';
  };

  const getStatusColor = (result) => {
    if (result.status === 'completed') return 'text-green-400';
    if (result.status === 'failed') return 'text-red-400';
    return 'text-yellow-400';
  };

  const getStatusIcon = (result) => {
    if (result.status === 'completed') return '✅';
    if (result.status === 'failed') return '❌';
    return '⏳';
  };

  return (
    <div>
      {/* Enhanced Header with Statistics */}
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-cinema-text mb-4 flex items-center gap-3">
          <span className="text-3xl">📊</span>
          <span>Çoklu Analiz Sonuçları</span>
        </h3>

        {/* ÖZET: Genel Değerlendirme */}
        <div className="bg-gradient-to-r from-cinema-gray/50 to-cinema-gray/30 rounded-xl p-6 mb-6 border border-cinema-gray">
          <h4 className="text-lg font-semibold text-cinema-accent mb-3 flex items-center gap-2">
            <span>📋</span>
            <span>Genel Değerlendirme</span>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Sol Kolon: Analiz İstatistikleri */}
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-cinema-black/30 rounded p-2">
                <span className="text-cinema-text-dim text-sm">Toplam Analiz:</span>
                <span className="text-cinema-accent font-bold">{analysisStats?.total || availableResults.length}</span>
              </div>
              <div className="flex items-center justify-between bg-cinema-black/30 rounded p-2">
                <span className="text-cinema-text-dim text-sm">Başarılı:</span>
                <span className="text-green-400 font-bold">{analysisStats?.completed || availableResults.length}</span>
              </div>
              <div className="flex items-center justify-between bg-cinema-black/30 rounded p-2">
                <span className="text-cinema-text-dim text-sm">Başarı Oranı:</span>
                <span className="text-cinema-accent font-bold">{analysisStats?.successRate || 100}%</span>
              </div>
            </div>

            {/* Sağ Kolon: İçerik Bilgileri */}
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-cinema-black/30 rounded p-2">
                <span className="text-cinema-text-dim text-sm">Toplam Kelime:</span>
                <span className="text-blue-400 font-bold">{Math.round((analysisStats?.totalWords || 0) / 1000)}K</span>
              </div>
              <div className="flex items-center justify-between bg-cinema-black/30 rounded p-2">
                <span className="text-cinema-text-dim text-sm">Analiz Tarihi:</span>
                <span className="text-cinema-text text-sm">{new Date().toLocaleDateString('tr-TR')}</span>
              </div>
              <div className="flex items-center justify-between bg-cinema-black/30 rounded p-2">
                <span className="text-cinema-text-dim text-sm">Durum:</span>
                <span className="text-green-400 font-bold">✓ Tamamlandı</span>
              </div>
            </div>
          </div>

          {/* Özet Açıklama */}
          <div className="bg-cinema-black/20 rounded-lg p-4 border-l-4 border-cinema-accent">
            <p className="text-cinema-text text-sm leading-relaxed">
              <span className="font-semibold text-cinema-accent">{availableResults.length} farklı analiz türü</span> başarıyla tamamlandı.
              Aşağıda her analiz türünün detaylı sonuçlarını inceleyebilir, JSON formatında dışa aktarabilir
              veya başka projelerde kullanabilirsiniz.
            </p>

            {/* Validation Status */}
            {validationReport && validationReport.summary && (
              <div className="mt-3 pt-3 border-t border-cinema-gray/40">
                <div className="flex items-center gap-4 text-xs">
                  {validationReport.summary.validCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-green-400">✓</span>
                      <span className="text-cinema-text-dim">Geçerli:</span>
                      <span className="text-green-400 font-bold">{validationReport.summary.validCount}</span>
                    </div>
                  )}
                  {validationReport.summary.fixedCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-yellow-400">⚙️</span>
                      <span className="text-cinema-text-dim">Düzeltildi:</span>
                      <span className="text-yellow-400 font-bold">{validationReport.summary.fixedCount}</span>
                    </div>
                  )}
                  {validationReport.summary.errorCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-red-400">⚠️</span>
                      <span className="text-cinema-text-dim">Hatalı:</span>
                      <span className="text-red-400 font-bold">{validationReport.summary.errorCount}</span>
                    </div>
                  )}
                </div>

                {/* Düzeltme detayları bilgi notu */}
                {validationReport.summary.fixedCount > 0 && (
                  <div className="mt-2 text-xs text-yellow-400/80 bg-yellow-500/5 rounded px-2 py-1.5 border-l-2 border-yellow-400/30">
                    <span className="font-semibold">🔧 Otomatik Düzeltmeler:</span> Parantez dengeleme, virgül düzeltme, tırnak işaretleri ve syntax hataları otomatik düzeltildi.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* All Results Display - Enhanced Grid Layout */}
      <div className="space-y-4">
        {availableResults.map((promptKey) => {
          const resultData = validatedResults[promptKey] || customResults[promptKey]; // Validated data kullan
          const promptName = resultData?.name || promptKey;
          const resultText = resultData?.result || resultData;
          const isExpanded = expandedResults[promptKey];

          // Validation durumunu belirle
          const validationStatus = validationReport && validationReport.valid && validationReport.fixed && validationReport.errors ? (
            validationReport.valid[promptKey] ? 'valid' :
              validationReport.fixed[promptKey] ? 'fixed' :
                validationReport.errors[promptKey] ? 'error' : null
          ) : null;

          return (
            <div key={promptKey} className="bg-cinema-gray rounded-lg border border-cinema-gray-light overflow-hidden">
              {/* Header - Always visible with enhanced information */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-cinema-gray-light transition-colors"
                onClick={() => setExpandedResults({
                  ...expandedResults,
                  [promptKey]: !isExpanded
                })}
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">
                    {getAnalysisIcon(promptKey)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-lg font-bold text-cinema-text truncate" title={promptName}>
                        {shortenAnalysisName(promptName)}
                      </h4>
                      <span className={`text-sm flex-shrink-0 ${getStatusColor(resultData)}`}>
                        {getStatusIcon(resultData)}
                      </span>

                      {/* Validation Badge */}
                      {validationStatus === 'valid' && (
                        <span
                          className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full flex-shrink-0"
                          title="JSON yapısı doğrulandı ve geçerli"
                        >
                          ✓ Geçerli
                        </span>
                      )}
                      {validationStatus === 'fixed' && (
                        <span
                          className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-full flex-shrink-0 cursor-help"
                          title={`Otomatik düzeltildi:\n${(validationReport?.fixed?.[promptKey]?.errors || []).slice(0, 3).join('\n')}`}
                        >
                          ⚙️ Düzeltildi
                        </span>
                      )}
                      {validationStatus === 'error' && (
                        <span
                          className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full flex-shrink-0 cursor-help"
                          title={`Hatalar:\n${(validationReport?.errors?.[promptKey]?.errors || []).slice(0, 3).join('\n')}`}
                        >
                          ⚠️ Hata
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-cinema-text-dim flex-wrap">
                      <span className="truncate max-w-md">
                        {(() => {
                          // Akıllı preview metni
                          if (typeof resultText === 'object') {
                            // Object/Array ise yapıyı özetle
                            const keys = Object.keys(resultText);
                            if (Array.isArray(resultText)) {
                              return `📊 ${resultText.length} öğe`;
                            } else if (resultText.characters) {
                              return `👥 ${resultText.characters.length} karakter`;
                            } else if (resultText.scenes) {
                              return `🎬 ${resultText.scenes.length} sahne`;
                            } else if (resultText.locations) {
                              return `📍 ${resultText.locations.length} mekan`;
                            } else if (resultText.shots) {
                              return `🎥 ${resultText.shots.length} çekim`;
                            } else if (keys.length > 0) {
                              return `📋 ${keys.length} alan`;
                            }
                            return 'Analiz tamamlandı';
                          }
                          // String ise ilk satırı göster (JSON değilse)
                          const firstLine = String(resultText).split('\n')[0];
                          if (firstLine.startsWith('{') || firstLine.startsWith('[')) {
                            return 'JSON formatında analiz (genişlet)';
                          }
                          return `${firstLine.substring(0, 60)}...`;
                        })()}
                      </span>
                      {resultData.wordCount && (
                        <span className="text-cinema-accent flex-shrink-0">
                          📝 {resultData.wordCount} kelime
                        </span>
                      )}
                      {resultData.timestamp && (
                        <span className="flex-shrink-0">
                          🕒 {new Date(resultData.timestamp).toLocaleTimeString('tr-TR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const textToCopy = typeof resultText === 'string' ? resultText : JSON.stringify(resultText, null, 2);
                      navigator.clipboard.writeText(`=== ${promptName} ===\n\n${textToCopy}`);
                    }}
                    className="px-3 py-1 bg-cinema-accent/20 hover:bg-cinema-accent/30 text-cinema-accent text-xs rounded transition-colors"
                  >
                    📋 Kopyala
                  </button>
                  <span className="text-cinema-text-dim text-sm">
                    {isExpanded ? '▼' : '▶'}
                  </span>
                </div>
              </div>

              {/* Content - Expandable with better formatting */}
              {isExpanded && (
                <div className="p-4 bg-cinema-black/50 border-t border-cinema-gray-light">
                  {/* Analysis metadata */}
                  {(resultData.timestamp || resultData.wordCount || resultData.type || resultData.summary) && (
                    <div className="mb-4 pb-3 border-b border-cinema-gray/30">
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        {resultData.timestamp && (
                          <div>
                            <span className="text-cinema-text-dim">Oluşturulma:</span>
                            <div className="text-cinema-text">
                              {new Date(resultData.timestamp).toLocaleString('tr-TR')}
                            </div>
                          </div>
                        )}
                        {resultData.wordCount && (
                          <div>
                            <span className="text-cinema-text-dim">Kelime Sayısı:</span>
                            <div className="text-cinema-accent font-bold">{resultData.wordCount}</div>
                          </div>
                        )}
                        {resultData.status && (
                          <div>
                            <span className="text-cinema-text-dim">Durum:</span>
                            <div className={`font-medium ${getStatusColor(resultData)}`}>
                              {resultData.status === 'completed' ? 'Başarılı' :
                                resultData.status === 'failed' ? 'Başarısız' : 'İşleniyor'}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Karakter Analizi Özet Bilgisi */}
                      {promptKey === 'character' && resultData.parsed && resultData.summary && (
                        <div className="mt-4 pt-3 border-t border-cinema-gray/30">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-cinema-accent font-semibold">🎭 Yapılandırılmış Karakter Analizi</span>
                            <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">✓ Parse Edildi</span>
                          </div>
                          <div className="grid grid-cols-4 gap-3">
                            <div className="bg-cinema-black/50 rounded p-2 text-center">
                              <div className="text-lg font-bold text-cinema-accent">{resultData.summary.totalCharacters}</div>
                              <div className="text-xs text-cinema-text-dim">Toplam Karakter</div>
                            </div>
                            <div className="bg-cinema-black/50 rounded p-2 text-center">
                              <div className="text-lg font-bold text-green-400">{resultData.summary.readyForVisualization}</div>
                              <div className="text-xs text-cinema-text-dim">Görselleştirmeye Hazır</div>
                            </div>
                            <div className="bg-cinema-black/50 rounded p-2 text-center">
                              <div className="text-lg font-bold text-blue-400">{resultData.summary.charactersWithVisualDescription}</div>
                              <div className="text-xs text-cinema-text-dim">Fiziksel Tanım</div>
                            </div>
                            <div className="bg-cinema-black/50 rounded p-2 text-center">
                              <div className="text-lg font-bold text-purple-400">%{Math.round(resultData.summary.averageCompleteness)}</div>
                              <div className="text-xs text-cinema-text-dim">Ortalama Tamlık</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Basit text/JSON görüntüleme */}
                  <div className="p-6 bg-cinema-black rounded-lg border border-cinema-gray/30">
                    <pre className="text-cinema-text text-sm whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
                      {typeof resultData.result === 'object'
                        ? JSON.stringify(resultData.result, null, 2)
                        : resultData.result
                      }
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bulk Actions */}
      <div className="mt-6 flex justify-end gap-2">
        <button
          onClick={() => {
            const allExpanded = {};
            availableResults.forEach(key => {
              allExpanded[key] = true;
            });
            setExpandedResults(allExpanded);
          }}
          className="px-3 py-2 bg-cinema-gray-light hover:bg-cinema-gray text-cinema-text text-xs rounded transition-colors"
        >
          ▼ Tümünü Genişlet
        </button>
        <button
          onClick={() => setExpandedResults({})}
          className="px-3 py-2 bg-cinema-gray-light hover:bg-cinema-gray text-cinema-text text-xs rounded transition-colors"
        >
          ▶ Tümünü Daralt
        </button>
        <button
          onClick={() => {
            const allText = availableResults.map(key => {
              const resultData = customResults[key];
              const promptName = resultData?.name || key;
              const resultText = resultData?.result || resultData;
              return `=== ${promptName} ===\n\n${typeof resultText === 'string' ? resultText : JSON.stringify(resultText, null, 2)}\n\n`;
            }).join('\n');
            navigator.clipboard.writeText(allText);
          }}
          className="px-3 py-2 bg-cinema-accent hover:bg-cinema-accent/80 text-cinema-black text-xs rounded transition-colors font-medium"
        >
          📋 Tüm Sonuçları Kopyala
        </button>
      </div>
    </div>
  );
}

function OverviewTab({ analysisData }) {
  const { t } = useTranslation();

  if (!analysisData || Object.keys(analysisData).length === 0) {
    return (
      <div className="text-center py-12 text-cinema-text-dim">
        <div className="text-4xl mb-4">📊</div>
        <p>Henüz analiz verisi bulunmuyor</p>
        <p className="text-sm mt-2">Analiz çalıştırdıktan sonra detaylı raporu burada görebilirsiniz.</p>
      </div>
    );
  }

  // Enhanced metrics extraction with consistent data handling
  const getMetrics = () => {
    const metrics = {
      scenes: 0,
      characters: 0,
      locations: 0,
      shootingDays: 'Belirlenmedi',
      budget: 'N/A',
      genre: 'Belirlenmedi',
      duration: 'Belirlenmedi',
      complexity: 'Orta',
      marketability: 'N/A',
      risk: 'Orta',
      analysisCount: 0,
      completedAnalysis: 0,
      failedAnalysis: 0,
      totalWordCount: 0,
      provider: 'N/A',
      language: 'Türkçe'
    };

    // Count scenes
    if (analysisData.scenes) metrics.scenes = analysisData.scenes.length;
    if (analysisData.analysis?.scenes) metrics.scenes = analysisData.analysis.scenes.length;

    // Count characters
    if (analysisData.characters) metrics.characters = analysisData.characters.length;
    if (analysisData.analysis?.characters) metrics.characters = analysisData.analysis.characters.length;

    // Count locations
    if (analysisData.locations) metrics.locations = analysisData.locations.length;
    if (analysisData.analysis?.locations) metrics.locations = analysisData.analysis.locations.length;

    // Extract analysis metadata
    if (analysisData.metadata) {
      if (analysisData.metadata.provider) metrics.provider = analysisData.metadata.provider;
      if (analysisData.metadata.language) metrics.language = analysisData.metadata.language;
      if (analysisData.metadata.totalAnalysisCount) metrics.analysisCount = analysisData.metadata.totalAnalysisCount;
    }

    // Extract from summary
    if (analysisData.summary) {
      if (analysisData.summary.completedAnalysisCount) metrics.completedAnalysis = analysisData.summary.completedAnalysisCount;
      if (analysisData.summary.failedAnalysisCount) metrics.failedAnalysis = analysisData.summary.failedAnalysisCount;
      if (analysisData.summary.totalWordCount) metrics.totalWordCount = analysisData.summary.totalWordCount;
    }

    // Extract from custom results
    if (analysisData.customResults) {
      metrics.analysisCount = Object.keys(analysisData.customResults).length;
      metrics.completedAnalysis = Object.values(analysisData.customResults).filter(r => r.status === 'completed').length;
      metrics.failedAnalysis = Object.values(analysisData.customResults).filter(r => r.status === 'failed').length;
      metrics.totalWordCount = Object.values(analysisData.customResults).reduce((sum, r) => sum + (r.wordCount || 0), 0);
    }

    // Extract from analysisOverview  
    if (analysisData.analysisOverview) {
      if (analysisData.analysisOverview.provider) metrics.provider = analysisData.analysisOverview.provider;
      if (analysisData.analysisOverview.language) metrics.language = analysisData.analysisOverview.language;
      if (analysisData.analysisOverview.analysisTypes) metrics.analysisCount = analysisData.analysisOverview.analysisTypes.length;
    }

    // Extract other metrics from analysis
    if (analysisData.analysis) {
      if (analysisData.analysis.genre) metrics.genre = analysisData.analysis.genre;
      if (analysisData.analysis.duration) metrics.duration = analysisData.analysis.duration;
      if (analysisData.analysis.shootingDays) metrics.shootingDays = analysisData.analysis.shootingDays;
      if (analysisData.analysis.budget) metrics.budget = analysisData.analysis.budget;
      if (analysisData.analysis.complexity) metrics.complexity = analysisData.analysis.complexity;
      if (analysisData.analysis.marketability) metrics.marketability = analysisData.analysis.marketability;
      if (analysisData.analysis.risk) metrics.risk = analysisData.analysis.risk;
    }

    // Extract from production analysis
    if (analysisData.productionAnalysis) {
      if (analysisData.productionAnalysis.estimatedShootingDays) {
        metrics.shootingDays = analysisData.productionAnalysis.estimatedShootingDays;
      }
      if (analysisData.productionAnalysis.budgetEstimate) {
        metrics.budget = analysisData.productionAnalysis.budgetEstimate;
      }
    }

    // Extract from evaluation
    if (analysisData.evaluation) {
      if (analysisData.evaluation.marketability) metrics.marketability = analysisData.evaluation.marketability;
      if (analysisData.evaluation.complexity) metrics.complexity = analysisData.evaluation.complexity;
      if (analysisData.evaluation.risk) metrics.risk = analysisData.evaluation.risk;
    }

    return metrics;
  };

  const metrics = getMetrics();

  const getProductionCapacity = () => {
    let equipmentCount = 0;
    let vfxCount = 0;
    let sfxCount = 0;
    let virtualProductionReady = false;

    if (analysisData.equipment) equipmentCount = analysisData.equipment.length;
    if (analysisData.vfxRequirements) vfxCount = analysisData.vfxRequirements.length;
    if (analysisData.sfxRequirements) sfxCount = analysisData.sfxRequirements.length;
    if (analysisData.virtualProductionSuitability?.isRecommended) virtualProductionReady = true;

    return { equipmentCount, vfxCount, sfxCount, virtualProductionReady };
  };

  const productionData = getProductionCapacity();

  const getAnalysisScore = () => {
    if (!analysisData.evaluation) return { score: 0, label: 'Belirlenmedi' };

    const evaluation = analysisData.evaluation;
    let score = 0;
    let count = 0;

    if (evaluation.marketability) {
      if (evaluation.marketability.includes('Yüksek') || evaluation.marketability.includes('High')) score += 90;
      else if (evaluation.marketability.includes('Orta') || evaluation.marketability.includes('Medium')) score += 70;
      else score += 50;
      count++;
    }

    if (evaluation.feasibility) {
      if (evaluation.feasibility.includes('Yüksek') || evaluation.feasibility.includes('High')) score += 90;
      else if (evaluation.feasibility.includes('Orta') || evaluation.feasibility.includes('Medium')) score += 70;
      else score += 50;
      count++;
    }

    if (evaluation.quality) {
      if (evaluation.quality.includes('Yüksek') || evaluation.quality.includes('High')) score += 90;
      else if (evaluation.quality.includes('Orta') || evaluation.quality.includes('Medium')) score += 70;
      else score += 50;
      count++;
    }

    const avgScore = count > 0 ? score / count : 0;

    let label = 'Belirlenmedi';
    if (avgScore >= 80) label = 'Mükemmel';
    else if (avgScore >= 70) label = 'İyi';
    else if (avgScore >= 60) label = 'Orta';
    else if (avgScore >= 40) label = 'Düşük';
    else if (avgScore > 0) label = 'Çok Düşük';

    return { score: Math.round(avgScore), label };
  };

  const analysisScore = getAnalysisScore();

  const formatSpecialAnalysisTitle = (key) => {
    const titleMap = {
      'marketAnalysis': 'Pazar Analizi',
      'competitorAnalysis': 'Rakip Analizi',
      'audienceAnalysis': 'Hedef Kitle',
      'productionAnalysis': 'Prodüksiyon',
      'budgetAnalysis': 'Bütçe Analizi',
      'riskAnalysis': 'Risk Değerlendirmesi',
      'dialogueAnalysis': 'Diyalog İncelemesi',
      'characterDevelopment': 'Karakter Gelişimi',
      'plotStructure': 'Olay Örgüsü',
      'themeAnalysis': 'Tema Analizi'
    };

    return titleMap[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
  };

  return (
    <div className="space-y-6">
      {/* Header Stats - Enhanced with Analysis Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-cinema-black/50 rounded-xl border border-cinema-gray p-4 text-center">
          <div className="text-3xl font-bold text-cinema-accent mb-2">{metrics.analysisCount || metrics.scenes}</div>
          <div className="text-sm text-cinema-text-dim">
            {analysisData.isCustomAnalysis ? 'Analiz Sonuçları' : 'Sahneler'}
          </div>
        </div>
        <div className="bg-cinema-black/50 rounded-xl border border-cinema-gray p-4 text-center">
          <div className="text-3xl font-bold text-purple-400 mb-2">{metrics.completedAnalysis || metrics.characters}</div>
          <div className="text-sm text-cinema-text-dim">
            {analysisData.isCustomAnalysis ? 'Başarılı Analiz' : 'Karakterler'}
          </div>
        </div>
        <div className="bg-cinema-black/50 rounded-xl border border-cinema-gray p-4 text-center">
          <div className="text-3xl font-bold text-blue-400 mb-2">{metrics.failedAnalysis || metrics.locations}</div>
          <div className="text-sm text-cinema-text-dim">
            {analysisData.isCustomAnalysis ? 'Başarısız Analiz' : 'Mekanlar'}
          </div>
        </div>
        <div className="bg-cinema-black/50 rounded-xl border border-cinema-gray p-4 text-center">
          <div className="text-3xl font-bold text-green-400 mb-2">{Math.round(metrics.totalWordCount / 1000) || 0}</div>
          <div className="text-sm text-cinema-text-dim">
            {analysisData.isCustomAnalysis ? 'Kelime (K)' : 'Değerlendirme Puanı'}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Analysis Overview */}
        <div className="bg-cinema-black/30 rounded-xl border border-cinema-gray p-6">
          <h3 className="text-lg font-semibold text-cinema-text mb-4 flex items-center gap-2">
            🎬 Analiz Genel Bakış
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-cinema-gray/30">
              <span className="text-cinema-text-dim">Analiz Türü:</span>
              <span className="text-cinema-text font-medium">
                {analysisData.isCustomAnalysis ? 'Özelleştirilmiş' : 'Standart'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-cinema-gray/30">
              <span className="text-cinema-text-dim">AI Provider:</span>
              <span className="text-cinema-text font-medium capitalize">{metrics.provider}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-cinema-gray/30">
              <span className="text-cinema-text-dim">Dil:</span>
              <span className="text-cinema-text font-medium">{metrics.language}</span>
            </div>
            {analysisData.isCustomAnalysis && (
              <>
                <div className="flex justify-between items-center py-2 border-b border-cinema-gray/30">
                  <span className="text-cinema-text-dim">Toplam Analiz:</span>
                  <span className="text-cinema-accent font-bold">{metrics.analysisCount}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-cinema-gray/30">
                  <span className="text-cinema-text-dim">Başarı Oranı:</span>
                  <span className={`font-medium ${metrics.completedAnalysis / metrics.analysisCount > 0.8 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {Math.round((metrics.completedAnalysis / metrics.analysisCount) * 100) || 0}%
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between items-center py-2">
              <span className="text-cinema-text-dim">Oluşturulma:</span>
              <span className="text-cinema-text font-medium text-sm">
                {analysisData.metadata?.timestamp
                  ? new Date(analysisData.metadata.timestamp).toLocaleDateString('tr-TR')
                  : new Date().toLocaleDateString('tr-TR')
                }
              </span>
            </div>
          </div>
        </div>

        {/* Production Overview */}
        <div className="bg-cinema-black/30 rounded-xl border border-cinema-gray p-6">
          <h3 className="text-lg font-semibold text-cinema-text mb-4 flex items-center gap-2">
            🎯 Prodüksiyon Kapsamı
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-cinema-gray/20 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-lg">🛠️</span>
                <span className="text-cinema-text">Ekipman Öğeleri:</span>
              </div>
              <span className="text-cinema-accent font-bold">{productionData.equipmentCount}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-cinema-gray/20 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-lg">✨</span>
                <span className="text-cinema-text">VFX Sekansları:</span>
              </div>
              <span className="text-purple-400 font-bold">{productionData.vfxCount}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-cinema-gray/20 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔊</span>
                <span className="text-cinema-text">SFX İhtiyaçları:</span>
              </div>
              <span className="text-blue-400 font-bold">{productionData.sfxCount}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-cinema-gray/20 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎨</span>
                <span className="text-cinema-text">Sanal Prodüksiyon:</span>
              </div>
              <span className={`font-bold ${productionData.virtualProductionReady ? 'text-green-400' : 'text-red-400'}`}>
                {productionData.virtualProductionReady ? 'Uygun' : 'Değerlendirilmedi'}
              </span>
            </div>
          </div>
        </div>

        {/* Analysis Summary */}
        <div className="bg-cinema-black/30 rounded-xl border border-cinema-gray p-6">
          <h3 className="text-lg font-semibold text-cinema-text mb-4 flex items-center gap-2">
            📊 Analiz Özeti
          </h3>
          <div className="space-y-4">
            {analysisData.isCustomAnalysis && analysisData.customResults ? (
              <div>
                <div className="text-cinema-text-dim leading-relaxed mb-4">
                  {Object.keys(analysisData.customResults).length} farklı analiz türü tamamlandı.
                  Toplam {Math.round(metrics.totalWordCount / 1000)}K kelime analiz sonucu üretildi.
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-cinema-gray/10 p-3 rounded-lg">
                    <div className="text-sm text-cinema-accent font-medium">Tamamlanan Analizler:</div>
                    <div className="text-lg font-bold text-green-400">{metrics.completedAnalysis}</div>
                  </div>
                  <div className="bg-cinema-gray/10 p-3 rounded-lg">
                    <div className="text-sm text-cinema-accent font-medium">Başarı Oranı:</div>
                    <div className="text-lg font-bold text-cinema-accent">
                      {Math.round((metrics.completedAnalysis / metrics.analysisCount) * 100) || 0}%
                    </div>
                  </div>
                </div>
                {/* Show top analysis types */}
                <div>
                  <div className="text-sm text-cinema-accent font-medium mb-2">Analiz Türleri:</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(analysisData.customResults).slice(0, 5).map((key, index) => (
                      <span key={index} className="bg-cinema-accent/20 text-cinema-accent px-2 py-1 rounded text-xs">
                        {analysisData.customResults[key]?.name || key}
                      </span>
                    ))}
                    {Object.keys(analysisData.customResults).length > 5 && (
                      <span className="text-xs text-cinema-text-dim">
                        +{Object.keys(analysisData.customResults).length - 5} daha
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {analysisData.analysis?.summary && (
                  <div className="text-cinema-text-dim leading-relaxed">
                    {typeof analysisData.analysis.summary === 'string'
                      ? analysisData.analysis.summary.substring(0, 200) + (analysisData.analysis.summary.length > 200 ? '...' : '')
                      : 'Analiz özeti mevcut değil'
                    }
                  </div>
                )}
                {analysisData.analysis?.themes && (
                  <div>
                    <div className="text-sm text-cinema-accent font-medium mb-2">Ana Temalar:</div>
                    <div className="flex flex-wrap gap-2">
                      {analysisData.analysis.themes.slice(0, 3).map((theme, index) => (
                        <span key={index} className="bg-cinema-accent/20 text-cinema-accent px-2 py-1 rounded text-xs">
                          {typeof theme === 'string' ? theme : theme.name || 'Tema'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Budget & Timeline */}
        <div className="bg-cinema-black/30 rounded-xl border border-cinema-gray p-6">
          <h3 className="text-lg font-semibold text-cinema-text mb-4 flex items-center gap-2">
            💰 Bütçe & Zaman
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-cinema-gray/20 rounded-lg">
              <span className="text-cinema-text">Çekim Günleri:</span>
              <span className="text-cinema-accent font-bold text-lg">{metrics.shootingDays}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-cinema-gray/20 rounded-lg">
              <span className="text-cinema-text">Bütçe Tahmini:</span>
              <span className="text-green-400 font-bold text-lg">{metrics.budget}</span>
            </div>
            {/* Custom analysis specific information */}
            {analysisData.isCustomAnalysis && (
              <div className="p-3 bg-cinema-gray/20 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-cinema-text">Analiz Süresi:</span>
                  <span className="text-cinema-accent font-medium">
                    {analysisData.metadata?.timestamp
                      ? `${new Date(analysisData.metadata.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
                      : 'Bilinmiyor'
                    }
                  </span>
                </div>
              </div>
            )}
            {analysisData.evaluation?.risk && (
              <div className="p-3 bg-cinema-gray/20 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-cinema-text">Risk Seviyesi:</span>
                  <span className={`font-bold px-2 py-1 rounded text-xs ${metrics.risk === 'Yüksek' || metrics.risk === 'High' ? 'bg-red-500/20 text-red-400' :
                    metrics.risk === 'Orta' || metrics.risk === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-green-500/20 text-green-400'
                    }`}>
                    {metrics.risk}
                  </span>
                </div>
                <div className="text-xs text-cinema-text-dim">
                  {analysisData.evaluation.risk.substring(0, 100)}...
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Special Analysis Results */}
      {analysisData.specialAnalysis && Object.keys(analysisData.specialAnalysis).length > 0 && (
        <div className="bg-cinema-black/30 rounded-xl border border-cinema-gray p-6">
          <h3 className="text-lg font-semibold text-cinema-text mb-4 flex items-center gap-2">
            ⚡ Özel Analizler
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(analysisData.specialAnalysis).map(([key, value]) => (
              <div key={key} className="bg-cinema-gray/10 rounded-lg p-4">
                <div className="text-sm font-medium text-cinema-accent mb-2">
                  {formatSpecialAnalysisTitle(key)}
                </div>
                <div className="text-xs text-cinema-text-dim">
                  {typeof value === 'string'
                    ? value.substring(0, 80) + '...'
                    : typeof value === 'object' && value !== null
                      ? Object.keys(value).length + ' öğe'
                      : 'Analiz tamamlandı'
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VFXTab({ vfxRequirements, sfxRequirements }) {
  const { t } = useTranslation();
  const totalRequirements = [...(vfxRequirements || []), ...(sfxRequirements || [])];

  if (totalRequirements.length === 0) {
    return (
      <div className="text-center py-12 text-cinema-text-dim">
        <div className="text-4xl mb-4">✨</div>
        <p>{t('vfx.noRequirements')}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-cinema-accent mb-2">{t('vfx.title')}</h3>
        <p className="text-cinema-text-dim text-sm">
          {t('vfx.desc')}
        </p>
      </div>

      {/* VFX Section */}
      {vfxRequirements && vfxRequirements.length > 0 && (
        <div className="mb-8">
          <h4 className="text-lg font-bold text-cinema-text mb-4 flex items-center gap-2">
            <span>🎭</span> {t('vfx.visualEffects')} ({vfxRequirements.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vfxRequirements.map((vfx, index) => (
              <div key={index} className="bg-cinema-gray rounded-lg border border-cinema-gray-light p-5 hover:border-cinema-accent/30 transition-colors">
                <div className="flex items-start gap-3 mb-3">
                  <div className="text-2xl">🎬</div>
                  <div className="flex-1">
                    <h5 className="text-cinema-text font-bold text-lg mb-1">{vfx.type || `VFX Effect ${index + 1}`}</h5>
                    <span className={`text-xs px-2 py-1 rounded ${vfx.complexity === 'high' ? 'bg-red-500/20 text-red-400' :
                      vfx.complexity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                      {t(`common.${vfx.complexity?.toLowerCase()}`) || vfx.complexity || t('common.medium')} {t('vfx.complexity')}
                    </span>
                  </div>
                </div>

                <p className="text-cinema-text-dim text-sm mb-4 leading-relaxed">{vfx.description}</p>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-cinema-text-dim">{t('vfx.scenes')}</span>
                    <span className="text-cinema-text">{Array.isArray(vfx.scenes) ? vfx.scenes.join(', ') : vfx.scenes || t('common.tbd')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cinema-text-dim">{t('vfx.estimatedCost')}</span>
                    <span className="text-cinema-accent font-medium">{vfx.estimatedCost || t('common.tbd')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cinema-text-dim">{t('vfx.timeline')}</span>
                    <span className="text-cinema-text">{vfx.timeline || t('common.tbd')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SFX Section */}
      {sfxRequirements && sfxRequirements.length > 0 && (
        <div>
          <h4 className="text-lg font-bold text-cinema-text mb-4 flex items-center gap-2">
            <span>🔊</span> {t('vfx.soundEffects')} ({sfxRequirements.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sfxRequirements.map((sfx, index) => (
              <div key={index} className="bg-cinema-gray rounded-lg border border-cinema-gray-light p-5 hover:border-cinema-accent/30 transition-colors">
                <div className="flex items-start gap-3 mb-3">
                  <div className="text-2xl">🎵</div>
                  <div className="flex-1">
                    <h5 className="text-cinema-text font-bold text-lg mb-1">{sfx.type || `SFX ${index + 1}`}</h5>
                    <span className={`text-xs px-2 py-1 rounded ${sfx.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                      sfx.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                      {t(`common.${sfx.priority?.toLowerCase()}`) || sfx.priority || t('common.medium')} {t('common.priority')}
                    </span>
                  </div>
                </div>

                <p className="text-cinema-text-dim text-sm mb-4 leading-relaxed">{sfx.description}</p>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-cinema-text-dim">{t('vfx.type')}</span>
                    <span className="text-cinema-text">{sfx.category || t('common.general')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cinema-text-dim">{t('vfx.recordingRequired')}</span>
                    <span className="text-cinema-accent">{sfx.recordingRequired ? t('vfx.yes') : t('vfx.library')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VirtualProductionTab({ virtualProductionSuitability, shootingTechniques }) {
  const { t } = useTranslation();
  if (!virtualProductionSuitability || Object.keys(virtualProductionSuitability).length === 0) {
    return (
      <div className="text-center py-12 text-cinema-text-dim">
        <div className="text-4xl mb-4">🎮</div>
        <p>{t('virtualProduction.noAnalysis')}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-cinema-accent mb-2">{t('virtualProduction.title')}</h3>
        <p className="text-cinema-text-dim text-sm">
          {t('virtualProduction.desc')}
        </p>
      </div>

      {/* Overall Assessment */}
      <div className="bg-cinema-gray rounded-lg p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="text-4xl">🎯</div>
          <div>
            <h4 className="text-xl font-bold text-cinema-text">{t('virtualProduction.overallSuitability')}</h4>
            <div className={`text-2xl font-bold mt-1 ${virtualProductionSuitability.overall === 'High' ? 'text-green-400' :
              virtualProductionSuitability.overall === 'Medium' ? 'text-yellow-400' :
                'text-red-400'
              }`}>
              {t(`common.${virtualProductionSuitability.overall?.toLowerCase()}`) || virtualProductionSuitability.overall || t('virtualProduction.notAssessed')}
            </div>
          </div>
        </div>
        <p className="text-cinema-text-dim leading-relaxed">
          {virtualProductionSuitability.reasoning || 'No detailed analysis available'}
        </p>
      </div>

      {/* Assessment Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-cinema-gray rounded-lg p-5">
          <h5 className="text-lg font-bold text-cinema-text mb-3 flex items-center gap-2">
            <span>🌍</span> {t('virtualProduction.environmentSuitability')}
          </h5>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-cinema-text-dim">{t('virtualProduction.controlledEnvironments')}</span>
              <span className="text-cinema-accent font-medium">
                {virtualProductionSuitability.controlledEnvironments || t('common.tbd')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-cinema-text-dim">{t('virtualProduction.cgiIntegration')}</span>
              <span className="text-cinema-accent font-medium">
                {virtualProductionSuitability.cgiIntegration || t('common.tbd')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-cinema-text-dim">{t('virtualProduction.ledVolumeReady')}</span>
              <span className="text-cinema-accent font-medium">
                {virtualProductionSuitability.ledVolumeReady ? t('common.yes') : t('common.no')}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-cinema-gray rounded-lg p-5">
          <h5 className="text-lg font-bold text-cinema-text mb-3 flex items-center gap-2">
            <span>📹</span> {t('virtualProduction.technicalRequirements')}
          </h5>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-cinema-text-dim">{t('virtualProduction.realTimeRendering')}</span>
              <span className="text-cinema-accent font-medium">
                {virtualProductionSuitability.realTimeRendering || t('common.tbd')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-cinema-text-dim">{t('virtualProduction.motionCapture')}</span>
              <span className="text-cinema-accent font-medium">
                {virtualProductionSuitability.motionCapture || t('common.tbd')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-cinema-text-dim">{t('virtualProduction.cameraTracking')}</span>
              <span className="text-cinema-accent font-medium">
                {virtualProductionSuitability.cameraTracking || t('common.tbd')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EvaluationTab({ evaluation }) {
  const { t } = useTranslation();
  if (!evaluation || Object.keys(evaluation).length === 0) {
    return (
      <div className="text-center py-12 text-cinema-text-dim">
        <div className="text-4xl mb-4">📈</div>
        <p>{t('evaluation.noEvaluation')}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-cinema-accent mb-2">{t('evaluation.title')}</h3>
        <p className="text-cinema-text-dim text-sm">
          {t('evaluation.desc')}
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-cinema-gray to-cinema-gray-light rounded-lg p-4 text-center">
          <div className="text-2xl mb-2">💝</div>
          <div className="text-2xl font-bold text-cinema-accent">{evaluation.emotionScore || 'N/A'}/10</div>
          <div className="text-sm text-cinema-text-dim">{t('evaluation.emotionScore')}</div>
        </div>
        <div className="bg-gradient-to-br from-cinema-gray to-cinema-gray-light rounded-lg p-4 text-center">
          <div className="text-2xl mb-2">🎭</div>
          <div className="text-lg font-bold text-cinema-accent">{evaluation.genre || t('common.tbd')}</div>
          <div className="text-sm text-cinema-text-dim">{t('evaluation.primaryGenre')}</div>
        </div>
        <div className="bg-gradient-to-br from-cinema-gray to-cinema-gray-light rounded-lg p-4 text-center">
          <div className="text-2xl mb-2">⏱️</div>
          <div className="text-lg font-bold text-cinema-accent">{evaluation.estimatedDuration || t('common.tbd')}</div>
          <div className="text-sm text-cinema-text-dim">{t('evaluation.duration')}</div>
        </div>
        <div className="bg-gradient-to-br from-cinema-gray to-cinema-gray-light rounded-lg p-4 text-center">
          <div className="text-2xl mb-2">📊</div>
          <div className="text-2xl font-bold text-cinema-accent">{evaluation.complexityScore || 'N/A'}/10</div>
          <div className="text-sm text-cinema-text-dim">{t('evaluation.complexity')}</div>
        </div>
      </div>
    </div>
  );
}

function CompetitiveTab({ analysis }) {
  const { t } = useTranslation();
  if (!analysis) return <div className="text-center py-12 text-cinema-text-dim">{t('analysis.tabs.competitive.noData', 'No competitive analysis available')}</div>;

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-xl font-bold text-cinema-accent mb-2">{t('analysis.tabs.competitive.title', 'Competitive Analysis')}</h3>
        <p className="text-cinema-text-dim text-sm">{t('analysis.tabs.competitive.subtitle', 'Market positioning and competitive landscape assessment')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-cinema-gray rounded-lg p-5 text-center">
          <div className="text-3xl mb-2">🏆</div>
          <div className="text-2xl font-bold text-cinema-accent">{analysis.competitiveScore || 0}/100</div>
          <div className="text-sm text-cinema-text-dim">{t('analysis.tabs.competitive.score', 'Competitive Score')}</div>
        </div>
        <div className="bg-cinema-gray rounded-lg p-5 text-center">
          <div className="text-3xl mb-2">📊</div>
          <div className="text-xl font-bold text-cinema-text capitalize">{analysis.marketPosition?.position || 'Unknown'}</div>
          <div className="text-sm text-cinema-text-dim">{t('analysis.tabs.competitive.marketPosition', 'Market Position')}</div>
        </div>
        <div className="bg-cinema-gray rounded-lg p-5 text-center">
          <div className="text-3xl mb-2">💎</div>
          <div className="text-2xl font-bold text-cinema-accent">{analysis.uniquenessAnalysis?.overallUniqueness || 0}%</div>
          <div className="text-sm text-cinema-text-dim">{t('analysis.tabs.competitive.uniqueness', 'Uniqueness Score')}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-cinema-gray rounded-lg p-5">
          <h4 className="text-lg font-bold text-cinema-text mb-4">{t('analysis.tabs.competitive.comparableFilms', 'Comparable Films')}</h4>
          <div className="space-y-3">
            {analysis.comparableFilms?.map((film, i) => (
              <div key={i} className="flex justify-between items-center border-b border-cinema-gray-light pb-2 last:border-0">
                <span className="text-cinema-text">{film.title}</span>
                <span className="text-cinema-accent text-sm">{film.similarity}% {t('analysis.tabs.competitive.match', 'Match')}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-cinema-gray rounded-lg p-5">
          <h4 className="text-lg font-bold text-cinema-text mb-4">{t('analysis.tabs.competitive.recommendations', 'Strategic Recommendations')}</h4>
          <ul className="space-y-2">
            {analysis.strategicRecommendations?.map((rec, i) => (
              <li key={i} className="text-sm text-cinema-text-dim flex gap-2">
                <span className="text-cinema-accent">•</span>
                {rec.recommendation}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function GeographicTab({ analysis }) {
  const { t } = useTranslation();
  if (!analysis) return <div className="text-center py-12 text-cinema-text-dim">{t('analysis.tabs.geographic.noData', 'No geographic analysis available')}</div>;

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-xl font-bold text-cinema-accent mb-2">{t('analysis.tabs.geographic.title', 'Geographic Market Analysis')}</h3>
        <p className="text-cinema-text-dim text-sm">{t('analysis.tabs.geographic.subtitle', 'Regional market potential and localization strategies')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-cinema-gray rounded-lg p-5">
          <h4 className="text-lg font-bold text-cinema-text mb-4">{t('analysis.tabs.geographic.globalPotential', 'Global Potential')}</h4>
          <div className="flex items-center gap-4 mb-4">
            <div className="text-4xl font-bold text-cinema-accent">{analysis.globalPotential || 0}%</div>
            <div className="text-sm text-cinema-text-dim">{t('analysis.tabs.geographic.appealScore', 'Overall Global Appeal Score')}</div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-cinema-text-dim">{t('analysis.tabs.geographic.universality', 'Cultural Universality')}:</span>
              <span className="text-cinema-text">{analysis.culturalSuitability?.universalityScore || 0}/100</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-cinema-text-dim">{t('analysis.tabs.geographic.localization', 'Localization Complexity')}:</span>
              <span className="text-cinema-text">{analysis.culturalSuitability?.localizationComplexity || 'Medium'}</span>
            </div>
          </div>
        </div>

        <div className="bg-cinema-gray rounded-lg p-5">
          <h4 className="text-lg font-bold text-cinema-text mb-4">{t('analysis.tabs.geographic.topMarkets', 'Top Markets')}</h4>
          <div className="space-y-3">
            {Object.entries(analysis.regionalAnalysis || {})
              .sort((a, b) => b[1].marketScore - a[1].marketScore)
              .slice(0, 5)
              .map(([region, data], i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-cinema-text capitalize">{region}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-cinema-black rounded-full overflow-hidden">
                      <div className="h-full bg-cinema-accent" style={{ width: `${data.marketScore}%` }} />
                    </div>
                    <span className="text-xs text-cinema-text-dim w-8">{data.marketScore}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrendTab({ analysis }) {
  const { t } = useTranslation();
  if (!analysis) return <div className="text-center py-12 text-cinema-text-dim">{t('analysis.tabs.trend.noData', 'No trend analysis available')}</div>;

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-xl font-bold text-cinema-accent mb-2">{t('analysis.tabs.trend.title', 'Trend Analysis')}</h3>
        <p className="text-cinema-text-dim text-sm">{t('analysis.tabs.trend.subtitle', 'Industry trend alignment and timing optimization')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-cinema-gray rounded-lg p-5 text-center">
          <div className="text-3xl mb-2">📈</div>
          <div className="text-2xl font-bold text-cinema-accent">{analysis.overallTrendScore || 0}/100</div>
          <div className="text-sm text-cinema-text-dim">{t('analysis.tabs.trend.alignment', 'Trend Alignment')}</div>
        </div>
        <div className="bg-cinema-gray rounded-lg p-5 text-center">
          <div className="text-3xl mb-2">⏱️</div>
          <div className="text-xl font-bold text-cinema-text capitalize">{analysis.timingAnalysis?.recommendation || 'Neutral'}</div>
          <div className="text-sm text-cinema-text-dim">{t('analysis.tabs.trend.timing', 'Timing Strategy')}</div>
        </div>
        <div className="bg-cinema-gray rounded-lg p-5 text-center">
          <div className="text-3xl mb-2">📺</div>
          <div className="text-xl font-bold text-cinema-text capitalize">{analysis.platformFit?.primaryPlatform || 'Theatrical'}</div>
          <div className="text-sm text-cinema-text-dim">{t('analysis.tabs.trend.platform', 'Best Platform')}</div>
        </div>
      </div>

      <div className="bg-cinema-gray rounded-lg p-5 mb-6">
        <h4 className="text-lg font-bold text-cinema-text mb-4">{t('analysis.tabs.trend.identified', 'Identified Trends')}</h4>
        <div className="flex flex-wrap gap-2">
          {analysis.identifiedTrends?.map((trend, i) => (
            <span key={i} className="px-3 py-1 bg-cinema-accent/20 text-cinema-accent rounded-full text-sm border border-cinema-accent/30">
              {trend.name} ({trend.relevance}%)
            </span>
          ))}
        </div>
      </div>
    </div>
  );
} function RiskTab({ analysis }) {
  const { t } = useTranslation();
  if (!analysis) return <div className="text-center py-12 text-cinema-text-dim">{t('analysis.tabs.risk.noData', 'No risk analysis available')}</div>;

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-xl font-bold text-cinema-accent mb-2">{t('analysis.tabs.risk.title', 'Risk & Opportunity Assessment')}</h3>
        <p className="text-cinema-text-dim text-sm">{t('analysis.tabs.risk.subtitle', 'Project risk profile and strategic opportunities')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-cinema-gray rounded-lg p-5">
          <h4 className="text-lg font-bold text-cinema-text mb-4 text-red-400">{t('analysis.tabs.risk.factors', 'Risk Factors')}</h4>
          <div className="space-y-3">
            {analysis.riskAnalysis?.identifiedRisks?.map((risk, i) => (
              <div key={i} className="p-3 bg-cinema-black/30 rounded border border-red-500/20">
                <div className="flex justify-between mb-1">
                  <span className="font-medium text-red-300">{risk.category}</span>
                  <span className="text-xs px-2 py-0.5 bg-red-500/20 rounded text-red-400 uppercase">{risk.severity}</span>
                </div>
                <p className="text-sm text-cinema-text-dim">{risk.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-cinema-gray rounded-lg p-5">
          <h4 className="text-lg font-bold text-cinema-text mb-4 text-green-400">{t('analysis.tabs.risk.opportunities', 'Opportunities')}</h4>
          <div className="space-y-3">
            {analysis.opportunityAnalysis?.prioritized?.map((opp, i) => (
              <div key={i} className="p-3 bg-cinema-black/30 rounded border border-green-500/20">
                <div className="flex justify-between mb-1">
                  <span className="font-medium text-green-300">{opp.type}</span>
                  <span className="text-xs px-2 py-0.5 bg-green-500/20 rounded text-green-400 uppercase">{opp.impact} {t('analysis.tabs.risk.impact', 'Impact')}</span>
                </div>
                <p className="text-sm text-cinema-text-dim">{opp.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AudienceTab({ audienceAnalysis }) {
  const { t } = useTranslation();
  if (!audienceAnalysis || Object.keys(audienceAnalysis).length === 0) {
    return (
      <div className="text-center py-12 text-cinema-text-dim">
        <div className="text-4xl mb-4">🎯</div>
        <p>{t('analysis.tabs.audience.noData', 'No audience analysis available')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-xl font-bold text-cinema-accent mb-2">{t('analysis.tabs.audience.title', 'Audience & Platform Analysis')}</h3>
        <p className="text-cinema-text-dim text-sm">{t('analysis.tabs.audience.subtitle', 'Target audience demographics and platform suitability')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-cinema-gray rounded-lg p-5">
          <h4 className="text-lg font-bold text-cinema-text mb-4">{t('analysis.tabs.audience.demographics', 'Target Demographics')}</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-cinema-text-dim">{t('analysis.tabs.audience.age', 'Primary Age Group')}:</span>
              <span className="text-cinema-text font-medium">{audienceAnalysis.demographics?.primaryAge || 'TBD'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cinema-text-dim">{t('analysis.tabs.audience.gender', 'Gender Skew')}:</span>
              <span className="text-cinema-text font-medium">{audienceAnalysis.demographics?.genderSkew || 'Balanced'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cinema-text-dim">{t('analysis.tabs.audience.psychographics', 'Psychographics')}:</span>
              <span className="text-cinema-text font-medium">{audienceAnalysis.demographics?.psychographics || 'TBD'}</span>
            </div>
          </div>
        </div>

        <div className="bg-cinema-gray rounded-lg p-5">
          <h4 className="text-lg font-bold text-cinema-text mb-4">{t('analysis.tabs.audience.platform', 'Platform Suitability')}</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-cinema-text-dim">{t('analysis.tabs.audience.primaryPlatform', 'Primary Platform')}:</span>
              <span className="text-cinema-accent font-medium">{audienceAnalysis.platformSuitability?.primary || 'TBD'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cinema-text-dim">{t('analysis.tabs.audience.secondaryPlatform', 'Secondary Platform')}:</span>
              <span className="text-cinema-text font-medium">{audienceAnalysis.platformSuitability?.secondary || 'TBD'}</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

function SavedAnalysesTab({ savedAnalyses, setSavedAnalyses, loadingSavedAnalyses, onLoadAnalysis, onDeleteAnalysis, onRefresh, setCustomResults, setAnalysisData }) {
  if (loadingSavedAnalyses) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cinema-accent mx-auto"></div>
          <p className="text-cinema-text-dim mt-4">Kaydedilmiş analizler yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!savedAnalyses || savedAnalyses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-center">
          <div className="text-6xl mb-4">💾</div>
          <h3 className="text-xl font-semibold text-cinema-text mb-2">Henüz kaydedilmiş analiz yok</h3>
          <p className="text-cinema-text-dim mb-6">
            Analiz yaptığınızda otomatik olarak burada görünecek ve daha sonra tekrar kullanabileceksiniz.
          </p>
          <button
            onClick={onRefresh}
            className="bg-cinema-accent text-white px-6 py-2 rounded-lg hover:bg-opacity-80 transition-all"
          >
            🔄 Yenile
          </button>
        </div>
      </div>
    );
  }

  // Group analyses by project
  const projectGroups = savedAnalyses.reduce((groups, analysis) => {
    const projectName = analysis.projectName || 'Unknown';
    if (!groups[projectName]) {
      groups[projectName] = {
        projectName,
        analyses: [],
        lastUpdate: analysis.timestamp
      };
    }
    groups[projectName].analyses.push(analysis);

    // Update last update time
    if (new Date(analysis.timestamp) > new Date(groups[projectName].lastUpdate)) {
      groups[projectName].lastUpdate = analysis.timestamp;
    }

    return groups;
  }, {});

  const projects = Object.values(projectGroups).sort((a, b) =>
    new Date(b.lastUpdate) - new Date(a.lastUpdate)
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-cinema-text">
          📁 {projects.length} {projects.length === 1 ? 'Proje' : 'Proje'}
          <span className="text-cinema-text-dim text-base ml-2">
            ({savedAnalyses.length} analiz dosyası)
          </span>
        </h3>
        <div className="flex gap-2">
          <button
            onClick={onRefresh}
            className="text-cinema-accent hover:text-cinema-text transition-colors px-3 py-1"
            title="Listeyi yenile"
          >
            🔄
          </button>
          {savedAnalyses.length > 0 && (
            <button
              onClick={async () => {
                // Kısmi ve tam analizleri say
                const partialCount = savedAnalyses.filter(a =>
                  a.analysisType && a.analysisType !== 'full'
                ).length;
                const fullCount = savedAnalyses.length - partialCount;

                const confirmMessage = partialCount > 0
                  ? `⚠️ ${savedAnalyses.length} adet analiz silinecek:\n` +
                  `📊 ${fullCount} tam analiz\n` +
                  `⏸️ ${partialCount} kısmi/yarım analiz\n\n` +
                  `Bu işlem geri alınamaz. Emin misiniz?`
                  : `⚠️ ${savedAnalyses.length} adet kaydedilmiş analiz tamamen silinecek.\n\n` +
                  `Bu işlem geri alınamaz. Emin misiniz?`;

                if (confirm(confirmMessage)) {
                  try {
                    console.log('🧹 KAPSAMLI TEMİZLEME BAŞLIYOR...');

                    // 1. FileSystem ve localStorage'dan tüm analizleri sil
                    const clearResult = await analysisStorageService.clearAll();
                    console.log('📁 FileSystem temizlendi:', clearResult);

                    // 2. LocalStorage'daki TÜM analiz ve script verilerini temizle
                    const keysToRemove = [];
                    for (let i = 0; i < localStorage.length; i++) {
                      const key = localStorage.key(i);
                      if (key && (
                        key.startsWith('mgx_analysis_') ||
                        key.startsWith('mgx_storyboard_') ||
                        key.startsWith('analysis_checkpoint_') ||
                        key.startsWith('temp_')
                      )) {
                        keysToRemove.push(key);
                      }
                    }
                    keysToRemove.forEach(key => {
                      localStorage.removeItem(key);
                      console.log('🗑️ Silindi:', key);
                    });
                    console.log(`📊 LocalStorage'dan ${keysToRemove.length} anahtar silindi`);

                    // 3. Zustand persist storage'ı temizle
                    const scriptStoreKey = 'mgx-script-store';
                    const scriptStore = localStorage.getItem(scriptStoreKey);
                    if (scriptStore) {
                      try {
                        const storeData = JSON.parse(scriptStore);
                        // Analiz verilerini temizle ama scripts array'i koru
                        const cleanedData = {
                          ...storeData,
                          state: {
                            ...storeData.state,
                            analysisData: null,
                            scenes: [],
                            characters: [],
                            locations: [],
                            equipment: [],
                            // Tüm scriptlerdeki analiz verilerini temizle
                            scripts: storeData.state.scripts?.map(script => ({
                              ...script,
                              analysisData: null,
                              customResults: null,
                              scenes: [],
                              characters: [],
                              locations: [],
                              equipment: []
                            })) || []
                          }
                        };
                        localStorage.setItem(scriptStoreKey, JSON.stringify(cleanedData));
                        console.log('🗑️ Zustand persist storage temizlendi');
                      } catch (e) {
                        console.error('Zustand storage parse hatası:', e);
                      }
                    }

                    // 4. UI state'i temizle
                    setSavedAnalyses([]);

                    // 5. Mevcut analiz state'ini temizle
                    setCustomResults({});
                    setAnalysisData(null);
                    console.log('🗑️ Local component state temizlendi (customResults + analysisData)');

                    // 6. Script store'dan TÜM scriptlerdeki analiz verilerini temizle
                    const scriptStoreInstance = useScriptStore.getState();
                    const allScripts = scriptStoreInstance.scripts || [];

                    // Her script için analiz verilerini temizle
                    allScripts.forEach(script => {
                      if (script?.id) {
                        scriptStoreInstance.updateScript(script.id, {
                          analysisData: null,
                          customResults: null,
                          scenes: [],
                          characters: [],
                          locations: [],
                          equipment: []
                        });
                      }
                    });

                    // Mevcut script için de temizle
                    const currentScript = scriptStoreInstance.getCurrentScript();
                    if (currentScript) {
                      scriptStoreInstance.updateScript(currentScript.id, {
                        analysisData: null,
                        customResults: null,
                        scenes: [],
                        characters: [],
                        locations: [],
                        equipment: []
                      });
                    }

                    console.log(`🗑️ ${allScripts.length} scriptin analiz verileri temizlendi`);

                    // 7. IndexedDB'yi temizle (Storyboard verileri)
                    if (window.indexedDB) {
                      try {
                        const deleteRequest = indexedDB.deleteDatabase('StoryboardDB');
                        deleteRequest.onsuccess = () => {
                          console.log('✅ StoryboardDB IndexedDB silindi');
                        };
                        deleteRequest.onerror = (e) => {
                          console.error('❌ IndexedDB silme hatası:', e);
                        };
                        deleteRequest.onblocked = () => {
                          console.warn('⚠️ IndexedDB silinemiyor (açık bağlantı var)');
                        };
                      } catch (e) {
                        console.error('❌ IndexedDB temizleme hatası:', e);
                      }
                    }

                    // 8. Diğer componentlere bildir
                    window.dispatchEvent(new CustomEvent('analysisCleared'));

                    // 9. Başarı mesajı
                    const totalCleaned = clearResult.successCount + keysToRemove.length;
                    alert(
                      `✅ KAPSAMLI TEMİZLİK TAMAMLANDI!\n\n` +
                      `📁 ${clearResult.successCount} dosya silindi\n` +
                      `💾 ${keysToRemove.length} localStorage kaydı silindi\n` +
                      `🗂️ ${allScripts.length} scriptin analiz verileri temizlendi\n` +
                      `🖼️ Storyboard görselleri ve onayları temizlendi\n` +
                      `📊 Toplam ${totalCleaned} kayıt temizlendi\n\n` +
                      `Sayfayı yenilemek için F5'e basın.`
                    );

                    // 9. Listeyi yeniden yükle
                    setTimeout(() => onRefresh(), 100);

                  } catch (error) {
                    console.error('❌ Temizleme hatası:', error);
                    alert(
                      `❌ Temizleme sırasında hata oluştu:\n\n` +
                      `${error.message}\n\n` +
                      `Lütfen konsolu (F12) kontrol edin veya uygulamayı yeniden başlatın.`
                    );
                  }
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-1 rounded-lg transition-all text-sm font-medium"
              title="Tüm kaydedilmiş analizleri sil"
            >
              🗑️ Tümünü Temizle
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4">
        {projects.map((project) => (
          <div
            key={project.projectName}
            className="bg-cinema-gray rounded-lg p-4 border border-gray-700 hover:border-cinema-accent transition-colors"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-cinema-text mb-2">
                  📄 {project.projectName}
                </h4>
                <div className="flex flex-wrap gap-2 mb-2">
                  {project.analyses.map((analysis) => (
                    <div
                      key={analysis.key}
                      className="inline-block px-2 py-0.5 rounded text-xs bg-cinema-accent/20 text-cinema-accent"
                      title={`${analysis.analysisType} - ${new Date(analysis.timestamp).toLocaleString('tr-TR')}`}
                    >
                      {analysis.analysisType === 'character' ? '👤' :
                        analysis.analysisType === 'location' || analysis.analysisType === 'location_analysis' ? '📍' :
                          analysis.analysisType === 'theme' ? '🎭' :
                            analysis.analysisType === 'style' ? '🎨' :
                              analysis.analysisType === 'cinematography' ? '🎥' :
                                analysis.analysisType === 'visual_style' ? '🖼️' :
                                  '📋'} {analysis.analysisType}
                    </div>
                  ))}
                </div>
                <div className="text-sm text-cinema-text-dim space-y-1 mt-2">
                  <div>
                    📅 Son güncelleme: {new Date(project.lastUpdate).toLocaleDateString('tr-TR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                  <div>
                    📊 {project.analyses.length} analiz türü
                  </div>
                  {project.analyses[0]?.metadata && (
                    <>
                      <div>📝 {project.analyses[0].metadata.wordCount?.toLocaleString('tr-TR') || 0} kelime</div>
                      <div>🔧 Versiyon: {project.analyses[0].metadata.version || '1.2'}</div>
                    </>
                  )}
                  {project.analyses[0]?.scriptMetadata && (
                    <>
                      <div>📂 Dosya Türü: {project.analyses[0].scriptMetadata.fileType === 'pdf' ? '📄 PDF' : '📝 Text'}</div>
                      {project.analyses[0].scriptMetadata.analysisProvider && (
                        <div>🤖 Provider: {project.analyses[0].scriptMetadata.analysisProvider}</div>
                      )}
                      {project.analyses[0].scriptMetadata.originalFileName && (
                        <div>🏷️ Orijinal: {project.analyses[0].scriptMetadata.originalFileName}</div>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={async () => {
                    try {
                      // Load all analyses for this project
                      const projectAnalyses = await analysisStorageService.loadAllAnalyses(project.projectName);
                      if (projectAnalyses && projectAnalyses.customResults) {
                        setCustomResults(projectAnalyses.customResults);
                        if (setAnalysisData) {
                          setAnalysisData(projectAnalyses);
                        }
                        console.log(`✅ ${project.projectName} için ${Object.keys(projectAnalyses.customResults).length} analiz yüklendi`);
                        alert(`✅ ${Object.keys(projectAnalyses.customResults).length} analiz türü yüklendi!`);
                      } else {
                        alert('❌ Analiz verisi yüklenemedi. Dosyalar silinmiş olabilir.');
                        // Refresh list to remove stale entries
                        onRefresh();
                      }
                    } catch (error) {
                      console.error('❌ Analiz yükleme hatası:', error);
                      alert(`❌ Analiz yüklenirken hata: ${error.message}`);
                      // Refresh list to remove stale entries
                      onRefresh();
                    }
                  }}
                  className="bg-cinema-accent text-white px-4 py-2 rounded-lg hover:bg-opacity-80 transition-all text-sm"
                  title="Bu projenin tüm analizlerini yükle"
                >
                  📂 Yükle ({project.analyses.length})
                </button>
                <button
                  onClick={async () => {
                    if (confirm(`⚠️ ${project.projectName} projesinin ${project.analyses.length} analizi silinecek. Emin misiniz?`)) {
                      // Delete all analyses for this project
                      for (const analysis of project.analyses) {
                        await onDeleteAnalysis(analysis.key);
                      }
                      onRefresh();
                    }
                  }}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-all text-sm"
                  title="Bu projenin tüm analizlerini sil"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-cinema-bg border border-gray-700 rounded-lg">
        <h4 className="text-lg font-semibold text-cinema-text mb-2">ℹ️ Bilgi</h4>
        <ul className="text-sm text-cinema-text-dim space-y-1">
          <li>• Analizler otomatik olarak yerel depolama alanınıza kaydedilir</li>
          <li>• Aynı senaryo için tekrar analiz yaparsanız, önce kaydedilmiş halini kullanır</li>
          <li>• 30 günden eski analizler otomatik olarak silinir</li>
          <li>• Veriler sadece bu cihazda saklanır, başka yerle paylaşılmaz</li>
        </ul>
      </div>
    </div>
  );
}
