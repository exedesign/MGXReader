/**
 * 🎯 DynamicDataTable - Kullanım Örnekleri
 * 
 * Bu dosya farklı veri tipleri için örnek kullanımları gösterir
 */

import React from 'react';
import DynamicDataTable from './components/DynamicDataTable';

// ============================================
// 📊 ÖRNEK 1: SAHNE ANALİZİ
// ============================================
export const SceneAnalysisExample = () => {
  const sceneData = [
    {
      number: 1,
      title: "SAHNE 1 - KAFE İÇERİSİ",
      location: "Kafe İçerisi",
      intExt: "İÇ",
      timeOfDay: "GÜNDÜZ",
      characters: ["GUSTAV", "MARIA", "OTTO"],
      duration: "orta",
      mood: "Gergin ve gizemli atmosfer. Karakterler arası gerilim hissediliyor.",
      content: "Gustav kafede oturuyor. Maria içeri girer ve Gustav'ı fark eder. Aralarında kısa ama anlamlı bir göz teması olur."
    },
    {
      number: 2,
      title: "SAHNE 2 - PARK ALANI",
      location: "Park",
      intExt: "DIŞ",
      timeOfDay: "AKŞAM",
      characters: ["GUSTAV", "OTTO"],
      duration: "uzun",
      mood: "Sakin ve düşünceli. Arkadaşlık teması ön planda.",
      content: "Gustav ve Otto parkta yürüyorlar. Derin bir konuşma yapıyorlar."
    }
  ];

  const columnMapping = {
    'number': 'Sahne #',
    'title': 'Sahne Başlığı',
    'location': 'Mekan',
    'intExt': 'İç/Dış',
    'timeOfDay': 'Zaman',
    'characters': 'Karakterler',
    'duration': 'Süre',
    'mood': 'Atmosfer',
    'content': 'İçerik'
  };

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold text-cinema-accent">📊 Sahne Analizi</h2>
      <DynamicDataTable 
        data={sceneData}
        columnMapping={columnMapping}
        maxChipsPerCell={5}
        showRowNumbers={true}
        compactMode={false}
      />
    </div>
  );
};

// ============================================
// 👥 ÖRNEK 2: KARAKTER ANALİZİ
// ============================================
export const CharacterAnalysisExample = () => {
  const characterData = [
    {
      name: "GUSTAV",
      age: 35,
      physical: "Uzun boylu, kahverengi saç, zarif duruş",
      personality: "Gizemli, çekici, kontrollü",
      style: "Şık takım elbiseler, klasik zevk",
      role: "main",
      scenes: ["Sahne 1", "Sahne 2", "Sahne 5", "Sahne 8"]
    },
    {
      name: "MARIA",
      age: 28,
      physical: "Orta boylu, siyah saç, çekici",
      personality: "Güçlü, kararlı, gizemli geçmişe sahip",
      style: "Modern ve şık",
      role: "main",
      scenes: ["Sahne 1", "Sahne 3", "Sahne 7"]
    },
    {
      name: "OTTO",
      age: 40,
      physical: "Kısa boylu, gri saç, ciddi yüz ifadesi",
      personality: "Sadık, koruyucu, geleneksel",
      style: "Klasik, sade",
      role: "supporting",
      scenes: ["Sahne 2", "Sahne 6"]
    }
  ];

  const columnMapping = {
    'name': 'İsim',
    'age': 'Yaş',
    'physical': 'Fiziksel Özellikler',
    'personality': 'Kişilik',
    'style': 'Giyim Stili',
    'role': 'Rol',
    'scenes': 'Sahneler'
  };

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold text-cinema-accent">👥 Karakter Analizi</h2>
      <DynamicDataTable 
        data={characterData}
        columnMapping={columnMapping}
        maxChipsPerCell={4}
        showRowNumbers={true}
      />
    </div>
  );
};

// ============================================
// 📍 ÖRNEK 3: LOKASYON ANALİZİ
// ============================================
export const LocationAnalysisExample = () => {
  const locationData = [
    {
      name: "Kafe İçerisi",
      type: "INT",
      timeOfDay: "GÜNDÜZ",
      sceneCount: 3,
      atmosphere: "Sakin ve huzurlu, ahşap masalar, yumuşak ışık",
      characters: ["GUSTAV", "MARIA", "OTTO"]
    },
    {
      name: "Park Alanı",
      type: "EXT",
      timeOfDay: "AKŞAM",
      sceneCount: 2,
      atmosphere: "Doğal, huzurlu, yeşillik içinde",
      characters: ["GUSTAV", "OTTO"]
    },
    {
      name: "Meierburg Şatosu",
      type: "INT",
      timeOfDay: "GECE",
      sceneCount: 5,
      atmosphere: "Gotik, karanlık, gizemli, görkemli",
      characters: ["GUSTAV", "MARIA", "AUGUSTE"]
    }
  ];

  const columnMapping = {
    'name': 'Mekan Adı',
    'type': 'Tip',
    'timeOfDay': 'Zaman',
    'sceneCount': 'Sahne Sayısı',
    'atmosphere': 'Atmosfer',
    'characters': 'Karakterler'
  };

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold text-cinema-accent">📍 Lokasyon Analizi</h2>
      <DynamicDataTable 
        data={locationData}
        columnMapping={columnMapping}
        maxChipsPerCell={4}
        showRowNumbers={true}
      />
    </div>
  );
};

// ============================================
// 💰 ÖRNEK 4: BÜTÇE ANALİZİ
// ============================================
export const BudgetAnalysisExample = () => {
  const budgetData = [
    {
      category: "Production",
      amount: 50000,
      percentage: 60,
      items: ["Crew", "Equipment", "Location"],
      status: "approved"
    },
    {
      category: "Post-Production",
      amount: 20000,
      percentage: 24,
      items: ["Editing", "VFX", "Sound"],
      status: "approved"
    },
    {
      category: "Marketing",
      amount: 13000,
      percentage: 16,
      items: ["Social Media", "PR", "Trailer"],
      status: "pending"
    }
  ];

  const columnMapping = {
    'category': 'Kategori',
    'amount': 'Tutar ($)',
    'percentage': 'Yüzde',
    'items': 'Kalemler',
    'status': 'Durum'
  };

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold text-cinema-accent">💰 Bütçe Analizi</h2>
      <DynamicDataTable 
        data={budgetData}
        columnMapping={columnMapping}
        maxChipsPerCell={3}
        showRowNumbers={true}
        compactMode={true}
      />
    </div>
  );
};

// ============================================
// 🎬 ÖRNEK 5: ÇEKİM PLANI
// ============================================
export const ShootingScheduleExample = () => {
  const scheduleData = [
    {
      day: 1,
      date: "15 Mayıs 2024",
      location: "Kafe İçerisi",
      scenes: ["Sahne 1", "Sahne 3"],
      intExt: "İÇ",
      timeOfDay: "GÜNDÜZ",
      cast: ["GUSTAV", "MARIA"],
      crew: 12,
      equipmentReady: true
    },
    {
      day: 2,
      date: "16 Mayıs 2024",
      location: "Park Alanı",
      scenes: ["Sahne 2"],
      intExt: "DIŞ",
      timeOfDay: "AKŞAM",
      cast: ["GUSTAV", "OTTO"],
      crew: 10,
      equipmentReady: true
    },
    {
      day: 3,
      date: "17 Mayıs 2024",
      location: "Meierburg Şatosu",
      scenes: ["Sahne 5", "Sahne 6", "Sahne 7"],
      intExt: "İÇ",
      timeOfDay: "GECE",
      cast: ["GUSTAV", "MARIA", "AUGUSTE"],
      crew: 15,
      equipmentReady: false
    }
  ];

  const columnMapping = {
    'day': 'Gün',
    'date': 'Tarih',
    'location': 'Lokasyon',
    'scenes': 'Sahneler',
    'intExt': 'İç/Dış',
    'timeOfDay': 'Zaman',
    'cast': 'Oyuncular',
    'crew': 'Ekip',
    'equipmentReady': 'Ekipman Hazır'
  };

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold text-cinema-accent">🎬 Çekim Planı</h2>
      <DynamicDataTable 
        data={scheduleData}
        columnMapping={columnMapping}
        maxChipsPerCell={3}
        showRowNumbers={true}
      />
    </div>
  );
};

// ============================================
// 🎨 TÜM ÖRNEKLERİ GÖSTER
// ============================================
export const AllExamples = () => {
  return (
    <div className="space-y-8 bg-cinema-bg min-h-screen">
      <SceneAnalysisExample />
      <CharacterAnalysisExample />
      <LocationAnalysisExample />
      <BudgetAnalysisExample />
      <ShootingScheduleExample />
    </div>
  );
};

export default AllExamples;
