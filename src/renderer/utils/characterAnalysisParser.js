/**
 * Karakter Analizi Parser
 * Ham AI yanıtlarını yapılandırılmış karakter verilerine dönüştürür
 */

/**
 * Ham karakter analiz metnini parse eder ve yapılandırılmış karakter listesine dönüştürür
 * @param {string} analysisText - Ham analiz metni
 * @returns {Array} Yapılandırılmış karakter dizisi
 */
export function parseCharacterAnalysis(analysisText) {
  if (!analysisText || typeof analysisText !== 'string') {
    console.warn('⚠️ Geçersiz karakter analiz metni');
    return [];
  }

  const characters = [];
  
  // Farklı AI yanıt formatlarını destekle
  // Format 1: "## Karakter Adı" veya "### Karakter Adı"
  // Format 2: "**Karakter Adı**" veya "*Karakter Adı*"
  // Format 3: Numaralı liste "1. Karakter Adı"
  
  // Metni satırlara böl
  const lines = analysisText.split('\n');
  let currentCharacter = null;
  let currentSection = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Boş satırları atla
    if (!line) {
      currentSection = null;
      continue;
    }

    // Yeni karakter başlığı tespit et
    if (isCharacterHeader(line)) {
      // Önceki karakteri kaydet
      if (currentCharacter) {
        characters.push(finalizeCharacter(currentCharacter));
      }
      
      // Yeni karakter oluştur
      const characterName = extractCharacterName(line);
      currentCharacter = {
        name: characterName,
        role: '',
        physicalDescription: '',
        personality: '',
        motivations: '',
        visualStyle: '',
        keyScenes: [],
        relationships: [],
        development: '',
        costumeNotes: '',
        rawSections: {},
        metadata: {
          extractedAt: new Date().toISOString(),
          sourceFormat: detectFormat(line)
        }
      };
      currentSection = null;
      continue;
    }

    // Bölüm başlığı tespit et
    if (currentCharacter && isSectionHeader(line)) {
      currentSection = detectSectionType(line);
      continue;
    }

    // İçerik ekle
    if (currentCharacter && line.length > 0) {
      addContentToCharacter(currentCharacter, line, currentSection);
    }
  }

  // Son karakteri kaydet
  if (currentCharacter) {
    characters.push(finalizeCharacter(currentCharacter));
  }

  console.log(`✅ ${characters.length} karakter başarıyla parse edildi`);
  return characters;
}

/**
 * Satırın karakter başlığı olup olmadığını kontrol eder
 */
function isCharacterHeader(line) {
  // Markdown başlıkları
  if (/^#{1,4}\s+/.test(line)) return true;
  
  // Bold formatlar
  if (/^\*\*[^*]+\*\*/.test(line)) return true;
  if (/^__[^_]+__/.test(line)) return true;
  
  // Numaralı liste
  if (/^\d+\.\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+/.test(line)) return true;
  
  // ALL CAPS (en az 3 karakter)
  if (/^[A-ZÇĞİÖŞÜ\s]{3,}$/.test(line)) return true;
  
  return false;
}

/**
 * Karakter adını başlıktan çıkarır
 */
function extractCharacterName(line) {
  // Markdown başlıklarından
  let name = line.replace(/^#{1,4}\s+/, '');
  
  // Bold formatlardan
  name = name.replace(/^\*\*([^*]+)\*\*/, '$1');
  name = name.replace(/^__([^_]+)__/, '$1');
  
  // Numaralı listeden
  name = name.replace(/^\d+\.\s+/, '');
  
  // Parantez içindeki ek bilgileri temizle
  name = name.replace(/\([^)]*\)/g, '').trim();
  
  // Özel karakterleri temizle
  name = name.replace(/[*_#]/g, '').trim();
  
  return name;
}

/**
 * Format tipini tespit eder
 */
function detectFormat(line) {
  if (/^#{1,4}\s+/.test(line)) return 'markdown-heading';
  if (/^\*\*/.test(line)) return 'markdown-bold';
  if (/^\d+\./.test(line)) return 'numbered-list';
  if (/^[A-Z\s]{3,}$/.test(line)) return 'all-caps';
  return 'unknown';
}

/**
 * Satırın bölüm başlığı olup olmadığını kontrol eder
 */
function isSectionHeader(line) {
  const sectionKeywords = [
    'rol', 'role', 'pozisyon', 'position',
    'fiziksel', 'physical', 'görünüm', 'appearance', 'dış görünüş',
    'kişilik', 'personality', 'karakter', 'character traits',
    'motivasyon', 'motivation', 'amaç', 'goal',
    'görsel', 'visual', 'stil', 'style',
    'sahne', 'scene', '장면',
    'ilişki', 'relationship', 'relation',
    'gelişim', 'development', 'arc',
    'kostüm', 'costume', 'giyim', 'wardrobe',
    'özellik', 'trait', 'feature'
  ];
  
  const lowerLine = line.toLowerCase();
  
  // Bold veya başlık formatında mı?
  const isFormatted = /^\*\*|^__|\*\*$|__$|^###|^##/.test(line);
  
  // Anahtar kelime içeriyor mu?
  const hasKeyword = sectionKeywords.some(keyword => 
    lowerLine.includes(keyword.toLowerCase())
  );
  
  // İki nokta üst üste ile bitiyor mu?
  const endsWithColon = line.endsWith(':');
  
  return (isFormatted && hasKeyword) || (hasKeyword && endsWithColon) || 
         (line.startsWith('- ') && hasKeyword);
}

/**
 * Bölüm tipini tespit eder
 */
function detectSectionType(line) {
  const lowerLine = line.toLowerCase();
  
  if (/rol|role|pozisyon|position/.test(lowerLine)) return 'role';
  if (/fiziksel|physical|görünüm|appearance|dış görünüş/.test(lowerLine)) return 'physical';
  if (/kişilik|personality|karakter özellikleri/.test(lowerLine)) return 'personality';
  if (/motivasyon|motivation|amaç|goal/.test(lowerLine)) return 'motivation';
  if (/görsel|visual|stil|style/.test(lowerLine)) return 'visualStyle';
  if (/sahne|scene/.test(lowerLine)) return 'scenes';
  if (/ilişki|relationship/.test(lowerLine)) return 'relationships';
  if (/gelişim|development|arc/.test(lowerLine)) return 'development';
  if (/kostüm|costume|giyim|wardrobe/.test(lowerLine)) return 'costume';
  
  return 'other';
}

/**
 * İçeriği karaktere ekler
 */
function addContentToCharacter(character, content, section) {
  // Madde işaretlerini ve numaraları temizle
  const cleanContent = content
    .replace(/^[-*•]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .trim();
  
  if (!cleanContent) return;
  
  // Bölüme göre içerik ekle
  switch (section) {
    case 'role':
      character.role += (character.role ? ' ' : '') + cleanContent;
      break;
    case 'physical':
      character.physicalDescription += (character.physicalDescription ? '\n' : '') + cleanContent;
      break;
    case 'personality':
      character.personality += (character.personality ? '\n' : '') + cleanContent;
      break;
    case 'motivation':
      character.motivations += (character.motivations ? '\n' : '') + cleanContent;
      break;
    case 'visualStyle':
      character.visualStyle += (character.visualStyle ? '\n' : '') + cleanContent;
      break;
    case 'scenes':
      character.keyScenes.push(cleanContent);
      break;
    case 'relationships':
      character.relationships.push(cleanContent);
      break;
    case 'development':
      character.development += (character.development ? '\n' : '') + cleanContent;
      break;
    case 'costume':
      character.costumeNotes += (character.costumeNotes ? '\n' : '') + cleanContent;
      break;
    default:
      // Bilinmeyen bölümleri rawSections'a kaydet
      const key = section || 'general';
      if (!character.rawSections[key]) {
        character.rawSections[key] = '';
      }
      character.rawSections[key] += (character.rawSections[key] ? '\n' : '') + cleanContent;
  }
}

/**
 * Karakteri sonlandırır ve temizler
 */
function finalizeCharacter(character) {
  // Boş alanları temizle
  Object.keys(character).forEach(key => {
    if (typeof character[key] === 'string') {
      character[key] = character[key].trim();
    }
  });
  
  // Eğer fiziksel tanım yoksa ama rawSections'da varsa oradan al
  if (!character.physicalDescription && character.rawSections.general) {
    const lines = character.rawSections.general.split('\n');
    // İlk 2-3 satırı fiziksel tanım olarak kabul et
    character.physicalDescription = lines.slice(0, 3).join('\n');
  }
  
  // Görsel prompt oluştur
  character.visualPrompt = generateVisualPrompt(character);
  
  // Metadata güncelle
  character.metadata.completeness = calculateCompleteness(character);
  character.metadata.wordCount = countWords(character);
  
  return character;
}

/**
 * Karakter için görsel üretim promptu oluşturur
 */
function generateVisualPrompt(character) {
  const parts = [];
  
  if (character.name) {
    parts.push(`Karakter: ${character.name}`);
  }
  
  if (character.role) {
    parts.push(`Rol: ${character.role}`);
  }
  
  if (character.physicalDescription) {
    parts.push(`Fiziksel Özellikler: ${character.physicalDescription}`);
  }
  
  if (character.personality) {
    const personalityShort = character.personality.split('\n')[0];
    parts.push(`Kişilik: ${personalityShort}`);
  }
  
  if (character.visualStyle) {
    parts.push(`Stil: ${character.visualStyle}`);
  }
  
  if (character.costumeNotes) {
    parts.push(`Kostüm: ${character.costumeNotes}`);
  }
  
  return parts.join('. ');
}

/**
 * Karakter bilgisinin tamlık yüzdesini hesaplar
 */
function calculateCompleteness(character) {
  const fields = [
    'name', 'role', 'physicalDescription', 'personality', 
    'motivations', 'visualStyle', 'development'
  ];
  
  let filledFields = 0;
  fields.forEach(field => {
    if (character[field] && character[field].length > 10) {
      filledFields++;
    }
  });
  
  return Math.round((filledFields / fields.length) * 100);
}

/**
 * Karakter bilgisindeki toplam kelime sayısını hesaplar
 */
function countWords(character) {
  let totalWords = 0;
  
  const textFields = [
    'role', 'physicalDescription', 'personality', 
    'motivations', 'visualStyle', 'development', 'costumeNotes'
  ];
  
  textFields.forEach(field => {
    if (character[field]) {
      totalWords += character[field].split(/\s+/).length;
    }
  });
  
  return totalWords;
}

/**
 * Karakter listesini Storyboard modülü için optimize eder
 */
export function optimizeForStoryboard(characters) {
  return characters.map(char => ({
    // Temel bilgiler
    id: generateCharacterId(char.name),
    name: char.name,
    displayName: char.name,
    
    // Görsel bilgiler (Storyboard için kritik)
    visualPrompt: char.visualPrompt,
    physicalDescription: char.physicalDescription,
    visualStyle: char.visualStyle,
    costumeNotes: char.costumeNotes,
    
    // Ek bilgiler (opsiyonel)
    role: char.role,
    personality: char.personality,
    motivations: char.motivations,
    
    // İlişkiler ve sahneler
    keyScenes: char.keyScenes || [],
    relationships: char.relationships || [],
    
    // Metadata
    metadata: {
      ...char.metadata,
      readyForVisualization: char.metadata.completeness >= 50,
      hasVisualDescription: !!(char.physicalDescription || char.visualStyle),
      sourceAnalysis: 'character_analysis'
    }
  }));
}

/**
 * Karakter adından benzersiz ID oluşturur
 */
function generateCharacterId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9çğıöşü]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Karakterleri JSON formatında export eder
 */
export function exportCharactersAsJSON(characters) {
  return JSON.stringify(characters, null, 2);
}

/**
 * Karakterleri özet rapor olarak formatlar
 */
export function generateCharacterSummary(characters) {
  const summary = {
    totalCharacters: characters.length,
    charactersWithVisualDescription: characters.filter(c => c.physicalDescription).length,
    charactersWithVisualStyle: characters.filter(c => c.visualStyle).length,
    averageCompleteness: characters.reduce((sum, c) => sum + c.metadata.completeness, 0) / characters.length,
    readyForVisualization: characters.filter(c => c.metadata.readyForVisualization).length,
    characters: characters.map(c => ({
      name: c.name,
      role: c.role,
      completeness: c.metadata.completeness,
      readyForVisualization: c.metadata.readyForVisualization
    }))
  };
  
  return summary;
}

export default {
  parseCharacterAnalysis,
  optimizeForStoryboard,
  exportCharactersAsJSON,
  generateCharacterSummary
};
