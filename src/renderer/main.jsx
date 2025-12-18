import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/fonts.css';
import './i18n';
import * as titleExtractor from './utils/titleExtractor';
import { analysisStorageService } from './utils/analysisStorageService';

// titleExtractor'u global olarak erişilebilir yap
window.titleExtractor = titleExtractor;

// 🔄 MIGRATION: Run on startup (only once)
const MIGRATION_KEY = 'mgx_migration_v1.2_completed';
if (!localStorage.getItem(MIGRATION_KEY)) {
  console.log('🔄 İlk yükleme - eski analiz sistemi yeni sisteme migrate ediliyor...');
  analysisStorageService.migrateOldAnalyses()
    .then((result) => {
      console.log('✅ Migration tamamlandı:', result);
      localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
    })
    .catch((error) => {
      console.error('❌ Migration hatası:', error);
    });
} else {
  console.log('✓ Migration daha önce tamamlanmış:', localStorage.getItem(MIGRATION_KEY));
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
