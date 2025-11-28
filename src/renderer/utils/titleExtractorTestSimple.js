// Basit test dosyası - titleExtractor.js fonksiyonlarını test et

// Test örnekleri
const testFiles = [
  'gustav_maier_1_bolum.pdf',
  'the_matrix_screenplay_v2_final.pdf', 
  'interstellar_chapter_3.pdf',
  'kahve_dukkani_senaryo.pdf',
  'lost_episode_4_script.pdf'
];

const multipleFiles = [
  'Gustav_Maier_1_Bolum.pdf',
  'Gustav_Maier_2_Bolum.pdf',
  'Gustav_Maier_3_Bolum.pdf'
];

console.log("=== Basitleştirilmiş Başlık Çıkarma Test ===\n");

// Manuel test fonksiyonları (browser console'da çalıştırmak için)
window.testTitleExtraction = function() {
  if (!window.titleExtractor) {
    console.error('titleExtractor modülü yüklenmemiş');
    return;
  }
  
  console.log("Tek dosya testleri:");
  testFiles.forEach(file => {
    const result = window.titleExtractor.extractProjectInfo(file);
    console.log(`📁 ${file} →`, result);
  });
  
  console.log("\nÇoklu dosya ortak başlık testi:");
  const commonTitle = window.titleExtractor.findCommonProjectTitle(multipleFiles);
  console.log(`📚 ${multipleFiles.join(', ')} → "${commonTitle}"`);
};

console.log("Test fonksiyonu hazır. Browser console'da 'testTitleExtraction()' çalıştırın.");

export { testFiles, multipleFiles };