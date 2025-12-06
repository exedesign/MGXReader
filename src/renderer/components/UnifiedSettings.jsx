import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAIStore } from '../store/aiStore';
import { usePromptStore } from '../store/promptStore';
import { useReaderStore } from '../store/readerStore';
import { useFeatureStore } from '../store/featureStore';
import { AI_PROVIDERS } from '../utils/aiHandler';
import ProvidersTab from './ProvidersTab';
import PromptsTab from './PromptsTab';

export default function UnifiedSettings({ onClose, initialTab = 'ai' }) {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [customLogo, setCustomLogo] = useState(localStorage.getItem('customLogo') || '');
  const [showPreview, setShowPreview] = useState(false);
  const [newFilterWord, setNewFilterWord] = useState('');

  // Store hooks with error handling
  const aiStore = useAIStore();
  const promptStore = usePromptStore();
  const readerStore = useReaderStore();
  const { blacklist, addToBlacklist, removeFromBlacklist, clearBlacklist } = readerStore;
  const { features, toggleFeature } = useFeatureStore();

  // Local settings state
  const [localSettings, setLocalSettings] = useState({
    wordsPerMinute: 200,
    highlightColor: '#ffd700',
    fontSize: 16,
    wordFilter: readerStore.blacklist || [],
    customLogo: ''
  });

  // Check for saved active tab on mount
  useEffect(() => {
    const savedTab = localStorage.getItem('unifiedSettingsActiveTab');
    if (savedTab) {
      setActiveTab(savedTab);
    }
  }, []);

  // Change language
  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  // Logo upload handler
  const handleLogoUpload = (event) => {
    const file = event.target.files[0];
    if (file && (file.type.includes('image/png') || file.type.includes('image/svg') || file.type.includes('image/jpeg'))) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const logoData = e.target.result;
        setLocalSettings(prev => ({ ...prev, customLogo: logoData }));
        localStorage.setItem('customLogo', logoData);
        setShowPreview(true);
      };
      reader.readAsDataURL(file);
    } else {
      alert('Lütfen PNG, SVG veya JPEG formatında bir dosya seçin.');
    }
  };

  // Word filter management
  const addWordToFilter = (word) => {
    if (word && !localSettings.wordFilter.includes(word.toLowerCase())) {
      const newFilter = [...localSettings.wordFilter, word.toLowerCase()];
      setLocalSettings(prev => ({ ...prev, wordFilter: newFilter }));
    }
  };

  const removeWordFromFilter = (word) => {
    const newFilter = localSettings.wordFilter.filter(w => w !== word);
    setLocalSettings(prev => ({ ...prev, wordFilter: newFilter }));
  };

  const handleAddFilterWord = () => {
    const word = newFilterWord.trim();
    if (word && !blacklist.includes(word.toUpperCase())) {
      addToBlacklist(word);
      setLocalSettings(prev => ({ ...prev, wordFilter: [...prev.wordFilter, word.toUpperCase()] }));
      setNewFilterWord('');
    }
  };

  const handleRemoveFilterWord = (index) => {
    const wordToRemove = blacklist[index];
    if (wordToRemove) {
      removeFromBlacklist(wordToRemove);
      const newFilter = localSettings.wordFilter.filter((_, i) => i !== index);
      setLocalSettings(prev => ({ ...prev, wordFilter: newFilter }));
    }
  };

  const resetSettings = () => {
    if (confirm('TÜM ayarları (AI anahtarları dahil) varsayılan değerlere sıfırlamak istediğinizden emin misiniz? Bu işlem geri alınamaz!')) {
      // Local reader settings reset
      setLocalSettings({
        wordsPerMinute: 200,
        highlightColor: '#ffd700',
        fontSize: 16,
        wordFilter: [],
        customLogo: ''
      });
      localStorage.removeItem('customLogo');
      
      // AI Store reset
      if (aiStore) {
        // Reset OpenAI settings
        if (aiStore.setOpenAIConfig) {
          aiStore.setOpenAIConfig('', 'gpt-4o');
          aiStore.setOpenAIImageModel('dall-e-3');
        }
        
        // Reset Gemini settings
        if (aiStore.setGeminiConfig) {
          aiStore.setGeminiConfig('', 'gemini-3-pro-preview');
          aiStore.setGeminiImageModel('gemini-3-pro-image-preview');
        }
        
        // Reset Local AI settings
        if (aiStore.setLocalConfig) {
          aiStore.setLocalConfig('http://127.0.0.1:11434', 'llama2', 0.7);
        }
        
        // Reset MLX settings
        if (aiStore.setMLXConfig) {
          aiStore.setMLXConfig('http://127.0.0.1:8080', 'mlx-community/Llama-3.2-3B-Instruct-4bit', 0.7);
        }
        
        // Reset provider to OpenAI
        if (aiStore.setProvider) {
          aiStore.setProvider('openai');
        }
      }
      
      // Reader store reset
      if (readerStore) {
        if (readerStore.clearBlacklist) {
          readerStore.clearBlacklist();
        }
      }
      
      // Feature store reset
      if (toggleFeature) {
        // Reset all features to default (enabled)
        Object.keys(features || {}).forEach(feature => {
          if (!features[feature]) {
            toggleFeature(feature);
          }
        });
      }
      
      console.log('🗑️ Tüm ayarlar sıfırlandı');
      alert('Tüm ayarlar başarıyla sıfırlandı!');
    }
  };

  const tabs = [
    { key: 'ai', label: 'AI Ayarları', icon: '🤖' },
    { key: 'modules', label: 'Modüller', icon: '🧩' },
    { key: 'prompts', label: 'Prompt Yönetimi', icon: '📝' },
    { key: 'filter', label: 'Kelime Filtresi', icon: '🔍' },
    { key: 'general', label: 'Genel Ayarlar', icon: '⚙️' },
    { key: 'appearance', label: 'Görünüm', icon: '🎨' },
    { key: 'about', label: 'Hakkında', icon: 'ℹ️' }
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-cinema-dark rounded-xl border border-cinema-gray w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-cinema-gray">
          <div>
            <h2 className="text-2xl font-bold text-cinema-text">Ayarlar</h2>
            <p className="text-cinema-text-dim text-sm mt-1">Uygulama ayarlarınızı yönetin</p>
          </div>
          <button
            onClick={onClose}
            className="text-cinema-text-dim hover:text-cinema-text transition-colors p-2"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 bg-cinema-black/50 border-r border-cinema-gray p-4">
            <div className="space-y-2">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${activeTab === tab.key
                    ? 'bg-cinema-accent text-cinema-black font-medium'
                    : 'text-cinema-text hover:bg-cinema-gray/50'
                    }`}
                >
                  <span className="text-xl">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* AI Settings Tab */}
            {activeTab === 'ai' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-cinema-text mb-4">AI Sağlayıcı Ayarları</h3>
                  <ProvidersTab
                    provider={aiStore.provider}
                    setProvider={aiStore.setProvider}
                    config={aiStore.config}
                    setConfig={aiStore.setConfig}
                    isConfigured={aiStore.isConfigured}
                  />
                </div>
              </div>
            )}

            {/* Modules Tab */}
            {activeTab === 'modules' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-cinema-text mb-4">🧩 Modül Yönetimi</h3>
                  <p className="text-cinema-text-dim text-sm mb-6">
                    Uygulama özelliklerini açıp kapatarak performansı artırabilir ve arayüzü sadeleştirebilirsiniz.
                    Kapalı modüller belleğe yüklenmez ve API kullanımı yapmazlar.
                  </p>

                  {/* Module Cards */}
                  <div className="space-y-4">
                    {/* Storyboard Module */}
                    <div className={`bg-cinema-black/30 rounded-lg p-6 border transition-all ${
                      features.enable_storyboard 
                        ? 'border-cinema-accent/50 shadow-lg shadow-cinema-accent/10' 
                        : 'border-cinema-gray/50'
                    }`}>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-4 flex-1">
                          <span className="text-3xl">🎨</span>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="text-lg font-medium text-cinema-text">Storyboard Modülü</h4>
                              {features.enable_storyboard && (
                                <span className="px-2 py-1 bg-green-900/30 text-green-400 text-xs rounded-full">Aktif</span>
                              )}
                            </div>
                            <p className="text-cinema-text-dim text-sm mb-3">
                              Görselleştirme ve storyboard oluşturma araçları
                            </p>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="text-cinema-text-dim">💾 Bellek:</span>
                                <span className="text-cinema-accent">50-100 MB</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-cinema-text-dim">🔌 API:</span>
                                <span className="text-orange-400">Yüksek</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={features.enable_storyboard}
                            onChange={() => toggleFeature('enable_storyboard')}
                          />
                          <div className="w-11 h-6 bg-cinema-gray rounded-full peer peer-focus:ring-4 peer-focus:ring-cinema-accent/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cinema-accent"></div>
                        </label>
                      </div>
                      {!features.enable_storyboard && (
                        <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-900/30 rounded text-sm text-yellow-200">
                          <span className="font-bold">⚠️ Uyarı:</span> Görsel üretim ve storyboard özellikleri kullanılamayacak.
                        </div>
                      )}
                    </div>

                    {/* Canvas Module */}
                    <div className={`bg-cinema-black/30 rounded-lg p-6 border transition-all ${
                      features.enable_canvas 
                        ? 'border-cinema-accent/50 shadow-lg shadow-cinema-accent/10' 
                        : 'border-cinema-gray/50'
                    }`}>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-4 flex-1">
                          <span className="text-3xl">🎨</span>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="text-lg font-medium text-cinema-text">Tuval Modülü</h4>
                              {features.enable_canvas && (
                                <span className="px-2 py-1 bg-green-900/30 text-green-400 text-xs rounded-full">Aktif</span>
                              )}
                            </div>
                            <p className="text-cinema-text-dim text-sm mb-3">
                              AI destekli görsel düzenleme: Eskiz, Stil Transferi, Inpainting, Outpainting
                            </p>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="text-cinema-text-dim">💾 Bellek:</span>
                                <span className="text-cinema-accent">20-40 MB</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-cinema-text-dim">🔌 API:</span>
                                <span className="text-orange-400">Yüksek</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={features.enable_canvas}
                            onChange={() => toggleFeature('enable_canvas')}
                          />
                          <div className="w-11 h-6 bg-cinema-gray rounded-full peer peer-focus:ring-4 peer-focus:ring-cinema-accent/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cinema-accent"></div>
                        </label>
                      </div>
                      {!features.enable_canvas && (
                        <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-900/30 rounded text-sm text-yellow-200">
                          <span className="font-bold">⚠️ Uyarı:</span> Görsel düzenleme ve Tuval özellikleri kullanılamayacak.
                        </div>
                      )}
                    </div>

                    {/* AI Analysis Module */}
                    <div className={`bg-cinema-black/30 rounded-lg p-6 border transition-all ${
                      features.enable_ai_analysis 
                        ? 'border-cinema-accent/50 shadow-lg shadow-cinema-accent/10' 
                        : 'border-cinema-gray/50'
                    }`}>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-4 flex-1">
                          <span className="text-3xl">🤖</span>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="text-lg font-medium text-cinema-text">Analiz Modülü</h4>
                              {features.enable_ai_analysis && (
                                <span className="px-2 py-1 bg-green-900/30 text-green-400 text-xs rounded-full">Aktif</span>
                              )}
                            </div>
                            <p className="text-cinema-text-dim text-sm mb-3">
                              Yapay zeka destekli özellikler: Analiz, Görsel Üretimi, Metin İşleme
                            </p>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="text-cinema-text-dim">💾 Bellek:</span>
                                <span className="text-cinema-accent">30-50 MB</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-cinema-text-dim">🔌 API:</span>
                                <span className="text-yellow-400">Orta</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={features.enable_ai_analysis}
                            onChange={() => toggleFeature('enable_ai_analysis')}
                          />
                          <div className="w-11 h-6 bg-cinema-gray rounded-full peer peer-focus:ring-4 peer-focus:ring-cinema-accent/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cinema-accent"></div>
                        </label>
                      </div>
                      {!features.enable_ai_analysis && (
                        <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-900/30 rounded text-sm text-yellow-200">
                          <span className="font-bold">⚠️ Uyarı:</span> AI özellikleri (Analiz, Görsel Üretimi, Storyboard) kullanılamayacak.
                        </div>
                      )}
                    </div>

                    {/* Core Features (Always Active) */}
                    <div className="bg-green-900/20 border border-green-900/30 rounded-lg p-6">
                      <h4 className="text-lg font-medium text-green-200 mb-4 flex items-center gap-2">
                        <span>✅</span>
                        <span>Temel Özellikler (Her Zaman Aktif)</span>
                      </h4>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-2xl">⚡</span>
                          <div className="flex-1">
                            <div className="font-medium text-cinema-text">Hızlı Okuma</div>
                            <div className="text-cinema-text-dim text-xs">RSVP teknolojisi ile hızlı okuma araçları</div>
                          </div>
                          <span className="px-2 py-1 bg-green-900/30 text-green-400 text-xs rounded-full">Sabit</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-2xl">📝</span>
                          <div className="flex-1">
                            <div className="font-medium text-cinema-text">Editör</div>
                            <div className="text-cinema-text-dim text-xs">Senaryo düzenleme ve metin işleme araçları</div>
                          </div>
                          <span className="px-2 py-1 bg-green-900/30 text-green-400 text-xs rounded-full">Sabit</span>
                        </div>
                      </div>
                    </div>

                    {/* Resource Summary */}
                    <div className="bg-blue-900/20 border border-blue-900/30 rounded-lg p-6">
                      <h4 className="text-lg font-medium text-blue-200 mb-4 flex items-center gap-2">
                        <span>📊</span>
                        <span>Kaynak Kullanımı Özeti</span>
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-cinema-text-dim mb-1">Aktif Modüller</div>
                          <div className="text-2xl font-bold text-cinema-accent">
                            {(() => {
                              let active = 2; // Base: Editor + Speed Reader (always active)
                              if (features.enable_ai_analysis) active++;
                              if (features.enable_storyboard) active++;
                              if (features.enable_canvas) active++;
                              let total = 5; // Total possible: Editor, Speed Reader, Analysis, Storyboard, Canvas
                              return `${active} / ${total}`;
                            })()}
                          </div>
                        </div>
                        <div>
                          <div className="text-cinema-text-dim mb-1">Tahmini Bellek Kullanımı</div>
                          <div className="text-2xl font-bold text-cinema-accent">
                            {(() => {
                              let memory = 30; // Base + Core features (Editor, Speed Reader)
                              if (features.enable_ai_analysis) memory += 40;
                              if (features.enable_storyboard) memory += 75;
                              if (features.enable_canvas) memory += 30;
                              return `~${memory} MB`;
                            })()}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 p-3 bg-blue-900/30 rounded text-xs text-blue-200">
                        💡 <span className="font-bold">İpucu:</span> Kullanmadığınız modülleri kapatarak API kullanımını azaltabilir ve sistem kaynaklarını daha verimli kullanabilirsiniz. Editör ve Hızlı Okuma her zaman aktiftir.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Prompts Tab */}
            {activeTab === 'prompts' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-cinema-text mb-4">Prompt Yönetimi</h3>
                  <PromptsTab
                    getPromptTypes={promptStore.getPromptTypes}
                    getPrompt={promptStore.getPrompt}
                    getAllPrompts={promptStore.getAllPrompts}
                    saveCustomPrompt={promptStore.saveCustomPrompt}
                    deleteCustomPrompt={promptStore.deleteCustomPrompt}
                    setActivePrompt={promptStore.setActivePrompt}
                    activePrompts={promptStore.activePrompts}
                    defaultPrompts={promptStore.defaultPrompts}
                  />
                </div>
              </div>
            )}



            {/* Word Filter Tab */}
            {activeTab === 'filter' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-cinema-text mb-4">Kelime Filtresi Yönetimi</h3>

                  <div className="bg-cinema-gray/20 p-6 rounded-lg border border-cinema-gray-light">
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="text-lg font-medium text-cinema-text flex items-center gap-2">
                        🔍 Filtrelenecek Kelimeler
                        <span className="text-xs bg-cinema-accent text-black px-2 py-1 rounded-full">
                          {blacklist?.length || 0} kelime
                        </span>
                      </h4>
                      <button
                        onClick={() => {
                          clearBlacklist();
                          setLocalSettings(prev => ({ ...prev, wordFilter: [] }));
                        }}
                        className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
                      >
                        Tümünü Temizle
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-cinema-text font-medium block mb-2">
                          Yeni Kelime Ekle
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newFilterWord}
                            onChange={(e) => setNewFilterWord(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddFilterWord()}
                            placeholder="Kelime veya kelime grubu ekle..."
                            className="flex-1 px-3 py-2 bg-cinema-gray border border-cinema-gray-light rounded-lg text-cinema-text focus:outline-none focus:border-cinema-accent transition-colors"
                          />
                          <button
                            onClick={handleAddFilterWord}
                            className="px-4 py-2 bg-cinema-accent text-black rounded-lg hover:bg-cinema-accent-light transition-colors"
                          >
                            Ekle
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {blacklist?.map((word, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center gap-2 px-3 py-1 bg-cinema-accent/20 text-cinema-accent rounded-full text-sm"
                            >
                              {word}
                              <button
                                onClick={() => handleRemoveFilterWord(index)}
                                className="text-cinema-accent hover:text-red-400 transition-colors"
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                        </div>

                        {blacklist?.length === 0 && (
                          <div className="text-center py-8 text-cinema-text-dim">
                            <p>🔍 Henüz filtrelenmiş kelime yok</p>
                            <p className="text-xs mt-2">Filtrelemek istediğiniz kelimeleri yukarıdan ekleyin</p>
                          </div>
                        )}
                      </div>

                      <div className="bg-cinema-gray/30 p-4 rounded-lg">
                        <h5 className="text-sm font-medium text-cinema-text mb-2">💡 Nasıl Kullanılır:</h5>
                        <ul className="text-xs text-cinema-text-dim space-y-1">
                          <li>• Bu kelimeler hızlı okuma sırasında vurgulanmayacak</li>
                          <li>• Editörde metin seçip sağ tıklayarak da kelime ekleyebilirsiniz</li>
                          <li>• Kelime gruplarını da ekleyebilirsiniz (örn: "çok güzel")</li>
                          <li>• Filtreleme otomatik olarak aktif, manuel açma/kapama gereksiz</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* General Settings Tab */}
            {activeTab === 'general' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-semibold text-cinema-text mb-4">Genel Ayarlar</h3>

                  {/* Language Settings */}
                  <div className="bg-cinema-black/30 rounded-lg p-6">
                    <h4 className="text-lg font-medium text-cinema-text mb-4">Dil Seçimi</h4>
                    <p className="text-cinema-text-dim text-sm mb-4">
                      Uygulama dilini değiştirin. Değişiklikler anında uygulanır.
                    </p>

                    <div className="flex gap-3">
                      <button
                        onClick={() => changeLanguage('tr')}
                        className={`px-6 py-3 rounded-lg font-medium transition-colors ${i18n.language === 'tr'
                            ? 'bg-cinema-accent text-cinema-black'
                            : 'bg-cinema-gray text-cinema-text hover:bg-cinema-gray-light'
                          }`}
                      >
                        🇹🇷 Türkçe
                      </button>
                      <button
                        onClick={() => changeLanguage('en')}
                        className={`px-6 py-3 rounded-lg font-medium transition-colors ${i18n.language === 'en'
                            ? 'bg-cinema-accent text-cinema-black'
                            : 'bg-cinema-gray text-cinema-text hover:bg-cinema-gray-light'
                          }`}
                      >
                        🇺🇸 English
                      </button>
                    </div>
                  </div>

                  {/* Other General Settings */}
                  <div className="bg-cinema-black/30 rounded-lg p-6">
                    <h4 className="text-lg font-medium text-cinema-text mb-4">Diğer Ayarlar</h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-cinema-text">Otomatik Kaydetme</label>
                          <p className="text-cinema-text-dim text-sm">Değişiklikler otomatik olarak kaydedilir</p>
                        </div>
                        <input
                          type="checkbox"
                          defaultChecked={true}
                          className="rounded"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-cinema-text">Debug Modu</label>
                          <p className="text-cinema-text-dim text-sm">Gelişmiş hata ayıklama bilgilerini gösterir</p>
                        </div>
                        <input
                          type="checkbox"
                          defaultChecked={localStorage.getItem('debugMode') === 'true'}
                          onChange={(e) => localStorage.setItem('debugMode', e.target.checked)}
                          className="rounded"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Appearance Tab */}
            {activeTab === 'appearance' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-semibold text-cinema-text mb-4">Görünüm Ayarları</h3>

                  {/* Logo Settings */}
                  <div className="bg-cinema-black/30 rounded-lg p-6">
                    <h4 className="text-lg font-medium text-cinema-text mb-4">Özel Logo</h4>
                    <p className="text-cinema-text-dim text-sm mb-4">
                      Uygulamanın sol üst kısmında görünecek özel logo yükleyin. (PNG, SVG, JPEG)
                    </p>

                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <input
                          type="file"
                          accept=".png,.svg,.jpg,.jpeg"
                          onChange={handleLogoUpload}
                          className="hidden"
                          id="logo-upload"
                        />
                        <label
                          htmlFor="logo-upload"
                          className="btn-secondary px-4 py-2 cursor-pointer"
                        >
                          Logo Seç
                        </label>
                        {localSettings.customLogo && (
                          <button
                            onClick={() => {
                              setLocalSettings(prev => ({ ...prev, customLogo: '' }));
                              localStorage.removeItem('customLogo');
                            }}
                            className="btn-secondary px-4 py-2 text-red-400"
                          >
                            Logo Kaldır
                          </button>
                        )}
                      </div>

                      {/* Logo Preview */}
                      {localSettings.customLogo && (
                        <div className="p-4 bg-cinema-gray/20 rounded-lg">
                          <label className="block text-cinema-text-dim text-sm mb-2">Önizleme:</label>
                          <img
                            src={localSettings.customLogo}
                            alt="Custom Logo Preview"
                            className="max-w-48 max-h-24 object-contain border border-cinema-gray rounded"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* About Tab */}
            {activeTab === 'about' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-semibold text-cinema-text mb-6">Hakkında</h3>

                  <div className="bg-cinema-black/30 rounded-lg p-8">
                    <div className="text-center space-y-6">
                      {/* Logo/Icon */}
                      <div className="text-6xl mb-4">🎬</div>

                      <div>
                        <h4 className="text-2xl font-bold text-cinema-accent mb-2">MGX Reader</h4>
                        <p className="text-cinema-text-dim text-lg">Senaryo Analiz ve Hızlı Okuma Uygulaması</p>
                      </div>

                      <div className="border-t border-cinema-gray pt-6 space-y-4">
                        <div>
                          <p className="text-cinema-text font-medium mb-1">Proje MGX Film için geliştirilmiştir</p>
                        </div>

                        <div className="space-y-2">
                          <p className="text-cinema-text">
                            <span className="font-medium">Yaratıcı:</span> Fatih Eke
                          </p>
                          <p className="text-cinema-text">
                            <span className="font-medium">İletişim:</span>{' '}
                            <a
                              href="mailto:fatiheke@gmail.com"
                              className="text-cinema-accent hover:underline"
                            >
                              fatiheke@gmail.com
                            </a>
                          </p>
                        </div>

                        <div className="pt-4">
                          <p className="text-cinema-accent font-medium flex items-center justify-center gap-2">
                            Made in <span className="text-red-500">❤️</span> Türkiye
                          </p>
                        </div>
                      </div>

                      {/* Version Info */}
                      <div className="border-t border-cinema-gray pt-4 text-sm text-cinema-text-dim">
                        <p>Sürüm 1.0.0 • {new Date().getFullYear()}</p>
                        <p className="mt-2">
                          AI destekli senaryo analizi, hızlı okuma teknolojisi ve PDF export özellikleri ile
                          profesyonel senaryo değerlendirme aracı.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-cinema-gray p-4 flex justify-between items-center">
          <div className="text-sm text-cinema-text-dim">
            Değişiklikler otomatik olarak kaydedilir
          </div>
          <div className="flex gap-3">
            <button
              onClick={resetSettings}
              className="btn-secondary px-4 py-2"
            >
              Sıfırla
            </button>
            <button
              onClick={onClose}
              className="btn-secondary px-4 py-2"
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}