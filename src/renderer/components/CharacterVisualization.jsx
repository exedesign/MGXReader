import React, { useState } from 'react';

export default function CharacterVisualization({ 
  characterAnalysis, 
  locationAnalysis,
  onCharactersUpdated,
  onContinue 
}) {
  // Yapılandırılmış karakter verisini kullan
  const initialCharacters = characterAnalysis?.parsed 
    ? characterAnalysis.characters 
    : (characterAnalysis?.characters || []);
    
  const [characters, setCharacters] = useState(initialCharacters);
  const [locations, setLocations] = useState(locationAnalysis?.locations || []);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showRawData, setShowRawData] = useState(false);
  
  // Karakter özet bilgisini göster
  const characterSummary = characterAnalysis?.summary;

  const handleEdit = (index, type = 'character') => {
    const item = type === 'character' ? characters[index] : locations[index];
    setEditingIndex({ index, type });
    setEditForm({ ...item });
  };

  const handleSave = () => {
    if (!editingIndex) return;
    
    const { index, type } = editingIndex;
    
    if (type === 'character') {
      const newCharacters = [...characters];
      newCharacters[index] = editForm;
      setCharacters(newCharacters);
    } else {
      const newLocations = [...locations];
      newLocations[index] = editForm;
      setLocations(newLocations);
    }
    
    setEditingIndex(null);
    setEditForm({});
  };

  const handleAddCharacter = () => {
    // Yeni yapılandırılmış karakter formatı
    const newCharacter = {
      id: `char_${Date.now()}`,
      name: 'Yeni Karakter',
      displayName: 'Yeni Karakter',
      role: 'Ana karakter / Yan karakter',
      physicalDescription: 'Fiziksel özellikler: boy, kilo, saç, göz rengi, ayırt edici özellikler',
      personality: 'Kişilik özellikleri ve karakter yapısı',
      motivations: 'Motivasyonlar ve amaçlar',
      visualStyle: 'Giyim tarzı ve görsel stil',
      costumeNotes: 'Kostüm detayları',
      keyScenes: [],
      relationships: [],
      development: 'Karakter gelişim yayı',
      visualPrompt: '',
      metadata: {
        extractedAt: new Date().toISOString(),
        sourceFormat: 'manual',
        completeness: 0,
        readyForVisualization: false,
        hasVisualDescription: false
      },
      // Eski format uyumluluğu için
      age: '25-35',
      physical: 'Fiziksel özellikler (boy, saç, göz rengi)',
      style: 'Giyim tarzı',
      gestures: 'Karakteristik hareketler'
    };
    
    setCharacters([...characters, newCharacter]);
  };

  const handleDelete = (index, type = 'character') => {
    if (type === 'character') {
      setCharacters(characters.filter((_, i) => i !== index));
    } else {
      setLocations(locations.filter((_, i) => i !== index));
    }
  };

  const handleContinue = () => {
    onCharactersUpdated({
      characters: { characters },
      locations: { locations }
    });
    onContinue();
  };

  return (
    <div className="character-visualization">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-cinema-accent rounded-lg flex items-center justify-center text-3xl">
              🎭
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Karakterler ve Mekanlar</h2>
              <p className="text-cinema-text-dim text-sm">Karakterleri ve mekanları inceleyip düzenleyin</p>
              
              {/* Karakter Özet Bilgisi */}
              {characterSummary && (
                <div className="flex gap-4 mt-2 text-xs">
                  <span className="text-green-400">
                    ✓ {characterSummary.readyForVisualization}/{characterSummary.totalCharacters} görselleştirmeye hazır
                  </span>
                  <span className="text-cinema-text-dim">
                    📊 Ortalama tamlık: %{Math.round(characterSummary.averageCompleteness)}
                  </span>
                  <span className="text-cinema-text-dim">
                    🎨 {characterSummary.charactersWithVisualDescription} fiziksel tanım
                  </span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={handleContinue}
            className="bg-cinema-accent hover:bg-cinema-accent/90 text-cinema-black px-6 py-3 rounded-lg font-medium transition-all transform hover:scale-105"
          >
            Devam Et →
          </button>
        </div>
      </div>

      {/* Characters Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <span>👥</span>
            Karakterler ({characters.length})
          </h3>
          <button
            onClick={handleAddCharacter}
            className="bg-cinema-gray hover:bg-cinema-gray-light text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            + Karakter Ekle
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {characters.map((char, index) => (
            <div
              key={index}
              className="bg-cinema-dark border border-cinema-gray rounded-lg p-4 hover:border-cinema-accent transition-colors"
            >
              {editingIndex?.index === index && editingIndex?.type === 'character' ? (
                // Edit Mode
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full bg-cinema-black border border-cinema-gray rounded px-3 py-2 text-white text-lg font-semibold"
                    placeholder="Karakter Adı"
                  />
                  <input
                    type="text"
                    value={editForm.age || ''}
                    onChange={(e) => setEditForm({ ...editForm, age: e.target.value })}
                    className="w-full bg-cinema-black border border-cinema-gray rounded px-3 py-2 text-cinema-text text-sm"
                    placeholder="Yaş aralığı"
                  />
                  <textarea
                    value={editForm.physical || ''}
                    onChange={(e) => setEditForm({ ...editForm, physical: e.target.value })}
                    className="w-full bg-cinema-black border border-cinema-gray rounded px-3 py-2 text-cinema-text text-sm"
                    placeholder="Fiziksel özellikler"
                    rows={2}
                  />
                  <textarea
                    value={editForm.personality || ''}
                    onChange={(e) => setEditForm({ ...editForm, personality: e.target.value })}
                    className="w-full bg-cinema-black border border-cinema-gray rounded px-3 py-2 text-cinema-text text-sm"
                    placeholder="Kişilik"
                    rows={2}
                  />
                  <input
                    type="text"
                    value={editForm.style || ''}
                    onChange={(e) => setEditForm({ ...editForm, style: e.target.value })}
                    className="w-full bg-cinema-black border border-cinema-gray rounded px-3 py-2 text-cinema-text text-sm"
                    placeholder="Giyim tarzı"
                  />
                  <input
                    type="text"
                    value={editForm.role || ''}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full bg-cinema-black border border-cinema-gray rounded px-3 py-2 text-cinema-text text-sm"
                    placeholder="Hikayedeki rolü"
                  />
                  <textarea
                    value={editForm.gestures || ''}
                    onChange={(e) => setEditForm({ ...editForm, gestures: e.target.value })}
                    className="w-full bg-cinema-black border border-cinema-gray rounded px-3 py-2 text-cinema-text text-sm"
                    placeholder="Karakteristik hareketler ve jestler"
                    rows={2}
                  />
                  <textarea
                    value={editForm.relationships || ''}
                    onChange={(e) => setEditForm({ ...editForm, relationships: e.target.value })}
                    className="w-full bg-cinema-black border border-cinema-gray rounded px-3 py-2 text-cinema-text text-sm"
                    placeholder="Diğer karakterlerle ilişkiler"
                    rows={2}
                  />
                  
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleSave}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm transition-colors"
                    >
                      ✓ Kaydet
                    </button>
                    <button
                      onClick={() => setEditingIndex(null)}
                      className="flex-1 bg-cinema-gray hover:bg-cinema-gray-light text-white px-3 py-2 rounded text-sm transition-colors"
                    >
                      İptal
                    </button>
                  </div>
                </div>
              ) : (
                // View Mode - Yapılandırılmış veri desteği
                <>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-white mb-1">{char.name || char.displayName}</h4>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {char.role && (
                          <span className="text-xs text-cinema-accent bg-cinema-accent/10 px-2 py-1 rounded">
                            {char.role}
                          </span>
                        )}
                        {char.age && (
                          <span className="text-xs text-blue-400 bg-blue-400/10 px-2 py-1 rounded">
                            {char.age}
                          </span>
                        )}
                        {char.metadata?.readyForVisualization && (
                          <span className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded">
                            ✓ Hazır
                          </span>
                        )}
                        {char.metadata?.completeness && (
                          <span className="text-xs text-purple-400 bg-purple-400/10 px-2 py-1 rounded">
                            %{char.metadata.completeness}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(index, 'character')}
                        className="p-2 hover:bg-cinema-gray rounded transition-colors"
                        title="Düzenle"
                      >
                        <svg className="w-4 h-4 text-cinema-text-dim" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(index, 'character')}
                        className="p-2 hover:bg-red-900/30 rounded transition-colors"
                        title="Sil"
                      >
                        <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    {/* Fiziksel Tanım - Yeni ve eski yapı desteği */}
                    {(char.physicalDescription || char.physical) && (
                      <div>
                        <span className="text-cinema-text-dim font-semibold">Fiziksel:</span>
                        <p className="text-cinema-text text-xs mt-1 whitespace-pre-line">
                          {char.physicalDescription || char.physical}
                        </p>
                      </div>
                    )}
                    
                    {/* Kişilik */}
                    {char.personality && (
                      <div>
                        <span className="text-cinema-text-dim font-semibold">Kişilik:</span>
                        <p className="text-cinema-text text-xs mt-1 whitespace-pre-line">{char.personality}</p>
                      </div>
                    )}
                    
                    {/* Görsel Stil */}
                    {(char.visualStyle || char.style || char.costumeNotes) && (
                      <div>
                        <span className="text-cinema-text-dim font-semibold">Görsel Stil:</span>
                        <p className="text-cinema-text text-xs mt-1 whitespace-pre-line">
                          {char.visualStyle || char.style || char.costumeNotes}
                        </p>
                      </div>
                    )}
                    
                    {/* Motivasyon */}
                    {char.motivations && (
                      <div>
                        <span className="text-cinema-text-dim font-semibold">Motivasyon:</span>
                        <p className="text-cinema-text text-xs mt-1 whitespace-pre-line">{char.motivations}</p>
                      </div>
                    )}
                    
                    {/* Jestler ve Hareketler */}
                    {char.gestures && (
                      <div>
                        <span className="text-cinema-text-dim font-semibold">Karakteristik Özellikler:</span>
                        <p className="text-cinema-text text-xs mt-1">{char.gestures}</p>
                      </div>
                    )}
                    
                    {/* İlişkiler */}
                    {char.relationships && char.relationships.length > 0 && (
                      <div>
                        <span className="text-cinema-text-dim font-semibold">İlişkiler:</span>
                        <ul className="text-cinema-text text-xs mt-1 space-y-1 list-disc list-inside">
                          {Array.isArray(char.relationships) 
                            ? char.relationships.map((rel, i) => <li key={`rel-${char.name || char.id}-${i}`}>{rel}</li>)
                            : <li>{char.relationships}</li>
                          }
                        </ul>
                      </div>
                    )}
                    
                    {/* Görsel Prompt */}
                    {char.visualPrompt && (
                      <div className="mt-3 pt-3 border-t border-cinema-gray">
                        <span className="text-green-400 text-xs font-semibold">🎨 Görsel Prompt:</span>
                        <p className="text-cinema-text-dim text-xs mt-1 italic bg-cinema-black/50 p-2 rounded">
                          {char.visualPrompt}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Locations Section */}
      <div>
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <span>🏛️</span>
          Mekanlar ({locations.length})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {locations.map((loc, index) => (
            <div
              key={index}
              className="bg-cinema-dark border border-cinema-gray rounded-lg p-4 hover:border-cinema-accent transition-colors"
            >
              {editingIndex?.index === index && editingIndex?.type === 'location' ? (
                // Edit Mode for Location
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full bg-cinema-black border border-cinema-gray rounded px-3 py-2 text-white text-lg font-semibold"
                    placeholder="Mekan Adı"
                  />
                  <input
                    type="text"
                    value={editForm.type || ''}
                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                    className="w-full bg-cinema-black border border-cinema-gray rounded px-3 py-2 text-cinema-text text-sm"
                    placeholder="İç/Dış mekan"
                  />
                  <textarea
                    value={editForm.description || ''}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full bg-cinema-black border border-cinema-gray rounded px-3 py-2 text-cinema-text text-sm"
                    placeholder="Açıklama"
                    rows={2}
                  />
                  <input
                    type="text"
                    value={editForm.atmosphere || ''}
                    onChange={(e) => setEditForm({ ...editForm, atmosphere: e.target.value })}
                    className="w-full bg-cinema-black border border-cinema-gray rounded px-3 py-2 text-cinema-text text-sm"
                    placeholder="Atmosfer"
                  />
                  
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleSave}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm transition-colors"
                    >
                      ✓ Kaydet
                    </button>
                    <button
                      onClick={() => setEditingIndex(null)}
                      className="flex-1 bg-cinema-gray hover:bg-cinema-gray-light text-white px-3 py-2 rounded text-sm transition-colors"
                    >
                      İptal
                    </button>
                  </div>
                </div>
              ) : (
                // View Mode
                <>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-white mb-1">{loc.name}</h4>
                      <span className="text-xs text-purple-400 bg-purple-400/10 px-2 py-1 rounded">
                        {loc.type}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(index, 'location')}
                        className="p-2 hover:bg-cinema-gray rounded transition-colors"
                        title="Düzenle"
                      >
                        <svg className="w-4 h-4 text-cinema-text-dim" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(index, 'location')}
                        className="p-2 hover:bg-red-900/30 rounded transition-colors"
                        title="Sil"
                      >
                        <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-cinema-text-dim">Açıklama:</span>
                      <p className="text-cinema-text">{loc.description}</p>
                    </div>
                    <div>
                      <span className="text-cinema-text-dim">Atmosfer:</span>
                      <p className="text-cinema-text">{loc.atmosphere}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="mt-8 pt-6 border-t border-cinema-gray flex justify-between items-center">
        <div className="text-cinema-text-dim text-sm">
          <span className="text-cinema-accent font-bold">{characters.length}</span> karakter ve{' '}
          <span className="text-purple-400 font-bold">{locations.length}</span> mekan tanımlandı
        </div>
        <button
          onClick={handleContinue}
          className="bg-cinema-accent hover:bg-cinema-accent/90 text-cinema-black px-8 py-3 rounded-lg font-medium transition-all transform hover:scale-105 flex items-center gap-2"
        >
          Stil Analizine Geç
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
