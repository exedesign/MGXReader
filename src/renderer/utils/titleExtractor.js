/**
 * TITLE EXTRACTOR - PDF Metadata & Profile-Based Title Extraction
 * 
 * 3 AŞAMA YAPISI:
 * 1. Dedektiflik (Metadata Okuma): PDF'in hangi yazılımla oluşturulduğunu tespit et
 * 2. Haritalama (Profil Seçimi): Tespit edilen yazılımın margin kurallarını yükle
 * 3. Ölçüm (Koordinat Ayrıştırma): X koordinatlarına göre başlık/bölüm bilgisi çıkar
 */

// SENARYO YAZILIMI FONT SIGNATURE DATABASE
// Her yazılımın kullandığı karakteristik fontlar
const SCREENPLAY_FONT_SIGNATURES = {
  'FINAL_DRAFT': [
    'courierfinal',
    'courier final draft',
    'courierfinal-bold',
    'courierfinal-italic'
  ],
  'CELTX': [
    'courier-prime',
    'courier prime',
    'courierprime'
  ],
  'WRITERDUET': [
    'courier screenplay',
    'courierscreenplay'
  ],
  'FADE_IN': [
    'fadein',
    'fade in'
  ],
  'HIGHLAND': [
    'courier-prime',
    'courier prime'
  ],
  'ARC_STUDIO': [
    'courier',
    'courier new'
  ]
};

// 1. PROFİL HARİTASI (CETVEL AYARLARI)
// Her programın sayfa düzeni farklıdır. pdf2json birimleri ile ölçülür.
const LAYOUT_PROFILES = {
  'FINAL_DRAFT': {
    name: 'Final Draft',
    description: 'Endüstri standardı. Kurallar çok sıkıdır.',
    titlePage: {
      titleY: { min: 15, max: 25 },      // Başlık yukarıda (Y koordinatı)
      authorY: { min: 30, max: 40 },     // Yazar ortada
      centered: true                      // Final Draft başlık sayfası ortalanır
    },
    margins: {
      scene: { max: 4.5 },
      character: { min: 18, max: 28 },
      dialogue: { min: 10, max: 17 }
    }
  },
  'CELTX': {
    name: 'Celtx',
    description: 'Eski popüler yazılım. Boşluklar biraz daha geniştir.',
    titlePage: {
      titleY: { min: 12, max: 28 },
      authorY: { min: 28, max: 45 },
      centered: true
    },
    margins: {
      scene: { max: 5 },
      character: { min: 19, max: 29 },
      dialogue: { min: 9, max: 28 }
    }
  },
  'GENERIC': {
    name: 'Standart / Word',
    description: 'Bilinmeyen kaynak. Hata payı yüksek bırakılır.',
    titlePage: {
      titleY: { min: 10, max: 35 },      // Word'de her şey olabilir
      authorY: { min: 25, max: 50 },
      centered: false                     // Ortalama garantisi yok
    },
    margins: {
      scene: { max: 6 },
      character: { min: 16, max: 32 },
      dialogue: { min: 8, max: 35 }
    }
  }
};

/**
 * PDF METADATA OKUYUCU (Dedektiflik Aşaması)
 * PDF'in kimlik kartına bakarak hangi yazılımla oluşturulduğunu bulur
 * 4-Seviye Tespit: Electron Detection → Font List → Element Fonts → Metadata
 * 
 * @param {object} meta - PDF metadata (pdfData.Meta veya metadata objesi)
 * @param {array} elements - PDF elements array (font bilgisi için)
 * @returns {string} - 'FINAL_DRAFT', 'CELTX', veya 'GENERIC'
 */
function detectScriptSource(meta, elements = []) {
  // DEBUG: Mevcut veriler
  console.log('🔍 detectScriptSource çağrıldı:', { 
    hasMeta: !!meta,
    fontList: meta?.fontList,
    detectedProgram: meta?.detectedProgram,
    elementsLength: elements?.length || 0
  });
  
  // SEVİYE 1: ELECTRON-SIDE DETECTION KONTROLÜ (En hızlı ve en güvenilir)
  if (meta?.detectedProgram && meta.detectedProgram !== 'Unknown') {
    console.log(`🎬 Electron tarafında tespit edildi: ${meta.detectedProgram}`);
    
    // Program ismini profile key'e çevir
    const programMap = {
      'Final Draft': 'FINAL_DRAFT',
      'Celtx / Highland': 'CELTX',
      'WriterDuet': 'FINAL_DRAFT', // WriterDuet Final Draft formatı kullanır
      'Fade In': 'GENERIC',
      'Generic Screenplay': 'GENERIC'
    };
    
    const profileKey = programMap[meta.detectedProgram] || 'GENERIC';
    console.log(`✅ Profile: ${profileKey}`);
    return profileKey;
  }
  
  // SEVİYE 2: FONT LIST KONTROLÜ (metadata.fontList)
  if (meta?.fontList && Array.isArray(meta.fontList)) {
    const fontString = meta.fontList.join('|').toLowerCase();
    console.log(`🔤 Font listesi: ${meta.fontList.join(', ')}`);
    
    // Font signature matching
    for (const [program, signatures] of Object.entries(SCREENPLAY_FONT_SIGNATURES)) {
      for (const signature of signatures) {
        if (fontString.includes(signature)) {
          console.log(`🔍 Font match: "${signature}" → ${program}`);
          const profileMap = {
            'FINAL_DRAFT': 'FINAL_DRAFT',
            'CELTX': 'CELTX',
            'WRITERDUET': 'FINAL_DRAFT',
            'FADE_IN': 'GENERIC',
            'HIGHLAND': 'CELTX',
            'ARC_STUDIO': 'GENERIC'
          };
          return profileMap[program] || 'GENERIC';
        }
      }
    }
  }
  
  // SEVİYE 3: ELEMENT-LEVEL FONT KONTROLÜ (elements array)
  if (elements && elements.length > 0) {
    console.log(`🔍 Element font kontrolü: ${elements.length} element`);
    
    const sampleSize = Math.min(10, elements.length);
    for (let i = 0; i < sampleSize; i++) {
      const el = elements[i];
      const fontName = (el?.fontName || '').toLowerCase();
      
      if (fontName) {
        // Font signature matching
        for (const [program, signatures] of Object.entries(SCREENPLAY_FONT_SIGNATURES)) {
          for (const signature of signatures) {
            if (fontName.includes(signature)) {
              console.log(`🔍 Element font match: "${fontName}" → ${program}`);
              const profileMap = {
                'FINAL_DRAFT': 'FINAL_DRAFT',
                'CELTX': 'CELTX',
                'WRITERDUET': 'FINAL_DRAFT',
                'FADE_IN': 'GENERIC',
                'HIGHLAND': 'CELTX',
                'ARC_STUDIO': 'GENERIC'
              };
              return profileMap[program] || 'GENERIC';
            }
          }
        }
      }
    }
  }
  
  // SEVİYE 4: METADATA STRING KONTROLÜ (Fallback)
  if (meta) {
    const metaString = JSON.stringify(meta).toLowerCase();
    
    if (metaString.includes('final draft')) {
      console.log('📄 Metadata: Final Draft bulundu');
      return 'FINAL_DRAFT';
    }
    if (metaString.includes('celtx')) {
      console.log('📄 Metadata: Celtx bulundu');
      return 'CELTX';
    }
  }
  
  console.log('⚠️ Hiçbir tespit yapılamadı → GENERIC');
  return 'GENERIC';
}

/**
 * LAYOUT PROFILE SELECTOR (Haritalama Aşaması)
 * Tespit edilen kaynağa göre doğru margin profilini yükler
 * 
 * @param {object} metadata - PDF metadata objesi
 * @param {array} elements - PDF elements array (font bilgisi için)
 * @returns {object} - Seçilen layout profile
 */
function selectLayoutProfile(metadata, elements = []) {
  const sourceApp = detectScriptSource(metadata, elements);
  const profile = LAYOUT_PROFILES[sourceApp] || LAYOUT_PROFILES['GENERIC'];
  
  console.log(`✅ Kaynak Tespit: ${sourceApp} (${profile.description})`);
  return profile;
}

/**
 * Dosya adından proje bilgilerini çıkarır (basitleştirilmiş versiyon)
 * @param {string} fileName - Dosya adı
 * @returns {object} - Proje bilgileri
 */
export function extractProjectInfo(fileName) {
  try {
    const cleanName = cleanFileName(fileName);
    
    // Bölüm numarası tespit et
    const chapterInfo = extractChapterInfo(cleanName);
    
    // Proje adını çıkar
    const projectTitle = extractProjectTitle(cleanName, chapterInfo);
    
    return {
      projectTitle: projectTitle || cleanName,
      chapterNumber: chapterInfo.number,
      chapterTitle: chapterInfo.title,
      displayTitle: chapterInfo.number 
        ? `${projectTitle} - ${chapterInfo.title}`
        : projectTitle,
      isMultipart: !!chapterInfo.number
    };
  } catch (error) {
    console.error('Error extracting project info:', error);
    return {
      projectTitle: fileName.replace(/\.[^/.]+$/, ''),
      chapterNumber: null,
      chapterTitle: null,
      displayTitle: fileName.replace(/\.[^/.]+$/, ''),
      isMultipart: false
    };
  }
}

/**
 * Dosya adını temizler
 * @param {string} fileName - Ham dosya adı
 * @returns {string} - Temizlenmiş dosya adı
 */
function cleanFileName(fileName) {
  if (!fileName) return '';

  // Önce dosya yolunu tamamen temizle
  let cleanName = fileName
    .replace(/.*[/\\]([^/\\]+)$/, '$1') // Windows/Unix dosya yollarını kaldır
    .replace(/^[A-Z]:[/\\]/, '') // Windows drive harflerini kaldır (C:\ gibi)
    .replace(/\.[^/.]+$/, '') // Uzantıyı kaldır
    .replace(/[-_]+/g, ' ') // Tire ve alt çizgileri boşluğa çevir
    .replace(/\s+/g, ' ') // Fazla boşlukları tek boşluğa çevir
    .trim();

  // Author/creator isimlerini kaldır (dosya sonunda genellikle bulunur)
  const authorPatterns = [
    /_[A-ZÇĞİİÖŞÜ\s]+$/i,  // _FATİH EKE gibi
    /\s[A-ZÇĞİİÖŞÜ]{2,}\s[A-ZÇĞİİÖŞÜ]{2,}$/i, // FATİH EKE gibi
    /\sEKE$/i, // EKE gibi
    /\sFATİH$/i, // FATİH gibi
  ];
  
  authorPatterns.forEach(pattern => {
    cleanName = cleanName.replace(pattern, '').trim();
  });

  return cleanName;
}

/**
 * Dosya adından bölüm bilgilerini çıkarır
 * @param {string} cleanName - Temizlenmiş dosya adı
 * @returns {object} - Bölüm bilgileri
 */
function extractChapterInfo(cleanName) {
  const chapterPatterns = [
    // Türkçe bölüm kalıpları
    { pattern: /(\d+)\.\s*(?:BÖLÜM|bölüm|BOLUM|bolum)/i, type: 'bölüm' },
    { pattern: /(\d+)\s*(?:BÖLÜM|bölüm|BOLUM|bolum)/i, type: 'bölüm' },
    { pattern: /(?:BÖLÜM|bölüm|BOLUM|bolum)\s*(\d+)/i, type: 'bölüm' },
    
    // İngilizce kalıplar
    { pattern: /(\d+)\.\s*(?:CHAPTER|chapter)/i, type: 'chapter' },
    { pattern: /(\d+)\s*(?:CHAPTER|chapter)/i, type: 'chapter' },
    { pattern: /(?:CHAPTER|chapter)\s*(\d+)/i, type: 'chapter' },
    
    // Episode kalıpları
    { pattern: /(\d+)\.\s*(?:EPISODE|episode|EP|ep)/i, type: 'episode' },
    { pattern: /(?:EPISODE|episode|EP|ep)\s*(\d+)/i, type: 'episode' },
    
    // Season/Episode formatları (S1E1, S01E01 vb.)
    { pattern: /S(\d+)E(\d+)/i, type: 'episode', isSeason: true },
    { pattern: /Season\s*(\d+).*Episode\s*(\d+)/i, type: 'episode', isSeason: true },
    
    // Part kalıpları
    { pattern: /(\d+)\.\s*(?:PART|part|KISIM|kisim)/i, type: 'part' },
    { pattern: /(?:PART|part|KISIM|kisim)\s*(\d+)/i, type: 'part' },
    
    // Sadece numara (dosya sonunda)
    { pattern: /\s(\d+)$/, type: 'bölüm' }
  ];

  for (const { pattern, type, isSeason } of chapterPatterns) {
    const match = cleanName.match(pattern);
    if (match) {
      let number, seasonNumber = null;
      
      if (isSeason) {
        // S1E1 formatı için
        seasonNumber = parseInt(match[1]);
        number = parseInt(match[2]);
      } else {
        number = parseInt(match[1]);
      }
      
      return {
        number: number,
        seasonNumber: seasonNumber,
        title: `${number}. ${type === 'bölüm' ? 'Bölüm' : 
                type === 'chapter' ? 'Chapter' :
                type === 'episode' ? 'Episode' :
                type === 'part' ? 'Part' : 'Bölüm'}`,
        type: type,
        matched: match[0]
      };
    }
  }

  return { number: null, title: null, type: null, matched: null };
}

/**
 * Dosya adından proje başlığını çıkarır
 * @param {string} cleanName - Temizlenmiş dosya adı
 * @param {object} chapterInfo - Bölüm bilgileri
 * @returns {string} - Proje başlığı
 */
function extractProjectTitle(cleanName, chapterInfo) {
  let title = cleanName;
  
  // Bölüm bilgisini kaldır
  if (chapterInfo.matched) {
    title = title.replace(new RegExp(chapterInfo.matched.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').trim();
  }
  
  // Bölüm numarasını da kaldır (ekstra güvenlik)
  if (chapterInfo.number) {
    // Bölüm numarasını farklı formatlarla kaldır
    const patterns = [
      new RegExp(`\\b${chapterInfo.number}\\b`, 'g'),
      new RegExp(`\\s${chapterInfo.number}$`),
      new RegExp(`^${chapterInfo.number}\\s`),
      new RegExp(`\\s${chapterInfo.number}\\s`)
    ];
    patterns.forEach(pattern => {
      title = title.replace(pattern, ' ');
    });
  }
  
  // Yaygın ek/önek'leri temizle
  const cleanupPatterns = [
    /^(senaryo|screenplay|script|draft|taslak)[\s\-_]*/i,
    /[\s\-_]*(senaryo|screenplay|script|draft|taslak)$/i,
    /^(v\d+|version\d+|sürüm\d+|ver\d+)[\s\-_]*/i,
    /[\s\-_]*(v\d+|version\d+|sürüm\d+|ver\d+)$/i,
    /^(final|son|nihai|last)[\s\-_]*/i,
    /[\s\-_]*(final|son|nihai|last)$/i,
    /^(new|yeni)[\s\-_]*/i,
    /[\s\-_]*(new|yeni)$/i,
    // Tire ve noktalarla ayrılmış sayıları kaldır
    /\s*[-_.]\s*\d+\s*$/,
    /^\d+\s*[-_.]\s*/,
    // .pdf artıklarını temizle
    /\.pdf$/i,
    /\s+pdf\s*$/i
  ];
  
  for (const pattern of cleanupPatterns) {
    title = title.replace(pattern, '').trim();
  }
  
  // Fazla boşlukları temizle
  title = title.replace(/\s+/g, ' ').trim();
  
  // Eğer title boş kaldıysa, orijinal dosya adının ilk kısmını kullan
  if (!title) {
    const words = cleanName.split(/\s+/);
    title = words.slice(0, Math.max(1, words.length - 1)).join(' ');
  }
  
  // Tutarlı normalizasyon
  title = normalizeProjectTitle(title);
  
  return toTitleCase(title);
}

/**
 * Proje başlığını normalleştirme (fuzzy matching için)
 * @param {string} title - Ham proje başlığı
 * @returns {string} - Normalleştirilmiş başlık
 */
function normalizeProjectTitle(title) {
  if (!title) return '';
  
  // Daha az agresif normalizasyon
  return title
    .toLowerCase()
    .replace(/[''‛]/g, "'") // Normalize apostrophes  
    .replace(/[iı̇]/g, 'i') // Normalize Turkish i
    .replace(/[çğöşü]/g, match => ({ 'ç': 'c', 'ğ': 'g', 'ö': 'o', 'ş': 's', 'ü': 'u' })[match] || match)
    .replace(/\s+/g, ' ') // Normalize spaces
    .replace(/['nin|'in|nin|in]/g, '') // Remove Turkish possessive suffixes  
    .replace(/\.pdf$/i, '') // Remove .pdf
    .replace(/[^\w\s]/g, ' ') // Replace special chars with space (less aggressive)
    .replace(/\s+/g, ' ') // Normalize spaces again
    .trim();
}

/**
 * Metni Title Case'e çevirir
 * @param {string} text - Ham metin
 * @returns {string} - Title Case metin  
 */
function toTitleCase(text) {
  if (!text) return '';
  
  const smallWords = ['the', 'a', 'an', 'and', 'or', 'but', 'of', 'in', 'on', 'at', 'to', 'for', 'by', 'with', 've', 'ile', 'veya', 'ama', 'için', 'den', 'da', 'de', 'bir'];
  
  return text
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      // İlk ve son kelime her zaman büyük harfle başlar
      if (index === 0 || index === text.split(' ').length - 1) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      // Küçük kelimeler küçük kalır
      if (smallWords.includes(word.toLowerCase())) {
        return word.toLowerCase();
      }
      // Diğer kelimeler büyük harfle başlar
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Birden fazla dosyadan ortak proje adını bulur
 * @param {string[]} fileNames - Dosya adları
 * @returns {string|null} - Ortak proje adı
 */
export function findCommonProjectTitle(fileNames) {
  if (!fileNames || fileNames.length < 2) {
    return fileNames?.[0] ? extractProjectInfo(fileNames[0]).projectTitle : null;
  }

  // Her dosyadan proje bilgilerini çıkar
  const projects = fileNames.map(name => extractProjectInfo(name));
  
  // Ortak kelimeleri bul
  const firstProject = projects[0].projectTitle.toLowerCase().split(' ');
  const commonWords = firstProject.filter(word => 
    projects.every(project => 
      project.projectTitle.toLowerCase().includes(word) && word.length > 2
    )
  );

  if (commonWords.length > 0) {
    return toTitleCase(commonWords.join(' '));
  }

  // Ortak prefix bul
  let commonPrefix = '';
  const minLength = Math.min(...projects.map(p => p.projectTitle.length));
  
  for (let i = 0; i < minLength; i++) {
    const char = projects[0].projectTitle[i].toLowerCase();
    if (projects.every(p => p.projectTitle[i].toLowerCase() === char)) {
      commonPrefix += projects[0].projectTitle[i];
    } else {
      break;
    }
  }
  
  // Son kelime sınırında kes
  const lastSpace = commonPrefix.lastIndexOf(' ');
  if (lastSpace > 0) {
    commonPrefix = commonPrefix.substring(0, lastSpace);
  }

  return commonPrefix.trim().length > 2 ? commonPrefix.trim() : projects[0].projectTitle;
}

/**
 * Ana başlık çıkarma fonksiyonu - PDF Metadata & Profile-Based Extraction
 * @param {string} text - PDF metni
 * @param {object} metadata - PDF metadata (creator, title, author vb.)
 * @param {string|string[]} fileNames - Dosya adı/adları
 * @param {number} fileIndex - Dosya index'i (çoklu dosya için)
 * @returns {string} - En uygun başlık
 */
export function extractBestTitle(text, metadata = {}, fileNames = null, fileIndex = 0) {
  try {
    // ADIM 1: DEDEKTİFLİK - Kaynak tespit et (font + metadata)
    const elements = metadata?.elements || [];
    
    console.log('🎯 extractBestTitle çağrıldı - metadata yapısı:', { 
      metadataKeys: Object.keys(metadata || {}),
      hasElements: !!elements,
      elementsLength: elements.length,
      firstElementSample: elements[0]
    });
    
    const profile = selectLayoutProfile(metadata, elements);
    
    console.log('🎯 extractBestTitle çağrıldı:', { 
      hasText: !!text, 
      fileNames, 
      fileIndex,
      source: profile.name,
      elementCount: elements.length
    });
    
    // ADIM 2: METADATA'DAN BAŞLIK ÇIKART (Varsa)
    let titleFromMetadata = null;
    if (metadata?.title && metadata.title.length > 3) {
      titleFromMetadata = metadata.title.trim();
      console.log('📄 Metadata başlık bulundu:', titleFromMetadata);
    }
    
    // Dosya adını al
    let fileName = '';
    if (typeof fileNames === 'string') {
      fileName = fileNames;
    } else if (Array.isArray(fileNames) && fileNames.length > 0) {
      fileName = fileNames[0];
    } else {
      fileName = 'Bilinmeyen Dokuman';
    }
    
    // Sadece dosya adını al, yolu kaldır
    const cleanedFileName = fileName.split(/[\\\/]/).pop().replace(/\.[^.]+$/, '');
    console.log('📁 Temizlenmiş dosya adı:', cleanedFileName);
    
    // ADIM 3: PRİORİTE SİSTEMİ
    // 1. Metadata başlık (varsa ve güvenilirse)
    // 2. Dosya adı (her zaman var)
    let projectTitle = titleFromMetadata || cleanedFileName;
    
    // Dosya adında bölüm numarası varsa temizle
    projectTitle = projectTitle
      .replace(/[-_\s]*(?:bölüm|bolum|chapter|part|episode|ep)[-_\s]*\d+/gi, '')
      .replace(/[-_\s]*\d+[-_\s]*(?:bölüm|bolum|chapter|part|episode|ep)/gi, '')
      .replace(/[-_\s]*S\d+E\d+/gi, '') // S1E1 formatını temizle
      .replace(/[-_\s]*\d+$/gi, '') // Sondaki sayıları kaldır
      .replace(/[-_\s]+$/, '') // Sondaki tireli boşlukları temizle
      .trim();
    
    // Eğer çok kısa kaldıysa orijinal adı kullan
    if (projectTitle.length < 3) {
      projectTitle = cleanedFileName;
    }
    
    // Bölüm numarasını hesapla (1'den başlar)
    const chapterNumber = fileIndex + 1;
    const chapterTitle = `${chapterNumber}. Bölüm`;
    
    console.log(`📋 Proje: "${projectTitle}" - ${chapterTitle} [${profile.name}]`);
    
    // Eski API uyumluluğu için string döndür
    return `${projectTitle} - ${chapterTitle}`;
    
  } catch (error) {
    console.error('Error in extractBestTitle:', error);
    return `Dokuman ${fileIndex + 1}`;
  }
}

/**
 * PDF içeriğinden başlık ve bölüm bilgisi çıkarır
 * @param {string} text - PDF metni
 * @returns {string|null} - Çıkarılan başlık veya null
 */
function extractTitleFromContent(text) {
  if (!text || typeof text !== 'string') return null;
  
  // İlk 2 sayfayı analiz et (yaklaşık ilk 3000 karakter)
  const firstPages = text.substring(0, 3000);
  
  // Satırlara böl ve temizle
  const lines = firstPages
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 2);
  
  console.log('📖 Analyzing content for title patterns...');
  console.log('First 15 lines:', lines.slice(0, 15));
  
  // 1. İki satırlı format: Başlık + Bölüm
  const twoLineResult = extractTwoLinePattern(lines);
  if (twoLineResult) return twoLineResult;
  
  // 2. Tek satırlı format
  const singleLineResult = extractSingleLinePattern(lines);
  if (singleLineResult) return singleLineResult;
  
  // 3. 🔥 YENİ: Sektörel keyword-based detection
  const keywordResult = extractWithSectorKeywords(lines);
  if (keywordResult) return keywordResult;
  
  // 4. 🔥 YENİ: Semantic title detection
  const semanticResult = extractSemanticTitle(lines);
  if (semanticResult) return semanticResult;
  
  console.log('❌ No title pattern found in content');
  return null;
}

/**
 * İki satırlı pattern analizi
 * @param {string[]} lines - Satırlar 
 * @returns {string|null} - Başlık veya null
 */
function extractTwoLinePattern(lines) {
  for (let i = 0; i < Math.min(lines.length - 1, 15); i++) {
    const currentLine = lines[i];
    const nextLine = lines[i + 1];
    
    if (currentLine && currentLine.length > 5 && currentLine.length < 100) {
      if (nextLine && isChapterLine(nextLine)) {
        const chapterInfo = extractChapterInfoFromLine(nextLine);
        const projectTitle = cleanContentTitle(currentLine);
        
        if (projectTitle && chapterInfo) {
          const result = `${projectTitle} - ${chapterInfo.title}`;
          console.log('✅ Two-line pattern found:', {
            line1: currentLine,
            line2: nextLine,
            result: result
          });
          return result;
        }
      }
    }
  }
  return null;
}

/**
 * Tek satırlı pattern analizi
 * @param {string[]} lines - Satırlar
 * @returns {string|null} - Başlık veya null
 */
function extractSingleLinePattern(lines) {
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i];
    if (line && line.length > 10 && line.length < 150) {
      const result = extractFromSingleLine(line);
      if (result) {
        console.log('✅ Single-line pattern found:', { line: line, result: result });
        return result;
      }
    }
  }
  return null;
}

/**
 * 🔥 Sektörel keyword'lerle başlık çıkarma
 * @param {string[]} lines - Satırlar
 * @returns {string|null} - Başlık veya null
 */
function extractWithSectorKeywords(lines) {
  // Film/dizi sektörüne ait keyword'ler
  const sectorKeywords = {
    // Türkçe
    'turkish': [
      'senaryo', 'dizi', 'film', 'bölüm', 'episode', 'sezon', 'chapter',
      'hikaye', 'öykü', 'hikayesi', 'serisi', 'macera', 'macerası',
      'tiyatro', 'oyun', 'roman', 'kitap', 'eseri', 'yapımı',
      'senaryosu', 'filmi', 'dizisi', 'belgesel'
    ],
    // İngilizce
    'english': [
      'screenplay', 'script', 'series', 'movie', 'film', 'episode', 'season',
      'story', 'tale', 'adventure', 'drama', 'thriller', 'comedy',
      'documentary', 'pilot', 'finale', 'production'
    ]
  };
  
  // Başlık pattern'leri - sektörel keyword'ler içeren satırlar
  const titlePatterns = [
    // "GUSTAV MAIER'IN TUHAF ÖYKÜSÜ"
    /^[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ\s'İNIN]{8,80}$/i,
    // "Gustav Maier'in Hikayesi"  
    /^[A-ZÇĞİÖŞÜ][a-zçğıöşü]*(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü']*){1,8}$/,
    // Tam büyük harf başlıklar
    /^[A-ZÇĞİÖŞÜ\s']{10,60}$/
  ];
  
  console.log('🔍 Searching for sector keywords...');
  
  // Her satırı keyword analizi için kontrol et
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i];
    if (!line || line.length < 5 || line.length > 100) continue;
    
    // Bu satırda sektörel keyword var mı?
    const hasKeyword = [...sectorKeywords.turkish, ...sectorKeywords.english]
      .some(keyword => line.toLowerCase().includes(keyword.toLowerCase()));
    
    if (hasKeyword) {
      console.log(`🎯 Sector keyword found in line ${i}: "${line}"`);
      
      // Potansiyel başlık satırlarını ara (keyword'lü satırdan önce/sonra)
      const candidateLines = [
        lines[Math.max(0, i-2)],
        lines[Math.max(0, i-1)], 
        line,
        lines[i+1],
        lines[i+2]
      ].filter(Boolean);
      
      for (const candidate of candidateLines) {
        // Bu satır başlık pattern'ine uyuyor mu?
        const matchesPattern = titlePatterns.some(pattern => pattern.test(candidate));
        
        if (matchesPattern && candidate !== line) {
          // Bölüm bilgisi araştır
          const chapterInfo = findChapterInfoNearby(lines, candidateLines.indexOf(candidate) + i - 2);
          const cleanTitle = cleanContentTitle(candidate);
          
          if (cleanTitle) {
            const result = chapterInfo 
              ? `${cleanTitle} - ${chapterInfo.title}`
              : cleanTitle;
            
            console.log('✅ Sector keyword-based title found:', {
              titleLine: candidate,
              keywordLine: line,
              chapterInfo: chapterInfo,
              result: result
            });
            return result;
          }
        }
      }
    }
  }
  
  return null;
}

/**
 * 🔥 Semantic başlık tespiti (içerik analizi)
 * @param {string[]} lines - Satırlar
 * @returns {string|null} - Başlık veya null
 */
function extractSemanticTitle(lines) {
  console.log('🧠 Attempting semantic title detection...');
  
  // Başlık olabilecek satır özellikleri
  const titleIndicators = {
    // Pozitif sinyaller (başlık olma olasılığını artırır)
    positive: [
      /^[A-ZÇĞİÖŞÜ]/,  // Büyük harfle başlama
      /[A-ZÇĞİÖŞÜ\s']{3,}/,  // Çoğunlukla büyük harf
      /\b(?:hikaye|öykü|serüven|macera|dram|komedi)\b/i, // Tür belirten kelimeler
      /\b(?:bir|the|a)\s+(?:hikaye|story|tale)/i, // "Bir hikaye" gibi
      /[''](?:in|nin|nın|nun)\b/i  // Türkçe iyelik ekleri
    ],
    // Negatif sinyaller (başlık olma olasılığını düşürür)
    negative: [
      /\d{2,}/,  // Çok sayı içeren
      /\b(?:sayfa|page|tarih|date|saat|time)\b/i,  // Metadata benzeri
      /^(?:INT|EXT)\./,  // Senaryo sahne tanımları
      /^\s*-\s*/,  // Tire ile başlayan
      /\b(?:fade|cut|close|wide|medium)\b/i  // Senaryo teknikleri
    ]
  };
  
  const candidates = [];
  
  // İlk 15 satırı değerlendir
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const line = lines[i];
    if (!line || line.length < 5 || line.length > 80) continue;
    
    let score = 0;
    
    // Pozitif skor hesapla
    titleIndicators.positive.forEach(pattern => {
      if (pattern.test(line)) score += 1;
    });
    
    // Negatif skor düş
    titleIndicators.negative.forEach(pattern => {
      if (pattern.test(line)) score -= 2;
    });
    
    // Satır pozisyonu bonusu (üst satırlar tercih)
    score += Math.max(0, (10 - i) * 0.1);
    
    if (score > 0.5) {
      candidates.push({ line, score, index: i });
    }
  }
  
  if (candidates.length > 0) {
    // En yüksek skorlu adayı seç
    const best = candidates.sort((a, b) => b.score - a.score)[0];
    
    // Yakında bölüm bilgisi var mı?
    const chapterInfo = findChapterInfoNearby(lines, best.index);
    const cleanTitle = cleanContentTitle(best.line);
    
    if (cleanTitle) {
      const result = chapterInfo 
        ? `${cleanTitle} - ${chapterInfo.title}`
        : cleanTitle;
      
      console.log('✅ Semantic title detection successful:', {
        titleLine: best.line,
        score: best.score,
        chapterInfo: chapterInfo,
        result: result
      });
      return result;
    }
  }
  
  return null;
}

/**
 * Belirli bir satırın yakınında bölüm bilgisi arar
 * @param {string[]} lines - Tüm satırlar
 * @param {number} index - Merkez satır indeksi
 * @returns {object|null} - Bölüm bilgileri veya null
 */
function findChapterInfoNearby(lines, index) {
  // Önceki ve sonraki 5 satırı kontrol et (daha geniş arama)
  for (let offset = -5; offset <= 5; offset++) {
    const checkIndex = index + offset;
    if (checkIndex >= 0 && checkIndex < lines.length) {
      const line = lines[checkIndex];
      if (line && isChapterLine(line)) {
        const chapterInfo = extractChapterInfoFromLine(line);
        
        // 🔥 YENİ: Bölüm bilgisi ile birlikte context de ekle
        if (chapterInfo) {
          // Yakındaki satırlarda ek bilgi ara
          const contextLines = [];
          for (let contextOffset = -2; contextOffset <= 2; contextOffset++) {
            const contextIndex = checkIndex + contextOffset;
            if (contextIndex >= 0 && contextIndex < lines.length && contextIndex !== checkIndex) {
              const contextLine = lines[contextIndex]?.trim();
              if (contextLine && contextLine.length > 5 && contextLine.length < 50) {
                // Tarih, sayfa numarası değilse ekle
                if (!/^\d+$/.test(contextLine) && !/\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4}/.test(contextLine)) {
                  contextLines.push(contextLine);
                }
              }
            }
          }
          
          chapterInfo.context = contextLines;
          return chapterInfo;
        }
      }
    }
  }
  return null;
}

/**
 * Tek satırdan başlık çıkarır
 * @param {string} line - Satır
 * @returns {string|null} - Başlık veya null
 */
function extractFromSingleLine(line) {
  // Çeşitli tek satır formatları
  const singleLinePatterns = [
    // "GUSTAV MAIER'IN TUHAF ÖYKÜSÜ - 1. BÖLÜM"
    /^(.+?)\s*[-–—]\s*(\d+)\.\s*(?:BÖLÜM|bölüm|BOLUM|bolum|CHAPTER|chapter)/i,
    // "GUSTAV MAIER'IN TUHAF ÖYKÜSÜ 1. BÖLÜM"
    /^(.+?)\s+(\d+)\.\s*(?:BÖLÜM|bölüm|BOLUM|bolum|CHAPTER|chapter)/i,
    // "1. BÖLÜM: GUSTAV MAIER'IN TUHAF ÖYKÜSÜ"
    /^(\d+)\.\s*(?:BÖLÜM|bölüm|BOLUM|bolum|CHAPTER|chapter):\s*(.+)/i
  ];
  
  for (const pattern of singleLinePatterns) {
    const match = line.match(pattern);
    if (match) {
      const isReversed = pattern.source.includes('^(\\d+)');
      const projectTitle = cleanContentTitle(isReversed ? match[2] : match[1]);
      const chapterNum = parseInt(isReversed ? match[1] : match[2]);
      
      if (projectTitle && chapterNum) {
        return `${projectTitle} - ${chapterNum}. Bölüm`;
      }
    }
  }
  
  return null;
}

/**
 * Satırın bölüm satırı olup olmadığını kontrol eder
 * @param {string} line - Satır
 * @returns {boolean} - Bölüm satırı ise true
 */
function isChapterLine(line) {
  if (!line || line.length > 50) return false;
  
  const chapterPatterns = [
    // Türkçe formatlar - mevcut
    /^\d+\.\s*(?:BÖLÜM|bölüm|BOLUM|bolum)$/i,
    /^(?:BÖLÜM|bölüm|BOLUM|bolum)\s*\d+$/i,
    /^\d+\.\s*(?:KISIM|kisim|PART|part)$/i,
    
    // İngilizce formatlar - mevcut
    /^\d+\.\s*(?:CHAPTER|chapter)$/i,
    /^(?:CHAPTER|chapter)\s*\d+$/i,
    
    // Episode formatları - geliştirildi
    /^\d+\.\s*(?:EPISODE|episode|EP|ep)$/i,
    /^(?:EPISODE|episode|EP|ep)\s*\d+$/i,
    /^S\d+E\d+$/i, // Season/Episode format
    
    // Genel sayısal formatlar
    /^(?:PART|part|PARCA|parça)\s*\d+$/i,
    /^\d+\.\s*(?:ACT|act|PERDE|perde)$/i,
    
    // 🔥 YENİ: Daha esnek pattern'ler
    /^\d+\s*[-\.\s]\s*(?:BÖLÜM|bölüm|CHAPTER|chapter|EPISODE|episode|PART|part)/i,
    /(?:BÖLÜM|bölüm|CHAPTER|chapter|EPISODE|episode|PART|part)\s*[-\.\s]\s*\d+/i,
    // Çoklu dil sahne desteği (boşluklu veya boşluksuz): SAHNE1, SCENE1, SZENE1, vb.
    /^(?:SCENE|scene|SAHNE|sahne|SZENE|szene|SCÈNE|scène|ESCENA|escena|SCENA|scena|CENA|cena)\s*\d+$/i
  ];
  
  return chapterPatterns.some(pattern => pattern.test(line.trim()));
}

/**
 * Satırdan bölüm bilgisi çıkarır
 * @param {string} line - Bölüm satırı
 * @returns {object|null} - Bölüm bilgileri veya null
 */
function extractChapterInfoFromLine(line) {
  const cleanLine = line.trim();
  
  // Çeşitli bölüm formatları
  const patterns = [
    { pattern: /^(\d+)\.\s*(?:BÖLÜM|bölüm|BOLUM|bolum)$/i, type: 'bölüm' },
    { pattern: /^(?:BÖLÜM|bölüm|BOLUM|bolum)\s*(\d+)$/i, type: 'bölüm' },
    { pattern: /^(\d+)\.\s*(?:CHAPTER|chapter)$/i, type: 'chapter' },
    { pattern: /^(?:CHAPTER|chapter)\s*(\d+)$/i, type: 'chapter' },
    { pattern: /^S(\d+)E(\d+)$/i, type: 'episode', isSeason: true },
    { pattern: /^(?:EPISODE|episode|EP|ep)\s*(\d+)$/i, type: 'episode' }
  ];
  
  for (const { pattern, type, isSeason } of patterns) {
    const match = cleanLine.match(pattern);
    if (match) {
      if (isSeason) {
        return {
          number: parseInt(match[2]),
          seasonNumber: parseInt(match[1]),
          title: `${match[2]}. Episode`,
          type: type
        };
      } else {
        return {
          number: parseInt(match[1]),
          title: `${match[1]}. ${type === 'bölüm' ? 'Bölüm' : type === 'chapter' ? 'Chapter' : 'Episode'}`,
          type: type
        };
      }
    }
  }
  
  return null;
}

/**
 * İçerikten çıkarılan başlığı temizler
 * @param {string} title - Ham başlık
 * @returns {string} - Temizlenmiş başlık
 */
function cleanContentTitle(title) {
  if (!title) return '';
  
  let cleaned = title
    .trim()
    .replace(/^["']|["']$/g, '') // Tırnak işaretlerini kaldır
    .replace(/^\s*[•·▪▫]\s*/, '') // Bullet point'leri kaldır
    .replace(/^\s*[-=_]+\s*/, '') // Başlangıçtaki çizgileri kaldır
    .replace(/\s+/g, ' ') // Fazla boşlukları temizle
    .trim();
  
  // 🔥 YENİ: Sektörel temizlik
  // Senaryo terimlerini kaldır
  const sectorTermsToRemove = [
    /\b(?:senaryo|screenplay|script|senaryosu)\s*:?\s*/i,
    /\b(?:dizi|series|film|movie|belgesel|documentary)\s*:?\s*/i,
    /\b(?:by|tarafından|yazan|yazarı)\s+[A-Z][a-z]+\s+[A-Z][a-z]+/i, // "By John Doe" gibi
    /\b(?:original|orijinal|yapım|production)\s*/i,
    /\b(?:final|draft|taslak|version|versiyon)\s*/i,
    /\b(?:copyright|©|telif|hakkı|saklıdır)\s*/i
  ];
  
  sectorTermsToRemove.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '').trim();
  });
  
  // Eğer tamamen büyük harfse, Title Case'e çevir
  if (cleaned === cleaned.toUpperCase() && cleaned.length > 3) {
    cleaned = toTitleCase(cleaned);
  }
  
  // Çok kısa veya çok uzun başlıkları filtrele
  if (cleaned.length < 3 || cleaned.length > 100) {
    return '';
  }
  
  // Sadece sayı ve noktalama içeriyorsa geçersiz
  if (/^[\d\s\.\-_]+$/.test(cleaned)) {
    return '';
  }
  
  // Tarih formatını temizle (2024, 12.01.2024 gibi)
  cleaned = cleaned.replace(/\b(?:19|20)\d{2}\b/g, '').trim();
  cleaned = cleaned.replace(/\b\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4}\b/g, '').trim();
  
  return cleaned;
}

/**
 * Eski API uyumluluğu için - dosya adından başlık çıkarma
 * @param {string|string[]} fileNames - Dosya adı/adları
 * @returns {string|null} - Çıkarılan başlık
 */
export function extractTitleFromFilename(fileNames) {
  if (Array.isArray(fileNames)) {
    return findCommonProjectTitle(fileNames);
  } else {
    return extractProjectInfo(fileNames).displayTitle;
  }
}

export default {
  extractProjectInfo,
  extractBestTitle,
  extractTitleFromFilename,
  findCommonProjectTitle
};