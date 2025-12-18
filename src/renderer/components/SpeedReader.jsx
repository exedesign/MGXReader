import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useScriptStore } from '../store/scriptStore';
import { useReaderStore } from '../store/readerStore';
import { useAIStore } from '../store/aiStore';
import { usePromptStore } from '../store/promptStore';
import { parseWordsWithMetadata, calculatePagePosition } from '../utils/textProcessing';
import ReaderSettings from './ReaderSettings';
import ReadingTimeline from './ReadingTimeline';
import { updateTokenUsage } from '../utils/tokenTracker';
import { calculateGeminiCost } from '../utils/aiHandler';
import { estimateTokens, estimateOutputTokens } from '../utils/tokenEstimator';

/**
 * SpeedReader - Professional RSVP Engine with Pixel-Perfect ORP Alignment
 * Features:
 * - Mathematically precise pivot character centering
 * - Monospace font requirement for consistent alignment
 * - Dynamic transform: translateX() for fluid positioning
 * - Zen Mode with mouse idle detection
 * - Page-based timeline navigation
 * - Word blacklist filtering
 */
export default function SpeedReader() {
  const { t, i18n } = useTranslation();
  const { cleanedText, scriptText, setCleanedText, pageCount, originalPageRatio, pageBreaks, wordsPerPage } = useScriptStore();
  const { isConfigured, getAIHandler } = useAIStore();
  const { getActivePrompt } = usePromptStore();
  const {
    words,
    currentWordIndex,
    isPlaying,
    wpm,
    fontSize,
    focusMode,
    isFullscreen,
    orpOffset,
    showSettings,
    fontFamily,
    fontWeight,
    letterSpacing,
    theme,
    blacklist,
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
    setFullscreen,
    adjustORPLeft,
    adjustORPRight,
    toggleSettings,
    getFilteredWords,
  } = useReaderStore();

  const intervalRef = useRef(null);
  const wordDisplayRef = useRef(null);

  // Mouse idle detection for Zen Mode
  const [mouseIdle, setMouseIdle] = useState(false);
  const mouseIdleTimerRef = useRef(null);

  // AI Summary states
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [aiSummary, setAiSummary] = useState('');

  // Initialize words when component mounts
  useEffect(() => {
    const text = cleanedText || scriptText;
    if (text && words.length === 0) {
      // Prepare page information for accurate tracking
      const pageInfo = originalPageRatio ? {
        pageCount: pageCount,
        totalWords: originalPageRatio.totalWords,
        pageBreaks: pageBreaks
      } : null;

      const wordsWithMetadata = parseWordsWithMetadata(text, pageInfo);
      setWords(wordsWithMetadata);
    }
  }, [cleanedText, scriptText, pageCount, originalPageRatio, pageBreaks]);

  // Get filtered words (excluding blacklist)
  const filteredWords = getFilteredWords();
  const activeWords = filteredWords.length > 0 ? filteredWords : words;

  // Handle playback with filtered words
  useEffect(() => {
    if (isPlaying && activeWords.length > 0) {
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
  }, [isPlaying, wpm, activeWords.length, nextWord]);

  // Mouse idle detection (2 seconds for Zen Mode)
  useEffect(() => {
    if (!focusMode) {
      setMouseIdle(false);
      return;
    }

    const handleMouseMove = () => {
      setMouseIdle(false);
      if (mouseIdleTimerRef.current) {
        clearTimeout(mouseIdleTimerRef.current);
      }
      mouseIdleTimerRef.current = setTimeout(() => {
        setMouseIdle(true);
      }, 2000);
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Initial timer
    mouseIdleTimerRef.current = setTimeout(() => {
      setMouseIdle(true);
    }, 2000);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (mouseIdleTimerRef.current) {
        clearTimeout(mouseIdleTimerRef.current);
      }
    };
  }, [focusMode]);

  // Handle fullscreen state
  const handleToggleFullscreen = async () => {
    if (window.electronAPI && window.electronAPI.toggleFullscreen) {
      const newFullscreenState = await window.electronAPI.toggleFullscreen();
      setFullscreen(newFullscreenState);
    }
  };

  // Generate AI Summary for Speed Reading
  const handleGenerateSummary = async () => {
    if (!isConfigured()) {
      alert(t('speedReader.configureFirst'));
      return;
    }

    const text = cleanedText || scriptText;
    if (!text) {
      alert(t('speedReader.noText'));
      return;
    }

    setIsGeneratingSummary(true);

    try {
      const aiHandler = getAIHandler();
      const speedReadingPrompt = getActivePrompt('speed_reading');

      let prompt;
      if (speedReadingPrompt && speedReadingPrompt.system && speedReadingPrompt.user) {
        prompt = {
          system: speedReadingPrompt.system,
          user: speedReadingPrompt.user
        };
      } else {
        // Default speed reading summary prompt
        prompt = {
          system: "You are a professional text summarizer specialized in creating optimized summaries for speed reading. Create concise, scannable summaries that highlight key points and main ideas.",
          user: `Create a speed-reading optimized summary of this text. Focus on:\n\n1. Main plot points or key arguments\n2. Important character names or concepts\n3. Critical facts or conclusions\n4. Essential details for understanding\n\nFormat as bullet points for easy scanning:`
        };
      }

      // Estimate tokens before API call
      const fullPromptText = prompt.system + '\n\n' + prompt.user + '\n\n' + text;
      const estimatedTokens = estimateTokens(fullPromptText) + estimateOutputTokens('summary');
      
      const result = await aiHandler.analyzeWithCustomPrompt(text, {
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        language: i18n.language,
        includeMetadata: true
      });
      
      // Extract text and metadata from result
      const summaryText = typeof result === 'string' ? result : result.text;
      const usage = typeof result === 'object' ? result.usage : null;
      const model = typeof result === 'object' ? result.model : 'unknown';
      
      // Track token usage if metadata available
      if (usage && usage.totalTokenCount) {
        const cost = calculateGeminiCost(model, usage);
        updateTokenUsage({
          cost: cost,
          usage: usage,
          model: model,
          analysisType: 'speed_reading_summary',
          estimatedTokens: estimatedTokens
        });
        
        console.log('📊 Speed reading summary cost tracked:', {
          model: model,
          estimated: estimatedTokens,
          actual: usage.totalTokenCount,
          cost: `$${cost.total.toFixed(6)}`
        });
      }
      
      setAiSummary(summaryText);
      setShowSummaryModal(true);
    } catch (error) {
      console.error('Summary generation error:', error);
      alert(t('speedReader.failedSummary') + ' ' + error.message);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Apply summary as speed reading text
  const applySummaryAsText = () => {
    if (aiSummary) {
      setCleanedText(aiSummary);

      // Prepare page information for summary text
      const pageInfo = originalPageRatio ? {
        pageCount: pageCount,
        totalWords: originalPageRatio.totalWords,
        pageBreaks: pageBreaks
      } : null;

      const summaryWords = parseWordsWithMetadata(aiSummary, pageInfo);
      setWords(summaryWords);
      setCurrentWordIndex(0);
      setShowSummaryModal(false);
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
        setCurrentWordIndex(Math.min(activeWords.length - 1, currentWordIndex + 10));
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
  }, [togglePlay, currentWordIndex, activeWords.length, isFullscreen, showSettings]);

  // Handle loading state - if no words loaded yet
  if (!words || words.length === 0) {
    return (
      <div className="flex flex-col h-full bg-cinema-black items-center justify-center">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-cinema-accent animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-cinema-text-dim">{t('speedReader.loading')}</p>
          <p className="text-sm text-cinema-text-dim mt-2">{t('speedReader.uploadFirst')}</p>
        </div>
      </div>
    );
  }

  // Get current word object
  const currentWordObj = activeWords[currentWordIndex];
  const currentWord = currentWordObj?.word || currentWordObj || '';

  // Calculate progress and page information
  const progress = activeWords.length > 0 ? (currentWordIndex / activeWords.length) * 100 : 0;
  const pagePosition = calculatePagePosition(currentWordIndex, activeWords);
  const timeElapsed = Math.floor((currentWordIndex / wpm) * 60);
  const timeRemaining = Math.floor(((activeWords.length - currentWordIndex) / wpm) * 60);

  /**
   * Calculate Optimal Recognition Point (ORP) with user offset
   * This is the "pivot character" that should stay centered
   */
  const calculateORP = (word) => {
    const len = word.length;
    let baseORP;

    // Standard ORP calculation based on word length
    if (len <= 1) baseORP = 0;
    else if (len <= 5) baseORP = 1;
    else if (len <= 9) baseORP = 2;
    else if (len <= 13) baseORP = 3;
    else baseORP = 4;

    // Apply user offset and clamp to valid range
    const adjustedORP = baseORP + orpOffset;
    return Math.max(0, Math.min(len - 1, adjustedORP));
  };

  /**
   * Calculate pixel-perfect transform for ORP centering
   * Uses monospace character width to determine exact translateX value
   */
  const calculateTransform = (word, orpIndex) => {
    if (!word || word.length === 0) return 'translateX(0)';

    // For monospace fonts, each character has equal width
    // We need to shift the word so that the ORP character aligns with center

    // Characters before ORP (should be to the left of center)
    const charsBeforeORP = orpIndex;

    // Characters after ORP (should be to the right of center)
    const charsAfterORP = word.length - orpIndex - 1;

    // Calculate offset as a percentage of character width
    // Negative value shifts left, positive shifts right
    // We want ORP at center, so we shift by the distance from word start to ORP
    const charWidth = fontSize * 0.6; // Monospace character width approximation
    const offsetPixels = -(charsBeforeORP * charWidth) + (word.length * charWidth * 0.5) - (charWidth * 0.5);

    return `translateX(${offsetPixels}px)`;
  };

  const orpIndex = calculateORP(currentWord);
  const wordTransform = calculateTransform(currentWord, orpIndex);

  // Font family mapping
  const fontFamilyMap = {
    'Courier Prime': 'var(--font-courier-prime)',
    'Roboto Mono': 'var(--font-roboto-mono)',
    'Fira Code': 'var(--font-fira-code)',
    'OpenDyslexic': 'var(--font-opendyslexic)',
    'JetBrains Mono': 'var(--font-jetbrains-mono)',
  };

  // Letter spacing mapping
  const letterSpacingMap = {
    tight: '-0.05em',
    normal: '0',
    relaxed: '0.05em',
    wide: '0.1em',
  };

  // Apply theme colors
  const themeClass = `theme-${theme}`;

  return (
    <div className={`flex flex-col h-full ${themeClass}`} style={{ backgroundColor: 'var(--reader-bg)', color: 'var(--reader-text)' }}>
      {/* Settings Modal */}
      {showSettings && <ReaderSettings />}

      {/* AI Summary Modal */}
      {showSummaryModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-cinema-dark border border-cinema-gray rounded-2xl w-full max-w-4xl max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-cinema-gray">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-cinema-accent flex items-center gap-2">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  {t('speedReader.aiSummaryTitle')}
                </h3>
                <button
                  onClick={() => setShowSummaryModal(false)}
                  className="text-cinema-text-dim hover:text-white transition-colors p-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-cinema-text-dim mt-2">
                {t('speedReader.aiSummaryDesc')}
              </p>
            </div>

            <div className="p-6">
              <div className="bg-cinema-bg border border-cinema-gray-light rounded-lg p-4 mb-4 max-h-96 overflow-y-auto">
                <pre className="text-cinema-text whitespace-pre-wrap font-mono text-sm leading-relaxed">
                  {aiSummary}
                </pre>
              </div>

              <div className="flex justify-between items-center">
                <div className="text-sm text-cinema-text-dim">
                  {t('speedReader.summaryReady')} • {aiSummary.split(/\s+/).length} {t('editor.words').toLowerCase()}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSummaryModal(false)}
                    className="px-4 py-2 bg-cinema-gray hover:bg-cinema-gray-light text-cinema-text rounded-lg transition-colors"
                  >
                    {t('speedReader.keepOriginal')}
                  </button>
                  <button
                    onClick={applySummaryAsText}
                    className="px-4 py-2 bg-cinema-accent hover:bg-cinema-accent-dark text-cinema-black rounded-lg transition-colors"
                  >
                    {t('speedReader.useSummary')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Controls - Hidden in Zen Mode when mouse is idle AND in fullscreen */}
      {!focusMode && !isFullscreen && (
        <div className="bg-cinema-dark border-b border-cinema-gray p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className="w-14 h-14 rounded-full bg-cinema-accent hover:bg-cinema-accent-dark text-cinema-black flex items-center justify-center transition-colors"
                title={t('speedReader.playPause')}
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
                title={t('speedReader.reset')}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
                </svg>
              </button>

              {/* WPM Control */}
              <div className="flex items-center gap-3 bg-cinema-gray px-4 py-2 rounded-lg">
                <label className="text-sm text-cinema-text-dim">{t('speedReader.wpm')}</label>
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
                <label className="text-sm text-cinema-text-dim">{t('speedReader.size')}</label>
                <input
                  type="range"
                  min="24"
                  max="128"
                  step="4"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-cinema-accent font-bold w-12">{fontSize}</span>
              </div>

              {/* Page Information */}
              <div className="flex items-center gap-2 bg-cinema-gray px-3 py-2 rounded-lg">
                <span className="text-sm text-cinema-text-dim">{t('speedReader.page')}</span>
                <span className="text-cinema-accent font-bold text-sm">
                  {pagePosition.page} / {pagePosition.totalPages}
                </span>
                <div className="w-px h-4 bg-cinema-gray-light mx-1"></div>
                <span className="text-xs text-cinema-text-dim">
                  {pagePosition.pageProgress}%
                </span>
              </div>

              {/* ORP Adjustment */}
              <div className="flex items-center gap-2 bg-cinema-gray px-3 py-2 rounded-lg">
                <span className="text-sm text-cinema-text-dim">{t('speedReader.focus')}</span>
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
              {/* AI Summary Button */}
              <button
                onClick={handleGenerateSummary}
                disabled={isGeneratingSummary || !isConfigured()}
                className={`px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${isConfigured()
                  ? 'bg-cinema-accent text-cinema-black hover:bg-cinema-accent-dark disabled:opacity-50'
                  : 'bg-cinema-gray text-cinema-text-dim cursor-not-allowed'
                  }`}
                title={t('speedReader.aiSummaryTitle')}
              >
                {isGeneratingSummary ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('speedReader.generating')}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    {t('speedReader.aiSummaryBtn')}
                  </>
                )}
              </button>
              <button
                onClick={handleToggleFullscreen}
                className="p-3 bg-cinema-gray hover:bg-cinema-gray-light rounded-lg transition-colors"
                title={t('speedReader.fullscreen')}
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
                onClick={toggleFocusMode}
                className="px-4 py-2 bg-cinema-gray hover:bg-cinema-gray-light text-cinema-text rounded-lg text-sm transition-colors"
              >
                {t('speedReader.focusMode')}
              </button>
              <button
                onClick={toggleSettings}
                className="p-3 bg-cinema-gray hover:bg-cinema-gray-light rounded-lg transition-colors"
                title={t('speedReader.settings')}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81a.488.488 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6-3.6z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reader Display - The Heart of RSVP */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {/* Reticle Guide (Vertical Center Line) - Hide in fullscreen */}
        {!isFullscreen && (
          <div className="absolute top-0 bottom-0 left-1/2 w-px bg-current opacity-10 pointer-events-none" style={{ color: 'var(--reader-accent)' }} />
        )}

        {/* Word Display with Pixel-Perfect ORP Alignment */}
        <div className="text-center relative" ref={wordDisplayRef}>
          {currentWord && (
            <div
              className="inline-block select-none transition-opacity duration-150"
              style={{
                fontFamily: fontFamilyMap[fontFamily] || fontFamilyMap['Courier Prime'],
                fontSize: `${fontSize}px`,
                fontWeight: fontWeight,
                letterSpacing: letterSpacingMap[letterSpacing] || '0',
                transform: wordTransform,
                opacity: 1,
              }}
            >
              {/* Characters before ORP */}
              <span style={{ color: 'var(--reader-text-dim)' }}>
                {currentWord.substring(0, orpIndex)}
              </span>
              {/* ORP Character (Pivot/Focus) */}
              <span style={{ color: 'var(--reader-accent)', fontWeight: 700 }}>
                {currentWord[orpIndex]}
              </span>
              {/* Characters after ORP */}
              <span style={{ color: 'var(--reader-text-dim)' }}>
                {currentWord.substring(orpIndex + 1)}
              </span>
            </div>
          )}


        </div>

        {/* Zen Mode Floating Controls - HIDDEN in fullscreen */}
        {focusMode && !isFullscreen && (
          <div
            className={`absolute top-4 right-4 flex gap-2 transition-opacity duration-500 ${mouseIdle ? 'opacity-0 pointer-events-none' : 'opacity-100'
              }`}
          >
            <button
              onClick={togglePlay}
              className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur rounded-lg transition-colors"
              title={t('speedReader.playPause')}
            >
              {isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <button
              onClick={handleToggleFullscreen}
              className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur rounded-lg transition-colors"
              title={t('speedReader.fullscreen')}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
              </svg>
            </button>
            <button
              onClick={toggleSettings}
              className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur rounded-lg transition-colors"
              title={t('speedReader.settings')}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81a.488.488 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
              </svg>
            </button>
            <button
              onClick={toggleFocusMode}
              className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur rounded-lg transition-colors"
              title={t('speedReader.exitFocus')}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>
        )}

        {/* Keyboard shortcuts hint - Hidden in fullscreen */}
        {focusMode && !isPlaying && !mouseIdle && !isFullscreen && (
          <div
            className="absolute bottom-8 text-center text-sm transition-opacity duration-500"
            style={{ color: 'var(--reader-text-dim)' }}
          >
            <div className="mb-2">
              <kbd className="px-2 py-1 bg-white/10 rounded">{t('speedReader.shortcuts.space')}</kbd> {t('speedReader.shortcuts.playPause')}
            </div>
            <div className="text-xs flex items-center justify-center gap-4 flex-wrap">
              <span>
                <kbd className="px-2 py-1 bg-white/10 rounded">← →</kbd> {t('speedReader.shortcuts.skip')}
              </span>
              <span>
                <kbd className="px-2 py-1 bg-white/10 rounded">HOME</kbd> {t('speedReader.shortcuts.reset')}
              </span>
              <span>
                <kbd className="px-2 py-1 bg-white/10 rounded">F</kbd> {t('speedReader.shortcuts.fullscreen')}
              </span>
              <span>
                <kbd className="px-2 py-1 bg-white/10 rounded">S</kbd> {t('speedReader.shortcuts.settings')}
              </span>
              <span>
                <kbd className="px-2 py-1 bg-white/10 rounded">[ ]</kbd> {t('speedReader.shortcuts.focus')}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Timeline - Page-based Scrubber - Hidden only in fullscreen */}
      {!isFullscreen && activeWords.length > 0 && (
        <ReadingTimeline
          words={activeWords}
          currentWordIndex={currentWordIndex}
          onSeek={setCurrentWordIndex}
        />
      )}
    </div>
  );
}
