import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useScriptStore } from '../store/scriptStore';
import { useAIStore } from '../store/aiStore';
import { usePromptStore } from '../store/promptStore';
import { useReaderStore } from '../store/readerStore';
import { useFeatureStore } from '../store/featureStore';
import AIHandler from '../utils/aiHandler';
import PDFExportService from '../utils/pdfExportService';
import { analysisStorageService } from '../utils/analysisStorageService';

// Storyboard için gerekli analiz türleri - otomatik seçim için
export const STORYBOARD_REQUIRED_ANALYSIS = [
  'character',          // Karakter analizi - karakterlerin görsel tanımları için
  'location_analysis',  // Mekan analizi - lokasyonların görsel karakteri için
  'cinematography',     // Görüntü yönetimi - kamera açıları ve kompozisyon için
  'visual_style',       // Görsel stil - tonlama ve atmosfer için
  'color_palette',      // Renk paleti - storyboard renk kılavuzu için
  'structure',          // Yapısal analiz - sahne akışı için
  'dialogue',           // Diyalog analizi - karakter etkileşimleri için
  'production'          // Prodüksiyon analizi - teknik gereksinimler için
];

export default function AnalysisPanel() {
  const { cleanedText, scriptText, analysisData, setAnalysisData, isAnalyzing, analysisProgress, setAnalysisProgress, setIsAnalyzing, clearAnalysisProgress, setAnalysisAbortController, cancelAnalysis, isStoryboardProcessing, storyboardProgress } = useScriptStore();
  const { isConfigured, provider, getAIHandler } = useAIStore();
  const { getActivePrompt, getPromptTypes, activePrompts, getPrompt } = usePromptStore();
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
  const [customResults, setCustomResults] = useState({});
  const [showAnalysisDropdown, setShowAnalysisDropdown] = useState(false);
  const [savedAnalyses, setSavedAnalyses] = useState([]);
  const [loadingSavedAnalyses, setLoadingSavedAnalyses] = useState(false);
  
  // Multi-analysis selection - Dynamically initialize with all available types
  const [selectedAnalysisTypes, setSelectedAnalysisTypes] = useState(() => {
    const allTypes = {};
    // Get all available analysis types
    const types = getPromptTypes('analysis');
    types.forEach(({ key }) => {
      // Default selection: main analysis types are selected, llama variants are unselected
      allTypes[key] = !key.includes('llama');
    });
    return allTypes;
  });

  // Track current script and load existing analysis data
  useEffect(() => {
    const loadExistingAnalysisData = async () => {
      const currentScript = useScriptStore.getState().getCurrentScript();
      
      if (!currentScript) {
        // Clear analysis data when no script
        setCustomResults({});
        return;
      }

      const scriptText = currentScript.scriptText || currentScript.cleanedText;
      const fileName = currentScript.fileName || currentScript.name;
      
      if (!scriptText || !fileName) {
        setCustomResults({});
        return;
      }

      console.log('🔍 Loading existing analysis for script:', fileName);

      try {
        // Priority 1: Check if analysis data exists in current script store
        if (currentScript.analysisData?.customResults) {
          setCustomResults(currentScript.analysisData.customResults);
          console.log('📋 Loaded analysis from script store');
          return;
        }

        // Priority 2: Try to load from persistent storage
        const existingAnalysis = await analysisStorageService.loadAnalysis(scriptText, fileName);
        if (existingAnalysis?.customResults) {
          setCustomResults(existingAnalysis.customResults);
          console.log('💾 Loaded analysis from persistent storage');
          
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
          setCustomResults({});
          console.log('❌ No existing analysis found for script');
        }
      } catch (error) {
        console.error('Failed to load existing analysis:', error);
        setCustomResults({});
      }
    };

    loadExistingAnalysisData();
  }, [useScriptStore.getState().currentScriptId]); // Track current script changes

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

        // 🔄 Her adımda ara kayıt güncelle
        try {
          // Güvenli currentScript kontrolü
          const scriptFileName = currentScript?.fileName || currentScript?.name || 'Unknown_Script';
          const tempKey = `temp_${new Date().getTime()}_${scriptFileName}`;
          const tempAnalysisData = {
            customResults: { ...multiResults },
            fileName: scriptFileName,
            analysisDate: new Date().toISOString(),
            isPartialAnalysis: true,
            totalExpectedAnalyses: totalAnalyses,
            completedAnalyses: completed + 1,
            remainingAnalyses: remainingTypes.slice(remainingTypes.indexOf(analysisType) + 1),
            scriptMetadata: {
              fileName: scriptFileName,
              originalFileName: currentScript?.originalFileName || scriptFileName,
              fileType: currentScript?.fileType || 'unknown',
              analysisProvider: provider
            }
          };
          
          await analysisStorageService.saveAnalysis(
            text,
            `${tempKey}_partial`,
            tempAnalysisData,
            { isPartialAnalysis: true }
          );
          
          console.log(`💾 Devam ara kayıt: ${analysisType} tamamlandı (${completed + 1}/${totalAnalyses})`);
        } catch (saveError) {
          console.error('Devam ara kayıt hatası:', saveError);
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
        await analysisStorageService.saveAnalysis(text, scriptFileName, finalAnalysisData, {
          fileName: scriptFileName,
          originalFileName: currentScript?.originalFileName || scriptFileName,
          fileType: currentScript?.fileType || 'unknown',
          analysisProvider: provider
        });
        console.log('💾 Devam edilen analiz tamamlandı ve kaydedildi!');
      } else {
        console.warn('⚠️ Script bilgisi eksik, analiz kaydedilemedi');
      }
    } catch (error) {
      console.error('Final save error:', error);
    }
    
    setActiveTab('custom');
    return multiResults;
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
      const fileName = scriptStore.currentScript?.name || 'Unnamed Script';
      
      // 🔄 ÖNCELİKLE ARA KAYIT KONTROLÜ YAP
      // Selected analysis types'ı önce belirle
      const selectedTypes = Object.keys(selectedAnalysisTypes).filter(key => selectedAnalysisTypes[key]);
      
      if (selectedTypes.length === 0) {
        alert(t('analysis.selectAtLeastOne', 'Lütfen en az bir analiz türü seçin'));
        setIsAnalyzing(false);
        return;
      }
      
      const partialAnalyses = await analysisStorageService.findPartialAnalyses(fileName);
      if (partialAnalyses && partialAnalyses.length > 0) {
        const latestPartial = partialAnalyses[0]; // En yeni ara kayıt
        
        const shouldContinue = confirm(
          `🔄 Yarım kalan analiz bulundu!\n\n` +
          `📄 Dosya: ${latestPartial.fileName}\n` +
          `📅 Tarih: ${new Date(latestPartial.timestamp).toLocaleString('tr-TR')}\n` +
          `📊 Tamamlanan: ${latestPartial.completedAnalyses}/${latestPartial.totalExpectedAnalyses}\n` +
          `⏰ Kalan: ${latestPartial.remainingAnalyses?.join(', ') || 'Bilinmiyor'}\n\n` +
          `Kaldığı yerden devam etmek istiyor musunuz?\n\n` +
          `✅ EVET = Devam et\n❌ HAYIR = Yeni analiz başlat`
        );
        
        if (shouldContinue) {
          // Ara kayıttan devam et
          const partialData = await analysisStorageService.loadAnalysisByKey(latestPartial.key);
          if (partialData && partialData.customResults) {
            setCustomResults(partialData.customResults);
            setAnalysisData(partialData);
            
            // Kalan analizleri belirle
            const completedTypes = Object.keys(partialData.customResults);
            const remainingTypes = selectedTypes.filter(type => !completedTypes.includes(type));
            
            if (remainingTypes.length > 0) {
              console.log(`🔄 Analiz devam ediyor: ${remainingTypes.length} analiz kaldı:`, remainingTypes);
              // Kalan analizleri yap
              await continuePartialAnalysis(text, remainingTypes, partialData.customResults, abortController);
            } else {
              console.log('✅ Tüm analizler zaten tamamlanmış!');
              setActiveTab('custom');
            }
            setIsAnalyzing(false);
            return;
          }
        } else {
          // Eski ara kayıtları temizle
          for (const partial of partialAnalyses) {
            await analysisStorageService.deleteAnalysis(partial.key);
          }
          console.log('🗑️ Eski ara kayıtlar temizlendi, yeni analiz başlatılıyor');
        }
      }
      
      // First try exact match
      let cachedAnalysis = await analysisStorageService.loadAnalysis(text, fileName);
      
      // If no exact match, try PDF filename matching
      if (!cachedAnalysis && fileName.endsWith('.pdf')) {
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

      console.log('Running multi-analysis with selected types:', selectedTypes);

      // Get language variable first
      const currentLanguage = t('language.name', 'Türkçe');

      // Run multiple analyses
      const multiResults = {};
      const totalAnalyses = selectedTypes.length;
      let completed = 0;

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

        setAnalysisProgress({
          message: `${prompt.name} analizi yapılıyor... (${completed + 1}/${totalAnalyses})`,
          progress: (completed / totalAnalyses) * 100
        });

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
          
          // Use the chunking-enabled analyzeWithCustomPrompt method
          // Disable chunking for analysis types that work better without synthesis
          const nonChunkingTypes = ['character', 'theme', 'dialogue', 'location_analysis', 'competitive'];
          const shouldUseChunking = text.length > 15000 && !nonChunkingTypes.includes(analysisType);
          
          const analysisResult = await aiHandler.analyzeWithCustomPrompt(text, {
            systemPrompt: systemPrompt,
            userPrompt: fullPrompt,
            useChunking: shouldUseChunking,
            abortSignal: abortController.signal,
            onProgress: (progressInfo) => {
              // Update progress during chunking
              const chunkProgress = progressInfo.progress || 0;
              const overallProgress = ((completed + (chunkProgress / 100)) / totalAnalyses) * 100;
              
              setAnalysisProgress({
                message: `${prompt.name} - ${progressInfo.message || 'Analiz yapılıyor...'}`,
                progress: overallProgress,
                currentChunk: progressInfo.chunkNumber,
                totalChunks: progressInfo.totalChunks
              });
            }
          });

          // Store structured results with metadata
          multiResults[analysisType] = {
            name: prompt.name,
            type: analysisType,
            result: analysisResult,
            timestamp: new Date().toISOString(),
            wordCount: analysisResult ? analysisResult.length : 0,
            status: 'completed'
          };
          
          // 🔄 ARA KAYIT: Her analiz adımı bittiğinde kaydet
          try {
            const scriptStore = useScriptStore.getState();
            const currentScript = scriptStore.currentScript;
            const scriptFileName = currentScript?.name || 'Unnamed Script';
            
            const tempKey = `temp_${new Date().getTime()}_${scriptFileName}`;
            const tempAnalysisData = {
              customResults: { ...multiResults }, // Şu ana kadar tamamlanan analizler
              fileName: scriptFileName,
              analysisDate: new Date().toISOString(),
              isPartialAnalysis: true,
              totalExpectedAnalyses: totalAnalyses,
              completedAnalyses: completed,
              remainingAnalyses: selectedTypes.slice(completed),
              scriptMetadata: {
                fileName: scriptFileName,
                originalFileName: currentScript?.originalFileName || scriptFileName,
                fileType: currentScript?.fileType || 'script',
                analysisProvider: provider
              }
            };
            
            // Bellekte ara kayıt
            await analysisStorageService.saveAnalysis(
              filteredAnalysisText,
              `${tempKey}_partial`,
              tempAnalysisData,
              { isPartialAnalysis: true }
            );
            
            console.log(`💾 Ara kayıt yapıldı: ${analysisType} analizi tamamlandı (${completed}/${totalAnalyses})`);
          } catch (saveError) {
            console.error('Ara kayıt hatası:', saveError);
            // Ara kayıt hatası analizi durdurmaz, devam eder
          }
          
          completed++;
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
            const scriptFileName = currentScript?.name || 'Unnamed Script';
            
            const tempKey = `temp_${new Date().getTime()}_${scriptFileName}`;
            const tempAnalysisData = {
              customResults: { ...multiResults },
              fileName: scriptFileName,
              analysisDate: new Date().toISOString(),
              isPartialAnalysis: true,
              totalExpectedAnalyses: totalAnalyses,
              completedAnalyses: completed,
              remainingAnalyses: selectedTypes.slice(completed),
              lastError: error.message,
              scriptMetadata: {
                fileName: scriptFileName,
                originalFileName: currentScript?.originalFileName || scriptFileName,
                fileType: currentScript?.fileType || 'script',
                analysisProvider: provider
              }
            };
            
            await analysisStorageService.saveAnalysis(
              filteredAnalysisText,
              `${tempKey}_partial`,
              tempAnalysisData,
              { isPartialAnalysis: true, hasErrors: true }
            );
            
            console.log(`💾 Hata ile ara kayıt yapıldı: ${analysisType} analizi başarısız (${completed}/${totalAnalyses})`);
          } catch (saveError) {
            console.error('Hata durumunda ara kayıt hatası:', saveError);
          }
          
          completed++;
        }
      }

      // Store results with enhanced structure
      setCustomResults(multiResults);

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
        characters: [],
        equipment: [],
        // Analysis result overview for consistent reporting
        analysisOverview: {
          provider: provider,
          language: currentLanguage,
          textLength: text.length,
          analysisTypes: selectedTypes,
          timestamp: new Date().toISOString(),
          resultsGenerated: Object.keys(multiResults).length
        }
      };

      setAnalysisData(result);
      
      // Save analysis to storage with metadata
      try {
        const scriptMetadata = {
          originalFileName: scriptStore.currentScript?.name || fileName,
          fileType: fileName.endsWith('.pdf') ? 'pdf' : 'text',
          uploadDate: scriptStore.currentScript?.uploadDate || new Date().toISOString(),
          analysisProvider: provider,
          analysisLanguage: currentLanguage
        };
        
        await analysisStorageService.saveAnalysis(text, fileName, result, scriptMetadata);
        console.log('✅ Analysis saved to storage with metadata');
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

  // Load saved analyses
  const loadSavedAnalyses = async () => {
    setLoadingSavedAnalyses(true);
    try {
      const analyses = await analysisStorageService.listAnalyses();
      setSavedAnalyses(analyses);
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

  // Delete a saved analysis
  const deleteSavedAnalysis = async (analysisKey) => {
    if (confirm('Bu analizi silmek istediğinizden emin misiniz?')) {
      try {
        await analysisStorageService.deleteAnalysis(analysisKey);
        await loadSavedAnalyses(); // Refresh the list
        console.log('🗑️ Deleted saved analysis:', analysisKey);
      } catch (error) {
        console.error('Failed to delete saved analysis:', error);
        alert('Analizi silmede hata: ' + error.message);
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
      const fileName = scriptStore.currentScript?.name;
      
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
  const runStoryboardRequiredAnalysis = async () => {
    const requirements = checkStoryboardAnalysisRequirements();
    
    if (requirements.hasRequired) {
      console.log('✅ Storyboard için gerekli tüm analizler mevcut');
      return true;
    }
    
    console.log('🎬 Storyboard için eksik analizler tespit edildi:', requirements.missing);
    
    // Eksik analizleri selectedAnalysisTypes'da işaretle
    const updatedSelection = { ...selectedAnalysisTypes };
    requirements.missing.forEach(type => {
      updatedSelection[type] = true;
    });
    setSelectedAnalysisTypes(updatedSelection);
    
    // Analizi otomatik başlat
    console.log('🚀 Storyboard için gerekli analizler başlatılıyor...');
    await handleAnalyze();
    
    return true;
  };

  // Export function for Storyboard component to use
  window.analysisPanel = {
    checkStoryboardRequirements: checkStoryboardAnalysisRequirements,
    runRequiredAnalysis: runStoryboardRequiredAnalysis,
    hasAnalysisData: () => !!analysisData && !!analysisData.customResults
  };

  // Load saved analyses when component mounts or when switching to saved tab
  useEffect(() => {
    if (activeTab === 'saved') {
      loadSavedAnalyses();
    }
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
      {/* Analysis Progress Overlay */}
      {isAnalyzing && (
        <div className="absolute inset-0 bg-cinema-black/95 backdrop-blur-sm z-50 flex items-center justify-center">
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
      
      {/* Toolbar */}
      <div className="bg-cinema-dark border-b border-cinema-gray p-4">
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
              onClick={handleAnalyze}
              disabled={isAnalyzing || !isConfigured()}
              className="btn-primary text-sm disabled:opacity-50 flex items-center gap-2"
              title={!isConfigured() ? 'Configure AI Provider in Settings' : ''}
            >
              {isAnalyzing ? (
                <>
                  <span className="inline-block animate-spin mr-2">⏳</span>
                  {analysisProgress?.message || t('analysis.analyzing')}
                </>
              ) : (
                <>
                  🤖 {t('analysis.runAnalysis')}
                  <span className="text-xs opacity-75">
                    ({provider === 'openai' ? 'OpenAI' : provider === 'gemini' ? 'Gemini' : provider === 'local' ? 'Local' : provider === 'mlx' ? 'MLX' : provider})
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
                      {getPromptTypes('analysis').filter(({ key }) => !key.includes('llama')).map(({ key, name }) => (
                        <label
                          key={key}
                          className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-all hover:bg-cinema-gray/50 ${
                            selectedAnalysisTypes[key] ? 'bg-cinema-accent/10 border-l-4 border-cinema-accent' : ''
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
                  
                  {/* Llama Optimized Types */}
                  <div>
                    <h4 className="text-xs font-semibold text-orange-400 uppercase tracking-wide mb-2 px-2">
                      🦙 Llama Optimize Analizler
                    </h4>
                    <div className="space-y-1">
                      {getPromptTypes('analysis').filter(({ key }) => key.includes('llama')).map(({ key, name }) => (
                        <label
                          key={key}
                          className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-all hover:bg-cinema-gray/50 ${
                            selectedAnalysisTypes[key] ? 'bg-orange-400/10 border-l-4 border-orange-400' : ''
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
                            className="w-4 h-4 rounded border-cinema-gray text-orange-400 focus:ring-orange-400 focus:ring-offset-0"
                          />
                          <span className={`text-sm flex-1 ${selectedAnalysisTypes[key] ? 'text-orange-400 font-medium' : 'text-cinema-text'}`}>
                            {name}
                          </span>
                          {selectedAnalysisTypes[key] && (
                            <span className="text-xs text-orange-400">✓</span>
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
                /* Custom Analysis Summary */
                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="bg-gradient-to-br from-cinema-dark to-cinema-gray p-5 rounded-lg border border-cinema-gray hover:border-cinema-accent/30 transition-colors cursor-pointer"
                    onClick={() => setActiveTab('custom')}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-2xl">🎯</div>
                      <div className="text-3xl font-bold text-cinema-accent">
                        {analysisData.customResults ? Object.keys(analysisData.customResults).length : 0}
                      </div>
                    </div>
                    <div className="text-sm text-cinema-text-dim">Özel Sonuçlar</div>
                    <div className="text-xs text-cinema-accent mt-1">Analizi görmek için tıklayın</div>
                  </div>
                  <div className="bg-gradient-to-br from-cinema-dark to-cinema-gray p-5 rounded-lg border border-cinema-gray">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-2xl">📝</div>
                      <div className="text-3xl font-bold text-cinema-accent">
                        {analysisData.customResults ? 
                          Object.values(analysisData.customResults).filter(r => r.status === 'completed').length : 0}
                      </div>
                    </div>
                    <div className="text-sm text-cinema-text-dim">Aktif Analiz</div>
                    <div className="text-xs text-cinema-text-dim mt-1">{
                      analysisData.customResults && Object.keys(analysisData.customResults).length > 0 ?
                      `${Object.values(analysisData.customResults).filter(r => r.status === 'completed').length} Tamamlandı` :
                      'None'
                    }</div>
                  </div>
                  <div className="bg-gradient-to-br from-cinema-dark to-cinema-gray p-5 rounded-lg border border-cinema-gray">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-2xl">⚡</div>
                      <div className="text-3xl font-bold text-cinema-accent">
                        Custom
                      </div>
                    </div>
                    <div className="text-sm text-cinema-text-dim">Analiz Türü</div>
                    <div className="text-xs text-cinema-accent mt-1">Özelleştirilmiş komut</div>
                  </div>
                </div>
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
                  { key: 'overview', label: t('analysis.tabs.overview'), icon: '📊', count: null, show: !analysisData.isCustomAnalysis },
                  { key: 'scenes', label: t('analysis.tabs.scenes'), icon: '🎬', count: analysisData.scenes?.length, show: !analysisData.isCustomAnalysis },
                  { key: 'locations', label: t('analysis.tabs.locations'), icon: '📍', count: analysisData.locations?.length, show: !analysisData.isCustomAnalysis },
                  { key: 'characters', label: t('analysis.tabs.characters'), icon: '👥', count: analysisData.characters?.length, show: !analysisData.isCustomAnalysis },
                  { key: 'competitive', label: t('analysis.tabs.competitive'), icon: '🏆', count: null, show: !analysisData.isCustomAnalysis && analysisData.competitiveAnalysis },
                  { key: 'geographic', label: t('analysis.tabs.geographic'), icon: '🌍', count: null, show: !analysisData.isCustomAnalysis && analysisData.geographicAnalysis },
                  { key: 'trend', label: t('analysis.tabs.trend'), icon: '📈', count: null, show: !analysisData.isCustomAnalysis && analysisData.trendAnalysis },
                  { key: 'risk', label: t('analysis.tabs.risk'), icon: '⚖️', count: null, show: !analysisData.isCustomAnalysis && analysisData.riskOpportunityAnalysis },
                  { key: 'equipment', label: t('analysis.tabs.equipment'), icon: '🎥', count: analysisData.equipment?.length, show: !analysisData.isCustomAnalysis },
                  { key: 'vfx', label: t('analysis.tabs.vfx'), icon: '✨', count: analysisData.vfxRequirements?.length || analysisData.sfxRequirements?.length, show: !analysisData.isCustomAnalysis },
                  { key: 'production', label: t('analysis.tabs.virtualProduction'), icon: '🎮', count: null, show: !analysisData.isCustomAnalysis },
                  { key: 'evaluation', label: t('analysis.tabs.evaluation'), icon: '📝', count: null, show: !analysisData.isCustomAnalysis },
                  { key: 'audience', label: t('analysis.tabs.audience'), icon: '🎯', count: null, show: !analysisData.isCustomAnalysis },
                  { key: 'custom', label: t('analysis.tabs.customResults'), icon: '🎯', count: analysisData.customResults ? Object.keys(analysisData.customResults).length : 0, show: analysisData.isCustomAnalysis },
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
                  />
                )}
              </div>
            </>
          </div>
        )}
      </div>
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
                  <div>
                    <span className="text-xs text-cinema-text-dim uppercase tracking-wider">{t('scenes.characters')}</span>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {scene.characters && scene.characters.length > 0 ? (
                        scene.characters.map((char, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-1 bg-cinema-accent/20 rounded text-cinema-accent border border-cinema-accent/30"
                          >
                            {char}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-cinema-text-dim">{t('scenes.noCharactersSpecified')}</span>
                      )}
                    </div>
                  </div>
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
        {locations.map((location, index) => (
          <div key={index} className="p-5 bg-cinema-gray rounded-lg border border-cinema-gray-light hover:border-cinema-accent/30 transition-colors">
            <div className="flex items-start gap-3 mb-4">
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
        ))}
      </div>
    </div>
  );
}

function CharactersTab({ characters }) {
  const { t } = useTranslation();
  
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
            
            return (
              <div key={index} className="bg-cinema-black/30 rounded-xl border border-cinema-gray p-5 hover:border-cinema-accent/30 transition-colors">
                <div className="flex items-start gap-4 mb-4">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl ${
                    isMain ? 'bg-yellow-500/20 text-yellow-400' :
                    isSupporting ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {isMain ? '⭐' : isSupporting ? '👤' : '🎭'}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-cinema-text font-bold text-xl mb-1">
                      {character.name || `Karakter ${index + 1}`}
                    </h4>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                      isMain ? 'bg-yellow-500/20 text-yellow-400' :
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

  const getAnalysisIcon = (promptKey) => {
    if (promptKey.includes('character')) return '👥';
    if (promptKey.includes('plot') || promptKey.includes('story')) return '📖';
    if (promptKey.includes('theme')) return '🎭';
    if (promptKey.includes('dialogue')) return '💬';
    if (promptKey.includes('structure')) return '🏗️';
    if (promptKey.includes('production')) return '🎬';
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
        <h3 className="text-xl font-bold text-cinema-accent mb-2">
          📊 Çoklu Analiz Sonuçları
        </h3>
        <p className="text-cinema-text-dim text-sm mb-4">
          {availableResults.length} farklı analiz türü sonuçlandı
        </p>

        {/* Analysis Statistics Panel */}
        {analysisStats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-cinema-gray/30 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-cinema-accent">{analysisStats.total}</div>
              <div className="text-xs text-cinema-text-dim">Toplam Analiz</div>
            </div>
            <div className="bg-cinema-gray/30 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{analysisStats.completed}</div>
              <div className="text-xs text-cinema-text-dim">Başarılı</div>
            </div>
            <div className="bg-cinema-gray/30 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-cinema-accent">{analysisStats.successRate}%</div>
              <div className="text-xs text-cinema-text-dim">Başarı Oranı</div>
            </div>
            <div className="bg-cinema-gray/30 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">{Math.round(analysisStats.totalWords / 1000)}K</div>
              <div className="text-xs text-cinema-text-dim">Kelime Sayısı</div>
            </div>
          </div>
        )}
      </div>

      {/* All Results Display - Enhanced Grid Layout */}
      <div className="space-y-4">
        {availableResults.map((promptKey) => {
          const resultData = customResults[promptKey];
          const promptName = resultData?.name || promptKey;
          const resultText = resultData?.result || resultData;
          const isExpanded = expandedResults[promptKey];

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
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-lg font-bold text-cinema-text">
                        {promptName}
                      </h4>
                      <span className={`text-sm ${getStatusColor(resultData)}`}>
                        {getStatusIcon(resultData)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-cinema-text-dim">
                      <span>
                        {typeof resultText === 'string' ? `${resultText.substring(0, 80)}...` : 'Analiz tamamlandı'}
                      </span>
                      {resultData.wordCount && (
                        <span className="text-cinema-accent">
                          {resultData.wordCount} kelime
                        </span>
                      )}
                      {resultData.timestamp && (
                        <span>
                          {new Date(resultData.timestamp).toLocaleTimeString('tr-TR', { 
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
                  {(resultData.timestamp || resultData.wordCount || resultData.type) && (
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
                    </div>
                  )}

                  {/* Analysis result content */}
                  <div className="bg-cinema-black rounded-lg p-4">
                    <div className="text-cinema-text whitespace-pre-wrap text-sm leading-relaxed">
                      {typeof resultText === 'string' ? resultText : JSON.stringify(resultText, null, 2)}
                    </div>
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
                  <span className={`font-bold px-2 py-1 rounded text-xs ${
                    metrics.risk === 'Yüksek' || metrics.risk === 'High' ? 'bg-red-500/20 text-red-400' :
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

function SavedAnalysesTab({ savedAnalyses, setSavedAnalyses, loadingSavedAnalyses, onLoadAnalysis, onDeleteAnalysis, onRefresh }) {
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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-cinema-text">Kaydedilmiş Analizler ({savedAnalyses.length})</h3>
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
                if (confirm(`⚠️ ${savedAnalyses.length} adet kaydedilmiş analiz tamamen silinecek. Emin misiniz?`)) {
                  try {
                    await analysisStorageService.clearAll();
                    setSavedAnalyses([]);
                    alert('✅ Tüm analizler başarıyla temizlendi!');
                  } catch (error) {
                    console.error('❌ Temizleme hatası:', error);
                    alert('❌ Temizleme sırasında hata oluştu: ' + error.message);
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
        {savedAnalyses.map((analysis) => (
          <div
            key={analysis.key}
            className="bg-cinema-gray rounded-lg p-4 border border-gray-700 hover:border-cinema-accent transition-colors"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-cinema-text mb-2">
                  📄 {analysis.fileName}
                </h4>
                <div className="text-sm text-cinema-text-dim space-y-1">
                  <div>
                    📅 {new Date(analysis.timestamp).toLocaleDateString('tr-TR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                  {analysis.metadata && (
                    <>
                      <div>📝 {analysis.metadata.wordCount?.toLocaleString('tr-TR') || 0} kelime</div>
                      <div>📏 {analysis.metadata.scriptLength?.toLocaleString('tr-TR') || 0} karakter</div>
                      <div>🔧 Versiyon: {analysis.metadata.version || '1.0'}</div>
                    </>
                  )}
                  {analysis.scriptMetadata && (
                    <>
                      <div>📂 Dosya Türü: {analysis.scriptMetadata.fileType === 'pdf' ? '📄 PDF' : '📝 Text'}</div>
                      {analysis.scriptMetadata.analysisProvider && (
                        <div>🤖 Provider: {analysis.scriptMetadata.analysisProvider}</div>
                      )}
                      {analysis.scriptMetadata.originalFileName !== analysis.fileName && (
                        <div>🏷️ Orijinal: {analysis.scriptMetadata.originalFileName}</div>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => onLoadAnalysis(analysis.key)}
                  className="bg-cinema-accent text-white px-4 py-2 rounded-lg hover:bg-opacity-80 transition-all text-sm"
                  title="Bu analizi yükle"
                >
                  📂 Yükle
                </button>
                <button
                  onClick={() => onDeleteAnalysis(analysis.key)}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-all text-sm"
                  title="Bu analizi sil"
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
