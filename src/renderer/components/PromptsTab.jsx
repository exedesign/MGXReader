import React, { useState } from 'react';
import { useAIStore } from '../store/aiStore';

export default function PromptsTab({
  getPromptTypes,
  getPrompt,
  getAllPrompts,
  saveCustomPrompt,
  deleteCustomPrompt,
  setActivePrompt,
  activePrompts,
  defaultPrompts
}) {
  const { provider } = useAIStore(); // Provider bilgisini al
  const [selectedCategory, setSelectedCategory] = useState('analysis');
  const [selectedType, setSelectedType] = useState(null);
  const [editingPrompt, setEditingPrompt] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newPromptData, setNewPromptData] = useState({
    name: '',
    system: '',
    user: ''
  });

  const categories = {
    analysis: { name: 'Senaryo Analizi', icon: '📝' },
    grammar: { name: 'Grammar Düzeltme', icon: '✏️' },
    speed_reading: { name: 'Hızlı Okuma', icon: '⚡' }
  };

  // Provider'a göre prompt'ları sırala - Llama optimize olanları önce göster
  const sortPromptsByProvider = (promptTypes) => {
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
    setEditingPrompt({ category, type, ...prompt });
    setSelectedType(type);
  };

  const handleSavePrompt = () => {
    if (editingPrompt) {
      saveCustomPrompt(editingPrompt.category, selectedType, {
        name: editingPrompt.name,
        system: editingPrompt.system,
        user: editingPrompt.user
      });
      setEditingPrompt(null);
    }
  };

  const handleCreatePrompt = () => {
    if (newPromptData.name && newPromptData.system && newPromptData.user) {
      const key = newPromptData.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      saveCustomPrompt(selectedCategory, key, newPromptData);
      setNewPromptData({ name: '', system: '', user: '' });
      setIsCreating(false);
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

  const promptTypes = sortPromptsByProvider(getPromptTypes(selectedCategory));
  const selectedPrompt = selectedType ? getPrompt(selectedCategory, selectedType) : null;
  const isDefault = selectedPrompt && defaultPrompts[selectedCategory]?.[selectedType];

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-gradient-to-r from-cinema-accent/10 to-cinema-accent/5 p-4 rounded-lg border border-cinema-accent/20">
        <h3 className="text-lg font-semibold text-cinema-accent mb-2">Özel AI Komutları</h3>
        <p className="text-sm text-cinema-text-dim">
          AI analiz ve düzeltme işlemleri için kendi kurallarınızı ve komutlarınızı oluşturun. 
          Varsayılan şablonları düzenleyebilir veya yeni özel komutlar ekleyebilirsiniz.
        </p>
      </div>

      {/* Categories */}
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(categories).map(([key, cat]) => (
          <button
            key={key}
            onClick={() => {
              setSelectedCategory(key);
              setSelectedType(null);
              setEditingPrompt(null);
              setIsCreating(false);
            }}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              selectedCategory === key
                ? 'border-cinema-accent bg-cinema-accent/10'
                : 'border-cinema-gray hover:border-cinema-gray-light bg-cinema-gray/20'
            }`}
          >
            <div className="text-2xl mb-2">{cat.icon}</div>
            <div className="text-sm font-medium text-cinema-text">{cat.name}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prompt List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-cinema-text">
              {categories[selectedCategory].name} Komutları
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
            {promptTypes.map(({ key, name, isCustom }) => (
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
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-cinema-text">{name}</span>
                      {key.includes('llama') && (provider === 'local' || provider === 'mlx') && (
                        <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs">
                          🦙 Optimize
                        </span>
                      )}
                      {isCustom && (
                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">
                          Özel
                        </span>
                      )}
                      {activePrompts[selectedCategory] === key && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">
                          Aktif
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {activePrompts[selectedCategory] !== key && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetActive(selectedCategory, key);
                        }}
                        className="p-1 hover:bg-cinema-gray rounded text-xs text-cinema-text-dim hover:text-white"
                        title="Aktif yap"
                      >
                        ⭐
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditPrompt(selectedCategory, key);
                      }}
                      className="p-1 hover:bg-cinema-gray rounded text-xs text-cinema-text-dim hover:text-white"
                      title="Düzenle"
                    >
                      ✏️
                    </button>
                    {isCustom && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePrompt(selectedCategory, key);
                        }}
                        className="p-1 hover:bg-red-600 rounded text-xs text-cinema-text-dim hover:text-white"
                        title="Sil"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
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
                  System Prompt (AI'nin rolü ve kuralları)
                </label>
                <textarea
                  value={newPromptData.system}
                  onChange={(e) => setNewPromptData({ ...newPromptData, system: e.target.value })}
                  rows={6}
                  placeholder="AI'nin nasıl davranacağını ve hangi kurallara uyacağını belirtin..."
                  className="w-full px-3 py-2 bg-cinema-gray border border-cinema-gray-light rounded-lg text-cinema-text focus:outline-none focus:border-cinema-accent transition-colors resize-none"
                />
              </div>

              <div>
                <label className="text-cinema-text font-medium block mb-2">
                  User Prompt (Kullanıcı talimatı)
                </label>
                <textarea
                  value={newPromptData.user}
                  onChange={(e) => setNewPromptData({ ...newPromptData, user: e.target.value })}
                  rows={6}
                  placeholder="AI'nin kullanıcı metnini nasıl işleyeceğini belirtin..."
                  className="w-full px-3 py-2 bg-cinema-gray border border-cinema-gray-light rounded-lg text-cinema-text focus:outline-none focus:border-cinema-accent transition-colors resize-none"
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
                  System Prompt
                </label>
                <textarea
                  value={editingPrompt.system}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, system: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 bg-cinema-gray border border-cinema-gray-light rounded-lg text-cinema-text focus:outline-none focus:border-cinema-accent transition-colors resize-none"
                />
              </div>

              <div>
                <label className="text-cinema-text font-medium block mb-2">
                  User Prompt
                </label>
                <textarea
                  value={editingPrompt.user}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, user: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 bg-cinema-gray border border-cinema-gray-light rounded-lg text-cinema-text focus:outline-none focus:border-cinema-accent transition-colors resize-none"
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
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-cinema-text">{selectedPrompt.name}</h4>
                <div className="flex gap-2">
                  {activePrompts[selectedCategory] !== selectedType && (
                    <button
                      onClick={() => handleSetActive(selectedCategory, selectedType)}
                      className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
                    >
                      Aktif Yap
                    </button>
                  )}
                  <button
                    onClick={() => handleEditPrompt(selectedCategory, selectedType)}
                    className="px-3 py-1 bg-cinema-accent text-black rounded-lg text-sm hover:bg-cinema-accent-light transition-colors"
                  >
                    Düzenle
                  </button>
                </div>
              </div>

              <div>
                <label className="text-cinema-text font-medium block mb-2">
                  System Prompt (AI Rolü)
                </label>
                <div className="p-3 bg-cinema-gray/20 border border-cinema-gray-light rounded-lg text-sm text-cinema-text-dim">
                  {selectedPrompt.system}
                </div>
              </div>

              <div>
                <label className="text-cinema-text font-medium block mb-2">
                  User Prompt (Talimat)
                </label>
                <div className="p-3 bg-cinema-gray/20 border border-cinema-gray-light rounded-lg text-sm text-cinema-text-dim">
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