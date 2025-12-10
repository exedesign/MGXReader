/**
 * KAPSAMLI TEMİZLİK SCRİPTİ
 * Tüm cache, temp dosyaları ve localStorage verilerini temizler
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🧹 KAPSAMLI TEMİZLİK BAŞLATILIYOR...\n');
console.log('='.repeat(60));

let totalCleaned = 0;
let errors = 0;

// 1. TEMP DİZİNİ TEMİZLİĞİ
console.log('\n📁 1. TEMP DİZİNİ TEMİZLENİYOR...');
const tempDir = os.tmpdir();
const mgxTempDir = path.join(tempDir, 'MGXReader');

if (fs.existsSync(mgxTempDir)) {
  try {
    const tempFiles = fs.readdirSync(mgxTempDir);
    console.log(`   Bulunan dosya sayısı: ${tempFiles.length}`);
    
    for (const file of tempFiles) {
      try {
        const filePath = path.join(mgxTempDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile()) {
          fs.unlinkSync(filePath);
          console.log(`   ✓ Silindi: ${file}`);
          totalCleaned++;
        } else if (stats.isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true });
          console.log(`   ✓ Dizin silindi: ${file}`);
          totalCleaned++;
        }
      } catch (err) {
        console.error(`   ✗ Silinemedi: ${file} - ${err.message}`);
        errors++;
      }
    }
  } catch (err) {
    console.error(`   ✗ Temp dizini okunamadı: ${err.message}`);
    errors++;
  }
} else {
  console.log('   ℹ️  Temp dizini bulunamadı');
}

// 2. PROJE İÇİ CACHE TEMİZLİĞİ
console.log('\n📁 2. PROJE İÇİ CACHE TEMİZLENİYOR...');
const projectRoot = __dirname;
const cacheDir = path.join(projectRoot, 'cache');

if (fs.existsSync(cacheDir)) {
  try {
    const cacheFiles = fs.readdirSync(cacheDir);
    console.log(`   Bulunan dosya sayısı: ${cacheFiles.length}`);
    
    for (const file of cacheFiles) {
      try {
        const filePath = path.join(cacheDir, file);
        fs.unlinkSync(filePath);
        console.log(`   ✓ Silindi: ${file}`);
        totalCleaned++;
      } catch (err) {
        console.error(`   ✗ Silinemedi: ${file} - ${err.message}`);
        errors++;
      }
    }
  } catch (err) {
    console.error(`   ✗ Cache dizini okunamadı: ${err.message}`);
    errors++;
  }
} else {
  console.log('   ℹ️  Cache dizini bulunamadı');
}

// 3. BUILD DİZİNİ TEMİZLİĞİ
console.log('\n📁 3. BUILD DİZİNİ TEMİZLENİYOR...');
const buildDir = path.join(projectRoot, 'build');

if (fs.existsSync(buildDir)) {
  try {
    fs.rmSync(buildDir, { recursive: true, force: true });
    console.log('   ✓ Build dizini tamamen silindi');
    totalCleaned++;
  } catch (err) {
    console.error(`   ✗ Build dizini silinemedi: ${err.message}`);
    errors++;
  }
} else {
  console.log('   ℹ️  Build dizini bulunamadı');
}

// 4. DIST DİZİNİ TEMİZLİĞİ
console.log('\n📁 4. DIST DİZİNİ TEMİZLENİYOR...');
const distDir = path.join(projectRoot, 'dist');

if (fs.existsSync(distDir)) {
  try {
    fs.rmSync(distDir, { recursive: true, force: true });
    console.log('   ✓ Dist dizini tamamen silindi');
    totalCleaned++;
  } catch (err) {
    console.error(`   ✗ Dist dizini silinemedi: ${err.message}`);
    errors++;
  }
} else {
  console.log('   ℹ️  Dist dizini bulunamadı');
}

// 5. NODE_MODULES CACHE TEMİZLİĞİ
console.log('\n📁 5. NODE_MODULES .CACHE TEMİZLENİYOR...');
const nodeModulesCacheDir = path.join(projectRoot, 'node_modules', '.cache');

if (fs.existsSync(nodeModulesCacheDir)) {
  try {
    fs.rmSync(nodeModulesCacheDir, { recursive: true, force: true });
    console.log('   ✓ node_modules/.cache silindi');
    totalCleaned++;
  } catch (err) {
    console.error(`   ✗ node_modules/.cache silinemedi: ${err.message}`);
    errors++;
  }
} else {
  console.log('   ℹ️  node_modules/.cache bulunamadı');
}

// 6. VITE CACHE TEMİZLİĞİ
console.log('\n📁 6. VITE CACHE TEMİZLENİYOR...');
const viteCacheDir = path.join(projectRoot, 'node_modules', '.vite');

if (fs.existsSync(viteCacheDir)) {
  try {
    fs.rmSync(viteCacheDir, { recursive: true, force: true });
    console.log('   ✓ Vite cache silindi');
    totalCleaned++;
  } catch (err) {
    console.error(`   ✗ Vite cache silinemedi: ${err.message}`);
    errors++;
  }
} else {
  console.log('   ℹ️  Vite cache bulunamadı');
}

// 7. LOCALSTORAGE TEMİZLİK TALİMATLARI
console.log('\n💾 7. LOCALSTORAGE TEMİZLİK TALİMATLARI');
console.log('   ⚠️  localStorage browser içinde çalışır, manuel temizleme gerekli:');
console.log('');
console.log('   TARAYICI KONSOLUNDA ÇALIŞTIRIN:');
console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('   // Tüm localStorage temizle');
console.log('   localStorage.clear();');
console.log('');
console.log('   // Sadece MGX anahtarları temizle');
console.log('   Object.keys(localStorage)');
console.log('     .filter(key => key.includes("mgx") || key.includes("character") || key.includes("location"))');
console.log('     .forEach(key => localStorage.removeItem(key));');
console.log('');
console.log('   // SessionStorage da temizle');
console.log('   sessionStorage.clear();');
console.log('');
console.log('   // IndexedDB temizle');
console.log('   indexedDB.deleteDatabase("ai-store");');
console.log('   indexedDB.deleteDatabase("scriptmaster-ai-settings");');
console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// 8. HTML TEMİZLİK SCRİPTİ OLUŞTUR
console.log('\n📝 8. LOCALSTORAGE TEMİZLEME HTML DOSYASI OLUŞTURULUYOR...');
const cleanupHtml = `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MGXReader - LocalStorage Temizleyici</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            max-width: 600px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 {
            color: #667eea;
            margin-bottom: 10px;
            font-size: 28px;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 14px;
        }
        .stats {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
        }
        .stat-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-size: 14px;
        }
        .stat-label {
            color: #666;
        }
        .stat-value {
            font-weight: bold;
            color: #667eea;
        }
        button {
            width: 100%;
            padding: 15px;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            margin-bottom: 10px;
        }
        .btn-danger {
            background: #dc3545;
            color: white;
        }
        .btn-danger:hover {
            background: #c82333;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(220,53,69,0.3);
        }
        .btn-warning {
            background: #ffc107;
            color: #333;
        }
        .btn-warning:hover {
            background: #e0a800;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(255,193,7,0.3);
        }
        .btn-success {
            background: #28a745;
            color: white;
        }
        .btn-success:hover {
            background: #218838;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(40,167,69,0.3);
        }
        .log {
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 20px;
            border-radius: 10px;
            max-height: 300px;
            overflow-y: auto;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            line-height: 1.6;
            margin-top: 20px;
            display: none;
        }
        .log.show {
            display: block;
        }
        .log-success {
            color: #4ec9b0;
        }
        .log-error {
            color: #f48771;
        }
        .log-info {
            color: #569cd6;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧹 MGXReader Temizleyici</h1>
        <p class="subtitle">Tüm cache ve localStorage verilerini temizleyin</p>
        
        <div class="stats">
            <div class="stat-row">
                <span class="stat-label">📦 LocalStorage Öğe Sayısı:</span>
                <span class="stat-value" id="localStorageCount">0</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">💾 SessionStorage Öğe Sayısı:</span>
                <span class="stat-value" id="sessionStorageCount">0</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">🗄️ MGX Anahtarları:</span>
                <span class="stat-value" id="mgxKeysCount">0</span>
            </div>
        </div>

        <button class="btn-danger" onclick="clearAll()">
            🗑️ Tümünü Temizle (localStorage + sessionStorage + IndexedDB)
        </button>
        
        <button class="btn-warning" onclick="clearMGXOnly()">
            🎯 Sadece MGX Verilerini Temizle
        </button>
        
        <button class="btn-success" onclick="refreshStats()">
            🔄 İstatistikleri Yenile
        </button>

        <div class="log" id="log"></div>
    </div>

    <script>
        const log = document.getElementById('log');
        
        function addLog(message, type = 'info') {
            log.classList.add('show');
            const line = document.createElement('div');
            line.className = 'log-' + type;
            line.textContent = new Date().toLocaleTimeString() + ' - ' + message;
            log.appendChild(line);
            log.scrollTop = log.scrollHeight;
        }

        function refreshStats() {
            document.getElementById('localStorageCount').textContent = localStorage.length;
            document.getElementById('sessionStorageCount').textContent = sessionStorage.length;
            
            const mgxKeys = Object.keys(localStorage).filter(key => 
                key.includes('mgx') || 
                key.includes('character') || 
                key.includes('location') ||
                key.includes('ai-store') ||
                key.includes('storyboard')
            );
            document.getElementById('mgxKeysCount').textContent = mgxKeys.length;
            
            addLog('İstatistikler güncellendi', 'info');
        }

        function clearAll() {
            if (!confirm('TÜM VERİLER SİLİNECEK! Emin misiniz?')) {
                return;
            }
            
            try {
                // LocalStorage
                const localCount = localStorage.length;
                localStorage.clear();
                addLog(\`✅ \${localCount} localStorage öğesi silindi\`, 'success');
                
                // SessionStorage
                const sessionCount = sessionStorage.length;
                sessionStorage.clear();
                addLog(\`✅ \${sessionCount} sessionStorage öğesi silindi\`, 'success');
                
                // IndexedDB
                indexedDB.deleteDatabase('ai-store');
                indexedDB.deleteDatabase('scriptmaster-ai-settings');
                addLog('✅ IndexedDB veritabanları silindi', 'success');
                
                refreshStats();
                
                setTimeout(() => {
                    alert('✅ Temizlik tamamlandı! Sayfa yenilenecek.');
                    window.location.reload();
                }, 1000);
            } catch (error) {
                addLog('❌ Hata: ' + error.message, 'error');
            }
        }

        function clearMGXOnly() {
            if (!confirm('Sadece MGX verileri silinecek. Emin misiniz?')) {
                return;
            }
            
            try {
                const mgxKeys = Object.keys(localStorage).filter(key => 
                    key.includes('mgx') || 
                    key.includes('character') || 
                    key.includes('location') ||
                    key.includes('ai-store') ||
                    key.includes('storyboard')
                );
                
                mgxKeys.forEach(key => {
                    localStorage.removeItem(key);
                    addLog(\`🗑️ Silindi: \${key}\`, 'success');
                });
                
                addLog(\`✅ \${mgxKeys.length} MGX anahtarı silindi\`, 'success');
                
                refreshStats();
            } catch (error) {
                addLog('❌ Hata: ' + error.message, 'error');
            }
        }

        // Sayfa yüklendiğinde istatistikleri göster
        refreshStats();
    </script>
</body>
</html>`;

try {
  const cleanupHtmlPath = path.join(projectRoot, 'cleanup-localstorage.html');
  fs.writeFileSync(cleanupHtmlPath, cleanupHtml, 'utf8');
  console.log(`   ✓ Dosya oluşturuldu: cleanup-localstorage.html`);
  console.log('   ℹ️  Bu dosyayı tarayıcıda açarak localStorage temizleyebilirsiniz');
} catch (err) {
  console.error(`   ✗ HTML dosyası oluşturulamadı: ${err.message}`);
  errors++;
}

// ÖZET
console.log('\n' + '='.repeat(60));
console.log('📊 TEMİZLİK ÖZETİ');
console.log('='.repeat(60));
console.log(`✅ Temizlenen öğe sayısı: ${totalCleaned}`);
console.log(`❌ Hata sayısı: ${errors}`);
console.log('');
console.log('📝 SONRAKI ADIMLAR:');
console.log('   1. cleanup-localstorage.html dosyasını tarayıcıda açın');
console.log('   2. "Tümünü Temizle" butonuna tıklayın');
console.log('   3. Uygulamayı yeniden başlatın: npm start');
console.log('');
console.log('✨ Temizlik tamamlandı!');
console.log('='.repeat(60));
