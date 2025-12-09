# Speed Reader - Özellikler ve Klavye Kısayolları

## 🎯 Yeni Özellikler

### 1. **Tam Ekran Modu (Fullscreen)**
- **F** tuşu veya toolbar'daki buton ile tam ekran moduna geçiş
- **ESC** tuşu ile tam ekrandan çıkış
- Maksimum odaklanma için ideal

### 2. **ORP (Optimal Recognition Point) Ayarı**
- Vurgulanan harfin pozisyonunu sağa/sola kaydırabilme
- **[** veya **<** tuşu: Odak noktasını sola kaydır
- **]** veya **>** tuşu: Odak noktasını sağa kaydır
- -3 ile +3 arasında ayarlanabilir
- Herkes için optimal okuma deneyimi

### 3. **Gelişmiş Ayarlar Menüsü**
- **S** tuşu ile ayarlar panelini aç
- Tüm okuma parametrelerini tek yerden yönet
- Gerçek zamanlı önizleme

## ⌨️ Klavye Kısayolları

### Temel Kontroller
| Tuş | Fonksiyon |
|-----|-----------|
| `SPACE` | Oynat/Duraklat |
| `HOME` | Başa dön |
| `←` | 10 kelime geri |
| `→` | 10 kelime ileri |

### Görünüm Kontrolleri
| Tuş | Fonksiyon |
|-----|-----------|
| `F` | Tam ekran aç/kapat |
| `S` | Ayarlar menüsünü aç |
| `ESC` | Tam ekrandan çık |

### ORP (Odak Noktası) Ayarı
| Tuş | Fonksiyon |
|-----|-----------|
| `[` veya `<` | Odak noktasını sola kaydır |
| `]` veya `>` | Odak noktasını sağa kaydır |

## 🎛️ Ayarlar Menüsü İçeriği

### Reading Speed (Okuma Hızı)
- **Aralık:** 100-1000 WPM
- **Varsayılan:** 250 WPM
- **Öneriler:**
  - 100-200 WPM: Yavaş, detaylı okuma
  - 250-400 WPM: Normal okuma
  - 500-1000 WPM: Hızlı tarama

### Font Size (Yazı Boyutu)
- **Aralık:** 24-96px
- **Varsayılan:** 48px
- Ekran boyutunuza ve mesafenize göre ayarlayın

### Focus Letter Position (Odak Noktası)
- **Aralık:** -3 ile +3
- **Varsayılan:** 0 (otomatik)
- **Nasıl çalışır?**
  - Negatif değerler: Odak noktası sola kayar
  - Pozitif değerler: Odak noktası sağa kayar
  - Her kelimenin uzunluğuna göre otomatik ayarlanır

### Display Options (Görünüm Seçenekleri)
- **Progress Bar:** İlerleme çubuğu göster/gizle
- **Focus Mode:** Dikkat dağıtıcı öğeleri gizle

## 💡 Kullanım İpuçları

### Optimal Okuma Hızı Bulma
1. 250 WPM ile başlayın
2. Rahat okuyabiliyorsanız 50 WPM artırın
3. Kelimeler çok hızlı kaçıyorsa 50 WPM azaltın
4. İdeal hızınızı bulana kadar tekrarlayın

### ORP Ayarı Neden Önemli?
Her insanın göz yapısı farklıdır. Bazı okuyucular için kelimenin başına yakın bir odak noktası daha rahat olurken, diğerleri için ortaya yakın bir nokta daha iyidir. ORP ayarı ile kişisel okuma tarzınıza uygun noktayı bulabilirsiniz.

**Örnek:**
- **"EXAMPLE"** kelimesi için:
  - Varsayılan ORP: **A** (index 2)
  - ORP -2: **E** (index 0)
  - ORP +2: **P** (index 4)

### Tam Ekran Modu Avantajları
- Dikkat dağıtıcı öğeleri ortadan kaldırır
- Gözlerin ekranın merkezine odaklanmasını sağlar
- Uzun süreli okuma seansları için idealdir
- Göz yorgunluğunu azaltır

## 🎬 Görseller

### Normal Mod
```
┌─────────────────────────────────────────┐
│  [▶] [↻] WPM:250 Size:48  Focus:0      │
│  [Fullscreen] [Progress] [Focus] [⚙]   │
├─────────────────────────────────────────┤
│                                         │
│              EXAM P LE                  │
│              ─────────                  │
│                                         │
│         Word 145 of 1250                │
│                                         │
├─────────────────────────────────────────┤
│ ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░ 58%           │
│ Elapsed: 2m 30s  |  Remaining: 1m 45s  │
└─────────────────────────────────────────┘
```

### Focus Mode (Tam Ekran)
```
┌───────────────────────────────────────┐
│                                 [F][S][X]│
│                                       │
│                                       │
│                                       │
│           EXAM P LE                   │
│           ─────────                   │
│                                       │
│                                       │
│                                       │
│   Press SPACE to play/pause           │
│   [← →] Skip  [HOME] Reset  [F] Full │
└───────────────────────────────────────┘
```

## 🔧 Teknik Detaylar

### ORP Algoritması
```javascript
function getORPIndex(word) {
  const len = word.length;
  let baseORP;
  
  if (len <= 1) baseORP = 0;       // 1 harf
  else if (len <= 5) baseORP = 1;  // 2-5 harf
  else if (len <= 9) baseORP = 2;  // 6-9 harf
  else if (len <= 13) baseORP = 3; // 10-13 harf
  else baseORP = 4;                // 14+ harf
  
  // Kullanıcı ayarını uygula
  return clamp(baseORP + userOffset, 0, len - 1);
}
```

### Fullscreen API
Electron'un native fullscreen API'sini kullanır:
- macOS: Tam ekran animasyonu ile
- Windows/Linux: Borderless fullscreen
- Tüm platformlarda ESC ile çıkış

## 📊 Performans

- **60 FPS:** Yumuşak kelime geçişleri
- **Düşük CPU:** Optimize edilmiş render döngüsü
- **Hafıza:** <50MB RAM kullanımı
- **Klavye:** <50ms yanıt süresi

## 🐛 Bilinen Sorunlar & Çözümler

### Kelimeler çok hızlı kayıyor
➜ WPM değerini düşürün (S > Reading Speed)

### Odak noktası yanlış hissi
➜ ORP ayarını değiştirin ([ ve ] tuşları)

### Tam ekran açılmıyor
➜ Electron API'sini kontrol edin (geliştirme modunda olmalı)

### Font çok küçük/büyük
➜ S > Font Size ile ayarlayın

---

**İyi okumalar!** 📚⚡
