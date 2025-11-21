import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useScriptStore } from '../store/scriptStore';
import { useAIStore } from '../store/aiStore';
import AIHandler, { AI_PROVIDERS } from '../utils/aiHandler';

export default function SimpleStoryboard() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scenes, setScenes] = useState([]);
  const [storyboards, setStoryboards] = useState([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [editingIndex, setEditingIndex] = useState(null);
  const [editPrompt, setEditPrompt] = useState('');
  
  const { getCurrentScript, currentScriptId } = useScriptStore();
  const { geminiApiKey } = useAIStore();
  const { t } = useTranslation();
  
  const currentScript = getCurrentScript();
  
  // Load existing storyboards
  useEffect(() => {
    if (currentScript?.simpleStoryboard) {
      setStoryboards(currentScript.simpleStoryboard || []);
    }
  }, [currentScript]);
  
  // Analyze script and extract scenes
  const analyzeScript = async () => {
    const scriptText = currentScript?.scriptText || currentScript?.cleanedText;
    if (!scriptText || !geminiApiKey) {
      alert('Senaryo metni veya Google Gemini API key bulunamadı!');
      return;
    }
    
    setIsAnalyzing(true);
    
    try {
      const aiHandler = new AIHandler({
        provider: AI_PROVIDERS.GEMINI,
        apiKey: geminiApiKey,
        model: 'gemini-3-pro-preview',
        temperature: 1.0
      });
      
      const analysisPrompt = `Bu senaryoyu analiz et ve storyboard için uygun sahneleri çıkar. Her sahne için şu bilgileri ver:

SENARYO:
${scriptText}

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

      const result = await aiHandler.processPrompt(analysisPrompt);
      
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
      }
      
    } catch (error) {
      console.error('Script analysis failed:', error);
      alert(`Senaryo analizi başarısız: ${error.message}`);
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
    
    // Save to script
    const { updateScript } = useScriptStore.getState();
    updateScript(currentScriptId, {
      simpleStoryboard: newStoryboards,
      updatedAt: new Date().toISOString()
    });
    
    setIsGenerating(false);
    setProgress({ current: 0, total: 0 });
  };
  
  // Generate single image
  const generateImage = async (prompt) => {
    if (!geminiApiKey) {
      throw new Error('Google Gemini API key bulunamadı');
    }
    
    try {
      const aiHandler = new AIHandler({
        provider: AI_PROVIDERS.GEMINI,
        apiKey: geminiApiKey,
        model: 'gemini-2.0-flash'
      });
      
      const result = await aiHandler.generateImage(prompt, { size: '1024x1024' });
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
                    <span>�</span>
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
                <h4 className="font-medium text-green-300">📋 Analiz Tamamlandı</h4>
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
            <div className="text-6xl mb-4">�</div>
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