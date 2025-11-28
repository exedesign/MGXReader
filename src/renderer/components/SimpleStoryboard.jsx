import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useScriptStore } from '../store/scriptStore';
import { useAIStore } from '../store/aiStore';
import AIHandler, { AI_PROVIDERS } from '../utils/aiHandler';
import { analysisStorageService } from '../utils/analysisStorageService';

export default function SimpleStoryboard() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scenes, setScenes] = useState([]);
  const [storyboards, setStoryboards] = useState([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [editingIndex, setEditingIndex] = useState(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [hasStoredStoryboard, setHasStoredStoryboard] = useState(false);
  const [isLoadingStored, setIsLoadingStored] = useState(true);
  
  const { getCurrentScript, currentScriptId } = useScriptStore();
  const { geminiApiKey, getAIHandler, provider, geminiImageModel } = useAIStore();
  
  // Debug: Store'dan gelen image model değerini kontrol et
  console.log('🏪 Store geminiImageModel değeri:', geminiImageModel);
  const { t } = useTranslation();
  
  const currentScript = getCurrentScript();
  
  // Auto-load stored storyboard when script changes
  useEffect(() => {
    const loadStoredStoryboard = async () => {
      if (!currentScript) {
        setScenes([]);
        setStoryboards([]);
        setHasStoredStoryboard(false);
        setIsLoadingStored(false);
        return;
      }

      setIsLoadingStored(true);
      const scriptText = currentScript?.scriptText || currentScript?.cleanedText;
      const fileName = currentScript?.fileName || currentScript?.name || 'untitled';

      try {
        console.log('🔍 Loading storyboard for script:', fileName);
        
        // Priority 1: Check script store for existing storyboard and scenes
        if (currentScript?.simpleStoryboard?.length > 0 || currentScript?.storyboardScenes?.length > 0) {
          if (currentScript?.simpleStoryboard?.length > 0) {
            setStoryboards(currentScript.simpleStoryboard);
            setHasStoredStoryboard(true);
            console.log('📋 Loaded storyboard from script store:', currentScript.simpleStoryboard.length, 'items');
          }
          
          if (currentScript?.storyboardScenes?.length > 0) {
            setScenes(currentScript.storyboardScenes);
            console.log('📋 Loaded scenes from script store:', currentScript.storyboardScenes.length, 'scenes');
          }
          
          setIsLoadingStored(false);
          return;
        }

        // Priority 2: Check persistent storage with multiple keys
        if (scriptText && fileName) {
          const possibleKeys = [
            `storyboard_${fileName}`,
            `storyboard_${fileName.replace(/\.[^/.]+$/, "")}`, // without extension
            fileName,
            fileName.replace(/\.[^/.]+$/, "")
          ];
          
          for (const storyboardKey of possibleKeys) {
            try {
              const storedStoryboard = await analysisStorageService.loadAnalysisByKey(storyboardKey);
              
              if (storedStoryboard?.storyboardData || storedStoryboard?.analysisData) {
                const storyboardData = storedStoryboard.storyboardData || storedStoryboard.analysisData?.storyboardData;
                const scenesData = storedStoryboard.scenes || storedStoryboard.analysisData?.scenes;
                
                if (storyboardData?.length > 0) {
                  setStoryboards(storyboardData);
                  setHasStoredStoryboard(true);
                  console.log('🎬 Loaded storyboard from persistent storage with key:', storyboardKey);
                }
                
                if (scenesData?.length > 0) {
                  setScenes(scenesData);
                  console.log('🎬 Loaded scenes from persistent storage:', scenesData.length, 'scenes');
                }
                
                // Update script store with loaded data
                const { updateScript } = useScriptStore.getState();
                updateScript(currentScript.id, {
                  simpleStoryboard: storyboardData || [],
                  storyboardScenes: scenesData || [],
                  updatedAt: new Date().toISOString()
                });
                
                break; // Exit loop on successful load
              }
            } catch (keyError) {
              console.warn(`Failed to load with key ${storyboardKey}:`, keyError.message);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load stored storyboard:', error);
      } finally {
        setIsLoadingStored(false);
      }
    };

    loadStoredStoryboard();
  }, [currentScript?.id, currentScript?.fileName]); // Depend on script ID and filename
  
  // Analyze script and extract scenes
  const analyzeScript = async () => {
    const scriptText = currentScript?.scriptText || currentScript?.cleanedText;
    if (!scriptText || !geminiApiKey) {
      alert('Senaryo metni veya Google Gemini API key bulunamadı!');
      return;
    }

    // Check if storyboard already exists and warn user
    if (hasStoredStoryboard && storyboards.length > 0) {
      const shouldOverwrite = confirm(
        '🎬 Bu senaryo için storyboard zaten mevcut.\n\n' +
        'Yeni analiz yapmak mevcut storyboard\'u yeniden oluşturacak. Devam etmek istiyor musunuz?'
      );
      if (!shouldOverwrite) return;
    }
    
    // Çok uzun senaryolar için uyarı ver ve optimize et
    // API key kontrolü - kullanıcı dostu hata mesajı
    if (!geminiApiKey || geminiApiKey.trim() === '') {
      alert(
        '⚠️ Gemini API Key Bulunamadı\n\n' +
        'Lütfen önce Ayarlar > AI Sağlayıcıları bölümünden Gemini API key ekleyin.\n\n' +
        'API key almak için: https://aistudio.google.com/app/apikey'
      );
      return;
    }
    
    let optimizedText = scriptText;
    if (scriptText.length > 50000) {
      const confirmed = confirm(
        'Senaryo çok uzun (50.000+ karakter). Bu analiz uzun sürebilir.\n\n' +
        'Devam etmek istiyor musunuz? (İptal için "Cancel")'
      );
      if (!confirmed) return;
      
      // Sadece ilk 50.000 karakteri al
      optimizedText = scriptText.substring(0, 50000) + '\n\n[... senaryo devamı kesildi]';
    }
    
    setIsAnalyzing(true);
    
    try {
      const aiHandler = new AIHandler({
        provider: AI_PROVIDERS.GEMINI,
        geminiApiKey: geminiApiKey,
        model: 'gemini-3-pro-preview',
        temperature: 1.0
      });
      
      const analysisPrompt = `Bu senaryoyu analiz et ve storyboard için uygun sahneleri çıkar. Her sahne için şu bilgileri ver:

SENARYO:
${optimizedText}

Lütfen şu formatta cevap ver (JSON array):
[
  {
    "title": "Sahne başlığı",
    "location": "Mekan",
    "timeOfDay": "Zaman",
    "description": "Sahne açıklaması",
    "visualPrompt": "Bu sahne için storyboard görsel prompt'ı"
  }
]

Sadece ana sahneleri seç, çok detaya girme. En fazla 10-15 sahne çıkar.`;

      const result = await aiHandler.generateText(
        'Sen profesyonel bir senaryo analizcisisin. Senaryo metinlerini analiz edip sahnelere ayırırsın.',
        analysisPrompt,
        { temperature: 0.7, maxTokens: 4096 }
      );
      
      // Parse the JSON response
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const extractedScenes = JSON.parse(jsonMatch[0]);
        setScenes(extractedScenes);
        
        // Initialize storyboards array with empty entries
        setStoryboards(extractedScenes.map(() => ({
          imageUrl: null,
          prompt: '',
          isGenerating: false
        })));
        
        // Save scenes and initial storyboard structure to script store
        const { updateScript } = useScriptStore.getState();
        updateScript(currentScriptId, {
          storyboardScenes: extractedScenes,
          simpleStoryboard: extractedScenes.map(() => ({
            imageUrl: null,
            prompt: '',
            isGenerating: false
          })),
          updatedAt: new Date().toISOString()
        });
        
        // Save to persistent storage with scenes data
        const initialStoryboard = extractedScenes.map(() => ({
          imageUrl: null,
          prompt: '',
          isGenerating: false
        }));
        saveStoryboardToStorage(initialStoryboard, extractedScenes);
      }
      
    } catch (error) {
      console.error('Script analysis failed:', error);
      
      let errorMessage = error.message;
      if (error.message.includes('timeout') || error.code === 'ECONNABORTED') {
        errorMessage = 'Analiz süresi çok uzun sürdü. Daha kısa bir senaryo parçası deneyin veya internet bağlantınızı kontrol edin.';
      }
      
      alert(`Senaryo analizi başarısız: ${errorMessage}`);
    }
    
    setIsAnalyzing(false);
  };
  
  // Generate all storyboards
  const generateAllStoryboards = async () => {
    if (!scenes.length || !geminiApiKey) return;
    
    setIsGenerating(true);
    setProgress({ current: 0, total: scenes.length });
    
    const newStoryboards = [...storyboards];
    
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      
      try {
        setProgress({ current: i + 1, total: scenes.length });
        
        // Mark this storyboard as generating
        newStoryboards[i] = { ...newStoryboards[i], isGenerating: true };
        setStoryboards([...newStoryboards]);
        
        // Generate image
        const result = await generateImage(scene.visualPrompt);
        
        if (result.success) {
          newStoryboards[i] = {
            imageUrl: result.imageUrl,
            prompt: scene.visualPrompt,
            isGenerating: false
          };
        } else {
          newStoryboards[i] = {
            ...newStoryboards[i],
            isGenerating: false
          };
        }
        
        setStoryboards([...newStoryboards]);
        
        // Wait between generations
        if (i < scenes.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
      } catch (error) {
        console.error(`Scene ${i + 1} generation failed:`, error);
        newStoryboards[i] = { ...newStoryboards[i], isGenerating: false };
        setStoryboards([...newStoryboards]);
      }
    }
    
    // Save to script store with both scenes and storyboards
    const { updateScript } = useScriptStore.getState();
    updateScript(currentScriptId, {
      storyboardScenes: scenes, // Preserve scenes data
      simpleStoryboard: newStoryboards,
      updatedAt: new Date().toISOString()
    });
    
    // Also save to persistent storage
    saveStoryboardToStorage(newStoryboards, scenes);
    
    setIsGenerating(false);
    setProgress({ current: 0, total: 0 });
  };

  // Auto-save storyboard to persistent storage
  const saveStoryboardToStorage = async (storyboardData, scenesData = null) => {
    const scriptText = currentScript?.scriptText || currentScript?.cleanedText;
    const fileName = currentScript?.fileName || 'untitled';
    
    if (!scriptText || !fileName || !storyboardData?.length) return;

    try {
      const storyboardKey = `storyboard_${fileName}`;
      await analysisStorageService.saveAnalysis(
        scriptText,
        storyboardKey,
        { 
          storyboardData,
          scenes: scenesData || scenes // Include scenes data for complete restoration
        },
        {
          fileType: 'storyboard',
          provider: 'gemini',
          analysisType: 'storyboard',
          sceneCount: storyboardData.length,
          timestamp: new Date().toISOString()
        }
      );
      setHasStoredStoryboard(true);
      console.log('💾 Storyboard automatically saved to storage');
    } catch (error) {
      console.error('Failed to save storyboard:', error);
    }
  };
  
  // Generate single image
  const generateImage = async (prompt) => {
    if (!geminiApiKey || geminiApiKey.trim() === '') {
      alert(
        '⚠️ Gemini API Key Bulunamadı\n\n' +
        'Görsel oluşturmak için Ayarlar > AI Sağlayıcıları bölümünden Gemini API key ekleyin.\n\n' +
        'API key almak için: https://aistudio.google.com/app/apikey'
      );
      throw new Error('Gemini API key is required');
    }
    
    try {
      // Use configured AI handler from store (includes image model)
      const aiHandler = getAIHandler();
      
      // Set the API key but preserve imageModel configuration
      aiHandler.apiKey = geminiApiKey;
      
      // Ensure imageModel is set to the current store configuration
      if (provider === 'gemini' && geminiImageModel) {
        aiHandler.imageModel = geminiImageModel;
      }
      
      console.log('🎨 Storyboard Image Generation:', {
        provider: aiHandler.provider,
        configuredImageModel: geminiImageModel,
        handlerImageModel: aiHandler.imageModel,
        textModel: aiHandler.model,
        apiKeyPresent: !!geminiApiKey,
        finalImageModel: aiHandler.imageModel
      });
      
      const result = await aiHandler.generateImage(prompt, { 
        size: '1024x1024'
        // imageModel already set in handler configuration
      });
      return result;
      
    } catch (error) {
      console.error('Image generation failed:', error);
      throw error;
    }
  };
  
  // Regenerate specific storyboard
  const regenerateStoryboard = async (index, customPrompt = null) => {
    if (!scenes[index] || !geminiApiKey) return;
    
    const newStoryboards = [...storyboards];
    newStoryboards[index] = { ...newStoryboards[index], isGenerating: true };
    setStoryboards(newStoryboards);
    
    try {
      const prompt = customPrompt || editPrompt || scenes[index].visualPrompt;
      const result = await generateImage(prompt);
      
      if (result.success) {
        newStoryboards[index] = {
          imageUrl: result.imageUrl,
          prompt: prompt,
          isGenerating: false
        };
      } else {
        newStoryboards[index] = { ...newStoryboards[index], isGenerating: false };
        alert(`Görsel üretimi başarısız: ${result.error}`);
      }
      
    } catch (error) {
      console.error('Regeneration failed:', error);
      newStoryboards[index] = { ...newStoryboards[index], isGenerating: false };
      alert(`Hata: ${error.message}`);
    }
    
    setStoryboards(newStoryboards);
    
    // Save to script
    const { updateScript } = useScriptStore.getState();
    updateScript(currentScriptId, {
      simpleStoryboard: newStoryboards,
      updatedAt: new Date().toISOString()
    });
    
    // Clear editing state
    setEditingIndex(null);
    setEditPrompt('');
  };
  
  // Check if Google API is configured
  if (!geminiApiKey) {
    return (
      <div className="h-full flex items-center justify-center bg-cinema-dark">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">🎬</div>
          <h3 className="text-xl font-bold text-cinema-text mb-2">Google Gemini API Gerekli</h3>
          <p className="text-cinema-text-dim mb-4">
            Storyboard üretimi için Google Gemini API key'inizi yapılandırın.
          </p>
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('openUnifiedSettings', {
                detail: { activeTab: 'ai' }
              }));
            }}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
          >
            AI Ayarlarını Aç
          </button>
        </div>
      </div>
    );
  }

  // Show message if no script is loaded  
  if (!currentScript) {
    return (
      <div className="h-full flex items-center justify-center bg-cinema-dark">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-xl font-bold text-cinema-text mb-2">Senaryo Seçilmedi</h3>
          <p className="text-cinema-text-dim mb-4">
            Sol panelden bir senaryo seçin.
          </p>
        </div>
      </div>
    );
  }  return (
    <div className="h-full flex flex-col bg-cinema-dark">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-cinema-gray">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🎬</div>
            <h2 className="text-2xl font-bold text-cinema-text">Simple Storyboard</h2>
            <span className="bg-green-600 text-white text-sm px-3 py-1 rounded-full">
              Google Gemini
            </span>
            {isLoadingStored && (
              <span className="text-xs text-cinema-text-dim flex items-center gap-1">
                <span className="animate-pulse">🔍</span> Loading stored...
              </span>
            )}
            {hasStoredStoryboard && !isLoadingStored && (
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                💾 Auto-saved
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {!scenes.length ? (
              <button
                onClick={analyzeScript}
                disabled={isAnalyzing}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white rounded-lg font-medium flex items-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    <span>Analiz Ediliyor...</span>
                  </>
                ) : (
                  <>
                    <span>🔍</span>
                    <span>Senaryoyu Analiz Et</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={generateAllStoryboards}
                disabled={isGenerating}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white rounded-lg font-medium flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    <span>Üretiliyor {progress.current}/{progress.total}</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>Tüm Storyboard'ları Üret</span>
                  </>
                )}
              </button>
            )}
            
            {scenes.length > 0 && (
              <button
                onClick={() => {
                  setScenes([]);
                  setStoryboards([]);
                }}
                className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
                title="Temizle"
              >
                🗑️
              </button>
            )}
          </div>
        </div>
        
        {scenes.length > 0 && (
          <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-green-300">✅ Analiz Tamamlandı</h4>
                <p className="text-sm text-green-400">{scenes.length} sahne bulundu ve storyboard için hazır</p>
              </div>
              <div className="text-green-300">
                <span className="text-2xl font-bold">{scenes.length}</span>
                <span className="text-sm ml-1">sahne</span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {scenes.length === 0 ? (
          <div className="text-center text-cinema-text-dim py-12">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-xl font-bold mb-2">Senaryo Analizi</h3>
            <p>Senaryonuzu analiz ederek storyboard sahnelerini çıkaralım</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {scenes.map((scene, index) => {
              const storyboard = storyboards[index];
              return (
                <div key={index} className="bg-cinema-gray rounded-xl border border-cinema-gray-light overflow-hidden">
                  {/* Scene Header */}
                  <div className="p-4 border-b border-cinema-gray-light">
                    <h3 className="font-bold text-cinema-text mb-2">{scene.title}</h3>
                    <div className="space-y-1 text-sm text-cinema-text-dim">
                      <div>📍 {scene.location}</div>
                      <div>🕐 {scene.timeOfDay}</div>
                    </div>
                  </div>
                  
                  {/* Image Area */}
                  <div className="aspect-video bg-cinema-black relative">
                    {storyboard?.isGenerating ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin w-12 h-12 border-4 border-cinema-accent border-t-transparent rounded-full mx-auto mb-4"></div>
                          <p className="text-cinema-accent font-medium">Üretiliyor...</p>
                        </div>
                      </div>
                    ) : storyboard?.imageUrl ? (
                      <img
                        src={storyboard.imageUrl}
                        alt={scene.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-cinema-text-dim">
                        <div className="text-center">
                          <div className="text-4xl mb-2">🖼️</div>
                          <p>Görsel henüz üretilmedi</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Scene Description */}
                  <div className="p-4 border-b border-cinema-gray-light">
                    <p className="text-sm text-cinema-text-dim">{scene.description}</p>
                  </div>
                  
                  {/* Prompt Editor */}
                  <div className="p-4 space-y-3">
                    <label className="block text-sm font-medium text-cinema-text">
                      Görsel Prompt:
                    </label>
                    {editingIndex === index ? (
                      <textarea
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        placeholder="Özel prompt girin..."
                        className="w-full h-20 px-3 py-2 bg-cinema-black border border-cinema-gray rounded text-cinema-text text-sm resize-none focus:ring-2 focus:ring-cinema-accent focus:outline-none"
                      />
                    ) : (
                      <div 
                        onClick={() => {
                          setEditingIndex(index);
                          setEditPrompt(storyboard?.prompt || scene.visualPrompt);
                        }}
                        className="w-full px-3 py-2 bg-cinema-black border border-cinema-gray rounded text-cinema-text text-sm cursor-text hover:border-cinema-accent/50 transition-colors"
                      >
                        {storyboard?.prompt || scene.visualPrompt}
                      </div>
                    )}
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      {editingIndex === index ? (
                        <>
                          <button
                            onClick={() => regenerateStoryboard(index, editPrompt)}
                            disabled={storyboard?.isGenerating}
                            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white rounded font-medium flex items-center justify-center gap-2"
                          >
                            <span>✨</span>
                            <span>Üret</span>
                          </button>
                          <button
                            onClick={() => {
                              setEditingIndex(null);
                              setEditPrompt('');
                            }}
                            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded font-medium"
                          >
                            ❌
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => regenerateStoryboard(index)}
                            disabled={storyboard?.isGenerating}
                            className="flex-1 px-4 py-2 bg-cinema-accent hover:bg-cinema-accent/80 disabled:bg-gray-500 text-white rounded font-medium flex items-center justify-center gap-2"
                          >
                            <span>🔄</span>
                            <span>Yeniden Üret</span>
                          </button>
                          <button
                            onClick={() => {
                              setEditingIndex(index);
                              setEditPrompt(storyboard?.prompt || scene.visualPrompt);
                            }}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-medium"
                            title="Prompt'ı Düzenle"
                          >
                            ✏️
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}