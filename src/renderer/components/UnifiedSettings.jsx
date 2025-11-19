import React, { useState, useEffect } from 'react';
import { useAIStore } from '../store/aiStore';
import { usePromptStore } from '../store/promptStore';
import { useReaderStore } from '../store/readerStore';
import { useTranslation } from 'react-i18next';
import { AI_PROVIDERS } from '../utils/aiHandler';
import ProvidersTab from './ProvidersTab';
import PromptsTab from './PromptsTab';

export default function UnifiedSettings({ onClose, initialTab = 'ai' }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [customLogo, setCustomLogo] = useState(localStorage.getItem('customLogo') || '');
  const [showPreview, setShowPreview] = useState(false);
  const [newFilterWord, setNewFilterWord] = useState('');

  // Check for saved active tab on mount
  useEffect(() => {
    const savedTab = localStorage.getItem('unifiedSettingsActiveTab');
    if (savedTab) {
      setActiveTab(savedTab);
      localStorage.removeItem('unifiedSettingsActiveTab'); // Clean up after use
    }
  }, []);

  // Update local settings when store values change
  useEffect(() => {
    setLocalSettings({
      wordsPerMinute: wordsPerMinute || 200,
      highlightColor: highlightColor || '#ffd700',
      fontSize: fontSize || 16,
      wordFilter: wordFilter || [],
      customLogo: customLogo || ''
    });
  }, [wordsPerMinute, highlightColor, fontSize, wordFilter, customLogo]);

  // Reader settings
  const {
    wordsPerMinute,
    highlightColor,
    fontSize,
    setWordsPerMinute,
    setHighlightColor,
    setFontSize,
    wordFilter,
    setWordFilter
  } = useReaderStore();

  // AI Store
  const aiStore = useAIStore();
  const promptStore = usePromptStore();

  const [localSettings, setLocalSettings] = useState({
    wordsPerMinute: wordsPerMinute || 200,
    highlightColor: highlightColor || '#ffd700',
    fontSize: fontSize || 16,
    wordFilter: wordFilter || [],
    customLogo: customLogo || ''
  });

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
    if (word && !localSettings.wordFilter.includes(word.toLowerCase())) {
      const newFilter = [...localSettings.wordFilter, word.toLowerCase()];
      setLocalSettings(prev => ({ ...prev, wordFilter: newFilter }));
      setNewFilterWord('');
    }
  };

  const handleRemoveFilterWord = (index) => {
    const newFilter = localSettings.wordFilter.filter((_, i) => i !== index);
    setLocalSettings(prev => ({ ...prev, wordFilter: newFilter }));
  };

  const saveSettings = () => {
    // Save reader settings
    setWordsPerMinute(localSettings.wordsPerMinute);
    setHighlightColor(localSettings.highlightColor);
    setFontSize(localSettings.fontSize);
    setWordFilter(localSettings.wordFilter);
    
    // Save custom logo
    localStorage.setItem('customLogo', localSettings.customLogo);
    
    alert('Ayarlar başarıyla kaydedildi!');
  };

  const resetSettings = () => {
    if (confirm('Tüm ayarları varsayılan değerlere sıfırlayın?')) {
      setLocalSettings({
        wordsPerMinute: 200,
        highlightColor: '#ffd700',
        fontSize: 16,
        wordFilter: [],
        customLogo: ''
      });
      localStorage.removeItem('customLogo');
    }
  };

  const tabs = [
    { key: 'ai', label: 'AI Ayarları', icon: '🤖' },
    { key: 'prompts', label: 'Prompt Yönetimi', icon: '📝' },
    { key: 'reader', label: 'Hızlı Okuma', icon: '⚡' },
    { key: 'filter', label: 'Kelime Filtresi', icon: '🔍' },
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
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                    activeTab === tab.key
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

            {/* Reader Settings Tab */}
            {activeTab === 'reader' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-semibold text-cinema-text mb-4">Hızlı Okuma Ayarları</h3>
                  
                  {/* Reading Speed */}
                  <div className="bg-cinema-black/30 rounded-lg p-6 mb-6">
                    <h4 className="text-lg font-medium text-cinema-text mb-4">Okuma Hızı</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-cinema-text-dim text-sm mb-2">
                          Dakikada Kelime Sayısı: {localSettings.wordsPerMinute} WPM
                        </label>
                        <input
                          type="range"
                          min="50"
                          max="1000"
                          step="10"
                          value={localSettings.wordsPerMinute}
                          onChange={(e) => setLocalSettings(prev => ({ ...prev, wordsPerMinute: parseInt(e.target.value) }))}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-cinema-text-dim mt-1">
                          <span>50 WPM (Yavaş)</span>
                          <span>500 WPM (Orta)</span>
                          <span>1000 WPM (Hızlı)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Visual Settings */}
                  <div className="bg-cinema-black/30 rounded-lg p-6 mb-6">
                    <h4 className="text-lg font-medium text-cinema-text mb-4">Görsel Ayarlar</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-cinema-text-dim text-sm mb-2">Vurgu Rengi</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={localSettings.highlightColor}
                            onChange={(e) => setLocalSettings(prev => ({ ...prev, highlightColor: e.target.value }))}
                            className="w-12 h-12 rounded border border-cinema-gray"
                          />
                          <input
                            type="text"
                            value={localSettings.highlightColor}
                            onChange={(e) => setLocalSettings(prev => ({ ...prev, highlightColor: e.target.value }))}
                            className="flex-1 bg-cinema-gray border border-cinema-gray-light rounded px-3 py-2 text-cinema-text"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-cinema-text-dim text-sm mb-2">Yazı Boyutu: {localSettings.fontSize}px</label>
                        <input
                          type="range"
                          min="12"
                          max="32"
                          value={localSettings.fontSize}
                          onChange={(e) => setLocalSettings(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
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
                          {localSettings.wordFilter?.length || 0} kelime
                        </span>
                      </h4>
                      <button
                        onClick={() => {
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
                          {localSettings.wordFilter?.map((word, index) => (
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
                        
                        {localSettings.wordFilter?.length === 0 && (
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
              onClick={saveSettings}
              className="btn-primary px-6 py-2"
            >
              Kaydet
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