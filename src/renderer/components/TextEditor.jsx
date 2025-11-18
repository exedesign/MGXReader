import React, { useState } from 'react';
import { useScriptStore } from '../store/scriptStore';
import { useAIStore } from '../store/aiStore';
import { cleanScreenplayText } from '../utils/textProcessing';
import { correctScreenplayText } from '../utils/aiService2';

export default function TextEditor() {
  const { scriptText, cleanedText, setCleanedText } = useScriptStore();
  const { isConfigured, provider } = useAIStore();
  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState('cleaned'); // 'raw' or 'cleaned'
  const [isCorrectingGrammar, setIsCorrectingGrammar] = useState(false);

  const displayText = viewMode === 'raw' ? scriptText : cleanedText;

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
    try {
      const result = await correctScreenplayText(cleanedText || scriptText);
      
      if (result.success) {
        setCleanedText(result.text);
        setViewMode('cleaned');
        alert('Grammar correction completed!');
      } else {
        alert(`Grammar correction failed: ${result.error}`);
      }
    } catch (error) {
      alert(`Grammar correction failed: ${error.message}`);
    } finally {
      setIsCorrectingGrammar(false);
    }
  };

  const handleTextChange = (e) => {
    setCleanedText(e.target.value);
  };

  const handleExport = async () => {
    try {
      const filePath = await window.electronAPI.saveFile({
        defaultPath: 'screenplay-cleaned.txt',
        filters: [{ name: 'Text Files', extensions: ['txt'] }],
      });

      if (filePath) {
        await window.electronAPI.saveFileContent({
          filePath,
          data: cleanedText,
        });
        alert('File saved successfully!');
      }
    } catch (error) {
      alert(`Export failed: ${error.message}`);
    }
  };

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

            <button
              onClick={handleGrammarCorrection}
              disabled={isCorrectingGrammar || !isConfigured()}
              className="btn-secondary text-sm disabled:opacity-50 flex items-center gap-2"
              title={!isConfigured() ? 'Configure AI Provider in Settings' : ''}
            >
              {isCorrectingGrammar ? (
                <>
                  <span className="inline-block animate-spin mr-2">⏳</span>
                  Correcting...
                </>
              ) : (
                <>
                  ✨ Fix Grammar 
                  <span className="text-xs opacity-75">
                    ({provider === 'openai' ? 'OpenAI' : provider === 'gemini' ? 'Gemini' : 'Local'})
                  </span>
                </>
              )}
            </button>

            <button onClick={handleExport} className="btn-primary text-sm">
              💾 Export
            </button>
          </div>
        </div>
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
            <pre className="screenplay-text text-cinema-text whitespace-pre-wrap p-6 bg-cinema-dark border border-cinema-gray rounded-lg">
              {displayText}
            </pre>
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
