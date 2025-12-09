/**
 * TEK SEFERLİK ANALİZ TEMİZLEME - LocalStorage + FileSystem
 * Hem localStorage hem de dosya sistemindeki tüm analizleri siler
 */

console.log('🧹 KAPSAMLI ANALİZ TEMİZLEME BAŞLIYOR...\n');
console.log('⚠️  Bu script şunları temizleyecek:');
console.log('   1. Tüm localStorage analiz kayıtları');
console.log('   2. Tüm temp dizinindeki analiz dosyaları');
console.log('   3. Tüm storyboard kayıtları');
console.log('\n🚨 UYGULAMAYI KAPATIP BU SCRIPT\'İ ELECTRON İÇİNDE ÇALIŞTIRIN\n');

// Bu kodu Electron console'da çalıştırın:
const cleanupCode = `
(async function() {
  console.log('🧹 Temizlik başlıyor...');
  
  // 1. LocalStorage temizliği
  let localStorageCount = 0;
  const keysToRemove = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('mgx_analysis_') || key.startsWith('mgx_storyboard_'))) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    console.log('🗑️  LocalStorage silindi:', key);
    localStorageCount++;
  });
  
  console.log(\`✅ LocalStorage: \${localStorageCount} kayıt silindi\`);
  
  // 2. Dosya sistemi temizliği (Electron varsa)
  if (window.electronAPI && window.electronAPI.getTempDir) {
    try {
      const tempDir = await window.electronAPI.getTempDir();
      const analysisDir = tempDir + '/MGXReader/analysis';
      
      console.log('📁 Analiz dizini kontrol ediliyor:', analysisDir);
      
      if (await window.electronAPI.directoryExists(analysisDir)) {
        const files = await window.electronAPI.listDirectory(analysisDir);
        console.log(\`📊 Toplam \${files.length} dosya bulundu\`);
        
        let fileDeleteCount = 0;
        for (const file of files) {
          try {
            const filePath = analysisDir + '/' + file;
            await window.electronAPI.deleteFile(filePath);
            console.log('🗑️  Dosya silindi:', file);
            fileDeleteCount++;
          } catch (err) {
            console.error('❌ Silinemedi:', file, err);
          }
        }
        
        console.log(\`✅ Dosya sistemi: \${fileDeleteCount} dosya silindi\`);
      } else {
        console.log('ℹ️  Analiz dizini bulunamadı');
      }
    } catch (error) {
      console.error('❌ Dosya sistemi temizliği hatası:', error);
    }
  } else {
    console.log('⚠️  Electron API bulunamadı, sadece localStorage temizlendi');
  }
  
  console.log('\\n✨ TEMİZLİK TAMAMLANDI!');
  console.log('   📊 LocalStorage: ' + localStorageCount + ' kayıt');
  console.log('   🔄 Uygulamayı yenileyin: location.reload()');
})();
`;

console.log('📋 KULLANIM TALİMATLARI:');
console.log('='.repeat(60));
console.log('1. Uygulamayı açın (npm start)');
console.log('2. Chrome DevTools açın (F12 veya Ctrl+Shift+I)');
console.log('3. Console sekmesine gidin');
console.log('4. Aşağıdaki kodu kopyalayıp yapıştırın ve Enter\'a basın:\n');
console.log('='.repeat(60));
console.log(cleanupCode);
console.log('='.repeat(60));
console.log('\n✨ İşlem tamamlandıktan sonra location.reload() yapın\n');
