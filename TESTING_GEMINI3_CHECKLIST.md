# ✅ Gemini 3 Pro API Entegrasyonu - TEST KONTROL LİSTESİ

## 📋 Uygulamada Test Yapma Adımları

### ADIM 1️⃣ : ⚙️ Ayarlar → Google Gemini API Key Gir
```
1. Uygulamada ⚙️ Settings ikonuna tıkla
2. "AI Providers" tab'ına git
3. Dropdown'dan "Google Gemini" seç
4. API Key alanına kendi Gemini API key'ini yapıştır
   - Key al: https://aistudio.google.com/app/apikey
5. "Test" button'ı tıkla (eğer varsa)
6. Model dropdown'dan "Gemini 3 Pro (Latest) ✨" seçildiğini doğrula
```

**Beklenen Sonuç:** 
- ✅ API Key kaydedilmiş
- ✅ Model: gemini-3-pro-preview gösterildi
- ✅ Temperature: 1.0
- ✅ No error messages

---

### ADIM 2️⃣ : 📝 Senaryo Seç
```
1. Sol panel'den bir senaryo yükle
   - "Load Sample" kullan veya
   - "Upload PDF" ile kendi screenplay'ini ekle
2. Senaryo başarıyla yüklendiğini doğrula
3. Senaryo panel'de görüntüleniyor
```

**Beklenen Sonuç:**
- ✅ Senaryo metni visible
- ✅ Scene count gösterildi
- ✅ Character list gösterildi

---

### ADIM 3️⃣ : 🎬 "Simple Storyboard" Tab'ına Git
```
1. Sağ panel'de tab'ları bul
2. "Simple Storyboard" tab'ını tıkla
```

**Beklenen Sonuç:**
- ✅ SimpleStoryboard bileşeni loaded
- ✅ "Senaryoyu Analiz Et" button visible
- ✅ Google Gemini badge gösterildi

---

### ADIM 4️⃣ : 🔍 "Senaryoyu Analiz Et" Tıkla
```
1. "Senaryoyu Analiz Et" button'ı tıkla
2. Loading spinner'ı bekle
   - Expected duration: 3-8 seconds
3. Console'da gelen API logs'u kontrol et (F12 açıp Console tab)
```

**Beklenen Sonuç:**
- ✅ Button disabled + spinner visible
- ✅ Console'da: "Making Gemini API request..."
- ✅ Console'da: API URL (v1 endpoint)
- ✅ Console'da: Model: "gemini-3-pro-preview"
- ✅ Console'da: "generationConfig: {..., thinkingLevel: 'low'}"
- ✅ 3-8 saniye sonra scenes liste görüntülendi

**API İstekleri (Developer Tools → Network):**
```
POST /v1/models/gemini-3-pro-preview:generateContent?key=...
Status: 200 OK
Response: {
  "candidates": [{
    "content": {
      "parts": [{
        "text": "[{\"title\": \"...\", ...}]"
      }]
    }
  }]
}
```

---

### ADIM 5️⃣ : ✅ Sahneler Extracted
```
1. Analiz bittikten sonra kontrol et:
   - Scene count (expected: 5-15)
   - Her scene'de: title, location, timeOfDay, description
   - Green success banner: "Analiz Tamamlandı"
```

**Beklenen Sonuç:**
- ✅ Scene card'ları grid layout'ta
- ✅ Her card'da scene info
- ✅ Green banner: "📋 Analiz Tamamlandı"
- ✅ Scene count displayed

**JSON Format Doğrulama:**
```javascript
// Her scene'de gerekli:
{
  "title": "Sahne başlığı",
  "location": "Mekan",
  "timeOfDay": "Zaman (GÜN/GECESİ)",
  "description": "Kısa açıklama",
  "visualPrompt": "Image generation için prompt"
}
```

---

### ADIM 6️⃣ : 🎨 "Tüm Storyboard'ları Üret" Tıkla
```
1. "Tüm Storyboard'ları Üret" button'ı tıkla
2. Progress bar'ı gözlemle: "Üretiliyor 1/10" vs.
3. Her scene için ~5-10 saniye bekle
4. Console'da gelen logs'u kontrol et
```

**Beklenen Sonuç:**
- ✅ Button disabled + spinner visible
- ✅ Progress: "Üretiliyor 1/10"
- ✅ Console'da: "Making Gemini API request..." (text gen)
- ✅ Console'da: "Gemini Image Generation Request..." (image gen)

**API İstekleri (Network):**
```
// Text Analysis
POST /v1/models/gemini-3-pro-preview:generateContent?key=...
Status: 200 OK

// Image Generation (Imagen-3)
POST /v1/models/imagen-3.0-generate-001:generateImage?key=...
Status: 200 OK
Response: {
  "generatedImages": [{
    "bytesBase64": "iVBORw0KGgo..."  // Base64 image
  }]
}
```

---

### ADIM 7️⃣ : 🖼️ Görseller Rendered
```
1. Her scene card'da görsel yükleniyor
2. Base64 image'lar data URL'den render ediliyor
3. All scenes complete:
   - Green checkmark or
   - Complete grid visibility
```

**Beklenen Sonuç:**
- ✅ Scene thumbnail'lar visible (1024x1024)
- ✅ Grid layout responsive
- ✅ No broken image icons
- ✅ All 10-15 scenes with images

---

### ADIM 8️⃣ : ✏️ Custom Prompt Testi (Optional)
```
1. İlk scene'de ✏️ button'ı tıkla
2. Prompt text'e tıkla veya ✏️ edit button
3. Custom prompt gir (Türkçe veya İngilizce)
4. "✨ Üret" button'ı tıkla
```

**Beklenen Sonuç:**
- ✅ Text area editable
- ✅ "✨ Üret" button visible
- ✅ New image generated within 10 sec
- ✅ Console logs show custom prompt

---

### ADIM 9️⃣ : 💾 Verilerin Kaydedildiğini Doğrula
```
1. Uygulamayı kapat
2. Uygulamayı yeniden aç
3. Aynı senaryo'yu seç
4. Simple Storyboard tab'ını aç
```

**Beklenen Sonuç:**
- ✅ Önceki storyboard'lar hala visible
- ✅ Görseller hala yüklü (local store)
- ✅ Scene bilgileri intact

---

## 🔍 Troubleshooting Kontrol Listesi

### Problem: API key çalışmıyor
```
❌ "Invalid Gemini API key"
✅ Çözüm:
1. https://aistudio.google.com/app/apikey'den yeni key al
2. Billing'in aktif olduğunu doğrula
3. Key'i tekrar gir ve test et
```

### Problem: "Model not found"
```
❌ "Model 'gemini-3-pro-preview' not found"
✅ Çözüm:
1. Region check: Türkiye/EU bölgesinde mı?
2. Fallback: "gemini-1.5-flash" seç
3. API erişimini doğrula
```

### Problem: Rate limit error
```
❌ "Rate limit exceeded (429)"
✅ Çözüm:
1. 60 saniye bekle
2. Daha az scene analiz et
3. Pro plan'a upgrade et
```

### Problem: Image generation başarısız
```
❌ "No image generated from Gemini response"
✅ Çözüm:
1. Prompt'ı kontrol et (inappropriate content?)
2. Aspect ratio'yu değiştir
3. Imagen API'ın region'da aktif olduğunu doğrula
```

### Problem: JSON parsing hatası
```
❌ "Failed to parse analysis response"
✅ Çözüm:
1. Senaryo metninin UTF-8 olduğunu doğrula
2. JSON format'ında prompt bekle
3. Dev console'da raw response'ı gözlemle
```

---

## 📊 Beklenen Sonuçlar Özeti

### API Features
| Feature | Status | Expected |
|---------|--------|----------|
| Gemini 3 Pro Model | ✅ Deployed | gemini-3-pro-preview |
| thinkingLevel | ✅ Enabled | 'low' in generationConfig |
| Temperature | ✅ Optimized | 1.0 default |
| API Endpoint | ✅ Updated | v1 (not v1beta) |
| Authentication | ✅ Fixed | Query parameter (not header) |
| Imagen-3 Gen | ✅ Ready | imagen-3.0-generate-001 |
| Error Handling | ✅ Complete | 6 status code handlers |

### Performance
| Metric | Expected | Actual |
|--------|----------|--------|
| Text Analysis | 3-8 sec | ⏱️ Measure |
| Image Generation | 5-10 sec | ⏱️ Measure |
| Grid Rendering | <1 sec | ⏱️ Measure |
| Total Time (10 scenes) | 60-90 sec | ⏱️ Measure |

### Quality
| Aspect | Benchmark | Expected |
|--------|-----------|----------|
| Scene Detection | 80%+ | ⏱️ Verify |
| Image Quality | DALL-E 3 level | ⏱️ Verify |
| Prompt Accuracy | 90%+ | ⏱️ Verify |
| Error Recovery | All cases | ⏱️ Verify |

---

## 🎉 Success Criteria

✅ **Başarılı Sayılması İçin Gereken:**

1. ✅ API Key kaydedilip doğrulandı
2. ✅ Senaryo başarıyla analiz edildi (Gemini 3 Pro'dan JSON)
3. ✅ Minimum 5 sahne extracted
4. ✅ Her sahne için görsel üretildi (Imagen-3)
5. ✅ Tüm görseller grid'de render edildi
6. ✅ Custom prompt editing çalıştı
7. ✅ Veriler persist etti (reload sonrası)
8. ✅ Console'da error yok
9. ✅ Network requests başarılı (200 OK)
10. ✅ Bölgesel kısıtlama yok

---

## 📝 Test Sonuçları Örneği

```
🧪 TEST SESSION: 21 Kasım 2025 - 14:30

API KEY: ✅ Valid (AIza...)
MODEL: ✅ gemini-3-pro-preview
TEMPERATURE: ✅ 1.0
THINKING_LEVEL: ✅ 'low'

ANALYSIS: ✅ Success
  - Time: 5.2 sec
  - Scenes: 12 extracted
  - JSON Valid: Yes

IMAGE GEN (Scene 1): ✅ Success
  - Time: 7.8 sec
  - Model: imagen-3.0-generate-001
  - Size: 1024x1024
  - Base64: 2.4 MB

TOTAL TIME (12 scenes): 92 sec
AVERAGE PER SCENE: 7.67 sec
SUCCESS RATE: 100% (12/12)

CONCLUSION: ✅ FULLY OPERATIONAL
```

---

**Testi tamamladıktan sonra sonuçları bildirin!** 📬
