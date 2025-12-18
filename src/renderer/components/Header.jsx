import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { useScriptStore } from '../store/scriptStore';
import { useAIStore } from '../store/aiStore';
import { useFeatureStore } from '../store/featureStore';
import ErrorBoundary from './ErrorBoundary';
import TokenUsageDisplay from './TokenUsageDisplay';
import { getSavedCurrencyPreference } from '../utils/currencyConverter';

// Lazy load UnifiedSettings to prevent circular dependencies
const UnifiedSettings = lazy(() => import('./UnifiedSettings'));

export default function Header({ sidebarOpen, setSidebarOpen }) {
  const { originalFileName, currentView, setCurrentView, clearScript, analysisData } = useScriptStore();
  const { provider, isConfigured, openaiModel, geminiModel, localModel, mlxModel } = useAIStore();
  const { t, i18n } = useTranslation();
  const [showUnifiedSettings, setShowUnifiedSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [customLogo, setCustomLogo] = useState('');
  const [sessionUsage, setSessionUsage] = useState(null);
  const [selectedCurrency, setSelectedCurrency] = useState(() => getSavedCurrencyPreference());

  // Load custom logo from localStorage
  useEffect(() => {
    const savedLogo = localStorage.getItem('customLogo');
    if (savedLogo) {
      setCustomLogo(savedLogo);
    }
  }, [showUnifiedSettings]); // Refresh when settings are closed

  // Load and update token usage
  useEffect(() => {
    const loadTokenUsage = () => {
      try {
        const saved = localStorage.getItem('mgxreader_token_usage');
        if (saved) {
          const usage = JSON.parse(saved);
          setSessionUsage(usage);
        } else {
          setSessionUsage(null);
        }
      } catch (error) {
        console.error('Failed to load token usage:', error);
        setSessionUsage(null);
      }
    };
    
    // Initial load
    loadTokenUsage();
    
    const handleTokenUpdate = () => {
      loadTokenUsage();
    };
    
    const handleStorageChange = (e) => {
      if (e.key === 'mgxreader_token_usage') {
        loadTokenUsage();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('tokenUsageUpdated', handleTokenUpdate);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tokenUsageUpdated', handleTokenUpdate);
    };
  }, []);

  // Update currency from settings
  useEffect(() => {
    const handleCurrencyChange = () => {
      setSelectedCurrency(getSavedCurrencyPreference());
    };
    
    window.addEventListener('currencyChanged', handleCurrencyChange);
    return () => window.removeEventListener('currencyChanged', handleCurrencyChange);
  }, []);

  // 🎯 Basit başlık gösterimi: Proje adını göster, bölüm bilgisi olmasın
  const getDisplayTitle = (fileName) => {
    if (!fileName) return '';

    let cleanName = fileName;

    // Windows ve Unix path ayırıcılarını işle
    if (fileName.includes('\\') || fileName.includes('/')) {
      cleanName = fileName.split('\\').pop()?.split('/').pop() || fileName;
    }

    // Uzantıyı kaldır
    cleanName = cleanName.replace(/\.[^/.]+$/, '');

    // Bölüm bilgisini kaldır (sadece proje adını göster)
    cleanName = cleanName.replace(/\s*-\s*\d+\.\s*Bölüm$/, '');
    cleanName = cleanName.replace(/[-_\s]*(?:bölüm|bolum|chapter|part|episode|ep)[-_\s]*\d+/gi, '');
    cleanName = cleanName.replace(/[-_\s]*\d+[-_\s]*(?:bölüm|bolum|chapter|part|episode|ep)/gi, '');
    cleanName = cleanName.replace(/[-_\s]*\d+$/gi, '');
    cleanName = cleanName.replace(/[-_\s]+$/, '');

    return cleanName.trim() || 'Bilinmeyen Proje';
  };

  const displayTitle = getDisplayTitle(originalFileName);

  // Listen for unified settings open events
  useEffect(() => {
    const handleOpenUnifiedSettings = (event) => {
      setShowUnifiedSettings(true);
      // Eğer belirli bir tab belirtilmişse, onu UnifiedSettings'e geçirebiliriz
      if (event.detail?.activeTab) {
        // Bu bilgiyi UnifiedSettings'e props olarak geçirmek için state ekleyebiliriz
        localStorage.setItem('unifiedSettingsActiveTab', event.detail.activeTab);
      }
    };

    window.addEventListener('openUnifiedSettings', handleOpenUnifiedSettings);

    return () => {
      window.removeEventListener('openUnifiedSettings', handleOpenUnifiedSettings);
    };
  }, []);

  // Check fullscreen status
  useEffect(() => {
    const checkFullscreen = () => {
      if (window.electronAPI && window.electronAPI.isFullscreen) {
        window.electronAPI.isFullscreen().then(setIsFullscreen);
      }
    };

    checkFullscreen();

    // Listen for fullscreen changes
    const handleFullscreenChange = () => checkFullscreen();
    if (window.electronAPI && window.electronAPI.onFullscreenChange) {
      window.electronAPI.onFullscreenChange(handleFullscreenChange);
    }

    return () => {
      if (window.electronAPI && window.electronAPI.removeFullscreenListener) {
        window.electronAPI.removeFullscreenListener(handleFullscreenChange);
      }
    };
  }, []);

  // Toggle fullscreen
  const handleToggleFullscreen = async () => {
    if (window.electronAPI && window.electronAPI.toggleFullscreen) {
      const newFullscreenState = await window.electronAPI.toggleFullscreen();
      setIsFullscreen(newFullscreenState);
    }
  };



  // Download/Export analysis
  const handleDownloadAnalysis = async () => {
    if (!analysisData) {
      alert('No analysis data to export. Please run an analysis first.');
      return;
    }

    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = displayTitle ?
        `${displayTitle}_analysis_${timestamp}.json` :
        `screenplay_analysis_${timestamp}.json`;

      const filePath = await window.electronAPI.saveFile({
        defaultPath: fileName,
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (filePath) {
        await window.electronAPI.saveFileContent({
          filePath,
          data: JSON.stringify(analysisData, null, 2),
        });
        alert(t('export.success', { format: 'JSON' }));
      }
    } catch (error) {
      alert(t('export.failed', { error: error.message }));
    }
  };

  const { features } = useFeatureStore();

  const views = [
    { id: 'editor', label: t('nav.editor', 'Editör'), icon: '📝' },
    { id: 'reader', label: t('nav.speedReader', 'Hızlı Okuma'), icon: '⚡' },
    ...(features.enable_ai_analysis ? [
      { id: 'analysis', label: t('nav.analysis', 'Analiz'), icon: '🎬' }
    ] : []),
    ...(features.enable_storyboard ? [
      { id: 'storyboard', label: t('nav.storyboard', 'Storyboard'), icon: '🎨' }
    ] : []),
    ...(features.enable_canvas ? [
      { id: 'canvas', label: t('nav.canvas', 'Tuval'), icon: '🖌️' }
    ] : []),
  ];



  return (
    <header className="h-16 bg-cinema-dark border-b border-cinema-gray flex items-center justify-between px-4 lg:px-6 select-none flex-wrap relative z-[10000]">
      {/* Left section */}
      <div className="flex items-center gap-2 lg:gap-4 min-w-0">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 hover:bg-cinema-gray rounded-lg transition-colors flex-shrink-0"
          title="Toggle sidebar"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        <div className="flex items-center gap-2 lg:gap-3 min-w-0">
          {/* Custom Logo or Default Icon */}
          {customLogo ? (
            <img
              src={customLogo}
              alt="Custom Logo"
              className="w-12 h-12 lg:w-14 lg:h-14 object-contain flex-shrink-0"
            />
          ) : (
            <div className="text-3xl lg:text-4xl flex-shrink-0">🎬</div>
          )}
          <div className="min-w-0">
            <h1 className="text-lg lg:text-xl font-bold text-cinema-accent truncate">{t('header.title')}</h1>
            {displayTitle && (
              <p className="text-xs text-cinema-text-dim truncate max-w-[150px] lg:max-w-xs" title={displayTitle}>
                {displayTitle}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Center - View tabs */}
      {originalFileName && (
        <div className="hidden md:flex gap-1 lg:gap-2 bg-cinema-gray rounded-lg p-1 mx-2 lg:mx-4 flex-shrink-0">
          {views.map((view) => (
            <button
              key={view.id}
              onClick={() => setCurrentView(view.id)}
              className={`px-2 lg:px-4 py-2 rounded-md transition-all text-sm lg:text-base ${currentView === view.id
                ? 'bg-cinema-accent text-cinema-black font-medium'
                : 'text-cinema-text hover:bg-cinema-gray-light'
                }`}
            >
              <span className="mr-1 lg:mr-2">{view.icon}</span>
              <span className="hidden lg:inline">{view.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Right section */}
      <div className="flex items-center gap-1 lg:gap-2 flex-shrink-0">

        {/* Download Analysis Button */}
        {analysisData && (
          <button
            onClick={handleDownloadAnalysis}
            className="p-2 bg-cinema-gray hover:bg-green-900/30 text-cinema-text rounded-lg transition-colors"
            title={t('header.downloadAnalysis')}
          >
            <svg className="w-4 lg:w-5 h-4 lg:h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}

        {/* AI Provider Info Display - Sadece simge */}
        {isConfigured() && (
          <div className="flex items-center px-3 py-2 bg-cinema-gray/50 rounded-lg text-cinema-text" title={`AI: ${provider === 'openai' ? 'OpenAI ' + openaiModel : provider === 'gemini' ? 'Gemini ' + geminiModel : 'Local ' + (localModel || mlxModel || 'AI')}`}>
            {provider === 'openai' && (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997L9.4041 13.5V10.4976z" />
              </svg>
            )}
            {provider === 'gemini' && (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" />
              </svg>
            )}
            {provider === 'local' && (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            )}
          </div>
        )}

        {/* Settings Button */}
        <button
          onClick={() => setShowUnifiedSettings(true)}
          className={`p-2 rounded-lg transition-colors ${isConfigured()
            ? 'bg-cinema-gray hover:bg-cinema-gray-light text-cinema-text'
            : 'bg-yellow-900/30 hover:bg-yellow-900/50 text-yellow-400'
            }`}
          title={t('header.aiProviderSettings')}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
          {!isConfigured() && (
            <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
            </svg>
          )}
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={handleToggleFullscreen}
          className="p-2 bg-cinema-gray hover:bg-cinema-gray-light text-cinema-text rounded-lg transition-colors"
          title={isFullscreen ? t('header.exitFullscreen') : t('header.enterFullscreen')}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            {isFullscreen ? (
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 01-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 011.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 011.414-1.414L15 13.586V12a1 1 0 011-1z" clipRule="evenodd" />
            ) : (
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 11-2 0V4zm9 1a1 1 0 110-2h4a1 1 0 011 1v4a1 1 0 11-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 112 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 110 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 110-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z" clipRule="evenodd" />
            )}
          </svg>
        </button>

        {/* Close Script (only visible when script is loaded) */}
        {originalFileName && (
          <button
            onClick={() => {
              if (confirm(t('header.closeScriptConfirm'))) {
                clearScript();
              }
            }}
            className="p-2 hover:bg-orange-900/30 text-cinema-text rounded-lg transition-colors ml-2"
            title={t('header.closeScript')}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {/* AI Settings Modal */}
      {showUnifiedSettings && (
        <ErrorBoundary onClose={() => setShowUnifiedSettings(false)}>
          <Suspense fallback={
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-cinema-dark border border-cinema-gray rounded-lg p-6">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-cinema-accent border-t-transparent"></div>
                  <span className="text-cinema-text">Ayarlar yükleniyor...</span>
                </div>
              </div>
            </div>
          }>
            <UnifiedSettings onClose={() => setShowUnifiedSettings(false)} />
          </Suspense>
        </ErrorBoundary>
      )}
    </header>
  );
}
