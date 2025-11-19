import React, { useState, useEffect, useRef } from 'react';
import { useScriptStore } from '../store/scriptStore';
import { useAIStore } from '../store/aiStore';
import { cleanScreenplayText } from '../utils/textProcessing';
import { GRAMMAR_LEVELS } from '../utils/aiHandler';

export default function TextEditor() {
  const { scriptText, cleanedText, setCleanedText } = useScriptStore();
  const { isConfigured, provider, getAIHandler } = useAIStore();
  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState('cleaned'); // 'raw' or 'cleaned'
  const [isCorrectingGrammar, setIsCorrectingGrammar] = useState(false);
  const [grammarLevel, setGrammarLevel] = useState(GRAMMAR_LEVELS.STANDARD);
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
      alert('Please configure your AI provider in Settings first.');
      return;
    }

    setIsCorrectingGrammar(true);
    setGrammarProgress(null);
    
    try {
      const aiHandler = getAIHandler();
      const textToCorrect = cleanedText || scriptText;
      
      const correctedText = await aiHandler.correctGrammar(textToCorrect, {
        level: grammarLevel,
        useChunking: textToCorrect.length > 3000,
        onProgress: (progress) => {
          setGrammarProgress(progress);
        },
      });
      
      setCleanedText(correctedText);
      setViewMode('cleaned');
      setGrammarProgress(null);
      alert('Grammar correction completed!');
    } catch (error) {
      console.error('Grammar correction failed:', error);
      alert(`Grammar correction failed: ${error.message}`);
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
          <div className="text-lg mb-2">No script loaded</div>
          <div>Upload a PDF script to get started</div>
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
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  viewMode === 'cleaned'
                    ? 'bg-cinema-accent text-cinema-black font-medium'
                    : 'text-cinema-text hover:bg-cinema-gray-light'
                }`}
              >
                Cleaned
              </button>
              <button
                onClick={() => setViewMode('raw')}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  viewMode === 'raw'
                    ? 'bg-cinema-accent text-cinema-black font-medium'
                    : 'text-cinema-text hover:bg-cinema-gray-light'
                }`}
              >
                Original
              </button>
            </div>

            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                isEditing
                  ? 'bg-cinema-accent text-cinema-black'
                  : 'bg-cinema-gray text-cinema-text hover:bg-cinema-gray-light'
              }`}
            >
              {isEditing ? '✓ Done Editing' : '✏️ Edit'}
            </button>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-3">
            {viewMode === 'raw' && (
              <button onClick={handleClean} className="btn-secondary text-sm">
                🧹 Clean Text
              </button>
            )}

            {/* Grammar Settings */}
            <div className="relative" ref={grammarSettingsRef}>
              <button
                onClick={() => setShowGrammarSettings(!showGrammarSettings)}
                className="btn-secondary text-sm flex items-center gap-2"
                disabled={isCorrectingGrammar}
              >
                ⚙️ Grammar Level
              </button>

              {showGrammarSettings && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-cinema-dark border border-cinema-gray rounded-lg shadow-lg z-10">
                  <div className="p-4">
                    <h4 className="text-sm font-medium text-cinema-text mb-3">Grammar Correction Level</h4>
                    
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value={GRAMMAR_LEVELS.BASIC}
                          checked={grammarLevel === GRAMMAR_LEVELS.BASIC}
                          onChange={(e) => setGrammarLevel(e.target.value)}
                          className="text-cinema-accent"
                        />
                        <div>
                          <div className="text-sm font-medium text-cinema-text">Basic</div>
                          <div className="text-xs text-cinema-text-dim">
                            Only fix obvious spelling and grammar mistakes. Best for local LLMs.
                          </div>
                        </div>
                      </label>

                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value={GRAMMAR_LEVELS.STANDARD}
                          checked={grammarLevel === GRAMMAR_LEVELS.STANDARD}
                          onChange={(e) => setGrammarLevel(e.target.value)}
                          className="text-cinema-accent"
                        />
                        <div>
                          <div className="text-sm font-medium text-cinema-text">Standard</div>
                          <div className="text-xs text-cinema-text-dim">
                            Fix grammar and improve clarity while preserving style.
                          </div>
                        </div>
                      </label>

                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value={GRAMMAR_LEVELS.ADVANCED}
                          checked={grammarLevel === GRAMMAR_LEVELS.ADVANCED}
                          onChange={(e) => setGrammarLevel(e.target.value)}
                          className="text-cinema-accent"
                        />
                        <div>
                          <div className="text-sm font-medium text-cinema-text">Advanced</div>
                          <div className="text-xs text-cinema-text-dim">
                            Comprehensive grammar and style improvements.
                          </div>
                        </div>
                      </label>

                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value={GRAMMAR_LEVELS.PRESERVE_STYLE}
                          checked={grammarLevel === GRAMMAR_LEVELS.PRESERVE_STYLE}
                          onChange={(e) => setGrammarLevel(e.target.value)}
                          className="text-cinema-accent"
                        />
                        <div>
                          <div className="text-sm font-medium text-cinema-text">Preserve Style</div>
                          <div className="text-xs text-cinema-text-dim">
                            Fix only errors while maintaining the original voice and style.
                          </div>
                        </div>
                      </label>
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
                ? grammarProgress?.message || 'Correcting...'
                : '✨ Fix Grammar'
              }
            </button>

            <button onClick={handleExport} className="btn-primary text-sm">
              💾 Export
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
                  Chunk {grammarProgress.currentChunk} of {grammarProgress.totalChunks}
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
            <span>Characters: {displayText?.length.toLocaleString()}</span>
            <span>Words: {displayText?.split(/\s+/).length.toLocaleString()}</span>
            <span>Lines: {displayText?.split('\n').length.toLocaleString()}</span>
          </div>
          <div>
            {viewMode === 'cleaned' ? 'Viewing cleaned text' : 'Viewing original text'}
          </div>
        </div>
      </div>
    </div>
  );
}