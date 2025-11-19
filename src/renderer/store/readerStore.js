import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useReaderStore = create(
  persist(
    (set, get) => ({
      // Reader settings
      wpm: 250, // Words per minute
      isPlaying: false,
      currentWordIndex: 0,
      words: [], // Array of word objects: {id, word, page, originalIndex}

      // Reader configuration
      fontSize: 48,
      focusMode: true,
      showProgress: true,
      isFullscreen: false,
      orpOffset: 0, // -3 to +3, adjust the ORP position left or right
      showSettings: false,

      // Additional reader settings for UnifiedSettings compatibility
      wordsPerMinute: 200,
      highlightColor: '#ffd700',
      wordFilter: [],

      // Advanced Typography Settings
      fontFamily: 'Courier Prime', // 'Courier Prime' | 'Roboto Mono' | 'Fira Code' | 'OpenDyslexic' | 'JetBrains Mono'
      fontWeight: 400, // 300 | 400 | 500 | 700
      letterSpacing: 'normal', // 'tight' | 'normal' | 'relaxed' | 'wide'
      theme: 'cinema', // 'cinema' | 'paper' | 'hacker' | 'eink'

          // Blacklist for word filtering
      blacklist: [], // Array of strings to filter out (e.g., ['KESME', 'DIŞ', 'GÜN'])

      // Actions
      setWPM: (wpm) => set({ wpm }),

      // UnifiedSettings compatibility functions
      setWordsPerMinute: (wpm) => set({ wordsPerMinute: wpm, wpm }),
      setHighlightColor: (color) => set({ highlightColor: color }),
      setWordFilter: (filter) => set({ wordFilter: filter }),

      setWords: (input) => {
        // Accept either array of word objects or text string
        let words;
        if (Array.isArray(input)) {
          words = input; // Already parsed word objects with metadata
        } else {
          // Legacy support: split text into simple strings
          words = input.split(/\s+/).filter(word => word.length > 0);
        }
        set({ words, currentWordIndex: 0, isPlaying: false });
      },

      play: () => set({ isPlaying: true }),

      pause: () => set({ isPlaying: false }),

      togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

      setCurrentWordIndex: (index) => set({ currentWordIndex: index }),

      nextWord: () => set((state) => {
        const nextIndex = state.currentWordIndex + 1;
        if (nextIndex >= state.words.length) {
          return { currentWordIndex: nextIndex, isPlaying: false };
        }
        return { currentWordIndex: nextIndex };
      }),

      previousWord: () => set((state) => ({
        currentWordIndex: Math.max(0, state.currentWordIndex - 1),
      })),

      reset: () => set({ currentWordIndex: 0, isPlaying: false }),

      jumpTo: (index) => set({
        currentWordIndex: Math.max(0, Math.min(index, get().words.length - 1)),
      }),

      setFontSize: (size) => set({ fontSize: size }),

      toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),

      toggleShowProgress: () => set((state) => ({ showProgress: !state.showProgress })),

      setFullscreen: (isFullscreen) => set({ isFullscreen }),

      setORPOffset: (offset) => set({ orpOffset: Math.max(-3, Math.min(3, offset)) }),

      adjustORPLeft: () => set((state) => ({ 
        orpOffset: Math.max(-3, state.orpOffset - 1) 
      })),

      adjustORPRight: () => set((state) => ({ 
        orpOffset: Math.min(3, state.orpOffset + 1) 
      })),

      resetORPOffset: () => set({ orpOffset: 0 }),

      toggleSettings: () => set((state) => ({ showSettings: !state.showSettings })),

      setShowSettings: (show) => set({ showSettings: show }),

      // Advanced Typography Actions
      setFontFamily: (fontFamily) => set({ fontFamily }),

      setFontWeight: (fontWeight) => set({ fontWeight }),

      setLetterSpacing: (letterSpacing) => set({ letterSpacing }),

      setTheme: (theme) => set({ theme }),

      // Blacklist Management
      addToBlacklist: (word) => set((state) => ({
        blacklist: [...new Set([...state.blacklist, word.toUpperCase()])],
      })),

      removeFromBlacklist: (word) => set((state) => ({
        blacklist: state.blacklist.filter((w) => w !== word.toUpperCase()),
      })),

      clearBlacklist: () => set({ blacklist: [] }),

      setBlacklist: (blacklist) => set({ blacklist: blacklist.map(w => w.toUpperCase()) }),

      // Get filtered words (excluding blacklist)
      getFilteredWords: () => {
        const { words, blacklist } = get();
        if (blacklist.length === 0) return words;
        return words.filter(wordObj => {
          const upperWord = wordObj.word?.toUpperCase() || wordObj.toUpperCase?.() || wordObj;
          return !blacklist.includes(upperWord);
        });
      },
    }),
    {
      name: 'scriptmaster-reader-storage',
      partialize: (state) => ({
        wpm: state.wpm,
        fontSize: state.fontSize,
        focusMode: state.focusMode,
        showProgress: state.showProgress,
        orpOffset: state.orpOffset,
        fontFamily: state.fontFamily,
        fontWeight: state.fontWeight,
        letterSpacing: state.letterSpacing,
        theme: state.theme,
        blacklist: state.blacklist,
        wordsPerMinute: state.wordsPerMinute,
        highlightColor: state.highlightColor,
        wordFilter: state.wordFilter,
      }),
    }
  )
);
