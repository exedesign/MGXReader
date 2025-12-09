# Gemini 3 Pro Entegrasyonu - Kasım 2025

## 🎯 Güncel API Belgeleri Kullanıldı

**Kaynak:** https://ai.google.dev/gemini-api/docs/gemini-3
**Son Güncelleme:** 20 Kasım 2025

---

## ✅ Doğru Model İsimleri

### Metin Üretimi (Text Generation)
```
Model ID: gemini-3-pro-preview
API Endpoint: /v1beta/models/gemini-3-pro-preview:generateContent
```

**Özellikler:**
- ⭐ En akıllı Gemini modeli
- 🧠 Gelişmiş reasoning (akıl yürütme)
- 📊 1M token input / 64K output
- 🎨 Multimodal (metin, görsel, video)
- 🎚️ Thinking level kontrolü (low/medium/high)
- 📅 Kesme tarihi: Ocak 2025

**Thinking Levels:**
- `low`: Hızlı yanıtlar, basit görevler
- `medium`: (Çok yakında)
- `high`: Maksimum reasoning, karmaşık görevler

---

### Görsel Üretimi (Image Generation)
```
Model ID: gemini-3-pro-image-preview
API Endpoint: /v1beta/models/gemini-3-pro-image-preview:generateContent
```

**Özellikler:**
- 🎨 AI tabanlı görsel üretim
- 🖼️ Doğal 4K çözünürlük
- 📝 Metin ve diyagram oluşturma
- 🔍 Google Search ile temellendirme
- ✏️ Sohbet ederek düzenleme
- 💾 65K input / 32K output tokens

**Desteklenen Aspect Ratios:**
- 1:1 (kare)
- 16:9 (geniş)
- 9:16 (dikey)
- 4:3, 3:4

**Image Sizes:**
- 2K (2048x2048)
- 4K (4096x4096)

---

## 📝 Yapılan Değişiklikler

### 1. aiHandler.js
```javascript
// ÖNCE
export const GEMINI_MODELS = [
  { id: 'gemini-2.0-flash-exp', recommended: true },
  // ...
]

// SONRA
export const GEMINI_MODELS = [
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Preview)', 
    recommended: true, reasoning: true, multimodal: true },
  { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash Exp', fast: true },
  // ...
]
```

### 2. ProvidersTab.jsx
```javascript
// Varsayılan model
const validGeminiModels = [
  'gemini-3-pro-preview', // ✅ Yeni
  'gemini-2.0-flash-exp', 
  'gemini-1.5-flash', 
  'gemini-1.5-pro'
]

// Reset fonksiyonu
const handleResetGemini = () => {
  setLocalGeminiModel('gemini-3-pro-preview'); // ✅ Güncel
}
```

---

## 🔧 API Kullanım Örnekleri

### Metin Üretimi
```javascript
const response = await axios.post(
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=' + API_KEY,
  {
    contents: [{
      role: 'user',
      parts: [{ text: 'Senaryo analizi yap...' }]
    }],
    generationConfig: {
      temperature: 1.0, // ⚠️ Gemini 3 için 1.0 önerilir
      maxOutputTokens: 8192,
      thinking_level: 'high' // low, medium, high
    }
  }
)
```

### Görsel Üretimi
```javascript
const response = await axios.post(
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=' + API_KEY,
  {
    contents: [{
      role: 'user',
      parts: [{ text: 'Cyberpunk city, neon lights, 4K' }]
    }],
    generationConfig: {
      temperature: 0.8,
      image_config: {
        aspect_ratio: '16:9',
        image_size: '4K'
      }
    }
  }
)

// Response format
{
  candidates: [{
    content: {
      parts: [{
        inlineData: {
          mimeType: 'image/png',
          data: 'base64_encoded_image...'
        }
      }]
    }
  }]
}
```

---

## 💡 Önemli Notlar

### 1. Temperature Ayarı
⚠️ **Gemini 3 Pro için temperature=1.0 kullanın!**

Gemini 3'ün reasoning özellikleri varsayılan ayar için optimize edilmiştir. Temperature'ı değiştirmek (özellikle 1.0'ın altına):
- Döngüye girme
- Performans düşüşü
- Beklenmedik davranışlar

oluşturabilir.

### 2. Thinking Level
```javascript
// Hızlı görevler için
thinking_level: 'low' 

// Karmaşık görevler için (varsayılan)
thinking_level: 'high'
```

### 3. Media Resolution
```javascript
// Resimler için
media_resolution: 'media_resolution_high' // 1120 tokens

// PDF'ler için
media_resolution: 'media_resolution_medium' // 560 tokens

// Video için
media_resolution: 'media_resolution_low' // 70 tokens/frame
```

### 4. Thought Signatures
Gemini 3, API çağrıları arasında reasoning context'i korumak için "thought signatures" kullanır.

**Otomatik Yönetim:** Python, Node, Java SDK'ları otomatik halleder ✅

**Manuel Kullanım:**
```javascript
// Model response'dan gelen thoughtSignature'ı
// bir sonraki request'te geri gönderin
{
  contents: [{
    parts: [{
      text: '...',
      thoughtSignature: 'signature_from_previous_response'
    }]
  }]
}
```

---

## 📊 Fiyatlandırma

### Gemini 3 Pro Preview (Text)
| Token Miktarı | Input (1M token) | Output (1M token) |
|---------------|------------------|-------------------|
| < 200K tokens | $2.00 | $12.00 |
| > 200K tokens | $4.00 | $18.00 |

### Gemini 3 Pro Image Preview
| İşlem | Fiyat |
|-------|-------|
| Text Input | $2.00 / 1M tokens |
| Image Output | $0.134 / görsel* |

*Çözünürlüğe göre değişir

### Ücretsiz Tier
❌ Gemini 3 Pro için ücretsiz tier YOK
✅ Google AI Studio'da test edebilirsiniz

---

## 🚀 Kullanım Önerileri

### Ne Zaman Gemini 3 Pro?
✅ Karmaşık senaryo analizi
✅ Derin character development
✅ Çok adımlı problem çözme
✅ Kod üretimi ve debugging
✅ Uzun belge analizi (1M tokens)

### Ne Zaman Gemini 2.0 Flash?
✅ Hızlı görevler
✅ Düşük maliyet
✅ Yüksek throughput
✅ Basit sohbet

### Ne Zaman Gemini 1.5 Flash-8B?
✅ Çok hızlı yanıt gerektiğinde
✅ Minimum maliyet
✅ Basit görevler

---

## 🔍 Sorun Giderme

### Problem: "Model not found"
```
Çözüm: Model ID'yi kontrol et
✅ gemini-3-pro-preview (DOĞRU)
❌ gemini-3-pro (YANLIŞ)
❌ gemini-3 (YANLIŞ)
```

### Problem: Düşük performans
```
Çözüm: Temperature kontrolü
✅ temperature: 1.0 (Gemini 3 için önerilen)
❌ temperature: 0.1 (döngüye girebilir)
```

### Problem: Context window aşıldı
```
Input limit: 1M tokens
Output limit: 64K tokens

Çözüm:
1. Metni özetle
2. Context caching kullan
3. Medya çözünürlüğünü düşür
```

---

## 📚 Kaynaklar

- [Gemini 3 Geliştirici Kılavuzu](https://ai.google.dev/gemini-api/docs/gemini-3)
- [Gemini Models Listesi](https://ai.google.dev/gemini-api/docs/models/gemini)
- [API Key Alma](https://aistudio.google.com/apikey)
- [Gemini Cookbook](https://github.com/google-gemini/cookbook)
- [Fiyatlandırma](https://ai.google.dev/gemini-api/docs/pricing)

---

## ✅ Checklist

- [x] Gemini 3 Pro Preview model ID doğru
- [x] Gemini 3 Pro Image Preview model ID doğru
- [x] aiHandler.js güncellendi
- [x] ProvidersTab.jsx güncellendi
- [x] GOOGLE_GEMINI_API_GUIDE.md güncellendi
- [x] GEMINI_3_IMAGE_UPDATE.md güncellendi
- [x] Temperature=1.0 uyarısı eklendi
- [x] Thinking level dokümante edildi
- [x] Thought signatures açıklandı
- [ ] Production testleri yapılacak
- [ ] Kullanıcı feedback toplanacak

---

## 🎉 Sonuç

**Gemini 3 Pro entegrasyonu tamamlandı!**

En akıllı Gemini modeli artık MGXReader'da:
- ✅ Gelişmiş reasoning
- ✅ Multimodal yetenekler
- ✅ 4K görsel üretimi
- ✅ 1M token context window
- ✅ Thinking level kontrolü

**Önerilen Model Strateji:**
1. Karmaşık görevler → `gemini-3-pro-preview`
2. Hızlı görevler → `gemini-2.0-flash-exp`
3. Görsel üretim → `gemini-3-pro-image-preview`
