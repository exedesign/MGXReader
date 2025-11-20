import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useScriptStore } from '../store/scriptStore';

export default function SceneManagement() {
  const [selectedSceneId, setSelectedSceneId] = useState(null);
  const [editingScene, setEditingScene] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list', 'grid', 'timeline'
  const [filterBy, setFilterBy] = useState('all'); // 'all', 'interior', 'exterior', 'day', 'night'
  const [searchTerm, setSearchTerm] = useState('');
  
  const { 
    getCurrentScript, 
    updateScript, 
    addSceneToScript, 
    currentScriptId,
    setCurrentView 
  } = useScriptStore();
  const { t } = useTranslation();

  const currentScript = getCurrentScript();

  // Filter and search scenes
  const filteredScenes = useMemo(() => {
    if (!currentScript?.structure?.scenes) return [];
    
    let scenes = currentScript.structure.scenes;

    // Apply filters
    if (filterBy !== 'all') {
      scenes = scenes.filter(scene => {
        switch (filterBy) {
          case 'interior':
            return scene.intExt?.toLowerCase() === 'int';
          case 'exterior':
            return scene.intExt?.toLowerCase() === 'ext';
          case 'day':
            return scene.timeOfDay?.toLowerCase().includes('day') || 
                   scene.timeOfDay?.toLowerCase().includes('gün');
          case 'night':
            return scene.timeOfDay?.toLowerCase().includes('night') || 
                   scene.timeOfDay?.toLowerCase().includes('gece');
          default:
            return true;
        }
      });
    }

    // Apply search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      scenes = scenes.filter(scene => 
        scene.title?.toLowerCase().includes(term) ||
        scene.location?.toLowerCase().includes(term) ||
        scene.content?.toLowerCase().includes(term) ||
        scene.characters?.some(char => 
          (typeof char === 'string' ? char : char.name)?.toLowerCase().includes(term)
        )
      );
    }

    return scenes;
  }, [currentScript, filterBy, searchTerm]);

  const handleSceneEdit = (scene) => {
    setEditingScene({ ...scene });
  };

  const handleSceneSave = () => {
    if (!editingScene || !currentScript) return;

    const updatedScenes = currentScript.structure.scenes.map(scene =>
      scene.id === editingScene.id ? editingScene : scene
    );

    const updatedStructure = {
      ...currentScript.structure,
      scenes: updatedScenes
    };

    updateScript(currentScriptId, { 
      structure: updatedStructure,
      updatedAt: new Date().toISOString()
    });

    setEditingScene(null);
  };

  const handleSceneAdd = () => {
    if (!currentScript) return;

    const newScene = {
      title: `Scene ${(currentScript.structure?.scenes?.length || 0) + 1}`,
      content: '',
      location: '',
      intExt: 'INT',
      timeOfDay: 'DAY',
      characters: [],
      duration: null,
      notes: ''
    };

    addSceneToScript(currentScriptId, newScene);
  };

  const handleSceneDelete = (sceneId) => {
    if (!currentScript) return;

    const updatedScenes = currentScript.structure.scenes.filter(scene => scene.id !== sceneId);
    const updatedStructure = {
      ...currentScript.structure,
      scenes: updatedScenes
    };

    updateScript(currentScriptId, { 
      structure: updatedStructure,
      updatedAt: new Date().toISOString()
    });

    if (selectedSceneId === sceneId) {
      setSelectedSceneId(null);
    }
  };

  const handleSceneReorder = (fromIndex, toIndex) => {
    if (!currentScript?.structure?.scenes) return;

    const scenes = [...currentScript.structure.scenes];
    const [movedScene] = scenes.splice(fromIndex, 1);
    scenes.splice(toIndex, 0, movedScene);

    // Update scene numbers
    const updatedScenes = scenes.map((scene, index) => ({
      ...scene,
      number: index + 1,
      title: scene.title.replace(/Scene \d+/, `Scene ${index + 1}`)
    }));

    const updatedStructure = {
      ...currentScript.structure,
      scenes: updatedScenes
    };

    updateScript(currentScriptId, { 
      structure: updatedStructure,
      updatedAt: new Date().toISOString()
    });
  };

  const getSceneStats = () => {
    if (!currentScript?.structure?.scenes) return {};
    
    const scenes = currentScript.structure.scenes;
    const totalScenes = scenes.length;
    const intScenes = scenes.filter(s => s.intExt?.toLowerCase() === 'int').length;
    const extScenes = scenes.filter(s => s.intExt?.toLowerCase() === 'ext').length;
    const dayScenes = scenes.filter(s => 
      s.timeOfDay?.toLowerCase().includes('day') || s.timeOfDay?.toLowerCase().includes('gün')
    ).length;
    const nightScenes = scenes.filter(s => 
      s.timeOfDay?.toLowerCase().includes('night') || s.timeOfDay?.toLowerCase().includes('gece')
    ).length;

    return { totalScenes, intScenes, extScenes, dayScenes, nightScenes };
  };

  const stats = getSceneStats();

  if (!currentScript) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center text-cinema-text-dim">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2M7 4h10M7 4l-2 18h14l-2-18M10 8v6m4-6v6" />
          </svg>
          <p className="text-lg mb-2">{t('sceneManagement.noScript', 'Senaryo seçilmedi')}</p>
          <p className="text-sm">{t('sceneManagement.selectScript', 'Sahne düzenlemek için bir senaryo seçin')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-cinema-black text-cinema-text flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-cinema-dark border-b border-cinema-gray p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-cinema-text mb-1">
              {t('sceneManagement.title', 'Sahne Yönetimi')}
            </h1>
            <p className="text-sm text-cinema-text-dim">
              {currentScript.title} • {stats.totalScenes} sahne
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleSceneAdd}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              {t('sceneManagement.addScene', 'Sahne Ekle')}
            </button>

            <button
              onClick={() => setCurrentView('analysis')}
              className="px-3 py-1.5 bg-cinema-accent/20 hover:bg-cinema-accent/30 border border-cinema-accent/50 rounded text-sm text-cinema-accent transition-colors"
            >
              {t('sceneManagement.analyze', 'Analiz Et')}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 mb-4">
          <div className="text-center">
            <div className="text-lg font-bold text-cinema-accent">{stats.totalScenes}</div>
            <div className="text-xs text-cinema-text-dim">Toplam</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-400">{stats.intScenes}</div>
            <div className="text-xs text-cinema-text-dim">İç Mekan</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-400">{stats.extScenes}</div>
            <div className="text-xs text-cinema-text-dim">Dış Mekan</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-yellow-400">{stats.dayScenes}</div>
            <div className="text-xs text-cinema-text-dim">Gündüz</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-purple-400">{stats.nightScenes}</div>
            <div className="text-xs text-cinema-text-dim">Gece</div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder={t('sceneManagement.search', 'Sahne ara...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 bg-cinema-gray border border-cinema-gray-light rounded text-sm text-cinema-text focus:ring-2 focus:ring-cinema-accent focus:outline-none"
            />
          </div>

          <select
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value)}
            className="px-3 py-1.5 bg-cinema-gray border border-cinema-gray-light rounded text-sm text-cinema-text focus:ring-2 focus:ring-cinema-accent focus:outline-none"
          >
            <option value="all">{t('sceneManagement.filterAll', 'Tüm Sahneler')}</option>
            <option value="interior">{t('sceneManagement.filterInt', 'İç Mekan')}</option>
            <option value="exterior">{t('sceneManagement.filterExt', 'Dış Mekan')}</option>
            <option value="day">{t('sceneManagement.filterDay', 'Gündüz')}</option>
            <option value="night">{t('sceneManagement.filterNight', 'Gece')}</option>
          </select>

          <div className="flex items-center bg-cinema-gray rounded overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm transition-colors ${
                viewMode === 'list' ? 'bg-cinema-accent text-white' : 'text-cinema-text hover:bg-cinema-gray-light'
              }`}
            >
              {t('sceneManagement.listView', 'Liste')}
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 text-sm transition-colors ${
                viewMode === 'grid' ? 'bg-cinema-accent text-white' : 'text-cinema-text hover:bg-cinema-gray-light'
              }`}
            >
              {t('sceneManagement.gridView', 'Kart')}
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 text-sm transition-colors ${
                viewMode === 'timeline' ? 'bg-cinema-accent text-white' : 'text-cinema-text hover:bg-cinema-gray-light'
              }`}
            >
              {t('sceneManagement.timelineView', 'Zaman Çizelgesi')}
            </button>
          </div>
        </div>
      </div>

      {/* Scenes Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'list' && (
          <div className="h-full overflow-y-auto">
            <div className="divide-y divide-cinema-gray/50">
              {filteredScenes.map((scene, index) => (
                <div 
                  key={scene.id || index}
                  className={`p-4 hover:bg-cinema-gray/20 cursor-pointer transition-colors ${
                    selectedSceneId === scene.id ? 'bg-cinema-accent/10 border-r-2 border-cinema-accent' : ''
                  }`}
                  onClick={() => setSelectedSceneId(scene.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="px-2 py-1 bg-cinema-accent rounded text-xs font-medium text-white">
                          {scene.number || index + 1}
                        </span>
                        <h3 className="font-medium text-cinema-text truncate">
                          {scene.title || `Scene ${index + 1}`}
                        </h3>
                        {scene.intExt && scene.location && (
                          <span className={`px-2 py-1 rounded text-xs ${
                            scene.intExt.toLowerCase() === 'int' 
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-green-500/20 text-green-400'
                          }`}>
                            {scene.intExt}. {scene.location}
                            {scene.timeOfDay && ` - ${scene.timeOfDay}`}
                          </span>
                        )}
                      </div>
                      
                      {scene.content && (
                        <p className="text-sm text-cinema-text-dim truncate mb-2">
                          {scene.content.substring(0, 120)}...
                        </p>
                      )}
                      
                      {scene.characters && scene.characters.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-cinema-text-dim">Karakterler:</span>
                          <div className="flex flex-wrap gap-1">
                            {scene.characters.slice(0, 3).map((char, charIndex) => (
                              <span 
                                key={charIndex}
                                className="px-2 py-0.5 bg-cinema-gray/50 rounded text-xs text-cinema-text"
                              >
                                {typeof char === 'string' ? char : char.name}
                              </span>
                            ))}
                            {scene.characters.length > 3 && (
                              <span className="text-xs text-cinema-text-dim">
                                +{scene.characters.length - 3} daha
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSceneEdit(scene);
                        }}
                        className="p-1.5 hover:bg-cinema-accent/20 text-cinema-accent rounded"
                        title={t('sceneManagement.editScene', 'Sahneyi düzenle')}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(t('sceneManagement.confirmDelete', 'Bu sahneyi silmek istediğinizden emin misiniz?'))) {
                            handleSceneDelete(scene.id);
                          }
                        }}
                        className="p-1.5 hover:bg-red-500/20 text-red-400 rounded"
                        title={t('sceneManagement.deleteScene', 'Sahneyi sil')}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'grid' && (
          <div className="h-full overflow-y-auto p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredScenes.map((scene, index) => (
                <div
                  key={scene.id || index}
                  className={`p-4 bg-cinema-dark rounded-lg border hover:border-cinema-accent transition-colors cursor-pointer ${
                    selectedSceneId === scene.id ? 'border-cinema-accent bg-cinema-accent/10' : 'border-cinema-gray'
                  }`}
                  onClick={() => setSelectedSceneId(scene.id)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2 py-1 bg-cinema-accent rounded text-xs font-medium text-white">
                      {scene.number || index + 1}
                    </span>
                    
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSceneEdit(scene);
                        }}
                        className="p-1 hover:bg-cinema-accent/20 text-cinema-accent rounded"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <h3 className="font-medium text-cinema-text mb-2 truncate">
                    {scene.title || `Scene ${index + 1}`}
                  </h3>

                  {scene.intExt && scene.location && (
                    <div className="mb-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        scene.intExt.toLowerCase() === 'int'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-green-500/20 text-green-400'
                      }`}>
                        {scene.intExt}. {scene.location}
                      </span>
                      {scene.timeOfDay && (
                        <span className={`ml-1 px-2 py-1 rounded text-xs ${
                          scene.timeOfDay.toLowerCase().includes('day') || scene.timeOfDay.toLowerCase().includes('gün')
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-purple-500/20 text-purple-400'
                        }`}>
                          {scene.timeOfDay}
                        </span>
                      )}
                    </div>
                  )}

                  {scene.content && (
                    <p className="text-xs text-cinema-text-dim mb-2 line-clamp-2">
                      {scene.content.substring(0, 80)}...
                    </p>
                  )}

                  {scene.characters && scene.characters.length > 0 && (
                    <div className="text-xs text-cinema-text-dim">
                      {scene.characters.length} karakter
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'timeline' && (
          <div className="h-full overflow-y-auto p-4">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-cinema-accent/30"></div>
              
              {filteredScenes.map((scene, index) => (
                <div key={scene.id || index} className="relative flex items-start gap-4 mb-6">
                  {/* Timeline dot */}
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                    selectedSceneId === scene.id 
                      ? 'bg-cinema-accent border-cinema-accent' 
                      : 'bg-cinema-gray border-cinema-accent/30'
                  }`}></div>
                  
                  {/* Scene content */}
                  <div 
                    className={`flex-1 p-4 bg-cinema-dark rounded-lg border cursor-pointer transition-colors ${
                      selectedSceneId === scene.id ? 'border-cinema-accent' : 'border-cinema-gray hover:border-cinema-accent/50'
                    }`}
                    onClick={() => setSelectedSceneId(scene.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-medium text-cinema-text">
                          Scene {scene.number || index + 1}: {scene.title || `Scene ${index + 1}`}
                        </h3>
                        {scene.intExt && scene.location && (
                          <p className="text-sm text-cinema-text-dim">
                            {scene.intExt}. {scene.location}
                            {scene.timeOfDay && ` - ${scene.timeOfDay}`}
                          </p>
                        )}
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSceneEdit(scene);
                        }}
                        className="p-1.5 hover:bg-cinema-accent/20 text-cinema-accent rounded"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                    
                    {scene.content && (
                      <p className="text-sm text-cinema-text-dim">
                        {scene.content.substring(0, 150)}...
                      </p>
                    )}
                    
                    {scene.characters && scene.characters.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {scene.characters.slice(0, 4).map((char, charIndex) => (
                          <span 
                            key={charIndex}
                            className="px-2 py-0.5 bg-cinema-gray/50 rounded text-xs text-cinema-text"
                          >
                            {typeof char === 'string' ? char : char.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit Scene Modal */}
      {editingScene && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-cinema-dark border border-cinema-gray rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-cinema-dark border-b border-cinema-gray p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-cinema-text">
                {t('sceneManagement.editSceneTitle', 'Sahne Düzenle')}
              </h2>
              <button
                onClick={() => setEditingScene(null)}
                className="text-cinema-text-dim hover:text-cinema-text transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Scene Header */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-cinema-text mb-2">
                    {t('sceneManagement.sceneTitle', 'Sahne Başlığı')}
                  </label>
                  <input
                    type="text"
                    value={editingScene.title || ''}
                    onChange={(e) => setEditingScene(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 bg-cinema-gray border border-cinema-gray-light rounded text-cinema-text focus:ring-2 focus:ring-cinema-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-cinema-text mb-2">
                    {t('sceneManagement.location', 'Lokasyon')}
                  </label>
                  <input
                    type="text"
                    value={editingScene.location || ''}
                    onChange={(e) => setEditingScene(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full px-3 py-2 bg-cinema-gray border border-cinema-gray-light rounded text-cinema-text focus:ring-2 focus:ring-cinema-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-cinema-text mb-2">
                    {t('sceneManagement.intExt', 'İç/Dış Mekan')}
                  </label>
                  <select
                    value={editingScene.intExt || 'INT'}
                    onChange={(e) => setEditingScene(prev => ({ ...prev, intExt: e.target.value }))}
                    className="w-full px-3 py-2 bg-cinema-gray border border-cinema-gray-light rounded text-cinema-text focus:ring-2 focus:ring-cinema-accent focus:outline-none"
                  >
                    <option value="INT">İç Mekan</option>
                    <option value="EXT">Dış Mekan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-cinema-text mb-2">
                    {t('sceneManagement.timeOfDay', 'Zaman')}
                  </label>
                  <select
                    value={editingScene.timeOfDay || 'DAY'}
                    onChange={(e) => setEditingScene(prev => ({ ...prev, timeOfDay: e.target.value }))}
                    className="w-full px-3 py-2 bg-cinema-gray border border-cinema-gray-light rounded text-cinema-text focus:ring-2 focus:ring-cinema-accent focus:outline-none"
                  >
                    <option value="DAY">Gündüz</option>
                    <option value="NIGHT">Gece</option>
                    <option value="DAWN">Şafak</option>
                    <option value="DUSK">Akşam</option>
                  </select>
                </div>
              </div>

              {/* Scene Content */}
              <div>
                <label className="block text-sm font-medium text-cinema-text mb-2">
                  {t('sceneManagement.sceneContent', 'Sahne İçeriği')}
                </label>
                <textarea
                  value={editingScene.content || ''}
                  onChange={(e) => setEditingScene(prev => ({ ...prev, content: e.target.value }))}
                  rows={10}
                  className="w-full px-3 py-2 bg-cinema-gray border border-cinema-gray-light rounded text-cinema-text focus:ring-2 focus:ring-cinema-accent focus:outline-none"
                />
              </div>

              {/* Characters */}
              <div>
                <label className="block text-sm font-medium text-cinema-text mb-2">
                  {t('sceneManagement.characters', 'Karakterler (virgülle ayırın)')}
                </label>
                <input
                  type="text"
                  value={editingScene.characters?.join(', ') || ''}
                  onChange={(e) => setEditingScene(prev => ({ 
                    ...prev, 
                    characters: e.target.value.split(',').map(s => s.trim()).filter(s => s) 
                  }))}
                  className="w-full px-3 py-2 bg-cinema-gray border border-cinema-gray-light rounded text-cinema-text focus:ring-2 focus:ring-cinema-accent focus:outline-none"
                  placeholder="John, Mary, Robert"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-cinema-text mb-2">
                  {t('sceneManagement.notes', 'Notlar')}
                </label>
                <textarea
                  value={editingScene.notes || ''}
                  onChange={(e) => setEditingScene(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 bg-cinema-gray border border-cinema-gray-light rounded text-cinema-text focus:ring-2 focus:ring-cinema-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-cinema-dark border-t border-cinema-gray p-4 flex justify-end gap-3">
              <button
                onClick={() => setEditingScene(null)}
                className="px-4 py-2 bg-cinema-gray hover:bg-cinema-gray-light border border-cinema-gray-light rounded text-cinema-text transition-colors"
              >
                {t('sceneManagement.cancel', 'İptal')}
              </button>
              <button
                onClick={handleSceneSave}
                className="btn-primary"
              >
                {t('sceneManagement.saveScene', 'Kaydet')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}