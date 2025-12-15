import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useScriptStore } from '../store/scriptStore';
import { useAIStore } from '../store/aiStore';
import usePromptStore from '../store/promptStore';
import StoryboardLoadingScreen from './StoryboardLoadingScreen';
import CharacterVisualization from './CharacterVisualization';
import CharacterImageGenerator from './CharacterImageGenerator';
import LocationImageGenerator from './LocationImageGenerator';
import LocationTableView from './LocationTableView';
import { analysisStorageService } from '../utils/analysisStorageService';

export default function ProfessionalStoryboard() {
  // PromptStore'dan storyboard modülü için tanımlanmış promptları al
  const storyboardPrompts = usePromptStore(state => state.getPromptsByModule('storyboard'));
  
  // Storyboard modülü için dinamik analiz listesi
  const getStoryboardRequiredAnalysis = () => {
    return storyboardPrompts.map(p => p.key);
  };
  
  // Analiz display isimleri - promptlardan al
  const getAnalysisDisplayNames = () => {
    const names = {};
    storyboardPrompts.forEach(p => {
      names[p.key] = p.prompt.name || p.key;
    });
    return names;
  };
  const { t } = useTranslation();
  const { getCurrentScript, updateScript, currentScriptId, setCurrentView } = useScriptStore();
  const { generateImage, isGeneratingImage, isConfigured, provider, getAIHandler: getAIHandlerFromStore } = useAIStore();
  const { setStoryboardProgress, setIsStoryboardProcessing, clearStoryboardProgress, setStoryboardAbortController, cancelStoryboard, isStoryboardProcessing, storyboardProgress } = useScriptStore();

  // AI Handler state
  const [aiHandler, setAiHandler] = useState(null);

  // 3-Phase Workflow States
  const [currentPhase, setCurrentPhase] = useState(null); // null (initial) | 'character' | 'location' | 'storyboard'
  const [currentStep, setCurrentStep] = useState(1); // Legacy support
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [abortController, setAbortController] = useState(null);

  // Analysis Data States
  const [characterAnalysis, setCharacterAnalysis] = useState(null);
  const [locationAnalysis, setLocationAnalysis] = useState(null);
  const [styleAnalysis, setStyleAnalysis] = useState(null);
  const [colorPalette, setColorPalette] = useState(null);
  const [visualLanguage, setVisualLanguage] = useState(null);

  // Character Approval Workflow
  const [characterApprovals, setCharacterApprovals] = useState({
    // characterName: { 
    //   approved: boolean,
    //   image: { url, prompt, timestamp },
    //   referenceImages: [...],
    //   regenerationCount: number,
    //   generating: boolean,
    //   progress: number (0-100)
    // }
  });
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [characterGeneratingProgress, setCharacterGeneratingProgress] = useState({});

  // Location Approval Workflow
  const [locationApprovals, setLocationApprovals] = useState({
    // locationName: {
    //   approved: boolean,
    //   image: { url, prompt, timestamp },
    //   referenceImages: [...],
    //   regenerationCount: number
    // }
  });

  // Scene Approval Workflow
  const [sceneApprovals, setSceneApprovals] = useState({
    // sceneNumber: {
    //   approved: boolean,
    //   sceneData: { ... },
    //   timestamp: number
    // }
  });

  // Phase Completion Tracking
  const [phaseCompletion, setPhaseCompletion] = useState({
    character: { total: 0, approved: 0, generated: 0, complete: false },
    location: { total: 0, approved: 0, generated: 0, complete: false },
    scene: { total: 0, approved: 0, complete: false },
    storyboard: { total: 0, generated: 0, complete: false }
  });

  // Scene extraction and parsing
  const [extractedScenes, setExtractedScenes] = useState([]);
  const [sceneCharacters, setSceneCharacters] = useState({});
  const [sceneLocations, setSceneLocations] = useState({});
  const [sceneAnalysisData, setSceneAnalysisData] = useState({});
  const [storyboardFrames, setStoryboardFrames] = useState([]);
  
  // Storyboard style settings
  const [storyboardStyle, setStoryboardStyle] = useState('realistic'); // realistic or sketch
  const useCharacterReferences = true; // Always use character references if approved
  const useLocationReferences = true; // Always use location references if approved

  // Extract Scenes from Script Text Helper
  const extractScenesFromScript = (scriptText) => {
    if (!scriptText || typeof scriptText !== 'string') {
      console.warn('⚠️ extractScenesFromScript: Geçersiz input');
      return [];
    }

    const scenes = [];
    let sceneNumber = 0;

    // Sahne başlıklarını tespit edecek regex patternleri
    // SAHNE 1, SAHNE1 (boşluksuz), INT. MEKAN - GÜN, EXT. MEKAN - GECE, SCENE 1, SCENE1, vb.
    const sceneHeaderPatterns = [
      // Türkçe format: SAHNE 1 veya SAHNE1 (boşluklu veya boşluksuz) - MEKAN ADI
      /^SAHNE\s*(\d+)\s*[-–—:]\s*(.+)$/im,
      // Türkçe format: Sadece SAHNE1 veya SAHNE 1 (boşluklu veya boşluksuz, mekan yok)
      /^SAHNE\s*(\d+)\s*$/im,
      // Çoklu dil desteği: SCENE, SZENE, SCÈNE, ESCENA, SCENA, CENA (boşluklu veya boşluksuz)
      /^(?:SCENE|SZENE|SCÈNE|ESCENA|SCENA|CENA)\s*(\d+)\s*[-–—:]\s*(.+)$/im,
      /^(?:SCENE|SZENE|SCÈNE|ESCENA|SCENA|CENA)\s*(\d+)\s*$/im,
      // Türkçe format: İÇ/DIŞ - MEKAN - ZAMAN
      /^(İÇ|DIŞ)\s*[-–—:]\s*(.+?)\s*[-–—:]\s*(.+)$/im,
      // İngilizce format: INT./EXT. LOCATION - TIME
      /^(INT\.|EXT\.)\s+(.+?)\s*[-–—]\s*(.+)$/im,
      // Sadece INT./EXT. ile başlayan
      /^(INT\.|EXT\.)\s+(.+)$/im,
    ];

    // Metni satırlara böl
    const lines = scriptText.split('\n');
    let currentScene = null;
    let sceneContent = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) continue;

      // Sahne başlığı mı kontrol et
      let isSceneHeader = false;
      let sceneInfo = null;

      for (const pattern of sceneHeaderPatterns) {
        const match = line.match(pattern);
        if (match) {
          isSceneHeader = true;
          sceneNumber++;

          // Önceki sahneyi kaydet
          if (currentScene) {
            currentScene.content = sceneContent.join('\n').trim();
            scenes.push(currentScene);
            sceneContent = [];
          }

          // Yeni sahne başlat
          sceneInfo = {
            id: `scene_${sceneNumber}`,
            number: sceneNumber,
            title: line,
            location: '',
            locations: [],
            intExt: '',
            timeOfDay: '',
            content: '',
            description: '',
            characters: [],
            duration: 'orta',
            mood: ''
          };

          // Pattern'e göre bilgileri parse et
          if (match[1] && match[1].match(/^\d+$/)) {
            // SAHNE X formatı
            sceneInfo.location = match[2] || '';
            if (sceneInfo.location) sceneInfo.locations.push(sceneInfo.location);
          } else if (match[1] === 'İÇ' || match[1] === 'DIŞ') {
            // İÇ/DIŞ - MEKAN - ZAMAN formatı
            sceneInfo.intExt = match[1];
            sceneInfo.location = match[2] || '';
            if (sceneInfo.location) sceneInfo.locations.push(sceneInfo.location);
            sceneInfo.timeOfDay = match[3] || '';
          } else if (match[1] === 'INT.' || match[1] === 'EXT.') {
            // INT./EXT. formatı
            sceneInfo.intExt = match[1] === 'INT.' ? 'İÇ' : 'DIŞ';
            sceneInfo.location = match[2] || '';
            if (sceneInfo.location) sceneInfo.locations.push(sceneInfo.location);
            sceneInfo.timeOfDay = match[3] || '';
          }

          currentScene = sceneInfo;
          break;
        }
      }

      // Sahne başlığı değilse içeriğe ekle
      if (!isSceneHeader && currentScene) {
        sceneContent.push(line);

        // Karakter isimlerini tespit et (büyük harfle yazılan isimler)
        // Genelde karakter diyaloğu öncesi büyük harfle yazılır
        const characterMatch = line.match(/^([A-ZÜÇĞIÖŞ][A-ZÜÇĞIÖŞa-züçğıöş\s]{2,30})$/);
        if (characterMatch) {
          const charName = characterMatch[1].trim();
          if (!currentScene.characters.includes(charName)) {
            currentScene.characters.push(charName);
          }
        }
      }
    }

    // Son sahneyi kaydet
    if (currentScene) {
      currentScene.content = sceneContent.join('\n').trim();
      scenes.push(currentScene);
    }

    console.log(`🎬 Senaryodan ${scenes.length} sahne çıkarıldı`);
    scenes.forEach((scene, idx) => {
      console.log(`   ${idx + 1}. ${scene.title} - ${scene.characters.length} karakter`);
    });

    return scenes;
  };

  // Safe JSON Parse Helper
  const safeJSONParse = (text, fallback = null) => {
    if (!text || typeof text !== 'string') {
      console.warn('⚠️ safeJSONParse: Geçersiz input', typeof text);
      return fallback;
    }

    try {
      // Trim whitespace
      let cleaned = text.trim();
      
      // Remove markdown code blocks if present
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
      }
      
      // Remove any text before first { or [
      const firstBrace = cleaned.indexOf('{');
      const firstBracket = cleaned.indexOf('[');
      let startIndex = -1;
      
      if (firstBrace !== -1 && firstBracket !== -1) {
        startIndex = Math.min(firstBrace, firstBracket);
      } else if (firstBrace !== -1) {
        startIndex = firstBrace;
      } else if (firstBracket !== -1) {
        startIndex = firstBracket;
      }
      
      if (startIndex > 0) {
        console.log(`🔧 JSON öncesi ${startIndex} karakter temizlendi`);
        cleaned = cleaned.substring(startIndex);
      }
      
      // Remove any text after last } or ]
      const lastBrace = cleaned.lastIndexOf('}');
      const lastBracket = cleaned.lastIndexOf(']');
      let endIndex = -1;
      
      if (lastBrace !== -1 && lastBracket !== -1) {
        endIndex = Math.max(lastBrace, lastBracket);
      } else if (lastBrace !== -1) {
        endIndex = lastBrace;
      } else if (lastBracket !== -1) {
        endIndex = lastBracket;
      }
      
      if (endIndex !== -1 && endIndex < cleaned.length - 1) {
        console.log(`🔧 JSON sonrası ${cleaned.length - endIndex - 1} karakter temizlendi`);
        cleaned = cleaned.substring(0, endIndex + 1);
      }
      
      // Try to parse
      const parsed = JSON.parse(cleaned);
      console.log('✅ JSON başarıyla parse edildi');
      return parsed;
      
    } catch (error) {
      console.error('❌ JSON parse hatası:', error.message);
      console.log('📝 Parse edilemeyen metin (ilk 200 karakter):', text.substring(0, 200));
      
      // Try to extract JSON using regex as last resort
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
          console.log('🔧 Regex ile JSON bloğu bulundu, tekrar deneniyor...');
          const extracted = jsonMatch[0];
          const parsed = JSON.parse(extracted);
          console.log('✅ Regex ile JSON parse edildi');
          return parsed;
        }
      } catch (regexError) {
        console.error('❌ Regex ile de parse edilemedi:', regexError.message);
      }
      
      return fallback;
    }
  };

  // Legacy states (kept for compatibility)
  const [characterImages, setCharacterImages] = useState({});
  const [characterReferences, setCharacterReferences] = useState({});
  const [locationReferences, setLocationReferences] = useState({});
  const [finalStoryboard, setFinalStoryboard] = useState({});
  const [storyboardScenes, setStoryboardScenes] = useState([]);

  // Image modal states
  const [selectedImage, setSelectedImage] = useState(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [showAnalysisRedirect, setShowAnalysisRedirect] = useState(false);
  const [missingAnalysisTypes, setMissingAnalysisTypes] = useState([]);
  
  // Character and Location detail modal states
  const [selectedCharacterDetail, setSelectedCharacterDetail] = useState(null);
  const [selectedLocationDetail, setSelectedLocationDetail] = useState(null);
  const [isCharacterDetailOpen, setIsCharacterDetailOpen] = useState(false);
  const [isLocationDetailOpen, setIsLocationDetailOpen] = useState(false);
  
  // Storyboard frame detail modal states
  const [selectedFrameDetail, setSelectedFrameDetail] = useState(null);
  const [isFrameDetailOpen, setIsFrameDetailOpen] = useState(false);
  const [frameRegenerateSettings, setFrameRegenerateSettings] = useState({
    useReference: true,
    customPrompt: '',
    style: 'realistic'
  });
  
  // Analysis progress tracking for storyboard - dinamik olarak promptStore'dan
  const [analysisProgressList, setAnalysisProgressList] = useState([]);
  
  // PromptStore değişikliklerini dinle ve listeyi güncelle
  useEffect(() => {
    const newList = storyboardPrompts.map(p => ({
      key: p.key,
      name: p.prompt.name || p.key,
      status: 'pending',
      progress: 0
    }));
    
    console.log('📊 Storyboard promptları yüklendi:', newList.length, 'adet');
    newList.forEach(item => console.log(`  - ${item.name} (${item.key})`));
    
    if (JSON.stringify(newList.map(i => i.key)) !== JSON.stringify(analysisProgressList.map(i => i.key))) {
      console.log('📊 Storyboard analiz listesi güncellendi');
      setAnalysisProgressList(newList);
    }
  }, [storyboardPrompts]);

  // Listen for analysis clearing events from AnalysisPanel
  useEffect(() => {
    const handleAnalysisCleared = () => {
      console.log('🗑️ Analysis cleared event received - resetting Storyboard data');
      
      // Clear all analysis states
      setCharacterAnalysis(null);
      setLocationAnalysis(null);
      setStyleAnalysis(null);
      setColorPalette(null);
      setVisualLanguage(null);
      
      // Clear approval workflows
      setCharacterApprovals({});
      setLocationApprovals({});
      setSceneApprovals({});
      
      // Reset phase completion
      setPhaseCompletion({
        character: { total: 0, approved: 0, generated: 0, complete: false },
        location: { total: 0, approved: 0, generated: 0, complete: false },
        scene: { total: 0, approved: 0, complete: false },
        storyboard: { total: 0, generated: 0, complete: false }
      });
      
      // Clear extracted scenes
      setExtractedScenes([]);
      setSceneCharacters({});
      setSceneLocations({});
      setSceneAnalysisData({});
      setStoryboardFrames([]);
      
      // Clear script store customResults, characters, and locations
      const currentScript = useScriptStore.getState().getCurrentScript();
      if (currentScript) {
        const { updateScript } = useScriptStore.getState();
        updateScript(currentScript.id, {
          customResults: null,
          characters: [],
          locations: [],
          scenes: [],
          analysisData: null
        });
        console.log('🗑️ Script store cleared: customResults, characters, locations, scenes, analysisData');
      }
      
      // Reload analysis data to check if any analyses still exist
      setTimeout(() => {
        loadComprehensiveAnalysisData(true);
      }, 100);
      
      console.log('✅ Storyboard data cleared and reloaded');
    };

    window.addEventListener('analysisCleared', handleAnalysisCleared);
    
    return () => {
      window.removeEventListener('analysisCleared', handleAnalysisCleared);
    };
  }, []);
  
  // Location filter and table states - moved to LocationTableView component

  // Analiz sonuçlarından sahne verilerini çıkar
  const extractScenesFromAnalysis = (analysisData) => {
    try {
      const { customResults } = analysisData;
      let scenes = [];
      const characters = {};
      const locations = {};
      
      console.log('🎬 Analiz sonuçlarından sahne çıkarımı başlıyor...');
      console.log('📊 Mevcut analizler:', Object.keys(customResults));

      // 0. Önce orijinal senaryodan sahneleri çıkarmayı dene
      if (scriptText && scriptText.length > 0) {
        console.log('📜 Orijinal senaryodan sahne başlıkları aranıyor...');
        const extractedFromScript = extractScenesFromScript(scriptText);
        if (extractedFromScript && extractedFromScript.length > 0) {
          scenes = extractedFromScript;
          console.log(`✅ ${scenes.length} sahne orijinal senaryodan çıkarıldı`);
        } else {
          console.log('⚠️ Senaryoda sahne başlığı bulunamadı, AI analiz sonuçlarına bakılıyor...');
        }
      }
      
      // 1. Önce karakter verilerini topla
      if (customResults.character) {
        console.log('👥 Karakter verisi işleniyor...');
        console.log('📊 Character format:', {
          hasParsed: !!customResults.character.parsed,
          hasCharacters: !!customResults.character.characters,
          hasRawCharacters: !!customResults.character.rawCharacters,
          hasResult: !!customResults.character.result
        });
        
        // Yeni format - parsed characters
        if (customResults.character.parsed && customResults.character.characters) {
          console.log('📦 Parsed characters bulundu:', Array.isArray(customResults.character.characters), customResults.character.characters.length);
          customResults.character.characters.forEach(char => {
            if (typeof char === 'object' && char !== null && char.name) {
              characters[char.name] = char;
              console.log(`  ✓ ${char.name} eklendi`);
            } else {
              console.warn('  ⚠️ Geçersiz karakter:', typeof char, char);
            }
          });
          console.log(`✅ ${Object.keys(characters).length} yapılandırılmış karakter bulundu`);
        }
        // rawCharacters formatı
        else if (customResults.character.rawCharacters && Array.isArray(customResults.character.rawCharacters)) {
          console.log('📦 rawCharacters bulundu:', customResults.character.rawCharacters.length);
          customResults.character.rawCharacters.forEach(char => {
            if (typeof char === 'object' && char !== null && char.name) {
              characters[char.name] = char;
              console.log(`  ✓ ${char.name} eklendi (raw)`);
            }
          });
          console.log(`✅ ${Object.keys(characters).length} rawCharacter bulundu`);
        }
        // Legacy format - result parsing with safeJSONParse
        else if (customResults.character.result) {
          const characterText = customResults.character.result;
          console.log('📝 Character result parse ediliyor...');
          const characterData = safeJSONParse(characterText);
          
          if (characterData) {
            // Format 1: { characters: [...] }
            if (characterData.characters && Array.isArray(characterData.characters)) {
              characterData.characters.forEach(char => {
                if (typeof char === 'object' && char !== null && char.name) {
                  characters[char.name] = char;
                  console.log(`  ✓ Karakter eklendi: ${char.name}`);
                }
              });
            }
            // Format 2: Direct array [...]
            else if (Array.isArray(characterData)) {
              characterData.forEach(char => {
                if (typeof char === 'object' && char !== null && char.name) {
                  characters[char.name] = char;
                  console.log(`  ✓ Karakter eklendi: ${char.name}`);
                }
              });
            }
            // Format 3: Direct object with character names as keys
            else if (typeof characterData === 'object') {
              // "characters", "summary" gibi meta key'leri atla
              const metaKeys = ['characters', 'summary', 'totalCharacters', 'mainCharacters', 'supportingCharacters', 'parsed', 'type', 'source', 'timestamp', 'result'];
              
              Object.keys(characterData).forEach(key => {
                // Meta key'leri atla
                if (metaKeys.includes(key)) return;
                
                const char = characterData[key];
                // Sadece obje olan ve özellik içeren karakterleri al
                if (typeof char === 'object' && char !== null && 
                    (char.name || char.age || char.physical || char.personality)) {
                  const charObj = { ...char, name: char.name || key };
                  // İsim uzunluk kontrolü (3-50 karakter arası)
                  if (charObj.name.length >= 3 && charObj.name.length <= 50) {
                    characters[charObj.name] = charObj;
                    console.log(`  ✓ Karakter eklendi: ${charObj.name}`);
                  }
                }
              });
            }
            console.log(`✅ ${Object.keys(characters).length} karakter JSON'dan parse edildi`);
          } else {
            console.warn('⚠️ Karakter JSON parse edilemedi, text parsing deneniyor...');
            // Text parsing fallback
            const characterLines = characterText.split('\n').filter(line => line.trim());
            let currentChar = null;
            
            characterLines.forEach(line => {
              const nameMatch = line.match(/^([A-ZÜÇĞIÖŞ][A-ZÜÇĞIÖŞa-züçğıöş\s]+):/i);
              if (nameMatch) {
                // Önceki karakteri kaydet
                if (currentChar) {
                  characters[currentChar.name] = currentChar;
                }
                // Yeni karakter başlat
                const name = nameMatch[1].trim();
                currentChar = {
                  name,
                  physical: '',
                  age: '',
                  style: '',
                  personality: '',
                  role: 'supporting'
                };
              } else if (currentChar) {
                // Karakter özelliklerini parse et
                if (line.toLowerCase().includes('fiziksel') || line.toLowerCase().includes('physical')) {
                  currentChar.physical = line.split(':')[1]?.trim() || '';
                }
                if (line.toLowerCase().includes('yaş') || line.toLowerCase().includes('age')) {
                  currentChar.age = line.split(':')[1]?.trim() || '';
                }
                if (line.toLowerCase().includes('stil') || line.toLowerCase().includes('style')) {
                  currentChar.style = line.split(':')[1]?.trim() || '';
                }
                if (line.toLowerCase().includes('kişilik') || line.toLowerCase().includes('personality')) {
                  currentChar.personality = line.split(':')[1]?.trim() || '';
                }
                if (line.toLowerCase().includes('rol') || line.toLowerCase().includes('role')) {
                  currentChar.role = line.toLowerCase().includes('ana') || line.toLowerCase().includes('main') ? 'main' : 'supporting';
                }
              }
            });
            // Son karakteri kaydet
            if (currentChar) {
              characters[currentChar.name] = currentChar;
            }
            console.log(`✅ ${Object.keys(characters).length} karakter text'ten parse edildi`);
          }
        }
      }
      
      // 2. Lokasyon verilerini topla (YENİ: Sahne bazlı format desteği)
      if (customResults.location_analysis) {
        console.log('📍 Lokasyon verisi işleniyor...');
        
        // Yeni format - parsed locations with scenes
        if (customResults.location_analysis.parsed && customResults.location_analysis.locations) {
          console.log('📦 Parsed location_analysis bulundu');
          customResults.location_analysis.locations.forEach(loc => {
            locations[loc.name] = loc;
            
            // Lokasyondan sahne bilgilerini çıkar (yeni format)
            if (loc.scenes && Array.isArray(loc.scenes)) {
              console.log(`  📍 ${loc.name}: ${loc.scenes.length} sahne bilgisi`);
              
              loc.scenes.forEach(sceneInfo => {
                const sceneNum = parseInt(sceneInfo.sceneNumber) || sceneInfo.sceneNumber;
                
                // Eğer senaryodan sahne çıkarıldıysa, sadece lokasyon ve karakter bilgilerini ekle
                if (scenes.length > 0) {
                  const existingScene = scenes.find(s => {
                    const sNum = parseInt(s.number) || s.number;
                    return sNum === sceneNum || 
                           s.title === sceneInfo.sceneTitle ||
                           s.title.toLowerCase().includes(loc.name.toLowerCase()) ||
                           (s.location && s.location.toLowerCase() === loc.name.toLowerCase());
                  });
                  
                  if (existingScene) {
                    // Mevcut sahneye lokasyonu ekle
                    if (!existingScene.locations) existingScene.locations = [];
                    if (!existingScene.locations.includes(loc.name)) {
                      existingScene.locations.push(loc.name);
                    }
                    if (!existingScene.location) {
                      existingScene.location = loc.name;
                    }
                    // Sahnedeki karakterleri ekle
                    if (!existingScene.characters) existingScene.characters = [];
                    if (sceneInfo.characters && Array.isArray(sceneInfo.characters)) {
                      sceneInfo.characters.forEach(char => {
                        const charName = typeof char === 'string' ? char : (char.name || '');
                        if (charName && !existingScene.characters.includes(charName)) {
                          existingScene.characters.push(charName);
                        }
                      });
                    }
                    // Eksik bilgileri tamamla
                    if (!existingScene.description && sceneInfo.action) {
                      existingScene.description = sceneInfo.action;
                    }
                    if (!existingScene.timeOfDay && loc.timeOfDay) {
                      existingScene.timeOfDay = loc.timeOfDay;
                    }
                    console.log(`    ✓ Sahne ${existingScene.number} güncellendi: ${loc.name} eklendi`);
                  } else {
                    console.log(`    ⚠️ Sahne ${sceneNum} bulunamadı, yeni sahne oluşturuluyor`);
                  }
                }
                
                // Eşleşen sahne yoksa yeni oluştur
                if (scenes.length === 0 || !scenes.find(s => parseInt(s.number) === sceneNum)) {
                  // Sahne yoksa yeni oluştur
                  scenes.push({
                    id: `scene_${sceneInfo.sceneNumber}`,
                    number: sceneInfo.sceneNumber,
                    title: sceneInfo.sceneTitle || `SAHNE ${sceneInfo.sceneNumber} - ${loc.name}`,
                    description: sceneInfo.action || loc.description || '',
                    content: sceneInfo.action || loc.description || '',
                    characters: Array.isArray(sceneInfo.characters) ? sceneInfo.characters : [],
                    locations: [loc.name],
                    timeOfDay: loc.timeOfDay || 'day',
                    location: loc.name,
                    intExt: loc.type === 'interior' ? 'İÇ' : 'DIŞ',
                    duration: sceneInfo.duration || loc.duration || 'orta',
                    mood: loc.mood || ''
                  });
                  console.log(`    ✓ Yeni sahne oluşturuldu: ${sceneInfo.sceneNumber} - ${loc.name}`);
                }
              });
            }
          });
          console.log(`✅ ${Object.keys(locations).length} yapılandırılmış lokasyon işlendi`);
        }
        // rawLocations formatı
        else if (customResults.location_analysis.rawLocations && Array.isArray(customResults.location_analysis.rawLocations)) {
          customResults.location_analysis.rawLocations.forEach(loc => {
            locations[loc.name] = loc;
          });
          console.log(`✅ ${Object.keys(locations).length} rawLocation bulundu`);
        }
        // JSON result parsing
        else if (customResults.location_analysis.result) {
          console.log('📝 Location_analysis result parse ediliyor...');
          const locationData = safeJSONParse(customResults.location_analysis.result);
          
          if (locationData && locationData.locations && Array.isArray(locationData.locations)) {
            console.log(`📦 ${locationData.locations.length} lokasyon bulundu`);
            
            locationData.locations.forEach(loc => {
              locations[loc.name] = loc;
              
              // Sahne bilgilerini çıkar ve mevcut sahnelere entegre et
              if (loc.scenes && Array.isArray(loc.scenes)) {
                console.log(`  📍 ${loc.name}: ${loc.scenes.length} sahne bilgisi`);
                
                loc.scenes.forEach(sceneInfo => {
                  const sceneNum = parseInt(sceneInfo.sceneNumber) || sceneInfo.sceneNumber;
                  
                  // Eğer senaryodan sahne çıkarıldıysa, sadece lokasyon bilgilerini ekle
                  if (scenes.length > 0) {
                    const existingScene = scenes.find(s => {
                      const sNum = parseInt(s.number) || s.number;
                      return sNum === sceneNum || 
                             s.title === sceneInfo.sceneTitle ||
                             s.title.toLowerCase().includes(loc.name.toLowerCase());
                    });
                    
                    if (existingScene) {
                      // Mevcut sahneye lokasyonu ekle
                      if (!existingScene.locations) existingScene.locations = [];
                      if (!existingScene.locations.includes(loc.name)) {
                        existingScene.locations.push(loc.name);
                      }
                      if (!existingScene.location) {
                        existingScene.location = loc.name;
                      }
                      // Karakterleri ekle
                      if (!existingScene.characters) existingScene.characters = [];
                      if (sceneInfo.characters && Array.isArray(sceneInfo.characters)) {
                        sceneInfo.characters.forEach(char => {
                          const charName = typeof char === 'string' ? char : (char.name || '');
                          if (charName && !existingScene.characters.includes(charName)) {
                            existingScene.characters.push(charName);
                          }
                        });
                      }
                      // Eksik bilgileri tamamla
                      if (!existingScene.description && sceneInfo.action) {
                        existingScene.description = sceneInfo.action;
                      }
                      if (!existingScene.timeOfDay && loc.timeOfDay) {
                        existingScene.timeOfDay = loc.timeOfDay;
                      }
                      console.log(`    ✓ Sahne ${existingScene.number} güncellendi (result parsing)`);
                    } else {
                      console.log(`    ⚠️ Sahne ${sceneNum} bulunamadı (result parsing)`);
                    }
                  }
                  
                  // Eşleşen sahne yoksa yeni oluştur
                  if (scenes.length === 0 || !scenes.find(s => parseInt(s.number) === sceneNum)) {
                    // Hiç sahne yoksa yeni oluştur
                    scenes.push({
                      id: `scene_${sceneInfo.sceneNumber}`,
                      number: sceneInfo.sceneNumber,
                      title: sceneInfo.sceneTitle || `SAHNE ${sceneInfo.sceneNumber} - ${loc.name}`,
                      description: sceneInfo.action || loc.description || '',
                      content: sceneInfo.action || loc.description || '',
                      characters: Array.isArray(sceneInfo.characters) ? sceneInfo.characters : [],
                      locations: [loc.name],
                      timeOfDay: loc.timeOfDay || 'day',
                      location: loc.name,
                      intExt: loc.type === 'interior' ? 'İÇ' : 'DIŞ',
                      duration: sceneInfo.duration || loc.duration || 'orta',
                      mood: loc.mood || ''
                    });
                    console.log(`    ✓ Yeni sahne oluşturuldu: ${sceneInfo.sceneNumber}`);
                  }
                });
              }
            });
            console.log(`✅ ${Object.keys(locations).length} lokasyon JSON'dan parse edildi ve işlendi`);
          } else {
            console.warn('⚠️ Location JSON parse edilemedi veya locations array bulunamadı');
          }
        }
      }
      
      // 3. Yapısal analizden sahne bilgilerini al (varsa) ve mevcut sahneleri zenginleştir
      if (customResults.structure) {
        console.log('🏗️ Yapısal analiz bulundu, sahne bilgileri çıkarılıyor...');
        
        let structureData = null;
        
        // JSON format
        if (customResults.structure.result) {
          structureData = safeJSONParse(customResults.structure.result);
          if (!structureData) {
            // Text format fallback
            console.log('⚠️ Structure JSON parse edilemedi, text format deneniyor');
            structureData = { result: customResults.structure.result };
          }
        } else {
          structureData = customResults.structure;
        }
        
        // Scenes array'i bul
        let structureScenes = [];
        if (structureData && structureData.scenes && Array.isArray(structureData.scenes)) {
          structureScenes = structureData.scenes;
          console.log(`📋 Structure'dan ${structureScenes.length} sahne bulundu`);
        } else if (structureData && structureData.result && typeof structureData.result === 'string') {
          // Text formatından sahne çıkar
          console.log('📝 Structure text formatından sahne başlıkları çıkarılıyor...');
          const sceneMatches = structureData.result.match(/(?:SAHNE|INT\.|EXT\.|İÇ|DIŞ|SCENE)\s+[^\n]+/gi) || [];
          sceneMatches.forEach((sceneHeader, index) => {
            const sceneNumber = index + 1;
            structureScenes.push({
              number: sceneNumber,
              title: sceneHeader.trim()
            });
          });
          console.log(`📋 Text'ten ${structureScenes.length} sahne başlığı çıkarıldı`);
        }
        
        // Eğer daha önce senaryodan sahne çıkarılmışsa, structure'dan gelen bilgilerle zenginleştir
        if (scenes.length > 0 && structureScenes.length > 0) {
          console.log('🔄 Mevcut sahneler structure bilgileriyle zenginleştiriliyor...');
          scenes.forEach(scene => {
            const matchingStructureScene = structureScenes.find(
              s => s.number === scene.number || s.title === scene.title
            );
            if (matchingStructureScene) {
              // Structure'dan gelen detayları ekle
              scene.description = matchingStructureScene.description || scene.description || '';
              scene.mood = matchingStructureScene.mood || scene.mood || '';
              scene.duration = matchingStructureScene.duration || scene.duration || 'orta';
              scene.visualStyle = matchingStructureScene.visualStyle || '';
              
              // Karakterleri birleştir
              if (matchingStructureScene.characters) {
                const structChars = Array.isArray(matchingStructureScene.characters) 
                  ? matchingStructureScene.characters 
                  : [];
                scene.characters = [...new Set([...scene.characters, ...structChars])];
              }
            }
          });
          console.log('✅ Sahneler structure bilgileriyle zenginleştirildi');
        }
        // Eğer senaryodan sahne çıkarılmamışsa, structure'dan gelen sahneleri kullan
        else if (scenes.length === 0 && structureScenes.length > 0) {
          console.log('📥 Structure\'dan gelen sahneler kullanılıyor...');
          scenes = structureScenes.map(structScene => ({
            id: `scene_${structScene.number}`,
            number: structScene.number,
            title: structScene.title || `SAHNE ${structScene.number}`,
            description: structScene.description || structScene.content || '',
            content: structScene.content || '',
            characters: structScene.characters || [],
            locations: structScene.location ? [structScene.location] : [],
            timeOfDay: structScene.timeOfDay || 'day',
            location: structScene.location || '',
            intExt: structScene.intExt || 'İÇ',
            duration: structScene.duration || 'orta',
            mood: structScene.mood || '',
            visualStyle: structScene.visualStyle || ''
          }));
          console.log(`✅ ${scenes.length} sahne structure'dan yüklendi`);
        }
        
        // Legacy: Structure'dan gelen sahneleri merge et (eski davranış için)
        structureScenes.forEach(structScene => {
          const existingScene = scenes.find(s => s.number === structScene.number);
          
          if (existingScene) {
            // Mevcut sahneyi güncelle
            existingScene.title = structScene.title || existingScene.title;
            existingScene.description = structScene.description || structScene.content || existingScene.description;
            existingScene.duration = structScene.duration || existingScene.duration;
            
            // Karakterleri birleştir
            if (structScene.characters) {
              structScene.characters.forEach(char => {
                if (!existingScene.characters.includes(char)) {
                  existingScene.characters.push(char);
                }
              });
            }
            
            // Lokasyonları birleştir
            if (structScene.location && !existingScene.locations.includes(structScene.location)) {
              existingScene.locations.push(structScene.location);
            }
          } else {
            // Yeni sahne ekle
            scenes.push({
              id: `scene_${structScene.number}`,
              number: structScene.number,
              title: structScene.title || `SAHNE ${structScene.number}`,
              description: structScene.description || structScene.content,
              content: structScene.content || '',
              characters: structScene.characters || [],
              locations: structScene.location ? [structScene.location] : [],
              timeOfDay: structScene.timeOfDay || 'day',
              location: structScene.location || '',
              intExt: structScene.intExt || 'İÇ',
              duration: structScene.duration
            });
          }
        });
        
        console.log(`✅ ${structureScenes.length} sahne yapısal analizden işlendi`);
      }
      
      // 4. Sahneler hala yoksa, lokasyonlardan oluştur
      if (scenes.length === 0) {
        console.log('⚠️ Sahne bulunamadı, lokasyonlardan oluşturuluyor...');
        
        const locationList = Object.keys(locations);
        
        if (locationList.length > 0) {
          locationList.forEach((locName, index) => {
            const loc = locations[locName];
            const sceneNumber = index + 1;
            
            scenes.push({
              id: `scene_${sceneNumber}`,
              number: sceneNumber,
              title: `SAHNE ${sceneNumber} - ${locName}`,
              description: loc.description || '',
              content: loc.description || '',
              characters: loc.mainCharacters || [],
              locations: [locName],
              timeOfDay: loc.timeOfDay || 'day',
              location: locName,
              intExt: loc.type === 'interior' ? 'İÇ' : 'DIŞ',
              duration: loc.duration
            });
          });
          console.log(`✅ ${scenes.length} sahne lokasyonlardan oluşturuldu`);
        }
      }
      
      // 5. Sahneleri numaraya göre sırala
      scenes.sort((a, b) => (a.number || 0) - (b.number || 0));
      
      // 6. Sahne verilerini zenginleştir
      scenes.forEach(scene => {
        // Karakter isimlerini normalize et
        if (scene.characters) {
          scene.characters = scene.characters.map(char => 
            typeof char === 'string' ? char : char.name || char
          );
          scene.characters = [...new Set(scene.characters)]; // Unique yap
        }
        
        // Lokasyon isimlerini normalize et
        if (scene.locations) {
          scene.locations = scene.locations.map(loc => 
            typeof loc === 'string' ? loc : loc.name || loc
          );
          scene.locations = [...new Set(scene.locations)]; // Unique yap
        }
      });
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`✅ SAHNE ÇIKARIM SONUCU:`);
      console.log(`   📊 Toplam Sahne: ${scenes.length}`);
      console.log(`   👥 Toplam Karakter: ${Object.keys(characters).length}`);
      console.log(`   📍 Toplam Lokasyon: ${Object.keys(locations).length}`);
      scenes.forEach(scene => {
        console.log(`   🎬 Sahne ${scene.number}: ${scene.characters.length} karakter, ${scene.locations.length} mekan`);
      });
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      return {
        scenes,
        characters,
        locations,
        success: scenes.length > 0
      };
      
    } catch (error) {
      console.error('❌ Sahne çıkarım hatası:', error);
      return {
        scenes: [],
        characters: {},
        locations: {},
        success: false,
        error: error.message
      };
    }
  };

  // Helper functions for parsing
  const extractTimeOfDay = (content) => {
    const timeKeywords = {
      'sabah': 'morning',
      'öğle': 'noon', 
      'akşam': 'evening',
      'gece': 'night',
      'gündüz': 'day'
    };
    
    for (const [turkish, english] of Object.entries(timeKeywords)) {
      if (content.toLowerCase().includes(turkish)) {
        return english;
      }
    }
    return 'day';
  };
  
  const extractLocation = (content) => {
    const locMatch = content.match(/(İÇ|DIŞ)\s*-\s*([^\n]+)/i);
    return locMatch ? locMatch[2].trim() : 'Unknown Location';
  };
  
  const extractIntExt = (content) => {
    const intExtMatch = content.match(/(İÇ|DIŞ)/i);
    return intExtMatch ? (intExtMatch[1].toLowerCase() === 'iç' ? 'INT' : 'EXT') : 'INT';
  };
  
  const extractAfterKeyword = (text, keyword) => {
    const regex = new RegExp(`${keyword}[^a-zA-Züçğıöş]*([^.]+)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  };
  
  const extractAge = (text) => {
    const ageMatch = text.match(/(\d{1,2})\s*(yaş|yaşında)/i);
    return ageMatch ? `${ageMatch[1]} yaş` : '';
  };
  
  const extractLocationDescription = (text, locationName) => {
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().includes(locationName.toLowerCase())) {
        return line.trim();
      }
    }
    return '';
  };
  
  const extractAtmosphere = (text, locationName) => {
    const atmosphereKeywords = ['atmosfer', 'mood', 'hava', 'his'];
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (line.toLowerCase().includes(locationName.toLowerCase())) {
        for (const keyword of atmosphereKeywords) {
          if (line.toLowerCase().includes(keyword)) {
            return extractAfterKeyword(line, keyword);
          }
        }
      }
    }
    return 'neutral';
  };
  
  const extractLighting = (text, locationName) => {
    const lightingKeywords = ['ışık', 'aydınlatma', 'lighting'];
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (line.toLowerCase().includes(locationName.toLowerCase())) {
        for (const keyword of lightingKeywords) {
          if (line.toLowerCase().includes(keyword)) {
            return extractAfterKeyword(line, keyword);
          }
        }
      }
    }
    return 'natural';
  };

  // Safe data access with error handling
  let currentScript, scriptText, scenes;
  try {
    currentScript = getCurrentScript();
    scriptText = currentScript?.content || currentScript?.scriptText || '';
    scenes = currentScript?.structure?.scenes || [];
  } catch (err) {
    console.error('❌ Error accessing script data:', err);
    setError('Script verilerine erişimde hata oluştu');
    currentScript = null;
    scriptText = '';
    scenes = [];
  }

  // Initialize AI Handler
  useEffect(() => {
    try {
      const handler = getAIHandlerFromStore();
      setAiHandler(handler);
    } catch (err) {
      console.error('❌ Error initializing AI handler:', err);
      setAiHandler(null);
    }
  }, [getAIHandlerFromStore]);

  // Check for existing analysis data on mount
  useEffect(() => {
    const checkAnalysisData = async () => {
      console.log('🔍 Analiz verisi kontrolü...');
      
      const currentScript = getCurrentScript();
      if (!currentScript) {
        console.log('⚠️ Script bulunamadı');
        return;
      }

      // Check if analysis data already exists in script
      if (currentScript.analysisData?.customResults) {
        console.log('✅ Script içinde analiz verisi bulundu, yükleniyor...');
        const result = await loadComprehensiveAnalysisData(false);
        
        if (result.hasRequiredAnalysis && result.analysisData) {
          console.log('✅ Tüm gerekli analizler mevcut, storyboard\'a yükleniyor...');
          
          // Update progress list based on available analyses
          const customResults = result.analysisData.customResults;
          setAnalysisProgressList(prevList => 
            prevList.map(item => {
              const hasAnalysis = customResults[item.key] && (
                customResults[item.key].status === 'completed' || 
                customResults[item.key].result
              );
              
              if (hasAnalysis) {
                const timestamp = customResults[item.key].timestamp;
                const version = customResults[item.key].version || '1.0';
                console.log(`✅ ${item.name} - Versiyon: ${version}, Tarih: ${timestamp ? new Date(timestamp).toLocaleString('tr-TR') : 'Bilinmiyor'}`);
                
                return {
                  ...item,
                  status: 'completed',
                  progress: 100,
                  version: version,
                  timestamp: timestamp
                };
              }
              
              return item;
            })
          );
          
          await loadAnalysisDataToStoryboard(result.analysisData);
          console.log('✅ Analizler storyboard state\'ine yüklendi');
        }
      } else {
        console.log('ℹ️ Script analiz verisi yok, storage kontrol ediliyor...');
        // Try loading from storage
        const result = await loadComprehensiveAnalysisData(false);
        
        if (result.hasRequiredAnalysis && result.analysisData) {
          console.log('✅ Storage\'dan analizler bulundu, yükleniyor...');
          
          // Update progress list based on available analyses
          const customResults = result.analysisData.customResults;
          setAnalysisProgressList(prevList => 
            prevList.map(item => {
              const hasAnalysis = customResults[item.key] && (
                customResults[item.key].status === 'completed' || 
                customResults[item.key].result
              );
              
              if (hasAnalysis) {
                const timestamp = customResults[item.key].timestamp;
                const version = customResults[item.key].version || '1.0';
                console.log(`✅ ${item.name} - Versiyon: ${version}, Tarih: ${timestamp ? new Date(timestamp).toLocaleString('tr-TR') : 'Bilinmiyor'}`);
                
                return {
                  ...item,
                  status: 'completed',
                  progress: 100,
                  version: version,
                  timestamp: timestamp
                };
              }
              
              return item;
            })
          );
          
          await loadAnalysisDataToStoryboard(result.analysisData);
          console.log('✅ Storage\'dan analizler storyboard state\'ine yüklendi');
        }
      }
    };

    // Wait a bit for script to be loaded
    const timer = setTimeout(checkAnalysisData, 500);
    return () => clearTimeout(timer);
  }, []); // Run only on mount

  // Listen for analysis updates from AnalysisPanel
  useEffect(() => {
    const handleAnalysisUpdate = async () => {
      console.log('🔄 Analiz güncellemesi algılandı, veriler yeniden yükleniyor...');
      
      // Mark all analyses as completed in progress list
      setAnalysisProgressList(prevList => 
        prevList.map(item => ({
          ...item,
          status: 'completed',
          progress: 100
        }))
      );
      
      // Load the analysis data
      const result = await loadComprehensiveAnalysisData(false);
      
      if (result.hasRequiredAnalysis && result.analysisData) {
        console.log('✅ Analizler bulundu, storyboard state\'ine yükleniyor...');
        await loadAnalysisDataToStoryboard(result.analysisData);
        console.log('✅ Analiz verileri yüklendi, karakterler ve mekanlar hazır!');
      } else {
        console.warn('⚠️ Gerekli analizler eksik:', result.missing);
      }
    };

    // Listen for custom event from AnalysisPanel
    window.addEventListener('analysisUpdated', handleAnalysisUpdate);
    
    return () => {
      window.removeEventListener('analysisUpdated', handleAnalysisUpdate);
    };
  }, []);

  // Listen for analysis progress updates
  useEffect(() => {
    const handleAnalysisProgress = (event) => {
      const { currentAnalysis, currentAnalysisName, progress, status, completed, total, chunkProgress } = event.detail;
      
      console.log('📊 Analiz ilerlemesi:', { currentAnalysis, progress, status, chunkProgress });
      
      setAnalysisProgressList(prevList => 
        prevList.map(item => {
          if (item.key === currentAnalysis) {
            return {
              ...item,
              status: status === 'completed' ? 'completed' : 'in-progress',
              progress: status === 'completed' ? 100 : (chunkProgress || progress || 0)
            };
          }
          return item;
        })
      );
    };

    const handleAnalysisReset = () => {
      console.log('🔄 Analiz progress listesi sıfırlanıyor...');
      setAnalysisProgressList([
        { key: 'character', name: 'Karakter Analizi', status: 'pending', progress: 0 },
        { key: 'location_analysis', name: 'Mekan ve Lokasyon Analizi', status: 'pending', progress: 0 },
        { key: 'cinematography', name: 'Görüntü Yönetimi', status: 'pending', progress: 0 },
        { key: 'visual_style', name: 'Görsel Stil Analizi', status: 'pending', progress: 0 },
        { key: 'structure', name: 'Yapısal Analiz', status: 'pending', progress: 0 }
      ]);
    };

    window.addEventListener('storyboardAnalysisProgress', handleAnalysisProgress);
    window.addEventListener('storyboardAnalysisReset', handleAnalysisReset);
    
    return () => {
      window.removeEventListener('storyboardAnalysisProgress', handleAnalysisProgress);
      window.removeEventListener('storyboardAnalysisReset', handleAnalysisReset);
    };
  }, []);

  // DEBUG: characterAnalysis state değişimlerini izle
  useEffect(() => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🐛 [STATE CHANGE] characterAnalysis değişti!');
    console.log('🐛 characterAnalysis:', characterAnalysis);
    console.log('🐛 characters array:', characterAnalysis?.characters);
    console.log('🐛 Array length:', characterAnalysis?.characters?.length);
    console.log('🐛 UI condition check:', characterAnalysis?.characters && characterAnalysis.characters.length > 0);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }, [characterAnalysis]);

  // DEBUG: locationAnalysis state değişimlerini izle
  useEffect(() => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🐛 [STATE CHANGE] locationAnalysis değişti!');
    console.log('🐛 locationAnalysis:', locationAnalysis);
    console.log('🐛 locations array:', locationAnalysis?.locations);
    console.log('🐛 Array length:', locationAnalysis?.locations?.length);
    console.log('🐛 UI condition check:', locationAnalysis?.locations && locationAnalysis.locations.length > 0);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }, [locationAnalysis]);

  // Analiz paneline yönlendirme fonksiyonu (sadece yönlendirme)
  const handleGoToAnalysis = () => {
    console.log('🎬 Storyboard: Analiz paneline yönlendiriliyor...');
    
    // Storyboard modundan geldiği bilgisini window'a ekle
    window.storyboardRequestedAnalysis = true;
    
    // Analiz paneline yönlendir
    setCurrentView('analysis');
    
    // TabbedSidebar'ı da analysis tabına yönlendir
    setTimeout(() => {
      const analysisTab = document.querySelector('[data-tab="analysis"]');
      if (analysisTab) {
        analysisTab.click();
      }
      
      // Storyboard için gerekli analizleri otomatik seç ve başlat
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('selectStoryboardAnalysis'));
      }, 500);
    }, 100);
  };

  // Otomatik analiz paneli yönlendirmesi
  useEffect(() => {
    if (showAnalysisRedirect && currentScript) {
      console.log('🔄 Eksik analizler tespit edildi, otomatik olarak analiz paneline yönlendiriliyor...');
      const timer = setTimeout(() => {
        handleGoToAnalysis();
      }, 2000); // 2 saniye bekle
      
      return () => clearTimeout(timer);
    }
  }, [showAnalysisRedirect, currentScript]);

  // ESC tuşu ile modal kapatma
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape') {
        if (isFrameDetailOpen) {
          setIsFrameDetailOpen(false);
          setSelectedFrameDetail(null);
        }
        if (isCharacterDetailOpen) {
          setIsCharacterDetailOpen(false);
          setSelectedCharacterDetail(null);
        }
        if (isLocationDetailOpen) {
          setIsLocationDetailOpen(false);
          setSelectedLocationDetail(null);
        }
        if (isImageModalOpen) {
          setIsImageModalOpen(false);
          setSelectedImage(null);
        }
      }
    };

    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [isFrameDetailOpen, isCharacterDetailOpen, isLocationDetailOpen, isImageModalOpen]);

  // Prevent component unmounting from clearing processing state
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isProcessing) {
        const message = 'Storyboard analizi devam ediyor. Sayfayı kapatmak istediğinizden emin misiniz?';
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isProcessing]);

  // ============= LOCAL STORAGE MANAGEMENT =============
  
  // Save character image to local storage and file system
  const saveCharacterImageLocally = async (characterName, imageData) => {
    try {
      // Save to localStorage for quick access
      const storageKey = `character_image_${characterName}`;
      localStorage.setItem(storageKey, JSON.stringify({
        url: imageData.url,
        prompt: imageData.prompt,
        seed: imageData.seed,
        timestamp: new Date().toISOString(),
        characterName
      }));

      // Also save to indexedDB for larger storage
      if (window.indexedDB) {
        const dbRequest = indexedDB.open('StoryboardDB', 1);
        
        dbRequest.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('characters')) {
            db.createObjectStore('characters', { keyPath: 'name' });
          }
          if (!db.objectStoreNames.contains('locations')) {
            db.createObjectStore('locations', { keyPath: 'name' });
          }
        };
        
        dbRequest.onsuccess = (event) => {
          const db = event.target.result;
          
          // Check if object store exists
          if (!db.objectStoreNames.contains('characters')) {
            console.warn('⚠️ Characters object store bulunamadı, atlanıyor');
            db.close();
            return;
          }
          
          try {
            const transaction = db.transaction(['characters'], 'readwrite');
            const store = transaction.objectStore('characters');
            
            store.put({
              name: characterName,
              imageData: imageData,
              savedAt: new Date().toISOString()
            });
            
            transaction.oncomplete = () => {
              console.log('💾 Karakter görseli IndexedDB\'ye kaydedildi:', characterName);
              db.close();
            };
            
            transaction.onerror = (error) => {
              console.error('❌ Transaction hatası:', error);
              db.close();
            };
          } catch (error) {
            console.error('❌ IndexedDB transaction hatası:', error);
            db.close();
          }
        };
        
        dbRequest.onerror = (error) => {
          console.error('❌ IndexedDB açma hatası:', error);
        };
      }
      
      return true;
    } catch (error) {
      console.error('❌ Karakter görseli kaydedilemedi:', error);
      return false;
    }
  };

  // Save location image to local storage
  const saveLocationImageLocally = async (locationName, imageData) => {
    try {
      const storageKey = `location_image_${locationName}`;
      localStorage.setItem(storageKey, JSON.stringify({
        url: imageData.url,
        prompt: imageData.prompt,
        seed: imageData.seed,
        timestamp: new Date().toISOString(),
        locationName
      }));

      if (window.indexedDB) {
        const dbRequest = indexedDB.open('StoryboardDB', 1);
        
        dbRequest.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('characters')) {
            db.createObjectStore('characters', { keyPath: 'name' });
          }
          if (!db.objectStoreNames.contains('locations')) {
            db.createObjectStore('locations', { keyPath: 'name' });
          }
        };
        
        dbRequest.onsuccess = (event) => {
          const db = event.target.result;
          
          // Check if object store exists
          if (!db.objectStoreNames.contains('locations')) {
            console.warn('⚠️ Locations object store bulunamadı, atlanıyor');
            db.close();
            return;
          }
          
          try {
            const transaction = db.transaction(['locations'], 'readwrite');
            const store = transaction.objectStore('locations');
            
            store.put({
              name: locationName,
              imageData: imageData,
              savedAt: new Date().toISOString()
            });
            
            transaction.oncomplete = () => {
              console.log('💾 Mekan görseli IndexedDB\'ye kaydedildi:', locationName);
              db.close();
            };
            
            transaction.onerror = (error) => {
              console.error('❌ Transaction hatası:', error);
              db.close();
            };
          } catch (error) {
            console.error('❌ IndexedDB transaction hatası:', error);
            db.close();
          }
        };
        
        dbRequest.onerror = (error) => {
          console.error('❌ IndexedDB açma hatası:', error);
        };
      }
      
      return true;
    } catch (error) {
      console.error('❌ Mekan görseli kaydedilemedi:', error);
      return false;
    }
  };

  // Load saved character image from local storage
  const loadSavedCharacterImage = async (characterName) => {
    try {
      // Try localStorage first
      const storageKey = `character_image_${characterName}`;
      const savedData = localStorage.getItem(storageKey);
      
      if (savedData) {
        return JSON.parse(savedData);
      }

      // Try indexedDB
      if (window.indexedDB) {
        return new Promise((resolve, reject) => {
          const dbRequest = indexedDB.open('StoryboardDB', 1);
          
          dbRequest.onsuccess = (event) => {
            const db = event.target.result;
            
            // Check if object store exists
            if (!db.objectStoreNames.contains('characters')) {
              console.warn('⚠️ Characters object store bulunamadı');
              db.close();
              resolve(null);
              return;
            }
            
            try {
              const transaction = db.transaction(['characters'], 'readonly');
              const store = transaction.objectStore('characters');
              const request = store.get(characterName);
              
              request.onsuccess = () => {
                db.close();
                resolve(request.result?.imageData || null);
              };
              
              request.onerror = () => {
                db.close();
                resolve(null);
              };
            } catch (error) {
              console.error('❌ IndexedDB okuma hatası:', error);
              db.close();
              resolve(null);
            }
          };
          
          dbRequest.onerror = () => {
            resolve(null);
          };
        });
      }
      
      return null;
    } catch (error) {
      console.error('❌ Kaydedilmiş karakter görseli yüklenemedi:', error);
      return null;
    }
  };

  // Load saved location image from local storage
  const loadSavedLocationImage = async (locationName) => {
    try {
      const storageKey = `location_image_${locationName}`;
      const savedData = localStorage.getItem(storageKey);
      
      if (savedData) {
        return JSON.parse(savedData);
      }

      if (window.indexedDB) {
        return new Promise((resolve, reject) => {
          const dbRequest = indexedDB.open('StoryboardDB', 1);
          
          dbRequest.onsuccess = (event) => {
            const db = event.target.result;
            
            // Check if object store exists
            if (!db.objectStoreNames.contains('locations')) {
              console.warn('⚠️ Locations object store bulunamadı');
              db.close();
              resolve(null);
              return;
            }
            
            try {
              const transaction = db.transaction(['locations'], 'readonly');
              const store = transaction.objectStore('locations');
              const request = store.get(locationName);
              
              request.onsuccess = () => {
                db.close();
                resolve(request.result?.imageData || null);
              };
              
              request.onerror = () => {
                db.close();
                resolve(null);
              };
            } catch (error) {
              console.error('❌ IndexedDB okuma hatası:', error);
              db.close();
              resolve(null);
            }
          };
          
          dbRequest.onerror = () => {
            resolve(null);
          };
        });
      }
      
      return null;
    } catch (error) {
      console.error('❌ Kaydedilmiş mekan görseli yüklenemedi:', error);
      return null;
    }
  };

  // ============= IMAGE UPLOAD FROM FILE =============
  
  const handleCharacterImageUpload = async (characterName, file) => {
    try {
      console.log('📁 Karakter için dosya yükleniyor:', characterName);
      
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageData = {
          url: e.target.result,
          prompt: 'Kullanıcı tarafından yüklendi',
          seed: null,
          uploadedAt: new Date().toISOString()
        };
        
        // Save to local storage
        await saveCharacterImageLocally(characterName, imageData);
        
        // Update state
        setCharacterApprovals(prev => ({
          ...prev,
          [characterName]: {
            ...prev[characterName],
            image: imageData,
            uploaded: true
          }
        }));
        
        updatePhaseCompletion('character');
        console.log('✅ Karakter görseli dosyadan yüklendi:', characterName);
      };
      
      reader.readAsDataURL(file);
      return true;
    } catch (error) {
      console.error('❌ Karakter görseli yüklenemedi:', error);
      return false;
    }
  };

  const handleLocationImageUpload = async (locationName, file) => {
    try {
      console.log('📁 Mekan için dosya yükleniyor:', locationName);
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageData = {
          url: e.target.result,
          prompt: 'Kullanıcı tarafından yüklendi',
          seed: null,
          uploadedAt: new Date().toISOString()
        };
        
        await saveLocationImageLocally(locationName, imageData);
        
        setLocationApprovals(prev => ({
          ...prev,
          [locationName]: {
            ...prev[locationName],
            image: imageData,
            uploaded: true
          }
        }));
        
        updatePhaseCompletion('location');
        console.log('✅ Mekan görseli dosyadan yüklendi:', locationName);
      };
      
      reader.readAsDataURL(file);
      return true;
    } catch (error) {
      console.error('❌ Mekan görseli yüklenemedi:', error);
      return false;
    }
  };

  // ============= CHARACTER APPROVAL WORKFLOW =============
  
  const handleCharacterImageGenerated = async (characterName, imageData) => {
    console.log('🎨 Karakter görseli oluşturuldu:', characterName);
    
    // Save to local storage
    await saveCharacterImageLocally(characterName, imageData);
    
    setCharacterApprovals(prev => ({
      ...prev,
      [characterName]: {
        ...prev[characterName],
        image: imageData,
        regenerationCount: (prev[characterName]?.regenerationCount || 0) + 1
      }
    }));

    // Update phase completion tracking
    updatePhaseCompletion('character');
  };

  const approveCharacter = (characterName) => {
    console.log('✅ Karakter onaylandı:', characterName);
    
    setCharacterApprovals(prev => ({
      ...prev,
      [characterName]: {
        ...prev[characterName],
        approved: true
      }
    }));

    // Update phase completion
    updatePhaseCompletion('character');
    
    // Save to localStorage
    saveApprovalsToStorage();
  };

  const rejectCharacter = (characterName) => {
    console.log('❌ Karakter reddedildi:', characterName);
    
    setCharacterApprovals(prev => ({
      ...prev,
      [characterName]: {
        ...prev[characterName],
        approved: false,
        image: null
      }
    }));

    updatePhaseCompletion('character');
  };

  // ============= LOCATION APPROVAL WORKFLOW =============
  
  const handleLocationImageGenerated = async (locationName, imageData) => {
    console.log('🏞️ Mekan görseli oluşturuldu:', locationName);
    
    // Save to local storage
    await saveLocationImageLocally(locationName, imageData);
    
    setLocationApprovals(prev => ({
      ...prev,
      [locationName]: {
        ...prev[locationName],
        image: imageData,
        regenerationCount: (prev[locationName]?.regenerationCount || 0) + 1
      }
    }));

    // Update phase completion tracking
    updatePhaseCompletion('location');
  };

  const approveLocation = (locationName) => {
    console.log('✅ Mekan onaylandı:', locationName);
    
    setLocationApprovals(prev => {
      const updated = {
        ...prev,
        [locationName]: {
          ...prev[locationName],
          approved: true
        }
      };
      
      console.log('📍 Location approvals state güncellendi:', {
        mekan: locationName,
        toplamMekan: Object.keys(updated).length,
        onaylıMekan: Object.values(updated).filter(a => a.approved).length,
        tümOnaylar: updated
      });
      
      return updated;
    });

    // Update phase completion after state update
    setTimeout(() => {
      updatePhaseCompletion('location');
      console.log('📊 Phase completion güncellendi (location)');
    }, 0);
    
    // Save to localStorage
    saveApprovalsToStorage();
  };

  const rejectLocation = (locationName) => {
    console.log('❌ Mekan reddedildi:', locationName);
    
    setLocationApprovals(prev => ({
      ...prev,
      [locationName]: {
        ...prev[locationName],
        approved: false,
        image: null
      }
    }));

    updatePhaseCompletion('location');
  };

  // ============= SCENE APPROVAL WORKFLOW =============
  
  const approveScene = (sceneNumber) => {
    console.log('✅ Sahne onaylandı:', sceneNumber);
    
    const scene = extractedScenes.find(s => (s.number || s.sceneNumber) === sceneNumber);
    
    setSceneApprovals(prev => ({
      ...prev,
      [sceneNumber]: {
        approved: true,
        sceneData: scene,
        timestamp: Date.now()
      }
    }));

    // Update phase completion
    updatePhaseCompletion('scene');
  };

  const rejectScene = (sceneNumber) => {
    console.log('❌ Sahne reddedildi:', sceneNumber);
    
    setSceneApprovals(prev => ({
      ...prev,
      [sceneNumber]: {
        ...prev[sceneNumber],
        approved: false
      }
    }));

    updatePhaseCompletion('scene');
  };

  const approveAllScenes = () => {
    console.log('✅ Tüm sahneler onaylanıyor...');
    
    const newApprovals = {};
    extractedScenes.forEach(scene => {
      const sceneNum = scene.number || scene.sceneNumber;
      newApprovals[sceneNum] = {
        approved: true,
        sceneData: scene,
        timestamp: Date.now()
      };
    });
    
    setSceneApprovals(newApprovals);
    updatePhaseCompletion('scene');
    
    console.log(`✅ ${extractedScenes.length} sahne onaylandı!`);
  };

  const deleteLocation = (locationIndex) => {
    const location = locationAnalysis.locations[locationIndex];
    const locationName = typeof location === 'string' ? location : (location.name || location);
    
    console.log('🗑️ Mekan silindi:', locationName);
    
    // Remove from locations array
    const updatedLocations = locationAnalysis.locations.filter((_, i) => i !== locationIndex);
    setLocationAnalysis({ ...locationAnalysis, locations: updatedLocations });
    
    // Remove from approvals
    const newApprovals = { ...locationApprovals };
    delete newApprovals[locationName];
    setLocationApprovals(newApprovals);
    
    updatePhaseCompletion('location');
  };

  // ============= PHASE MANAGEMENT =============
  
  const updatePhaseCompletion = (phase) => {
    if (phase === 'character') {
      const characters = Object.keys(characterApprovals);
      const total = characters.length;
      const approved = characters.filter(name => characterApprovals[name]?.approved).length;
      const generated = characters.filter(name => characterApprovals[name]?.image).length;
      const complete = total > 0 && approved === total;

      setPhaseCompletion(prev => ({
        ...prev,
        character: { total, approved, generated, complete }
      }));
    } else if (phase === 'location') {
      const locations = Object.keys(locationApprovals);
      const total = locations.length;
      const approved = locations.filter(name => locationApprovals[name]?.approved).length;
      const generated = locations.filter(name => locationApprovals[name]?.image).length;
      const complete = total > 0 && approved === total;

      console.log('📊 Mekan fazı tamamlanma durumu:', {
        toplamMekan: total,
        onaylıMekan: approved,
        üretilmişGörsel: generated,
        tamamMı: complete,
        locationApprovals: locationApprovals
      });

      setPhaseCompletion(prev => ({
        ...prev,
        location: { total, approved, generated, complete }
      }));
    } else if (phase === 'scene') {
      const scenes = Object.keys(sceneApprovals);
      const total = extractedScenes.length;
      const approved = scenes.filter(num => sceneApprovals[num]?.approved).length;
      const complete = total > 0 && approved === total;

      setPhaseCompletion(prev => ({
        ...prev,
        scene: { total, approved, complete }
      }));
      
      console.log(`📊 Sahne durumu: ${approved}/${total} onaylı`);
    }
  };

  const proceedToNextPhase = () => {
    if (currentPhase === 'character' && phaseCompletion.character.complete) {
      console.log('➡️ Karakter fazı tamamlandı, mekan fazına geçiliyor...');
      setCurrentPhase('location');
    } else if (currentPhase === 'location' && phaseCompletion.location.complete) {
      console.log('➡️ Mekan fazı tamamlandı, storyboard üretimine geçiliyor...');
      setCurrentPhase('storyboard');
    }
  };

  const skipPhase = (phase) => {
    console.log(`⏭️ ${phase} fazı atlanıyor...`);
    
    if (phase === 'character') {
      // Auto-approve all characters
      const autoApprovals = {};
      Object.keys(characterApprovals).forEach(name => {
        autoApprovals[name] = {
          ...characterApprovals[name],
          approved: true
        };
      });
      setCharacterApprovals(autoApprovals);
      setCurrentPhase('location');
    } else if (phase === 'location') {
      // Auto-approve all locations
      const autoApprovals = {};
      Object.keys(locationApprovals).forEach(name => {
        autoApprovals[name] = {
          ...locationApprovals[name],
          approved: true
        };
      });
      setLocationApprovals(autoApprovals);
      setCurrentPhase('storyboard');
    }
  };

  // ============= STATE PERSISTENCE =============
  
  const saveApprovalsToStorage = async () => {
    try {
      const currentScript = getCurrentScript();
      if (!currentScript) {
        console.warn('⚠️ No current script to save storyboard data');
        return;
      }

      const storyboardData = {
        characterApprovals,
        locationApprovals,
        storyboardFrames,
        currentPhase,
        phaseCompletion
      };

      await analysisStorageService.saveStoryboard(
        currentScript.text,
        currentScript.name,
        storyboardData
      );
      console.log('💾 Storyboard verileri kaydedildi');
      
      // Eğer karakterler ve mekanlar analiz edilmişse, Analysis paneline bildir
      await saveAnalysisDataIfComplete();
    } catch (error) {
      console.error('❌ Storyboard kayıt hatası:', error);
    }
  };

  // Analiz verilerini Analysis paneline kaydet (görünür olması için)
  const saveAnalysisDataIfComplete = async () => {
    try {
      const currentScript = getCurrentScript();
      if (!currentScript) return;

      // Eğer karakter veya mekan analizi varsa, bunu Analysis storage'a kaydet
      if (characterAnalysis || locationAnalysis || styleAnalysis) {
        const scriptText = currentScript.cleanedText || currentScript.scriptText || currentScript.text || currentScript.content || '';
        const fileName = currentScript.fileName || currentScript.name || currentScript.title || 'untitled';
        
        // Mevcut analysis data'yı oluştur
        const analysisDataToSave = {
          character: characterAnalysis,
          location_analysis: locationAnalysis,
          style: styleAnalysis,
          color_palette: colorPalette,
          visual_language: visualLanguage,
          scenes: extractedScenes,
          timestamp: new Date().toISOString(),
          source: 'Storyboard Panel'
        };

        // Analysis storage'a kaydet (Analysis panelinde görünecek)
        await analysisStorageService.saveAnalysis(
          scriptText,
          fileName,
          analysisDataToSave,
          {
            projectName: currentScript.title || fileName.replace(/\.(pdf|txt|fountain)$/i, ''),
            analysisType: 'storyboard',
            originalFileName: fileName,
            fileType: fileName.match(/\.(pdf|txt|fountain)$/i)?.[1] || 'unknown'
          }
        );
        
        console.log('✅ Analiz verileri Analysis paneline kaydedildi');
        
        // Event gönder - Analysis panelinin refresh yapması için
        window.dispatchEvent(new CustomEvent('analysisUpdated', {
          detail: { fileName, source: 'storyboard' }
        }));
      }
    } catch (error) {
      console.error('❌ Analiz kayıt hatası:', error);
    }
  };

  const loadApprovalsFromStorage = async () => {
    try {
      const currentScript = getCurrentScript();
      if (!currentScript) {
        console.warn('⚠️ No current script to load storyboard data');
        return;
      }

      const storyboardData = await analysisStorageService.loadStoryboard(
        currentScript.text,
        currentScript.name
      );

      if (storyboardData) {
        setCharacterApprovals(storyboardData.characterApprovals || {});
        setLocationApprovals(storyboardData.locationApprovals || {});
        setStoryboardFrames(storyboardData.storyboardFrames || []);
        setCurrentPhase(storyboardData.currentPhase || null);
        setPhaseCompletion(storyboardData.phaseCompletion || {
          character: { total: 0, approved: 0, generated: 0, complete: false },
          location: { total: 0, approved: 0, generated: 0, complete: false },
          storyboard: { total: 0, generated: 0, complete: false }
        });
        console.log('📂 Storyboard verileri yüklendi');
      }
    } catch (error) {
      console.error('❌ Storyboard yükleme hatası:', error);
    }
  };

  // Load approvals on mount and check if analysis exists
  useEffect(() => {
    const checkAnalysisAndLoad = async () => {
      if (!currentScriptId) {
        // No script - clear everything
        setCharacterAnalysis(null);
        setLocationAnalysis(null);
        setStyleAnalysis(null);
        setColorPalette(null);
        setVisualLanguage(null);
        setExtractedScenes([]);
        setStoryboardFrames([]);
        setCharacterApprovals({});
        setLocationApprovals({});
        setSceneApprovals({});
        console.log('🗑️ Script yok - tüm veriler temizlendi');
        return;
      }

      // Check if analysis exists AND load analysis data
      const currentScript = getCurrentScript();
      if (currentScript) {
        const scriptText = currentScript.cleanedText || currentScript.scriptText || currentScript.text || currentScript.content || '';
        const fileName = currentScript.fileName || currentScript.name || currentScript.title || 'untitled';
        
        console.log('🔍 Script değişti - analiz verileri yükleniyor:', fileName);
        
        // Priority 1: Check script store first (AnalysisPanel loads here)
        if (currentScript.analysisData?.customResults) {
          const results = currentScript.analysisData.customResults;
          console.log('✅ Script store\'dan analiz yükleniyor:', Object.keys(results));
          
          if (results.character) {
            setCharacterAnalysis(results.character);
            console.log('📊 Karakter analizi yüklendi:', results.character.characters?.length || 0, 'karakter');
          }
          if (results.location_analysis) {
            setLocationAnalysis(results.location_analysis);
            console.log('📊 Mekan analizi yüklendi:', results.location_analysis.locations?.length || 0, 'mekan');
          }
          if (results.style) {
            setStyleAnalysis(results.style);
            console.log('📊 Stil analizi yüklendi');
          }
          if (results.color_palette) {
            setColorPalette(results.color_palette);
            console.log('📊 Renk paleti yüklendi');
          }
          if (results.visual_language) {
            setVisualLanguage(results.visual_language);
            console.log('📊 Görsel dil yüklendi');
          }
          
          // Load storyboard approvals
          await loadApprovalsFromStorage();
          return;
        }
        
        // Priority 2: Load from Analysis Panel storage
        const existingAnalysis = await analysisStorageService.loadAnalysis(scriptText, fileName);
        
        if (!existingAnalysis || !existingAnalysis.customResults || Object.keys(existingAnalysis.customResults).length === 0) {
          // No analysis found - clear storyboard data
          console.log('⚠️ Analiz kaydı bulunamadı - storyboard verileri temizleniyor');
          setCharacterAnalysis(null);
          setLocationAnalysis(null);
          setStyleAnalysis(null);
          setColorPalette(null);
          setVisualLanguage(null);
          setExtractedScenes([]);
          setStoryboardFrames([]);
          setCharacterApprovals({});
          setLocationApprovals({});
          setSceneApprovals({});
          setCurrentPhase(null);
          console.log('🗑️ Analiz yok - tüm storyboard verileri temizlendi');
        } else {
          // Analysis exists - load both analysis data and storyboard approvals
          console.log('✅ analysisStorageService\'den analiz yükleniyor:', Object.keys(existingAnalysis.customResults));
          
          // Load analysis data into state
          const results = existingAnalysis.customResults;
          if (results.character) {
            setCharacterAnalysis(results.character);
            console.log('📊 Karakter analizi yüklendi:', results.character.characters?.length || 0, 'karakter');
          }
          if (results.location_analysis) {
            setLocationAnalysis(results.location_analysis);
            console.log('📊 Mekan analizi yüklendi:', results.location_analysis.locations?.length || 0, 'mekan');
          }
          if (results.style) {
            setStyleAnalysis(results.style);
            console.log('📊 Stil analizi yüklendi');
          }
          if (results.color_palette) {
            setColorPalette(results.color_palette);
            console.log('📊 Renk paleti yüklendi');
          }
          if (results.visual_language) {
            setVisualLanguage(results.visual_language);
            console.log('📊 Görsel dil yüklendi');
          }
          
          // Load storyboard approvals
          await loadApprovalsFromStorage();
        }
      }
    };

    checkAnalysisAndLoad();
  }, [currentScriptId]);

  // Auto-save when approvals change
  useEffect(() => {
    if (currentScriptId && (Object.keys(characterApprovals).length > 0 || Object.keys(locationApprovals).length > 0)) {
      const timeoutId = setTimeout(() => {
        saveApprovalsToStorage();
      }, 1000); // Debounce 1 saniye
      
      return () => clearTimeout(timeoutId);
    }
  }, [characterApprovals, locationApprovals, storyboardFrames, currentPhase, phaseCompletion]);

  // Initialize character/location approvals when analysis data is loaded
  useEffect(() => {
    if (characterAnalysis?.characters) {
      const newApprovals = {};
      characterAnalysis.characters.forEach(char => {
        if (!characterApprovals[char.name]) {
          newApprovals[char.name] = {
            approved: false,
            image: null,
            referenceImages: [],
            regenerationCount: 0
          };
        }
      });
      
      if (Object.keys(newApprovals).length > 0) {
        setCharacterApprovals(prev => ({ ...prev, ...newApprovals }));
        updatePhaseCompletion('character');
      }
    }
  }, [characterAnalysis]);

  useEffect(() => {
    if (locationAnalysis?.locations) {
      const newApprovals = {};
      locationAnalysis.locations.forEach(loc => {
        const locName = loc.name || loc;
        if (!locationApprovals[locName]) {
          newApprovals[locName] = {
            approved: false,
            image: null,
            referenceImages: [],
            regenerationCount: 0
          };
        }
      });
      
      if (Object.keys(newApprovals).length > 0) {
        setLocationApprovals(prev => {
          const updated = { ...prev, ...newApprovals };
          console.log('📍 Location approvals güncellendi:', {
            yeniEklenen: Object.keys(newApprovals),
            toplamMekan: Object.keys(updated).length,
            onaylıMekan: Object.values(updated).filter(a => a.approved).length
          });
          return updated;
        });
        // updatePhaseCompletion after state update
        setTimeout(() => updatePhaseCompletion('location'), 0);
      }
    }
  }, [locationAnalysis]);

  // AnalysisPanel'dan kapsamlı analiz verilerini yükle
  const loadComprehensiveAnalysisData = async (showRedirect = true) => {
    try {
      let existingAnalysis = null;
      
      // Get current script
      const currentScript = getCurrentScript();
      
      console.log('🔍 Debug - getCurrentScript() sonucu:', {
        exists: !!currentScript,
        keys: currentScript ? Object.keys(currentScript) : [],
        id: currentScript?.id,
        title: currentScript?.title,
        fileName: currentScript?.fileName,
        hasText: !!currentScript?.text,
        hasContent: !!currentScript?.content,
        hasScriptText: !!currentScript?.scriptText,
        hasCleanedText: !!currentScript?.cleanedText,
        scriptTextLength: currentScript?.scriptText?.length || 0,
        cleanedTextLength: currentScript?.cleanedText?.length || 0
      });
      
      if (!currentScript) {
        console.warn('⚠️ Current script bulunamadı');
        
        // Clear all analysis states when no script found
        setCharacterAnalysis(null);
        setLocationAnalysis(null);
        setStyleAnalysis(null);
        setColorPalette(null);
        setVisualLanguage(null);
        setExtractedScenes([]);
        setStoryboardFrames([]);
        console.log('🗑️ Tüm analysis state\'leri temizlendi (script yok)');
        
        const requiredAnalysis = getStoryboardRequiredAnalysis();
        if (showRedirect) {
          setShowAnalysisRedirect(true);
          setMissingAnalysisTypes(requiredAnalysis);
        }
        return { hasRequiredAnalysis: false, available: [], missing: requiredAnalysis };
      }
      
      // Try multiple possible text field names (prioritize cleanedText if available)
      const scriptText = currentScript.cleanedText || currentScript.scriptText || currentScript.text || currentScript.content || '';
      const fileName = currentScript.fileName || currentScript.name || currentScript.title || 'untitled';
      
      if (!scriptText || scriptText.trim().length === 0) {
        console.warn('⚠️ Script metni boş veya bulunamadı');
        
        // Clear all analysis states when no script text
        setCharacterAnalysis(null);
        setLocationAnalysis(null);
        setStyleAnalysis(null);
        setColorPalette(null);
        setVisualLanguage(null);
        setExtractedScenes([]);
        setStoryboardFrames([]);
        console.log('🗑️ Tüm analysis state\'leri temizlendi (script text yok)');
        
        const requiredAnalysis = getStoryboardRequiredAnalysis();
        if (showRedirect) {
          setShowAnalysisRedirect(true);
          setMissingAnalysisTypes(requiredAnalysis);
        }
        return { hasRequiredAnalysis: false, available: [], missing: requiredAnalysis };
      }
      
      console.log('✅ Script başarıyla yüklendi:', fileName);
      console.log('📊 Script uzunluğu:', scriptText?.length || 0, 'karakter');
      
      // ═══════════════════════════════════════════════════════════════
      // VERİ YÜKLEME: Script Store (Priority 1) → analysisStorageService (Priority 2)
      // ═══════════════════════════════════════════════════════════════
      
      // Priority 1: Check script store first (AnalysisPanel loads here)
      if (currentScript.analysisData?.customResults) {
        console.log('✅ Script store\'da analiz bulundu!');
        existingAnalysis = currentScript.analysisData;
      } else {
        // Priority 2: Load from analysisStorageService
        console.log('🔍 Analysis storage\'dan yükleniyor...');
        existingAnalysis = await analysisStorageService.loadAnalysis(scriptText, fileName);
      }
      
      // 2. Bulunamazsa tüm kaydedilmiş analizleri kontrol et
      if (!existingAnalysis) {
        console.log('🗂️ Kaydedilmiş tüm analizler taranıyor...');
        const allAnalyses = await analysisStorageService.listAnalyses();
        console.log(`📊 Toplam ${allAnalyses.length} kaydedilmiş analiz bulundu`);
        
        // Exact match
        let match = allAnalyses.find(a => a.fileName === fileName || a.scriptMetadata?.originalFileName === fileName);
        
        // Fuzzy match if exact match not found
        if (!match && allAnalyses.length > 0) {
          const calculateSimilarity = (str1, str2) => {
            const a = (str1 || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const b = (str2 || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (a === b) return 1.0;
            if (a.includes(b) || b.includes(a)) return 0.9;
            let matches = 0;
            const minLength = Math.min(a.length, b.length);
            for (let i = 0; i < minLength; i++) {
              if (a[i] === b[i]) matches++;
            }
            return matches / Math.max(a.length, b.length);
          };
          
          const matches = allAnalyses
            .map(a => ({
              ...a,
              similarity: Math.max(
                calculateSimilarity(fileName, a.fileName),
                calculateSimilarity(fileName, a.scriptMetadata?.originalFileName || '')
              )
            }))
            .filter(m => m.similarity >= 0.7)
            .sort((a, b) => b.similarity - a.similarity);
          
          if (matches.length > 0) {
            match = matches[0];
            console.log(`🎯 Fuzzy match bulundu: ${match.fileName} (similarity: ${match.similarity.toFixed(2)})`);
          }
        }
        
        if (match) {
          console.log(`✅ Kaydedilmiş analiz bulundu: ${match.fileName}`);
          existingAnalysis = await analysisStorageService.loadAnalysisByKey(match.key);
        }
      }
      
      // 4. PDF match kontrolü
      if (!existingAnalysis && fileName?.endsWith('.pdf')) {
        console.log('📄 PDF dosyası için eşleşme aranıyor:', fileName);
        const pdfMatch = await analysisStorageService.findAnalysisByFileName(fileName, 0.7);
        if (pdfMatch) {
          console.log('✅ PDF eşleşmesi bulundu:', pdfMatch.key);
          existingAnalysis = await analysisStorageService.loadAnalysisByKey(pdfMatch.key);
        }
      }
      
      // ⚠️ REMOVED: Legacy customResults check - causes stale data issues
      // Script store should not cache analysis data directly
      
      console.log('🔍 Analysis Panel veri kontrolü:', {
        hasExistingAnalysis: !!existingAnalysis,
        hasCustomResults: !!existingAnalysis?.customResults,
        customResultsKeys: existingAnalysis?.customResults ? Object.keys(existingAnalysis.customResults) : [],
        dataSource: 'Analysis Panel (analysisStorageService)',
        note: 'Storyboard her zaman Analysis panelinden veri okur'
      });
      
      // 5. customResults kontrolü
      if (!existingAnalysis?.customResults) {
        console.log('ℹ️ AnalysisPanel customResults bulunamadı');
        
        // Clear all analysis states when no customResults found
        setCharacterAnalysis(null);
        setLocationAnalysis(null);
        setStyleAnalysis(null);
        setColorPalette(null);
        setVisualLanguage(null);
        setExtractedScenes([]);
        setStoryboardFrames([]);
        console.log('🗑️ Tüm analysis state\'leri temizlendi (customResults yok)');
        
        const requiredAnalysis = getStoryboardRequiredAnalysis();
        const displayNames = getAnalysisDisplayNames();
        const missingNames = requiredAnalysis.map(key => displayNames[key] || key);
        console.warn('❌ Eksik analizler:', missingNames.join(', '));
        if (showRedirect) {
          setShowAnalysisRedirect(true);
        }
        return { hasRequiredAnalysis: false, available: [], missing: requiredAnalysis };
      }
      
      const customResults = existingAnalysis.customResults;
      const available = [];
      const missing = [];
      
      // Gerekli analizleri kontrol et
      console.log('🔍 Storyboard için gerekli analizler kontrol ediliyor...');
      console.log('📊 Mevcut analizler:', Object.keys(customResults));
      
      const requiredAnalysis = getStoryboardRequiredAnalysis();
      const displayNames = getAnalysisDisplayNames();
      
      requiredAnalysis.forEach(requiredType => {
        // Check if analysis exists and has result (more flexible check)
        const analysis = customResults[requiredType];
        const hasAnalysis = analysis && (
          analysis.status === 'completed' || 
          analysis.result || 
          (typeof analysis === 'string' && analysis.length > 0)
        );
        
        if (hasAnalysis) {
          available.push(requiredType);
          console.log(`✅ ${displayNames[requiredType] || requiredType} mevcut`);
        } else {
          missing.push(requiredType);
          console.warn(`❌ ${displayNames[requiredType] || requiredType} eksik`);
        }
      });
      
      // Minimum gerekli analiz türlerini kontrol et
      const priorityAnalysis = ['character', 'location_analysis', 'cinematography', 'visual_style', 'structure'];
      const availablePriority = available.filter(type => priorityAnalysis.includes(type));
      const hasRequiredAnalysis = availablePriority.length >= 3; // En az 3 temel analiz gerekli
      
      if (!hasRequiredAnalysis && showRedirect) {
        const displayNames = getAnalysisDisplayNames();
        const missingNames = missing.map(key => displayNames[key] || key);
        console.log(`⚠️ Eksik analizler (${missing.length}/${requiredAnalysis.length}):`);
        missingNames.forEach((name, index) => {
          console.log(`   ${index + 1}. ${name}`);
        });
        
        setShowAnalysisRedirect(true);
        setMissingAnalysisTypes(missing);
        
        // Set user-friendly error message
        const errorMsg = `Storyboard için ${missing.length} analiz eksik:\n\n${missingNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}\n\nLütfen Analysis panelinden bu analizleri tamamlayın.`;
        setError(errorMsg);
      } else if (hasRequiredAnalysis) {
        setShowAnalysisRedirect(false);
        console.log(`✅ ${available.length}/${requiredAnalysis.length} gerekli analiz mevcut`);
      }
      
      return {
        hasRequiredAnalysis,
        available,
        missing,
        availableCount: available.length,
        priorityCount: availablePriority.length,
        customResults,
        analysisData: existingAnalysis
      };
      
    } catch (error) {
      console.error('❌ Kapsamlı analiz verisi yüklenemedi:', error);
      const requiredAnalysis = getStoryboardRequiredAnalysis();
      if (showRedirect) {
        setShowAnalysisRedirect(true);
        setMissingAnalysisTypes(requiredAnalysis);
      }
      return { hasRequiredAnalysis: false, available: [], missing: requiredAnalysis };
    }
  };
  
  // AnalysisPanel verilerini storyboard state'ine yükle
  const loadAnalysisDataToStoryboard = async (analysisData) => {
    try {
      const { customResults } = analysisData;
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔄 AnalysisPanel verileri storyboard\'a aktarılıyor...');
      console.log('📊 customResults keys:', Object.keys(customResults));
      console.log('📊 customResults içeriği:', customResults);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // Karakter analizi - Yapılandırılmış veriyi kullan
      if (customResults.character) {
        console.log('👥 Karakter analizi bulundu');
        console.log('📋 character içeriği:', customResults.character);
        console.log('🔍 character.parsed:', customResults.character.parsed);
        console.log('🔍 character.characters:', customResults.character.characters);
        console.log('🔍 character.rawCharacters:', customResults.character.rawCharacters);
        console.log('🔍 character.result type:', typeof customResults.character.result);
        
        let characters = [];
        
        // Önce parse edilmiş karakterleri kontrol et (yeni format)
        if (customResults.character.parsed && customResults.character.characters && customResults.character.characters.length > 0) {
          console.log('✅ Yapılandırılmış karakter verisi bulundu');
          characters = customResults.character.characters;
          console.log('📊 Karakter sayısı:', characters.length);
          console.log('📊 İlk 3 karakter:', characters.slice(0, 3));
          
          const characterState = {
            characters: characters,
            result: customResults.character.result,
            parsed: true,
            summary: customResults.character.summary,
            rawCharacters: customResults.character.rawCharacters,
            type: 'comprehensive',
            source: 'AnalysisPanel_Structured',
            timestamp: customResults.character.timestamp
          };
          
          console.log('🎯 State\'e yüklenecek veri:', characterState);
          console.log('🎯 characters array:', characterState.characters);
          console.log('🎯 İlk karakter:', characterState.characters[0]);
          
          setCharacterAnalysis(characterState);
          
          console.log(`✅ ${characters.length} yapılandırılmış karakter state'e yazıldı`);
          console.log('📊 Karakter özeti:', customResults.character.summary);
        } 
        // rawCharacters varsa onu kullan (characters boşsa)
        else if (customResults.character.rawCharacters && Array.isArray(customResults.character.rawCharacters) && customResults.character.rawCharacters.length > 0) {
          console.log('📦 rawCharacters kullanılıyor...');
          characters = customResults.character.rawCharacters;
          console.log('📊 rawCharacters sayısı:', characters.length);
          console.log('📊 İlk rawCharacter:', characters[0]);
          
          setCharacterAnalysis({
            characters: characters,
            result: customResults.character.result,
            parsed: true,
            summary: customResults.character.summary,
            rawCharacters: customResults.character.rawCharacters,
            type: 'comprehensive',
            source: 'AnalysisPanel_RawCharacters',
            timestamp: customResults.character.timestamp
          });
          
          console.log(`✅ ${characters.length} karakter rawCharacters'dan yüklendi`);
        } 
        // Result string'inden parse et (characters ve rawCharacters boş)
        else if (customResults.character.result) {
          console.log('🔧 result string\'inden karakter parse ediliyor...');
          const characterResult = customResults.character.result;
          
          // JSON bloğunu bul ve parse et
          try {
            // "KAPSAMLI ANALİZ" başlığını temizle ve JSON'u çıkar
            const jsonMatch = characterResult.match(/\{[\s\S]*"characters"[\s\S]*\}/);
            if (jsonMatch) {
              const jsonStr = jsonMatch[0];
              console.log('📝 JSON bloğu bulundu:', jsonStr.substring(0, 100) + '...');
              
              const parsed = JSON.parse(jsonStr);
              if (parsed.characters && Array.isArray(parsed.characters)) {
                characters = parsed.characters;
                console.log(`✅ ${characters.length} karakter result'tan parse edildi`);
                console.log('📊 İlk karakter:', characters[0]);
                
                setCharacterAnalysis({
                  characters: characters,
                  result: customResults.character.result,
                  parsed: true,
                  summary: parsed.summary || customResults.character.summary,
                  rawCharacters: characters,
                  type: 'comprehensive',
                  source: 'AnalysisPanel_ParsedFromResult',
                  timestamp: customResults.character.timestamp
                });
                
                console.log(`✅ ${characters.length} karakter result'tan state'e yüklendi`);
              }
            } else {
              console.warn('⚠️ JSON bloğu bulunamadı, legacy parsing deneniyor...');
              throw new Error('JSON block not found');
            }
          } catch (parseError) {
            console.warn('⚠️ JSON parse hatası, alternatif parsing deneniyor:', parseError.message);
            
            // Alternatif: Satır satır karakter objesi ara
            const lines = characterResult.split('\n');
            const parsedChars = [];
            let currentChar = null;
            
            lines.forEach(line => {
              const trimmed = line.trim();
              
              // İsim satırı: "1. AHMET" veya "AHMET:" formatı
              const nameMatch = trimmed.match(/^(?:\d+\.\s*)?([A-ZÜÇĞIÖŞ][A-ZÜÇĞIÖŞa-züçğıöş\s]{2,40})(?::|$)/);
              
              if (nameMatch && !trimmed.toLowerCase().includes('karakter') && !trimmed.toLowerCase().includes('analiz')) {
                // Önceki karakteri kaydet
                if (currentChar && currentChar.name) {
                  parsedChars.push(currentChar);
                }
                
                // Yeni karakter başlat
                currentChar = {
                  name: nameMatch[1].trim(),
                  age: '',
                  physical: '',
                  personality: '',
                  style: '',
                  role: 'supporting',
                  description: ''
                };
              } else if (currentChar) {
                // Karakter özelliklerini parse et
                const lowerLine = trimmed.toLowerCase();
                
                if (lowerLine.includes('yaş') || lowerLine.includes('age')) {
                  const ageMatch = trimmed.match(/(?:yaş|age)\s*:?\s*(.+)/i);
                  if (ageMatch) currentChar.age = ageMatch[1].trim();
                } else if (lowerLine.includes('fiziksel') || lowerLine.includes('physical')) {
                  const physicalMatch = trimmed.match(/(?:fiziksel|physical)\s*:?\s*(.+)/i);
                  if (physicalMatch) currentChar.physical = physicalMatch[1].trim();
                } else if (lowerLine.includes('kişilik') || lowerLine.includes('personality')) {
                  const personalityMatch = trimmed.match(/(?:kişilik|personality)\s*:?\s*(.+)/i);
                  if (personalityMatch) currentChar.personality = personalityMatch[1].trim();
                } else if (lowerLine.includes('stil') || lowerLine.includes('style')) {
                  const styleMatch = trimmed.match(/(?:stil|style)\s*:?\s*(.+)/i);
                  if (styleMatch) currentChar.style = styleMatch[1].trim();
                } else if (lowerLine.includes('rol') || lowerLine.includes('role')) {
                  const roleMatch = trimmed.match(/(?:rol|role)\s*:?\s*(.+)/i);
                  if (roleMatch) {
                    const roleText = roleMatch[1].toLowerCase();
                    currentChar.role = (roleText.includes('ana') || roleText.includes('main')) ? 'main' : 'supporting';
                  }
                }
              }
            });
            
            // Son karakteri kaydet
            if (currentChar && currentChar.name) {
              parsedChars.push(currentChar);
            }
            
            // Sadece geçerli karakterleri kullan (en az isim ve bir özellik olmalı)
            characters = parsedChars.filter(char => 
              char.name && 
              char.name.length >= 3 && 
              char.name.length <= 50 &&
              (char.age || char.physical || char.personality || char.style)
            );
            
            if (characters.length > 0 && characters.length < 50) { // Makul sayıda karakter
              setCharacterAnalysis({
                characters: characters,
                result: characterResult,
                parsed: false,
                type: 'comprehensive',
                source: 'AnalysisPanel_TextParsed',
                timestamp: customResults.character.timestamp
              });
              console.log(`✅ ${characters.length} karakter text parsing ile bulundu`);
            } else {
              console.error(`❌ Text parsing başarısız: ${parsedChars.length} parse edildi, ${characters.length} geçerli karakter bulundu`);
              console.log('🚨 Karakter analizi başarısız! Lütfen analizi tekrar çalıştırın.');
            }
          }
        }
      }
      
      // Lokasyon/mekan analizi - Farklı key varyasyonlarını kontrol et
      const locationData = customResults.location_analysis || customResults.locations || customResults.location;
      let locations = []; // Scope dışına taşındı
      
      if (locationData) {
        console.log('📍 Lokasyon analizi bulundu');
        console.log('📋 Lokasyon data key:', customResults.location_analysis ? 'location_analysis' : customResults.locations ? 'locations' : 'location');
        console.log('📋 Lokasyon data içeriği:', locationData);
        console.log('🔍 locations array:', locationData.locations);
        console.log('🔍 rawLocations:', locationData.rawLocations);
        console.log('🔍 result:', locationData.result ? locationData.result.substring(0, 300) : 'null');
        console.log('🔍 result type:', typeof locationData.result);
        
        // HATA KONTROLÜ
        if (locationData.result && typeof locationData.result === 'string' && locationData.result.includes('teknik bir sorun')) {
          console.error('❌❌❌ LOKASYON ANALİZİ BAŞARISIZ! ❌❌❌');
          console.error('🔴 Result:', locationData.result);
          console.error('💡 Çözüm: Analysis panelinden "Mekan ve Lokasyon Analizi"ni yeniden yapın');
        }
        
        // Önce locations array'ini kontrol et
        if (locationData.locations && Array.isArray(locationData.locations) && locationData.locations.length > 0) {
          locations = locationData.locations;
          console.log(`✅ ${locations.length} yapılandırılmış lokasyon bulundu`);
          console.log('📊 İlk 3 lokasyon:', locations.slice(0, 3));
        }
        // rawLocations'ı kontrol et
        else if (locationData.rawLocations && Array.isArray(locationData.rawLocations) && locationData.rawLocations.length > 0) {
          locations = locationData.rawLocations;
          console.log(`✅ ${locations.length} rawLocation bulundu`);
        }
        // Result'tan parse et
        else if (locationData.result && typeof locationData.result === 'string') {
          console.log('🔧 result string\'inden lokasyon parse ediliyor...');
          const locationResult = locationData.result;
          
          try {
            // JSON bloğunu bul - daha esnek regex
            let jsonMatch = locationResult.match(/\{[\s\S]*?"locations"[\s\S]*?\]/s);
            if (jsonMatch) {
              // Tam JSON'u tamamla
              let jsonStr = jsonMatch[0];
              if (!jsonStr.endsWith('}')) {
                jsonStr += '}';
              }
              console.log('📝 JSON bloğu bulundu:', jsonStr.substring(0, 200) + '...');
              
              const parsed = JSON.parse(jsonStr);
              if (parsed.locations && Array.isArray(parsed.locations) && parsed.locations.length > 0) {
                locations = parsed.locations.map(loc => ({
                  name: loc.name || 'İsimsiz Mekan',
                  type: loc.type || 'interior',
                  description: loc.description || '',
                  timeOfDay: loc.timeOfDay || 'day',
                  atmosphere: loc.atmosphere || '',
                  lighting: loc.lighting || '',
                  colors: loc.colors || '',
                  mood: loc.mood || ''
                }));
                console.log(`✅ ${locations.length} lokasyon result'tan parse edildi`);
                console.log('📊 İlk lokasyon:', locations[0]);
              } else {
                console.warn('⚠️ Parsed JSON\'da locations array boş veya yok');
                throw new Error('Empty locations array');
              }
            } else {
              console.warn('⚠️ "locations" içeren JSON bloğu bulunamadı');
              console.log('🔍 Result içeriği:', locationResult.substring(0, 500));
              throw new Error('JSON block not found');
            }
          } catch (parseError) {
            console.warn('⚠️ JSON parse hatası:', parseError.message);
            console.log('🔍 Parse edilmeye çalışılan text:', locationResult.substring(0, 500));
            // Analiz yeniden yapılmalı uyarısı
            console.error('❌ Lokasyon verisi JSON formatında değil. Analizi yeniden yapın.');
          }
        } else {
          console.warn('⚠️ locationData.result null veya string değil');
        }
        
        if (locations.length > 0) {
          const locationState = {
            locations: locations,
            result: locationData.result,
            type: 'comprehensive',
            source: 'AnalysisPanel_Structured',
            timestamp: locationData.timestamp
          };
          
          console.log('🎯 State\'e yüklenecek lokasyon verisi:', locationState);
          console.log('🎯 locations array:', locationState.locations);
          console.log('🎯 İlk lokasyon:', locationState.locations[0]);
          
          setLocationAnalysis(locationState);
          console.log(`✅ ${locations.length} mekan state'e yüklendi`);
        } else {
          console.warn('⚠️ Lokasyon verisi parse edilemedi, locations array boş');
          console.log('💡 Çözüm: Storyboard sayfasından "Analiz Yap" ile mekan analizini yeniden yapın');
        }
      } else {
        console.warn('❌ customResults içinde location_analysis, locations veya location anahtarı bulunamadı!');
        console.log('📋 Mevcut keys:', Object.keys(customResults));
      }
      
      // Alternatif: cinematography'den lokasyon çıkar
      if (customResults.cinematography && (!locationData || locations.length === 0)) {
        console.log('🎬 Sinematografi analizi lokasyon olarak kullanılıyor...');
        const cinematographyResult = customResults.cinematography.result;
        console.log('📋 Cinematography result:', cinematographyResult.substring(0, 200));
        
        // Parse cinematography for locations (locations zaten tanımlı)
        if (typeof cinematographyResult === 'string') {
          try {
            // Önce JSON parse dene - shots array'inden mekanları çıkar
            const jsonMatch = cinematographyResult.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              
              // Yeni JSON formatında shots array'i içinden mekanları çıkar
              if (parsed.shots && Array.isArray(parsed.shots)) {
                const uniqueLocations = new Map();
                parsed.shots.forEach(shot => {
                  if (shot.location && !uniqueLocations.has(shot.location)) {
                    uniqueLocations.set(shot.location, {
                      name: shot.location,
                      type: 'interior', // Default, daha sonra düzeltilebilir
                      description: shot.description || '',
                      timeOfDay: 'day',
                      atmosphere: shot.mood || '',
                      lighting: shot.lighting || ''
                    });
                  }
                });
                locations = Array.from(uniqueLocations.values());
                console.log(`✅ JSON shots array'inden ${locations.length} lokasyon çıkarıldı`);
              }
              // Eski format için fallback
              else if (parsed.locations || parsed.mekanlar) {
                locations = parsed.locations || parsed.mekanlar || [];
                console.log(`✅ JSON locations array'inden ${locations.length} lokasyon çıkarıldı`);
              }
            }
            
            // JSON yoksa veya boşsa, text'ten lokasyon pattern'lerini ara
            if (locations.length === 0) {
              console.log('⚠️ JSON\'da lokasyon yok, text parsing yapılıyor...');
              
              // Çeşitli pattern'leri dene
              const patterns = [
                /(İÇ|DIŞ)\s*[-–—:]\s*([^\n.]+)/gi,                    // İÇ - MEKAN
                /\*\*([^*]+(?:EV|SALON|ODA|OFİS|MEKAN|SOKAK|PARK|BINA|CAFE|BAR|RESTORAN|MUTFAK|BANYO)[^*]*)\*\*/gi, // **MEKAN ADI**
                /(?:^|\n)(?:\d+[\.)]\s*)?([A-ZÜÇĞİÖŞ][A-ZÜÇĞİÖŞa-züçğıöş\s]+(?:EV|SALON|ODA|OFİS|MEKAN|SOKAK|PARK|BINA|CAFE|BAR|RESTORAN|MUTFAK|BANYO)[^\n]*)/gm // BÜYÜK HARF BAŞLIKLAR
              ];
              
              for (const pattern of patterns) {
                const matches = [...cinematographyResult.matchAll(pattern)];
                if (matches.length > 0) {
                  locations = matches.map((match) => {
                    const name = match[2] || match[1];
                    const isInterior = match[0].includes('İÇ') || name.toLowerCase().includes('iç') || 
                                     name.match(/oda|salon|mutfak|banyo|ofis/i);
                    
                    return {
                      name: name.trim().replace(/^\*\*|\*\*$/g, '').replace(/^[\d\.)]+\s*/, ''),
                      type: isInterior ? 'interior' : 'exterior',
                      description: name.trim(),
                      timeOfDay: 'day'
                    };
                  });
                  
                  // Tekrar edenleri temizle
                  locations = locations.filter((loc, index, self) => 
                    index === self.findIndex(l => l.name.toLowerCase() === loc.name.toLowerCase())
                  );
                  
                  console.log(`✅ Text parsing ile ${locations.length} lokasyon bulundu (pattern ${patterns.indexOf(pattern) + 1})`);
                  break;
                }
              }
              
              if (locations.length === 0) {
                console.log('⚠️ Hiçbir pattern ile lokasyon bulunamadı');
              }
            }
          } catch (e) {
            console.warn('⚠️ Sinematografi analizi parse edilemedi:', e.message);
            
            // Fallback: Gelişmiş pattern matching
            const patterns = [
              /(İÇ|DIŞ)\s*[-–—:]\s*([^\n.]+)/gi,
              /\*\*([^*]+(?:EV|SALON|ODA|OFİS|MEKAN|SOKAK|PARK|BINA|CAFE|BAR|RESTORAN|MUTFAK|BANYO)[^*]*)\*\*/gi,
              /(?:^|\n)(?:\d+[\.)]\s*)?([A-ZÜÇĞİÖŞ][A-ZÜÇĞİÖŞa-züçğıöş\s]+(?:EV|SALON|ODA|OFİS|MEKAN|SOKAK|PARK|BINA|CAFE|BAR|RESTORAN|MUTFAK|BANYO)[^\n]*)/gm
            ];
            
            for (const pattern of patterns) {
              const matches = [...cinematographyResult.matchAll(pattern)];
              if (matches.length > 0) {
                locations = matches.map((match) => {
                  const name = match[2] || match[1];
                  const isInterior = match[0].includes('İÇ') || name.toLowerCase().includes('iç') || 
                                   name.match(/oda|salon|mutfak|banyo|ofis/i);
                  
                  return {
                    name: name.trim().replace(/^\*\*|\*\*$/g, '').replace(/^[\d\.)]+\s*/, ''),
                    type: isInterior ? 'interior' : 'exterior',
                    description: name.trim(),
                    timeOfDay: 'day'
                  };
                });
                
                locations = locations.filter((loc, index, self) => 
                  index === self.findIndex(l => l.name.toLowerCase() === loc.name.toLowerCase())
                );
                
                console.log(`✅ Fallback parsing ile ${locations.length} lokasyon bulundu`);
                break;
              }
            }
          }
        }
        
        if (locations.length > 0) {
          console.log('📊 Bulunan lokasyonlar:', locations.map(l => l.name).slice(0, 5));
          
          setLocationAnalysis({
            locations: locations,
            result: cinematographyResult,
            type: 'cinematography',
            source: 'AnalysisPanel_Cinematography',
            timestamp: customResults.cinematography.timestamp
          });
          console.log(`✅ ${locations.length} mekan (sinematografi) state'e yüklendi`);
        } else {
          console.warn('⚠️ Cinematography\'den hiç lokasyon çıkarılamadı');
        }
      }
      
      // Stil analizi
      if (customResults.visual_style) {
        console.log('🎨 Görsel stil analizi yüklendi');
        setStyleAnalysis({
          result: customResults.visual_style.result,
          type: 'comprehensive',
          source: 'AnalysisPanel',
          timestamp: customResults.visual_style.timestamp
        });
      }
      
      // Renk paleti
      if (customResults.color_palette) {
        console.log('🎭 Renk paleti analizi yüklendi');
        setColorPalette({
          result: customResults.color_palette.result,
          type: 'comprehensive',
          source: 'AnalysisPanel',
          timestamp: customResults.color_palette.timestamp
        });
      }
      
      // Yapısal analiz -> sahne verisi olarak kullan
      if (customResults.structure) {
        console.log('🏗️ Yapısal analiz sahne verisi olarak yüklendi');
        // Yapısal analiz sonucunu sahne listesi olarak parse et
        try {
          const structureResult = customResults.structure.result;
          // Bu veriyi scene parsing için kullan
          console.log('📋 Yapısal analiz verisi sahne ekstraktı için hazır');
        } catch (parseError) {
          console.warn('⚠️ Yapısal analiz parse edilemedi:', parseError);
        }
      }
      
      console.log('✅ AnalysisPanel verileri başarıyla storyboard\'a yüklendi!');
      
      // Analiz verilerinden sahneleri çıkar
      console.log('🎬 Analiz verilerinden sahne çıkarımı başlatılıyor...');
      const sceneExtractionResult = extractScenesFromAnalysis({ customResults });
      
      console.log('📊 Sahne çıkarım sonucu:', sceneExtractionResult);
      
      // Sonuç objesinden scenes array'ini al
      const extractedScenesData = sceneExtractionResult?.scenes || [];
      const extractedCharactersData = sceneExtractionResult?.characters || {};
      const extractedLocationsData = sceneExtractionResult?.locations || {};
      
      if (extractedScenesData.length > 0) {
        setExtractedScenes(extractedScenesData);
        console.log(`✅ ${extractedScenesData.length} sahne başarıyla çıkarıldı!`);
      } else {
        // Sahne verisi yoksa karakterleri ve lokasyonları kullanarak basit sahneler oluştur
        console.log('⚠️ Yapısal analiz bulunamadı, karakter ve lokasyonlardan sahneler oluşturuluyor...');
        
        const characters = customResults.character?.characters || [];
        const locations = customResults.location_analysis?.locations || customResults.cinematography?.locations || [];
        
        const generatedScenes = [];
        
        // Her lokasyon için bir sahne oluştur
        if (locations.length > 0) {
          locations.forEach((loc, index) => {
            generatedScenes.push({
              id: `scene_${index + 1}`,
              number: index + 1,
              title: `SAHNE ${index + 1} - ${loc.name || loc}`,
              content: `${loc.description || 'Sahne açıklaması'}`,
              characters: characters.slice(0, 3).map(c => c.name || c), // İlk 3 karakteri ekle
              locations: [loc.name || loc],
              timeOfDay: loc.timeOfDay || 'day',
              location: loc.name || loc,
              intExt: loc.type === 'interior' ? 'İÇ' : 'DIŞ'
            });
          });
        } else if (characters.length > 0) {
          // Lokasyon yoksa karakter bazlı sahneler oluştur
          generatedScenes.push({
            id: 'scene_1',
            number: 1,
            title: 'SAHNE 1 - Karakter Sahnesi',
            content: 'Karakterlerin yer aldığı genel sahne',
            characters: characters.map(c => c.name || c),
            locations: ['Genel Mekan'],
            timeOfDay: 'day',
            location: 'Genel Mekan',
            intExt: 'İÇ'
          });
        }
        
        if (generatedScenes.length > 0) {
          setExtractedScenes(generatedScenes);
          console.log(`✅ ${generatedScenes.length} sahne otomatik oluşturuldu`);
        } else {
          console.warn('⚠️ Hiç sahne oluşturulamadı');
          setExtractedScenes([]);
        }
      }
      
      // Karakter referanslarını set et (extracted veya analysis'den)
      const allCharacters = {};
      
      // Önce extracted characters'ı kullan
      Object.keys(extractedCharactersData).forEach(charName => {
        allCharacters[charName] = extractedCharactersData[charName];
      });
      
      // Eğer yoksa character analysis'den al
      if (Object.keys(allCharacters).length === 0 && customResults.character?.characters) {
        customResults.character.characters.forEach(char => {
          const charName = char.name || char;
          allCharacters[charName] = char;
        });
      }
      
      if (Object.keys(allCharacters).length > 0) {
        setCharacterReferences(allCharacters);
        console.log(`👥 ${Object.keys(allCharacters).length} karakter referansı set edildi`);
        
        // Kaydedilmiş karakter görsellerini yükle
        console.log('🖼️ Kaydedilmiş karakter görselleri kontrol ediliyor...');
        const savedCharacterImages = {};
        for (const charName of Object.keys(allCharacters)) {
          const savedImage = await loadSavedCharacterImage(charName);
          if (savedImage) {
            savedCharacterImages[charName] = {
              image: savedImage,
              approved: true,
              uploaded: savedImage.uploadedAt ? true : false
            };
            console.log(`✅ ${charName} için kaydedilmiş görsel yüklendi`);
          }
        }
        if (Object.keys(savedCharacterImages).length > 0) {
          setCharacterApprovals(prev => ({ ...prev, ...savedCharacterImages }));
          console.log(`📦 ${Object.keys(savedCharacterImages).length} karakter görseli geri yüklendi`);
        }
      }
      
      // Lokasyon referanslarını set et (extracted veya analysis'den)
      const allLocations = {};
      
      // Önce extracted locations'ı kullan
      Object.keys(extractedLocationsData).forEach(locName => {
        allLocations[locName] = extractedLocationsData[locName];
      });
      
      // Eğer yoksa location analysis'den al
      if (Object.keys(allLocations).length === 0 && customResults.location_analysis?.locations) {
        customResults.location_analysis.locations.forEach(loc => {
          const locName = loc.name || loc;
          allLocations[locName] = loc;
        });
      }
      
      if (Object.keys(allLocations).length > 0) {
        setLocationReferences(allLocations);
        console.log(`📍 ${Object.keys(allLocations).length} lokasyon referansı set edildi`);
        
        // Kaydedilmiş lokasyon görsellerini yükle
        console.log('🖼️ Kaydedilmiş lokasyon görselleri kontrol ediliyor...');
        const savedLocationImages = {};
        for (const locName of Object.keys(allLocations)) {
          const savedImage = await loadSavedLocationImage(locName);
          if (savedImage) {
            savedLocationImages[locName] = {
              image: savedImage,
              approved: true,
              uploaded: savedImage.uploadedAt ? true : false
            };
            console.log(`✅ ${locName} için kaydedilmiş görsel yüklendi`);
          }
        }
        if (Object.keys(savedLocationImages).length > 0) {
          setLocationApprovals(prev => ({ ...prev, ...savedLocationImages }));
          console.log(`📦 ${Object.keys(savedLocationImages).length} lokasyon görseli geri yüklendi`);
        }
      }
      
    } catch (error) {
      console.error('❌ AnalysisPanel verileri storyboard\'a yüklenemedi:', error);
      throw error;
    }
  };


  // Sayfa yüklendiğinde analiz verilerini kontrol et
  useEffect(() => {
    const checkAnalysisData = async () => {
      if (!scriptText || !currentScript?.name) {
        return;
      }
      
      console.log('🔍 Storyboard için analiz verileri kontrol ediliyor...');
      await loadComprehensiveAnalysisData(true);
    };

    // Debounce ile sayfa yüklendiğinde kontrol et
    const timeoutId = setTimeout(() => {
      checkAnalysisData();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [currentScript?.name, scriptText]);

  // Auto-load cached storyboard data when component mounts
  useEffect(() => {
    const autoLoadStoryboard = async () => {
      // Safety checks
      if (!scriptText || !currentScript?.name) {
        console.log('⏭️ Skipping auto-load: no script text or name');
        return;
      }

      const fileName = currentScript.name;
      const storageKey = `storyboard_${fileName}`;

      console.log('🔍 Auto-loading storyboard check for:', fileName);

      try {
        // FIRST: Try to load existing analysis data from analysisStorageService
        let analysisData = null;
        try {
          analysisData = await analysisStorageService.loadAnalysis(scriptText, fileName);
          if (!analysisData && fileName.endsWith('.pdf')) {
            const pdfMatch = await analysisStorageService.findAnalysisByFileName(fileName, 0.7);
            if (pdfMatch) {
              analysisData = await analysisStorageService.loadAnalysisByKey(pdfMatch.key);
            }
          }

          if (analysisData) {
            console.log('📊 Found existing analysis data, will use for storyboard');

            // Extract character data from analysis
            if (analysisData.characters && !characterAnalysis) {
              console.log('👥 Using analysis character data');
              setCharacterAnalysis(analysisData.characters);
            }

            // Extract location data from analysis
            if (analysisData.locations && !locationAnalysis) {
              console.log('📍 Using analysis location data');
              setLocationAnalysis(analysisData.locations);
            }

            // Extract visual style hints if available
            if (analysisData.visual_style && !styleAnalysis) {
              console.log('🎨 Using analysis visual style data');
              setStyleAnalysis(analysisData.visual_style);
            }
          }
        } catch (analysisError) {
          console.log('ℹ️ No existing analysis found:', analysisError.message);
        }

        // THEN: Try to load cached storyboard data
        const cached = localStorage.getItem(storageKey);
        if (!cached) {
          console.log('ℹ️ No cached storyboard found');
          return;
        }

        const data = JSON.parse(cached);
        console.log('📦 Found cached storyboard data');

        // Validate data structure
        if (!data || typeof data !== 'object') {
          console.warn('⚠️ Invalid cached data format');
          localStorage.removeItem(storageKey);
          return;
        }

        // Restore all storyboard state with safety checks
        if (data.characterAnalysis && typeof data.characterAnalysis === 'object') {
          setCharacterAnalysis(data.characterAnalysis);
        }
        if (data.locationAnalysis && typeof data.locationAnalysis === 'object') {
          setLocationAnalysis(data.locationAnalysis);
        }
        if (data.styleAnalysis && typeof data.styleAnalysis === 'object') {
          setStyleAnalysis(data.styleAnalysis);
        }
        if (data.colorPalette) {
          setColorPalette(data.colorPalette);
        }
        if (data.visualLanguage) {
          setVisualLanguage(data.visualLanguage);
        }
        if (data.characterReferences && typeof data.characterReferences === 'object') {
          setCharacterReferences(data.characterReferences);
        }
        if (data.locationReferences && typeof data.locationReferences === 'object') {
          setLocationReferences(data.locationReferences);
        }
        if (data.finalStoryboard && typeof data.finalStoryboard === 'object') {
          setFinalStoryboard(data.finalStoryboard);
        }
        if (data.storyboardScenes && Array.isArray(data.storyboardScenes)) {
          setStoryboardScenes(data.storyboardScenes);
        }

        // Set to appropriate step based on what's completed
        if (data.finalStoryboard && Object.keys(data.finalStoryboard).length > 0) {
          setCurrentStep(4);
        } else if (data.characterReferences && Object.keys(data.characterReferences).length > 0) {
          setCurrentStep(3);
        } else if (data.styleAnalysis) {
          setCurrentStep(2);
        } else if (data.characterAnalysis) {
          setCurrentStep(1);
        }

        console.log('✅ Auto-loaded cached storyboard successfully');
      } catch (error) {
        console.error('❌ Auto-load storyboard failed:', error);
        // Clear corrupted cache
        try {
          const storageKey = `storyboard_${currentScript.name}`;
          localStorage.removeItem(storageKey);
          console.log('🗑️ Cleared corrupted cache');
        } catch (cleanupError) {
          console.error('Cleanup failed:', cleanupError);
        }
      }
    };

    // Add a small delay to ensure component is fully mounted
    const timeoutId = setTimeout(() => {
      autoLoadStoryboard();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [scriptText, currentScript?.name]);

  // Save storyboard data to cache whenever it changes
  useEffect(() => {
    const saveStoryboard = () => {
      if (!currentScript?.name) {
        console.log('⏭️ Skipping save: no script name');
        return;
      }

      // Only save if we have some actual data (not initial empty states)
      const hasData = characterAnalysis ||
        styleAnalysis ||
        (characterReferences && Object.keys(characterReferences).length > 0) ||
        (finalStoryboard && Object.keys(finalStoryboard).length > 0);

      if (!hasData) {
        console.log('⏭️ Skipping save: no data to save yet');
        return;
      }

      try {
        const storageKey = `storyboard_${currentScript.name}`;
        const data = {
          characterAnalysis,
          locationAnalysis,
          styleAnalysis,
          colorPalette,
          visualLanguage,
          characterReferences,
          locationReferences,
          finalStoryboard,
          storyboardScenes,
          timestamp: new Date().toISOString(),
          version: '1.0'
        };

        localStorage.setItem(storageKey, JSON.stringify(data));
        console.log('💾 Storyboard data saved to cache');
      } catch (error) {
        console.error('❌ Failed to save storyboard:', error);
        // If localStorage is full, try to clear old storyboards
        if (error.name === 'QuotaExceededError') {
          console.warn('⚠️ LocalStorage quota exceeded, consider implementing cleanup');
        }
      }
    };

    // Debounce save operations
    const timeoutId = setTimeout(() => {
      saveStoryboard();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [
    characterAnalysis,
    locationAnalysis,
    styleAnalysis,
    colorPalette,
    visualLanguage,
    characterReferences,
    locationReferences,
    finalStoryboard,
    storyboardScenes,
    currentScript?.name
  ]);

  // 🎨 Otomatik karakter görseli oluşturma fonksiyonu
  const autoGenerateCharacterImages = async (characters) => {
    if (!characters || characters.length === 0) {
      console.log('⏭️ No characters to generate images for');
      return;
    }

    console.log('🎨 Auto-generating character images for:', characters.length, 'characters');
    setStoryboardProgress({
      message: 'Karakter görselleri otomatik oluşturuluyor...',
      progress: 10
    });

    let generatedCount = 0;
    const characterImagesData = {};

    for (let i = 0; i < characters.length; i++) {
      const character = characters[i];

      try {
        setStoryboardProgress({
          message: `${character.name} karakter görseli oluşturuluyor...`,
          progress: 10 + (i / characters.length) * 30
        });

        // Build character prompt
        let characterPrompt = `Professional character portrait of ${character.name}`;

        if (character.physical) {
          characterPrompt += `, ${character.physical}`;
        }

        if (character.personality) {
          const personalityVisuals = {
            'confident': 'confident posture, strong gaze',
            'mysterious': 'enigmatic expression, dramatic lighting',
            'friendly': 'warm smile, approachable demeanor',
            'aggressive': 'intense expression, strong jaw',
            'gentle': 'soft features, kind eyes',
            'intelligent': 'thoughtful expression, sharp eyes'
          };

          Object.keys(personalityVisuals).forEach(trait => {
            if (character.personality.toLowerCase().includes(trait)) {
              characterPrompt += `, ${personalityVisuals[trait]}`;
            }
          });
        }

        if (character.age) {
          characterPrompt += `, ${character.age} years old`;
        }

        if (character.style) {
          characterPrompt += `, ${character.style}`;
        }

        characterPrompt += ', cinematic portrait, professional lighting, 4K quality, detailed facial features';

        console.log(`🎨 Generating image for ${character.name} with prompt:`, characterPrompt);

        const imageResult = await aiHandler.generateImage(characterPrompt, {
          character: character.name,
          style: 'cinematic character portrait'
        });

        if (imageResult && imageResult.imageData) {
          const imageUrl = `data:${imageResult.mimeType || 'image/png'};base64,${imageResult.imageData}`;
          characterImagesData[character.name] = {
            url: imageUrl,
            prompt: characterPrompt,
            timestamp: new Date().toISOString(),
            character: character.name
          };

          generatedCount++;
          console.log(`✅ Character image generated for ${character.name}`);
        }

      } catch (error) {
        console.error(`❌ Failed to generate image for ${character.name}:`, error);
        // Continue with other characters
      }

      // Small delay between requests to avoid rate limits
      if (i < characters.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Save generated images
    if (generatedCount > 0) {
      setCharacterImages(characterImagesData);
      console.log(`✅ Generated ${generatedCount}/${characters.length} character images`);

      setStoryboardProgress({
        message: `${generatedCount} karakter görseli oluşturuldu!`,
        progress: 50
      });
    } else {
      console.log('⚠️ No character images could be generated');
    }
  };

  const phases = [
    {
      id: 'character',
      title: '🎭 Karakter Seçimi',
      description: 'Karakterleri görselleştir, beğenmediklerini yeniden üret veya referans kullan',
      status: !characterAnalysis ? 'pending' : // If no analysis, can't start
        phaseCompletion.character.complete ? 'completed' :
        currentPhase === 'character' && isProcessing ? 'processing' :
        currentPhase === 'character' ? 'active' : 'pending'
    },
    {
      id: 'location',
      title: '🏞️ Mekan Görselleştirme',
      description: 'Mekanları görselleştir ve onayla',
      status: !characterAnalysis ? 'pending' : // If no analysis, can't start
        phaseCompletion.location.complete ? 'completed' :
        currentPhase === 'location' && isProcessing ? 'processing' :
        currentPhase === 'location' ? 'active' : 'pending'
    },
    {
      id: 'storyboard',
      title: '🎬 Storyboard Üretimi',
      description: 'Onaylanmış karakter ve mekanlarla profesyonel storyboard oluştur',
      status: phaseCompletion.storyboard.complete ? 'completed' :
        currentPhase === 'storyboard' && isProcessing ? 'processing' :
        currentPhase === 'storyboard' ? 'active' : 'pending'
    }
  ];

  // Aşama 1: Karakter ve Mekan Analizi
  const analyzeCharactersAndLocations = async () => {
    setError(null);
    setIsStoryboardProcessing(true);
    setStoryboardProgress({ message: 'Karakter ve mekan analizi başlıyor...', progress: 0 });

    // Create AbortController for cancellation
    const controller = new AbortController();
    setAbortController(controller);
    setStoryboardAbortController(controller);

    try {
      const isAIConfigured = isConfigured();
      let aiHandler = null;

      try {
        aiHandler = getAIHandlerFromStore();
      } catch (aiError) {
        console.error('❌ AI Handler error:', aiError);
        alert('AI bağlantısında sorun var. Lütfen AI ayarlarını kontrol edin.');
        return;
      }

      if (!isAIConfigured || !aiHandler) {
        alert('AI ayarları yapılmamış. Lütfen önce AI sağlayıcısını yapılandırın.');
        return;
      }

      // FIRST: Check if AnalysisPanel has required data
      console.log('🔍 Checking if AnalysisPanel has storyboard requirements...');

      if (window.analysisPanel && window.analysisPanel.hasAnalysisData()) {
        const requirements = window.analysisPanel.checkStoryboardRequirements();
        console.log('📊 Analysis requirements check:', requirements);

        if (!requirements.hasRequired) {
          const runMissingAnalysis = confirm(
            '🎬 Storyboard için bazı analizler eksik!\n\n' +
            `❌ Eksik analizler: ${requirements.missing.join(', ')}\n` +
            `✅ Mevcut analizler: ${requirements.existing.join(', ')}\n\n` +
            'Eksik analizleri otomatik olarak çalıştıralım mı?\n\n' +
            '✅ EVET = Ana analiz modülünde eksik analizleri yap\n' +
            '❌ HAYIR = Manuel analiz yap (daha uzun sürer)'
          );

          if (runMissingAnalysis) {
            console.log('🚀 Running missing analysis via AnalysisPanel...');
            try {
              await window.analysisPanel.runRequiredAnalysis();
              alert('✅ Storyboard için gerekli analizler tamamlandı! Analiz verileri kullanılıyor.');
              // Continue with analysis data below
            } catch (error) {
              console.error('Analysis failed:', error);
              alert('❌ Analiz sırasında hata oluştu. Manuel analiz yapılacak.');
            }
          }
        }
      }

      setIsProcessing(true);

      // AnalysisPanel'dan kapsamlı analiz verilerini al
      const comprehensiveAnalysis = await loadComprehensiveAnalysisData();
      
      if (comprehensiveAnalysis?.hasRequiredAnalysis) {
        console.log('📊 AnalysisPanel kapsamlı analiz verisi bulundu!');
        const requiredAnalysis = getStoryboardRequiredAnalysis();
        
        const useExisting = confirm(
          '🎬 AnalysisPanel\'den kapsamlı storyboard analizi bulundu!\n\n' +
          `✅ Mevcut Analizler (${comprehensiveAnalysis.availableCount}/${requiredAnalysis.length}):` +
          `\n${comprehensiveAnalysis.available.join(', ')}\n\n` +
          (comprehensiveAnalysis.missing.length > 0 ? 
            `❌ Eksik Analizler (${comprehensiveAnalysis.missing.length}):` +
            `\n${comprehensiveAnalysis.missing.join(', ')}\n\n` : '') +
          'Bu verileri storyboard için kullanmak ister misiniz?\n\n' +
          '✅ EVET = Mevcut analizi kullan (hızlı ve kapsamlı)\n' +
          '❌ HAYIR = Yeni temel analiz yap (API kullanır)'
        );

        if (useExisting) {
          console.log('✅ AnalysisPanel kapsamlı verisi storyboard için yükleniyor...');
          await loadAnalysisDataToStoryboard(comprehensiveAnalysis);
          setCurrentStep(2);
          alert(`✅ Kapsamlı analiz verisi yüklendi! (${comprehensiveAnalysis.availableCount} analiz türü)`);
          return;
        }
      }
      // Karakter analizi - AnalysisPanel'daki prompt'u kullanıyoruz
      const characterPrompt = `
Lütfen metindeki karakterleri analiz et ve şu başlıklar altında raporla:

ÖNEMLİ: Bu senaryo belirli bir dönemde geçmektedir. Karakter özelliklerini, giyim tarzını ve fiziksel özelliklerini bu döneme uygun olarak belirt.

SENARYO:
${scriptText}

1. Ana Karakterler:
   - İsim ve temel özellikler (yaş, fiziksel görünüm, giyim tarzı - döneme uygun)
   - Motivasyonlar ve hedefler
   - Karakter gelişimi
   - Karakteristik jestleri ve davranışları

2. Yan Karakterler:
   - İsim ve temel özellikler
   - Rolleri ve önemleri
   - Ana karakterlerle ilişkileri

3. Diyalog Analizi:
   - Her karakterin konuşma tarzı
   - Diyalog tutarlılığı
   - Karakter sesine uygunluk

4. Fiziksel ve Görsel Özellikler:
   - Boy, kilo, saç rengi, göz rengi
   - Giyim tarzı ve aksesuar tercihleri (dönemin modasına uygun)
   - Karakteristik fiziksel özellikleri
   - Yüz ifadeleri ve mimikler

Lütfen MUTLAKA JSON formatında yanıt ver (ek açıklama olmadan sadece JSON):
{
  "characters": [
    {
      "name": "Karakter İsmi",
      "age": "yaş aralığı",
      "physical": "detaylı fiziksel özellikler (boy, kilo, saç, göz, ten rengi, vs. - döneme uygun)",
      "personality": "kişilik özellikleri ve motivasyonlar",
      "style": "giyim tarzı ve aksesuar tercihleri (döneme uygun)",
      "role": "hikayedeki rolü (ana karakter/yan karakter)",
      "gestures": "karakteristik hareketler, jestler ve konuşma tarzı",
      "relationships": "diğer karakterlerle ilişkiler",
      "development": "karakter gelişimi",
      "period": "karakterin hangi dönemde yaşadığı"
    }
  ]
}
      `;

      console.log('🎭 Karakter analizi başlıyor...');
      setStoryboardProgress({ message: 'Karakter analizi yapılıyor...', progress: 25 });

      // Check for cancellation
      if (controller.signal.aborted) {
        console.log('🚫 Character analysis cancelled');
        return;
      }

      // Senaryo metnini kısalt (çok uzunsa chunking kullan)
      const maxTextLength = 8000; // 8K karakter limit
      const textToAnalyze = scriptText.length > maxTextLength
        ? scriptText.substring(0, maxTextLength) + '\n\n[Metin kısaltıldı...]'
        : scriptText;

      // Extract time period/year from script for historical accuracy
      let timePeriod = 'modern';
      const scriptLower = scriptText.toLowerCase();
      
      // Check for specific years
      const yearMatch = scriptText.match(/\b(19\d{2}|20\d{2})\b/);
      if (yearMatch) {
        timePeriod = yearMatch[0];
      }
      // Check for historical periods
      else if (scriptLower.includes('osmanlı') || scriptLower.includes('ottoman')) {
        timePeriod = 'Osmanlı Dönemi (1299-1922)';
      } else if (scriptLower.includes('cumhuriyet') || scriptLower.includes('atatürk')) {
        timePeriod = 'Erken Cumhuriyet Dönemi (1920-1940)';
      } else if (scriptLower.includes('80\'ler') || scriptLower.includes('1980')) {
        timePeriod = '1980\'ler';
      } else if (scriptLower.includes('90\'lar') || scriptLower.includes('1990')) {
        timePeriod = '1990\'lar';
      } else if (scriptLower.includes('2000\'ler') || scriptLower.includes('milenyum')) {
        timePeriod = '2000\'ler';
      } else if (scriptLower.includes('gelecek') || scriptLower.includes('distopya') || scriptLower.includes('bilim kurgu')) {
        timePeriod = 'Gelecek/Bilim Kurgu';
      }
      
      console.log('📅 Tespit edilen dönem:', timePeriod);
      
      // Kısaltılmış karakter promptı
      const shortCharacterPrompt = `Sen bir senaryo analiz uzmanısın. Aşağıdaki senaryodaki karakterleri analiz et:

ÖNEMLİ: Bu senaryo "${timePeriod}" döneminde geçmektedir. Karakter özelliklerini, giyim tarzını ve fiziksel özelliklerini bu döneme uygun olarak belirt.

SENARYO:
${textToAnalyze}

Lütfen JSON formatında yanıt ver:
{
  "characters": [
    {
      "name": "Karakter İsmi",
      "age": "yaş aralığı",
      "physical": "fiziksel özellikler (${timePeriod} dönemine uygun)",
      "personality": "kişilik özellikleri",
      "style": "giyim tarzı ve stil (${timePeriod} dönemine uygun)",
      "role": "ana/yan karakter",
      "period": "${timePeriod}"
    }
  ]
}`;

      const characterResult = await getAIHandlerFromStore().generateText(
        'Sen bir senaryo analiz uzmanısın.',
        shortCharacterPrompt,
        { timeout: 300000 } // 5 dakika
      );

      // Mekan analizi
      console.log('🏢 Mekan analizi başlıyor...');
      setStoryboardProgress({ message: 'Mekan analizi yapılıyor...', progress: 50 });

      // Check for cancellation
      if (controller.signal.aborted) {
        console.log('🚫 Location analysis cancelled');
        return;
      }

      const shortLocationPrompt = `Sen bir senaryo analiz uzmanısın. Aşağıdaki senaryodaki mekanları analiz et:

ÖNEMLİ: Bu senaryo "${timePeriod}" döneminde geçmektedir. Mekan tanımlarını, mimari özellikleri, dekorasyon ve atmosferi bu döneme uygun olarak belirt.

SENARYO:
${textToAnalyze}

Lütfen JSON formatında yanıt ver:
{
  "locations": [
    {
      "name": "Mekan İsmi",
      "type": "İç/Dış Mekan",
      "time": "Gündüz/Gece",
      "description": "detaylı açıklama (${timePeriod} dönemine uygun mimari ve dekorasyon)",
      "atmosphere": "atmosfer (${timePeriod} dönemine özgü)",
      "lighting": "aydınlatma (${timePeriod} dönemine uygun)",
      "architecture": "mimari stil (${timePeriod} dönemine özgü)",
      "period": "${timePeriod}"
    }
  ]
}`;

      const locationResult = await getAIHandlerFromStore().generateText(
        'Sen bir senaryo analiz uzmanısın.',
        shortLocationPrompt,
        { timeout: 300000 } // 5 dakika
      );

      // JSON parse etmeye çalış
      try {
        // Ham sonuçları logla
        console.log('🔍 Ham karakter sonucu (ilk 500 karakter):', characterResult.substring(0, 500));
        console.log('🔍 Ham mekan sonucu (ilk 500 karakter):', locationResult.substring(0, 500));

        // Safe JSON parse kullan
        const characterData = safeJSONParse(characterResult);
        const locationData = safeJSONParse(locationResult);

        // Veri doğrulama
        if (!characterData || !characterData.characters || !Array.isArray(characterData.characters)) {
          throw new Error('Karakter listesi bulunamadı veya geçersiz format');
        }
        if (!locationData || !locationData.locations || !Array.isArray(locationData.locations)) {
          throw new Error('Mekan listesi bulunamadı veya geçersiz format');
        }

        console.log('✅ JSON parse başarılı:', {
          characters: characterData.characters.length,
          locations: locationData.locations.length
        });

        setCharacterAnalysis(characterData);
        setLocationAnalysis(locationData);

        setStoryboardProgress({ message: 'Karakter ve mekan analizi tamamlandı!', progress: 100 });

        console.log('📋 Bulunan karakterler:', characterData.characters.map(c => c.name).join(', '));
        console.log('📋 Bulunan mekanlar:', locationData.locations.map(l => l.name).join(', '));

        // 🎨 Otomatik karakter görseli oluşturma başlat
        await autoGenerateCharacterImages(characterData.characters);

      } catch (parseError) {
        console.error('❌ JSON parse hatası:', parseError);
        console.log('🔍 Ham karakter yanıtı (tamamı):', characterResult);
        console.log('Ham mekan yanıtı:', locationResult);

        // Fallback: Ham metni yapılandırılmış formata çevirmeye çalış
        const fallbackCharacters = {
          characters: [{
            name: 'Parse Hatası',
            age: 'Bilinmiyor',
            physical: 'AI yanıtı JSON formatında değil',
            personality: characterResult.substring(0, 200),
            style: 'Bilinmiyor',
            role: 'Hata',
            gestures: 'N/A',
            relationships: 'N/A',
            development: 'Lütfen analizi tekrar deneyin'
          }]
        };

        const fallbackLocations = {
          locations: [{
            name: 'Parse Hatası',
            type: 'Bilinmiyor',
            time: 'Bilinmiyor',
            description: 'AI yanıtı JSON formatında değil',
            atmosphere: locationResult.substring(0, 200),
            lighting: 'Bilinmiyor',
            colors: 'Bilinmiyor',
            textures: 'Bilinmiyor',
            objects: 'N/A',
            composition: 'N/A',
            mood: 'Lütfen analizi tekrar deneyin'
          }]
        };

        setCharacterAnalysis(fallbackCharacters);
        setLocationAnalysis(fallbackLocations);

        alert('⚠️ AI yanıtı beklenilen formatta değil. Lütfen analizi tekrar deneyin veya farklı bir AI modeli seçin.');
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('🚫 Storyboard generation cancelled by user');
        alert('Storyboard üretimi iptal edildi.');
      } else {
        console.error('❌ Karakter ve mekan analizi hatası:', error);
        setError(`Analiz sırasında hata oluştu: ${error.message}`);
        alert('Analiz sırasında hata oluştu: ' + error.message);
      }
    } finally {
      setIsProcessing(false);
      clearStoryboardProgress();
      setAbortController(null);
    }
  };

  // Image modal functions
  const openImageModal = (imageData) => {
    setSelectedImage(imageData);
    setIsImageModalOpen(true);
  };

  const closeImageModal = () => {
    setSelectedImage(null);
    setIsImageModalOpen(false);
  };

  // Aşama 2: Stil ve Renk Analizi
  const analyzeStyleAndColors = async () => {
    const isAIConfigured = isConfigured();
    if (!characterAnalysis || !locationAnalysis || !aiHandler || !isAIConfigured) {
      alert('Önce karakter ve mekan analizini tamamlayın ve AI ayarlarınızı kontrol edin.');
      return;
    }

    // Create AbortController for cancellation
    const controller = new AbortController();
    setAbortController(controller);
    setStoryboardAbortController(controller);

    setIsProcessing(true);

    try {
      const stylePrompt = `
Aşağıdaki senaryo, karakter ve mekan analizlerine dayanarak görsel stil belirle:

SENARYO: ${scriptText.substring(0, 1000)}...

KARAKTER ANALİZİ: ${JSON.stringify(characterAnalysis, null, 2)}

MEKAN ANALİZİ: ${JSON.stringify(locationAnalysis, null, 2)}

Aşağıdaki konuları belirle:
- Görsel stil (sinematik, çizgi roman, realistik, vs.)
- Ana renk paleti (5-6 renk)
- İkincil renk paleti
- Aydınlatma stili
- Kamera açıları tercihi
- Görsel atmosfer
- Çizim/üretim stili

JSON formatında yanıt ver:
{
  "visualStyle": "seçilen görsel stil",
  "primaryColors": ["renk1", "renk2", "renk3"],
  "secondaryColors": ["renk4", "renk5", "renk6"],
  "lightingStyle": "aydınlatma stili",
  "cameraAngles": ["açı1", "açı2", "açı3"],
  "atmosphere": "genel atmosfer",
  "artStyle": "sanat stili açıklaması"
}
      `;

      const styleResult = await getAIHandlerFromStore().generateText(
        'Sen bir görsel tasarım uzmanısın.',
        stylePrompt
      );

      try {
        const styleData = JSON.parse(styleResult.replace(/```json|```/g, ''));
        setStyleAnalysis(styleData);
        setColorPalette(styleData.primaryColors);
        setVisualLanguage(styleData);

        console.log('✅ Stil analizi tamamlandı:', styleData);

        // Update step progress - skip reference images, go directly to final storyboard
        setTimeout(() => {
          setCurrentStep(3);
          console.log('📈 Step updated to 3 (Style analysis completed, skipping references)');
        }, 1000);

      } catch (parseError) {
        console.warn('Style JSON parse hatası:', parseError);
        setStyleAnalysis({ text: styleResult });
      }

    } catch (error) {
      console.error('Stil analizi hatası:', error);
      alert('Stil analizi sırasında hata oluştu: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Aşama 3: Referans Görsel Üretimi
  const generateReferenceImages = async () => {
    const isAIConfigured = isConfigured();
    if (!characterAnalysis || !styleAnalysis || !isAIConfigured || !aiHandler) {
      alert('Önce karakter analizi ve stil analizini tamamlayın, AI ayarlarınızı kontrol edin.');
      return;
    }

    setIsProcessing(true);
    const newCharacterRefs = {};
    const newLocationRefs = {};

    try {
      // Karakter referans görselleri - güvenli erişim
      if (characterAnalysis && characterAnalysis.characters && Array.isArray(characterAnalysis.characters)) {
        for (const character of characterAnalysis.characters) {
          if (!character.name) continue; // Boş karakterleri atla

          const characterPrompt = `
Professional character reference sheet: ${character.name}

Physical description: ${character.physical || 'Not specified'}
Age: ${character.age || 'Not specified'}  
Style: ${character.style || 'Casual'}
Personality: ${character.personality || 'Neutral'}

Visual style: ${styleAnalysis?.visualStyle || 'realistic'}
Color palette: ${colorPalette?.join(', ') || 'neutral tones'}
Art style: ${styleAnalysis?.artStyle || 'professional illustration'}

Create a clean character reference image showing the character from multiple angles (front, side, back view), consistent with the established visual style and color palette.
          `;

          try {
            const imageResult = await generateImage(characterPrompt);
            if (imageResult.success) {
              newCharacterRefs[character.name] = {
                ...character,
                referenceImage: imageResult.imageUrl,
                prompt: characterPrompt
              };
            }
          } catch (error) {
            console.warn(`${character.name} referans görseli oluşturulamadı:`, error);
          }
        }
      }

      // Mekan referans görselleri - güvenli erişim
      if (locationAnalysis && locationAnalysis.locations && Array.isArray(locationAnalysis.locations)) {
        for (const location of locationAnalysis.locations.slice(0, 3)) { // İlk 3 mekan
          if (!location.name) continue; // Boş mekanları atla

          const locationPrompt = `
Professional location reference: ${location.name}

Description: ${location.description || 'Not specified'}
Type: ${location.type || 'General location'}
Atmosphere: ${location.atmosphere || 'Neutral'}
Lighting: ${location.lighting || 'Natural lighting'}
Colors: ${location.colors || 'Neutral colors'}

Visual style: ${styleAnalysis?.visualStyle || 'realistic'}
Color palette: ${colorPalette?.join(', ') || 'neutral tones'}
Lighting style: ${styleAnalysis?.lightingStyle || 'natural'}

Create a detailed environment reference showing the location with consistent lighting and color palette.
          `;

          try {
            const imageResult = await generateImage(locationPrompt);
            if (imageResult.success) {
              newLocationRefs[location.name] = {
                ...location,
                referenceImage: imageResult.imageUrl,
                prompt: locationPrompt
              };
            }
          } catch (error) {
            console.warn(`${location.name} referans görseli oluşturulamadı:`, error);
          }
        }
      }

      setCharacterReferences(newCharacterRefs);
      setLocationReferences(newLocationRefs);

      console.log('✅ Referans görseller oluşturuldu:', {
        characters: Object.keys(newCharacterRefs).length,
        locations: Object.keys(newLocationRefs).length
      });

      // Update step progress
      setTimeout(() => {
        setCurrentStep(4);
        console.log('📈 Step updated to 4 (Reference images completed)');
      }, 1000);

    } catch (error) {
      console.error('Referans görsel üretim hatası:', error);
      alert('Referans görsel üretimi sırasında hata oluştu: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Profesyonel Storyboard Frame Üretimi
  const generateProfessionalStoryboardFrames = async () => {
    const isAIConfigured = isConfigured();
    
    // Debug: Tüm kontrolleri tek tek logla
    console.log('🔍 Storyboard üretim kontrolleri:');
    console.log('  - characterAnalysis:', characterAnalysis ? '✅ Var' : '❌ Yok');
    console.log('  - extractedScenes.length:', extractedScenes.length);
    console.log('  - characterApprovals:', Object.keys(characterApprovals).length);
    console.log('  - locationApprovals:', Object.keys(locationApprovals).length);
    console.log('  - isAIConfigured:', isAIConfigured ? '✅ Evet' : '❌ Hayır');
    console.log('  - aiHandler:', aiHandler ? '✅ Var' : '❌ Yok');
    
    if (!isAIConfigured || !aiHandler) {
      alert('❌ AI ayarları yapılmamış! Lütfen AI ayarlarını kontrol edin.');
      return;
    }
    
    // Sahne yoksa ama onaylanmış karakter/lokasyon varsa sadece bunları kullan
    const totalScenes = extractedScenes.length || 1; // En az 1 sahne varsay

    setIsProcessing(true);
    const frames = [];

    try {
      console.log(`🎬 ${totalScenes} sahne için profesyonel storyboard frame üretimi başlıyor...`);
      
      for (let i = 0; i < totalScenes; i++) {
        const scene = extractedScenes[i];
        
        setStoryboardProgress({
          message: `Sahne ${i + 1}/${totalScenes}: "${scene.title}" frame üretiliyor...`,
          progress: (i / totalScenes) * 100
        });

        // Sahne karakterlerini al
        const sceneChars = scene.characters.map(charName => {
          const charData = sceneCharacters[charName];
          return charData ? `${charName}: ${charData.physical}, ${charData.age}, ${charData.style}` : charName;
        }).join('; ');

        // Sahne lokasyonlarını al
        const sceneLocation = scene.locations.length > 0 ? sceneLocations[scene.locations[0]] : null;
        const locationDesc = sceneLocation ? 
          `${sceneLocation.name} (${sceneLocation.type}): ${sceneLocation.description}, ${sceneLocation.atmosphere} atmosfer, ${sceneLocation.lighting} ışık` :
          `${scene.location} (${scene.intExt})`;

        // Görsel stil verilerini al
        const visualStyleData = styleAnalysis?.result || '';
        const colorPaletteData = colorPalette?.result || '';
        
        // Style-specific prompt creation
        let styleDescription = '';
        let technicalRequirements = '';
        
        if (storyboardStyle === 'sketch') {
          styleDescription = `STYLE: Traditional storyboard sketch/drawing style
- Hand-drawn pencil sketch aesthetic
- Black and white line art
- Clean, professional illustration
- Expressive character sketches
- Clear environment outlines
- Film production storyboard quality`;
          
          technicalRequirements = `Technical requirements:
- 16:9 cinematic aspect ratio
- Black and white sketch/drawing style
- Clear line art with hatching for shadows
- Professional storyboard illustration
- Readable composition for film production
- Traditional animation/comic book style drawing`;
        } else {
          styleDescription = `STYLE: Cinematic realistic/photorealistic frame
- Film-quality realistic rendering
- Cinematic lighting and photography
- Natural colors and textures
- Photo-realistic characters and environments
- Professional cinematography look
- Movie production quality frame`;
          
          technicalRequirements = `Technical requirements:
- 16:9 cinematic aspect ratio
- Photorealistic rendering
- Natural lighting and colors
- Cinematic composition
- Professional film photography aesthetic
- High detail and texture quality`;
        }
        
        // Professional Storyboard Prompt
        const storyboardPrompt = `Professional film storyboard panel for:

SCENE: ${scene.title}
LOCATION: ${locationDesc}
TIME: ${scene.timeOfDay.toUpperCase()}
CHARACTERS: ${sceneChars || 'No specific characters'}

SCENE CONTENT:
${scene.content}

${styleDescription}

VISUAL STYLE GUIDE:
${visualStyleData}

COLOR PALETTE:
${colorPaletteData}

Create a detailed storyboard panel showing:
1. Clear composition with proper framing
2. Character positioning and expressions matching approved references
3. Environment/location details matching approved references
4. Camera angle and perspective
5. Lighting and mood appropriate for ${scene.timeOfDay}
6. Professional ${storyboardStyle === 'sketch' ? 'sketch/drawing' : 'cinematic photorealistic'} style

${technicalRequirements}

IMPORTANT: Use approved character and location references for visual consistency across all frames.
Focus on cinematic storytelling and professional ${storyboardStyle === 'sketch' ? 'storyboard illustration' : 'film frame'} aesthetics.`;

        try {
          console.log(`🖼️ Sahne ${i + 1} için görsel üretiliyor...`);
          
          // Prepare reference images for consistency
          const referenceImages = [];
          
          // Add character references (if enabled)
          if (useCharacterReferences) {
            scene.characters.forEach(charName => {
              const charApproval = characterApprovals[charName];
              if (charApproval?.approved && charApproval.image?.url) {
                const base64Data = charApproval.image.url.split(',')[1];
                const mimeType = charApproval.image.url.match(/data:([^;]+);/)?.[1] || 'image/png';
                referenceImages.push({
                  data: base64Data, // ✅ Sadece base64 string (data URL prefix olmadan)
                  mimeType: mimeType
                });
                console.log(`✅ Karakter referansı eklendi: ${charName}`);
              }
            });
          }
          
          // Add location references with prompt/seed info (if enabled)
          const locationPromptData = [];
          if (useLocationReferences) {
            scene.locations.forEach(locName => {
              const locApproval = locationApprovals[locName];
              if (locApproval?.approved && locApproval.image) {
                // Add image reference
                if (locApproval.image.url) {
                  const base64Data = locApproval.image.url.split(',')[1];
                  const mimeType = locApproval.image.url.match(/data:([^;]+);/)?.[1] || 'image/png';
                  referenceImages.push({
                    data: base64Data, // ✅ Sadece base64 string (data URL prefix olmadan)
                    mimeType: mimeType
                  });
                  console.log(`✅ Mekan referansı eklendi: ${locName}`);
                }
                
                // Collect prompt and seed info for consistency
                if (locApproval.image.prompt) {
                  locationPromptData.push(`${locName}: ${locApproval.image.prompt}`);
                }
                if (locApproval.image.seed) {
                  console.log(`🌱 Using seed ${locApproval.image.seed} for location ${locName} consistency`);
                }
              }
            });
          }
          
          const imageOptions = {
            scene: scene.title
          };
          
          // Add location prompt data to enhance consistency
          let enhancedPrompt = storyboardPrompt;
          if (locationPromptData.length > 0) {
            enhancedPrompt += `\n\nAPPROVED LOCATION DETAILS (use these for consistency):\n${locationPromptData.join('\n')}`;
          }
          
          // Add references if available (max 14 for Gemini)
          if (referenceImages.length > 0) {
            imageOptions.referenceImages = referenceImages.slice(0, 14);
            const charRefCount = useCharacterReferences ? scene.characters.filter(c => characterApprovals[c]?.approved).length : 0;
            const locRefCount = useLocationReferences ? scene.locations.filter(l => locationApprovals[l]?.approved).length : 0;
            console.log(`🖼️ Scene ${i + 1}: Style: ${storyboardStyle}, ${imageOptions.referenceImages.length} references (${charRefCount} characters, ${locRefCount} locations)`);
            
            // Try to use seed from first location for consistency
            if (useLocationReferences) {
              const firstLocation = scene.locations[0];
              if (firstLocation && locationApprovals[firstLocation]?.image?.seed) {
                imageOptions.seed = locationApprovals[firstLocation].image.seed;
                console.log(`🌱 Using seed ${imageOptions.seed} for scene consistency`);
              }
            }
          } else {
            console.log(`🖼️ Scene ${i + 1}: Style: ${storyboardStyle}, no references (generating from scratch)`);
          }
          
          const imageResult = await generateImage(enhancedPrompt, imageOptions);

          if (imageResult && (imageResult.success || imageResult.imageData)) {
            const imageUrl = imageResult.imageUrl ||
              (imageResult.imageData ? `data:${imageResult.mimeType || 'image/png'};base64,${imageResult.imageData}` : null);

            if (imageUrl) {
              const frame = {
                sceneId: scene.id,
                sceneNumber: scene.number,
                title: scene.title,
                location: scene.location,
                timeOfDay: scene.timeOfDay,
                intExt: scene.intExt,
                characters: scene.characters,
                locations: scene.locations,
                content: scene.content,
                storyboardImage: imageUrl,
                prompt: storyboardPrompt,
                frameNumber: i + 1,
                timestamp: new Date().toISOString(),
                analysisSource: 'AnalysisPanel'
              };
              
              frames.push(frame);
              console.log(`✅ Sahne ${i + 1} storyboard frame'i tamamlandı`);
            }
          }
        } catch (error) {
          console.error(`❌ Sahne ${i + 1} frame hatası:`, error);
          // Hata durumunda placeholder frame ekle
          frames.push({
            sceneId: scene.id,
            sceneNumber: scene.number,
            title: scene.title,
            error: true,
            errorMessage: error.message,
            frameNumber: i + 1
          });
        }

        // Rate limiting için kısa bekleme
        if (i < totalScenes - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      setStoryboardFrames(frames);
      setFinalStoryboard(frames.reduce((acc, frame) => {
        acc[frame.sceneId] = frame;
        return acc;
      }, {}));

      console.log(`🎊 Profesyonel storyboard tamamlandı! ${frames.length} frame üretildi`);
      
      // Script'e kaydet
      if (currentScriptId) {
        updateScript(currentScriptId, {
          ...currentScript,
          professionalStoryboard: {
            characterAnalysis,
            locationAnalysis,
            styleAnalysis,
            extractedScenes,
            sceneCharacters,
            sceneLocations,
            storyboardFrames: frames,
            createdAt: new Date().toISOString(),
            version: '2.0',
            source: 'AnalysisPanel'
          }
        });
      }

      // Save storyboard data to persistent storage
      await saveApprovalsToStorage();

      setCurrentStep(3);
      alert(`✅ Profesyonel storyboard tamamlandı! ${frames.length} sahne için frame üretildi.`);

    } catch (error) {
      console.error('❌ Storyboard üretim hatası:', error);
      alert('Storyboard üretimi sırasında hata oluştu: ' + error.message);
    } finally {
      setIsProcessing(false);
      clearStoryboardProgress();
    }
  };

  // Aşama 4: Final Storyboard Üretimi (Legacy)
  const generateFinalStoryboard = async () => {
    const isAIConfigured = isConfigured();
    if (!characterAnalysis || !styleAnalysis || !isAIConfigured || !aiHandler) {
      alert('Önce karakter ve stil analizini tamamlayın ve AI ayarlarınızı kontrol edin.');
      return;
    }

    setIsProcessing(true);
    const newStoryboard = {};

    try {
      // Her sahne için storyboard frame'i oluştur - güvenli erişim
      const scenesToProcess = scenes && Array.isArray(scenes) ? scenes.slice(0, 6) : [];

      for (let i = 0; i < scenesToProcess.length; i++) {
        const scene = scenesToProcess[i];
        if (!scene || !scene.title) continue; // Boş sahneleri atla

        const storyboardPrompt = `
Professional storyboard frame for scene: "${scene.title}"

Scene description: ${scene.text || 'No description available'}

CHARACTER REFERENCES:
${Object.entries(characterReferences).map(([name, ref]) =>
          `- ${name}: ${ref.physical || 'Not specified'}, ${ref.style || 'Casual'}`
        ).join('\n')}

LOCATION CONTEXT:
${Object.entries(locationReferences).map(([name, ref]) =>
          `- ${name}: ${ref.description || 'Not specified'}, ${ref.atmosphere || 'Neutral'}`
        ).join('\n')}

VISUAL STYLE GUIDE:
- Style: ${styleAnalysis?.visualStyle || 'realistic'}
- Color palette: ${colorPalette?.join(', ') || 'neutral tones'}
- Lighting: ${styleAnalysis?.lightingStyle || 'natural'}
- Camera angles: ${styleAnalysis?.cameraAngles?.join(', ') || 'medium shot'}
- Atmosphere: ${styleAnalysis?.atmosphere || 'neutral'}

Create a detailed storyboard frame that:
1. Maintains character consistency with the reference designs
2. Uses the established color palette and visual style
3. Shows clear composition and camera angle
4. Captures the scene's emotional tone
5. Professional storyboard quality with clean lines

Frame format: Cinematic 16:9 aspect ratio, storyboard sketch style
        `;

        try {
          const imageResult = await generateImage(storyboardPrompt);
          if (imageResult && (imageResult.success || imageResult.imageData)) {
            const imageUrl = imageResult.imageUrl ||
              imageResult.imageData ? `data:${imageResult.mimeType || 'image/png'};base64,${imageResult.imageData}` : null;

            if (imageUrl) {
              newStoryboard[scene.id || `scene_${i}`] = {
                ...scene,
                storyboardImage: imageUrl,
                prompt: storyboardPrompt,
                frameNumber: i + 1
              };
              console.log(`✅ Sahne ${i + 1} storyboard'u oluşturuldu`);
            }
          }
        } catch (error) {
          console.warn(`Sahne ${i + 1} storyboard'u oluşturulamadı:`, error);
        }
      }

      setFinalStoryboard(newStoryboard);
      setStoryboardScenes(Object.values(newStoryboard));

      // Storyboard'u script'e kaydet
      if (currentScriptId) {
        updateScript(currentScriptId, {
          ...currentScript,
          professionalStoryboard: {
            characterAnalysis,
            locationAnalysis,
            styleAnalysis,
            characterReferences,
            locationReferences,
            finalStoryboard: newStoryboard,
            createdAt: new Date().toISOString()
          }
        });
      }

      // Final storyboard completed - keep step 3
      console.log('✅ Final storyboard oluşturuldu:', Object.keys(newStoryboard).length, 'sahne');

    } catch (error) {
      console.error('Final storyboard üretim hatası:', error);
      alert('Final storyboard üretimi sırasında hata oluştu: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Load existing professional storyboard data
  useEffect(() => {
    if (currentScript?.professionalStoryboard) {
      const data = currentScript.professionalStoryboard;
      setCharacterAnalysis(data.characterAnalysis);
      setLocationAnalysis(data.locationAnalysis);
      setStyleAnalysis(data.styleAnalysis);
      setCharacterReferences(data.characterReferences || {});
      setLocationReferences(data.locationReferences || {});
      setFinalStoryboard(data.finalStoryboard || {});
      setStoryboardScenes(Object.values(data.finalStoryboard || {}));
    }
  }, [currentScript]);

  const executeStep = async (step) => {
    setCurrentStep(step);

    switch (step) {
      case 1:
        try {
          // AI konfigürasyonunu kontrol et
          if (!isConfigured()) {
            setError('AI sağlayıcısı yapılandırılmamış. Lütfen Settings > AI Providers bölümünden API key ekleyin.');
            return;
          }

          // Önce mevcut analizleri kontrol et
          console.log('🔍 Mevcut analiz verileri kontrol ediliyor...');
          const analysisResult = await loadComprehensiveAnalysisData();
          
          // Eğer analiz verileri varsa onları storyboard'a yükle
          if (analysisResult?.hasRequiredAnalysis && analysisResult?.analysisData) {
            await loadAnalysisDataToStoryboard(analysisResult.analysisData);
            console.log('✅ 1. Aşama tamamlandı: Mevcut analiz verileri yüklendi ve sahneler çıkarıldı');
            
            // Set phase to character after loading
            setCurrentPhase('character');
          } else {
            // Analiz verileri eksik - kullanıcıyı analiz paneline yönlendir
            throw new Error('Storyboard için gerekli analizler eksik. Lütfen Analysis panelinden gerekli analizleri yapın.');
          }
        } catch (error) {
          console.error('❌ 1. Aşama hatası:', error);
          setError(`1. Aşama hatası: ${error.message}`);
        }
        break;
      case 2:
        // Generate professional storyboard frames
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎬 STORYBOARD ÜRETİMİ BAŞLIYOR');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 Mevcut Veri Durumu:');
        console.log(`  ✓ Sahneler: ${extractedScenes.length} adet`);
        console.log(`  ✓ Karakter Analizi: ${characterAnalysis?.characters?.length || 0} adet`);
        console.log(`  ✓ Mekan Analizi: ${locationAnalysis?.locations?.length || 0} adet`);
        console.log(`  ✓ Onaylı Karakterler: ${Object.keys(characterApprovals).length} adet`);
        console.log(`  ✓ Onaylı Mekanlar: ${Object.keys(locationApprovals).length} adet`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // Önce analiz verilerinin yüklenip yüklenmediğini kontrol et
        const hasCharacterAnalysisData = characterAnalysis && characterAnalysis.characters && characterAnalysis.characters.length > 0;
        const hasLocationAnalysisData = locationAnalysis && locationAnalysis.locations && locationAnalysis.locations.length > 0;
        
        if (!hasCharacterAnalysisData && !hasLocationAnalysisData) {
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.error('❌ HATA: Analysis panelinde analiz verisi bulunamadı!');
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.error('Çözüm: Analysis paneline gidin ve analiz yapın.');
          alert('❌ Analysis panelinde analiz verisi yok!\n\nStoryboard paneli Analysis panelinden veri okur.\n\n1. Analysis paneline gidin\n2. Gerekli analizleri yapın\n3. Tekrar Storyboard paneline dönün');
          return;
        }
        
        // Eğer sahne verisi yoksa ama analiz verileri varsa, sahneleri tekrar çıkarmayı dene
        if (extractedScenes.length === 0) {
          console.log('⚠️ Sahne verisi yok, analiz verilerinden çıkarılmaya çalışılıyor...');
          try {
            // Try to reload analysis data
            const analysisResult = await loadComprehensiveAnalysisData(false);
            if (analysisResult?.hasRequiredAnalysis && analysisResult?.analysisData) {
              await loadAnalysisDataToStoryboard(analysisResult.analysisData);
              console.log('✅ Analiz verileri tekrar yüklendi');
            }
          } catch (error) {
            console.error('❌ Analiz verileri yüklenemedi:', error);
          }
          
          // Hala sahne yoksa uyarı ver
          if (extractedScenes.length === 0) {
            console.warn('⚠️ Sahne verisi yok, sadece onaylı karakter ve lokasyon görselleriyle devam ediliyor...');
          }
        }
        
        // Check if we have character and location data
        const hasCharacters = Object.keys(characterApprovals).length > 0 || (characterAnalysis?.characters?.length > 0);
        const hasLocations = Object.keys(locationApprovals).length > 0 || (locationAnalysis?.locations?.length > 0);
        
        if (!hasCharacters && !hasLocations) {
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.error('❌ HATA: Karakter veya mekan verisi yok!');
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.error('Çözüm: Analysis panelinde karakter/mekan analizi yapın.');
          alert('❌ Karakter veya mekan analizi yapılmamış!\n\nAnalysis paneline gidin ve:\n1. Karakter analizi yapın\n2. Mekan analizi yapın\n3. Tekrar Storyboard paneline dönün');
          return;
        }
        
        console.log('✅ Tüm kontroller başarılı, storyboard üretimi başlatılıyor...');
        await generateProfessionalStoryboardFrames();
        break;
    }
  };

  // Get loading message based on current step
  const getLoadingMessage = () => {
    switch (currentStep) {
      case 1: return 'AI Karakterleri ve Mekanları Sizin İçin Hazırlıyor...';
      case 2: return 'Görsel Stil ve Renk Paleti Belirleniyor...';
      case 3: return 'Final Storyboard Üretiliyor...';
      default: return 'İşleniyor...';
    }
  };

  return (
    <>
      {/* Error Display */}
      {error && (
        <div className="error-banner bg-red-600 text-white p-4 rounded-lg mb-6">
          <h3 className="font-bold mb-2">❌ Storyboard Hatası</h3>
          <p>{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 bg-red-500 hover:bg-red-400 px-3 py-1 rounded text-sm"
          >
            Hata Mesajını Kapat
          </button>
        </div>
      )}

      {/* Script Check */}
      {!currentScript && !error && (
        <div className="no-script-warning bg-yellow-600 text-white p-4 rounded-lg mb-6">
          <h3 className="font-bold mb-2">⚠️ Senaryo Gerekli</h3>
          <p>Storyboard oluşturmak için önce bir senaryo yükleyin.</p>
        </div>
      )}

      {/* Otomatik Analiz Paneli Yönlendirmesi */}
      {showAnalysisRedirect && currentScript && (
        <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-6 text-center mb-6">
          <div className="text-yellow-400 mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
            <h3 className="text-xl font-semibold mb-2">Analiz Paneline Yönlendiriliyor...</h3>
            <p className="text-sm opacity-75">
              Storyboard için gerekli analizler eksik. Otomatik olarak analiz paneline yönlendiriliyorsunuz.
            </p>
          </div>
        </div>
      )}

      <div className="professional-storyboard flex flex-col h-full bg-cinema-black">
        <div className="p-4 lg:p-6 flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {/* Progress panel removed per user request */}
            <div className="mb-8 flex items-center justify-between">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-white mb-2">
                  🎨 Storyboard
                </h1>
                <p className="text-cinema-text-dim mb-3">
                  Senaryonuzdan profesyonel storyboard oluşturun
                </p>
                <p className="text-xs text-yellow-400/70 mb-4">
                  ℹ️ Bu panel <span className="font-semibold">Analysis panelinden</span> veri okur. Analiz yoksa storyboard oluşturulamaz.
                </p>
              </div>
              {(characterAnalysis || styleAnalysis || Object.keys(characterReferences).length > 0) && (
                <button
                  onClick={async () => {
                    if (confirm('Tüm storyboard verilerini sıfırlamak istediğinizden emin misiniz?')) {
                      // Clear all state
                      setCharacterAnalysis(null);
                      setLocationAnalysis(null);
                      setStyleAnalysis(null);
                      setColorPalette(null);
                      setVisualLanguage(null);
                      setCharacterReferences({});
                      setLocationReferences({});
                      setFinalStoryboard({});
                      setStoryboardScenes([]);
                      setStoryboardFrames([]);
                      setCharacterApprovals({});
                      setLocationApprovals({});
                      setCurrentPhase(null);
                      setCurrentStep(1);
                      setPhaseCompletion({
                        character: { total: 0, approved: 0, generated: 0, complete: false },
                        location: { total: 0, approved: 0, generated: 0, complete: false },
                        storyboard: { total: 0, generated: 0, complete: false }
                      });

                      // Clear from persistent storage
                      if (currentScript?.text && currentScript?.name) {
                        try {
                          await analysisStorageService.deleteStoryboard(currentScript.text, currentScript.name);
                          console.log('🗑️ Storyboard data cleared from storage');
                        } catch (error) {
                          console.error('❌ Failed to delete storyboard:', error);
                        }
                      }
                    }
                  }}
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm transition-colors border border-red-500/30"
                >
                  🗑️ Sıfırla
                </button>
              )}
            </div>



            {/* Current Phase Content */}
            <div className="bg-cinema-dark rounded-xl border border-cinema-gray p-6 mb-6">
              
              {/* PHASE 1: CHARACTER SELECTION */}
              {(currentPhase === 'character' || currentPhase === null) && (
                <div>
                  <div className="flex items-center justify-between gap-3 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-cinema-accent rounded-lg flex items-center justify-center text-3xl">
                        🎭
                      </div>
                      <div>
                        <h2 className="text-2xl font-semibold text-white">Karakter Seçimi ve Görselleştirme</h2>
                        <p className="text-cinema-text-dim text-sm">
                          {phaseCompletion.character.total > 0 
                            ? `${phaseCompletion.character.approved}/${phaseCompletion.character.total} karakter onaylandı`
                            : 'Karakterleri görselleştirin ve storyboard için hazırlayın'}
                        </p>
                      </div>
                    </div>
                    
                    {phaseCompletion.character.total > 0 && (
                      <button
                        onClick={() => skipPhase('character')}
                        className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 px-4 py-2 rounded-lg text-sm transition-colors border border-yellow-500/30"
                      >
                        ⏭️ Bu Fazı Atla
                      </button>
                    )}
                  </div>



                  {/* Character Management - Card Grid View */}
                  {(() => {
                    console.log('🎨 [UI RENDER] Character Phase UI rendering...');
                    console.log('🎨 characterAnalysis:', characterAnalysis);
                    console.log('🎨 characterAnalysis?.characters:', characterAnalysis?.characters);
                    console.log('🎨 Array length:', characterAnalysis?.characters?.length);
                    console.log('🎨 Condition result:', characterAnalysis?.characters && characterAnalysis.characters.length > 0);
                    return null;
                  })()}
                  {characterAnalysis?.characters && characterAnalysis.characters.length > 0 && (
                    <div className="space-y-6">
                      {/* Character Management Header */}
                      <div className="bg-cinema-black/50 rounded-lg border border-cinema-gray p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h3 className="text-lg font-semibold text-cinema-accent mb-1">
                              👥 Karakter Yönetimi ({characterAnalysis.characters.length})
                            </h3>
                            <p className="text-sm text-cinema-text-dim">
                              Karakterleri gözden geçirin, hatalı olanları silin veya yeni karakter ekleyin
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                // Get characters without approved images
                                const charactersToGenerate = characterAnalysis.characters.filter(
                                  char => !characterApprovals[char.name]?.approved
                                );
                                
                                if (charactersToGenerate.length === 0) {
                                  alert('✅ Tüm karakterler zaten onaylanmış!');
                                  return;
                                }
                                
                                if (!window.confirm(`🎨 ${charactersToGenerate.length} karakter için görsel oluşturulsun mu?\n\nİşlem yaklaşık ${Math.ceil(charactersToGenerate.length * 0.5)} dakika sürebilir.`)) {
                                  return;
                                }
                                
                                setBulkGenerating(true);
                                console.log(`🎨 Toplu görselleştirme başlatılıyor: ${charactersToGenerate.length} karakter`);
                                
                                try {
                                  for (let i = 0; i < charactersToGenerate.length; i++) {
                                  const character = charactersToGenerate[i];
                                  console.log(`🎨 [${i + 1}/${charactersToGenerate.length}] ${character.name} için görsel oluşturuluyor...`);
                                  
                                  try {
                                    // Generate character prompt (same logic as CharacterImageGenerator)
                                    let characterPrompt = `Professional character portrait of ${character.name || 'character'}`;

                                    // Add physical description if available
                                    if (character.physicalDescription || character.physical) {
                                      const physicalDesc = character.physicalDescription || character.physical;
                                      if (typeof physicalDesc === 'string' && physicalDesc.trim()) {
                                        characterPrompt += `, ${physicalDesc}`;
                                      }
                                    } else if (character.description) {
                                      if (typeof character.description === 'string' && character.description.trim()) {
                                        characterPrompt += `, ${character.description}`;
                                      }
                                    }

                                    // Add personality traits for visual style
                                    if (character.personality && typeof character.personality === 'string') {
                                      const personalityVisuals = {
                                        'confident': 'confident posture, strong gaze',
                                        'mysterious': 'enigmatic expression, dramatic lighting',
                                        'friendly': 'warm smile, approachable demeanor',
                                        'aggressive': 'intense expression, strong jaw',
                                        'gentle': 'soft features, kind eyes',
                                        'intelligent': 'thoughtful expression, sharp eyes'
                                      };

                                      Object.keys(personalityVisuals).forEach(trait => {
                                        if (character.personality.toLowerCase().includes(trait)) {
                                          characterPrompt += `, ${personalityVisuals[trait]}`;
                                        }
                                      });
                                    }

                                    // Add age/role context if available
                                    if (character.age && typeof character.age === 'string' && character.age.trim()) {
                                      characterPrompt += `, ${character.age} years old`;
                                    }

                                    if (character.role || character.occupation) {
                                      const role = character.role || character.occupation;
                                      if (typeof role === 'string' && role.trim()) {
                                        characterPrompt += `, ${role}`;
                                      }
                                    }

                                    // Add style if available
                                    if (character.style && typeof character.style === 'string' && character.style.trim()) {
                                      characterPrompt += `, ${character.style}`;
                                    }

                                    // Add cinematic style
                                    characterPrompt += ', cinematic portrait, professional lighting, 4K quality, detailed facial features';
                                    
                                    // Build image options (same as CharacterImageGenerator)
                                    let imageOptions = {
                                      character: character.name || 'character',
                                      style: 'cinematic character portrait',
                                      imageSize: '1K'
                                    };

                                    // Load reference images from localStorage if available
                                    const storageKey = `character_reference_${character.name}`;
                                    try {
                                      const savedReferences = localStorage.getItem(storageKey);
                                      if (savedReferences) {
                                        const parsedReferences = JSON.parse(savedReferences);
                                        if (Array.isArray(parsedReferences) && parsedReferences.length > 0) {
                                          imageOptions.referenceImages = parsedReferences.slice(0, 14).map(refImage => {
                                            // Extract base64 data without data URL prefix
                                            let base64Data = refImage.data;
                                            const originalLength = base64Data.length;
                                            
                                            if (base64Data.includes('base64,')) {
                                              base64Data = base64Data.split('base64,')[1];
                                            }
                                            
                                            // Validate base64
                                            const cleanedLength = base64Data.length;
                                            const startsCorrectly = base64Data.startsWith('/9j') || base64Data.startsWith('iVBOR');
                                            
                                            console.log(`🔍 [${i + 1}/${charactersToGenerate.length}] Base64 Debug:`, {
                                              originalLength,
                                              cleanedLength,
                                              startsCorrectly,
                                              prefix: base64Data.substring(0, 20),
                                              mimeType: refImage.type
                                            });
                                            
                                            return {
                                              data: base64Data,
                                              mimeType: refImage.type || 'image/png',
                                              instruction: 'Create a character similar to this reference image'
                                            };
                                          });
                                          console.log(`🖼️ [${i + 1}/${charactersToGenerate.length}] ${parsedReferences.length} referans görsel yüklendi`);
                                        }
                                      }
                                    } catch (refError) {
                                      console.warn('⚠️ Referans görseller yüklenemedi:', refError);
                                    }
                                    
                                    // Generate image using AI Store (respects user's AI settings)
                                    const result = await generateImage(characterPrompt, imageOptions);
                                    
                                    if (result && result.imageData) {
                                      const imageUrl = `data:${result.mimeType || 'image/png'};base64,${result.imageData}`;
                                      
                                      // Update character approvals
                                      setCharacterApprovals(prev => ({
                                        ...prev,
                                        [character.name]: {
                                          ...prev[character.name],
                                          image: {
                                            url: imageUrl,
                                            prompt: characterPrompt,
                                            timestamp: new Date().toISOString(),
                                            model: result.model || 'unknown'
                                          },
                                          approved: false,
                                          regenerationCount: (prev[character.name]?.regenerationCount || 0)
                                        }
                                      }));
                                      
                                      console.log(`✅ [${i + 1}/${charactersToGenerate.length}] ${character.name} görseli oluşturuldu`);
                                    } else {
                                      console.error(`❌ [${i + 1}/${charactersToGenerate.length}] ${character.name} görseli oluşturulamadı`);
                                    }
                                    
                                    // Wait between requests to avoid rate limiting
                                    if (i < charactersToGenerate.length - 1) {
                                      console.log(`⏳ Rate limit koruması: 5 saniye bekleniyor...`);
                                      await new Promise(resolve => setTimeout(resolve, 5000));
                                    }
                                  } catch (error) {
                                    console.error(`❌ ${character.name} için hata:`, error);
                                  }
                                }
                                
                                console.log('✅ Toplu görselleştirme tamamlandı!');
                                alert(`✅ ${charactersToGenerate.length} karakter görseli oluşturuldu! Lütfen görselleri gözden geçirin ve onaylayın.`);
                              } finally {
                                setBulkGenerating(false);
                              }
                              }}
                              className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 px-4 py-2 rounded-lg text-sm transition-colors border border-purple-500/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={bulkGenerating || characterAnalysis.characters.filter(c => !characterApprovals[c.name]?.approved).length === 0}
                            >
                              {bulkGenerating ? (
                                <>
                                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  <span>Oluşturuluyor...</span>
                                </>
                              ) : (
                                <>
                                  <span>🎨</span>
                                  <span>Toplu Görselleştir</span>
                                  <span className="bg-purple-500/30 px-2 py-0.5 rounded text-xs">
                                    {characterAnalysis.characters.filter(c => !characterApprovals[c.name]?.approved).length}
                                  </span>
                                </>
                              )}
                            </button>
                            {characterAnalysis.characters.length > 0 && (
                              <button
                                onClick={() => {
                                  const imageCount = Object.values(characterApprovals).filter(a => a.image).length;
                                  const referenceCount = characterAnalysis.characters.filter(char => {
                                    const storageKey = `character_reference_${char.name}`;
                                    try {
                                      return !!localStorage.getItem(storageKey);
                                    } catch {
                                      return false;
                                    }
                                  }).length;
                                  
                                  let message = `⚠️ Tüm karakterleri (${characterAnalysis.characters.length}) silmek istediğinizden emin misiniz?\n\n`;
                                  if (imageCount > 0) message += `• ${imageCount} oluşturulmuş görsel silinecek\n`;
                                  if (referenceCount > 0) message += `• ${referenceCount} referans görsel silinecek\n`;
                                  message += `\nBu işlem geri alınamaz!`;
                                  
                                  if (window.confirm(message)) {
                                    console.log('🗑️ Tüm karakterler siliniyor:', {
                                      karakterler: characterAnalysis.characters.length,
                                      oluşturulmuşGörseller: imageCount,
                                      referansGörseller: referenceCount
                                    });
                                    
                                    // Clear all reference images from localStorage
                                    characterAnalysis.characters.forEach(character => {
                                      const storageKey = `character_reference_${character.name}`;
                                      try {
                                        localStorage.removeItem(storageKey);
                                      } catch (error) {
                                        console.warn(`⚠️ ${character.name} referans görselleri temizlenemedi:`, error);
                                      }
                                    });
                                    
                                    // Clear character data and approvals (includes generated images)
                                    setCharacterAnalysis({ ...characterAnalysis, characters: [] });
                                    setCharacterApprovals({});
                                    updatePhaseCompletion('character');
                                    
                                    console.log('✅ Tüm karakterler, görseller ve referanslar temizlendi');
                                  }
                                }}
                                className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm transition-colors border border-red-500/30"
                              >
                                🗑️ Tümünü Sil
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {/* Quick Stats */}
                        <div className="grid grid-cols-4 gap-3">
                          <div className="bg-cinema-gray/30 rounded p-2 text-center">
                            <div className="text-xl font-bold text-cinema-accent">{characterAnalysis.characters.length}</div>
                            <div className="text-xs text-cinema-text-dim">Toplam</div>
                          </div>
                          <div className="bg-cinema-gray/30 rounded p-2 text-center">
                            <div className="text-xl font-bold text-green-400">
                              {Object.values(characterApprovals).filter(a => a.approved).length}
                            </div>
                            <div className="text-xs text-cinema-text-dim">Onaylı</div>
                          </div>
                          <div className="bg-cinema-gray/30 rounded p-2 text-center">
                            <div className="text-xl font-bold text-blue-400">
                              {Object.values(characterApprovals).filter(a => a.image && !a.approved).length}
                            </div>
                            <div className="text-xs text-cinema-text-dim">Bekliyor</div>
                          </div>
                          <div className="bg-cinema-gray/30 rounded p-2 text-center">
                            <div className="text-xl font-bold text-yellow-400">
                              {characterAnalysis.characters.filter(c => !characterApprovals[c.name]?.image).length}
                            </div>
                            <div className="text-xs text-cinema-text-dim">Üretilmedi</div>
                          </div>
                        </div>
                      </div>

                      {/* Character Cards Grid - Football Card Style */}
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {characterAnalysis.characters.map((character, index) => {
                          const characterImage = characterApprovals[character.name]?.image;
                          const isApproved = characterApprovals[character.name]?.approved;
                          const hasImage = !!characterImage;
                          
                          return (
                            <div 
                              key={`character-card-${index}-${character.name || ''}`} 
                              className="relative group"
                            >
                              {/* Football-style Character Card */}
                              <div 
                                onClick={() => {
                                  if (hasImage) {
                                    // Görsel varsa aç
                                    const modal = document.createElement('div');
                                    modal.className = 'fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4';
                                    modal.onclick = () => modal.remove();
                                    modal.innerHTML = `
                                      <div class="relative max-w-4xl max-h-[90vh]">
                                        <button class="absolute -top-10 right-0 text-white hover:text-red-400 text-2xl" onclick="this.parentElement.parentElement.remove()">✕</button>
                                        <img src="${characterImage.url}" alt="${character.name}" class="max-w-full max-h-[90vh] object-contain rounded-lg" />
                                        <div class="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-4 rounded-b-lg">
                                          <div class="font-bold text-lg">${character.name}</div>
                                          ${character.role ? `<div class="text-sm text-gray-300">${character.role}</div>` : ''}
                                        </div>
                                      </div>
                                    `;
                                    document.body.appendChild(modal);
                                  }
                                }}
                                className={`
                                relative rounded-xl overflow-hidden
                                ${isApproved ? 'bg-gradient-to-br from-green-900/40 to-green-700/20' : 
                                  hasImage ? 'bg-gradient-to-br from-blue-900/40 to-blue-700/20' : 
                                  'bg-gradient-to-br from-gray-900/40 to-gray-700/20'}
                                border-2 transition-all duration-300
                                ${isApproved ? 'border-green-500/50' : 
                                  hasImage ? 'border-blue-500/50' : 
                                  'border-cinema-gray'}
                                hover:scale-105 hover:shadow-2xl hover:shadow-cinema-accent/20
                                ${hasImage ? 'cursor-pointer' : 'cursor-default'}
                              `}>
                                {/* Delete Button - Top Right */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm(`"${character.name}" karakterini silmek istediğinizden emin misiniz?${characterApprovals[character.name]?.image ? ' Üretilen görsel de silinecek.' : ''}`)) {
                                      // Remove character from list
                                      const updatedCharacters = characterAnalysis.characters.filter((_, i) => i !== index);
                                      setCharacterAnalysis({ ...characterAnalysis, characters: updatedCharacters });
                                      
                                      // Remove generated image from approvals
                                      const newApprovals = { ...characterApprovals };
                                      delete newApprovals[character.name];
                                      setCharacterApprovals(newApprovals);
                                      
                                      // Remove reference images from localStorage
                                      const storageKey = `character_reference_${character.name}`;
                                      try {
                                        localStorage.removeItem(storageKey);
                                        console.log(`🗑️ "${character.name}" karakteri, görseli ve referans görselleri silindi`);
                                      } catch (error) {
                                        console.warn('⚠️ localStorage temizleme hatası:', error);
                                        console.log(`🗑️ "${character.name}" ve görseli silindi`);
                                      }
                                    }
                                  }}
                                  className="absolute top-2 right-2 z-10 p-1.5 bg-red-500/80 hover:bg-red-600 rounded-full transition-all opacity-0 group-hover:opacity-100"
                                  title="Karakteri Sil"
                                >
                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                </button>

                                {/* Character Image */}
                                <div className="relative aspect-[3/4] bg-gradient-to-b from-cinema-gray/20 to-cinema-black/40">
                                  {hasImage ? (
                                    <>
                                      <img 
                                        src={characterImage.url} 
                                        alt={character.name}
                                        className="w-full h-full object-cover"
                                      />
                                      {/* Gradient Overlay for Text Readability */}
                                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                    </>
                                  ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-cinema-text-dim">
                                      <div className="text-5xl mb-2">🎭</div>
                                      <div className="text-xs">Görsel Yok</div>
                                    </div>
                                  )}

                                  {/* Character Info Overlay - Bottom */}
                                  <div className="absolute bottom-0 left-0 right-0 p-3">
                                    <h4 className="font-bold text-white text-sm mb-1 drop-shadow-lg line-clamp-1">
                                      {character.name || `Karakter ${index + 1}`}
                                    </h4>
                                    {character.role && (
                                      <p className="text-xs text-cinema-accent font-medium drop-shadow line-clamp-1">
                                        {character.role}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Progress Bar - Show when generating */}
                                {characterGeneratingProgress[character.name] !== undefined && (
                                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-cinema-black/60">
                                    <div 
                                      className="h-full bg-green-500 transition-all duration-300"
                                      style={{ width: `${characterGeneratingProgress[character.name]}%` }}
                                    />
                                  </div>
                                )}

                                {/* Card Footer - Action Buttons */}
                                <div className="p-2 bg-cinema-black/60 backdrop-blur-sm">
                                  {hasImage && !isApproved ? (
                                    <div className="flex gap-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          rejectCharacter(character.name);
                                        }}
                                        className="flex-1 bg-red-500/30 hover:bg-red-500/50 text-red-300 px-2 py-1 rounded text-xs transition-colors font-medium"
                                      >
                                        ✕
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          approveCharacter(character.name);
                                        }}
                                        className="flex-1 bg-green-500/30 hover:bg-green-500/50 text-green-300 px-2 py-1 rounded text-xs transition-colors font-medium"
                                      >
                                        ✓
                                      </button>
                                    </div>
                                  ) : isApproved ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Onayı kaldır
                                        setCharacterApprovals(prev => ({
                                          ...prev,
                                          [character.name]: {
                                            ...prev[character.name],
                                            approved: false
                                          }
                                        }));
                                        console.log(`🔄 "${character.name}" onayı kaldırıldı`);
                                      }}
                                      className="w-full bg-yellow-500/30 hover:bg-yellow-500/50 text-yellow-300 px-2 py-1 rounded text-xs transition-colors font-medium"
                                    >
                                      🔄 Onayı Kaldır
                                    </button>
                                  ) : (
                                    <div className="flex gap-1">
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          
                                          // Doğrudan görsel üret
                                          try {
                                            console.log(`🎨 "${character.name}" için görsel üretiliyor...`);
                                            
                                            // Initialize progress
                                            setCharacterGeneratingProgress(prev => ({ ...prev, [character.name]: 0 }));
                                            
                                            // Simulate progress steps
                                            const progressInterval = setInterval(() => {
                                              setCharacterGeneratingProgress(prev => {
                                                const current = prev[character.name] || 0;
                                                if (current < 90) {
                                                  return { ...prev, [character.name]: current + 10 };
                                                }
                                                return prev;
                                              });
                                            }, 300);
                                            
                                            // Generate prompt
                                            let characterPrompt = `Professional character portrait of ${character.name}`;
                                            
                                            if (character.physicalDescription || character.physical) {
                                              const physicalDesc = character.physicalDescription || character.physical;
                                              if (typeof physicalDesc === 'string' && physicalDesc.trim()) {
                                                characterPrompt += `, ${physicalDesc}`;
                                              }
                                            }
                                            
                                            if (character.age) characterPrompt += `, ${character.age} years old`;
                                            if (character.role) characterPrompt += `, ${character.role}`;
                                            characterPrompt += ', cinematic portrait, professional lighting, 4K quality';
                                            
                                            // Generate image
                                            const result = await generateImage(characterPrompt, {
                                              imageSize: '1K'
                                            });
                                            
                                            // Clear progress interval
                                            clearInterval(progressInterval);
                                            
                                            if (result?.success && result?.imageData) {
                                              // Complete progress
                                              setCharacterGeneratingProgress(prev => ({ ...prev, [character.name]: 100 }));
                                              
                                              const imageUrl = `data:${result.mimeType || 'image/jpeg'};base64,${result.imageData}`;
                                              const imageData = {
                                                url: imageUrl,
                                                prompt: characterPrompt,
                                                timestamp: new Date().toISOString(),
                                                model: result.model || 'unknown'
                                              };
                                              
                                              // Save and update
                                              await saveCharacterImageLocally(character.name, imageData);
                                              setCharacterApprovals(prev => ({
                                                ...prev,
                                                [character.name]: {
                                                  ...prev[character.name],
                                                  image: imageData,
                                                  approved: false
                                                }
                                              }));
                                              
                                              console.log(`✅ "${character.name}" görseli oluşturuldu`);
                                              
                                              // Clear progress after a short delay
                                              setTimeout(() => {
                                                setCharacterGeneratingProgress(prev => {
                                                  const { [character.name]: _, ...rest } = prev;
                                                  return rest;
                                                });
                                              }, 500);
                                            } else {
                                              console.error(`❌ "${character.name}" görseli oluşturulamadı`);
                                              alert(`Görsel üretilemedi. Lütfen AI ayarlarınızı kontrol edin.`);
                                              setCharacterGeneratingProgress(prev => {
                                                const { [character.name]: _, ...rest } = prev;
                                                return rest;
                                              });
                                            }
                                          } catch (error) {
                                            console.error(`❌ "${character.name}" için hata:`, error);
                                            alert(`Hata: ${error.message}`);
                                            setCharacterGeneratingProgress(prev => {
                                              const { [character.name]: _, ...rest } = prev;
                                              return rest;
                                            });
                                          }
                                        }}
                                        className="flex-1 bg-cinema-accent/30 hover:bg-cinema-accent/50 text-cinema-accent px-2 py-1 rounded text-xs transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="AI ile görsel üret"
                                        disabled={!!characterGeneratingProgress[character.name]}
                                      >
                                        {characterGeneratingProgress[character.name] ? '⏳' : '🎨'} Üret
                                      </button>
                                      <label className="flex-1 bg-blue-500/30 hover:bg-blue-500/50 text-blue-300 px-2 py-1 rounded text-xs transition-colors font-medium cursor-pointer text-center">
                                        📁 Yükle
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          onChange={(e) => {
                                            const file = e.target.files[0];
                                            if (file) {
                                              handleCharacterImageUpload(character.name, file);
                                            }
                                          }}
                                        />
                                      </label>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Details Button */}
                              <button
                                onClick={() => {
                                  setSelectedCharacterDetail(character);
                                  setIsCharacterDetailOpen(true);
                                }}
                                className="mt-2 w-full px-3 py-2 bg-cinema-gray/20 rounded cursor-pointer hover:bg-cinema-gray/40 transition-colors text-xs text-cinema-text-dim text-center"
                              >
                                📝 Detaylar & Görsel Üretimi
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Bulk Generation Button */}
                      {characterAnalysis.characters.some(char => !characterApprovals[char.name]?.image) && (
                        <div className="flex justify-center pt-4 pb-6 border-t border-cinema-gray">
                          <button
                            onClick={async () => {
                              setIsProcessing(true);
                              try {
                                const charactersToGenerate = characterAnalysis.characters.filter(
                                  char => !characterApprovals[char.name]?.image
                                );
                                
                                console.log(`🎨 Toplu görsel üretimi başlıyor: ${charactersToGenerate.length} karakter`);
                                
                                for (let i = 0; i < charactersToGenerate.length; i++) {
                                  const character = charactersToGenerate[i];
                                  console.log(`🎨 ${i + 1}/${charactersToGenerate.length}: ${character.name} üretiliyor...`);
                                  
                                  // Generate prompt for character
                                  let characterPrompt = `Professional character portrait of ${character.name}`;
                                  
                                  if (character.physicalDescription || character.physical) {
                                    const physicalDesc = character.physicalDescription || character.physical;
                                    if (typeof physicalDesc === 'string' && physicalDesc.trim()) {
                                      characterPrompt += `, ${physicalDesc}`;
                                    }
                                  }
                                  
                                  if (character.age) characterPrompt += `, ${character.age} years old`;
                                  if (character.role || character.occupation) {
                                    characterPrompt += `, ${character.role || character.occupation}`;
                                  }
                                  
                                  characterPrompt += ', cinematic portrait, professional lighting, 4K quality, detailed facial features';
                                  
                                  // Generate image
                                  const imageOptions = {
                                    character: character.name,
                                    style: 'cinematic portrait',
                                    imageSize: '2K'
                                  };
                                  
                                  const result = await generateImage(characterPrompt.trim(), imageOptions);
                                  
                                  if (result && result.imageData) {
                                    const imageUrl = `data:${result.mimeType || 'image/png'};base64,${result.imageData}`;
                                    const imageData = {
                                      url: imageUrl,
                                      prompt: characterPrompt,
                                      character: character.name,
                                      timestamp: new Date().toISOString()
                                    };
                                    
                                    // Update character approvals
                                    handleCharacterImageGenerated(character.name, imageData);
                                    console.log(`✅ ${character.name} görseli üretildi`);
                                  }
                                  
                                  // Rate limiting: 2 saniye bekle
                                  if (i < charactersToGenerate.length - 1) {
                                    await new Promise(resolve => setTimeout(resolve, 2000));
                                  }
                                }
                                
                                alert(`✅ ${charactersToGenerate.length} karakter görseli üretildi!`);
                              } catch (error) {
                                console.error('❌ Toplu üretim hatası:', error);
                                alert('Toplu üretim sırasında hata oluştu: ' + error.message);
                              } finally {
                                setIsProcessing(false);
                              }
                            }}
                            disabled={isProcessing}
                            className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 px-6 py-3 rounded-lg font-medium transition-colors border border-purple-500/30 disabled:opacity-50"
                          >
                            {isProcessing ? '🔄 Üretiliyor...' : '🎨 Tüm Karakterleri Toplu Üret'}
                          </button>
                        </div>
                      )}

                      {/* Phase Status Summary */}
                      <div className="pt-6 border-t border-cinema-gray">
                        <div className="text-center text-sm text-cinema-text-dim">
                          {phaseCompletion.character.complete ? (
                            <span className="text-green-400 font-medium">✓ Tüm karakterler onaylandı - Alt menüden Mekanlar fazına geçebilirsiniz</span>
                          ) : (
                            <span>{phaseCompletion.character.approved}/{phaseCompletion.character.total} karakter onaylandı</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PHASE 2: LOCATION VISUALIZATION */}
              {currentPhase === 'location' && (
                <div>
                  <div className="flex items-center justify-between gap-3 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-cinema-accent rounded-lg flex items-center justify-center text-3xl">
                        🏞️
                      </div>
                      <div>
                        <h2 className="text-2xl font-semibold text-white">Mekanlar ve Sahneler</h2>
                        <p className="text-cinema-text-dim text-sm">
                          {phaseCompletion.location.total > 0 
                            ? `${phaseCompletion.location.approved}/${phaseCompletion.location.total} mekan onaylandı`
                            : 'Mekanlar ve sahneler yükleniyor...'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPhase('character')}
                        className="bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 px-4 py-2 rounded-lg text-sm transition-colors border border-gray-500/30"
                        title="Karakterleri düzenlemek için geri dön"
                      >
                        ← Karakterlere Dön
                      </button>
                      {phaseCompletion.location.total > 0 && (
                        <button
                          onClick={() => skipPhase('location')}
                          className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 px-4 py-2 rounded-lg text-sm transition-colors border border-yellow-500/30"
                        >
                          ⏭️ Bu Fazı Atla
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Scene List - Above Location Management */}
                  {extractedScenes && extractedScenes.length > 0 && (
                    <div className="mb-6 bg-cinema-black/50 rounded-lg border border-purple-500/30 p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-purple-400 mb-1 flex items-center gap-2">
                            🎬 Sahne Listesi ({extractedScenes.length})
                          </h3>
                          <p className="text-sm text-cinema-text-dim">
                            {(() => {
                              const approved = Object.values(sceneApprovals).filter(s => s?.approved).length;
                              const total = extractedScenes.length;
                              return approved > 0 
                                ? `${approved}/${total} sahne onaylandı` 
                                : 'Sahneleri onaylayarak storyboard üretimine hazırlanın';
                            })()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {(() => {
                            const allApproved = extractedScenes.every(scene => {
                              const sceneNum = scene.number || scene.sceneNumber;
                              return sceneApprovals[sceneNum]?.approved;
                            });
                            
                            return (
                              <button
                                onClick={() => {
                                  if (allApproved) {
                                    // Tümünü reddet
                                    setSceneApprovals({});
                                    updatePhaseCompletion('scene');
                                  } else {
                                    // Tümünü onayla
                                    approveAllScenes();
                                  }
                                }}
                                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                                  allApproved
                                    ? 'bg-red-600 hover:bg-red-700 text-white'
                                    : 'bg-green-600 hover:bg-green-700 text-white'
                                }`}
                              >
                                {allApproved ? '❌ Tümünü Reddet' : '✅ Tümünü Onayla'}
                              </button>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Scene Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-cinema-gray/20 border-b border-cinema-gray sticky top-0">
                            <tr>
                              <th className="px-4 py-3 text-center text-xs font-semibold text-cinema-text-dim uppercase tracking-wider w-12">
                                ✓
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-cinema-text-dim uppercase tracking-wider w-16">#</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-cinema-text-dim uppercase tracking-wider">Sahne Adı</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-cinema-text-dim uppercase tracking-wider">Karakterler</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-cinema-text-dim uppercase tracking-wider">Mekanlar</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-cinema-text-dim uppercase tracking-wider w-24">Süre</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-cinema-gray/30">
                            {extractedScenes.map((scene, index) => {
                              const sceneLocations = scene.locations || [];
                              const sceneCharacters = scene.characters || [];
                              const sceneNum = scene.number || scene.sceneNumber || index + 1;
                              const isApproved = sceneApprovals[sceneNum]?.approved;
                              
                              return (
                                <tr 
                                  key={index} 
                                  className={`hover:bg-cinema-gray/10 transition-colors ${
                                    isApproved ? 'bg-green-900/10' : ''
                                  }`}
                                >
                                  {/* Approval Checkbox */}
                                  <td className="px-4 py-3 text-center">
                                    <button
                                      onClick={() => {
                                        if (isApproved) {
                                          rejectScene(sceneNum);
                                        } else {
                                          approveScene(sceneNum);
                                        }
                                      }}
                                      className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                                        isApproved
                                          ? 'bg-green-600 border-green-600'
                                          : 'border-cinema-gray hover:border-purple-500'
                                      }`}
                                      title={isApproved ? 'Onayı kaldır' : 'Sahneyi onayla'}
                                    >
                                      {isApproved && (
                                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                    </button>
                                  </td>
                                  
                                  {/* Scene Number */}
                                  <td className="px-4 py-3 text-sm text-cinema-text-dim font-mono">
                                    {sceneNum}
                                  </td>
                                  
                                  {/* Scene Title */}
                                  <td className="px-4 py-3">
                                    <div className="text-sm font-semibold text-cinema-text">
                                      {scene.title || `Sahne ${scene.number || index + 1}`}
                                    </div>
                                    {scene.description && (
                                      <div className="text-xs text-cinema-text-dim mt-1 line-clamp-2">
                                        {scene.description}
                                      </div>
                                    )}
                                  </td>
                                  
                                  {/* Characters */}
                                  <td className="px-4 py-3">
                                    {sceneCharacters.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {sceneCharacters.slice(0, 3).map((charName, idx) => (
                                          <span 
                                            key={`char-${index}-${idx}-${charName}`} 
                                            className="text-xs bg-cinema-accent/20 text-cinema-accent px-2 py-0.5 rounded font-medium"
                                          >
                                            🎭 {charName}
                                          </span>
                                        ))}
                                        {sceneCharacters.length > 3 && (
                                          <span className="text-xs text-cinema-accent font-bold">
                                            +{sceneCharacters.length - 3}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-cinema-text-dim">—</span>
                                    )}
                                  </td>
                                  
                                  {/* Locations */}
                                  <td className="px-4 py-3">
                                    {sceneLocations.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {sceneLocations.slice(0, 2).map((loc, idx) => {
                                          const locName = typeof loc === 'string' ? loc : (loc.name || loc);
                                          return (
                                            <span 
                                              key={`loc-${index}-${idx}-${locName}`} 
                                              className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-medium"
                                            >
                                              🏛️ {locName}
                                            </span>
                                          );
                                        })}
                                        {sceneLocations.length > 2 && (
                                          <span className="text-xs text-blue-400 font-bold">
                                            +{sceneLocations.length - 2}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-cinema-text-dim">—</span>
                                    )}
                                  </td>
                                  
                                  {/* Duration */}
                                  <td className="px-4 py-3">
                                    <span className="text-sm text-cinema-text">
                                      {scene.duration || '—'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Location Management - Card Grid View */}
                  {(() => {
                    console.log('🎨 [UI RENDER] Location Phase UI rendering...');
                    console.log('🎨 locationAnalysis:', locationAnalysis);
                    console.log('🎨 locationAnalysis?.locations:', locationAnalysis?.locations);
                    console.log('🎨 Array length:', locationAnalysis?.locations?.length);
                    console.log('🎨 Condition result:', locationAnalysis?.locations && locationAnalysis.locations.length > 0);
                    return null;
                  })()}
                  {locationAnalysis?.locations && locationAnalysis.locations.length > 0 && (
                    <div className="space-y-6">
                      {/* Location Management Header */}
                      <div className="bg-cinema-black/50 rounded-lg border border-cinema-gray p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h3 className="text-lg font-semibold text-cinema-accent mb-1">
                              🏛️ Mekan Yönetimi ({locationAnalysis.locations.length})
                            </h3>
                            <p className="text-sm text-cinema-text-dim">
                              Excel tarzı tablo ile mekanları filtreleyin ve yönetin
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const newLocation = {
                                  name: `Yeni Mekan ${locationAnalysis.locations.length + 1}`,
                                  type: 'INTERIOR',
                                  description: 'Mekan açıklaması buraya eklenecek',
                                  atmosphere: '',
                                  lighting: '',
                                  timeOfDay: 'DAY',
                                  characters: [],
                                  sceneCount: 0
                                };
                                
                                setLocationAnalysis({
                                  ...locationAnalysis,
                                  locations: [...locationAnalysis.locations, newLocation]
                                });
                                console.log('➕ Yeni mekan eklendi:', newLocation.name);
                              }}
                              className="bg-green-500/20 hover:bg-green-500/30 text-green-400 px-4 py-2 rounded-lg text-sm transition-colors border border-green-500/30"
                            >
                              ➕ Yeni Mekan
                            </button>
                            {locationAnalysis.locations.length > 0 && (
                              <button
                                onClick={() => {
                                  const imageCount = Object.values(locationApprovals).filter(a => a.image).length;
                                  const message = imageCount > 0 
                                    ? `⚠️ Tüm mekanları (${locationAnalysis.locations.length}) ve ${imageCount} görseli silmek istediğinizden emin misiniz?`
                                    : `⚠️ Tüm mekanları (${locationAnalysis.locations.length}) silmek istediğinizden emin misiniz?`;
                                  
                                  if (window.confirm(message)) {
                                    // Clear all reference images from localStorage
                                    let referenceCount = 0;
                                    locationAnalysis.locations.forEach(location => {
                                      const locName = typeof location === 'string' ? location : location.name;
                                      const storageKey = `location_reference_${locName}`;
                                      try {
                                        if (localStorage.getItem(storageKey)) {
                                          localStorage.removeItem(storageKey);
                                          referenceCount++;
                                        }
                                      } catch (error) {
                                        console.warn(`⚠️ ${locName} referans görselleri temizlenemedi:`, error);
                                      }
                                    });
                                    
                                    // Clear location data and approvals
                                    setLocationAnalysis({ ...locationAnalysis, locations: [] });
                                    setLocationApprovals({});
                                    
                                    console.log(`🗑️ Tüm mekanlar${imageCount > 0 ? ' ve görselleri' : ''} silindi${referenceCount > 0 ? ` (${referenceCount} mekan referans görseli temizlendi)` : ''}`);
                                  }
                                }}
                                className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm transition-colors border border-red-500/30"
                              >
                                🗑️ Tümünü Sil
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {/* Quick Stats */}
                        <div className="grid grid-cols-4 gap-3 mb-4">
                          <div className="bg-cinema-gray/30 rounded p-2 text-center">
                            <div className="text-xl font-bold text-cinema-accent">{locationAnalysis.locations.length}</div>
                            <div className="text-xs text-cinema-text-dim">Toplam</div>
                          </div>
                          <div className="bg-cinema-gray/30 rounded p-2 text-center">
                            <div className="text-xl font-bold text-green-400">
                              {Object.values(locationApprovals).filter(a => a.approved).length}
                            </div>
                            <div className="text-xs text-cinema-text-dim">Onaylı</div>
                          </div>
                          <div className="bg-cinema-gray/30 rounded p-2 text-center">
                            <div className="text-xl font-bold text-blue-400">
                              {Object.values(locationApprovals).filter(a => a.image && !a.approved).length}
                            </div>
                            <div className="text-xs text-cinema-text-dim">Bekliyor</div>
                          </div>
                          <div className="bg-cinema-gray/30 rounded p-2 text-center">
                            <div className="text-xl font-bold text-yellow-400">
                              {locationAnalysis.locations.filter(l => {
                                const locName = typeof l === 'string' ? l : (l.name || l);
                                return !locationApprovals[locName]?.image;
                              }).length}
                            </div>
                            <div className="text-xs text-cinema-text-dim">Üretilmedi</div>
                          </div>
                        </div>

                      </div>

                      {/* Location Table View */}
                      <LocationTableView
                        locations={locationAnalysis.locations}
                        locationApprovals={locationApprovals}
                        extractedScenes={extractedScenes}
                        characterApprovals={characterApprovals}
                        onLocationDelete={deleteLocation}
                        onLocationApprove={approveLocation}
                        onLocationReject={rejectLocation}
                        onImageGenerated={handleLocationImageGenerated}
                        onImageUpload={handleLocationImageUpload}
                        onLocationDetailClick={(location) => {
                          setSelectedLocationDetail(location);
                          setIsLocationDetailOpen(true);
                        }}
                      />

                      {/* OLD: Location Cards Grid - Replaced with LocationTableView above */}
                      {false && <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {locationAnalysis.locations.map((location, index) => {
                          const locName = typeof location === 'string' ? location : (location.name || location);
                          const locType = typeof location === 'object' ? location.type : null;
                          const locDescription = typeof location === 'object' ? location.description : null;
                          
                          // Find characters that appear in scenes with this location
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
                          
                          // Get approved character images for this location
                          const locationCharacterRefs = Array.from(charactersInLocation)
                            .filter(charName => characterApprovals[charName]?.approved && characterApprovals[charName]?.image)
                            .map(charName => ({
                              name: charName,
                              image: characterApprovals[charName].image
                            }));
                          
                          const locationImage = locationApprovals[locName]?.image;
                          const isApproved = locationApprovals[locName]?.approved;
                          const hasImage = !!locationImage;
                          
                          return (
                            <div 
                              key={`${locName}-${index}`} 
                              className="relative group"
                            >
                              {/* Location Card - Cinema Style */}
                              <div 
                                onClick={() => {
                                  if (hasImage) {
                                    // Görsel varsa aç
                                    const modal = document.createElement('div');
                                    modal.className = 'fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4';
                                    modal.onclick = () => modal.remove();
                                    modal.innerHTML = `
                                      <div class="relative max-w-4xl max-h-[90vh]">
                                        <button class="absolute -top-10 right-0 text-white hover:text-red-400 text-2xl" onclick="this.parentElement.parentElement.remove()">✕</button>
                                        <img src="${locationImage.url}" alt="${locName}" class="max-w-full max-h-[90vh] object-contain rounded-lg" />
                                        <div class="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-4 rounded-b-lg">
                                          <div class="font-bold text-lg">${locName}</div>
                                          ${locType ? `<div class="text-sm text-gray-300">${locType === 'INTERIOR' ? 'İç Mekan' : 'Dış Mekan'}</div>` : ''}
                                        </div>
                                      </div>
                                    `;
                                    document.body.appendChild(modal);
                                  }
                                }}
                                className={`
                                relative rounded-xl overflow-hidden
                                ${isApproved ? 'bg-gradient-to-br from-green-900/40 to-green-700/20' : 
                                  hasImage ? 'bg-gradient-to-br from-purple-900/40 to-purple-700/20' : 
                                  'bg-gradient-to-br from-gray-900/40 to-gray-700/20'}
                                border-2 transition-all duration-300
                                ${isApproved ? 'border-green-500/50' : 
                                  hasImage ? 'border-purple-500/50' : 
                                  'border-cinema-gray'}
                                hover:scale-105 hover:shadow-2xl hover:shadow-cinema-accent/20
                                ${hasImage ? 'cursor-pointer' : 'cursor-default'}
                              `}>
                                {/* Delete Button - Top Right */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm(`"${locName}" mekanını silmek istediğinizden emin misiniz?${locationApprovals[locName]?.image ? ' Üretilen görsel de silinecek.' : ''}`)) {
                                      // Remove location from list
                                      const updatedLocations = locationAnalysis.locations.filter((_, i) => i !== index);
                                      setLocationAnalysis({ ...locationAnalysis, locations: updatedLocations });
                                      
                                      // Remove generated image from approvals
                                      const newApprovals = { ...locationApprovals };
                                      delete newApprovals[locName];
                                      setLocationApprovals(newApprovals);
                                      
                                      // Remove reference images from localStorage
                                      const storageKey = `location_reference_${locName}`;
                                      try {
                                        localStorage.removeItem(storageKey);
                                        console.log(`🗑️ "${locName}" mekanı, görseli ve referans görselleri silindi`);
                                      } catch (error) {
                                        console.warn('⚠️ localStorage temizleme hatası:', error);
                                        console.log(`🗑️ "${locName}" ve görseli silindi`);
                                      }
                                    }
                                  }}
                                  className="absolute top-2 right-2 z-10 p-1.5 bg-red-500/80 hover:bg-red-600 rounded-full transition-all opacity-0 group-hover:opacity-100"
                                  title="Mekanı Sil"
                                >
                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                </button>

                                {/* Location Image */}
                                <div className="relative aspect-[4/3] bg-gradient-to-b from-cinema-gray/20 to-cinema-black/40">
                                  {hasImage ? (
                                    <>
                                      <img 
                                        src={locationImage.url} 
                                        alt={locName}
                                        className="w-full h-full object-cover"
                                      />
                                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                    </>
                                  ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-cinema-text-dim">
                                      <div className="text-5xl mb-2">
                                        {locType === 'INTERIOR' ? '🏠' : locType === 'EXTERIOR' ? '🌍' : '📍'}
                                      </div>
                                      <div className="text-xs">Görsel Yok</div>
                                    </div>
                                  )}

                                  {/* Type Badge - Top Center */}
                                  {locType && (
                                    <div className="absolute top-2 left-1/2 -translate-x-1/2">
                                      <span className="text-xs bg-cinema-black/80 text-cinema-accent px-2 py-1 rounded-full font-medium shadow-lg backdrop-blur-sm">
                                        {locType === 'INTERIOR' ? 'İç Mekan' : 'Dış Mekan'}
                                      </span>
                                    </div>
                                  )}

                                  {/* Location Info Overlay - Bottom */}
                                  <div className="absolute bottom-0 left-0 right-0 p-3">
                                    <h4 className="font-bold text-white text-sm mb-1 drop-shadow-lg line-clamp-1">
                                      {locName}
                                    </h4>
                                    {locDescription && (
                                      <p className="text-xs text-cinema-text-dim drop-shadow line-clamp-2">
                                        {locDescription}
                                      </p>
                                    )}
                                    {locationCharacterRefs.length > 0 && (
                                      <div className="flex items-center gap-1 mt-1">
                                        <span className="text-xs text-blue-300">👥</span>
                                        <span className="text-xs text-blue-300 font-medium">
                                          {locationCharacterRefs.length} karakter
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Card Footer - Action Buttons */}
                                <div className="p-2 bg-cinema-black/60 backdrop-blur-sm">
                                  {hasImage && !isApproved ? (
                                    <div className="flex gap-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          rejectLocation(locName);
                                        }}
                                        className="flex-1 bg-red-500/30 hover:bg-red-500/50 text-red-300 px-2 py-1 rounded text-xs transition-colors font-medium"
                                      >
                                        ✕
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          approveLocation(locName);
                                        }}
                                        className="flex-1 bg-green-500/30 hover:bg-green-500/50 text-green-300 px-2 py-1 rounded text-xs transition-colors font-medium"
                                      >
                                        ✓
                                      </button>
                                    </div>
                                  ) : isApproved ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Onayı kaldır
                                        setLocationApprovals(prev => ({
                                          ...prev,
                                          [locName]: {
                                            ...prev[locName],
                                            approved: false
                                          }
                                        }));
                                        console.log(`🔄 "${locName}" onayı kaldırıldı`);
                                      }}
                                      className="w-full bg-yellow-500/30 hover:bg-yellow-500/50 text-yellow-300 px-2 py-1 rounded text-xs transition-colors font-medium"
                                    >
                                      🔄 Onayı Kaldır
                                    </button>
                                  ) : (
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        
                                        // Doğrudan görsel üret
                                        try {
                                          console.log(`🏞️ "${locName}" için görsel üretiliyor...`);
                                          
                                          // Generate prompt
                                          let locationPrompt = `Professional cinematic location photography of ${locName}`;
                                          
                                          if (locType === 'INTERIOR') {
                                            locationPrompt += ', interior scene';
                                          } else if (locType === 'EXTERIOR') {
                                            locationPrompt += ', exterior scene';
                                          }
                                          
                                          if (locDescription) {
                                            locationPrompt += `, ${locDescription}`;
                                          }
                                          
                                          locationPrompt += ', cinematic lighting, atmospheric, high quality, professional photography';
                                          
                                          // Generate image
                                          const result = await generateImage(locationPrompt, {
                                            imageSize: '1K'
                                          });
                                          
                                          if (result?.success && result?.imageData) {
                                            const imageUrl = `data:${result.mimeType || 'image/jpeg'};base64,${result.imageData}`;
                                            const imageData = {
                                              url: imageUrl,
                                              prompt: locationPrompt,
                                              timestamp: new Date().toISOString(),
                                              model: result.model || 'unknown'
                                            };
                                            
                                            // Save and update
                                            await handleLocationImageGenerated(locName, imageData);
                                            console.log(`✅ "${locName}" görseli oluşturuldu`);
                                          } else {
                                            console.error(`❌ "${locName}" görseli oluşturulamadı`);
                                            alert(`Görsel üretilemedi. Lütfen AI ayarlarınızı kontrol edin.`);
                                          }
                                        } catch (error) {
                                          console.error(`❌ "${locName}" için hata:`, error);
                                          alert(`Hata: ${error.message}`);
                                        }
                                      }}
                                      className="w-full bg-cinema-accent/30 hover:bg-cinema-accent/50 text-cinema-accent px-2 py-1 rounded text-xs transition-colors font-medium"
                                    >
                                      🏞️ Görsel Üret
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Expandable Details */}
                              <details className="mt-2">
                                <summary className="px-3 py-2 bg-cinema-gray/20 rounded cursor-pointer hover:bg-cinema-gray/40 transition-colors text-xs text-cinema-text-dim text-center">
                                  📝 Detaylar & Görsel Üretimi
                                </summary>
                                <div className="mt-2 p-3 bg-cinema-black/50 rounded-lg border border-cinema-gray">
                                  {/* Location Info */}
                                  {locDescription && (
                                    <div className="mb-3 text-xs">
                                      <span className="text-cinema-accent font-semibold block mb-1">Açıklama:</span>
                                      <p className="text-cinema-text-dim">{locDescription}</p>
                                    </div>
                                  )}
                                  
                                  {/* Characters in this location */}
                                  {locationCharacterRefs.length > 0 && (
                                    <div className="mb-3">
                                      <span className="text-cinema-accent text-xs font-semibold block mb-2">Bu mekanda geçenler:</span>
                                      <div className="flex flex-wrap gap-1">
                                        {locationCharacterRefs.map((charRef, charIdx) => (
                                          <span key={`loc-char-${charIdx}-${charRef.name}`} className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                                            👤 {charRef.name}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Image Generator */}
                                  <LocationImageGenerator
                                    location={typeof location === 'string' ? { name: location } : location}
                                    onImageGenerated={(name, imageData) => handleLocationImageGenerated(name, imageData)}
                                    characterReferences={locationCharacterRefs}
                                  />
                                </div>
                              </details>
                            </div>
                          );
                        })}
                      </div>}
                      {/* END OLD Location Cards Grid */}

                      {/* Phase Status Summary */}
                      <div className="pt-6 border-t border-cinema-gray">
                        <div className="text-center text-sm text-cinema-text-dim">
                          {phaseCompletion.location.complete ? (
                            <span className="text-green-400 font-medium">✓ Tüm mekanlar onaylandı - Alt menüden Storyboard fazına geçebilirsiniz</span>
                          ) : (
                            <span>{phaseCompletion.location.approved}/{phaseCompletion.location.total} mekan onaylandı</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PHASE 3: STORYBOARD GENERATION */}
              {currentPhase === 'storyboard' && (
                <div>
                  <div className="flex items-center justify-between gap-3 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-cinema-accent rounded-lg flex items-center justify-center text-3xl">
                        🎬
                      </div>
                      <div>
                        <h2 className="text-2xl font-semibold text-white">Profesyonel Storyboard Üretimi</h2>
                        <p className="text-cinema-text-dim text-sm">
                          Onaylanmış karakterler ve mekanlarla profesyonel storyboard çerçeveleri oluştur
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPhase('character')}
                        className="bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 px-3 py-2 rounded-lg text-sm transition-colors border border-gray-500/30"
                        title="Karakterleri düzenlemek için"
                      >
                        🎭 Karakterler
                      </button>
                      <button
                        onClick={() => setCurrentPhase('location')}
                        className="bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 px-3 py-2 rounded-lg text-sm transition-colors border border-gray-500/30"
                        title="Mekanları düzenlemek için"
                      >
                        🏞️ Mekanlar
                      </button>
                    </div>
                  </div>

                  {storyboardFrames.length === 0 && !isStoryboardProcessing ? (
                    <div className="max-w-3xl mx-auto">
                      {/* Stats */}
                      <div className="mb-8 grid grid-cols-3 gap-4 text-center">
                        <div className="bg-cinema-gray/50 rounded-lg p-4">
                          <div className="text-sm text-cinema-text-dim mb-1">Karakterler</div>
                          <div className="text-2xl font-bold text-green-400">
                            {Object.keys(characterApprovals).filter(k => characterApprovals[k].approved).length}
                          </div>
                          <div className="text-xs text-cinema-text-dim">onaylandı</div>
                        </div>
                        <div className="bg-cinema-gray/50 rounded-lg p-4">
                          <div className="text-sm text-cinema-text-dim mb-1">Mekanlar</div>
                          <div className="text-2xl font-bold text-green-400">
                            {phaseCompletion.location.approved}
                          </div>
                          <div className="text-xs text-cinema-text-dim">onaylandı</div>
                        </div>
                        <div className="bg-cinema-gray/50 rounded-lg p-4">
                          <div className="text-sm text-cinema-text-dim mb-1">Sahneler</div>
                          <div className="text-2xl font-bold text-blue-400">
                            {extractedScenes.length}
                          </div>
                          <div className="text-xs text-cinema-text-dim">tespit edildi</div>
                        </div>
                      </div>

                      {/* Style Selection */}
                      <div className="mb-8 bg-cinema-gray/30 rounded-xl p-6 border border-cinema-gray">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                          🎨 Storyboard Stili
                        </h3>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <button
                            onClick={() => setStoryboardStyle('sketch')}
                            className={`p-4 rounded-lg border-2 transition-all ${
                              storyboardStyle === 'sketch'
                                ? 'border-cinema-accent bg-cinema-accent/10'
                                : 'border-cinema-gray bg-cinema-gray/30 hover:border-cinema-gray-light'
                            }`}
                          >
                            <div className="text-4xl mb-2">✏️</div>
                            <div className="font-semibold text-white mb-1">Çizim / Sketch</div>
                            <div className="text-xs text-cinema-text-dim">
                              Geleneksel storyboard çizimi, siyah-beyaz karakalem tarzı
                            </div>
                          </button>
                          <button
                            onClick={() => setStoryboardStyle('realistic')}
                            className={`p-4 rounded-lg border-2 transition-all ${
                              storyboardStyle === 'realistic'
                                ? 'border-cinema-accent bg-cinema-accent/10'
                                : 'border-cinema-gray bg-cinema-gray/30 hover:border-cinema-gray-light'
                            }`}
                          >
                            <div className="text-4xl mb-2">📸</div>
                            <div className="font-semibold text-white mb-1">Gerçekçi / Fotorealist</div>
                            <div className="text-xs text-cinema-text-dim">
                              Sinematik gerçekçi görüntü, renkli film frame görünümü
                            </div>
                          </button>
                        </div>

                        <div className="text-xs text-cinema-text-dim mt-2">
                          ✅ Onaylı karakter ve mekan görselleri otomatik olarak referans alınacak
                        </div>
                      </div>

                      {/* Generate Button */}
                      <div className="text-center">
                        <button
                          onClick={() => executeStep(2)}
                          disabled={isProcessing || isStoryboardProcessing || extractedScenes.length === 0 || !isConfigured()}
                          className="bg-cinema-accent hover:bg-cinema-accent/90 text-cinema-black px-8 py-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg transition-all transform hover:scale-105 shadow-lg"
                        >
                          {isProcessing || isStoryboardProcessing ? '🔄 Üretiliyor...' : '🎬 Profesyonel Storyboard Üret'}
                        </button>
                        <p className="mt-4 text-cinema-text-dim text-sm">
                          {storyboardStyle === 'sketch' ? '✏️ Çizim stili' : '📸 Gerçekçi stil'} • {extractedScenes.length} sahne
                          {` • ${Object.keys(characterApprovals).filter(k => characterApprovals[k].approved).length} karakter ref.`}
                          {` • ${Object.keys(locationApprovals).filter(k => locationApprovals[k].approved).length} mekan ref.`}
                        </p>
                      </div>
                    </div>
                  ) : storyboardFrames.length > 0 ? (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-cinema-accent">
                          ✅ {storyboardFrames.length} Storyboard Çerçevesi Üretildi
                        </h3>
                        {storyboardFrames.length > 0 && (
                          <button
                            onClick={() => {
                              if (confirm(`${storyboardFrames.length} adet storyboard çerçevesini silmek istediğinizden emin misiniz?`)) {
                                setStoryboardFrames([]);
                                setFinalStoryboard({});
                                console.log('🗑️ Tüm storyboard çerçeveleri silindi');
                              }
                            }}
                            className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm transition-colors border border-red-500/30"
                          >
                            🗑️ Tümünü Sil
                          </button>
                        )}
                      </div>

                      {/* Style Settings - Always Visible */}
                      <div className="bg-cinema-gray/30 rounded-xl p-6 border border-cinema-gray">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                          🎨 Storyboard Stili
                        </h3>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <button
                            onClick={() => setStoryboardStyle('sketch')}
                            className={`p-4 rounded-lg border-2 transition-all ${
                              storyboardStyle === 'sketch'
                                ? 'border-cinema-accent bg-cinema-accent/10'
                                : 'border-cinema-gray bg-cinema-gray/30 hover:border-cinema-gray-light'
                            }`}
                          >
                            <div className="text-4xl mb-2">✏️</div>
                            <div className="font-semibold text-white mb-1">Çizim / Sketch</div>
                            <div className="text-xs text-cinema-text-dim">
                              Geleneksel storyboard çizimi, siyah-beyaz karakalem tarzı
                            </div>
                          </button>
                          <button
                            onClick={() => setStoryboardStyle('realistic')}
                            className={`p-4 rounded-lg border-2 transition-all ${
                              storyboardStyle === 'realistic'
                                ? 'border-cinema-accent bg-cinema-accent/10'
                                : 'border-cinema-gray bg-cinema-gray/30 hover:border-cinema-gray-light'
                            }`}
                          >
                            <div className="text-4xl mb-2">📸</div>
                            <div className="font-semibold text-white mb-1">Gerçekçi / Fotorealist</div>
                            <div className="text-xs text-cinema-text-dim">
                              Sinematik gerçekçi görüntü, renkli film frame görünümü
                            </div>
                          </button>
                        </div>

                        <div className="text-xs text-cinema-text-dim mt-2">
                          ✅ Onaylı karakter ve mekan görselleri otomatik olarak referans alınacak
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {storyboardFrames.map((frame, index) => (
                          <div key={index} className="border border-cinema-gray rounded-lg p-4 bg-cinema-black/30 hover:border-cinema-accent transition-colors">
                            <div className="mb-2">
                              <h4 className="font-semibold text-cinema-accent">Çerçeve {frame.frameNumber}</h4>
                              <p className="text-xs text-cinema-text-dim">{frame.title}</p>
                            </div>
                            {frame.storyboardImage && (
                              <img
                                src={frame.storyboardImage}
                                alt={`Storyboard ${frame.frameNumber}`}
                                className="w-full h-40 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => {
                                  setSelectedFrameDetail({ frame, index, scene: extractedScenes[index] });
                                  setFrameRegenerateSettings({
                                    useReference: true,
                                    customPrompt: '',
                                    style: storyboardStyle
                                  });
                                  setIsFrameDetailOpen(true);
                                }}
                              />
                            )}
                            
                            {/* Action Buttons */}
                            <div className="mt-2 flex gap-2">
                              <button
                                onClick={() => {
                                  setSelectedFrameDetail({ frame, index, scene: extractedScenes[index] });
                                  setFrameRegenerateSettings({
                                    useReference: true,
                                    customPrompt: '',
                                    style: storyboardStyle
                                  });
                                  setIsFrameDetailOpen(true);
                                }}
                                className="flex-1 px-3 py-2 bg-cinema-gray/20 hover:bg-cinema-gray/40 text-cinema-text rounded text-xs transition-colors"
                              >
                                📝 Detaylar
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Çerçeve ${frame.frameNumber} - "${frame.title}" silmek istediğinizden emin misiniz?`)) {
                                    const newFrames = storyboardFrames.filter((_, i) => i !== index);
                                    setStoryboardFrames(newFrames);
                                    console.log(`🗑️ Çerçeve ${frame.frameNumber} silindi`);
                                  }
                                }}
                                className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-xs transition-colors border border-red-500/30"
                                title="Bu çerçeveyi sil"
                              >
                                🗑️
                              </button>
                            </div>
                            
                            {/* Quick Regenerate Button */}
                            <button
                              onClick={async () => {
                                const scene = extractedScenes[index];
                                if (!scene) return;
                                
                                setIsStoryboardProcessing(true);
                                try {
                                  // Regenerate this specific scene with proper style
                                  const styleDesc = storyboardStyle === 'sketch'
                                    ? `STYLE: Traditional storyboard sketch/drawing style
- Hand-drawn pencil sketch aesthetic
- Black and white line art
- Clean, professional illustration
- Traditional animation/comic book style drawing`
                                    : `STYLE: Cinematic realistic/photorealistic frame
- Film-quality realistic rendering
- Cinematic lighting and photography
- Photo-realistic characters and environments
- Professional cinematography look`;
                                  
                                  const prompt = `Professional film storyboard panel:

SCENE: ${scene.title}
LOCATION: ${scene.location}
TIME: ${scene.timeOfDay?.toUpperCase() || 'DAY'}
CHARACTERS: ${scene.characters.join(', ')}

${scene.content}

${styleDesc}

Create a ${storyboardStyle === 'sketch' ? 'professional sketch/drawing' : 'cinematic photorealistic'} storyboard frame with clear composition and proper framing.`;
                                  
                                  const imageOptions = {
                                    referenceImages: []
                                  };
                                  
                                  // Always add approved character references
                                  scene.characters.forEach(charName => {
                                    const approval = characterApprovals[charName];
                                    if (approval?.approved && approval?.image?.url) {
                                      const base64Data = approval.image.url.split(',')[1];
                                      const mimeType = approval.image.url.match(/data:([^;]+);/)?.[1] || 'image/png';
                                      imageOptions.referenceImages.push({
                                        data: base64Data,
                                        mimeType: mimeType
                                      });
                                      console.log(`✅ [Regenerate] Karakter referansı: ${charName}`);
                                    }
                                  });
                                  
                                  // Always add approved location references
                                  scene.locations?.forEach(locName => {
                                    const approval = locationApprovals[locName];
                                    if (approval?.approved && approval?.image?.url) {
                                      const base64Data = approval.image.url.split(',')[1];
                                      const mimeType = approval.image.url.match(/data:([^;]+);/)?.[1] || 'image/png';
                                      imageOptions.referenceImages.push({
                                        data: base64Data,
                                        mimeType: mimeType
                                      });
                                      console.log(`✅ [Regenerate] Mekan referansı: ${locName}`);
                                    }
                                  });
                                  
                                  const result = await generateImage(prompt, imageOptions);
                                  if (result && (result.success || result.imageData)) {
                                    const imageUrl = result.imageUrl ||
                                      (result.imageData ? `data:${result.mimeType || 'image/png'};base64,${result.imageData}` : null);
                                    
                                    if (imageUrl) {
                                      const newFrames = [...storyboardFrames];
                                      newFrames[index] = { ...frame, storyboardImage: imageUrl };
                                      setStoryboardFrames(newFrames);
                                    }
                                  }
                                } catch (error) {
                                  console.error('Failed to regenerate frame:', error);
                                } finally {
                                  setIsStoryboardProcessing(false);
                                }
                              }}
                              disabled={isStoryboardProcessing}
                              className="mt-2 w-full px-3 py-2 bg-cinema-accent/20 hover:bg-cinema-accent/40 text-cinema-accent rounded text-xs transition-colors disabled:opacity-50"
                            >
                              🔄 Hızlı Yeniden Üret
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4 animate-spin">🎬</div>
                      <h3 className="text-2xl font-semibold text-cinema-accent mb-2">Storyboard Üretiliyor...</h3>
                      <p className="text-cinema-text-dim mb-6">Her sahne için profesyonel çerçeveler oluşturuluyor</p>
                      <button
                        onClick={() => {
                          if (abortController) abortController.abort();
                          cancelStoryboard();
                        }}
                        className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg border border-red-500/30"
                      >
                        ✖ İptal Et
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Welcome Message - Show when no phase is selected */}
              {currentPhase !== 'character' && currentPhase !== 'location' && currentPhase !== 'storyboard' && (
                <div className="text-center py-12">
                  <div className="mb-8">
                    <div className="text-6xl mb-4">🎬</div>
                    <h2 className="text-3xl font-bold text-white mb-3">Profesyonel Storyboard Modülü</h2>
                    <p className="text-cinema-text-dim text-lg max-w-2xl mx-auto">
                      Senaryonuzdan profesyonel storyboard oluşturun
                    </p>
                  </div>

                  {/* Analysis Progress List - Always Visible */}
                  <div className="bg-cinema-black/50 rounded-lg border border-cinema-gray p-6 mb-8 max-w-3xl mx-auto">
                    <h3 className="text-lg font-semibold text-cinema-accent mb-4 flex items-center gap-2">
                      <span>📊</span>
                      <span>Storyboard İçin Gerekli Analizler</span>
                    </h3>
                    <div className="space-y-3">
                      {analysisProgressList.map((analysis) => {
                        // Get version and timestamp info from loaded analysis
                        const analysisInfo = characterAnalysis || locationAnalysis || {};
                        const hasVersionInfo = analysis.version || analysis.timestamp;
                        
                        return (
                          <div key={analysis.key} className="flex items-center gap-3 bg-cinema-black/30 rounded-lg p-3">
                            <div className={`text-2xl ${analysis.status === 'completed' ? 'text-green-400' : ''}`}>
                              {analysis.status === 'pending' && '○'}
                              {analysis.status === 'in-progress' && <span className="animate-spin">⟳</span>}
                              {analysis.status === 'completed' && '✓'}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-cinema-text font-medium">{analysis.name}</span>
                                {analysis.status === 'completed' && (
                                  <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded">
                                    ✓ Hazır
                                  </span>
                                )}
                              </div>
                              {analysis.status === 'in-progress' && (
                                <div className="mt-2">
                                  <div className="w-full bg-cinema-gray/30 rounded-full h-2">
                                    <div 
                                      className="bg-cinema-accent h-2 rounded-full transition-all duration-300"
                                      style={{ width: `${analysis.progress}%` }}
                                    />
                                  </div>
                                  <div className="text-xs text-cinema-text-dim mt-1">
                                    {Math.round(analysis.progress)}%
                                  </div>
                                </div>
                              )}
                              {analysis.status === 'completed' && analysis.version && (
                                <div className="text-xs text-cinema-text-dim mt-1">
                                  Versiyon: {analysis.version} {analysis.timestamp && `• ${new Date(analysis.timestamp).toLocaleDateString('tr-TR')}`}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                    <div className="bg-cinema-black/50 rounded-lg border border-cinema-gray p-6">
                      <div className="text-4xl mb-3">👥</div>
                      <h3 className="text-lg font-semibold text-cinema-accent mb-2">1. Karakterler</h3>
                      <p className="text-sm text-cinema-text-dim">
                        Karakterleri AI ile görselleştirin ve onaylayın
                      </p>
                    </div>

                    <div className="bg-cinema-black/50 rounded-lg border border-cinema-gray p-6">
                      <div className="text-4xl mb-3">🏛️</div>
                      <h3 className="text-lg font-semibold text-cinema-accent mb-2">2. Mekanlar</h3>
                      <p className="text-sm text-cinema-text-dim">
                        Mekanları AI ile oluşturun ve referans olarak kaydedin
                      </p>
                    </div>

                    <div className="bg-cinema-black/50 rounded-lg border border-cinema-gray p-6">
                      <div className="text-4xl mb-3">🎬</div>
                      <h3 className="text-lg font-semibold text-cinema-accent mb-2">3. Storyboard</h3>
                      <p className="text-sm text-cinema-text-dim">
                        Sahneleri görselleştirin ve storyboard'u tamamlayın
                      </p>
                    </div>
                  </div>

                  {!characterAnalysis && !isStoryboardProcessing && (
                    <div className="mt-8 space-y-4">
                      <p className="text-cinema-text-dim text-sm text-center">
                        💡 Başlamak için alt panelden <strong>"🚀 Storyboard Analizlerini Başlat"</strong> butonuna tıklayın
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* LEGACY STEP 2 - Hidden when using phase-based workflow */}
              {currentPhase !== 'character' && currentPhase !== 'location' && currentPhase !== 'storyboard' && currentStep === 2 && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-cinema-accent rounded-lg flex items-center justify-center text-2xl">
                      🎬
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white">Profesyonel Storyboard Üretimi (Legacy)</h2>
                      <p className="text-cinema-text-dim text-sm">
                        Çıkarılan sahnelerden profesyonel storyboard çerçeveleri oluştur
                      </p>
                    </div>
                  </div>

                  {storyboardFrames.length === 0 && !isStoryboardProcessing ? (
                    <div className="text-center py-8">
                      <div className="flex flex-col gap-4 items-center">
                        <button
                          onClick={() => executeStep(2)}
                          disabled={isProcessing || isStoryboardProcessing || extractedScenes.length === 0 || !isConfigured() || !aiHandler}
                          className="bg-cinema-accent hover:bg-cinema-accent/90 text-cinema-black px-8 py-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg transition-all transform hover:scale-105"
                        >
                          {(isProcessing || isStoryboardProcessing) ? '🔄 Storyboard Üretiliyor...' :
                            extractedScenes.length === 0 ? '⚠️ Analysis Panelinde Analiz Yapın' :
                              !isConfigured() ? '⚠️ AI Ayarları Gerekli' :
                                !aiHandler ? '⏳ Yükleniyor...' :
                                  '🎬 Profesyonel Storyboard Üret'}
                        </button>

                        {extractedScenes.length > 0 && (
                          <p className="text-cinema-text-dim text-sm">
                            {extractedScenes.length} sahne için profesyonel çerçeveler üretilecek
                          </p>
                        )}

                        {(isProcessing || isStoryboardProcessing) && (
                          <button
                            onClick={() => {
                              if (abortController) {
                                abortController.abort();
                              }
                              cancelStoryboard();
                            }}
                            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-colors border border-red-500/30"
                          >
                            ✕ İptal Et
                          </button>
                        )}
                      </div>
                    </div>
                  ) : storyboardFrames.length === 0 && isStoryboardProcessing ? (
                    <div className="text-center py-12">
                      <div className="flex flex-col gap-4 items-center max-w-md mx-auto">
                        <div className="text-6xl mb-4 animate-spin">🎬</div>
                        <h3 className="text-2xl font-semibold text-cinema-accent mb-2">
                          🔄 Storyboard Çerçeveleri Üretiliyor
                        </h3>
                        <p className="text-cinema-text-dim text-lg mb-6">
                          Her sahne için profesyonel storyboard çerçeveleri AI tarafından oluşturuluyor...
                        </p>
                        <button
                          onClick={() => {
                            if (abortController) {
                              abortController.abort();
                            }
                            cancelStoryboard();
                          }}
                          className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-colors border border-red-500/30"
                        >
                          ✖ İptal Et
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-cinema-gray rounded-lg p-6 bg-cinema-dark/50">
                      <h3 className="font-semibold text-cinema-accent mb-4 flex items-center gap-2">
                        ✅ Profesyonel Storyboard Üretimi Tamamlandı ({storyboardFrames.length} çerçeve)
                      </h3>

                      {storyboardFrames.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {storyboardFrames.map((frame, index) => (
                            <div key={index} className="border border-cinema-gray/30 rounded-lg p-4 bg-cinema-black/30">
                              <div className="flex justify-between items-start mb-3">
                                <h4 className="font-semibold text-cinema-accent">Çerçeve {frame.frameNumber}</h4>
                                <span className="text-sm text-cinema-text-dim">{frame.title}</span>
                              </div>
                              
                              {frame.storyboardImage && (
                                <img
                                  src={frame.storyboardImage}
                                  alt={`Storyboard çerçevesi ${frame.frameNumber}`}
                                  className="w-full h-48 object-cover rounded mb-3 cursor-pointer hover:border hover:border-cinema-accent transition-colors"
                                  onClick={() => openImageModal({ 
                                    url: frame.storyboardImage, 
                                    scene: frame.title, 
                                    frame: frame.frameNumber, 
                                    type: 'storyboard' 
                                  })}
                                  title="Görseli büyütmek için tıklayın"
                                />
                              )}

                              <div className="space-y-2">
                                <p className="text-sm text-cinema-text">{frame.description}</p>
                                
                                {frame.characters && frame.characters.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {frame.characters.map((char, i) => (
                                      <span key={`frame-${index}-char-${i}-${char}`} className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                                        {char}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {frame.locations && frame.locations.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {frame.locations.map((loc, i) => (
                                      <span key={`frame-${index}-loc-${i}-${loc}`} className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded">
                                        📍 {loc}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step Navigation */}
            <div className="flex justify-between">
              <button
                onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                disabled={currentStep === 1}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
              >
                ← Önceki Aşama
              </button>

            </div>
          </div>
        </div>

        {/* Bottom Navigation Bar - Inside Module */}
        <div className="mt-6 bg-cinema-black/95 backdrop-blur-sm border-t border-cinema-gray shadow-lg rounded-lg">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              {/* Left Section - Phase Navigation with Numbers */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-cinema-text-dim font-semibold uppercase tracking-wider mr-2">Fazlar:</span>
                
                {/* Phase 1: Characters */}
                <button
                  onClick={() => setCurrentPhase('character')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    currentPhase === 'character'
                      ? 'bg-cinema-accent text-white shadow-lg shadow-cinema-accent/20'
                      : 'bg-cinema-gray/30 text-cinema-text hover:bg-cinema-gray/50'
                  }`}
                >
                  {phaseCompletion.character.approved > 0 && phaseCompletion.character.approved === phaseCompletion.character.total ? (
                    <span className="text-green-400">✓</span>
                  ) : (
                    <span className="font-bold">1.</span>
                  )}
                  👥 Karakterler
                </button>

                {/* Phase 2: Locations */}
                <button
                  onClick={() => setCurrentPhase('location')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    currentPhase === 'location'
                      ? 'bg-cinema-accent text-white shadow-lg shadow-cinema-accent/20'
                      : 'bg-cinema-gray/30 text-cinema-text hover:bg-cinema-gray/50'
                  }`}
                >
                  {phaseCompletion.location.approved > 0 && phaseCompletion.location.approved === phaseCompletion.location.total ? (
                    <span className="text-green-400">✓</span>
                  ) : (
                    <span className="font-bold">2.</span>
                  )}
                  🏛️ Mekanlar
                </button>

                {/* Phase 3: Storyboard */}
                <button
                  onClick={() => setCurrentPhase('storyboard')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    currentPhase === 'storyboard'
                      ? 'bg-cinema-accent text-white shadow-lg shadow-cinema-accent/20'
                      : 'bg-cinema-gray/30 text-cinema-text hover:bg-cinema-gray/50'
                  }`}
                >
                  {storyboardFrames.length > 0 ? (
                    <span className="text-green-400">✓</span>
                  ) : (
                    <span className="font-bold">3.</span>
                  )}
                  🎬 Storyboard
                </button>
              </div>

              {/* Right Section - Action Buttons */}
              <div className="flex items-center gap-2">
                {!characterAnalysis ? (
                  <button
                    onClick={() => {
                      console.log('🎬 Storyboard analizi başlatılıyor...');
                      window.storyboardRequestedAnalysis = true;
                      handleGoToAnalysis();
                    }}
                    className="px-5 py-2 bg-cinema-accent hover:bg-cinema-accent-dark text-white rounded-lg text-sm font-semibold transition-all shadow-lg"
                  >
                    🚀 Storyboard Analizlerini Başlat
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (confirm('Tüm storyboard verilerini sıfırlamak istediğinizden emin misiniz?')) {
                        setCharacterAnalysis(null);
                        setLocationAnalysis(null);
                        setCharacterApprovals({});
                        setLocationApprovals({});
                        setExtractedScenes([]);
                        setStoryboardFrames([]);
                        setCurrentPhase(null);
                        console.log('🔄 Storyboard sıfırlandı');
                      }
                    }}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium transition-all border border-red-500/30"
                  >
                    🗑️ Temizle
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {isImageModalOpen && selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4" onClick={closeImageModal}>
          <div className="relative max-w-6xl max-h-full">
            <button
              onClick={closeImageModal}
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-75 transition-opacity z-10"
            >
              ✕
            </button>
            <img
              src={selectedImage.url}
              alt={selectedImage.character || selectedImage.location || selectedImage.scene || "Görsel"}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            {(selectedImage.character || selectedImage.location || selectedImage.scene) && (
              <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white p-3 rounded-lg">
                <h4 className="font-semibold">
                  {selectedImage.type === 'storyboard' && `Frame ${selectedImage.frame} - ${selectedImage.scene}`}
                  {selectedImage.type === 'reference' && `${selectedImage.character} Referansı`}
                  {selectedImage.type === 'location_reference' && `${selectedImage.location} Referansı`}
                  {selectedImage.character && !selectedImage.type && selectedImage.character}
                </h4>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Character Detail Modal - Full Screen */}
      {isCharacterDetailOpen && selectedCharacterDetail && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-cinema-dark rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto border-2 border-cinema-accent">
            {/* Header */}
            <div className="sticky top-0 bg-cinema-dark border-b border-cinema-gray px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-cinema-accent rounded-full flex items-center justify-center text-2xl">
                  👤
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedCharacterDetail.name}</h2>
                  <p className="text-sm text-cinema-text-dim">
                    {selectedCharacterDetail.age && `${selectedCharacterDetail.age} • `}
                    {selectedCharacterDetail.role || 'Karakter'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsCharacterDetailOpen(false);
                  setSelectedCharacterDetail(null);
                }}
                className="w-10 h-10 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-400 flex items-center justify-center transition-colors text-xl"
                title="Kapat (ESC)"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Current Image */}
              {characterApprovals[selectedCharacterDetail.name]?.image?.url && (
                <div className="bg-cinema-gray/30 rounded-xl p-4 border border-cinema-gray">
                  <h3 className="text-lg font-semibold text-white mb-3">Mevcut Görsel</h3>
                  <img
                    src={characterApprovals[selectedCharacterDetail.name].image.url}
                    alt={selectedCharacterDetail.name}
                    className="w-full h-auto rounded-lg shadow-lg cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => {
                      setSelectedImage({
                        url: characterApprovals[selectedCharacterDetail.name].image.url,
                        character: selectedCharacterDetail.name,
                        type: 'reference'
                      });
                      setIsImageModalOpen(true);
                    }}
                  />
                </div>
              )}

              {/* Character Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(selectedCharacterDetail.physicalDescription || selectedCharacterDetail.physical) && (
                  <div className="bg-cinema-gray/30 rounded-xl p-4 border border-cinema-gray">
                    <h3 className="text-lg font-semibold text-cinema-accent mb-2">Fiziksel Özellikler</h3>
                    <p className="text-cinema-text-dim">
                      {selectedCharacterDetail.physicalDescription || selectedCharacterDetail.physical}
                    </p>
                  </div>
                )}
                {selectedCharacterDetail.personality && (
                  <div className="bg-cinema-gray/30 rounded-xl p-4 border border-cinema-gray">
                    <h3 className="text-lg font-semibold text-cinema-accent mb-2">Kişilik</h3>
                    <p className="text-cinema-text-dim">{selectedCharacterDetail.personality}</p>
                  </div>
                )}
                {selectedCharacterDetail.style && (
                  <div className="bg-cinema-gray/30 rounded-xl p-4 border border-cinema-gray">
                    <h3 className="text-lg font-semibold text-cinema-accent mb-2">Stil & Giyim</h3>
                    <p className="text-cinema-text-dim">{selectedCharacterDetail.style}</p>
                  </div>
                )}
                {selectedCharacterDetail.description && (
                  <div className="bg-cinema-gray/30 rounded-xl p-4 border border-cinema-gray">
                    <h3 className="text-lg font-semibold text-cinema-accent mb-2">Açıklama</h3>
                    <p className="text-cinema-text-dim">{selectedCharacterDetail.description}</p>
                  </div>
                )}
              </div>

              {/* Image Generator */}
              <div className="bg-cinema-gray/30 rounded-xl p-6 border border-cinema-accent">
                <h3 className="text-xl font-semibold text-white mb-4">🎨 Görsel Üretici</h3>
                <CharacterImageGenerator
                  character={selectedCharacterDetail}
                  onImageGenerated={(name, imageData) => {
                    handleCharacterImageGenerated(name, imageData);
                    // Modal'ı kapatma (kullanıcı isterse açık tutabilir)
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Storyboard Frame Detail Modal - Full Screen */}
      {isFrameDetailOpen && selectedFrameDetail && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-cinema-dark rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto border-2 border-cinema-accent">
            {/* Header */}
            <div className="sticky top-0 bg-cinema-dark border-b border-cinema-gray px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-cinema-accent rounded-full flex items-center justify-center text-2xl">
                  🎬
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Çerçeve {selectedFrameDetail.frame.frameNumber}</h2>
                  <p className="text-sm text-cinema-text-dim">{selectedFrameDetail.frame.title}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsFrameDetailOpen(false);
                  setSelectedFrameDetail(null);
                }}
                className="w-10 h-10 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-400 flex items-center justify-center transition-colors text-xl"
                title="Kapat (ESC)"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Current Image */}
              {selectedFrameDetail.frame.storyboardImage && (
                <div className="bg-cinema-gray/30 rounded-xl p-4 border border-cinema-gray">
                  <h3 className="text-lg font-semibold text-white mb-3">Mevcut Görsel</h3>
                  <img
                    src={selectedFrameDetail.frame.storyboardImage}
                    onClick={() => {
                      setSelectedImage({
                        url: selectedFrameDetail.frame.storyboardImage,
                        scene: selectedFrameDetail.frame.title,
                        frame: selectedFrameDetail.frame.frameNumber,
                        type: 'storyboard'
                      });
                      setIsImageModalOpen(true);
                    }}
                    className="w-full h-auto rounded-lg shadow-lg cursor-pointer hover:opacity-90 transition-opacity"
                    alt={`Storyboard ${selectedFrameDetail.frame.frameNumber}`}
                  />
                </div>
              )}

              {/* Scene Details */}
              {selectedFrameDetail.scene && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-cinema-gray/30 rounded-xl p-4 border border-cinema-gray">
                    <h4 className="text-sm font-semibold text-cinema-accent mb-2">📍 Mekan</h4>
                    <p className="text-white">{selectedFrameDetail.scene.location || '—'}</p>
                    <p className="text-xs text-cinema-text-dim mt-1">
                      {selectedFrameDetail.scene.intExt || ''} {selectedFrameDetail.scene.timeOfDay ? `• ${selectedFrameDetail.scene.timeOfDay}` : ''}
                    </p>
                  </div>

                  <div className="bg-cinema-gray/30 rounded-xl p-4 border border-cinema-gray">
                    <h4 className="text-sm font-semibold text-cinema-accent mb-2">👥 Karakterler</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedFrameDetail.scene.characters?.map((char, charIdx) => (
                        <span key={`frame-detail-char-${charIdx}-${char}`} className="text-xs bg-cinema-accent/20 text-cinema-accent px-2 py-1 rounded">
                          {char}
                        </span>
                      )) || <span className="text-cinema-text-dim">—</span>}
                    </div>
                  </div>

                  <div className="bg-cinema-gray/30 rounded-xl p-4 border border-cinema-gray md:col-span-2">
                    <h4 className="text-sm font-semibold text-cinema-accent mb-2">📝 Sahne İçeriği</h4>
                    <p className="text-sm text-cinema-text leading-relaxed">{selectedFrameDetail.scene.content || '—'}</p>
                  </div>
                </div>
              )}

              {/* Reference Images Used */}
              {selectedFrameDetail.scene && (
                <div className="bg-cinema-gray/30 rounded-xl p-4 border border-cinema-gray">
                  <h4 className="text-lg font-semibold text-cinema-accent mb-3 flex items-center gap-2">
                    🖼️ Kullanılan Referans Görseller
                  </h4>
                  
                  {(() => {
                    const charRefs = selectedFrameDetail.scene.characters
                      ?.map(charName => {
                        const approval = characterApprovals[charName];
                        return approval?.approved && approval?.image?.url ? { name: charName, image: approval.image, type: 'character' } : null;
                      })
                      .filter(Boolean) || [];
                    
                    const locRefs = selectedFrameDetail.scene.locations
                      ?.map(locName => {
                        const approval = locationApprovals[locName];
                        return approval?.approved && approval?.image?.url ? { name: locName, image: approval.image, type: 'location' } : null;
                      })
                      .filter(Boolean) || [];
                    
                    const allRefs = [...charRefs, ...locRefs];
                    
                    if (allRefs.length === 0) {
                      return (
                        <p className="text-cinema-text-dim text-sm">
                          Bu sahne için referans görsel kullanılmadı. Karakterleri ve mekanları onaylayarak referans görseller ekleyebilirsiniz.
                        </p>
                      );
                    }
                    
                    return (
                      <div className="space-y-3">
                        <p className="text-xs text-cinema-text-dim">
                          Bu görseller storyboard frame üretiminde AI'ya referans olarak gönderildi
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {allRefs.map((ref, idx) => (
                            <div key={`ref-${idx}-${ref.name}`} className="bg-cinema-black/50 rounded-lg p-2 border border-cinema-gray/50">
                              <img
                                src={ref.image.url}
                                alt={ref.name}
                                className="w-full h-24 object-cover rounded mb-2 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => {
                                  setSelectedImage({
                                    url: ref.image.url,
                                    scene: ref.name,
                                    type: ref.type
                                  });
                                  setIsImageModalOpen(true);
                                }}
                              />
                              <div className="text-xs">
                                <div className="text-white font-medium truncate">{ref.name}</div>
                                <div className="text-cinema-text-dim">
                                  {ref.type === 'character' ? '👤 Karakter' : '🏛️ Mekan'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Regeneration Options */}
              <div className="bg-cinema-gray/30 rounded-xl p-6 border border-cinema-accent">
                <h3 className="text-xl font-semibold text-white mb-4">🔄 Yeniden Üretim Seçenekleri</h3>
                
                {/* Style Selection */}
                <div className="mb-6">
                  <label className="text-sm font-medium text-white mb-2 block">🎨 Stil</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setFrameRegenerateSettings({...frameRegenerateSettings, style: 'sketch'})}
                      className={`p-3 rounded-lg border transition-all ${
                        frameRegenerateSettings.style === 'sketch'
                          ? 'border-cinema-accent bg-cinema-accent/20'
                          : 'border-cinema-gray bg-cinema-gray/30 hover:border-cinema-gray-light'
                      }`}
                    >
                      <div className="text-2xl mb-1">✏️</div>
                      <div className="text-xs font-medium text-white">Çizim</div>
                    </button>
                    <button
                      onClick={() => setFrameRegenerateSettings({...frameRegenerateSettings, style: 'realistic'})}
                      className={`p-3 rounded-lg border transition-all ${
                        frameRegenerateSettings.style === 'realistic'
                          ? 'border-cinema-accent bg-cinema-accent/20'
                          : 'border-cinema-gray bg-cinema-gray/30 hover:border-cinema-gray-light'
                      }`}
                    >
                      <div className="text-2xl mb-1">📸</div>
                      <div className="text-xs font-medium text-white">Gerçekçi</div>
                    </button>
                  </div>
                </div>

                {/* Reference Toggle */}
                <div className="mb-6">
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-cinema-gray/30 transition-colors">
                    <input
                      type="checkbox"
                      checked={frameRegenerateSettings.useReference}
                      onChange={(e) => setFrameRegenerateSettings({...frameRegenerateSettings, useReference: e.target.checked})}
                      className="w-5 h-5 rounded border-cinema-gray bg-cinema-dark text-cinema-accent"
                    />
                    <div className="flex-1">
                      <div className="text-white font-medium">🖼️ Mevcut Görseli Referans Olarak Kullan</div>
                      <div className="text-xs text-cinema-text-dim">
                        Üretilen görsele benzer bir kompozisyon oluşturulur
                      </div>
                    </div>
                  </label>
                </div>

                {/* Custom Prompt */}
                <div className="mb-6">
                  <label className="text-sm font-medium text-white mb-2 block">✍️ Özel Talimat (Opsiyonel)</label>
                  <textarea
                    value={frameRegenerateSettings.customPrompt}
                    onChange={(e) => setFrameRegenerateSettings({...frameRegenerateSettings, customPrompt: e.target.value})}
                    placeholder="Örn: Daha yakın çekim, gece sahnesi, daha dramatik ışık..."
                    className="w-full px-4 py-3 bg-cinema-black/60 border border-cinema-gray rounded-lg text-cinema-text placeholder-cinema-text-dim focus:ring-2 focus:ring-cinema-accent focus:border-transparent resize-none"
                    rows="3"
                  />
                </div>

                {/* Regenerate Button */}
                <button
                  onClick={async () => {
                    const scene = selectedFrameDetail.scene;
                    const frame = selectedFrameDetail.frame;
                    const index = selectedFrameDetail.index;
                    
                    setIsStoryboardProcessing(true);
                    try {
                      const styleDesc = frameRegenerateSettings.style === 'sketch'
                        ? `STYLE: Traditional storyboard sketch/drawing style
- Hand-drawn pencil sketch aesthetic
- Black and white line art
- Clean, professional illustration
- Traditional animation/comic book style drawing`
                        : `STYLE: Cinematic realistic/photorealistic frame
- Film-quality realistic rendering
- Cinematic lighting and photography
- Photo-realistic characters and environments
- Professional cinematography look`;
                      
                      let prompt = `Professional film storyboard panel:

SCENE: ${scene.title}
LOCATION: ${scene.location}
TIME: ${scene.timeOfDay?.toUpperCase() || 'DAY'}
CHARACTERS: ${scene.characters.join(', ')}

${scene.content}

${styleDesc}`;
                      
                      if (frameRegenerateSettings.customPrompt) {
                        prompt += `\n\nAdditional instructions: ${frameRegenerateSettings.customPrompt}`;
                      }
                      
                      prompt += `\n\nCreate a ${frameRegenerateSettings.style === 'sketch' ? 'professional sketch/drawing' : 'cinematic photorealistic'} storyboard frame with clear composition and proper framing.`;
                      
                      const imageOptions = {
                        referenceImages: []
                      };
                      
                      // Add current frame as reference if enabled
                      if (frameRegenerateSettings.useReference && frame.storyboardImage) {
                        imageOptions.referenceImages.push(frame.storyboardImage);
                      }
                      
                      // Add character references
                      scene.characters.forEach(charName => {
                        const approval = characterApprovals[charName];
                        if (approval?.approved && approval?.image?.url) {
                          imageOptions.referenceImages.push(approval.image.url);
                        }
                      });
                      
                      // Add location references
                      scene.locations?.forEach(locName => {
                        const approval = locationApprovals[locName];
                        if (approval?.approved && approval?.image?.url) {
                          imageOptions.referenceImages.push(approval.image.url);
                        }
                      });
                      
                      const result = await generateImage(prompt, imageOptions);
                      if (result && (result.success || result.imageData)) {
                        const imageUrl = result.imageUrl ||
                          (result.imageData ? `data:${result.mimeType || 'image/png'};base64,${result.imageData}` : null);
                        
                        if (imageUrl) {
                          const newFrames = [...storyboardFrames];
                          newFrames[index] = { ...frame, storyboardImage: imageUrl };
                          setStoryboardFrames(newFrames);
                          
                          // Update modal with new image
                          setSelectedFrameDetail({
                            ...selectedFrameDetail,
                            frame: { ...frame, storyboardImage: imageUrl }
                          });
                        }
                      }
                    } catch (error) {
                      console.error('Failed to regenerate frame:', error);
                    } finally {
                      setIsStoryboardProcessing(false);
                    }
                  }}
                  disabled={isStoryboardProcessing}
                  className="w-full px-6 py-4 bg-cinema-accent hover:bg-cinema-accent/90 text-cinema-black rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isStoryboardProcessing ? '🔄 Üretiliyor...' : '🎬 Yeniden Üret'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Location Detail Modal - Full Screen */}
      {isLocationDetailOpen && selectedLocationDetail && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-cinema-dark rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto border-2 border-cinema-accent">
            {/* Header */}
            <div className="sticky top-0 bg-cinema-dark border-b border-cinema-gray px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-cinema-accent rounded-full flex items-center justify-center text-2xl">
                  🏛️
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedLocationDetail.name}</h2>
                  <p className="text-sm text-cinema-text-dim">
                    {selectedLocationDetail.type === 'interior' ? 'İç Mekan' : 'Dış Mekan'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsLocationDetailOpen(false);
                  setSelectedLocationDetail(null);
                }}
                className="w-10 h-10 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-400 flex items-center justify-center transition-colors text-xl"
                title="Kapat (ESC)"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Current Image */}
              {locationApprovals[selectedLocationDetail.name]?.image?.url && (
                <div className="bg-cinema-gray/30 rounded-xl p-4 border border-cinema-gray">
                  <h3 className="text-lg font-semibold text-white mb-3">Mevcut Görsel</h3>
                  <img
                    src={locationApprovals[selectedLocationDetail.name].image.url}
                    alt={selectedLocationDetail.name}
                    className="w-full h-auto rounded-lg shadow-lg cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => {
                      setSelectedImage({
                        url: locationApprovals[selectedLocationDetail.name].image.url,
                        location: selectedLocationDetail.name,
                        type: 'location_reference'
                      });
                      setIsImageModalOpen(true);
                    }}
                  />
                </div>
              )}

              {/* Location Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedLocationDetail.description && (
                  <div className="bg-cinema-gray/30 rounded-xl p-4 border border-cinema-gray">
                    <h3 className="text-lg font-semibold text-cinema-accent mb-2">Açıklama</h3>
                    <p className="text-cinema-text-dim">{selectedLocationDetail.description}</p>
                  </div>
                )}
                {selectedLocationDetail.atmosphere && (
                  <div className="bg-cinema-gray/30 rounded-xl p-4 border border-cinema-gray">
                    <h3 className="text-lg font-semibold text-cinema-accent mb-2">Atmosfer</h3>
                    <p className="text-cinema-text-dim">{selectedLocationDetail.atmosphere}</p>
                  </div>
                )}
                {selectedLocationDetail.lighting && (
                  <div className="bg-cinema-gray/30 rounded-xl p-4 border border-cinema-gray">
                    <h3 className="text-lg font-semibold text-cinema-accent mb-2">Işıklandırma</h3>
                    <p className="text-cinema-text-dim">{selectedLocationDetail.lighting}</p>
                  </div>
                )}
                {selectedLocationDetail.colors && (
                  <div className="bg-cinema-gray/30 rounded-xl p-4 border border-cinema-gray">
                    <h3 className="text-lg font-semibold text-cinema-accent mb-2">Renk Paleti</h3>
                    <p className="text-cinema-text-dim">{selectedLocationDetail.colors}</p>
                  </div>
                )}
                {selectedLocationDetail.mood && (
                  <div className="bg-cinema-gray/30 rounded-xl p-4 border border-cinema-gray">
                    <h3 className="text-lg font-semibold text-cinema-accent mb-2">Mood</h3>
                    <p className="text-cinema-text-dim">{selectedLocationDetail.mood}</p>
                  </div>
                )}
              </div>

              {/* Image Generator */}
              <div className="bg-cinema-gray/30 rounded-xl p-6 border border-cinema-accent">
                <h3 className="text-xl font-semibold text-white mb-4">🎨 Görsel Üretici</h3>
                <LocationImageGenerator
                  location={selectedLocationDetail}
                  onImageGenerated={(name, imageData) => {
                    handleLocationImageGenerated(name, imageData);
                    // Modal'ı kapatma (kullanıcı isterse açık tutabilir)
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}