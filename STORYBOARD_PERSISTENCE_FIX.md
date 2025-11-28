# 🔄 Storyboard Analiz Verileri Persistence Düzeltmesi

Storyboard analiz esnasında ve sonuçlarında farklı ekranlara geçildiğinde kaybolan veri sorununu düzeltik.

## ❌ Önceki Sorun

- Storyboard analizi yapılıyor ✅
- Farklı modüle geçiliyor (örn: AnalysisPanel → SimpleStoryboard) 🔄
- Veriler kayboluyor ❌
- Tekrar analiz yapmak zorunda kalınıyor 😞

## ✅ Çözüm

### 1. **ScriptStore Persistence** 
```javascript
// scriptStore.js - Zustand persist middleware eklendi
import { persist } from 'zustand/middleware';

export const useScriptStore = create(
  persist(
    (state) => ({...}),
    {
      name: 'mgx-script-store',
      partialize: (state) => ({
        // Persist critical data
        scripts: state.scripts,
        analysisData: state.analysisData,
        scenes: state.scenes,
        characters: state.characters,
        // ... storyboard data included
      })
    }
  )
);
```

### 2. **AnalysisPanel Auto-Loading**
```javascript
// AnalysisPanel.jsx - Script değişiklik tracking
useEffect(() => {
  const loadExistingAnalysisData = async () => {
    const currentScript = useScriptStore.getState().getCurrentScript();
    
    // Priority 1: Script store'dan yükle
    if (currentScript.analysisData?.customResults) {
      setCustomResults(currentScript.analysisData.customResults);
      return;
    }

    // Priority 2: Persistent storage'dan yükle  
    const existingAnalysis = await analysisStorageService.loadAnalysis(scriptText, fileName);
    if (existingAnalysis?.customResults) {
      setCustomResults(existingAnalysis.customResults);
    }
  };

  loadExistingAnalysisData();
}, [useScriptStore.getState().currentScriptId]); // Script değişikliklerini takip et
```

### 3. **SimpleStoryboard Multi-Source Loading**
```javascript
// SimpleStoryboard.jsx - Gelişmiş veri yükleme
useEffect(() => {
  const loadStoredStoryboard = async () => {
    // Priority 1: Script store'dan yükle
    if (currentScript?.simpleStoryboard?.length > 0) {
      setStoryboards(currentScript.simpleStoryboard);
      setScenes(currentScript.storyboardScenes);
      return;
    }

    // Priority 2: Persistent storage'dan multiple keys ile ara
    const possibleKeys = [
      `storyboard_${fileName}`,
      `storyboard_${fileName.replace(/\.[^/.]+$/, "")}`, 
      fileName
    ];
    
    for (const key of possibleKeys) {
      const stored = await analysisStorageService.loadAnalysisByKey(key);
      if (stored?.storyboardData) {
        setStoryboards(stored.storyboardData);
        setScenes(stored.scenes);
        break;
      }
    }
  };

  loadStoredStoryboard();
}, [currentScript?.id, currentScript?.fileName]);
```

### 4. **AIStoryboard_v2 Comprehensive Loading**
```javascript
// AIStoryboard_v2.jsx - Çoklu kaynak veri yükleme
useEffect(() => {
  const loadStoryboardData = async () => {
    // Priority 1: Script store
    if (currentScript?.storyboard) {
      setGeneratedImages(currentScript.storyboard);
    }

    // Priority 2: localStorage (manual scenes)
    const stored = localStorage.getItem(`manual-scenes-${currentScriptId}`);
    if (stored) {
      setManualScenes(JSON.parse(stored));
    }

    // Priority 3: Persistent storage (full storyboard)
    const storyboardKey = `storyboard_v2_${fileName}`;
    const storedStoryboard = await analysisStorageService.loadAnalysisByKey(storyboardKey);
    if (storedStoryboard?.storyboardData) {
      setGeneratedImages(storedStoryboard.storyboardData.generatedImages);
    }
  };

  loadStoryboardData();
}, [currentScript?.id, currentScriptId]);
```

## 🔄 Çalışma Akışı

### Senaryo 1: Analiz → Modül Değiştir → Geri Dön
```
1. AnalysisPanel'de analiz yap ✅
2. SimpleStoryboard'a geç 🔄
3. AnalysisPanel'e geri dön 🔄
4. Veriler hala mevcut ✅ (Önceden: ❌ kayboluyordu)
```

### Senaryo 2: Storyboard → Modül Değiştir → Geri Dön  
```
1. SimpleStoryboard'da sahne analizi yap ✅
2. AnalysisPanel'e geç 🔄
3. SimpleStoryboard'a geri dön 🔄  
4. Scenes ve storyboard'lar hala mevcut ✅ (Önceden: ❌ kayboluyordu)
```

### Senaryo 3: AIStoryboard_v2 Manual Scenes
```
1. AIStoryboard_v2'de manual scene ekle ✅
2. Başka modüle geç 🔄
3. Geri dön 🔄
4. Manual scenes korunmuş ✅ (localStorage + script store)
```

## 🎯 Ana Faydalar

### ✅ **Persistent Data Recovery**
- Script değişiklik tracking ile otomatik yükleme
- Multiple priority levels (script store → persistent storage → localStorage)
- Cross-module data consistency

### ✅ **Performance Improvements**
- Unnecessary re-analysis önleniyor
- Kullanıcı deneyimi kesintisiz
- Background'da otomatik save/restore

### ✅ **Robust Error Handling**
- Multiple fallback sources
- Graceful degradation
- Console logging for debugging

### ✅ **Data Integrity**
- Zustand persist middleware ile güvenli saklama
- JSON parsing error handling
- Version compatibility

## 🔧 Technical Details

### Data Flow
```
User Action → State Change → Auto Save
     ↓
Script Switch → Auto Load → State Restore
     ↓  
Module Switch → State Preserved → No Data Loss
```

### Storage Hierarchy
```
1. 🥇 Script Store (Zustand persist) - Immediate access
2. 🥈 Persistent Storage (analysisStorageService) - File-based
3. 🥉 localStorage - Manual scenes backup
```

### File Naming Strategy
```javascript
// Multiple key attempts for better compatibility
const possibleKeys = [
  `storyboard_${fileName}`,           // storyboard_script.pdf
  `storyboard_${baseName}`,           // storyboard_script 
  fileName,                           // script.pdf
  baseName                            // script
];
```

## 🚀 Kullanıcı Deneyimi

### Öncesi ❌
```
1. Analiz yap (10 dakika) ⏱️
2. Başka modüle geç ↔️
3. Veriler kaybol 💥
4. Tekrar analiz yap (10 dakika) ⏱️
```

### Sonrası ✅
```
1. Analiz yap (10 dakika) ⏱️
2. Başka modüle geç ↔️
3. Veriler korunur 💎
4. Anında devam et ⚡
```

Artık kullanıcılar modüller arasında serbestçe geçiş yapabilir ve analiz verilerini kaybetme korkusu yaşamaz! 🎉