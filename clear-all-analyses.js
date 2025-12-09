/**
 * TEK SEFERLİK ANALİZ TEMİZLEME SCRIPT'İ
 * Tüm kaydedilmiş analiz dosyalarını siler
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

async function clearAllAnalyses() {
  console.log('🧹 Tüm analizler temizleniyor...\n');

  // Analysis directory path
  const tempDir = os.tmpdir();
  const analysisDir = path.join(tempDir, 'MGXReader', 'analysis');
  
  console.log(`📁 Analiz dizini: ${analysisDir}\n`);

  if (!fs.existsSync(analysisDir)) {
    console.log('ℹ️  Analiz dizini bulunamadı. Temizlenecek bir şey yok.');
    return;
  }

  try {
    // List all files
    const files = fs.readdirSync(analysisDir);
    console.log(`📊 Toplam ${files.length} dosya bulundu\n`);

    if (files.length === 0) {
      console.log('✅ Dizin zaten boş!');
      return;
    }

    let deletedCount = 0;
    let errorCount = 0;

    // Delete each file
    for (const file of files) {
      const filePath = path.join(analysisDir, file);
      
      try {
        const stats = fs.statSync(filePath);
        
        if (stats.isFile()) {
          fs.unlinkSync(filePath);
          console.log(`🗑️  Silindi: ${file}`);
          deletedCount++;
        } else if (stats.isDirectory()) {
          console.log(`📁 Dizin atlandı: ${file}`);
        }
      } catch (err) {
        console.error(`❌ Silinemedi: ${file} - ${err.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ İşlem tamamlandı!`);
    console.log(`   Silinen: ${deletedCount} dosya`);
    console.log(`   Hata: ${errorCount} dosya`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ Hata oluştu:', error.message);
    process.exit(1);
  }
}

// Run the script
clearAllAnalyses().then(() => {
  console.log('\n✨ Temizlik tamamlandı! Uygulama yeniden başlatılabilir.\n');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Beklenmeyen hata:', err);
  process.exit(1);
});
