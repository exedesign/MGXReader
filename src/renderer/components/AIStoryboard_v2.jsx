import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useScriptStore } from '../store/scriptStore';
import { useAIStore } from '../store/aiStore';
import { usePromptStore } from '../store/promptStore';

export default function AIStoryboard() {
  // Core states
  const [storyboardStyle, setStoryboardStyle] = useState('cinematic');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [generatedImages, setGeneratedImages] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  
  // Storyboard settings
  const [showStoryboardSettings, setShowStoryboardSettings] = useState(false);
  const [storyboardPrompt, setStoryboardPrompt] = useState('');
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });
  
  // Prompt management
  const [selectedPromptTemplate, setSelectedPromptTemplate] = useState('main_storyboard');
  const [showPromptManager, setShowPromptManager] = useState(false);
  const [customScenePrompt, setCustomScenePrompt] = useState('');
  const [editingPromptId, setEditingPromptId] = useState(null);
  const [showPromptModal, setShowPromptModal] = useState(false);
  
  // Scene management
  const [sceneInputMode, setSceneInputMode] = useState('manual'); // 'manual' or 'analysis'
  const [manualScenes, setManualScenes] = useState([]);
  const [newSceneText, setNewSceneText] = useState('');
  const [newSceneTitle, setNewSceneTitle] = useState('');
  
  // Stores
  const { getCurrentScript, updateScript, currentScriptId } = useScriptStore();
  const { generateImage, isGeneratingImage, addGeneratingScene, removeGeneratingScene, isConfigured } = useAIStore();
  const { getPrompt, getAllPrompts, saveCustomPrompt } = usePromptStore();
  const { t } = useTranslation();
  
  const currentScript = getCurrentScript();
  const analysisScenes = currentScript?.structure?.scenes || [];
  
  // Combined scenes (analysis + manual)
  const allScenes = sceneInputMode === 'analysis' 
    ? analysisScenes 
    : [...analysisScenes, ...manualScenes];

  // Load existing storyboard data
  useEffect(() => {
    const loadStoryboardData = async () => {
      if (!currentScript) {
        setGeneratedImages({});
        setManualScenes([]);
        return;
      }

      console.log('🔍 Loading storyboard data for script:', currentScript.id);

      try {
        // Priority 1: Load from current script store
        if (currentScript?.storyboard && Object.keys(currentScript.storyboard).length > 0) {
          setGeneratedImages(currentScript.storyboard);
          console.log('📋 Loaded storyboard images from script store');
        }

        // Priority 2: Load manual scenes from localStorage
        const stored = localStorage.getItem(`manual-scenes-${currentScriptId}`);
        if (stored) {
          try {
            const parsedScenes = JSON.parse(stored);
            setManualScenes(parsedScenes);
            console.log('📋 Loaded manual scenes from localStorage:', parsedScenes.length);
          } catch (e) {
            console.warn('Failed to parse manual scenes:', e);
            setManualScenes([]);
          }
        }

        // Priority 3: Try to load storyboard from persistent storage
        const scriptText = currentScript?.scriptText || currentScript?.cleanedText;
        const fileName = currentScript?.fileName || currentScript?.name;
        
        if (scriptText && fileName && (!currentScript?.storyboard || Object.keys(currentScript.storyboard).length === 0)) {
          const storyboardKey = `storyboard_v2_${fileName}`;
          const storedStoryboard = await analysisStorageService.loadAnalysisByKey(storyboardKey);
          
          if (storedStoryboard?.storyboardData) {
            const storyboardImages = storedStoryboard.storyboardData.generatedImages || {};
            setGeneratedImages(storyboardImages);
            console.log('💾 Loaded storyboard from persistent storage');
            
            // Update script store with loaded data
            const { updateScript } = useScriptStore.getState();
            updateScript(currentScript.id, {
              storyboard: storyboardImages,
              updatedAt: new Date().toISOString()
            });
          }
        }

        // Load storyboard prompt
        const mainPrompt = getPrompt('storyboard', 'main_storyboard');
        if (mainPrompt) {
          setStoryboardPrompt(mainPrompt.user || '');
          console.log('📋 Loaded storyboard prompt');
        }

      } catch (error) {
        console.error('Failed to load storyboard data:', error);
      }
    };

    loadStoryboardData();
  }, [currentScript?.id, currentScriptId, getPrompt]); // Track script and ID changes

  // Save manual scenes to localStorage
  const saveManualScenes = (scenes) => {
    setManualScenes(scenes);
    localStorage.setItem(`manual-scenes-${currentScriptId}`, JSON.stringify(scenes));
  };

  // Add manual scene
  const addManualScene = () => {
    if (!newSceneText.trim()) return;
    
    const newScene = {
      id: `manual_${Date.now()}`,
      title: newSceneTitle.trim() || `Sahne ${allScenes.length + 1}`,
      content: newSceneText.trim(),
      location: extractLocationFromText(newSceneText),
      timeOfDay: extractTimeFromText(newSceneText),
      characters: extractCharactersFromText(newSceneText),
      intExt: extractIntExtFromText(newSceneText),
      isManual: true
    };
    
    saveManualScenes([...manualScenes, newScene]);
    setNewSceneText('');
    setNewSceneTitle('');
  };

  // Simple text extraction functions
  const extractLocationFromText = (text) => {
    const locationMatch = text.match(/(?:INT\.|EXT\.)\s*([^-\n]+)/i);
    return locationMatch ? locationMatch[1].trim() : 'Bilinmeyen Mekan';
  };

  const extractTimeFromText = (text) => {
    const timeMatch = text.match(/(?:DAY|NIGHT|GÜNDÜZ|GECE|SABAH|AKŞAM)/i);
    return timeMatch ? timeMatch[0] : 'Gündüz';
  };

  const extractIntExtFromText = (text) => {
    const intExtMatch = text.match(/^(INT\.|EXT\.)/i);
    return intExtMatch ? intExtMatch[1].replace('.', '') : 'INT';
  };

  const extractCharactersFromText = (text) => {
    // Simple character extraction - names in CAPS
    const lines = text.split('\n');
    const characters = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^[A-Z][A-Z\s]+$/.test(trimmed) && trimmed.length < 30) {
        characters.push(trimmed);
      }
    }
    return characters.slice(0, 3); // Max 3 characters
  };

  // Generate storyboard for all scenes
  const generateAllStoryboards = async () => {
    if (!isConfigured() || allScenes.length === 0) return;
    
    setIsGeneratingAll(true);
    setGenerationProgress({ current: 0, total: allScenes.length });
    
    try {
      for (let i = 0; i < allScenes.length; i++) {
        const scene = allScenes[i];
        setGenerationProgress({ current: i + 1, total: allScenes.length });
        
        await generateStoryboard(scene, true); // silent mode
        
        // Wait a bit between generations to avoid rate limits
        if (i < allScenes.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } catch (error) {
      console.error('Error generating all storyboards:', error);
      alert(`Toplu storyboard üretimi başarısız: ${error.message}`);
    }
    
    setIsGeneratingAll(false);
    setGenerationProgress({ current: 0, total: 0 });
  };

  // Generate storyboard using template prompts
  const generateStoryboard = async (scene, silent = false) => {
    if (!scene || !isConfigured()) return;

    const sceneId = scene.id || `scene_${Date.now()}`;
    addGeneratingScene(sceneId);

    try {
      // Use main storyboard prompt for consistency
      let finalPrompt;
      
      if (customScenePrompt) {
        // Use custom prompt if editing
        finalPrompt = customScenePrompt;
      } else {
        // Use main storyboard prompt
        finalPrompt = storyboardPrompt || getPrompt('storyboard', 'main_storyboard')?.user || '';
        if (!finalPrompt) {
          throw new Error('Ana storyboard prompt bulunamadı');
        }
      }
      
      // Replace template variables
      const replacements = {
        '{{scene_title}}': scene.title || 'Sahne',
        '{{location}}': scene.location || 'Bilinmeyen Mekan',
        '{{time_of_day}}': scene.timeOfDay || 'Gündüz',
        '{{int_ext}}': scene.intExt || 'INT',
        '{{characters}}': Array.isArray(scene.characters) ? scene.characters.join(', ') : 'Karakterler',
        '{{scene_text}}': scene.content || scene.description || 'Sahne içeriği',
        '{{style}}': storyboardStyle,
        '{{aspect_ratio}}': aspectRatio,
        '{{camera_angle}}': 'medium shot',
        '{{language}}': 'Turkish'
      };

      for (const [key, value] of Object.entries(replacements)) {
        finalPrompt = finalPrompt.replace(new RegExp(key, 'g'), value);
      }

      // Add style-specific enhancements
      finalPrompt = enhancePromptWithStyle(finalPrompt, storyboardStyle, aspectRatio);

      console.log('Generating storyboard with prompt:', finalPrompt);

      // Generate image
      const result = await generateImage(finalPrompt, {
        size: aspectRatio === '16:9' ? '1792x1024' : 
              aspectRatio === '4:3' ? '1152x864' :
              aspectRatio === '1:1' ? '1024x1024' :
              aspectRatio === '9:16' ? '1024x1792' : '1024x1024'
      });

      if (result.success && result.imageUrl) {
        const newImages = {
          ...generatedImages,
          [sceneId]: {
            url: result.imageUrl,
            prompt: finalPrompt,
            templateUsed: selectedPromptTemplate,
            style: storyboardStyle,
            aspectRatio: aspectRatio,
            generatedAt: new Date().toISOString(),
            revisedPrompt: result.revisedPrompt,
            sceneInfo: {
              title: scene.title,
              location: scene.location,
              timeOfDay: scene.timeOfDay,
              intExt: scene.intExt,
              isManual: scene.isManual
            }
          }
        };
        
        setGeneratedImages(newImages);
        
        // Save to script
        updateScript(currentScriptId, {
          storyboard: newImages,
          updatedAt: new Date().toISOString()
        });
        
      } else {
        console.error('Failed to generate image:', result.error);
        if (!silent) {
          alert(`Storyboard üretimi başarısız: ${result.error}`);
        }
      }
      
    } catch (error) {
      console.error('Error generating storyboard:', error);
      if (!silent) {
        alert(`Hata: ${error.message}`);
      }
    }
    
    removeGeneratingScene(sceneId);
  };

  // Enhance prompt with style-specific additions
  const enhancePromptWithStyle = (prompt, style, aspectRatio) => {
    const styleEnhancements = {
      cinematic: ', cinematic still, film photography, dramatic lighting, professional movie scene, high quality, detailed composition',
      sketch: ', pencil sketch, storyboard drawing, black and white, hand-drawn illustration, concept art',
      comic: ', comic book style, graphic novel illustration, bold lines, dynamic composition, vibrant colors',
      realistic: ', photorealistic, high detail, natural lighting, professional photography, film set'
    };

    const aspectEnhancements = {
      '16:9': ', widescreen format, cinematic framing',
      '4:3': ', classic TV format, traditional framing',
      '1:1': ', square format, centered composition',
      '9:16': ', vertical format, mobile-friendly'
    };

    return prompt + 
           (styleEnhancements[style] || '') + 
           (aspectEnhancements[aspectRatio] || '') + 
           ', masterpiece quality, professional composition';
  };

  // Open custom prompt editor
  const openPromptEditor = (scene) => {
    const sceneId = scene.id || `scene_${Date.now()}`;
    setEditingPromptId(sceneId);
    
    // Load existing prompt or generate from template
    const existingImage = generatedImages[sceneId];
    if (existingImage?.prompt) {
      setCustomScenePrompt(existingImage.prompt);
    } else {
      const template = getPrompt('storyboard', selectedPromptTemplate);
      setCustomScenePrompt(template?.user || '');
    }
    
    setShowPromptModal(true);
  };

  // Generate with custom prompt
  const generateWithCustomPrompt = async () => {
    if (!editingPromptId || !customScenePrompt.trim()) return;
    
    const scene = allScenes.find(s => s.id === editingPromptId);
    if (!scene) return;

    setShowPromptModal(false);
    await generateStoryboard(scene);
    setEditingPromptId(null);
    setCustomScenePrompt('');
  };

  // Clear scene storyboard
  const clearSceneStoryboard = (sceneId) => {
    const newImages = { ...generatedImages };
    delete newImages[sceneId];
    setGeneratedImages(newImages);
    
    updateScript(currentScriptId, {
      storyboard: newImages,
      updatedAt: new Date().toISOString()
    });
  };

  // Remove manual scene
  const removeManualScene = (sceneId) => {
    const filtered = manualScenes.filter(s => s.id !== sceneId);
    saveManualScenes(filtered);
    
    // Also remove its storyboard if exists
    clearSceneStoryboard(sceneId);
  };

  // Get all prompt templates
  const promptTemplates = getAllPrompts('storyboard');

  if (!isConfigured()) {
    return (
      <div className="p-8 text-center">
        <div className="text-cinema-text-dim mb-4">
          <svg className="w-16 h-16 mx-auto mb-4 text-cinema-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          </svg>
          <p className="text-lg mb-2">{t('storyboard.noProvider', 'AI Sağlayıcı Yapılandırılmamış')}</p>
          <p className="text-sm">{t('storyboard.configureFirst', 'AI Storyboard üretmek için önce AI ayarlarından bir sağlayıcı yapılandırın.')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-cinema-dark">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-cinema-gray bg-cinema-black/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-cinema-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <h2 className="text-lg font-bold text-cinema-text">
              🎨 AI Storyboard Studio
            </h2>
            <span className="text-xs bg-cinema-accent text-white px-2 py-1 rounded">
              {allScenes.length} sahne
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Generate All Storyboards Button */}
            <button
              onClick={generateAllStoryboards}
              disabled={isGeneratingAll || allScenes.length === 0 || !isConfigured()}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white rounded font-medium transition-colors flex items-center gap-2"
              title="Tüm Sahneler İçin Storyboard Üret"
            >
              {isGeneratingAll ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>{generationProgress.current}/{generationProgress.total}</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Tüm Storyboard</span>
                </>
              )}
            </button>
            
            {/* Storyboard Settings */}
            <button
              onClick={() => setShowStoryboardSettings(!showStoryboardSettings)}
              className="p-2 bg-blue-600 hover:bg-blue-700 rounded text-white transition-colors"
              title="Storyboard Ayarları"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            
            <button
              onClick={() => setShowPromptManager(!showPromptManager)}
              className="p-2 bg-purple-600 hover:bg-purple-700 rounded text-white transition-colors"
              title="Prompt Yönetimi"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 bg-cinema-gray hover:bg-cinema-gray-light rounded text-cinema-text transition-colors"
              title="Ayarlar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Storyboard Settings Panel */}
        {showStoryboardSettings && (
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-4">
            <h4 className="text-lg font-medium text-blue-300 mb-3">🎯 Storyboard Ayarları</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-blue-300 mb-2">Ana Storyboard Prompt</label>
                <textarea
                  value={storyboardPrompt}
                  onChange={(e) => setStoryboardPrompt(e.target.value)}
                  placeholder="Tüm sahneler için kullanılacak ana storyboard prompt'ını girin..."
                  className="w-full h-32 px-3 py-2 bg-cinema-black border border-cinema-gray rounded text-cinema-text placeholder-cinema-text-dim focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                />
                <div className="flex justify-between items-center mt-2 text-xs text-blue-300">
                  <div>Bu prompt tüm sahneler için tutarlılık sağlar</div>
                  <button
                    onClick={() => {
                      const mainPrompt = getPrompt('storyboard', 'main_storyboard');
                      if (mainPrompt) {
                        setStoryboardPrompt(mainPrompt.user || '');
                      }
                    }}
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    🔄 Varsayılana Dön
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-blue-300 mb-2">AI Sağlayıcı Önceliği</label>
                  <div className="bg-cinema-black/50 px-3 py-2 rounded border border-cinema-gray text-cinema-text text-sm">
                    🟢 Google Gemini → OpenAI
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-blue-300 mb-2">Toplu Üretim</label>
                  <div className="bg-cinema-black/50 px-3 py-2 rounded border border-cinema-gray text-cinema-text text-sm">
                    🎬 {allScenes.length} sahne
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-blue-300 mb-2">Tutarlılık</label>
                  <div className="bg-cinema-black/50 px-3 py-2 rounded border border-cinema-gray text-cinema-text text-sm">
                    🎯 Ana prompt'la
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Prompt Manager */}
        {showPromptManager && (
          <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4 mb-4">
            <h4 className="text-lg font-medium text-purple-300 mb-3">📝 Prompt Template Seçimi</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(promptTemplates).map(([key, template]) => (
                <button
                  key={key}
                  onClick={() => setSelectedPromptTemplate(key)}
                  className={`p-3 rounded-lg text-left transition-all ${
                    selectedPromptTemplate === key 
                      ? 'bg-purple-600 text-white ring-2 ring-purple-400' 
                      : 'bg-purple-800/30 text-purple-200 hover:bg-purple-700/40'
                  }`}
                >
                  <div className="font-medium text-sm">{template.name}</div>
                  <div className="text-xs opacity-80 mt-1">
                    {key.includes('professional') ? 'Genel amaçlı' :
                     key.includes('cinematic') ? 'Sinema kalitesi' :
                     key.includes('comic') ? 'Çizgi roman' :
                     key.includes('sketch') ? 'Çizim/Eskiz' :
                     key.includes('realistic') ? 'Gerçekçi' :
                     key.includes('concept') ? 'Konsept sanat' :
                     key.includes('animated') ? 'Animasyon' :
                     key.includes('noir') ? 'Film noir' :
                     key.includes('fantasy') ? 'Fantasy' :
                     key.includes('horror') ? 'Korku' :
                     key.includes('action') ? 'Aksiyon' : 'Özel stil'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-cinema-gray p-4 rounded-lg border border-cinema-gray-light mb-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Style Selection */}
              <div>
                <label className="block text-sm font-medium text-cinema-text mb-2">Stil</label>
                <select
                  value={storyboardStyle}
                  onChange={(e) => setStoryboardStyle(e.target.value)}
                  className="w-full px-3 py-2 bg-cinema-black border border-cinema-gray rounded text-cinema-text focus:ring-2 focus:ring-cinema-accent focus:outline-none"
                >
                  <option value="cinematic">🎬 Sinematik</option>
                  <option value="sketch">✏️ Çizim/Eskiz</option>
                  <option value="comic">💥 Çizgi Roman</option>
                  <option value="realistic">📷 Gerçekçi</option>
                </select>
              </div>

              {/* Aspect Ratio */}
              <div>
                <label className="block text-sm font-medium text-cinema-text mb-2">En-Boy Oranı</label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="w-full px-3 py-2 bg-cinema-black border border-cinema-gray rounded text-cinema-text focus:ring-2 focus:ring-cinema-accent focus:outline-none"
                >
                  <option value="16:9">🖥️ 16:9 (Geniş)</option>
                  <option value="4:3">📺 4:3 (Klasik)</option>
                  <option value="1:1">📷 1:1 (Kare)</option>
                  <option value="9:16">📱 9:16 (Dikey)</option>
                </select>
              </div>

              {/* Scene Mode */}
              <div>
                <label className="block text-sm font-medium text-cinema-text mb-2">Sahne Modu</label>
                <select
                  value={sceneInputMode}
                  onChange={(e) => setSceneInputMode(e.target.value)}
                  className="w-full px-3 py-2 bg-cinema-black border border-cinema-gray rounded text-cinema-text focus:ring-2 focus:ring-cinema-accent focus:outline-none"
                >
                  <option value="manual">✏️ Manuel Sahne Girişi</option>
                  <option value="analysis">🤖 Analiz Edilen Sahneler</option>
                </select>
              </div>

              {/* AI Provider */}
              <div>
                <label className="block text-sm font-medium text-cinema-text mb-2">AI Sağlayıcı</label>
                <div className="px-3 py-2 bg-cinema-black border border-cinema-gray rounded text-cinema-text-dim text-sm">
                  ✅ Google Gemini / OpenAI DALL-E
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Manual Scene Input */}
        {sceneInputMode === 'manual' && (
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-4">
            <h4 className="text-lg font-medium text-blue-300 mb-3">➕ Yeni Sahne Ekle</h4>
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Sahne Başlığı (opsiyonel)"
                  value={newSceneTitle}
                  onChange={(e) => setNewSceneTitle(e.target.value)}
                  className="px-3 py-2 bg-cinema-black border border-cinema-gray rounded text-cinema-text placeholder-cinema-text-dim focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  onClick={addManualScene}
                  disabled={!newSceneText.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white rounded font-medium transition-colors"
                >
                  ➕ Sahne Ekle
                </button>
              </div>
              <textarea
                placeholder="Sahne metni girin... (Örn: INT. BEDROOM - NIGHT&#10;&#10;JANE oturur masanın başında. Bilgisayar ekranına bakar.&#10;&#10;JANE&#10;Bu çok garip...)"
                value={newSceneText}
                onChange={(e) => setNewSceneText(e.target.value)}
                className="w-full h-24 px-3 py-2 bg-cinema-black border border-cinema-gray rounded text-cinema-text placeholder-cinema-text-dim focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
              />
            </div>
          </div>
        )}

        {/* Info Panel */}
        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 text-green-300 text-sm">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">AI Storyboard Studio</span>
          </div>
          <p>📝 {sceneInputMode === 'manual' ? 'Manuel sahne girişi aktif. Kendi sahne metinlerinizi ekleyip görselleştirin.' : 'Analiz edilmiş sahneler kullanılıyor.'}</p>
          <p>🎨 Template: <span className="font-medium">{promptTemplates[selectedPromptTemplate]?.name || 'Bilinmeyen'}</span></p>
          <p>🖼️ Format: {storyboardStyle} • {aspectRatio} • Google Gemini / OpenAI DALL-E</p>
        </div>
      </div>

      {/* Scenes Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {allScenes.map((scene, index) => {
            const sceneId = scene.id || `scene_${index}`;
            const hasStoryboard = generatedImages[sceneId];
            const isGenerating = isGeneratingImage; // Simplified for now

            return (
              <div
                key={sceneId}
                className="bg-cinema-gray rounded-lg border border-cinema-gray-light hover:border-cinema-accent/50 transition-all duration-200"
              >
                {/* Scene Header */}
                <div className="p-3 border-b border-cinema-gray-light">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-cinema-text text-sm truncate">
                      {scene.title || `Sahne ${index + 1}`}
                      {scene.isManual && <span className="ml-1 text-xs text-blue-400">✏️</span>}
                    </h3>
                    {scene.isManual && (
                      <button
                        onClick={() => removeManualScene(sceneId)}
                        className="p-1 text-red-400 hover:text-red-300 rounded"
                        title="Manuel sahneyi sil"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                  
                  {/* Scene Info */}
                  <div className="text-xs text-cinema-text-dim space-y-1">
                    {scene.location && (
                      <div>📍 {scene.location}</div>
                    )}
                    {(scene.intExt || scene.timeOfDay) && (
                      <div>
                        {scene.intExt && `${scene.intExt === 'INT' ? '🏠' : '🌳'} ${scene.intExt}`}
                        {scene.intExt && scene.timeOfDay && ' • '}
                        {scene.timeOfDay && `${scene.timeOfDay.includes('DAY') || scene.timeOfDay.includes('GÜN') ? '☀️' : '🌙'} ${scene.timeOfDay}`}
                      </div>
                    )}
                    {scene.characters && scene.characters.length > 0 && (
                      <div>👥 {scene.characters.slice(0, 3).join(', ')}</div>
                    )}
                  </div>
                </div>

                {/* Storyboard Area */}
                <div className="p-3">
                  {isGenerating ? (
                    <div className="aspect-video bg-cinema-black rounded border border-dashed border-cinema-accent/50 flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin w-8 h-8 border-3 border-cinema-accent border-t-transparent rounded-full mx-auto mb-2"></div>
                        <p className="text-xs text-cinema-accent">Üretiliyor...</p>
                      </div>
                    </div>
                  ) : hasStoryboard ? (
                    <div className="relative group">
                      <img
                        src={hasStoryboard.url}
                        alt={`Storyboard for ${scene.title}`}
                        className="w-full aspect-video object-cover rounded border border-cinema-gray-light"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center gap-2">
                        <button
                          onClick={() => generateStoryboard(scene)}
                          disabled={isGeneratingImage}
                          className="p-2 bg-cinema-accent hover:bg-cinema-accent/80 text-white rounded"
                          title="Yeniden üret"
                        >
                          🔄
                        </button>
                        <button
                          onClick={() => openPromptEditor(scene)}
                          disabled={isGeneratingImage}
                          className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded"
                          title="Prompt düzenle"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => clearSceneStoryboard(sceneId)}
                          className="p-2 bg-red-600 hover:bg-red-700 text-white rounded"
                          title="Sil"
                        >
                          🗑️
                        </button>
                        <a
                          href={hasStoryboard.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
                          title="Büyük görüntüle"
                        >
                          🔍
                        </a>
                      </div>
                      
                      {/* Generation Info */}
                      <div className="mt-2 text-xs text-cinema-text-dim space-y-1">
                        <div>🎨 {hasStoryboard.style} • {hasStoryboard.aspectRatio}</div>
                        <div>📅 {new Date(hasStoryboard.generatedAt).toLocaleDateString('tr')}</div>
                        {hasStoryboard.templateUsed && (
                          <div className="text-purple-400">📝 {promptTemplates[hasStoryboard.templateUsed]?.name || hasStoryboard.templateUsed}</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-video bg-cinema-black/50 rounded border border-dashed border-cinema-gray flex items-center justify-center">
                      <button
                        onClick={() => generateStoryboard(scene)}
                        disabled={isGeneratingImage}
                        className="flex flex-col items-center gap-2 p-4 text-cinema-text-dim hover:text-cinema-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <span className="text-xs font-medium">🎨 Storyboard Üret</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {allScenes.length === 0 && (
          <div className="text-center text-cinema-text-dim py-8">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-lg mb-2">Görselleştirilecek sahne yok</p>
            <p className="text-sm">
              {sceneInputMode === 'manual' 
                ? 'Yukarıdan yeni sahne ekleyin veya analiz moduna geçin.'
                : 'Senaryo analiz edin veya manuel sahne girişi moduna geçin.'}
            </p>
          </div>
        )}
      </div>
      
      {/* Prompt Editing Modal */}
      {showPromptModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-cinema-dark rounded-xl border border-cinema-gray w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-cinema-gray">
              <div>
                <h3 className="text-xl font-bold text-cinema-text">✏️ Prompt Özelleştirme</h3>
                <p className="text-cinema-text-dim text-sm mt-1">
                  Görseli istediğiniz şekilde oluşturmak için prompt'ı düzenleyin
                </p>
              </div>
              <button
                onClick={() => {
                  setShowPromptModal(false);
                  setEditingPromptId(null);
                  setCustomScenePrompt('');
                }}
                className="p-2 hover:bg-cinema-gray rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-cinema-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {/* Template Info */}
                <div className="bg-cinema-black/30 rounded-lg p-4">
                  <h4 className="text-lg font-medium text-cinema-text mb-2">
                    📝 Kullanılan Template: {promptTemplates[selectedPromptTemplate]?.name}
                  </h4>
                  <div className="text-sm text-cinema-text-dim">
                    Seçili template otomatik değişkenlerle doldurulur. İsterseniz tamamen özelleştirebilirsiniz.
                  </div>
                </div>
                
                {/* Prompt Editor */}
                <div>
                  <label className="block text-sm font-medium text-cinema-text mb-2">
                    Görsel Üretim Prompt'ı
                  </label>
                  <textarea
                    value={customScenePrompt}
                    onChange={(e) => setCustomScenePrompt(e.target.value)}
                    placeholder="Özel prompt girin..."
                    className="w-full h-40 px-3 py-2 bg-cinema-black border border-cinema-gray rounded-lg text-cinema-text placeholder-cinema-text-dim focus:ring-2 focus:ring-cinema-accent focus:outline-none resize-none"
                  />
                  <div className="flex justify-between items-center mt-2 text-xs text-cinema-text-dim">
                    <div>Karakter sayısı: {customScenePrompt.length}</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const template = getPrompt('storyboard', selectedPromptTemplate);
                          setCustomScenePrompt(template?.user || '');
                        }}
                        className="text-cinema-accent hover:text-cinema-accent/80 transition-colors"
                      >
                        🔄 Template'e Dön
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Tips */}
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                  <h5 className="text-blue-400 font-medium mb-2">💡 Prompt İpuçları</h5>
                  <ul className="text-blue-300 text-sm space-y-1">
                    <li>• Camera açıları: "close-up", "wide shot", "medium shot", "bird's eye view"</li>
                    <li>• Lighting: "dramatic lighting", "soft natural light", "golden hour", "moody shadows"</li> 
                    <li>• Style: "cinematic", "photorealistic", "comic book style", "hand-drawn"</li>
                    <li>• Mood: "tense", "romantic", "mysterious", "action-packed", "serene"</li>
                    <li>• Quality: "masterpiece", "high detail", "professional composition"</li>
                  </ul>
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-cinema-gray">
              <button
                onClick={() => {
                  setShowPromptModal(false);
                  setEditingPromptId(null);
                  setCustomScenePrompt('');
                }}
                className="px-4 py-2 bg-cinema-gray hover:bg-cinema-gray-light text-cinema-text rounded-lg transition-colors"
              >
                ❌ İptal
              </button>
              <button
                onClick={generateWithCustomPrompt}
                disabled={!customScenePrompt.trim() || isGeneratingImage}
                className="px-6 py-2 bg-cinema-accent hover:bg-cinema-accent/80 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                {isGeneratingImage ? '🔄 Üretiliyor...' : '🎨 Görsel Üret'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}