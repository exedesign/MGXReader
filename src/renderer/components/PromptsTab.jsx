import React, { useState, useRef } from 'react';
import { useAIStore } from '../store/aiStore';

export default function PromptsTab({
  getPromptTypes = () => [],
  getPrompt = () => null,
  getAllPrompts = () => ({}),
  saveCustomPrompt = () => {},
  deleteCustomPrompt = () => {},
  setActivePrompt = () => {},
  activePrompts = {},
  defaultPrompts = {},
  exportAllPrompts = () => {},
  exportCategory = () => {},
  importPrompts = () => {},
  getCategories = () => ({})
}) {
  const { provider } = useAIStore(); // Provider bilgisini al
  const [selectedCategory, setSelectedCategory] = useState('analysis');
  const [selectedType, setSelectedType] = useState(null);
  const [editingPrompt, setEditingPrompt] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newPromptData, setNewPromptData] = useState({
    name: '',
    system: '',
    user: '',
    usedBy: [],
    category: 'custom'
  });
  const [showImportExport, setShowImportExport] = useState(false);
  const [importMode, setImportMode] = useState('merge');
  const fileInputRef = useRef(null);

  // Kategorileri store'dan al
  const categories = getCategories() || {};
  
  // Eğer kategoriler boşsa veya selectedCategory yoksa, varsayılana dön
  if (!categories[selectedCategory]) {
    const firstCategory = Object.keys(categories)[0];
    if (firstCategory && selectedCategory !== firstCategory) {
      setSelectedCategory(firstCategory);
    }
  }

  // Provider'a göre prompt'ları sırala - Gemini 3 optimize olanları önce göster
  const sortPromptsByProvider = (promptTypes) => {
    if (provider === 'gemini') {
      // Gemini provider için Gemini 3 optimize promptları önce göster
      return promptTypes.sort((a, b) => {
        const aOptimized = a.key.includes('gemini3') || a.key.includes('g3');
        const bOptimized = b.key.includes('gemini3') || b.key.includes('g3');
        
        if (aOptimized && !bOptimized) return -1;
        if (!aOptimized && bOptimized) return 1;
        return 0;
      });
    }
    
    if (provider === 'local' || provider === 'mlx') {
      // Local provider'lar için Llama optimize promptları önce göster
      return promptTypes.sort((a, b) => {
        const aOptimized = a.key.includes('llama');
        const bOptimized = b.key.includes('llama');
        
        if (aOptimized && !bOptimized) return -1;
        if (!aOptimized && bOptimized) return 1;
        return 0;
      });
    }
    return promptTypes;
  };

  const handleEditPrompt = (category, type) => {
    const prompt = getPrompt(category, type);
    // usedBy yoksa veya boşsa, kategori bazlı varsayılan değer ata
    let defaultUsedBy = [];
    if (category === 'analysis') {
      defaultUsedBy = ['analysis_panel'];
    } else if (category === 'storyboard') {
      defaultUsedBy = ['storyboard'];
    } else if (category === 'speed_reading') {
      defaultUsedBy = ['speed_reader'];
    } else if (category === 'grammar') {
      defaultUsedBy = ['analysis_panel'];
    } else if (category === 'cinematography' || category === 'production') {
      defaultUsedBy = ['storyboard', 'analysis_panel'];
    }
    
    setEditingPrompt({ 
      category, 
      type, 
      ...prompt,
      usedBy: prompt.usedBy && prompt.usedBy.length > 0 ? prompt.usedBy : defaultUsedBy
    });
    setSelectedType(type);
  };

  const handleSavePrompt = () => {
    if (editingPrompt && editingPrompt.usedBy?.length > 0) {
      saveCustomPrompt(editingPrompt.category || selectedCategory, selectedType, {
        name: editingPrompt.name,
        system: editingPrompt.system,
        user: editingPrompt.user,
        usedBy: editingPrompt.usedBy,
        category: editingPrompt.category || selectedCategory
      });
      setEditingPrompt(null);
    } else if (!editingPrompt.usedBy?.length) {
      alert('⚠️ Lütfen en az bir modül seçin');
    }
  };

  const handleCreatePrompt = () => {
    if (newPromptData.name && newPromptData.system && newPromptData.user && newPromptData.usedBy?.length > 0) {
      const key = newPromptData.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const targetCategory = selectedCategory;
      saveCustomPrompt(targetCategory, key, {
        name: newPromptData.name,
        system: newPromptData.system,
        user: newPromptData.user,
        usedBy: newPromptData.usedBy,
        category: targetCategory
      });
      setNewPromptData({ 
        name: '', 
        system: '', 
        user: '', 
        usedBy: [],
        category: 'custom' 
      });
      setIsCreating(false);
    } else if (!newPromptData.usedBy?.length) {
      alert('⚠️ Lütfen en az bir modül seçin');
    }
  };

  const handleDeletePrompt = (category, type) => {
    if (confirm('Bu özel prompt\'u silmek istediğinize emin misiniz?')) {
      deleteCustomPrompt(category, type);
      if (selectedType === type) {
        setSelectedType(null);
        setEditingPrompt(null);
      }
    }
  };

  const handleSetActive = (category, type) => {
    setActivePrompt(category, type);
  };

  // Prompt listesini al ve filtrele
  let promptTypes = sortPromptsByProvider(getPromptTypes(selectedCategory));
  
  // Llama promptlarını sadece local/mlx provider'da göster
  promptTypes = promptTypes.filter(promptType => {
    const prompt = getPrompt(selectedCategory, promptType.key);
    const isLlamaPrompt = promptType.key.includes('llama') || prompt?.optimizedFor === 'llama';
    
    // Eğer llama promptu ise, sadece local veya mlx provider'da göster
    if (isLlamaPrompt) {
      return provider === 'local' || provider === 'mlx';
    }
    
    return true;
  });
  
  const selectedPrompt = selectedType ? getPrompt(selectedCategory, selectedType) : null;
  const isDefault = selectedPrompt && defaultPrompts[selectedCategory]?.[selectedType];

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-gradient-to-r from-cinema-accent/10 to-cinema-accent/5 p-4 rounded-lg border border-cinema-accent/20">
        <h3 className="text-lg font-semibold text-cinema-accent mb-2">🎯 AI Analiz Ayarları</h3>
        <p className="text-sm text-cinema-text-dim">
          Yapay zeka analiz komutlarını düzenleyin, yeni analiz türleri ekleyin veya mevcut analizleri özelleştirin. 
          Google Gemini 3.0 için optimize edilmiş promptlar ile gelişmiş analiz yetenekleri.
        </p>
        <div className="mt-2 text-xs text-cinema-text-dim bg-cinema-black/30 p-2 rounded">
          💡 <strong>İpucu:</strong> Gemini 3.0 ile LED Virtual Production, profesyonel storyboard, karakter analizi ve hikaye yapısı analizleri. 🟣 Gemini 3 optimize promptları önceliklidir.
        </div>
      </div>

      {/* Export/Import Section - Single Line */}
      <div className="bg-cinema-bg border border-cinema-gray rounded-lg p-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-cinema-text-dim">💾</span>
          
          <button
            onClick={() => {
              try {
                console.log('🚀 Export butonu tıklandı');
                const result = exportAllPrompts();
                console.log('📦 Export sonucu:', result);
                alert('✅ Tüm promptlar başarıyla dışa aktarıldı!\n\n' + 
                      `Toplam: ${result.metadata.totalPrompts} prompt\n` +
                      `Default: ${result.metadata.defaultPrompts}\n` +
                      `Custom: ${result.metadata.customPrompts}`);
              } catch (error) {
                console.error('❌ Export hatası:', error);
                alert('❌ Dışa aktarma hatası: ' + error.message);
              }
            }}
            className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs transition-colors flex items-center gap-1"
          >
            <span>📤</span>
            <span>Tümünü Dışa Aktar</span>
          </button>
          
          <span className="text-xs text-cinema-text-dim">|</span>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;

              const reader = new FileReader();
              reader.onload = (event) => {
                try {
                  console.log('📂 JSON dosyası okunuyor...');
                  const jsonData = JSON.parse(event.target.result);
                  console.log('✓ JSON parse başarılı:', {
                    version: jsonData.version,
                    hasPrompts: !!jsonData.prompts,
                    hasCustomPrompts: !!jsonData.customPrompts,
                    keys: Object.keys(jsonData)
                  });
                  
                  const result = importPrompts(jsonData, {
                    merge: importMode === 'merge',
                    overwrite: importMode === 'replace'
                  });

                  console.log('📊 Import sonucu:', result);

                  if (result.success) {
                    const mode = importMode === 'merge' ? 'Birleştirme' : 'Değiştirme';
                    alert(`✅ ${result.imported} prompt başarıyla içe aktarıldı!\n\nMod: ${mode}\nSayfa yeniden yüklenecek...`);
                    
                    // localStorage'ın flush olması için kısa gecikme
                    setTimeout(() => {
                      window.location.reload();
                    }, 100);
                  } else {
                    alert(`❌ İçe aktarma hatası:\n\n${result.error}\n\nKonsolu (F12) kontrol edin.`);
                  }
                } catch (error) {
                  console.error('❌ JSON parse hatası:', error);
                  alert('❌ JSON dosyası okunamadı:\n\n' + error.message + '\n\nDosya formatını kontrol edin.');
                }
              };
              reader.readAsText(file);
              e.target.value = '';
            }}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs transition-colors flex items-center gap-1"
          >
            <span>📥</span>
            <span>İçe Aktar</span>
          </button>
          
          <label className="flex items-center gap-1 text-xs text-cinema-text-dim cursor-pointer">
            <input
              type="radio"
              name="importMode"
              value="merge"
              checked={importMode === 'merge'}
              onChange={(e) => setImportMode(e.target.value)}
              className="accent-cinema-accent"
            />
            <span>Birleştir</span>
          </label>
          <label className="flex items-center gap-1 text-xs text-cinema-text-dim cursor-pointer">
            <input
              type="radio"
              name="importMode"
              value="replace"
              checked={importMode === 'replace'}
              onChange={(e) => setImportMode(e.target.value)}
              className="accent-cinema-accent"
            />
            <span>Değiştir</span>
          </label>
        </div>
      </div>

      {/* Categories */}
      <div className="grid grid-cols-4 gap-3">
        {Object.entries(categories).map(([key, cat]) => {
          const promptCount = getPromptTypes(key).length;
          return (
            <button
              key={key}
              onClick={() => {
                setSelectedCategory(key);
                setSelectedType(null);
                setEditingPrompt(null);
                setIsCreating(false);
              }}
              className={`p-4 rounded-lg border-2 transition-all text-left relative ${
                selectedCategory === key
                  ? 'border-cinema-accent bg-cinema-accent/10'
                  : 'border-cinema-gray hover:border-cinema-gray-light bg-cinema-gray/20'
              }`}
              style={{
                borderLeftColor: cat.color,
                borderLeftWidth: '4px'
              }}
            >
              <div className="text-2xl mb-1">{cat.icon}</div>
              <div className="text-sm font-semibold text-cinema-text mb-1">{cat.name}</div>
              <div className="text-xs text-cinema-text-dim line-clamp-2">{cat.description}</div>
              <div className="absolute top-2 right-2 bg-cinema-accent/20 text-cinema-accent text-xs px-2 py-0.5 rounded-full">
                {promptCount}
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prompt List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-cinema-text">
              {categories[selectedCategory]?.name || 'Prompt'} Komutları
            </h4>
            <button
              onClick={() => {
                setIsCreating(true);
                setSelectedType(null);
                setEditingPrompt(null);
              }}
              className="px-3 py-1 bg-cinema-accent text-black rounded-lg text-sm hover:bg-cinema-accent-light transition-colors"
            >
              + Yeni Ekle
            </button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {promptTypes.map(({ key, name, isCustom, id }) => {
              const prompt = getPrompt(selectedCategory, key);
              const tags = prompt?.tags || [];
              const usedBy = prompt?.usedBy || [];
              
              return (
                <div
                  key={key}
                  className={`p-3 rounded-lg border transition-all cursor-pointer ${
                    selectedType === key
                      ? 'border-cinema-accent bg-cinema-accent/10'
                      : 'border-cinema-gray hover:border-cinema-gray-light bg-cinema-gray/20'
                  }`}
                  onClick={() => {
                    setSelectedType(key);
                    setEditingPrompt(null);
                    setIsCreating(false);
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="font-medium text-cinema-text">{name}</span>
                        {(key.includes('gemini3') || key.includes('g3')) && provider === 'gemini' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs font-medium">
                            <span className="text-[10px]">🟣</span> Gemini 3
                          </span>
                        )}
                        {key.includes('llama') && (provider === 'local' || provider === 'mlx') && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs font-medium">
                            <span className="text-[10px]">🦙</span> Optimize
                          </span>
                        )}
                        {isCustom && (
                          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
                            Özel
                          </span>
                        )}
                      </div>
                      
                      {/* Tags */}
                      {tags.length > 0 && (
                        <div className="flex items-center gap-1 mb-1.5 flex-wrap">
                          {tags.map(tag => (
                            <span key={tag} className="px-1.5 py-0.5 bg-cinema-gray-light/20 text-cinema-text-dim rounded text-[11px]">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      {/* Used By */}
                      {usedBy.length > 0 && (
                        <div className="inline-flex items-center gap-1.5 text-[11px] text-cinema-text-dim">
                          <span className="text-xs">📍</span>
                          <span>
                            {usedBy.map((module, idx) => (
                              <span key={module}>
                                {module === 'analysis_panel' && 'Analiz'}
                                {module === 'storyboard' && 'Storyboard'}
                                {module === 'speed_reader' && 'Hızlı Okuma'}
                                {idx < usedBy.length - 1 && ' · '}
                              </span>
                            ))}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditPrompt(selectedCategory, key);
                        }}
                        className="p-1.5 hover:bg-cinema-gray rounded transition-colors text-cinema-text-dim hover:text-white"
                        title="Düzenle"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      {isCustom && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePrompt(selectedCategory, key);
                          }}
                          className="p-1.5 hover:bg-red-600/20 rounded transition-colors text-cinema-text-dim hover:text-red-400"
                          title="Sil"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Prompt Editor/Viewer */}
        <div className="space-y-4">
          {isCreating ? (
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-cinema-text">Yeni Prompt Oluştur</h4>
              
              <div>
                <label className="text-cinema-text font-medium block mb-2">Prompt Adı</label>
                <input
                  type="text"
                  value={newPromptData.name}
                  onChange={(e) => setNewPromptData({ ...newPromptData, name: e.target.value })}
                  placeholder="Örn: Gelişmiş Karakter Analizi"
                  className="w-full px-3 py-2 bg-cinema-gray border border-cinema-gray-light rounded-lg text-cinema-text focus:outline-none focus:border-cinema-accent transition-colors"
                />
              </div>
              
              <div>
                <label className="text-cinema-text font-medium block mb-2">
                  Kullanılacağı Modüller <span className="text-xs text-cinema-text-dim">(en az bir modül seçin)</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['analysis_panel', 'storyboard', 'speed_reader'].map(module => (
                    <label key={module} className="flex items-center gap-2 p-2 bg-cinema-gray/20 rounded border border-cinema-gray-light hover:border-cinema-accent transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPromptData.usedBy?.includes(module) || false}
                        onChange={(e) => {
                          const usedBy = newPromptData.usedBy || [];
                          setNewPromptData({
                            ...newPromptData,
                            usedBy: e.target.checked
                              ? [...usedBy, module]
                              : usedBy.filter(m => m !== module)
                          });
                        }}
                        className="accent-cinema-accent"
                      />
                      <span className="text-sm text-cinema-text">
                        {module === 'analysis_panel' && '🎬 Analiz Paneli'}
                        {module === 'storyboard' && '🎯 Storyboard'}
                        {module === 'speed_reader' && '⚡ Hızlı Okuma'}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-cinema-text-dim mt-2">
                  💡 Seçilen modüllerde bu prompt kullanılabilir olacaktır
                </p>
              </div>

              <div>
                <label className="text-cinema-text font-medium block mb-2">
                  System Prompt (AI'nin rolü ve kuralları)
                </label>
                <div className="text-xs text-cinema-text-dim mb-1">
                  💡 Markdown formatında yazabilirsiniz: **kalın**, *italik*, • madde işaretleri
                </div>
                <textarea
                  value={newPromptData.system}
                  onChange={(e) => setNewPromptData({ ...newPromptData, system: e.target.value })}
                  rows={8}
                  placeholder="Örnek:&#10;Sen bir senaryo analiz uzmanısın.&#10;&#10;Görevin:&#10;• Karakterleri derinlemesine analiz et&#10;• Motivasyonları belirle&#10;• Gelişim eğrilerini çıkar"
                  className="w-full px-3 py-2 bg-cinema-gray border border-cinema-gray-light rounded-lg text-cinema-text focus:outline-none focus:border-cinema-accent transition-colors resize-none font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-cinema-text font-medium block mb-2">
                  User Prompt (Analiz talimatı)
                </label>
                <div className="text-xs text-cinema-text-dim mb-1">
                  💡 Madde işaretleri ve numaralandırma kullanarak net talimatlar verin
                </div>
                <textarea
                  value={newPromptData.user}
                  onChange={(e) => setNewPromptData({ ...newPromptData, user: e.target.value })}
                  rows={8}
                  placeholder="Örnek:&#10;Bu senaryoyu LED Volume çekimi için analiz et:&#10;&#10;1. Hangi sahneler LED duvar ile çekilebilir?&#10;2. Dış mekan sahneleri uygun mu?&#10;3. Gerekli 3D ortamlar neler?"
                  className="w-full px-3 py-2 bg-cinema-gray border border-cinema-gray-light rounded-lg text-cinema-text focus:outline-none focus:border-cinema-accent transition-colors resize-none font-mono text-sm"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCreatePrompt}
                  disabled={!newPromptData.name || !newPromptData.system || !newPromptData.user}
                  className="px-4 py-2 bg-cinema-accent text-black rounded-lg hover:bg-cinema-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Oluştur
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setNewPromptData({ name: '', system: '', user: '' });
                  }}
                  className="px-4 py-2 bg-cinema-gray text-cinema-text rounded-lg hover:bg-cinema-gray-light transition-colors"
                >
                  İptal
                </button>
              </div>
            </div>
          ) : editingPrompt ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-cinema-text">Prompt Düzenle</h4>
                {isDefault && (
                  <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs">
                    ⚠️ Varsayılan şablon - değişiklikler özel kopya olarak kaydedilir
                  </span>
                )}
              </div>
              
              <div>
                <label className="text-cinema-text font-medium block mb-2">Prompt Adı</label>
                <input
                  type="text"
                  value={editingPrompt.name}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, name: e.target.value })}
                  className="w-full px-3 py-2 bg-cinema-gray border border-cinema-gray-light rounded-lg text-cinema-text focus:outline-none focus:border-cinema-accent transition-colors"
                />
              </div>
              
              <div>
                <label className="text-cinema-text font-medium block mb-2">
                  Kullanılacağı Modüller <span className="text-xs text-cinema-text-dim">(en az bir modül seçin)</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['analysis_panel', 'storyboard', 'speed_reader'].map(module => (
                    <label key={module} className="flex items-center gap-2 p-2 bg-cinema-gray/20 rounded border border-cinema-gray-light hover:border-cinema-accent transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingPrompt.usedBy?.includes(module) || false}
                        onChange={(e) => {
                          const usedBy = editingPrompt.usedBy || [];
                          setEditingPrompt({
                            ...editingPrompt,
                            usedBy: e.target.checked
                              ? [...usedBy, module]
                              : usedBy.filter(m => m !== module)
                          });
                        }}
                        className="accent-cinema-accent"
                      />
                      <span className="text-sm text-cinema-text">
                        {module === 'analysis_panel' && '🎬 Analiz Paneli'}
                        {module === 'storyboard' && '🎯 Storyboard'}
                        {module === 'speed_reader' && '⚡ Hızlı Okuma'}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-cinema-text-dim mt-2">
                  💡 Seçilen modüllerde bu prompt kullanılabilir olacaktır
                </p>
              </div>

              <div>
                <label className="text-cinema-text font-medium block mb-2">
                  System Prompt (AI Rolü)
                </label>
                <div className="text-xs text-cinema-text-dim mb-1">
                  📝 Markdown formatında düzenlenebilir: **kalın**, *italik*, • liste
                </div>
                <textarea
                  value={editingPrompt.system}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, system: e.target.value })}
                  rows={8}
                  className="w-full px-3 py-2 bg-cinema-gray border border-cinema-gray-light rounded-lg text-cinema-text focus:outline-none focus:border-cinema-accent transition-colors resize-none font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-cinema-text font-medium block mb-2">
                  User Prompt (Analiz Talimatı)
                </label>
                <div className="text-xs text-cinema-text-dim mb-1">
                  📝 Net ve yapılandırılmış talimatlar verin
                </div>
                <textarea
                  value={editingPrompt.user}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, user: e.target.value })}
                  rows={8}
                  className="w-full px-3 py-2 bg-cinema-gray border border-cinema-gray-light rounded-lg text-cinema-text focus:outline-none focus:border-cinema-accent transition-colors resize-none font-mono text-sm"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSavePrompt}
                  className="px-4 py-2 bg-cinema-accent text-black rounded-lg hover:bg-cinema-accent-light transition-colors"
                >
                  Kaydet
                </button>
                <button
                  onClick={() => setEditingPrompt(null)}
                  className="px-4 py-2 bg-cinema-gray text-cinema-text rounded-lg hover:bg-cinema-gray-light transition-colors"
                >
                  İptal
                </button>
              </div>
            </div>
          ) : selectedPrompt ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="text-lg font-semibold text-cinema-text">{selectedPrompt.name}</h4>
                  {isDefault && (
                    <p className="text-xs text-cinema-text-dim mt-1">
                      📦 Varsayılan şablon - Düzenlemek için klonlanır
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditPrompt(selectedCategory, selectedType)}
                    className="px-3 py-1 bg-cinema-accent text-black rounded-lg text-sm hover:bg-cinema-accent-light transition-colors"
                  >
                    ✏️ Düzenle
                  </button>
                </div>
              </div>

              <div>
                <label className="text-cinema-text font-medium block mb-2">
                  System Prompt (AI Rolü)
                </label>
                <div className="p-3 bg-cinema-gray/20 border border-cinema-gray-light rounded-lg text-sm text-cinema-text-dim whitespace-pre-wrap font-mono">
                  {selectedPrompt.system}
                </div>
              </div>

              <div>
                <label className="text-cinema-text font-medium block mb-2">
                  User Prompt (Analiz Talimatı)
                </label>
                <div className="p-3 bg-cinema-gray/20 border border-cinema-gray-light rounded-lg text-sm text-cinema-text-dim whitespace-pre-wrap font-mono">
                  {selectedPrompt.user}
                </div>
              </div>

              {activePrompts[selectedCategory] === selectedType && (
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <p className="text-green-400 text-sm flex items-center gap-2">
                    ✅ Bu prompt şu an aktif olarak kullanılıyor
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-cinema-text-dim">
              <p>Düzenlemek veya görüntülemek için bir prompt seçin</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}