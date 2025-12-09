import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Pose Store - Karakter poz şablonlarını yönetir
 * Character sheet pozları için template sistemi
 */
export const usePoseStore = create(
  persist(
    (set, get) => ({
      // Poz şablonları - her biri bir karakter sheet pozunu temsil eder
      poseTemplates: [
        {
          id: 'front-view',
          name: 'Ön Görünüm',
          description: 'Karakterin önden tam görünüşü',
          prompt: 'full body front view, standing straight, arms at sides, neutral expression, white background, character sheet style',
          icon: '🧍',
          category: 'basic',
          isDefault: true
        },
        {
          id: 'side-view',
          name: 'Yan Görünüm',
          description: 'Karakterin profilden tam görünüşü',
          prompt: 'full body side view profile, standing straight, arms at sides, neutral expression, white background, character sheet style',
          icon: '🚶',
          category: 'basic',
          isDefault: true
        },
        {
          id: 'back-view',
          name: 'Arka Görünüm',
          description: 'Karakterin arkadan tam görünüşü',
          prompt: 'full body back view, standing straight, arms at sides, white background, character sheet style',
          icon: '🚶‍♂️',
          category: 'basic',
          isDefault: true
        },
        {
          id: 'three-quarter',
          name: '3/4 Görünüm',
          description: 'Karakterin 3/4 açıdan görünüşü',
          prompt: 'full body three-quarter view, standing straight, slight angle, neutral expression, white background, character sheet style',
          icon: '👤',
          category: 'basic',
          isDefault: true
        },
        {
          id: 'action-pose',
          name: 'Aksiyon Pozu',
          description: 'Dinamik hareket pozisyonu',
          prompt: 'full body dynamic action pose, movement, dramatic stance, white background, character sheet style',
          icon: '🤸',
          category: 'action',
          isDefault: true
        },
        {
          id: 'sitting',
          name: 'Oturma Pozu',
          description: 'Oturur pozisyonda',
          prompt: 'full body sitting pose, relaxed position, neutral expression, white background, character sheet style',
          icon: '🪑',
          category: 'static',
          isDefault: true
        },
        {
          id: 'close-up-face',
          name: 'Yüz Detayı',
          description: 'Yüz ifadesi ve detayları',
          prompt: 'close-up face portrait, detailed facial features, neutral expression, white background, character sheet style',
          icon: '😐',
          category: 'detail',
          isDefault: true
        },
        {
          id: 'hands-detail',
          name: 'El Detayı',
          description: 'El pozisyonları ve detayları',
          prompt: 'detailed hand studies, various hand poses and gestures, white background, character sheet style',
          icon: '👋',
          category: 'detail',
          isDefault: true
        }
      ],

      // Kategoriler
      categories: [
        { id: 'basic', name: 'Temel Pozlar', icon: '📐' },
        { id: 'action', name: 'Aksiyon Pozları', icon: '⚡' },
        { id: 'static', name: 'Statik Pozlar', icon: '🧘' },
        { id: 'detail', name: 'Detay Çekimleri', icon: '🔍' },
        { id: 'custom', name: 'Özel Pozlar', icon: '✨' }
      ],

      // Hazır poz görselleri (referans olarak kullanılacak)
      poseReferenceImages: [],

      // Poz referans görseli ekleme
      addPoseReferenceImage: (imageData) => {
        const newImage = {
          id: `pose_ref_${Date.now()}`,
          name: imageData.name || 'Poz Referansı',
          description: imageData.description || '',
          imageUrl: imageData.imageUrl, // base64 data URL
          mimeType: imageData.mimeType || 'image/png',
          category: imageData.category || 'custom',
          tags: imageData.tags || [],
          uploadedAt: new Date().toISOString()
        };

        set((state) => ({
          poseReferenceImages: [...state.poseReferenceImages, newImage]
        }));

        console.log('✅ Poz referans görseli eklendi:', newImage.name);
        return newImage;
      },

      // Poz referans görseli güncelleme
      updatePoseReferenceImage: (id, updates) => {
        set((state) => ({
          poseReferenceImages: state.poseReferenceImages.map((img) =>
            img.id === id
              ? { ...img, ...updates, updatedAt: new Date().toISOString() }
              : img
          )
        }));

        console.log('✏️ Poz referans görseli güncellendi:', id);
      },

      // Poz referans görseli silme
      deletePoseReferenceImage: (id) => {
        set((state) => ({
          poseReferenceImages: state.poseReferenceImages.filter((img) => img.id !== id)
        }));

        console.log('🗑️ Poz referans görseli silindi:', id);
      },

      // Tüm referans görsellerini getir
      getAllPoseReferenceImages: () => {
        return get().poseReferenceImages;
      },

      // Kategoriye göre referans görselleri getir
      getPoseReferenceImagesByCategory: (categoryId) => {
        return get().poseReferenceImages.filter(
          (img) => img.category === categoryId
        );
      },

      // Poz şablonu ekleme
      addPoseTemplate: (template) => {
        const newTemplate = {
          ...template,
          id: template.id || `pose_${Date.now()}`,
          isDefault: false,
          createdAt: new Date().toISOString()
        };
        
        set((state) => ({
          poseTemplates: [...state.poseTemplates, newTemplate]
        }));
        
        console.log('✅ Yeni poz şablonu eklendi:', newTemplate.name);
        return newTemplate;
      },

      // Poz şablonu güncelleme
      updatePoseTemplate: (id, updates) => {
        set((state) => ({
          poseTemplates: state.poseTemplates.map((template) =>
            template.id === id
              ? { ...template, ...updates, updatedAt: new Date().toISOString() }
              : template
          )
        }));
        
        console.log('✏️ Poz şablonu güncellendi:', id);
      },

      // Poz şablonu silme (sadece custom pozlar silinebilir)
      deletePoseTemplate: (id) => {
        const template = get().poseTemplates.find(t => t.id === id);
        
        if (template?.isDefault) {
          console.warn('⚠️ Varsayılan poz şablonları silinemez');
          return false;
        }
        
        set((state) => ({
          poseTemplates: state.poseTemplates.filter((template) => template.id !== id)
        }));
        
        console.log('🗑️ Poz şablonu silindi:', id);
        return true;
      },

      // Kategoriye göre poz getirme
      getPosesByCategory: (categoryId) => {
        return get().poseTemplates.filter(
          (template) => template.category === categoryId
        );
      },

      // ID'ye göre poz getirme
      getPoseById: (id) => {
        return get().poseTemplates.find((template) => template.id === id);
      },

      // Tüm pozları getirme
      getAllPoses: () => {
        return get().poseTemplates;
      },

      // Varsayılan pozları sıfırlama
      resetToDefaults: () => {
        const currentTemplates = get().poseTemplates;
        const customTemplates = currentTemplates.filter(t => !t.isDefault);
        
        set((state) => ({
          poseTemplates: [
            ...state.poseTemplates.filter(t => t.isDefault),
            ...customTemplates
          ]
        }));
        
        console.log('🔄 Varsayılan pozlar geri yüklendi');
      },

      // Popüler poz kombinasyonları
      posePresets: [
        {
          id: 'basic-turnaround',
          name: 'Temel Dönüş (3 Görünüm)',
          description: 'Ön, yan ve arka görünüm - karakter model sheet\'i için ideal',
          icon: '🔄',
          poseIds: ['front-view', 'side-view', 'back-view']
        },
        {
          id: 'full-turnaround',
          name: 'Tam Dönüş (4 Görünüm)',
          description: 'Ön, yan, arka ve 3/4 görünüm - detaylı karakter referansı',
          icon: '🎯',
          poseIds: ['front-view', 'side-view', 'back-view', 'three-quarter']
        },
        {
          id: 'portrait-details',
          name: 'Portre ve Detaylar',
          description: 'Ön görünüm, yüz detayı ve el detayı',
          icon: '👤',
          poseIds: ['front-view', 'close-up-face', 'hands-detail']
        },
        {
          id: 'action-static',
          name: 'Aksiyon ve Statik',
          description: 'Ön görünüm, aksiyon pozu ve oturma pozu',
          icon: '⚡',
          poseIds: ['front-view', 'action-pose', 'sitting']
        }
      ],

      // Preset ID'sine göre pozları getir
      getPosesByPreset: (presetId) => {
        const preset = get().posePresets.find(p => p.id === presetId);
        if (!preset) return [];
        
        const poses = get().poseTemplates;
        return preset.poseIds
          .map(id => poses.find(p => p.id === id))
          .filter(Boolean);
      }
    }),
    {
      name: 'pose-storage',
      version: 1
    }
  )
);
