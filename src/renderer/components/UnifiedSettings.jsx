import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAIStore } from '../store/aiStore';
import { usePromptStore } from '../store/promptStore';
import { useReaderStore } from '../store/readerStore';
import { useFeatureStore } from '../store/featureStore';
import { usePoseStore } from '../store/poseStore';
import { AI_PROVIDERS } from '../utils/aiHandler';
import { CURRENCIES, getSavedCurrencyPreference, saveCurrencyPreference, convertFromUSD } from '../utils/currencyConverter';
import ProvidersTab from './ProvidersTab';
import PromptsTab from './PromptsTab';
import TokenUsageDisplay from './TokenUsageDisplay';
import { getBudgetSettings, saveBudgetSettings } from '../utils/budgetAlarm';

// Character Poses Tab Component
function CharacterPosesTab() {
  const poseStore = usePoseStore();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingPose, setEditingPose] = useState(null);
  const [newPose, setNewPose] = useState({
    name: '',
    description: '',
    prompt: '',
    icon: '🎭',
    category: 'custom'
  });

  // Debug
  React.useEffect(() => {
    console.log('🎭 CharacterPosesTab mounted');
    console.log('📊 Pose templates:', poseStore.poseTemplates?.length);
    console.log('🖼️ Pose reference images:', poseStore.poseReferenceImages?.length);
  }, []);

  const filteredPoses = selectedCategory === 'all'
    ? poseStore.poseTemplates
    : poseStore.poseTemplates.filter(p => p.category === selectedCategory);

  const handleAddPose = () => {
    if (!newPose.name || !newPose.prompt) {
      alert('Poz adı ve prompt alanları zorunludur!');
      return;
    }

    poseStore.addPoseTemplate(newPose);
    setNewPose({
      name: '',
      description: '',
      prompt: '',
      icon: '🎭',
      category: 'custom'
    });
  };

  const handleUpdatePose = () => {
    if (!editingPose) return;
    
    poseStore.updatePoseTemplate(editingPose.id, {
      name: editingPose.name,
      description: editingPose.description,
      prompt: editingPose.prompt,
      icon: editingPose.icon,
      category: editingPose.category
    });
    
    setEditingPose(null);
  };

  const handleDeletePose = (id) => {
    if (window.confirm('Bu poz şablonunu silmek istediğinizden emin misiniz?')) {
      const success = poseStore.deletePoseTemplate(id);
      if (!success) {
        alert('Varsayılan poz şablonları silinemez!');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-cinema-text mb-2">Karakter Poz Şablonları</h3>
        <p className="text-sm text-cinema-text-dim">
          Storyboard'da kullanılacak karakter poz şablonlarını yönetin. Bu pozlar character sheet oluşturmak için kullanılır.
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-lg transition-all ${
            selectedCategory === 'all'
              ? 'bg-cinema-accent text-cinema-black font-medium'
              : 'bg-cinema-gray/50 text-cinema-text hover:bg-cinema-gray'
          }`}
        >
          📋 Tümü ({poseStore.poseTemplates.length})
        </button>
        {poseStore.categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-lg transition-all ${
              selectedCategory === cat.id
                ? 'bg-cinema-accent text-cinema-black font-medium'
                : 'bg-cinema-gray/50 text-cinema-text hover:bg-cinema-gray'
            }`}
          >
            {cat.icon} {cat.name} ({poseStore.getPosesByCategory(cat.id).length})
          </button>
        ))}
      </div>

      {/* Add New Pose Form */}
      <div className="bg-cinema-gray/20 p-6 rounded-lg border border-cinema-gray">
        <h4 className="text-lg font-semibold text-cinema-text mb-4">➕ Yeni Poz Ekle</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-cinema-text mb-2">Poz Adı *</label>
            <input
              type="text"
              value={newPose.name}
              onChange={(e) => setNewPose({ ...newPose, name: e.target.value })}
              placeholder="Örn: Koşma Pozu"
              className="w-full bg-cinema-black/60 border border-cinema-gray rounded-lg px-4 py-2 text-cinema-text focus:ring-2 focus:ring-cinema-accent focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-cinema-text mb-2">İkon</label>
            <input
              type="text"
              value={newPose.icon}
              onChange={(e) => setNewPose({ ...newPose, icon: e.target.value })}
              placeholder="🏃"
              className="w-full bg-cinema-black/60 border border-cinema-gray rounded-lg px-4 py-2 text-cinema-text focus:ring-2 focus:ring-cinema-accent focus:border-transparent"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-cinema-text mb-2">Açıklama</label>
            <input
              type="text"
              value={newPose.description}
              onChange={(e) => setNewPose({ ...newPose, description: e.target.value })}
              placeholder="Bu pozun kısa açıklaması"
              className="w-full bg-cinema-black/60 border border-cinema-gray rounded-lg px-4 py-2 text-cinema-text focus:ring-2 focus:ring-cinema-accent focus:border-transparent"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-cinema-text mb-2">Prompt *</label>
            <textarea
              value={newPose.prompt}
              onChange={(e) => setNewPose({ ...newPose, prompt: e.target.value })}
              placeholder="full body running pose, dynamic movement, character sheet style, white background"
              rows="3"
              className="w-full bg-cinema-black/60 border border-cinema-gray rounded-lg px-4 py-2 text-cinema-text focus:ring-2 focus:ring-cinema-accent focus:border-transparent resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-cinema-text mb-2">Kategori</label>
            <select
              value={newPose.category}
              onChange={(e) => setNewPose({ ...newPose, category: e.target.value })}
              className="w-full bg-cinema-black/60 border border-cinema-gray rounded-lg px-4 py-2 text-cinema-text focus:ring-2 focus:ring-cinema-accent focus:border-transparent"
            >
              {poseStore.categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleAddPose}
              className="w-full bg-cinema-accent hover:bg-cinema-accent/80 text-cinema-black font-medium px-4 py-2 rounded-lg transition-colors"
            >
              ➕ Poz Ekle
            </button>
          </div>
        </div>
      </div>

      {/* Pose List */}
      <div className="space-y-3">
        <h4 className="text-lg font-semibold text-cinema-text">
          Mevcut Pozlar ({filteredPoses.length})
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPoses.map(pose => (
            <div
              key={pose.id}
              className="bg-cinema-gray/20 rounded-lg border border-cinema-gray p-4 hover:border-cinema-accent/50 transition-all"
            >
              {editingPose?.id === pose.id ? (
                // Edit Mode
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editingPose.icon}
                      onChange={(e) => setEditingPose({ ...editingPose, icon: e.target.value })}
                      className="w-16 bg-cinema-black/60 border border-cinema-gray rounded px-2 py-1 text-cinema-text text-center"
                    />
                    <input
                      type="text"
                      value={editingPose.name}
                      onChange={(e) => setEditingPose({ ...editingPose, name: e.target.value })}
                      className="flex-1 bg-cinema-black/60 border border-cinema-gray rounded px-3 py-1 text-cinema-text font-medium"
                    />
                  </div>
                  <input
                    type="text"
                    value={editingPose.description}
                    onChange={(e) => setEditingPose({ ...editingPose, description: e.target.value })}
                    className="w-full bg-cinema-black/60 border border-cinema-gray rounded px-3 py-1 text-cinema-text text-sm"
                  />
                  <textarea
                    value={editingPose.prompt}
                    onChange={(e) => setEditingPose({ ...editingPose, prompt: e.target.value })}
                    rows="3"
                    className="w-full bg-cinema-black/60 border border-cinema-gray rounded px-3 py-2 text-cinema-text text-sm resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdatePose}
                      className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 px-3 py-1.5 rounded text-sm transition-colors"
                    >
                      ✓ Kaydet
                    </button>
                    <button
                      onClick={() => setEditingPose(null)}
                      className="flex-1 bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 px-3 py-1.5 rounded text-sm transition-colors"
                    >
                      ✕ İptal
                    </button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{pose.icon}</span>
                      <div>
                        <h5 className="font-medium text-cinema-text">{pose.name}</h5>
                        {pose.description && (
                          <p className="text-xs text-cinema-text-dim">{pose.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {!pose.isDefault && (
                        <>
                          <button
                            onClick={() => setEditingPose(pose)}
                            className="p-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded transition-colors"
                            title="Düzenle"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeletePose(pose.id)}
                            className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors"
                            title="Sil"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </>
                      )}
                      {pose.isDefault && (
                        <span className="px-2 py-1 bg-cinema-accent/20 text-cinema-accent text-xs rounded">
                          Varsayılan
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="bg-cinema-black/40 rounded p-2 mt-2">
                    <p className="text-xs text-cinema-text-dim font-mono">{pose.prompt}</p>
                  </div>
                  <div className="mt-2">
                    <span className="text-xs px-2 py-1 bg-cinema-gray/50 text-cinema-text-dim rounded">
                      {poseStore.categories.find(c => c.id === pose.category)?.icon} {poseStore.categories.find(c => c.id === pose.category)?.name}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pose Reference Images Section */}
      <div className="bg-cinema-gray/20 p-6 rounded-lg border border-cinema-gray">
        <h4 className="text-lg font-semibold text-cinema-text mb-4">🖼️ Hazır Poz Referans Görselleri</h4>
        <p className="text-sm text-cinema-text-dim mb-4">
          Character sheet, skeleton rig veya hazır poz görsellerinizi yükleyin. Bu görseller karakter üretirken referans olarak kullanılabilir.
        </p>
        
        <PoseReferenceImagesManager poseStore={poseStore} />
      </div>

      {/* Reset Button */}
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h5 className="font-medium text-yellow-400">Varsayılan Pozları Geri Yükle</h5>
            <p className="text-xs text-cinema-text-dim mt-1">
              Tüm varsayılan poz şablonlarını geri yükler (özel pozlarınız korunur)
            </p>
          </div>
          <button
            onClick={() => {
              if (window.confirm('Varsayılan pozları geri yüklemek istediğinizden emin misiniz?')) {
                poseStore.resetToDefaults();
              }
            }}
            className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            🔄 Geri Yükle
          </button>
        </div>
      </div>
    </div>
  );
}

// Pose Reference Images Manager Component
function PoseReferenceImagesManager({ poseStore }) {
  const [uploadingImage, setUploadingImage] = useState(null);
  const [newImageData, setNewImageData] = useState({
    name: '',
    description: '',
    category: 'custom',
    tags: []
  });
  const fileInputRef = React.useRef(null);

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Lütfen geçerli bir görsel dosyası seçin!');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadingImage({
        imageUrl: e.target.result,
        mimeType: file.type,
        fileName: file.name
      });
      setNewImageData({
        ...newImageData,
        name: file.name.replace(/\.[^/.]+$/, '')
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveImage = () => {
    if (!uploadingImage) return;
    if (!newImageData.name.trim()) {
      alert('Lütfen görsel için bir ad girin!');
      return;
    }

    poseStore.addPoseReferenceImage({
      ...newImageData,
      imageUrl: uploadingImage.imageUrl,
      mimeType: uploadingImage.mimeType
    });

    // Reset
    setUploadingImage(null);
    setNewImageData({
      name: '',
      description: '',
      category: 'custom',
      tags: []
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteImage = (id) => {
    if (window.confirm('Bu referans görselini silmek istediğinizden emin misiniz?')) {
      poseStore.deletePoseReferenceImage(id);
    }
  };

  const referenceImages = poseStore.poseReferenceImages || [];

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      <div className="border-2 border-dashed border-cinema-gray rounded-lg p-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
        
        {!uploadingImage ? (
          <div className="text-center">
            <div className="text-4xl mb-2">📤</div>
            <p className="text-sm text-cinema-text mb-3">
              Hazır poz görselinizi yükleyin (skeleton rig, character sheet, vb.)
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-cinema-accent hover:bg-cinema-accent/80 text-cinema-black px-4 py-2 rounded-lg transition-colors text-sm"
            >
              Görsel Seç
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-4">
              <img
                src={uploadingImage.imageUrl}
                alt="Preview"
                className="w-32 h-32 object-contain bg-cinema-black/40 rounded border border-cinema-gray"
              />
              <div className="flex-1 space-y-2">
                <div>
                  <label className="block text-xs font-medium text-cinema-text mb-1">Görsel Adı *</label>
                  <input
                    type="text"
                    value={newImageData.name}
                    onChange={(e) => setNewImageData({ ...newImageData, name: e.target.value })}
                    placeholder="Örn: Full Body Rig"
                    className="w-full bg-cinema-black/60 border border-cinema-gray rounded px-3 py-1.5 text-cinema-text text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-cinema-text mb-1">Açıklama</label>
                  <input
                    type="text"
                    value={newImageData.description}
                    onChange={(e) => setNewImageData({ ...newImageData, description: e.target.value })}
                    placeholder="Kısa açıklama"
                    className="w-full bg-cinema-black/60 border border-cinema-gray rounded px-3 py-1.5 text-cinema-text text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-cinema-text mb-1">Kategori</label>
                  <select
                    value={newImageData.category}
                    onChange={(e) => setNewImageData({ ...newImageData, category: e.target.value })}
                    className="w-full bg-cinema-black/60 border border-cinema-gray rounded px-3 py-1.5 text-cinema-text text-sm"
                  >
                    {poseStore.categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveImage}
                className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 px-4 py-2 rounded-lg transition-colors text-sm"
              >
                ✓ Kaydet
              </button>
              <button
                onClick={() => {
                  setUploadingImage(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="flex-1 bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 px-4 py-2 rounded-lg transition-colors text-sm"
              >
                ✕ İptal
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Existing Images */}
      {referenceImages.length > 0 && (
        <div>
          <h5 className="text-sm font-medium text-cinema-text mb-3">
            Yüklü Referans Görselleri ({referenceImages.length})
          </h5>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {referenceImages.map((img) => (
              <div
                key={img.id}
                className="group relative bg-cinema-black/40 rounded-lg border border-cinema-gray overflow-hidden hover:border-cinema-accent/50 transition-all"
              >
                <img
                  src={img.imageUrl}
                  alt={img.name}
                  className="w-full h-32 object-contain bg-cinema-black/20"
                />
                <div className="p-2">
                  <h6 className="text-xs font-medium text-cinema-text line-clamp-1" title={img.name}>
                    {img.name}
                  </h6>
                  {img.description && (
                    <p className="text-xs text-cinema-text-dim line-clamp-2 mt-1">
                      {img.description}
                    </p>
                  )}
                  <span className="text-xs bg-cinema-gray/50 text-cinema-text-dim px-2 py-0.5 rounded mt-1 inline-block">
                    {poseStore.categories.find(c => c.id === img.category)?.icon} {poseStore.categories.find(c => c.id === img.category)?.name}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteImage(img.id)}
                  className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-600 text-white rounded-full transition-all opacity-0 group-hover:opacity-100"
                  title="Sil"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {referenceImages.length === 0 && (
        <div className="text-center py-8 text-cinema-text-dim text-sm">
          <div className="text-4xl mb-2">🎭</div>
          <p>Henüz referans görseli yüklenmemiş</p>
        </div>
      )}
    </div>
  );
}

export default function UnifiedSettings({ onClose, initialTab = 'ai' }) {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedCurrency, setSelectedCurrency] = useState(() => getSavedCurrencyPreference());
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

  // Budget settings state - component seviyesinde olmalı
  const [budgetSettingsState, setBudgetSettingsState] = useState(getBudgetSettings());
  const [inputKey, setInputKey] = useState(0); // Force input re-render on currency change

  // Update inputKey when currency changes to force input refresh
  useEffect(() => {
    setInputKey(prev => prev + 1);
  }, [selectedCurrency]);

  const tabs = [
    { key: 'ai', label: 'AI Ayarları', icon: '🤖' },
    { key: 'usage', label: 'Token Kullanımı', icon: '💰' },
    { key: 'modules', label: 'Modüller', icon: '🧩' },
    { key: 'prompts', label: 'Prompt Yönetimi', icon: '📝' },
    { key: 'filter', label: 'Kelime Filtresi', icon: '🔍' },
    { key: 'general', label: 'Genel Ayarlar', icon: '⚙️' },
    { key: 'appearance', label: 'Görünüm', icon: '🎨' },
    { key: 'about', label: 'Hakkında', icon: 'ℹ️' }
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
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

            {/* Token Usage Tab */}
            {activeTab === 'usage' && (
              <div className="space-y-6">
                <div className="bg-cinema-gray rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-cinema-accent mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Token Kullanımı ve Maliyet Takibi
                  </h3>
                  <p className="text-sm text-cinema-text-dim mb-6">
                    Oturum boyunca yapılan API isteklerinin token kullanımı ve maliyeti burada gösterilir. 
                    Sayaç bellekte tutulur ve uygulama kapatılıp açıldığında devam eder.
                  </p>

                  {/* Currency Selection */}
                  <div className="mb-6 p-4 bg-cinema-dark rounded-lg border border-cinema-gray">
                    <h4 className="text-sm font-semibold text-cinema-accent mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Para Birimi Tercihi
                    </h4>
                    <p className="text-xs text-cinema-text-dim mb-3">
                      Maliyet gösteriminde kullanılacak para birimini seçin. Kurlar güncel API'den otomatik çekilir.
                    </p>
                    <div className="flex items-center gap-3">
                      {Object.entries(CURRENCIES).map(([code, info]) => (
                        <button
                          key={code}
                          onClick={() => {
                            setSelectedCurrency(code);
                            saveCurrencyPreference(code);
                            window.location.reload();
                          }}
                          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                            selectedCurrency === code
                              ? 'border-cinema-accent bg-cinema-accent/10 text-cinema-accent'
                              : 'border-cinema-gray hover:border-cinema-accent/50 text-cinema-text-dim hover:text-cinema-text'
                          }`}
                        >
                          <span className="text-xl">{info.symbol}</span>
                          <div className="text-left">
                            <div className="font-semibold text-sm">{code}</div>
                            <div className="text-[10px] opacity-70">{info.name}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 text-[10px] text-cinema-text-dim flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      Kurlar günlük olarak güncellenir ve tarayıcıda 24 saat boyunca cache'lenir
                    </div>
                  </div>

                  {/* Token Usage Display */}
                  <div className="mb-6">
                    {(() => {
                      const saved = localStorage.getItem('mgxreader_token_usage');
                      if (!saved) {
                        return (
                          <div className="text-center py-12 bg-cinema-dark rounded-lg border border-cinema-gray">
                            <svg className="w-12 h-12 mx-auto text-cinema-text-dim mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-cinema-text-dim">Henüz token kullanımı yok</p>
                            <p className="text-xs text-cinema-text-dim mt-2">Analiz yaptıkça burası güncellenecek</p>
                          </div>
                        );
                      }

                      const usage = JSON.parse(saved);
                      
                      return (
                        <div className="bg-cinema-dark rounded-lg p-4">
                          <TokenUsageDisplay 
                            sessionUsage={usage} 
                            showDetailed={true}
                            currency={getSavedCurrencyPreference()}
                          />
                        </div>
                      );
                    })()}
                  </div>

                  {/* Reset Button */}
                  <div className="flex items-center justify-between p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                    <div>
                      <h4 className="text-sm font-semibold text-red-400 mb-1">Sayacı Sıfırla</h4>
                      <p className="text-xs text-cinema-text-dim">
                        Tüm token kullanımı ve maliyet verilerini temizle
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (window.confirm('Token kullanım sayacını sıfırlamak istediğinize emin misiniz?\n\nBu işlem geri alınamaz.')) {
                          localStorage.removeItem('mgxreader_token_usage');
                          alert('✅ Token sayacı sıfırlandı!\n\nYeni analizlerle sayaç yeniden başlayacak.');
                          window.location.reload();
                        }
                      }}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors border border-red-500/30 font-medium text-sm"
                    >
                      🗑️ Sıfırla
                    </button>
                  </div>

                  {/* Budget Management Section */}
                  <div className="mt-6 space-y-4">
                    <h3 className="text-lg font-semibold text-cinema-accent mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Bakiye ve Limit Yönetimi
                    </h3>

                    {/* Previous Debt Entry */}
                    <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                      <label className="block text-sm font-medium text-cinema-text mb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Kullanılan Bakiye ({selectedCurrency})</span>
                        </div>
                        <div className="text-xs text-cinema-text-dim">
                          Bu programı kullanmadan önce API'de harcadığınız tutar (USD bazlı saklanır)
                        </div>
                      </label>
                      <div className="flex gap-2">
                        <input
                          key={`previousDebt-${inputKey}`}
                          type="number"
                          step="0.01"
                          placeholder={selectedCurrency === 'USD' ? 'Örn: 950.00' : selectedCurrency === 'TRY' ? 'Örn: 30000.00' : 'Örn: 900.00'}
                          defaultValue={(() => {
                            if (!budgetSettingsState.previousDebt) return '';
                            if (selectedCurrency === 'USD') return budgetSettingsState.previousDebt;
                            return (budgetSettingsState.previousDebt * (selectedCurrency === 'TRY' ? 32 : 0.95)).toFixed(2);
                          })()}
                          onBlur={(e) => {
                            const value = e.target.value;
                            const numValue = parseFloat(value) || 0;
                            let valueInUSD = numValue;
                            if (selectedCurrency !== 'USD' && numValue > 0) {
                              valueInUSD = selectedCurrency === 'TRY' ? numValue / 32 : numValue / 0.95;
                            }
                            const newSettings = { 
                              ...budgetSettingsState, 
                              previousDebt: valueInUSD,
                              debtSetDate: new Date().toISOString()
                            };
                            setBudgetSettingsState(newSettings);
                          }}
                          className="flex-1 px-4 py-2 bg-cinema-dark border border-cinema-gray rounded-lg text-cinema-text focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                        <button
                          onClick={() => {
                            saveBudgetSettings(budgetSettingsState);
                            alert('✅ Kullanılan bakiye kaydedildi!');
                            window.location.reload();
                          }}
                          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                        >
                          Kaydet
                        </button>
                      </div>
                      {budgetSettingsState.debtSetDate && (
                        <div className="mt-2 text-xs text-cinema-text-dim">
                          Kayıt tarihi: {new Date(budgetSettingsState.debtSetDate).toLocaleString('tr-TR')}
                        </div>
                      )}
                    </div>

                    {/* Balance Limit (Optional) */}
                    <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/30">
                      <label className="block text-sm font-medium text-cinema-text mb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          <span>Maksimum Harcama Limiti ({selectedCurrency}) - Opsiyonel</span>
                        </div>
                        <div className="text-xs text-cinema-text-dim">
                          Toplam harcama bu limite ulaşınca uyarı alırsınız (boş = limitsiz, USD bazlı saklanır)
                        </div>
                      </label>
                      <input
                        key={`balanceLimit-${inputKey}`}
                        type="number"
                        step="0.01"
                        placeholder={selectedCurrency === 'USD' ? 'Örn: 500.00 (boş = limitsiz)' : selectedCurrency === 'TRY' ? 'Örn: 16000.00 (boş = limitsiz)' : 'Örn: 475.00 (boş = limitsiz)'}
                        defaultValue={(() => {
                          if (!budgetSettingsState.balanceLimit) return '';
                          if (selectedCurrency === 'USD') return budgetSettingsState.balanceLimit;
                          return (budgetSettingsState.balanceLimit * (selectedCurrency === 'TRY' ? 32 : 0.95)).toFixed(2);
                        })()}
                        onBlur={(e) => {
                          const value = e.target.value;
                          const numValue = parseFloat(value) || 0;
                          let valueInUSD = numValue;
                          if (selectedCurrency !== 'USD' && numValue > 0) {
                            valueInUSD = selectedCurrency === 'TRY' ? numValue / 32 : numValue / 0.95;
                          }
                          const newSettings = { ...budgetSettingsState, balanceLimit: valueInUSD };
                          setBudgetSettingsState(newSettings);
                          saveBudgetSettings(newSettings);
                        }}
                        className="w-full px-4 py-2 bg-cinema-dark border border-cinema-gray rounded-lg text-cinema-text focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="mt-4 p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                    <h4 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      Bilgilendirme
                    </h4>
                    <ul className="text-xs text-cinema-text-dim space-y-1">

                      <li>• Cache kullanımı normal fiyatın yaklaşık %10'u kadardır</li>
                      <li>• Sayaç localStorage'da saklanır ve tarayıcı geçmişi temizlenene kadar kalır</li>
                    </ul>
                  </div>
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
                    exportAllPrompts={promptStore.exportAllPrompts}
                    exportCategory={promptStore.exportCategory}
                    importPrompts={promptStore.importPrompts}
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