# Basitleştirilmiş Başlık Çıkarma Özelliği Test Kılavuzu

## Özellik Özeti

Karmaşık PDF metin analizi yerine **dosya adı odaklı** basit ve etkili başlık çıkarma:

1. **Dosya Adından Proje Başlığı**: Dosya adını temizleyerek anlamlı başlık çıkarma
2. **Bölüm/Chapter Tespiti**: "1. Bölüm", "Chapter 2" gibi kalıpları tanıma
3. **Çoklu Dosya Ortak Başlık**: Birden fazla dosyanın ortak proje adını bulma

## Test Dosyaları

### Tek Dosya Örnekleri:
- `gustav_maier_1_bolum.pdf` → **"Gustav Maier - 1. Bölüm"**
- `the_matrix_screenplay_v2.pdf` → **"The Matrix Screenplay"** 
- `kahve_dukkani_senaryo_final.pdf` → **"Kahve Dükkanı Senaryo"**
- `interstellar_chapter_3.pdf` → **"Interstellar - 3. Chapter"**

### Çoklu Dosya Örnekleri:
```
Gustav_Maier_1_Bolum.pdf
Gustav_Maier_2_Bolum.pdf  
Gustav_Maier_3_Bolum.pdf
```
→ **Ortak Başlık: "Gustav Maier"**

## Desteklenen Kalıplar

### Bölüm Tespit Kalıpları:
- **Türkçe**: `1. BÖLÜM`, `2 bölüm`, `BÖLÜM 3`
- **İngilizce**: `1. CHAPTER`, `Chapter 2`, `EPISODE 5`
- **Diğer**: `1. PART`, `PART 2`, `1. KISIM`
- **Sadece Numara**: `gustav_maier_1.pdf` → Son rakam

### Temizlenen Terimler:
- **Prefix/Suffix**: `senaryo_`, `screenplay_`, `_final`, `_v2`, `_draft`
- **Versiyon**: `v1`, `version2`, `sürüm3`, `ver4`  
- **Durum**: `final`, `son`, `nihai`, `last`, `new`, `yeni`

## Test Adımları

### 1. Tek PDF Test
```bash
npm start
```
1. "Editor" sekmesinde test dosyası yükleyin
2. Console'da şu logu arayın:
```javascript
🎬 Simplified title extraction from filename: {
  originalFileName: "gustav_maier_1_bolum.pdf",
  extractedTitle: "Gustav Maier - 1. Bölüm",
  method: "filename-based"
}
```
3. Header'da doğru başlığın görünüp görünmediğini kontrol edin

### 2. Çoklu Dosya Test  
1. "Multi Script Importer" sekmesini açın
2. Benzer dosyaları toplu yükleyin
3. Console logları:
```javascript
🎬 Simplified multi-import title extraction: {
  fileName: "Gustav_Maier_1_Bolum.pdf",
  extractedTitle: "Gustav Maier - 1. Bölüm", 
  method: "filename-based"
}

📁 Common project title detected for batch: {
  files: ["Gustav_Maier_1_Bolum.pdf", "Gustav_Maier_2_Bolum.pdf"],
  totalFiles: 3,
  commonTitle: "Gustav Maier"
}
```

## Başlık Çıkarma Mantığı

### 1. Dosya Adı Temizleme:
```javascript
"gustav_maier_1_bolum.pdf" 
→ "gustav maier 1 bolum"  // Uzantı + tire/alt çizgi temizleme
```

### 2. Bölüm Bilgisi Çıkarma:
```javascript
"gustav maier 1 bolum"
→ { number: 1, title: "1. Bölüm", type: "bölüm" }
```

### 3. Proje Adı Çıkarma:
```javascript
"gustav maier 1 bolum" - "1 bolum" 
→ "gustav maier" 
→ "Gustav Maier" (Title Case)
```

### 4. Final Başlık:
```javascript
"Gustav Maier" + " - " + "1. Bölüm"
→ "Gustav Maier - 1. Bölüm"
```

## Avantajlar

✅ **Hızlı**: PDF metni analiz etmeye gerek yok  
✅ **Güvenilir**: Dosya adı her zaman mevcut  
✅ **Türkçe Destek**: Bölüm, kısım gibi Türkçe terimler  
✅ **Temiz Sonuç**: Title Case formatında profesyonel görünüm  
✅ **Çoklu Dosya**: Seri/dizi projeler için ortak başlık  

## Debug Çıktıları

Başarılı çıkarma örneği:
```javascript
📁 File-based title extraction: {
  original: "interstellar_chapter_5_final.pdf",
  projectTitle: "Interstellar", 
  chapterNumber: 5,
  displayTitle: "Interstellar - 5. Chapter",
  isMultipart: true
}
```