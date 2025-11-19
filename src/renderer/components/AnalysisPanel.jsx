import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useScriptStore } from '../store/scriptStore';
import { useAIStore } from '../store/aiStore';
import { usePromptStore } from '../store/promptStore';
import AIHandler from '../utils/aiHandler';

export default function AnalysisPanel() {
  const { cleanedText, scriptText, analysisData, setAnalysisData } = useScriptStore();
  const { isConfigured, provider, getAIHandler } = useAIStore();
  const { getActivePrompt, getPromptTypes, activePrompts } = usePromptStore();
  const { t } = useTranslation();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'scenes', 'locations', 'characters', 'equipment', 'vfx', 'production', 'evaluation', 'audience', 'custom'
  const [useCustomAnalysis, setUseCustomAnalysis] = useState(false);
  const [selectedCustomPrompt, setSelectedCustomPrompt] = useState('character');
  const [customResults, setCustomResults] = useState({});

  const handleAnalyze = async () => {
    if (!isConfigured()) {
      alert(t('analysis.configureFirst', 'Please configure your AI provider in Settings first.'));
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress(null);

    try {
      const text = cleanedText || scriptText;
      const aiHandler = getAIHandler();

      console.log(`🔍 Starting analysis with provider: ${provider}`);

      // Optimal chunking settings per provider
      const isCloudProvider = provider === 'openai' || provider === 'gemini';
      const useChunking = !isCloudProvider && text.length > 15000;

      let result;

      if (useCustomAnalysis) {
        console.log('Running custom prompt analysis');

        // Get active custom prompt
        const customPrompt = getActivePrompt('analysis');

        if (!customPrompt || !customPrompt.system || !customPrompt.user) {
          throw new Error('Custom prompt not properly configured');
        }

        // Run custom analysis
        const customAnalysisText = await aiHandler.analyzeWithCustomPrompt(text, {
          systemPrompt: customPrompt.system,
          userPrompt: customPrompt.user,
          useChunking,
          onProgress: (progress) => {
            setAnalysisProgress(progress);
            console.log('Custom analysis progress:', progress);
          },
        });

        // Store custom results and create compatible structure
        const newCustomResults = {
          ...customResults,
          [selectedCustomPrompt]: customAnalysisText
        };
        setCustomResults(newCustomResults);

        // Create structure compatible with tab display
        result = {
          isCustomAnalysis: true,
          customResults: newCustomResults,
          activeCustomPrompt: selectedCustomPrompt,
          summary: { totalScenes: 0, estimatedShootingDays: 0 },
          scenes: [],
          locations: [],
          characters: [],
          equipment: []
        };

        // Auto-switch to custom tab
        setActiveTab('custom');
      } else {
        console.log('Running comprehensive enhanced screenplay analysis');

        // Enhanced analysis with all 8 engines
        result = await aiHandler.analyzeScreenplayEnhanced(text, [], [], {
          useChunking,
          language: t('language.code', 'en'), // Pass current language
          onProgress: (progress) => {
            setAnalysisProgress(progress);
            console.log('Analysis progress:', progress);
          },
        });

        // Ensure it's marked as default analysis
        result.isCustomAnalysis = false;
      }

      setAnalysisData(result);
      setAnalysisProgress(null);
    } catch (error) {
      console.error('Analysis failed:', error);
      alert(`Analysis failed: ${error.message}`);
      setAnalysisProgress(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef(null);

  // Close export menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setShowExportMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleExport = async (format = 'json') => {
    if (!analysisData) return;

    try {
      let defaultPath, filters, data;

      switch (format) {
        case 'pdf':
          defaultPath = 'screenplay-analysis.pdf';
          filters = [{ name: 'PDF Files', extensions: ['pdf'] }];
          data = generatePDFContent(analysisData);
          break;
        case 'docx':
          defaultPath = 'screenplay-analysis.docx';
          filters = [{ name: 'Word Documents', extensions: ['docx'] }];
          data = generateDocxContent(analysisData);
          break;
        case 'json':
        default:
          defaultPath = 'screenplay-analysis.json';
          filters = [{ name: 'JSON Files', extensions: ['json'] }, { name: 'All Files', extensions: ['*'] }];
          data = JSON.stringify(analysisData, null, 2);
          break;
      }

      const filePath = await window.electronAPI.saveFile({
        defaultPath,
        filters,
      });

      if (filePath) {
        if (format === 'pdf' || format === 'docx') {
          // For PDF/DOCX, we'll need to implement proper document generation
          await generateStructuredDocument(analysisData, format, filePath);
        } else {
          await window.electronAPI.saveFileContent({
            filePath,
            data,
          });
        }
        alert(`Analysis exported successfully as ${format.toUpperCase()}!`);
        setShowExportMenu(false);
      }
    } catch (error) {
      alert(`Export failed: ${error.message}`);
    }
  };

  const generateStructuredDocument = async (data, format, filePath) => {
    // This will generate a properly formatted document with visual layout
    const documentContent = {
      title: 'Screenplay Analysis Report',
      timestamp: new Date().toLocaleString(),
      sections: [
        {
          title: 'Executive Summary',
          content: generateOverviewSection(data)
        },
        {
          title: 'Scene Breakdown',
          content: generateSceneSection(data.scenes || [])
        },
        {
          title: 'Cast & Characters',
          content: generateCharacterSection(data.characters || [])
        },
        {
          title: 'Location Analysis',
          content: generateLocationSection(data.locations || [])
        },
        {
          title: 'Equipment Requirements',
          content: generateEquipmentSection(data.equipment || [])
        },
        {
          title: 'VFX & SFX Requirements',
          content: generateVFXSection(data.vfxRequirements || [], data.sfxRequirements || [])
        },
        {
          title: 'Virtual Production Assessment',
          content: generateVirtualProductionSection(data.virtualProductionSuitability || {})
        },
        {
          title: 'Screenplay Evaluation',
          content: generateEvaluationSection(data.evaluation || {})
        },
        {
          title: 'Audience & Platform Analysis',
          content: generateAudienceSection(data.audienceAnalysis || {})
        }
      ]
    };

    // Send to main process for document generation
    await window.electronAPI.generateDocument({
      content: documentContent,
      format,
      filePath
    });
  };

  const generateOverviewSection = (data) => {
    return {
      type: 'overview',
      metrics: {
        scenes: data.scenes?.length || 0,
        characters: data.characters?.length || 0,
        locations: data.locations?.length || 0,
        shootDays: data.summary?.estimatedShootingDays || 'TBD'
      },
      summary: data.summary || {}
    };
  };

  const generateSceneSection = (scenes) => {
    return {
      type: 'scenes',
      data: scenes.map(scene => ({
        number: scene.number,
        header: scene.header,
        description: scene.description,
        intExt: scene.intExt,
        timeOfDay: scene.timeOfDay,
        duration: scene.estimatedDuration,
        characters: scene.characters || []
      }))
    };
  };

  const generateCharacterSection = (characters) => {
    return {
      type: 'characters',
      data: characters.map(char => ({
        name: char.name,
        description: char.description,
        importance: char.importance,
        sceneCount: char.sceneCount
      }))
    };
  };

  const generateLocationSection = (locations) => {
    return {
      type: 'locations',
      data: locations.map(loc => ({
        name: loc.name,
        type: loc.type,
        sceneCount: loc.sceneCount,
        shootingDays: loc.estimatedShootingDays
      }))
    };
  };

  const generateEquipmentSection = (equipment) => {
    return {
      type: 'equipment',
      data: equipment.map(item => ({
        item: item.item,
        category: item.category,
        reason: item.reason,
        priority: item.priority,
        scenes: item.scenes
      }))
    };
  };

  const generateVFXSection = (vfx, sfx) => {
    return {
      type: 'vfx',
      vfx: vfx.map(item => ({
        type: item.type,
        description: item.description,
        complexity: item.complexity,
        scenes: item.scenes
      })),
      sfx: sfx.map(item => ({
        type: item.type,
        description: item.description,
        category: item.category,
        priority: item.priority
      }))
    };
  };

  const generateVirtualProductionSection = (vpData) => {
    return {
      type: 'virtualProduction',
      data: vpData
    };
  };

  const generateEvaluationSection = (evaluation) => {
    return {
      type: 'evaluation',
      data: evaluation
    };
  };

  const generateAudienceSection = (audience) => {
    return {
      type: 'audience',
      data: audience
    };
  };

  return (
    <div className="flex flex-col h-full bg-cinema-black">
      {/* Toolbar */}
      <div className="bg-cinema-dark border-b border-cinema-gray p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-cinema-accent">{t('analysis.title')}</h2>
          <div className="flex items-center gap-3">
            {analysisData && !isAnalyzing && (
              <div className="relative" ref={exportMenuRef}>
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="btn-secondary text-sm flex items-center gap-2"
                >
                  💾 {t('analysis.exportAnalysis')}
                  <span className="text-xs">▼</span>
                </button>

                {showExportMenu && (
                  <div className="absolute top-full right-0 mt-1 bg-cinema-dark border border-cinema-gray rounded-lg shadow-lg z-50 min-w-[200px]">
                    <button
                      onClick={() => handleExport('json')}
                      className="w-full px-4 py-2 text-left text-sm text-cinema-text hover:bg-cinema-gray transition-colors flex items-center gap-2"
                    >
                      📄 JSON (Data)
                    </button>
                    <button
                      onClick={() => handleExport('pdf')}
                      className="w-full px-4 py-2 text-left text-sm text-cinema-text hover:bg-cinema-gray transition-colors flex items-center gap-2"
                    >
                      📋 PDF (Report)
                    </button>
                    <button
                      onClick={() => handleExport('docx')}
                      className="w-full px-4 py-2 text-left text-sm text-cinema-text hover:bg-cinema-gray transition-colors flex items-center gap-2 rounded-b-lg"
                    >
                      📝 Word Document
                    </button>
                  </div>
                )}
              </div>
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
                  {analysisProgress?.message || t('analysis.analyzing')}
                </>
              ) : (
                <>
                  🤖 {t('analysis.runAnalysis')}
                  <span className="text-xs opacity-75">
                    ({provider === 'openai' ? 'OpenAI' : provider === 'gemini' ? 'Gemini' : provider === 'local' ? 'Local' : provider === 'mlx' ? 'MLX' : provider})
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Analysis Configuration */}
        <div className="bg-cinema-gray rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-cinema-text">{t('analysis.config.title')}</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-cinema-text-dim">{t('analysis.config.analysisMode')}</span>
              <button
                onClick={() => setUseCustomAnalysis(!useCustomAnalysis)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${useCustomAnalysis
                  ? 'bg-cinema-accent text-cinema-black'
                  : 'bg-cinema-gray-light text-cinema-text hover:bg-cinema-accent/20'
                  }`}
              >
                {useCustomAnalysis ? '🎯 Custom' : '📊 Standard'}
              </button>
            </div>
          </div>

          {useCustomAnalysis ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-cinema-text mb-2 block">
                  {t('analysis.config.selectCustom')}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {getPromptTypes('analysis').filter(p => p.isCustom).map(({ key, name }) => (
                    <button
                      key={key}
                      onClick={() => setSelectedCustomPrompt(key)}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors ${selectedCustomPrompt === key
                        ? 'bg-cinema-accent text-cinema-black font-medium'
                        : 'bg-cinema-gray-light text-cinema-text hover:bg-cinema-accent/20'
                        }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-xs text-cinema-text-dim bg-cinema-black/30 p-2 rounded">
                💡 <strong>Custom Analysis:</strong> Uses your predefined prompts for specialized analysis.
                Results will appear in a dedicated Custom tab with formatted text output.
              </div>
            </div>
          ) : (
            <div className="text-sm text-cinema-text-dim">
              📊 <strong>Standard Analysis:</strong> Comprehensive screenplay breakdown including characters, locations, scenes, and production requirements.
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {isAnalyzing && analysisProgress && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm text-cinema-text-dim mb-1">
              <span>{analysisProgress.message}</span>
              {analysisProgress.currentChunk && analysisProgress.totalChunks && (
                <span>
                  Chunk {analysisProgress.currentChunk} of {analysisProgress.totalChunks}
                </span>
              )}
              <span>{Math.round(analysisProgress.progress || 0)}%</span>
            </div>
            <div className="w-full bg-cinema-gray-light rounded-full h-2">
              <div
                className="bg-cinema-accent h-2 rounded-full transition-all duration-300"
                style={{ width: `${analysisProgress.progress || 0}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {!analysisData ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-4">🎬</div>
              <h3 className="text-xl font-bold text-cinema-text mb-2">
                {t('analysis.noAnalysisYet')}
              </h3>
              <p className="text-cinema-text-dim mb-6">
                {t('analysis.noAnalysisYetDesc')}
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            {/* Comprehensive Analysis Results */}
            <>
              {/* Enhanced Summary Cards */}
              {analysisData.isCustomAnalysis ? (
                /* Custom Analysis Summary */
                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="bg-gradient-to-br from-cinema-dark to-cinema-gray p-5 rounded-lg border border-cinema-gray hover:border-cinema-accent/30 transition-colors cursor-pointer"
                    onClick={() => setActiveTab('custom')}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-2xl">🎯</div>
                      <div className="text-3xl font-bold text-cinema-accent">
                        {analysisData.customResults ? Object.keys(analysisData.customResults).length : 0}
                      </div>
                    </div>
                    <div className="text-sm text-cinema-text-dim">{t('analysis.tabs.customResults')}</div>
                    <div className="text-xs text-cinema-accent mt-1">{t('analysis.clickToViewAnalysis')}</div>
                  </div>
                  <div className="bg-gradient-to-br from-cinema-dark to-cinema-gray p-5 rounded-lg border border-cinema-gray">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-2xl">📝</div>
                      <div className="text-3xl font-bold text-cinema-accent">
                        {analysisData.activeCustomPrompt ? 1 : 0}
                      </div>
                    </div>
                    <div className="text-sm text-cinema-text-dim">{t('analysis.activeAnalysis')}</div>
                    <div className="text-xs text-cinema-text-dim mt-1">{analysisData.activeCustomPrompt || 'None'}</div>
                  </div>
                  <div className="bg-gradient-to-br from-cinema-dark to-cinema-gray p-5 rounded-lg border border-cinema-gray">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-2xl">⚡</div>
                      <div className="text-3xl font-bold text-cinema-accent">
                        Custom
                      </div>
                    </div>
                    <div className="text-sm text-cinema-text-dim">{t('analysis.analysisType')}</div>
                    <div className="text-xs text-cinema-accent mt-1">{t('analysis.specializedPrompt')}</div>
                  </div>
                </div>
              ) : (
                /* Standard Analysis Summary */
                <div className="grid grid-cols-4 gap-4 mb-8">
                  <div className="bg-gradient-to-br from-cinema-dark to-cinema-gray p-5 rounded-lg border border-cinema-gray hover:border-cinema-accent/30 transition-colors cursor-pointer"
                    onClick={() => setActiveTab('scenes')}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-2xl">🎬</div>
                      <div className="text-3xl font-bold text-cinema-accent">
                        {analysisData.summary?.totalScenes || analysisData.scenes?.length || 0}
                      </div>
                    </div>
                    <div className="text-sm text-cinema-text-dim">{t('analysis.totalScenes')}</div>
                    <div className="text-xs text-cinema-accent mt-1">{t('common.clickToView')}</div>
                  </div>
                  <div className="bg-gradient-to-br from-cinema-dark to-cinema-gray p-5 rounded-lg border border-cinema-gray hover:border-cinema-accent/30 transition-colors cursor-pointer"
                    onClick={() => setActiveTab('locations')}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-2xl">📍</div>
                      <div className="text-3xl font-bold text-cinema-accent">
                        {analysisData.locations?.length || 0}
                      </div>
                    </div>
                    <div className="text-sm text-cinema-text-dim">{t('analysis.tabs.locations')}</div>
                    <div className="text-xs text-cinema-accent mt-1">{t('common.clickToView')}</div>
                  </div>
                  <div className="bg-gradient-to-br from-cinema-dark to-cinema-gray p-5 rounded-lg border border-cinema-gray hover:border-cinema-accent/30 transition-colors cursor-pointer"
                    onClick={() => setActiveTab('characters')}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-2xl">👥</div>
                      <div className="text-3xl font-bold text-cinema-accent">
                        {analysisData.characters?.length || 0}
                      </div>
                    </div>
                    <div className="text-sm text-cinema-text-dim">{t('analysis.tabs.characters')}</div>
                    <div className="text-xs text-cinema-accent mt-1">{t('common.clickToView')}</div>
                  </div>
                  <div className="bg-gradient-to-br from-cinema-dark to-cinema-gray p-5 rounded-lg border border-cinema-gray hover:border-cinema-accent/30 transition-colors cursor-pointer"
                    onClick={() => setActiveTab('equipment')}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-2xl">🎥</div>
                      <div className="text-3xl font-bold text-cinema-accent">
                        {analysisData.summary?.estimatedShootingDays ||
                          (analysisData.locations?.reduce((acc, loc) => acc + (parseInt(loc.estimatedShootingDays) || 1), 0)) || 0}
                      </div>
                    </div>
                    <div className="text-sm text-cinema-text-dim">{t('analysis.estShootDays')}</div>
                    <div className="text-xs text-cinema-accent mt-1">{t('common.clickToView')}</div>
                  </div>
                </div>
              )}

              {/* Enhanced Tab Navigation */}
              <div className="flex gap-1 mb-6 bg-cinema-gray rounded-xl p-1 overflow-x-auto">
                {[
                  { key: 'overview', label: t('analysis.tabs.overview'), icon: '📊', count: null, show: !analysisData.isCustomAnalysis },
                  { key: 'scenes', label: t('analysis.tabs.scenes'), icon: '🎬', count: analysisData.scenes?.length, show: !analysisData.isCustomAnalysis },
                  { key: 'locations', label: t('analysis.tabs.locations'), icon: '📍', count: analysisData.locations?.length, show: !analysisData.isCustomAnalysis },
                  { key: 'characters', label: t('analysis.tabs.characters'), icon: '👥', count: analysisData.characters?.length, show: !analysisData.isCustomAnalysis },
                  { key: 'competitive', label: t('analysis.tabs.competitive'), icon: '🏆', count: null, show: !analysisData.isCustomAnalysis && analysisData.competitiveAnalysis },
                  { key: 'geographic', label: t('analysis.tabs.geographic'), icon: '🌍', count: null, show: !analysisData.isCustomAnalysis && analysisData.geographicAnalysis },
                  { key: 'trend', label: t('analysis.tabs.trend'), icon: '📈', count: null, show: !analysisData.isCustomAnalysis && analysisData.trendAnalysis },
                  { key: 'risk', label: t('analysis.tabs.risk'), icon: '⚖️', count: null, show: !analysisData.isCustomAnalysis && analysisData.riskOpportunityAnalysis },
                  { key: 'equipment', label: t('analysis.tabs.equipment'), icon: '🎥', count: analysisData.equipment?.length, show: !analysisData.isCustomAnalysis },
                  { key: 'vfx', label: t('analysis.tabs.vfx'), icon: '✨', count: analysisData.vfxRequirements?.length || analysisData.sfxRequirements?.length, show: !analysisData.isCustomAnalysis },
                  { key: 'production', label: t('analysis.tabs.virtualProduction'), icon: '🎮', count: null, show: !analysisData.isCustomAnalysis },
                  { key: 'evaluation', label: t('analysis.tabs.evaluation'), icon: '📝', count: null, show: !analysisData.isCustomAnalysis },
                  { key: 'audience', label: t('analysis.tabs.audience'), icon: '🎯', count: null, show: !analysisData.isCustomAnalysis },
                  { key: 'custom', label: t('analysis.tabs.customResults'), icon: '🎯', count: analysisData.customResults ? Object.keys(analysisData.customResults).length : 0, show: analysisData.isCustomAnalysis }
                ].filter(tab => tab.show !== false).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex-shrink-0 px-4 py-3 rounded-lg transition-all font-medium flex items-center justify-center gap-2 ${activeTab === tab.key
                      ? 'bg-cinema-accent text-cinema-black shadow-lg'
                      : 'text-cinema-text hover:bg-cinema-gray-light hover:text-cinema-accent'
                      }`}
                  >
                    <span className="text-lg">{tab.icon}</span>
                    <span>{tab.label}</span>
                    {tab.count !== undefined && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab.key
                        ? 'bg-cinema-black/20 text-cinema-black'
                        : 'bg-cinema-accent/20 text-cinema-accent'
                        }`}>
                        {tab.count || 0}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Enhanced Tab Content */}
              <div className="bg-cinema-dark rounded-xl border border-cinema-gray-light p-6 min-h-[500px]">
                {activeTab === 'overview' && (
                  <OverviewTab analysisData={analysisData} />
                )}
                {activeTab === 'scenes' && (
                  <ScenesTab scenes={analysisData.scenes || []} />
                )}
                {activeTab === 'locations' && (
                  <LocationsTab locations={analysisData.locations || []} />
                )}
                {activeTab === 'characters' && (
                  <CharactersTab characters={analysisData.characters || []} />
                )}
                {activeTab === 'competitive' && (
                  <CompetitiveTab analysis={analysisData.competitiveAnalysis} />
                )}
                {activeTab === 'geographic' && (
                  <GeographicTab analysis={analysisData.geographicAnalysis} />
                )}
                {activeTab === 'trend' && (
                  <TrendTab analysis={analysisData.trendAnalysis} />
                )}
                {activeTab === 'risk' && (
                  <RiskTab analysis={analysisData.riskOpportunityAnalysis} />
                )}
                {activeTab === 'equipment' && (
                  <EquipmentTab equipment={analysisData.equipment || []} />
                )}
                {activeTab === 'vfx' && (
                  <VFXTab
                    vfxRequirements={analysisData.vfxRequirements || []}
                    sfxRequirements={analysisData.sfxRequirements || []}
                  />
                )}
                {activeTab === 'production' && (
                  <VirtualProductionTab
                    virtualProductionSuitability={analysisData.virtualProductionSuitability || {}}
                    shootingTechniques={analysisData.shootingTechniques || []}
                  />
                )}
                {activeTab === 'evaluation' && (
                  <EvaluationTab
                    evaluation={analysisData.evaluation || {}}
                  />
                )}
                {activeTab === 'audience' && (
                  <AudienceTab
                    audienceAnalysis={analysisData.audienceAnalysis || {}}
                  />
                )}
                {activeTab === 'custom' && (
                  <CustomAnalysisTab
                    customResults={analysisData.customResults || {}}
                    activePrompt={analysisData.activeCustomPrompt}
                    onSelectPrompt={setSelectedCustomPrompt}
                  />
                )}
              </div>
            </>
          </div>
        )}
      </div>
    </div>
  );
}

function ScenesTab({ scenes }) {
  const { t } = useTranslation();
  if (!scenes || scenes.length === 0) {
    return (
      <div className="text-center py-12 text-cinema-text-dim">
        <div className="text-4xl mb-4">🎬</div>
        <p>{t('scenes.noScenes')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-cinema-accent mb-2">{t('scenes.title')}</h3>
        <p className="text-cinema-text-dim text-sm">
          {t('scenes.desc', { count: scenes.length })}
        </p>
      </div>

      {/* Scenes List */}
      <div className="space-y-4">
        {scenes.map((scene, index) => (
          <div key={index} className="p-5 bg-cinema-gray rounded-lg border border-cinema-gray-light hover:border-cinema-accent/30 transition-colors">
            <div className="flex items-start gap-4">
              <div className="bg-cinema-accent text-cinema-black font-bold text-lg px-3 py-1 rounded-lg min-w-[60px] text-center">
                #{scene.number || index + 1}
              </div>
              <div className="flex-1">
                <h4 className="text-cinema-text font-bold text-lg mb-2">{scene.header || `Scene ${index + 1}`}</h4>
                <p className="text-cinema-text-dim text-sm mb-4 leading-relaxed">{scene.description}</p>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <span className="text-xs text-cinema-text-dim uppercase tracking-wider">{t('scenes.technicalDetails')}</span>
                    <div className="flex gap-2 flex-wrap mt-1">
                      <span className="text-xs px-2 py-1 bg-cinema-black rounded text-cinema-text border border-cinema-gray-light">
                        {scene.intExt || 'N/A'}
                      </span>
                      <span className="text-xs px-2 py-1 bg-cinema-black rounded text-cinema-text border border-cinema-gray-light">
                        {scene.timeOfDay || 'N/A'}
                      </span>
                      <span className="text-xs px-2 py-1 bg-cinema-black rounded text-cinema-text border border-cinema-gray-light">
                        ~{scene.estimatedDuration || '5'} {t('units.min')}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-cinema-text-dim uppercase tracking-wider">{t('scenes.characters')}</span>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {scene.characters && scene.characters.length > 0 ? (
                        scene.characters.map((char, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-1 bg-cinema-accent/20 rounded text-cinema-accent border border-cinema-accent/30"
                          >
                            {char}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-cinema-text-dim">{t('scenes.noCharactersSpecified')}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LocationsTab({ locations }) {
  const { t } = useTranslation();
  if (!locations || locations.length === 0) {
    return (
      <div className="text-center py-12 text-cinema-text-dim">
        <div className="text-4xl mb-4">📍</div>
        <p>{t('locations.noLocations')}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-cinema-accent mb-2">{t('locations.title')}</h3>
        <p className="text-cinema-text-dim text-sm">
          {t('locations.desc', { count: locations.length })}
        </p>
      </div>

      {/* Locations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {locations.map((location, index) => (
          <div key={index} className="p-5 bg-cinema-gray rounded-lg border border-cinema-gray-light hover:border-cinema-accent/30 transition-colors">
            <div className="flex items-start gap-3 mb-4">
              <div className="text-2xl">
                {location.type === 'INTERIOR' ? '🏠' : location.type === 'EXTERIOR' ? '🌍' : '📍'}
              </div>
              <div className="flex-1">
                <h4 className="text-cinema-text font-bold text-lg mb-1">{location.name || `Location ${index + 1}`}</h4>
                <span className="text-xs px-2 py-1 bg-cinema-accent/20 rounded text-cinema-accent">
                  {location.type || t('common.unknownType')}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {location.description && (
                <p className="text-cinema-text-dim text-sm leading-relaxed">{location.description}</p>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-cinema-text-dim">Scenes:</span>
                    <span className="text-cinema-text font-medium">{location.sceneCount || '0'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cinema-text-dim">Shoot Days:</span>
                    <span className="text-cinema-accent font-bold">
                      {location.estimatedShootingDays || 'TBD'}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  {location.requirements && location.requirements.length > 0 && (
                    <div>
                      <span className="text-cinema-text-dim text-xs uppercase tracking-wider">Requirements</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {location.requirements.slice(0, 3).map((req, i) => (
                          <span key={i} className="text-xs px-1 py-0.5 bg-cinema-black rounded text-cinema-text">
                            {req}
                          </span>
                        ))}
                        {location.requirements.length > 3 && (
                          <span className="text-xs text-cinema-text-dim">+{location.requirements.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CharactersTab({ characters }) {
  if (!characters || characters.length === 0) {
    return (
      <div className="text-center py-12 text-cinema-text-dim">
        <div className="text-4xl mb-4">👥</div>
        <p>No characters detected in analysis</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-cinema-accent mb-2">{t('characters.title')}</h3>
        <p className="text-cinema-text-dim text-sm">
          {t('characters.desc', { count: characters.length })}
        </p>
      </div>

      {/* Characters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {characters.map((character, index) => (
          <div key={index} className="p-5 bg-cinema-gray rounded-lg border border-cinema-gray-light hover:border-cinema-accent/30 transition-colors">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 bg-cinema-accent/20 rounded-full flex items-center justify-center text-xl">
                {character.importance === 'main' ? '⭐' : character.importance === 'supporting' ? '👤' : '🎭'}
              </div>
              <div className="flex-1">
                <h4 className="text-cinema-text font-bold text-lg mb-1">{character.name || `Character ${index + 1}`}</h4>
                <span className={`text-xs px-2 py-1 rounded ${character.importance === 'main'
                  ? 'bg-cinema-accent text-cinema-black'
                  : character.importance === 'supporting'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-gray-500/20 text-gray-400'
                  }`}>
                  {character.importance || 'Character'}
                </span>
              </div>
            </div>

            {character.description && (
              <p className="text-cinema-text-dim text-sm mb-4 leading-relaxed">{character.description}</p>
            )}

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-cinema-text-dim text-sm">{t('characters.sceneAppearances')}</span>
                <span className="text-cinema-accent font-bold text-lg">{character.sceneCount || '0'}</span>
              </div>

              {character.relationships && character.relationships.length > 0 && (
                <div>
                  <span className="text-cinema-text-dim text-xs uppercase tracking-wider">{t('characters.keyRelationships')}</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {character.relationships.slice(0, 3).map((rel, i) => (
                      <span key={i} className="text-xs px-1 py-0.5 bg-cinema-black rounded text-cinema-text">
                        {rel}
                      </span>
                    ))}
                    {character.relationships.length > 3 && (
                      <span className="text-xs text-cinema-text-dim">+{character.relationships.length - 3} more</span>
                    )}
                  </div>
                </div>
              )}

              {character.notes && (
                <div className="text-xs text-cinema-text-dim bg-cinema-black/30 p-2 rounded">
                  <strong>{t('characters.notes')}</strong> {character.notes}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EquipmentTab({ equipment }) {
  if (!equipment || equipment.length === 0) {
    return (
      <div className="text-center py-12 text-cinema-text-dim">
        <div className="text-4xl mb-4">🎬</div>
        <p>{t('equipment.noEquipment')}</p>
      </div>
    );
  }

  // Group equipment by category
  const groupedEquipment = equipment.reduce((acc, item) => {
    const category = item.category || t('common.general');
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {});

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-cinema-accent mb-2">{t('equipment.title')}</h3>
        <p className="text-cinema-text-dim text-sm">
          {t('equipment.desc')}
        </p>
      </div>

      {/* Equipment by Category */}
      <div className="space-y-6">
        {Object.entries(groupedEquipment).map(([category, items]) => (
          <div key={category}>
            <h4 className="text-lg font-bold text-cinema-text mb-4 border-b border-cinema-gray-light pb-2">
              {category} <span className="text-sm font-normal text-cinema-text-dim">({items.length} {t('equipment.items')})</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((item, index) => (
                <div key={index} className="p-4 bg-cinema-gray rounded-lg border border-cinema-gray-light hover:border-cinema-accent/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">
                      {item.category === 'Camera' ? '📹' :
                        item.category === 'Audio' ? '🎤' :
                          item.category === 'Lighting' ? '💡' :
                            item.category === 'Props' ? '🎭' : '🔧'}
                    </div>
                    <div className="flex-1">
                      <h5 className="text-cinema-text font-bold mb-2">{item.item || item.name || 'Equipment'}</h5>
                      <p className="text-cinema-text-dim text-sm mb-3 leading-relaxed">{item.reason || item.description}</p>

                      {item.scenes && item.scenes.length > 0 && (
                        <div className="mb-3">
                          <span className="text-xs text-cinema-text-dim uppercase tracking-wider">{t('equipment.requiredForScenes')}</span>
                          <div className="text-sm text-cinema-text mt-1">
                            {Array.isArray(item.scenes) ? item.scenes.join(', ') : item.scenes}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-center text-xs">
                        <span className={`px-2 py-1 rounded ${item.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                          item.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-green-500/20 text-green-400'
                          }`}>
                          {t(`common.${item.priority?.toLowerCase()}`) || item.priority || t('common.standard')} {t('equipment.priority')}
                        </span>
                        {item.cost && (
                          <span className="text-cinema-text-dim">
                            {t('equipment.estimatedCost')} {item.cost}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomAnalysisTab({ customResults, activePrompt, onSelectPrompt }) {
  // Get prompt store functions
  const getPromptTypes = usePromptStore(state => state.getPromptTypes);
  const getPrompt = usePromptStore(state => state.getPrompt);

  if (!customResults || Object.keys(customResults).length === 0) {
    return (
      <div className="text-center py-12 text-cinema-text-dim">
        <div className="text-4xl mb-4">🎯</div>
        <p>{t('custom.noResults')}</p>
        <p className="text-sm mt-2">{t('custom.runCustom')}</p>
      </div>
    );
  }

  const customPrompts = getPromptTypes('analysis').filter(p => p.isCustom);
  const availableResults = Object.keys(customResults);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-cinema-accent mb-2">{t('custom.title')}</h3>
        <p className="text-cinema-text-dim text-sm">
          {t('custom.desc')}
        </p>
      </div>

      {/* Results Navigation */}
      {availableResults.length > 1 && (
        <div className="mb-6">
          <div className="flex gap-2 flex-wrap">
            {availableResults.map((promptKey) => {
              const promptInfo = getPrompt('analysis', promptKey);
              return (
                <button
                  key={promptKey}
                  onClick={() => onSelectPrompt(promptKey)}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors ${activePrompt === promptKey
                    ? 'bg-cinema-accent text-cinema-black font-medium'
                    : 'bg-cinema-gray-light text-cinema-text hover:bg-cinema-accent/20'
                    }`}
                >
                  {promptInfo?.name || promptKey}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Result Display */}
      <div className="space-y-6">
        {availableResults.map((promptKey) => {
          if (activePrompt && activePrompt !== promptKey) return null;

          const promptInfo = getPrompt('analysis', promptKey);
          const result = customResults[promptKey];

          return (
            <div key={promptKey} className="bg-cinema-gray rounded-lg border border-cinema-gray-light p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="text-2xl">🎯</div>
                <div>
                  <h4 className="text-lg font-bold text-cinema-text mb-1">
                    {promptInfo?.name || promptKey}
                  </h4>
                  <p className="text-cinema-text-dim text-sm">
                    {promptInfo?.description || 'Custom analysis result'}
                  </p>
                </div>
              </div>

              <div className="bg-cinema-black rounded-lg p-4 border border-cinema-gray-light">
                <div className="text-cinema-text whitespace-pre-wrap text-sm leading-relaxed font-mono">
                  {result}
                </div>
              </div>

              {/* Copy Button */}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(result);
                    // You could add a toast notification here
                  }}
                  className="px-3 py-1 bg-cinema-gray-light hover:bg-cinema-accent/20 text-cinema-text text-xs rounded transition-colors flex items-center gap-1"
                >
                  📋 {t('custom.copyText')}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OverviewTab({ analysisData }) {
  const { t } = useTranslation();
  if (!analysisData) {
    return (
      <div className="text-center py-12 text-cinema-text-dim">
        <div className="text-4xl mb-4">📊</div>
        <p>No analysis data available</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-cinema-accent mb-2">{t('overview.title')}</h3>
        <p className="text-cinema-text-dim text-sm">
          {t('overview.desc')}
        </p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-cinema-gray rounded-lg p-4 text-center">
          <div className="text-2xl mb-2">🎬</div>
          <div className="text-2xl font-bold text-cinema-accent">{analysisData.scenes?.length || 0}</div>
          <div className="text-sm text-cinema-text-dim">{t('overview.scenes')}</div>
        </div>
        <div className="bg-cinema-gray rounded-lg p-4 text-center">
          <div className="text-2xl mb-2">📍</div>
          <div className="text-2xl font-bold text-cinema-accent">{analysisData.locations?.length || 0}</div>
          <div className="text-sm text-cinema-text-dim">{t('overview.locations')}</div>
        </div>
        <div className="bg-cinema-gray rounded-lg p-4 text-center">
          <div className="text-2xl mb-2">👥</div>
          <div className="text-2xl font-bold text-cinema-accent">{analysisData.characters?.length || 0}</div>
          <div className="text-sm text-cinema-text-dim">{t('overview.characters')}</div>
        </div>
        <div className="bg-cinema-gray rounded-lg p-4 text-center">
          <div className="text-2xl mb-2">📅</div>
          <div className="text-2xl font-bold text-cinema-accent">
            {analysisData.summary?.estimatedShootingDays || t('common.tbd')}
          </div>
          <div className="text-sm text-cinema-text-dim">{t('overview.shootDays')}</div>
        </div>
      </div>

      {/* Production Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-cinema-gray rounded-lg p-5">
          <h4 className="text-lg font-bold text-cinema-text mb-3 flex items-center gap-2">
            <span>🎯</span> {t('overview.productionScope')}
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-cinema-text-dim">{t('overview.equipmentItems')}</span>
              <span className="text-cinema-text font-medium">{analysisData.equipment?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cinema-text-dim">{t('overview.vfxSequences')}</span>
              <span className="text-cinema-text font-medium">{analysisData.vfxRequirements?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cinema-text-dim">{t('overview.sfxRequirements')}</span>
              <span className="text-cinema-text font-medium">{analysisData.sfxRequirements?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cinema-text-dim">{t('overview.virtualProduction')}</span>
              <span className="text-cinema-accent font-medium">
                {analysisData.virtualProductionSuitability?.overall || t('virtualProduction.notAssessed')}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-cinema-gray rounded-lg p-5">
          <h4 className="text-lg font-bold text-cinema-text mb-3 flex items-center gap-2">
            <span>📈</span> {t('overview.analysisSummary')}
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-cinema-text-dim">{t('overview.genre')}</span>
              <span className="text-cinema-text font-medium">
                {analysisData.enhancedMetrics?.marketAnalysis?.genre || analysisData.evaluation?.genre || t('common.tbd')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-cinema-text-dim">{t('overview.emotionScore')}</span>
              <span className="text-cinema-accent font-medium">
                {analysisData.evaluation?.emotionScore || t('common.notScored')}/10
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-cinema-text-dim">{t('analysis.tabs.competitive.score')}</span>
              <span className="text-cinema-text font-medium">
                {analysisData.competitiveAnalysis?.competitiveScore || 'N/A'}/100
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-cinema-text-dim">{t('analysis.tabs.geographic.globalPotential')}:</span>
              <span className="text-cinema-text font-medium">
                {analysisData.enhancedMetrics?.marketAnalysis?.marketPotential?.toUpperCase() || t('common.tbd')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VFXTab({ vfxRequirements, sfxRequirements }) {
  const { t } = useTranslation();
  const totalRequirements = [...(vfxRequirements || []), ...(sfxRequirements || [])];

  if (totalRequirements.length === 0) {
    return (
      <div className="text-center py-12 text-cinema-text-dim">
        <div className="text-4xl mb-4">✨</div>
        <p>{t('vfx.noRequirements')}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-cinema-accent mb-2">{t('vfx.title')}</h3>
        <p className="text-cinema-text-dim text-sm">
          {t('vfx.desc')}
        </p>
      </div>

      {/* VFX Section */}
      {vfxRequirements && vfxRequirements.length > 0 && (
        <div className="mb-8">
          <h4 className="text-lg font-bold text-cinema-text mb-4 flex items-center gap-2">
            <span>🎭</span> {t('vfx.visualEffects')} ({vfxRequirements.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vfxRequirements.map((vfx, index) => (
              <div key={index} className="bg-cinema-gray rounded-lg border border-cinema-gray-light p-5 hover:border-cinema-accent/30 transition-colors">
                <div className="flex items-start gap-3 mb-3">
                  <div className="text-2xl">🎬</div>
                  <div className="flex-1">
                    <h5 className="text-cinema-text font-bold text-lg mb-1">{vfx.type || `VFX Effect ${index + 1}`}</h5>
                    <span className={`text-xs px-2 py-1 rounded ${vfx.complexity === 'high' ? 'bg-red-500/20 text-red-400' :
                      vfx.complexity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                      {t(`common.${vfx.complexity?.toLowerCase()}`) || vfx.complexity || t('common.medium')} {t('vfx.complexity')}
                    </span>
                  </div>
                </div>

                <p className="text-cinema-text-dim text-sm mb-4 leading-relaxed">{vfx.description}</p>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-cinema-text-dim">{t('vfx.scenes')}</span>
                    <span className="text-cinema-text">{Array.isArray(vfx.scenes) ? vfx.scenes.join(', ') : vfx.scenes || t('common.tbd')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cinema-text-dim">{t('vfx.estimatedCost')}</span>
                    <span className="text-cinema-accent font-medium">{vfx.estimatedCost || t('common.tbd')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cinema-text-dim">{t('vfx.timeline')}</span>
                    <span className="text-cinema-text">{vfx.timeline || t('common.tbd')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SFX Section */}
      {sfxRequirements && sfxRequirements.length > 0 && (
        <div>
          <h4 className="text-lg font-bold text-cinema-text mb-4 flex items-center gap-2">
            <span>🔊</span> {t('vfx.soundEffects')} ({sfxRequirements.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sfxRequirements.map((sfx, index) => (
              <div key={index} className="bg-cinema-gray rounded-lg border border-cinema-gray-light p-5 hover:border-cinema-accent/30 transition-colors">
                <div className="flex items-start gap-3 mb-3">
                  <div className="text-2xl">🎵</div>
                  <div className="flex-1">
                    <h5 className="text-cinema-text font-bold text-lg mb-1">{sfx.type || `SFX ${index + 1}`}</h5>
                    <span className={`text-xs px-2 py-1 rounded ${sfx.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                      sfx.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                      {t(`common.${sfx.priority?.toLowerCase()}`) || sfx.priority || t('common.medium')} {t('common.priority')}
                    </span>
                  </div>
                </div>

                <p className="text-cinema-text-dim text-sm mb-4 leading-relaxed">{sfx.description}</p>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-cinema-text-dim">{t('vfx.type')}</span>
                    <span className="text-cinema-text">{sfx.category || t('common.general')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-cinema-text-dim">{t('vfx.recordingRequired')}</span>
                    <span className="text-cinema-accent">{sfx.recordingRequired ? t('vfx.yes') : t('vfx.library')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VirtualProductionTab({ virtualProductionSuitability, shootingTechniques }) {
  const { t } = useTranslation();
  if (!virtualProductionSuitability || Object.keys(virtualProductionSuitability).length === 0) {
    return (
      <div className="text-center py-12 text-cinema-text-dim">
        <div className="text-4xl mb-4">🎮</div>
        <p>{t('virtualProduction.noAnalysis')}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-cinema-accent mb-2">{t('virtualProduction.title')}</h3>
        <p className="text-cinema-text-dim text-sm">
          {t('virtualProduction.desc')}
        </p>
      </div>

      {/* Overall Assessment */}
      <div className="bg-cinema-gray rounded-lg p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="text-4xl">🎯</div>
          <div>
            <h4 className="text-xl font-bold text-cinema-text">{t('virtualProduction.overallSuitability')}</h4>
            <div className={`text-2xl font-bold mt-1 ${virtualProductionSuitability.overall === 'High' ? 'text-green-400' :
              virtualProductionSuitability.overall === 'Medium' ? 'text-yellow-400' :
                'text-red-400'
              }`}>
              {t(`common.${virtualProductionSuitability.overall?.toLowerCase()}`) || virtualProductionSuitability.overall || t('virtualProduction.notAssessed')}
            </div>
          </div>
        </div>
        <p className="text-cinema-text-dim leading-relaxed">
          {virtualProductionSuitability.reasoning || 'No detailed analysis available'}
        </p>
      </div>

      {/* Assessment Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-cinema-gray rounded-lg p-5">
          <h5 className="text-lg font-bold text-cinema-text mb-3 flex items-center gap-2">
            <span>🌍</span> {t('virtualProduction.environmentSuitability')}
          </h5>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-cinema-text-dim">{t('virtualProduction.controlledEnvironments')}</span>
              <span className="text-cinema-accent font-medium">
                {virtualProductionSuitability.controlledEnvironments || t('common.tbd')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-cinema-text-dim">{t('virtualProduction.cgiIntegration')}</span>
              <span className="text-cinema-accent font-medium">
                {virtualProductionSuitability.cgiIntegration || t('common.tbd')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-cinema-text-dim">{t('virtualProduction.ledVolumeReady')}</span>
              <span className="text-cinema-accent font-medium">
                {virtualProductionSuitability.ledVolumeReady ? t('common.yes') : t('common.no')}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-cinema-gray rounded-lg p-5">
          <h5 className="text-lg font-bold text-cinema-text mb-3 flex items-center gap-2">
            <span>📹</span> {t('virtualProduction.technicalRequirements')}
          </h5>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-cinema-text-dim">{t('virtualProduction.realTimeRendering')}</span>
              <span className="text-cinema-accent font-medium">
                {virtualProductionSuitability.realTimeRendering || t('common.tbd')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-cinema-text-dim">{t('virtualProduction.motionCapture')}</span>
              <span className="text-cinema-accent font-medium">
                {virtualProductionSuitability.motionCapture || t('common.tbd')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-cinema-text-dim">{t('virtualProduction.cameraTracking')}</span>
              <span className="text-cinema-accent font-medium">
                {virtualProductionSuitability.cameraTracking || t('common.tbd')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EvaluationTab({ evaluation }) {
  const { t } = useTranslation();
  if (!evaluation || Object.keys(evaluation).length === 0) {
    return (
      <div className="text-center py-12 text-cinema-text-dim">
        <div className="text-4xl mb-4">📈</div>
        <p>{t('evaluation.noEvaluation')}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-cinema-accent mb-2">{t('evaluation.title')}</h3>
        <p className="text-cinema-text-dim text-sm">
          {t('evaluation.desc')}
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-cinema-gray to-cinema-gray-light rounded-lg p-4 text-center">
          <div className="text-2xl mb-2">💝</div>
          <div className="text-2xl font-bold text-cinema-accent">{evaluation.emotionScore || 'N/A'}/10</div>
          <div className="text-sm text-cinema-text-dim">{t('evaluation.emotionScore')}</div>
        </div>
        <div className="bg-gradient-to-br from-cinema-gray to-cinema-gray-light rounded-lg p-4 text-center">
          <div className="text-2xl mb-2">🎭</div>
          <div className="text-lg font-bold text-cinema-accent">{evaluation.genre || t('common.tbd')}</div>
          <div className="text-sm text-cinema-text-dim">{t('evaluation.primaryGenre')}</div>
        </div>
        <div className="bg-gradient-to-br from-cinema-gray to-cinema-gray-light rounded-lg p-4 text-center">
          <div className="text-2xl mb-2">⏱️</div>
          <div className="text-lg font-bold text-cinema-accent">{evaluation.estimatedDuration || t('common.tbd')}</div>
          <div className="text-sm text-cinema-text-dim">{t('evaluation.duration')}</div>
        </div>
        <div className="bg-gradient-to-br from-cinema-gray to-cinema-gray-light rounded-lg p-4 text-center">
          <div className="text-2xl mb-2">📊</div>
          <div className="text-2xl font-bold text-cinema-accent">{evaluation.complexityScore || 'N/A'}/10</div>
          <div className="text-sm text-cinema-text-dim">{t('evaluation.complexity')}</div>
        </div>
      </div>
    </div>
  );
}

function CompetitiveTab({ analysis }) {
  const { t } = useTranslation();
  if (!analysis) return <div className="text-center py-12 text-cinema-text-dim">{t('analysis.tabs.competitive.noData', 'No competitive analysis available')}</div>;

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-xl font-bold text-cinema-accent mb-2">{t('analysis.tabs.competitive.title', 'Competitive Analysis')}</h3>
        <p className="text-cinema-text-dim text-sm">{t('analysis.tabs.competitive.subtitle', 'Market positioning and competitive landscape assessment')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-cinema-gray rounded-lg p-5 text-center">
          <div className="text-3xl mb-2">🏆</div>
          <div className="text-2xl font-bold text-cinema-accent">{analysis.competitiveScore || 0}/100</div>
          <div className="text-sm text-cinema-text-dim">{t('analysis.tabs.competitive.score', 'Competitive Score')}</div>
        </div>
        <div className="bg-cinema-gray rounded-lg p-5 text-center">
          <div className="text-3xl mb-2">📊</div>
          <div className="text-xl font-bold text-cinema-text capitalize">{analysis.marketPosition?.position || 'Unknown'}</div>
          <div className="text-sm text-cinema-text-dim">{t('analysis.tabs.competitive.marketPosition', 'Market Position')}</div>
        </div>
        <div className="bg-cinema-gray rounded-lg p-5 text-center">
          <div className="text-3xl mb-2">💎</div>
          <div className="text-2xl font-bold text-cinema-accent">{analysis.uniquenessAnalysis?.overallUniqueness || 0}%</div>
          <div className="text-sm text-cinema-text-dim">{t('analysis.tabs.competitive.uniqueness', 'Uniqueness Score')}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-cinema-gray rounded-lg p-5">
          <h4 className="text-lg font-bold text-cinema-text mb-4">{t('analysis.tabs.competitive.comparableFilms', 'Comparable Films')}</h4>
          <div className="space-y-3">
            {analysis.comparableFilms?.map((film, i) => (
              <div key={i} className="flex justify-between items-center border-b border-cinema-gray-light pb-2 last:border-0">
                <span className="text-cinema-text">{film.title}</span>
                <span className="text-cinema-accent text-sm">{film.similarity}% {t('analysis.tabs.competitive.match', 'Match')}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-cinema-gray rounded-lg p-5">
          <h4 className="text-lg font-bold text-cinema-text mb-4">{t('analysis.tabs.competitive.recommendations', 'Strategic Recommendations')}</h4>
          <ul className="space-y-2">
            {analysis.strategicRecommendations?.map((rec, i) => (
              <li key={i} className="text-sm text-cinema-text-dim flex gap-2">
                <span className="text-cinema-accent">•</span>
                {rec.recommendation}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function GeographicTab({ analysis }) {
  const { t } = useTranslation();
  if (!analysis) return <div className="text-center py-12 text-cinema-text-dim">{t('analysis.tabs.geographic.noData', 'No geographic analysis available')}</div>;

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-xl font-bold text-cinema-accent mb-2">{t('analysis.tabs.geographic.title', 'Geographic Market Analysis')}</h3>
        <p className="text-cinema-text-dim text-sm">{t('analysis.tabs.geographic.subtitle', 'Regional market potential and localization strategies')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-cinema-gray rounded-lg p-5">
          <h4 className="text-lg font-bold text-cinema-text mb-4">{t('analysis.tabs.geographic.globalPotential', 'Global Potential')}</h4>
          <div className="flex items-center gap-4 mb-4">
            <div className="text-4xl font-bold text-cinema-accent">{analysis.globalPotential || 0}%</div>
            <div className="text-sm text-cinema-text-dim">{t('analysis.tabs.geographic.appealScore', 'Overall Global Appeal Score')}</div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-cinema-text-dim">{t('analysis.tabs.geographic.universality', 'Cultural Universality')}:</span>
              <span className="text-cinema-text">{analysis.culturalSuitability?.universalityScore || 0}/100</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-cinema-text-dim">{t('analysis.tabs.geographic.localization', 'Localization Complexity')}:</span>
              <span className="text-cinema-text">{analysis.culturalSuitability?.localizationComplexity || 'Medium'}</span>
            </div>
          </div>
        </div>

        <div className="bg-cinema-gray rounded-lg p-5">
          <h4 className="text-lg font-bold text-cinema-text mb-4">{t('analysis.tabs.geographic.topMarkets', 'Top Markets')}</h4>
          <div className="space-y-3">
            {Object.entries(analysis.regionalAnalysis || {})
              .sort((a, b) => b[1].marketScore - a[1].marketScore)
              .slice(0, 5)
              .map(([region, data], i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-cinema-text capitalize">{region}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-cinema-black rounded-full overflow-hidden">
                      <div className="h-full bg-cinema-accent" style={{ width: `${data.marketScore}%` }} />
                    </div>
                    <span className="text-xs text-cinema-text-dim w-8">{data.marketScore}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrendTab({ analysis }) {
  const { t } = useTranslation();
  if (!analysis) return <div className="text-center py-12 text-cinema-text-dim">{t('analysis.tabs.trend.noData', 'No trend analysis available')}</div>;

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-xl font-bold text-cinema-accent mb-2">{t('analysis.tabs.trend.title', 'Trend Analysis')}</h3>
        <p className="text-cinema-text-dim text-sm">{t('analysis.tabs.trend.subtitle', 'Industry trend alignment and timing optimization')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-cinema-gray rounded-lg p-5 text-center">
          <div className="text-3xl mb-2">📈</div>
          <div className="text-2xl font-bold text-cinema-accent">{analysis.overallTrendScore || 0}/100</div>
          <div className="text-sm text-cinema-text-dim">{t('analysis.tabs.trend.alignment', 'Trend Alignment')}</div>
        </div>
        <div className="bg-cinema-gray rounded-lg p-5 text-center">
          <div className="text-3xl mb-2">⏱️</div>
          <div className="text-xl font-bold text-cinema-text capitalize">{analysis.timingAnalysis?.recommendation || 'Neutral'}</div>
          <div className="text-sm text-cinema-text-dim">{t('analysis.tabs.trend.timing', 'Timing Strategy')}</div>
        </div>
        <div className="bg-cinema-gray rounded-lg p-5 text-center">
          <div className="text-3xl mb-2">📺</div>
          <div className="text-xl font-bold text-cinema-text capitalize">{analysis.platformFit?.primaryPlatform || 'Theatrical'}</div>
          <div className="text-sm text-cinema-text-dim">{t('analysis.tabs.trend.platform', 'Best Platform')}</div>
        </div>
      </div>

      <div className="bg-cinema-gray rounded-lg p-5 mb-6">
        <h4 className="text-lg font-bold text-cinema-text mb-4">{t('analysis.tabs.trend.identified', 'Identified Trends')}</h4>
        <div className="flex flex-wrap gap-2">
          {analysis.identifiedTrends?.map((trend, i) => (
            <span key={i} className="px-3 py-1 bg-cinema-accent/20 text-cinema-accent rounded-full text-sm border border-cinema-accent/30">
              {trend.name} ({trend.relevance}%)
            </span>
          ))}
        </div>
      </div>
    </div>
  );
} function RiskTab({ analysis }) {
  const { t } = useTranslation();
  if (!analysis) return <div className="text-center py-12 text-cinema-text-dim">{t('analysis.tabs.risk.noData', 'No risk analysis available')}</div>;

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-xl font-bold text-cinema-accent mb-2">{t('analysis.tabs.risk.title', 'Risk & Opportunity Assessment')}</h3>
        <p className="text-cinema-text-dim text-sm">{t('analysis.tabs.risk.subtitle', 'Project risk profile and strategic opportunities')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-cinema-gray rounded-lg p-5">
          <h4 className="text-lg font-bold text-cinema-text mb-4 text-red-400">{t('analysis.tabs.risk.factors', 'Risk Factors')}</h4>
          <div className="space-y-3">
            {analysis.riskAnalysis?.identifiedRisks?.map((risk, i) => (
              <div key={i} className="p-3 bg-cinema-black/30 rounded border border-red-500/20">
                <div className="flex justify-between mb-1">
                  <span className="font-medium text-red-300">{risk.category}</span>
                  <span className="text-xs px-2 py-0.5 bg-red-500/20 rounded text-red-400 uppercase">{risk.severity}</span>
                </div>
                <p className="text-sm text-cinema-text-dim">{risk.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-cinema-gray rounded-lg p-5">
          <h4 className="text-lg font-bold text-cinema-text mb-4 text-green-400">{t('analysis.tabs.risk.opportunities', 'Opportunities')}</h4>
          <div className="space-y-3">
            {analysis.opportunityAnalysis?.prioritized?.map((opp, i) => (
              <div key={i} className="p-3 bg-cinema-black/30 rounded border border-green-500/20">
                <div className="flex justify-between mb-1">
                  <span className="font-medium text-green-300">{opp.type}</span>
                  <span className="text-xs px-2 py-0.5 bg-green-500/20 rounded text-green-400 uppercase">{opp.impact} {t('analysis.tabs.risk.impact', 'Impact')}</span>
                </div>
                <p className="text-sm text-cinema-text-dim">{opp.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AudienceTab({ audienceAnalysis }) {
  const { t } = useTranslation();
  if (!audienceAnalysis || Object.keys(audienceAnalysis).length === 0) {
    return (
      <div className="text-center py-12 text-cinema-text-dim">
        <div className="text-4xl mb-4">🎯</div>
        <p>{t('analysis.tabs.audience.noData', 'No audience analysis available')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-xl font-bold text-cinema-accent mb-2">{t('analysis.tabs.audience.title', 'Audience & Platform Analysis')}</h3>
        <p className="text-cinema-text-dim text-sm">{t('analysis.tabs.audience.subtitle', 'Target audience demographics and platform suitability')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-cinema-gray rounded-lg p-5">
          <h4 className="text-lg font-bold text-cinema-text mb-4">{t('analysis.tabs.audience.demographics', 'Target Demographics')}</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-cinema-text-dim">{t('analysis.tabs.audience.age', 'Primary Age Group')}:</span>
              <span className="text-cinema-text font-medium">{audienceAnalysis.demographics?.primaryAge || 'TBD'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cinema-text-dim">{t('analysis.tabs.audience.gender', 'Gender Skew')}:</span>
              <span className="text-cinema-text font-medium">{audienceAnalysis.demographics?.genderSkew || 'Balanced'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cinema-text-dim">{t('analysis.tabs.audience.psychographics', 'Psychographics')}:</span>
              <span className="text-cinema-text font-medium">{audienceAnalysis.demographics?.psychographics || 'TBD'}</span>
            </div>
          </div>
        </div>

        <div className="bg-cinema-gray rounded-lg p-5">
          <h4 className="text-lg font-bold text-cinema-text mb-4">{t('analysis.tabs.audience.platform', 'Platform Suitability')}</h4>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-cinema-text-dim">{t('analysis.tabs.audience.primaryPlatform', 'Primary Platform')}:</span>
              <span className="text-cinema-accent font-medium">{audienceAnalysis.platformSuitability?.primary || 'TBD'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cinema-text-dim">{t('analysis.tabs.audience.secondaryPlatform', 'Secondary Platform')}:</span>
              <span className="text-cinema-text font-medium">{audienceAnalysis.platformSuitability?.secondary || 'TBD'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
