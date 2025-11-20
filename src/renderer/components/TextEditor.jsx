import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useScriptStore } from '../store/scriptStore';
import { useReaderStore } from '../store/readerStore';
import { cleanScreenplayText } from '../utils/textProcessing';

export default function TextEditor() {
  const { t } = useTranslation();
  const { scriptText, cleanedText, setCleanedText } = useScriptStore();
  const { wordFilter, wordFilterEnabled, setWordFilterEnabled, setWordFilter, blacklist, addToBlacklist } = useReaderStore();
  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState('cleaned'); // 'raw' or 'cleaned'
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, selectedText: '' });

  const baseDisplayText = viewMode === 'raw' ? scriptText : cleanedText;

  // Apply blacklist filter automatically if blacklist exists
  const finalDisplayText = useMemo(() => {
    if (!blacklist?.length || !baseDisplayText) {
      return baseDisplayText;
    }

    let filteredText = baseDisplayText;
    blacklist.forEach(word => {
      const trimmedWord = word?.trim();
      if (trimmedWord && trimmedWord.length > 0) {
        // Escape special regex characters and create regex for word boundaries
        const escapedWord = trimmedWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
        filteredText = filteredText.replace(regex, '');
      }
    });

    // Clean up extra whitespace and multiple spaces
    return filteredText.replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
  }, [baseDisplayText, blacklist]);

  // Context menu handlers
  const handleContextMenu = (e) => {
    e.preventDefault();
    
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText) {
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        selectedText
      });
    }
  };

  const handleAddToFilter = () => {
    if (contextMenu.selectedText && !blacklist.includes(contextMenu.selectedText.toUpperCase())) {
      addToBlacklist(contextMenu.selectedText);
      // Visual feedback
      console.log(`"${contextMenu.selectedText}" kelimesi blacklist'e eklendi`);
    }
    setContextMenu({ visible: false, x: 0, y: 0, selectedText: '' });
  };

  const handleCloseContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, selectedText: '' });
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClick = () => handleCloseContextMenu();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleClean = () => {
    const cleaned = cleanScreenplayText(scriptText);
    setCleanedText(cleaned);
    setViewMode('cleaned');
  };

  const handleTextChange = (e) => {
    if (viewMode === 'cleaned') {
      setCleanedText(e.target.value);
    }
  };

  const handleExport = () => {
    const textToExport = finalDisplayText;
    const element = document.createElement('a');
    const file = new Blob([textToExport], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `script_${viewMode}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (!scriptText && !cleanedText) {
    return (
      <div className="flex-1 flex items-center justify-center bg-cinema-black">
        <div className="text-center text-cinema-text-dim">
          <div className="text-lg mb-2">{t('editor.noScript')}</div>
          <div>{t('editor.uploadPrompt')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-cinema-black">
      {/* Toolbar */}
      <div className="bg-cinema-dark border-b border-cinema-gray p-4">
        <div className="flex items-center justify-between">
          {/* Left side - View mode */}
          <div className="flex items-center gap-3">
            <div className="flex gap-2 bg-cinema-gray rounded-lg p-1">
              <button
                onClick={() => setViewMode('cleaned')}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${viewMode === 'cleaned'
                    ? 'bg-cinema-accent text-cinema-black font-medium'
                    : 'text-cinema-text hover:bg-cinema-gray-light'
                  }`}
              >
                {t('editor.cleaned')}
              </button>
              <button
                onClick={() => setViewMode('raw')}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${viewMode === 'raw'
                    ? 'bg-cinema-accent text-cinema-black font-medium'
                    : 'text-cinema-text hover:bg-cinema-gray-light'
                  }`}
              >
                {t('editor.original')}
              </button>
            </div>

            {/* Filter Status Indicator */}
            {blacklist?.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-sm">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                {blacklist.length} kelime filtrelendi
              </div>
            )}

            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${isEditing
                  ? 'bg-cinema-accent text-cinema-black'
                  : 'bg-cinema-gray text-cinema-text hover:bg-cinema-gray-light'
                }`}
            >
              {isEditing ? '✓ ' + t('editor.doneEditing') : '✏️ ' + t('editor.edit')}
            </button>
            
            {/* Kelime Filtreleme Ayarları */}
            <button
              onClick={() => {
                // UnifiedSettings modal'ını aç ve Filter tabına git
                const settingsEvent = new CustomEvent('openUnifiedSettings', {
                  detail: { activeTab: 'filter' }
                });
                window.dispatchEvent(settingsEvent);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
              title="Kelime filtreleme ayarlarını düzenle"
            >
              ⚙️ Kelime Filtresi
            </button>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-3">
            {viewMode === 'raw' && (
              <button onClick={handleClean} className="btn-secondary text-sm">
                🧹 {t('editor.cleanText')}
              </button>
            )}

            <button onClick={handleExport} className="btn-primary text-sm">
              💾 {t('editor.export')}
            </button>
          </div>
        </div>
      </div>

      {/* Text Display/Editor */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-4xl mx-auto">
          {isEditing ? (
            <textarea
              value={finalDisplayText}
              onChange={handleTextChange}
              onContextMenu={handleContextMenu}
              className="w-full h-full min-h-[600px] p-6 bg-cinema-dark border border-cinema-gray rounded-lg text-cinema-text screenplay-text resize-none focus:outline-none focus:border-cinema-accent"
              spellCheck="false"
            />
          ) : (
            <div 
              className="bg-cinema-dark border border-cinema-gray rounded-lg p-6"
              onContextMenu={handleContextMenu}
            >
              <pre className="screenplay-text text-cinema-text whitespace-pre-wrap">
                {finalDisplayText}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Footer Stats */}
      <div className="bg-cinema-dark border-t border-cinema-gray p-3 px-6">
        <div className="flex items-center justify-between text-xs text-cinema-text-dim">
          <div className="flex gap-6">
            <span>{t('editor.characters')}: {finalDisplayText?.length.toLocaleString()}</span>
            <span>{t('editor.words')}: {finalDisplayText?.split(/\s+/).filter(w => w.length > 0).length.toLocaleString()}</span>
            <span>{t('editor.lines')}: {finalDisplayText?.split('\n').length.toLocaleString()}</span>
          </div>
          <div>
            {viewMode === 'cleaned' ? t('editor.viewingCleaned') : t('editor.viewingOriginal')}
          </div>
        </div>
      </div>
      
      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="fixed bg-cinema-gray border border-cinema-gray-light rounded-lg shadow-lg py-2 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleAddToFilter}
            className="w-full px-4 py-2 text-left text-cinema-text hover:bg-cinema-gray-light transition-colors flex items-center gap-2 text-sm"
          >
            🔍 "{contextMenu.selectedText}" filtreye ekle
          </button>
        </div>
      )}
    </div>
  );
}