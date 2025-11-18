import React from 'react';
import { useReaderStore } from '../store/readerStore';

export default function ReaderSettings() {
  const {
    wpm,
    fontSize,
    orpOffset,
    showProgress,
    setWPM,
    setFontSize,
    setORPOffset,
    adjustORPLeft,
    adjustORPRight,
    resetORPOffset,
    toggleShowProgress,
    setShowSettings,
  } = useReaderStore();

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-cinema-dark border border-cinema-gray rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-cinema-gray">
          <div>
            <h2 className="text-2xl font-bold text-cinema-accent">Speed Reader Settings</h2>
            <p className="text-sm text-cinema-text-dim mt-1">
              Customize your reading experience
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

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Reading Speed */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-cinema-text font-semibold">
                Reading Speed
              </label>
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
              style={{
                background: `linear-gradient(to right, #d4af37 0%, #d4af37 ${((wpm - 100) / 900) * 100}%, #2a2a2a ${((wpm - 100) / 900) * 100}%, #2a2a2a 100%)`
              }}
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
              <label className="text-cinema-text font-semibold">
                Font Size
              </label>
              <span className="text-cinema-accent font-bold text-lg">{fontSize}px</span>
            </div>
            <input
              type="range"
              min="24"
              max="96"
              step="4"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full h-2 bg-cinema-gray rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #d4af37 0%, #d4af37 ${((fontSize - 24) / 72) * 100}%, #2a2a2a ${((fontSize - 24) / 72) * 100}%, #2a2a2a 100%)`
              }}
            />
            <div className="flex justify-between text-xs text-cinema-text-dim">
              <span>Small (24px)</span>
              <span>Medium (48px)</span>
              <span>Large (96px)</span>
            </div>
          </div>

          {/* ORP (Optimal Recognition Point) Adjustment */}
          <div className="space-y-3 bg-cinema-gray/30 p-4 rounded-lg border border-cinema-gray">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-cinema-text font-semibold block">
                  Focus Letter Position (ORP)
                </label>
                <p className="text-xs text-cinema-text-dim mt-1">
                  Adjust the highlighted letter left or right
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

            {/* Visual demonstration */}
            <div className="mt-4 p-4 bg-cinema-black rounded-lg">
              <p className="text-xs text-cinema-text-dim mb-2 text-center">Preview:</p>
              <DemoWord offset={orpOffset} />
            </div>

            <button
              onClick={resetORPOffset}
              className="w-full btn-secondary text-sm"
            >
              Reset to Default (Auto)
            </button>
          </div>

          {/* Display Options */}
          <div className="space-y-3">
            <label className="text-cinema-text font-semibold block mb-3">
              Display Options
            </label>

            <label className="flex items-center justify-between p-3 bg-cinema-gray/30 rounded-lg cursor-pointer hover:bg-cinema-gray/50 transition-colors">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-cinema-accent" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
                </svg>
                <div>
                  <span className="text-cinema-text">Show Progress Bar</span>
                  <p className="text-xs text-cinema-text-dim">Display reading progress and time</p>
                </div>
              </div>
              <div
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

            <button
              onClick={toggleShowProgress}
              className="sr-only"
              aria-label="Toggle progress bar"
            ></button>
          </div>

          {/* Keyboard Shortcuts Info */}
          <div className="bg-cinema-gray/30 p-4 rounded-lg border border-cinema-gray">
            <h3 className="text-cinema-text font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-cinema-accent" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z" />
              </svg>
              Keyboard Shortcuts
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-cinema-text-dim">Play/Pause:</span>
                <kbd className="px-2 py-1 bg-cinema-black rounded text-cinema-accent font-mono text-xs">
                  SPACE
                </kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-cinema-text-dim">Reset:</span>
                <kbd className="px-2 py-1 bg-cinema-black rounded text-cinema-accent font-mono text-xs">
                  HOME
                </kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-cinema-text-dim">Skip Back:</span>
                <kbd className="px-2 py-1 bg-cinema-black rounded text-cinema-accent font-mono text-xs">
                  ←
                </kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-cinema-text-dim">Skip Forward:</span>
                <kbd className="px-2 py-1 bg-cinema-black rounded text-cinema-accent font-mono text-xs">
                  →
                </kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-cinema-text-dim">Fullscreen:</span>
                <kbd className="px-2 py-1 bg-cinema-black rounded text-cinema-accent font-mono text-xs">
                  F
                </kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-cinema-text-dim">Settings:</span>
                <kbd className="px-2 py-1 bg-cinema-black rounded text-cinema-accent font-mono text-xs">
                  S
                </kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-cinema-gray flex justify-end gap-3">
          <button
            onClick={() => setShowSettings(false)}
            className="btn-primary"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// Demo word component to show ORP adjustment
function DemoWord({ offset }) {
  const word = 'EXAMPLE';
  const baseORP = 2; // Default ORP for 7-letter word
  const adjustedORP = Math.max(0, Math.min(word.length - 1, baseORP + offset));

  return (
    <div className="text-center">
      <div className="font-mono text-4xl tracking-wider select-none">
        <span className="text-cinema-text-dim">
          {word.substring(0, adjustedORP)}
        </span>
        <span className="text-cinema-accent font-bold">
          {word[adjustedORP]}
        </span>
        <span className="text-cinema-text-dim">
          {word.substring(adjustedORP + 1)}
        </span>
      </div>
      <div className="mt-2 h-0.5 bg-cinema-accent/30 w-full"></div>
      <p className="text-xs text-cinema-text-dim mt-2">
        Focus position: {adjustedORP + 1} of {word.length}
      </p>
    </div>
  );
}
