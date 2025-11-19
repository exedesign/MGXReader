import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const defaultPrompts = {
  // Analiz kategorileri için varsayılan prompts
  analysis: {
    character: {
      name: 'Karakter Analizi',
      system: `Bir senaryo analiz uzmanısın. Karakterleri derinlemesine analiz et.
Şunlara odaklan:
- Karakter gelişimi ve motivasyonları
- Diyalog tarzları ve konuşma kalıpları
- Karakterler arası ilişkiler ve dinamikler
- Karakter tutarlılığı ve gerçekçiliği`,
      user: `Lütfen metindeki karakterleri analiz et ve şu başlıklar altında raporla:

1. Ana Karakterler:
   - İsim ve temel özellikler
   - Motivasyonlar ve hedefler
   - Karakter gelişimi

2. Yan Karakterler:
   - Rolleri ve önemleri
   - Ana karakterlerle ilişkileri

3. Diyalog Analizi:
   - Her karakterin konuşma tarzı
   - Diyalog tutarlılığı

4. Öneriler:
   - Geliştirilmesi gereken alanlar
   - Güçlü yönler`
    },
    llama_character: {
      name: '🦙 Llama 3.1 - Karakter Analizi',
      system: 'Sen Türkçe senaryo uzmanısın. Karakterleri analiz edersin. Basit ve net Türkçe cevaplar ver.',
      user: `Bu Türkçe senaryodaki karakterleri analiz et. Cevabını Türkçe yaz:

• Ana karakter kimdir? Ne istiyor?
• Diğer önemli karakterler kimler?
• Karakterlerin kişilikleri nasıl?
• Hangi karakterler değişiyor hikayede?
• Diyaloglar karaktere uygun mu?

Net ve açık Türkçe cevaplar ver. Örnekler kullan.`,
      optimizedFor: 'llama'
    },
    plot: {
      name: 'Olay Örgüsü Analizi',
      system: `Senaryo yapısı ve olay örgüsü uzmanısın. Hikaye akışını analiz et.
Şunlara odaklan:
- Üç perde yapısı (kurulum, gelişme, çözüm)
- Gerilim noktaları ve dönüm noktaları
- Ritim ve tempo
- Sahne geçişleri ve süreklilik`,
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
      name: '🦙 Llama 3.1 - Hikaye Yapısı',
      system: 'Sen hikaye yapısı uzmanısın. Basit ve net analiz yaparısın.',
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
      name: 'Tema ve Mesaj Analizi',
      system: `Edebiyat ve sinema analiz uzmanısın. Temaları ve alt metinleri keşfet.
Şunlara odaklan:
- Ana tema ve alt temalar
- Sembolik öğeler ve metaforlar
- Kültürel ve sosyal referanslar
- Mesaj iletimi ve etkinliği`,
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
    llama_theme: {
      name: '🦙 Llama 3.1 - Tema Analizi',
      system: 'Sen tema uzmanısın. Hikayelerin ana mesajlarını bulursun.',
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
      name: '🦙 Llama 3.1 - Senaryo Yapısı',
      system: 'Sen senaryo yapısı uzmanısın. Basit analiz yaparısın.',
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
      name: '🦙 Llama 3.1 - Diyalog Analizi',
      system: 'Sen diyalog uzmanısın. Konuşmaları analiz edersin.',
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
      system: 'Sen sahne uzmanısın. Sahneleri tek tek incelersin.',
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
      system: 'Sen film endüstrisi uzmanısın. Ticari potansiyeli değerlendirirsin.',
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
      system: 'Sen senaryo format uzmanısın. Teknik detayları kontrol edersin.',
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
      name: '🦙 Llama 3.1 - Hızlı İnceleme',
      system: 'Sen hızlı okuma uzmanısın. 2 dakikada özet çıkarırsın.',
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
    }
  },

  // Grammar düzeltme seviyeleri
  grammar: {
    basic: {
      name: 'Temel Düzeltme',
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
      system: `Metin özetleme uzmanısın. Hızlı okuma için etkili özetler çıkar.`,
      user: `Bu metni hızlı okuma için özetle. Ana noktaları ve kilit bilgileri vurgula:`
    },
    keywords: {
      name: 'Anahtar Kelimeler',
      system: `Metin analiz uzmanısın. Anahtar kelimeleri ve kavramları belirle.`,
      user: `Bu metinden anahtar kelimeleri ve önemli kavramları çıkar:`
    },
    llama_quick_read: {
      name: '🦙 Llama 3.1 - Hızlı Okuma',
      system: 'Sen hızlı okuma uzmanısın. Basit özetler yaparsın.',
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
      system: 'Metni madde işaretli özet formatında düzenleyen uzmanısın.',
      user: `Bu metni madde işaretli özet formatında yeniden yaz. Ana konuları ve alt konuları hiyerarşik şekilde düzenle:`
    }
  }
};

export const usePromptStore = create(
  persist(
    (set, get) => ({
      // Custom prompts kullanıcı tarafından eklenen/düzenlenen
      customPrompts: {
        analysis: {},
        grammar: {},
        speed_reading: {}
      },
      
      // Default prompts - sabit şablonlar
      defaultPrompts,
      
      // Active prompt - şu an kullanılan
      activePrompts: {
        analysis: 'llama_quick_review',
        grammar: 'intermediate',
        speed_reading: 'summary'
      },

      // Prompt getirme fonksiyonları
      getPrompt: (category, type) => {
        const custom = get().customPrompts[category]?.[type];
        if (custom) return custom;
        
        return get().defaultPrompts[category]?.[type];
      },

      getActivePrompt: (category) => {
        const activeType = get().activePrompts[category];
        return get().getPrompt(category, activeType);
      },

      // Prompt kaydetme
      saveCustomPrompt: (category, type, prompt) => {
        set((state) => ({
          customPrompts: {
            ...state.customPrompts,
            [category]: {
              ...state.customPrompts[category],
              [type]: prompt
            }
          }
        }));
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
          name: all[key].name,
          isCustom: !get().defaultPrompts[category]?.[key]
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
      }
    }),
    {
      name: 'mgx-prompt-store',
      version: 1
    }
  )
);

export default usePromptStore;