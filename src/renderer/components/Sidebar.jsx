import React from 'react';
import { useScriptStore } from '../store/scriptStore';
import { parseScenes, extractCharacters } from '../utils/textProcessing';

export default function Sidebar() {
  const { scriptText, cleanedText, pageCount, scenes } = useScriptStore();

  // Parse scenes if not already done
  const sceneList = scenes.length > 0 ? scenes : parseScenes(cleanedText || scriptText);
  const characters = extractCharacters(cleanedText || scriptText);

  return (
    <div className="p-4 h-full overflow-y-auto">
      {/* Script Info */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-cinema-accent mb-3">Script Info</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-cinema-text-dim">Pages:</span>
            <span className="text-cinema-text font-medium">{pageCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-cinema-text-dim">Scenes:</span>
            <span className="text-cinema-text font-medium">{sceneList.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-cinema-text-dim">Characters:</span>
            <span className="text-cinema-text font-medium">{characters.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-cinema-text-dim">Est. Runtime:</span>
            <span className="text-cinema-text font-medium">~{pageCount} min</span>
          </div>
        </div>
      </div>

      {/* Scene List */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-cinema-accent mb-3">Scenes</h2>
        {sceneList.length > 0 ? (
          <div className="space-y-2">
            {sceneList.map((scene, index) => (
              <button
                key={index}
                className="w-full text-left p-3 bg-cinema-gray hover:bg-cinema-gray-light rounded-lg transition-colors group"
              >
                <div className="flex items-start gap-2">
                  <span className="text-cinema-accent font-bold text-xs mt-1">
                    #{scene.sceneNumber}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-cinema-text text-xs font-medium truncate group-hover:text-cinema-accent transition-colors">
                      {scene.header}
                    </p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[10px] px-2 py-0.5 bg-cinema-dark rounded text-cinema-text-dim">
                        {scene.intExt}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 bg-cinema-dark rounded text-cinema-text-dim">
                        {scene.timeOfDay}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-cinema-text-dim text-sm">No scenes detected</p>
        )}
      </div>

      {/* Characters */}
      <div>
        <h2 className="text-lg font-bold text-cinema-accent mb-3">Characters</h2>
        {characters.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {characters.map((character, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-cinema-gray text-cinema-text text-xs rounded-full"
              >
                {character}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-cinema-text-dim text-sm">No characters detected</p>
        )}
      </div>
    </div>
  );
}
