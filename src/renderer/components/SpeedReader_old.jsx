import React, { useEffect, useRef, useState } from 'react';
import { useScriptStore } from '../store/scriptStore';
import { useReaderStore } from '../store/readerStore';
import ReaderSettings from './ReaderSettings';

export default function SpeedReader() {
  const { cleanedText, scriptText } = useScriptStore();
  const {
    words,
    currentWordIndex,
    isPlaying,
    wpm,
    fontSize,
    focusMode,
    showProgress,
    isFullscreen,
    orpOffset,
    showSettings,
    setWords,
    play,
    pause,
    togglePlay,
    setWPM,
    setCurrentWordIndex,
    nextWord,
    reset,
    setFontSize,
    toggleFocusMode,
    toggleShowProgress,
    setFullscreen,
    adjustORPLeft,
    adjustORPRight,
    toggleSettings,
  } = useReaderStore();

  const intervalRef = useRef(null);

  // Initialize words when component mounts
  useEffect(() => {
    const text = cleanedText || scriptText;
    if (text && words.length === 0) {
      setWords(text);
    }
  }, [cleanedText, scriptText]);

  // Handle playback
  useEffect(() => {
    if (isPlaying) {
      const interval = 60000 / wpm; // milliseconds per word
      intervalRef.current = setInterval(() => {
        nextWord();
      }, interval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, wpm, nextWord]);

  // Handle fullscreen state
  const handleToggleFullscreen = async () => {
    if (window.electronAPI && window.electronAPI.toggleFullscreen) {
      const newFullscreenState = await window.electronAPI.toggleFullscreen();
      setFullscreen(newFullscreenState);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't handle shortcuts if settings is open
      if (showSettings) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setCurrentWordIndex(Math.max(0, currentWordIndex - 10));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setCurrentWordIndex(Math.min(words.length - 1, currentWordIndex + 10));
      } else if (e.code === 'Home') {
        e.preventDefault();
        reset();
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        handleToggleFullscreen();
      } else if (e.code === 'KeyS') {
        e.preventDefault();
        toggleSettings();
      } else if (e.code === 'Escape' && isFullscreen) {
        e.preventDefault();
        if (window.electronAPI && window.electronAPI.exitFullscreen) {
          window.electronAPI.exitFullscreen();
          setFullscreen(false);
        }
      } else if (e.code === 'Comma' || e.code === 'BracketLeft') {
        // < or [ - move ORP left
        e.preventDefault();
        adjustORPLeft();
      } else if (e.code === 'Period' || e.code === 'BracketRight') {
        // > or ] - move ORP right
        e.preventDefault();
        adjustORPRight();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, currentWordIndex, words.length, isFullscreen, showSettings]);

  const currentWord = words[currentWordIndex] || '';
  const progress = words.length > 0 ? (currentWordIndex / words.length) * 100 : 0;
  const timeElapsed = Math.floor((currentWordIndex / wpm) * 60);
  const timeRemaining = Math.floor(((words.length - currentWordIndex) / wpm) * 60);

  // Find optimal recognition point (ORP) in word with user adjustment
  const getORPIndex = (word) => {
    const len = word.length;
    let baseORP;
    if (len <= 1) baseORP = 0;
    else if (len <= 5) baseORP = 1;
    else if (len <= 9) baseORP = 2;
    else if (len <= 13) baseORP = 3;
    else baseORP = 4;

    // Apply user offset and clamp to valid range
    const adjustedORP = baseORP + orpOffset;
    return Math.max(0, Math.min(len - 1, adjustedORP));
  };

  const orpIndex = getORPIndex(currentWord);

  return (
    <div className={`flex flex-col h-full ${focusMode ? 'bg-black' : 'bg-cinema-black'}`}>
      {/* Settings Modal */}
      {showSettings && <ReaderSettings />}

      {/* Controls */}
      {!focusMode && (
        <div className="bg-cinema-dark border-b border-cinema-gray p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className="w-14 h-14 rounded-full bg-cinema-accent hover:bg-cinema-accent-dark text-cinema-black flex items-center justify-center transition-colors"
                title="Play/Pause (Space)"
              >
                {isPlaying ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Reset */}
              <button
                onClick={reset}
                className="p-3 bg-cinema-gray hover:bg-cinema-gray-light rounded-lg transition-colors"
                title="Reset to start (Home)"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
                </svg>
              </button>

              {/* WPM Control */}
              <div className="flex items-center gap-3 bg-cinema-gray px-4 py-2 rounded-lg">
                <label className="text-sm text-cinema-text-dim">WPM:</label>
                <input
                  type="range"
                  min="100"
                  max="1000"
                  step="50"
                  value={wpm}
                  onChange={(e) => setWPM(Number(e.target.value))}
                  className="w-32"
                />
                <span className="text-cinema-accent font-bold w-12">{wpm}</span>
              </div>

              {/* Font Size */}
              <div className="flex items-center gap-3 bg-cinema-gray px-4 py-2 rounded-lg">
                <label className="text-sm text-cinema-text-dim">Size:</label>
                <input
                  type="range"
                  min="24"
                  max="96"
                  step="4"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-cinema-accent font-bold w-12">{fontSize}</span>
              </div>

              {/* ORP Adjustment */}
              <div className="flex items-center gap-2 bg-cinema-gray px-3 py-2 rounded-lg">
                <span className="text-sm text-cinema-text-dim">Focus:</span>
                <button
                  onClick={adjustORPLeft}
                  className="p-1 hover:bg-cinema-gray-light rounded transition-colors"
                  title="Move focus left [ or <"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                  </svg>
                </button>
                <span className="text-cinema-accent font-bold w-8 text-center text-sm">
                  {orpOffset > 0 ? '+' : ''}{orpOffset}
                </span>
                <button
                  onClick={adjustORPRight}
                  className="p-1 hover:bg-cinema-gray-light rounded transition-colors"
                  title="Move focus right ] or >"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Right side controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleToggleFullscreen}
                className="p-3 bg-cinema-gray hover:bg-cinema-gray-light rounded-lg transition-colors"
                title="Fullscreen (F)"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  {isFullscreen ? (
                    <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                  ) : (
                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                  )}
                </svg>
              </button>
              <button
                onClick={toggleShowProgress}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  showProgress
                    ? 'bg-cinema-accent text-cinema-black'
                    : 'bg-cinema-gray text-cinema-text hover:bg-cinema-gray-light'
                }`}
              >
                Progress
              </button>
              <button
                onClick={toggleFocusMode}
                className="px-4 py-2 bg-cinema-gray hover:bg-cinema-gray-light text-cinema-text rounded-lg text-sm transition-colors"
              >
                Focus Mode
              </button>
              <button
                onClick={toggleSettings}
                className="p-3 bg-cinema-gray hover:bg-cinema-gray-light rounded-lg transition-colors"
                title="Settings (S)"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81a.488.488 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reader Display */}
      <div className="flex-1 flex items-center justify-center relative">
        {/* Word Display */}
        <div className="text-center">
          {/* The Word with ORP highlighted */}
          <div
            className="font-mono tracking-wider select-none"
            style={{ fontSize: `${fontSize}px` }}
          >
            {currentWord && (
              <>
                <span className={focusMode ? 'text-gray-400' : 'text-cinema-text-dim'}>
                  {currentWord.substring(0, orpIndex)}
                </span>
                <span className={focusMode ? 'text-white' : 'text-cinema-accent'}>
                  {currentWord[orpIndex]}
                </span>
                <span className={focusMode ? 'text-gray-400' : 'text-cinema-text-dim'}>
                  {currentWord.substring(orpIndex + 1)}
                </span>
              </>
            )}
          </div>

          {/* ORP Guide Line */}
          <div
            className={`mt-2 h-0.5 ${
              focusMode ? 'bg-white/20' : 'bg-cinema-accent/30'
            } w-full`}
          ></div>

          {/* Word Counter */}
          {showProgress && (
            <div
              className={`mt-6 text-sm ${
                focusMode ? 'text-gray-500' : 'text-cinema-text-dim'
              }`}
            >
              Word {currentWordIndex + 1} of {words.length}
            </div>
          )}
        </div>

        {/* Focus Mode Controls */}
        {focusMode && (
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              onClick={handleToggleFullscreen}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              title="Toggle Fullscreen (F)"
            >
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                {isFullscreen ? (
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                ) : (
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                )}
              </svg>
            </button>
            <button
              onClick={toggleSettings}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              title="Settings (S)"
            >
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81a.488.488 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
              </svg>
            </button>
            <button
              onClick={toggleFocusMode}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              title="Exit Focus Mode"
            >
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>
        )}

        {/* Keyboard shortcuts hint */}
        {focusMode && !isPlaying && (
          <div className="absolute bottom-8 text-center text-gray-500 text-sm">
            <div className="mb-2">Press <kbd className="px-2 py-1 bg-white/10 rounded">SPACE</kbd> to play/pause</div>
            <div className="text-xs flex items-center justify-center gap-4">
              <span><kbd className="px-2 py-1 bg-white/10 rounded">← →</kbd> Skip</span>
              <span><kbd className="px-2 py-1 bg-white/10 rounded">HOME</kbd> Reset</span>
              <span><kbd className="px-2 py-1 bg-white/10 rounded">F</kbd> Fullscreen</span>
              <span><kbd className="px-2 py-1 bg-white/10 rounded">S</kbd> Settings</span>
              <span><kbd className="px-2 py-1 bg-white/10 rounded">[ ]</kbd> Focus</span>
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {showProgress && !focusMode && (
        <div className="bg-cinema-dark border-t border-cinema-gray">
          <div className="relative h-2 bg-cinema-gray">
            <div
              className="absolute top-0 left-0 h-full bg-cinema-accent transition-all duration-100"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between px-6 py-2 text-xs text-cinema-text-dim">
            <div>
              Elapsed: {Math.floor(timeElapsed / 60)}m {timeElapsed % 60}s
            </div>
            <div>{progress.toFixed(1)}%</div>
            <div>
              Remaining: {Math.floor(timeRemaining / 60)}m {timeRemaining % 60}s
            </div>
          </div>
        </div>
      )}

      {/* Seek bar (when not in focus mode) */}
      {!focusMode && (
        <div className="bg-cinema-dark border-t border-cinema-gray p-4">
          <input
            type="range"
            min="0"
            max={words.length - 1}
            value={currentWordIndex}
            onChange={(e) => setCurrentWordIndex(Number(e.target.value))}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}
