import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useScriptStore } from '../store/scriptStore';
import { useAIStore } from '../store/aiStore';
import AISettings from './AISettings';

export default function Header({ sidebarOpen, setSidebarOpen }) {
  const { originalFileName, currentView, setCurrentView, clearScript, analysisData } = useScriptStore();
  const { provider, isConfigured } = useAIStore();
  const { t, i18n } = useTranslation();
  const [showAISettings, setShowAISettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
      const fileName = originalFileName ?
        `${originalFileName.replace(/\.[^/.]+$/, '')}_analysis_${timestamp}.json` :
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

  const views = [
    { id: 'editor', label: t('nav.editor', 'Editor'), icon: '📝' },
    { id: 'analysis', label: t('nav.analysis', 'Analysis'), icon: '🎬' },
    { id: 'reader', label: t('nav.speedReader', 'Speed Reader'), icon: '⚡' },
  ];

  // Change language
  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  return (
    <header className="h-16 bg-cinema-dark border-b border-cinema-gray flex items-center justify-between px-4 lg:px-6 select-none flex-wrap">
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
          <div className="text-xl lg:text-2xl flex-shrink-0">🎬</div>
          <div className="min-w-0">
            <h1 className="text-lg lg:text-xl font-bold text-cinema-accent truncate">{t('header.title')}</h1>
            {originalFileName && (
              <p className="text-xs text-cinema-text-dim truncate max-w-[150px] lg:max-w-xs" title={originalFileName}>
                {originalFileName}
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
        {/* Language Selector */}
        <div className="flex bg-cinema-gray rounded-lg p-1">
          <button
            onClick={() => changeLanguage('tr')}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${i18n.language === 'tr'
                ? 'bg-cinema-accent text-cinema-black'
                : 'text-cinema-text hover:bg-cinema-gray-light'
              }`}
            title="Türkçe"
          >
            TR
          </button>
          <button
            onClick={() => changeLanguage('en')}
            className={`px-2 py-1 text-xs font-medium rounded transition-colors ${i18n.language === 'en'
                ? 'bg-cinema-accent text-cinema-black'
                : 'text-cinema-text hover:bg-cinema-gray-light'
              }`}
            title="English"
          >
            EN
          </button>
        </div>
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

        {/* AI Settings Button */}
        <button
          onClick={() => setShowAISettings(true)}
          className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${isConfigured()
              ? 'bg-cinema-gray hover:bg-cinema-gray-light text-cinema-text'
              : 'bg-yellow-900/30 hover:bg-yellow-900/50 text-yellow-400'
            }`}
          title={t('header.aiProviderSettings')}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
          <span className="text-xs font-medium hidden lg:inline">
            {provider === 'openai' && 'OpenAI'}
            {provider === 'gemini' && 'Gemini'}
            {provider === 'local' && 'Local AI'}
          </span>
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
      {showAISettings && <AISettings onClose={() => setShowAISettings(false)} />}
    </header>
  );
}
