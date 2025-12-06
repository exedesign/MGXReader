import React, { useState } from 'react';
import LocationImageGenerator from './LocationImageGenerator';

const LocationTableView = ({ 
  locations, 
  locationApprovals,
  extractedScenes,
  characterApprovals,
  onLocationDelete,
  onLocationApprove,
  onLocationReject,
  onImageGenerated,
  onImageUpload,
  onLocationDetailClick
}) => {
  const [locationFilter, setLocationFilter] = useState({
    type: 'ALL',
    timeOfDay: 'ALL',
    status: 'ALL',
    search: ''
  });
  const [expandedLocationRow, setExpandedLocationRow] = useState(null);

  // Apply filters
  const getFilteredLocations = () => {
    let filtered = locations.map((loc, idx) => ({ loc, originalIndex: idx }));
    
    // Type filter
    if (locationFilter.type !== 'ALL') {
      filtered = filtered.filter(({loc}) => {
        const locType = typeof loc === 'object' ? loc.type : null;
        return locType === locationFilter.type;
      });
    }
    
    // Time of day filter
    if (locationFilter.timeOfDay !== 'ALL') {
      filtered = filtered.filter(({loc}) => {
        const timeOfDay = typeof loc === 'object' ? loc.timeOfDay : null;
        return timeOfDay === locationFilter.timeOfDay;
      });
    }
    
    // Status filter
    if (locationFilter.status !== 'ALL') {
      filtered = filtered.filter(({loc}) => {
        const locName = typeof loc === 'string' ? loc : (loc.name || loc);
        const hasImage = locationApprovals[locName]?.image;
        const isApproved = locationApprovals[locName]?.approved;
        
        if (locationFilter.status === 'APPROVED') return isApproved;
        if (locationFilter.status === 'PENDING') return hasImage && !isApproved;
        if (locationFilter.status === 'NOT_GENERATED') return !hasImage;
        return true;
      });
    }
    
    // Search filter
    if (locationFilter.search) {
      const searchLower = locationFilter.search.toLowerCase();
      filtered = filtered.filter(({loc}) => {
        const locName = typeof loc === 'string' ? loc : (loc.name || loc);
        const locDescription = typeof loc === 'object' ? loc.description : '';
        const locAtmosphere = typeof loc === 'object' ? loc.atmosphere : '';
        
        return locName.toLowerCase().includes(searchLower) ||
               (locDescription && locDescription.toLowerCase().includes(searchLower)) ||
               (locAtmosphere && locAtmosphere.toLowerCase().includes(searchLower));
      });
    }
    
    return filtered;
  };

  const getCharactersForLocation = (locName) => {
    const charactersInLocation = new Set();
    extractedScenes.forEach(scene => {
      const sceneLocations = scene.locations || [];
      const sceneLocationNames = sceneLocations.map(loc => 
        typeof loc === 'string' ? loc : loc.name || loc
      );
      
      if (sceneLocationNames.includes(locName) || 
          scene.location === locName ||
          sceneLocationNames.some(sceneLoc => 
            sceneLoc.toLowerCase().includes(locName.toLowerCase()) ||
            locName.toLowerCase().includes(sceneLoc.toLowerCase())
          )) {
        scene.characters?.forEach(char => charactersInLocation.add(char));
      }
    });
    
    return Array.from(charactersInLocation)
      .filter(charName => characterApprovals[charName]?.approved && characterApprovals[charName]?.image)
      .map(charName => ({
        name: charName,
        image: characterApprovals[charName].image
      }));
  };

  const getScenesForLocation = (locName) => {
    const scenes = [];
    extractedScenes.forEach(scene => {
      const sceneLocations = scene.locations || [];
      const sceneLocationNames = sceneLocations.map(loc => 
        typeof loc === 'string' ? loc : loc.name || loc
      );
      
      if (sceneLocationNames.includes(locName) || 
          scene.location === locName ||
          sceneLocationNames.some(sceneLoc => 
            sceneLoc.toLowerCase().includes(locName.toLowerCase()) ||
            locName.toLowerCase().includes(sceneLoc.toLowerCase())
          )) {
        scenes.push({
          number: scene.number || scene.sceneNumber,
          title: scene.title
        });
      }
    });
    return scenes;
  };

  const filteredLocations = getFilteredLocations();

  return (
    <div className="space-y-4">
      {/* Filter Controls */}
      <div className="bg-cinema-black/50 rounded-lg border border-cinema-gray p-4">
        <div className="flex gap-2 flex-wrap">
          <select
            value={locationFilter.type}
            onChange={(e) => setLocationFilter({...locationFilter, type: e.target.value})}
            className="px-3 py-2 bg-cinema-black/60 border border-cinema-gray rounded-lg text-sm text-cinema-text focus:ring-2 focus:ring-cinema-accent"
          >
            <option value="ALL">🔍 Tüm Tipler</option>
            <option value="INTERIOR">🏠 İç Mekan</option>
            <option value="EXTERIOR">🌍 Dış Mekan</option>
          </select>
          
          <select
            value={locationFilter.timeOfDay}
            onChange={(e) => setLocationFilter({...locationFilter, timeOfDay: e.target.value})}
            className="px-3 py-2 bg-cinema-black/60 border border-cinema-gray rounded-lg text-sm text-cinema-text focus:ring-2 focus:ring-cinema-accent"
          >
            <option value="ALL">🕐 Tüm Zamanlar</option>
            <option value="DAY">☀️ Gündüz</option>
            <option value="NIGHT">🌙 Gece</option>
            <option value="DAWN">🌅 Şafak</option>
            <option value="DUSK">🌆 Alacakaranlık</option>
          </select>
          
          <select
            value={locationFilter.status}
            onChange={(e) => setLocationFilter({...locationFilter, status: e.target.value})}
            className="px-3 py-2 bg-cinema-black/60 border border-cinema-gray rounded-lg text-sm text-cinema-text focus:ring-2 focus:ring-cinema-accent"
          >
            <option value="ALL">📊 Tüm Durumlar</option>
            <option value="APPROVED">✓ Onaylanmış</option>
            <option value="PENDING">⏳ Beklemede</option>
            <option value="NOT_GENERATED">📍 Üretilmemiş</option>
          </select>
          
          <input
            type="text"
            placeholder="🔎 Mekan ara..."
            value={locationFilter.search}
            onChange={(e) => setLocationFilter({...locationFilter, search: e.target.value})}
            className="px-3 py-2 bg-cinema-black/60 border border-cinema-gray rounded-lg text-sm text-cinema-text flex-1 min-w-[200px] focus:ring-2 focus:ring-cinema-accent"
          />
          
          {(locationFilter.type !== 'ALL' || locationFilter.timeOfDay !== 'ALL' || locationFilter.status !== 'ALL' || locationFilter.search) && (
            <button
              onClick={() => setLocationFilter({type: 'ALL', timeOfDay: 'ALL', status: 'ALL', search: ''})}
              className="px-3 py-2 bg-cinema-gray/30 hover:bg-cinema-gray/50 rounded-lg text-sm text-cinema-text transition-colors"
            >
              🔄 Sıfırla
            </button>
          )}
        </div>
        
        {/* Results Count */}
        <div className="mt-2 text-xs text-cinema-text-dim">
          {filteredLocations.length} mekan gösteriliyor {filteredLocations.length !== locations.length && `(toplam ${locations.length})`}
        </div>
      </div>

      {/* Excel-Style Table */}
      <div className="bg-cinema-black/50 rounded-lg border border-cinema-gray overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-cinema-gray/20 border-b border-cinema-gray sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-cinema-text-dim uppercase tracking-wider w-12">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-cinema-text-dim uppercase tracking-wider w-24">Görsel</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-cinema-text-dim uppercase tracking-wider">Mekan Adı</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-cinema-text-dim uppercase tracking-wider w-28">Tip</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-cinema-text-dim uppercase tracking-wider w-32">Zaman</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-cinema-text-dim uppercase tracking-wider">Karakterler</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-cinema-text-dim uppercase tracking-wider w-20">Sahne</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-cinema-text-dim uppercase tracking-wider w-28">Durum</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-cinema-text-dim uppercase tracking-wider w-32">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cinema-gray/30">
              {filteredLocations.map(({loc: location, originalIndex: index}) => {
                const locName = typeof location === 'string' ? location : (location.name || location);
                const locType = typeof location === 'object' ? location.type : null;
                const locDescription = typeof location === 'object' ? location.description : null;
                const locTimeOfDay = typeof location === 'object' ? location.timeOfDay : null;
                const locSceneCount = typeof location === 'object' ? location.sceneCount : 0;
                
                const charactersInLocation = getCharactersForLocation(locName);
                const locationImage = locationApprovals[locName]?.image;
                const isApproved = locationApprovals[locName]?.approved;
                const hasImage = !!locationImage;
                
                return (
                  <tr key={`${locName}-${index}`} className="hover:bg-cinema-gray/10 transition-colors">
                    {/* Row Number */}
                    <td className="px-4 py-3 text-sm text-cinema-text-dim font-mono">
                      {index + 1}
                    </td>
                    
                    {/* Thumbnail */}
                    <td className="px-4 py-3">
                      <div className="relative w-20 h-15 rounded overflow-hidden bg-cinema-black/40 border border-cinema-gray/30">
                        {hasImage ? (
                          <img
                            src={locationImage.url}
                            alt={locName}
                            className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => {
                              if (onLocationDetailClick) {
                                onLocationDetailClick(location);
                              }
                            }}
                            title="Detayları göster"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">
                            {locType === 'INTERIOR' ? '🏠' : locType === 'EXTERIOR' ? '🌍' : '📍'}
                          </div>
                        )}
                      </div>
                    </td>
                    
                    {/* Name & Description */}
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-cinema-text">{locName}</div>
                      {locDescription && (
                        <div className="text-xs text-cinema-text-dim line-clamp-2 mt-1 max-w-xs">
                          {locDescription}
                        </div>
                      )}
                    </td>
                    
                    {/* Type */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        locType === 'INTERIOR' ? 'bg-blue-600/20 text-blue-400' : 
                        locType === 'EXTERIOR' ? 'bg-green-600/20 text-green-400' : 
                        'bg-gray-600/20 text-gray-400'
                      }`}>
                        {locType === 'INTERIOR' && '🏠 İç'}
                        {locType === 'EXTERIOR' && '🌍 Dış'}
                        {!locType && '📍 —'}
                      </span>
                    </td>
                    
                    {/* Time of Day */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-cinema-text">
                        {locTimeOfDay === 'DAY' && '☀️ Gündüz'}
                        {locTimeOfDay === 'NIGHT' && '🌙 Gece'}
                        {locTimeOfDay === 'DAWN' && '🌅 Şafak'}
                        {locTimeOfDay === 'DUSK' && '🌆 Alacakaranlık'}
                        {!locTimeOfDay && '—'}
                      </span>
                    </td>
                    
                    {/* Characters */}
                    <td className="px-4 py-3">
                      {charactersInLocation.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {charactersInLocation.slice(0, 2).map(charRef => (
                            <span key={charRef.name} className="text-xs bg-cinema-accent/20 text-cinema-accent px-2 py-0.5 rounded">
                              {charRef.name}
                            </span>
                          ))}
                          {charactersInLocation.length > 2 && (
                            <span className="text-xs text-cinema-text-dim">+{charactersInLocation.length - 2}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-cinema-text-dim">—</span>
                      )}
                    </td>
                    
                    {/* Scene Count */}
                    <td className="px-4 py-3">
                      {(() => {
                        const scenes = getScenesForLocation(locName);
                        return scenes.length > 0 ? (
                          <div className="space-y-1">
                            {scenes.slice(0, 3).map(scene => (
                              <div key={scene.number} className="text-xs bg-cinema-accent/10 text-cinema-accent px-2 py-0.5 rounded">
                                Sahne {scene.number}
                              </div>
                            ))}
                            {scenes.length > 3 && (
                              <div className="text-xs text-cinema-text-dim">+{scenes.length - 3} daha</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-cinema-text-dim">—</span>
                        );
                      })()}
                    </td>
                    
                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        isApproved ? 'bg-green-600/20 text-green-400' : 
                        hasImage ? 'bg-blue-600/20 text-blue-400' : 
                        'bg-yellow-600/20 text-yellow-400'
                      }`}>
                        {isApproved ? '✓ Onaylı' : hasImage ? '⏳ Bekliyor' : '📍 Yok'}
                      </span>
                    </td>
                    
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-center items-center">
                        {hasImage && !isApproved ? (
                          <>
                            <button
                              onClick={() => onLocationApprove(locName)}
                              className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs transition-colors"
                              title="Onayla"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => onLocationReject(locName)}
                              className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition-colors"
                              title="Reddet"
                            >
                              ✗
                            </button>
                          </>
                        ) : !hasImage ? (
                          <>
                            <button
                              onClick={() => {
                                if (onLocationDetailClick) {
                                  onLocationDetailClick(location);
                                }
                              }}
                              className="p-1.5 bg-cinema-accent hover:bg-cinema-accent-dark text-white rounded text-xs transition-colors"
                              title="AI ile görsel üret"
                            >
                              🎨
                            </button>
                            <label className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors cursor-pointer" title="Dosyadan yükle">
                              📁
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files[0];
                                  if (file && onImageUpload) {
                                    onImageUpload(locName, file);
                                  }
                                }}
                              />
                            </label>
                          </>
                        ) : (
                          <span className="text-xs text-green-400 font-bold">✓</span>
                        )}
                        <button
                          onClick={() => onLocationDelete(index)}
                          className="p-1.5 bg-red-600/50 hover:bg-red-600 text-white rounded text-xs transition-colors"
                          title="Sil"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Empty State */}
        {filteredLocations.length === 0 && (
          <div className="p-8 text-center text-cinema-text-dim">
            <div className="text-4xl mb-2">🔍</div>
            <div>Filtrelere uygun mekan bulunamadı</div>
            <button
              onClick={() => setLocationFilter({type: 'ALL', timeOfDay: 'ALL', status: 'ALL', search: ''})}
              className="mt-4 px-4 py-2 bg-cinema-accent/20 hover:bg-cinema-accent/30 text-cinema-accent rounded-lg text-sm transition-colors"
            >
              Filtreleri Sıfırla
            </button>
          </div>
        )}
      </div>
      
      {/* Expanded Row for Image Generation */}
      {expandedLocationRow !== null && (
        <div className="bg-cinema-black/50 rounded-lg border-2 border-cinema-accent p-4 animate-fadeIn">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-lg font-semibold text-cinema-accent">
              🎨 {typeof locations[expandedLocationRow] === 'string' 
                ? locations[expandedLocationRow] 
                : locations[expandedLocationRow].name} - Görsel Üretimi
            </h4>
            <button
              onClick={() => setExpandedLocationRow(null)}
              className="text-cinema-text-dim hover:text-cinema-text text-xl"
            >
              ✕
            </button>
          </div>
          <LocationImageGenerator
            location={typeof locations[expandedLocationRow] === 'string' 
              ? { name: locations[expandedLocationRow] }
              : locations[expandedLocationRow]}
            onImageGenerated={(name, imageData) => {
              onImageGenerated(name, imageData);
              setExpandedLocationRow(null);
            }}
            characterReferences={getCharactersForLocation(
              typeof locations[expandedLocationRow] === 'string' 
                ? locations[expandedLocationRow] 
                : locations[expandedLocationRow].name
            )}
          />
        </div>
      )}
    </div>
  );
};

export default LocationTableView;
