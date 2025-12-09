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

// Lazy load heavy components
const SpeedReader = React.lazy(() => import('./components/SpeedReader'));


function App() {
  const { currentView, scripts, currentScriptId, isAnalyzing, analysisProgress, isStoryboardProcessing, storyboardProgress, getCurrentScript } = useScriptStore();
  const { isFullscreen } = useReaderStore();
  const { features } = useFeatureStore();
  const { getConfig, setGeminiModel } = useAIStore();
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);

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

      {/* No global progress bar */}

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
