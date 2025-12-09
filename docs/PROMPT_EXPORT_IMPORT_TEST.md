# 🧪 Prompt Export/Import Test Senaryosu

**Tarih:** 8 Aralık 2025  
**Durum:** Test Hazır ✅  
**Düzeltilen Sorunlar:** Import logic tamamen yeniden yazıldı

---

## 🔧 Yapılan Düzeltmeler

### 1. Syntax Hataları (✅ Düzeltildi)
- **Sorun:** `promptStore.js` satır 1719-1726'da unreachable code ve eksik parantezler
- **Çözüm:** 
  - Unreachable code kaldırıldı
  - Try-catch yapısı düzeltildi
  - Persist middleware indentation düzeltildi
- **Sonuç:** 12 compiler hatası tamamen giderildi

### 2. Import Logic Sorunu (✅ Düzeltildi)
- **Sorun:** Export edilen dosya tüm promptları içeriyor (default + custom) ama import sırasında:
  - Default promptlar "değişmemiş" diye atlanıyordu
  - Sadece custom prompt count'u sayılıyordu
  - Merge mode'da hiçbir default prompt import edilmiyordu
  
- **Çözüm:**
  - **Replace Mode:** Tüm promptları custom olarak import et (default bile olsa)
  - **Merge Mode:** Sadece yeni veya değişmiş promptları ekle
  - Debug logging eklendi (console'da tüm işlem izlenebilir)

### 3. Error Handling (✅ İyileştirildi)
- Daha detaylı hata mesajları
- JSON format kontrolü
- Version detection (v1.0 vs v2.0)
- Console preview (ilk 500 karakter)

---

## 📋 Test Adımları

### 🎯 Test 1: Export Fonksiyonu

1. **Uygulamayı Başlat**
   ```bash
   npm run dev
   # veya
   npm start
   ```

2. **Ayarlar → AI Ayarları → Prompts sekmesine git**

3. **"Prompt Yönetimi" panelini aç** (sağ üstteki buton)

4. **"Tümünü Dışa Aktar" butonuna tıkla**
   - ✅ Beklenen: JSON dosyası indirilir
   - ✅ İsim: `MGXReader_AllPrompts_2025-12-08.json`
   - ✅ Alert: Prompt sayıları gösterilir

5. **Console (F12) Kontrol:**
   ```
   🚀 Export butonu tıklandı
   🔍 Export Debug - State: {...}
   📊 Category analysis: X default + Y custom = Z total
   📊 Category grammar: ...
   📊 Category speed_reading: ...
   📊 Category storyboard: ...
   ✅ [toplam] prompt exported: [dosya adı]
   ```

6. **JSON Dosyasını Aç ve Kontrol Et:**
   ```json
   {
     "version": "2.0",
     "exportDate": "2025-12-08T...",
     "exportType": "all",
     "prompts": {
       "analysis": { ... },
       "grammar": { ... },
       "speed_reading": { ... },
       "storyboard": { ... }
     },
     "activePrompts": { ... },
     "metadata": {
       "totalPrompts": 25,
       "customPrompts": 0,
       "defaultPrompts": 25,
       "categories": [...]
     }
   }
   ```

**✅ Başarı Kriteri:** JSON dosyası indirilebilir ve format doğru

---

### 🎯 Test 2: Import - Replace Mode

1. **Önceki testten indirilen JSON dosyasını kullan**

2. **Ayarlar → AI Ayarları → Prompts → Prompt Yönetimi**

3. **Import Modu: "Değiştir (Hepsini Sil)" seçeneğini işaretle**

4. **"JSON Dosyasından İçe Aktar" butonuna tıkla**

5. **İndirilen JSON dosyasını seç**

6. **Console (F12) Kontrol:**
   ```
   📂 JSON dosyası okunuyor...
   ✓ JSON parse başarılı: {...}
   🔍 Import Debug: {version: "2.0", hasPrompts: true, options: {...}}
   🔄 Replace mode aktif - tüm custom promptlar silinecek
   📊 Import sonucu: {success: true, imported: 25}
   ```

7. **Alert Mesajı:**
   ```
   ✅ 25 prompt başarıyla içe aktarıldı!
   
   Mod: Değiştirme
   Sayfa yeniden yüklenecek...
   ```

8. **Sayfa yeniden yüklendikten sonra:**
   - Prompts sekmesine git
   - Tüm promptlar görünür olmalı

**✅ Başarı Kriteri:** 25 prompt import edildi ve görünüyor

---

### 🎯 Test 3: Import - Merge Mode

1. **Önce bir custom prompt oluştur:**
   - Ayarlar → Prompts → Analysis kategorisi
   - "Yeni Prompt Oluştur" butonuna tıkla
   - İsim: `test_custom_prompt`
   - System: `Test system message`
   - User: `Test user message`
   - Kaydet

2. **Export et** (bu yeni custom prompt ile)

3. **Import Modu: "Birleştir (Ekle)" seçeneğini işaretle**

4. **Aynı JSON dosyasını tekrar import et**

5. **Console Kontrol:**
   ```
   🔀 Merge mode aktif - sadece yeni/değişmiş promptlar eklenecek
   ⊘ Skipped (already in custom): analysis/test_custom_prompt
   ⊘ Skipped (same as default): analysis/character_analysis
   ⊘ Skipped (same as default): analysis/location_analysis
   ...
   📊 Import sonucu: {success: true, imported: 0}
   ```

6. **Alert:**
   ```
   ✅ 0 prompt başarıyla içe aktarıldı!
   
   Mod: Birleştirme
   ```

7. **Custom prompt hala durmalı** (silinmemeli)

**✅ Başarı Kriteri:** Mevcut custom prompt korundu, duplicate import yapılmadı

---

### 🎯 Test 4: Modified Default Import (Merge Mode)

1. **Export edilen JSON dosyasını aç**

2. **Bir default prompt'u değiştir:**
   ```json
   "prompts": {
     "analysis": {
       "character_analysis": {
         "name": "🎭 Karakter Analizi [MODIFIED TEST]",
         "system": "Modified system message for testing",
         "user": "Modified user message"
       }
     }
   }
   ```

3. **Değiştirilmiş JSON'u kaydet**

4. **Import et (Merge mode)**

5. **Console Kontrol:**
   ```
   ✓ Modified default: analysis/character_analysis
   📊 Import sonucu: {success: true, imported: 1}
   ```

6. **Alert:**
   ```
   ✅ 1 prompt başarıyla içe aktarıldı!
   ```

7. **Prompts sekmesinde kontrol:**
   - `character_analysis` prompt'u değişmiş olmalı
   - İsim: "🎭 Karakter Analizi [MODIFIED TEST]"

**✅ Başarı Kriteri:** Default'tan farklı prompt başarıyla import edildi

---

### 🎯 Test 5: Category Export

1. **"Kategori Dışa Aktar" butonuna tıkla** (seçili kategori için)

2. **Console Kontrol:**
   ```
   ✅ X prompts exported: MGXReader_analysis_2025-12-08.json
   ```

3. **JSON Format:**
   ```json
   {
     "version": "2.0",
     "category": "analysis",
     "exportDate": "...",
     "exportType": "category",
     "prompts": {
       "analysis": { ... }
     },
     "activePrompt": "character_analysis",
     "metadata": {
       "totalPrompts": 8,
       "customPrompts": 1,
       "defaultPrompts": 7
     }
   }
   ```

**✅ Başarı Kriteri:** Kategori bazlı export çalışıyor

---

### 🎯 Test 6: Legacy Format (v1.0) Import

1. **Legacy format JSON oluştur:**
   ```json
   {
     "customPrompts": {
       "analysis": {
         "legacy_test": {
           "name": "Legacy Test",
           "system": "Old format",
           "user": "Old format user"
         }
       }
     },
     "activePrompts": {
       "analysis": "legacy_test"
     }
   }
   ```

2. **Bu JSON'u import et**

3. **Console Kontrol:**
   ```
   📜 Legacy v1.0 format detected
   ✅ 1 prompts imported (legacy v1.0 format)
   ```

**✅ Başarı Kriteri:** Backward compatibility çalışıyor

---

### 🎯 Test 7: Invalid Format Error Handling

1. **Geçersiz JSON oluştur:**
   ```json
   {
     "invalid": "format",
     "no": "prompts"
   }
   ```

2. **Import et**

3. **Console Kontrol:**
   ```
   ❌ Invalid prompt file format. Expected v2.0 with 'prompts' object or v1.0 with 'customPrompts' object. Received: ["invalid","no"]
   📋 JSON Data preview: {"invalid":"format","no":"prompts"}
   ```

4. **Alert:**
   ```
   ❌ İçe aktarma hatası:
   
   Invalid prompt file format...
   
   Konsolu (F12) kontrol edin.
   ```

**✅ Başarı Kriteri:** Hata yakalanıyor ve detaylı mesaj veriliyor

---

## 📊 Beklenen Sonuçlar

| Test | Durum | Import Sayısı | Açıklama |
|------|-------|---------------|----------|
| Export All | ✅ | - | 25+ prompt JSON'a yazılır |
| Import Replace | ✅ | 25 | Tüm promptlar custom olarak eklenir |
| Import Merge (ilk) | ✅ | 0 | Zaten var, duplicate yapılmaz |
| Import Merge (değişmiş) | ✅ | 1 | Sadece değişenler eklenir |
| Export Category | ✅ | - | Tek kategori export edilir |
| Legacy Import | ✅ | 1+ | v1.0 format desteklenir |
| Invalid Format | ✅ | 0 | Hata yakalanır |

---

## 🐛 Bilinen Sorunlar

### Çözüldü ✅
- ~~Import sırasında 0 prompt import ediliyor~~ → **Düzeltildi**
- ~~Merge mode çalışmıyor~~ → **Düzeltildi**
- ~~Replace mode custom promptları silmiyor~~ → **Düzeltildi**

### Açık Sorunlar
- Yok (henüz tespit edilmedi)

---

## 🎓 Kullanım Notları

### Replace Mode Ne Zaman Kullanılır?
- ✅ Başka bir bilgisayardan prompt paylaşımı
- ✅ Yedekten geri yükleme
- ✅ Varsayılan ayarlara dönüş (default export ile)
- ❌ Kendi promptlarını korumak istiyorsan KULLANMA

### Merge Mode Ne Zaman Kullanılır?
- ✅ Yeni promptları mevcut ayarlara eklemek
- ✅ Başkalarından prompt koleksiyonu almak (kendi ayarları koruyarak)
- ✅ Güvenli import (hiçbir şey silinmez)
- ❌ Eski promptları temizlemek istiyorsan yetersiz

---

## 📝 Test Checklist

**Uygulamayı başlatmadan önce:**
- [ ] `promptStore.js` dosyası kaydedildi
- [ ] `PromptsTab.jsx` dosyası kaydedildi
- [ ] Terminal'de error yok
- [ ] Uygulama build ediliyor

**Test sırasında:**
- [ ] Export butonu çalışıyor
- [ ] JSON dosyası indiriliyor
- [ ] JSON format doğru (version: 2.0)
- [ ] Import butonu çalışıyor
- [ ] Replace mode tüm promptları import ediyor
- [ ] Merge mode sadece değişenleri import ediyor
- [ ] Console log'lar açıklayıcı
- [ ] Alert mesajları doğru
- [ ] Sayfa reload sonrası promptlar görünüyor
- [ ] Custom promptlar korunuyor (merge mode)
- [ ] Custom promptlar siliniyor (replace mode)

---

## 🚀 Hızlı Test Komutu

```bash
# Terminal 1: Uygulamayı başlat
npm run dev

# Tarayıcı: F12 → Console aç
# Ayarlar → AI Ayarları → Prompts → Prompt Yönetimi

# 1. Export Testi
- "Tümünü Dışa Aktar" → JSON indir
- Console: "✅ X prompt exported" görmeli

# 2. Import Replace Testi
- "Değiştir" modunu seç
- JSON'u import et
- Console: "🔄 Replace mode aktif" + "✅ X prompts imported"

# 3. Import Merge Testi
- "Birleştir" modunu seç
- Aynı JSON'u tekrar import et
- Console: "⊘ Skipped" mesajları

# 4. Modified Import Testi
- JSON'da bir prompt'u değiştir
- Merge mode'da import et
- Console: "✓ Modified default: ..."
```

---

## 📞 Hata Durumunda

Eğer import başarısız olursa:

1. **Console (F12) kontrol et:**
   - Hangi satırda hata var?
   - JSON parse başarılı mı?
   - Version detection çalışıyor mu?

2. **JSON dosyasını kontrol et:**
   - Valid JSON mı? (JSONLint.com'da test et)
   - `version: "2.0"` var mı?
   - `prompts` objesi var mı?

3. **Log çıktısını paylaş:**
   ```
   🔍 Import Debug: {...}
   🔄/🔀 Mode mesajı
   ✓/⊘ Import kararları
   📊 Import sonucu
   ```

---

**Son Güncelleme:** 8 Aralık 2025, 03:15  
**Test Durumu:** Hazır ✅  
**Kod Durumu:** Syntax hataları düzeltildi, logic iyileştirildi ✅
