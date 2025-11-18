# 🎬 ScriptMaster AI v2.0 - Professional Screenplay Analysis & RSVP Reader

**The Ultimate Cross-Platform Desktop App for Screenplay Professionals**

Built with Electron.js + React + Tailwind CSS | AI-Powered | Privacy-First Architecture

---

## 🌟 What's New in v2.0 (18 Kasım 2025)

### 🎨 **Professional Typography Engine**
- **5 Carefully Selected Monospace Fonts:**
  - Courier Prime (Industry Standard)
  - Roboto Mono (Modern & Clean)
  - Fira Code (High Clarity)
  - OpenDyslexic (Accessibility)
  - JetBrains Mono (Ergonomic)
  
- **Dynamic Settings:**
  - Font Size: 24px - 128px
  - Font Weight: Light / Normal / Medium / Bold
  - Letter Spacing: Tight / Normal / Relaxed / Wide

### 🎨 **4 Scientific Color Themes**
- **Cinema Mode:** Black background, white text (default)
- **Paper Mode:** Sepia background, brown text (eye-friendly)
- **Hacker Mode:** Matrix-style green on black
- **E-Ink Mode:** Pure white background, black text

### ⚡ **Pixel-Perfect ORP Alignment**
- Mathematically precise pivot character centering
- `transform: translateX()` for fluid positioning
- User-adjustable ORP offset: -3 to +3
- Guaranteed monospace font alignment

### 📊 **YouTube-Style Timeline Navigation**
- Page-based scrubber with vertical ticks
- Click to jump to any page instantly
- Hover tooltips showing page numbers
- Progress percentage and remaining word count

### 🚫 **Smart Word Blacklist System**
- Filter screenplay markers: "INT", "EXT", "FADE IN", "CUT TO"
- Live filtering without flow interruption
- Quick presets: Scene Headers, Transitions
- Case-insensitive, persistent storage

### 🧘 **Zen Mode 2.0**
- Mouse idle detection (2 seconds)
- UI auto-fades out for maximum focus
- Only ORP text and center reticle remain
- Fade-in on mouse movement

### 💾 **Persistent Settings**
- Zustand middleware with LocalStorage
- All preferences saved automatically
- Survives app restarts
- No data loss

---

## 🚀 Quick Start

### Installation
```bash
# Clone repository
git clone <repository-url>
cd MGXReader

# Install dependencies
npm install

# Start application
npm start
```

### First Use
1. **Upload PDF:** Drag & drop a screenplay PDF
2. **Clean Text:** Click "Clean Text" in Editor tab
3. **Configure AI:** Set up OpenAI/Gemini/Local AI (optional)
4. **Start Reading:** Switch to "Speed Reader" tab
5. **Customize:** Press `S` for settings, choose your font/theme

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `SPACE` | Play / Pause |
| `HOME` | Reset to beginning |
| `← →` | Skip 10 words backward/forward |
| `F` | Toggle fullscreen |
| `S` | Open settings panel |
| `[ ]` | Adjust ORP focus left/right |
| `ESC` | Exit fullscreen |

---

## 📁 Project Structure

```
MGXReader/
├── src/
│   ├── electron/
│   │   ├── main.js              # Electron main process
│   │   └── preload.js           # IPC bridge
│   └── renderer/
│       ├── components/
│       │   ├── SpeedReader.jsx  # ⭐ RSVP Engine (v2.0)
│       │   ├── ReaderSettings.jsx # Advanced Settings Panel
│       │   ├── ReadingTimeline.jsx # YouTube-style Scrubber
│       │   ├── AISettings.jsx   # Multi-provider AI config
│       │   ├── TextEditor.jsx   # PDF text cleaning
│       │   └── AnalysisPanel.jsx # AI screenplay breakdown
│       ├── store/
│       │   ├── readerStore.js   # ⭐ Zustand store with persist
│       │   ├── scriptStore.js   # Script data management
│       │   └── aiStore.js       # AI provider config
│       ├── utils/
│       │   ├── textProcessing.js # ⭐ parseWordsWithMetadata()
│       │   ├── aiHandler.js     # Unified AI gateway
│       │   └── aiService2.js    # AI integration wrapper
│       └── styles/
│           └── fonts.css        # ⭐ Typography system
├── index.html                   # ⭐ Google Fonts import
├── package.json
├── TESTING_GUIDE.md            # ⭐ Comprehensive test scenarios
└── README.md
```

---

## 🧪 Testing

See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for:
- 10 detailed test scenarios
- Edge case handling
- Performance benchmarks
- Troubleshooting guide

**Quick Test:**
```bash
npm start
# 1. Upload PDF
# 2. Go to Speed Reader
# 3. Press S → Typography → Change font
# 4. Press SPACE to play
# 5. Press [ ] to adjust ORP
```

---

## 🎯 Core Features

### 1. PDF Processing
- ✅ Drag & drop upload
- ✅ Advanced text cleaning (headers, footers, page numbers)
- ✅ Scene parsing (INT./EXT. detection)
- ✅ Character extraction
- ✅ Duration estimation

### 2. AI Integration (Multi-Provider)
- ✅ **OpenAI:** GPT-4 Turbo, GPT-3.5
- ✅ **Google Gemini:** 1.5 Pro (1M token context!)
- ✅ **Local AI:** Ollama/LM Studio (privacy mode)
- ✅ Grammar correction
- ✅ Screenplay analysis (scenes, locations, characters, equipment)

### 3. RSVP Speed Reader (v2.0)
- ✅ Variable WPM: 100 - 1000
- ✅ Pixel-perfect ORP alignment
- ✅ 5 professional fonts
- ✅ 4 scientific themes
- ✅ Page-based timeline
- ✅ Word blacklist filtering
- ✅ Zen Mode with mouse idle
- ✅ Fullscreen support

### 4. State Management
- ✅ Zustand stores with persist
- ✅ LocalStorage integration
- ✅ Automatic saving
- ✅ No data loss on restart

---

## 🏗️ Architecture Highlights

### AI Gateway Pattern
```javascript
// Unified interface for 3 providers
AIHandler.generateText(systemPrompt, userPrompt, options)
  → callOpenAI() | callGemini() | callLocalAI()
```

### ORP Calculation Algorithm
```javascript
calculateORP(word) {
  // Base ORP by word length
  const baseORP = wordLengthMap[word.length];
  // Apply user offset
  const adjusted = baseORP + orpOffset;
  // Clamp to valid range
  return clamp(adjusted, 0, word.length - 1);
}

calculateTransform(word, orpIndex) {
  // Monospace character width
  const charWidth = fontSize * 0.6;
  // Center the pivot character
  const offset = -(orpIndex * charWidth) + ...;
  return `translateX(${offset}px)`;
}
```

### Word Metadata Structure
```javascript
{
  id: "word-1234-timestamp-random9",
  word: "ACTION",
  page: 42,
  originalIndex: 1337
}
```

---

## 🔧 Configuration

### Vite Config (Hot Module Replacement)
```javascript
// vite.config.js
export default defineConfig({
  plugins: [react()],
  server: { port: 3000 },
  build: { outDir: 'build' }
});
```

### Tailwind Custom Theme
```javascript
// tailwind.config.js
theme: {
  extend: {
    colors: {
      'cinema-black': '#0a0a0a',
      'cinema-accent': '#d4af37', // Gold
      // ... 12 custom colors
    }
  }
}
```

### Electron Security
```javascript
// main.js
webPreferences: {
  contextIsolation: true,
  nodeIntegration: false,
  preload: path.join(__dirname, 'preload.js')
}
```

---

## 📦 Build & Distribution

### Development
```bash
npm start              # Start dev server + Electron
npm run start:react    # Vite dev server only
```

### Production Build
```bash
npm run build          # Build React app
npm run electron-build # Package for macOS/Windows/Linux
```

### Output
- **macOS:** `.dmg` installer
- **Windows:** `.exe` installer  
- **Linux:** `.AppImage` / `.deb`

---

## 🐛 Troubleshooting

### Issue: Speed Reader shows "Loading screenplay..."
**Solution:** Upload a PDF first in the "Editor" tab.

### Issue: Fonts not loading
**Solution:** Check `index.html` for Google Fonts CDN links. Clear cache with `Cmd+Shift+R`.

### Issue: Settings not persisting
**Solution:** Check browser console for LocalStorage errors. Verify `zustand/middleware` is installed.

### Issue: Timeline clicks go to wrong position
**Solution:** Ensure `parseWordsWithMetadata()` is used instead of simple `text.split()`.

---

## 🛣️ Roadmap

### v2.1 (Upcoming)
- [ ] Voice Reading (TTS integration)
- [ ] Multi-language support (Turkish, French)
- [ ] Cloud sync for settings
- [ ] Export reading statistics

### v3.0 (Future)
- [ ] Mobile app (React Native)
- [ ] Collaborative reading mode
- [ ] Reading heatmap analytics
- [ ] Bionic reading mode

---

## 📄 License

MIT License - See LICENSE file

---

## 👥 Contributors

- **Developer:** ScriptMaster AI Team
- **AI Assistant:** GitHub Copilot
- **Date:** 18 Kasım 2025

---

## 🙏 Credits

**Fonts:**
- Courier Prime by Quote-Unquote Apps
- Roboto Mono by Google
- Fira Code by Nikita Prokopov
- OpenDyslexic by Abbie Gonzalez
- JetBrains Mono by JetBrains

**Libraries:**
- Electron.js, React, Tailwind CSS
- Zustand, pdf-parse
- OpenAI SDK, Google Generative AI

---

## 📞 Support

- 📧 Email: support@scriptmaster-ai.com
- 🐛 Issues: GitHub Issues
- 📖 Docs: [TESTING_GUIDE.md](./TESTING_GUIDE.md)
- 💬 Discord: Coming soon

---

**Made with ❤️ for Screenplay Professionals**

*"Read faster, understand better, create brilliantly."*
