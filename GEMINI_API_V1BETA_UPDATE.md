# Gemini API v1beta Uyumluluk Güncellemesi

## Güncelleme Tarihi: 11 Aralık 2025

### 📋 Yapılan Değişiklikler

#### 1. API Format Güncellemeleri (camelCase)

Gemini API v1beta endpoint'i **camelCase** format kullanıyor. Tüm request body alanları güncellendi:

##### Text Generation API
- ✅ `contents` → camelCase (değişiklik yok)
- ✅ `generationConfig` → camelCase (değişiklik yok)
- ✅ `safetySettings` → camelCase (değişiklik yok)
- ✅ `systemInstruction` → camelCase (değişiklik yok)

##### Image Generation API (Gemini Native)
**Değiştirilenler:**
- ❌ `response_modalities` → ✅ `responseModalities`
- ❌ `image_config` → ✅ `imageConfig`
- ❌ `image_size` → ✅ `imageSize`

##### Vision/Image Understanding API
**Değiştirilenler:**
- ❌ `inline_data` → ✅ `inlineData`
- ❌ `mime_type` → ✅ `mimeType`

##### Imagen API (Legacy)
**Değiştirilenler:**
- ❌ `number_of_images` → ✅ `numberOfImages`
- ❌ `image_size` → ✅ `imageSize`
- ❌ `person_generation` → ✅ `personGeneration`

---

#### 2. Safety Settings Güncellemesi

Gemini v1beta API'de tüm zarar kategorileri destekleniyor:

**Eski:**
```javascript
safetySettings: [
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_LOW_AND_ABOVE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_LOW_AND_ABOVE" }
]
```

**Yeni (Tam Koruma):**
```javascript
safetySettings: [
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
]
```

**Desteklenen Kategoriler:**
- `HARM_CATEGORY_HATE_SPEECH` (Nefret söylemi)
- `HARM_CATEGORY_SEXUALLY_EXPLICIT` (Müstehcen içerik)
- `HARM_CATEGORY_DANGEROUS_CONTENT` (Tehlikeli içerik)
- `HARM_CATEGORY_HARASSMENT` (Taciz)
- `HARM_CATEGORY_CIVIC_INTEGRITY` (Sivil bütünlük - deprecated)

**Threshold Seviyeleri:**
- `BLOCK_NONE` - Hiç engelleme
- `OFF` - Güvenlik filtresini devre dışı bırak
- `BLOCK_ONLY_HIGH` - Sadece yüksek risk
- `BLOCK_MEDIUM_AND_ABOVE` - Orta ve üzeri risk ⭐ **Önerilen**
- `BLOCK_LOW_AND_ABOVE` - Düşük ve üzeri risk

---

#### 3. Model Listesi Güncellemesi

##### Text Generation Models

**Gemini 3 Series (Preview):**
- `gemini-3-pro-preview` 🌟
  - Context: 2M tokens
  - Output: 8K tokens
  - Status: Preview (kararlı değil)
  - Özellik: En akıllı model

**Gemini 2.5 Series (Stable):**
- `gemini-2.5-flash` ⚡
  - Context: 1M tokens
  - Hızlı ve ekonomik
- `gemini-2.5-flash-lite` 🚀
  - Context: 1M tokens
  - Ultra hızlı
- `gemini-2.5-pro` 🧠
  - Context: 2M tokens
  - Düşünme modu

**Gemini 2.0 Series (Stable):**
- `gemini-2.0-flash`
- `gemini-2.0-flash-lite`

**Gemini 1.5 Series (Stable):**
- `gemini-1.5-pro`
- `gemini-1.5-flash`

##### Image Generation Models

**Aktif Modeller:**
- `gemini-3-pro-image-preview` 🍌 Pro
  - 14 referans görsel
  - 4K çözünürlük
  - Google Search desteği
- `gemini-2.5-flash-image` 🍌
  - 3 referans görsel
  - 1K çözünürlük
  - Hızlı üretim

**Deprecated Modeller:**
- `imagen-4.0-*` ⚠️ API tarafından desteklenmiyor
- `imagen-3.0-generate-001` ⚠️ Legacy

---

#### 4. API Endpoint Formatı

**Doğru Format:**
```
https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={API_KEY}
```

**Desteklenen Endpoint'ler:**
- `:generateContent` - Text/Image generation, vision
- `:generateImages` - Imagen legacy (deprecated)
- `:streamGenerateContent` - Streaming yanıt

---

### 🔍 API Döküman Referansları

1. **Generate Content API:**
   https://ai.google.dev/api/generate-content

2. **Gemini Models:**
   https://ai.google.dev/gemini-api/docs/models/gemini

3. **Vision API:**
   https://ai.google.dev/gemini-api/docs/vision

4. **Image Generation:**
   https://ai.google.dev/gemini-api/docs/image-generation

5. **Safety Settings:**
   https://ai.google.dev/gemini-api/docs/safety-settings

---

### ✅ Test Edilmesi Gerekenler

1. **Text Generation:**
   - [ ] Gemini 3 Pro Preview ile metin üretimi
   - [ ] Gemini 2.5 Flash ile hızlı yanıt
   - [ ] Gemini 2.5 Pro ile düşünme modu

2. **Image Generation:**
   - [ ] Gemini 3 Pro Image ile 4K görsel
   - [ ] Gemini 2.5 Flash Image ile hızlı görsel
   - [ ] Referans görseller ile üretim (3-14 adet)

3. **Vision/Image Understanding:**
   - [ ] Görsel analizi (caption, classification)
   - [ ] OCR ve metin çıkarma
   - [ ] Çoklu görsel analizi (3600'e kadar)

4. **Safety Settings:**
   - [ ] Güvenlik filtreleri çalışıyor mu
   - [ ] Threshold seviyeleri doğru mu

---

### 🚀 Sonraki Adımlar

1. ✅ API formatları güncellendi (camelCase)
2. ✅ Model listesi güncellendi (stable/preview flags)
3. ✅ Safety settings genişletildi (4 kategori)
4. ⏳ Gerçek API ile test edilecek
5. ⏳ Hata durumları gözlenecek
6. ⏳ Performans ölçümleri yapılacak

---

### 📝 Notlar

- **v1beta** endpoint kullanıyoruz (kararlı)
- **camelCase** format zorunlu (snake_case deprecated)
- **Imagen 4.0** API'de mevcut değil (kullanmayın)
- **Gemini 3 Pro** preview modunda (üretimde dikkatli kullanın)
- **Safety settings** varsayılan olarak `BLOCK_MEDIUM_AND_ABOVE`

### 🔗 İlgili Dosyalar

- `src/renderer/utils/aiHandler.js` - Ana AI handler (1276 satır)
- `src/renderer/store/promptStore.js` - Prompt yönetimi
- `src/renderer/components/AISettings.jsx` - AI ayarları UI

---

**Güncelleme:** Bu değişiklikler Gemini API v1beta dokümantasyonuna (11 Aralık 2025) göre yapılmıştır.
