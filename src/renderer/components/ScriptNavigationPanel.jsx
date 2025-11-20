import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useScriptStore } from '../store/scriptStore';

export default function ScriptNavigationPanel() {
  const [expandedSeries, setExpandedSeries] = useState(new Set());
  const [expandedScripts, setExpandedScripts] = useState(new Set());
  const [showImported, setShowImported] = useState(true);
  const [sortBy, setSortBy] = useState('recent'); // 'recent', 'name', 'type'
  
  const { 
    scripts, 
    currentScriptId, 
    switchToScript, 
    removeScript,
    currentView,
    setCurrentView
  } = useScriptStore();
  const { t } = useTranslation();

  // Group and sort scripts
  const organizedScripts = useMemo(() => {
    const series = {};
    const standalone = [];

    scripts.forEach(script => {
      if (script.structure?.type === 'series' && script.structure.seriesTitle) {
        const seriesTitle = script.structure.seriesTitle;
        if (!series[seriesTitle]) {
          series[seriesTitle] = {
            title: seriesTitle,
            episodes: [],
            totalScenes: 0,
            totalCharacters: new Set(),
            latestUpdate: null
          };
        }
        
        series[seriesTitle].episodes.push(script);
        series[seriesTitle].totalScenes += script.structure?.scenes?.length || 0;
        script.characters?.forEach(char => series[seriesTitle].totalCharacters.add(char.name || char));
        
        const scriptUpdate = new Date(script.updatedAt);
        if (!series[seriesTitle].latestUpdate || scriptUpdate > series[seriesTitle].latestUpdate) {
          series[seriesTitle].latestUpdate = scriptUpdate;
        }
      } else {
        standalone.push(script);
      }
    });

    // Sort episodes within each series
    Object.keys(series).forEach(seriesTitle => {
      series[seriesTitle].episodes.sort((a, b) => {
        const episodeA = a.structure?.episodeNumber || 0;
        const episodeB = b.structure?.episodeNumber || 0;
        return episodeA - episodeB;
      });
    });

    // Convert to arrays for sorting
    const seriesArray = Object.values(series);
    
    // Sort by selected method
    const sortFn = (a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.title || a.fileName || '').localeCompare(b.title || b.fileName || '');
        case 'type':
          return (a.structure?.type || 'single').localeCompare(b.structure?.type || 'single');
        case 'recent':
        default:
          const dateA = new Date(a.latestUpdate || a.updatedAt || a.createdAt);
          const dateB = new Date(b.latestUpdate || b.updatedAt || b.createdAt);
          return dateB - dateA;
      }
    };

    seriesArray.sort(sortFn);
    standalone.sort(sortFn);

    return { series: seriesArray, standalone };
  }, [scripts, sortBy]);

  const toggleSeries = (seriesTitle) => {
    const newExpanded = new Set(expandedSeries);
    if (newExpanded.has(seriesTitle)) {
      newExpanded.delete(seriesTitle);
    } else {
      newExpanded.add(seriesTitle);
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

  if (scripts.length === 0) {
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
    <div className="h-full flex flex-col bg-cinema-dark border-r border-cinema-gray">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-cinema-gray">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-cinema-text flex items-center gap-2">
            <svg className="w-5 h-5 text-cinema-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            {t('scriptNav.title', 'Senaryolar')}
          </h2>
          <span className="text-xs bg-cinema-accent text-white px-2 py-1 rounded">
            {scripts.length}
          </span>
        </div>

        {/* Controls */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="flex-1 text-xs px-2 py-1.5 bg-cinema-gray border border-cinema-gray-light rounded text-cinema-text focus:ring-2 focus:ring-cinema-accent focus:outline-none"
            >
              <option value="recent">{t('scriptNav.sortRecent', 'Son güncellenen')}</option>
              <option value="name">{t('scriptNav.sortName', 'İsim')}</option>
              <option value="type">{t('scriptNav.sortType', 'Tür')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Scripts List */}
      <div className="flex-1 overflow-y-auto">
        {/* Series */}
        {organizedScripts.series.map((series) => (
          <div key={series.title} className="border-b border-cinema-gray/50">
            {/* Series Header */}
            <button
              onClick={() => toggleSeries(series.title)}
              className="w-full p-3 text-left hover:bg-cinema-gray/30 transition-colors flex items-center gap-2"
            >
              <svg 
                className={`w-4 h-4 text-cinema-text-dim transition-transform ${
                  expandedSeries.has(series.title) ? 'rotate-90' : ''
                }`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-lg">📺</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-cinema-text text-sm truncate">
                    {series.title}
                  </h3>
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                    {series.episodes.length} ep
                  </span>
                </div>
                <p className="text-xs text-cinema-text-dim">
                  {series.totalScenes} sahne • {series.totalCharacters.size} karakter
                </p>
              </div>
              <span className="text-xs text-cinema-text-dim">
                {formatDate(series.latestUpdate)}
              </span>
            </button>

            {/* Episodes */}
            {expandedSeries.has(series.title) && (
              <div className="bg-cinema-gray/10">
                {series.episodes.map((episode) => (
                  <div key={episode.id}>
                    <div
                      onClick={() => selectScript(episode.id)}
                      className={`w-full p-3 pl-8 text-left hover:bg-cinema-accent/10 transition-colors flex items-center gap-2 cursor-pointer ${
                        currentScriptId === episode.id ? 'bg-cinema-accent/20 border-r-2 border-cinema-accent' : ''
                      }`}
                    >
                      <span className="text-sm">🎬</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-cinema-text text-sm truncate">
                            {episode.title}
                          </h4>
                          {episode.structure?.episodeNumber && (
                            <span className="text-xs bg-cinema-accent/20 text-cinema-accent px-1.5 py-0.5 rounded">
                              #{episode.structure.episodeNumber}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-cinema-text-dim">
                          {episode.structure?.scenes?.length || 0} sahne • {episode.pageCount} sayfa
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleScript(episode.id);
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
                              removeScript(episode.id);
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

                    {/* Episode Scenes */}
                    {expandedScripts.has(episode.id) && episode.structure?.scenes && (
                      <div className="bg-cinema-gray/5 border-l-2 border-cinema-accent/30 ml-8">
                        {episode.structure.scenes.slice(0, 10).map((scene, index) => (
                          <div
                            key={scene.id || index}
                            className="p-2 pl-4 hover:bg-cinema-accent/5 cursor-pointer border-b border-cinema-gray/20 last:border-b-0"
                            onClick={() => {
                              selectScript(episode.id);
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
                        {episode.structure.scenes.length > 10 && (
                          <div className="p-2 pl-4 text-xs text-cinema-text-dim text-center">
                            +{episode.structure.scenes.length - 10} sahne daha
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
              onClick={() => selectScript(script.id)}
              className={`w-full p-3 text-left hover:bg-cinema-accent/10 transition-colors flex items-center gap-2 cursor-pointer ${
                currentScriptId === script.id ? 'bg-cinema-accent/20 border-r-2 border-cinema-accent' : ''
              }`}
            >
              <span className="text-lg">{getScriptIcon(script)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-cinema-text text-sm truncate">
                    {script.title}
                  </h3>
                  <span className="text-xs bg-gray-500/20 text-gray-400 px-1.5 py-0.5 rounded">
                    {script.structure?.type || 'single'}
                  </span>
                </div>
                <p className="text-xs text-cinema-text-dim">
                  {script.structure?.scenes?.length || 0} sahne • {script.pageCount} sayfa
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
                      selectScript(script.id);
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

      {/* Footer Actions */}
      <div className="flex-shrink-0 p-3 border-t border-cinema-gray">
        <button
          onClick={() => setCurrentView('uploader')}
          className="w-full btn-primary text-sm flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          {t('scriptNav.addNew', 'Yeni Senaryo Ekle')}
        </button>
      </div>
    </div>
  );
}