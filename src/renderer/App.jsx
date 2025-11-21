import React, { useState } from 'react';
import { useScriptStore } from './store/scriptStore';
import { useReaderStore } from './store/readerStore';
import TabbedSidebar from './components/TabbedSidebar';
import MultiScriptImporter from './components/MultiScriptImporter';
import TextEditor from './components/TextEditor';
import AnalysisPanel from './components/AnalysisPanel';
import SpeedReader from './components/SpeedReader';
import AIStoryboard from './components/SimpleStoryboard';
import Header from './components/Header';

function App() {
  const { currentView, scripts, currentScriptId, isAnalyzing, analysisProgress, getCurrentScript } = useScriptStore();
  const { isFullscreen } = useReaderStore();
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);

  const currentScript = getCurrentScript();

  // In fullscreen mode, hide everything except the reader
  if (isFullscreen && currentView === 'reader') {
    return (
      <div className="h-screen w-screen bg-cinema-black">
        <SpeedReader />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-cinema-black text-cinema-text">
      {/* Header */}
      <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {/* Global Analysis Progress Bar */}
      {isAnalyzing && analysisProgress && (
        <div className="bg-cinema-dark border-b border-cinema-gray px-4 py-3 z-10">
          <div className="flex items-center justify-between text-sm text-cinema-text-dim mb-2">
            <span className="font-medium">🎬 {analysisProgress.message}</span>
            {analysisProgress.currentChunk && analysisProgress.totalChunks && (
              <span className="text-xs">
                Chunk {analysisProgress.currentChunk} / {analysisProgress.totalChunks}
              </span>
            )}
            <span className="font-bold text-cinema-accent">{Math.round(analysisProgress.progress || 0)}%</span>
          </div>
          <div className="w-full bg-cinema-gray-light rounded-full h-2.5">
            <div
              className="bg-gradient-to-r from-cinema-accent to-cinema-accent/70 h-2.5 rounded-full transition-all duration-300 shadow-lg"
              style={{ width: `${analysisProgress.progress || 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Tabbed Navigation */}
        {sidebarOpen && (
          <TabbedSidebar />
        )}

        {/* Main Panel */}
        <div className="flex-1 overflow-hidden min-w-0">
          {/* Main Content */}
          {currentView === 'uploader' || (scripts.length === 0) ? (
            // No scripts yet or uploader view - show universal importer
            <MultiScriptImporter />
          ) : !currentScript ? (
            // Scripts exist but none selected - show universal importer  
            <MultiScriptImporter />
          ) : (
            // Script is selected - show content
            <>
              {currentView === 'editor' && <TextEditor />}
              {currentView === 'analysis' && <AnalysisPanel />}
              {currentView === 'reader' && <SpeedReader />}
              {currentView === 'scenes' && <AIStoryboard />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
