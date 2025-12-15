import React, { useState } from 'react';
import { useReaderStore } from '../store/readerStore';

/**
 * ReaderSettings - Advanced Typography & Configuration Panel
 * Tabs: Speed & Display | Typography | Blacklist | Shortcuts
 */
export default function ReaderSettings() {
  const {
    wpm,
    fontSize,
    orpOffset,
    showProgress,
    fontFamily,
    fontWeight,
    letterSpacing,
    theme,
    blacklist,
    setWPM,
    setFontSize,
    setORPOffset,
    adjustORPLeft,
    adjustORPRight,
    resetORPOffset,
    toggleShowProgress,
    setShowSettings,
    setFontFamily,
    setFontWeight,
    setLetterSpacing,
    setTheme,
    addToBlacklist,
    removeFromBlacklist,
    clearBlacklist,
  } = useReaderStore();

  const [activeTab, setActiveTab] = useState('speed'); // 'speed' | 'typography' | 'blacklist' | 'shortcuts'
  const [blacklistInput, setBlacklistInput] = useState('');

  // Font options
  const fontOptions = [
    { value: 'Courier Prime', label: 'Courier Prime', desc: 'Screenplay Standard' },
    { value: 'Roboto Mono', label: 'Roboto Mono', desc: 'Modern & Clean' },
    { value: 'Fira Code', label: 'Fira Code', desc: 'High Clarity' },
    { value: 'OpenDyslexic', label: 'OpenDyslexic', desc: 'Accessibility' },
    { value: 'JetBrains Mono', label: 'JetBrains Mono', desc: 'Ergonomic' },
  ];

  // Theme options
  const themeOptions = [
    { value: 'cinema', label: 'Cinema Mode', bg: '#0a0a0a', text: '#ffffff', accent: '#d4af37' },
    { value: 'paper', label: 'Paper Mode', bg: '#f4f1ea', text: '#3e2723', accent: '#8d6e63' },
    { value: 'hacker', label: 'Hacker Mode', bg: '#000000', text: '#00ff00', accent: '#00ff00' },
    { value: 'eink', label: 'E-Ink Mode', bg: '#ffffff', text: '#000000', accent: '#333333' },
  ];

  // Handle blacklist addition
  const handleAddBlacklist = () => {
    if (blacklistInput.trim()) {
      const words = blacklistInput
        .split(/[,\s]+/)
        .map(w => w.trim())
        .filter(w => w.length > 0);
      words.forEach(word => addToBlacklist(word));
      setBlacklistInput('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] animate-fadeIn">
      <div className="bg-cinema-dark border border-cinema-gray rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-cinema-gray">
          <div>
            <h2 className="text-2xl font-bold text-cinema-accent">Speed Reader Settings</h2>
            <p className="text-sm text-cinema-text-dim mt-1">
              Customize your reading experience with advanced typography
            </p>
          </div>
          <button
            onClick={() => setShowSettings(false)}
            className="p-2 hover:bg-cinema-gray rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-cinema-text" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-cinema-gray bg-cinema-dark/50">
          {[
            { id: 'speed', label: 'Speed & Display', icon: '⚡' },
            { id: 'typography', label: 'Typography', icon: '✏️' },
            { id: 'blacklist', label: 'Word Filter', icon: '🚫' },
            { id: 'shortcuts', label: 'Shortcuts', icon: '⌨️' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-cinema-accent border-b-2 border-cinema-accent bg-cinema-gray/30'
                  : 'text-cinema-text-dim hover:text-cinema-text hover:bg-cinema-gray/20'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Tab: Speed & Display */}
          {activeTab === 'speed' && (
            <div className="space-y-6">
              {/* Reading Speed */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-cinema-text font-semibold">Reading Speed</label>
                  <span className="text-cinema-accent font-bold text-lg">{wpm} WPM</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="1000"
                  step="50"
                  value={wpm}
                  onChange={(e) => setWPM(Number(e.target.value))}
                  className="w-full h-2 bg-cinema-gray rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-cinema-text-dim">
                  <span>Slow (100)</span>
                  <span>Average (250)</span>
                  <span>Fast (1000)</span>
                </div>
              </div>

              {/* Font Size */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-cinema-text font-semibold">Font Size</label>
                  <span className="text-cinema-accent font-bold text-lg">{fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="24"
                  max="128"
                  step="4"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full h-2 bg-cinema-gray rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-cinema-text-dim">
                  <span>Small (24px)</span>
                  <span>Medium (64px)</span>
                  <span>Large (128px)</span>
                </div>
              </div>

              {/* ORP Adjustment */}
              <div className="space-y-3 bg-cinema-gray/30 p-4 rounded-lg border border-cinema-gray">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-cinema-text font-semibold block">
                      Focus Letter Position (ORP)
                    </label>
                    <p className="text-xs text-cinema-text-dim mt-1">
                      Adjust the highlighted pivot character
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={adjustORPLeft}
                      disabled={orpOffset <= -3}
                      className="p-2 bg-cinema-gray hover:bg-cinema-gray-light disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                      </svg>
                    </button>
                    <span className="text-cinema-accent font-bold text-xl w-12 text-center">
                      {orpOffset > 0 ? '+' : ''}{orpOffset}
                    </span>
                    <button
                      onClick={adjustORPRight}
                      disabled={orpOffset >= 3}
                      className="p-2 bg-cinema-gray hover:bg-cinema-gray-light disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="mt-4 p-4 bg-cinema-black rounded-lg">
                  <p className="text-xs text-cinema-text-dim mb-2 text-center">Preview:</p>
                  <DemoWord offset={orpOffset} />
                </div>
                <button onClick={resetORPOffset} className="w-full btn-secondary text-sm">
                  Reset to Default (Auto)
                </button>
              </div>

              {/* Progress Toggle */}
              <label className="flex items-center justify-between p-4 bg-cinema-gray/30 rounded-lg cursor-pointer hover:bg-cinema-gray/50 transition-colors">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-cinema-accent" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
                  </svg>
                  <div>
                    <span className="text-cinema-text font-medium">Show Progress Bar</span>
                    <p className="text-xs text-cinema-text-dim">Display reading progress and time</p>
                  </div>
                </div>
                <div
                  onClick={toggleShowProgress}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    showProgress ? 'bg-cinema-accent' : 'bg-cinema-gray'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full transition-transform transform ${
                      showProgress ? 'translate-x-6' : 'translate-x-1'
                    } mt-0.5`}
                  ></div>
                </div>
              </label>
            </div>
          )}

          {/* Tab: Typography */}
          {activeTab === 'typography' && (
            <div className="space-y-6">
              {/* Font Family Selector */}
              <div className="space-y-3">
                <label className="text-cinema-text font-semibold block">Font Family</label>
                <div className="grid grid-cols-1 gap-2">
                  {fontOptions.map(font => (
                    <button
                      key={font.value}
                      onClick={() => setFontFamily(font.value)}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        fontFamily === font.value
                          ? 'border-cinema-accent bg-cinema-accent/10'
                          : 'border-cinema-gray bg-cinema-gray/30 hover:border-cinema-accent/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-cinema-text font-medium">{font.label}</div>
                          <div className="text-xs text-cinema-text-dim">{font.desc}</div>
                        </div>
                        {fontFamily === font.value && (
                          <svg className="w-5 h-5 text-cinema-accent" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Weight */}
              <div className="space-y-3">
                <label className="text-cinema-text font-semibold block">Font Weight</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: 300, label: 'Light' },
                    { value: 400, label: 'Normal' },
                    { value: 500, label: 'Medium' },
                    { value: 700, label: 'Bold' },
                  ].map(weight => (
                    <button
                      key={weight.value}
                      onClick={() => setFontWeight(weight.value)}
                      className={`p-3 rounded-lg border-2 text-sm transition-all ${
                        fontWeight === weight.value
                          ? 'border-cinema-accent bg-cinema-accent/10 text-cinema-accent font-bold'
                          : 'border-cinema-gray bg-cinema-gray/30 text-cinema-text hover:border-cinema-accent/50'
                      }`}
                    >
                      {weight.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Letter Spacing */}
              <div className="space-y-3">
                <label className="text-cinema-text font-semibold block">Letter Spacing</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: 'tight', label: 'Tight' },
                    { value: 'normal', label: 'Normal' },
                    { value: 'relaxed', label: 'Relaxed' },
                    { value: 'wide', label: 'Wide' },
                  ].map(spacing => (
                    <button
                      key={spacing.value}
                      onClick={() => setLetterSpacing(spacing.value)}
                      className={`p-3 rounded-lg border-2 text-sm transition-all ${
                        letterSpacing === spacing.value
                          ? 'border-cinema-accent bg-cinema-accent/10 text-cinema-accent font-bold'
                          : 'border-cinema-gray bg-cinema-gray/30 text-cinema-text hover:border-cinema-accent/50'
                      }`}
                    >
                      {spacing.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme Selector */}
              <div className="space-y-3">
                <label className="text-cinema-text font-semibold block">Color Theme</label>
                <div className="grid grid-cols-2 gap-3">
                  {themeOptions.map(themeOpt => (
                    <button
                      key={themeOpt.value}
                      onClick={() => setTheme(themeOpt.value)}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        theme === themeOpt.value
                          ? 'border-cinema-accent'
                          : 'border-cinema-gray hover:border-cinema-accent/50'
                      }`}
                      style={{ backgroundColor: themeOpt.bg + '20' }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium" style={{ color: themeOpt.text }}>
                          {themeOpt.label}
                        </div>
                        {theme === themeOpt.value && (
                          <svg className="w-5 h-5 text-cinema-accent" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <div className="w-6 h-6 rounded" style={{ backgroundColor: themeOpt.bg }} />
                        <div className="w-6 h-6 rounded" style={{ backgroundColor: themeOpt.text }} />
                        <div className="w-6 h-6 rounded" style={{ backgroundColor: themeOpt.accent }} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Preview */}
              <div className={`p-6 rounded-lg theme-${theme}`} style={{ backgroundColor: 'var(--reader-bg)', color: 'var(--reader-text)' }}>
                <p className="text-xs mb-2" style={{ color: 'var(--reader-text-dim)' }}>Live Preview:</p>
                <div className="font-mono text-3xl text-center" style={{ fontFamily: `var(--font-${fontFamily.toLowerCase().replace(' ', '-')})`, fontWeight, letterSpacing: letterSpacing === 'tight' ? '-0.05em' : letterSpacing === 'relaxed' ? '0.05em' : letterSpacing === 'wide' ? '0.1em' : '0' }}>
                  <span style={{ color: 'var(--reader-text-dim)' }}>EX</span>
                  <span style={{ color: 'var(--reader-accent)' }}>A</span>
                  <span style={{ color: 'var(--reader-text-dim)' }}>MPLE</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Blacklist */}
          {activeTab === 'blacklist' && (
            <div className="space-y-6">
              <div className="bg-cinema-gray/30 p-4 rounded-lg border border-cinema-gray">
                <h3 className="text-cinema-text font-semibold mb-2">What is Word Filtering?</h3>
                <p className="text-sm text-cinema-text-dim">
                  Filter out common screenplay markers like "CUT TO", "FADE IN", "INT.", "EXT." from your reading flow.
                  Words are case-insensitive and automatically uppercased.
                </p>
              </div>

              {/* Add Words */}
              <div className="space-y-3">
                <label className="text-cinema-text font-semibold block">Add Words to Filter</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={blacklistInput}
                    onChange={(e) => setBlacklistInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddBlacklist()}
                    placeholder="Enter words separated by commas..."
                    className="flex-1 px-4 py-2 bg-cinema-gray border border-cinema-gray-light rounded-lg text-cinema-text placeholder-cinema-text-dim focus:outline-none focus:border-cinema-accent"
                  />
                  <button onClick={handleAddBlacklist} className="btn-primary">
                    Add
                  </button>
                </div>
                <p className="text-xs text-cinema-text-dim">
                  Example: INT, EXT, FADE, CUT TO, DISSOLVE
                </p>
              </div>

              {/* Current Blacklist */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-cinema-text font-semibold">Filtered Words ({blacklist.length})</label>
                  {blacklist.length > 0 && (
                    <button
                      onClick={clearBlacklist}
                      className="text-sm text-red-400 hover:text-red-300 transition-colors"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                {blacklist.length === 0 ? (
                  <div className="p-8 text-center text-cinema-text-dim">
                    <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                    </svg>
                    <p>No words filtered yet</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {blacklist.map(word => (
                      <div
                        key={word}
                        className="flex items-center gap-2 px-3 py-2 bg-cinema-gray/50 rounded-lg border border-cinema-gray"
                      >
                        <span className="text-cinema-text font-mono text-sm">{word}</span>
                        <button
                          onClick={() => removeFromBlacklist(word)}
                          className="text-cinema-text-dim hover:text-red-400 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Presets */}
              <div className="space-y-3">
                <label className="text-cinema-text font-semibold block">Quick Presets</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      ['INT', 'EXT', 'INT/EXT'].forEach(w => addToBlacklist(w));
                    }}
                    className="p-3 bg-cinema-gray/30 hover:bg-cinema-gray/50 rounded-lg text-sm text-cinema-text transition-colors"
                  >
                    Scene Headers
                  </button>
                  <button
                    onClick={() => {
                      ['FADE IN', 'FADE OUT', 'CUT TO', 'DISSOLVE', 'CONTINUED'].forEach(w => addToBlacklist(w));
                    }}
                    className="p-3 bg-cinema-gray/30 hover:bg-cinema-gray/50 rounded-lg text-sm text-cinema-text transition-colors"
                  >
                    Transitions
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Shortcuts */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-4">
              <div className="bg-cinema-gray/30 p-4 rounded-lg border border-cinema-gray">
                <h3 className="text-cinema-text font-semibold mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-cinema-accent" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z" />
                  </svg>
                  Keyboard Shortcuts
                </h3>
                <div className="space-y-2">
                  {[
                    { key: 'SPACE', desc: 'Play / Pause reading' },
                    { key: 'HOME', desc: 'Reset to beginning' },
                    { key: '← →', desc: 'Skip backward / forward (10 words)' },
                    { key: 'F', desc: 'Toggle fullscreen mode' },
                    { key: 'S', desc: 'Open settings panel' },
                    { key: '[ ]', desc: 'Adjust ORP focus left / right' },
                    { key: 'ESC', desc: 'Exit fullscreen (when active)' },
                  ].map((shortcut, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-cinema-gray/30 last:border-0">
                      <span className="text-cinema-text">{shortcut.desc}</span>
                      <kbd className="px-3 py-1 bg-cinema-black rounded text-cinema-accent font-mono text-sm">
                        {shortcut.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-cinema-gray flex justify-end gap-3 bg-cinema-dark/50">
          <button onClick={() => setShowSettings(false)} className="btn-primary">
            Done & Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// Demo word component to show ORP adjustment
function DemoWord({ offset }) {
  const word = 'EXAMPLE';
  const baseORP = 2;
  const adjustedORP = Math.max(0, Math.min(word.length - 1, baseORP + offset));

  return (
    <div className="text-center">
      <div className="font-mono text-4xl tracking-wider select-none">
        <span className="text-cinema-text-dim">{word.substring(0, adjustedORP)}</span>
        <span className="text-cinema-accent font-bold">{word[adjustedORP]}</span>
        <span className="text-cinema-text-dim">{word.substring(adjustedORP + 1)}</span>
      </div>
      <div className="mt-2 h-0.5 bg-cinema-accent/30 w-full"></div>
      <p className="text-xs text-cinema-text-dim mt-2">
        Focus position: {adjustedORP + 1} of {word.length}
      </p>
    </div>
  );
}
