import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Translation resources
const resources = {
  tr: {
    translation: {
      // Navigation & UI
      "nav.editor": "Editör",
      "nav.analysis": "Analiz",
      "nav.speedReader": "Hızlı Okuma",
      "nav.aiSettings": "AI Ayarları",
      "nav.promptsTab": "Komutlar",
      "nav.providersTab": "Sağlayıcılar",
      
      // Analysis Panel
      "analysis.title": "AI Analizi",
      "analysis.runAnalysis": "Analizi Başlat",
      "analysis.analyzing": "Analiz Ediliyor...",
      "analysis.exportAnalysis": "Analizi Dışa Aktar",
      "analysis.noAnalysisYet": "Henüz Analiz Yok",
      "analysis.noAnalysisYetDesc": "AI destekli prodüksiyon detayları için 'Analizi Başlat' butonuna tıklayın",
      "analysis.configureFirst": "Önce Ayarlarda AI Sağlayıcınızı yapılandırın",
      
      // Analysis Configuration
      "analysis.config.title": "Analiz Yapılandırması",
      "analysis.config.analysisMode": "Analiz Modu:",
      "analysis.config.custom": "Özel",
      "analysis.config.standard": "Standart",
      "analysis.config.selectCustom": "Özel Analiz Türü Seçin:",
      "analysis.config.customDesc": "Özel Analiz: Özel komutlarınızı kullanarak özelleştirilmiş analiz. Sonuçlar özel sekmede formatlanmış metin olarak görünür.",
      "analysis.config.standardDesc": "Standart Analiz: Karakterler, mekanlar, sahneler ve prodüksiyon gereksinimlerini içeren kapsamlı senaryo analizi.",
      
      // Analysis Tabs
      "analysis.tabs.overview": "Genel Bakış",
      "analysis.tabs.scenes": "Sahneler",
      "analysis.tabs.locations": "Mekanlar",
      "analysis.tabs.characters": "Karakterler",
      "analysis.tabs.equipment": "Ekipman",
      "analysis.tabs.vfx": "VFX/SFX",
      "analysis.tabs.virtualProduction": "Sanal Prodüksiyon",
      "analysis.tabs.evaluation": "Değerlendirme",
      "analysis.tabs.audience": "Kitle",
      "analysis.tabs.competitive": "Rekabet",
      "analysis.tabs.geographic": "Coğrafi",
      "analysis.tabs.trend": "Trendler",
      "analysis.tabs.risk": "Risk & Fırsat",
      "analysis.tabs.customResults": "Özel Sonuçlar",
      
      // Export
      "export.json": "JSON (Veri)",
      "export.pdf": "PDF (Rapor)",
      "export.docx": "Word Belgesi",
      "export.success": "Analiz başarıyla {{format}} olarak dışa aktarıldı!",
      "export.failed": "Dışa aktarma başarısız: {{error}}",
      
      // Overview Tab
      "overview.title": "Prodüksiyon Genel Bakışı",
      "overview.desc": "Senaryo analizi ve prodüksiyon gereksinimlerinin kapsamlı özeti",
      "overview.scenes": "Sahneler",
      "overview.locations": "Mekanlar", 
      "overview.characters": "Karakterler",
      "overview.shootDays": "Çekim Günleri",
      "overview.productionScope": "Prodüksiyon Kapsamı",
      "overview.analysisSummary": "Analiz Özeti",
      "overview.equipmentItems": "Ekipman Öğeleri:",
      "overview.vfxSequences": "VFX Sekansları:",
      "overview.sfxRequirements": "SFX İhtiyaçları:",
      "overview.virtualProduction": "Sanal Prodüksiyon:",
      "overview.genre": "Tür:",
      "overview.emotionScore": "Duygu Puanı:",
      "overview.targetDuration": "Hedef Süre:",
      "overview.primaryAudience": "Birincil Kitle:",
      
      // Scenes Tab
      "scenes.title": "Sahne Dökümü",
      "scenes.desc": "Prodüksiyon gereksinimleri ile {{count}} sahnenin detaylı analizi",
      "scenes.noScenes": "Analizde sahne tespit edilmedi",
      "scenes.technicalDetails": "Teknik Detaylar",
      "scenes.characters": "Karakterler",
      "scenes.noCharactersSpecified": "Karakter belirtilmedi",
      
      // Locations Tab
      "locations.title": "Çekim Mekanları",
      "locations.desc": "{{count}} benzersiz mekan için prodüksiyon gereksinimleri",
      "locations.noLocations": "Analizde mekan tespit edilmedi",
      "locations.scenes": "Sahneler:",
      "locations.shootDays": "Çekim Günleri:",
      "locations.requirements": "Gereksinimler",
      "locations.more": "+{{count}} daha",
      
      // Characters Tab
      "characters.title": "Karakter Analizi",
      "characters.desc": "{{count}} tespit edilen karakter için oyuncu kadrosu ve karakter dökümü",
      "characters.noCharacters": "Analizde karakter tespit edilmedi",
      "characters.sceneAppearances": "Sahne Görünümleri",
      "characters.keyRelationships": "Temel İlişkiler",
      "characters.notes": "Notlar:",
      
      // Equipment Tab
      "equipment.title": "Prodüksiyon Ekipmanı",
      "equipment.desc": "Prodüksiyon için ekipman gereksinimleri ve teknik ihtiyaçlar",
      "equipment.noEquipment": "Özel ekipman gereksinimi tespit edilmedi",
      "equipment.items": "öğe",
      "equipment.requiredForScenes": "Gerekli sahneler",
      "equipment.priority": "Öncelik",
      "equipment.estimatedCost": "Tahmini Maliyet:",
      
      // VFX Tab
      "vfx.title": "VFX & SFX Gereksinimleri",
      "vfx.desc": "Prodüksiyon planlama için görsel ve ses efektleri analizi",
      "vfx.noRequirements": "VFX veya SFX gereksinimi tespit edilmedi",
      "vfx.visualEffects": "Görsel Efektler",
      "vfx.soundEffects": "Ses Efektleri",
      "vfx.complexity": "Karmaşıklık",
      "vfx.high": "Yüksek",
      "vfx.medium": "Orta",
      "vfx.low": "Düşük",
      "vfx.scenes": "Sahneler:",
      "vfx.estimatedCost": "Tahmini Maliyet:",
      "vfx.timeline": "Zaman Çizelgesi:",
      "vfx.type": "Tür:",
      "vfx.recordingRequired": "Kayıt Gerekli:",
      "vfx.yes": "Evet",
      "vfx.library": "Kütüphane",
      
      // Virtual Production Tab
      "virtualProduction.title": "Sanal Prodüksiyon Değerlendirmesi",
      "virtualProduction.desc": "Sanal prodüksiyon uygunluğu ve çekim teknikleri analizi",
      "virtualProduction.noAnalysis": "Sanal prodüksiyon analizi mevcut değil",
      "virtualProduction.overallSuitability": "Genel Uygunluk",
      "virtualProduction.notAssessed": "Değerlendirilmedi",
      "virtualProduction.environmentSuitability": "Çevre Uygunluğu",
      "virtualProduction.technicalRequirements": "Teknik Gereksinimler",
      "virtualProduction.controlledEnvironments": "Kontrollü Çevreler:",
      "virtualProduction.cgiIntegration": "CGI Entegrasyonu:",
      "virtualProduction.ledVolumeReady": "LED Volume Hazır:",
      "virtualProduction.realTimeRendering": "Gerçek Zamanlı Render:",
      "virtualProduction.motionCapture": "Motion Capture:",
      "virtualProduction.cameraTracking": "Kamera Takibi:",
      
      // Evaluation Tab
      "evaluation.title": "Senaryo Değerlendirmesi",
      "evaluation.desc": "Senaryo kalitesi ve prodüksiyon metriklerinin kapsamlı değerlendirmesi",
      "evaluation.noEvaluation": "Senaryo değerlendirmesi mevcut değil",
      "evaluation.emotionScore": "Duygu Puanı",
      "evaluation.primaryGenre": "Birincil Tür",
      "evaluation.duration": "Süre",
      "evaluation.complexity": "Karmaşıklık",
      
      // Audience Tab
      "audience.title": "Kitle & Platform Analizi",
      "audience.desc": "Hedef kitle demografisi ve platform uygunluk değerlendirmesi",
      "audience.noAnalysis": "Kitle analizi mevcut değil",
      "audience.primaryAgeGroup": "Birincil Yaş Grubu",
      "audience.primaryRegion": "Birincil Bölge",
      "audience.recommendedRating": "Önerilen Yaş Sınırı",
      "audience.global": "Küresel",
      "analysis.tabs.audience.noData": "Kitle analizi mevcut değil",
      "analysis.tabs.audience.title": "Kitle & Platform Analizi",
      "analysis.tabs.audience.subtitle": "Hedef kitle demografisi ve platform uygunluğu",
      "analysis.tabs.audience.demographics": "Hedef Demografi",
      "analysis.tabs.audience.age": "Birincil Yaş Grubu",
      "analysis.tabs.audience.gender": "Cinsiyet Dağılımı",
      "analysis.tabs.audience.psychographics": "Psikografik",
      "analysis.tabs.audience.platform": "Platform Uygunluğu",
      "analysis.tabs.audience.primaryPlatform": "Birincil Platform",
      "analysis.tabs.audience.secondaryPlatform": "İkincil Platform",

      // Competitive Tab
      "analysis.tabs.competitive.noData": "Rekabet analizi mevcut değil",
      "analysis.tabs.competitive.title": "Rekabet Analizi",
      "analysis.tabs.competitive.subtitle": "Pazar konumu ve rekabet ortamı değerlendirmesi",
      "analysis.tabs.competitive.score": "Rekabet Puanı",
      "analysis.tabs.competitive.marketPosition": "Pazar Konumu",
      "analysis.tabs.competitive.uniqueness": "Benzersizlik Puanı",
      "analysis.tabs.competitive.comparableFilms": "Benzer Filmler",
      "analysis.tabs.competitive.match": "Eşleşme",
      "analysis.tabs.competitive.recommendations": "Stratejik Öneriler",

      // Geographic Tab
      "analysis.tabs.geographic.noData": "Coğrafi analiz mevcut değil",
      "analysis.tabs.geographic.title": "Coğrafi Pazar Analizi",
      "analysis.tabs.geographic.subtitle": "Bölgesel pazar potansiyeli ve yerelleştirme stratejileri",
      "analysis.tabs.geographic.globalPotential": "Küresel Potansiyel",
      "analysis.tabs.geographic.appealScore": "Genel Küresel Çekicilik Puanı",
      "analysis.tabs.geographic.universality": "Kültürel Evrensellik",
      "analysis.tabs.geographic.localization": "Yerelleştirme Karmaşıklığı",
      "analysis.tabs.geographic.topMarkets": "En İyi Pazarlar",

      // Trend Tab
      "analysis.tabs.trend.noData": "Trend analizi mevcut değil",
      "analysis.tabs.trend.title": "Trend Analizi",
      "analysis.tabs.trend.subtitle": "Endüstri trend uyumu ve zamanlama optimizasyonu",
      "analysis.tabs.trend.alignment": "Trend Uyumu",
      "analysis.tabs.trend.timing": "Zamanlama Stratejisi",
      "analysis.tabs.trend.platform": "En İyi Platform",
      "analysis.tabs.trend.identified": "Tespit Edilen Trendler",

      // Risk Tab
      "analysis.tabs.risk.noData": "Risk analizi mevcut değil",
      "analysis.tabs.risk.title": "Risk & Fırsat Değerlendirmesi",
      "analysis.tabs.risk.subtitle": "Proje risk profili ve stratejik fırsatlar",
      "analysis.tabs.risk.factors": "Risk Faktörleri",
      "analysis.tabs.risk.opportunities": "Fırsatlar",
      "analysis.tabs.risk.impact": "Etki",
      
      // Custom Analysis Tab
      "custom.title": "Özel Analiz Sonuçları",
      "custom.desc": "Özel komutlarınızdan özelleştirilmiş analiz sonuçları",
      "custom.noResults": "Henüz özel analiz sonucu yok",
      "custom.runCustom": "Burada sonuçları görmek için özel analiz çalıştırın",
      "custom.copyText": "Metni Kopyala",
      
      // Common
      "common.tbd": "Belirlenmedi",
      "common.notScored": "Puanlanmadı",
      "common.general": "Genel",
      "common.priority": "öncelik",
      "common.items": "öğe",
      "common.clickToView": "Detayları görmek için tıklayın",
      
      // File Uploader
      "uploader.processing": "Dosya işleniyor...",
      "uploader.dropHere": "Senaryonuzu buraya bırakın",
      "uploader.extracting": "Metin çıkarılıyor ve temizleniyor...",
      "uploader.dragOrClick": "Senaryo dosyasını sürükleyip bırakın veya seçmek için tıklayın",
      "uploader.supportedFormats": "Desteklenen formatlar",
      "uploader.selectFile": "Senaryo Dosyası Seç"
    }
  },
  en: {
    translation: {
      // Navigation & UI
      "nav.editor": "Editor",
      "nav.analysis": "Analysis",
      "nav.speedReader": "Speed Reader",
      "nav.aiSettings": "AI Settings",
      "nav.promptsTab": "Prompts",
      "nav.providersTab": "Providers",
      
      // Analysis Panel
      "analysis.title": "AI Analysis",
      "analysis.runAnalysis": "Run Analysis",
      "analysis.analyzing": "Analyzing...",
      "analysis.exportAnalysis": "Export Analysis",
      "analysis.noAnalysisYet": "No Analysis Yet",
      "analysis.noAnalysisYetDesc": "Click 'Run Analysis' to get AI-powered production breakdown including scenes, locations, characters, and equipment needs.",
      "analysis.configureFirst": "Please configure your AI provider in Settings first",
      
      // Analysis Configuration
      "analysis.config.title": "Analysis Configuration",
      "analysis.config.analysisMode": "Analysis Mode:",
      "analysis.config.custom": "Custom",
      "analysis.config.standard": "Standard",
      "analysis.config.selectCustom": "Select Custom Analysis Type:",
      "analysis.config.customDesc": "Custom Analysis: Uses your predefined prompts for specialized analysis. Results will appear in a dedicated Custom tab with formatted text output.",
      "analysis.config.standardDesc": "Standard Analysis: Comprehensive screenplay breakdown including characters, locations, scenes, and production requirements.",
      
      // Analysis Tabs
      "analysis.tabs.overview": "Overview",
      "analysis.tabs.scenes": "Scenes",
      "analysis.tabs.locations": "Locations",
      "analysis.tabs.characters": "Characters",
      "analysis.tabs.equipment": "Equipment",
      "analysis.tabs.vfx": "VFX/SFX",
      "analysis.tabs.virtualProduction": "Virtual Production",
      "analysis.tabs.evaluation": "Evaluation",
      "analysis.tabs.audience": "Audience",
      "analysis.tabs.competitive": "Competitive",
      "analysis.tabs.geographic": "Geographic",
      "analysis.tabs.trend": "Trends",
      "analysis.tabs.risk": "Risk & Opp",
      "analysis.tabs.customResults": "Custom Results",
      
      // Export
      "export.json": "JSON (Data)",
      "export.pdf": "PDF (Report)",
      "export.docx": "Word Document",
      "export.success": "Analysis exported successfully as {{format}}!",
      "export.failed": "Export failed: {{error}}",
      
      // Overview Tab
      "overview.title": "Production Overview",
      "overview.desc": "Comprehensive summary of screenplay analysis and production requirements",
      "overview.scenes": "Scenes",
      "overview.locations": "Locations",
      "overview.characters": "Characters", 
      "overview.shootDays": "Shoot Days",
      "overview.productionScope": "Production Scope",
      "overview.analysisSummary": "Analysis Summary",
      "overview.equipmentItems": "Equipment Items:",
      "overview.vfxSequences": "VFX Sequences:",
      "overview.sfxRequirements": "SFX Requirements:",
      "overview.virtualProduction": "Virtual Production:",
      "overview.genre": "Genre:",
      "overview.emotionScore": "Emotion Score:",
      "overview.targetDuration": "Target Duration:",
      "overview.primaryAudience": "Primary Audience:",
      
      // Scenes Tab
      "scenes.title": "Scene Breakdown",
      "scenes.desc": "Detailed analysis of {{count}} scenes with production requirements",
      "scenes.noScenes": "No scenes detected in analysis",
      "scenes.technicalDetails": "Technical Details",
      "scenes.characters": "Characters",
      "scenes.noCharactersSpecified": "No characters specified",
      
      // Locations Tab
      "locations.title": "Filming Locations",
      "locations.desc": "Production requirements for {{count}} unique locations",
      "locations.noLocations": "No locations detected in analysis",
      "locations.scenes": "Scenes:",
      "locations.shootDays": "Shoot Days:",
      "locations.requirements": "Requirements",
      "locations.more": "+{{count}} more",
      
      // Characters Tab
      "characters.title": "Character Analysis",
      "characters.desc": "Cast and character breakdown for {{count}} identified characters",
      "characters.noCharacters": "No characters detected in analysis",
      "characters.sceneAppearances": "Scene Appearances",
      "characters.keyRelationships": "Key Relationships",
      "characters.notes": "Notes:",
      
      // Equipment Tab
      "equipment.title": "Production Equipment",
      "equipment.desc": "Equipment requirements and technical needs for production",
      "equipment.noEquipment": "No special equipment requirements detected",
      "equipment.items": "items",
      "equipment.requiredForScenes": "Required for scenes",
      "equipment.priority": "Priority",
      "equipment.estimatedCost": "Est. Cost:",
      
      // VFX Tab
      "vfx.title": "VFX & SFX Requirements",
      "vfx.desc": "Visual and sound effects analysis for production planning",
      "vfx.noRequirements": "No VFX or SFX requirements detected",
      "vfx.visualEffects": "Visual Effects",
      "vfx.soundEffects": "Sound Effects",
      "vfx.complexity": "Complexity",
      "vfx.high": "High",
      "vfx.medium": "Medium",
      "vfx.low": "Low",
      "vfx.scenes": "Scenes:",
      "vfx.estimatedCost": "Estimated Cost:",
      "vfx.timeline": "Timeline:",
      "vfx.type": "Type:",
      "vfx.recordingRequired": "Recording Required:",
      "vfx.yes": "Yes",
      "vfx.library": "Library",
      
      // Virtual Production Tab
      "virtualProduction.title": "Virtual Production Assessment",
      "virtualProduction.desc": "Analysis of virtual production suitability and shooting techniques",
      "virtualProduction.noAnalysis": "No virtual production analysis available",
      "virtualProduction.overallSuitability": "Overall Suitability",
      "virtualProduction.notAssessed": "Not Assessed",
      "virtualProduction.environmentSuitability": "Environment Suitability",
      "virtualProduction.technicalRequirements": "Technical Requirements",
      "virtualProduction.controlledEnvironments": "Controlled Environments:",
      "virtualProduction.cgiIntegration": "CGI Integration:",
      "virtualProduction.ledVolumeReady": "LED Volume Ready:",
      "virtualProduction.realTimeRendering": "Real-time Rendering:",
      "virtualProduction.motionCapture": "Motion Capture:",
      "virtualProduction.cameraTracking": "Camera Tracking:",
      
      // Evaluation Tab
      "evaluation.title": "Screenplay Evaluation",
      "evaluation.desc": "Comprehensive assessment of screenplay qualities and production metrics",
      "evaluation.noEvaluation": "No screenplay evaluation available",
      "evaluation.emotionScore": "Emotion Score",
      "evaluation.primaryGenre": "Primary Genre",
      "evaluation.duration": "Duration",
      "evaluation.complexity": "Complexity",
      
      // Audience Tab
      "audience.title": "Audience & Platform Analysis",
      "audience.desc": "Target audience demographics and platform suitability assessment",
      "audience.noAnalysis": "No audience analysis available",
      "audience.primaryAgeGroup": "Primary Age Group",
      "audience.primaryRegion": "Primary Region",
      "audience.recommendedRating": "Recommended Rating",
      "audience.global": "Global",
      "analysis.tabs.audience.noData": "No audience analysis available",
      "analysis.tabs.audience.title": "Audience & Platform Analysis",
      "analysis.tabs.audience.subtitle": "Target audience demographics and platform suitability",
      "analysis.tabs.audience.demographics": "Target Demographics",
      "analysis.tabs.audience.age": "Primary Age Group",
      "analysis.tabs.audience.gender": "Gender Skew",
      "analysis.tabs.audience.psychographics": "Psychographics",
      "analysis.tabs.audience.platform": "Platform Suitability",
      "analysis.tabs.audience.primaryPlatform": "Primary Platform",
      "analysis.tabs.audience.secondaryPlatform": "Secondary Platform",

      // Competitive Tab
      "analysis.tabs.competitive.noData": "No competitive analysis available",
      "analysis.tabs.competitive.title": "Competitive Analysis",
      "analysis.tabs.competitive.subtitle": "Market positioning and competitive landscape assessment",
      "analysis.tabs.competitive.score": "Competitive Score",
      "analysis.tabs.competitive.marketPosition": "Market Position",
      "analysis.tabs.competitive.uniqueness": "Uniqueness Score",
      "analysis.tabs.competitive.comparableFilms": "Comparable Films",
      "analysis.tabs.competitive.match": "Match",
      "analysis.tabs.competitive.recommendations": "Strategic Recommendations",

      // Geographic Tab
      "analysis.tabs.geographic.noData": "No geographic analysis available",
      "analysis.tabs.geographic.title": "Geographic Market Analysis",
      "analysis.tabs.geographic.subtitle": "Regional market potential and localization strategies",
      "analysis.tabs.geographic.globalPotential": "Global Potential",
      "analysis.tabs.geographic.appealScore": "Overall Global Appeal Score",
      "analysis.tabs.geographic.universality": "Cultural Universality",
      "analysis.tabs.geographic.localization": "Localization Complexity",
      "analysis.tabs.geographic.topMarkets": "Top Markets",

      // Trend Tab
      "analysis.tabs.trend.noData": "No trend analysis available",
      "analysis.tabs.trend.title": "Trend Analysis",
      "analysis.tabs.trend.subtitle": "Industry trend alignment and timing optimization",
      "analysis.tabs.trend.alignment": "Trend Alignment",
      "analysis.tabs.trend.timing": "Timing Strategy",
      "analysis.tabs.trend.platform": "Best Platform",
      "analysis.tabs.trend.identified": "Identified Trends",

      // Risk Tab
      "analysis.tabs.risk.noData": "No risk analysis available",
      "analysis.tabs.risk.title": "Risk & Opportunity Assessment",
      "analysis.tabs.risk.subtitle": "Project risk profile and strategic opportunities",
      "analysis.tabs.risk.factors": "Risk Factors",
      "analysis.tabs.risk.opportunities": "Opportunities",
      "analysis.tabs.risk.impact": "Impact",
      
      // Custom Analysis Tab
      "custom.title": "Custom Analysis Results",
      "custom.desc": "Specialized analysis results from your custom prompts",
      "custom.noResults": "No custom analysis results yet",
      "custom.runCustom": "Run a custom analysis to see results here",
      "custom.copyText": "Copy Text",
      
      // Common
      "common.tbd": "TBD",
      "common.notScored": "Not Scored",
      "common.general": "General",
      "common.priority": "priority",
      "common.items": "items",
      "common.clickToView": "Click to view details",
      
      // File Uploader
      "uploader.processing": "Processing file...",
      "uploader.dropHere": "Drop your screenplay here",
      "uploader.extracting": "Extracting and cleaning text...",
      "uploader.dragOrClick": "Drag and drop a screenplay file, or click to browse",
      "uploader.supportedFormats": "Supported formats",
      "uploader.selectFile": "Select Screenplay File"
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,
    
    interpolation: {
      escapeValue: false, // React already does escaping
    },
    
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    }
  });

export default i18n;