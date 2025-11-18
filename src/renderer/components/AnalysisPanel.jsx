import React, { useState } from 'react';
import { useScriptStore } from '../store/scriptStore';
import { useAIStore } from '../store/aiStore';
import { analyzeScreenplay } from '../utils/aiService2';

export default function AnalysisPanel() {
  const { cleanedText, scriptText, analysisData, setAnalysisData } = useScriptStore();
  const { isConfigured, provider } = useAIStore();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState('scenes'); // 'scenes', 'locations', 'characters', 'equipment'

  const handleAnalyze = async () => {
    if (!isConfigured()) {
      alert('Please configure your AI provider in Settings first.');
      return;
    }

    setIsAnalyzing(true);
    try {
      const text = cleanedText || scriptText;
      const result = await analyzeScreenplay(text);
      
      if (result.success) {
        setAnalysisData(result.data);
      } else {
        alert(`Analysis failed: ${result.error}`);
      }
    } catch (error) {
      alert(`Analysis failed: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExport = async () => {
    if (!analysisData) return;

    try {
      const filePath = await window.electronAPI.saveFile({
        defaultPath: 'screenplay-analysis.json',
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (filePath) {
        await window.electronAPI.saveFileContent({
          filePath,
          data: JSON.stringify(analysisData, null, 2),
        });
        alert('Analysis exported successfully!');
      }
    } catch (error) {
      alert(`Export failed: ${error.message}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-cinema-black">
      {/* Toolbar */}
      <div className="bg-cinema-dark border-b border-cinema-gray p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-cinema-accent">AI Analysis</h2>
          <div className="flex items-center gap-3">
            {analysisData && (
              <button onClick={handleExport} className="btn-secondary text-sm">
                💾 Export Analysis
              </button>
            )}
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !isConfigured()}
              className="btn-primary text-sm disabled:opacity-50 flex items-center gap-2"
              title={!isConfigured() ? 'Configure AI Provider in Settings' : ''}
            >
              {isAnalyzing ? (
                <>
                  <span className="inline-block animate-spin mr-2">⏳</span>
                  Analyzing...
                </>
              ) : (
                <>
                  🤖 Run Analysis
                  <span className="text-xs opacity-75">
                    ({provider === 'openai' ? 'OpenAI' : provider === 'gemini' ? 'Gemini' : 'Local'})
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {!analysisData ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-4">🎬</div>
              <h3 className="text-xl font-bold text-cinema-text mb-2">
                No Analysis Yet
              </h3>
              <p className="text-cinema-text-dim mb-6">
                Click "Run Analysis" to get AI-powered production breakdown including
                scenes, locations, characters, and equipment needs.
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-cinema-dark p-4 rounded-lg border border-cinema-gray">
                <div className="text-3xl font-bold text-cinema-accent">
                  {analysisData.summary?.totalScenes || 0}
                </div>
                <div className="text-sm text-cinema-text-dim">Total Scenes</div>
              </div>
              <div className="bg-cinema-dark p-4 rounded-lg border border-cinema-gray">
                <div className="text-3xl font-bold text-cinema-accent">
                  {analysisData.locations?.length || 0}
                </div>
                <div className="text-sm text-cinema-text-dim">Locations</div>
              </div>
              <div className="bg-cinema-dark p-4 rounded-lg border border-cinema-gray">
                <div className="text-3xl font-bold text-cinema-accent">
                  {analysisData.characters?.length || 0}
                </div>
                <div className="text-sm text-cinema-text-dim">Characters</div>
              </div>
              <div className="bg-cinema-dark p-4 rounded-lg border border-cinema-gray">
                <div className="text-3xl font-bold text-cinema-accent">
                  {analysisData.summary?.estimatedShootingDays || 0}
                </div>
                <div className="text-sm text-cinema-text-dim">Est. Shoot Days</div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4 bg-cinema-gray rounded-lg p-1">
              {['scenes', 'locations', 'characters', 'equipment'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-4 py-2 rounded-md transition-all capitalize ${
                    activeTab === tab
                      ? 'bg-cinema-accent text-cinema-black font-medium'
                      : 'text-cinema-text hover:bg-cinema-gray-light'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="bg-cinema-dark rounded-lg border border-cinema-gray p-6">
              {activeTab === 'scenes' && (
                <ScenesTab scenes={analysisData.scenes || []} />
              )}
              {activeTab === 'locations' && (
                <LocationsTab locations={analysisData.locations || []} />
              )}
              {activeTab === 'characters' && (
                <CharactersTab characters={analysisData.characters || []} />
              )}
              {activeTab === 'equipment' && (
                <EquipmentTab equipment={analysisData.equipment || []} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ScenesTab({ scenes }) {
  return (
    <div className="space-y-4">
      {scenes.map((scene, index) => (
        <div key={index} className="p-4 bg-cinema-gray rounded-lg">
          <div className="flex items-start gap-4">
            <div className="text-cinema-accent font-bold text-lg">
              #{scene.number}
            </div>
            <div className="flex-1">
              <h4 className="text-cinema-text font-bold mb-2">{scene.header}</h4>
              <p className="text-cinema-text-dim text-sm mb-3">{scene.description}</p>
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs px-2 py-1 bg-cinema-black rounded text-cinema-text">
                  {scene.intExt}
                </span>
                <span className="text-xs px-2 py-1 bg-cinema-black rounded text-cinema-text">
                  {scene.timeOfDay}
                </span>
                <span className="text-xs px-2 py-1 bg-cinema-black rounded text-cinema-text">
                  ~{scene.estimatedDuration} min
                </span>
                {scene.characters?.map((char, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 bg-cinema-accent/20 rounded text-cinema-accent"
                  >
                    {char}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LocationsTab({ locations }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {locations.map((location, index) => (
        <div key={index} className="p-4 bg-cinema-gray rounded-lg">
          <h4 className="text-cinema-text font-bold mb-2">{location.name}</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-cinema-text-dim">Type:</span>
              <span className="text-cinema-text">{location.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cinema-text-dim">Scenes:</span>
              <span className="text-cinema-text">{location.sceneCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cinema-text-dim">Est. Days:</span>
              <span className="text-cinema-accent font-medium">
                {location.estimatedShootingDays}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CharactersTab({ characters }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {characters.map((character, index) => (
        <div key={index} className="p-4 bg-cinema-gray rounded-lg">
          <h4 className="text-cinema-text font-bold mb-2">{character.name}</h4>
          <p className="text-cinema-text-dim text-sm mb-3">{character.description}</p>
          <div className="text-xs text-cinema-text">
            Appears in <span className="text-cinema-accent font-bold">{character.sceneCount}</span> scenes
          </div>
        </div>
      ))}
    </div>
  );
}

function EquipmentTab({ equipment }) {
  return (
    <div className="space-y-4">
      {equipment.map((item, index) => (
        <div key={index} className="p-4 bg-cinema-gray rounded-lg">
          <h4 className="text-cinema-text font-bold mb-2">{item.item}</h4>
          <p className="text-cinema-text-dim text-sm mb-2">{item.reason}</p>
          <div className="text-xs text-cinema-text">
            Required for scenes: {item.scenes?.join(', ')}
          </div>
        </div>
      ))}
    </div>
  );
}
