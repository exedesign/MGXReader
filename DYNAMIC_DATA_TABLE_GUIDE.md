# 🎯 DynamicDataTable - Kullanım Kılavuzu

## Genel Bakış

`DynamicDataTable` bileşeni, herhangi bir JSON verisini otomatik olarak profesyonel bir tablo görünümüne dönüştüren **generic** bir bileşendir. Veri tipini analiz eder ve en uygun görsel renderlama yöntemini uygular.

## Özellikler

### ✅ Otomatik Sütun Oluşturma
- JSON key'lerinden otomatik header oluşturur
- snake_case → Title Case dönüşümü
- Özel başlık eşleştirme desteği (columnMapping)

### 🎨 Akıllı Hücre Renderlama
Veri tipine göre otomatik görsel seçimi:

| Veri Tipi | Görünüm | Örnek |
|-----------|---------|-------|
| **Array** | Renkli Chip/Badge | `["Gustav", "Otto"]` → 🔵 Gustav 🔵 Otto |
| **Short String** | Renkli Durum Etiketi | `"İÇ"` → 🟦 İÇ, `"GÜNDÜZ"` → 🟨 GÜNDÜZ |
| **Long String** | Açılabilir Paragraf | 200+ karakter → "devamını göster" |
| **Number** | Sayı + Progress Bar | `score: 75` → ████████░░ 75% |
| **Boolean** | Icon | `true` → ✓, `false` → ✗ |
| **Object** | JSON Viewer | Açılabilir JSON preview |

### 🎯 Akıllı Renklendirme
Belirli değerler için otomatik renk ataması:
- İÇ/INT → Mavi
- DIŞ/EXT → Yeşil
- GÜNDÜZ/DAY → Sarı
- GECE/NIGHT → Mor
- KISA/ORTA/UZUN → Turuncu

## Kullanım

### Basit Kullanım

```jsx
import DynamicDataTable from './components/DynamicDataTable';

const scenes = [
  {
    number: 1,
    title: "SAHNE 1 - KAFE İÇERİSİ",
    location: "Kafe",
    intExt: "İÇ",
    timeOfDay: "GÜNDÜZ",
    characters: ["AHMET", "AYŞE"],
    duration: "orta"
  },
  // ...
];

<DynamicDataTable data={scenes} />
```

### Gelişmiş Kullanım (Column Mapping)

```jsx
const columnMapping = {
  'number': 'Sahne #',
  'title': 'Sahne Başlığı',
  'location': 'Mekan',
  'intExt': 'İç/Dış',
  'timeOfDay': 'Zaman',
  'characters': 'Karakterler',
  'duration': 'Süre'
};

<DynamicDataTable 
  data={scenes}
  columnMapping={columnMapping}
  maxChipsPerCell={5}
  showRowNumbers={true}
  compactMode={false}
/>
```

## Props

| Prop | Tip | Varsayılan | Açıklama |
|------|-----|------------|----------|
| `data` | `Array<Object>` | `[]` | **Gerekli.** Görüntülenecek veri array'i |
| `columnMapping` | `Object` | `{}` | Sütun başlıklarını özelleştirme |
| `maxChipsPerCell` | `Number` | `5` | Array hücrelerinde max chip sayısı |
| `showRowNumbers` | `Boolean` | `true` | Satır numaralarını göster |
| `compactMode` | `Boolean` | `false` | Kompakt görünüm (daha az padding) |
| `className` | `String` | `''` | Ek CSS class |

## Gerçek Kullanım Senaryoları

### 1. Sahne Analizi
```jsx
const sceneData = [
  {
    number: 1,
    title: "Açılış Sahnesi",
    location: "Kafe İçerisi",
    characters: ["Gustav", "Maria", "Otto"],
    mood: "Gergin ve gizemli",
    duration: 0.5
  }
];

<DynamicDataTable data={sceneData} />
```

**Sonuç:**
- `number` → Normal sayı
- `title` → Kısa string (etiket)
- `characters` → Array (renkli chip'ler)
- `mood` → Uzun string (paragraf)
- `duration` → Sayı (0.5)

### 2. Karakter Analizi
```jsx
const characterData = [
  {
    name: "GUSTAV",
    age: 35,
    physical: "Uzun boylu, kahverengi saç",
    role: "main",
    scenes: ["Sahne 1", "Sahne 3", "Sahne 5"]
  }
];

<DynamicDataTable data={characterData} />
```

### 3. Lokasyon Analizi
```jsx
const locationData = [
  {
    name: "Kafe İçerisi",
    type: "INT",
    timeOfDay: "GÜNDÜZ",
    sceneCount: 3,
    atmosphere: "Sakin ve huzurlu"
  }
];

<DynamicDataTable data={locationData} />
```

## Tasarım Özellikleri

### 🌑 Dark Mode
- Cinematic siyah/gri palet
- Yüksek kontrastlı okunabilirlik
- Accent color: Cinema Gold (#f59e0b)

### 📐 Layout
- Responsive yatay scroll
- Sticky row numbers (ilk sütun sabit)
- Hover effects
- Belirgin satır ayırıcılar

### 🎨 Tipografi
- Header: Uppercase, bold, küçük harf aralığı
- Chip'ler: Rounded-full, medium font
- Sayılar: Monospace font
- Long text: Pre-wrap, leading-relaxed

## Generic Yapı - Farklı Veri Tipleri

Aynı bileşen **herhangi bir veri tipi** için çalışır:

```jsx
// Bütçe Analizi
const budgetData = [
  { category: "Production", amount: 50000, percentage: 60 }
];

// Marketing Analizi
const marketingData = [
  { channel: "Social Media", reach: 100000, active: true }
];

// Tek bir bileşen hepsini render eder
<DynamicDataTable data={budgetData} />
<DynamicDataTable data={marketingData} />
```

## Best Practices

### ✅ Yapılması Gerekenler
- Consistent key isimleri kullanın
- columnMapping ile başlıkları güzelleştirin
- Array'lerde obje yerine string kullanın (chip'ler için)
- Boolean'lar için `true`/`false` kullanın

### ❌ Yapılmaması Gerekenler
- Null/undefined değerler eklemeyin (filter edin)
- Çok derin nested objeler kullanmayın
- Key isimlerini sürekli değiştirmeyin
- Çok fazla sütun eklemeyin (15+ okuma zorluğu)

## Performans

- **Optimized rendering** - React.memo kullanımı (eklenebilir)
- **Lazy loading** - Uzun listeler için sayfalama
- **Virtual scrolling** - 1000+ satır için (eklenebilir)

## Gelecek Özellikler

- [ ] Sütun sıralama (sort)
- [ ] Sütun filtreleme
- [ ] Inline editing
- [ ] Export CSV/Excel
- [ ] Sütun genişliği ayarlama
- [ ] Kolon gizleme/gösterme
- [ ] Sayfalama (pagination)
- [ ] Arama (global search)

## Sorun Giderme

### Veri görünmüyor
```jsx
// ❌ Yanlış - Obje gönderiyorsunuz
<DynamicDataTable data={{ scenes: [...] }} />

// ✅ Doğru - Array göndermelisiniz
<DynamicDataTable data={data.scenes} />
```

### Başlıklar çirkin görünüyor
```jsx
// ✅ columnMapping kullanın
const mapping = {
  'scene_title': 'Sahne Başlığı',
  'char_list': 'Karakterler'
};
```

### Chip'ler görünmüyor
```jsx
// ❌ Yanlış - Object array
characters: [{ name: "AHMET" }]

// ✅ Doğru - String array
characters: ["AHMET", "AYŞE"]
```

## Lisans

MIT License - Özgürce kullanın ve özelleştirin!
