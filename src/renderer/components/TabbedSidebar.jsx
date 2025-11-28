import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useScriptStore } from '../store/scriptStore';
import ScriptNavigationPanel from './ScriptNavigationPanel';
import Sidebar from './Sidebar';

export default function TabbedSidebar() {
  const [activeTab, setActiveTab] = useState('scripts');
  const { scripts, setCurrentView } = useScriptStore();
  const { t } = useTranslation();

  const handleViewChange = (view) => {
    setCurrentView(view);
  };

  const tabs = [
    {
      id: 'scripts',
      label: t('sidebar.scriptsTab', 'Senaryolar'),
      icon: '📚',
      count: scripts.length,
      component: ScriptNavigationPanel
    },
    {
      id: 'settings',
      label: t('sidebar.infoTab', 'Bilgiler'),
      icon: '📋',
      component: Sidebar
    }
  ];

  return (
    <div className="bg-cinema-dark border-r border-cinema-gray overflow-hidden flex flex-col">
      {/* Tab Headers */}
      <div className="flex-shrink-0 border-b border-cinema-gray">
        <div className="flex">
          {tabs.map((tab) => {
            const TabComponent = tab.component;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-cinema-accent bg-cinema-accent/10'
                    : 'text-cinema-text-dim hover:text-cinema-text hover:bg-cinema-gray/30'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-base">{tab.icon}</span>
                  <span className="hidden md:inline">{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="bg-cinema-accent text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] h-[18px] flex items-center justify-center">
                      {tab.count}
                    </span>
                  )}
                </div>
                
                {/* Active indicator */}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cinema-accent"></div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {tabs.map((tab) => {
          const TabComponent = tab.component;
          return (
            <div 
              key={tab.id}
              className={`h-full ${activeTab === tab.id ? 'block' : 'hidden'}`}
            >
              <TabComponent />
            </div>
          );
        })}
      </div>

      {/* Quick Actions Footer */}
      <div className="flex-shrink-0 border-t border-cinema-gray p-3">
        {activeTab === 'scripts' ? (
          <button
            onClick={() => setCurrentView('uploader')}
            className="w-full btn-primary text-sm flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            {t('sidebar.addScript', 'Senaryo Ekle')}
          </button>
        ) : (
          <div className="text-center">
            <p className="text-xs text-cinema-text-dim mb-2">
              {t('sidebar.settingsInfo', 'AI ve uygulama ayarlarını yönetin')}
            </p>
            <div className="flex justify-center gap-2">
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('openUnifiedSettings', {
                    detail: { activeTab: 'ai' }
                  }));
                }}
                className="text-xs px-3 py-1.5 bg-cinema-gray hover:bg-cinema-gray-light border border-cinema-gray-light rounded text-cinema-text transition-colors"
              >
                {t('sidebar.aiSettings', 'AI Ayarları')}
              </button>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('openUnifiedSettings', {
                    detail: { activeTab: 'reader' }
                  }));
                }}
                className="text-xs px-3 py-1.5 bg-cinema-gray hover:bg-cinema-gray-light border border-cinema-gray-light rounded text-cinema-text transition-colors"
              >
                {t('sidebar.readerSettings', 'Okuyucu')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}