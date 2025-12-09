# AI Provider Konfigürasyon Kılavuzu

## 🎯 Genel Bakış

ScriptMaster AI, üç farklı AI sağlayıcısını destekler:
1. **OpenAI** (GPT-4, GPT-3.5)
2. **Google Gemini** (Uzun senaryolar için önerilir - 1M token context)
3. **Local AI** (Ollama/LM Studio - Gizlilik modu)

## 🔧 Kurulum Adımları

### 1. AI Settings Menüsünü Açın

Header'daki AI sağlayıcı butonuna tıklayın:
- Yapılandırılmışsa: Provider adı gösterilir (OpenAI/Gemini/Local)
- Yapılandırılmamışsa: Sarı uyarı simgesi görünür

### 2. Sağlayıcı Seçimi

Açılan menüden AI Provider dropdown'ından birini seçin:

---

## 🌐 OpenAI Konfigürasyonu

### Avantajlar
- ✅ En popüler ve güvenilir
- ✅ Mükemmel anlama kapasitesi
- ✅ Hızlı yanıt süreleri
- ⚠️ Ücretli (pay-per-use)

### Kurulum
1. **API Key Alın:**
   - [platform.openai.com/api-keys](https://platform.openai.com/api-keys) adresine gidin
   - "Create new secret key" butonuna tıklayın
   - Anahtarı kopyalayın (bir daha gösterilmez!)

2. **ScriptMaster AI'da Yapılandırın:**
   - Provider: `OpenAI`
   - API Key: `sk-...` (kopyaladığınız anahtar)
   - Model: Seçenekler:
     - **GPT-4 Turbo** (128K context) - Önerilen
     - **GPT-4** (8K context)
     - **GPT-3.5 Turbo** (16K context) - Ekonomik

3. **Test Connection** butonuna tıklayın
4. **Save Settings**

### Fiyatlandırma (Tahmini)
- GPT-4 Turbo: ~$0.01 per 1K tokens input, ~$0.03 per 1K tokens output
- 120 sayfalık senaryo analizi: ~$1-2

---

## 🌟 Google Gemini Konfigürasyonu (ÖNERİLEN)

### Avantajlar
- ⭐ **1 MİLYON TOKEN CONTEXT!** (Tüm uzun metraj senaryosu tek seferde)
- ✅ Ücretsiz katman (günde 60 request)
- ✅ Çok hızlı
- ✅ Mükemmel Türkçe desteği

### Kurulum
1. **API Key Alın:**
   - [makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey) adresine gidin
   - "Create API Key" butonuna tıklayın
   - Anahtarı kopyalayın

2. **ScriptMaster AI'da Yapılandırın:**
   - Provider: `Google Gemini`
   - API Key: `AIza...` (kopyaladığınız anahtar)
   - Model: Seçenekler:
     - **Gemini 1.5 Pro** ⭐ Önerilen (1M context)
     - **Gemini 1.5 Flash** (1M context, daha hızlı)
     - **Gemini Pro** (32K context)

3. **Test Connection** butonuna tıklayın
4. **Save Settings**

### Neden Gemini?
- 📚 **120 sayfalık senaryo** = ~30,000 kelime = ~40,000 token
- ✅ Gemini 1.5 Pro: 1,000,000 token (25 tane 120 sayfalık senaryo!)
- ✅ OpenAI GPT-4: 8,192 token (sadece 25 sayfa)
- ✅ Ücretsiz katman var

### Fiyatlandırma
- **Ücretsiz:** 60 request/dakika
- Ücretli: $7 per 1M tokens (çok ucuz)

---

## 🏠 Local AI Konfigürasyonu (Privacy Mode)

### Avantajlar
- 🔒 **%100 GİZLİLİK** - Verileriniz hiçbir yere gitmez
- ✅ Ücretsiz (sadece elektrik)
- ✅ İnternet gerektirmez
- ⚠️ Daha yavaş (donanıma bağlı)
- ⚠️ Teknik bilgi gerektirir

### Ön Gereksinimler
Mac/Linux veya Windows üzerinde:
- **Ollama** veya **LM Studio** kurulu olmalı
- Minimum 8GB RAM (16GB+ önerilir)
- AI modeli indirilmiş olmalı

### Ollama Kurulumu

#### 1. Ollama'yı İndirin
```bash
# Mac
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# https://ollama.com/download/windows adresinden exe'yi indirin
```

#### 2. Ollama'yı Başlatın
```bash
ollama serve
# Arka planda çalışır: http://localhost:11434
```

#### 3. Model İndirin
```bash
# Önerilen modeller:
ollama pull llama3        # 7B, genel amaçlı
ollama pull mistral       # 7B, hızlı ve kaliteli
ollama pull gemma         # Google'ın modeli
ollama pull phi3          # Microsoft, kompakt

# Kurulu modelleri görmek için:
ollama list
```

### ScriptMaster AI'da Yapılandırma

1. **Provider:** `Local AI`
2. **Endpoint URL:** 
   - Ollama: `http://localhost:11434`
   - LM Studio: `http://localhost:1234`
3. **Model Name:** İndirdiğiniz model adı (örn: `llama3`)
4. **Temperature:** 0.3 (Dengeli)
   - 0.0: Çok deterministik
   - 1.0: Balanced
   - 2.0: Çok yaratıcı

5. **Test Connection** → **Save Settings**

### Performans İpuçları

**Hız Karşılaştırması (120 sayfa senaryo):**
- OpenAI GPT-4: ~30 saniye
- Gemini 1.5 Pro: ~20 saniye
- Llama 3 (8GB RAM): ~5-10 dakika
- Llama 3 (16GB RAM + M1/M2): ~2-3 dakika

**Öneriler:**
- İlk analiz için: **Gemini** (hızlı + ücretsiz)
- Gizlilik hassasiyeti: **Local AI**
- Profesyonel kullanım: **OpenAI**

---

## 🔄 Sağlayıcı Değiştirme

İstediğiniz zaman AI Settings'den farklı bir sağlayıcıya geçebilirsiniz. Ayarlarınız kaydedilir ve her sağlayıcı için ayrı konfigürasyon tutulur.

**Örnek Senaryo:**
1. Gramer düzeltme → Local AI (hızlı + ücretsiz)
2. Detaylı analiz → Gemini (uzun context)
3. Final rapor → OpenAI (en yüksek kalite)

---

## 🧪 Test Connection Özelliği

Her sağlayıcı için "Test Connection" butonu:
- ✅ Başarılı: "OK" yanıtı gösterir
- ❌ Başarısız: Hata mesajını gösterir

**Sık Karşılaşılan Hatalar:**

### "API key is required"
➜ API anahtarı girilmemiş

### "Failed to fetch" / "Network Error"
➜ İnternet bağlantısı yok veya endpoint yanlış

### "Invalid API key"
➜ API anahtarı hatalı veya süresi dolmuş

### "Model not found" (Local AI)
➜ Model indirilmemiş: `ollama pull <model-name>`

### "Connection refused" (Local AI)
➜ Ollama çalışmıyor: `ollama serve`

---

## 💡 Kullanım Senaryoları

### Senaryo 1: Hobbyci Yazar
**Önerilen:** Local AI (Llama 3)
- Ücretsiz
- Gizli
- Hız önemli değil

### Senaryo 2: Profesyonel Yapım
**Önerilen:** Gemini 1.5 Pro
- Tüm senaryo tek seferde
- Hızlı
- Ücretsiz katman

### Senaryo 3: Hassas İçerik
**Önerilen:** Local AI (Mistral)
- %100 privacy
- NDA uyumlu
- Offline çalışma

### Senaryo 4: Maksimum Kalite
**Önerilen:** OpenAI GPT-4 Turbo
- En iyi anlama
- En iyi analiz kalitesi
- Ücretli ama değer

---

## 🛡️ Güvenlik ve Gizlilik

### API Anahtarları
- Electron-store ile yerel olarak şifrelenerek saklanır
- Hiçbir sunucuya gönderilmez
- Sadece seçilen AI sağlayıcısına gider

### Local AI
- Verileriniz asla bilgisayarınızdan çıkmaz
- İnternet gerektirmez
- NDA ve GDPR uyumlu

---

## 📊 Karşılaştırma Tablosu

| Özellik | OpenAI | Gemini | Local AI |
|---------|--------|--------|----------|
| **Context** | 128K | 1M ⭐ | Değişken |
| **Hız** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐ |
| **Kalite** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Fiyat** | $$ | Ücretsiz+ | Ücretsiz |
| **Gizlilik** | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| **Kurulum** | Kolay | Kolay | Orta |

---

## 🎬 Başlangıç Önerisi

**İlk kez kullanıyorsanız:**

1. **Gemini** ile başlayın (Ücretsiz + Güçlü)
2. API key alın (5 dakika)
3. Test edin
4. Beğenirseniz devam edin

**Gizlilik önemliyse:**
1. Ollama kurun (10 dakika)
2. Llama 3 indirin (5 dakika)
3. Local AI yapılandırın

**Profesyonel kullanım:**
1. OpenAI hesabı açın
2. $5 kredi yükleyin
3. GPT-4 Turbo ile başlayın

---

**Yardıma mı ihtiyacınız var?** Header'daki AI Provider butonuna tıklayın ve "Test Connection" ile kurulumunuzu doğrulayın!
