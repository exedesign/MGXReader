import React, { useState, useEffect, Suspense } from 'react';
import { useScriptStore } from './store/scriptStore';
import { useReaderStore } from './store/readerStore';
import { useFeatureStore } from './store/featureStore';
import { useAIStore } from './store/aiStore';
import TabbedSidebar from './components/TabbedSidebar';
import MultiScriptImporter from './components/MultiScriptImporter';
import TextEditor from './components/TextEditor';
import AnalysisPanel from './components/AnalysisPanel';
import Header from './components/Header';
import ErrorBoundary from './components/ErrorBoundary';
import ProfessionalStoryboard from './components/ProfessionalStoryboard';
import Canvas from './components/Canvas';
import TokenUsageDisplay from './components/TokenUsageDisplay';
import { getSavedCurrencyPreference } from './utils/currencyConverter';

// Lazy load heavy components
const SpeedReader = React.lazy(() => import('./components/SpeedReader'));


function App() {
  const { currentView, scripts, currentScriptId, isAnalyzing, analysisProgress, isStoryboardProcessing, storyboardProgress, getCurrentScript, originalFileName } = useScriptStore();
  const { isFullscreen } = useReaderStore();
  const { features } = useFeatureStore();
  const { getConfig, setGeminiModel } = useAIStore();
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [currency, setCurrency] = useState(getSavedCurrencyPreference());
  
  // Token usage display state
  const [tokenUsage, setTokenUsage] = useState(() => {
    const saved = localStorage.getItem('mgxreader_token_usage');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  
  // Listen for localStorage changes to update token usage
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('mgxreader_token_usage');
      if (saved) {
        try {
          setTokenUsage(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to parse token usage:', e);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('tokenUsageUpdated', handleStorageChange);
    // Also check periodically for same-window updates (every 3 seconds)
    const interval = setInterval(handleStorageChange, 3000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tokenUsageUpdated', handleStorageChange);
      clearInterval(interval);
    };
  }, []);
  
  // Listen for currency changes
  useEffect(() => {
    const handleCurrencyChange = (event) => {
      setCurrency(event.detail.currency);
    };
    
    window.addEventListener('currencyChanged', handleCurrencyChange);
    return () => window.removeEventListener('currencyChanged', handleCurrencyChange);
  }, []);
  
  // Listen for budget warnings
  useEffect(() => {
    const handleBudgetWarning = (event) => {
      const { exceeded, warnings } = event.detail;
      
      if (warnings.length > 0) {
        const warningMessages = warnings.map(w => {
          const emoji = w.exceeded ? '🚨' : '⚠️';
          const status = w.exceeded ? 'AŞILDI!' : `%${w.percent.toFixed(0)} ulaştı`;
          const typeLabel = w.type === 'daily' ? 'GÜNLÜGNLÜK' : 
                           w.type === 'weekly' ? 'HAFTALIK' : 
                           w.type === 'monthly' ? 'AYLIK' : 
                           w.type === 'balance' ? 'TOPLAM HARCAMA' : w.type.toUpperCase();
          return `${emoji} ${typeLabel} limit ${status}: $${w.current.toFixed(2)} / $${w.limit.toFixed(2)}`;
        });
        
        // Show warning toast
        const warningDiv = document.createElement('div');
        warningDiv.className = 'fixed top-20 right-4 z-50 bg-yellow-500/90 text-black px-6 py-4 rounded-lg shadow-2xl border-2 border-yellow-600 max-w-md';
        warningDiv.innerHTML = `
          <div class="flex items-start gap-3">
            <svg class="w-6 h-6 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            <div>
              <h4 class="font-bold text-lg mb-2">💰 Bütçe Uyarısı!</h4>
              <div class="space-y-1 text-sm">
                ${warningMessages.map(msg => `<div>${msg}</div>`).join('')}
              </div>
              <p class="text-xs mt-3 opacity-75">Ayarlar > Bütçe Limitleri'nden değiştirebilirsiniz</p>
            </div>
          </div>
        `;
        
        document.body.appendChild(warningDiv);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
          warningDiv.style.transition = 'opacity 0.5s';
          warningDiv.style.opacity = '0';
          setTimeout(() => warningDiv.remove(), 500);
        }, 10000);
      }
    };
    
    window.addEventListener('budgetWarning', handleBudgetWarning);
    
    return () => {
      window.removeEventListener('budgetWarning', handleBudgetWarning);
    };
  }, []);

  const currentScript = getCurrentScript();

  // Global fix for deprecated Gemini models
  useEffect(() => {
    const config = getConfig();
    const currentGeminiModel = config?.gemini?.model;

    if (currentGeminiModel === 'gemini-1.5-flash-latest' ||
      currentGeminiModel === 'gemini-1.5-flash' ||
      currentGeminiModel === 'gemini-1.5-pro') {
      console.log('🚨 Global fix: Deprecated Gemini model detected:', currentGeminiModel);
      console.log('🔄 Auto-correcting to: gemini-3-pro-preview');
      setGeminiModel('gemini-3-pro-preview');

      // Clear localStorage cache
      localStorage.removeItem('scriptmaster-ai-settings');
      localStorage.removeItem('ai-store');
    }
  }, []);

  // Cleanup orphaned analysis data on startup
  useEffect(() => {
    const cleanupOrphanedData = async () => {
      try {
        console.log('🧹 Başlangıç temizliği başlatılıyor...');
        
        // Get all scripts from store
        const existingScriptIds = new Set(scripts.map(s => s.id));
        
        // Clean localStorage keys that don't match existing scripts
        const keysToCheck = ['mgx_analysis_', 'mgx_storyboard_', 'analysis_checkpoint_', 'temp_'];
        let cleanedCount = 0;
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key) continue;
          
          // Check if this is an analysis-related key
          const isAnalysisKey = keysToCheck.some(prefix => key.startsWith(prefix));
          if (isAnalysisKey) {
            // Check if the script still exists
            const scriptStillExists = Array.from(existingScriptIds).some(scriptId => 
              key.includes(scriptId) || key.includes(scriptId.substring(0, 8))
            );
            
            // If script doesn't exist, remove the key
            if (!scriptStillExists) {
              localStorage.removeItem(key);
              cleanedCount++;
              console.log(`  ❌ Temizlendi: ${key}`);
            }
          }
        }
        
        if (cleanedCount > 0) {
          console.log(`✅ Başlangıç temizliği: ${cleanedCount} eski kayıt silindi`);
        } else {
          console.log('✅ Başlangıç temizliği: Temizlenecek eski kayıt bulunamadı');
        }
        
      } catch (error) {
        console.error('❌ Başlangıç temizliği hatası:', error);
      }
    };
    
    // Run cleanup after a short delay to ensure store is initialized
    const timer = setTimeout(cleanupOrphanedData, 1000);
    return () => clearTimeout(timer);
  }, []); // Run only once on mount

  // In fullscreen mode, hide everything except the reader
  if (isFullscreen && currentView === 'reader') {
    return (
      <div className="h-screen w-screen bg-cinema-black">
        <Suspense fallback={<div className="h-screen flex items-center justify-center text-cinema-text">Yükleniyor...</div>}>
          <SpeedReader />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-cinema-black text-cinema-text">
      {/* Header */}
      <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {/* Token Usage Bar - Outside overflow container */}
      {tokenUsage && tokenUsage.requestCount > 0 && 
       originalFileName && 
       (currentView === 'analysis' || currentView === 'storyboard' || currentView === 'canvas') && (
        <div className="py-1.5 px-4 flex justify-center">
          <TokenUsageDisplay 
            sessionUsage={tokenUsage}
            currency={currency}
            showDetailed={false}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Tabbed Navigation */}
        {sidebarOpen && (
          <TabbedSidebar />
        )}

        {/* Main Panel */}
        <div className="flex-1 overflow-hidden min-w-0">
          {/* Main Content */}
          {currentView === 'uploader' || (scripts.length === 0) ? (
            // No scripts yet or uploader view - show universal importer
            <MultiScriptImporter />
          ) : !currentScript ? (
            // Scripts exist but none selected - show universal importer  
            <MultiScriptImporter />
          ) : (
            // Script is selected - show content
            <>
              {currentView === 'editor' && <TextEditor />}
              {currentView === 'analysis' && <AnalysisPanel />}

              {/* Speed Reader - Always available */}
              {currentView === 'reader' && (
                <Suspense fallback={<div className="flex items-center justify-center h-full text-cinema-text">Hızlı okuma yükleniyor...</div>}>
                  <SpeedReader />
                </Suspense>
              )}

              {/* Storyboard - Unified professional workflow */}
              {currentView === 'storyboard' && features.enable_storyboard && (
                <ErrorBoundary>
                  <ProfessionalStoryboard />
                </ErrorBoundary>
              )}

              {/* Show message if trying to access disabled storyboard module */}
              {currentView === 'storyboard' && !features.enable_storyboard && (
                <div className="flex flex-col items-center justify-center h-full text-cinema-text p-8">
                  <span className="text-6xl mb-4">🎨</span>
                  <h3 className="text-2xl font-bold mb-2">Storyboard Modülü Kapalı</h3>
                  <p className="text-cinema-text-dim text-center mb-4">
                    Bu özelliği kullanmak için Ayarlar &gt; Modüler Özellikler bölümünden etkinleştirin.
                  </p>
                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('openUnifiedSettings', { detail: { activeTab: 'modules' } }));
                    }}
                    className="px-6 py-3 bg-cinema-accent text-cinema-black rounded-lg font-medium hover:bg-cinema-accent/90 transition-colors"
                  >
                    Ayarları Aç
                  </button>
                </div>
              )}

              {/* Canvas - AI-powered image editing */}
              {currentView === 'canvas' && features.enable_canvas && (
                <ErrorBoundary>
                  <Canvas />
                </ErrorBoundary>
              )}

              {/* Show message if trying to access disabled canvas module */}
              {currentView === 'canvas' && !features.enable_canvas && (
                <div className="flex flex-col items-center justify-center h-full text-cinema-text p-8">
                  <span className="text-6xl mb-4">🎨</span>
                  <h3 className="text-2xl font-bold mb-2">Tuval Modülü Kapalı</h3>
                  <p className="text-cinema-text-dim text-center mb-4">
                    Bu özelliği kullanmak için Ayarlar &gt; Modüler Özellikler bölümünden etkinleştirin.
                  </p>
                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('openUnifiedSettings', { detail: { activeTab: 'modules' } }));
                    }}
                    className="px-6 py-3 bg-cinema-accent text-cinema-black rounded-lg font-medium hover:bg-cinema-accent/90 transition-colors"
                  >
                    Ayarları Aç
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
