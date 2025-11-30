import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useScriptStore } from '../store/scriptStore';
import { useAIStore } from '../store/aiStore';
import { usePromptStore } from '../store/promptStore';
import StoryboardLoadingScreen from './StoryboardLoadingScreen';
import CharacterVisualization from './CharacterVisualization';
import CharacterImageGenerator from './CharacterImageGenerator';
import { analysisStorageService } from '../utils/analysisStorageService';

export default function ProfessionalStoryboard() {
  const { t } = useTranslation();
  const { getCurrentScript, updateScript, currentScriptId } = useScriptStore();
  const { generateImage, isGeneratingImage, isConfigured, provider, getAIHandler } = useAIStore();
  const { getPrompt } = usePromptStore();
  const { setStoryboardProgress, setIsStoryboardProcessing, clearStoryboardProgress, setStoryboardAbortController, cancelStoryboard, isStoryboardProcessing, storyboardProgress } = useScriptStore();

  // AI Handler state
  const [aiHandler, setAiHandler] = useState(null);

  // Storyboard üretim aşamaları
  const [currentStep, setCurrentStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [abortController, setAbortController] = useState(null);

  // Aşama 1: Karakter ve Mekan Analizi
  const [characterAnalysis, setCharacterAnalysis] = useState(null);
  const [locationAnalysis, setLocationAnalysis] = useState(null);

  // Karakter görselleri
  const [characterImages, setCharacterImages] = useState({});

  // Aşama 2: Stil ve Renk Analizi  
  const [styleAnalysis, setStyleAnalysis] = useState(null);
  const [colorPalette, setColorPalette] = useState(null);
  const [visualLanguage, setVisualLanguage] = useState(null);

  // Aşama 3: Karakter Referans Görselleri
  const [characterReferences, setCharacterReferences] = useState({});
  const [locationReferences, setLocationReferences] = useState({});

  // Aşama 4: Final Storyboard
  const [finalStoryboard, setFinalStoryboard] = useState({});
  const [storyboardScenes, setStoryboardScenes] = useState([]);

  // Image modal states
  const [selectedImage, setSelectedImage] = useState(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

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
      const handler = getAIHandler();
      setAiHandler(handler);
    } catch (err) {
      console.error('❌ Error initializing AI handler:', err);
      setAiHandler(null);
    }
  }, [getAIHandler]);

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

  const steps = [
    {
      id: 1,
      title: 'Karakter & Mekan Analizi',
      description: 'Senaryodaki karakterlerin ve mekanların detaylı analizi',
      status: (characterAnalysis && locationAnalysis) ? 'completed' :
        isProcessing && currentStep === 1 ? 'processing' : 'pending'
    },
    {
      id: 2,
      title: 'Stil & Renk Paleti',
      description: 'Görsel stil, renk paleti ve sinematik dil belirleme',
      status: (styleAnalysis && colorPalette) ? 'completed' :
        isProcessing && currentStep === 2 ? 'processing' : 'pending'
    },
    {
      id: 3,
      title: 'Final Storyboard',
      description: 'Profesyonel storyboard sahneleri oluştur',
      status: Object.keys(finalStoryboard).length > 0 ? 'completed' :
        isProcessing && currentStep === 3 ? 'processing' : 'pending'
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
        aiHandler = getAIHandler();
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

      // Check if we already have analysis data from AnalysisPanel
      let existingAnalysis = null;
      try {
        existingAnalysis = await analysisStorageService.loadAnalysis(scriptText, currentScript?.name);
        if (!existingAnalysis && currentScript?.name?.endsWith('.pdf')) {
          const pdfMatch = await analysisStorageService.findAnalysisByFileName(currentScript.name, 0.7);
          if (pdfMatch) {
            existingAnalysis = await analysisStorageService.loadAnalysisByKey(pdfMatch.key);
          }
        }
      } catch (err) {
        console.log('ℹ️ No existing analysis found');
      }

      // If we have existing analysis with characters and locations, use it
      if (existingAnalysis?.customResults?.character && existingAnalysis?.customResults?.cinematography) {
        const useExisting = confirm(
          '📊 Bu senaryo için kapsamlı analiz verisi bulundu!\n\n' +
          `👥 Karakter Analizi: ${existingAnalysis.customResults.character ? '✅' : '❌'}\n` +
          `🎬 Sinematografi: ${existingAnalysis.customResults.cinematography ? '✅' : '❌'}\n` +
          `🏗️ Yapı Analizi: ${existingAnalysis.customResults.structure ? '✅' : '❌'}\n\n` +
          'Bu verileri storyboard için kullanmak ister misiniz?\n\n' +
          '✅ EVET = Mevcut analizi kullan (hızlı)\n' +
          '❌ HAYIR = Yeni analiz yap (API kullanır)'
        );

        if (useExisting) {
          console.log('✅ Using existing comprehensive analysis data for storyboard');
          setCharacterAnalysis(existingAnalysis.customResults.character);
          setLocationAnalysis(existingAnalysis.customResults.cinematography);
          setIsProcessing(false);
          setCurrentStep(2);
          alert('✅ Mevcut analiz verileri storyboard için yüklendi! Stil analizi aşamasına geçiliyor.');
          return;
        }
      }

      // Fallback to legacy simple analysis
      if (existingAnalysis?.characters && existingAnalysis?.locations) {
        const useExisting = confirm(
          '📊 Bu senaryo için temel analiz verisi bulundu!\n\n' +
          `👥 Karakterler: ${existingAnalysis.characters?.characters?.length || 'Bilinmiyor'}\n` +
          `📍 Mekanlar: ${existingAnalysis.locations?.locations?.length || 'Bilinmiyor'}\n\n` +
          'Bu verileri kullanmak ister misiniz?\n\n' +
          '✅ EVET = Mevcut analizi kullan (hızlı)\n' +
          '❌ HAYIR = Yeni analiz yap (API kullanır)'
        );

        if (useExisting) {
          console.log('✅ Using existing legacy analysis data for storyboard');
          setCharacterAnalysis(existingAnalysis.characters);
          setLocationAnalysis(existingAnalysis.locations);
          setIsProcessing(false);
          setCurrentStep(2);
          alert('✅ Mevcut analiz verileri yüklendi! Bir sonraki aşamaya geçiliyor.');
          return;
        }
      }
      // Karakter analizi - AnalysisPanel'daki prompt'u kullanıyoruz
      const characterPrompt = `
Lütfen metindeki karakterleri analiz et ve şu başlıklar altında raporla:

SENARYO:
${scriptText}

1. Ana Karakterler:
   - İsim ve temel özellikler (yaş, fiziksel görünüm, giyim tarzı)
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
   - Giyim tarzı ve aksesuar tercihleri
   - Karakteristik fiziksel özellikleri
   - Yüz ifadeleri ve mimikler

Lütfen MUTLAKA JSON formatında yanıt ver (ek açıklama olmadan sadece JSON):
{
  "characters": [
    {
      "name": "Karakter İsmi",
      "age": "yaş aralığı",
      "physical": "detaylı fiziksel özellikler (boy, kilo, saç, göz, ten rengi, vs.)",
      "personality": "kişilik özellikleri ve motivasyonlar",
      "style": "giyim tarzı ve aksesuar tercihleri",
      "role": "hikayedeki rolü (ana karakter/yan karakter)",
      "gestures": "karakteristik hareketler, jestler ve konuşma tarzı",
      "relationships": "diğer karakterlerle ilişkiler",
      "development": "karakter gelişimi"
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

      // Kısaltılmış karakter promptı
      const shortCharacterPrompt = `Sen bir senaryo analiz uzmanısın. Aşağıdaki senaryodaki karakterleri analiz et:

SENARYO:
${textToAnalyze}

Lütfen JSON formatında yanıt ver:
{
  "characters": [
    {
      "name": "Karakter İsmi",
      "age": "yaş aralığı",
      "physical": "fiziksel özellikler",
      "personality": "kişilik özellikleri",
      "role": "ana/yan karakter"
    }
  ]
}`;

      const characterResult = await getAIHandler().generateText(
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

SENARYO:
${textToAnalyze}

Lütfen JSON formatında yanıt ver:
{
  "locations": [
    {
      "name": "Mekan İsmi",
      "type": "İç/Dış Mekan",
      "time": "Gündüz/Gece",
      "description": "detaylı açıklama",
      "atmosphere": "atmosfer",
      "lighting": "aydınlatma"
    }
  ]
}`;

      const locationResult = await getAIHandler().generateText(
        'Sen bir senaryo analiz uzmanısın.',
        shortLocationPrompt,
        { timeout: 300000 } // 5 dakika
      );

      // JSON parse etmeye çalış
      try {
        // Ham sonuçları logla
        console.log('🔍 Ham karakter sonucu:', characterResult.substring(0, 500));
        console.log('🔍 Ham mekan sonucu:', locationResult.substring(0, 500));

        // JSON formatını temizle
        let cleanCharacterResult = characterResult.replace(/```json|```/g, '').trim();
        let cleanLocationResult = locationResult.replace(/```json|```/g, '').trim();

        // İlk ve son satırları kontrol et (bazen açıklama gelir)
        if (!cleanCharacterResult.startsWith('{')) {
          const jsonStart = cleanCharacterResult.indexOf('{');
          if (jsonStart > -1) {
            cleanCharacterResult = cleanCharacterResult.substring(jsonStart);
          }
        }
        if (!cleanLocationResult.startsWith('{')) {
          const jsonStart = cleanLocationResult.indexOf('{');
          if (jsonStart > -1) {
            cleanLocationResult = cleanLocationResult.substring(jsonStart);
          }
        }

        const characterData = JSON.parse(cleanCharacterResult);
        const locationData = JSON.parse(cleanLocationResult);

        // Veri doğrulama
        if (!characterData.characters || !Array.isArray(characterData.characters)) {
          throw new Error('Karakter listesi bulunamadı');
        }
        if (!locationData.locations || !Array.isArray(locationData.locations)) {
          throw new Error('Mekan listesi bulunamadı');
        }

        setCharacterAnalysis(characterData);
        setLocationAnalysis(locationData);

        setStoryboardProgress({ message: 'Karakter ve mekan analizi tamamlandı!', progress: 100 });

        console.log('✅ Karakter ve mekan analizi tamamlandı:', {
          characters: characterData.characters.length,
          locations: locationData.locations.length
        });
        console.log('📋 Bulunan karakterler:', characterData.characters.map(c => c.name).join(', '));
        console.log('📋 Bulunan mekanlar:', locationData.locations.map(l => l.name).join(', '));

        // 🎨 Otomatik karakter görseli oluşturma başlat
        await autoGenerateCharacterImages(characterData.characters);

      } catch (parseError) {
        console.error('❌ JSON parse hatası:', parseError);
        console.log('Ham karakter yanıtı:', characterResult);
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

      const styleResult = await getAIHandler().generateText(
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

  // Aşama 4: Final Storyboard Üretimi
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
        await analyzeCharactersAndLocations();
        break;
      case 2:
        await analyzeStyleAndColors();
        break;
      case 3:
        await generateFinalStoryboard();
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

      <div className="professional-storyboard flex flex-col h-full bg-cinema-black">
        <div className="p-4 lg:p-6 flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {/* Progress panel removed per user request */}
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  🎨 Storyboard
                </h1>
                <p className="text-cinema-text-dim">
                  Senaryonuzdan profesyonel storyboard oluşturun
                </p>
              </div>
              {(characterAnalysis || styleAnalysis || Object.keys(characterReferences).length > 0) && (
                <button
                  onClick={() => {
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
                      setCurrentStep(1);

                      // Clear from cache
                      if (currentScript?.name) {
                        const storageKey = `storyboard_${currentScript.name}`;
                        localStorage.removeItem(storageKey);
                        console.log('🗑️ Storyboard data cleared');
                      }
                    }
                  }}
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm transition-colors border border-red-500/30"
                >
                  🗑️ Sıfırla
                </button>
              )}
            </div>

            {/* Modern Wizard Progress Steps */}
            <div className="mb-8 bg-cinema-dark rounded-xl p-6 border border-cinema-gray">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
                {steps.map((step, index) => (
                  <React.Fragment key={step.id}>
                    <div className={`
                relative p-4 rounded-lg border-2 transition-all cursor-pointer
                ${step.status === 'completed' ? 'border-green-500 bg-green-500/10' :
                        step.status === 'processing' ? 'border-cinema-accent bg-cinema-accent/10 animate-pulse' :
                          currentStep === step.id ? 'border-cinema-accent bg-cinema-accent/5' :
                            'border-cinema-gray bg-cinema-gray/30 opacity-60'}
              `}>
                      {/* Step number badge */}
                      <div className={`
                  absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                  ${step.status === 'completed' ? 'bg-green-500 text-white' :
                          step.status === 'processing' ? 'bg-cinema-accent text-cinema-black' :
                            currentStep === step.id ? 'bg-cinema-accent text-cinema-black' :
                              'bg-cinema-gray text-cinema-text-dim'}
                `}>
                        {step.status === 'completed' ? '✓' : step.id}
                      </div>

                      {/* Step content */}
                      <div className="mt-2">
                        <h3 className={`font-semibold text-sm mb-1 ${step.status === 'completed' || step.status === 'processing' || currentStep === step.id
                            ? 'text-white' : 'text-cinema-text-dim'
                          }`}>
                          {step.title}
                        </h3>
                        <p className="text-xs text-cinema-text-dim">
                          {step.description}
                        </p>
                      </div>

                      {/* Status icon */}
                      <div className="absolute top-4 right-4">
                        {step.status === 'completed' && <span className="text-green-500 text-xl">✓</span>}
                        {step.status === 'processing' && <span className="text-cinema-accent text-xl animate-spin">⚙️</span>}
                      </div>
                    </div>

                    {/* Connection line */}
                    {index < steps.length - 1 && (
                      <div className="hidden md:flex items-center justify-center absolute left-1/4 right-3/4 top-1/2 transform -translate-y-1/2"
                        style={{ left: `${(index + 1) * 25 - 2}%`, width: '4%' }}>
                        <div className={`h-0.5 w-full ${steps[index + 1].status === 'completed' || steps[index + 1].status === 'processing'
                            ? 'bg-cinema-accent' : 'bg-cinema-gray'
                          }`} />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Current Step Content */}
            <div className="bg-cinema-dark rounded-xl border border-cinema-gray p-6 mb-6">
              {currentStep === 1 && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-cinema-accent rounded-lg flex items-center justify-center text-2xl">
                      🎭
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white">Karakter ve Mekan Analizi</h2>
                      <p className="text-cinema-text-dim text-sm">
                        Senaryodaki karakterler ve mekanlar AI tarafından analiz ediliyor
                      </p>
                    </div>
                  </div>

                  {(!characterAnalysis || !locationAnalysis) && !isStoryboardProcessing ? (
                    <div className="text-center py-8">
                      <div className="flex flex-col gap-4 items-center">
                        <button
                          onClick={() => executeStep(1)}
                          disabled={isProcessing || isStoryboardProcessing || !isConfigured() || !aiHandler}
                          className="bg-cinema-accent hover:bg-cinema-accent/90 text-cinema-black px-8 py-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg transition-all transform hover:scale-105"
                        >
                          {(isProcessing || isStoryboardProcessing) ? '🔄 Analiz Ediliyor...' :
                            !isConfigured() ? '⚠️ AI Ayarları Gerekli' :
                              !aiHandler ? '⏳ Yükleniyor...' :
                                '🚀 Analizi Başlat'}
                        </button>

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
                      {!isConfigured() && (
                        <p className="mt-4 text-cinema-text-dim text-sm">
                          Ayarlar {'>'} AI Sağlayıcıları bölümünden API key ekleyin
                        </p>
                      )}
                    </div>
                  ) : (!characterAnalysis || !locationAnalysis) && isStoryboardProcessing ? (
                    <div className="text-center py-12">
                      <div className="flex flex-col gap-4 items-center max-w-md mx-auto">
                        <div className="text-6xl mb-4 animate-spin">🎭</div>
                        <h3 className="text-2xl font-semibold text-cinema-accent mb-2">
                          🔄 Karakter ve Mekan Analizi
                        </h3>

                        <p className="text-cinema-text-dim text-lg mb-6">
                          Senaryodaki karakterler ve mekanlar AI tarafından analiz ediliyor...
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
                    <div className="space-y-6">
                      {/* Character Visualization and Image Generation */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-lg font-semibold text-cinema-accent">👥 Karakterler</span>
                          <span className="text-sm text-cinema-text-dim">
                            ({characterAnalysis?.characters?.length || 0} karakter analiz edildi)
                          </span>
                        </div>

                        {/* Character Images Section */}
                        <div className="mb-6">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-semibold text-cinema-text">🎨 Karakter Görselleri</h3>
                            {Object.keys(characterImages).length > 0 && (
                              <span className="text-sm text-cinema-accent">
                                {Object.keys(characterImages).length} görsel oluşturuldu
                              </span>
                            )}
                          </div>

                          {Object.keys(characterImages).length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                              {Object.entries(characterImages).map(([characterName, imageData]) => (
                                <div key={characterName} className="bg-cinema-gray rounded-lg border border-cinema-gray-light p-4">
                                  <div className="text-sm font-semibold text-cinema-accent mb-2">
                                    {characterName}
                                  </div>
                                  <img
                                    src={imageData.url}
                                    alt={`${characterName} character visual`}
                                    className="w-full h-48 object-cover rounded border border-cinema-gray cursor-pointer hover:border-cinema-accent transition-colors"
                                    onClick={() => openImageModal(imageData)}
                                    title="Görseli büyütmek için tıklayın"
                                  />
                                  <div className="text-xs text-cinema-text-dim mt-2">
                                    🕐 {new Date(imageData.timestamp).toLocaleString('tr-TR')}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : characterAnalysis?.characters?.length > 0 && (
                            <div className="text-center py-6 bg-cinema-gray/50 rounded-lg border border-cinema-gray">
                              <div className="text-4xl mb-3 text-cinema-text-dim">🎨</div>
                              <p className="text-cinema-text-dim mb-4">Karakter görselleri otomatik oluşturuldu</p>
                              <p className="text-xs text-cinema-text-dim">
                                Yukarıdaki analiz adımında karakter görselleri otomatik olarak üretildi
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Individual Character Image Generators */}
                        {characterAnalysis?.characters?.map((character, index) => (
                          <CharacterImageGenerator
                            key={character.name + index}
                            character={character}
                            onImageGenerated={(characterName, imageData) => {
                              setCharacterImages(prev => ({
                                ...prev,
                                [characterName]: imageData
                              }));
                            }}
                          />
                        ))}
                      </div>

                      {/* Original Character Visualization */}
                      <CharacterVisualization
                        characterAnalysis={characterAnalysis}
                        locationAnalysis={locationAnalysis}
                        onCharactersUpdated={(updated) => {
                          setCharacterAnalysis(updated.characters);
                          setLocationAnalysis(updated.locations);
                        }}
                        onContinue={() => setCurrentStep(2)}
                      />
                    </div>
                  )}
                </div>
              )}

              {currentStep === 2 && (
                <div>
                  <h2 className="text-xl font-semibold mb-4">2. Stil ve Renk Paleti</h2>
                  <p className="text-gray-600 mb-4">
                    Görsel stil, renk paleti ve sinematik dil belirlenecek.
                  </p>

                  {!styleAnalysis && !isStoryboardProcessing ? (
                    <button
                      onClick={() => executeStep(2)}
                      disabled={isProcessing || isStoryboardProcessing || !characterAnalysis || !locationAnalysis || !isConfigured() || !aiHandler}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg disabled:opacity-50"
                    >
                      {(isProcessing || isStoryboardProcessing) ? 'Stil Analizi Yapılıyor...' :
                        !characterAnalysis || !locationAnalysis ? 'Önce 1. Aşamayı Tamamlayın' :
                          !isConfigured() ? 'AI Ayarları Gerekli' :
                            !aiHandler ? 'AI Handler Yükleniyor...' :
                              'Stil ve Renk Analizini Başlat'}
                    </button>
                  ) : !styleAnalysis && isStoryboardProcessing ? (
                    <div className="text-center py-12">
                      <div className="flex flex-col gap-4 items-center max-w-md mx-auto">
                        <div className="text-6xl mb-4 animate-spin">🎨</div>
                        <h3 className="text-2xl font-semibold text-blue-400 mb-2">
                          🔄 Stil ve Renk Analizi
                        </h3>

                        <p className="text-gray-400 text-lg">
                          Görsel stil ve renk paleti belirleniyor...
                        </p>
                      </div>
                    </div>
                  ) : !styleAnalysis && isStoryboardProcessing ? (
                    <div className="text-center py-12">
                      <div className="flex flex-col gap-4 items-center">
                        <div className="text-6xl mb-4 animate-spin">🎨</div>
                        <h3 className="text-2xl font-semibold text-blue-400 mb-2">
                          🔄 Stil Analizi Devam Ediyor
                        </h3>
                        <p className="text-gray-400 text-lg">
                          Görsel stil ve renk paleti belirleniyor...
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-gray-700 rounded-lg p-4 bg-gray-800">
                      <h3 className="font-semibold text-green-400 mb-3">✅ Stil Analizi Tamamlandı</h3>
                      {styleAnalysis.visualStyle ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="text-gray-200">
                            <strong className="text-blue-400">Görsel Stil:</strong> {styleAnalysis.visualStyle}<br />
                            <strong className="text-blue-400">Aydınlatma:</strong> {styleAnalysis.lightingStyle}<br />
                            <strong className="text-blue-400">Atmosfer:</strong> {styleAnalysis.atmosphere}
                          </div>
                          <div className="text-gray-200">
                            <strong className="text-blue-400">Ana Renkler:</strong>
                            <div className="flex gap-2 mt-1">
                              {(styleAnalysis.primaryColors || colorPalette)?.map((color, index) => (
                                <div key={index} className="w-8 h-8 rounded border border-gray-600" style={{ backgroundColor: color }} title={color}></div>
                              )) || (
                                  <span className="text-gray-400 text-sm">Renk paleti belirlenmedi</span>
                                )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <pre className="text-xs bg-gray-700 text-gray-200 p-3 rounded overflow-auto max-h-32 border border-gray-600">
                          {styleAnalysis.text}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              )}

              {currentStep === 3 && (
                <div>
                  <h2 className="text-xl font-semibold mb-4">3. Final Storyboard</h2>
                  <p className="text-gray-600 mb-4">
                    Karakter ve stil analizine dayalı profesyonel storyboard sahneleri oluşturacağız.
                  </p>

                  {Object.keys(finalStoryboard).length === 0 && !isStoryboardProcessing ? (
                    <button
                      onClick={generateFinalStoryboard}
                      disabled={isProcessing || isStoryboardProcessing || !styleAnalysis || !isConfigured() || !aiHandler}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg disabled:opacity-50"
                    >
                      {(isProcessing || isStoryboardProcessing) ? 'Final Storyboard Oluşturuluyor...' :
                        !styleAnalysis ? 'Önce 2. Aşamayı Tamamlayın' :
                          !isConfigured() ? 'AI Ayarları Gerekli' :
                            !aiHandler ? 'AI Handler Yükleniyor...' :
                              'Final Storyboard Üretimini Başlat'}
                    </button>
                  ) : Object.keys(finalStoryboard).length === 0 && isStoryboardProcessing ? (
                    <div className="text-center py-12">
                      <div className="flex flex-col gap-4 items-center max-w-md mx-auto">
                        <div className="text-6xl mb-4 animate-spin">🎬</div>
                        <h3 className="text-2xl font-semibold text-green-400 mb-2">
                          🔄 Final Storyboard
                        </h3>

                        <p className="text-gray-400 text-lg">
                          Profesyonel storyboard üretimi devam ediyor...
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-gray-700 rounded-lg p-4 bg-gray-800">
                      <h3 className="font-semibold text-green-400 mb-3">✅ Referans Görseller Oluşturuldu</h3>

                      {/* Karakter Referansları */}
                      {Object.keys(characterReferences).length > 0 && (
                        <div className="mb-6">
                          <h4 className="font-semibold mb-3 text-blue-400">Karakter Referansları ({Object.keys(characterReferences).length})</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Object.entries(characterReferences).map(([name, ref]) => (
                              <div key={name} className="border border-gray-700 rounded-lg p-3 bg-gray-800">
                                <h5 className="font-semibold mb-2 text-gray-200">{name}</h5>
                                <img
                                  src={ref.referenceImage}
                                  alt={`${name} referansı`}
                                  className="w-full h-40 object-cover rounded mb-2 cursor-pointer hover:border hover:border-cinema-accent transition-colors"
                                  onClick={() => openImageModal({ url: ref.referenceImage, character: name, type: 'reference' })}
                                  title="Görseli büyütmek için tıklayın"
                                />
                                <p className="text-xs text-gray-400">{ref.physical}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Mekan Referansları */}
                      {Object.keys(locationReferences).length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-3 text-blue-400">Mekan Referansları ({Object.keys(locationReferences).length})</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Object.entries(locationReferences).map(([name, ref]) => (
                              <div key={name} className="border border-gray-700 rounded-lg p-3 bg-gray-800">
                                <h5 className="font-semibold mb-2 text-gray-200">{name}</h5>
                                <img
                                  src={ref.referenceImage}
                                  alt={`${name} referansı`}
                                  className="w-full h-40 object-cover rounded mb-2 cursor-pointer hover:border hover:border-cinema-accent transition-colors"
                                  onClick={() => openImageModal({ url: ref.referenceImage, location: name, type: 'location_reference' })}
                                  title="Görseli büyütmek için tıklayın"
                                />
                                className="w-full h-40 object-cover rounded mb-2"
                          />
                                <p className="text-xs text-gray-600">{ref.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {currentStep === 4 && (
                <div>
                  <h2 className="text-xl font-semibold mb-4">4. Final Storyboard</h2>
                  <p className="text-gray-600 mb-4">
                    Tutarlı stil ile profesyonel storyboard üretimi yapılacak.
                  </p>

                  {Object.keys(finalStoryboard).length === 0 && !isStoryboardProcessing ? (
                    <button
                      onClick={() => executeStep(4)}
                      disabled={isProcessing || isStoryboardProcessing || Object.keys(characterReferences).length === 0 || !isConfigured() || !aiHandler}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg disabled:opacity-50"
                    >
                      {(isProcessing || isStoryboardProcessing) ? 'Final Storyboard Oluşturuluyor...' :
                        Object.keys(characterReferences).length === 0 ? 'Önce 3. Aşamayı Tamamlayın' :
                          !isConfigured() ? 'AI Ayarları Gerekli' :
                            !aiHandler ? 'AI Handler Yükleniyor...' :
                              'Final Storyboard Üretimini Başlat'}
                    </button>
                  ) : Object.keys(finalStoryboard).length === 0 && isStoryboardProcessing ? (
                    <div className="text-center py-12">
                      <div className="flex flex-col gap-4 items-center max-w-md mx-auto">
                        <div className="text-6xl mb-4 animate-spin">🎬</div>
                        <h3 className="text-2xl font-semibold text-green-400 mb-2">
                          🔄 Final Storyboard
                        </h3>

                        <p className="text-gray-400 text-lg">
                          Profesyonel storyboard üretimi devam ediyor...
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-gray-700 rounded-lg p-4 bg-gray-800">
                      <h3 className="font-semibold text-green-400 mb-3">
                        ✅ Profesyonel Storyboard Tamamlandı ({Object.keys(finalStoryboard).length} sahne)
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {storyboardScenes.map((scene, index) => (
                          <div key={index} className="border border-gray-700 rounded-lg p-4 bg-gray-800">
                            <div className="flex justify-between items-start mb-3">
                              <h4 className="font-semibold text-blue-400">Frame {scene.frameNumber}</h4>
                              <span className="text-sm text-gray-400">{scene.title}</span>
                            </div>
                            <img
                              src={scene.storyboardImage}
                              alt={`Storyboard frame ${scene.frameNumber}`}
                              className="w-full h-48 object-cover rounded mb-3 cursor-pointer hover:border hover:border-cinema-accent transition-colors"
                              onClick={() => openImageModal({ url: scene.storyboardImage, scene: scene.title, frame: scene.frameNumber, type: 'storyboard' })}
                              title="Görseli büyütmek için tıklayın"
                            />
                            <p className="text-sm text-gray-300">{scene.text}</p>
                          </div>
                        ))}
                      </div>
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
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
              >
                Önceki Aşama
              </button>

              <button
                onClick={() => setCurrentStep(Math.min(3, currentStep + 1))}
                disabled={currentStep === 3}
                className="bg-cinema-gray hover:bg-cinema-gray-light text-white px-6 py-3 rounded-lg disabled:opacity-50 transition-colors font-medium"
              >
                Sonraki Adım →
              </button>
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
    </>
  );
}