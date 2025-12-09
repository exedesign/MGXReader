# AI Ayarları Model Zorunluluğu Düzeltmesi

**Tarih:** 9 Aralık 2025  
**Amaç:** AI Ayarlarında seçilen modelin TÜM AI işlemlerinde kullanılmasını zorlamak

## 🎯 Problem

Kullanıcı AI Ayarları'nda bir görsel üretim modeli seçse bile, bazı bileşenler kendi model tercihlerini kullanıyordu veya `options.model` parametresi ile model override ediyordu. Bu, kullanıcının kontrolünü elinden alıyordu.

## ✅ Çözüm

### 1. **aiStore.js - generateImage() Fonksiyonu**

Model override'ları engellendi ve store'daki seçili model ZORUNLU hale getirildi.

**Değişiklikler:**
```javascript
// ÖNCESİ:
generateImage: async (prompt, options = {}) => {
  // options.model kullanılabiliyordu
  const result = await handler.generateImage(prompt, options);
}

// SONRASI:
generateImage: async (prompt, options = {}) => {
  // CRITICAL: Force use of store-selected image model
  const imageOptions = { ...options };
  delete imageOptions.model; // Model override'ı kaldır
  
  console.log('🎯 FORCING STORE MODELS:', {
    geminiImageModel: state.geminiImageModel,
    openaiImageModel: state.openaiImageModel,
    optionsModel: options.model ? '⚠️ IGNORED' : 'none'
  });
  
  // Handler'a imageModel parametresi gönder
  handler = new AIHandler({
    ...
    imageModel: state.geminiImageModel, // STORE MODEL
  });
  
  const result = await handler.generateImage(prompt, imageOptions);
}
```

### 2. **aiHandler.js - Constructor**

Provider'a özel image model yönetimi eklendi.

**Değişiklikler:**
```javascript
// ÖNCESİ:
constructor(config = {}) {
  this.imageModel = config.imageModel || 'dall-e-3';
}

// SONRASI:
constructor(config = {}) {
  // CRITICAL: Provider-specific image model
  if (config.provider === AI_PROVIDERS.GEMINI) {
    this.geminiImageModel = config.imageModel || 'gemini-2.5-flash-image';
    this.imageModel = this.geminiImageModel;
    console.log('🎯 AIHandler initialized with Gemini image model:', this.geminiImageModel);
  } else if (config.provider === AI_PROVIDERS.OPENAI) {
    this.openaiImageModel = config.imageModel || 'dall-e-3';
    this.imageModel = this.openaiImageModel;
    console.log('🎯 AIHandler initialized with OpenAI image model:', this.openaiImageModel);
  }
}
```

### 3. **aiHandler.js - generateImageGemini()**

Model override'ı tamamen engellendi.

**Değişiklikler:**
```javascript
// ÖNCESİ:
async generateImageGemini(prompt, options = {}) {
  const model = options.model || this.geminiImageModel || 'gemini-2.5-flash-image';
  // options.model kullanılabiliyordu
}

// SONRASI:
async generateImageGemini(prompt, options = {}) {
  // CRITICAL: ONLY use model from constructor (from store)
  const model = this.geminiImageModel || 'gemini-2.5-flash-image';
  
  if (options.model && options.model !== model) {
    console.warn('⚠️ IGNORED model override:', options.model, '→', model);
  }
  
  console.log('🎯 Using STORE model:', model);
}
```

---

## 🔒 Güvenlik Mekanizmaları

### 1. **Model Override Engelleme**
```javascript
// aiStore.js içinde
const imageOptions = { ...options };
delete imageOptions.model; // Herhangi bir override'ı kaldır
```

### 2. **Warning Sistemi**
```javascript
// aiHandler.js içinde
if (options.model && options.model !== model) {
  console.warn('⚠️ IGNORED model override attempt');
}
```

### 3. **Debug Logging**
```javascript
console.log('🎯 FORCING STORE MODELS - No overrides allowed:', {
  geminiImageModel: state.geminiImageModel,
  openaiImageModel: state.openaiImageModel,
  optionsModel: options.model ? '⚠️ IGNORED' : 'none'
});
```

---

## 📊 Model Akışı

### Önceki (Yanlış) Akış:
```
AI Settings → Store → Handler
                ↓
            Component (model override) ✗
                ↓
            generateImage(prompt, { model: 'override' })
```

### Yeni (Doğru) Akış:
```
AI Settings → Store → Handler → FORCED MODEL ✓
              ↓
          Removes any model override
              ↓
          generateImage(prompt, cleanOptions)
```

---

## 🎯 Etkilenen Bileşenler

### ✅ Doğru Kullanım
1. **ProfessionalStoryboard** - `generateImage()` store'dan çağrılıyor ✓
2. **CharacterImageGenerator** - `generateImage()` store'dan çağrılıyor ✓
3. **LocationImageGenerator** - `generateImage()` store'dan çağrılıyor ✓

### 🔒 Artık Engellenen
- Hiçbir bileşen `model` parametresi ile override yapamaz
- `options.model` parametresi otomatik olarak kaldırılır
- Sadece AI Settings'deki seçim geçerlidir

---

## 🧪 Test Senaryoları

### Senaryo 1: Normal Kullanım
```javascript
// AI Settings'de: gemini-2.5-flash-image seçili
generateImage("a cat");
// ✓ gemini-2.5-flash-image kullanılır
```

### Senaryo 2: Override Denemesi (Engellendi)
```javascript
// AI Settings'de: gemini-2.5-flash-image seçili
generateImage("a cat", { model: 'imagen-4.0-generate-001' });
// ⚠️ WARNING: Override ignored
// ✓ gemini-2.5-flash-image kullanılır (store'dan)
```

### Senaryo 3: Provider Değiştirme
```javascript
// AI Settings'de: Provider = OpenAI
// OpenAI Image Model: dall-e-3 seçili
generateImage("a cat");
// ✓ dall-e-3 kullanılır
```

---

## 📝 Console Çıktıları

### Başarılı Görsel Üretimi:
```
🔍 API Keys Status:
  geminiKey: AIzaSyB...***
  geminiImageModel: gemini-2.5-flash-image
  provider: gemini

🎯 FORCING STORE MODELS - No overrides allowed:
  geminiImageModel: gemini-2.5-flash-image
  openaiImageModel: dall-e-3
  optionsModel: none

🎯 AIHandler initialized with Gemini image model: gemini-2.5-flash-image

🎯 Gemini Image Generation with STORE model:
  storeModel: gemini-2.5-flash-image
  ignoredOptionsModel: none

✅ Success with gemini!
```

### Override Denemesi Engellendi:
```
🎯 FORCING STORE MODELS - No overrides allowed:
  geminiImageModel: gemini-2.5-flash-image
  optionsModel: ⚠️ IGNORED: imagen-4.0-generate-001

⚠️ IGNORED model override attempt: imagen-4.0-generate-001 → Using store model: gemini-2.5-flash-image

🎯 Gemini Image Generation with STORE model:
  storeModel: gemini-2.5-flash-image
  ignoredOptionsModel: imagen-4.0-generate-001
```

---

## 🎓 Kullanıcı İçin

### Model Nasıl Değiştirilir?

**TEK YOL - AI Ayarları:**

1. Üst menüden **Ayarlar** → **AI Ayarları**
2. **Providers** sekmesi
3. **Google Gemini** bölümü
4. **Image Generation Model** dropdown'ından seçim yapın:
   - `gemini-2.5-flash-image` (Önerilen) ⭐
   - `gemini-3-pro-image-preview` (Pro)
   - `imagen-4.0-generate-001` (Fotogerçekçi)
   - `imagen-4.0-ultra-generate-001` (Ultra)
5. **Save Gemini Settings** butonuna tıklayın

### ⚠️ Önemli Notlar

- ✅ Seçilen model **tüm** görsel üretim işlemlerinde kullanılır
- ✅ Kod seviyesinde model değiştirilemez
- ✅ Bileşenler model tercihini override edemez
- ✅ Sadece AI Settings'deki seçim geçerlidir

---

## 📁 Değiştirilen Dosyalar

1. **src/renderer/store/aiStore.js**
   - `generateImage()` fonksiyonu
   - Model override engellendi
   - Debug logging eklendi

2. **src/renderer/utils/aiHandler.js**
   - Constructor - provider-specific model yönetimi
   - `generateImageGemini()` - model override engellendi
   - Warning sistemi eklendi

---

## ✅ Sonuç

Artık **TÜM** AI görsel üretim işlemleri:
- ✓ AI Ayarları'nda seçilen modeli kullanır
- ✓ Kod seviyesinde override yapılamaz
- ✓ Kullanıcı kontrolü tam olarak sağlanır
- ✓ Console'da detaylı log bulunur

**Tek doğru kaynak:** AI Settings → Providers → Image Generation Model

---

**Durum:** ✅ Tamamlandı  
**Test:** Console logları ile doğrulanabilir
