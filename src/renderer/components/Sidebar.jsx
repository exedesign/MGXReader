import React from 'react';
import { useTranslation } from 'react-i18next';
import { useScriptStore } from '../store/scriptStore';
import { useReaderStore } from '../store/readerStore';
import { parseScenes, extractCharacters } from '../utils/textProcessing';

export default function Sidebar() {
  const { t } = useTranslation();
  const { scriptText, cleanedText, pageCount, scenes } = useScriptStore();
  const { words, wpm } = useReaderStore();

  // Parse scenes if not already done
  const sceneList = scenes.length > 0 ? scenes : parseScenes(cleanedText || scriptText);
  const characters = extractCharacters(cleanedText || scriptText);

  // Calculate reading statistics
  const calculateReadingStats = () => {
    const text = cleanedText || scriptText;
    if (!text) return null;

    const wordCount = words.length > 0 ? words.length : text.split(/\s+/).length;

    // Traditional reading speeds (words per minute)
    const traditionalWPM = 200; // Average adult reading speed
    const slowWPM = 150; // Slow reader
    const fastWPM = 300; // Fast reader

    // Current speed reading WPM
    const speedReadingWPM = wpm;

    // Calculate reading times in minutes
    const traditionalTime = wordCount / traditionalWPM;
    const slowTime = wordCount / slowWPM;
    const fastTime = wordCount / fastWPM;
    const speedTime = wordCount / speedReadingWPM;

    // Calculate time saved
    const timeSavedVsTraditional = traditionalTime - speedTime;
    const timeSavedVsSlow = slowTime - speedTime;
    const timeSavedVsFast = fastTime - speedTime;

    // Calculate per-page reading times
    const wordsPerPage = wordCount / Math.max(pageCount, 1);
    const traditionalPageTime = wordsPerPage / traditionalWPM;
    const speedPageTime = wordsPerPage / speedReadingWPM;

    return {
      wordCount,
      traditionalTime,
      slowTime,
      fastTime,
      speedTime,
      timeSavedVsTraditional,
      timeSavedVsSlow,
      timeSavedVsFast,
      traditionalPageTime,
      speedPageTime,
      wordsPerPage: Math.round(wordsPerPage),
    };
  };

  const formatTime = (minutes) => {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const stats = calculateReadingStats();

  return (
    <div className="p-4 h-full overflow-y-auto">
      {/* Script Info */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-cinema-accent mb-3">{t('sidebar.scriptInfo')}</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-cinema-text-dim">{t('sidebar.pages')}:</span>
            <span className="text-cinema-text font-medium">{pageCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-cinema-text-dim">{t('sidebar.estRuntime')}:</span>
            <span className="text-cinema-text font-medium">~{pageCount} min</span>
          </div>
          {stats && (
            <div className="flex justify-between">
              <span className="text-cinema-text-dim">{t('sidebar.totalWords')}:</span>
              <span className="text-cinema-text font-medium">{stats.wordCount.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Reading Times Analysis */}
      {stats && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-cinema-accent mb-3">📖 {t('sidebar.readingTimes')}</h2>
          <div className="space-y-4">
            {/* Traditional vs Speed Reading Comparison */}
            <div className="bg-cinema-dark p-4 rounded-lg border border-cinema-gray">
              <h3 className="text-sm font-bold text-cinema-text mb-3">📚 {t('sidebar.traditionalReading')}</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-cinema-text-dim">{t('sidebar.normal')}:</span>
                  <span className="text-cinema-text">{formatTime(stats.traditionalTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cinema-text-dim">{t('sidebar.slow')}:</span>
                  <span className="text-cinema-text">{formatTime(stats.slowTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cinema-text-dim">{t('sidebar.fast')}:</span>
                  <span className="text-cinema-text">{formatTime(stats.fastTime)}</span>
                </div>
                <div className="border-t border-cinema-gray pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="text-cinema-text-dim">{t('sidebar.perPage')}:</span>
                    <span className="text-cinema-text">{formatTime(stats.traditionalPageTime)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Speed Reading Stats */}
            <div className="bg-cinema-accent/10 p-4 rounded-lg border border-cinema-accent/30">
              <h3 className="text-sm font-bold text-cinema-accent mb-3">⚡ {t('sidebar.speedReading')} ({wpm} WPM)</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-cinema-text-dim">{t('sidebar.totalTime')}:</span>
                  <span className="text-cinema-accent font-bold">{formatTime(stats.speedTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cinema-text-dim">{t('sidebar.perPage')}:</span>
                  <span className="text-cinema-accent font-bold">{formatTime(stats.speedPageTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cinema-text-dim">{t('sidebar.wordsPerPage')}:</span>
                  <span className="text-cinema-text">{stats.wordsPerPage}</span>
                </div>
              </div>
            </div>

            {/* Time Saved Analysis */}
            <div className="bg-green-900/20 p-4 rounded-lg border border-green-500/30">
              <h3 className="text-sm font-bold text-green-400 mb-3">💾 {t('sidebar.timeSaved')}</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-cinema-text-dim">{t('sidebar.vsNormal')}:</span>
                  <span className="text-green-400 font-bold">
                    {stats.timeSavedVsTraditional > 0 ? '+' : ''}{formatTime(Math.abs(stats.timeSavedVsTraditional))}
                    {stats.timeSavedVsTraditional < 0 && ` ${t('sidebar.slower')}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cinema-text-dim">{t('sidebar.vsSlow')}:</span>
                  <span className="text-green-400 font-bold">
                    {stats.timeSavedVsSlow > 0 ? '+' : ''}{formatTime(Math.abs(stats.timeSavedVsSlow))}
                    {stats.timeSavedVsSlow < 0 && ` ${t('sidebar.slower')}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cinema-text-dim">{t('sidebar.vsFast')}:</span>
                  <span className="text-green-400 font-bold">
                    {stats.timeSavedVsFast > 0 ? '+' : ''}{formatTime(Math.abs(stats.timeSavedVsFast))}
                    {stats.timeSavedVsFast < 0 && ` ${t('sidebar.slower')}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Efficiency Stats */}
            <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-500/30">
              <h3 className="text-sm font-bold text-blue-400 mb-3">📊 {t('sidebar.efficiency')}</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-cinema-text-dim">{t('sidebar.speedMultiplier')}:</span>
                  <span className="text-blue-400 font-bold">
                    {(wpm / 200).toFixed(1)}x {t('sidebar.faster')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cinema-text-dim">{t('sidebar.pagesPerHour')}:</span>
                  <span className="text-blue-400 font-bold">
                    {Math.round(60 / stats.speedPageTime)} {t('sidebar.pages').toLowerCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-cinema-text-dim">{t('sidebar.productivityBoost')}:</span>
                  <span className="text-blue-400 font-bold">
                    {Math.round(((stats.traditionalTime - stats.speedTime) / stats.traditionalTime) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
