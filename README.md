# 🎬 MGXReader (ScriptMaster AI)

**Professional Screenplay Analysis & RSVP Speed Reading Tool**

Cross-platform desktop application combining AI-powered screenplay analysis with an advanced RSVP speed reader featuring pixel-perfect ORP alignment.

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)
![Electron](https://img.shields.io/badge/Electron-28.0.0-47848F)
![React](https://img.shields.io/badge/React-18.2.0-61DAFB)

---

## ✨ Features

### 🧠 Multi-AI Screenplay Analysis
- **OpenAI GPT-4/3.5** - Industry-leading AI models
- **Google Gemini 1.5 Pro** - 2M token context window for full-length screenplays
- **🍎 Apple MLX** - Ultra-fast local inference on Apple Silicon (M1/M2/M3/M4)
- **Local AI (Ollama)** - Privacy-first offline analysis

### ⚡ Professional RSVP Speed Reader
- 📄 **PDF Import**: Drag-and-drop screenplay PDFs with intelligent text extraction
- 🧹 **Text Cleaning**: Automatic removal of headers, footers, and page numbers
- **Pixel-Perfect ORP Engine** - Mathematical pivot character alignment
- **5 Professional Fonts** - Courier Prime, Roboto Mono, Fira Code, JetBrains Mono, OpenDyslexic
- **Advanced Typography** - Font weight, letter spacing, custom themes (Cinema/Paper/Hacker/E-Ink)
- **YouTube-Style Timeline** - Page-based scrubbing and navigation
- **Word Blacklist** - Filter unwanted words
- **Zen Mode** - Mouse idle detection with auto-fade UI
- **Fullscreen Minimalism** - Pure text-only display

### 📊 Production Tools
- Scene breakdown and analysis
- Character tracking
- Location management
- Equipment suggestions
- � **Production Reports**: Export analysis data to JSON

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and npm
- **Python 3.10+** (optional - for MLX support on Apple Silicon)

### Installation

```bash
# Clone the repository
git clone https://github.com/exedesign/MGXReader.git
cd MGXReader

# Install dependencies
npm install

# Start development server
npm start
```

---

## 🍎 Apple MLX Setup (Apple Silicon Only)

For ultra-fast local AI inference on M1/M2/M3/M4 Macs:

```bash
# Install MLX LM
pip install mlx-lm

# Start MLX server with recommended model
mlx_lm.server --model mlx-community/Llama-3.2-3B-Instruct-4bit

# Or with more powerful model (requires 16GB+ RAM)
mlx_lm.server --model mlx-community/Llama-3.1-8B-Instruct-4bit
```

**MLX Benefits:**
- ⚡ Lightning Fast - Optimized for Apple Silicon GPU
- 🔒 100% Private - Data never leaves your Mac
- 📴 Offline - No internet required
- 💰 Free - No API keys needed

---

## 🛠️ Tech Stack

- **Desktop**: Electron 28
- **Frontend**: React 18, Zustand (state management with persistence)
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS 3
- **PDF**: pdf-parse for text extraction
- **Fonts**: Google Fonts (5 professional monospace fonts)
- **AI Integrations**:
  - OpenAI API
  - Google Gemini API v1
  - Apple MLX (mlx-lm)
  - Ollama/LM Studio

---

## 📦 Build

```bash
# Build for production
npm run build

# Package for current platform
npm run package

# Package for specific platforms
npm run package:mac    # macOS
npm run package:win    # Windows
npm run package:linux  # Linux
```

---

## 🎯 Usage

### 1. Import Screenplay
- Drag & drop `.fountain`, `.txt`, or `.pdf` files
- Or paste text directly

### 2. AI Analysis
- Configure your preferred AI provider
- Click "Analyze Screenplay"
- Get scene breakdown, character analysis, location data

### 3. Speed Reading
- Click "Start Speed Reader"
- Adjust WPM (50-1000)
- **Keyboard shortcuts**:
  - `Space` - Play/Pause
  - `F` - Fullscreen
  - `←/→` - Navigate words
  - `↑/↓` - Adjust speed

### 4. Settings
- **Speed & Display** - WPM, font size, colors
- **Typography** - Font family, weight, spacing, themes
- **Word Filter** - Blacklist unwanted words

---

## 🔧 AI Provider Setup

### Google Gemini (Recommended for Long Scripts)
1. Get free API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click **AI Settings** in app
3. Select "Google Gemini"
4. Paste API key, choose model (Gemini 1.5 Pro recommended)
5. Test Connection → Save

### OpenAI
1. Get API key from [platform.openai.com](https://platform.openai.com/api-keys)
2. Select "OpenAI" provider
3. Choose model (GPT-4 Turbo, GPT-4, or GPT-3.5)
4. Save settings

### Apple MLX (Apple Silicon)
1. Install: `pip install mlx-lm`
2. Start server: `mlx_lm.server --model mlx-community/Llama-3.2-3B-Instruct-4bit`
3. Select "🍎 Apple MLX" provider
4. Keep default endpoint: `http://localhost:8080`
5. Test connection

### Local AI (Ollama)
1. Install [Ollama](https://ollama.com)
2. Pull model: `ollama pull llama3`
3. Select "Local AI" provider
4. Default endpoint: `http://localhost:11434`

---

## 🎨 Typography Themes

- **Cinema** - Classic screenplay aesthetic (dark with gold accents)
- **Paper** - Warm reading experience (sepia tones)
- **Hacker** - High-contrast terminal style (green on black)
- **E-Ink** - E-reader simulation (soft contrast)

---

## 🎓 ORP Algorithm

The Optimal Recognition Point (ORP) is the character where the eye naturally fixates for fastest recognition:

1. **Calculate ORP Index**:
   - Words ≤2 chars: position 0
   - Words 3-5 chars: position 1  
   - Words 6-9 chars: position 2
   - Words 10-13 chars: position 3
   - Words ≥14 chars: position 4

2. **Pixel Alignment**:
   - Measure character widths
   - Calculate translateX offset
   - Center ORP at screen center

3. **User Adjustment**: ORP Offset slider (-5 to +5)

---

## 🤝 Contributing

Contributions welcome! Please feel free to submit a Pull Request.

---

## 📄 License

MIT License

---

## 🙏 Acknowledgments

- Fountain screenplay format
- RSVP research and cognitive science community
- MLX team at Apple
- Open-source AI models (Meta Llama, Mistral AI, Google Gemma)

---

**Made with ❤️ for screenwriters, speed readers, and AI enthusiasts**

🎬 **Happy Reading & Writing!** 🚀
