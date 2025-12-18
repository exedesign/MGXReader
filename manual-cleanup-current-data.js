/**
 * MANUAL CLEANUP SCRIPT - Mevcut Analiz Verilerini Temizleme
 * 
 * Kullanım: 
 * 1. Programı açın
 * 2. F12 ile Developer Tools'u açın
 * 3. Console sekmesine gidin
 * 4. Bu dosyanın içeriğini kopyalayıp console'a yapıştırın
 * 5. Enter'a basın
 * 6. Sayfayı yenileyin (F5 veya Ctrl+R)
 */

(async function manualCleanup() {
  console.log('🧹🧹🧹 MANUEL TEMİZLİK BAŞLIYOR 🧹🧹🧹');
  console.log('═'.repeat(50));
  
  let totalCleaned = 0;
  
  // 1. LocalStorage'daki TÜM analiz verilerini temizle
  console.log('\n📦 1. LocalStorage Temizleniyor...');
  const keysToRemove = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.startsWith('mgx_analysis_') || 
      key.startsWith('mgx_storyboard_') ||
      key.startsWith('analysis_checkpoint_') ||
      key.startsWith('temp_') ||
      key.includes('analysis') ||
      key.includes('storyboard')
    )) {
      keysToRemove.push(key);
    }
  }
  
  console.log(`   Temizlenecek key sayısı: ${keysToRemove.length}`);
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    console.log(`   ❌ Silindi: ${key}`);
    totalCleaned++;
  });
  
  // 2. Zustand Script Store'u temizle
  console.log('\n🗄️ 2. Zustand Script Store Temizleniyor...');
  const scriptStoreKey = 'mgx-script-store';
  const scriptStore = localStorage.getItem(scriptStoreKey);
  
  if (scriptStore) {
    try {
      const storeData = JSON.parse(scriptStore);
      console.log('   Mevcut store durumu:', {
        scriptCount: storeData.state?.scripts?.length || 0,
        hasAnalysisData: !!storeData.state?.analysisData,
        customResultsCount: storeData.state?.analysisData?.customResults ? 
          Object.keys(storeData.state.analysisData.customResults).length : 0
      });
      
      // Analiz verilerini temizle ama scripts array'i koru
      const cleanedData = {
        ...storeData,
        state: {
          ...storeData.state,
          // Ana state'i temizle
          analysisData: null,
          scenes: [],
          characters: [],
          locations: [],
          equipment: [],
          
          // Tüm scriptlerdeki analiz verilerini temizle
          scripts: (storeData.state.scripts || []).map(script => ({
            ...script,
            analysisData: null,
            customResults: null,
            scenes: [],
            characters: [],
            locations: [],
            equipment: []
          }))
        }
      };
      
      localStorage.setItem(scriptStoreKey, JSON.stringify(cleanedData));
      console.log('   ✅ Script store temizlendi');
      console.log('   Script sayısı korundu:', cleanedData.state.scripts.length);
      totalCleaned++;
    } catch (e) {
      console.error('   ❌ Store parse hatası:', e);
    }
  } else {
    console.log('   ℹ️ Script store bulunamadı');
  }
  
  // 3. Token Usage'ı sıfırla (opsiyonel)
  console.log('\n💰 3. Token Usage Kontrol Ediliyor...');
  const tokenUsageKey = 'mgxreader_token_usage';
  const tokenUsage = localStorage.getItem(tokenUsageKey);
  if (tokenUsage) {
    console.log('   ℹ️ Token usage mevcut (korunuyor)');
    try {
      const usage = JSON.parse(tokenUsage);
      console.log('   Mevcut kullanım:', {
        totalCost: usage.totalCost,
        requestCount: usage.requestCount
      });
    } catch (e) {}
  }
  
  // 4. FileSystem temizleme talimatı
  console.log('\n📁 4. FileSystem Temizleme (Electron API)...');
  if (window.electronAPI && window.electronAPI.getTempDir) {
    try {
      const tempDir = await window.electronAPI.getTempDir();
      const analysisDir = `${tempDir}\\MGXReader\\analysis`;
      console.log('   Analiz dizini:', analysisDir);
      console.log('   ⚠️ FileSystem temizliği için programı yeniden başlatın');
      console.log('   (Başlangıç temizliği otomatik çalışacak)');
    } catch (e) {
      console.log('   ℹ️ FileSystem API erişilemiyor (browser mode)');
    }
  } else {
    console.log('   ℹ️ Electron API bulunamadı (browser mode)');
  }
  
  // 5. Component state'ini temizle (eğer varsa)
  console.log('\n⚛️ 5. React Component State Temizleniyor...');
  try {
    // Store'dan doğrudan temizleme
    if (window.useScriptStore) {
      const store = window.useScriptStore.getState();
      store.setAnalysisData(null);
      console.log('   ✅ AnalysisData sıfırlandı');
      totalCleaned++;
    }
  } catch (e) {
    console.log('   ℹ️ Component state doğrudan erişilemiyor (sayfa yenileme gerekli)');
  }
  
  // Özet
  console.log('\n' + '═'.repeat(50));
  console.log('✅ TEMİZLİK TAMAMLANDI!');
  console.log(`📊 Toplam ${totalCleaned} veri silindi/temizlendi`);
  console.log('\n🔄 Şimdi yapılması gerekenler:');
  console.log('   1. Sayfayı yenileyin (F5 veya Ctrl+R)');
  console.log('   2. Analiz sonuçları bölümünü kontrol edin');
  console.log('   3. "0 analiz seçili" ve "Henüz analiz sonucu yok" yazmalı');
  console.log('═'.repeat(50));
  
  return {
    success: true,
    keysRemoved: keysToRemove.length,
    totalCleaned
  };
})();
