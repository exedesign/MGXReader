# 🆔 Prompt ID Sistemi - Kullanım Kılavuzu

**Tarih:** 8 Aralık 2025  
**Versiyon:** 1.0  
**Durum:** Aktif ✅

---

## 🎯 Amaç

Her prompt'a **değişmez (immutable) bir UUID** ekleyerek:
- ✅ Prompt key'leri değişse bile adresleme bozulmasın
- ✅ Import/export sırasında prompt'lar kaybolmasın
- ✅ Kullanıcı JSON'da istediği değişikliği yapsın
- ✅ Yeni promptlar eklendiğinde sistem otomatik ID atasın
- ✅ Modüller ID ile prompt arasın, key değişse bile çalışsın

---

## 📊 Prompt Yapısı (Yeni Format)

### Önce (ID Yok)
```javascript
{
  name: "Karakter Analizi",
  system: "Sen senaryo analistisin...",
  user: "Karakterleri analiz et..."
}
```

### Sonra (ID Var)
```javascript
{
  id: "prompt_analysis_character_lx4k8n2p",  // Benzersiz, değişmez ID
  name: "Karakter Analizi",
  system: "Sen senaryo analistisin...",
  user: "Karakterleri analiz et...",
  createdAt: "2025-12-08T10:30:00.000Z",    // Oluşturulma zamanı
  updatedAt: "2025-12-08T12:45:00.000Z"     // Son güncellenme
}
```

---

## 🔧 Otomatik ID Oluşturma

### 1. Default Prompts (Uygulama Başlangıcında)
```javascript
// promptStore.js içinde otomatik
const defaultPromptsWithIDs = {
  analysis: addIDsToPrompts(defaultPrompts.analysis, 'analysis'),
  grammar: addIDsToPrompts(defaultPrompts.grammar, 'grammar'),
  // ...
};
```

**Sonuç:** Tüm default promptlar ID ile gelir:
- `prompt_analysis_character_xyz123`
- `prompt_analysis_plot_abc456`
- `prompt_grammar_intermediate_def789`

### 2. Custom Prompts (Kullanıcı Kaydettiğinde)
```javascript
// saveCustomPrompt otomatik ID ekler
const promptID = saveCustomPrompt('analysis', 'my_custom', {
  name: "Özel Analiz",
  system: "...",
  user: "..."
});

// promptID: "550e8400-e29b-41d4-a716-446655440000" (UUID)
```

### 3. Import Edilen Prompts
```javascript
// Import sırasında ensurePromptID çağrılır
// ID yoksa otomatik oluşturulur
// ID varsa korunur
```

---

## 🚀 Kullanım Örnekleri

### Örnek 1: Prompt'u ID ile Getir

```javascript
import { usePromptStore } from './store/promptStore';

const { getPromptByID } = usePromptStore();

// ID ile ara
const result = getPromptByID("prompt_analysis_character_lx4k8n2p");

if (result) {
  console.log(`Category: ${result.category}`);  // "analysis"
  console.log(`Key: ${result.key}`);            // "character"
  console.log(`Prompt:`, result.prompt);        // Prompt objesi
}
```

**Avantaj:** Kullanıcı key'i değiştirse bile (character → karakter_analizi), ID ile bulursunuz!

---

### Örnek 2: Modül ID Kaydetsin, Sonra Kullansın

```javascript
// AnalysisPanel.jsx
import { usePromptStore } from '../store/promptStore';

function AnalysisPanel() {
  const { getActivePrompt, getPromptByID } = usePromptStore();
  
  // 1. Kullanıcı analiz başlatırken ID'yi kaydet
  const startAnalysis = (category) => {
    const activePrompt = getActivePrompt(category);
    
    // ID'yi localStorage'a veya state'e kaydet
    localStorage.setItem('lastAnalysisPromptID', activePrompt.id);
    
    // Analizi başlat
    runAnalysis(activePrompt);
  };
  
  // 2. Daha sonra aynı prompt'u ID ile bul
  const resumeAnalysis = () => {
    const savedID = localStorage.getItem('lastAnalysisPromptID');
    const result = getPromptByID(savedID);
    
    if (result) {
      console.log(`Resuming with prompt: ${result.prompt.name}`);
      runAnalysis(result.prompt);
    } else {
      console.warn('Prompt bulunamadı, default kullanılıyor');
    }
  };
  
  // ...
}
```

---

### Örnek 3: Storyboard Referans Sistemi

```javascript
// ProfessionalStoryboard.jsx
import { usePromptStore } from '../store/promptStore';

function ProfessionalStoryboard() {
  const { getPromptByID } = usePromptStore();
  
  // Storyboard metadata'sında prompt ID'leri sakla
  const generateStoryboard = () => {
    const characterPromptID = "prompt_analysis_character_xyz";
    const locationPromptID = "prompt_analysis_location_abc";
    
    const metadata = {
      generatedWith: {
        characterPrompt: characterPromptID,
        locationPrompt: locationPromptID,
        timestamp: Date.now()
      }
    };
    
    // Storyboard oluştur...
    saveStoryboard(scenes, metadata);
  };
  
  // Storyboard yeniden oluşturulurken aynı promptları kullan
  const regenerateStoryboard = (storyboardData) => {
    const meta = storyboardData.metadata.generatedWith;
    
    const charPrompt = getPromptByID(meta.characterPromptID);
    const locPrompt = getPromptByID(meta.locationPromptID);
    
    if (charPrompt && locPrompt) {
      // Aynı promptlarla yeniden oluştur
      console.log(`Regenerating with: ${charPrompt.prompt.name}, ${locPrompt.prompt.name}`);
    }
  };
}
```

---

### Örnek 4: Prompt Geçmişi ve Versiyonlama

```javascript
// AnalysisStorageService.js
const saveAnalysisResult = (scriptHash, analysisData) => {
  const { getActivePrompt } = usePromptStore.getState();
  
  const analysisRecord = {
    scriptHash,
    analysisData,
    metadata: {
      promptID: getActivePrompt('analysis').id,
      promptName: getActivePrompt('analysis').name,
      timestamp: Date.now(),
      version: "1.0"
    }
  };
  
  // Daha sonra bu analizi görüntülerken hangi prompt kullanıldığını biliyoruz
  localStorage.setItem(`analysis_${scriptHash}`, JSON.stringify(analysisRecord));
};

const loadAnalysisResult = (scriptHash) => {
  const stored = JSON.parse(localStorage.getItem(`analysis_${scriptHash}`));
  const { getPromptByID } = usePromptStore.getState();
  
  console.log(`Bu analiz şu prompt ile yapıldı: ${stored.metadata.promptName}`);
  console.log(`Prompt ID: ${stored.metadata.promptID}`);
  
  // Aynı prompt hâlâ var mı kontrol et
  const promptStillExists = getPromptByID(stored.metadata.promptID);
  if (!promptStillExists) {
    console.warn('⚠️ Bu prompt artık mevcut değil!');
  }
};
```

---

## 📥 Export/Import Davranışı

### Export Edilen JSON Formatı
```json
{
  "version": "2.0",
  "exportDate": "2025-12-08T10:00:00.000Z",
  "exportType": "all",
  "prompts": {
    "analysis": {
      "character": {
        "id": "prompt_analysis_character_lx4k8n2p",
        "name": "Karakter Analizi",
        "system": "...",
        "user": "...",
        "createdAt": "2025-12-01T09:00:00.000Z",
        "updatedAt": "2025-12-08T10:00:00.000Z"
      }
    }
  },
  "activePrompts": {
    "analysis": "character"
  }
}
```

### Import Davranışı

#### Senaryo 1: ID Var (Export'tan Gelen)
```javascript
// JSON'da ID var
{
  "id": "prompt_analysis_character_lx4k8n2p",
  "name": "Karakter Analizi",
  // ...
}

// Import: ID korunur, değiştirilmez
✓ Imported with ID: prompt_analysis_character_lx4k8n2p
```

#### Senaryo 2: ID Yok (Manuel Oluşturulan)
```javascript
// JSON'da ID yok
{
  "name": "Özel Analiz",
  "system": "...",
  // id yok!
}

// Import: Otomatik ID oluşturulur
✓ Imported with ID: prompt_analysis_ozel_analiz_m3k9n4t2
```

#### Senaryo 3: Duplicate ID (İki Farklı Prompt Aynı ID'ye Sahip)
```javascript
// Şu an duplicate detection yok
// TODO: İleride eklenebilir
// Çözüm: Son gelen üzerine yazar
```

---

## 🔍 ID Yapısı

### Deterministik ID (Default Prompts)
```javascript
// Format: prompt_{category}_{key}_{timestamp}
prompt_analysis_character_lx4k8n2p
prompt_grammar_intermediate_m8k3t9w1
prompt_storyboard_main_n5p2k7q4
```

**Özellikler:**
- Category + Key bilgisi içerir
- Timestamp suffix ile benzersizlik garanti
- Manuel okuyup anlayabilirsiniz

### UUID (Custom Prompts)
```javascript
// RFC 4122 UUID v4
550e8400-e29b-41d4-a716-446655440000
7c9e6679-7425-40de-944b-e07fc1f90ae7
```

**Özellikler:**
- Tamamen rastgele
- Global olarak benzersiz
- 128-bit

---

## ⚙️ Store API

### Yeni Fonksiyonlar

#### `getPromptByID(promptID)`
```javascript
const result = getPromptByID("prompt_analysis_character_xyz");
// Returns: { category, key, prompt } veya null
```

#### `saveCustomPrompt(category, type, prompt)`
```javascript
const promptID = saveCustomPrompt('analysis', 'my_prompt', {
  name: "Özel",
  system: "...",
  user: "..."
});
// Returns: Prompt ID (string)
// Prompt otomatik ID + timestamp alır
```

#### `getPromptTypes(category)`
```javascript
const types = getPromptTypes('analysis');
// Returns:
[
  {
    key: "character",
    id: "prompt_analysis_character_xyz",  // ID eklendi!
    name: "Karakter Analizi",
    isCustom: false,
    createdAt: "2025-12-01T09:00:00.000Z",
    updatedAt: "2025-12-08T10:00:00.000Z"
  },
  // ...
]
```

---

## 🧪 Test Senaryoları

### Test 1: Default Promptlar ID Aldı mı?
```javascript
const { defaultPrompts } = usePromptStore.getState();

Object.values(defaultPrompts).forEach(category => {
  Object.values(category).forEach(prompt => {
    console.assert(prompt.id, 'Prompt ID eksik!');
  });
});

console.log('✅ Tüm default promptların ID\'si var');
```

### Test 2: Custom Prompt Kaydedince ID Alıyor mu?
```javascript
const { saveCustomPrompt, getPrompt } = usePromptStore.getState();

const promptID = saveCustomPrompt('analysis', 'test_prompt', {
  name: "Test",
  system: "Test system",
  user: "Test user"
});

const saved = getPrompt('analysis', 'test_prompt');
console.assert(saved.id === promptID, 'ID eşleşmiyor!');
console.assert(saved.createdAt, 'createdAt yok!');
console.assert(saved.updatedAt, 'updatedAt yok!');

console.log('✅ Custom prompt ID sistemi çalışıyor');
```

### Test 3: Import Edilen Promptlar ID Alıyor mu?
```javascript
const { importPrompts } = usePromptStore.getState();

const testJSON = {
  version: "2.0",
  prompts: {
    analysis: {
      imported_test: {
        name: "Imported Test",
        system: "Test",
        user: "Test"
        // id yok!
      }
    }
  }
};

const result = importPrompts(testJSON, { overwrite: true });
console.assert(result.success, 'Import başarısız!');

const { getPrompt } = usePromptStore.getState();
const imported = getPrompt('analysis', 'imported_test');
console.assert(imported.id, 'Import edilen prompt ID almadı!');

console.log('✅ Import ID sistemi çalışıyor');
```

### Test 4: ID ile Arama Çalışıyor mu?
```javascript
const { getPromptTypes, getPromptByID } = usePromptStore.getState();

const types = getPromptTypes('analysis');
const firstPrompt = types[0];

const found = getPromptByID(firstPrompt.id);
console.assert(found, 'Prompt ID ile bulunamadı!');
console.assert(found.key === firstPrompt.key, 'Key eşleşmiyor!');
console.assert(found.prompt.id === firstPrompt.id, 'ID eşleşmiyor!');

console.log('✅ ID ile arama çalışıyor');
```

---

## 📋 Migration Plan (Mevcut Kullanıcılar)

### Durum: Eski promptlarda ID yok

**Çözüm:** İlk uygulama yüklendiğinde otomatik ID atanır

```javascript
// persist middleware migrate fonksiyonu
migrate: (persistedState, version) => {
  if (!persistedState) return getDefaultState();
  
  // Her custom prompt'a ID ekle (yoksa)
  const customPromptsWithIDs = {};
  Object.entries(persistedState.customPrompts).forEach(([cat, prompts]) => {
    customPromptsWithIDs[cat] = {};
    Object.entries(prompts).forEach(([key, prompt]) => {
      customPromptsWithIDs[cat][key] = ensurePromptID(prompt, `${cat}_${key}`);
    });
  });
  
  return {
    ...persistedState,
    customPrompts: customPromptsWithIDs
  };
}
```

**Sonuç:** Kullanıcı fark etmez, otomatik upgrade olur ✅

---

## 🎯 Best Practices

### ✅ YAPILMASI GEREKENLER

1. **ID ile Referans Tutun**
   ```javascript
   // ✅ İYİ
   const promptID = activePrompt.id;
   localStorage.setItem('usedPromptID', promptID);
   
   // ❌ KÖTÜ
   const promptKey = 'character';
   localStorage.setItem('usedPromptKey', promptKey);
   ```

2. **ID Kontrolü Yapın**
   ```javascript
   // ✅ İYİ
   const result = getPromptByID(savedID);
   if (!result) {
     console.warn('Prompt bulunamadı, fallback kullanılıyor');
     // Fallback logic
   }
   
   // ❌ KÖTÜ
   const prompt = getPrompt(category, key); // Key değişmiş olabilir
   ```

3. **Metadata'da ID Saklayın**
   ```javascript
   // ✅ İYİ
   const metadata = {
     analysisPromptID: prompt.id,
     storyboardPromptID: sbPrompt.id,
     timestamp: Date.now()
   };
   
   // ❌ KÖTÜ
   const metadata = {
     analysisPrompt: 'character', // Key değişebilir
     timestamp: Date.now()
   };
   ```

### ❌ YAPILMAMASI GEREKENLER

1. **ID'yi Manuel Değiştirmeyin**
   ```javascript
   // ❌ YAPMAYIN
   prompt.id = "my_custom_id";
   ```

2. **ID'ye Güvenmeyin (Fallback Ekleyin)**
   ```javascript
   // ❌ KÖTÜ
   const prompt = getPromptByID(id);
   runAnalysis(prompt.prompt); // prompt null olabilir!
   
   // ✅ İYİ
   const result = getPromptByID(id);
   const prompt = result ? result.prompt : getDefaultPrompt();
   runAnalysis(prompt);
   ```

3. **Key ile Arama Yapmaktan Vazgeçmeyin**
   ```javascript
   // Key hâlâ valid ve kullanışlı
   // ID sistemin üzerine eklenen bir katman
   
   // ✅ Her ikisi de geçerli
   const prompt1 = getPrompt('analysis', 'character');  // Key ile
   const prompt2 = getPromptByID(prompt1.id);           // ID ile
   ```

---

## 🔮 Gelecek İyileştirmeler

### 1. Prompt Versiyonlama
```javascript
{
  id: "prompt_analysis_character_xyz",
  version: 2,
  history: [
    { version: 1, updatedAt: "...", changes: "..." },
    { version: 2, updatedAt: "...", changes: "..." }
  ]
}
```

### 2. Duplicate ID Detection
```javascript
// Import sırasında duplicate ID varsa uyarı ver
if (existingPromptWithSameID) {
  console.warn(`⚠️ Duplicate ID: ${id}`);
  // Yeni ID oluştur veya kullanıcıya sor
}
```

### 3. Prompt Dependencies
```javascript
{
  id: "prompt_storyboard_main_xyz",
  dependencies: [
    "prompt_analysis_character_abc",  // Bu promptlar önce çalışmalı
    "prompt_analysis_location_def"
  ]
}
```

### 4. Cross-Workspace Sync
```javascript
// Farklı projelerde aynı prompt ID'si
// Cloud sync ile senkronize et
```

---

## 📞 Sorun Giderme

### Sorun 1: "Prompt ID bulunamadı"
```
Çözüm:
1. Prompt export sonrası silindi mi?
2. Import sırasında ID korundu mu?
3. localStorage'da kayıtlı ID hâlâ geçerli mi?
4. Fallback mekanizması ekleyin
```

### Sorun 2: "Import sonrası prompt kayboldu"
```
Çözüm:
1. Console'da import log'larını kontrol et
2. JSON'da 'prompts' objesi var mı?
3. Version formatı doğru mu? (v2.0+)
4. Merge/Replace mode doğru seçildi mi?
```

### Sorun 3: "Custom prompt ID'si değişiyor"
```
Çözüm:
1. saveCustomPrompt kullanıldığında ID otomatik korunur
2. Manuel JSON edit yapıldıysa ID silinmiş olabilir
3. Import/export kullanarak ID'leri koruyun
```

---

**Doküman Sahibi:** MGXReader Development Team  
**Son Güncelleme:** 8 Aralık 2025, 03:45  
**Versiyon:** 1.0  
**Durum:** Production Ready ✅
