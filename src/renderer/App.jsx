import React, { useState } from 'react';
import { useScriptStore } from './store/scriptStore';
import { useReaderStore } from './store/readerStore';
import Sidebar from './components/Sidebar';
import PDFUploader from './components/PDFUploader';
import TextEditor from './components/TextEditor';
import AnalysisPanel from './components/AnalysisPanel';
import SpeedReader from './components/SpeedReader';
import Header from './components/Header';

function App() {
  const { scriptText, currentView } = useScriptStore();
  const { isFullscreen } = useReaderStore();
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);

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

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Responsive */}
        {sidebarOpen && (
          <div className="w-64 md:w-72 lg:w-80 bg-cinema-dark border-r border-cinema-gray overflow-y-auto flex-shrink-0">
            <Sidebar />
          </div>
        )}

        {/* Main Panel - Responsive */}
        <div className="flex-1 overflow-hidden min-w-0">
          {!scriptText ? (
            <PDFUploader />
          ) : (
            <>
              {currentView === 'editor' && <TextEditor />}
              {currentView === 'analysis' && <AnalysisPanel />}
              {currentView === 'reader' && <SpeedReader />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
