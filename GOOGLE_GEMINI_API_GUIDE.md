# Google Gemini API Entegrasyon Rehberi

## Kasım 2025 Güncel Model Listesi

### 🎨 Görsel Üretim Modelleri (Image Generation)

#### **Gemini 3 Pro Image Preview** ⭐ ÖNERİLEN
- **Model ID**: `gemini-3-pro-image-preview`
- **Durum**: Preview (Önizleme)
- **Özellikler**:
  - AI tabanlı görsel üretim
  - Yüksek kalite, sanatsal görseller
  - Prompt ile detaylı kontrol
  - Context window: 8K tokens
- **API Endpoint**: 
  ```
  https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent
  ```
- **Kullanım Alanları**:
  - Storyboard görsel üretimi
  - Karakter konsept tasarımı
  - Sahne görselleştirme
  - Film prodüksiyon ön görselleri

#### **Imagen 3.0**
- **Model ID**: `imagen-3.0-generate-001`
- **Durum**: Stable
- **Özellikler**:
  - Google Imagen 3 görsel modeli
  - Fotorealistik görseller
  - Hızlı üretim süreleri
  - Context window: 4K tokens
- **API Endpoint**:
  ```
  https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:generateContent
  ```

---

### 🤖 Metin Üretim Modelleri (Text Generation)

#### **Gemini 3 Pro Preview** ⭐ ÖNERİLEN
- **Model ID**: `gemini-3-pro-preview`
- **Durum**: Preview
- **Özellikler**:
  - En akıllı Gemini modeli
  - Gelişmiş akıl yürütme (reasoning)
  - Multimodal (metin, görsel, video)
  - 1M token context window / 64K output
  - Düşünme düzeyi (thinking level) kontrolü
  - Kesme tarihi: Ocak 2025
- **API Endpoint**:
  ```
  https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent
  ```
- **Kullanım Alanları**:
  - Karmaşık senaryo analizi
  - Derin karakter gelişimi
  - Çok adımlı problem çözme
  - Kod üretimi ve debugging
  - Uzun belge analizi

#### **Gemini 2.0 Flash Exp**
- **Model ID**: `gemini-2.0-flash-exp`
- **Durum**: Experimental
- **Özellikler**:
  - Multimodal (metin, görsel, ses, video)
  - 1M token context window
  - Çok hızlı yanıt süreleri
  - Gelişmiş kod üretimi
- **API Kullanımı**:
  ```javascript
  const model = 'gemini-2.0-flash-exp';
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
  ```

#### **Gemini Experimental 1206**
- **Model ID**: `gemini-exp-1206`
- **Durum**: Experimental
- **Özellikler**:
  - 2M token context window
  - Gelişmiş mantıksal akıl yürütme (reasoning)
  - Uzun belge analizi
  - Kompleks problem çözme
- **Kullanım Alanları**:
  - Senaryo analizi
  - Karakter gelişimi planlama
  - Dramatik yapı önerileri

#### **Gemini 2.0 Flash Thinking (Experimental)**
- **Model ID**: `gemini-2.0-flash-thinking-exp-1219`
- **Durum**: Experimental
- **Özellikler**:
  - Düşünme süreci (thinking mode)
  - 32K token context window
  - Adım adım problem çözme
  - Detaylı açıklamalar

#### **Gemini 1.5 Flash**
- **Model ID**: `gemini-1.5-flash-latest`
- **Durum**: Stable
- **Özellikler**:
  - 1M token context window
  - Hızlı yanıt süreleri
  - Düşük maliyet
- **Kullanım**: Günlük AI görevleri için ideal

#### **Gemini 1.5 Pro**
- **Model ID**: `gemini-1.5-pro-latest`
- **Durum**: Stable
- **Özellikler**:
  - 2M token context window
  - Yüksek doğruluk
  - Gelişmiş anlama yeteneği
- **Kullanım**: Karmaşık analiz görevleri için

#### **Gemini 1.5 Flash-8B**
- **Model ID**: `gemini-1.5-flash-8b`
- **Durum**: Stable
- **Özellikler**:
  - 1M token context window
  - Çok hızlı (8B parametre)
  - Çok düşük maliyet
- **Kullanım**: Basit görevler için ekonomik seçenek

---

### 🔬 Preview Modelleri

#### **Gemini 3 Pro Preview** ⭐ ÖNERİLEN
- **Model ID**: `gemini-3-pro-preview`
- **Durum**: Preview
- **Özellikler**:
  - 1M token context window / 64K output
  - Gelişmiş düşünme (reasoning)
  - Multimodal yetenekler
  - Düşünme düzeyi ayarı
- **Kullanım**: En akıllı model, kompleks görevler için

#### **LearnLM 1.5 Pro (Experimental)**
- **Model ID**: `learnlm-1.5-pro-experimental`
- **Durum**: Preview
- **Özellikler**:
  - 2M token context window
  - Eğitim odaklı
  - Pedagojik öneriler
- **Kullanım Alanları**:
  - Senaryo yazım eğitimleri
  - Karakter gelişimi dersleri
  - Dramatik yapı öğretimi

---

## 🔑 API Key Kurulumu

### API Key Alma

1. [Google AI Studio](https://aistudio.google.com/app/apikey) adresine gidin
2. Google hesabınızla giriş yapın
3. "Get API Key" butonuna tıklayın
4. Yeni bir API key oluşturun veya mevcut key'i kopyalayın
5. API key'i güvenli bir yerde saklayın

### API Key Ekleme (MGXReader)

1. **Ayarlar** menüsüne gidin
2. **API Yapılandırması** sekmesini açın
3. **Google Gemini** bölümüne gidin
4. API Key'inizi yapıştırın
5. **Kaydet** butonuna tıklayın

---

## 📊 API Kullanım Limitleri

### Ücretsiz Tier (Free Tier)

| Model | RPM (Request/dk) | TPM (Token/dk) | RPD (Request/gün) |
|-------|------------------|----------------|-------------------|
| Gemini 2.0 Flash Exp | 10 | 4,000,000 | 1,500 |
| Gemini 1.5 Flash | 15 | 1,000,000 | 1,500 |
| Gemini 1.5 Pro | 2 | 32,000 | 50 |
| Gemini 3 Pro Image | 5 | 100,000 | 100 |

### Paid Tier (Ücretli Tier)

| Model | RPM | TPM | RPD |
|-------|-----|-----|-----|
| Gemini 2.0 Flash Exp | 1,000 | 4,000,000 | Sınırsız |
| Gemini 1.5 Flash | 2,000 | 4,000,000 | Sınırsız |
| Gemini 1.5 Pro | 1,000 | 4,000,000 | Sınırsız |
| Gemini 3 Pro Image | 100 | 1,000,000 | Sınırsız |

---

## 💰 Fiyatlandırma

### Metin Modelleri (1M token başına)

| Model | Input | Output | Context Cache* |
|-------|--------|--------|----------------|
| Gemini 2.0 Flash Exp | Ücretsiz | Ücretsiz | Ücretsiz |
| Gemini 1.5 Flash | $0.075 | $0.30 | $0.019 |
| Gemini 1.5 Pro | $1.25 | $5.00 | $0.31 |
| Gemini 1.5 Flash-8B | $0.038 | $0.15 | $0.010 |

### Görsel Üretim

| Model | Fiyat (görsel başına) |
|-------|----------------------|
| Gemini 3 Pro Image Preview | Ücretsiz (preview) |
| Imagen 3.0 | $0.04 (1024x1024) |

*Context Cache: Büyük promptların önbelleğe alınması

---

## 🔧 API Kullanım Örnekleri

### Metin Üretimi (Text Generation)

```javascript
import AIHandler from './utils/aiHandler.js';

const handler = new AIHandler({
  provider: 'gemini',
  apiKey: 'YOUR_GEMINI_API_KEY',
  model: 'gemini-3-pro-preview' // En akıllı model
});

const response = await handler.callGemini(
  'Sen bir senaryo analiz uzmanısın.',
  'Bu sahnenin duygusal etkisini analiz et: ...',
  0.7, // temperature
  2048 // maxTokens
);
```

### Görsel Üretimi (Image Generation)

```javascript
const imageResult = await handler.generateImageGemini(
  'Cyberpunk tarzında, gece sahnesinde, neon ışıklı şehir manzarası, 4K kalite',
  {
    model: 'gemini-3-pro-image-preview',
    temperature: 0.8
  }
);

console.log('Görsel URL:', imageResult.imageUrl);
console.log('MIME Type:', imageResult.mimeType);
```

### Multimodal Analiz (Görsel + Metin)

```javascript
const analysis = await handler.callGemini(
  'Sen bir görsel analiz uzmanısın.',
  'Bu storyboard çiziminin kompozisyonunu analiz et.',
  0.5,
  1024
);
```

---

## ⚠️ Güvenlik Filtreleri

Gemini API, aşağıdaki kategorilerde içerik filtreleme yapar:

1. **HARM_CATEGORY_HARASSMENT**: Taciz içeriği
2. **HARM_CATEGORY_HATE_SPEECH**: Nefret söylemi
3. **HARM_CATEGORY_SEXUALLY_EXPLICIT**: Cinsel içerik
4. **HARM_CATEGORY_DANGEROUS_CONTENT**: Tehlikeli içerik

### Filter Threshold Seviyeleri

- `BLOCK_NONE`: Filtreleme yok
- `BLOCK_ONLY_HIGH`: Sadece yüksek riskli
- `BLOCK_MEDIUM_AND_ABOVE`: Orta ve üzeri (varsayılan)
- `BLOCK_LOW_AND_ABOVE`: Düşük ve üzeri

### MGXReader Filtreleme Ayarları

```javascript
safetySettings: [
  {
    category: "HARM_CATEGORY_HARASSMENT",
    threshold: "BLOCK_MEDIUM_AND_ABOVE"
  },
  {
    category: "HARM_CATEGORY_HATE_SPEECH", 
    threshold: "BLOCK_MEDIUM_AND_ABOVE"
  },
  {
    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    threshold: "BLOCK_MEDIUM_AND_ABOVE"
  },
  {
    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
    threshold: "BLOCK_MEDIUM_AND_ABOVE"
  }
]
```

---

## 🚀 En İyi Kullanım Pratikleri

### Model Seçimi

1. **En İyi Performans** → `gemini-3-pro-preview` (en akıllı, reasoning)
2. **Hızlı Görevler** → `gemini-2.0-flash-exp` veya `gemini-1.5-flash-8b`
3. **Karmaşık Analiz** → `gemini-3-pro-preview` veya `gemini-1.5-pro-latest`
3. **Görsel Üretim** → `gemini-3-pro-image-preview`
4. **Bütçe Dostu** → `gemini-1.5-flash-8b`

### Prompt Optimizasyonu

```javascript
// ❌ Kötü Örnek
"Bir sahne oluştur"

// ✅ İyi Örnek
"Cyberpunk tarzında, gece sahnesinde, yağmurlu sokak, neon ışıkları, 
tek karakter (erkek dedektif, trençkot), karanlık atmosfer, sinematik 
kompozisyon, 4K kalite"
```

### Token Yönetimi

- **Kısa Görevler**: 512-1024 token
- **Orta Görevler**: 1024-2048 token
- **Uzun Görevler**: 2048-4096 token
- **Çok Uzun Belgeler**: 4096-8192 token

### Rate Limiting

```javascript
// Rate limit aşımı kontrolü
try {
  const response = await handler.callGemini(...);
} catch (error) {
  if (error.response?.status === 429) {
    console.error('Rate limit aşıldı. 60 saniye bekleyin.');
    await new Promise(resolve => setTimeout(resolve, 60000));
    // Retry
  }
}
```

---

## 🔗 Faydalı Bağlantılar

- [Google AI Studio](https://aistudio.google.com/)
- [Gemini API Dokümantasyonu](https://ai.google.dev/docs)
- [Model Karşılaştırma](https://ai.google.dev/models/gemini)
- [Pricing Calculator](https://ai.google.dev/pricing)
- [API Limits Dashboard](https://aistudio.google.com/app/limits)

---

## 📝 Güncellemeler

### Kasım 2025
- ✅ Gemini 3 Pro Image Preview eklendi
- ✅ Gemini 2.0 Flash Experimental modelleri eklendi
- ✅ Imagen 3.0 desteği eklendi
- ✅ Context cache özelliği eklendi
- ✅ Multimodal (görsel + metin) desteği genişletildi

### Planlanan Özellikler
- 🔜 Gemini 3 Ultra (2025 Q1)
- 🔜 Video üretimi (Veo 2.0)
- 🔜 Ses sentezleme
- 🔜 Daha uzun context window (10M+ tokens)

---

## ❓ Sık Sorulan Sorular

### Gemini 3 Pro Image ücretsiz mi?
Evet, preview döneminde ücretsiz. Ancak günlük request limiti (100 request/gün) var.

### Hangi model en hızlı?
`gemini-1.5-flash-8b` en hızlı model. Ardından `gemini-2.0-flash-exp` geliyor.

### Context window ne kadar önemli?
Uzun senaryo analizi için çok önemli. 1M+ token seçenekleri tam senaryo okuma için ideal.

### API Key ücretsiz mi?
Evet, Google AI Studio'da ücretsiz API key alabilirsiniz. Ücretsiz tier sınırları oldukça cömert.

### Rate limit aşarsam ne olur?
429 hatası alırsınız ve 60 saniye beklemeniz gerekir. Ücretli tier'a geçerek limitleri artırabilirsiniz.

---

## 📞 Destek

Sorunlarla karşılaşırsanız:
1. [Google AI Forum](https://discuss.ai.google.dev/)
2. [GitHub Issues](https://github.com/your-repo/issues)
3. [API Status Page](https://status.cloud.google.com/)
