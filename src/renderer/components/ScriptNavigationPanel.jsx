import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useScriptStore } from '../store/scriptStore';

export default function ScriptNavigationPanel() {
  const [expandedSeries, setExpandedSeries] = useState(new Set());
  const [expandedScripts, setExpandedScripts] = useState(new Set());
  const [showImported, setShowImported] = useState(true);
  const [sortBy, setSortBy] = useState('recent'); // 'recent', 'name', 'type'
  
  // 🔧 Resizable panel state
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem('scriptPanelWidth');
    return saved ? parseInt(saved) : 320;
  });
  const [isResizing, setIsResizing] = useState(false);
  
  const { 
    scripts, 
    currentScriptId, 
    switchToScript, 
    removeScript,
    currentView,
    setCurrentView,
    getGroupedScripts
  } = useScriptStore();
  const { t } = useTranslation();

  // 💾 Panel width'i localStorage'a kaydet
  useEffect(() => {
    localStorage.setItem('scriptPanelWidth', panelWidth.toString());
  }, [panelWidth]);

  // 📱 Responsive breakpoints
  const isNarrow = panelWidth < 280;
  const isMedium = panelWidth >= 280 && panelWidth < 350;
  const isWide = panelWidth >= 350;

  // 🖱️ Resize handlers - Basit ve güvenilir sistem
  const handleMouseDown = useCallback((e) => {
    console.log('🔧 Resize start');
    e.preventDefault();
    setIsResizing(true);
    
    const handleMouseMove = (moveEvent) => {
      if (moveEvent.clientX >= 250 && moveEvent.clientX <= 600) {
        setPanelWidth(moveEvent.clientX);
        console.log('🔧 Resize move:', moveEvent.clientX);
      }
    };

    const handleMouseUp = () => {
      console.log('🔧 Resize end');
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  // 🧹 Cleanup - Sadece component unmount
  useEffect(() => {
    return () => {
      setIsResizing(false);
    };
  }, []);

  // Group and sort scripts with enhanced project grouping
  const organizedScripts = useMemo(() => {
    const { grouped, ungrouped } = getGroupedScripts();
    const projects = {};
    const standalone = ungrouped;

    // Process grouped scripts (projects with chapters/episodes)
    Object.keys(grouped).forEach(projectTitle => {
      const projectScripts = grouped[projectTitle];
      
      projects[projectTitle] = {
        title: projectTitle,
        type: projectScripts[0]?.structure?.type || 'series',
        scripts: projectScripts,
        totalChapters: projectScripts.length,
        totalScenes: projectScripts.reduce((sum, script) => sum + (script.structure?.scenes?.length || 0), 0),
        totalCharacters: new Set(),
        latestUpdate: null,
        firstChapter: Math.min(...projectScripts.map(s => s.structure?.chapterNumber || s.structure?.episodeNumber || 1)),
        lastChapter: Math.max(...projectScripts.map(s => s.structure?.chapterNumber || s.structure?.episodeNumber || 1))
      };
      
      // Collect unique characters
      projectScripts.forEach(script => {
        script.characters?.forEach(char => 
          projects[projectTitle].totalCharacters.add(char.name || char)
        );
      });
      
      // Find latest update
      const scriptUpdates = projectScripts.map(s => new Date(s.updatedAt));
      projects[projectTitle].latestUpdate = new Date(Math.max(...scriptUpdates));
    });

    // Convert to arrays for sorting
    const projectsArray = Object.values(projects);
    
    // Sort by selected method
    const sortFn = (a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.title || a.fileName || '').localeCompare(b.title || b.fileName || '');
        case 'type':
          return (a.type || a.structure?.type || 'single').localeCompare(b.type || b.structure?.type || 'single');
        case 'recent':
        default:
          const dateA = new Date(a.latestUpdate || a.updatedAt || a.createdAt);
          const dateB = new Date(b.latestUpdate || b.updatedAt || b.createdAt);
          return dateB - dateA;
      }
    };

    projectsArray.sort(sortFn);
    standalone.sort(sortFn);

    return { projects: projectsArray, standalone };
  }, [scripts, sortBy, getGroupedScripts]);

  const toggleProject = (projectTitle) => {
    const newExpanded = new Set(expandedSeries);
    if (newExpanded.has(projectTitle)) {
      newExpanded.delete(projectTitle);
    } else {
      newExpanded.add(projectTitle);
    }
    setExpandedSeries(newExpanded);
  };

  const toggleScript = (scriptId) => {
    const newExpanded = new Set(expandedScripts);
    if (newExpanded.has(scriptId)) {
      newExpanded.delete(scriptId);
    } else {
      newExpanded.add(scriptId);
    }
    setExpandedScripts(newExpanded);
  };

  const selectScript = (scriptId) => {
    switchToScript(scriptId);
    if (currentView === 'uploader') {
      setCurrentView('editor');
    }
  };

  const getScriptIcon = (script) => {
    if (script.structure?.type === 'series') {
      return '📺';
    } else if (script.structure?.scenes?.length > 10) {
      return '🎬'; // Movie
    } else {
      return '📝'; // Short script
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Bugün';
    if (diffDays === 1) return 'Dün';
    if (diffDays < 7) return `${diffDays} gün önce`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} hafta önce`;
    return date.toLocaleDateString('tr-TR', { 
      day: 'numeric', 
      month: 'short'
    });
  };

  if (!scripts.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-cinema-text-dim">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-sm mb-2">{t('scriptNav.noScripts', 'Henüz senaryo yok')}</p>
          <p className="text-xs opacity-75">{t('scriptNav.importFirst', 'Senaryo eklemek için içe aktarma yapın')}</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="h-full flex relative bg-cinema-dark border-r border-cinema-gray overflow-hidden"
      style={{ 
        width: `${panelWidth}px`,
        minWidth: '250px',
        maxWidth: '600px'
      }}
    >
      {/* Main Panel Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b border-cinema-gray">
          <div className="flex items-center justify-between mb-3">
            <h2 className={`font-bold text-cinema-text flex items-center gap-2 truncate ${
              isNarrow ? 'text-base' : 'text-lg'
            }`}>
              <svg className={`text-cinema-accent flex-shrink-0 ${
                isNarrow ? 'w-4 h-4' : 'w-5 h-5'
              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="truncate">
                {isNarrow ? t('scriptNav.titleShort', 'Senaryo') : t('scriptNav.title', 'Senaryolar')}
              </span>
            </h2>
            <span className={`bg-cinema-accent text-white rounded flex-shrink-0 ${
              isNarrow ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs'
            }`}>
              {scripts.length}
            </span>
          </div>

        {/* Controls */}
        <div className="space-y-2">
          <div className={`flex gap-2 ${isNarrow ? 'flex-col' : ''}`}>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={`flex-1 px-2 py-1.5 bg-cinema-gray border border-cinema-gray-light rounded text-cinema-text focus:ring-2 focus:ring-cinema-accent focus:outline-none ${
                isNarrow ? 'text-xs' : 'text-xs'
              }`}
            >
              <option value="recent">{isNarrow ? t('scriptNav.sortRecentShort', 'Son') : t('scriptNav.sortRecent', 'Son güncellenen')}</option>
              <option value="name">{t('scriptNav.sortName', 'İsim')}</option>
              <option value="type">{t('scriptNav.sortType', 'Tür')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Scripts List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Projects (grouped scripts like "GUSTAV MAIER'IN TUHAF ÖYKÜSÜ") */}
        {organizedScripts.projects.map((project) => (
          <div key={project.title} className="border-b border-cinema-gray/50">
            {/* Project Header */}
            <button
              onClick={() => toggleProject(project.title)}
              className="w-full p-3 text-left hover:bg-cinema-gray/30 transition-colors flex items-center gap-2"
            >
              <svg 
                className={`text-cinema-text-dim transition-transform flex-shrink-0 ${
                  expandedSeries.has(project.title) ? 'rotate-90' : ''
                } ${isNarrow ? 'w-3 h-3' : 'w-4 h-4'}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className={isNarrow ? 'text-base' : 'text-lg'}>📚</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className={`font-medium text-cinema-text truncate ${
                    isNarrow ? 'text-xs' : 'text-sm'
                  }`}>
                    {project.title}
                  </h3>
                  <span className={`bg-purple-500/20 text-purple-400 rounded flex-shrink-0 ${
                    isNarrow ? 'px-1 py-0.5 text-xs' : 'px-1.5 py-0.5 text-xs'
                  }`}>
                    {project.totalChapters} {isNarrow ? 'böl' : 'bölüm'}
                  </span>
                  {project.firstChapter !== project.lastChapter && (
                    <span className="text-xs bg-cinema-accent/20 text-cinema-accent px-1.5 py-0.5 rounded">
                      {project.firstChapter}-{project.lastChapter}
                    </span>
                  )}
                </div>
                <p className="text-xs text-cinema-text-dim">
                  {project.totalScenes} sahne • {project.totalCharacters.size} karakter
                </p>
              </div>
              <span className="text-xs text-cinema-text-dim">
                {formatDate(project.latestUpdate)}
              </span>
            </button>

            {/* Chapters/Episodes */}
            {expandedSeries.has(project.title) && (
              <div className="bg-cinema-gray/10">
                {project.scripts.map((chapter) => (
                  <div key={chapter.id}>
                    <div
                      onClick={() => switchToScript(chapter.id)}
                      className={`w-full p-3 pl-8 text-left hover:bg-cinema-accent/10 transition-colors flex items-center gap-2 cursor-pointer ${
                        currentScriptId === chapter.id ? 'bg-cinema-accent/20 border-r-2 border-cinema-accent' : ''
                      }`}
                    >
                      <span className="text-sm">📖</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-cinema-text text-sm truncate">
                            {chapter.structure?.chapterTitle || chapter.title}
                          </h4>
                          {(chapter.structure?.chapterNumber || chapter.structure?.episodeNumber) && (
                            <span className="text-xs bg-cinema-accent/20 text-cinema-accent px-1.5 py-0.5 rounded">
                              #{chapter.structure.chapterNumber || chapter.structure.episodeNumber}
                            </span>
                          )}
                        </div>
                        <p className={`text-cinema-text-dim ${
                          isNarrow ? 'text-xs' : 'text-xs'
                        }`}>
                          {isNarrow 
                            ? `${chapter.structure?.scenes?.length || 0}s • ${chapter.pageCount}p`
                            : `${chapter.structure?.scenes?.length || 0} sahne • ${chapter.pageCount} sayfa`
                          }
                        </p>
                        {!isNarrow && (
                          <p className="text-xs text-cinema-text-dim truncate">
                            {chapter.fileName}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleScript(chapter.id);
                          }}
                          className="p-1 hover:bg-cinema-gray/50 rounded cursor-pointer"
                          title={t('scriptNav.showScenes', 'Sahneleri göster')}
                        >
                          <svg className="w-3 h-3 text-cinema-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                        
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(t('scriptNav.confirmDelete', 'Bu senaryoyu silmek istediğinizden emin misiniz?'))) {
                              removeScript(chapter.id);
                            }
                          }}
                          className="p-1 hover:bg-red-500/20 text-red-400 rounded cursor-pointer"
                          title={t('scriptNav.deleteScript', 'Senaryoyu sil')}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Chapter Scenes */}
                    {expandedScripts.has(chapter.id) && chapter.structure?.scenes && (
                      <div className="bg-cinema-gray/5 border-l-2 border-cinema-accent/30 ml-8">
                        {chapter.structure.scenes.slice(0, 10).map((scene, index) => (
                          <div
                            key={scene.id || index}
                            className="p-2 pl-4 hover:bg-cinema-accent/5 cursor-pointer border-b border-cinema-gray/20 last:border-b-0"
                            onClick={() => {
                              selectScript(chapter.id);
                              // TODO: Navigate to specific scene
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-cinema-accent font-medium">
                                {index + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-cinema-text truncate">
                                  {scene.title || `Sahne ${index + 1}`}
                                </p>
                                {scene.location && (
                                  <p className="text-xs text-cinema-text-dim truncate">
                                    {scene.intExt && `${scene.intExt}. `}{scene.location}
                                    {scene.timeOfDay && ` - ${scene.timeOfDay}`}
                                  </p>
                                )}
                              </div>
                              {scene.characters && scene.characters.length > 0 && (
                                <span className="text-xs text-cinema-text-dim">
                                  {scene.characters.length} karakter
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                        {chapter.structure.scenes.length > 10 && (
                          <div className="p-2 pl-4 text-xs text-cinema-text-dim text-center">
                            +{chapter.structure.scenes.length - 10} sahne daha
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Standalone Scripts */}
        {organizedScripts.standalone.map((script) => (
          <div key={script.id} className="border-b border-cinema-gray/50">
            <div
              onClick={() => switchToScript(script.id)}
              className={`w-full p-3 text-left hover:bg-cinema-accent/10 transition-colors flex items-center gap-2 cursor-pointer ${
                currentScriptId === script.id ? 'bg-cinema-accent/20 border-r-2 border-cinema-accent' : ''
              }`}
            >
              <span className={isNarrow ? 'text-base' : 'text-lg'}>{getScriptIcon(script)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className={`font-medium text-cinema-text truncate ${
                    isNarrow ? 'text-xs' : 'text-sm'
                  }`}>
                    {script.title}
                  </h3>
                  <span className={`bg-gray-500/20 text-gray-400 rounded flex-shrink-0 ${
                    isNarrow ? 'px-1 py-0.5 text-xs' : 'px-1.5 py-0.5 text-xs'
                  }`}>
                    {script.structure?.type || 'single'}
                  </span>
                </div>
                <p className={`text-cinema-text-dim ${
                  isNarrow ? 'text-xs' : 'text-xs'
                }`}>
                  {isNarrow 
                    ? `${script.structure?.scenes?.length || 0}s • ${script.pageCount}p`
                    : `${script.structure?.scenes?.length || 0} sahne • ${script.pageCount} sayfa`
                  }
                </p>
              </div>
              
              <div className="flex items-center gap-1">
                <span className="text-xs text-cinema-text-dim">
                  {formatDate(script.updatedAt)}
                </span>
                
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleScript(script.id);
                  }}
                  className="p-1 hover:bg-cinema-gray/50 rounded cursor-pointer"
                  title={t('scriptNav.showScenes', 'Sahneleri göster')}
                >
                  <svg className="w-3 h-3 text-cinema-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(t('scriptNav.confirmDelete', 'Bu senaryoyu silmek istediğinizden emin misiniz?'))) {
                      removeScript(script.id);
                    }
                  }}
                  className="p-1 hover:bg-red-500/20 text-red-400 rounded cursor-pointer"
                  title={t('scriptNav.deleteScript', 'Senaryoyu sil')}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Standalone Scenes */}
            {expandedScripts.has(script.id) && script.structure?.scenes && (
              <div className="bg-cinema-gray/5 border-l-2 border-cinema-accent/30">
                {script.structure.scenes.slice(0, 10).map((scene, index) => (
                  <div
                    key={scene.id || index}
                    className="p-2 pl-6 hover:bg-cinema-accent/5 cursor-pointer border-b border-cinema-gray/20 last:border-b-0"
                    onClick={() => {
                      switchToScript(script.id);
                      // TODO: Navigate to specific scene
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-cinema-accent font-medium">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-cinema-text truncate">
                          {scene.title || `Sahne ${index + 1}`}
                        </p>
                        {scene.location && (
                          <p className="text-xs text-cinema-text-dim truncate">
                            {scene.intExt && `${scene.intExt}. `}{scene.location}
                            {scene.timeOfDay && ` - ${scene.timeOfDay}`}
                          </p>
                        )}
                      </div>
                      {scene.characters && scene.characters.length > 0 && (
                        <span className="text-xs text-cinema-text-dim">
                          {scene.characters.length} karakter
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {script.structure.scenes.length > 10 && (
                  <div className="p-2 pl-6 text-xs text-cinema-text-dim text-center">
                    +{script.structure.scenes.length - 10} sahne daha
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer Actions - Sadece debug için */}
      {scripts.length > 0 && (
        <div className="flex-shrink-0 p-3 border-t border-cinema-gray">
          <button
            onClick={() => {
              if (confirm('Tüm senaryoları silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) {
                const { clearAllScripts } = useScriptStore.getState();
                clearAllScripts();
              }
            }}
            className="w-full text-xs px-3 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/30 rounded transition-colors"
          >
            🗑️ Tüm Senaryoları Temizle
          </button>
        </div>
      )}
      </div>
      
      {/* 🔧 Resize Handle - İyileştirilmiş */}
      <div
        className={`absolute top-0 right-0 w-2 h-full cursor-col-resize transition-all duration-200 z-10 ${
          isResizing 
            ? 'bg-yellow-500 shadow-xl' 
            : 'bg-yellow-400/70 hover:bg-yellow-500'
        }`}
        onMouseDown={handleMouseDown}
        style={{ 
          right: '-2px',
          background: isResizing 
            ? 'linear-gradient(90deg, transparent, #facc15, #facc15, transparent)'
            : 'linear-gradient(90deg, transparent, rgba(250, 204, 21, 0.7), rgba(250, 204, 21, 0.7), transparent)'
        }}
      >
        {/* Merkez çizgi */}
        <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-0.5 h-12 rounded transition-all duration-200 ${
          isResizing
            ? 'bg-yellow-800 shadow-lg'
            : 'bg-yellow-600/90 hover:bg-yellow-800'
        }`}></div>
        
        {/* Resize ipucu */}
        <div className="absolute top-1/2 right-4 transform -translate-y-1/2 text-xs text-white opacity-0 hover:opacity-100 transition-opacity bg-black/80 px-2 py-1 rounded whitespace-nowrap pointer-events-none">
          ↔️ Panel Genişliği
        </div>
      </div>
    </div>
  );
}