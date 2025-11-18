import React, { useState } from 'react';
import { useScriptStore } from '../store/scriptStore';
import { useAIStore } from '../store/aiStore';
import AISettings from './AISettings';

export default function Header({ sidebarOpen, setSidebarOpen }) {
  const { originalFileName, currentView, setCurrentView, clearScript } = useScriptStore();
  const { provider, isConfigured } = useAIStore();
  const [showAISettings, setShowAISettings] = useState(false);

  const views = [
    { id: 'editor', label: 'Editor', icon: '📝' },
    { id: 'analysis', label: 'Analysis', icon: '🎬' },
    { id: 'reader', label: 'Speed Reader', icon: '⚡' },
  ];

  return (
    <header className="h-16 bg-cinema-dark border-b border-cinema-gray flex items-center justify-between px-6">
      {/* Left section */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 hover:bg-cinema-gray rounded-lg transition-colors"
          title="Toggle sidebar"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        <div className="flex items-center gap-3">
          <div className="text-2xl">🎬</div>
          <div>
            <h1 className="text-xl font-bold text-cinema-accent">ScriptMaster AI</h1>
            {originalFileName && (
              <p className="text-xs text-cinema-text-dim">{originalFileName}</p>
            )}
          </div>
        </div>
      </div>

      {/* Center - View tabs */}
      {originalFileName && (
        <div className="flex gap-2 bg-cinema-gray rounded-lg p-1">
          {views.map((view) => (
            <button
              key={view.id}
              onClick={() => setCurrentView(view.id)}
              className={`px-4 py-2 rounded-md transition-all ${
                currentView === view.id
                  ? 'bg-cinema-accent text-cinema-black font-medium'
                  : 'text-cinema-text hover:bg-cinema-gray-light'
              }`}
            >
              <span className="mr-2">{view.icon}</span>
              {view.label}
            </button>
          ))}
        </div>
      )}

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* AI Settings Button */}
        <button
          onClick={() => setShowAISettings(true)}
          className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${
            isConfigured()
              ? 'bg-cinema-gray hover:bg-cinema-gray-light text-cinema-text'
              : 'bg-yellow-900/30 hover:bg-yellow-900/50 text-yellow-400'
          }`}
          title="AI Provider Settings"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <span className="text-xs font-medium hidden lg:inline">
            {provider === 'openai' && 'OpenAI'}
            {provider === 'gemini' && 'Gemini'}
            {provider === 'local' && 'Local AI'}
          </span>
          {!isConfigured() && (
            <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
            </svg>
          )}
        </button>

        {originalFileName && (
          <button
            onClick={() => {
              if (confirm('Are you sure you want to close this script?')) {
                clearScript();
              }
            }}
            className="px-4 py-2 bg-cinema-gray hover:bg-red-900/30 text-cinema-text rounded-lg transition-colors"
          >
            Close Script
          </button>
        )}
      </div>

      {/* AI Settings Modal */}
      {showAISettings && <AISettings onClose={() => setShowAISettings(false)} />}
    </header>
  );
}
