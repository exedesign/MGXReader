import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useScriptStore } from '../store/scriptStore';
import { useAIStore } from '../store/aiStore';
import { usePromptStore } from '../store/promptStore';
import { cleanScreenplayText } from '../utils/textProcessing';

export default function TextEditor() {
  const { t } = useTranslation();
  const { scriptText, cleanedText, setCleanedText } = useScriptStore();
  const { isConfigured, provider, getAIHandler } = useAIStore();
  const { getActivePrompt, getPromptTypes, setActivePrompt, activePrompts } = usePromptStore();
  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState('cleaned'); // 'raw' or 'cleaned'
  const [isCorrectingGrammar, setIsCorrectingGrammar] = useState(false);
  const [grammarProgress, setGrammarProgress] = useState(null);
  const [showGrammarSettings, setShowGrammarSettings] = useState(false);
  const grammarSettingsRef = useRef(null);

  const displayText = viewMode === 'raw' ? scriptText : cleanedText;

  // Close grammar settings when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (grammarSettingsRef.current && !grammarSettingsRef.current.contains(event.target)) {
        setShowGrammarSettings(false);
      }
    };

    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        setShowGrammarSettings(false);
      }
    };

    if (showGrammarSettings) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showGrammarSettings]);

  const handleClean = () => {
    const cleaned = cleanScreenplayText(scriptText);
    setCleanedText(cleaned);
    setViewMode('cleaned');
  };

  const handleGrammarCorrection = async () => {
    if (!isConfigured()) {
      alert(t('editor.configureFirst'));
      return;
    }

    setIsCorrectingGrammar(true);
    setGrammarProgress(null);

    try {
      const aiHandler = getAIHandler();
      const textToCorrect = cleanedText || scriptText;

      // Get active custom prompt for grammar correction
      const customPrompt = getActivePrompt('grammar');

      let correctedText;
      if (customPrompt && customPrompt.system && customPrompt.user) {
        // Use custom prompt
        correctedText = await aiHandler.analyzeWithCustomPrompt(textToCorrect, {
          systemPrompt: customPrompt.system,
          userPrompt: customPrompt.user,
          useChunking: textToCorrect.length > 3000,
          onProgress: (progress) => {
            setGrammarProgress(progress);
          },
        });
      } else {
        // Fallback to standard grammar correction
        correctedText = await aiHandler.correctGrammar(textToCorrect, {
          level: grammarLevel,
          useChunking: textToCorrect.length > 3000,
          onProgress: (progress) => {
            setGrammarProgress(progress);
          },
        });
      }

      setCleanedText(correctedText);
      setViewMode('cleaned');
      setGrammarProgress(null);
      alert(t('editor.grammarComplete'));
    } catch (error) {
      console.error('Grammar correction failed:', error);
      alert(t('editor.grammarFailed') + ' ' + error.message);
      setGrammarProgress(null);
    } finally {
      setIsCorrectingGrammar(false);
    }
  };

  const handleTextChange = (e) => {
    if (viewMode === 'cleaned') {
      setCleanedText(e.target.value);
    }
  };

  const handleExport = () => {
    const textToExport = displayText;
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

            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${isEditing
                  ? 'bg-cinema-accent text-cinema-black'
                  : 'bg-cinema-gray text-cinema-text hover:bg-cinema-gray-light'
                }`}
            >
              {isEditing ? '✓ ' + t('editor.doneEditing') : '✏️ ' + t('editor.edit')}
            </button>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-3">
            {viewMode === 'raw' && (
              <button onClick={handleClean} className="btn-secondary text-sm">
                🧹 {t('editor.cleanText')}
              </button>
            )}

            {/* Grammar Settings */}
            <div className="relative" ref={grammarSettingsRef}>
              <button
                onClick={() => setShowGrammarSettings(!showGrammarSettings)}
                className="btn-secondary text-sm flex items-center gap-2"
                disabled={isCorrectingGrammar}
              >
                ⚙️ {t('editor.grammarSettings')}
              </button>

              {showGrammarSettings && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-cinema-dark border border-cinema-gray rounded-lg shadow-lg z-10">
                  <div className="p-4">
                    <h4 className="text-sm font-medium text-cinema-text mb-3">{t('editor.grammarCorrection')}</h4>

                    {/* Custom Prompt Selector */}
                    <div className="mb-4">
                      <label className="block text-xs text-cinema-text-dim mb-2">
                        {t('editor.correctionStyle')}
                      </label>
                      <select
                        value={activePrompts.grammar}
                        onChange={(e) => setActivePrompt('grammar', e.target.value)}
                        className="w-full px-3 py-2 bg-cinema-gray border border-cinema-gray-light rounded text-sm text-cinema-text focus:outline-none focus:border-cinema-accent"
                      >
                        {getPromptTypes('grammar').map(({ key, name, isCustom }) => (
                          <option key={key} value={key}>
                            {name} {isCustom ? '(Custom)' : ''}
                          </option>
                        ))}
                      </select>
                      <div className="text-xs text-cinema-text-dim mt-1">
                        {t('editor.using')} {getActivePrompt('grammar')?.name}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleGrammarCorrection}
              disabled={isCorrectingGrammar || !displayText}
              className="btn-primary text-sm"
            >
              {isCorrectingGrammar
                ? grammarProgress?.message || t('editor.correcting')
                : '✨ ' + t('editor.fixGrammar')
              }
            </button>

            <button onClick={handleExport} className="btn-primary text-sm">
              💾 {t('editor.export')}
            </button>
          </div>
        </div>

        {/* Progress Bar for Grammar Correction */}
        {isCorrectingGrammar && grammarProgress && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm text-cinema-text-dim mb-1">
              <span>{grammarProgress.message}</span>
              {grammarProgress.currentChunk && grammarProgress.totalChunks && (
                <span>
                  {t('editor.chunk')} {grammarProgress.currentChunk} {t('editor.of')} {grammarProgress.totalChunks}
                </span>
              )}
              <span>{Math.round(grammarProgress.progress || 0)}%</span>
            </div>
            <div className="w-full bg-cinema-gray-light rounded-full h-2">
              <div
                className="bg-cinema-accent h-2 rounded-full transition-all duration-300"
                style={{ width: `${grammarProgress.progress || 0}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Text Display/Editor */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-4xl mx-auto">
          {isEditing ? (
            <textarea
              value={displayText}
              onChange={handleTextChange}
              className="w-full h-full min-h-[600px] p-6 bg-cinema-dark border border-cinema-gray rounded-lg text-cinema-text screenplay-text resize-none focus:outline-none focus:border-cinema-accent"
              spellCheck="false"
            />
          ) : (
            <div className="bg-cinema-dark border border-cinema-gray rounded-lg p-6">
              <pre className="screenplay-text text-cinema-text whitespace-pre-wrap">
                {displayText}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Footer Stats */}
      <div className="bg-cinema-dark border-t border-cinema-gray p-3 px-6">
        <div className="flex items-center justify-between text-xs text-cinema-text-dim">
          <div className="flex gap-6">
            <span>{t('editor.characters')}: {displayText?.length.toLocaleString()}</span>
            <span>{t('editor.words')}: {displayText?.split(/\s+/).length.toLocaleString()}</span>
            <span>{t('editor.lines')}: {displayText?.split('\n').length.toLocaleString()}</span>
          </div>
          <div>
            {viewMode === 'cleaned' ? t('editor.viewingCleaned') : t('editor.viewingOriginal')}
          </div>
        </div>
      </div>
    </div>
  );
}