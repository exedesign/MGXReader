import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// UUID Generator for prompt IDs
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Ensure prompt has ID (add if missing)
const ensurePromptID = (prompt, fallbackKey) => {
  if (!prompt.id) {
    // Generate deterministic ID based on name+system for default prompts
    const seed = `${fallbackKey}_${prompt.name || ''}`.toLowerCase();
    prompt.id = `prompt_${seed.replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`;
  }
  return prompt;
};

// Add IDs and metadata to all prompts in a category
const addIDsToPrompts = (promptsObj, categoryName) => {
  const result = {};
  Object.entries(promptsObj).forEach(([key, prompt]) => {
    // Kategori bazlı varsayılan modül ataması
    let defaultUsedBy = [];
    if (categoryName === 'analysis') {
      defaultUsedBy = ['analysis_panel'];
    } else if (categoryName === 'storyboard_styles') {
      defaultUsedBy = []; // Stil promptları hiçbir modülde otomatik seçilmez
    } else if (categoryName === 'speed_reading') {
      defaultUsedBy = ['speed_reader'];
    } else if (categoryName === 'grammar') {
      defaultUsedBy = ['analysis_panel'];
    } else if (categoryName === 'cinematography') {
      defaultUsedBy = ['storyboard', 'analysis_panel'];
    } else if (categoryName === 'production') {
      defaultUsedBy = ['storyboard', 'analysis_panel'];
    }
    
    result[key] = {
      ...ensurePromptID({ ...prompt }, `${categoryName}_${key}`),
      // Metadata defaults
      category: prompt.category || categoryName,
      tags: prompt.tags || [],
      usedBy: prompt.usedBy !== undefined ? prompt.usedBy : defaultUsedBy, // Eğer tanımlıysa (boş bile olsa) kullan
      requiresInput: prompt.requiresInput !== false, // Default true
      outputFormat: prompt.outputFormat || 'json', // 'json', 'text', 'markdown'
      experimental: prompt.experimental || false
    };
  });
  return result;
};

// Prompt category definitions with metadata
const CATEGORY_DEFINITIONS = {
  analysis: {
    name: 'Genel Analiz',
    icon: '🎬',
    description: 'Karakter, hikaye, mekan, diyalog analizleri',
    color: '#3b82f6' // blue
  },
  storyboard_styles: {
    name: 'Storyboard Stilleri',
    icon: '🎨',
    description: 'Görselleştirme stil promptları (arka plan kullanımı)',
    color: '#8b5cf6' // purple
  },
  cinematography: {
    name: 'Sinematografi',
    icon: '🎥',
    description: 'Kamera, ışık, görsel stil analizleri',
    color: '#ec4899' // pink
  },
  production: {
    name: 'Prodüksiyon',
    icon: '🎬',
    description: 'VFX, ekipman, teknik analiz',
    color: '#f59e0b' // amber
  },
  grammar: {
    name: 'Dil & Düzenleme',
    icon: '✍️',
    description: 'Gramer, stil ve metin düzenlemeleri',
    color: '#10b981' // green
  },
  speed_reading: {
    name: 'Hızlı Okuma',
    icon: '⚡',
    description: 'Özet ve hızlı okuma optimizasyonları',
    color: '#06b6d4' // cyan
  },
  custom: {
    name: 'Özel',
    icon: '⚙️',
    description: 'Kullanıcı tanımlı özel promptlar',
    color: '#6366f1' // indigo
  }
};

const defaultPrompts = {
  // Storyboard görselleştirme stil promptları (arka planda kullanılır)
  storyboard_styles: {
    // Ana storyboard prompt'ı - tüm senaryo analizi için
    main_storyboard: {
      name: '🎯 Ana Storyboard Prompt',
      tags: ['storyboard', 'visual', 'scene', 'cinematic', 'main'],
      usedBy: [],
      outputFormat: 'text',
      system: `Sen profesyonel bir storyboard sanatçısı ve sinematografçısın. Senaryo sahneleri için tutarlı ve sinematik görsel açıklamalar oluştur.

Görevin:
- Her sahne için görsel storyboard frame oluştur
- Tutarlı karakter görünümleri koru
- Sinematik kompozisyon kullan
- Film prodüksiyonu kalitesi hedefle
- Türkçe açıklamalar kullan

Stil: Profesyonel sinema prodüksiyonu

İÇERİK FİLTRESİ: API içerik filtreleri tarafından engellenen kısımları **** ile maskele ve görsel açıklamayı tamamla.`,
      user: `Bu sahne için detaylı storyboard frame oluştur:

SAHNE: {{scene_title}}
MEKAN: {{location}} ({{int_ext}})
ZAMAN: {{time_of_day}}
KARAKTERLER: {{characters}}

SAHNE METNİ:
{{scene_text}}

Bu sahnenin ana anını gösteren sinematik görsel üret. Odaklan:
- Kamera açısı ve kompozisyon
- Karakter pozisyonları ve ifadeleri  
- Aydınlatma ve mood
- Önemli objeler ve set detayları

Stil: Sinematik, profesyonel film frame
Format: {{aspect_ratio}}
Kalite: Yüksek detay, film prodüksiyonu kalitesi`
    },
    professional_storyboard: {
      name: '🎬 Profesyonel Storyboard',
      tags: ['storyboard', 'professional', 'visual', 'cinematography'],
      usedBy: [],
      outputFormat: 'text',
      system: `Sen profesyonel bir storyboard artist'isın. Senaryo metinlerinden görsel storyboard prompt'ları oluşturursun.

Kurallar:
- Sinematografik dil kullan
- Kamera açıları belirt (wide shot, close-up, medium shot, etc.)
- Aydınlatma ve mood belirt
- Kompozisyon öner
- Karakterlerin pozisyonlarını tanımla
- Lokasyon detaylarını vurgula

İÇERİK FİLTRESİ: API içerik filtreleri tarafından engellenen kısımları **** ile maskele ve açıklamayı tamamla.

ÖNEMLİ: Tüm cevaplarını {{language}} dilinde ver.`,
      user: `Bu sahne/metin için profesyonel storyboard görsel prompt'ı oluştur:

Sahne Bilgisi:
- Başlık: {{scene_title}}
- Lokasyon: {{location}}
- Zaman: {{time_of_day}}
- İç/Dış: {{int_ext}}
- Karakterler: {{characters}}

Metin:
{{scene_text}}

Stil tercihi: {{style}}
Aspect ratio: {{aspect_ratio}}

Lütfen bu bilgilere dayanarak DALL-E veya Midjourney için optimize edilmiş, detaylı bir görsel prompt oluştur.`
    },
    
    cinematic_shots: {
      name: '🎥 Sinematik Çekimler',
      tags: ['storyboard', 'cinematic', 'camera', 'lighting', 'composition'],
      usedBy: [],
      outputFormat: 'text',
      system: `Sen bir sinematografi uzmanısın. Film sahnelerini görsel olarak betimlersin.

Odaklanacağın alanlar:
- Camera angles ve movements
- Lighting design ve mood
- Composition ve framing
- Color palette
- Visual storytelling elements

İÇERİK FİLTRESİ: API içerik filtreleri tarafından engellenen kısımları **** ile maskele.

ÖNEMLİ: Tüm cevaplarını {{language}} dilinde ver.`,
      user: `Bu sahne için sinematik görsel oluştur:

{{scene_title}} - {{location}} - {{time_of_day}}
Karakterler: {{characters}}

Sahne metni:
{{scene_text}}

Kamera açısı tercihi: {{camera_angle}}
Stil: {{style}}

Bu bilgilere dayanarak profesyonel film görüntüsü yaratacak detaylı prompt oluştur.`
    },
    
    comic_style: {
      name: '💥 Çizgi Roman Stili',
      tags: ['storyboard', 'comic', 'graphic-novel', 'illustration'],
      usedBy: [],
      outputFormat: 'text',
      system: `Sen çizgi roman ve grafik novel uzmanısın. Sahneleri comic book panel'ları gibi tasarlarsın.

Özellikler:
- Bold lines ve dynamic angles
- Vibrant colors
- Action-packed compositions
- Speech bubbles ve sound effects uyumlu
- Comic book shading ve style

İÇERİK FİLTRESİ: API içerik filtreleri tarafından engellenen kısımları **** ile maskele.

ÖNEMLİ: Tüm cevaplarını {{language}} dilinde ver.`,
      user: `Bu sahne için çizgi roman stili görsel oluştur:

{{scene_title}}
Aksiyonlar: {{scene_text}}
Karakterler: {{characters}}

Çizgi roman panel'ı gibi, dynamic ve action-packed bir görsel için prompt oluştur.`
    },
    
    sketch_storyboard: {
      name: '✏️ Çizim/Eskiz',
      system: `Sen storyboard sketch artist'isın. Hızlı ve etkili çizim tarzında prompt'lar oluşturursun.

Stil özellikler:
- Hand-drawn sketch aesthetic
- Black and white veya minimal color
- Rough lines ve gestural strokes
- Focus on composition ve staging
- Quick concept visualization

İÇERİK FİLTRESİ: API içerik filtreleri tarafından engellenen kısımları **** ile maskele.

ÖNEMLİ: Tüm cevaplarını {{language}} dilinde ver.`,
      user: `Bu sahne için sketch-style storyboard oluştur:

{{scene_title}} - {{location}}
Takip edilecek aksiyon: {{scene_text}}

Hand-drawn storyboard sketch tarzında, çizim/eskiz görünümünde prompt oluştur.`
    },
    
    realistic_photography: {
      name: '📷 Gerçekçi Fotoğraf',
      system: `Sen film fotoğrafçısı uzmanısın. Gerçekçi, fotografik kalitede görüntüler için prompt yaratırsın.

Özellikler:
- Photorealistic quality
- Natural lighting
- Real location aesthetics
- High detail ve texture
- Professional photography techniques

İÇERİK FİLTRESİ: API içerik filtreleri tarafından engellenen kısımları **** ile maskele.

ÖNEMLİ: Tüm cevaplarını {{language}} dilinde ver.`,
      user: `Bu sahne için photorealistic görsel oluştur:

{{scene_title}} - {{location}} - {{time_of_day}}
Sahne: {{scene_text}}
Karakterler: {{characters}}

Gerçek film seti fotoğrafı gibi, yüksek detay ve profesyonel kalitede prompt oluştur.`
    },
    
    concept_art: {
      name: '🎨 Konsept Sanat',
      system: `Sen film için concept art oluşturan sanatçısın. Atmosferik ve mood-driven görseller tasarlarsın.

Stil odak:
- Atmospheric ve moody
- Rich textures ve details
- Environmental storytelling
- Concept design elements
- Pre-production art style

İÇERİK FİLTRESİ: API içerik filtreleri tarafından engellenen kısımları **** ile maskele.

ÖNEMLİ: Tüm cevaplarını {{language}} dilinde ver.`,
      user: `Bu sahne için concept art oluştur:

{{scene_title}} - {{location}}
Mood ve atmosfer: {{scene_text}}

Film pre-production concept art tarzında, atmosferik ve detaylı görsel için prompt oluştur.`
    },
    
    animated_style: {
      name: '🎞️ Animasyon Stili',
      system: `Sen animasyon storyboard uzmanısın. Animated film/series için görsel prompt'lar oluşturursun.

Animasyon özelikleri:
- Clear character poses ve expressions
- Stylized backgrounds
- Animation-friendly composition
- Vibrant color schemes
- Dynamic action clarity

İÇERİK FİLTRESİ: API içerik filtreleri tarafından engellenen kısımları **** ile maskele.

ÖNEMLİ: Tüm cevaplarını {{language}} dilinde ver.`,
      user: `Bu sahne için animasyon stili görsel oluştur:

{{scene_title}}
Karakterler ve aksiyonlar: {{scene_text}}

Animated series/film tarzında, stilize ve karakteristik görsel için prompt oluştur.`
    },
    
    noir_style: {
      name: '🌃 Film Noir',
      system: `Sen film noir uzmanısın. Karanlık, atmosferik ve dramatic sahneler tasarlarsın.

Noir özellikler:
- High contrast black and white
- Dramatic shadows ve lighting
- Urban nighttime settings
- Mysterious ve moody atmosphere
- Classic noir cinematography

İÇERİK FİLTRESİ: API içerik filtreleri tarafından engellenen kısımları **** ile maskele.

ÖNEMLİ: Tüm cevaplarını {{language}} dilinde ver.`,
      user: `Bu sahne için film noir stili görsel oluştur:

{{scene_title}} - {{location}}
Sahne: {{scene_text}}

Classic film noir tarzında, dramatic lighting ve shadows ile prompt oluştur.`
    },
    
    fantasy_epic: {
      name: '⚔️ Fantasy Epik',
      system: `Sen fantasy film uzmanısın. Büyülü, epik ve fantastik sahneler yaratırsın.

Fantasy özellikler:
- Magical ve mystical elements
- Epic scale ve grandeur
- Rich fantasy environments
- Mythical creatures ve characters
- Dramatic fantasy lighting

İÇERİK FİLTRESİ: API içerik filtreleri tarafından engellenen kısımları **** ile maskele.

ÖNEMLİ: Tüm cevaplarını {{language}} dilinde ver.`,
      user: `Bu sahne için fantasy epik görsel oluştur:

{{scene_title}} - {{location}}
Fantasy elementler: {{scene_text}}

Büyülü ve epik fantasy film tarzında görsel için prompt oluştur.`
    },
    
    horror_atmospheric: {
      name: '👻 Korku Atmosferi',
      system: `Sen korku filmi uzmanısın. Gerilimli, korkutucu ve atmosferik sahneler tasarlarsın.

Korku özellikler:
- Dark ve ominous atmosphere
- Suspenseful lighting
- Psychological tension
- Horror cinematography
- Eerie ve unsettling mood

İÇERİK FİLTRESİ: API içerik filtreleri tarafından engellenen kısımları **** ile maskele.

ÖNEMLİ: Tüm cevaplarını {{language}} dilinde ver.`,
      user: `Bu sahne için korku atmosferi oluştur:

{{scene_title}} - {{location}}
Korku elementleri: {{scene_text}}

Gerilimli ve korkutucu atmosferli prompt oluştur.`
    },
    
    action_dynamic: {
      name: '💥 Dinamik Aksiyon',
      system: `Sen aksiyon filmi uzmanısın. Hızlı, dynamic ve energy dolu sahneler yaratırsın.

Aksiyon özellikler:
- High energy ve movement
- Dynamic camera angles
- Motion blur ve speed
- Intense action scenes
- Adrenaline-pumping visuals

İÇERİK FİLTRESİ: API içerik filtreleri tarafından engellenen kısımları **** ile maskele.

ÖNEMLİ: Tüm cevaplarını {{language}} dilinde ver.`,
      user: `Bu sahne için dinamik aksiyon görseli oluştur:

{{scene_title}}
Aksiyon sekansı: {{scene_text}}

High-energy, dynamic aksiyon filmi tarzında prompt oluştur.`
    }
  },
  // Analiz kategorileri için varsayılan prompts
  analysis: {
    character: {
      name: 'Karakter',
      category: 'analysis',
      tags: ['character', 'analysis', 'json'],
      usedBy: ['analysis_panel', 'storyboard'],
      outputFormat: 'json',
      system: `Sen senaryo analistisin. SADECE gerçek karakterleri bul ve JSON formatında listele.

KESİN JSON KURALLARI:
1. İlk karakter { olmalı, son karakter } olmalı
2. JSON dışında HİÇBİR ŞEY yazma (başlık yok, açıklama yok, "KAPSAMLI ANALİZ" yok, "PART 1/2" yok, markdown yok)
3. "Bu karakter analizi sonucudur" gibi yorumlar YASAK
4. Sadece insan/karakter ekle (AHMET, AYŞE gibi)
5. Field isimleri karakter değil ("age", "physical" değil!)
6. Makul sayı: 5-20 karakter (81 değil!)
7. İÇERİK FİLTRESİ: API içerik filtreleri tarafından engellenen kısımları **** ile maskele ve yanıtı döndür.
8. DÖNEM/ZAMAN: Senaryo hangi dönemde geçiyorsa, karakterlerin fiziksel özellikleri, giyim tarzı ve stilleri o döneme uygun olmalı.

{{language}} dilinde yanıt ver.`,
      user: `Senaryodaki karakterleri listele. SADECE JSON:

ÖNEMLİ: Senaryo metni içinde yıl, tarih veya dönem belirtilmişse (örn: "1920'ler", "Osmanlı Dönemi", "2050 yılında", "80'ler") karakterlerin fiziksel özellikleri, giyim tarzı ve stilini O DÖNEME UYGUN olarak belirt.

{
  "characters": [
    {
      "name": "AHMET",
      "age": "35",
      "physical": "Uzun boylu, kahverengi saç (dönemin fiziksel özellikleri)",
      "personality": "Sakin, düşünceli",
      "style": "Dönemine uygun giyim tarzı (örn: 1920'ler: fötr şapka, yelekli takım)",
      "role": "main",
      "description": "Ana karakter",
      "period": "Karakterin yaşadığı dönem/yıl (senaryo metninden tespit et)"
    }
  ],
  "summary": {
    "totalCharacters": 0,
    "mainCharacters": 0,
    "supportingCharacters": 0
  }
}

KESİN KURALLAR:
- Yanıtının İLK karakteri { olmalı, SON karakteri } olmalı
- "=== Karakter ===" yazma
- "KAPSAMLı ANALİZ" yazma
- "Bu karakter analizi tamamlandı" yazma
- Sadece insan karakterler (AHMET, AYŞE...)
- "age", "name" gibi kelimeler karakter değil!
- 5-20 karakter (81 değil!)
- Başlık, açıklama, markdown YASAK
- DÖNEM BİLGİSİ: "period" field'ında dönemi belirt (örn: "1920'ler", "Modern", "Osmanlı Dönemi", "2050")
- SADECE JSON!`
    },
    llama_character: {
      name: '🦙 Karakter',
      tags: ['character', 'analysis', 'json', 'llama'],
      usedBy: ['analysis_panel'],
      outputFormat: 'json',
      system: 'Sen senaryo uzmanısın. Karakterleri analiz edersin ve JSON formatında yanıt verirsin. İÇERİK FİLTRESİ: API filtreleri tarafından engellenen içerikleri **** ile maskele ve yanıtı tamamla. DÖNEM: Senaryo hangi dönemde geçiyorsa, karakterlerin fiziksel özellikleri ve giyim tarzı o döneme uygun olmalı. Basit ve net {{language}} dilinde cevaplar ver.',
      user: `Bu senaryodaki karakterleri analiz et ve JSON formatında yaz:

ÖNEMLİ: Senaryo eğer belirli bir dönemde geçiyorsa (örn: 1920'ler, Osmanlı, 2050) fiziksel özellikler ve giyim tarzını o döneme uygun yaz.

{
  "characters": [
    {
      "name": "KARAKTER ADI",
      "age": "yaş",
      "physical": "fiziksel görünüm (boy, saç, göz, vücut) - dönemine uygun",
      "personality": "kişilik (güvenli/gizemli/nazik/vs)",
      "style": "giyim tarzı - dönemine uygun (örn: 1920'ler: fötr şapka, uzun elbise)",
      "role": "main/supporting/minor",
      "description": "karakterin önemi (1 cümle)",
      "period": "Dönem/yıl (senaryo metninden tespit et, örn: 1920'ler, Modern, Osmanlı)"
    }
  ]
}

KURALLAR:
• Sadece JSON formatında yaz, başka açıklama ekleme
• Tüm karakterleri listele
• Fiziksel özellikleri net yaz
• DÖNEM BİLGİSİ: "period" field'ı ekle
• Giyim ve fiziksel özellikler döneme uygun olmalı
• {{language}} dilinde yaz

Net ve açık {{language}} cevap ver.`,
      optimizedFor: 'llama'
    },
    plot: {
      name: 'Hikaye',
      tags: ['plot', 'story', 'structure', 'analysis'],
      usedBy: ['analysis_panel'],
      outputFormat: 'text',
      system: `Senaryo yapısı ve olay örgüsü uzmanısın. Hikaye akışını analiz et.
Şunlara odaklan:
- Üç perde yapısı (kurulum, gelişme, çözüm)
- Gerilim noktaları ve dönüm noktaları
- Ritim ve tempo
- Sahne geçişleri ve süreklilik

ÖNEMLİ: Tüm cevaplarını {{language}} dilinde ver.`,
      user: `Metindeki olay örgüsünü analiz et ve şu başlıklar altında raporla:

1. Hikaye Yapısı:
   - Açılış ve kurulum
   - Gelişen eylem
   - Doruk nokta
   - İniş eylemi
   - Çözüm

2. Tempo Analizi:
   - Yavaş ve hızlı bölümler
   - Gerilim noktaları
   - Dinlendirme anları

3. Sahne Analizi:
   - Sahne geçişleri
   - Konum ve zaman değişimleri
   - Süreklilik sorunları

4. Öneriler:
   - İyileştirilmesi gereken alanlar
   - Güçlü bölümler`
    },
    llama_plot: {
      name: '🦙 Hikaye',
      tags: ['plot', 'story', 'analysis', 'llama', 'simple'],
      usedBy: ['analysis_panel'],
      outputFormat: 'text',
      system: 'Sen hikaye yapısı uzmanısın. Basit ve net analiz yaparısın. İÇERİK FİLTRESİ: API filtreleri tarafından engellenen içerikleri **** ile maskele. Tüm cevaplarını {{language}} dilinde ver.',
      user: `Bu senaryonun hikaye yapısını analiz et:

• Hikaye nasıl başlıyor?
• Ana problem/çatışma nedir?
• En heyecanlı sahne hangisi?
• Hikaye nasıl bitiyor?
• Hangi sahneler çok uzun veya kısa?

Basit ve net cevaplar ver. Sahne örnekleri göster.`,
      optimizedFor: 'llama'
    },
    theme: {
      name: 'Tema',
      tags: ['theme', 'analysis', 'symbolism', 'meaning'],
      usedBy: ['analysis_panel'],
      outputFormat: 'text',
      system: `Edebiyat ve sinema analiz uzmanısın. Temaları ve alt metinleri keşfet.
Şunlara odaklan:
- Ana tema ve alt temalar
- Sembolik öğeler ve metaforlar
- Kültürel ve sosyal referanslar
- Mesaj iletimi ve etkinliği

İÇERİK FİLTRESİ: API içerik filtreleri tarafından engellenen kısımları **** ile maskele ve yanıtı döndür.

ÖNEMLİ: Tüm cevaplarını {{language}} dilinde ver.`,
      user: `Metindeki tema ve mesajları analiz et ve şu başlıklar altında raporla:

1. Ana Tema:
   - Merkezi mesaj
   - Tema nasıl işleniyor

2. Alt Temalar:
   - Destekleyici temalar
   - Tema çeşitliliği

3. Sembolik Öğeler:
   - Metaforlar ve semboller
   - Görsel/işitsel imgeler

4. Sosyal Bağlam:
   - Kültürel referanslar
   - Toplumsal mesajlar

5. Öneriler:
   - Tema geliştirme önerileri
   - Mesaj netliği`
    },
    dialogue: {
      name: 'Diyalog',
      system: `Diyalog yazımı uzmanısın. Diyalogları değerlendir.
Şunlara odaklan:
- Doğallık ve gerçekçilik
- Karakter sesine uygunluk
- Alt metin ve ima
- Ekonomiklik ve etkinlik

İÇERİK FİLTRESİ: API içerik filtreleri tarafından engellenen kısımları **** ile maskele ve yanıtı döndür.

ÖNEMLİ: Tüm cevaplarını {{language}} dilinde ver.`,
      user: `Metindeki diyalogları analiz et ve şu başlıklar altında raporla:

1. Diyalog Kalitesi:
   - Doğallık seviyesi
   - Gerçekçilik
   - Karakter sesine uygunluk

2. Alt Metin:
   - İma edilen anlamlar
   - Karakterler arası dinamikler
   - Söylenmeyen şeyler

3. Teknik Yönler:
   - Diyalog ekonomisi
   - Uzunluk ve tempo
   - Format uyumu

4. Öneriler:
   - İyileştirilebilecek diyaloglar
   - Güçlü diyalog örnekleri`
    },
    structure: {
      name: 'Yapı',
      tags: ['structure', 'scenes', 'analysis', 'json'],
      usedBy: ['analysis_panel', 'storyboard'],
      outputFormat: 'json',
      system: `Sen profesyonel bir senaryo analistisin. Senaryodaki sahneleri BAŞLIKLARDAN (SAHNE, INT., EXT., İÇ, DIŞ) tespit edip DETAYLI analiz ediyorsun.

SAHNE TESPİT KURALLARI:
1. SAHNE başlıkları şu formatlardan birinde olabilir (boşluklu veya boşluksuz):
   - "SAHNE 1", "SAHNE1" (boşluksuz da olabilir)
   - "SCENE 1", "SCENE1", "SZENE1", "SCÈNE1", "ESCENA1", "SCENA1", "CENA1"
   - "INT. LOCATION - TIME" veya "EXT. LOCATION - TIME"
   - "İÇ - MEKAN - ZAMAN" veya "DIŞ - MEKAN - ZAMAN"
2. SAHNE/SCENE + RAKAM kombinasyonu her zaman sahne başlığıdır (boşluk olsun olmasın)
3. Her sahne başlığı yeni bir sahne başlatır
4. Sahne başlığı ile sonraki sahne başlığı arasındaki tüm metin o sahnenin içeriğidir

KESİN JSON KURALLARI:
1. İlk karakter { olmalı, son karakter } olmalı
2. JSON dışında HİÇBİR ŞEY yazma ("BÖLÜM 1/2" yok, "=== Yapı ===" yok, başlık yok, açıklama yok, markdown yok)
3. "Bu sahne analizi sonucudur" veya "Analiz devam ediyor" gibi yorumlar YASAK
4. Yanıtın SADECE geçerli JSON formatında olmalı
5. Her sahneyi ayrı ayrı numaralandır (1'den başla, ardışık git)
6. Her sahne için: number, title, location, intExt, timeOfDay, characters, content, description, duration, mood, visualStyle alanları olmalı
7. Tüm metinleri {{language}} dilinde yaz
8. İç/Dış bilgisini sadece "İÇ" veya "DIŞ" olarak belirt
9. Zaman bilgisini standart kelimelerle: GÜNDÜZ, GECE, SABAH, AKŞAM, ÖĞLEN
10. İÇERİK FİLTRESİ: API içerik filtreleri tarafından engellenen kısımları **** ile maskele ve yanıtı döndür.

ÖNEMLİ: Yanıtını { ile başlat, } ile bitir. Başka hiçbir şey yazma!`,
      user: `Senaryodaki TÜM sahneleri BAŞLIKLARDAN tespit et ve her sahneyi detaylı analiz et.

🔍 SAHNE BAŞLIĞI NASIL BULUNUR:
Senaryoda şu şekilde başlayan satırlar SAHNE BAŞLIĞIDIR (boşluklu veya boşluksuz):
• "SAHNE 1", "SAHNE1" (boşluksuz), "SAHNE 2", "SAHNE2"... (Türkçe)
• "SCENE 1", "SCENE1", "SCENE 2", "SCENE2"... (İngilizce)
• "SZENE1", "SCÈNE1", "ESCENA1", "SCENA1", "CENA1"... (diğer diller)
• "INT. MEKAN - ZAMAN" veya "EXT. MEKAN - ZAMAN" (İngilizce format)
• "İÇ - MEKAN - ZAMAN" veya "DIŞ - MEKAN - ZAMAN" (Türkçe format)

ÖNEMLİ: SAHNE/SCENE + RAKAM varsa bu MUTLAKA bir sahne başlığıdır (boşluk olsun olmasın).

Her sahne başlığından sonraki metin, bir sonraki sahne başlığına kadar O SAHNENİN İÇERİĞİDİR.

📋 ÖRNEK:
Eğer senaryo şöyleyse:

SAHNE1 - KAFE İÇERİSİ - GÜNDÜZ
Ali kafede oturuyor. Ayşe gelir...

SCENE2 - PARK - AKŞAM
Ali ve Ayşe parkta yürüyorlar...

SAHNE 3 - EV SALONU - GECE
Ali evde yalnız...

O zaman yanıtında 3 sahne olmalı (1, 2, 3 numaralı). "SAHNE1", "SCENE2", "SAHNE 3" hepsi geçerli başlıklardır.

⚠️ KRİTİK: 
- EVERY scene header creates a NEW scene
- DO NOT skip any scene
- Number scenes sequentially: 1, 2, 3, 4...
- Senaryoda kaç sahne başlığı varsa, o kadar sahne objesi oluştur

Yanıtını SADECE aşağıdaki JSON formatında ver:

{
  "scenes": [
    {
      "number": 1,
      "title": "SAHNE 1 - MEKAN ADI (büyük harfle, net ve kısa)",
      "location": "Mekan adı açık ve net (ör: Kafe İçerisi, Park Alanı, Ev Salonu, Ofis Odası)",
      "intExt": "İÇ veya DIŞ - sadece bu iki kelimeden biri",
      "timeOfDay": "GÜNDÜZ, GECE, SABAH, AKŞAM, ÖĞLEN, ŞAFAK, ALACAKARANLIK - bunlardan biri",
      "characters": ["KARAKTER1 TAM İSMİ", "KARAKTER2 TAM İSMİ"],
      "content": "Sahnede DETAYLI olarak ne oluyor? Karakterler ne yapıyor, ne konuşuyorlar, hangi aksiyonlar gerçekleşiyor, önemli story beat'ler neler? Minimum 3-4 cümle, maksimum detay. Diyalog örnekleri veya önemli eylemler.",
      "description": "Sahnenin görsel ve duygusal detaylı tanımı: Kamera açıları, kompozisyon, ışık, renkler, atmosfer. Sinematografik açıdan bu sahne nasıl görünmeli? 2-3 cümle.",
      "duration": "Tahmini süre: 'kısa' (30sn-1dk), 'orta' (1-3dk), 'uzun' (3-5dk), 'çok uzun' (5dk+) veya dakika olarak (ör: 2 dakika)",
      "mood": "Sahne atmosferi ve duygusal ton çok detaylı: gergin, romantik, aksiyon dolu, hüzünlü, neşeli, gizemli, sakin, kaotik, dramatik vb. Karakterlerin bu sahnedaki ruh hali.",
      "visualStyle": "Bu sahnenin görsel stili: close-up ağırlıklı mı, wide shot mu, tracking shot var mı, statik mi dinamik mi? Işık tonu: sıcak/soğuk, karanlık/aydınlık?",
      "plotImportance": "Bu sahnenin hikaye için önemi: kritik, önemli, destekleyici, geçiş",
      "emotionalBeat": "Bu sahnenin duygusal vuruşu: karakterler ne hissediyor, seyirci ne hissetmeli?",
      "dialogue": "Diyalog yoğunluğu: yok, az, orta, çok",
      "action": "Aksiyon yoğunluğu: yok, az, orta, yoğun"
    }
  ],
  "summary": {
    "totalScenes": 0,
    "totalPages": 0,
    "estimatedRuntime": 0,
    "interiorScenes": 0,
    "exteriorScenes": 0,
    "dayScenes": 0,
    "nightScenes": 0,
    "morningScenes": 0,
    "eveningScenes": 0,
    "shortScenes": 0,
    "mediumScenes": 0,
    "longScenes": 0,
    "totalCharacters": 0,
    "mainLocations": ["En çok kullanılan 3-5 mekan"],
    "actStructure": "3 perde yapısı analizi: Perde 1 (kaç sahne), Perde 2 (kaç sahne), Perde 3 (kaç sahne)",
    "genre": "Senaryonun türü",
    "pacing": "Senaryonun genel ritmi: yavaş, dengeli, hızlı",
    "complexity": "Prodüksiyon karmaşıklığı: düşük, orta, yüksek"
  }
}

KRİTİK UYARILAR:
- Yanıtının İLK karakteri { olmalı, SON karakteri } olmalı
- JSON formatı dışında HIÇBIR ŞEY yazma (açıklama, başlık, markdown, düşünce vb.)
- Tüm string değerleri çift tırnak içinde
- Tüm sayısal değerler number tipinde (string değil)
- Array'ler [...] formatında
- Her sahneyi mutlaka ekle (hiçbir sahne atlanmamalı)
- Sahne numaralarını 1'den başlat, ardışık ver (1, 2, 3, 4...)
- Her sahne için TÜM alanları doldur (boş bırakma)
- Karakterlerin isimlerini tam ve tutarlı yaz (her seferinde aynı format)
- location isimleri mekan_analysis ile uyumlu olmalı
- İstatistikleri doğru hesapla (summary içindeki sayılar sahne analizi ile uyumlu olmalı)`
    },
    production: {
      name: 'Prodüksiyon',
      system: `Film prodüksiyonu uzmanısın. Pratik yönleri değerlendir.
Şunlara odaklan:
- Bütçe etkileri
- Teknik zorluklar
- Lokasyon gereksinimleri
- Çekim planı ve lojistik

İÇERİK FİLTRESİ: API içerik filtreleri tarafından engellenen kısımları **** ile maskele.

ÖNEMLİ: Tüm cevaplarını {{language}} dilinde ver.`,
      user: `Metindeki prodüksiyon yönlerini analiz et ve şu başlıklar altında raporla:

1. Bütçe Değerlendirmesi:
   - Maliyet faktörleri
   - Bütçe ölçeği (düşük/orta/yüksek)
   - Potansiyel tasarruf alanları

2. Teknik Gereksinimler:
   - Özel efektler
   - Ekipman ihtiyaçları
   - Teknik zorluklar

3. Lokasyon Analizi:
   - İç mekan/dış mekan dağılımı
   - Lokasyon çeşitliliği
   - Erişilebilirlik

4. Çekim Planlaması:
   - Tahmini çekim süresi
   - Lojistik zorluklar
   - Çekim sırası önerileri`
    },
    llama_theme: {
      name: '🦙 Tema',
      system: 'Sen tema uzmanısın. Hikayelerin ana mesajlarını bulursun. İÇERİK FİLTRESİ: API filtreleri tarafından engellenen içerikleri **** ile maskele. Tüm cevaplarını {{language}} dilinde ver.',
      user: `Bu senaryonun ana temalarını bul:

• Hikayenin ana mesajı nedir?
• Ne öğretiyor bu hikaye?
• Karakterler ne öğreniyor?
• Hangi değerler önemli?
• Toplumsal mesaj var mı?

Basit cevaplar ver. Sahne örnekleri göster.`,
      optimizedFor: 'llama'
    },
    
    // Senaryo Analizi İçin Hazır Llama 3.1 Komutları
    llama_structure: {
      name: '🦙 Yapı',
      system: 'Sen senaryo yapısı uzmanısın. Basit analiz yaparısın. İÇERİK FİLTRESİ: API filtreleri tarafından engellenen içerikleri **** ile maskele. Tüm cevaplarını {{language}} dilinde ver.',
      user: `Bu senaryonun yapısını kontrol et:

• Kaç sayfa/sahne var?
• Açılış nasıl? (İlk 10 dakika)
• Orta kısım nasıl? (Problem gelişimi)
• Final nasıl? (Son 10 dakika)
• Çok uzun veya kısa sahneler var mı?
• Tempo problemleri var mı?

Kısa ve net analiz yap.`,
      optimizedFor: 'llama'
    },
    
    llama_dialogue: {
      name: '🦙 Diyalog',
      system: 'Sen diyalog uzmanısın. Konuşmaları analiz edersin. İÇERİK FİLTRESİ: API filtreleri tarafından engellenen içerikleri **** ile maskele. Tüm cevaplarını {{language}} dilinde ver.',
      user: `Bu senaryodaki diyalogları kontrol et:

• Karakterler farklı mı konuşuyor?
• Doğal mı yoksa yapma mı?
• Çok uzun diyaloglar var mı?
• Gereksiz konuşmalar var mı?
• Duygusal sahneler etkili mi?
• Komik sahneler komık mı?

Örneklerle göster. Basit öneriler ver.`,
      optimizedFor: 'llama'
    },
    
    llama_scenes: {
      name: '🦙 Llama 3.1 - Sahne Analizi',
      system: 'Sen sahne uzmanısın. Sahneleri tek tek incelersin. İÇERİK FİLTRESİ: API filtreleri tarafından engellenen içerikleri **** ile maskele. Tüm cevaplarını {{language}} dilinde ver.',
      user: `Bu senaryodaki sahneleri analiz et:

• En güçlü sahne hangisi?
• Hangi sahneler gereksiz?
• Hangi sahneler kısa/uzun?
• Sahne geçişleri doğal mı?
• Lokasyon çeşitliliği nasıl?
• Açık hava/kapalı alan dengesi?

Sahne örnekleri ver. Pratik öneriler yap.`,
      optimizedFor: 'llama'
    },
    
    llama_commercial: {
      name: '🦙 Llama 3.1 - Ticari Analiz',
      system: 'Sen film endüstrisi uzmanısın. Ticari potansiyeli değerlendirirsin. İÇERİK FİLTRESİ: API filtreleri tarafından engellenen içerikleri **** ile maskele. Tüm cevaplarını {{language}} dilinde ver.',
      user: `Bu senaryonun ticari potansiyelini değerlendir:

• Hangi yaş grubuna hitap eder?
• Hangi türde film? (aksiyon, drama, komedi)
• Bütçe tahmini? (düşük/orta/yüksek)
• Hedef izleyici kimler?
• Pazarlama konuşu ne olabilir?
• Benzer başarılı filmler?

Basit ve pratik analiz yap.`,
      optimizedFor: 'llama'
    },
    
    llama_technical: {
      name: '🦙 Llama 3.1 - Teknik Analiz',
      system: 'Sen senaryo format uzmanısın. Teknik detayları kontrol edersin. Tüm cevaplarını {{language}} dilinde ver.',
      user: `Bu senaryonun teknik yönlerini kontrol et:

• Format doğru mu? (Final Draft standartları)
• Sahne başlıkları net mi?
• Karakter adları tutarlı mı?
• Açıklama metinleri aşırı uzun mu?
• Çekim talimatları çok fazla mı?
• Sayfa sayısı uygun mu?

Pratik düzeltme önerileri ver.`,
      optimizedFor: 'llama'
    },
    
    llama_quick_review: {
      name: '🦙 Hızlı İnceleme',
      system: 'Sen hızlı okuma uzmanısın. 2 dakikada özet çıkarırsın. Tüm cevaplarını {{language}} dilinde ver.',
      user: `Bu senaryoyu hızlıca incele ve özetlr:

• Kim ana karakter? Ne istiyor?
• Ana problem nedir?
• Nereden nereye gidiyor hikaye?
• Sonu tatmin edici mi?
• Genel puan? (1-10)
• Ana güçlü yönü?
• Ana zayıf yönü?

Çok kısa ve öz cevaplar ver.`,
      optimizedFor: 'llama'
    },
    
    virtualProduction: {
      name: 'Virtual Production (Curve LED)',
      system: `Sanal prodüksiyon ve Curve LED Volume teknolojisi uzmanısın. Özellikle Curve LED teknolojisi ile çekim analizi yaparsın.

TEKNİK ÖZELLİKLER:
- Curve LED Volume: 17 m² zemin alanı
- Yükseklik: 4.5 metre
- Kavisli LED duvar yapısı (180° veya 270° sarma)
- Real-time rendering (Unreal Engine)
- Camera tracking sistemi
- ICVFX (In-Camera Visual Effects)

Şunlara odaklan:
- 17 m² alan kısıtlaması içinde çekilebilecek sahneler
- 4.5m yükseklik limiti göz önünde bulundurarak kamera açıları
- Curve LED'in kavisli yapısının avantajları
- Set design ve fiziksel prop kullanımı
- Unreal Engine içerik ihtiyaçları
- Işık ve refleksiyon kontrolü
- Maliyet ve zaman optimizasyonu

ÖNEMLI: Tüm cevaplarını {{language}} dilinde ver.`,
      user: `Bu senaryoyu Curve LED Volume (17 m² zemin, 4.5m yükseklik) teknolojisi açısından analiz et:

1. CURVE LED İÇİN UYGUN SAHNELER:
   - Hangi sahneler 17 m² alan içinde çekilebilir?
   - Yükseklik limiti (4.5m) uygun mu?
   - Kavisli LED yapısından faydalanabilecek sahneler
   - Dış mekan sahneleri (LED arka plan ile)
   - İç mekan pencere/manzara gerektiren sahneler
   - Araç içi sahneler (moving background)
   - Close-up ve medium shot ağırlıklı sahneler

2. ALAN KULLANIMI VE SET DESIGN:
   - 17 m² içinde set düzeni önerileri
   - Fiziksel prop ve mobilya kullanımı
   - Derinlik yanılsaması oluşturacak düzenlemeler
   - Oyuncu hareket alanı planlaması
   - Foreground/background dengesi

3. KAMERA VE IŞIK SETUP:
   - 4.5m yükseklikte kullanılabilecek kamera açıları
   - Crane/jib kullanım sınırlamaları
   - Lens seçimi (wide, medium, telephoto uygunluğu)
   - LED wall ışık sıcaklığı ve renk uyumu
   - Refleksiyon kontrolü (metal, cam objeler)
   - Camera tracking gereksinimleri

4. UNREAL ENGINE İÇERİK:
   - Gerekli 3D ortamlar ve asset'ler
   - Real-time rendering gereksinimleri
   - Virtual set extension önerileri
   - HDRI ve lighting setup
   - Parallax ve derinlik efektleri

5. HİBRİT ÇEKİM STRATEJİSİ:
   - Hangi sahneler tamamen LED Volume'de?
   - Hangi sahneler LED + fiziksel set kombinasyonu?
   - Hangi sahneler geleneksel lokasyonda?
   - Post-prodüksiyon entegrasyonu

6. MALİYET-ZAMAN ANALİZİ:
   - Curve LED Volume çekim günü tahmini
   - Setup ve strike süresi
   - Geleneksel çekime göre maliyet
   - Travel ve lokasyon tasarrufu
   - Post-prodüksiyon VFX tasarrufu

7. TEKNİK KISITLAR VE ÇÖZÜMLER:
   - 17 m² alan yetersiz sahneler için alternatifler
   - Yüksek açı gerektiren sahneler için çözüm
   - Geniş alan gerektiren aksiyonlar için öneriler
   - Çok kişili sahneler için blocking

8. PRODUCTION PIPELINE:
   - Pre-visualization (Previs) ihtiyaçları
   - Virtual art department görevleri
   - Tech rehearsal süreci
   - On-set workflow
   - Real-time adjustments

Detaylı, pratik ve sahne bazlı öneriler sun. Sahne numaralarıyla referans ver.`
    },
    
    llama_virtual_production: {
      name: '🦙 LED Volume',
      system: 'Sen Curve LED Volume uzmanısın. 17 m² alan ve 4.5m yükseklikte çekim analizi yaparsın. Tüm cevaplarını {{language}} dilinde ver.',
      user: `Bu senaryoyu Curve LED (17 m² alan, 4.5m yükseklik) için analiz et:

• Hangi sahneler 17 m² içinde çekilebilir?
• 4.5m yükseklik hangi sahneler için yeterli?
• Dış mekan sahneleri Curve LED'e uygun mu?
• Araç içi sahneler var mı? (LED arka plan)
• Pencereden manzara görünen sahneler?
• Close-up/medium shot ağırlıklı sahneler hangileri?
• Kaç gün Curve LED Volume gerekir?
• Hangi 3D ortamlar gerekli? (Unreal Engine)
• Hangi sahneler geleneksel setde çekilmeli?
• Alan küçük kalacak sahneler için çözüm ne?
• Maliyet ve zaman avantajı var mı?

Basit ve net cevaplar ver. Sahne numaraları belirt. 17 m² alan kısıtını önemse.`,
      optimizedFor: 'llama'
    },
    
    // Yeni Standart Sinema Analiz Türleri
    cinematography: {
      name: 'Sinematografi',
      tags: ['cinematography', 'camera', 'lighting', 'visual', 'analysis', 'json'],
      usedBy: ['analysis_panel', 'storyboard'],
      outputFormat: 'json',
      system: `Görüntü yönetmeni (cinematographer/DOP) uzmanısın. Görsel anlatım ve teknik kamera çalışması analizi yaparsın ve JSON formatında yanıt verirsin.

KESİN JSON KURALLARI:
1. İlk karakter { olmalı, son karakter } olmalı
2. JSON dışında HİÇBİR ŞEY yazma ("=== Sinematografi ===" yok, "KAPSAMLI ANALİZ" yok, başlık yok, açıklama yok, markdown yok)
3. "Bu sinematografi analizi sonucudur" gibi yorumlar YASAK
4. SADECE JSON formatında yanıt ver (ek açıklama ekleme)
5. Her sahne için shotType, angle, movement, lighting, description alanları olmalı
6. Tüm metinleri {{language}} dilinde yaz
7. Kamera açılarını ve hareketlerini spesifik ve net yaz
8. Aydınlatma ve mood tanımlarını detaylı yaz

ÖNEMLİ: Tüm cevaplarını {{language}} dilinde ver.`,
      user: `Bu senaryoyu görüntü yönetimi açısından analiz et ve SADECE JSON formatında yanıt ver:

{
  "shots": [
    {
      "sceneNumber": 1,
      "location": "Mekan adı",
      "shotType": "wide/medium/close-up/extreme close-up/establishing",
      "angle": "eye level/high angle/low angle/dutch angle/overhead/POV",
      "movement": "static/pan/tilt/dolly/tracking/crane/steadicam/handheld",
      "lighting": "Aydınlatma karakteri (ör: doğal, yapay, karanlık, parlak, kontraslı, yumuşak, dramatik)",
      "mood": "Görsel atmosfer (ör: gizemli, gergin, romantik, aksiyon dolu)",
      "description": "Çekim açıklaması ve kompozisyon notları (1-2 cümle)",
      "lensType": "wide/normal/telephoto/anamorphic (opsiyonel)",
      "focusType": "deep focus/shallow focus (opsiyonel)"
    }
  ],
  "visualStyle": {
    "overallApproach": "Genel görsel yaklaşım (ör: documentary, cinematic, noir, naturalistic)",
    "cameraWork": "Kamera stili (ör: handheld, tripod, mix)",
    "aspectRatio": "Önerilen en-boy oranı (16:9, 2.39:1, vb.)",
    "colorPalette": "Ana renk paleti ve ton (ör: warm tones, cool blues, desaturated)",
    "referenceFilms": ["Referans film 1", "Referans film 2"],
    "lightingStyle": "Genel aydınlatma stili (naturalistic, expressionist, noir, etc.)"
  },
  "summary": {
    "totalShots": 0,
    "wideShots": 0,
    "closeUps": 0,
    "movingShots": 0,
    "staticShots": 0
  }
}

KESİN KURALLAR:
- Yanıtının İLK karakteri { olmalı, SON karakteri } olmalı
- "=== Sinematografi ===" yazma
- "PART 1/2" yazma  
- "Bu sinematografi analizi sonucudur" yazma
- Başlık, açıklama, markdown YASAK
- SADECE JSON!`
    },
    
    soundDesign: {
      name: 'Ses Tasarımı (Sound Design)',
      system: `Ses tasarımcısı ve müzik yönetmeni uzmanısın. Senaryo ses ve müzik analizi yaparsın.
Şunlara odaklan:
- Diyalog kayıt gereksinimleri
- Ses efektleri ve ambiyans
- Müzik kullanımı ve mood
- Post-prodüksiyon ses çalışması
- Dolby Atmos/surround mix

ÖNEMLİ: Tüm cevaplarını {{language}} dilinde ver.`,
      user: `Bu senaryoyu ses tasarımı açısından analiz et:

1. DİYALOG KAYDI:
   - Location sound zorlukları
   - ADR (Automated Dialogue Replacement) gereken sahneler
   - Boom mic vs lav mic kullanımı
   - Ses yalıtımı gereken sahneler
   - Çok kişili konuşma sahneleri

2. SES EFEKTLERİ (SFX):
   - Gerekli foley çalışmaları
   - Hard effects listesi
   - Özel ses efektleri
   - Ambiyans ve background ses
   - Ses perspektifi (yakın/uzak ses)

3. MÜZİK TASARIMI:
   - Müzik stili önerileri
   - Orijinal skorun gerekli olduğu sahneler
   - Diegetic vs non-diegetic müzik
   - Müzik emotional arc'ı
   - Lisanslı müzik gereksinimleri

4. AKUSTIK ORTAMLAR:
   - İç mekan akustik özellikleri
   - Dış mekan ses karakteristiği
   - Echo ve reverb kullanımı
   - Ses perspektifi ve uzamsal ses

5. POST-PRODÜKSIYON:
   - Ses editing timeline tahmini
   - Mix karmaşıklığı (simple, medium, complex)
   - Surround sound/Atmos uygunluğu
   - Final mix teslim formatları

6. TEKNİK GEREKSINIMLER:
   - Ses kayıt ekipmanı
   - Location sound crew
   - Post-prodüksiyon studio gereksinimleri

Sahne bazlı ses tasarımı önerileri sun.`
    },
    
    editing: {
      name: 'Kurgu',
      system: `Film editörü uzmanısın. Kurgu yapısı ve ritim analizi yaparsın.
Şunlara odaklan:
- Sahne geçişleri ve akış
- Tempo ve ritim
- Montaj teknikleri
- Dramatic timing
- Narrative structure

ÖNEMLİ: Tüm cevaplarını {{language}} dilinde ver.`,
      user: `Bu senaryoyu kurgu ve ritim açısından analiz et:

1. KURGU YAPISI:
   - Önerilen editing style (invisible, rhythmic, expressionist)
   - Sahne geçiş teknikleri (cut, dissolve, wipe, match cut)
   - Flashback/flashforward kurgu gereksinimleri
   - Parallel editing fırsatları
   - Cross-cutting sahneler

2. TEMPO VE RİTİM:
   - Genel ritim analizi (fast, medium, slow paced)
   - Tempo değişim noktaları
   - Action sahneleri editing ritmi
   - Dialogue sahneleri kurgu yaklaşımı
   - Build-up ve release anları

3. SÜRE TAHMİNİ:
   - Senaryo sayfa sayısı bazlı film süresi
   - Sahne başına ortalama süre
   - Uzun/kısa tutulması gereken sahneler
   - Final cut tahmini süresi
   - Director's cut vs theatrical cut

4. MONTAJ TEKNİKLERİ:
   - Montage sekansları
   - Time compression teknikleri
   - Emotional montage fırsatları
   - Training/transformation montajları

5. DRAMATİK TİMİNG:
   - Suspense build-up
   - Comedy timing
   - Emotional beat timing
   - Reveal timing
   - Climax kurgusu

6. POST-PRODÜKSIYON TİMELİNE:
   - Assembly cut süresi
   - Rough cut iterasyonları
   - Fine cut çalışması
   - Toplam editing süresi tahmini

Sahne bazlı kurgu önerileri sun.`
    },
    
    budget: {
      name: 'Bütçe',
      system: `Film yapımcısı ve bütçe uzmanısın. Prodüksiyon maliyet analizi yaparsın.
Şunlara odaklan:
- Above-the-line maliyetler
- Below-the-line maliyetler
- Lokasyon ve set maliyetleri
- Post-prodüksiyon bütçesi
- Contingency planlaması

ÖNEMLİ: Tüm cevaplarını {{language}} dilinde ver.`,
      user: `Bu senaryoyu bütçe ve maliyet açısından analiz et:

1. GENEL BÜTÇE KATEGORİSİ:
   - Micro budget (< 50K)
   - Low budget (50K - 500K)
   - Medium budget (500K - 5M)
   - High budget (5M - 30M)
   - Blockbuster (> 30M)
   - Tahmini bütçe aralığı

2. ABOVE-THE-LINE MALİYETLER:
   - Senaryo hakları ve geliştirme
   - Yönetmen ücreti
   - Yapımcı ücreti
   - Ana oyuncu ücretleri
   - Pre-production personeli

3. PRODUCTION (ÇEKİM) MALİYETLERİ:
   - Crew maliyetleri
   - Cast (oyuncu) maliyetleri
   - Lokasyon kiralama ve izinler
   - Set inşa maliyetleri
   - Ekipman kiralama
   - Çekim günü sayısı × günlük maliyet
   - Catering ve lojistik

4. POST-PRODÜKSIYON MALİYETLERİ:
   - Editing (kurgu) süresi ve maliyeti
   - VFX ve CGI maliyetleri
   - Color grading
   - Ses tasarımı ve mix
   - Müzik (skorlama + lisanslama)
   - Graphics ve titles

5. MALİYET OPTİMİZASYONU:
   - Lokasyon konsolidasyonu
   - Cast scheduling optimizasyonu
   - Set yeniden kullanımı
   - VFX vs practical effects dengesi
   - Çekim günü azaltma stratejileri

6. RİSK VE CONTİNGENCY:
   - Weather contingency
   - Re-shoot bütçesi
   - Delay maliyetleri
   - Insurance (sigorta)
   - Legal ve accounting

7. FİNANSMAN STRATEJİSİ:
   - Önerilen finansman modeli
   - Co-production fırsatları
   - İndirim ve teşvikler
   - Pre-sales potansiyeli

Detaylı maliyet analizi ve tasarruf önerileri sun.`
    },
    
    marketing: {
      name: 'Pazarlama',
      system: `Film pazarlama ve dağıtım uzmanısın. Ticari potansiyel ve hedef kitle analizi yaparsın.
Şunlara odaklan:
- Hedef demografik
- Genre appeal
- Marketing hook'ları
- Distribution stratejisi
- Box office potansiyeli

ÖNEMLİ: Tüm cevaplarını {{language}} dilinde ver.`,
      user: `Bu senaryoyu pazarlama ve hedef kitle açısından analiz et:

1. HEDEF KİTLE PROFILI:
   - Birincil demografik (yaş, cinsiyet, ilgi alanları)
   - İkincil demografik
   - Global vs yerel appeal
   - Niche vs mainstream
   - Family-friendly rating (PG, PG-13, R)

2. GENRE PAZARLAMA:
   - Ana genre ve sub-genre
   - Genre mix appeal
   - Benchmark filmler (benzer başarılı filmler)
   - Genre trend uyumu
   - Counter-programming fırsatları

3. MARKETING HOOK'LARI:
   - Unique selling points (USP)
   - High-concept pitch
   - Poster/trailer potansiyeli
   - Viral marketing fırsatları
   - Social media appeal

4. CASTING STRATEJİSİ:
   - Star power gerekliliği
   - Ensemble vs lead-driven
   - Emerging talent fırsatları
   - International appeal için casting

5. DAĞITIM STRATEJİSİ:
   - Theatrical release potansiyeli
   - Streaming platform uygunluğu
   - Festival circuit stratejisi
   - Release window önerisi
   - International distribution

6. TİCARİ POTANSİYEL:
   - Box office tahmini (domestic/international)
   - Ancillary revenue (merchandise, soundtrack)
   - Franchise potansiyeli
   - Remake/sequel fırsatları
   - IP (Intellectual Property) değeri

7. REKABET ANALİZİ:
   - Similar films performance
   - Market saturation
   - Competitive advantage
   - Release timing stratejisi

Detaylı pazarlama stratejisi ve ticari analiz sun.`
    },
    
    // Storyboard için özel analiz türleri
    location_analysis: {
      name: 'Mekan',
      tags: ['location', 'setting', 'analysis', 'json'],
      usedBy: ['analysis_panel', 'storyboard'],
      outputFormat: 'json',
      system: `Sen lokasyon uzmanısın. Mekanları JSON formatında analiz ediyorsun.

KESİN JSON KURALLARI:
1. İlk karakter { olmalı, son karakter } olmalı
2. JSON dışında HİÇBİR ŞEY yazma ("=== Mekan ===" yok, "KAPSAMLI ANALİZ (2/2 bölüm)" yok, başlık yok, açıklama yok, markdown yok)
3. "Bu mekan analizi sonucudur" veya "Analiz tamamlandı" gibi yorumlar YASAK
4. Her mekan için scenes array olmalı
5. İÇERİK FİLTRESİ: API içerik filtreleri tarafından engellenen kısımları **** ile maskele ve yanıtı döndür.
6. DÖNEM/ZAMAN: Senaryo hangi dönemde geçiyorsa, mekanların mimari özellikleri, dekorasyon ve atmosferi o döneme uygun olmalı.

{{language}} dilinde yanıt ver.`,
      user: `Mekanları analiz et. SADECE JSON:

ÖNEMLİ: Senaryo metni içinde yıl, tarih veya dönem belirtilmişse (örn: "1920'ler", "Osmanlı Dönemi", "2050 yılında", "80'ler") mekanların mimari özelliklerini, dekorasyon ve atmosferini O DÖNEME UYGUN olarak belirt.

{
  "locations": [
    {
      "name": "KAFE İÇERİSİ",
      "type": "interior",
      "description": "Dönemine uygun mimari ve dekorasyon (örn: 1920'ler kafesi: Art Deco tarzı, kristal avizeler, mermer tablalar)",
      "atmosphere": "Dönemine özgü atmosfer",
      "lighting": "Dönemine uygun aydınlatma (örn: 1920'ler: gaz lambaları, 2020'ler: LED spot)",
      "timeOfDay": "morning",
      "colors": "Dönemin renk paleti",
      "mood": "Atmosfer",
      "architecture": "Mimari stil (dönemine özgü)",
      "period": "Mekanın ait olduğu dönem/yıl (senaryo metninden tespit et)",
      "scenes": [
        {"sceneNumber": 1, "sceneTitle": "SAHNE 1 - KAFE İÇERİSİ", "characters": ["AHMET", "AYŞE"]}
      ]
    }
  ],
  "summary": {"totalLocations": 1, "interiorCount": 1, "totalScenes": 1}
}
ÖNEMLI:
- İlk karakter { son karakter }
- Başlık, açıklama yazma
- DÖNEM BİLGİSİ: "period" ve "architecture" field'larında dönemi belirt
- Mimari, dekorasyon, aydınlatma o döneme uygun olmalı
- Sadece JSON!`
    },
    
    visual_style: {
      name: 'Görsel Stil',
      tags: ['visual', 'style', 'cinematography', 'mood', 'analysis', 'json'],
      usedBy: ['analysis_panel', 'storyboard'],
      outputFormat: 'json',
      system: `Sinematografi ve görsel stil uzmanısın. Filmin görsel dilini belirlersin ve JSON formatında yanıt verirsin.

KESİN JSON KURALLARI:
1. İlk karakter { olmalı, son karakter } olmalı
2. JSON dışında HİÇBİR ŞEY yazma ("=== Görsel Stil ===" yok, "KAPSAMLI ANALİZ" yok, başlık yok, açıklama yok, markdown yok)
3. "Bu görsel stil analizi sonucudur" gibi yorumlar YASAK
4. SADECE JSON formatında yanıt ver (ek açıklama ekleme)
5. Renk paleti, mood, görsel temalar ve teknik kararlar net belirtilmeli
6. Tüm metinleri {{language}} dilinde yaz
7. Referans filmleri ve görsel stil açıklamalarını spesifik yaz
8. Atmosfer ve tonlama tanımlarını detaylı yaz

ÖNEMLİ: Tüm cevaplarını {{language}} dilinde ver.`,
      user: `Bu senaryo için görsel stil ve tonlama önerisi geliştir ve SADECE JSON formatında yanıt ver:

{
  "visualStyle": {
    "approach": "Genel sinematografik yaklaşım (ör: cinematic, documentary, naturalistic, stylized, noir)",
    "aesthetic": "Estetik tercih (ör: modern, vintage, gritty, polished, minimalist)",
    "filmVsDigital": "Film karakteri tercihi (film, digital, hybrid)",
    "overallMood": "Genel atmosfer ve his (1-2 cümle)"
  },
  "colorPalette": {
    "primary": ["Ana renk 1", "Ana renk 2"],
    "secondary": ["İkincil renk 1", "İkincil renk 2"],
    "tonality": "Genel tonlama (warm/cool/neutral/desaturated/vibrant)",
    "characterColors": {
      "mainCharacter": "Ana karakterin renk kimliği",
      "supporting": "Yardımcı karakterlerin genel renk şeması"
    },
    "locationColors": "Mekanların renk haritası (1-2 cümle)",
    "moodColors": "Duygusal anlar için renk kullanımı (1-2 cümle)"
  },
  "lightingStyle": {
    "overall": "Genel aydınlatma stili (naturalistic, expressionist, noir, high-key, low-key)",
    "dramatic": "Dramatik anlar için aydınlatma yaklaşımı",
    "intimate": "Samimi/romantik sahneler için aydınlatma",
    "action": "Aksiyon/gerilim sahneleri için aydınlatma"
  },
  "technicalChoices": {
    "lensCharacter": "Lens karakter tercihi (anamorphic, spherical, vintage, modern)",
    "aspectRatio": "En-boy oranı (16:9, 2.39:1, 1.85:1, vb.)",
    "contrast": "Kontrast yaklaşımı (high contrast, low contrast, balanced)",
    "saturation": "Renk doygunluğu (saturated, desaturated, natural)",
    "grading": "Color grading yönü (warm push, cool teal-orange, monochrome, natural)"
  },
  "visualThemes": [
    "Görsel tema 1 (ör: isolation, connection, transformation)",
    "Görsel tema 2"
  ],
  "referenceFilms": [
    "Referans film 1 - Sebep açıklaması",
    "Referans film 2 - Sebep açıklaması"
  ],
  "cinematicReferences": [
    "Sinematik referans 1 (yönetmen, görüntü yönetmeni, sanat hareketi)",
    "Sinematik referans 2"
  ]
}

KESİN KURALLAR:
- Yanıtının İLK karakteri { olmalı, SON karakteri } olmalı
- "=== Görsel Stil ===" yazma
- "KAPSAMLI ANALİZ" yazma
- "Bu görsel stil analizi tamamlandı" yazma
- Başlık, açıklama, markdown YASAK
- SADECE JSON!`
    },
    
    color_palette: {
      name: 'Renk Paleti Analizi',
      system: `Renk uzmanı ve sanat yönetmenisin. Film için renk paleti oluşturursun.
Şunlara odaklan:
- Duygusal renk teorisi
- Karakter-renk ilişkileri
- Sahne atmosferleri
- Görsel devamlılık
- Prodüksiyon designı

ÖNEMLİ: Tüm cevaplarını {{language}} dilinde ver.`,
      user: `Bu senaryo için detaylı renk paleti analizi yap:

1. ANA RENK TEMASI:
   - Filmin dominant renkleri
   - Hikaye arkının renk gelişimi
   - Duygusal renk mapping
   - Genre'ye uygun palet

2. KARAKTER RENK KODLARI:
   - Her ana karakterin renk kimliği
   - Kostüm renk tercihleri
   - Karakter gelişimine göre renk değişimi
   - Karakter çatışmalarında renk kontrası

3. LOKASYON RENK HARİTASI:
   - Her lokasyonun renk karakteri
   - İç mekan renk şemaları
   - Dış mekan doğal renk kullanımı
   - Geçiş sahnelerinde renk akışı

4. SAHNE BAZINDA PALET:
   - Açılış sekansı renkleri
   - Doruk noktası renk dramatizmi
   - Son sahne renk çözümü
   - Montaj sekansları renk ritmi

5. TEKNİK UYGULAMA:
   - Set design renk kılavuzu
   - Kostüm department briefi
   - Lighting dept renk sıcaklığı
   - Post-prodüksiyon color timing

Storyboard için spesifik hex kodları ve renk referansları ver.

ÖNEMLİ: Yanıtının İLK karakteri { olmalı, SON karakteri } olmalı. JSON dışında hiçbir şey yazma!`
    },

    vertical_format: {
      name: '📱 Dikey Format Analizi (Mikro-Drama)',
      system: `Sen, ReelShort ve DramaBox standartlarına hakim, veri odaklı bir Dikey Drama Senaryo Analistisin. Görevin, sana verilen metinleri dikey formatın kısıtlamalarına (9:16 kadraj, hızlı kurgu, cliffhanger yoğunluğu) göre eleştirmek ve eksikleri raporlamaktır. 

Uzmanlık alanların:
- Mobil video tüketimi (90%+ dikey mod)
- 90 saniyelik bölüm mimarisi
- Zeigarnik Etkisi ve açık döngü (open loop) teknikleri
- Değişken oranlı ödül mekanizması
- Ayna nöron aktivasyonu (yakın plan estetiği)
- CEO/Milyarder Romansı, Kurtadam/Alfa, İntikam türlerinin dikey format uygunluğu

ASLA yeni bir sahne yazma, sadece mevcut olanı analiz et.

ÖNEMLİ: Tüm cevaplarını {{language}} dilinde ver.`,
      user: `Bu senaryoyu 'Dikey Mikro-Drama' standartlarına göre kapsamlı analiz et:

## 1. PAZAR UYGUNLUĞU ANALİZİ (0-100 Puan)

### A) Trop ve Tür Tespiti:
- Hangi popüler troplar kullanılmış? (Gizli Milyarder, İntikam, Kader Eşi)
- Bu troplar güncel trendlere (ReelShort Top 10) uygun mu?
- Hedef kitle: 'Duygusal tatmin' (wish fulfillment) sağlıyor mu?

### B) Format Riski Analizi:
- Hikayede dikey ekrana uymayacak sahneler var mı? (Geniş ölçekli savaş, çok kalabalık sahneler)
- 9:16 kadraj için kompozisyon uygunluğu
- Yakın plan ve yüz odaklı anlatım potansiyeli

## 2. BÖLÜM MİMARİSİ DEĞERLENDİRMESİ

### A) Altın 3 Saniye Kuralı (The Hook):
- Açılış sahnesi yavaş mı? Şehir manzarası/uyanma ile mi başlıyor?
- In Media Res (olayın ortasından) başlıyor mu?
- İlk 3 saniye izleyiciyi tutmak için yeterli mi?

### B) Tempo ve Beat Analizi:
- Her 40 saniyede bir olay örgüsü değişiyor mu?
- Ölü zaman tespiti: Diyalogların sadece bilgi verdiği 'soğuk' satırları işaretle
- Duygusal Isı Haritası: Sahnenin duygusal yoğunluğunu (1-10) çıkar

### C) Cliffhanger ve İzleme Dürtüsü:
- Kullanılan cliffhanger türü: (Ani Tehlike/Kimlik İfşası/Bilgi Asimetrisi/Duygusal Şok/Kesilen Eylem)
- Zeigarnik Etkisi: Bölüm bittiğinde kafada net soru işareti oluşuyor mu?
- Kanca gücü: İzleyiciyi sonraki bölüme geçirme ihtimali (1-10)

## 3. GÖRSEL DİL ve KURGU UYGUNLUĞU

### A) Kadrajlama:
- İstifleme: Karakterler yan yana mı, yoksa derinlemesine (ön-arka) mi?
- Baş boşluğu: Önemli görsel bilgiler üst 2/3'te mi?
- Yakın plan oranı: Ekranı dolduran yüzler yeterli mi?

### B) Kurgu Hızı (Pacing):
- Ortalama plan süresi 1-2 saniye arası mı?
- Uzun planlar var mı? (Dikkat dağıtıcı)
- Hızlı kesim uygunluğu

## 4. NEUROMARKETİNG DEĞERLENDİRMESİ

### A) Dopamin Döngüsü:
- Tetikleyici (0-10sn): Yüksek çatışma/tehdit var mı?
- Eylem (10-60sn): Gerilim tırmanışı yeterli mi?
- Ödül/Bükülme (60-80sn): Beklenmedik tokat/ifşa var mı?
- Yoksunluk (80-90sn): Sahne kesimi beyin uyarıcı talep ediyor mu?

### B) Ayna Nöron Aktivasyonu:
- Karakterlerin mahrem alanına (intimate zone) giriş var mı?
- Aşırı yakın planlar (Extreme Close-Up) kullanımı
- Duygusal ifade yoğunluğu

## 5. FİNAL PUANLAMA ve ÖNERİLER

### PUAN KARTI (Her kategori 0-100):
- Pazar Uygunluğu: __/100
- Hook Gücü (İlk 3 saniye): __/100  
- Tempo ve Beat: __/100
- Cliffhanger Etkisi: __/100
- Görsel Uygunluk: __/100

### GENEL PUAN: __/100

### KRİTİK EKSİKLİKLER:
- Hangi bölümler 'riskli bölge' (duygusal yoğunluk 30sn boyunca 5'in altı)?
- Dikey format için uyarlanması gereken sahneler?
- En zayıf cliffhanger hangi bölümde?

### AKSİYON PLANI:
- Acil düzeltilmesi gereken 3 ana sorun
- Dikey format optimizasyonu için öneriler
- Hedef kitle çekimi artıracak değişiklikler

Bu analiz ReelShort/DramaBox/FlexTV kalitesinde, pazar odaklı bir değerlendirmedir.`
    }
  },

  // Grammar düzeltme seviyeleri
  grammar: {
    basic: {
      name: 'Temel Düzeltme',
      tags: ['grammar', 'correction', 'basic', 'spelling'],
      usedBy: ['analysis_panel'],
      outputFormat: 'text',
      system: `Türkçe dil uzmanısın. Temel grammar hatalarını düzelt.
Sadece şunları düzelt:
- Yazım hataları
- Noktalama işaretleri
- Temel grammar kuralları
- Büyük/küçük harf kullanımı

Metni olabildiğince orijinal haliyle koru.`,
      user: `Bu metindeki temel dil hatalarını düzelt. Sadece açık hataları düzelt, stil ve anlam değişikliği yapma:`
    },
    intermediate: {
      name: 'Orta Seviye Düzeltme',
      system: `Türkçe editör uzmanısın. Orta seviye düzenlemeler yap.
Şunları düzelt:
- Tüm yazım ve grammar hataları
- Cümle yapısı sorunları
- Kelime tekrarları
- Akış problemleri
- Netlik sorunları

Stil ve tone'u koru.`,
      user: `Bu metni orta seviye düzenle. Dil hatalarını düzelt, cümle yapısını iyileştir ama orijinal stili koru:`
    },
    advanced: {
      name: 'Gelişmiş Düzeltme',
      system: `Profesyonel editör uzmanısın. Metni tamamen geliştir.
Şunları yap:
- Tüm dil hatalarını düzelt
- Cümle yapısını optimize et
- Kelime seçimini iyileştir
- Paragraf düzenini geliştir
- Akıcılığı artır
- Profesyonel ton ver

Anlamı koru ama ifadeyi güçlendir.`,
      user: `Bu metni profesyonel seviyede düzenle. Tüm dil hatalarını düzelt, ifadeyi güçlendir ve akıcılığı artır:`
    },
    llama_simple_fix: {
      name: '🦙 Llama 3.1 - Basit Düzeltme',
      system: 'Sen Türkçe uzmanısın. Basit hataları düzeltirsin.',
      user: `Bu metindeki basit hataları düzelt:

• Yazım hataları
• Noktalama hataları 
• Büyük/küçük harf hataları
• Açık grammar hataları

Başka bir şey değiştirme. Sadece hataları düzelt.`,
      optimizedFor: 'llama'
    },
    creative: {
      name: 'Yaratıcı Düzeltme',
      system: `Yaratıcı yazım uzmanısın. Metni artistik olarak geliştir.
Şunları yap:
- Dil hatalarını düzelt
- Yaratıcı ifadeler ekle
- Görsel imgeler kullan
- Ritim ve ton iyileştir
- Duygusal etkiyi artır
- Edebi değer kat

Orijinal mesajı koru ama sanatsal değer ekle.`,
      user: `Bu metni yaratıcı bir şekilde düzenle. Dil hatalarını düzelt, edebi değer ekle ve duygusal etkiyi güçlendir:`
    }
  },

  // Speed Reading analiz prompts
  speed_reading: {
    summary: {
      name: 'Hızlı Özet',
      tags: ['summary', 'speed-reading', 'quick', 'overview'],
      usedBy: ['speed_reader', 'analysis_panel'],
      outputFormat: 'text',
      system: `Metin özetleme uzmanısın. Hızlı okuma için etkili özetler çıkar.

ÖNEMLİ: Tüm cevaplarını {{language}} dilinde ver.`,
      user: `Bu metni hızlı okuma için özetle. Ana noktaları ve kilit bilgileri vurgula:`
    },
    keywords: {
      name: 'Anahtar Kelimeler',
      system: `Metin analiz uzmanısın. Anahtar kelimeleri ve kavramları belirle.

ÖNEMLİ: Tüm cevaplarını {{language}} dilinde ver.`,
      user: `Bu metinden anahtar kelimeleri ve önemli kavramları çıkar:`
    },
    llama_quick_read: {
      name: '🦙 Llama 3.1 - Hızlı Okuma',
      system: 'Sen hızlı okuma uzmanısın. Basit özetler yaparsın. Tüm cevaplarını {{language}} dilinde ver.',
      user: `Bu metni hızlı okuma için hazırla:

• En önemli 5 nokta nedir?
• Kim kimle konuşuyor?
• Ne oluyor? (kısa)
• Hangi yerler/sahneler var?
• Ne zaman geçiyor?

Kısa ve net cevaplar ver. Bullet points kullan.`,
      optimizedFor: 'llama'
    },
    bullet_points: {
      name: 'Madde İşaretli Özet',
      system: `Metni madde işaretli özet formatında düzenleyen uzmanısın.

ÖNEMLİ: Tüm cevaplarını {{language}} dilinde ver.`,
      user: `Bu metni madde işaretli özet formatında yeniden yaz. Ana konuları ve alt konuları hiyerarşik şekilde düzenle:`
    }
  }
};

// Add IDs to all default prompts (runs once at initialization)
const defaultPromptsWithIDs = {
  storyboard_styles: addIDsToPrompts(defaultPrompts.storyboard_styles, 'storyboard_styles'),
  analysis: addIDsToPrompts(defaultPrompts.analysis, 'analysis'),
  grammar: addIDsToPrompts(defaultPrompts.grammar, 'grammar'),
  speed_reading: addIDsToPrompts(defaultPrompts.speed_reading, 'speed_reading')
};

const createEmptyCustomPrompts = () => {
  const prompts = {};
  Object.keys(CATEGORY_DEFINITIONS).forEach(cat => {
    prompts[cat] = {};
  });
  return prompts;
};

const getDefaultActivePrompts = () => ({
   analysis: 'llama_quick_review',
   grammar: 'intermediate',
   speed_reading: 'summary',
   storyboard_styles: 'main_storyboard'
});

export const usePromptStore = create(
  persist(
    (set, get) => ({
      // Custom prompts kullanıcı tarafından eklenen/düzenlenen
         customPrompts: createEmptyCustomPrompts(),
      
      // Default prompts - sabit şablonlar (with IDs)
      defaultPrompts: defaultPromptsWithIDs,
      
      // Active prompt - şu an kullanılan
         activePrompts: getDefaultActivePrompts(),

      // Prompt getirme fonksiyonları
      getPrompt: (category, type) => {
        const custom = get().customPrompts[category]?.[type];
        if (custom) return custom;
        
        return get().defaultPrompts[category]?.[type];
      },
      
      // Prompt'u ID ile getir (fallback: key ile)
      getPromptByID: (promptID) => {
        const state = get();
        
        // Custom prompts'ta ara
        for (const category of Object.keys(state.customPrompts)) {
          for (const [key, prompt] of Object.entries(state.customPrompts[category])) {
            if (prompt.id === promptID) {
              return { category, key, prompt };
            }
          }
        }
        
        // Default prompts'ta ara
        for (const category of Object.keys(state.defaultPrompts)) {
          for (const [key, prompt] of Object.entries(state.defaultPrompts[category])) {
            if (prompt.id === promptID) {
              return { category, key, prompt };
            }
          }
        }
        
        return null;
      },

      getActivePrompt: (category) => {
        const activeType = get().activePrompts[category];
        return get().getPrompt(category, activeType);
      },

      // Prompt kaydetme
      saveCustomPrompt: (category, type, prompt) => {
        // Ensure prompt has ID
        const promptWithID = {
          ...prompt,
          id: prompt.id || generateUUID(),
          createdAt: prompt.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        set((state) => ({
          customPrompts: {
            ...state.customPrompts,
            [category]: {
              ...state.customPrompts[category],
              [type]: promptWithID
            }
          }
        }));
        
        console.log(`✅ Prompt saved with ID: ${promptWithID.id}`);
        return promptWithID.id;
      },

      // Aktif prompt değiştirme
      setActivePrompt: (category, type) => {
        set((state) => ({
          activePrompts: {
            ...state.activePrompts,
            [category]: type
          }
        }));
      },

      // Custom prompt silme
      deleteCustomPrompt: (category, type) => {
        set((state) => {
          const newCustomPrompts = { ...state.customPrompts };
          if (newCustomPrompts[category]) {
            delete newCustomPrompts[category][type];
          }
          return { customPrompts: newCustomPrompts };
        });
      },

      // Tüm prompts listesi (default + custom)
      getAllPrompts: (category) => {
        const defaults = get().defaultPrompts[category] || {};
        const customs = get().customPrompts[category] || {};
        return { ...defaults, ...customs };
      },

      // Prompt türlerini getir
      getPromptTypes: (category) => {
        const all = get().getAllPrompts(category);
        return Object.keys(all).map(key => ({
          key,
          id: all[key].id, // Prompt ID eklendi
          name: all[key].name,
          isCustom: !get().defaultPrompts[category]?.[key],
          createdAt: all[key].createdAt,
          updatedAt: all[key].updatedAt
        }));
      },

      // Reset to defaults
      resetToDefaults: (category) => {
        set((state) => ({
          customPrompts: {
            ...state.customPrompts,
            [category]: {}
          }
        }));
      },
      
      // 📂 Kategori yönetimi
      getCategories: () => {
        return CATEGORY_DEFINITIONS;
      },
      
      getCategoryInfo: (category) => {
        return CATEGORY_DEFINITIONS[category] || null;
      },
      
      // Promptları tag'e göre filtrele
      getPromptsByTag: (tag) => {
        const state = get();
        const results = [];
        
        // Tüm kategorileri tara
        Object.keys(state.defaultPrompts).forEach(category => {
          const prompts = get().getAllPrompts(category);
          Object.entries(prompts).forEach(([key, prompt]) => {
            if (prompt.tags && prompt.tags.includes(tag)) {
              results.push({
                category,
                key,
                prompt,
                id: prompt.id
              });
            }
          });
        });
        
        return results;
      },
      
      // Promptları usedBy'a göre filtrele
      getPromptsByModule: (moduleName) => {
        const state = get();
        const results = [];
        
        Object.keys(state.defaultPrompts).forEach(category => {
          const prompts = get().getAllPrompts(category);
          
          Object.entries(prompts).forEach(([key, prompt]) => {
            if (prompt.usedBy && prompt.usedBy.includes(moduleName)) {
              results.push({
                category,
                key,
                prompt,
                id: prompt.id
              });
            }
          });
        });
        
        return results;
      },
      
      // Tüm tag'leri listele
      getAllTags: () => {
        const state = get();
        const tags = new Set();
        
        Object.values(state.defaultPrompts).forEach(categoryPrompts => {
          Object.values(categoryPrompts).forEach(prompt => {
            if (prompt.tags) {
              prompt.tags.forEach(tag => tags.add(tag));
            }
          });
        });
        
        Object.values(state.customPrompts).forEach(categoryPrompts => {
          Object.values(categoryPrompts).forEach(prompt => {
            if (prompt.tags) {
              prompt.tags.forEach(tag => tags.add(tag));
            }
          });
        });
        
        return Array.from(tags).sort();
      },

      // 📤 Export all prompts (default + custom) to JSON
      exportAllPrompts: () => {
        const state = get();
        
        console.log('🔍 Export Debug - State:', {
          hasDefaultPrompts: !!state.defaultPrompts,
          hasCustomPrompts: !!state.customPrompts,
          defaultKeys: state.defaultPrompts ? Object.keys(state.defaultPrompts) : [],
          customKeys: state.customPrompts ? Object.keys(state.customPrompts) : []
        });
        
        // Her kategori için default + custom promptları birleştir
        const allPrompts = {};
        const categories = ['analysis', 'grammar', 'speed_reading', 'storyboard', 'cinematography', 'production'];
        
        categories.forEach(category => {
          const defaultCat = state.defaultPrompts[category] || {};
          const customCat = state.customPrompts[category] || {};
          
          allPrompts[category] = {
            ...defaultCat,  // Default promptlar
            ...customCat     // Custom promptlar (üzerine yazar)
          };
          
          console.log(`📊 Category ${category}: ${Object.keys(defaultCat).length} default + ${Object.keys(customCat).length} custom = ${Object.keys(allPrompts[category]).length} total`);
        });
        
        // Toplam prompt sayısını hesapla
        const totalPrompts = Object.values(allPrompts).reduce(
          (sum, cat) => sum + Object.keys(cat).length, 0
        );
        
        const exportData = {
          version: '2.0',
          exportDate: new Date().toISOString(),
          exportType: 'all',
          prompts: allPrompts,  // Tüm promptlar (default + custom)
          activePrompts: state.activePrompts,
          metadata: {
            totalPrompts: totalPrompts,
            customPrompts: Object.values(state.customPrompts).reduce(
              (sum, cat) => sum + Object.keys(cat).length, 0
            ),
            defaultPrompts: Object.values(state.defaultPrompts).reduce(
              (sum, cat) => sum + Object.keys(cat).length, 0
            ),
            categories: categories
          }
        };
        
        // Create downloadable JSON
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        // Generate filename
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `MGXReader_AllPrompts_${timestamp}.json`;
        
        // Trigger download
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        
        // Cleanup
        URL.revokeObjectURL(url);
        
        console.log(`✅ ${totalPrompts} prompt exported: ${filename}`);
        console.log('📊 Export içeriği örneği:');
        Object.entries(allPrompts).forEach(([cat, prompts]) => {
          const promptArray = Object.entries(prompts).slice(0, 2);
          promptArray.forEach(([key, prompt]) => {
            console.log(`  ${cat}/${key}: usedBy = [${prompt.usedBy?.join(', ') || 'yok'}]`);
          });
        });
        return exportData;
      },

      // 📥 Import prompts from JSON file
      importPrompts: (jsonData, options = { merge: true, overwrite: false }) => {
        try {
          const state = get();
          let importedCount = 0;
          
          console.log('🔍 Import Debug:', {
            version: jsonData.version,
            hasPrompts: !!jsonData.prompts,
            options,
            categories: jsonData.prompts ? Object.keys(jsonData.prompts) : [],
            promptKeys: jsonData.prompts?.analysis ? Object.keys(jsonData.prompts.analysis) : []
          });
          
          // Yeni format (v2.0+, v3.0, vb.) - prompts objesi
          // Version string'i "2.0", "3.0_Pro_Separated" gibi farklı olabilir
          if (jsonData.prompts && jsonData.version) {
            let mergedCustomPrompts;
            
            // Replace mode: Tüm custom promptları sil, sadece import edilenleri al
            if (options.overwrite) {
              console.log('🔄 Replace mode aktif - tüm custom promptlar silinecek');
              mergedCustomPrompts = createEmptyCustomPrompts();
              
              // Import edilen her prompt custom olarak kaydedilecek
              Object.entries(jsonData.prompts).forEach(([category, prompts]) => {
                if (!mergedCustomPrompts[category]) {
                  mergedCustomPrompts[category] = {};
                }
                
                Object.entries(prompts).forEach(([key, prompt]) => {
                  // Ensure imported prompt has ID and preserve usedBy
                  const promptWithID = ensurePromptID(
                    { ...prompt }, 
                    `${category}_${key}`
                  );
                  mergedCustomPrompts[category][key] = promptWithID;
                  importedCount++;
                  console.log(`✓ Imported with ID: ${promptWithID.id} (${category}/${key}), usedBy: [${promptWithID.usedBy?.join(', ') || 'yok'}]`);
                });
              });
            } else {
              // Merge mode: Mevcut custom promptları koru, yeni olanları ekle
              console.log('🔀 Merge mode aktif - sadece yeni/değişmiş promptlar eklenecek');
              mergedCustomPrompts = { ...state.customPrompts };
              
              Object.entries(jsonData.prompts).forEach(([category, prompts]) => {
                if (!mergedCustomPrompts[category]) {
                  mergedCustomPrompts[category] = {};
                }
                
                Object.entries(prompts).forEach(([key, prompt]) => {
                  const existsInCustom = !!mergedCustomPrompts[category]?.[key];
                  const isDefaultPrompt = !!state.defaultPrompts[category]?.[key];
                  
                  // Eğer custom'da zaten varsa, atla (mevcut ayarları koru)
                  if (existsInCustom) {
                    console.log(`⊘ Skipped (already in custom): ${category}/${key}`);
                    return;
                  }
                  
                  // Custom'da yoksa kontrol et:
                  if (isDefaultPrompt) {
                    // Default prompt var - değişmiş mi kontrol et
                    const defaultPrompt = state.defaultPrompts[category][key];
                    const isDifferent = JSON.stringify(defaultPrompt) !== JSON.stringify(prompt);
                    
                    if (isDifferent) {
                      // Default'tan farklı - import et (ID'si ile)
                      const promptWithID = ensurePromptID(
                        { ...prompt }, 
                        `${category}_${key}`
                      );
                      mergedCustomPrompts[category][key] = promptWithID;
                      importedCount++;
                      console.log(`✓ Modified default with ID ${promptWithID.id}: ${category}/${key}`);
                    } else {
                      // Default ile aynı - import etme (default kullanılacak)
                      console.log(`⊘ Skipped (same as default): ${category}/${key}`);
                    }
                  } else {
                    // Tamamen yeni custom prompt - import et (ID'si ile, usedBy korunur)
                    const promptWithID = ensurePromptID(
                      { ...prompt }, 
                      `${category}_${key}`
                    );
                    mergedCustomPrompts[category][key] = promptWithID;
                    importedCount++;
                    console.log(`✓ New custom prompt with ID ${promptWithID.id}: ${category}/${key}, usedBy: [${promptWithID.usedBy?.join(', ') || 'yok'}]`);
                  }
                });
              });
            }
            
            set({
              customPrompts: mergedCustomPrompts,
              activePrompts: options.overwrite 
                ? (jsonData.activePrompts || getDefaultActivePrompts())
                : { ...state.activePrompts, ...(jsonData.activePrompts || {}) }
            });
            
            // localStorage'a yazılmasını garantile
            const newState = get();
            console.log('💾 State güncellendi:', {
              customPromptsKeys: Object.keys(newState.customPrompts),
              activePromptsKeys: Object.keys(newState.activePrompts)
            });
            
            console.log(`✅ ${importedCount} prompts imported successfully (version: ${jsonData.version})`);
            return { success: true, imported: importedCount };
          }
          
          // Eski format (v1.0) - customPrompts objesi (backward compatibility)
          if (jsonData.customPrompts) {
            console.log('📜 Legacy v1.0 format detected');
            
            let mergedCustomPrompts;
            
            if (options.overwrite) {
              // Replace mode
              mergedCustomPrompts = createEmptyCustomPrompts();
              Object.entries(jsonData.customPrompts).forEach(([category, prompts]) => {
                if (!mergedCustomPrompts[category]) {
                  mergedCustomPrompts[category] = {};
                }
                Object.entries(prompts).forEach(([key, prompt]) => {
                  const promptWithID = ensurePromptID({ ...prompt }, `${category}_${key}`);
                  mergedCustomPrompts[category][key] = promptWithID;
                  importedCount++;
                });
              });
            } else {
              // Merge mode
              mergedCustomPrompts = { ...state.customPrompts };
              Object.entries(jsonData.customPrompts).forEach(([category, prompts]) => {
                if (!mergedCustomPrompts[category]) {
                  mergedCustomPrompts[category] = {};
                }
                Object.entries(prompts).forEach(([key, prompt]) => {
                  if (!mergedCustomPrompts[category][key]) {
                    const promptWithID = ensurePromptID({ ...prompt }, `${category}_${key}`);
                    mergedCustomPrompts[category][key] = promptWithID;
                    importedCount++;
                  }
                });
              });
            }
            
            set({
              customPrompts: mergedCustomPrompts,
              activePrompts: options.overwrite 
                ? (jsonData.activePrompts || getDefaultActivePrompts())
                : { ...state.activePrompts, ...(jsonData.activePrompts || {}) }
            });
            
            // localStorage'a yazılmasını garantile
            const newState = get();
            console.log('💾 State güncellendi (legacy):', {
              customPromptsKeys: Object.keys(newState.customPrompts),
              activePromptsKeys: Object.keys(newState.activePrompts)
            });
            
            console.log(`✅ ${importedCount} prompts imported (legacy v1.0 format)`);
            return { success: true, imported: importedCount };
          }
          
          // Geçersiz format
          const errorMsg = `Invalid prompt file format.\n\nExpected:\n- Modern format: 'prompts' object with 'version' field (any version)\n- Legacy format: 'customPrompts' object\n\nReceived:\n- Keys: ${JSON.stringify(Object.keys(jsonData))}\n- Version: ${jsonData.version || 'N/A'}\n- Has prompts: ${!!jsonData.prompts}\n- Has customPrompts: ${!!jsonData.customPrompts}`;
          console.error('❌', errorMsg);
          throw new Error(errorMsg);
        } catch (error) {
          console.error('❌ Import failed:', error);
          console.error('📋 JSON Data preview:', JSON.stringify(jsonData, null, 2).slice(0, 800));
          return { success: false, error: error.message };
        }
      },

      // 📋 Export specific category
      exportCategory: (category) => {
        const state = get();
        
        // Default + custom promptları birleştir
        const categoryPrompts = {
          ...state.defaultPrompts[category],
          ...state.customPrompts[category]
        };
        
        const exportData = {
          version: '2.0',
          category,
          exportDate: new Date().toISOString(),
          exportType: 'category',
          prompts: { [category]: categoryPrompts },
          activePrompt: state.activePrompts[category],
          metadata: {
            totalPrompts: Object.keys(categoryPrompts).length,
            customPrompts: Object.keys(state.customPrompts[category] || {}).length,
            defaultPrompts: Object.keys(state.defaultPrompts[category] || {}).length
          }
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `MGXReader_${category}_${timestamp}.json`;
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        
        URL.revokeObjectURL(url);
        
        console.log(`✅ ${Object.keys(categoryPrompts).length} prompts exported: ${filename}`);
        return exportData;
      }
    }),
    {
      name: 'mgx-prompt-store',
      version: 2,
      partialize: (state) => ({
        customPrompts: state.customPrompts,
        activePrompts: state.activePrompts
      }),
      migrate: (persistedState, version) => {
        if (!persistedState) {
          return {
            customPrompts: createEmptyCustomPrompts(),
            activePrompts: getDefaultActivePrompts()
          };
        }

        return {
          customPrompts: {
            analysis: persistedState.customPrompts?.analysis || {},
            grammar: persistedState.customPrompts?.grammar || {},
            speed_reading: persistedState.customPrompts?.speed_reading || {},
            storyboard_styles: persistedState.customPrompts?.storyboard_styles || persistedState.customPrompts?.storyboard || {}
          },
          activePrompts: persistedState.activePrompts || getDefaultActivePrompts()
        };
      }
    }
  )
);

export default usePromptStore;