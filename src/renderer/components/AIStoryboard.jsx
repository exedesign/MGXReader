import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useScriptStore } from '../store/scriptStore';
import { useAIStore } from '../store/aiStore';
import { usePromptStore } from '../store/promptStore';

export default function AIStoryboard() {
  const [selectedScenes, setSelectedScenes] = useState([]);
  const [storyboardStyle, setStoryboardStyle] = useState('cinematic'); // 'cinematic', 'sketch', 'comic', 'realistic'
  const [aspectRatio, setAspectRatio] = useState('16:9'); // '16:9', '4:3', '1:1', '9:16'
  const [generateMode, setGenerateMode] = useState('single'); // 'single', 'batch', 'all'
  const [generatingScenes, setGeneratingScenes] = useState(new Set());
  const [generatedImages, setGeneratedImages] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(null); // Scene ID being edited
  const [customPrompt, setCustomPrompt] = useState(''); // Custom prompt for editing
  const [showPromptModal, setShowPromptModal] = useState(false);
  
  // Store hooks
  const { getCurrentScript, updateScript, currentScriptId } = useScriptStore();
  const {
    generateImage,
    isGeneratingImage,
    generatingScenes: storeGeneratingScenes,
    addGeneratingScene,
    removeGeneratingScene,
    isConfigured
  } = useAIStore();
  const { getPrompt, getAllPrompts, saveCustomPrompt } = usePromptStore();
  
  const { t } = useTranslation();
  
  const currentScript = getCurrentScript();
  const scenes = currentScript?.structure?.scenes || [];

  // Load existing storyboard data
  useEffect(() => {
    if (currentScript?.storyboard) {
      setGeneratedImages(currentScript.storyboard || {});
    }
  }, [currentScript]);

  // Generate storyboard prompt for a scene
  const generateScenePrompt = (scene) => {
    const stylePrompts = {
      cinematic: 'cinematic still, film photography, dramatic lighting, professional movie scene',
      sketch: 'pencil sketch, storyboard drawing, black and white, hand-drawn illustration',
      comic: 'comic book style, graphic novel illustration, bold lines, dynamic composition',
      realistic: 'photorealistic, high detail, natural lighting, professional photography'
    };

    const basePrompt = `${stylePrompts[storyboardStyle]}, ${aspectRatio} aspect ratio`;
    
    let prompt = `${basePrompt}. Scene: ${scene.title || `Scene ${scene.number}`}`;
    
    if (scene.location) {
      prompt += `, Location: ${scene.location}`;
    }
    
    if (scene.intExt) {
      prompt += `, ${scene.intExt === 'INT' ? 'Interior' : 'Exterior'}`;
    }
    
    if (scene.timeOfDay) {
      prompt += `, ${scene.timeOfDay}`;
    }
    
    if (scene.characters && scene.characters.length > 0) {
      const charList = scene.characters.slice(0, 3).map(char => 
        typeof char === 'string' ? char : char.name
      ).join(', ');
      prompt += `, Characters: ${charList}`;
    }
    
    if (scene.content && scene.content.length > 0) {
      // Extract key visual elements from scene content
      const visualKeywords = extractVisualKeywords(scene.content);
      if (visualKeywords.length > 0) {
        prompt += `, Action: ${visualKeywords.slice(0, 3).join(', ')}`;
      }
    }
    
    // Quality and style modifiers
    prompt += ', high quality, detailed composition, movie still';
    
    return prompt;
  };

  // Extract visual keywords from scene text
  const extractVisualKeywords = (text) => {
    if (!text) return [];
    
    // Common action/visual words to look for
    const visualWords = [
      'runs', 'walks', 'sits', 'stands', 'fights', 'talks', 'looks', 'holds',
      'door', 'window', 'car', 'building', 'forest', 'street', 'room',
      'gun', 'phone', 'computer', 'table', 'chair', 'bed',
      'dark', 'bright', 'rain', 'sun', 'fire', 'smoke'
    ];
    
    const words = text.toLowerCase().split(/\s+/);
    return words.filter(word => 
      visualWords.some(vw => word.includes(vw)) && word.length > 2
    );
  };

  // Open prompt editing modal
  const openPromptEditor = (scene) => {
    const sceneId = scene.id || `scene_${scene.number}`;
    const existingImage = generatedImages[sceneId];
    
    setEditingPrompt(sceneId);
    setCustomPrompt(existingImage?.prompt || generateScenePrompt(scene));
    setShowPromptModal(true);
  };

  // Generate with custom prompt
  const generateWithCustomPrompt = async () => {
    if (!editingPrompt || !customPrompt.trim()) return;
    
    const scene = scenes.find(s => (s.id || `scene_${s.number}`) === editingPrompt);
    if (!scene) return;

    setShowPromptModal(false);
    await generateSceneStoryboard(scene, customPrompt.trim());
    setEditingPrompt(null);
    setCustomPrompt('');
  };

  // Generate storyboard for single scene
  const generateSceneStoryboard = async (scene, customPromptOverride = null) => {
    if (!scene || !isConfigured()) {
      console.error('No scene or provider configured');
      return;
    }

    const sceneId = scene.id || `scene_${scene.number}`;
    addGeneratingScene(sceneId);
    setGeneratingScenes(prev => new Set([...prev, sceneId]));

    try {
      const prompt = customPromptOverride || generateScenePrompt(scene);
      console.log('Generating storyboard with prompt:', prompt);
      
      const result = await generateImage(prompt, {
        size: aspectRatio === '16:9' ? '1792x1024' : 
              aspectRatio === '4:3' ? '1024x768' :
              aspectRatio === '1:1' ? '1024x1024' :
              aspectRatio === '9:16' ? '1024x1792' : '1024x1024'
      });
      
      if (result.success && result.imageUrl) {
        const newImages = {
          ...generatedImages,
          [sceneId]: {
            url: result.imageUrl,
            prompt: prompt,
            originalPrompt: customPromptOverride ? generateScenePrompt(scene) : null,
            style: storyboardStyle,
            aspectRatio: aspectRatio,
            generatedAt: new Date().toISOString(),
            revisedPrompt: result.revisedPrompt,
            sceneInfo: {
              title: scene.title,
              location: scene.location,
              timeOfDay: scene.timeOfDay,
              intExt: scene.intExt
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
        alert(`Storyboard üretimi başarısız: ${result.error}`);
      }
      
    } catch (error) {
      console.error('Error generating storyboard:', error);
      alert(`Hata: ${error.message}`);
    }
    
    removeGeneratingScene(sceneId);
    setGeneratingScenes(prev => {
      const newSet = new Set(prev);
      newSet.delete(sceneId);
      return newSet;
    });
  };

  // Generate storyboard for multiple scenes
  const generateBatchStoryboard = async () => {
    if (selectedScenes.length === 0) {
      alert('Lütfen sahne seçin');
      return;
    }

    for (const sceneId of selectedScenes) {
      const scene = scenes.find(s => (s.id || `scene_${s.number}`) === sceneId);
      if (scene) {
        await generateSceneStoryboard(scene);
        // Add delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    setSelectedScenes([]);
  };

  // Generate storyboard for all scenes
  const generateAllStoryboards = async () => {
    if (scenes.length === 0) {
      alert('Sahne bulunamadı');
      return;
    }

    if (!confirm(`${scenes.length} sahne için storyboard üretilecek. Devam edilsin mi?`)) {
      return;
    }

    for (const scene of scenes) {
      await generateSceneStoryboard(scene);
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  };

  // Toggle scene selection
  const toggleSceneSelection = (sceneId) => {
    setSelectedScenes(prev => 
      prev.includes(sceneId) 
        ? prev.filter(id => id !== sceneId)
        : [...prev, sceneId]
    );
  };

  // Clear generated storyboard for scene
  const clearSceneStoryboard = (sceneId) => {
    const newImages = { ...generatedImages };
    delete newImages[sceneId];
    setGeneratedImages(newImages);
    
    updateScript(currentScriptId, {
      storyboard: newImages,
      updatedAt: new Date().toISOString()
    });
  };

  if (!currentScript) {
    return (
      <div className="p-8 text-center">
        <div className="text-cinema-text-dim mb-4">
          <svg className="w-16 h-16 mx-auto mb-4 text-cinema-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2h4a1 1 0 011 1v1a1 1 0 01-1 1v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a1 1 0 01-1-1V5a1 1 0 011-1h4zM9 3v1h6V3H9zM5 7v11h14V7H5zm2 3h10v2H7v-2zm0 4h10v2H7v-2z" />
          </svg>
          <p>{t('storyboard.noScript', 'Storyboard üretmek için önce bir senaryo seçin')}</p>
        </div>
      </div>
    );
  }

  if (scenes.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="text-cinema-text-dim mb-4">
          <svg className="w-16 h-16 mx-auto mb-4 text-cinema-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p>{t('storyboard.noScenes', 'Bu senaryoda sahne bulunamadı')}</p>
          <p className="text-sm mt-2">{t('storyboard.importTip', 'Sahne analizi için senaryoyu yeniden analiz edin')}</p>
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
              🎨 AI Storyboard Üretici
            </h2>
            <span className="text-xs bg-cinema-accent text-white px-2 py-1 rounded">
              {scenes.length} sahne
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 bg-cinema-gray hover:bg-cinema-gray-light rounded text-cinema-text transition-colors"
              title="Ayarlar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-cinema-gray p-4 rounded-lg border border-cinema-gray-light mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Style Selection */}
              <div>
                <label className="block text-sm font-medium text-cinema-text mb-2">
                  Stil
                </label>
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
                <label className="block text-sm font-medium text-cinema-text mb-2">
                  En-Boy Oranı
                </label>
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

              {/* Provider Info */}
              <div>
                <label className="block text-sm font-medium text-cinema-text mb-2">
                  AI Sağlayıcı
                </label>
                <div className="px-3 py-2 bg-cinema-black border border-cinema-gray rounded text-cinema-text-dim text-sm">
                  {currentProvider ? `✅ ${currentProvider.name}` : '❌ Yapılandırılmamış'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={generateAllStoryboards}
            disabled={isGeneratingImage || !isConfigured()}
            className="px-4 py-2 bg-cinema-accent hover:bg-cinema-accent/80 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded font-medium transition-colors"
          >
            🎨 Tüm Sahneler
          </button>
          
          <button
            onClick={generateBatchStoryboard}
            disabled={isGeneratingImage || selectedScenes.length === 0 || !isConfigured()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded font-medium transition-colors"
          >
            🖼️ Seçili Sahneler ({selectedScenes.length})
          </button>

          <button
            onClick={() => setSelectedScenes([])}
            disabled={selectedScenes.length === 0}
            className="px-4 py-2 bg-cinema-gray hover:bg-cinema-gray-light disabled:bg-gray-600 disabled:cursor-not-allowed text-cinema-text rounded font-medium transition-colors"
          >
            ❌ Seçimi Temizle
          </button>

          <button
            onClick={() => {
              const allSceneIds = scenes.map(s => s.id || `scene_${s.number}`);
              setSelectedScenes(selectedScenes.length === scenes.length ? [] : allSceneIds);
            }}
            className="px-4 py-2 bg-cinema-gray hover:bg-cinema-gray-light text-cinema-text rounded font-medium transition-colors"
          >
            {selectedScenes.length === scenes.length ? '◻️ Tümünü Kaldır' : '✅ Tümünü Seç'}
          </button>
        </div>

        {!isConfigured() && (
          <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded text-red-400 text-sm">
            ⚠️ Storyboard üretmek için önce AI ayarlarından bir sağlayıcı yapılandırın.
          </div>
        )}
      </div>

      {/* Scenes Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {scenes.map((scene, index) => {
            const sceneId = scene.id || `scene_${scene.number || index + 1}`;
            const isSelected = selectedScenes.includes(sceneId);
            const isGenerating = generatingScenes.has(sceneId);
            const hasStoryboard = generatedImages[sceneId];

            return (
              <div
                key={sceneId}
                className={`bg-cinema-gray rounded-lg border transition-all duration-200 ${
                  isSelected ? 'border-cinema-accent ring-2 ring-cinema-accent/30' : 'border-cinema-gray-light hover:border-cinema-accent/50'
                }`}
              >
                {/* Scene Header */}
                <div className="p-3 border-b border-cinema-gray-light">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-cinema-text text-sm truncate">
                      {scene.title || `Scene ${scene.number || index + 1}`}
                    </h3>
                    <div className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSceneSelection(sceneId)}
                        className="w-4 h-4 text-cinema-accent bg-cinema-black border-cinema-gray rounded focus:ring-cinema-accent"
                      />
                    </div>
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
                      <div>👥 {scene.characters.slice(0, 3).map(c => typeof c === 'string' ? c : c.name).join(', ')}</div>
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
                          onClick={() => generateSceneStoryboard(scene)}
                          disabled={isGeneratingImage || !isConfigured()}
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
                        {hasStoryboard.revisedPrompt && (
                          <div className="bg-cinema-black/30 p-2 rounded text-xs">
                            <div className="text-cinema-accent mb-1">AI Geliştirilmiş Prompt:</div>
                            <div className="text-cinema-text-dim overflow-hidden" style={{display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical'}}>{hasStoryboard.revisedPrompt}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-video bg-cinema-black/50 rounded border border-dashed border-cinema-gray flex items-center justify-center">
                      <button
                        onClick={() => generateSceneStoryboard(scene)}
                        disabled={isGeneratingImage || !isConfigured()}
                        className="flex flex-col items-center gap-2 p-4 text-cinema-text-dim hover:text-cinema-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <span className="text-xs font-medium">
                          {isConfigured() ? 'Storyboard Üret' : 'Sağlayıcı Yok'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {scenes.length === 0 && (
          <div className="text-center text-cinema-text-dim py-8">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p>Sahne bulunamadı</p>
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
                <h3 className="text-xl font-bold text-cinema-text">✏️ Prompt Düzenle</h3>
                <p className="text-cinema-text-dim text-sm mt-1">
                  Görseli istediğiniz şekilde değiştirmek için prompt'ı düzenleyin
                </p>
              </div>
              <button
                onClick={() => {
                  setShowPromptModal(false);
                  setEditingPrompt(null);
                  setCustomPrompt('');
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
                {/* Current Scene Info */}
                {editingPrompt && (
                  <div className="bg-cinema-black/30 rounded-lg p-4">
                    <h4 className="text-lg font-medium text-cinema-text mb-2">
                      {scenes.find(s => (s.id || `scene_${s.number}`) === editingPrompt)?.title || 'Scene'}
                    </h4>
                    <div className="text-sm text-cinema-text-dim">
                      {(() => {
                        const scene = scenes.find(s => (s.id || `scene_${s.number}`) === editingPrompt);
                        const parts = [];
                        if (scene?.location) parts.push(`📍 ${scene.location}`);
                        if (scene?.intExt) parts.push(`${scene.intExt === 'INT' ? '🏠' : '🌳'} ${scene.intExt}`);
                        if (scene?.timeOfDay) parts.push(`${scene.timeOfDay.includes('DAY') || scene.timeOfDay.includes('GÜN') ? '☀️' : '🌙'} ${scene.timeOfDay}`);
                        return parts.join(' • ');
                      })()} 
                    </div>
                  </div>
                )}
                
                {/* Style Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-cinema-gray/30 p-3 rounded">
                    <div className="text-cinema-text font-medium">🎨 Stil</div>
                    <div className="text-cinema-text-dim">{storyboardStyle}</div>
                  </div>
                  <div className="bg-cinema-gray/30 p-3 rounded">
                    <div className="text-cinema-text font-medium">📱 En-Boy Oranı</div>
                    <div className="text-cinema-text-dim">{aspectRatio}</div>
                  </div>
                </div>
                
                {/* Prompt Editor */}
                <div>
                  <label className="block text-sm font-medium text-cinema-text mb-2">
                    Görsel Üretim Prompt'ı
                  </label>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Sahne için özel prompt girin..."
                    className="w-full h-40 px-3 py-2 bg-cinema-black border border-cinema-gray rounded-lg text-cinema-text placeholder-cinema-text-dim focus:ring-2 focus:ring-cinema-accent focus:outline-none resize-none"
                  />
                  <div className="flex justify-between items-center mt-2 text-xs text-cinema-text-dim">
                    <div>Karakter sayısı: {customPrompt.length}</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const scene = scenes.find(s => (s.id || `scene_${s.number}`) === editingPrompt);
                          if (scene) {
                            setCustomPrompt(generateScenePrompt(scene));
                          }
                        }}
                        className="text-cinema-accent hover:text-cinema-accent/80 transition-colors"
                      >
                        🔄 Otomatik Prompt'ı Sıfırla
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Tips */}
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                  <h5 className="text-blue-400 font-medium mb-2">💡 Prompt İpuçları</h5>
                  <ul className="text-blue-300 text-sm space-y-1">
                    <li>• Spesifik detaylar ekleyin ("close-up", "wide shot", "dramatic lighting")</li>
                    <li>• Ruh halini belirtin ("tense", "romantic", "mysterious")</li> 
                    <li>• Renk paletini tanımlayın ("warm colors", "cold blue tones", "sepia")</li>
                    <li>• Kamera açısını belirtin ("low angle", "bird's eye view", "over shoulder")</li>
                  </ul>
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-cinema-gray">
              <button
                onClick={() => {
                  setShowPromptModal(false);
                  setEditingPrompt(null);
                  setCustomPrompt('');
                }}
                className="px-4 py-2 bg-cinema-gray hover:bg-cinema-gray-light text-cinema-text rounded-lg transition-colors"
              >
                ❌ İptal
              </button>
              <button
                onClick={generateWithCustomPrompt}
                disabled={!customPrompt.trim() || isGeneratingImage}
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